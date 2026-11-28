/**
 * Takeaways: the one sentence above a chart or metric that says what it shows (GLOSSARY.md).
 * Fixed rules, never AI-written, so the same data always gives the same sentence.
 */

/** Fewer values than this and we say so instead of describing a trend. */
export const MIN_SAMPLE = 5;
/** A change smaller than this many percentage points reads as steady. */
const CHANGE_POINTS = 5;

export function notEnoughData(count: number): string {
  return `Not enough data yet — based on ${count}.`;
}

/** Compare the latest half of the values with the earliest half: rising, falling or steady. */
export function trendTakeaway(values: number[], subject: string): string {
  if (values.length < MIN_SAMPLE) return notEnoughData(values.length);
  const half = Math.floor(values.length / 2);
  const mean = (xs: number[]) => xs.reduce((sum, x) => sum + x, 0) / xs.length;
  const change = Math.round(mean(values.slice(-half)) - mean(values.slice(0, half)));
  if (change >= CHANGE_POINTS) return `${subject} are rising (up about ${change} points).`;
  if (change <= -CHANGE_POINTS) return `${subject} are falling (down about ${-change} points).`;
  return `${subject} are steady.`;
}

/** "1 activity", "3 activities". */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Headline for Activities passed: value, total and what is left. */
export function activitiesPassedSentence(passed: number, total: number, language?: string): string {
  if (total === 0) return "Your workshops haven't shared an activity yet.";
  const where = language ? ` in ${language}` : "";
  const left = total - passed;
  return `You passed ${passed} of ${plural(total, "activity", "activities")}${where}.`
    + (left > 0 ? ` ${left} more ${left === 1 ? "is" : "are"} open.` : " Every activity is passed.");
}

/** Headline for First-try passes, out of the activities already passed. */
export function firstTrySentence(firstTry: number, passed: number): string {
  if (passed === 0) return "Pass an activity to see how many go through on the first try.";
  return `${firstTry} of the ${plural(passed, "activity", "activities")} you passed went through on the first try.`;
}

/** Title of the student's first-try chart: how many of the latest eight passed, then the trend. */
export function firstTryHeadline(tries: { score: number; passed: boolean }[]): string {
  if (!tries.length) return "Your first tries will appear here once you attempt an activity.";
  const latest = tries.slice(-8);
  const passed = latest.filter((t) => t.passed).length;
  return `${passed} of your last ${plural(latest.length, "first try", "first tries")} passed. `
    + trendTakeaway(latest.map((t) => t.score), "Your first-try scores");
}

/** The sentence that leads each Dashboard recap item: what the student did in the period. */
export function recapSentence(
  key: "solved" | "self_solved" | "recoveries" | "recalls" | "active_days", count: number, days: number,
): string {
  switch (key) {
    case "solved": return `You solved ${plural(count, "challenge", "challenges")} in the last ${plural(days, "day", "days")}.`;
    case "self_solved": return `You solved ${count} without a hint.`;
    case "recoveries": return `You fixed ${plural(count, "error", "errors")} on your own.`;
    case "recalls": return `You passed ${plural(count, "recall", "recalls")}.`;
    case "active_days": return `You practised on ${count} of the last ${plural(days, "day", "days")}.`;
  }
}
