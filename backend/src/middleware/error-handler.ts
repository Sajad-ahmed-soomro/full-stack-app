import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { ApiError } from "../utils/api-error";
import { toFieldIssues } from "./validate";

const PG_ERROR_STATUS: Record<string, { status: number; message: string }> = {
  "23505": { status: 409, message: "That record already exists" },
  "23503": { status: 400, message: "Referenced record does not exist" },
  "23502": { status: 400, message: "A required field was missing" },
  "23514": { status: 400, message: "A field failed a database constraint" },
};

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} does not exist`));
};

function normalise(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof ZodError) {
    return ApiError.validationFailed(toFieldIssues("body", error));
  }

  const pgError = error as { code?: string };
  if (pgError?.code && PG_ERROR_STATUS[pgError.code]) {
    const mapped = PG_ERROR_STATUS[pgError.code]!;
    return new ApiError(
      mapped.status,
      mapped.status === 409 ? "conflict" : "bad_request",
      mapped.message,
    );
  }

  if (error instanceof SyntaxError && "body" in error) {
    return ApiError.badRequest("Request body is not valid JSON");
  }

  return ApiError.internal();
}

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const apiError = normalise(error);
  const requestId = typeof req.id === "string" ? req.id : undefined;
  const log = req.log ?? logger;

  if (apiError.statusCode >= 500) {
    log.error({ err: error, requestId }, "Request failed");
  } else {
    log.warn(
      { code: apiError.code, status: apiError.statusCode, requestId },
      apiError.message,
    );
  }

  res.status(apiError.statusCode).json({
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details ? { details: apiError.details } : {}),
      ...(requestId ? { requestId } : {}),
      ...(!env.isProduction && apiError.statusCode >= 500 && error instanceof Error
        ? { cause: error.message }
        : {}),
    },
  });
};
