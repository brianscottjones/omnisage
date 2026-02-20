/**
 * Audit Logger - JSONL File-Based with In-Memory Buffer
 *
 * Features:
 * - Append-only JSONL format for tamper-evidence
 * - In-memory buffer with periodic flush for performance
 * - Automatic file rotation by date
 * - Crash-safe (fsync on flush)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AuditEvent } from './index.js';
import { defaultRedactor, type PIIRedactor } from './pii-redactor.js';

export interface AuditLoggerConfig {
  logDir: string;
  flushIntervalMs?: number;
  maxBufferSize?: number;
  redactor?: PIIRedactor;
  enablePIIRedaction?: boolean;
}

export class AuditLogger {
  private config: Required<AuditLoggerConfig>;
  private buffer: AuditEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private currentLogFile: string | null = null;
  private writeStream: fs.WriteStream | null = null;
  private flushing = false;

  constructor(config: AuditLoggerConfig) {
    this.config = {
      flushIntervalMs: 5000, // 5 seconds default
      maxBufferSize: 100,
      redactor: defaultRedactor,
      enablePIIRedaction: true,
      ...config,
    };

    this.ensureLogDirectory();
    this.startFlushTimer();
  }

  /**
   * Log an audit event
   */
  async log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: AuditEvent = {
      id: randomUUID(),
      timestamp: new Date(),
      ...event,
    };

    // Redact PII if enabled
    if (this.config.enablePIIRedaction && fullEvent.parameters) {
      fullEvent.parameters = this.config.redactor.redactObject(
        fullEvent.parameters,
      ) as Record<string, unknown>;
    }

    this.buffer.push(fullEvent);

    // Flush if buffer is full
    if (this.buffer.length >= this.config.maxBufferSize) {
      await this.flush();
    }
  }

  /**
   * Force flush buffer to disk
   */
  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) {
      return;
    }

    this.flushing = true;

    try {
      const events = [...this.buffer];
      this.buffer = [];

      const logFile = this.getLogFilePath();
      const stream = this.getWriteStream(logFile);

      for (const event of events) {
        const line = JSON.stringify(event) + '\n';
        await this.writeToStream(stream, line);
      }

      // Ensure data is written to disk
      await this.syncStream(stream);
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Graceful shutdown - flush and close
   */
  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flush();

    if (this.writeStream) {
      await new Promise<void>((resolve, reject) => {
        this.writeStream!.end((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      this.writeStream = null;
    }
  }

  /**
   * Get current log file path (rotates daily)
   */
  private getLogFilePath(): string {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.config.logDir, `audit-${date}.jsonl`);
  }

  /**
   * Get or create write stream for log file
   */
  private getWriteStream(filePath: string): fs.WriteStream {
    if (this.currentLogFile !== filePath) {
      // Close previous stream if switching files
      if (this.writeStream) {
        this.writeStream.end();
      }

      this.currentLogFile = filePath;
      this.writeStream = fs.createWriteStream(filePath, {
        flags: 'a', // append mode
        encoding: 'utf8',
      });
    }

    return this.writeStream!;
  }

  /**
   * Write to stream (promisified)
   */
  private writeToStream(stream: fs.WriteStream, data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!stream.write(data)) {
        stream.once('drain', resolve);
      } else {
        resolve();
      }
      stream.once('error', reject);
    });
  }

  /**
   * Fsync stream to disk
   */
  private syncStream(stream: fs.WriteStream): Promise<void> {
    return new Promise((resolve, reject) => {
      stream.once('error', reject);
      if (stream.pending) {
        stream.once('ready', () => {
          fs.fsync(stream.fd, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      } else {
        fs.fsync(stream.fd, (err) => {
          if (err) reject(err);
          else resolve();
        });
      }
    });
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.config.logDir)) {
      fs.mkdirSync(this.config.logDir, { recursive: true });
    }
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => {
        console.error('Audit log flush failed:', err);
      });
    }, this.config.flushIntervalMs);

    // Don't keep process alive just for flush timer
    this.flushTimer.unref();
  }

  /**
   * Get current buffer size (for testing/monitoring)
   */
  getBufferSize(): number {
    return this.buffer.length;
  }
}
