import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/async-handler";
import * as controller from "./appointments.controller";
import {
  appointmentIdSchema,
  createAppointmentSchema,
  listAppointmentsSchema,
  updateAppointmentSchema,
} from "./appointments.schemas";

export const appointmentsRouter = Router();

appointmentsRouter.use(authenticate);

appointmentsRouter.get(
  "/",
  validate({ query: listAppointmentsSchema }),
  asyncHandler(controller.list),
);

appointmentsRouter.get("/summary", asyncHandler(controller.summary));

appointmentsRouter.post(
  "/",
  validate({ body: createAppointmentSchema }),
  asyncHandler(controller.create),
);

appointmentsRouter.get(
  "/:id",
  validate({ params: appointmentIdSchema }),
  asyncHandler(controller.detail),
);

appointmentsRouter.patch(
  "/:id",
  validate({ params: appointmentIdSchema, body: updateAppointmentSchema }),
  asyncHandler(controller.update),
);

appointmentsRouter.delete(
  "/:id",
  validate({ params: appointmentIdSchema }),
  asyncHandler(controller.cancel),
);
