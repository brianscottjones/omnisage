/**
 * Audit Log Query Engine
 *
 * Provides filtering and search capabilities over JSONL audit logs.
 * Supports filtering by org, workspace, user, action, time range, etc.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import type { AuditEvent, AuditQuery } from './index.js';

export class QueryEngine {
  private logDir: string;

  constructor(logDir: string) {
    this.logDir = logDir;
  }

  /**
   * Query audit events with filters
   */
  async query(query: AuditQuery): Promise<AuditEvent[]> {
    const files = await this.getLogFiles(query.startTime, query.endTime);
    const events: AuditEvent[] = [];
    const limit = query.limit || 1000;
    const offset = query.offset || 0;

    let skipped = 0;
    let collected = 0;

    for (const file of files) {
      const fileEvents = await this.readLogFile(file);

      for (const event of fileEvents) {
        if (this.matchesQuery(event, query)) {
          if (skipped < offset) {
            skipped++;
            continue;
          }

          events.push(event);
          collected++;

          if (collected >= limit) {
            return events;
          }
        }
      }
    }

    return events;
  }

  /**
   * Count events matching query
   */
  async count(query: AuditQuery): Promise<number> {
    const files = await this.getLogFiles(query.startTime, query.endTime);
    let count = 0;

    for (const file of files) {
      const fileEvents = await this.readLogFile(file);

      for (const event of fileEvents) {
        if (this.matchesQuery(event, query)) {
          count++;
        }
      }
    }

    return count;
  }

  /**
   * Get unique values for a field (e.g., all user IDs who performed an action)
   */
  async distinct(query: AuditQuery, field: keyof AuditEvent): Promise<unknown[]> {
    const files = await this.getLogFiles(query.startTime, query.endTime);
    const values = new Set<unknown>();

    for (const file of files) {
      const fileEvents = await this.readLogFile(file);

      for (const event of fileEvents) {
        if (this.matchesQuery(event, query)) {
          values.add(event[field]);
        }
      }
    }

    return Array.from(values);
  }

  /**
   * Read a single log file and parse JSONL
   */
  private async readLogFile(filePath: string): Promise<AuditEvent[]> {
    const events: AuditEvent[] = [];

    if (!fs.existsSync(filePath)) {
      return events;
    }

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Number.POSITIVE_INFINITY,
    });

    for await (const line of rl) {
      if (line.trim()) {
        try {
          const event = JSON.parse(line);
          // Parse date strings back to Date objects
          event.timestamp = new Date(event.timestamp);
          if (event.approval?.approvedAt) {
            event.approval.approvedAt = new Date(event.approval.approvedAt);
          }
          if (event.approval?.deniedAt) {
            event.approval.deniedAt = new Date(event.approval.deniedAt);
          }
          events.push(event);
        } catch (err) {
          // Skip malformed lines
          console.warn('Skipping malformed audit log line:', err);
        }
      }
    }

    return events;
  }

  /**
   * Get log files within time range
   */
  private async getLogFiles(startTime?: Date, endTime?: Date): Promise<string[]> {
    if (!fs.existsSync(this.logDir)) {
      return [];
    }

    const allFiles = fs.readdirSync(this.logDir).filter((f) => f.endsWith('.jsonl'));

    if (!startTime && !endTime) {
      return allFiles.map((f) => path.join(this.logDir, f)).sort();
    }

    // Filter by date in filename (audit-YYYY-MM-DD.jsonl)
    // Note: File date is just a hint - we still check event timestamps
    const filteredFiles = allFiles.filter((filename) => {
      const match = filename.match(/audit-(\d{4}-\d{2}-\d{2})\.jsonl/);
      if (!match) return false;

      const fileDate = new Date(match[1] + 'T00:00:00Z');

      // Include file if it could contain events in range
      // (file date within 1 day of range to be safe)
      if (startTime) {
        const dayBefore = new Date(startTime);
        dayBefore.setDate(dayBefore.getDate() - 1);
        if (fileDate < dayBefore) return false;
      }
      if (endTime) {
        const dayAfter = new Date(endTime);
        dayAfter.setDate(dayAfter.getDate() + 1);
        if (fileDate > dayAfter) return false;
      }

      return true;
    });

    return filteredFiles.map((f) => path.join(this.logDir, f)).sort();
  }

  /**
   * Check if event matches query filters
   */
  private matchesQuery(event: AuditEvent, query: AuditQuery): boolean {
    if (query.orgId && event.orgId !== query.orgId) {
      return false;
    }

    if (query.workspaceId && event.workspaceId !== query.workspaceId) {
      return false;
    }

    if (query.userId && event.userId !== query.userId) {
      return false;
    }

    if (query.agentId && event.agentId !== query.agentId) {
      return false;
    }

    if (query.action && event.action !== query.action) {
      return false;
    }

    if (query.result && event.result !== query.result) {
      return false;
    }

    if (query.startTime && event.timestamp < query.startTime) {
      return false;
    }

    if (query.endTime && event.timestamp > query.endTime) {
      return false;
    }

    return true;
  }
}
