import { prisma } from '../../config/prisma.js';
import { NotFoundError, ConflictError, ValidationError } from '../../utils/errors.js';
import { GetBooksQuery, CreateBookInput, UpdateBookInput } from './books.schema.js';
import { Prisma, AuditAction, ItemCondition, ItemStatus } from '@prisma/client';

export class BooksService {
  async getBooks(query: GetBooksQuery) {
    const { page, limit, search, categoryId } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.BookWhereInput = {
      deletedAt: null,
      ...(categoryId ? { categoryId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { isbn13: { contains: search, mode: 'insensitive' } },
              { isbn10: { contains: search, mode: 'insensitive' } },
              { callNumber: { contains: search, mode: 'insensitive' } },
              {
                authors: {
                  some: {
                    author: {
                      name: { contains: search, mode: 'insensitive' },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [total, books] = await Promise.all([
      prisma.book.count({ where }),
      prisma.book.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { id: true, name: true, code: true } },
          publisher: { select: { id: true, name: true } },
          authors: {
            include: {
              author: { select: { id: true, name: true } },
            },
          },
          copies: {
            where: { deletedAt: null },
            select: {
              id: true,
              accessionNumber: true,
              barcode: true,
              status: true,
              condition: true,
              isReferenceOnly: true,
              shelfLocation: true,
              rfidTagId: true,
              rfidTag: {
                select: {
                  id: true,
                  epc: true,
                  easArmed: true,
                  status: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const formatted = books.map((book) => {
      const totalCopies = book.copies.length;
      const availableCopies = book.copies.filter(
        (c) => c.status === 'AVAILABLE' && !c.isReferenceOnly
      ).length;
      const referenceCopies = book.copies.filter((c) => c.isReferenceOnly).length;

      return {
        id: book.id,
        title: book.title,
        subtitle: book.subtitle,
        isbn13: book.isbn13,
        isbn10: book.isbn10,
        edition: book.edition,
        callNumber: book.callNumber,
        language: book.language,
        pageCount: book.pageCount,
        category: book.category,
        publisher: book.publisher,
        authors: book.authors.map((ba) => ba.author.name),
        copiesCount: {
          total: totalCopies,
          available: availableCopies,
          reference: referenceCopies,
        },
        copies: book.copies,
        createdAt: book.createdAt,
        updatedAt: book.updatedAt,
      };
    });

    return {
      items: formatted,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getBookById(id: string) {
    const book = await prisma.book.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: true,
        publisher: true,
        authors: {
          include: {
            author: true,
          },
        },
        copies: {
          where: { deletedAt: null },
          include: {
            rfidTag: true,
          },
          orderBy: { accessionNumber: 'asc' },
        },
      },
    });

    if (!book) {
      throw new NotFoundError(`Book with ID '${id}' not found`);
    }

    return {
      ...book,
      authors: book.authors.map((ba) => ba.author),
      authorNames: book.authors.map((ba) => ba.author.name),
    };
  }

  async getCategories() {
    return prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true, description: true },
    });
  }

  async getPublishers() {
    return prisma.publisher.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }

  async getAuthors() {
    return prisma.author.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }

  async createBook(
    input: CreateBookInput,
    actor?: { userId?: string; email?: string }
  ) {
    // 1. Check existing ISBN uniqueness
    if (input.isbn13 && input.isbn13.trim() !== '') {
      const existing = await prisma.book.findFirst({
        where: {
          isbn13: input.isbn13.trim(),
          deletedAt: null,
        },
      });
      if (existing) {
        throw new ConflictError(
          `Book with ISBN-13 '${input.isbn13}' already exists in the catalog (Title: "${existing.title}")`
        );
      }
    }

    // 2. Validate category if ID is provided
    if (input.categoryId) {
      const catExists = await prisma.category.findUnique({
        where: { id: input.categoryId },
      });
      if (!catExists) {
        throw new NotFoundError(`Category with ID '${input.categoryId}' does not exist`);
      }
    }

    // 3. Validate publisher if ID is provided
    if (input.publisherId) {
      const pubExists = await prisma.publisher.findUnique({
        where: { id: input.publisherId },
      });
      if (!pubExists) {
        throw new NotFoundError(`Publisher with ID '${input.publisherId}' does not exist`);
      }
    }

    // 4. Validate accession numbers uniqueness upfront if provided
    if (input.copies && input.copies.length > 0) {
      const explicitAccNums = input.copies
        .map((c) => c.accessionNumber?.trim())
        .filter((n): n is string => Boolean(n));

      // Check duplicates in payload
      const set = new Set<string>();
      for (const num of explicitAccNums) {
        if (set.has(num)) {
          throw new ConflictError(`Duplicate accession number '${num}' specified in request`);
        }
        set.add(num);
      }

      // Check database conflict for explicit accession numbers
      if (explicitAccNums.length > 0) {
        const existingCopies = await prisma.bookItem.findMany({
          where: { accessionNumber: { in: explicitAccNums } },
          select: { accessionNumber: true },
        });
        if (existingCopies.length > 0) {
          throw new ConflictError(
            `Accession number '${existingCopies[0]?.accessionNumber}' already exists in inventory`
          );
        }
      }
    }

    const currentYear = new Date().getFullYear();

    // 5. Execute transaction
    const result = await prisma.$transaction(async (tx) => {
      // 5a. Resolve or create Publisher
      let publisherId: string | null = input.publisherId || null;
      if (!publisherId && input.publisherName && input.publisherName.trim() !== '') {
        const pubName = input.publisherName.trim();
        const pub = await tx.publisher.upsert({
          where: { name: pubName },
          update: {},
          create: { name: pubName },
        });
        publisherId = pub.id;
      }

      // 5b. Resolve or create Category
      let categoryId: string | null = input.categoryId || null;
      if (!categoryId && input.categoryName && input.categoryName.trim() !== '') {
        const catName = input.categoryName.trim();
        const cat = await tx.category.upsert({
          where: { name: catName },
          update: {},
          create: {
            name: catName,
            code: input.classification?.trim() || null,
          },
        });
        categoryId = cat.id;
      }

      // 5c. Resolve or create Authors
      const authorIds: string[] = [];
      for (const authorName of input.authors) {
        const trimmed = authorName.trim();
        if (!trimmed) continue;
        let author = await tx.author.findFirst({
          where: { name: { equals: trimmed, mode: 'insensitive' } },
        });
        if (!author) {
          author = await tx.author.create({
            data: { name: trimmed },
          });
        }
        authorIds.push(author.id);
      }

      // 5d. Prepare physical copies data
      interface PreparedCopy {
        accessionNumber: string;
        barcode: string | null;
        shelfLocation: string;
        condition: ItemCondition;
        status: ItemStatus;
        isReferenceOnly: boolean;
        price: Prisma.Decimal | null;
      }

      const preparedCopies: PreparedCopy[] = [];

      if (input.copies && input.copies.length > 0) {
        // Detailed copies specified
        const prefix = `ACC-${currentYear}-`;
        let latestSeq = 0;

        for (let i = 0; i < input.copies.length; i++) {
          const c = input.copies[i]!;
          let accNum = c.accessionNumber?.trim();
          if (!accNum) {
            // Generate sequence
            if (latestSeq === 0) {
              const latestItem = await tx.bookItem.findFirst({
                where: { accessionNumber: { startsWith: prefix } },
                orderBy: { accessionNumber: 'desc' },
                select: { accessionNumber: true },
              });
              const totalItems = await tx.bookItem.count();
              let startSeq = totalItems + 1;
              if (latestItem?.accessionNumber) {
                const numericPart = parseInt(
                  latestItem.accessionNumber.replace(prefix, ''),
                  10
                );
                if (!isNaN(numericPart)) {
                  startSeq = Math.max(startSeq, numericPart + 1);
                }
              }
              latestSeq = startSeq;
            }
            accNum = `${prefix}${(latestSeq++).toString().padStart(5, '0')}`;
          }

          preparedCopies.push({
            accessionNumber: accNum,
            barcode: c.barcode?.trim() || `BC-${accNum}`,
            shelfLocation: c.shelfLocation?.trim() || input.shelfLocation || 'MAIN-STACKS',
            condition: (c.condition as ItemCondition) || 'GOOD',
            status: (c.status as ItemStatus) || 'AVAILABLE',
            isReferenceOnly: c.isReferenceOnly ?? input.isReferenceOnly ?? false,
            price: c.price ? new Prisma.Decimal(c.price) : input.price ? new Prisma.Decimal(input.price) : null,
          });
        }
      } else {
        // Quick copies generation using copiesCount
        const copiesCount = input.copiesCount || 1;
        const prefix = `ACC-${currentYear}-`;

        const latestItem = await tx.bookItem.findFirst({
          where: { accessionNumber: { startsWith: prefix } },
          orderBy: { accessionNumber: 'desc' },
          select: { accessionNumber: true },
        });

        const totalItems = await tx.bookItem.count();
        let startSeq = totalItems + 1;
        if (latestItem?.accessionNumber) {
          const numericPart = parseInt(
            latestItem.accessionNumber.replace(prefix, ''),
            10
          );
          if (!isNaN(numericPart)) {
            startSeq = Math.max(startSeq, numericPart + 1);
          }
        }

        for (let i = 0; i < copiesCount; i++) {
          const accNum = `${prefix}${(startSeq + i).toString().padStart(5, '0')}`;
          preparedCopies.push({
            accessionNumber: accNum,
            barcode: `BC-${accNum}`,
            shelfLocation: input.shelfLocation?.trim() || 'MAIN-STACKS',
            condition: (input.condition as ItemCondition) || 'GOOD',
            status: input.isReferenceOnly ? 'REFERENCE_ONLY' : 'AVAILABLE',
            isReferenceOnly: input.isReferenceOnly || false,
            price: input.price ? new Prisma.Decimal(input.price) : null,
          });
        }
      }

      // 5e. Create Book and Copies
      const book = await tx.book.create({
        data: {
          title: input.title.trim(),
          subtitle: input.subtitle?.trim() || null,
          isbn13: input.isbn13?.trim() || null,
          isbn10: input.isbn10?.trim() || null,
          edition: input.edition?.trim() || null,
          publicationYear: input.publicationYear || null,
          callNumber: input.callNumber?.trim() || null,
          description: input.description?.trim() || null,
          language: input.language || 'English',
          pageCount: input.pageCount || null,
          coverImageUrl: input.coverImageUrl?.trim() || null,
          publisherId,
          categoryId,
          authors: {
            create: authorIds.map((id) => ({ authorId: id })),
          },
          copies: {
            create: preparedCopies.map((c) => ({
              accessionNumber: c.accessionNumber,
              barcode: c.barcode,
              shelfLocation: c.shelfLocation,
              condition: c.condition,
              status: c.status,
              isReferenceOnly: c.isReferenceOnly,
              price: c.price,
            })),
          },
        },
        include: {
          category: { select: { id: true, name: true, code: true } },
          publisher: { select: { id: true, name: true } },
          authors: {
            include: {
              author: { select: { id: true, name: true } },
            },
          },
          copies: {
            select: {
              id: true,
              accessionNumber: true,
              barcode: true,
              status: true,
              condition: true,
              isReferenceOnly: true,
              shelfLocation: true,
              price: true,
            },
          },
        },
      });

      // 5f. Record Audit Log
      await tx.auditLog.create({
        data: {
          actorUserId: actor?.userId || null,
          actorEmail: actor?.email || null,
          action: AuditAction.CREATE,
          entityName: 'Book',
          entityId: book.id,
          newState: {
            title: book.title,
            isbn13: book.isbn13,
            copiesCount: book.copies.length,
            accessionNumbers: book.copies.map((c) => c.accessionNumber),
          },
        },
      });

      return {
        ...book,
        authors: book.authors.map((ba) => ba.author.name),
      };
    }, { timeout: 30000, maxWait: 15000 });

    return result;
  }

  async updateBook(
    id: string,
    input: UpdateBookInput,
    actor?: { userId?: string; email?: string }
  ) {
    const existing = await prisma.book.findFirst({
      where: { id, deletedAt: null },
      include: {
        authors: true,
        copies: { where: { deletedAt: null } },
      },
    });

    if (!existing) {
      throw new NotFoundError(`Book with ID '${id}' not found`);
    }

    // Check ISBN uniqueness if changing
    if (input.isbn13 && input.isbn13.trim() !== '') {
      const isbnConflict = await prisma.book.findFirst({
        where: {
          isbn13: input.isbn13.trim(),
          id: { not: id },
          deletedAt: null,
        },
      });
      if (isbnConflict) {
        throw new ConflictError(
          `Book with ISBN-13 '${input.isbn13}' already exists in catalog (Title: "${isbnConflict.title}")`
        );
      }
    }

    // Validate categoryId
    if (input.categoryId) {
      const cat = await prisma.category.findUnique({ where: { id: input.categoryId } });
      if (!cat) throw new NotFoundError(`Category with ID '${input.categoryId}' does not exist`);
    }

    // Validate publisherId
    if (input.publisherId) {
      const pub = await prisma.publisher.findUnique({ where: { id: input.publisherId } });
      if (!pub) throw new NotFoundError(`Publisher with ID '${input.publisherId}' does not exist`);
    }

    const currentYear = new Date().getFullYear();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Resolve publisher
      let publisherId: string | null | undefined = input.publisherId;
      if (publisherId === undefined && input.publisherName && input.publisherName.trim() !== '') {
        const pub = await tx.publisher.upsert({
          where: { name: input.publisherName.trim() },
          update: {},
          create: { name: input.publisherName.trim() },
        });
        publisherId = pub.id;
      }

      // 2. Resolve category
      let categoryId: string | null | undefined = input.categoryId;
      if (categoryId === undefined && input.categoryName && input.categoryName.trim() !== '') {
        const cat = await tx.category.upsert({
          where: { name: input.categoryName.trim() },
          update: {},
          create: {
            name: input.categoryName.trim(),
            code: input.classification?.trim() || null,
          },
        });
        categoryId = cat.id;
      }

      // 3. Update authors if specified
      if (input.authors) {
        // Delete existing relations
        await tx.bookAuthor.deleteMany({ where: { bookId: id } });

        for (const authorName of input.authors) {
          const trimmed = authorName.trim();
          if (!trimmed) continue;
          let author = await tx.author.findFirst({
            where: { name: { equals: trimmed, mode: 'insensitive' } },
          });
          if (!author) {
            author = await tx.author.create({ data: { name: trimmed } });
          }
          await tx.bookAuthor.create({
            data: { bookId: id, authorId: author.id },
          });
        }
      }

      // 4. Update or add physical copies if provided
      if (input.copies && input.copies.length > 0) {
        const prefix = `ACC-${currentYear}-`;
        for (const c of input.copies) {
          if (c.id) {
            // Update existing copy preserving RFID tag association
            await tx.bookItem.update({
              where: { id: c.id },
              data: {
                ...(c.shelfLocation ? { shelfLocation: c.shelfLocation.trim() } : {}),
                ...(c.condition ? { condition: c.condition as ItemCondition } : {}),
                ...(c.status ? { status: c.status as ItemStatus } : {}),
                ...(c.isReferenceOnly !== undefined ? { isReferenceOnly: c.isReferenceOnly } : {}),
                ...(c.barcode ? { barcode: c.barcode.trim() } : {}),
                ...(c.price !== undefined ? { price: new Prisma.Decimal(c.price) } : {}),
              },
            });
          } else {
            // Add new physical copy
            let accNum = c.accessionNumber?.trim();
            if (accNum) {
              const dup = await tx.bookItem.findUnique({ where: { accessionNumber: accNum } });
              if (dup) {
                throw new ConflictError(`Accession number '${accNum}' already exists`);
              }
            } else {
              const latestItem = await tx.bookItem.findFirst({
                where: { accessionNumber: { startsWith: prefix } },
                orderBy: { accessionNumber: 'desc' },
                select: { accessionNumber: true },
              });
              const totalItems = await tx.bookItem.count();
              let startSeq = totalItems + 1;
              if (latestItem?.accessionNumber) {
                const numericPart = parseInt(
                  latestItem.accessionNumber.replace(prefix, ''),
                  10
                );
                if (!isNaN(numericPart)) {
                  startSeq = Math.max(startSeq, numericPart + 1);
                }
              }
              accNum = `${prefix}${startSeq.toString().padStart(5, '0')}`;
            }

            await tx.bookItem.create({
              data: {
                bookId: id,
                accessionNumber: accNum,
                barcode: c.barcode?.trim() || `BC-${accNum}`,
                shelfLocation: c.shelfLocation?.trim() || 'MAIN-STACKS',
                condition: (c.condition as ItemCondition) || 'GOOD',
                status: (c.status as ItemStatus) || 'AVAILABLE',
                isReferenceOnly: c.isReferenceOnly || false,
                price: c.price ? new Prisma.Decimal(c.price) : null,
              },
            });
          }
        }
      }

      // 5. Update book record
      const updatedBook = await tx.book.update({
        where: { id },
        data: {
          ...(input.title ? { title: input.title.trim() } : {}),
          ...(input.subtitle !== undefined ? { subtitle: input.subtitle?.trim() || null } : {}),
          ...(input.isbn13 !== undefined ? { isbn13: input.isbn13?.trim() || null } : {}),
          ...(input.isbn10 !== undefined ? { isbn10: input.isbn10?.trim() || null } : {}),
          ...(input.edition !== undefined ? { edition: input.edition?.trim() || null } : {}),
          ...(input.publicationYear !== undefined ? { publicationYear: input.publicationYear } : {}),
          ...(input.callNumber !== undefined ? { callNumber: input.callNumber?.trim() || null } : {}),
          ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
          ...(input.language ? { language: input.language.trim() } : {}),
          ...(input.pageCount !== undefined ? { pageCount: input.pageCount } : {}),
          ...(input.coverImageUrl !== undefined ? { coverImageUrl: input.coverImageUrl?.trim() || null } : {}),
          ...(publisherId !== undefined ? { publisherId } : {}),
          ...(categoryId !== undefined ? { categoryId } : {}),
        },
        include: {
          category: true,
          publisher: true,
          authors: {
            include: { author: true },
          },
          copies: {
            where: { deletedAt: null },
            include: { rfidTag: true },
            orderBy: { accessionNumber: 'asc' },
          },
        },
      });

      // 6. Record Audit Log
      await tx.auditLog.create({
        data: {
          actorUserId: actor?.userId || null,
          actorEmail: actor?.email || null,
          action: AuditAction.UPDATE,
          entityName: 'Book',
          entityId: id,
          previousState: {
            title: existing.title,
            isbn13: existing.isbn13,
            copiesCount: existing.copies.length,
          },
          newState: {
            title: updatedBook.title,
            isbn13: updatedBook.isbn13,
            copiesCount: updatedBook.copies.length,
          },
        },
      });

      return {
        ...updatedBook,
        authors: updatedBook.authors.map((ba) => ba.author.name),
      };
    }, { timeout: 30000, maxWait: 15000 });

    return result;
  }
}

export const booksService = new BooksService();
