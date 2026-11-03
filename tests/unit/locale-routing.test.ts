import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import proxy from "@/proxy";

function request(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(new URL(path, "https://focuskept.com"), { headers });
}
const location = (response: Response) => response.headers.get("location");

describe("locale routing (proxy)", () => {
  it("redirects / to the Accept-Language match", () => {
    const response = proxy(
      request("/", { "accept-language": "de-DE,de;q=0.9,en;q=0.5" }),
    );
    expect(location(response)).toBe("https://focuskept.com/de");
  });
  it("prefers the locale cookie over Accept-Language", () => {
    const response = proxy(
      request("/", { "accept-language": "de", cookie: "NEXT_LOCALE=ar" }),
    );
    expect(location(response)).toBe("https://focuskept.com/ar");
  });
  it("falls back to English", () => {
    expect(location(proxy(request("/", { "accept-language": "xx-YY" })))).toBe(
      "https://focuskept.com/en",
    );
  });
  it("matches regional variants such as pt-BR and zh-CN", () => {
    expect(
      location(proxy(request("/", { "accept-language": "pt-BR,pt;q=0.9" }))),
    ).toBe("https://focuskept.com/pt-BR");
    expect(location(proxy(request("/", { "accept-language": "zh-CN" })))).toBe(
      "https://focuskept.com/zh-CN",
    );
  });
  it("prefixes unprefixed paths and keeps the query", () => {
    const response = proxy(
      request("/pricing?ref=x", { "accept-language": "fr" }),
    );
    expect(location(response)).toBe("https://focuskept.com/fr/pricing?ref=x");
  });
  it("passes locale-prefixed paths through", () => {
    const response = proxy(request("/ja/techniques/25-5"));
    expect(location(response)).toBeNull();
    expect(response.status).toBe(200);
  });
});
