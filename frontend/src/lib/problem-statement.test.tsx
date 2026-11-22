import { expect, it } from "vitest";
import { splitProblemStatement } from "./problem-statement";

it("separates one-line example pairs from the instructions", () => {
  const result = splitProblemStatement(
    "Read two integers. Print their sum.\n\nExample input: 2 3\nExample output: 5\nSample Input: 10 -4\nsample output: 6\n",
  );
  expect(result.body).toBe("Read two integers. Print their sum.");
  expect(result.samples).toEqual([
    { input: "2 3", output: "5" },
    { input: "10 -4", output: "6" },
  ]);
});

it("keeps the statement untouched when examples are not simple one-line pairs", () => {
  for (const text of [
    "Print hello.\nExample input:\n2 3\nExample output: 5",
    "Print hello.\nExample input: 2\nThen think.\nExample output: 5",
    "Print hello.\nExample output: 5",
    "Print hello.\nExample input: 5",
  ]) {
    expect(splitProblemStatement(text)).toEqual({ body: text, samples: [] });
  }
  expect(splitProblemStatement("Just instructions.")).toEqual({ body: "Just instructions.", samples: [] });
});
