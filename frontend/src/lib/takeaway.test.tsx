import { expect, it } from "vitest";
import { MIN_SAMPLE, activitiesPassedSentence, firstTryHeadline, firstTrySentence, notEnoughData, recapSentence, trendTakeaway } from "./takeaway";

it("needs at least five values before describing a trend", () => {
  expect(MIN_SAMPLE).toBe(5);
  expect(trendTakeaway([40, 60, 80, 90], "Your scores")).toBe("Not enough data yet — based on 4.");
  expect(notEnoughData(1)).toBe("Not enough data yet — based on 1.");
});

it("calls a change of five points or more rising or falling, and anything smaller steady", () => {
  expect(trendTakeaway([40, 50, 60, 70, 80, 90], "Your scores")).toBe("Your scores are rising (up about 30 points).");
  expect(trendTakeaway([90, 80, 70, 60, 50, 40], "Your scores")).toBe("Your scores are falling (down about 30 points).");
  expect(trendTakeaway([60, 60, 62, 61, 63, 64], "Your scores")).toBe("Your scores are steady.");
});

it("treats exactly five points as a change, and four as steady", () => {
  expect(trendTakeaway([50, 50, 55, 55, 55], "Scores")).toBe("Scores are rising (up about 5 points).");
  expect(trendTakeaway([50, 50, 54, 54, 54], "Scores")).toBe("Scores are steady.");
});

it("writes the counting headlines with correct plurals and edge cases", () => {
  expect(activitiesPassedSentence(13, 21)).toBe("You passed 13 of 21 activities. 8 more are open.");
  expect(activitiesPassedSentence(1, 2, "Java")).toBe("You passed 1 of 2 activities in Java. 1 more is open.");
  expect(activitiesPassedSentence(1, 1)).toBe("You passed 1 of 1 activity. Every activity is passed.");
  expect(activitiesPassedSentence(0, 0)).toBe("Your workshops haven't shared an activity yet.");
  expect(firstTrySentence(8, 13)).toBe("8 of the 13 activities you passed went through on the first try.");
  expect(firstTrySentence(1, 1)).toBe("1 of the 1 activity you passed went through on the first try.");
  expect(firstTrySentence(0, 0)).toBe("Pass an activity to see how many go through on the first try.");
});

it("headlines the first-try chart with a count, then the trend or a not-enough-data note", () => {
  const tries = (scores: number[]) => scores.map((score) => ({ score, passed: score === 100 }));
  expect(firstTryHeadline([])).toBe("Your first tries will appear here once you attempt an activity.");
  expect(firstTryHeadline(tries([100, 50]))).toBe("1 of your last 2 first tries passed. Not enough data yet — based on 2.");
  expect(firstTryHeadline(tries([50, 50, 67, 100, 100, 100, 100, 100])))
    .toBe("5 of your last 8 first tries passed. Your first-try scores are rising (up about 33 points).");
  expect(firstTryHeadline(tries([100, 100, 100, 100, 100, 100, 100, 100, 100, 50])))
    .toBe("7 of your last 8 first tries passed. Your first-try scores are falling (down about 12 points).");
});

it("leads each recap item with a plain sentence", () => {
  expect(recapSentence("solved", 3, 7)).toBe("You solved 3 challenges in the last 7 days.");
  expect(recapSentence("solved", 1, 3)).toBe("You solved 1 challenge in the last 3 days.");
  expect(recapSentence("self_solved", 1, 7)).toBe("You solved 1 without a hint.");
  expect(recapSentence("solved", 2, 1)).toBe("You solved 2 challenges in the last 1 day.");
  expect(recapSentence("recoveries", 0, 7)).toBe("You fixed 0 errors on your own.");
  expect(recapSentence("recalls", 1, 7)).toBe("You passed 1 recall.");
  expect(recapSentence("active_days", 4, 7)).toBe("You practised on 4 of the last 7 days.");
});
