/**
 * Local account creation and management
 */

import { randomBytes } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { UserRow } from "./database.js";
import type { AuthUser, OrgRole, WorkspaceRole } from "./index.js";
import { hashPassword, verifyPassword } from "./password.js";

export interface CreateAccountParams {
  email: string;
  password: string;
  displayName: string;
  orgId: string;
  roles?: OrgRole[];
  workspaceRoles?: Map<string, WorkspaceRole>;
}

/**
 * Create a new local account
 */
export async function createAccount(
  db: DatabaseSync,
  params: CreateAccountParams
): Promise<AuthUser> {
  // Check if email already exists
  const existingStmt = db.prepare("SELECT id FROM users WHERE email = ?");
  const existing = existingStmt.get(params.email);

  if (existing) {
    throw new Error("Email already exists");
  }

  // Hash password
  const passwordHash = await hashPassword(params.password);

  // Generate user ID
  const userId = randomBytes(16).toString("hex");
  const now = Date.now();

  // Create user
  const insertStmt = db.prepare(`
    INSERT INTO users (
      id, email, password_hash, display_name, org_id, roles, workspace_roles,
      created_at, last_login_at, mfa_enabled
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  const roles = params.roles || ["org:member"];
  const workspaceRoles = params.workspaceRoles || new Map();

  insertStmt.run(
    userId,
    params.email,
    passwordHash,
    params.displayName,
    params.orgId,
    JSON.stringify(roles),
    JSON.stringify(Object.fromEntries(workspaceRoles)),
    now,
    now
  );

  return {
    id: userId,
    email: params.email,
    displayName: params.displayName,
    orgId: params.orgId,
    roles,
    workspaceRoles,
    createdAt: new Date(now),
    lastLoginAt: new Date(now),
    mfaEnabled: false,
  };
}

/**
 * Authenticate a user with email and password
 */
export async function authenticateUser(
  db: DatabaseSync,
  email: string,
  password: string
): Promise<AuthUser | null> {
  const stmt = db.prepare("SELECT * FROM users WHERE email = ?");
  const row = stmt.get(email) as UserRow | undefined;

  if (!row) {
    return null;
  }

  // Verify password
  const valid = await verifyPassword(password, row.password_hash);

  if (!valid) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    orgId: row.org_id,
    roles: JSON.parse(row.roles),
    workspaceRoles: new Map(Object.entries(JSON.parse(row.workspace_roles))),
    createdAt: new Date(row.created_at),
    lastLoginAt: new Date(row.last_login_at),
    mfaEnabled: row.mfa_enabled === 1,
  };
}

/**
 * Get a user by ID
 */
export function getUserById(
  db: DatabaseSync,
  userId: string
): AuthUser | null {
  const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
  const row = stmt.get(userId) as UserRow | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    orgId: row.org_id,
    roles: JSON.parse(row.roles),
    workspaceRoles: new Map(Object.entries(JSON.parse(row.workspace_roles))),
    createdAt: new Date(row.created_at),
    lastLoginAt: new Date(row.last_login_at),
    mfaEnabled: row.mfa_enabled === 1,
  };
}

/**
 * Update user password
 */
export async function updatePassword(
  db: DatabaseSync,
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<boolean> {
  const stmt = db.prepare("SELECT password_hash FROM users WHERE id = ?");
  const row = stmt.get(userId) as { password_hash: string } | undefined;

  if (!row) {
    return false;
  }

  // Verify current password
  const valid = await verifyPassword(currentPassword, row.password_hash);

  if (!valid) {
    return false;
  }

  // Hash new password
  const newHash = await hashPassword(newPassword);

  // Update password
  const updateStmt = db.prepare(
    "UPDATE users SET password_hash = ? WHERE id = ?"
  );
  updateStmt.run(newHash, userId);

  return true;
}

/**
 * Update user roles
 */
export function updateUserRoles(
  db: DatabaseSync,
  userId: string,
  roles: OrgRole[]
): boolean {
  const stmt = db.prepare("UPDATE users SET roles = ? WHERE id = ?");
  const result = stmt.run(JSON.stringify(roles), userId);
  return result.changes > 0;
}

/**
 * Update workspace roles
 */
export function updateWorkspaceRoles(
  db: DatabaseSync,
  userId: string,
  workspaceRoles: Map<string, WorkspaceRole>
): boolean {
  const stmt = db.prepare(
    "UPDATE users SET workspace_roles = ? WHERE id = ?"
  );
  const result = stmt.run(
    JSON.stringify(Object.fromEntries(workspaceRoles)),
    userId
  );
  return result.changes > 0;
}

/**
 * Delete a user account
 */
export function deleteAccount(db: DatabaseSync, userId: string): boolean {
  // Foreign key constraints will cascade delete sessions and API keys
  const stmt = db.prepare("DELETE FROM users WHERE id = ?");
  const result = stmt.run(userId);
  return result.changes > 0;
}
