import { prisma } from '../../config/prisma.js';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../utils/errors.js';
import { AuditAction, ConfigDataType, ItemCondition, ItemStatus, Prisma } from '@prisma/client';
import crypto from 'crypto';

const SUPPLIERS_KEY = 'acquisitions.suppliers.v1';
const REQUESTS_KEY = 'acquisitions.requests.v1';
const ORDERS_KEY = 'acquisitions.orders.v1';

export interface SupplierRecord {
  id: string;
  code: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface AcquisitionRequestRecord {
  id: string;
  requestNumber: string;
  title: string;
  isbn13?: string;
  authors: string[];
  publisherName?: string;
  edition?: string;
  publicationYear?: number;
  categoryName?: string;
  quantity: number;
  estimatedUnitPrice: number;
  department?: string;
  justification?: string;
  status: 'PENDING' | 'APPROVED' | 'ORDERED' | 'REJECTED';
  requestedByEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderLineItem {
  id: string;
  title: string;
  isbn13?: string;
  authors: string[];
  publisherName?: string;
  categoryName?: string;
  edition?: string;
  publicationYear?: number;
  callNumber?: string;
  orderedQuantity: number;
  receivedQuantity: number;
  pendingQuantity: number;
  unitPrice: number;
  shelfLocation: string;
  isReferenceOnly: boolean;
  cataloguedBookId?: string;
  generatedAccessionNumbers: string[];
}

export interface PurchaseOrderRecord {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  requestId?: string;
  status: 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
  items: PurchaseOrderLineItem[];
  totalOrderedQuantity: number;
  totalReceivedQuantity: number;
  totalPendingQuantity: number;
  totalAmount: number;
  expectedDeliveryDate?: string;
  notes?: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
  receivingHistory: Array<{
    receivedAt: string;
    receivedByEmail: string;
    receivedCount: number;
    accessionNumbers: string[];
    bookIds: string[];
  }>;
}

const DEFAULT_SUPPLIERS: SupplierRecord[] = [
  {
    id: 'sup-default-01',
    code: 'SUP-2026-001',
    name: 'Oxford & Cambridge Academic Distributors',
    contactPerson: 'Rajesh Sharma',
    email: 'orders@oxcam-academic.example.com',
    phone: '+91-11-40506070',
    address: 'Connaught Place, New Delhi',
    status: 'ACTIVE',
    createdAt: '2026-01-15T09:00:00.000Z',
  },
  {
    id: 'sup-default-02',
    code: 'SUP-2026-002',
    name: 'IEEE & Springer Technical Publications India',
    contactPerson: 'Meera Nair',
    email: 'library-supply@springer-india.example.com',
    phone: '+91-80-22334455',
    address: 'MG Road, Bengaluru',
    status: 'ACTIVE',
    createdAt: '2026-01-20T09:00:00.000Z',
  },
];

export class AcquisitionsService {
  private async loadList<T>(configKey: string, fallback: T[]): Promise<T[]> {
    const row = await prisma.systemConfiguration.findUnique({ where: { configKey } });
    if (!row) {
      await prisma.systemConfiguration.create({
        data: {
          configKey,
          configValue: JSON.stringify(fallback),
          dataType: ConfigDataType.JSON,
          category: 'ACQUISITIONS',
          description: `Acquisitions store for ${configKey}`,
        },
      });
      return fallback;
    }
    try {
      return JSON.parse(row.configValue) as T[];
    } catch {
      return fallback;
    }
  }

  private async saveList<T>(configKey: string, items: T[], userId?: string): Promise<void> {
    await prisma.systemConfiguration.upsert({
      where: { configKey },
      update: {
        configValue: JSON.stringify(items),
        updatedByUserId: userId || null,
      },
      create: {
        configKey,
        configValue: JSON.stringify(items),
        dataType: ConfigDataType.JSON,
        category: 'ACQUISITIONS',
        updatedByUserId: userId || null,
      },
    });
  }

  async getSuppliers(): Promise<SupplierRecord[]> {
    return this.loadList<SupplierRecord>(SUPPLIERS_KEY, DEFAULT_SUPPLIERS);
  }

  async createSupplier(
    input: {
      name: string;
      contactPerson: string;
      email: string;
      phone: string;
      address?: string;
    },
    actor: { userId: string; email: string }
  ): Promise<SupplierRecord> {
    if (!input.name?.trim()) {
      throw new ValidationError('Supplier name is required');
    }
    if (!input.email?.trim()) {
      throw new ValidationError('Supplier email is required');
    }

    const suppliers = await this.getSuppliers();
    const exists = suppliers.find(
      (s) => s.name.toLowerCase() === input.name.trim().toLowerCase()
    );
    if (exists) {
      throw new ConflictError(`Supplier '${input.name}' already exists`);
    }

    const newSupplier: SupplierRecord = {
      id: crypto.randomUUID(),
      code: `SUP-2026-${String(suppliers.length + 1).padStart(3, '0')}`,
      name: input.name.trim(),
      contactPerson: input.contactPerson?.trim() || 'Accounts Desk',
      email: input.email.trim(),
      phone: input.phone?.trim() || 'N/A',
      address: input.address?.trim(),
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };

    suppliers.unshift(newSupplier);
    await this.saveList(SUPPLIERS_KEY, suppliers, actor.userId);

    await prisma.auditLog.create({
      data: {
        actorUserId: actor.userId,
        actorEmail: actor.email,
        action: AuditAction.CREATE,
        entityName: 'AcquisitionSupplier',
        entityId: newSupplier.id,
        newState: newSupplier as unknown as Prisma.InputJsonValue,
      },
    });

    return newSupplier;
  }

  async getRequests(status?: string): Promise<AcquisitionRequestRecord[]> {
    const requests = await this.loadList<AcquisitionRequestRecord>(REQUESTS_KEY, []);
    if (status) {
      return requests.filter((r) => r.status === status);
    }
    return requests;
  }

  async createRequest(
    input: {
      title: string;
      isbn13?: string;
      authors?: string[] | string;
      publisherName?: string;
      edition?: string;
      publicationYear?: number;
      categoryName?: string;
      quantity: number;
      estimatedUnitPrice?: number;
      department?: string;
      justification?: string;
    },
    actor: { userId: string; email: string }
  ): Promise<AcquisitionRequestRecord> {
    if (!input.title?.trim()) {
      throw new ValidationError('Requested book title is required');
    }
    const qty = Number(input.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 500) {
      throw new ValidationError('Requested quantity must be an integer between 1 and 500');
    }

    const authorsList = Array.isArray(input.authors)
      ? input.authors.map((a) => a.trim()).filter(Boolean)
      : typeof input.authors === 'string'
        ? input.authors.split(',').map((a) => a.trim()).filter(Boolean)
        : ['Unknown Author'];

    const requests = await this.getRequests();
    const record: AcquisitionRequestRecord = {
      id: crypto.randomUUID(),
      requestNumber: `ACQ-REQ-${Date.now().toString().slice(-6)}`,
      title: input.title.trim(),
      isbn13: input.isbn13?.trim() || undefined,
      authors: authorsList.length > 0 ? authorsList : ['Unknown Author'],
      publisherName: input.publisherName?.trim(),
      edition: input.edition?.trim(),
      publicationYear: input.publicationYear ? Number(input.publicationYear) : undefined,
      categoryName: input.categoryName?.trim() || 'General',
      quantity: qty,
      estimatedUnitPrice: Number(input.estimatedUnitPrice ?? 500),
      department: input.department?.trim() || 'General Library',
      justification: input.justification?.trim(),
      status: 'APPROVED',
      requestedByEmail: actor.email,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    requests.unshift(record);
    await this.saveList(REQUESTS_KEY, requests, actor.userId);

    await prisma.auditLog.create({
      data: {
        actorUserId: actor.userId,
        actorEmail: actor.email,
        action: AuditAction.CREATE,
        entityName: 'AcquisitionRequest',
        entityId: record.id,
        newState: record as unknown as Prisma.InputJsonValue,
      },
    });

    return record;
  }

  async getOrders(): Promise<PurchaseOrderRecord[]> {
    return this.loadList<PurchaseOrderRecord>(ORDERS_KEY, []);
  }

  async createPurchaseOrder(
    input: {
      supplierId: string;
      requestId?: string;
      expectedDeliveryDate?: string;
      notes?: string;
      items?: Array<{
        title: string;
        isbn13?: string;
        authors?: string[];
        publisherName?: string;
        categoryName?: string;
        edition?: string;
        publicationYear?: number;
        callNumber?: string;
        orderedQuantity: number;
        unitPrice?: number;
        shelfLocation?: string;
        isReferenceOnly?: boolean;
      }>;
    },
    actor: { userId: string; email: string }
  ): Promise<PurchaseOrderRecord> {
    const suppliers = await this.getSuppliers();
    const supplier = suppliers.find((s) => s.id === input.supplierId) || suppliers[0];
    if (!supplier) {
      throw new NotFoundError('Selected supplier not found');
    }

    const requests = await this.getRequests();
    let lineItemsInput = input.items || [];

    if (input.requestId && lineItemsInput.length === 0) {
      const matchedReq = requests.find((r) => r.id === input.requestId);
      if (!matchedReq) {
        throw new NotFoundError(`Acquisition request '${input.requestId}' not found`);
      }
      lineItemsInput = [
        {
          title: matchedReq.title,
          isbn13: matchedReq.isbn13,
          authors: matchedReq.authors,
          publisherName: matchedReq.publisherName,
          categoryName: matchedReq.categoryName,
          edition: matchedReq.edition,
          publicationYear: matchedReq.publicationYear,
          orderedQuantity: matchedReq.quantity,
          unitPrice: matchedReq.estimatedUnitPrice,
        },
      ];
      matchedReq.status = 'ORDERED';
      matchedReq.updatedAt = new Date().toISOString();
      await this.saveList(REQUESTS_KEY, requests, actor.userId);
    }

    if (lineItemsInput.length === 0) {
      throw new ValidationError('Purchase order must contain at least one book line item');
    }

    const items: PurchaseOrderLineItem[] = lineItemsInput.map((item) => {
      const qty = Number(item.orderedQuantity);
      if (!item.title?.trim() || !Number.isInteger(qty) || qty < 1) {
        throw new ValidationError('Each purchase order item requires a title and orderedQuantity >= 1');
      }
      return {
        id: crypto.randomUUID(),
        title: item.title.trim(),
        isbn13: item.isbn13?.trim() || undefined,
        authors: item.authors && item.authors.length > 0 ? item.authors : ['Institutional Author'],
        publisherName: item.publisherName?.trim() || 'Academic Press',
        categoryName: item.categoryName?.trim() || 'Computer Science',
        edition: item.edition?.trim() || '1st Edition',
        publicationYear: item.publicationYear || new Date().getFullYear(),
        callNumber: item.callNumber?.trim() || '005.1 ACQ',
        orderedQuantity: qty,
        receivedQuantity: 0,
        pendingQuantity: qty,
        unitPrice: Number(item.unitPrice ?? 500),
        shelfLocation: item.shelfLocation?.trim() || 'ACQ-NEW-ARRIVALS',
        isReferenceOnly: Boolean(item.isReferenceOnly),
        generatedAccessionNumbers: [],
      };
    });

    const totalOrderedQuantity = items.reduce((sum, i) => sum + i.orderedQuantity, 0);
    const totalAmount = items.reduce((sum, i) => sum + i.orderedQuantity * i.unitPrice, 0);

    const orders = await this.getOrders();
    const order: PurchaseOrderRecord = {
      id: crypto.randomUUID(),
      orderNumber: `PO-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
      supplierId: supplier.id,
      supplierName: supplier.name,
      requestId: input.requestId,
      status: 'ORDERED',
      items,
      totalOrderedQuantity,
      totalReceivedQuantity: 0,
      totalPendingQuantity: totalOrderedQuantity,
      totalAmount,
      expectedDeliveryDate: input.expectedDeliveryDate,
      notes: input.notes,
      createdByEmail: actor.email,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      receivingHistory: [],
    };

    orders.unshift(order);
    await this.saveList(ORDERS_KEY, orders, actor.userId);

    await prisma.auditLog.create({
      data: {
        actorUserId: actor.userId,
        actorEmail: actor.email,
        action: AuditAction.CREATE,
        entityName: 'PurchaseOrder',
        entityId: order.id,
        newState: {
          orderNumber: order.orderNumber,
          supplierName: order.supplierName,
          totalOrderedQuantity,
          totalAmount,
        },
      },
    });

    return order;
  }

  /**
   * Receive items for a Purchase Order and convert received items into
   * catalogued Books and physical BookItem copies inside a Prisma transaction.
   * Avoids duplicate Book creation if a book with the same ISBN-13 or title already exists.
   */
  async receivePurchaseOrder(
    orderId: string,
    input: {
      items?: Array<{
        lineItemId?: string;
        receivedQuantity: number;
        condition?: ItemCondition;
        shelfLocation?: string;
      }>;
    },
    actor: { userId: string; email: string }
  ) {
    const orders = await this.getOrders();
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      throw new NotFoundError(`Purchase order '${orderId}' not found`);
    }
    if (order.status === 'RECEIVED') {
      throw new AppError('Purchase order has already been fully received', 400);
    }

    const receiveInstructions: Array<{
      lineItemId?: string;
      receivedQuantity: number;
      condition?: ItemCondition;
      shelfLocation?: string;
    }> =
      input.items && input.items.length > 0
        ? input.items
        : order.items
            .filter((i) => i.pendingQuantity > 0)
            .map((i) => ({ lineItemId: i.id, receivedQuantity: i.pendingQuantity }));

    const currentYear = new Date().getFullYear();
    const prefix = `ACC-${currentYear}-`;

    const txResult = await prisma.$transaction(async (tx) => {
      const createdAccessionNumbers: string[] = [];
      const cataloguedBookIds: string[] = [];

      // Determine starting accession sequence
      const latestItem = await tx.bookItem.findFirst({
        where: { accessionNumber: { startsWith: prefix } },
        orderBy: { accessionNumber: 'desc' },
        select: { accessionNumber: true },
      });
      const totalItems = await tx.bookItem.count();
      let nextSeq = totalItems + 1;
      if (latestItem?.accessionNumber) {
        const parsed = parseInt(latestItem.accessionNumber.replace(prefix, ''), 10);
        if (!isNaN(parsed)) {
          nextSeq = Math.max(nextSeq, parsed + 1);
        }
      }

      for (const instr of receiveInstructions) {
        const lineItem = instr.lineItemId
          ? order.items.find((i) => i.id === instr.lineItemId)
          : order.items[0];

        if (!lineItem) {
          throw new NotFoundError('Purchase order line item not found');
        }

        const qtyToReceive = Number(instr.receivedQuantity);
        if (!Number.isInteger(qtyToReceive) || qtyToReceive < 1) {
          throw new ValidationError('receivedQuantity must be a positive integer');
        }
        if (qtyToReceive > lineItem.pendingQuantity) {
          throw new ValidationError(
            `Cannot receive ${qtyToReceive} copies for "${lineItem.title}" (only ${lineItem.pendingQuantity} pending)`
          );
        }

        // 1. Check if Book already exists by ISBN-13 or exact Title to prevent duplicates
        let existingBook = null;
        if (lineItem.isbn13) {
          existingBook = await tx.book.findFirst({
            where: { isbn13: lineItem.isbn13, deletedAt: null },
          });
        }
        if (!existingBook) {
          existingBook = await tx.book.findFirst({
            where: {
              title: { equals: lineItem.title, mode: 'insensitive' },
              deletedAt: null,
            },
          });
        }

        let bookId = existingBook?.id || '';

        if (!existingBook) {
          // Resolve Publisher
          let publisherId: string | null = null;
          if (lineItem.publisherName) {
            const pub = await tx.publisher.upsert({
              where: { name: lineItem.publisherName },
              update: {},
              create: { name: lineItem.publisherName },
            });
            publisherId = pub.id;
          }

          // Resolve Category
          let categoryId: string | null = null;
          if (lineItem.categoryName) {
            const cat = await tx.category.upsert({
              where: { name: lineItem.categoryName },
              update: {},
              create: { name: lineItem.categoryName },
            });
            categoryId = cat.id;
          }

          // Resolve Authors
          const authorIds: string[] = [];
          for (const authorName of lineItem.authors) {
            let author = await tx.author.findFirst({
              where: { name: { equals: authorName, mode: 'insensitive' } },
            });
            if (!author) {
              author = await tx.author.create({ data: { name: authorName } });
            }
            authorIds.push(author.id);
          }

          const createdBook = await tx.book.create({
            data: {
              title: lineItem.title,
              isbn13: lineItem.isbn13 || null,
              edition: lineItem.edition || null,
              publicationYear: lineItem.publicationYear || currentYear,
              callNumber: lineItem.callNumber || '005.1 ACQ',
              language: 'English',
              publisherId,
              categoryId,
              authors: {
                create: authorIds.map((id) => ({ authorId: id })),
              },
            },
          });
          bookId = createdBook.id;
        }

        cataloguedBookIds.push(bookId);
        lineItem.cataloguedBookId = bookId;

        // 2. Create physical copies (BookItem) for received quantity
        for (let i = 0; i < qtyToReceive; i++) {
          let accNum = `${prefix}${String(nextSeq++).padStart(5, '0')}`;
          // Ensure no collision
          while (await tx.bookItem.findUnique({ where: { accessionNumber: accNum } })) {
            accNum = `${prefix}${String(nextSeq++).padStart(5, '0')}`;
          }

          await tx.bookItem.create({
            data: {
              bookId,
              accessionNumber: accNum,
              barcode: `BC-${accNum}`,
              shelfLocation: instr.shelfLocation || lineItem.shelfLocation || 'MAIN-STACKS',
              condition: instr.condition || ItemCondition.NEW,
              status: lineItem.isReferenceOnly ? ItemStatus.REFERENCE_ONLY : ItemStatus.AVAILABLE,
              isReferenceOnly: lineItem.isReferenceOnly,
              price: new Prisma.Decimal(lineItem.unitPrice),
            },
          });

          createdAccessionNumbers.push(accNum);
          lineItem.generatedAccessionNumbers.push(accNum);
        }

        lineItem.receivedQuantity += qtyToReceive;
        lineItem.pendingQuantity = lineItem.orderedQuantity - lineItem.receivedQuantity;
      }

      order.totalReceivedQuantity = order.items.reduce((sum, i) => sum + i.receivedQuantity, 0);
      order.totalPendingQuantity = order.items.reduce((sum, i) => sum + i.pendingQuantity, 0);
      order.status = order.totalPendingQuantity === 0 ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
      order.updatedAt = new Date().toISOString();
      order.receivingHistory.push({
        receivedAt: new Date().toISOString(),
        receivedByEmail: actor.email,
        receivedCount: createdAccessionNumbers.length,
        accessionNumbers: createdAccessionNumbers,
        bookIds: Array.from(new Set(cataloguedBookIds)),
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.userId,
          actorEmail: actor.email,
          action: AuditAction.UPDATE,
          entityName: 'PurchaseOrder',
          entityId: order.id,
          newState: {
            orderNumber: order.orderNumber,
            status: order.status,
            receivedCount: createdAccessionNumbers.length,
            accessionNumbers: createdAccessionNumbers,
            cataloguedBookIds: Array.from(new Set(cataloguedBookIds)),
          },
        },
      });

      return {
        order,
        receivedCopiesCount: createdAccessionNumbers.length,
        accessionNumbers: createdAccessionNumbers,
        cataloguedBookIds: Array.from(new Set(cataloguedBookIds)),
      };
    }, { timeout: 30000, maxWait: 15000 });

    await this.saveList(ORDERS_KEY, orders, actor.userId);
    return txResult;
  }

  async getAcquisitionReports() {
    const [suppliers, requests, orders] = await Promise.all([
      this.getSuppliers(),
      this.getRequests(),
      this.getOrders(),
    ]);

    const totalOrderedCopies = orders.reduce((s, o) => s + o.totalOrderedQuantity, 0);
    const totalReceivedCopies = orders.reduce((s, o) => s + o.totalReceivedQuantity, 0);
    const totalPendingCopies = orders.reduce((s, o) => s + o.totalPendingQuantity, 0);
    const totalCommittedBudget = orders.reduce((s, o) => s + o.totalAmount, 0);

    return {
      summary: {
        activeSuppliers: suppliers.filter((s) => s.status === 'ACTIVE').length,
        totalRequests: requests.length,
        approvedRequests: requests.filter((r) => r.status === 'APPROVED' || r.status === 'ORDERED').length,
        totalPurchaseOrders: orders.length,
        completedOrders: orders.filter((o) => o.status === 'RECEIVED').length,
        partiallyReceivedOrders: orders.filter((o) => o.status === 'PARTIALLY_RECEIVED').length,
        totalOrderedCopies,
        totalReceivedCopies,
        totalPendingCopies,
        totalCommittedBudget,
      },
      suppliers,
      recentOrders: orders.slice(0, 20),
    };
  }
}

export const acquisitionsService = new AcquisitionsService();
