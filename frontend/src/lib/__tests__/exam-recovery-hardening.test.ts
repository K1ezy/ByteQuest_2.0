import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  writeUnsyncedExamSnapshot,
  readUnsyncedExamSnapshot,
  clearUnsyncedExamSnapshot,
  clearUnsyncedExamSnapshotIfMatched,
  purgeAllExamSessionSnapshots,
} from "../supabase";

// Mock window.sessionStorage for headless execution
const storageMap = new Map<string, string>();
const mockSessionStorage = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, value: string) => storageMap.set(key, value),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
  get length() {
    return storageMap.size;
  },
  key: (index: number) => Array.from(storageMap.keys())[index] ?? null,
};

Object.defineProperty(globalThis, "window", {
  value: {
    sessionStorage: mockSessionStorage,
  },
  writable: true,
  configurable: true,
});

function expect<T>(actual: T) {
  return {
    toBe: (expected: T) => assert.strictEqual(actual, expected),
    toBeNull: () => assert.strictEqual(actual, null),
    not: {
      toBeNull: () => assert.notStrictEqual(actual, null),
    },
  };
}

describe("ByteQuest Exam Recovery Hardening", () => {
  const userId = "stu_user_123";
  const attemptA = "attempt_alpha";
  const attemptB = "attempt_beta";

  beforeEach(() => {
    window.sessionStorage.clear();
  });

  test("1. Attempt-scoped cleanup removes only the finished attempt and preserves other active attempts", () => {
    writeUnsyncedExamSnapshot({
      userId,
      attemptId: attemptA,
      baseRevision: 1,
      editSeq: 2,
      updatedAtClientIso: new Date().toISOString(),
      answers: { q1: "print('exam A')" },
    });

    writeUnsyncedExamSnapshot({
      userId,
      attemptId: attemptB,
      baseRevision: 4,
      editSeq: 5,
      updatedAtClientIso: new Date().toISOString(),
      answers: { q1: "print('exam B unsaved')" },
    });

    // Finish or expire Attempt A: removes ONLY attempt A's snapshot
    clearUnsyncedExamSnapshot(userId, attemptA);

    expect(readUnsyncedExamSnapshot(userId, attemptA)).toBeNull();
    const snapB = readUnsyncedExamSnapshot(userId, attemptB);
    expect(snapB?.answers.q1).toBe("print('exam B unsaved')");
  });

  test("2. Older in-flight save acknowledgment cannot erase newer unsynced edit", () => {
    // Save #1 was dispatched at editSeq=1 with "print(1)"
    // While Save #1 was in flight, student typed editSeq=2 with "print(12)"
    writeUnsyncedExamSnapshot({
      userId,
      attemptId: attemptA,
      baseRevision: 1,
      editSeq: 2,
      updatedAtClientIso: new Date().toISOString(),
      answers: { q1: "print(12)" },
    });

    // Save #1 returns from server confirming editSeq=1 and revision=2
    const cleared = clearUnsyncedExamSnapshotIfMatched(
      userId,
      attemptA,
      1,
      { q1: "print(1)" },
      2
    );

    expect(cleared).toBe(false);
    const remaining = readUnsyncedExamSnapshot(userId, attemptA);
    expect(remaining).not.toBeNull();
    expect(remaining?.answers.q1).toBe("print(12)");
    // Base revision advances to 2 so the follow-up save uses expected_revision=2
    expect(remaining?.baseRevision).toBe(2);
  });

  test("3. Shared-computer sign-out purges all exam snapshots across all attempts", () => {
    writeUnsyncedExamSnapshot({
      userId,
      attemptId: attemptA,
      baseRevision: 1,
      editSeq: 1,
      updatedAtClientIso: new Date().toISOString(),
      answers: { q1: "a" },
    });
    writeUnsyncedExamSnapshot({
      userId,
      attemptId: attemptB,
      baseRevision: 1,
      editSeq: 1,
      updatedAtClientIso: new Date().toISOString(),
      answers: { q1: "b" },
    });

    purgeAllExamSessionSnapshots();

    expect(readUnsyncedExamSnapshot(userId, attemptA)).toBeNull();
    expect(readUnsyncedExamSnapshot(userId, attemptB)).toBeNull();
  });
});
