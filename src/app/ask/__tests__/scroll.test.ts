import { describe, expect, it } from "vitest";
import { AUTO_FOLLOW_THRESHOLD_PX, isNearBottom } from "@/app/ask/scroll";

describe("isNearBottom", () => {
  it("returns true when already at the bottom", () => {
    expect(isNearBottom(300, 500, 800)).toBe(true);
  });

  it("returns true when within the threshold", () => {
    expect(
      isNearBottom(266, 500, 790, AUTO_FOLLOW_THRESHOLD_PX),
    ).toBe(true);
  });

  it("returns false when user is no longer near the bottom", () => {
    expect(
      isNearBottom(200, 500, 790, AUTO_FOLLOW_THRESHOLD_PX),
    ).toBe(false);
  });
});
