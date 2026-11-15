import { expect, it } from "vitest";
import { isValidHandle, suggestHandle } from "./username";

it("accepts only 3-44 letters as a handle, ignoring case and outer spaces", () => {
  expect(isValidHandle(" NewHandle ")).toBe(true);
  expect(isValidHandle("ab")).toBe(false);
  expect(isValidHandle("k1ezy")).toBe(false);
  expect(isValidHandle("two words")).toBe(false);
  expect(isValidHandle("a".repeat(45))).toBe(false);
});

it("suggests a valid handle from the display name", () => {
  expect(suggestHandle("K1ezy")).toBe("kezy");
  expect(suggestHandle("Ana Cruz")).toBe("anacruz");
  expect(suggestHandle("Jo")).toBe("");
  expect(suggestHandle(null)).toBe("");
  expect(suggestHandle("a".repeat(60))).toHaveLength(44);
});
