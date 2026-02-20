/**
 * Auth Database Schema and Initialization
 * Uses Node.js built-in DatabaseSync (node:sqlite)
 */

import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { requireNodeSqlite } from "../memory/sqlite.js";

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  org_id: string;
  roles: string; // JSON array
  workspace_roles: string; // JSON object
  created_at: number;
  last_login_at: number;
  mfa_enabled: number; // 0 or 1
}

export interface SessionRow {
  session_id: string;
  user_id: string;
  org_id: string;
  created_at: number;
  expires_at: number;
  ip_address: string;
  user_agent: string;
}

export interface ApiKeyRow {
  id: string;
  name: string;
  key_hash: string;
  user_id: string;
  org_id: string;
  workspace_scopes: string; // JSON array
  permissions: string; // JSON array
  created_at: number;
  expires_at: number | null;
  last_used_at: number | null;
}

export interface RefreshTokenRow {
  token_id: string;
  user_id: string;
  token_hash: string;
  created_at: number;
  expires_at: number;
  revoked: number; // 0 or 1
}

/**
 * Initialize auth database schema
 */
export function initializeAuthDatabase(db: DatabaseSync): void {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      org_id TEXT NOT NULL,
      roles TEXT NOT NULL DEFAULT '["org:member"]',
      workspace_roles TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      last_login_at INTEGER NOT NULL,
      mfa_enabled INTEGER NOT NULL DEFAULT 0
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(org_id);
  `);

  // Sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      org_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      ip_address TEXT NOT NULL,
      user_agent TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  `);

  // API Keys table
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      user_id TEXT NOT NULL,
      org_id TEXT NOT NULL,
      workspace_scopes TEXT NOT NULL DEFAULT '[]',
      permissions TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      expires_at INTEGER,
      last_used_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_org_id ON api_keys(org_id);
  `);

  // Refresh Tokens table
  db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
  `);
}

/**
 * Get or create auth database
 */
export function getAuthDatabase(dbPath: string): DatabaseSync {
  const { DatabaseSync } = requireNodeSqlite();
  const db = new DatabaseSync(dbPath);
  initializeAuthDatabase(db);
  return db;
}

/**
 * Clean up expired sessions and tokens
 */
export function cleanupExpiredAuth(db: DatabaseSync): void {
  const now = Date.now();

  // Remove expired sessions
  const deleteSessionsStmt = db.prepare(
    "DELETE FROM sessions WHERE expires_at < ?"
  );
  deleteSessionsStmt.run(now);

  // Remove expired refresh tokens
  const deleteTokensStmt = db.prepare(
    "DELETE FROM refresh_tokens WHERE expires_at < ?"
  );
  deleteTokensStmt.run(now);
}
