/**
 * Session management - create, validate, and revoke sessions
 */

import { randomBytes, createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { SessionRow, RefreshTokenRow, UserRow } from "./database.js";
import type { AuthSession, AuthUser } from "./index.js";
import {
  generateAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
  verifyRefreshToken,
  type AccessTokenPayload,
} from "./tokens.js";

/**
 * Create a new session for a user
 */
export function createSession(
  db: DatabaseSync,
  params: {
    userId: string;
    orgId: string;
    ipAddress: string;
    userAgent: string;
  }
): {
  accessToken: string;
  refreshToken: string;
  session: AuthSession;
} {
  const sessionId = randomBytes(32).toString("hex");
  const now = Date.now();
  const expiresAt = now + 15 * 60 * 1000; // 15 minutes

  // Create session record
  const sessionStmt = db.prepare(`
    INSERT INTO sessions (session_id, user_id, org_id, created_at, expires_at, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  sessionStmt.run(
    sessionId,
    params.userId,
    params.orgId,
    now,
    expiresAt,
    params.ipAddress,
    params.userAgent
  );

  // Get user details for token payload
  const userStmt = db.prepare("SELECT * FROM users WHERE id = ?");
  const user = userStmt.get(params.userId) as UserRow;

  // Generate access token
  const accessTokenPayload: AccessTokenPayload = {
    userId: user.id,
    email: user.email,
    orgId: user.org_id,
    roles: JSON.parse(user.roles),
    workspaceRoles: JSON.parse(user.workspace_roles),
  };

  const accessToken = generateAccessToken(accessTokenPayload);

  // Generate refresh token
  const { token: refreshToken, tokenId } = generateRefreshToken(params.userId);
  const refreshExpiresAt = getRefreshTokenExpiry();
  const tokenHash = createHash("sha256").update(refreshToken).digest("hex");

  // Store refresh token
  const refreshStmt = db.prepare(`
    INSERT INTO refresh_tokens (token_id, user_id, token_hash, created_at, expires_at, revoked)
    VALUES (?, ?, ?, ?, ?, 0)
  `);

  refreshStmt.run(tokenId, params.userId, tokenHash, now, refreshExpiresAt);

  // Update last login
  const updateLoginStmt = db.prepare(
    "UPDATE users SET last_login_at = ? WHERE id = ?"
  );
  updateLoginStmt.run(now, params.userId);

  const session: AuthSession = {
    sessionId,
    userId: params.userId,
    orgId: params.orgId,
    createdAt: new Date(now),
    expiresAt: new Date(expiresAt),
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  };

  return {
    accessToken,
    refreshToken,
    session,
  };
}

/**
 * Refresh an access token using a refresh token
 */
export function refreshAccessToken(
  db: DatabaseSync,
  refreshToken: string
): { accessToken: string; refreshToken: string } | null {
  const payload = verifyRefreshToken(refreshToken);

  if (!payload) {
    return null;
  }

  const tokenHash = createHash("sha256").update(refreshToken).digest("hex");

  // Check if refresh token exists and is not revoked
  const stmt = db.prepare(`
    SELECT * FROM refresh_tokens
    WHERE token_id = ? AND user_id = ? AND token_hash = ? AND revoked = 0 AND expires_at > ?
  `);

  const tokenRow = stmt.get(
    payload.tokenId,
    payload.userId,
    tokenHash,
    Date.now()
  ) as RefreshTokenRow | undefined;

  if (!tokenRow) {
    return null;
  }

  // Get user details
  const userStmt = db.prepare("SELECT * FROM users WHERE id = ?");
  const user = userStmt.get(payload.userId) as UserRow | undefined;

  if (!user) {
    return null;
  }

  // Generate new access token
  const accessTokenPayload: AccessTokenPayload = {
    userId: user.id,
    email: user.email,
    orgId: user.org_id,
    roles: JSON.parse(user.roles),
    workspaceRoles: JSON.parse(user.workspace_roles),
  };

  const newAccessToken = generateAccessToken(accessTokenPayload);

  // Generate new refresh token (rotate)
  const {
    token: newRefreshToken,
    tokenId: newTokenId,
  } = generateRefreshToken(payload.userId);
  const newTokenHash = createHash("sha256")
    .update(newRefreshToken)
    .digest("hex");
  const now = Date.now();
  const newExpiresAt = getRefreshTokenExpiry();

  // Revoke old refresh token
  const revokeStmt = db.prepare(
    "UPDATE refresh_tokens SET revoked = 1 WHERE token_id = ?"
  );
  revokeStmt.run(payload.tokenId);

  // Insert new refresh token
  const insertStmt = db.prepare(`
    INSERT INTO refresh_tokens (token_id, user_id, token_hash, created_at, expires_at, revoked)
    VALUES (?, ?, ?, ?, ?, 0)
  `);

  insertStmt.run(newTokenId, payload.userId, newTokenHash, now, newExpiresAt);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

/**
 * Revoke a session
 */
export function revokeSession(
  db: DatabaseSync,
  sessionId: string,
  userId: string
): boolean {
  const stmt = db.prepare(
    "DELETE FROM sessions WHERE session_id = ? AND user_id = ?"
  );

  const result = stmt.run(sessionId, userId);
  return result.changes > 0;
}

/**
 * Revoke all sessions for a user
 */
export function revokeAllSessions(db: DatabaseSync, userId: string): number {
  // Revoke all sessions
  const sessionStmt = db.prepare("DELETE FROM sessions WHERE user_id = ?");
  const sessionResult = sessionStmt.run(userId);

  // Revoke all refresh tokens
  const tokenStmt = db.prepare(
    "UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?"
  );
  tokenStmt.run(userId);

  return sessionResult.changes;
}

/**
 * Get active sessions for a user
 */
export function getUserSessions(
  db: DatabaseSync,
  userId: string
): AuthSession[] {
  const stmt = db.prepare(`
    SELECT * FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY created_at DESC
  `);

  const rows = stmt.all(userId, Date.now()) as SessionRow[];

  return rows.map((row) => ({
    sessionId: row.session_id,
    userId: row.user_id,
    orgId: row.org_id,
    createdAt: new Date(row.created_at),
    expiresAt: new Date(row.expires_at),
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
  }));
}

/**
 * Validate a session
 */
export function validateSession(
  db: DatabaseSync,
  sessionId: string
): AuthSession | null {
  const stmt = db.prepare(`
    SELECT * FROM sessions WHERE session_id = ? AND expires_at > ?
  `);

  const row = stmt.get(sessionId, Date.now()) as SessionRow | undefined;

  if (!row) {
    return null;
  }

  return {
    sessionId: row.session_id,
    userId: row.user_id,
    orgId: row.org_id,
    createdAt: new Date(row.created_at),
    expiresAt: new Date(row.expires_at),
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
  };
}
