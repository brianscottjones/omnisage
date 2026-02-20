import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AuditLogger } from '../audit-logger.js';
import type { AuditEvent } from '../index.js';

const TEST_LOG_DIR = '/tmp/omnisage-audit-test';

describe('AuditLogger', () => {
  let logger: AuditLogger;

  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_LOG_DIR)) {
      fs.rmSync(TEST_LOG_DIR, { recursive: true });
    }

    logger = new AuditLogger({
      logDir: TEST_LOG_DIR,
      flushIntervalMs: 100, // Fast flush for testing
      maxBufferSize: 5,
      enablePIIRedaction: false, // Disable for easier testing
    });
  });

  afterEach(async () => {
    await logger.close();
    if (fs.existsSync(TEST_LOG_DIR)) {
      fs.rmSync(TEST_LOG_DIR, { recursive: true });
    }
  });

  it('should create log directory', () => {
    expect(fs.existsSync(TEST_LOG_DIR)).toBe(true);
  });

  it('should buffer events', async () => {
    await logger.log({
      orgId: 'org1',
      workspaceId: 'ws1',
      userId: 'user1',
      agentId: 'agent1',
      sessionId: 'session1',
      action: 'tool_call',
      tool: 'web_search',
      result: 'success',
      metadata: {},
    });

    expect(logger.getBufferSize()).toBe(1);
  });

  it('should flush when buffer is full', async () => {
    for (let i = 0; i < 5; i++) {
      await logger.log({
        orgId: 'org1',
        workspaceId: 'ws1',
        userId: 'user1',
        agentId: 'agent1',
        sessionId: 'session1',
        action: 'tool_call',
        result: 'success',
        metadata: {},
      });
    }

    // Wait for async flush
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(logger.getBufferSize()).toBe(0);

    // Check file was created
    const files = fs.readdirSync(TEST_LOG_DIR);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/^audit-\d{4}-\d{2}-\d{2}\.jsonl$/);
  });

  it('should write valid JSONL format', async () => {
    await logger.log({
      orgId: 'org1',
      workspaceId: 'ws1',
      userId: 'user1',
      agentId: 'agent1',
      sessionId: 'session1',
      action: 'memory_write',
      result: 'success',
      metadata: { tokensUsed: 100 },
    });

    await logger.flush();

    const files = fs.readdirSync(TEST_LOG_DIR);
    const logFile = path.join(TEST_LOG_DIR, files[0]);
    const content = fs.readFileSync(logFile, 'utf8');

    const lines = content.trim().split('\n');
    expect(lines.length).toBe(1);

    const event = JSON.parse(lines[0]);
    expect(event).toHaveProperty('id');
    expect(event).toHaveProperty('timestamp');
    expect(event.orgId).toBe('org1');
    expect(event.action).toBe('memory_write');
  });

  it('should redact PII when enabled', async () => {
    const loggerWithPII = new AuditLogger({
      logDir: TEST_LOG_DIR,
      flushIntervalMs: 100,
      maxBufferSize: 1,
      enablePIIRedaction: true,
    });

    await loggerWithPII.log({
      orgId: 'org1',
      workspaceId: 'ws1',
      userId: 'user1',
      agentId: 'agent1',
      sessionId: 'session1',
      action: 'tool_call',
      tool: 'email_send',
      parameters: {
        to: 'test@example.com',
        subject: 'Hello',
      },
      result: 'success',
      metadata: {},
    });

    await loggerWithPII.flush();
    await loggerWithPII.close();

    const files = fs.readdirSync(TEST_LOG_DIR);
    const logFile = path.join(TEST_LOG_DIR, files[0]);
    const content = fs.readFileSync(logFile, 'utf8');
    const event = JSON.parse(content.trim());

    expect(event.parameters.to).toBe('[EMAIL_REDACTED]');
    expect(event.parameters.subject).toBe('Hello');
  });

  it('should handle multiple events', async () => {
    const events = [
      { action: 'tool_call' as const, tool: 'web_search' },
      { action: 'memory_read' as const },
      { action: 'message_sent' as const },
    ];

    for (const evt of events) {
      await logger.log({
        orgId: 'org1',
        workspaceId: 'ws1',
        userId: 'user1',
        agentId: 'agent1',
        sessionId: 'session1',
        ...evt,
        result: 'success',
        metadata: {},
      });
    }

    await logger.flush();

    const files = fs.readdirSync(TEST_LOG_DIR);
    const logFile = path.join(TEST_LOG_DIR, files[0]);
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.trim().split('\n');

    expect(lines.length).toBe(3);
  });

  it('should rotate logs by date', async () => {
    // This is hard to test without mocking Date, but we can verify the filename format
    await logger.log({
      orgId: 'org1',
      workspaceId: 'ws1',
      userId: 'user1',
      agentId: 'agent1',
      sessionId: 'session1',
      action: 'tool_call',
      result: 'success',
      metadata: {},
    });

    await logger.flush();

    const files = fs.readdirSync(TEST_LOG_DIR);
    const today = new Date().toISOString().split('T')[0];
    expect(files[0]).toBe(`audit-${today}.jsonl`);
  });

  it('should handle graceful shutdown', async () => {
    await logger.log({
      orgId: 'org1',
      workspaceId: 'ws1',
      userId: 'user1',
      agentId: 'agent1',
      sessionId: 'session1',
      action: 'tool_call',
      result: 'success',
      metadata: {},
    });

    await logger.close();

    // Buffer should be flushed
    expect(logger.getBufferSize()).toBe(0);

    // File should exist
    const files = fs.readdirSync(TEST_LOG_DIR);
    expect(files.length).toBeGreaterThan(0);
  });
});
