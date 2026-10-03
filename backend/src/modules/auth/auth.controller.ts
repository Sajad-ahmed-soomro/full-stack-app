import type { Request, Response } from "express";
import { requireUser } from "../../middleware/authenticate";
import type { LoginInput, SignupInput } from "./auth.schemas";
import * as authService from "./auth.service";

export async function signup(
  req: Request<unknown, unknown, SignupInput>,
  res: Response,
): Promise<void> {
  const session = await authService.signup(req.body);
  res.status(201).json(session);
}

export async function login(
  req: Request<unknown, unknown, LoginInput>,
  res: Response,
): Promise<void> {
  const session = await authService.login(req.body);
  res.status(200).json(session);
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const profile = await authService.getProfile(user.id);
  res.status(200).json(profile);
}
