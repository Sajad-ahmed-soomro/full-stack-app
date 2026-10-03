import { describe, expect, it } from "vitest";
import {
  alignsWithSlot,
  combineDateAndTime,
  fitsBusinessHours,
  resolveRelativeDate,
  resolveTimeExpression,
  splitDateAndTime,
} from "./datetime";

const NOW = new Date("2026-03-10T09:00:00.000Z");

describe("combineDateAndTime", () => {
  it("builds a UTC instant from a date and a 24-hour time", () => {
    expect(combineDateAndTime("2026-03-12", "14:30")?.toISOString()).toBe(
      "2026-03-12T14:30:00.000Z",
    );
  });

  it("rejects malformed input", () => {
    expect(combineDateAndTime("12/03/2026", "14:30")).toBeNull();
    expect(combineDateAndTime("2026-03-12", "2:30pm")).toBeNull();
    expect(combineDateAndTime("2026-02-30", "10:00")).toBeNull();
  });
});

describe("splitDateAndTime", () => {
  it("round-trips an instant back to form field values", () => {
    expect(splitDateAndTime(new Date("2026-03-12T14:30:00.000Z"))).toEqual({
      date: "2026-03-12",
      time: "14:30",
    });
  });
});

describe("fitsBusinessHours", () => {
  it("accepts a slot that ends before closing", () => {
    expect(fitsBusinessHours(new Date("2026-03-12T16:30:00Z"), 30, 9, 17)).toBe(true);
  });

  it("rejects a slot that runs past closing", () => {
    expect(fitsBusinessHours(new Date("2026-03-12T16:45:00Z"), 30, 9, 17)).toBe(false);
  });

  it("rejects a slot before opening", () => {
    expect(fitsBusinessHours(new Date("2026-03-12T08:30:00Z"), 30, 9, 17)).toBe(false);
  });
});

describe("alignsWithSlot", () => {
  it("checks the start against the slot grid", () => {
    expect(alignsWithSlot(new Date("2026-03-12T10:30:00Z"), 30)).toBe(true);
    expect(alignsWithSlot(new Date("2026-03-12T10:20:00Z"), 30)).toBe(false);
  });
});

describe("resolveRelativeDate", () => {
  it("reads today and tomorrow", () => {
    expect(resolveRelativeDate("can I come in today", NOW)).toBe("2026-03-10");
    expect(resolveRelativeDate("tomorrow works", NOW)).toBe("2026-03-11");
  });

  it("reads the next instance of a weekday", () => {
    expect(resolveRelativeDate("friday please", NOW)).toBe("2026-03-13");
    expect(resolveRelativeDate("next tuesday", NOW)).toBe("2026-03-17");
  });

  it("returns null when there is no date", () => {
    expect(resolveRelativeDate("sometime soon", NOW)).toBeNull();
  });
});

describe("resolveTimeExpression", () => {
  it("normalises meridiem and 24-hour times", () => {
    expect(resolveTimeExpression("at 2pm")).toBe("14:00");
    expect(resolveTimeExpression("9:15 am works")).toBe("09:15");
    expect(resolveTimeExpression("16:45")).toBe("16:45");
    expect(resolveTimeExpression("midday at 12")).toBe("12:00");
  });

  it("returns null when there is no time", () => {
    expect(resolveTimeExpression("whenever you are free")).toBeNull();
  });
});
