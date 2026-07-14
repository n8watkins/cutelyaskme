import { describe, expect, it } from "vitest";
import {
  isOwnedMemoryPublicId,
  memoryPhotoDeliveryUrl,
  memoryPhotoFolder,
  removedPublicIds,
} from "./photo-refs";
import type { PhotoRef } from "./memory-display";

function ref(publicId: string): PhotoRef {
  return { url: `https://res.cloudinary.com/demo/${publicId}.jpg`, publicId };
}

const stored = (...ids: string[]) => JSON.stringify(ids.map(ref));

describe("removedPublicIds", () => {
  it("returns the ids dropped from the incoming list", () => {
    expect(removedPublicIds(stored("a", "b", "c"), [ref("a"), ref("c")])).toEqual(["b"]);
  });

  it("returns every id when the incoming list is empty (clear all)", () => {
    expect(removedPublicIds(stored("a", "b"), [])).toEqual(["a", "b"]);
  });

  it("is a no-op when the lists match", () => {
    expect(removedPublicIds(stored("a", "b"), [ref("a"), ref("b")])).toEqual([]);
  });

  it("treats a reorder as no removal", () => {
    expect(removedPublicIds(stored("a", "b"), [ref("b"), ref("a")])).toEqual([]);
  });

  it("treats additions as no removal", () => {
    expect(removedPublicIds(stored("a"), [ref("a"), ref("new")])).toEqual([]);
  });

  it("destroys nothing when the stored JSON is malformed or empty", () => {
    expect(removedPublicIds("not json", [ref("a")])).toEqual([]);
    expect(removedPublicIds('{"url":"x"}', [])).toEqual([]);
    expect(removedPublicIds(null, [])).toEqual([]);
    expect(removedPublicIds("[]", [])).toEqual([]);
  });

  it("skips malformed stored entries but still diffs the valid ones", () => {
    const json = JSON.stringify([ref("a"), { url: 5, publicId: "b" }, "nope", ref("c")]);
    expect(removedPublicIds(json, [ref("a")])).toEqual(["c"]);
  });

  it("deduplicates a publicId stored more than once", () => {
    expect(removedPublicIds(stored("a", "a", "b"), [ref("b")])).toEqual(["a"]);
  });

  it("binds upload folders and deletion to one plan participant", () => {
    expect(memoryPhotoFolder("plan-1", "user_1")).toBe("date-memories/plan-1/user_1");
    expect(
      isOwnedMemoryPublicId("date-memories/plan-1/user_1/photo", "plan-1", "user_1"),
    ).toBe(true);
    expect(
      isOwnedMemoryPublicId("date-memories/plan-2/user_1/photo", "plan-1", "user_1"),
    ).toBe(false);
  });

  it("derives a Cloudinary delivery URL from trusted configuration and public id", () => {
    expect(memoryPhotoDeliveryUrl("my-cloud", "date-memories/plan-1/user_1/photo_1")).toBe(
      "https://res.cloudinary.com/my-cloud/image/upload/date-memories/plan-1/user_1/photo_1",
    );
    expect(() => memoryPhotoDeliveryUrl("evil.example/x", "safe/photo")).toThrow(
      "invalid Cloudinary cloud name",
    );
    expect(() => memoryPhotoDeliveryUrl("my-cloud", "safe/../foreign")).toThrow(
      "invalid Cloudinary public id",
    );
  });

  it("never destroys a removed id outside the caller's scoped folder", () => {
    const own = "date-memories/plan-1/user_1/own";
    const foreign = "date-memories/plan-2/user_2/foreign";
    expect(
      removedPublicIds(stored(own, foreign), [], (id) =>
        isOwnedMemoryPublicId(id, "plan-1", "user_1"),
      ),
    ).toEqual([own]);
  });
});
