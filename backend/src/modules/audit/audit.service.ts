import { prisma } from '../../config/prisma.js';
import { GetAuditLogsQuery } from './audit.schema.js';
import { Prisma } from '@prisma/client';

export class AuditService {
  async getAuditLogs(query: GetAuditLogsQuery) {
    const { page, limit, action, entityName, actorUserId } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {
      ...(action ? { action } : {}),
      ...(entityName ? { entityName } : {}),
      ...(actorUserId ? { actorUserId } : {}),
    };

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          actorUser: {
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

    const formatted = logs.map((log) => ({
      id: log.id,
      timestamp: log.timestamp,
      action: log.action,
      entityName: log.entityName,
      entityId: log.entityId,
      actor: log.actorUser
        ? `${log.actorUser.firstName} ${log.actorUser.lastName}`
        : log.actorEmail || 'System / Automated',
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      previousState: log.previousState,
      newState: log.newState,
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
}

export const auditService = new AuditService();

