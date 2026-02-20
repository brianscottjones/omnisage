/**
 * OmniSage Authentication Module
 *
 * Handles user authentication via:
 * - Local accounts (bcrypt + TOTP 2FA)
 * - OIDC providers (Google, Microsoft, Okta)
 * - API keys (scoped per workspace)
 *
 * Phase 1 implementation: ✅ Complete
 * - Local auth with bcrypt password hashing
 * - JWT session tokens (15 min access + 7 day refresh)
 * - API key generation and validation
 * - Session management (create, validate, revoke)
 *
 * Phase 5: SAML 2.0 for enterprise SSO
 */

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  orgId: string;
  roles: OrgRole[];
  workspaceRoles: Map<string, WorkspaceRole>;
  createdAt: Date;
  lastLoginAt: Date;
  mfaEnabled: boolean;
}

export type OrgRole = 'org:owner' | 'org:admin' | 'org:member';
export type WorkspaceRole = 'ws:admin' | 'ws:member' | 'ws:viewer';

export interface AuthSession {
  sessionId: string;
  userId: string;
  orgId: string;
  createdAt: Date;
  expiresAt: Date;
  ipAddress: string;
  userAgent: string;
}

export interface ApiKey {
  id: string;
  name: string;
  keyHash: string; // SHA-256 hash of the key
  userId: string;
  orgId: string;
  workspaceScopes: string[]; // workspace IDs this key can access
  permissions: string[];
  createdAt: Date;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
}

// Re-export all auth functions
export {
  // Database
  getAuthDatabase,
  initializeAuthDatabase,
  cleanupExpiredAuth,
} from "./database.js";

export {
  // Accounts
  createAccount,
  authenticateUser,
  getUserById,
  updatePassword,
  updateUserRoles,
  updateWorkspaceRoles,
  deleteAccount,
  type CreateAccountParams,
} from "./accounts.js";

export {
  // Sessions
  createSession,
  refreshAccessToken,
  revokeSession,
  revokeAllSessions,
  getUserSessions,
  validateSession,
} from "./sessions.js";

export {
  // API Keys
  generateApiKeyString,
  hashApiKey,
  createApiKey,
  validateApiKey,
  revokeApiKey,
  listApiKeys,
} from "./api-keys.js";

export {
  // Password utilities
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
} from "./password.js";

export {
  // Token utilities
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getAccessTokenExpiry,
  getRefreshTokenExpiry,
  type AccessTokenPayload,
  type RefreshTokenPayload,
} from "./tokens.js";
