import type { PublicBusiness } from "../businesses/business.types";

export interface AuthenticatedUser {
  id: string;
  businessId: string;
  email: string;
  role: string;
}

export interface UserRow {
  id: string;
  business_id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: string;
  created_at: Date;
}

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  expiresIn: string;
  user: PublicUser;
  business: PublicBusiness;
}
