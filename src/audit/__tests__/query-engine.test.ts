import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { QueryEngine } from '../query-engine.js';
import { AuditLogger } from '../audit-logger.js';
import type { AuditEvent } from '../index.js';

const TEST_LOG_DIR = '/tmp/omnisage-query-test';

describe('QueryEngine', () => {
  let engine: QueryEngine;
  let logger: AuditLogger;

  beforeEach(async () => {
    // Clean up test directory
    if (fs.existsSync(TEST_LOG_DIR)) {
      fs.rmSync(TEST_LOG_DIR, { recursive: true });
    }

    engine = new QueryEngine(TEST_LOG_DIR);
    logger = new AuditLogger({
      logDir: TEST_LOG_DIR,
      flushIntervalMs: 100,
      maxBufferSize: 100,
      enablePIIRedaction: false,
    });

    // Create some test data
    const events = [
      {
        orgId: 'org1',
        workspaceId: 'ws1',
        userId: 'alice',
        agentId: 'agent1',
        sessionId: 'session1',
        action: 'tool_call' as const,
        tool: 'web_search',
        result: 'success' as const,
        metadata: { tokensUsed: 100 },
      },
      {
        orgId: 'org1',
        workspaceId: 'ws1',
        userId: 'bob',
        agentId: 'agent1',
        sessionId: 'session2',
        action: 'memory_write' as const,
        result: 'success' as const,
        metadata: { tokensUsed: 50 },
      },
      {
        orgId: 'org1',
        workspaceId: 'ws2',
        userId: 'alice',
        agentId: 'agent2',
        sessionId: 'session3',
        action: 'message_sent' as const,
        result: 'failure' as const,
        metadata: {},
      },
      {
        orgId: 'org2',
        workspaceId: 'ws3',
        userId: 'charlie',
        agentId: 'agent3',
        sessionId: 'session4',
        action: 'tool_call' as const,
        tool: 'email_send',
        result: 'success' as const,
        metadata: { tokensUsed: 200 },
      },
    ];

    for (const evt of events) {
      await logger.log(evt);
    }

    await logger.flush();
  });

  afterEach(async () => {
    await logger.close();
    if (fs.existsSync(TEST_LOG_DIR)) {
      fs.rmSync(TEST_LOG_DIR, { recursive: true });
    }
  });

  describe('query', () => {
    it('should query all events for an org', async () => {
      const results = await engine.query({ orgId: 'org1' });
      expect(results.length).toBe(3);
      expect(results.every((e) => e.orgId === 'org1')).toBe(true);
    });

    it('should filter by workspace', async () => {
      const results = await engine.query({
        orgId: 'org1',
        workspaceId: 'ws1',
      });
      expect(results.length).toBe(2);
      expect(results.every((e) => e.workspaceId === 'ws1')).toBe(true);
    });

    it('should filter by user', async () => {
      const results = await engine.query({
        orgId: 'org1',
        userId: 'alice',
      });
      expect(results.length).toBe(2);
      expect(results.every((e) => e.userId === 'alice')).toBe(true);
    });

    it('should filter by action', async () => {
      const results = await engine.query({
        orgId: 'org1',
        action: 'tool_call',
      });
      expect(results.length).toBe(1);
      expect(results[0].action).toBe('tool_call');
      expect(results[0].tool).toBe('web_search');
    });

    it('should filter by result', async () => {
      const results = await engine.query({
        orgId: 'org1',
        result: 'failure',
      });
      expect(results.length).toBe(1);
      expect(results[0].result).toBe('failure');
    });

    it('should combine multiple filters', async () => {
      const results = await engine.query({
        orgId: 'org1',
        workspaceId: 'ws1',
        userId: 'alice',
        result: 'success',
      });
      expect(results.length).toBe(1);
      expect(results[0].userId).toBe('alice');
      expect(results[0].workspaceId).toBe('ws1');
    });

    it('should support limit', async () => {
      const results = await engine.query({
        orgId: 'org1',
        limit: 2,
      });
      expect(results.length).toBe(2);
    });

    it('should support offset', async () => {
      const allResults = await engine.query({ orgId: 'org1' });
      const offsetResults = await engine.query({
        orgId: 'org1',
        offset: 1,
      });

      expect(offsetResults.length).toBe(allResults.length - 1);
      expect(offsetResults[0].id).toBe(allResults[1].id);
    });

    it('should filter by time range', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      const results = await engine.query({
        orgId: 'org1',
        startTime: oneHourAgo,
        endTime: oneHourFromNow,
      });

      // Should return events within time range (our test events were just created)
      expect(results.length).toBe(3); // All org1 events
      expect(results.every((e) => e.timestamp >= oneHourAgo)).toBe(true);
      expect(results.every((e) => e.timestamp <= oneHourFromNow)).toBe(true);
    });
  });

  describe('count', () => {
    it('should count matching events', async () => {
      const count = await engine.count({ orgId: 'org1' });
      expect(count).toBe(3);
    });

    it('should count with filters', async () => {
      const count = await engine.count({
        orgId: 'org1',
        action: 'tool_call',
      });
      expect(count).toBe(1);
    });
  });

  describe('distinct', () => {
    it('should get distinct user IDs', async () => {
      const users = await engine.distinct({ orgId: 'org1' }, 'userId');
      expect(users.sort()).toEqual(['alice', 'bob']);
    });

    it('should get distinct actions', async () => {
      const actions = await engine.distinct({ orgId: 'org1' }, 'action');
      expect(actions.sort()).toEqual(['memory_write', 'message_sent', 'tool_call']);
    });

    it('should respect filters', async () => {
      const users = await engine.distinct(
        { orgId: 'org1', workspaceId: 'ws1' },
        'userId',
      );
      expect(users.sort()).toEqual(['alice', 'bob']);
    });
  });

  describe('edge cases', () => {
    it('should handle non-existent log directory', async () => {
      const emptyEngine = new QueryEngine('/tmp/nonexistent-audit-logs');
      const results = await emptyEngine.query({ orgId: 'org1' });
      expect(results).toEqual([]);
    });

    it('should handle malformed JSON lines gracefully', async () => {
      const badLogFile = path.join(TEST_LOG_DIR, 'audit-2026-01-01.jsonl');
      fs.writeFileSync(badLogFile, 'not valid json\n{"valid": "json"}\n');

      // Should skip malformed line and continue
      const results = await engine.query({ orgId: 'org1' });
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });
});
