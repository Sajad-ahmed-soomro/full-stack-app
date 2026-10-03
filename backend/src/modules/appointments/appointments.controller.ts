import type { Request, Response } from "express";
import { requireUser } from "../../middleware/authenticate";
import type {
  CreateAppointmentInput,
  ListAppointmentsQuery,
  UpdateAppointmentInput,
} from "./appointments.schemas";
import * as appointmentService from "./appointments.service";

export async function create(
  req: Request<unknown, unknown, CreateAppointmentInput>,
  res: Response,
): Promise<void> {
  const appointment = await appointmentService.createAppointment(requireUser(req), req.body);
  res.status(201).json({ appointment });
}

export async function list(
  req: Request<unknown, unknown, unknown, ListAppointmentsQuery>,
  res: Response,
): Promise<void> {
  const appointments = await appointmentService.listAppointments(requireUser(req), req.query);
  res.status(200).json({ appointments, count: appointments.length });
}

export async function summary(req: Request, res: Response): Promise<void> {
  const result = await appointmentService.getSummary(requireUser(req));
  res.status(200).json({ summary: result });
}

export async function detail(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  const appointment = await appointmentService.getAppointment(requireUser(req), req.params.id);
  res.status(200).json({ appointment });
}

export async function update(
  req: Request<{ id: string }, unknown, UpdateAppointmentInput>,
  res: Response,
): Promise<void> {
  const appointment = await appointmentService.updateAppointment(
    requireUser(req),
    req.params.id,
    req.body,
  );
  res.status(200).json({ appointment });
}

export async function cancel(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  const appointment = await appointmentService.cancelAppointment(
    requireUser(req),
    req.params.id,
  );
  res.status(200).json({ appointment });
}
