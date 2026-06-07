import { describe, it, expect } from "vitest";
import { htmlEscape } from "./html";

describe("htmlEscape", () => {
  it("escapes HTML-significant characters", () => {
    expect(htmlEscape('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
    expect(htmlEscape("Tom & Jerry")).toBe("Tom &amp; Jerry");
  });
  it("leaves safe text unchanged", () => {
    expect(htmlEscape("Blue Bottle Coffee")).toBe("Blue Bottle Coffee");
  });
});
