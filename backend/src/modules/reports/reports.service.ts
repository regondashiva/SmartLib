import { prisma } from '../../config/prisma.js';
import {
  ExportReportQuery,
  ReportFilterQuery,
  CirculationStatus,
  MemberStatus,
  FineStatus,
  ItemStatus,
  MigrationStatus,
  AuditAction,
} from './reports.schema.js';
import { generatePdfBuffer, buildCsvDocument, ReportMetric } from './pdfGenerator.js';
import { Prisma } from '@prisma/client';

const PALETTE = ['#2563EB', '#0D9488', '#D97706', '#8B5CF6', '#EC4899', '#64748B', '#10B981', '#EF4444'];

function resolveDateBounds(query?: { startDate?: string; endDate?: string; academicYear?: string }) {
  let start: Date | undefined;
  let end: Date | undefined;

  if (query?.academicYear && query.academicYear.trim() !== '') {
    const parts = query.academicYear.trim().split('-');
    const startYear = parseInt(parts[0] || '', 10);
    if (!isNaN(startYear)) {
      start = new Date(`${startYear}-07-01T00:00:00.000Z`);
      const endYear = parts[1]
        ? parts[1].length === 2
          ? Math.floor(startYear / 100) * 100 + parseInt(parts[1], 10)
          : parseInt(parts[1], 10)
        : startYear + 1;
      end = new Date(`${endYear}-06-30T23:59:59.999Z`);
    }
  }

  if (query?.startDate && query.startDate.trim() !== '') {
    start = new Date(query.startDate);
    if (query.startDate.length === 10) {
      start = new Date(`${query.startDate}T00:00:00.000Z`);
    }
  }

  if (query?.endDate && query.endDate.trim() !== '') {
    end = new Date(query.endDate);
    if (query.endDate.length === 10) {
      end = new Date(`${query.endDate}T23:59:59.999Z`);
    }
  }

  return { start, end };
}

function toSafeMoney(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

export class ReportsService {
  /**
   * 0. Institutional KPI Summary & Dashboard Analytics
   * GET /api/v1/reports/dashboard (and /summary)
   */
  async getDashboardReport(query?: Partial<ReportFilterQuery>) {
    const now = new Date();
    const { start, end } = resolveDateBounds(query);
    const thirtyDaysAgo = start || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalBooks,
      totalCopies,
      availableCopies,
      issuedCopies,
      rfidTaggedCopies,
      activeLoans,
      overdueLoans,
      returnedLoans,
      activeMembers,
      blockedMembers,
      finesUnpaidAgg,
      finesPaidAgg,
      finesWaivedAgg,
      gateTotal,
      gateAlarms,
      devicesOnline,
      devicesTotal,
      migrationBatchesCount,
      categories,
      recentCirculations,
      itemStatuses,
    ] = await Promise.all([
      prisma.book.count({ where: { deletedAt: null } }),
      prisma.bookItem.count({ where: { deletedAt: null } }),
      prisma.bookItem.count({ where: { status: ItemStatus.AVAILABLE, deletedAt: null } }),
      prisma.bookItem.count({ where: { status: ItemStatus.ISSUED, deletedAt: null } }),
      prisma.bookItem.count({ where: { rfidTagId: { not: null }, deletedAt: null } }),
      prisma.circulation.count({ where: { status: CirculationStatus.ACTIVE } }),
      prisma.circulation.count({
        where: {
          OR: [
            { status: CirculationStatus.OVERDUE },
            { status: CirculationStatus.ACTIVE, dueDate: { lt: now } },
          ],
        },
      }),
      prisma.circulation.count({ where: { status: CirculationStatus.RETURNED } }),
      prisma.member.count({ where: { status: MemberStatus.ACTIVE, deletedAt: null } }),
      prisma.member.count({ where: { status: MemberStatus.BLOCKED, deletedAt: null } }),
      prisma.fine.aggregate({
        _sum: { amount: true, balance: true, paidAmount: true },
        where: { status: { in: [FineStatus.UNPAID, FineStatus.PARTIALLY_PAID] } },
      }),
      prisma.fine.aggregate({
        _sum: { paidAmount: true, amount: true },
        where: { status: { in: [FineStatus.PAID, FineStatus.PARTIALLY_PAID] } },
      }),
      prisma.fine.aggregate({
        _sum: { amount: true },
        where: { status: FineStatus.WAIVED },
      }),
      prisma.gateEvent.count(),
      prisma.gateEvent.count({ where: { alarmTriggered: true } }),
      prisma.rFIDDevice.count({ where: { status: 'ONLINE' } }),
      prisma.rFIDDevice.count(),
      prisma.migrationBatch.count(),
      prisma.category.findMany({
        select: {
          id: true,
          name: true,
          _count: { select: { books: { where: { deletedAt: null } } } },
        },
      }),
      prisma.circulation.findMany({
        where: {
          OR: [
            { issuedDate: { gte: thirtyDaysAgo, ...(end ? { lte: end } : {}) } },
            { returnedDate: { gte: thirtyDaysAgo, ...(end ? { lte: end } : {}) } },
          ],
        },
        select: { issuedDate: true, returnedDate: true, renewalCount: true },
      }),
      prisma.bookItem.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
    ]);

    // Build 7-day trend
    const dailyTrendMap: Record<string, { date: string; issues: number; returns: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      dailyTrendMap[key] = { date: key, issues: 0, returns: 0 };
    }

    recentCirculations.forEach((c) => {
      const issueKey = new Date(c.issuedDate).toISOString().slice(0, 10);
      if (dailyTrendMap[issueKey]) dailyTrendMap[issueKey].issues++;
      if (c.returnedDate) {
        const returnKey = new Date(c.returnedDate).toISOString().slice(0, 10);
        if (dailyTrendMap[returnKey]) dailyTrendMap[returnKey].returns++;
      }
    });

    const categoryDistribution = categories
      .map((cat, idx) => ({
        name: cat.name,
        value: cat._count.books,
        color: PALETTE[idx % PALETTE.length]!,
      }))
      .filter((c) => c.value > 0);

    const inventoryStatusBreakdown = itemStatuses.map((st, idx) => ({
      status: st.status,
      count: st._count._all,
      color: PALETTE[idx % PALETTE.length]!,
    }));

    return {
      catalog: {
        totalTitles: totalBooks,
        totalPhysicalCopies: totalCopies,
        availableCopies,
        issuedCopies,
        rfidTaggedCopies,
      },
      circulation: {
        activeLoans,
        overdueLoans,
        returnedLoans,
        totalTransactions: activeLoans + returnedLoans,
      },
      patrons: {
        activeMembers,
        blockedMembers,
      },
      fines: {
        outstandingBalance: toSafeMoney(finesUnpaidAgg._sum.balance),
        totalCollected: toSafeMoney(finesPaidAgg._sum.paidAmount),
        totalWaived: toSafeMoney(finesWaivedAgg._sum.amount),
        totalAssessed:
          toSafeMoney(finesUnpaidAgg._sum.amount) +
          toSafeMoney(finesPaidAgg._sum.amount) +
          toSafeMoney(finesWaivedAgg._sum.amount),
      },
      security: {
        totalGateEvents: gateTotal,
        authorizedPassages: Math.max(0, gateTotal - gateAlarms),
        unauthorizedAlarms: gateAlarms,
        devicesOnline,
        devicesTotal,
      },
      migrations: {
        totalBatches: migrationBatchesCount,
      },
      charts: {
        circulationTrend: Object.values(dailyTrendMap),
        categoryDistribution,
        inventoryStatusBreakdown,
      },
      generatedAt: now.toISOString(),
    };
  }

  // Alias for backward compatibility
  async getSummaryMetrics() {
    return this.getDashboardReport();
  }

  /**
   * A. Circulation Report
   * GET /api/v1/reports/circulation
   */
  async getCirculationReport(query: ReportFilterQuery) {
    const { page, limit, department, memberCategory, bookCategory, operator, transactionStatus } = query;
    const { start, end } = resolveDateBounds(query);
    const skip = (page - 1) * limit;
    const now = new Date();

    const where: Prisma.CirculationWhereInput = {
      ...(start || end
        ? {
            issuedDate: {
              ...(start ? { gte: start } : {}),
              ...(end ? { lte: end } : {}),
            },
          }
        : {}),
      ...(transactionStatus && Object.values(CirculationStatus).includes(transactionStatus as CirculationStatus)
        ? { status: transactionStatus as CirculationStatus }
        : {}),
      ...(department || memberCategory
        ? {
            member: {
              ...(department ? { department: { contains: department, mode: 'insensitive' } } : {}),
              ...(memberCategory ? { memberType: memberCategory } : {}),
            },
          }
        : {}),
      ...(bookCategory
        ? {
            bookItem: {
              book: {
                category: {
                  OR: [
                    { name: { contains: bookCategory, mode: 'insensitive' } },
                    ...(bookCategory.length === 36 ? [{ id: bookCategory }] : []),
                  ],
                },
              },
            },
          }
        : {}),
      ...(operator
        ? {
            issuedByUser: {
              OR: [
                { email: { contains: operator, mode: 'insensitive' } },
                { firstName: { contains: operator, mode: 'insensitive' } },
                ...(operator.length === 36 ? [{ id: operator }] : []),
              ],
            },
          }
        : {}),
    };

    const [
      totalIssues,
      totalReturns,
      activeLoans,
      overdueLoans,
      renewalsAgg,
      records,
      allMatchingForTrends,
    ] = await Promise.all([
      prisma.circulation.count({ where }),
      prisma.circulation.count({ where: { ...where, status: CirculationStatus.RETURNED } }),
      prisma.circulation.count({ where: { ...where, status: CirculationStatus.ACTIVE } }),
      prisma.circulation.count({
        where: {
          ...where,
          OR: [
            { status: CirculationStatus.OVERDUE },
            { status: CirculationStatus.ACTIVE, dueDate: { lt: now } },
          ],
        },
      }),
      prisma.circulation.aggregate({
        where,
        _sum: { renewalCount: true },
      }),
      prisma.circulation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { issuedDate: 'desc' },
        include: {
          member: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              cardNumber: true,
              memberType: true,
              department: true,
            },
          },
          bookItem: {
            include: {
              book: {
                include: {
                  category: { select: { id: true, name: true } },
                },
              },
            },
          },
          issuedByUser: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      prisma.circulation.findMany({
        where,
        take: 1000,
        orderBy: { issuedDate: 'desc' },
        select: {
          issuedDate: true,
          returnedDate: true,
          renewalCount: true,
          bookItem: {
            select: {
              bookId: true,
              book: {
                select: {
                  title: true,
                  isbn13: true,
                  category: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    // Calculate daily, weekly, monthly trends & most borrowed books
    const dailyMap: Record<string, { period: string; issues: number; returns: number; renewals: number }> = {};
    const weeklyMap: Record<string, { period: string; issues: number; returns: number }> = {};
    const monthlyMap: Record<string, { month: string; issues: number; returns: number }> = {};
    const bookBorrowCounts: Record<string, { bookId: string; title: string; isbn13: string | null; category: string; borrowCount: number }> = {};

    allMatchingForTrends.forEach((c) => {
      const issued = new Date(c.issuedDate);
      const dayKey = issued.toISOString().slice(0, 10);
      const monthKey = issued.toISOString().slice(0, 7);

      // ISO week approximation
      const startOfYear = new Date(issued.getFullYear(), 0, 1);
      const weekNum = Math.ceil(((issued.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
      const weekKey = `${issued.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;

      if (!dailyMap[dayKey]) dailyMap[dayKey] = { period: dayKey, issues: 0, returns: 0, renewals: 0 };
      dailyMap[dayKey].issues++;
      dailyMap[dayKey].renewals += c.renewalCount || 0;

      if (!weeklyMap[weekKey]) weeklyMap[weekKey] = { period: weekKey, issues: 0, returns: 0 };
      weeklyMap[weekKey].issues++;

      if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { month: monthKey, issues: 0, returns: 0 };
      monthlyMap[monthKey].issues++;

      if (c.returnedDate) {
        const ret = new Date(c.returnedDate);
        const rDay = ret.toISOString().slice(0, 10);
        const rMonth = ret.toISOString().slice(0, 7);
        if (!dailyMap[rDay]) dailyMap[rDay] = { period: rDay, issues: 0, returns: 0, renewals: 0 };
        dailyMap[rDay].returns++;
        if (!monthlyMap[rMonth]) monthlyMap[rMonth] = { month: rMonth, issues: 0, returns: 0 };
        monthlyMap[rMonth].returns++;
      }

      const bId = c.bookItem.bookId;
      if (!bookBorrowCounts[bId]) {
        bookBorrowCounts[bId] = {
          bookId: bId,
          title: c.bookItem.book.title,
          isbn13: c.bookItem.book.isbn13,
          category: c.bookItem.book.category?.name || 'Uncategorized',
          borrowCount: 0,
        };
      }
      bookBorrowCounts[bId].borrowCount++;
    });

    const mostBorrowedBooks = Object.values(bookBorrowCounts)
      .sort((a, b) => b.borrowCount - a.borrowCount)
      .slice(0, 10);

    const formattedRecords = records.map((r) => ({
      id: r.id,
      accessionNumber: r.bookItem.accessionNumber,
      bookTitle: r.bookItem.book.title,
      category: r.bookItem.book.category?.name || 'General',
      memberName: `${r.member.firstName} ${r.member.lastName}`,
      cardNumber: r.member.cardNumber,
      memberType: r.member.memberType,
      department: r.member.department || 'General',
      issuedDate: r.issuedDate.toISOString(),
      dueDate: r.dueDate.toISOString(),
      returnedDate: r.returnedDate ? r.returnedDate.toISOString() : null,
      renewalCount: r.renewalCount,
      status: r.status === CirculationStatus.ACTIVE && r.dueDate < now ? 'OVERDUE' : r.status,
      operator: `${r.issuedByUser.firstName} ${r.issuedByUser.lastName}`,
    }));

    return {
      summary: {
        totalIssues,
        totalReturns,
        activeLoans,
        overdueLoans,
        totalRenewals: renewalsAgg._sum.renewalCount || 0,
      },
      trends: {
        daily: Object.values(dailyMap).sort((a, b) => a.period.localeCompare(b.period)).slice(-14),
        weekly: Object.values(weeklyMap).sort((a, b) => a.period.localeCompare(b.period)).slice(-12),
        monthly: Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month)).slice(-12),
      },
      mostBorrowedBooks,
      records: formattedRecords,
      pagination: {
        page,
        limit,
        total: totalIssues,
        totalPages: Math.max(1, Math.ceil(totalIssues / limit)),
      },
    };
  }

  /**
   * B. Overdue Report
   * GET /api/v1/reports/overdue
   * Includes dynamic overdue days, fine assessment, and RBAC contact info protection
   */
  async getOverdueReport(query: ReportFilterQuery, callerRole?: string) {
    const { page, limit, department, memberCategory, bookCategory } = query;
    const { start, end } = resolveDateBounds(query);
    const skip = (page - 1) * limit;
    const now = new Date();

    const isAuthorizedForContact = callerRole === 'ADMIN' || callerRole === 'LIBRARIAN';

    // Get daily fine rate from system config
    const rateConfig = await prisma.systemConfiguration.findUnique({
      where: { configKey: 'DAILY_FINE_RATE' },
    });
    const dailyRate = rateConfig ? parseFloat(rateConfig.configValue) || 5.0 : 5.0;

    const where: Prisma.CirculationWhereInput = {
      OR: [
        { status: CirculationStatus.OVERDUE },
        { status: CirculationStatus.ACTIVE, dueDate: { lt: now } },
      ],
      ...(start || end
        ? {
            dueDate: {
              ...(start ? { gte: start } : {}),
              ...(end ? { lte: end } : {}),
            },
          }
        : {}),
      ...(department || memberCategory
        ? {
            member: {
              ...(department ? { department: { contains: department, mode: 'insensitive' } } : {}),
              ...(memberCategory ? { memberType: memberCategory } : {}),
            },
          }
        : {}),
      ...(bookCategory
        ? {
            bookItem: {
              book: {
                category: { name: { contains: bookCategory, mode: 'insensitive' } },
              },
            },
          }
        : {}),
    };

    const [totalOverdue, overdueCirculations] = await Promise.all([
      prisma.circulation.count({ where }),
      prisma.circulation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dueDate: 'asc' },
        include: {
          member: true,
          bookItem: {
            include: {
              book: {
                include: { category: true },
              },
            },
          },
          fines: true,
        },
      }),
    ]);

    let totalEstimatedFine = 0;
    let totalOverdueDays = 0;

    const records = overdueCirculations.map((c) => {
      const referenceEnd = c.returnedDate ? new Date(c.returnedDate) : now;
      const diffMs = Math.max(0, referenceEnd.getTime() - new Date(c.dueDate).getTime());
      const overdueDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

      const existingFine = c.fines.reduce((sum, f) => sum + toSafeMoney(f.amount), 0);
      const fineAmount = existingFine > 0 ? existingFine : toSafeMoney(overdueDays * dailyRate);

      totalEstimatedFine += fineAmount;
      totalOverdueDays += overdueDays;

      return {
        id: c.id,
        accessionNumber: c.bookItem.accessionNumber,
        bookTitle: c.bookItem.book.title,
        category: c.bookItem.book.category?.name || 'General',
        memberId: c.member.id,
        memberName: `${c.member.firstName} ${c.member.lastName}`,
        cardNumber: c.member.cardNumber,
        memberCategory: c.member.memberType,
        department: c.member.department || 'General',
        contactEmail: isAuthorizedForContact ? c.member.email : '***REDACTED***',
        contactPhone: isAuthorizedForContact ? c.member.phoneNumber || 'N/A' : '***REDACTED***',
        issuedDate: c.issuedDate.toISOString(),
        dueDate: c.dueDate.toISOString(),
        overdueDays,
        fineAmount: toSafeMoney(fineAmount),
        status: c.status,
      };
    });

    return {
      summary: {
        totalOverdueItems: totalOverdue,
        averageOverdueDays: records.length > 0 ? Math.round(totalOverdueDays / records.length) : 0,
        totalAccruedFine: toSafeMoney(totalEstimatedFine),
        dailyFineRate: dailyRate,
      },
      records,
      pagination: {
        page,
        limit,
        total: totalOverdue,
        totalPages: Math.max(1, Math.ceil(totalOverdue / limit)),
      },
    };
  }

  /**
   * C. Inventory Report
   * GET /api/v1/reports/inventory
   */
  async getInventoryReport(query: ReportFilterQuery) {
    const { page, limit, bookCategory, transactionStatus } = query;
    const skip = (page - 1) * limit;

    const itemWhere: Prisma.BookItemWhereInput = {
      deletedAt: null,
      ...(bookCategory
        ? {
            book: {
              category: {
                OR: [
                  { name: { contains: bookCategory, mode: 'insensitive' } },
                  ...(bookCategory.length === 36 ? [{ id: bookCategory }] : []),
                ],
              },
            },
          }
        : {}),
      ...(transactionStatus && Object.values(ItemStatus).includes(transactionStatus as ItemStatus)
        ? { status: transactionStatus as ItemStatus }
        : {}),
    };

    const [
      totalPhysicalCopies,
      availableCopies,
      issuedCopies,
      rfidTaggedCopies,
      missingCopiesFromCatalog,
      damagedCopies,
      referenceOnlyCopies,
      misplacedScansCount,
      missingScansCount,
      uncataloguedScansCount,
      verifiedScansCount,
      statusGroups,
      categoryBreakdown,
      itemsList,
    ] = await Promise.all([
      prisma.bookItem.count({ where: { deletedAt: null } }),
      prisma.bookItem.count({ where: { status: ItemStatus.AVAILABLE, deletedAt: null } }),
      prisma.bookItem.count({ where: { status: ItemStatus.ISSUED, deletedAt: null } }),
      prisma.bookItem.count({ where: { rfidTagId: { not: null }, deletedAt: null } }),
      prisma.bookItem.count({ where: { status: ItemStatus.LOST, deletedAt: null } }),
      prisma.bookItem.count({ where: { status: ItemStatus.DAMAGED, deletedAt: null } }),
      prisma.bookItem.count({ where: { isReferenceOnly: true, deletedAt: null } }),
      prisma.inventoryScan.count({ where: { scanStatus: 'MISPLACED' } }),
      prisma.inventoryScan.count({ where: { scanStatus: 'MISSING' } }),
      prisma.inventoryScan.count({ where: { scanStatus: 'UNCATALOGED' } }),
      prisma.inventoryScan.count({ where: { scanStatus: 'VERIFIED' } }),
      prisma.bookItem.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      prisma.category.findMany({
        select: {
          name: true,
          books: {
            where: { deletedAt: null },
            select: {
              _count: { select: { copies: { where: { deletedAt: null } } } },
            },
          },
        },
      }),
      prisma.bookItem.findMany({
        where: itemWhere,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          book: {
            include: { category: true, publisher: true },
          },
          rfidTag: true,
        },
      }),
    ]);

    const filteredTotal = await prisma.bookItem.count({ where: itemWhere });

    const statusBreakdown = statusGroups.map((g, idx) => ({
      status: g.status,
      count: g._count._all,
      color: PALETTE[idx % PALETTE.length]!,
    }));

    const categoryDistribution = categoryBreakdown
      .map((cat, idx) => ({
        name: cat.name,
        copies: cat.books.reduce((acc, b) => acc + b._count.copies, 0),
        color: PALETTE[idx % PALETTE.length]!,
      }))
      .filter((c) => c.copies > 0);

    const records = itemsList.map((item) => ({
      id: item.id,
      accessionNumber: item.accessionNumber,
      barcode: item.barcode || 'N/A',
      bookTitle: item.book.title,
      isbn13: item.book.isbn13 || 'N/A',
      category: item.book.category?.name || 'Uncategorized',
      shelfLocation: item.shelfLocation,
      status: item.status,
      condition: item.condition,
      isReferenceOnly: item.isReferenceOnly,
      rfidTagged: Boolean(item.rfidTagId),
      rfidEpc: item.rfidTag?.epc || null,
      easArmed: item.rfidTag?.easArmed ?? null,
    }));

    return {
      summary: {
        totalPhysicalCopies,
        availableCopies,
        issuedCopies,
        rfidTaggedCopies,
        untaggedCopies: Math.max(0, totalPhysicalCopies - rfidTaggedCopies),
        missingCopies: missingCopiesFromCatalog + missingScansCount,
        misplacedCopies: misplacedScansCount,
        uncataloguedScans: uncataloguedScansCount,
        verifiedScans: verifiedScansCount,
        damagedCopies,
        referenceOnlyCopies,
      },
      statusBreakdown,
      categoryDistribution,
      records,
      pagination: {
        page,
        limit,
        total: filteredTotal,
        totalPages: Math.max(1, Math.ceil(filteredTotal / limit)),
      },
    };
  }

  /**
   * D. Member Activity Report
   * GET /api/v1/reports/members
   */
  async getMembersReport(query: ReportFilterQuery, callerRole?: string) {
    const { page, limit, department, memberCategory, memberStatus, transactionStatus } = query;
    const skip = (page - 1) * limit;
    const isAuthorizedForContact = callerRole === 'ADMIN' || callerRole === 'LIBRARIAN';

    const effectiveStatus =
      memberStatus ||
      (transactionStatus && Object.values(MemberStatus).includes(transactionStatus as MemberStatus)
        ? (transactionStatus as MemberStatus)
        : undefined);

    const where: Prisma.MemberWhereInput = {
      deletedAt: null,
      ...(department ? { department: { contains: department, mode: 'insensitive' } } : {}),
      ...(memberCategory ? { memberType: memberCategory } : {}),
      ...(effectiveStatus ? { status: effectiveStatus } : {}),
    };

    const [
      activeMembers,
      expiredMembers,
      suspendedMembers,
      blockedMembers,
      finesAgg,
      categoryGroups,
      totalFiltered,
      membersList,
    ] = await Promise.all([
      prisma.member.count({ where: { status: MemberStatus.ACTIVE, deletedAt: null } }),
      prisma.member.count({ where: { status: MemberStatus.EXPIRED, deletedAt: null } }),
      prisma.member.count({ where: { status: MemberStatus.SUSPENDED, deletedAt: null } }),
      prisma.member.count({ where: { status: MemberStatus.BLOCKED, deletedAt: null } }),
      prisma.member.aggregate({
        where: { deletedAt: null },
        _sum: { fineBalance: true },
      }),
      prisma.member.groupBy({
        by: ['memberType'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      prisma.member.count({ where }),
      prisma.member.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              circulations: true,
              fines: true,
            },
          },
          circulations: {
            where: { status: CirculationStatus.ACTIVE },
            select: { id: true },
          },
        },
      }),
    ]);

    const records = membersList.map((m) => ({
      id: m.id,
      cardNumber: m.cardNumber,
      name: `${m.firstName} ${m.lastName}`,
      email: isAuthorizedForContact ? m.email : '***REDACTED***',
      phoneNumber: isAuthorizedForContact ? m.phoneNumber || 'N/A' : '***REDACTED***',
      memberCategory: m.memberType,
      department: m.department || 'General',
      status: m.status,
      borrowingFrequency: m._count.circulations,
      activeLoansCount: m.circulations.length,
      outstandingFines: toSafeMoney(m.fineBalance),
      expiryDate: m.expiryDate.toISOString(),
    }));

    return {
      summary: {
        activeMembers,
        inactiveMembers: expiredMembers + suspendedMembers,
        blockedMembers,
        totalMembers: activeMembers + expiredMembers + suspendedMembers + blockedMembers,
        totalOutstandingFines: toSafeMoney(finesAgg._sum.fineBalance),
      },
      categoryBreakdown: categoryGroups.map((g, idx) => ({
        category: g.memberType,
        count: g._count._all,
        color: PALETTE[idx % PALETTE.length]!,
      })),
      records,
      pagination: {
        page,
        limit,
        total: totalFiltered,
        totalPages: Math.max(1, Math.ceil(totalFiltered / limit)),
      },
    };
  }

  /**
   * E. Fine Collection Report
   * GET /api/v1/reports/fines
   */
  async getFinesReport(query: ReportFilterQuery) {
    const { page, limit, department, memberCategory, transactionStatus } = query;
    const { start, end } = resolveDateBounds(query);
    const skip = (page - 1) * limit;

    const where: Prisma.FineWhereInput = {
      ...(start || end
        ? {
            createdAt: {
              ...(start ? { gte: start } : {}),
              ...(end ? { lte: end } : {}),
            },
          }
        : {}),
      ...(transactionStatus && Object.values(FineStatus).includes(transactionStatus as FineStatus)
        ? { status: transactionStatus as FineStatus }
        : {}),
      ...(department || memberCategory
        ? {
            member: {
              ...(department ? { department: { contains: department, mode: 'insensitive' } } : {}),
              ...(memberCategory ? { memberType: memberCategory } : {}),
            },
          }
        : {}),
    };

    const [
      allFinesAgg,
      paidFinesAgg,
      unpaidFinesAgg,
      partialFinesAgg,
      waivedFinesAgg,
      totalFiltered,
      finesList,
      allFinesForTrends,
    ] = await Promise.all([
      prisma.fine.aggregate({
        where,
        _sum: { amount: true, paidAmount: true, balance: true },
        _count: { _all: true },
      }),
      prisma.fine.aggregate({
        where: { ...where, status: FineStatus.PAID },
        _sum: { paidAmount: true, amount: true },
        _count: { _all: true },
      }),
      prisma.fine.aggregate({
        where: { ...where, status: FineStatus.UNPAID },
        _sum: { balance: true, amount: true },
        _count: { _all: true },
      }),
      prisma.fine.aggregate({
        where: { ...where, status: FineStatus.PARTIALLY_PAID },
        _sum: { paidAmount: true, balance: true, amount: true },
        _count: { _all: true },
      }),
      prisma.fine.aggregate({
        where: { ...where, status: FineStatus.WAIVED },
        _sum: { amount: true, balance: true },
        _count: { _all: true },
      }),
      prisma.fine.count({ where }),
      prisma.fine.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          member: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              cardNumber: true,
              memberType: true,
              department: true,
            },
          },
          circulation: {
            include: {
              bookItem: {
                include: { book: { select: { title: true } } },
              },
            },
          },
          waivedByUser: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
      }),
      prisma.fine.findMany({
        where,
        take: 500,
        orderBy: { createdAt: 'asc' },
        select: {
          createdAt: true,
          amount: true,
          paidAmount: true,
          balance: true,
          status: true,
        },
      }),
    ]);

    const trendMap: Record<string, { date: string; assessed: number; collected: number; waived: number }> = {};
    allFinesForTrends.forEach((f) => {
      const key = f.createdAt.toISOString().slice(0, 10);
      if (!trendMap[key]) {
        trendMap[key] = { date: key, assessed: 0, collected: 0, waived: 0 };
      }
      trendMap[key].assessed = toSafeMoney(trendMap[key].assessed + toSafeMoney(f.amount));
      trendMap[key].collected = toSafeMoney(trendMap[key].collected + toSafeMoney(f.paidAmount));
      if (f.status === FineStatus.WAIVED) {
        trendMap[key].waived = toSafeMoney(trendMap[key].waived + toSafeMoney(f.amount));
      }
    });

    const totalAssessed = toSafeMoney(allFinesAgg._sum.amount);
    const paidFines = toSafeMoney(allFinesAgg._sum.paidAmount);
    const outstandingFines = toSafeMoney(
      toSafeMoney(unpaidFinesAgg._sum.balance) + toSafeMoney(partialFinesAgg._sum.balance)
    );
    const waivedFines = toSafeMoney(waivedFinesAgg._sum.amount);
    const partialPaymentsTotal = toSafeMoney(partialFinesAgg._sum.paidAmount);

    const records = finesList.map((f) => ({
      id: f.id,
      date: f.createdAt.toISOString(),
      memberName: `${f.member.firstName} ${f.member.lastName}`,
      cardNumber: f.member.cardNumber,
      department: f.member.department || 'General',
      bookTitle: f.circulation?.bookItem?.book?.title || 'Direct Assessment',
      accessionNumber: f.circulation?.bookItem?.accessionNumber || 'N/A',
      reason: f.reason,
      assessedAmount: toSafeMoney(f.amount),
      paidAmount: toSafeMoney(f.paidAmount),
      balance: toSafeMoney(f.balance),
      status: f.status,
      receiptNumber: f.receiptNumber || null,
      waivedBy: f.waivedByUser ? `${f.waivedByUser.firstName} ${f.waivedByUser.lastName}` : null,
      waivedReason: f.waivedReason || null,
    }));

    return {
      summary: {
        totalAssessedFines: totalAssessed,
        paidFines,
        outstandingFines,
        waivedFines,
        partialPayments: partialPaymentsTotal,
        partialPaymentsCount: partialFinesAgg._count._all,
        totalFineRecords: allFinesAgg._count._all,
      },
      collectionTrends: Object.values(trendMap).slice(-14),
      records,
      pagination: {
        page,
        limit,
        total: totalFiltered,
        totalPages: Math.max(1, Math.ceil(totalFiltered / limit)),
      },
    };
  }

  /**
   * F. RFID Operations Report
   * GET /api/v1/reports/rfid
   */
  async getRfidOperationsReport(query: ReportFilterQuery) {
    const { page, limit, rfidDevice } = query;
    const { start, end } = resolveDateBounds(query);
    const skip = (page - 1) * limit;

    const deviceFilter: Prisma.RFIDDeviceWhereInput = rfidDevice
      ? {
          OR: [
            { deviceCode: { contains: rfidDevice, mode: 'insensitive' } },
            { name: { contains: rfidDevice, mode: 'insensitive' } },
            ...(rfidDevice.length === 36 ? [{ id: rfidDevice }] : []),
          ],
        }
      : {};

    const tagWhere: Prisma.RFIDTagWhereInput = {
      ...(start || end
        ? {
            createdAt: {
              ...(start ? { gte: start } : {}),
              ...(end ? { lte: end } : {}),
            },
          }
        : {}),
    };

    const [
      totalTags,
      activeAssignedTags,
      easArmedTags,
      damagedTags,
      unassignedTags,
      devices,
      deviceEventsCount,
      failedDeviceEvents,
      uncataloguedScans,
      tagsList,
      recentEvents,
    ] = await Promise.all([
      prisma.rFIDTag.count({ where: tagWhere }),
      prisma.rFIDTag.count({ where: { ...tagWhere, status: 'ACTIVE' } }),
      prisma.rFIDTag.count({ where: { ...tagWhere, easArmed: true } }),
      prisma.rFIDTag.count({ where: { ...tagWhere, status: 'DAMAGED' } }),
      prisma.rFIDTag.count({ where: { ...tagWhere, status: 'UNASSIGNED' } }),
      prisma.rFIDDevice.findMany({
        where: deviceFilter,
        include: {
          _count: {
            select: {
              deviceEvents: true,
              gateEvents: true,
              inventorySessions: true,
            },
          },
        },
      }),
      prisma.deviceEvent.count(),
      prisma.deviceEvent.count({ where: { eventType: 'ERROR' } }),
      prisma.inventoryScan.count({ where: { scanStatus: 'UNCATALOGED' } }),
      prisma.rFIDTag.findMany({
        where: tagWhere,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          bookItem: {
            include: { book: { select: { title: true, isbn13: true } } },
          },
        },
      }),
      prisma.deviceEvent.findMany({
        take: 20,
        orderBy: { timestamp: 'desc' },
        include: { device: { select: { name: true, deviceCode: true } } },
      }),
    ]);

    const onlineDevices = devices.filter((d) => d.status === 'ONLINE').length;

    const deviceActivity = devices.map((d) => ({
      id: d.id,
      deviceCode: d.deviceCode,
      name: d.name,
      deviceType: d.deviceType,
      location: d.location,
      status: d.status,
      lastHeartbeatAt: d.lastHeartbeatAt ? d.lastHeartbeatAt.toISOString() : null,
      readerEvents: d._count.deviceEvents + d._count.gateEvents + d._count.inventorySessions,
    }));

    const records = tagsList.map((t) => ({
      id: t.id,
      epc: t.epc,
      tid: t.tid || 'N/A',
      tagType: t.tagType,
      easArmed: t.easArmed,
      status: t.status,
      accessionNumber: t.bookItem?.accessionNumber || 'UNASSIGNED',
      bookTitle: t.bookItem?.book?.title || 'Unlinked Transponder',
      encodedAt: t.encodedAt ? t.encodedAt.toISOString() : t.createdAt.toISOString(),
    }));

    return {
      summary: {
        taggedItems: activeAssignedTags,
        totalTagsProvisioned: totalTags,
        easArmedCount: easArmedTags,
        easDisarmedCount: Math.max(0, totalTags - easArmedTags),
        unassignedTags,
        damagedTags,
        readerEvents: deviceEventsCount + devices.reduce((acc, d) => acc + d._count.gateEvents, 0),
        failedScans: failedDeviceEvents + uncataloguedScans + damagedTags,
        devicesOnline: onlineDevices,
        devicesTotal: devices.length,
        deviceAvailabilityPercent:
          devices.length > 0 ? Math.round((onlineDevices / devices.length) * 100) : 100,
      },
      deviceActivity,
      recentReaderEvents: recentEvents.map((e) => ({
        id: e.id,
        deviceCode: e.device.deviceCode,
        deviceName: e.device.name,
        eventType: e.eventType,
        timestamp: e.timestamp.toISOString(),
      })),
      records,
      pagination: {
        page,
        limit,
        total: totalTags,
        totalPages: Math.max(1, Math.ceil(totalTags / limit)),
      },
    };
  }

  /**
   * G. Security Gate Report
   * GET /api/v1/reports/security-gates
   */
  async getSecurityGatesReport(query: ReportFilterQuery) {
    const { page, limit, gateId, rfidDevice } = query;
    const { start, end } = resolveDateBounds(query);
    const skip = (page - 1) * limit;

    const gateKey = gateId || rfidDevice;

    const where: Prisma.GateEventWhereInput = {
      ...(start || end
        ? {
            timestamp: {
              ...(start ? { gte: start } : {}),
              ...(end ? { lte: end } : {}),
            },
          }
        : {}),
      ...(gateKey
        ? {
            device: {
              OR: [
                { deviceCode: { contains: gateKey, mode: 'insensitive' } },
                { name: { contains: gateKey, mode: 'insensitive' } },
                ...(gateKey.length === 36 ? [{ id: gateKey }] : []),
              ],
            },
          }
        : {}),
    };

    const [
      totalGateEvents,
      authorizedPassages,
      alarmEvents,
      resolvedAlarms,
      footfallAgg,
      eventsList,
    ] = await Promise.all([
      prisma.gateEvent.count({ where }),
      prisma.gateEvent.count({ where: { ...where, alarmTriggered: false } }),
      prisma.gateEvent.count({ where: { ...where, alarmTriggered: true } }),
      prisma.gateEvent.count({ where: { ...where, alarmTriggered: true, alarmResolved: true } }),
      prisma.gateEvent.aggregate({
        where,
        _sum: { footfallCount: true },
      }),
      prisma.gateEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          device: {
            select: { id: true, deviceCode: true, name: true, location: true },
          },
          bookItem: {
            include: { book: { select: { title: true } } },
          },
          resolvedByUser: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
      }),
    ]);

    const gateBreakdownMap: Record<string, { gateId: string; gateName: string; authorized: number; alarms: number; footfall: number }> = {};
    eventsList.forEach((e) => {
      const code = e.device.deviceCode;
      if (!gateBreakdownMap[code]) {
        gateBreakdownMap[code] = {
          gateId: code,
          gateName: e.device.name,
          authorized: 0,
          alarms: 0,
          footfall: 0,
        };
      }
      if (e.alarmTriggered) {
        gateBreakdownMap[code].alarms++;
      } else {
        gateBreakdownMap[code].authorized++;
      }
      gateBreakdownMap[code].footfall += e.footfallCount ?? 1;
    });

    const records = eventsList.map((e) => ({
      id: e.id,
      timestamp: e.timestamp.toISOString(),
      gateIdentifier: e.device.deviceCode,
      gateName: e.device.name,
      location: e.device.location,
      tagEpc: e.tagEpc || 'N/A',
      accessionNumber: e.bookItem?.accessionNumber || 'N/A',
      bookTitle: e.bookItem?.book?.title || 'Unlinked / Patron Walk-Through',
      alarmTriggered: e.alarmTriggered,
      alarmResolved: e.alarmResolved,
      passageStatus: e.alarmTriggered
        ? e.alarmResolved
          ? 'ALARM_RESOLVED'
          : 'UNAUTHORIZED_ALARM'
        : 'AUTHORIZED_PASSAGE',
      footfallCount: e.footfallCount ?? 1,
      cctvReference: e.cctvTimestampRef || `CAM-GATE-${e.timestamp.toISOString().slice(0, 19)}`,
      resolvedBy: e.resolvedByUser
        ? `${e.resolvedByUser.firstName} ${e.resolvedByUser.lastName}`
        : null,
      resolutionNotes: e.resolutionNotes || null,
    }));

    return {
      summary: {
        totalGateEvents,
        authorizedPassages,
        unauthorizedPassages: alarmEvents,
        alarmEvents,
        resolvedAlarms,
        unresolvedAlarms: Math.max(0, alarmEvents - resolvedAlarms),
        totalFootfallCount: footfallAgg._sum.footfallCount || totalGateEvents,
      },
      gateBreakdown: Object.values(gateBreakdownMap),
      records,
      pagination: {
        page,
        limit,
        total: totalGateEvents,
        totalPages: Math.max(1, Math.ceil(totalGateEvents / limit)),
      },
    };
  }

  /**
   * H. Operator Activity Report
   * GET /api/v1/reports/operators
   */
  async getOperatorsReport(query: ReportFilterQuery) {
    const { page, limit, operator } = query;
    const { start, end } = resolveDateBounds(query);
    const skip = (page - 1) * limit;

    const auditWhere: Prisma.AuditLogWhereInput = {
      ...(start || end
        ? {
            timestamp: {
              ...(start ? { gte: start } : {}),
              ...(end ? { lte: end } : {}),
            },
          }
        : {}),
      ...(operator
        ? {
            OR: [
              { actorEmail: { contains: operator, mode: 'insensitive' } },
              ...(operator.length === 36 ? [{ actorUserId: operator }] : []),
            ],
          }
        : {}),
    };

    const [
      users,
      totalAuditLogs,
      rfidOpsCount,
      adminOpsCount,
      auditLogs,
    ] = await Promise.all([
      prisma.user.findMany({
        where: { deletedAt: null },
        include: {
          role: { select: { name: true } },
          _count: {
            select: {
              issuedCirculations: true,
              returnedCirculations: true,
              waivedFines: true,
              resolvedGateEvents: true,
              conductedAudits: true,
              executedMigrations: true,
              auditLogs: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where: auditWhere }),
      prisma.auditLog.count({
        where: {
          ...auditWhere,
          action: { in: [AuditAction.ARM_EAS, AuditAction.DISARM_EAS] },
        },
      }),
      prisma.auditLog.count({
        where: {
          ...auditWhere,
          action: {
            in: [
              AuditAction.CREATE,
              AuditAction.UPDATE,
              AuditAction.DELETE,
              AuditAction.WAIVE_FINE,
              AuditAction.MIGRATION_EXECUTE,
              AuditAction.MIGRATION_ROLLBACK,
              AuditAction.SYSTEM_CONFIG_CHANGE,
            ],
          },
        },
      }),
      prisma.auditLog.findMany({
        where: auditWhere,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          actorUser: {
            select: { firstName: true, lastName: true, email: true, role: { select: { name: true } } },
          },
        },
      }),
    ]);

    const operatorSummaries = users.map((u) => {
      const circOps = u._count.issuedCirculations + u._count.returnedCirculations;
      const rfidOps = u._count.resolvedGateEvents + u._count.conductedAudits;
      const adminOps = u._count.waivedFines + u._count.executedMigrations;
      return {
        userId: u.id,
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
        role: u.role.name,
        status: u.status,
        circulationOperations: circOps,
        rfidOperations: rfidOps,
        administrativeChanges: adminOps,
        totalAuditEvents: u._count.auditLogs,
        lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      };
    });

    const totalCirculationOps = operatorSummaries.reduce((a, b) => a + b.circulationOperations, 0);

    const records = auditLogs.map((log) => ({
      id: log.id,
      timestamp: log.timestamp.toISOString(),
      operatorName: log.actorUser
        ? `${log.actorUser.firstName} ${log.actorUser.lastName}`
        : log.actorEmail || 'System',
      operatorEmail: log.actorUser?.email || log.actorEmail || 'system@smartlib.ac.in',
      role: log.actorUser?.role?.name || 'SYSTEM',
      action: log.action,
      entityName: log.entityName,
      entityId: log.entityId || 'N/A',
      ipAddress: log.ipAddress || '127.0.0.1',
    }));

    return {
      summary: {
        activeOperators: users.filter((u) => u.status === 'ACTIVE').length,
        totalCirculationOperations: totalCirculationOps,
        totalRfidOperations: rfidOpsCount + operatorSummaries.reduce((a, b) => a + b.rfidOperations, 0),
        totalAdministrativeChanges: adminOpsCount,
        totalAuditEvents: totalAuditLogs,
      },
      operatorBreakdown: operatorSummaries,
      records,
      pagination: {
        page,
        limit,
        total: totalAuditLogs,
        totalPages: Math.max(1, Math.ceil(totalAuditLogs / limit)),
      },
    };
  }

  /**
   * I. Migration Report
   * GET /api/v1/reports/migrations
   */
  async getMigrationsReport(query: ReportFilterQuery) {
    const { page, limit, transactionStatus } = query;
    const { start, end } = resolveDateBounds(query);
    const skip = (page - 1) * limit;

    const where: Prisma.MigrationBatchWhereInput = {
      ...(start || end
        ? {
            createdAt: {
              ...(start ? { gte: start } : {}),
              ...(end ? { lte: end } : {}),
            },
          }
        : {}),
      ...(transactionStatus && Object.values(MigrationStatus).includes(transactionStatus as MigrationStatus)
        ? { status: transactionStatus as MigrationStatus }
        : {}),
    };

    const [
      totalBatches,
      committedBatches,
      rolledBackBatches,
      batchesAgg,
      batchesList,
      duplicateErrorsCount,
    ] = await Promise.all([
      prisma.migrationBatch.count({ where }),
      prisma.migrationBatch.count({ where: { ...where, status: MigrationStatus.COMMITTED } }),
      prisma.migrationBatch.count({ where: { ...where, status: MigrationStatus.ROLLED_BACK } }),
      prisma.migrationBatch.aggregate({
        where,
        _sum: {
          totalRecords: true,
          validRecords: true,
          errorRecords: true,
          migratedRecords: true,
        },
      }),
      prisma.migrationBatch.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          executedByUser: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
      }),
      prisma.migrationStagingRecord.count({
        where: {
          status: 'INVALID',
        },
      }),
    ]);

    const records = batchesList.map((b) => ({
      id: b.id,
      batchName: b.batchName,
      sourceFileName: b.sourceFileName,
      status: b.status,
      sourceRowCount: b.totalRecords,
      validRecords: b.validRecords,
      invalidRecords: b.errorRecords,
      committedRecords: b.migratedRecords,
      executedBy: `${b.executedByUser.firstName} ${b.executedByUser.lastName}`,
      createdAt: b.createdAt.toISOString(),
    }));

    return {
      summary: {
        uploadedBatches: totalBatches,
        sourceRowCounts: batchesAgg._sum.totalRecords || 0,
        validRecords: batchesAgg._sum.validRecords || 0,
        invalidRecords: batchesAgg._sum.errorRecords || 0,
        duplicateRecords: duplicateErrorsCount,
        committedRecords: batchesAgg._sum.migratedRecords || 0,
        committedBatches,
        rolledBackBatches,
      },
      records,
      pagination: {
        page,
        limit,
        total: totalBatches,
        totalPages: Math.max(1, Math.ceil(totalBatches / limit)),
      },
    };
  }

  /**
   * Export Report in PDF, CSV, or JSON
   * GET /api/v1/reports/export/pdf
   * GET /api/v1/reports/export/csv
   * GET /api/v1/reports/export
   */
  async generateReport(query: ExportReportQuery, operatorEmail?: string, callerRole?: string) {
    const rawType = (query.reportType || query.type || 'CIRCULATION').toUpperCase();
    const format = query.format || 'pdf';
    const limit = query.limit || 100;

    const filterQuery: ReportFilterQuery = {
      startDate: query.startDate,
      endDate: query.endDate,
      academicYear: query.academicYear,
      department: query.department,
      memberCategory: query.memberCategory,
      bookCategory: query.bookCategory,
      rfidDevice: query.rfidDevice,
      gateId: query.gateId,
      operator: query.operator,
      transactionStatus: query.transactionStatus,
      page: 1,
      limit,
    };

    let title = '';
    let subtitle = '';
    let metrics: ReportMetric[] = [];
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let rawData: unknown[] = [];

    switch (rawType) {
      case 'DASHBOARD': {
        const dash = await this.getDashboardReport(filterQuery);
        title = 'Executive Institutional Summary Report';
        subtitle = 'Consolidated KPI snapshot across catalog, circulation, fines, and security gates';
        metrics = [
          { label: 'Total Titles', value: dash.catalog.totalTitles },
          { label: 'Physical Copies', value: dash.catalog.totalPhysicalCopies },
          { label: 'Active Loans', value: dash.circulation.activeLoans },
          { label: 'Outstanding Fines', value: `INR ${dash.fines.outstandingBalance.toFixed(2)}` },
        ];
        headers = ['Category', 'Book Count'];
        rows = dash.charts.categoryDistribution.map((c) => [c.name, c.value]);
        rawData = dash.charts.categoryDistribution;
        break;
      }

      case 'CIRCULATION': {
        const rep = await this.getCirculationReport(filterQuery);
        title = 'Circulation & Loan Operations Audit';
        subtitle = 'Itemized loan ledger, borrower details, due dates, renewals, and return statuses';
        metrics = [
          { label: 'Total Issues', value: rep.summary.totalIssues },
          { label: 'Total Returns', value: rep.summary.totalReturns },
          { label: 'Active Loans', value: rep.summary.activeLoans },
          { label: 'Renewals', value: rep.summary.totalRenewals },
        ];
        headers = ['Issued Date', 'Accession #', 'Book Title', 'Member Name', 'Department', 'Status', 'Due Date'];
        rows = rep.records.map((r) => [
          r.issuedDate.slice(0, 10),
          r.accessionNumber,
          r.bookTitle,
          r.memberName,
          r.department,
          r.status,
          r.dueDate.slice(0, 10),
        ]);
        rawData = rep.records;
        break;
      }

      case 'OVERDUE': {
        const rep = await this.getOverdueReport(filterQuery, callerRole);
        title = 'Overdue Loans & Penalty Assessment Ledger';
        subtitle = 'Delinquent loans, elapsed overdue days, and calculated fine assessments';
        metrics = [
          { label: 'Overdue Items', value: rep.summary.totalOverdueItems },
          { label: 'Avg Overdue Days', value: rep.summary.averageOverdueDays },
          { label: 'Accrued Fines', value: `INR ${rep.summary.totalAccruedFine.toFixed(2)}` },
          { label: 'Daily Rate', value: `INR ${rep.summary.dailyFineRate.toFixed(2)}` },
        ];
        headers = ['Accession #', 'Book Title', 'Member Name', 'Card #', 'Due Date', 'Overdue Days', 'Fine (INR)'];
        rows = rep.records.map((r) => [
          r.accessionNumber,
          r.bookTitle,
          r.memberName,
          r.cardNumber,
          r.dueDate.slice(0, 10),
          r.overdueDays,
          r.fineAmount.toFixed(2),
        ]);
        rawData = rep.records;
        break;
      }

      case 'INVENTORY': {
        const rep = await this.getInventoryReport(filterQuery);
        title = 'Physical Inventory & RFID Tagging Reconciliation';
        subtitle = 'Copy-level availability, RFID transponder bindings, misplaced & missing audit counts';
        metrics = [
          { label: 'Total Copies', value: rep.summary.totalPhysicalCopies },
          { label: 'Available', value: rep.summary.availableCopies },
          { label: 'Issued', value: rep.summary.issuedCopies },
          { label: 'RFID Tagged', value: rep.summary.rfidTaggedCopies },
        ];
        headers = ['Accession #', 'Book Title', 'Category', 'Shelf Location', 'Status', 'Condition', 'RFID Tagged'];
        rows = rep.records.map((r) => [
          r.accessionNumber,
          r.bookTitle,
          r.category,
          r.shelfLocation,
          r.status,
          r.condition,
          r.rfidTagged ? 'YES' : 'NO',
        ]);
        rawData = rep.records;
        break;
      }

      case 'MEMBERS': {
        const rep = await this.getMembersReport(filterQuery, callerRole);
        title = 'Patron Membership & Borrowing Activity Report';
        subtitle = 'Active, inactive, and blocked members with borrowing frequency and fine balances';
        metrics = [
          { label: 'Active Members', value: rep.summary.activeMembers },
          { label: 'Inactive', value: rep.summary.inactiveMembers },
          { label: 'Blocked', value: rep.summary.blockedMembers },
          { label: 'Pending Fines', value: `INR ${rep.summary.totalOutstandingFines.toFixed(2)}` },
        ];
        headers = ['Card #', 'Member Name', 'Category', 'Department', 'Status', 'Total Loans', 'Fine Balance'];
        rows = rep.records.map((r) => [
          r.cardNumber,
          r.name,
          r.memberCategory,
          r.department,
          r.status,
          r.borrowingFrequency,
          `INR ${r.outstandingFines.toFixed(2)}`,
        ]);
        rawData = rep.records;
        break;
      }

      case 'FINES': {
        const rep = await this.getFinesReport(filterQuery);
        title = 'Institutional Fine Collection & Waiver Ledger';
        subtitle = 'Assessed penalties, revenue collected, partial payments, and authorized waivers';
        metrics = [
          { label: 'Total Assessed', value: `INR ${rep.summary.totalAssessedFines.toFixed(2)}` },
          { label: 'Paid Fines', value: `INR ${rep.summary.paidFines.toFixed(2)}` },
          { label: 'Outstanding', value: `INR ${rep.summary.outstandingFines.toFixed(2)}` },
          { label: 'Waived', value: `INR ${rep.summary.waivedFines.toFixed(2)}` },
        ];
        headers = ['Date', 'Card #', 'Member Name', 'Reason', 'Assessed', 'Paid', 'Balance', 'Status'];
        rows = rep.records.map((r) => [
          r.date.slice(0, 10),
          r.cardNumber,
          r.memberName,
          r.reason,
          `INR ${r.assessedAmount.toFixed(2)}`,
          `INR ${r.paidAmount.toFixed(2)}`,
          `INR ${r.balance.toFixed(2)}`,
          r.status,
        ]);
        rawData = rep.records;
        break;
      }

      case 'RFID': {
        const rep = await this.getRfidOperationsReport(filterQuery);
        title = 'RFID Transponder & Hardware Operations Report';
        subtitle = 'EPC Gen2 tag encodings, EAS security bit status, and reader availability';
        metrics = [
          { label: 'Tagged Items', value: rep.summary.taggedItems },
          { label: 'EAS Armed', value: rep.summary.easArmedCount },
          { label: 'Reader Events', value: rep.summary.readerEvents },
          { label: 'Availability', value: `${rep.summary.deviceAvailabilityPercent}%` },
        ];
        headers = ['EPC ID', 'Accession #', 'Book Title', 'EAS State', 'Tag Status', 'Encoded Date'];
        rows = rep.records.map((r) => [
          r.epc,
          r.accessionNumber,
          r.bookTitle,
          r.easArmed ? 'ARMED' : 'DISARMED',
          r.status,
          r.encodedAt.slice(0, 10),
        ]);
        rawData = rep.records;
        break;
      }

      case 'SECURITY_GATES':
      case 'GATE_EVENTS': {
        const rep = await this.getSecurityGatesReport(filterQuery);
        title = 'EAS Security Portal & Gate Alarm Audit Log';
        subtitle = 'Authorized vs unauthorized passages, alarm triggers, footfall counts, and CCTV refs';
        metrics = [
          { label: 'Total Passages', value: rep.summary.totalGateEvents },
          { label: 'Authorized', value: rep.summary.authorizedPassages },
          { label: 'Alarms Fired', value: rep.summary.alarmEvents },
          { label: 'Footfall', value: rep.summary.totalFootfallCount },
        ];
        headers = ['Timestamp', 'Gate ID', 'Accession #', 'Passage Status', 'Footfall', 'CCTV Reference'];
        rows = rep.records.map((r) => [
          r.timestamp.slice(0, 19).replace('T', ' '),
          r.gateIdentifier,
          r.accessionNumber,
          r.passageStatus,
          r.footfallCount,
          r.cctvReference,
        ]);
        rawData = rep.records;
        break;
      }

      case 'OPERATORS': {
        const rep = await this.getOperatorsReport(filterQuery);
        title = 'Staff Operator Activity & Compliance Audit Report';
        subtitle = 'Staff circulation transactions, RFID operations, and administrative audit trail';
        metrics = [
          { label: 'Active Staff', value: rep.summary.activeOperators },
          { label: 'Circulation Ops', value: rep.summary.totalCirculationOperations },
          { label: 'RFID Ops', value: rep.summary.totalRfidOperations },
          { label: 'Audit Events', value: rep.summary.totalAuditEvents },
        ];
        headers = ['Timestamp', 'Operator', 'Role', 'Action', 'Entity', 'Entity ID', 'IP Address'];
        rows = rep.records.map((r) => [
          r.timestamp.slice(0, 19).replace('T', ' '),
          r.operatorName,
          r.role,
          r.action,
          r.entityName,
          r.entityId,
          r.ipAddress,
        ]);
        rawData = rep.records;
        break;
      }

      case 'MIGRATIONS': {
        const rep = await this.getMigrationsReport(filterQuery);
        title = 'Legacy Catalog Data Migration Reconciliation Report';
        subtitle = 'Uploaded migration batches, staging validation counts, commits, and rollbacks';
        metrics = [
          { label: 'Total Batches', value: rep.summary.uploadedBatches },
          { label: 'Source Rows', value: rep.summary.sourceRowCounts },
          { label: 'Valid Rows', value: rep.summary.validRecords },
          { label: 'Committed', value: rep.summary.committedRecords },
        ];
        headers = ['Batch Name', 'Source File', 'Status', 'Total Rows', 'Valid', 'Invalid', 'Committed'];
        rows = rep.records.map((r) => [
          r.batchName,
          r.sourceFileName,
          r.status,
          r.sourceRowCount,
          r.validRecords,
          r.invalidRecords,
          r.committedRecords,
        ]);
        rawData = rep.records;
        break;
      }
    }

    if (format === 'json') {
      return {
        type: 'application/json',
        data: {
          title,
          subtitle,
          metrics,
          items: rawData,
        },
      };
    }

    if (format === 'csv') {
      const csvString = buildCsvDocument(headers, rows);
      return {
        type: 'text/csv',
        filename: `smartlib-${rawType.toLowerCase()}-report.csv`,
        data: csvString,
      };
    }

    // Default: PDF format
    const pdfBuffer = generatePdfBuffer({
      title,
      subtitle,
      dateRange: query.startDate
        ? `${query.startDate} to ${query.endDate || 'Present'}`
        : query.academicYear
        ? `Academic Year ${query.academicYear}`
        : 'All Institutional Records',
      appliedFilters: {
        academicYear: query.academicYear,
        department: query.department,
        memberCategory: query.memberCategory,
        bookCategory: query.bookCategory,
        rfidDevice: query.rfidDevice,
        gateId: query.gateId,
        operator: query.operator,
        status: query.transactionStatus,
      },
      generatedBy: operatorEmail || 'System Administrator',
      metrics,
      headers,
      rows,
    });

    return {
      type: 'application/pdf',
      filename: `smartlib-${rawType.toLowerCase()}-report.pdf`,
      data: pdfBuffer,
    };
  }
}

export const reportsService = new ReportsService();
