import type { RequestHandler } from "express";
import { ZodError, type ZodTypeAny } from "zod";
import { ApiError } from "../utils/api-error";

type RequestPart = "body" | "query" | "params";

export interface RequestSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export interface FieldIssue {
  location: RequestPart;
  field: string;
  message: string;
}

export function toFieldIssues(part: RequestPart, error: ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    location: part,
    field: issue.path.join(".") || part,
    message: issue.message,
  }));
}

export function validate(schemas: RequestSchemas): RequestHandler {
  const parts = Object.keys(schemas) as RequestPart[];

  return (req, _res, next) => {
    const issues: FieldIssue[] = [];

    for (const part of parts) {
      const schema = schemas[part];
      if (!schema) continue;

      const result = schema.safeParse(req[part]);
      if (result.success) {
        req[part] = result.data;
      } else {
        issues.push(...toFieldIssues(part, result.error));
      }
    }

    if (issues.length > 0) {
      next(ApiError.validationFailed(issues));
      return;
    }

    next();
  };
}
