import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  try {
    // Verify database connectivity on startup
    logger.info('Connecting to Neon Serverless PostgreSQL...');
    await prisma.$connect();
    logger.info('✅ Successfully connected to Neon PostgreSQL database');

    const server = app.listen(env.PORT, () => {
      logger.info(
        `🚀 SmartLib Backend Engine listening on http://localhost:${env.PORT}${env.API_PREFIX}`
      );
      logger.info(`📡 Health check available at: http://localhost:${env.PORT}${env.API_PREFIX}/health`);
      logger.info(`⚙️  Environment: ${env.NODE_ENV} | RFID Mock Mode: ${env.MOCK_RFID_MODE}`);
    });

    // Graceful Shutdown Handling
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Gracefully shutting down SmartLib server...`);
      server.close(async () => {
        logger.info('HTTP server closed');
        await prisma.$disconnect();
        logger.info('Database connection closed');
        process.exit(0);
      });

      // Force shutdown after 10 seconds if hanging
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start SmartLib Backend Engine:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

bootstrap();

