// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getSession: vi.fn(),
  db: vi.fn(),
  rateLimit: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/src/lib/app-user", () => ({
  requireAdmin: mocks.requireAdmin,
}));
vi.mock("@/src/lib/auth/session", () => ({
  getSession: mocks.getSession,
}));
vi.mock("@/src/lib/db", () => ({
  db: mocks.db,
}));
vi.mock("@/src/lib/security/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
}));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import {
  SUPPORT_CATEGORIES,
  supportTicketSchema,
} from "@/src/lib/support/validation";
import {
  checkSupportRateLimit,
  hashIp,
} from "@/src/lib/support/rate-limit";
import {
  updateTicketNoteAction,
  updateTicketStatusAction,
} from "@/app/[locale]/(app)/admin/support/actions";
import { GET as exportGet } from "@/app/api/account/export/route";

describe("supportTicketSchema validation", () => {
  const validData = {
    name: "Alex Smith",
    email: "alex@example.com",
    category: "question",
    subject: "How does matching work?",
    message: "I would like to know more about matching with partners.",
    locale: "en",
    pageUrl: "https://focuskept.com/contact",
  };

  it("accepts valid ticket input", () => {
    const result = supportTicketSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Alex Smith");
      expect(result.data.category).toBe("question");
      expect(result.data.hp).toBeUndefined();
    }
  });

  it.each(SUPPORT_CATEGORIES)("accepts valid category '%s'", (cat) => {
    const result = supportTicketSchema.safeParse({
      ...validData,
      category: cat,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid categories", () => {
    const result = supportTicketSchema.safeParse({
      ...validData,
      category: "unsupported_category",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email formats", () => {
    const result = supportTicketSchema.safeParse({
      ...validData,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty or whitespace-only name", () => {
    const result = supportTicketSchema.safeParse({
      ...validData,
      name: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects subject that is too short", () => {
    const result = supportTicketSchema.safeParse({
      ...validData,
      subject: "hi",
    });
    expect(result.success).toBe(false);
  });

  it("rejects message that is too short", () => {
    const result = supportTicketSchema.safeParse({
      ...validData,
      message: "short",
    });
    expect(result.success).toBe(false);
  });

  it("preserves honeypot field if bot submits it", () => {
    const result = supportTicketSchema.safeParse({
      ...validData,
      hp: "https://spam-bot.site",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hp).toBe("https://spam-bot.site");
    }
  });
});

describe("support rate limiting", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("hashes IP addresses deterministically with SHA-256", () => {
    const hash1 = hashIp("198.51.100.42");
    const hash2 = hashIp("198.51.100.42");
    const hash3 = hashIp("203.0.113.19");

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    expect(hash1).not.toContain("198.51.100.42");
  });

  it("allows requests when rate limits are not exceeded", async () => {
    mocks.rateLimit.mockResolvedValue(true);

    const allowed = await checkSupportRateLimit(
      "198.51.100.42",
      "user-123",
    );
    expect(allowed).toBe(true);
    expect(mocks.rateLimit).toHaveBeenCalledTimes(2);
    // Verifies the rate limit key uses the hashed IP, not the raw IP
    expect(mocks.rateLimit).toHaveBeenCalledWith(
      expect.stringMatching(/^support:ip:[a-f0-9]{64}$/),
      5,
      3600,
    );
    expect(mocks.rateLimit).toHaveBeenCalledWith(
      "support:user:user-123",
      5,
      3600,
    );
  });

  it("blocks requests when the IP rate limit is exceeded", async () => {
    mocks.rateLimit.mockResolvedValueOnce(false);

    const allowed = await checkSupportRateLimit(
      "198.51.100.42",
      "user-123",
    );
    expect(allowed).toBe(false);
    expect(mocks.rateLimit).toHaveBeenCalledTimes(1);
  });

  it("blocks requests when the user rate limit is exceeded", async () => {
    mocks.rateLimit.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const allowed = await checkSupportRateLimit(
      "198.51.100.42",
      "user-123",
    );
    expect(allowed).toBe(false);
    expect(mocks.rateLimit).toHaveBeenCalledTimes(2);
  });
});

describe("admin support authorization and actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("requires admin authorization before updating ticket status", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("unauthorized"));

    const formData = new FormData();
    formData.set("id", "8bba2632-e4b5-49c3-8716-2d6bacad601b");
    formData.set("status", "answered");

    await expect(updateTicketStatusAction(formData)).rejects.toThrow(
      "unauthorized",
    );
    expect(mocks.db).not.toHaveBeenCalled();
  });

  it("updates ticket status when caller is admin", async () => {
    mocks.requireAdmin.mockResolvedValue({
      user: { id: "admin-1" },
      profile: { role: "admin" },
    });

    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    mocks.db.mockReturnValue({ update: () => ({ set }) });

    const formData = new FormData();
    formData.set("id", "8bba2632-e4b5-49c3-8716-2d6bacad601b");
    formData.set("status", "answered");

    const result = await updateTicketStatusAction(formData);
    expect(result).toEqual({ ok: true });
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "answered",
        answeredAt: expect.any(Date),
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/[locale]/admin/support",
      "layout",
    );
  });

  it("requires admin authorization before updating admin note", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("unauthorized"));

    const formData = new FormData();
    formData.set("id", "8bba2632-e4b5-49c3-8716-2d6bacad601b");
    formData.set("adminNote", "Investigating issue");

    await expect(updateTicketNoteAction(formData)).rejects.toThrow(
      "unauthorized",
    );
    expect(mocks.db).not.toHaveBeenCalled();
  });

  it("updates admin internal note when caller is admin", async () => {
    mocks.requireAdmin.mockResolvedValue({
      user: { id: "admin-1" },
      profile: { role: "admin" },
    });

    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    mocks.db.mockReturnValue({ update: () => ({ set }) });

    const formData = new FormData();
    formData.set("id", "8bba2632-e4b5-49c3-8716-2d6bacad601b");
    formData.set("adminNote", "Followed up with user via email.");

    const result = await updateTicketNoteAction(formData);
    expect(result).toEqual({ ok: true });
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        adminNote: "Followed up with user via email.",
      }),
    );
  });
});

describe("GDPR export includes support tickets", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("includes user's support tickets in data export", async () => {
    const testUserId = "user-abc-123";
    const testUserEmail = "test@example.com";

    mocks.getSession.mockResolvedValue({
      user: {
        id: testUserId,
        email: testUserEmail,
        emailVerified: true,
      },
    });

    mocks.rateLimit.mockResolvedValue(true);

    const mockTickets = [
      {
        id: "ticket-1",
        category: "bug",
        subject: "Camera disconnected",
        message: "My webcam cut out at minute 30.",
        status: "answered",
        createdAt: new Date("2026-03-01T10:00:00Z"),
        answeredAt: new Date("2026-03-01T12:00:00Z"),
      },
    ];

    // Mock db selects for each export table
    mocks.db.mockReturnValue({
      select: () => ({
        from: () => ({
          where: vi.fn().mockImplementation(() => Promise.resolve(mockTickets)),
        }),
      }),
    });

    const response = await exportGet();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("supportTickets");
    expect(Array.isArray(data.supportTickets)).toBe(true);
    expect(data.supportTickets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ticket-1",
          category: "bug",
          subject: "Camera disconnected",
        }),
      ]),
    );
  });
});
