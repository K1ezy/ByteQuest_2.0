import assert from "node:assert/strict";
import {
  writeUnsyncedExamSnapshot,
  readUnsyncedExamSnapshot,
  clearUnsyncedExamSnapshot,
  clearUnsyncedExamSnapshotIfMatched,
  purgeAllExamSessionSnapshots,
  clearSharedComputerData,
} from "../src/lib/supabase.ts";

const storageMap = new Map();
const mockSessionStorage = {
  getItem: (key) => storageMap.get(key) ?? null,
  setItem: (key, value) => storageMap.set(key, value),
  removeItem: (key) => storageMap.delete(key),
  clear: () => storageMap.clear(),
  get length() {
    return storageMap.size;
  },
  key: (index) => Array.from(storageMap.keys())[index] ?? null,
};
const localMap = new Map();
const mockLocalStorage = {
  getItem: (key) => localMap.get(key) ?? null,
  setItem: (key, value) => localMap.set(key, value),
  removeItem: (key) => localMap.delete(key),
  clear: () => localMap.clear(),
  get length() { return localMap.size; },
  key: (index) => Array.from(localMap.keys())[index] ?? null,
};

globalThis.window = { sessionStorage: mockSessionStorage, localStorage: mockLocalStorage };

console.log("Running ByteQuest Exam Recovery Hardening Invariant Checks...");

const userId = "stu_user_123";
const attemptA = "attempt_alpha";
const attemptB = "attempt_beta";

// Invariant 1
storageMap.clear();
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

clearUnsyncedExamSnapshot(userId, attemptA);
assert.strictEqual(readUnsyncedExamSnapshot(userId, attemptA), null);
assert.strictEqual(readUnsyncedExamSnapshot(userId, attemptB)?.answers.q1, "print('exam B unsaved')");
console.log("✔ Invariant 1 Passed: Attempt-scoped cleanup removes only finished attempt and preserves other active attempts.");

// Invariant 2
storageMap.clear();
writeUnsyncedExamSnapshot({
  userId,
  attemptId: attemptA,
  baseRevision: 1,
  editSeq: 2,
  updatedAtClientIso: new Date().toISOString(),
  answers: { q1: "print(12)" },
});

const cleared = clearUnsyncedExamSnapshotIfMatched(
  userId,
  attemptA,
  1,
  { q1: "print(1)" },
  2
);

assert.strictEqual(cleared, false);
const remaining = readUnsyncedExamSnapshot(userId, attemptA);
assert.notStrictEqual(remaining, null);
assert.strictEqual(remaining?.answers.q1, "print(12)");
assert.strictEqual(remaining?.baseRevision, 2);
console.log("✔ Invariant 2 Passed: Older in-flight save acknowledgment cannot erase newer unsynced edit (baseRevision rebases).");

// Invariant 3
storageMap.clear();
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
assert.strictEqual(readUnsyncedExamSnapshot(userId, attemptA), null);
assert.strictEqual(readUnsyncedExamSnapshot(userId, attemptB), null);
console.log("✔ Invariant 3 Passed: Shared-computer sign-out purges all exam snapshots across all attempts.");

// Invariant 4: a shared-computer sign-out clears Auth and draft backups.
localMap.set("bytequest:draft:user:activity", "private code");
localMap.set("sb-local-auth-token", "private session");
localMap.set("unrelated-preference", "keep");
storageMap.set("sb-local-auth-token", "private session");
clearSharedComputerData();
assert.strictEqual(localMap.has("bytequest:draft:user:activity"), false);
assert.strictEqual(localMap.has("sb-local-auth-token"), false);
assert.strictEqual(storageMap.size, 0);
assert.strictEqual(localMap.get("unrelated-preference"), "keep");
console.log("✔ Invariant 4 Passed: Shared-computer sign-out removes local Auth and draft data.");

console.log("All 4 recovery hardening invariants verified successfully!");

