import { query, queryOne, withTransaction } from "../../config/database";
import type { BookingFields } from "../ai/ai.types";
import { readDraft } from "../ai/booking-fields";
import type {
  ChatMessage,
  ChatMessageRow,
  ChatSession,
  ChatSessionRow,
  MessageSender,
} from "./chat.types";

const SESSION_COLUMNS = `id, business_id, user_id, status, title, draft, message_count,
       last_message_at, created_at, closed_at`;
const MESSAGE_COLUMNS = "id, session_id, sender, content, extracted_data, created_at";

export function toSession(row: ChatSessionRow): ChatSession {
  return {
    id: row.id,
    status: row.status,
    title: row.title,
    draft: readDraft(row.draft),
    messageCount: row.message_count,
    lastMessageAt: row.last_message_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

export function toMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    sender: row.sender,
    content: row.content,
    createdAt: row.created_at.toISOString(),
    metadata: (row.extracted_data as Record<string, unknown> | null) ?? null,
  };
}

export async function findActiveSession(
  userId: string,
): Promise<ChatSessionRow | null> {
  return queryOne<ChatSessionRow>(
    `SELECT ${SESSION_COLUMNS}
       FROM chat_sessions
      WHERE user_id = $1 AND status = 'active'`,
    [userId],
  );
}

export async function createSession(
  businessId: string,
  userId: string,
  draft: BookingFields,
): Promise<ChatSessionRow> {
  const inserted = await queryOne<ChatSessionRow>(
    `INSERT INTO chat_sessions (business_id, user_id, draft)
          VALUES ($1, $2, $3)
     ON CONFLICT (user_id) WHERE status = 'active' DO NOTHING
       RETURNING ${SESSION_COLUMNS}`,
    [businessId, userId, JSON.stringify(draft)],
  );

  if (inserted) return inserted;

  const existing = await findActiveSession(userId);
  if (!existing) {
    throw new Error("Failed to create or locate an active chat session");
  }
  return existing;
}

export async function findSessionById(
  id: string,
  userId: string,
): Promise<ChatSessionRow | null> {
  return queryOne<ChatSessionRow>(
    `SELECT ${SESSION_COLUMNS}
       FROM chat_sessions
      WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
}

export async function listSessions(userId: string, limit = 20): Promise<ChatSessionRow[]> {
  return query<ChatSessionRow>(
    `SELECT ${SESSION_COLUMNS}
       FROM chat_sessions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [userId, limit],
  );
}

export async function closeSession(id: string, userId: string): Promise<ChatSessionRow | null> {
  return queryOne<ChatSessionRow>(
    `UPDATE chat_sessions
        SET status = 'closed', closed_at = now()
      WHERE id = $1 AND user_id = $2 AND status = 'active'
    RETURNING ${SESSION_COLUMNS}`,
    [id, userId],
  );
}

export async function appendMessage(
  sessionId: string,
  sender: MessageSender,
  content: string,
  metadata: Record<string, unknown> | null = null,
): Promise<ChatMessageRow> {
  return withTransaction(async (client) => {
    const result = await client.query<ChatMessageRow>(
      `INSERT INTO chat_messages (session_id, sender, content, extracted_data)
            VALUES ($1, $2, $3, $4)
         RETURNING ${MESSAGE_COLUMNS}`,
      [sessionId, sender, content, metadata ? JSON.stringify(metadata) : null],
    );

    await client.query(
      `UPDATE chat_sessions
          SET message_count = message_count + 1,
              last_message_at = now(),
              title = COALESCE(title, $2)
        WHERE id = $1`,
      [sessionId, sender === "user" ? content.slice(0, 60) : null],
    );

    return result.rows[0]!;
  });
}

export async function updateDraft(sessionId: string, draft: BookingFields): Promise<void> {
  await query(`UPDATE chat_sessions SET draft = $2 WHERE id = $1`, [
    sessionId,
    JSON.stringify(draft),
  ]);
}

export async function listMessages(
  sessionId: string,
  options: { limit: number; since?: string },
): Promise<ChatMessageRow[]> {
  const params: unknown[] = [sessionId];
  let sinceClause = "";

  if (options.since) {
    sinceClause = `AND created_at > $${params.length + 1}`;
    params.push(options.since);
  }

  params.push(options.limit);

  return query<ChatMessageRow>(
    `SELECT ${MESSAGE_COLUMNS}
       FROM chat_messages
      WHERE session_id = $1 ${sinceClause}
      ORDER BY created_at ASC, id ASC
      LIMIT $${params.length}`,
    params,
  );
}

export async function listRecentTurns(
  sessionId: string,
  limit: number,
): Promise<ChatMessageRow[]> {
  const rows = await query<ChatMessageRow>(
    `SELECT ${MESSAGE_COLUMNS}
       FROM chat_messages
      WHERE session_id = $1 AND sender <> 'system'
      ORDER BY created_at DESC, id DESC
      LIMIT $2`,
    [sessionId, limit],
  );
  return rows.reverse();
}

export async function countUserMessages(sessionId: string): Promise<number> {
  const row = await queryOne<{ total: string }>(
    `SELECT count(*) AS total
       FROM chat_messages
      WHERE session_id = $1 AND sender = 'user'`,
    [sessionId],
  );
  return Number(row?.total ?? 0);
}
