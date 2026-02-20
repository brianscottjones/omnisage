/**
 * Policy Cache Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PolicyCache, getGlobalPolicyCache, resetGlobalPolicyCache } from './policy-cache.js';
import type { AccessDecision } from './index.js';

describe('PolicyCache', () => {
  let cache: PolicyCache;

  beforeEach(() => {
    cache = new PolicyCache(1000, 100); // 1s TTL, 100 max size
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('get/set', () => {
    it('should store and retrieve decisions', () => {
      const decision: AccessDecision = {
        granted: true,
        approvalRequired: false,
        reason: 'Test',
      };

      cache.set('key1', decision);
      const retrieved = cache.get('key1');

      expect(retrieved).toEqual(decision);
    });

    it('should return null for missing keys', () => {
      const result = cache.get('nonexistent');
      expect(result).toBe(null);
    });

    it('should track cache hits and misses', () => {
      const decision: AccessDecision = {
        granted: true,
        approvalRequired: false,
        reason: 'Test',
      };

      cache.set('key1', decision);
      cache.get('key1'); // Hit
      cache.get('key2'); // Miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });
  });

  describe('expiration', () => {
    it('should expire entries after TTL', async () => {
      const decision: AccessDecision = {
        granted: true,
        approvalRequired: false,
        reason: 'Test',
      };

      cache.set('key1', decision);
      
      // Fast-forward time
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const result = cache.get('key1');
      expect(result).toBe(null);
    });

    it('should clear expired entries manually', () => {
      vi.useFakeTimers();
      
      const decision: AccessDecision = {
        granted: true,
        approvalRequired: false,
        reason: 'Test',
      };

      cache.set('key1', decision);
      
      // Fast-forward past TTL
      vi.advanceTimersByTime(2000);
      
      cache.clearExpired();
      
      const stats = cache.getStats();
      expect(stats.size).toBe(0);
      
      vi.useRealTimers();
    });
  });

  describe('size limits', () => {
    it('should evict oldest entries when full', () => {
      const smallCache = new PolicyCache(10000, 5);

      for (let i = 0; i < 10; i++) {
        smallCache.set(`key${i}`, {
          granted: true,
          approvalRequired: false,
          reason: `Test ${i}`,
        });
      }

      const stats = smallCache.getStats();
      expect(stats.size).toBeLessThanOrEqual(5);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      cache.set('key1', { granted: true, approvalRequired: false, reason: 'Test' });
      cache.set('key2', { granted: false, approvalRequired: false, reason: 'Test' });

      cache.clear();

      const stats = cache.getStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('invalidate', () => {
    it('should invalidate entries matching pattern', () => {
      cache.set('user1-resource1-read', {
        granted: true,
        approvalRequired: false,
        reason: 'Test',
      });
      cache.set('user1-resource2-read', {
        granted: true,
        approvalRequired: false,
        reason: 'Test',
      });
      cache.set('user2-resource1-read', {
        granted: true,
        approvalRequired: false,
        reason: 'Test',
      });

      const count = cache.invalidate(/^user1-/);
      expect(count).toBe(2);

      expect(cache.get('user1-resource1-read')).toBe(null);
      expect(cache.get('user1-resource2-read')).toBe(null);
      expect(cache.get('user2-resource1-read')).not.toBe(null);
    });

    it('should invalidate user-specific entries', () => {
      cache.set('user1-resource-read', {
        granted: true,
        approvalRequired: false,
        reason: 'Test',
      });
      cache.set('user2-resource-read', {
        granted: true,
        approvalRequired: false,
        reason: 'Test',
      });

      const count = cache.invalidateUser('user1');
      expect(count).toBe(1);
    });

    it('should invalidate resource-specific entries', () => {
      cache.set('user1-workspace-read', {
        granted: true,
        approvalRequired: false,
        reason: 'Test',
      });
      cache.set('user1-agent-read', {
        granted: true,
        approvalRequired: false,
        reason: 'Test',
      });

      const count = cache.invalidateResource('workspace');
      expect(count).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return accurate statistics', () => {
      cache.set('key1', { granted: true, approvalRequired: false, reason: 'Test' });
      cache.set('key2', { granted: false, approvalRequired: false, reason: 'Test' });
      
      cache.get('key1'); // Hit
      cache.get('key1'); // Hit
      cache.get('key3'); // Miss

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.667, 2);
    });
  });

  describe('global cache', () => {
    afterEach(() => {
      resetGlobalPolicyCache();
    });

    it('should return singleton instance', () => {
      const cache1 = getGlobalPolicyCache();
      const cache2 = getGlobalPolicyCache();

      expect(cache1).toBe(cache2);
    });

    it('should reset global instance', () => {
      const cache1 = getGlobalPolicyCache();
      resetGlobalPolicyCache();
      const cache2 = getGlobalPolicyCache();

      expect(cache1).not.toBe(cache2);
    });
  });
});
