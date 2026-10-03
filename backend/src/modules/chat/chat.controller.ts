import type { Request, Response } from "express";
import { requireUser } from "../../middleware/authenticate";
import { emitTurn } from "./chat.gateway";
import type { MessageHistoryQuery, SendMessageInput } from "./chat.schemas";
import * as chatService from "./chat.service";

export async function openSession(req: Request, res: Response): Promise<void> {
  const result = await chatService.openSession(requireUser(req));
  res.status(200).json(result);
}

export async function listSessions(req: Request, res: Response): Promise<void> {
  const sessions = await chatService.listSessions(requireUser(req));
  res.status(200).json({ sessions });
}

export async function resetSession(req: Request, res: Response): Promise<void> {
  const result = await chatService.closeSession(requireUser(req));
  res.status(201).json(result);
}

export async function messages(
  req: Request<{ id: string }, unknown, unknown, MessageHistoryQuery>,
  res: Response,
): Promise<void> {
  const history = await chatService.getMessages(
    requireUser(req),
    req.params.id,
    req.query,
  );
  res.status(200).json({ messages: history });
}

export async function sendMessage(
  req: Request<{ id: string }, unknown, SendMessageInput>,
  res: Response,
): Promise<void> {
  const user = requireUser(req);
  const turn = await chatService.handleUserMessage(user, req.body.content, req.params.id);
  emitTurn(user.id, turn);
  res.status(201).json(turn);
}
