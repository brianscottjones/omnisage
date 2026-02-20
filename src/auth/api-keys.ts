/**
 * API key generation and validation
 */

import { randomBytes, createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { ApiKeyRow } from "./database.js";
import type { ApiKey } from "./index.js";

/**
 * Generate a new API key
 * Format: os_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX (32 random bytes as hex)
 */
export function generateApiKeyString(): string {
  const randomPart = randomBytes(32).toString("hex");
  return `os_${randomPart}`;
}

/**
 * Hash an API key for storage
 */
export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

/**
 * Create a new API key in the database
 */
export function createApiKey(
  db: DatabaseSync,
  params: {
    name: string;
    userId: string;
    orgId: string;
    workspaceScopes?: string[];
    permissions?: string[];
    expiresAt?: Date | null;
  }
): { apiKey: string; id: string } {
  const apiKeyString = generateApiKeyString();
  const keyHash = hashApiKey(apiKeyString);
  const id = randomBytes(16).toString("hex");
  const now = Date.now();

  const stmt = db.prepare(`
    INSERT INTO api_keys (
      id, name, key_hash, user_id, org_id, workspace_scopes, permissions,
      created_at, expires_at, last_used_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `);

  stmt.run(
    id,
    params.name,
    keyHash,
    params.userId,
    params.orgId,
    JSON.stringify(params.workspaceScopes || []),
    JSON.stringify(params.permissions || []),
    now,
    params.expiresAt ? params.expiresAt.getTime() : null
  );

  return { apiKey: apiKeyString, id };
}

/**
 * Validate an API key and return the associated key data
 */
export function validateApiKey(
  db: DatabaseSync,
  apiKeyString: string
): ApiKey | null {
  const keyHash = hashApiKey(apiKeyString);

  const stmt = db.prepare(`
    SELECT * FROM api_keys WHERE key_hash = ?
  `);

  const row = stmt.get(keyHash) as ApiKeyRow | undefined;

  if (!row) {
    return null;
  }

  // Check if expired
  if (row.expires_at && row.expires_at < Date.now()) {
    return null;
  }

  // Update last_used_at
  const now = Date.now();
  const updateStmt = db.prepare(`
    UPDATE api_keys SET last_used_at = ? WHERE id = ?
  `);
  updateStmt.run(now, row.id);

  return {
    id: row.id,
    name: row.name,
    keyHash: row.key_hash,
    userId: row.user_id,
    orgId: row.org_id,
    workspaceScopes: JSON.parse(row.workspace_scopes),
    permissions: JSON.parse(row.permissions),
    createdAt: new Date(row.created_at),
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    lastUsedAt: new Date(now), // Use the current time we just set
  };
}

/**
 * Revoke (delete) an API key
 */
export function revokeApiKey(
  db: DatabaseSync,
  keyId: string,
  userId: string
): boolean {
  const stmt = db.prepare(`
    DELETE FROM api_keys WHERE id = ? AND user_id = ?
  `);

  const result = stmt.run(keyId, userId);
  return result.changes > 0;
}

/**
 * List all API keys for a user
 */
export function listApiKeys(
  db: DatabaseSync,
  userId: string
): Omit<ApiKey, "keyHash">[] {
  const stmt = db.prepare(`
    SELECT * FROM api_keys WHERE user_id = ? ORDER BY created_at DESC
  `);

  const rows = stmt.all(userId) as ApiKeyRow[];

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    keyHash: row.key_hash,
    userId: row.user_id,
    orgId: row.org_id,
    workspaceScopes: JSON.parse(row.workspace_scopes),
    permissions: JSON.parse(row.permissions),
    createdAt: new Date(row.created_at),
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : null,
  }));
}
