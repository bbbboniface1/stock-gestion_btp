import { describe, expect, it } from "vitest";
import { isValidLogoUrl, resolveCompanyLogo } from "./company-logo";

const TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("company-logo", () => {
  it("parses data URL logos", async () => {
    const logo = await resolveCompanyLogo(TINY_PNG);
    expect(logo).not.toBeNull();
    expect(logo?.format).toBe("png");
    expect(logo?.buffer.length).toBeGreaterThan(0);
  });

  it("rejects invalid data URLs", async () => {
    expect(await resolveCompanyLogo("data:text/plain;base64,abc")).toBeNull();
    expect(isValidLogoUrl("data:text/plain;base64,abc")).toBe(false);
  });

  it("rejects private network URLs", async () => {
    expect(await resolveCompanyLogo("http://127.0.0.1/logo.png")).toBeNull();
    expect(await resolveCompanyLogo("http://localhost/logo.png")).toBeNull();
  });

  it("accepts public http(s) logo URLs syntactically", () => {
    expect(isValidLogoUrl("https://example.com/logo.png")).toBe(true);
  });
});
