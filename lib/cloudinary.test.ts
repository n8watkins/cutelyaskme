import { describe, expect, it } from "vitest";
import { signCloudinaryParams } from "./cloudinary";

describe("signCloudinaryParams", () => {
  it("matches the upload signature shape (sha1 of sorted params + secret)", () => {
    // sha1("folder=date-memories&timestamp=1700000000shhh")
    expect(
      signCloudinaryParams({ folder: "date-memories", timestamp: 1700000000 }, "shhh"),
    ).toBe("c739e39b7eaf8675af206f2111b58f7bfbf77495");
  });

  it("matches the destroy signature shape", () => {
    // sha1("public_id=date-memories/abc&timestamp=1700000000shhh")
    expect(
      signCloudinaryParams(
        { public_id: "date-memories/abc", timestamp: 1700000000 },
        "shhh",
      ),
    ).toBe("d736ebafa5136a5f759c8e087a3aa304252722bc");
  });

  it("sorts params alphabetically regardless of insertion order", () => {
    const a = signCloudinaryParams({ timestamp: 1, folder: "f" }, "s");
    const b = signCloudinaryParams({ folder: "f", timestamp: 1 }, "s");
    expect(a).toBe(b);
  });
});
