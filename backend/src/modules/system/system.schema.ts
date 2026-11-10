import { z } from 'zod';

/**
 * Update State Machine States
 */
export const UPDATE_STATES = [
  'IDLE',
  'PENDING',
  'VALIDATING',
  'BACKING_UP',
  'APPLYING',
  'VERIFYING',
  'COMPLETED',
  'FAILED',
  'ROLLING_BACK',
  'ROLLED_BACK',
] as const;

export type UpdateOperationState = (typeof UPDATE_STATES)[number];

/**
 * Version Manifest Schema (`version-manifest.json`)
 * Enforces semantic versioning, runtime requirements, component versions,
 * SHA-256 package checksums, and database migration compatibility metadata.
 */
export const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/;
export const sha256Regex = /^[a-fA-F0-9]{64}$/;

export const componentChecksumSchema = z
  .object({
    archiveName: z.string().min(1).max(200),
    sha256: z.string().regex(sha256Regex, 'Checksum must be a valid 64-character hex SHA-256 digest'),
    sizeBytes: z.number().int().nonnegative(),
  })
  .strict();

export const versionManifestSchema = z
  .object({
    packageId: z.string().min(3).max(120),
    appVersion: z.string().regex(semverRegex, 'appVersion must follow SemVer (e.g. 1.5.0)'),
    minSupportedUpgradeVersion: z
      .string()
      .regex(semverRegex, 'minSupportedUpgradeVersion must follow SemVer'),
    buildTimestamp: z.string().datetime({ message: 'buildTimestamp must be ISO-8601 UTC datetime' }),
    components: z
      .object({
        frontendVersion: z.string().regex(semverRegex),
        backendVersion: z.string().regex(semverRegex),
        rfidMiddlewareVersion: z.string().regex(semverRegex),
        databaseSchemaVersion: z.string().min(3).max(60),
      })
      .strict(),
    requiredRuntimes: z
      .object({
        nodeMinVersion: z.string().regex(semverRegex),
        pythonMinVersion: z.string().regex(semverRegex),
        postgresqlMinVersion: z.string().regex(/^\d+(\.\d+)?$/),
        supportedOs: z.array(z.string().min(2)).min(1),
      })
      .strict(),
    migrations: z
      .object({
        requiresSchemaMigration: z.boolean(),
        backwardCompatible: z.boolean(),
        destructiveChanges: z.boolean().default(false),
        migrationFiles: z.array(z.string()).default([]),
      })
      .strict(),
    checksums: z
      .object({
        frontendBundle: componentChecksumSchema,
        backendBundle: componentChecksumSchema,
        rfidMiddlewareBundle: componentChecksumSchema,
        databaseSchemaBundle: componentChecksumSchema,
      })
      .strict(),
    releaseNotes: z.array(z.string().min(3)).min(1),
  })
  .strict();

export type VersionManifest = z.infer<typeof versionManifestSchema>;

/**
 * Request schema for validating an offline update package
 */
export const validatePackageBodySchema = z
  .object({
    packageId: z.string().min(1).max(120).optional(),
    manifest: z.record(z.unknown()),
    actualChecksums: z
      .object({
        frontendBundle: z.string().optional(),
        backendBundle: z.string().optional(),
        rfidMiddlewareBundle: z.string().optional(),
        databaseSchemaBundle: z.string().optional(),
      })
      .optional(),
    simulatedRuntimeVersions: z
      .object({
        nodeVersion: z.string().optional(),
        pythonVersion: z.string().optional(),
        freeDiskSpaceMb: z.number().optional(),
      })
      .optional(),
  })
  .strict();

export type ValidatePackageInput = z.infer<typeof validatePackageBodySchema>;

/**
 * Request schema for creating a verified database backup
 */
export const createBackupBodySchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(3, 'Backup label must be at least 3 characters')
      .max(120, 'Backup label cannot exceed 120 characters')
      .regex(/^[a-zA-Z0-9 _.-]+$/, 'Backup label contains invalid characters')
      .default('Manual Pre-Update Snapshot'),
    isKnownGood: z.boolean().optional().default(false),
  })
  .strict();

export type CreateBackupInput = z.infer<typeof createBackupBodySchema>;

/**
 * Request schema for verifying / testing restore readiness of a backup
 */
export const verifyBackupRestoreBodySchema = z
  .object({
    backupId: z
      .string()
      .trim()
      .min(3)
      .max(120)
      .regex(/^[a-zA-Z0-9_.-]+$/, 'Invalid backup identifier'),
    confirmRestoreWarning: z.boolean().optional().default(false),
    mode: z.enum(['DRY_RUN_VERIFY', 'FULL_RESTORE']).default('DRY_RUN_VERIFY'),
    reason: z.string().trim().min(5).max(300).optional(),
  })
  .strict();

export type VerifyBackupRestoreInput = z.infer<typeof verifyBackupRestoreBodySchema>;

/**
 * Request schema for executing a controlled application update
 */
export const executeUpdateBodySchema = z
  .object({
    manifest: z.record(z.unknown()),
    actualChecksums: z
      .object({
        frontendBundle: z.string().optional(),
        backendBundle: z.string().optional(),
        rfidMiddlewareBundle: z.string().optional(),
        databaseSchemaBundle: z.string().optional(),
      })
      .optional(),
    reason: z
      .string()
      .trim()
      .min(5, 'Update reason is required for audit compliance')
      .max(300)
      .default('Scheduled offline release update'),
    simulateFailureStage: z
      .enum(['NONE', 'BACKUP_FAILURE', 'MIGRATION_FAILURE', 'HEALTH_CHECK_FAILURE'])
      .optional()
      .default('NONE'),
    autoRollbackOnFailure: z.boolean().optional().default(true),
  })
  .strict();

export type ExecuteUpdateInput = z.infer<typeof executeUpdateBodySchema>;

/**
 * Request schema for executing an application rollback to the last known-good version
 */
export const executeRollbackBodySchema = z
  .object({
    targetVersion: z.string().regex(semverRegex).optional(),
    backupId: z
      .string()
      .regex(/^[a-zA-Z0-9_.-]+$/)
      .optional(),
    restoreDatabaseFromBackup: z.boolean().default(false),
    confirmDataLossWarning: z.boolean().default(false),
    reason: z
      .string()
      .trim()
      .min(5, 'Rollback reason must be at least 5 characters')
      .max(300),
  })
  .strict()
  .refine(
    (data) => !data.restoreDatabaseFromBackup || data.confirmDataLossWarning === true,
    {
      message:
        'Restoring a database backup requires explicit ADMIN confirmation (confirmDataLossWarning: true) acknowledging that transactions recorded after the backup timestamp may be affected.',
    }
  );

export type ExecuteRollbackInput = z.infer<typeof executeRollbackBodySchema>;

/**
 * Pagination query schema for update history
 */
export const systemHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type SystemHistoryQuery = z.infer<typeof systemHistoryQuerySchema>;

