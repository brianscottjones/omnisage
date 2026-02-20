/**
 * OmniSage Authentication Module
 *
 * Handles user authentication via:
 * - Local accounts (bcrypt + TOTP 2FA)
 * - OIDC providers (Google, Microsoft, Okta)
 * - API keys (scoped per workspace)
 *
 * Phase 1 implementation: Local accounts + API keys
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
  keyHash: string; // bcrypt hash of the key
  userId: string;
  orgId: string;
  workspaceScopes: string[]; // workspace IDs this key can access
  permissions: string[];
  createdAt: Date;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
}

// TODO: Phase 1 implementation
// - Local auth with bcrypt password hashing
// - JWT session tokens (15 min access + 7 day refresh)
// - API key generation and validation
// - Session management (create, validate, revoke)
// - Rate limiting on auth endpoints
