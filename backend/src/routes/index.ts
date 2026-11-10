import { Router, Request, Response } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import booksRoutes from '../modules/books/books.routes.js';
import membersRoutes from '../modules/members/members.routes.js';
import circulationRoutes from '../modules/circulation/circulation.routes.js';
import auditRoutes from '../modules/audit/audit.routes.js';
import rfidRoutes from '../modules/rfid/rfid.routes.js';
import migrationRoutes from '../modules/migration/migration.routes.js';
import reportsRoutes from '../modules/reports/reports.routes.js';
import dashboardRoutes from '../modules/dashboard/dashboard.routes.js';
import settingsRoutes from '../modules/settings/settings.routes.js';
import systemRoutes from '../modules/system/system.routes.js';
import acquisitionsRoutes from '../modules/acquisitions/acquisitions.routes.js';
import serialsRoutes from '../modules/serials/serials.routes.js';
import labelsRoutes from '../modules/labels/labels.routes.js';
import opacRoutes from '../modules/opac/opac.routes.js';
import adaptersRoutes from '../modules/adapters/adapters.routes.js';
import notificationsRoutes from '../modules/notifications/notifications.routes.js';
import { prisma } from '../config/prisma.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { env } from '../config/env.js';

const router = Router();

// ------------------------------------------------------------------------------
// Health Check Endpoint (GET /api/v1/health)
// ------------------------------------------------------------------------------
router.get('/health', async (_req: Request, res: Response) => {
  const startTime = Date.now();
  let dbStatus = 'CONNECTED';
  let latencyMs = 0;
  let dbError: string | null = null;

  try {
    // Quick test query to verify Neon connection
    await prisma.$queryRaw`SELECT 1`;
    latencyMs = Date.now() - startTime;
  } catch (error) {
    dbStatus = 'DISCONNECTED';
    dbError = (error as Error).message;
  }

  const isDegraded = dbStatus === 'DISCONNECTED';

  return sendSuccess(
    res,
    {
      status: isDegraded ? 'DEGRADED' : 'HEALTHY',
      api: 'ONLINE',
      service: 'smartlib-backend-engine',
      version: '1.0.0-phase2a',
      environment: env.NODE_ENV,
      database: {
        provider: 'Neon Serverless PostgreSQL',
        status: dbStatus,
        latencyMs,
        ...(dbError ? { error: dbError } : {}),
      },
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsage: {
        rssMb: Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100,
        heapUsedMb:
          Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
      },
      mockRfidMode: env.MOCK_RFID_MODE,
    },
    isDegraded
      ? 'SmartLib Backend Engine is operational (Database connection degraded)'
      : 'SmartLib Backend Engine is operational',
    200
  );
});

// ------------------------------------------------------------------------------
// API Modules
// ------------------------------------------------------------------------------
router.use('/auth', authRoutes);
router.use('/books', booksRoutes);
router.use('/members', membersRoutes);
router.use('/circulation', circulationRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/rfid', rfidRoutes);
router.use('/migration', migrationRoutes);
router.use('/migrations', migrationRoutes);
router.use('/reports', reportsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/settings', settingsRoutes);
router.use('/system', systemRoutes);
router.use('/acquisitions', acquisitionsRoutes);
router.use('/serials', serialsRoutes);
router.use('/labels', labelsRoutes);
router.use('/opac', opacRoutes);
router.use('/adapters', adaptersRoutes);
router.use('/notifications', notificationsRoutes);

export default router;

