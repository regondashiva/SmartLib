import { prisma } from '../../config/prisma.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors.js';
import { booksService } from '../books/books.service.js';
import { ConfigDataType, Prisma } from '@prisma/client';

// ============================================================================
// 3.3 Provider-Neutral Net Cataloguing Adapter Interface & Mock Implementation
// ============================================================================

export interface NormalizedBibliographicMetadata {
  title: string;
  subtitle?: string;
  isbn13: string;
  isbn10?: string;
  authors: string[];
  publisherName: string;
  publicationYear: number;
  edition: string;
  subject: string;
  categoryName: string;
  classification: string;
  callNumber: string;
  language: string;
  pageCount: number;
  description: string;
  coverImageUrl?: string;
  sourceProvider: string;
  providerMode: 'MOCK_ADAPTER' | 'LIVE_PROVIDER';
}

export interface NetCataloguingProviderAdapter {
  readonly providerId: string;
  readonly providerName: string;
  readonly mode: 'MOCK_ADAPTER' | 'LIVE_PROVIDER';
  lookupByIsbn(isbn: string): Promise<NormalizedBibliographicMetadata>;
}

const MOCK_NET_CATALOG_REGISTRY: Record<string, Omit<NormalizedBibliographicMetadata, 'sourceProvider' | 'providerMode'>> = {
  '9780134685991': {
    title: 'Effective Java',
    subtitle: 'Best Practices for the Java Platform',
    isbn13: '9780134685991',
    isbn10: '0134685997',
    authors: ['Joshua Bloch'],
    publisherName: 'Addison-Wesley Professional',
    publicationYear: 2018,
    edition: '3rd Edition',
    subject: 'Java (Computer program language) / Object-oriented programming',
    categoryName: 'Computer Science',
    classification: '005.133',
    callNumber: 'QA76.73.J38 B57 2018',
    language: 'English',
    pageCount: 416,
    description: 'Comprehensive guide to Java platform best practices, generics, lambdas, streams, and concurrency.',
  },
  '9780262046305': {
    title: 'Introduction to Algorithms',
    subtitle: 'CLRS Fourth Edition',
    isbn13: '9780262046305',
    isbn10: '026204630X',
    authors: ['Thomas H. Cormen', 'Charles E. Leiserson', 'Ronald L. Rivest', 'Clifford Stein'],
    publisherName: 'MIT Press',
    publicationYear: 2022,
    edition: '4th Edition',
    subject: 'Computer algorithms / Data structures',
    categoryName: 'Computer Science',
    classification: '005.1',
    callNumber: 'QA76.6 .C662 2022',
    language: 'English',
    pageCount: 1312,
    description: 'Rigorous and comprehensive textbook covering modern algorithm design and analysis.',
  },
};

export class MockNetCataloguingAdapter implements NetCataloguingProviderAdapter {
  public readonly providerId = 'smartlib-open-biblio-mock';
  public readonly providerName = 'SmartLib Provider-Neutral Z39.50 / MARC21 Mock Adapter';
  public readonly mode = 'MOCK_ADAPTER' as const;

  async lookupByIsbn(rawIsbn: string): Promise<NormalizedBibliographicMetadata> {
    const cleaned = rawIsbn.replace(/[^0-9Xx]/g, '').toUpperCase();
    if (cleaned.length !== 10 && cleaned.length !== 13) {
      throw new ValidationError(
        `Invalid ISBN '${rawIsbn}'. Provide a valid 10-digit or 13-digit ISBN for Net Cataloguing lookup.`
      );
    }

    const preset = MOCK_NET_CATALOG_REGISTRY[cleaned];
    if (preset) {
      return {
        ...preset,
        sourceProvider: this.providerName,
        providerMode: this.mode,
      };
    }

    const isbn13 = cleaned.length === 13 ? cleaned : `978${cleaned.slice(0, 9)}5`;
    return {
      title: `Net-Catalogued Academic Monograph (ISBN ${isbn13})`,
      subtitle: 'Imported via Provider-Neutral Bibliographic Adapter',
      isbn13,
      isbn10: cleaned.length === 10 ? cleaned : undefined,
      authors: ['Dr. S. Ranganathan', 'Prof. M. Dewey'],
      publisherName: 'International University Press',
      publicationYear: 2025,
      edition: '1st Edition',
      subject: 'Library Information Science & Digital Archives',
      categoryName: 'Computer Science',
      classification: '025.04',
      callNumber: `Z678.9 .N48 ${isbn13.slice(-4)}`,
      language: 'English',
      pageCount: 340,
      description: `Standardized bibliographic record synthesized by ${this.providerName} for offline/deterministic evaluation.`,
      sourceProvider: this.providerName,
      providerMode: this.mode,
    };
  }
}

export interface PersonalBookshelfItem {
  bookId: string;
  shelfName: string;
  notes?: string;
  addedAt: string;
}

export class OpacService {
  private netAdapter: NetCataloguingProviderAdapter = new MockNetCataloguingAdapter();

  /**
   * 3.1 & 3.2 Public OPAC Search with Full-Text Multi-Field Matching & Relevance Ranking
   * Strictly excludes member PII, staff records, fine balances, and internal audit data.
   */
  async searchPublicCatalog(params: {
    q?: string;
    title?: string;
    author?: string;
    isbn?: string;
    subject?: string;
    publisher?: string;
    accessionNumber?: string;
    category?: string;
    availability?: 'AVAILABLE_ONLY' | 'ALL';
    sort?: 'RELEVANCE' | 'TITLE_ASC' | 'YEAR_DESC' | 'RECENT';
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params.page || 1));
    const limit = Math.min(100, Math.max(1, Number(params.limit || 20)));
    const q = params.q?.trim() || '';
    const tokens = q
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0);

    const andFilters: Prisma.BookWhereInput[] = [{ deletedAt: null }];

    if (params.title) {
      andFilters.push({ title: { contains: params.title.trim(), mode: 'insensitive' } });
    }
    if (params.author) {
      andFilters.push({
        authors: {
          some: { author: { name: { contains: params.author.trim(), mode: 'insensitive' } } },
        },
      });
    }
    if (params.isbn) {
      const cleanIsbn = params.isbn.trim();
      andFilters.push({
        OR: [
          { isbn13: { contains: cleanIsbn, mode: 'insensitive' } },
          { isbn10: { contains: cleanIsbn, mode: 'insensitive' } },
        ],
      });
    }
    if (params.subject || params.category) {
      const subj = (params.subject || params.category)!.trim();
      andFilters.push({
        OR: [
          { category: { name: { contains: subj, mode: 'insensitive' } } },
          { category: { description: { contains: subj, mode: 'insensitive' } } },
          { description: { contains: subj, mode: 'insensitive' } },
        ],
      });
    }
    if (params.publisher) {
      andFilters.push({
        publisher: { name: { contains: params.publisher.trim(), mode: 'insensitive' } },
      });
    }
    if (params.accessionNumber) {
      andFilters.push({
        copies: {
          some: {
            accessionNumber: { contains: params.accessionNumber.trim(), mode: 'insensitive' },
            deletedAt: null,
          },
        },
      });
    }
    if (params.availability === 'AVAILABLE_ONLY') {
      andFilters.push({
        copies: {
          some: {
            status: 'AVAILABLE',
            isReferenceOnly: false,
            deletedAt: null,
          },
        },
      });
    }

    // Full-text token matching across title, subtitle, author, ISBN, publisher, category/subject, description, and accessionNumber
    for (const token of tokens) {
      andFilters.push({
        OR: [
          { title: { contains: token, mode: 'insensitive' } },
          { subtitle: { contains: token, mode: 'insensitive' } },
          { isbn13: { contains: token, mode: 'insensitive' } },
          { isbn10: { contains: token, mode: 'insensitive' } },
          { callNumber: { contains: token, mode: 'insensitive' } },
          { description: { contains: token, mode: 'insensitive' } },
          { publisher: { name: { contains: token, mode: 'insensitive' } } },
          { category: { name: { contains: token, mode: 'insensitive' } } },
          {
            authors: {
              some: { author: { name: { contains: token, mode: 'insensitive' } } },
            },
          },
          {
            copies: {
              some: {
                accessionNumber: { contains: token, mode: 'insensitive' },
                deletedAt: null,
              },
            },
          },
        ],
      });
    }

    const where: Prisma.BookWhereInput = { AND: andFilters };

    const candidates = await prisma.book.findMany({
      where,
      take: 250,
      include: {
        category: { select: { id: true, name: true, code: true } },
        publisher: { select: { id: true, name: true } },
        authors: {
          include: { author: { select: { id: true, name: true } } },
        },
        copies: {
          where: { deletedAt: null },
          select: {
            id: true,
            accessionNumber: true,
            status: true,
            condition: true,
            isReferenceOnly: true,
            shelfLocation: true,
          },
        },
      },
    });

    // Compute full-text relevance score
    const scored = candidates.map((b) => {
      let relevanceScore = 10;
      const authorNames = b.authors.map((ba) => ba.author.name);
      if (q) {
        const qLower = q.toLowerCase();
        const titleLower = b.title.toLowerCase();
        if (titleLower === qLower || b.isbn13 === q) {
          relevanceScore += 100;
        } else if (titleLower.startsWith(qLower)) {
          relevanceScore += 75;
        } else if (titleLower.includes(qLower)) {
          relevanceScore += 55;
        }
        for (const token of tokens) {
          if (titleLower.includes(token)) relevanceScore += 25;
          if (authorNames.some((a) => a.toLowerCase().includes(token))) relevanceScore += 20;
          if (b.category?.name.toLowerCase().includes(token)) relevanceScore += 15;
          if (b.publisher?.name.toLowerCase().includes(token)) relevanceScore += 10;
          if (b.description?.toLowerCase().includes(token)) relevanceScore += 8;
        }
      }

      const availableCount = b.copies.filter(
        (c) => c.status === 'AVAILABLE' && !c.isReferenceOnly
      ).length;
      const referenceCount = b.copies.filter((c) => c.isReferenceOnly).length;

      return {
        id: b.id,
        title: b.title,
        subtitle: b.subtitle,
        isbn13: b.isbn13,
        isbn10: b.isbn10,
        edition: b.edition,
        publicationYear: b.publicationYear,
        callNumber: b.callNumber,
        language: b.language,
        pageCount: b.pageCount,
        description: b.description,
        coverImageUrl: b.coverImageUrl,
        category: b.category?.name || 'General',
        subject: b.category?.name || 'General',
        publisher: b.publisher?.name || 'Unknown Publisher',
        authors: authorNames,
        availabilityStatus:
          availableCount > 0
            ? 'AVAILABLE'
            : referenceCount > 0
              ? 'REFERENCE_ONLY'
              : 'ALL_COPIES_CHECKED_OUT',
        copiesSummary: {
          totalCopies: b.copies.length,
          availableForLoan: availableCount,
          referenceOnlyCopies: referenceCount,
          shelfLocations: Array.from(new Set(b.copies.map((c) => c.shelfLocation))),
        },
        relevanceScore,
        createdAt: b.createdAt,
      };
    });

    const sortMode = params.sort || (q ? 'RELEVANCE' : 'RECENT');
    scored.sort((a, b) => {
      if (sortMode === 'RELEVANCE') return b.relevanceScore - a.relevanceScore;
      if (sortMode === 'TITLE_ASC') return a.title.localeCompare(b.title);
      if (sortMode === 'YEAR_DESC') return (b.publicationYear || 0) - (a.publicationYear || 0);
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    const total = scored.length;
    const paginated = scored.slice((page - 1) * limit, page * limit);

    return {
      items: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  /**
   * Public Book Detail with copy availability and Related Books.
   * Never exposes member PII or borrower identity.
   */
  async getPublicBookDetail(id: string) {
    const book = await prisma.book.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: { select: { id: true, name: true, code: true } },
        publisher: { select: { id: true, name: true } },
        authors: {
          include: { author: { select: { id: true, name: true } } },
        },
        copies: {
          where: { deletedAt: null },
          select: {
            id: true,
            accessionNumber: true,
            status: true,
            condition: true,
            isReferenceOnly: true,
            shelfLocation: true,
          },
          orderBy: { accessionNumber: 'asc' },
        },
      },
    });

    if (!book) {
      throw new NotFoundError(`Book '${id}' not found in public catalog`);
    }

    // Fetch up to 4 related books in the same category
    const relatedRaw = await prisma.book.findMany({
      where: {
        id: { not: book.id },
        deletedAt: null,
        ...(book.categoryId ? { categoryId: book.categoryId } : {}),
      },
      take: 4,
      include: {
        authors: { include: { author: { select: { name: true } } } },
        category: { select: { name: true } },
      },
    });

    return {
      id: book.id,
      title: book.title,
      subtitle: book.subtitle,
      isbn13: book.isbn13,
      isbn10: book.isbn10,
      edition: book.edition,
      publicationYear: book.publicationYear,
      callNumber: book.callNumber,
      language: book.language,
      pageCount: book.pageCount,
      description: book.description,
      coverImageUrl: book.coverImageUrl,
      category: book.category?.name || 'General',
      subject: book.category?.name || 'General',
      publisher: book.publisher?.name || 'Unknown Publisher',
      authors: book.authors.map((ba) => ba.author.name),
      copies: book.copies.map((c) => ({
        accessionNumber: c.accessionNumber,
        status: c.status,
        condition: c.condition,
        isReferenceOnly: c.isReferenceOnly,
        shelfLocation: c.shelfLocation,
      })),
      relatedBooks: relatedRaw.map((r) => ({
        id: r.id,
        title: r.title,
        isbn13: r.isbn13,
        authors: r.authors.map((ba) => ba.author.name),
        category: r.category?.name || 'General',
        publicationYear: r.publicationYear,
      })),
    };
  }

  /**
   * 3.3 Net Cataloguing — Lookup & Preview External/Mock Metadata by ISBN
   */
  async previewNetCatalogMetadata(isbn: string) {
    const metadata = await this.netAdapter.lookupByIsbn(isbn);
    const existingBook = await prisma.book.findFirst({
      where: { isbn13: metadata.isbn13, deletedAt: null },
      select: { id: true, title: true, isbn13: true },
    });

    return {
      metadata,
      duplicateExists: Boolean(existingBook),
      existingBook: existingBook || null,
    };
  }

  /**
   * 3.3 Net Cataloguing — Validate and Import Metadata into Catalog
   */
  async importNetCatalogMetadata(
    input: Partial<NormalizedBibliographicMetadata> & {
      isbn?: string;
      copiesCount?: number;
      shelfLocation?: string;
      isReferenceOnly?: boolean;
    },
    actor: { userId: string; email: string }
  ) {
    const lookupIsbn = input.isbn13 || input.isbn;
    let baseMeta: Partial<NormalizedBibliographicMetadata> = {};
    if (lookupIsbn) {
      baseMeta = await this.netAdapter.lookupByIsbn(lookupIsbn);
    }

    const mergedTitle = (input.title || baseMeta.title || '').trim();
    const mergedIsbn13 = (input.isbn13 || baseMeta.isbn13 || '').trim();
    if (!mergedTitle) {
      throw new ValidationError('Title is required to import Net Cataloguing metadata');
    }

    if (mergedIsbn13) {
      const existing = await prisma.book.findFirst({
        where: { isbn13: mergedIsbn13, deletedAt: null },
      });
      if (existing) {
        throw new ConflictError(
          `Duplicate ISBN-13 '${mergedIsbn13}' already exists in catalog ("${existing.title}")`
        );
      }
    }

    const createdBook = await booksService.createBook(
      {
        title: mergedTitle,
        subtitle: input.subtitle ?? baseMeta.subtitle,
        isbn13: mergedIsbn13 || undefined,
        isbn10: input.isbn10 ?? baseMeta.isbn10,
        edition: input.edition ?? baseMeta.edition,
        publicationYear: input.publicationYear ?? baseMeta.publicationYear,
        callNumber: input.callNumber ?? baseMeta.callNumber,
        classification: input.classification ?? baseMeta.classification,
        language: input.language ?? baseMeta.language ?? 'English',
        pageCount: input.pageCount ?? baseMeta.pageCount,
        description: input.description ?? baseMeta.description,
        publisherName: input.publisherName ?? baseMeta.publisherName ?? 'Academic Press',
        categoryName: input.categoryName ?? baseMeta.categoryName ?? 'Computer Science',
        authors:
          input.authors && input.authors.length > 0
            ? input.authors
            : baseMeta.authors || ['Unknown Author'],
        copiesCount: input.copiesCount || 1,
        shelfLocation: input.shelfLocation || 'NET-CAT-STACK',
        condition: 'NEW',
        isReferenceOnly: Boolean(input.isReferenceOnly),
      },
      actor
    );

    return {
      importedBook: createdBook,
      adapterUsed: this.netAdapter.providerName,
      providerMode: this.netAdapter.mode,
    };
  }

  /**
   * 3.4 Virtual Bookshelf — Personal Reading List (User-Isolated)
   */
  private getUserShelfKey(userId: string): string {
    return `bookshelf.user.${userId}`;
  }

  async getPersonalBookshelf(requestingUserId: string, targetUserId?: string) {
    if (targetUserId && targetUserId !== requestingUserId) {
      throw new ForbiddenError('Access denied: Cannot access another user’s private virtual bookshelf');
    }

    const key = this.getUserShelfKey(requestingUserId);
    const row = await prisma.systemConfiguration.findUnique({ where: { configKey: key } });
    const entries: PersonalBookshelfItem[] = row ? JSON.parse(row.configValue) : [];

    const bookIds = entries.map((e) => e.bookId);
    const books = bookIds.length
      ? await prisma.book.findMany({
          where: { id: { in: bookIds }, deletedAt: null },
          include: {
            authors: { include: { author: { select: { name: true } } } },
            category: { select: { name: true } },
            copies: {
              where: { deletedAt: null },
              select: { status: true, isReferenceOnly: true },
            },
          },
        })
      : [];

    const bookMap = new Map(books.map((b) => [b.id, b]));

    const enriched = entries
      .map((entry) => {
        const b = bookMap.get(entry.bookId);
        if (!b) return null;
        const available = b.copies.some((c) => c.status === 'AVAILABLE' && !c.isReferenceOnly);
        return {
          bookId: b.id,
          title: b.title,
          authors: b.authors.map((ba) => ba.author.name),
          category: b.category?.name || 'General',
          coverImageUrl: b.coverImageUrl,
          available,
          shelfName: entry.shelfName,
          notes: entry.notes,
          addedAt: entry.addedAt,
        };
      })
      .filter(Boolean);

    return {
      ownerUserId: requestingUserId,
      totalItems: enriched.length,
      items: enriched,
    };
  }

  async addToPersonalBookshelf(
    requestingUserId: string,
    input: { bookId: string; shelfName?: string; notes?: string }
  ) {
    if (!input.bookId) {
      throw new ValidationError('bookId is required');
    }
    const book = await prisma.book.findFirst({
      where: { id: input.bookId, deletedAt: null },
    });
    if (!book) {
      throw new NotFoundError(`Book '${input.bookId}' not found`);
    }

    const key = this.getUserShelfKey(requestingUserId);
    const row = await prisma.systemConfiguration.findUnique({ where: { configKey: key } });
    const entries: PersonalBookshelfItem[] = row ? JSON.parse(row.configValue) : [];

    const existingIdx = entries.findIndex((e) => e.bookId === input.bookId);
    const item: PersonalBookshelfItem = {
      bookId: input.bookId,
      shelfName: input.shelfName?.trim() || 'Reading List',
      notes: input.notes?.trim(),
      addedAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      entries[existingIdx] = item;
    } else {
      entries.unshift(item);
    }

    await prisma.systemConfiguration.upsert({
      where: { configKey: key },
      update: { configValue: JSON.stringify(entries), updatedByUserId: requestingUserId },
      create: {
        configKey: key,
        configValue: JSON.stringify(entries),
        dataType: ConfigDataType.JSON,
        category: 'BOOKSHELF',
        updatedByUserId: requestingUserId,
      },
    });

    return this.getPersonalBookshelf(requestingUserId);
  }

  async removeFromPersonalBookshelf(requestingUserId: string, bookId: string) {
    const key = this.getUserShelfKey(requestingUserId);
    const row = await prisma.systemConfiguration.findUnique({ where: { configKey: key } });
    const entries: PersonalBookshelfItem[] = row ? JSON.parse(row.configValue) : [];
    const filtered = entries.filter((e) => e.bookId !== bookId);

    await prisma.systemConfiguration.upsert({
      where: { configKey: key },
      update: { configValue: JSON.stringify(filtered), updatedByUserId: requestingUserId },
      create: {
        configKey: key,
        configValue: JSON.stringify(filtered),
        dataType: ConfigDataType.JSON,
        category: 'BOOKSHELF',
        updatedByUserId: requestingUserId,
      },
    });

    return this.getPersonalBookshelf(requestingUserId);
  }
}

export const opacService = new OpacService();

