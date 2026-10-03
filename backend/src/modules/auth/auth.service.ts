import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { env } from "../../config/env";
import { ApiError, isUniqueViolation } from "../../utils/api-error";
import { signAccessToken } from "../../utils/jwt";
import * as businessRepository from "../businesses/business.repository";
import type { BusinessRow } from "../businesses/business.types";
import * as repository from "./auth.repository";
import type { LoginInput, SignupInput } from "./auth.schemas";
import type { AuthSession, UserRow } from "./auth.types";

const UNKNOWN_USER_HASH = bcrypt.hashSync(randomBytes(16).toString("hex"), env.BCRYPT_ROUNDS);

function buildSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = randomBytes(3).toString("hex");
  return base.length >= 3 ? `${base}-${suffix}` : `business-${suffix}`;
}

function buildSession(user: UserRow, business: BusinessRow): AuthSession {
  const token = signAccessToken({
    sub: user.id,
    businessId: user.business_id,
    email: user.email,
    role: user.role,
  });

  return {
    token,
    expiresIn: env.JWT_EXPIRES_IN,
    user: repository.toPublicUser(user),
    business: businessRepository.toPublicBusiness(business),
  };
}

export async function signup(input: SignupInput): Promise<AuthSession> {
  const existing = await repository.findUserByEmail(input.email);
  if (existing) {
    throw ApiError.conflict("An account with that email already exists");
  }

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  const businessName = input.businessName ?? `${input.fullName.split(" ")[0]}'s business`;

  try {
    const { user, business } = await repository.createAccount({
      businessName,
      businessSlug: buildSlug(businessName),
      email: input.email,
      passwordHash,
      fullName: input.fullName,
    });
    return buildSession(user, business);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw ApiError.conflict("An account with that email already exists");
    }
    throw error;
  }
}

export async function login(input: LoginInput): Promise<AuthSession> {
  const user = await repository.findUserByEmail(input.email);
  const passwordMatches = await bcrypt.compare(
    input.password,
    user?.password_hash ?? UNKNOWN_USER_HASH,
  );

  if (!user || !passwordMatches) {
    throw ApiError.unauthorized("Email or password is incorrect");
  }

  const business = await businessRepository.getBusinessOrFail(user.business_id);

  return buildSession(user, business);
}

export async function getProfile(userId: string): Promise<Omit<AuthSession, "token" | "expiresIn">> {
  const user = await repository.findUserById(userId);
  if (!user) {
    throw ApiError.unauthorized("Account no longer exists");
  }

  const business = await businessRepository.getBusinessOrFail(user.business_id);

  return {
    user: repository.toPublicUser(user),
    business: businessRepository.toPublicBusiness(business),
  };
}
