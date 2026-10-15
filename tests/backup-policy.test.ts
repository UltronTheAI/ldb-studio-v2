import { describe, it } from "node:test";
import assert from "node:assert";
import {
  DEFAULT_MAX_MANUAL_BACKUPS,
  MAX_RETENTION_DAYS,
  filterManualBackups,
  filterAutomaticBackups,
  getBackupExpirationInfo,
  validateRetentionDays,
  checkManualBackupLimit,
} from "../lib/studio/backup-policy";

describe("LioranDB Studio Backup Policy & Automation", () => {
  describe("Manual Backup Quota & Limit Enforcement", () => {
    it("defaults to max 10 manual backups", () => {
      assert.strictEqual(DEFAULT_MAX_MANUAL_BACKUPS, 10);
    });

    it("allows creating backups when manual count is below limit", () => {
      const res = checkManualBackupLimit(5, 10);
      assert.strictEqual(res.allowed, true);
      assert.strictEqual(res.current, 5);
      assert.strictEqual(res.max, 10);
      assert.strictEqual(res.remaining, 5);
      assert.strictEqual(res.error, undefined);
    });

    it("blocks creating backups when manual count reaches default 10 limit", () => {
      const res = checkManualBackupLimit(10, 10);
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.current, 10);
      assert.strictEqual(res.max, 10);
      assert.strictEqual(res.remaining, 0);
      assert.match(res.error || "", /Manual backup capacity reached/);
    });

    it("respects user-modified manual backup quota", () => {
      // User modified limit to 5
      const res5 = checkManualBackupLimit(5, 5);
      assert.strictEqual(res5.allowed, false);

      // User modified limit to 15
      const res15 = checkManualBackupLimit(10, 15);
      assert.strictEqual(res15.allowed, true);
      assert.strictEqual(res15.remaining, 5);
    });

    it("excludes automatic backups (Daily, Weekly) from manual backup limit", () => {
      const allBackups = [
        { id: "b1", backup_type: "Manual" },
        { id: "b2", backup_type: "Manual" },
        { id: "b3", backup_type: "Daily" },
        { id: "b4", backup_type: "Daily" },
        { id: "b5", backup_type: "Weekly" },
        { id: "b6", backup_type: "Weekly" },
        { id: "b7", backup_type: "Monthly" },
        { id: "b8" }, // legacy without backup_type defaults to manual
      ];

      const manual = filterManualBackups(allBackups);
      assert.strictEqual(manual.length, 3); // b1, b2, b8
      assert.deepStrictEqual(
        manual.map((b) => b.id),
        ["b1", "b2", "b8"],
      );

      const automatic = filterAutomaticBackups(allBackups);
      assert.strictEqual(automatic.length, 5); // b3, b4, b5, b6, b7
      assert.deepStrictEqual(
        automatic.map((b) => b.id),
        ["b3", "b4", "b5", "b6", "b7"],
      );

      // Even though there are 8 total backups, manual count is only 3, so under limit of 10
      const limitCheck = checkManualBackupLimit(manual.length, 10);
      assert.strictEqual(limitCheck.allowed, true);
      assert.strictEqual(limitCheck.remaining, 7);
    });
  });

  describe("Retention Period Rules (Max 3 Days)", () => {
    it("enforces MAX_RETENTION_DAYS constant as 3", () => {
      assert.strictEqual(MAX_RETENTION_DAYS, 3);
    });

    it("accepts valid retention days between 1 and 3", () => {
      const r1 = validateRetentionDays(1);
      assert.strictEqual(r1.valid, true);
      assert.strictEqual(r1.value, 1);

      const r2 = validateRetentionDays(2);
      assert.strictEqual(r2.valid, true);
      assert.strictEqual(r2.value, 2);

      const r3 = validateRetentionDays(3);
      assert.strictEqual(r3.valid, true);
      assert.strictEqual(r3.value, 3);
    });

    it("rejects retention days greater than 3", () => {
      const r4 = validateRetentionDays(4);
      assert.strictEqual(r4.valid, false);
      assert.match(r4.error || "", /cannot exceed 3 days/);

      const r7 = validateRetentionDays(7);
      assert.strictEqual(r7.valid, false);

      const r30 = validateRetentionDays(30);
      assert.strictEqual(r30.valid, false);
    });

    it("rejects invalid or negative retention days", () => {
      const r0 = validateRetentionDays(0);
      assert.strictEqual(r0.valid, false);

      const rNeg = validateRetentionDays(-1);
      assert.strictEqual(rNeg.valid, false);

      const rNaN = validateRetentionDays(NaN);
      assert.strictEqual(rNaN.valid, false);
    });
  });

  describe("Backup Expiration Calculation", () => {
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const ONE_HOUR_MS = 60 * 60 * 1000;

    it("marks fresh backup (< 1 hour old) with 3 days retention as not expired", () => {
      const now = Date.now();
      const info = getBackupExpirationInfo(now - 1000 * 60 * 5, 3);
      assert.strictEqual(info.isExpired, false);
      assert.strictEqual(info.retentionDays, 3);
      assert.strictEqual(info.daysRemaining, 3);
      assert.strictEqual(info.label, "Expires in 3d");
    });

    it("shows hours remaining when less than 24 hours left", () => {
      const now = Date.now();
      // Created 2.5 days ago with 3 days retention -> ~12 hours remaining
      const created = now - (2.5 * ONE_DAY_MS);
      const info = getBackupExpirationInfo(created, 3);
      assert.strictEqual(info.isExpired, false);
      assert.strictEqual(info.hoursRemaining <= 24, true);
      assert.match(info.label, /^Expires in \d+h$/);
    });

    it("marks backup older than 3 days as expired", () => {
      const now = Date.now();
      // Created 4 days ago
      const created = now - (4 * ONE_DAY_MS);
      const info = getBackupExpirationInfo(created, 3);
      assert.strictEqual(info.isExpired, true);
      assert.strictEqual(info.daysRemaining, 0);
      assert.match(info.label, /^Expired \(\d+d ago\)$/);
    });

    it("strictly clamps retentionDays to max 3 days even if higher setting is passed", () => {
      const now = Date.now();
      // Even if user attempts 10 days, effective retention must clamp to 3
      const info = getBackupExpirationInfo(now, 10);
      assert.strictEqual(info.retentionDays, 3);

      // If created 4 days ago, it must be expired despite the 10 days setting
      const info4 = getBackupExpirationInfo(now - 4 * ONE_DAY_MS, 10);
      assert.strictEqual(info4.isExpired, true);
    });
  });
});
