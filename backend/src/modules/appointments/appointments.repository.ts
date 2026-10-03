import { query, queryOne } from "../../config/database";
import { splitDateAndTime } from "../../utils/datetime";
import type { ListAppointmentsQuery } from "./appointments.schemas";
import type {
  Appointment,
  AppointmentRow,
  AppointmentStatus,
  AppointmentSource,
} from "./appointments.types";

const APPOINTMENT_COLUMNS = `id, business_id, user_id, chat_session_id, service, customer_name,
       customer_email, scheduled_at, duration_minutes, status, source, notes, created_at, updated_at`;

export function toAppointment(row: AppointmentRow): Appointment {
  const { date, time } = splitDateAndTime(row.scheduled_at);
  return {
    id: row.id,
    service: row.service,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    scheduledAt: row.scheduled_at.toISOString(),
    date,
    time,
    durationMinutes: row.duration_minutes,
    status: row.status,
    source: row.source,
    notes: row.notes,
    chatSessionId: row.chat_session_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export interface AppointmentScope {
  businessId: string;
  userId?: string;
}

interface InsertAppointmentInput {
  businessId: string;
  userId: string;
  chatSessionId: string | null;
  service: string;
  customerName: string;
  customerEmail: string;
  scheduledAt: Date;
  durationMinutes: number;
  source: AppointmentSource;
  notes: string | null;
}

export async function insertAppointment(
  input: InsertAppointmentInput,
): Promise<AppointmentRow> {
  const rows = await query<AppointmentRow>(
    `INSERT INTO appointments (business_id, user_id, chat_session_id, service, customer_name,
                               customer_email, scheduled_at, duration_minutes, source, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING ${APPOINTMENT_COLUMNS}`,
    [
      input.businessId,
      input.userId,
      input.chatSessionId,
      input.service,
      input.customerName,
      input.customerEmail,
      input.scheduledAt,
      input.durationMinutes,
      input.source,
      input.notes,
    ],
  );
  return rows[0]!;
}

export async function findAppointmentById(
  id: string,
  scope: AppointmentScope,
): Promise<AppointmentRow | null> {
  const conditions = ["id = $1", "business_id = $2"];
  const params: unknown[] = [id, scope.businessId];

  if (scope.userId) {
    conditions.push(`user_id = $${params.length + 1}`);
    params.push(scope.userId);
  }

  return queryOne<AppointmentRow>(
    `SELECT ${APPOINTMENT_COLUMNS} FROM appointments WHERE ${conditions.join(" AND ")}`,
    params,
  );
}

export async function listAppointments(
  scope: AppointmentScope,
  filters: ListAppointmentsQuery,
): Promise<AppointmentRow[]> {
  const conditions = ["business_id = $1"];
  const params: unknown[] = [scope.businessId];

  if (scope.userId) {
    conditions.push(`user_id = $${params.length + 1}`);
    params.push(scope.userId);
  }

  if (filters.status?.length) {
    conditions.push(`status = ANY($${params.length + 1}::appointment_status[])`);
    params.push(filters.status);
  }

  if (filters.from) {
    conditions.push(`scheduled_at >= $${params.length + 1}`);
    params.push(`${filters.from}T00:00:00.000Z`);
  }

  if (filters.to) {
    conditions.push(`scheduled_at < $${params.length + 1}`);
    params.push(`${filters.to}T23:59:59.999Z`);
  }

  params.push(filters.limit, filters.offset);

  return query<AppointmentRow>(
    `SELECT ${APPOINTMENT_COLUMNS}
       FROM appointments
      WHERE ${conditions.join(" AND ")}
      ORDER BY scheduled_at ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
}

interface UpdateAppointmentPatch {
  status?: AppointmentStatus;
  scheduledAt?: Date;
  durationMinutes?: number;
  notes?: string | null;
}

export async function updateAppointment(
  id: string,
  scope: AppointmentScope,
  patch: UpdateAppointmentPatch,
): Promise<AppointmentRow | null> {
  const assignments: string[] = [];
  const params: unknown[] = [];

  if (patch.status !== undefined) {
    assignments.push(`status = $${params.length + 1}`);
    params.push(patch.status);
  }
  if (patch.scheduledAt !== undefined) {
    assignments.push(`scheduled_at = $${params.length + 1}`);
    params.push(patch.scheduledAt);
  }
  if (patch.durationMinutes !== undefined) {
    assignments.push(`duration_minutes = $${params.length + 1}`);
    params.push(patch.durationMinutes);
  }
  if (patch.notes !== undefined) {
    assignments.push(`notes = $${params.length + 1}`);
    params.push(patch.notes);
  }

  if (assignments.length === 0) {
    return findAppointmentById(id, scope);
  }

  const conditions = [`id = $${params.length + 1}`, `business_id = $${params.length + 2}`];
  params.push(id, scope.businessId);

  if (scope.userId) {
    conditions.push(`user_id = $${params.length + 1}`);
    params.push(scope.userId);
  }

  return queryOne<AppointmentRow>(
    `UPDATE appointments
        SET ${assignments.join(", ")}
      WHERE ${conditions.join(" AND ")}
    RETURNING ${APPOINTMENT_COLUMNS}`,
    params,
  );
}

export async function findSlotConflict(
  businessId: string,
  scheduledAt: Date,
  durationMinutes: number,
  excludeAppointmentId?: string,
): Promise<AppointmentRow | null> {
  const params: unknown[] = [businessId, scheduledAt, durationMinutes];
  let exclusion = "";

  if (excludeAppointmentId) {
    exclusion = `AND id <> $${params.length + 1}`;
    params.push(excludeAppointmentId);
  }

  return queryOne<AppointmentRow>(
    `SELECT ${APPOINTMENT_COLUMNS}
       FROM appointments
      WHERE business_id = $1
        AND status IN ('pending', 'confirmed')
        AND tstzrange(scheduled_at, scheduled_at + (duration_minutes * INTERVAL '1 minute'))
            && tstzrange($2::timestamptz, $2::timestamptz + ($3::int * INTERVAL '1 minute'))
        ${exclusion}
      LIMIT 1`,
    params,
  );
}

export async function summariseAppointments(
  scope: AppointmentScope,
): Promise<{ counts: Record<string, number>; upcoming: number; next: AppointmentRow | null }> {
  const conditions = ["business_id = $1"];
  const params: unknown[] = [scope.businessId];

  if (scope.userId) {
    conditions.push(`user_id = $${params.length + 1}`);
    params.push(scope.userId);
  }

  const where = conditions.join(" AND ");

  const [counts, next] = await Promise.all([
    query<{ status: AppointmentStatus; total: string; upcoming: string }>(
      `SELECT status,
              count(*) AS total,
              count(*) FILTER (WHERE scheduled_at >= now()) AS upcoming
         FROM appointments
        WHERE ${where}
        GROUP BY status`,
      params,
    ),
    queryOne<AppointmentRow>(
      `SELECT ${APPOINTMENT_COLUMNS}
         FROM appointments
        WHERE ${where}
          AND scheduled_at >= now()
          AND status IN ('pending', 'confirmed')
        ORDER BY scheduled_at ASC
        LIMIT 1`,
      params,
    ),
  ]);

  const totals: Record<string, number> = {};
  let upcoming = 0;

  for (const row of counts) {
    totals[row.status] = Number(row.total);
    if (row.status === "pending" || row.status === "confirmed") {
      upcoming += Number(row.upcoming);
    }
  }

  return { counts: totals, upcoming, next };
}
