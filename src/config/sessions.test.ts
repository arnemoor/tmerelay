import { describe, expect, it } from "vitest";

import { deriveSessionKey } from "./sessions.js";

describe("sessions", () => {
  it("returns normalized per-sender key", () => {
    expect(deriveSessionKey("per-sender", { From: "whatsapp:+1555" })).toBe(
      "+1555",
    );
  });

  it("falls back to unknown when sender missing", () => {
    expect(deriveSessionKey("per-sender", {})).toBe("unknown");
  });

  it("global scope returns global", () => {
    expect(deriveSessionKey("global", { From: "+1" })).toBe("global");
  });

  it("keeps group chats distinct", () => {
    expect(deriveSessionKey("per-sender", { From: "12345-678@g.us" })).toBe(
      "group:12345-678@g.us",
    );
  });

  it("preserves telegram identifiers with username", () => {
    expect(deriveSessionKey("per-sender", { From: "telegram:@alice" })).toBe(
      "telegram:@alice",
    );
  });

  it("preserves telegram identifiers with numeric ID", () => {
    expect(deriveSessionKey("per-sender", { From: "telegram:123456789" })).toBe(
      "telegram:123456789",
    );
  });

  it("keeps different telegram users distinct", () => {
    const alice = deriveSessionKey("per-sender", { From: "telegram:@alice" });
    const bob = deriveSessionKey("per-sender", { From: "telegram:@bob" });
    expect(alice).not.toBe(bob);
    expect(alice).toBe("telegram:@alice");
    expect(bob).toBe("telegram:@bob");
  });
});
