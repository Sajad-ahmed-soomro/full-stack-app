import type { NextFunction, Request, RequestHandler, Response } from "express";

type AnyRequest = Request<any, any, any, any>;

type TypedHandler<Req extends AnyRequest> = (
  req: Req,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

export function asyncHandler<Req extends AnyRequest = Request>(
  handler: TypedHandler<Req>,
): RequestHandler {
  return (req, res, next) => {
    handler(req as unknown as Req, res, next).catch(next);
  };
}
