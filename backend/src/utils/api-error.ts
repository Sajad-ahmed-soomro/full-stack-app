export type ErrorCode =
  | "bad_request"
  | "validation_failed"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "upstream_unavailable"
  | "internal_error";

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(400, "bad_request", message, details);
  }

  static validationFailed(details: unknown): ApiError {
    return new ApiError(422, "validation_failed", "Request validation failed", details);
  }

  static unauthorized(message = "Authentication required"): ApiError {
    return new ApiError(401, "unauthorized", message);
  }

  static forbidden(message = "You do not have access to this resource"): ApiError {
    return new ApiError(403, "forbidden", message);
  }

  static notFound(message = "Resource not found"): ApiError {
    return new ApiError(404, "not_found", message);
  }

  static conflict(message: string, details?: unknown): ApiError {
    return new ApiError(409, "conflict", message, details);
  }

  static upstreamUnavailable(message: string): ApiError {
    return new ApiError(503, "upstream_unavailable", message);
  }

  static internal(message = "Something went wrong"): ApiError {
    return new ApiError(500, "internal_error", message);
  }
}

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const candidate = error as { code?: string; constraint?: string };
  if (candidate?.code !== "23505") return false;
  return constraint ? candidate.constraint === constraint : true;
}
