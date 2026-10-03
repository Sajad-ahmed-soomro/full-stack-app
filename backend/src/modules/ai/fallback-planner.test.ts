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

    expect(plan.intent).not.toBe("book_appointment");
    expect(plan.complete).toBe(false);
    expect(plan.fields.service).toBeNull();
    expect(plan.fields.date).toBeNull();
    expect(plan.fields.time).toBeNull();
  });
});

describe("non-booking messages", () => {
  it("does not capture a service from a price question", () => {
    const plan = buildFallbackPlan(
      request({ message: "how much does a cleaning cost?" }),
      NOW,
    );

    expect(plan.intent).toBe("ask_question");
    expect(plan.fields.service).toBeNull();
    expect(plan.reply).toContain("pricing");
  });

  it("does not capture a date from an availability question", () => {
    const plan = buildFallbackPlan(
      request({ message: "what times are available tomorrow?" }),
      NOW,
    );

    expect(plan.intent).toBe("ask_question");
    expect(plan.fields.date).toBeNull();
    expect(plan.reply).toContain("check whether it is free");
  });

  it("answers an opening hours question from the business config", () => {
    const plan = buildFallbackPlan(request({ message: "are you open on Sunday?" }), NOW);

    expect(plan.intent).toBe("ask_question");
    expect(plan.reply).toContain("09:00 to 17:00 UTC");
    expect(plan.fields.date).toBeNull();
  });

  it("greets by name without starting a booking", () => {
    const plan = buildFallbackPlan(request({ message: "hello" }), NOW);

    expect(plan.intent).toBe("smalltalk");
    expect(plan.reply).toContain("Carter Clinic");
    expect(plan.fields.service).toBeNull();
  });

  it("acknowledges thanks instead of repeating the booking prompt", () => {
    const plan = buildFallbackPlan(request({ message: "thanks!" }), NOW);

    expect(plan.intent).toBe("smalltalk");
    expect(plan.reply).toContain("welcome");
  });

  it("still books when a question contains an explicit booking verb", () => {
    const plan = buildFallbackPlan(
      request({ message: "can you book me a cleaning tomorrow at 2pm?" }),
      NOW,
    );

    expect(plan.intent).toBe("book_appointment");
    expect(plan.fields.service).toBe("Cleaning");
    expect(plan.fields.time).toBe("14:00");
  });

  it("continues an in-progress booking from a bare detail", () => {
    const plan = buildFallbackPlan(
      request({
        message: "actually make it 10am",
        draft: { ...EMPTY_BOOKING_FIELDS, service: "Cleaning", date: "2026-03-11" },
      }),
      NOW,
    );

    expect(plan.intent).toBe("book_appointment");
    expect(plan.fields.time).toBe("10:00");
    expect(plan.fields.service).toBe("Cleaning");
  });
});
