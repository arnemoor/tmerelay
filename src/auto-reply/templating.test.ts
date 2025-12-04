import { describe, it, expect } from "vitest";
import { applyTemplate, type TemplateContext } from "./templating.js";

describe("templating", () => {
  describe("applyTemplate", () => {
    it("replaces simple placeholders", () => {
      const ctx: TemplateContext = {
        Body: "Hello world",
        From: "+1234567890",
        SessionId: "test-session",
      };
      const result = applyTemplate("Message: {{Body}} from {{From}}", ctx);
      expect(result).toBe("Message: Hello world from +1234567890");
    });

    it("handles PROVIDERS placeholder with single provider", () => {
      const ctx: TemplateContext = {
        Body: "test",
        PROVIDERS: "WhatsApp Web",
      };
      const result = applyTemplate("Connected to {{PROVIDERS}}", ctx);
      expect(result).toBe("Connected to WhatsApp Web");
    });

    it("handles PROVIDERS placeholder with multiple providers", () => {
      const ctx: TemplateContext = {
        Body: "test",
        PROVIDERS: "WhatsApp Web, Telegram",
      };
      const result = applyTemplate(
        "You're connected to {{PROVIDERS}}. Keep responses concise.",
        ctx,
      );
      expect(result).toBe(
        "You're connected to WhatsApp Web, Telegram. Keep responses concise.",
      );
    });

    it("replaces missing placeholders with empty string", () => {
      const ctx: TemplateContext = {
        Body: "test",
      };
      const result = applyTemplate("From: {{From}}, To: {{To}}", ctx);
      expect(result).toBe("From: , To: ");
    });

    it("handles whitespace in placeholder syntax", () => {
      const ctx: TemplateContext = {
        SessionId: "abc123",
      };
      const result = applyTemplate(
        "ID: {{ SessionId }} and {{SessionId}}",
        ctx,
      );
      expect(result).toBe("ID: abc123 and abc123");
    });

    it("preserves text without placeholders", () => {
      const ctx: TemplateContext = {
        Body: "test",
      };
      const result = applyTemplate("No placeholders here!", ctx);
      expect(result).toBe("No placeholders here!");
    });

    it("handles multiple occurrences of same placeholder", () => {
      const ctx: TemplateContext = {
        From: "+1234567890",
      };
      const result = applyTemplate("{{From}} sent to {{From}}", ctx);
      expect(result).toBe("+1234567890 sent to +1234567890");
    });

    it("handles all standard template fields", () => {
      const ctx: TemplateContext = {
        Body: "message body",
        BodyStripped: "stripped body",
        From: "+1111111111",
        To: "+2222222222",
        MessageSid: "msg123",
        MediaPath: "/tmp/media.jpg",
        MediaUrl: "https://example.com/media.jpg",
        MediaType: "image/jpeg",
        Transcript: "audio transcript",
        ChatType: "group",
        GroupSubject: "Test Group",
        GroupMembers: "Alice, Bob",
        SenderName: "Alice",
        SenderE164: "+1111111111",
        SessionId: "session-abc",
        IsNewSession: "true",
        PROVIDERS: "WhatsApp Web, Telegram",
      };

      const template = `
Body: {{Body}}
BodyStripped: {{BodyStripped}}
From: {{From}}
To: {{To}}
MessageSid: {{MessageSid}}
MediaPath: {{MediaPath}}
MediaUrl: {{MediaUrl}}
MediaType: {{MediaType}}
Transcript: {{Transcript}}
ChatType: {{ChatType}}
GroupSubject: {{GroupSubject}}
GroupMembers: {{GroupMembers}}
SenderName: {{SenderName}}
SenderE164: {{SenderE164}}
SessionId: {{SessionId}}
IsNewSession: {{IsNewSession}}
PROVIDERS: {{PROVIDERS}}
      `.trim();

      const result = applyTemplate(template, ctx);

      expect(result).toContain("Body: message body");
      expect(result).toContain("BodyStripped: stripped body");
      expect(result).toContain("From: +1111111111");
      expect(result).toContain("To: +2222222222");
      expect(result).toContain("MessageSid: msg123");
      expect(result).toContain("MediaPath: /tmp/media.jpg");
      expect(result).toContain("MediaUrl: https://example.com/media.jpg");
      expect(result).toContain("MediaType: image/jpeg");
      expect(result).toContain("Transcript: audio transcript");
      expect(result).toContain("ChatType: group");
      expect(result).toContain("GroupSubject: Test Group");
      expect(result).toContain("GroupMembers: Alice, Bob");
      expect(result).toContain("SenderName: Alice");
      expect(result).toContain("SenderE164: +1111111111");
      expect(result).toContain("SessionId: session-abc");
      expect(result).toContain("IsNewSession: true");
      expect(result).toContain("PROVIDERS: WhatsApp Web, Telegram");
    });
  });
});
