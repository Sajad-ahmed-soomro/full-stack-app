import rateLimit, { type Options } from "express-rate-limit";
import { env } from "../config/env";
import { ApiError } from "../utils/api-error";

function buildLimiter(limit: number, overrides: Partial<Options> = {}) {
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: () => env.NODE_ENV === "test",
    handler: (_req, _res, next) => {
      next(new ApiError(429, "rate_limited", "Too many requests, please slow down"));
    },
    ...overrides,
  });
}

export const globalRateLimiter = buildLimiter(env.RATE_LIMIT_MAX);

export const authRateLimiter = buildLimiter(env.AUTH_RATE_LIMIT_MAX, {
  skipSuccessfulRequests: true,
});

export const chatRateLimiter = buildLimiter(env.CHAT_RATE_LIMIT_MAX, {
  keyGenerator: (req) => req.user?.id ?? "anonymous",
});
