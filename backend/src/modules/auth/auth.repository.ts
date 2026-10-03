import { queryOne, withTransaction } from "../../config/database";
import { BUSINESS_COLUMNS } from "../businesses/business.repository";
import type { BusinessRow } from "../businesses/business.types";
import type { PublicUser, UserRow } from "./auth.types";

const USER_COLUMNS =
  "id, business_id, email, password_hash, full_name, role, created_at";

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    createdAt: row.created_at.toISOString(),
  };
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  return queryOne<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE email = $1`, [email]);
}

export async function findUserById(id: string): Promise<UserRow | null> {
  return queryOne<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
}

interface CreateAccountInput {
  businessName: string;
  businessSlug: string;
  email: string;
  passwordHash: string;
  fullName: string;
}

export async function createAccount(
  input: CreateAccountInput,
): Promise<{ user: UserRow; business: BusinessRow }> {
  return withTransaction(async (client) => {
    const businessResult = await client.query<BusinessRow>(
      `INSERT INTO businesses (name, slug)
            VALUES ($1, $2)
         RETURNING ${BUSINESS_COLUMNS}`,
      [input.businessName, input.businessSlug],
    );
    const business = businessResult.rows[0]!;

    const userResult = await client.query<UserRow>(
      `INSERT INTO users (business_id, email, password_hash, full_name, role)
            VALUES ($1, $2, $3, $4, 'owner')
         RETURNING ${USER_COLUMNS}`,
      [business.id, input.email, input.passwordHash, input.fullName],
    );

    return { user: userResult.rows[0]!, business };
  });
}
