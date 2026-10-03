import { describe, expect, it } from "vitest";
import { EMPTY_BOOKING_FIELDS, type PlanRequest } from "./ai.types";
import { buildFallbackPlan } from "./fallback-planner";

const NOW = new Date("2026-03-10T09:00:00.000Z");

function request(overrides: Partial<PlanRequest> = {}): PlanRequest {
  return {
    businessName: "Carter Clinic",
    openingHour: 9,
    closingHour: 17,
    slotMinutes: 30,
    defaultName: "Alex Carter",
    defaultEmail: "alex@example.com",
    draft: { ...EMPTY_BOOKING_FIELDS },
    history: [],
    message: "",
    ...overrides,
  };
}

describe("buildFallbackPlan", () => {
  it("resolves a relative date and a meridiem time from one message", () => {
    const plan = buildFallbackPlan(
      request({ message: "I need a consultation tomorrow at 2pm" }),
      NOW,
    );

    expect(plan.fields.service).toBe("Consultation");
    expect(plan.fields.date).toBe("2026-03-11");
    expect(plan.fields.time).toBe("14:00");
    expect(plan.complete).toBe(true);
    expect(plan.source).toBe("fallback");
  });

  it("fills identity from the signed-in account", () => {
    const plan = buildFallbackPlan(request({ message: "book a cleaning friday at 10:00" }), NOW);

    expect(plan.fields.customerName).toBe("Alex Carter");
    expect(plan.fields.customerEmail).toBe("alex@example.com");
  });

  it("asks for the details it is still missing", () => {
    const plan = buildFallbackPlan(request({ message: "I want to book an appointment" }), NOW);

    expect(plan.missingFields).toEqual(["service", "date", "time"]);
    expect(plan.complete).toBe(false);
    expect(plan.reply).toMatch(/what you would like to book/);
  });

  it("carries the draft forward when a later message only adds a time", () => {
    const plan = buildFallbackPlan(
      request({
        message: "make it 11:30",
        draft: {
          ...EMPTY_BOOKING_FIELDS,
          service: "Consultation",
          date: "2026-03-12",
          customerName: "Alex Carter",
          customerEmail: "alex@example.com",
        },
      }),
      NOW,
    );

    expect(plan.fields).toMatchObject({
      service: "Consultation",
      date: "2026-03-12",
      time: "11:30",
    });
    expect(plan.complete).toBe(true);
  });

  it("stays out of the booking flow for unrelated chat", () => {
    const plan = buildFallbackPlan(request({ message: "who are you?" }), NOW);

    expect(plan.intent).toBe("smalltalk");
    expect(plan.complete).toBe(false);
  });
});
