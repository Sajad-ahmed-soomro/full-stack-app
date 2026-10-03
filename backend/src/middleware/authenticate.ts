import type { RequestHandler } from "express";
import type { AuthenticatedUser } from "../modules/auth/auth.types";
import { ApiError } from "../utils/api-error";
import { extractBearerToken, verifyAccessToken } from "../utils/jwt";

export const authenticate: RequestHandler = (req, _res, next) => {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    next(ApiError.unauthorized("Missing bearer token"));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      businessId: payload.businessId,
      email: payload.email,
      role: payload.role,
    };
    next();
  } catch (error) {
    next(error);
  }
};

export function requireUser(req: { user?: AuthenticatedUser }): AuthenticatedUser {
  if (!req.user) {
    throw ApiError.unauthorized();
  }
  return req.user;
}
