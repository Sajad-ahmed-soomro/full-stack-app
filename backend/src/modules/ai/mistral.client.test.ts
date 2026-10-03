import { describe, expect, it } from "vitest";
import { parseRetryAfter } from "./mistral.client";

const NOW = Date.parse("2026-03-10T09:00:00.000Z");

describe("parseRetryAfter", () => {
  it("reads a delay given in seconds", () => {
    expect(parseRetryAfter("2", NOW)).toBe(2000);
  });

  it("reads a delay given as an HTTP date", () => {
    expect(parseRetryAfter("Tue, 10 Mar 2026 09:00:01 GMT", NOW)).toBe(1000);
  });

  it("declines a wait longer than the cap, so the call is not retried", () => {
    expect(parseRetryAfter("60", NOW)).toBeNull();
  });

  it("declines a missing or unparseable header", () => {
    expect(parseRetryAfter(null, NOW)).toBeNull();
    expect(parseRetryAfter("soon", NOW)).toBeNull();
  });

  it("declines a date already in the past", () => {
    expect(parseRetryAfter("Tue, 10 Mar 2026 08:59:50 GMT", NOW)).toBeNull();
  });
});
