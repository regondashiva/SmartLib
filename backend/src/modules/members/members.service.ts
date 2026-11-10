import { prisma } from '../../config/prisma.js';
import { NotFoundError } from '../../utils/errors.js';
import { GetMembersQuery } from './members.schema.js';
import { Prisma } from '@prisma/client';

export class MembersService {
  async getMembers(query: GetMembersQuery) {
    const { page, limit, search, memberType, status } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.MemberWhereInput = {
      deletedAt: null,
      ...(memberType ? { memberType } : {}),
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { cardNumber: { contains: search, mode: 'insensitive' } },
              { smartCardUid: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, members] = await Promise.all([
      prisma.member.count({ where }),
      prisma.member.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastName: 'asc' },
        include: {
          circulations: {
            where: { status: 'ACTIVE' },
            select: { id: true },
          },
        },
      }),
    ]);

    const formatted = members.map((member) => ({
      id: member.id,
      cardNumber: member.cardNumber,
      smartCardUid: member.smartCardUid,
      firstName: member.firstName,
      lastName: member.lastName,
      fullName: `${member.firstName} ${member.lastName}`,
      email: member.email,
      phoneNumber: member.phoneNumber,
      memberType: member.memberType,
      department: member.department,
      status: member.status,
      maxBorrowLimit: member.maxBorrowLimit,
      fineBalance: member.fineBalance,
      activeLoansCount: member.circulations.length,
      availableLoanAllowance: Math.max(0, member.maxBorrowLimit - member.circulations.length),
      expiryDate: member.expiryDate,
      createdAt: member.createdAt,
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

  async getMemberById(id: string) {
    const member = await prisma.member.findFirst({
      where: { id, deletedAt: null },
      include: {
        circulations: {
          where: { status: 'ACTIVE' },
          include: {
            bookItem: {
              include: {
                book: { select: { title: true, isbn13: true } },
              },
            },
          },
        },
        fines: {
          where: { status: { in: ['UNPAID', 'PARTIALLY_PAID'] } },
        },
      },
    });

    if (!member) {
      throw new NotFoundError(`Member with ID '${id}' not found`);
    }

    return member;
  }

  async getMemberBySmartCardUid(uid: string) {
    const member = await prisma.member.findUnique({
      where: { smartCardUid: uid },
      include: {
        circulations: {
          where: { status: 'ACTIVE' },
          include: {
            bookItem: {
              include: {
                book: { select: { title: true, isbn13: true } },
              },
            },
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundError(`No member registered with Smart Card UID '${uid}'`);
    }

    return member;
  }
}

export const membersService = new MembersService();

