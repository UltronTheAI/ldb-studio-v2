export const DEFAULT_MAX_MANUAL_BACKUPS = 10;
export const MAX_RETENTION_DAYS = 3; // Strict cap: retention is max 3 days per backup

export interface BackupExpirationInfo {
  createdAtMs: number;
  retentionDays: number;
  expiresAtMs: number;
  isExpired: boolean;
  daysRemaining: number;
  hoursRemaining: number;
  label: string;
}

/**
 * Filter backups that were created manually by a user (excludes automated schedules: Daily, Weekly, Hourly, Monthly).
 */
export function filterManualBackups<T extends { backup_type?: string }>(
  backups: readonly T[],
): T[] {
  return backups.filter(
    (b) => !b.backup_type || b.backup_type.toLowerCase() === "manual",
  );
}

/**
 * Filter automated backups (Daily, Weekly, Hourly, Monthly).
 */
export function filterAutomaticBackups<T extends { backup_type?: string }>(
  backups: readonly T[],
): T[] {
  return backups.filter(
    (b) => b.backup_type && b.backup_type.toLowerCase() !== "manual",
  );
}

/**
 * Calculate expiration and retention information for a backup.
 * Retention is capped at a maximum of 3 days.
 */
export function getBackupExpirationInfo(
  createdAtMs: number | undefined | null,
  retentionDaysSetting: number = MAX_RETENTION_DAYS,
): BackupExpirationInfo {
  const created = createdAtMs || Date.now();
  // Retention is strictly capped at a maximum of 3 days
  const effectiveRetentionDays = Math.min(
    MAX_RETENTION_DAYS,
    Math.max(1, retentionDaysSetting || MAX_RETENTION_DAYS),
  );
  const retentionMs = effectiveRetentionDays * 24 * 60 * 60 * 1000;
  const expiresAtMs = created + retentionMs;
  const now = Date.now();
  const msRemaining = expiresAtMs - now;
  const isExpired = msRemaining <= 0;

  const hoursRemaining = Math.max(0, Math.floor(msRemaining / (1000 * 60 * 60)));
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

  let label: string;
  if (isExpired) {
    const expiredDaysAgo = Math.ceil(Math.abs(msRemaining) / (1000 * 60 * 60 * 24));
    label = `Expired (${expiredDaysAgo}d ago)`;
  } else if (hoursRemaining < 24) {
    label = `Expires in ${hoursRemaining}h`;
  } else {
    label = `Expires in ${daysRemaining}d`;
  }

  return {
    createdAtMs: created,
    retentionDays: effectiveRetentionDays,
    expiresAtMs,
    isExpired,
    daysRemaining,
    hoursRemaining,
    label,
  };
}

/**
 * Validates that retention days do not exceed 3 days per policy rule.
 */
export function validateRetentionDays(days: number): {
  valid: boolean;
  value: number;
  error?: string;
} {
  if (typeof days !== "number" || Number.isNaN(days)) {
    return {
      valid: false,
      value: MAX_RETENTION_DAYS,
      error: "Retention days must be a valid number.",
    };
  }
  if (days < 1) {
    return {
      valid: false,
      value: 1,
      error: "Retention days must be at least 1 day.",
    };
  }
  if (days > MAX_RETENTION_DAYS) {
    return {
      valid: false,
      value: MAX_RETENTION_DAYS,
      error: `Retention period cannot exceed ${MAX_RETENTION_DAYS} days per policy rule (max 3 days).`,
    };
  }
  return {
    valid: true,
    value: Math.floor(days),
  };
}

/**
 * Checks if another manual backup can be created under the max manual limit.
 */
export function checkManualBackupLimit(
  currentManualCount: number,
  maxManualLimit: number = DEFAULT_MAX_MANUAL_BACKUPS,
): {
  allowed: boolean;
  current: number;
  max: number;
  remaining: number;
  error?: string;
} {
  const max = Math.max(1, maxManualLimit || DEFAULT_MAX_MANUAL_BACKUPS);
  const remaining = Math.max(0, max - currentManualCount);
  const allowed = currentManualCount < max;

  return {
    allowed,
    current: currentManualCount,
    max,
    remaining,
    error: allowed
      ? undefined
      : `Manual backup capacity reached (${currentManualCount}/${max} taken, excluding automatic backups). Delete an existing manual backup or adjust your backup policy.`,
  };
}
