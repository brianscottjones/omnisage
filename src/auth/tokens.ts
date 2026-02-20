/**
 * JWT token generation and validation
 * - Access tokens: 15 minutes
 * - Refresh tokens: 7 days
 */

import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";

// These should be loaded from environment variables in production
const ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET || "default-access-secret-change-me";
const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || "default-refresh-secret-change-me";

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

export interface AccessTokenPayload {
  userId: string;
  email: string;
  orgId: string;
  roles: string[];
  workspaceRoles: Record<string, string>;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
}

/**
 * Generate an access token (JWT)
 */
export function generateAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: "omnisage",
    audience: "omnisage-api",
  });
}

/**
 * Generate a refresh token (JWT) with a unique token ID
 */
export function generateRefreshToken(userId: string): {
  token: string;
  tokenId: string;
} {
  const tokenId = randomBytes(32).toString("hex");

  const token = jwt.sign(
    { userId, tokenId } as RefreshTokenPayload,
    REFRESH_TOKEN_SECRET,
    {
      expiresIn: REFRESH_TOKEN_EXPIRY,
      issuer: "omnisage",
      audience: "omnisage-api",
    }
  );

  return { token, tokenId };
}

/**
 * Verify and decode an access token
 */
export function verifyAccessToken(
  token: string
): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET, {
      issuer: "omnisage",
      audience: "omnisage-api",
    });

    if (typeof decoded === "object" && decoded !== null) {
      return decoded as AccessTokenPayload;
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Verify and decode a refresh token
 */
export function verifyRefreshToken(
  token: string
): RefreshTokenPayload | null {
  try {
    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET, {
      issuer: "omnisage",
      audience: "omnisage-api",
    });

    if (typeof decoded === "object" && decoded !== null) {
      return decoded as RefreshTokenPayload;
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Get expiry timestamp for access token (15 minutes from now)
 */
export function getAccessTokenExpiry(): number {
  return Date.now() + 15 * 60 * 1000;
}

/**
 * Get expiry timestamp for refresh token (7 days from now)
 */
export function getRefreshTokenExpiry(): number {
  return Date.now() + 7 * 24 * 60 * 60 * 1000;
}
