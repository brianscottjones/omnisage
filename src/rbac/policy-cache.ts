/**
 * Policy Cache
 *
 * In-memory cache for permission evaluation results to improve performance.
 * Uses TTL-based expiration and size limits.
 */

import type { AccessDecision } from './index.js';

interface CacheEntry {
  value: AccessDecision;
  expiresAt: number;
}

export class PolicyCache {
  private cache: Map<string, CacheEntry> = new Map();
  private ttlMs: number;
  private maxSize: number;
  private hits: number = 0;
  private misses: number = 0;

  constructor(ttlMs: number = 60000, maxSize: number = 10000) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
  }

  /**
   * Get a cached decision
   */
  get(key: string): AccessDecision | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.value;
  }

  /**
   * Set a cached decision
   */
  set(key: string, value: AccessDecision): void {
    // Evict oldest entries if at max size
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Clear expired entries
   */
  clearExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Evict oldest entries (by expiration time)
   */
  private evictOldest(): void {
    const entriesToEvict = Math.ceil(this.maxSize * 0.1); // Evict 10%
    const sorted = Array.from(this.cache.entries())
      .sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    
    for (let i = 0; i < entriesToEvict && i < sorted.length; i++) {
      this.cache.delete(sorted[i][0]);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  invalidate(pattern: RegExp): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Invalidate all cache entries for a specific user
   */
  invalidateUser(userId: string): number {
    return this.invalidate(new RegExp(`^${userId}-`));
  }

  /**
   * Invalidate all cache entries for a specific resource
   */
  invalidateResource(resource: string): number {
    return this.invalidate(new RegExp(`-${resource}-`));
  }
}

/**
 * Global cache instance (singleton pattern for shared cache across requests)
 */
let globalCache: PolicyCache | null = null;

export function getGlobalPolicyCache(): PolicyCache {
  if (!globalCache) {
    globalCache = new PolicyCache();
  }
  return globalCache;
}

export function resetGlobalPolicyCache(): void {
  globalCache = null;
}
