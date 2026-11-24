// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  transaction: vi.fn(),
  where: vi.fn(),
  set: vi.fn(),
  values: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/src/lib/auth/session", () => ({ getSession: mocks.session }));
vi.mock("@/src/config/env", () => ({
  getEnv: () => ({ APP_URL: "https://example.test" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/src/lib/db", () => ({
  db: () => ({
    transaction: mocks.transaction,
    select: () => ({ from: () => ({ where: mocks.where }) }),
  }),
}));
import { avatarType, MAX_AVATAR_BYTES } from "@/src/lib/profiles/avatar";
import { POST, DELETE } from "@/app/api/avatars/route";
import { GET } from "@/app/api/avatars/[userId]/route";
const jpeg = new Uint8Array([255, 216, 255, 224, 0]);
function upload(bytes: Uint8Array = jpeg, origin = "https://example.test") {
  const body = new FormData();
  body.set(
    "image",
    new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }),
    "photo.jpg",
  );
  return new Request("https://example.test/api/avatars", {
    method: "POST",
    headers: { Origin: origin },
    body,
  });
}
const get = (headers: HeadersInit = {}, version = "") =>
  GET(
    new Request(`https://example.test/api/avatars/member${version}`, {
      headers,
    }),
    { params: Promise.resolve({ userId: "member" }) },
  );
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({
    user: { id: "member", emailVerified: true },
  });
  mocks.where.mockResolvedValue([]);
  mocks.transaction.mockImplementation(async (fn) =>
    fn({
      insert: () => ({
        values: (value: unknown) => {
          mocks.values(value);
          return { onConflictDoUpdate: vi.fn() };
        },
      }),
      update: () => ({
        set: (value: unknown) => {
          mocks.set(value);
          return { where: vi.fn() };
        },
      }),
      delete: () => ({ where: vi.fn() }),
    }),
  );
});
describe("avatar upload", () => {
  it.each([null, { user: { id: "member", emailVerified: false } }])(
    "requires verified authentication",
    async (session) => {
      mocks.session.mockResolvedValue(session);
      expect((await POST(upload())).status).toBe(401);
      expect(mocks.transaction).not.toHaveBeenCalled();
    },
  );
  it("rejects another origin", async () => {
    expect((await POST(upload(jpeg, "https://other.test"))).status).toBe(403);
  });
  it("rejects oversized images before writing", async () => {
    expect(
      (await POST(upload(new Uint8Array(MAX_AVATAR_BYTES + 1)))).status,
    ).toBe(413);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rejects a JPEG filename containing non-image bytes", async () => {
    expect(
      (await POST(upload(new TextEncoder().encode("<svg/>")))).status,
    ).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("stores the bytes and versioned URL in one transaction", async () => {
    const response = await POST(upload());
    expect(response.status).toBe(200);
    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "member",
        content: Buffer.from(jpeg),
        contentType: "image/jpeg",
      }),
    );
    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        avatarUrl: expect.stringMatching(/^\/api\/avatars\/member\?v=\d+$/),
      }),
    );
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });
  it("requires authentication to remove a photo", async () => {
    mocks.session.mockResolvedValue(null);
    expect(
      (
        await DELETE(
          new Request("https://example.test/api/avatars", { method: "DELETE" }),
        )
      ).status,
    ).toBe(401);
  });
  it("removes bytes and clears the profile URL", async () => {
    const response = await DELETE(
      new Request("https://example.test/api/avatars", {
        method: "DELETE",
        headers: { Origin: "https://example.test" },
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({ avatarUrl: null }),
    );
  });
});
it("recognizes JPEG, PNG and WebP magic, ignores declared MIME, rejects empty and oversize data", () => {
  expect(avatarType(jpeg)).toBe("image/jpeg");
  expect(avatarType(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(
    "image/png",
  );
  expect(avatarType(new TextEncoder().encode("RIFFxxxxWEBP"))).toBe(
    "image/webp",
  );
  expect(avatarType(new Uint8Array())).toBeNull();
  expect(avatarType(new Uint8Array(MAX_AVATAR_BYTES + 1))).toBeNull();
  expect(avatarType(new TextEncoder().encode("GIF89a"))).toBeNull();
});
describe("avatar GET", () => {
  it("returns an uncached 404 for missing photos", async () => {
    const response = await get();
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("serves image bytes with ETag and immutable caching only for the current version", async () => {
    mocks.where.mockResolvedValue([
      {
        content: Buffer.from(jpeg),
        contentType: "image/jpeg",
        updatedAt: new Date(1234),
      },
    ]);
    const response = await get({}, "?v=1234");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(jpeg);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Cache-Control")).toContain(
      "max-age=31536000, immutable",
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    const etag = response.headers.get("ETag")!;
    const cached = await get({ "If-None-Match": etag }, "?v=1234");
    expect(cached.status).toBe(304);
    expect(await cached.text()).toBe("");
    expect((await get({}, "?v=old")).headers.get("Cache-Control")).toContain(
      "must-revalidate",
    );
  });
});
