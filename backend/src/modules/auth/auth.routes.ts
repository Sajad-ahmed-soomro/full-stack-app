import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authRateLimiter } from "../../middleware/rate-limit";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/async-handler";
import * as controller from "./auth.controller";
import { loginSchema, signupSchema } from "./auth.schemas";

export const authRouter = Router();

authRouter.post(
  "/signup",
  authRateLimiter,
  validate({ body: signupSchema }),
  asyncHandler(controller.signup),
);

authRouter.post(
  "/login",
  authRateLimiter,
  validate({ body: loginSchema }),
  asyncHandler(controller.login),
);

authRouter.get("/me", authenticate, asyncHandler(controller.me));
