import { prisma } from '../../config/prisma.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';
import { settingsService } from '../settings/settings.service.js';
import {
  GetCirculationsQuery,
  IssueBookInput,
  ReturnLoanInput,
  RenewLoanInput,
  PayFineInput,
  WaiveFineInput,
  GetFinesQuery,
} from './circulation.schema.js';
import {
  Prisma,
  AuditAction,
  CirculationStatus,
  FineStatus,
  FineReason,
} from '@prisma/client';

export class CirculationService {

  async getCirculations(query: GetCirculationsQuery) {
    const { page, limit, status, memberId, bookItemId } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CirculationWhereInput = {
      ...(status ? { status } : {}),
      ...(memberId ? { memberId } : {}),
      ...(bookItemId ? { bookItemId } : {}),
    };

    const [total, transactions] = await Promise.all([
      prisma.circulation.count({ where }),
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
              email: true,
              status: true,
            },
          },
          bookItem: {
            include: {
              book: {
                select: {
                  id: true,
                  title: true,
                  isbn13: true,
                  callNumber: true,
                },
              },
              rfidTag: {
                select: {
                  epc: true,
                  easArmed: true,
                },
              },
            },
          },
          issuedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
    ]);

    const formatted = transactions.map((t) => ({
      id: t.id,
      status: t.status,
      issuedDate: t.issuedDate,
      dueDate: t.dueDate,
      returnedDate: t.returnedDate,
      renewalCount: t.renewalCount,
      member: {
        id: t.member.id,
        name: `${t.member.firstName} ${t.member.lastName}`,
        cardNumber: t.member.cardNumber,
        email: t.member.email,
      },
      item: {
        id: t.bookItem.id,
        accessionNumber: t.bookItem.accessionNumber,
        title: t.bookItem.book.title,
        isbn13: t.bookItem.book.isbn13,
        callNumber: t.bookItem.book.callNumber,
        shelfLocation: t.bookItem.shelfLocation,
        rfidTag: t.bookItem.rfidTag,
      },
      issuedBy: `${t.issuedByUser.firstName} ${t.issuedByUser.lastName}`,
    }));

    return {
      items: formatted,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Evaluates institutional borrowing rules before loan transaction using persisted SystemConfiguration:
   * 1. Member must be ACTIVE (not BLOCKED or SUSPENDED)
   * 2. Member must not have exceeded effective maxBorrowLimit (persisted policy or member limit)
   * 3. Member fine balance must not exceed institutional FINE_BORROWING_THRESHOLD
   * 4. BookItem must NOT be REFERENCE_ONLY when ENFORCE_REFERENCE_ONLY_RESTRICTION is enabled
   * 5. BookItem status must be AVAILABLE
   */
  async validateIssueEligibility(memberId: string, bookItemId: string) {
    const [member, item, policy] = await Promise.all([
      prisma.member.findUnique({
        where: { id: memberId },
        include: {
          circulations: { where: { status: 'ACTIVE' } },
        },
      }),
      prisma.bookItem.findUnique({
        where: { id: bookItemId },
        include: { rfidTag: true },
      }),
      settingsService.getCirculationPolicies(),
    ]);

    if (!member) {
      throw new NotFoundError('Member record not found');
    }

    if (member.status !== 'ACTIVE') {
      throw new ValidationError(
        `Borrowing rejected: Member account is ${member.status.toLowerCase()}`
      );
    }

    // Determine effective borrowing limit:
    // If member has a specific custom override (e.g. 2 in test or faculty override), respect whichever is applicable,
    // or if member has the default 4 and STUDENT policy was changed, use the dynamic policy limit.
    const categoryMaxLoans = policy.resolveCategoryMaxLoans(member.memberType);
    const effectiveMaxLoans =
      member.memberType === 'STUDENT' && member.maxBorrowLimit === 4
        ? categoryMaxLoans
        : Math.min(member.maxBorrowLimit, categoryMaxLoans);

    if (member.circulations.length >= effectiveMaxLoans) {
      throw new ValidationError(
        `Borrowing rejected: Member has reached the maximum loan limit (${effectiveMaxLoans} books)`
      );
    }

    const memberFineDec = new Prisma.Decimal(member.fineBalance);
    if (memberFineDec.greaterThan(policy.fineThreshold)) {
      throw new ValidationError(
        `Borrowing rejected: Outstanding fines (₹${memberFineDec.toFixed(2)}) exceed the institutional policy threshold (₹${policy.fineThreshold.toFixed(2)})`
      );
    }

    if (!item) {
      throw new NotFoundError('Physical book copy not found');
    }

    if (policy.enforceReferenceOnly && (item.isReferenceOnly || item.status === 'REFERENCE_ONLY')) {
      throw new ValidationError(
        `Borrowing rejected: Accession #${item.accessionNumber} is a Non-Circulating Reference Material and cannot be checked out`
      );
    }

    if (item.status !== 'AVAILABLE' && !(item.status === 'REFERENCE_ONLY' && !policy.enforceReferenceOnly)) {
      throw new ValidationError(
        `Borrowing rejected: Book copy is currently ${item.status.toLowerCase()}`
      );
    }

    return { member, item, policy };
  }

  /**
   * Executes a transactional issue loan and clears the RFID EAS bit
   */
  async issueBook(input: IssueBookInput, issuedByUserId: string) {
    const { member, item, policy } = await this.validateIssueEligibility(
      input.memberId,
      input.bookItemId
    );

    const defaultDueDays = input.dueDays || policy.resolveLoanDuration(member.memberType);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + defaultDueDays);

    return prisma.$transaction(async (tx) => {
      // Concurrency check inside transaction: ensure copy is still available and not already on active loan
      const freshItem = await tx.bookItem.findUnique({
        where: { id: item.id },
        select: { status: true },
      });
      if (!freshItem || (freshItem.status !== 'AVAILABLE' && !(freshItem.status === 'REFERENCE_ONLY' && !policy.enforceReferenceOnly))) {
        throw new ValidationError(
          `Borrowing rejected: Book copy is currently ${(freshItem?.status || 'UNAVAILABLE').toLowerCase()}`
        );
      }

      // 1. Create circulation loan
      const circulation = await tx.circulation.create({
        data: {
          memberId: member.id,
          bookItemId: item.id,
          issuedByUserId,
          dueDate,
          status: 'ACTIVE',
        },
      });

      // 2. Transition BookItem status
      await tx.bookItem.update({
        where: { id: item.id },
        data: { status: 'ISSUED' },
      });

      // 3. Clear EAS security bit on RFID tag (authorized for portal exit)
      if (item.rfidTagId) {
        await tx.rFIDTag.update({
          where: { id: item.rfidTagId },
          data: { easArmed: false },
        });
      }

      // 4. Record audit ledger
      await tx.auditLog.create({
        data: {
          actorUserId: issuedByUserId,
          action: AuditAction.DISARM_EAS,
          entityName: 'Circulation',
          entityId: circulation.id,
          newState: {
            memberId: member.id,
            accessionNumber: item.accessionNumber,
            dueDate,
            easArmed: false,
          },
        },
      });

      return circulation;
    }, { timeout: 30000, maxWait: 15000 });
  }

  /**
   * Helper to resolve active loan record by circulationId, bookItemId, or accessionNumber
   */
  private async findLoan(input: {
    circulationId?: string;
    bookItemId?: string;
    accessionNumber?: string;
  }) {
    if (input.circulationId) {
      return prisma.circulation.findUnique({
        where: { id: input.circulationId },
        include: {
          bookItem: { include: { book: true, rfidTag: true } },
          member: true,
        },
      });
    }

    let targetBookItemId = input.bookItemId;
    if (!targetBookItemId && input.accessionNumber) {
      const copy = await prisma.bookItem.findUnique({
        where: { accessionNumber: input.accessionNumber },
        select: { id: true },
      });
      if (!copy) {
        throw new NotFoundError(
          `Physical book copy with accession number '${input.accessionNumber}' not found`
        );
      }
      targetBookItemId = copy.id;
    }

    if (!targetBookItemId) {
      throw new ValidationError(
        'A valid circulationId, bookItemId, or accessionNumber must be provided'
      );
    }

    return prisma.circulation.findFirst({
      where: {
        bookItemId: targetBookItemId,
        status: { in: [CirculationStatus.ACTIVE, CirculationStatus.OVERDUE] },
      },
      orderBy: { issuedDate: 'desc' },
      include: {
        bookItem: { include: { book: true, rfidTag: true } },
        member: true,
      },
    });
  }

  /**
   * Executes transactional return of borrowed book:
   * 1. Re-arms RFID EAS security bit
   * 2. Sets BookItem back to AVAILABLE
   * 3. Calculates overdue fines dynamically using persisted DAILY_FINE_RATE (default ₹5.00/day)
   * 4. Updates Member fineBalance if overdue
   * 5. Sets Circulation status to RETURNED
   * 6. Creates audit ledger entry
   */
  async returnLoan(input: ReturnLoanInput, returnedByUserId?: string) {
    const [loan, policy] = await Promise.all([
      this.findLoan(input),
      settingsService.getCirculationPolicies(),
    ]);

    if (!loan) {
      throw new NotFoundError('Active circulation loan record not found');
    }

    if (loan.status === CirculationStatus.RETURNED) {
      throw new ValidationError('This circulation loan has already been returned');
    }

    const now = new Date();
    const dueDate = new Date(loan.dueDate);
    let overdueDays = 0;
    let fineAmount = new Prisma.Decimal(0);

    if (now.getTime() > dueDate.getTime()) {
      const diffTime = now.getTime() - dueDate.getTime();
      overdueDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (overdueDays > 0) {
        fineAmount = policy.finePerOverdueDay.mul(new Prisma.Decimal(overdueDays));
      }
    }

    return prisma.$transaction(async (tx) => {
      // Concurrency check inside transaction to prevent duplicate return & duplicate fine assessment
      const currentLoan = await tx.circulation.findUnique({
        where: { id: loan.id },
        select: { status: true },
      });
      if (!currentLoan || currentLoan.status === CirculationStatus.RETURNED) {
        throw new ValidationError('This circulation loan has already been returned');
      }

      // 1. Update circulation record
      const updatedCirculation = await tx.circulation.update({
        where: { id: loan.id },
        data: {
          status: CirculationStatus.RETURNED,
          returnedDate: now,
          returnedToUserId: returnedByUserId || null,
          notes: input.notes
            ? loan.notes
              ? `${loan.notes}\n${input.notes}`
              : input.notes
            : loan.notes,
        },
      });

      // 2. Transition BookItem back to AVAILABLE
      await tx.bookItem.update({
        where: { id: loan.bookItemId },
        data: { status: 'AVAILABLE' },
      });

      // 3. Re-arm EAS anti-theft bit on RFID tag
      if (loan.bookItem.rfidTagId) {
        await tx.rFIDTag.update({
          where: { id: loan.bookItem.rfidTagId },
          data: { easArmed: true },
        });
      }

      // 4. If overdue, assess fine
      let createdFine = null;
      if (fineAmount.greaterThan(0)) {
        createdFine = await tx.fine.create({
          data: {
            circulationId: loan.id,
            memberId: loan.memberId,
            amount: fineAmount,
            paidAmount: new Prisma.Decimal(0),
            balance: fineAmount,
            status: FineStatus.UNPAID,
            reason: FineReason.OVERDUE,
          },
        });

        await tx.member.update({
          where: { id: loan.memberId },
          data: {
            fineBalance: {
              increment: fineAmount,
            },
          },
        });
      }

      // 5. Record Audit Log
      await tx.auditLog.create({
        data: {
          actorUserId: returnedByUserId || null,
          action: AuditAction.ARM_EAS,
          entityName: 'Circulation',
          entityId: loan.id,
          newState: {
            status: CirculationStatus.RETURNED,
            returnedDate: now,
            accessionNumber: loan.bookItem.accessionNumber,
            easArmed: true,
            overdueDays,
            fineAssessed: fineAmount.toNumber(),
          },
        },
      });

      return {
        circulation: updatedCirculation,
        bookItem: {
          id: loan.bookItem.id,
          accessionNumber: loan.bookItem.accessionNumber,
          status: 'AVAILABLE',
          easArmed: true,
        },
        overdueDays,
        fine: createdFine,
      };
    }, { timeout: 30000, maxWait: 15000 });
  }

  /**
   * Executes transactional renewal of borrowed book using persisted SystemConfiguration:
   * 1. Validates loan status is ACTIVE
   * 2. Enforces dynamic renewal limit (MAX_RENEWALS, default 2)
   * 3. Rejects reference-only items when ENFORCE_REFERENCE_ONLY_RESTRICTION is enabled
   * 4. Enforces member eligibility and dynamic FINE_BORROWING_THRESHOLD
   * 5. Calculates new dueDate using RENEWAL_EXTENSION_DAYS / FACULTY_RENEWAL_EXTENSION_DAYS
   * 6. Creates audit ledger entry
   */
  async renewLoan(input: RenewLoanInput, actorUserId?: string) {
    const [loan, policy] = await Promise.all([
      this.findLoan(input),
      settingsService.getCirculationPolicies(),
    ]);

    if (!loan) {
      throw new NotFoundError('Active circulation loan record not found');
    }

    if (loan.status === CirculationStatus.RETURNED) {
      throw new ValidationError('Cannot renew a loan that has already been returned');
    }

    if (loan.renewalCount >= policy.maxRenewals) {
      throw new ValidationError(
        `Renewal limit reached: A loan can only be renewed a maximum of ${policy.maxRenewals} times`
      );
    }

    if (policy.enforceReferenceOnly && loan.bookItem.isReferenceOnly) {
      throw new ValidationError(
        `Renewal rejected: Accession #${loan.bookItem.accessionNumber} is a Non-Circulating Reference Material`
      );
    }

    if (loan.member.status !== 'ACTIVE') {
      throw new ValidationError(
        `Renewal rejected: Member account is ${loan.member.status.toLowerCase()}`
      );
    }

    const memberFineDec = new Prisma.Decimal(loan.member.fineBalance);
    if (memberFineDec.greaterThan(policy.fineThreshold)) {
      throw new ValidationError(
        `Renewal rejected: Outstanding fines (₹${memberFineDec.toFixed(2)}) exceed the institutional policy threshold (₹${policy.fineThreshold.toFixed(2)})`
      );
    }

    const daysToAdd =
      loan.member.memberType === 'FACULTY'
        ? policy.facultyRenewalExtensionDays
        : policy.renewalExtensionDays;
    const baseDate = loan.dueDate > new Date() ? new Date(loan.dueDate) : new Date();
    const newDueDate = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

    return prisma.$transaction(async (tx) => {
      // Concurrency check inside transaction to prevent concurrent duplicate renewals exceeding MAX_RENEWALS
      const freshLoan = await tx.circulation.findUnique({
        where: { id: loan.id },
        select: { renewalCount: true, status: true },
      });
      if (!freshLoan || freshLoan.status === CirculationStatus.RETURNED) {
        throw new ValidationError('Cannot renew a loan that has already been returned');
      }
      if (freshLoan.renewalCount >= policy.maxRenewals) {
        throw new ValidationError(
          `Renewal limit reached: A loan can only be renewed a maximum of ${policy.maxRenewals} times`
        );
      }

      const updatedCirculation = await tx.circulation.update({
        where: { id: loan.id },
        data: {
          dueDate: newDueDate,
          renewalCount: { increment: 1 },
          status: CirculationStatus.ACTIVE,
        },
        include: {
          bookItem: { include: { book: true, rfidTag: true } },
          member: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId || null,
          action: AuditAction.UPDATE,
          entityName: 'Circulation',
          entityId: loan.id,
          previousState: {
            dueDate: loan.dueDate,
            renewalCount: loan.renewalCount,
          },
          newState: {
            dueDate: newDueDate,
            renewalCount: loan.renewalCount + 1,
            accessionNumber: loan.bookItem.accessionNumber,
          },
        },
      });

      return updatedCirculation;
    }, { timeout: 30000, maxWait: 15000 });
  }

  // ─── Retrieve single circulation by ID ─────────────────────────────────────

  async getCirculationById(id: string) {
    const circulation = await prisma.circulation.findUnique({
      where: { id },
      include: {
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            cardNumber: true,
            email: true,
            status: true,
            memberType: true,
            fineBalance: true,
          },
        },
        bookItem: {
          include: {
            book: {
              select: {
                id: true,
                title: true,
                isbn13: true,
                callNumber: true,
              },
            },
            rfidTag: {
              select: { epc: true, easArmed: true },
            },
          },
        },
        issuedByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        fines: true,
      },
    });

    if (!circulation) {
      throw new NotFoundError(`Circulation record ${id} not found`);
    }

    return {
      id: circulation.id,
      status: circulation.status,
      issuedDate: circulation.issuedDate,
      dueDate: circulation.dueDate,
      returnedDate: circulation.returnedDate,
      renewalCount: circulation.renewalCount,
      notes: circulation.notes,
      member: {
        id: circulation.member.id,
        name: `${circulation.member.firstName} ${circulation.member.lastName}`,
        cardNumber: circulation.member.cardNumber,
        email: circulation.member.email,
        memberType: circulation.member.memberType,
        fineBalance: Number(circulation.member.fineBalance),
      },
      item: {
        id: circulation.bookItem.id,
        accessionNumber: circulation.bookItem.accessionNumber,
        title: circulation.bookItem.book.title,
        isbn13: circulation.bookItem.book.isbn13,
        callNumber: circulation.bookItem.book.callNumber,
        shelfLocation: circulation.bookItem.shelfLocation,
        rfidTag: circulation.bookItem.rfidTag,
      },
      issuedBy: `${circulation.issuedByUser.firstName} ${circulation.issuedByUser.lastName}`,
      fines: circulation.fines.map((f) => ({
        id: f.id,
        amount: Number(f.amount),
        paidAmount: Number(f.paidAmount),
        balance: Number(f.balance),
        status: f.status,
        reason: f.reason,
        receiptNumber: f.receiptNumber,
        createdAt: f.createdAt,
      })),
    };
  }

  // ─── Fine Management ────────────────────────────────────────────────────────

  async getFines(query: GetFinesQuery) {
    const { memberId, circulationId, status, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.FineWhereInput = {
      ...(memberId ? { memberId } : {}),
      ...(circulationId ? { circulationId } : {}),
      ...(status ? { status } : {}),
    };

    const [total, fines] = await Promise.all([
      prisma.fine.count({ where }),
      prisma.fine.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          member: {
            select: { id: true, firstName: true, lastName: true, cardNumber: true },
          },
          circulation: {
            select: {
              id: true,
              issuedDate: true,
              dueDate: true,
              returnedDate: true,
              bookItem: {
                select: {
                  accessionNumber: true,
                  book: { select: { title: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    const items = fines.map((f) => ({
      id: f.id,
      amount: Number(f.amount),
      paidAmount: Number(f.paidAmount),
      balance: Number(f.balance),
      status: f.status,
      reason: f.reason,
      receiptNumber: f.receiptNumber,
      createdAt: f.createdAt,
      member: {
        id: f.member.id,
        name: `${f.member.firstName} ${f.member.lastName}`,
        cardNumber: f.member.cardNumber,
      },
      circulation: f.circulation
        ? {
            id: f.circulation.id,
            issuedDate: f.circulation.issuedDate,
            dueDate: f.circulation.dueDate,
            returnedDate: f.circulation.returnedDate,
            bookTitle: f.circulation.bookItem?.book?.title ?? 'Unknown',
            accessionNumber: f.circulation.bookItem?.accessionNumber ?? '',
          }
        : null,
    }));

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async payFine(input: PayFineInput, actorUserId?: string) {
    const fine = await prisma.fine.findUnique({
      where: { id: input.fineId },
      include: { member: true },
    });

    if (!fine) {
      throw new NotFoundError(`Fine record ${input.fineId} not found`);
    }

    if (fine.status === FineStatus.PAID || fine.status === FineStatus.WAIVED) {
      throw new ValidationError(`Fine is already ${fine.status.toLowerCase()} and cannot be modified`);
    }

    const currentBalance = new Prisma.Decimal(fine.balance);
    const paymentAmount = new Prisma.Decimal(input.amount);

    if (paymentAmount.greaterThan(currentBalance)) {
      throw new ValidationError(
        `Payment amount ₹${input.amount.toFixed(2)} exceeds outstanding balance ₹${currentBalance.toFixed(2)}`
      );
    }

    const newPaidAmount = new Prisma.Decimal(fine.paidAmount).plus(paymentAmount);
    const newBalance = currentBalance.minus(paymentAmount);
    const newStatus = newBalance.lessThanOrEqualTo(0) ? FineStatus.PAID : FineStatus.PARTIALLY_PAID;

    return prisma.$transaction(async (tx) => {
      const receiptNumber = newStatus === FineStatus.PAID
        ? `RCP-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
        : fine.receiptNumber;

      const updatedFine = await tx.fine.update({
        where: { id: fine.id },
        data: {
          paidAmount: newPaidAmount,
          balance: newBalance,
          status: newStatus,
          receiptNumber,
        },
      });

      // Decrement member fine balance
      await tx.member.update({
        where: { id: fine.memberId },
        data: { fineBalance: { decrement: paymentAmount } },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId ?? null,
          action: AuditAction.UPDATE,
          entityName: 'Fine',
          entityId: fine.id,
          previousState: {
            paidAmount: Number(fine.paidAmount),
            balance: Number(fine.balance),
            status: fine.status,
          },
          newState: {
            paidAmount: Number(newPaidAmount),
            balance: Number(newBalance),
            status: newStatus,
            receiptNumber,
            paymentMethod: input.paymentMethod,
          },
        },
      });

      return {
        fine: {
          id: updatedFine.id,
          amount: Number(updatedFine.amount),
          paidAmount: Number(updatedFine.paidAmount),
          balance: Number(updatedFine.balance),
          status: updatedFine.status,
          receiptNumber: updatedFine.receiptNumber,
        },
        message: newStatus === FineStatus.PAID
          ? `Fine fully settled. Receipt: ${receiptNumber}`
          : `Partial payment of ₹${input.amount.toFixed(2)} recorded. Remaining balance: ₹${Number(newBalance).toFixed(2)}`,
      };
    }, { timeout: 30000, maxWait: 15000 });
  }

  async waiveFine(input: WaiveFineInput, actorUserId: string) {
    const fine = await prisma.fine.findUnique({
      where: { id: input.fineId },
      include: { member: true },
    });

    if (!fine) {
      throw new NotFoundError(`Fine record ${input.fineId} not found`);
    }

    if (fine.status === FineStatus.PAID || fine.status === FineStatus.WAIVED) {
      throw new ValidationError(`Fine is already ${fine.status.toLowerCase()} and cannot be waived`);
    }

    const remainingBalance = new Prisma.Decimal(fine.balance);

    return prisma.$transaction(async (tx) => {
      const updatedFine = await tx.fine.update({
        where: { id: fine.id },
        data: {
          status: FineStatus.WAIVED,
          balance: new Prisma.Decimal(0),
          waivedByUserId: actorUserId,
          waivedReason: input.reason,
        },
      });

      // Remove waived amount from member's fine balance
      await tx.member.update({
        where: { id: fine.memberId },
        data: { fineBalance: { decrement: remainingBalance } },
      });

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: AuditAction.WAIVE_FINE,
          entityName: 'Fine',
          entityId: fine.id,
          previousState: {
            balance: Number(fine.balance),
            status: fine.status,
          },
          newState: {
            balance: 0,
            status: FineStatus.WAIVED,
            waivedReason: input.reason,
            waivedByUserId: actorUserId,
          },
        },
      });

      return {
        id: updatedFine.id,
        status: updatedFine.status,
        balance: 0,
        waivedReason: updatedFine.waivedReason,
        message: `Fine of ₹${Number(fine.balance).toFixed(2)} waived successfully`,
      };
    }, { timeout: 30000, maxWait: 15000 });
  }

  // ─── Due-Date Enquiry (Phase 5A SOP 2.4) ────────────────────────────────────

  async dueDateEnquiry(params: {
    search?: string;
    accessionNumber?: string;
    cardNumber?: string;
    barcode?: string;
  }) {
    const policy = await settingsService.getCirculationPolicies();
    const q = (
      params.search ||
      params.accessionNumber ||
      params.cardNumber ||
      params.barcode ||
      ''
    ).trim();

    const where: Prisma.CirculationWhereInput = {
      status: { in: [CirculationStatus.ACTIVE, CirculationStatus.OVERDUE] },
      ...(q
        ? {
            OR: [
              { bookItem: { accessionNumber: { contains: q, mode: 'insensitive' } } },
              { bookItem: { barcode: { contains: q, mode: 'insensitive' } } },
              { bookItem: { rfidTag: { epc: { contains: q, mode: 'insensitive' } } } },
              { bookItem: { book: { title: { contains: q, mode: 'insensitive' } } } },
              { member: { cardNumber: { contains: q, mode: 'insensitive' } } },
              { member: { firstName: { contains: q, mode: 'insensitive' } } },
              { member: { lastName: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const loans = await prisma.circulation.findMany({
      where,
      orderBy: { dueDate: 'asc' },
      take: 50,
      include: {
        bookItem: {
          include: {
            book: { select: { id: true, title: true, isbn13: true, callNumber: true } },
            rfidTag: { select: { epc: true, easArmed: true } },
          },
        },
        member: {
          select: {
            id: true,
            cardNumber: true,
            firstName: true,
            lastName: true,
            memberType: true,
            status: true,
            fineBalance: true,
          },
        },
      },
    });

    const now = new Date();
    const finePerDayNum = Number(policy.finePerOverdueDay);

    const items = loans.map((loan) => {
      const diffMs = loan.dueDate.getTime() - now.getTime();
      const isOverdue = diffMs < 0;
      const overdueDays = isOverdue ? Math.ceil(Math.abs(diffMs) / (1000 * 60 * 60 * 24)) : 0;
      const daysRemaining = !isOverdue ? Math.ceil(diffMs / (1000 * 60 * 60 * 24)) : 0;
      const estimatedAccruedFine = overdueDays * finePerDayNum;
      const canRenew =
        loan.renewalCount < policy.maxRenewals &&
        loan.member.status === 'ACTIVE' &&
        Number(loan.member.fineBalance) <= Number(policy.fineThreshold);

      return {
        circulationId: loan.id,
        accessionNumber: loan.bookItem.accessionNumber,
        barcode: loan.bookItem.barcode,
        epc: loan.bookItem.rfidTag?.epc || null,
        bookTitle: loan.bookItem.book.title,
        isbn13: loan.bookItem.book.isbn13,
        callNumber: loan.bookItem.book.callNumber,
        memberId: loan.member.id,
        memberName: `${loan.member.firstName} ${loan.member.lastName}`,
        memberCardNumber: loan.member.cardNumber,
        memberType: loan.member.memberType,
        issuedDate: loan.issuedDate.toISOString(),
        dueDate: loan.dueDate.toISOString(),
        isOverdue,
        daysRemaining,
        overdueDays,
        estimatedAccruedFine,
        renewalCount: loan.renewalCount,
        maxRenewals: policy.maxRenewals,
        canRenew,
      };
    });

    return {
      query: q || 'ALL_ACTIVE_LOANS',
      totalActiveMatches: items.length,
      overdueMatches: items.filter((i) => i.isOverdue).length,
      items,
    };
  }
}

export const circulationService = new CirculationService();

