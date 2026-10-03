import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { ApiError } from "./api-error";

export interface AccessTokenPayload {
  sub: string;
  businessId: string;
  email: string;
  role: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    issuer: "schedulr-api",
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { issuer: "schedulr-api" });
    if (typeof decoded === "string") {
      throw ApiError.unauthorized("Malformed access token");
    }
    const { sub, businessId, email, role } = decoded as Partial<AccessTokenPayload>;
    if (!sub || !businessId || !email || !role) {
      throw ApiError.unauthorized("Access token is missing required claims");
    }
    return { sub, businessId, email, role };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized("Session expired, please sign in again");
    }
    throw ApiError.unauthorized("Invalid access token");
  }
}

export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (!token || scheme?.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}
