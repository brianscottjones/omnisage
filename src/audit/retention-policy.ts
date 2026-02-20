/**
 * Audit Log Retention Policy
 *
 * Enforces retention policies on audit logs:
 * - Configurable retention period (days)
 * - Automatic cleanup of expired logs
 * - Archive support (optional - move instead of delete)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface RetentionConfig {
  retentionDays: number;
  archiveDir?: string; // If set, move instead of delete
  dryRun?: boolean; // For testing - don't actually delete
}

export class RetentionPolicy {
  private config: RetentionConfig;

  constructor(config: RetentionConfig) {
    this.config = config;
  }

  /**
   * Enforce retention policy - delete or archive old logs
   */
  async enforce(logDir: string): Promise<RetentionResult> {
    const result: RetentionResult = {
      deleted: [],
      archived: [],
      kept: [],
      errors: [],
    };

    if (!fs.existsSync(logDir)) {
      return result;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    const allFiles = fs.readdirSync(logDir);
    const files = allFiles.filter((f) => f.endsWith('.jsonl'));

    for (const filename of files) {
      try {
        const filePath = path.join(logDir, filename);
        const fileDate = this.extractDateFromFilename(filename);

        if (!fileDate) {
          result.kept.push(filename);
          continue;
        }

        if (fileDate < cutoffDate) {
          if (this.config.archiveDir) {
            await this.archiveFile(filePath, filename, result);
          } else {
            await this.deleteFile(filePath, filename, result);
          }
        } else {
          result.kept.push(filename);
        }
      } catch (err) {
        result.errors.push({
          filename,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return result;
  }

  /**
   * Extract date from filename (audit-YYYY-MM-DD.jsonl)
   */
  private extractDateFromFilename(filename: string): Date | null {
    const match = filename.match(/audit-(\d{4}-\d{2}-\d{2})\.jsonl/);
    if (!match) return null;
    return new Date(match[1]);
  }

  /**
   * Delete a log file
   */
  private async deleteFile(
    filePath: string,
    filename: string,
    result: RetentionResult,
  ): Promise<void> {
    if (!this.config.dryRun) {
      fs.unlinkSync(filePath);
    }
    result.deleted.push(filename);
  }

  /**
   * Archive a log file (move to archive directory)
   */
  private async archiveFile(
    filePath: string,
    filename: string,
    result: RetentionResult,
  ): Promise<void> {
    if (!this.config.archiveDir) return;

    if (!fs.existsSync(this.config.archiveDir)) {
      fs.mkdirSync(this.config.archiveDir, { recursive: true });
    }

    const archivePath = path.join(this.config.archiveDir, filename);

    if (!this.config.dryRun) {
      fs.renameSync(filePath, archivePath);
    }

    result.archived.push(filename);
  }

  /**
   * Calculate total size of audit logs
   */
  async calculateSize(logDir: string): Promise<number> {
    if (!fs.existsSync(logDir)) {
      return 0;
    }

    const files = fs.readdirSync(logDir).filter((f) => f.endsWith('.jsonl'));
    let totalSize = 0;

    for (const file of files) {
      const stats = fs.statSync(path.join(logDir, file));
      totalSize += stats.size;
    }

    return totalSize;
  }

  /**
   * Get retention statistics
   */
  async getStats(logDir: string): Promise<RetentionStats> {
    if (!fs.existsSync(logDir)) {
      return {
        totalFiles: 0,
        totalSizeBytes: 0,
        oldestLog: null,
        newestLog: null,
        expiredFiles: 0,
      };
    }

    const files = fs.readdirSync(logDir).filter((f) => f.endsWith('.jsonl'));
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    let totalSize = 0;
    let oldestLog: Date | null = null;
    let newestLog: Date | null = null;
    let expiredFiles = 0;

    for (const file of files) {
      const stats = fs.statSync(path.join(logDir, file));
      totalSize += stats.size;

      const fileDate = this.extractDateFromFilename(file);
      if (fileDate) {
        if (!oldestLog || fileDate < oldestLog) {
          oldestLog = fileDate;
        }
        if (!newestLog || fileDate > newestLog) {
          newestLog = fileDate;
        }
        if (fileDate < cutoffDate) {
          expiredFiles++;
        }
      }
    }

    return {
      totalFiles: files.length,
      totalSizeBytes: totalSize,
      oldestLog,
      newestLog,
      expiredFiles,
    };
  }
}

export interface RetentionResult {
  deleted: string[];
  archived: string[];
  kept: string[];
  errors: Array<{ filename: string; error: string }>;
}

export interface RetentionStats {
  totalFiles: number;
  totalSizeBytes: number;
  oldestLog: Date | null;
  newestLog: Date | null;
  expiredFiles: number;
}
