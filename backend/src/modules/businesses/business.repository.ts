import { queryOne } from "../../config/database";
import { ApiError } from "../../utils/api-error";
import type { BusinessRow, PublicBusiness } from "./business.types";

export const BUSINESS_COLUMNS =
  "id, name, slug, timezone, opening_hour, closing_hour, slot_minutes";

export function toPublicBusiness(row: BusinessRow): PublicBusiness {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    timezone: row.timezone,
    openingHour: row.opening_hour,
    closingHour: row.closing_hour,
    slotMinutes: row.slot_minutes,
  };
}

export async function findBusinessById(id: string): Promise<BusinessRow | null> {
  return queryOne<BusinessRow>(
    `SELECT ${BUSINESS_COLUMNS} FROM businesses WHERE id = $1`,
    [id],
  );
}

export async function getBusinessOrFail(id: string): Promise<BusinessRow> {
  const business = await findBusinessById(id);
  if (!business) {
    throw ApiError.notFound("Business not found");
  }
  return business;
}
