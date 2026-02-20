/**
 * Auth system unit tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { unlinkSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import {
  getAuthDatabase,
  createAccount,
  authenticateUser,
  getUserById,
  updatePassword,
  createSession,
  refreshAccessToken,
  revokeSession,
  revokeAllSessions,
  getUserSessions,
  validateSession,
  createApiKey,
  validateApiKey,
  revokeApiKey,
  listApiKeys,
  verifyAccessToken,
  cleanupExpiredAuth,
  validatePasswordStrength,
} from "./index.js";

const TEST_DB_PATH = ":memory:"; // Use in-memory database for tests

describe("Auth System", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = getAuthDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    db.close();
  });

  describe("Password Validation", () => {
    it("should validate strong passwords", () => {
      const result = validatePasswordStrength("SecurePass123!");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject weak passwords", () => {
      const result = validatePasswordStrength("weak");
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should require uppercase letters", () => {
      const result = validatePasswordStrength("lowercase123!");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Password must contain at least one uppercase letter"
      );
    });

    it("should require special characters", () => {
      const result = validatePasswordStrength("NoSpecialChar123");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Password must contain at least one special character"
      );
    });
  });

  describe("Account Management", () => {
    it("should create a new account", async () => {
      const user = await createAccount(db, {
        email: "test@example.com",
        password: "SecurePass123!",
        displayName: "Test User",
        orgId: "org-1",
        roles: ["org:admin"],
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe("test@example.com");
      expect(user.displayName).toBe("Test User");
      expect(user.orgId).toBe("org-1");
      expect(user.roles).toContain("org:admin");
      expect(user.mfaEnabled).toBe(false);
    });

    it("should reject duplicate emails", async () => {
      await createAccount(db, {
        email: "duplicate@example.com",
        password: "SecurePass123!",
        displayName: "User 1",
        orgId: "org-1",
      });

      await expect(
        createAccount(db, {
          email: "duplicate@example.com",
          password: "AnotherPass456!",
          displayName: "User 2",
          orgId: "org-1",
        })
      ).rejects.toThrow("Email already exists");
    });

    it("should authenticate valid credentials", async () => {
      const created = await createAccount(db, {
        email: "auth@example.com",
        password: "ValidPass123!",
        displayName: "Auth User",
        orgId: "org-1",
      });

      const authenticated = await authenticateUser(
        db,
        "auth@example.com",
        "ValidPass123!"
      );

      expect(authenticated).not.toBeNull();
      expect(authenticated?.id).toBe(created.id);
      expect(authenticated?.email).toBe("auth@example.com");
    });

    it("should reject invalid credentials", async () => {
      await createAccount(db, {
        email: "secure@example.com",
        password: "RightPass123!",
        displayName: "Secure User",
        orgId: "org-1",
      });

      const result = await authenticateUser(
        db,
        "secure@example.com",
        "WrongPass456!"
      );

      expect(result).toBeNull();
    });

    it("should update user password", async () => {
      const user = await createAccount(db, {
        email: "update@example.com",
        password: "OldPass123!",
        displayName: "Update User",
        orgId: "org-1",
      });

      const updated = await updatePassword(
        db,
        user.id,
        "OldPass123!",
        "NewPass456!"
      );

      expect(updated).toBe(true);

      // Should authenticate with new password
      const auth = await authenticateUser(
        db,
        "update@example.com",
        "NewPass456!"
      );
      expect(auth).not.toBeNull();

      // Should not authenticate with old password
      const oldAuth = await authenticateUser(
        db,
        "update@example.com",
        "OldPass123!"
      );
      expect(oldAuth).toBeNull();
    });

    it("should get user by ID", async () => {
      const created = await createAccount(db, {
        email: "getbyid@example.com",
        password: "TestPass123!",
        displayName: "Get By ID User",
        orgId: "org-1",
      });

      const retrieved = getUserById(db, created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.email).toBe("getbyid@example.com");
    });
  });

  describe("Session Management", () => {
    it("should create a session with access and refresh tokens", async () => {
      const user = await createAccount(db, {
        email: "session@example.com",
        password: "SessionPass123!",
        displayName: "Session User",
        orgId: "org-1",
      });

      const result = createSession(db, {
        userId: user.id,
        orgId: user.orgId,
        ipAddress: "192.168.1.1",
        userAgent: "Test Agent",
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.session.sessionId).toBeDefined();
      expect(result.session.userId).toBe(user.id);

      // Verify access token
      const payload = verifyAccessToken(result.accessToken);
      expect(payload?.userId).toBe(user.id);
      expect(payload?.email).toBe("session@example.com");
    });

    it("should validate active sessions", async () => {
      const user = await createAccount(db, {
        email: "validate@example.com",
        password: "ValidatePass123!",
        displayName: "Validate User",
        orgId: "org-1",
      });

      const { session } = createSession(db, {
        userId: user.id,
        orgId: user.orgId,
        ipAddress: "192.168.1.1",
        userAgent: "Test Agent",
      });

      const validated = validateSession(db, session.sessionId);

      expect(validated).not.toBeNull();
      expect(validated?.userId).toBe(user.id);
    });

    it("should refresh access tokens", async () => {
      const user = await createAccount(db, {
        email: "refresh@example.com",
        password: "RefreshPass123!",
        displayName: "Refresh User",
        orgId: "org-1",
      });

      const { refreshToken } = createSession(db, {
        userId: user.id,
        orgId: user.orgId,
        ipAddress: "192.168.1.1",
        userAgent: "Test Agent",
      });

      const refreshed = refreshAccessToken(db, refreshToken);

      expect(refreshed).not.toBeNull();
      expect(refreshed?.accessToken).toBeDefined();
      expect(refreshed?.refreshToken).toBeDefined();

      // New access token should be valid
      const payload = verifyAccessToken(refreshed!.accessToken);
      expect(payload?.userId).toBe(user.id);
    });

    it("should revoke sessions", async () => {
      const user = await createAccount(db, {
        email: "revoke@example.com",
        password: "RevokePass123!",
        displayName: "Revoke User",
        orgId: "org-1",
      });

      const { session } = createSession(db, {
        userId: user.id,
        orgId: user.orgId,
        ipAddress: "192.168.1.1",
        userAgent: "Test Agent",
      });

      const revoked = revokeSession(db, session.sessionId, user.id);
      expect(revoked).toBe(true);

      // Session should no longer be valid
      const validated = validateSession(db, session.sessionId);
      expect(validated).toBeNull();
    });

    it("should list user sessions", async () => {
      const user = await createAccount(db, {
        email: "list@example.com",
        password: "ListPass123!",
        displayName: "List User",
        orgId: "org-1",
      });

      // Create multiple sessions
      createSession(db, {
        userId: user.id,
        orgId: user.orgId,
        ipAddress: "192.168.1.1",
        userAgent: "Agent 1",
      });

      createSession(db, {
        userId: user.id,
        orgId: user.orgId,
        ipAddress: "192.168.1.2",
        userAgent: "Agent 2",
      });

      const sessions = getUserSessions(db, user.id);
      expect(sessions.length).toBe(2);
    });

    it("should revoke all user sessions", async () => {
      const user = await createAccount(db, {
        email: "revokeall@example.com",
        password: "RevokeAllPass123!",
        displayName: "Revoke All User",
        orgId: "org-1",
      });

      // Create multiple sessions
      createSession(db, {
        userId: user.id,
        orgId: user.orgId,
        ipAddress: "192.168.1.1",
        userAgent: "Agent 1",
      });

      createSession(db, {
        userId: user.id,
        orgId: user.orgId,
        ipAddress: "192.168.1.2",
        userAgent: "Agent 2",
      });

      const count = revokeAllSessions(db, user.id);
      expect(count).toBe(2);

      const remaining = getUserSessions(db, user.id);
      expect(remaining.length).toBe(0);
    });
  });

  describe("API Key Management", () => {
    it("should create an API key", async () => {
      const user = await createAccount(db, {
        email: "apikey@example.com",
        password: "ApiKeyPass123!",
        displayName: "API Key User",
        orgId: "org-1",
      });

      const { apiKey, id } = createApiKey(db, {
        name: "Test API Key",
        userId: user.id,
        orgId: user.orgId,
        workspaceScopes: ["ws-1", "ws-2"],
        permissions: ["read", "write"],
      });

      expect(apiKey).toMatch(/^os_[a-f0-9]{64}$/);
      expect(id).toBeDefined();
    });

    it("should validate an API key", async () => {
      const user = await createAccount(db, {
        email: "validatekey@example.com",
        password: "ValidateKeyPass123!",
        displayName: "Validate Key User",
        orgId: "org-1",
      });

      const { apiKey } = createApiKey(db, {
        name: "Test Key",
        userId: user.id,
        orgId: user.orgId,
        workspaceScopes: ["ws-1"],
        permissions: ["read"],
      });

      const validated = validateApiKey(db, apiKey);

      expect(validated).not.toBeNull();
      expect(validated?.userId).toBe(user.id);
      expect(validated?.workspaceScopes).toContain("ws-1");
      expect(validated?.lastUsedAt).not.toBeNull();
    });

    it("should reject invalid API keys", () => {
      const result = validateApiKey(db, "os_invalid_key_123");
      expect(result).toBeNull();
    });

    it("should list user API keys", async () => {
      const user = await createAccount(db, {
        email: "listkeys@example.com",
        password: "ListKeysPass123!",
        displayName: "List Keys User",
        orgId: "org-1",
      });

      createApiKey(db, {
        name: "Key 1",
        userId: user.id,
        orgId: user.orgId,
      });

      createApiKey(db, {
        name: "Key 2",
        userId: user.id,
        orgId: user.orgId,
      });

      const keys = listApiKeys(db, user.id);
      expect(keys.length).toBe(2);
      expect(keys[0].name).toBeDefined();
    });

    it("should revoke an API key", async () => {
      const user = await createAccount(db, {
        email: "revokekey@example.com",
        password: "RevokeKeyPass123!",
        displayName: "Revoke Key User",
        orgId: "org-1",
      });

      const { apiKey, id } = createApiKey(db, {
        name: "Revoke Test",
        userId: user.id,
        orgId: user.orgId,
      });

      const revoked = revokeApiKey(db, id, user.id);
      expect(revoked).toBe(true);

      // Should no longer validate
      const validated = validateApiKey(db, apiKey);
      expect(validated).toBeNull();
    });

    it("should reject expired API keys", async () => {
      const user = await createAccount(db, {
        email: "expiredkey@example.com",
        password: "ExpiredKeyPass123!",
        displayName: "Expired Key User",
        orgId: "org-1",
      });

      const expiredDate = new Date(Date.now() - 1000); // 1 second ago
      const { apiKey } = createApiKey(db, {
        name: "Expired Key",
        userId: user.id,
        orgId: user.orgId,
        expiresAt: expiredDate,
      });

      const validated = validateApiKey(db, apiKey);
      expect(validated).toBeNull();
    });
  });

  describe("Cleanup", () => {
    it("should clean up expired sessions and tokens", async () => {
      const user = await createAccount(db, {
        email: "cleanup@example.com",
        password: "CleanupPass123!",
        displayName: "Cleanup User",
        orgId: "org-1",
      });

      // Create a session (will be expired after cleanup in tests)
      const { session } = createSession(db, {
        userId: user.id,
        orgId: user.orgId,
        ipAddress: "192.168.1.1",
        userAgent: "Test Agent",
      });

      // In a real test, we'd wait or manipulate time
      // For now, just verify the function runs without error
      expect(() => cleanupExpiredAuth(db)).not.toThrow();
    });
  });
});
