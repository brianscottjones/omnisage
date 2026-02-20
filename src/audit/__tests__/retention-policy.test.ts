import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { RetentionPolicy } from '../retention-policy.js';

const TEST_LOG_DIR = '/tmp/omnisage-retention-test';
const TEST_ARCHIVE_DIR = '/tmp/omnisage-archive-test';

describe('RetentionPolicy', () => {
  beforeEach(() => {
    // Clean up test directories
    if (fs.existsSync(TEST_LOG_DIR)) {
      fs.rmSync(TEST_LOG_DIR, { recursive: true });
    }
    if (fs.existsSync(TEST_ARCHIVE_DIR)) {
      fs.rmSync(TEST_ARCHIVE_DIR, { recursive: true });
    }

    fs.mkdirSync(TEST_LOG_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_LOG_DIR)) {
      fs.rmSync(TEST_LOG_DIR, { recursive: true });
    }
    if (fs.existsSync(TEST_ARCHIVE_DIR)) {
      fs.rmSync(TEST_ARCHIVE_DIR, { recursive: true });
    }
  });

  describe('enforce', () => {
    it('should delete expired logs', async () => {
      const policy = new RetentionPolicy({ retentionDays: 7 });

      // Create old and new log files
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      const oldFile = `audit-${oldDate.toISOString().split('T')[0]}.jsonl`;

      const recentFile = `audit-${new Date().toISOString().split('T')[0]}.jsonl`;

      fs.writeFileSync(path.join(TEST_LOG_DIR, oldFile), 'test\n');
      fs.writeFileSync(path.join(TEST_LOG_DIR, recentFile), 'test\n');

      const result = await policy.enforce(TEST_LOG_DIR);

      expect(result.deleted).toContain(oldFile);
      expect(result.kept).toContain(recentFile);
      expect(fs.existsSync(path.join(TEST_LOG_DIR, oldFile))).toBe(false);
      expect(fs.existsSync(path.join(TEST_LOG_DIR, recentFile))).toBe(true);
    });

    it('should archive instead of delete when archiveDir is set', async () => {
      const policy = new RetentionPolicy({
        retentionDays: 7,
        archiveDir: TEST_ARCHIVE_DIR,
      });

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      const oldFile = `audit-${oldDate.toISOString().split('T')[0]}.jsonl`;

      fs.writeFileSync(path.join(TEST_LOG_DIR, oldFile), 'archived content\n');

      const result = await policy.enforce(TEST_LOG_DIR);

      expect(result.archived).toContain(oldFile);
      expect(result.deleted).toEqual([]);
      expect(fs.existsSync(path.join(TEST_LOG_DIR, oldFile))).toBe(false);
      expect(fs.existsSync(path.join(TEST_ARCHIVE_DIR, oldFile))).toBe(true);

      // Verify content was preserved
      const content = fs.readFileSync(path.join(TEST_ARCHIVE_DIR, oldFile), 'utf8');
      expect(content).toBe('archived content\n');
    });

    it('should support dry run mode', async () => {
      const policy = new RetentionPolicy({
        retentionDays: 7,
        dryRun: true,
      });

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      const oldFile = `audit-${oldDate.toISOString().split('T')[0]}.jsonl`;

      fs.writeFileSync(path.join(TEST_LOG_DIR, oldFile), 'test\n');

      const result = await policy.enforce(TEST_LOG_DIR);

      expect(result.deleted).toContain(oldFile);
      // File should still exist in dry run
      expect(fs.existsSync(path.join(TEST_LOG_DIR, oldFile))).toBe(true);
    });

    it('should handle multiple expired files', async () => {
      const policy = new RetentionPolicy({ retentionDays: 3 });

      const dates = [-5, -4, -2, -1, 0];
      const files = dates.map((offset) => {
        const date = new Date();
        date.setDate(date.getDate() + offset);
        return `audit-${date.toISOString().split('T')[0]}.jsonl`;
      });

      files.forEach((file) => {
        fs.writeFileSync(path.join(TEST_LOG_DIR, file), 'test\n');
      });

      const result = await policy.enforce(TEST_LOG_DIR);

      expect(result.deleted.length).toBe(2); // -5 and -4 days
      expect(result.kept.length).toBe(3); // -2, -1, 0 days
    });

    it('should skip non-audit files', async () => {
      const policy = new RetentionPolicy({ retentionDays: 7 });

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);

      fs.writeFileSync(path.join(TEST_LOG_DIR, 'other-file.txt'), 'test\n');
      fs.writeFileSync(
        path.join(TEST_LOG_DIR, `audit-${oldDate.toISOString().split('T')[0]}.jsonl`),
        'test\n',
      );

      const result = await policy.enforce(TEST_LOG_DIR);

      // Non-JSONL files are ignored by retention policy (not included in any array)
      expect(result.kept).not.toContain('other-file.txt');
      expect(result.deleted).not.toContain('other-file.txt');
      expect(result.archived).not.toContain('other-file.txt');
      // But the file should still exist
      expect(fs.existsSync(path.join(TEST_LOG_DIR, 'other-file.txt'))).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      const policy = new RetentionPolicy({ retentionDays: 7 });

      // Create a file with invalid date format
      fs.writeFileSync(path.join(TEST_LOG_DIR, 'audit-invalid-date.jsonl'), 'test\n');

      const result = await policy.enforce(TEST_LOG_DIR);

      expect(result.errors.length).toBe(0); // Invalid filename just gets kept
      expect(result.kept).toContain('audit-invalid-date.jsonl');
    });
  });

  describe('calculateSize', () => {
    it('should calculate total size of log files', async () => {
      const policy = new RetentionPolicy({ retentionDays: 7 });

      const file1 = path.join(TEST_LOG_DIR, 'audit-2026-02-01.jsonl');
      const file2 = path.join(TEST_LOG_DIR, 'audit-2026-02-02.jsonl');

      fs.writeFileSync(file1, 'a'.repeat(1000));
      fs.writeFileSync(file2, 'b'.repeat(2000));

      const size = await policy.calculateSize(TEST_LOG_DIR);
      expect(size).toBe(3000);
    });

    it('should return 0 for non-existent directory', async () => {
      const policy = new RetentionPolicy({ retentionDays: 7 });
      const size = await policy.calculateSize('/tmp/nonexistent');
      expect(size).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should provide retention statistics', async () => {
      const policy = new RetentionPolicy({ retentionDays: 5 });

      const dates = [-7, -3, 0];
      dates.forEach((offset) => {
        const date = new Date();
        date.setDate(date.getDate() + offset);
        const file = `audit-${date.toISOString().split('T')[0]}.jsonl`;
        fs.writeFileSync(path.join(TEST_LOG_DIR, file), 'x'.repeat(100));
      });

      const stats = await policy.getStats(TEST_LOG_DIR);

      expect(stats.totalFiles).toBe(3);
      expect(stats.totalSizeBytes).toBe(300);
      expect(stats.expiredFiles).toBe(1); // -7 days is expired
      expect(stats.oldestLog).toBeTruthy();
      expect(stats.newestLog).toBeTruthy();
    });

    it('should handle empty directory', async () => {
      const policy = new RetentionPolicy({ retentionDays: 7 });
      const stats = await policy.getStats(TEST_LOG_DIR);

      expect(stats.totalFiles).toBe(0);
      expect(stats.totalSizeBytes).toBe(0);
      expect(stats.oldestLog).toBeNull();
      expect(stats.newestLog).toBeNull();
      expect(stats.expiredFiles).toBe(0);
    });
  });
});
