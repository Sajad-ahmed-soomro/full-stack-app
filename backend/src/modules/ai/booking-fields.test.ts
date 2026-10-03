import { describe, expect, it } from "vitest";
import {
  mergeFields,
  missingFields,
  sanitiseFields,
  toCompleteBooking,
} from "./booking-fields";
import { EMPTY_BOOKING_FIELDS } from "./ai.types";

const NOW = new Date("2026-03-10T09:00:00.000Z");

describe("sanitiseFields", () => {
  it("keeps values that match the expected shape", () => {
    const fields = sanitiseFields(
      {
        service: "  Consultation ",
        date: "2026-03-12",
        time: "14:30",
        customerName: "Alex Carter",
        customerEmail: "ALEX@Example.com",
        notes: "bring records",
      },
      NOW,
    );

    expect(fields).toEqual({
      service: "Consultation",
      date: "2026-03-12",
      time: "14:30",
      customerName: "Alex Carter",
      customerEmail: "alex@example.com",
      notes: "bring records",
    });
  });

  it("drops values the model may hallucinate in the wrong format", () => {
    const fields = sanitiseFields(
      {
        service: "null",
        date: "next tuesday",
        time: "2pm",
        customerEmail: "not-an-email",
        customerName: "",
      },
      NOW,
    );

    expect(fields).toEqual(EMPTY_BOOKING_FIELDS);
  });

  it("rejects dates beyond the booking horizon", () => {
    expect(sanitiseFields({ date: "2030-01-01" }, NOW).date).toBeNull();
  });
});

describe("mergeFields", () => {
  it("lets new values win and keeps earlier turns otherwise", () => {
    const draft = sanitiseFields(
      { service: "Consultation", date: "2026-03-12", customerName: "Alex Carter" },
      NOW,
    );
    const incoming = sanitiseFields({ date: "2026-03-13", time: "09:30" }, NOW);

    expect(mergeFields(draft, incoming)).toMatchObject({
      service: "Consultation",
      date: "2026-03-13",
      time: "09:30",
      customerName: "Alex Carter",
    });
  });
});

describe("missingFields", () => {
  it("reports the fields still needed for a booking", () => {
    const fields = sanitiseFields({ service: "Consultation", time: "10:00" }, NOW);
    expect(missingFields(fields)).toEqual(["date", "customerName", "customerEmail"]);
  });
});

describe("toCompleteBooking", () => {
  it("returns null while any required field is missing", () => {
    const fields = sanitiseFields({ service: "Consultation", date: "2026-03-12" }, NOW);
    expect(toCompleteBooking(fields)).toBeNull();
  });

  it("returns a booking once every required field is present", () => {
    const fields = sanitiseFields(
      {
        service: "Consultation",
        date: "2026-03-12",
        time: "10:00",
        customerName: "Alex Carter",
        customerEmail: "alex@example.com",
      },
      NOW,
    );

    expect(toCompleteBooking(fields)).toEqual({
      service: "Consultation",
      date: "2026-03-12",
      time: "10:00",
      customerName: "Alex Carter",
      customerEmail: "alex@example.com",
      notes: null,
    });
  });
});
