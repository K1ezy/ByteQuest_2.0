"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in frontend/.env.local."
    );
  }

  // Remove legacy drafts without a user ID and old persistent auth tokens.
  // Account-scoped offline drafts must survive a browser restart until synced.
  if (typeof window !== "undefined") {
    try {
      for (const key of Object.keys(window.localStorage)) {
        if (
          /^bytequest:draft:[0-9a-f-]{36}$/i.test(key) ||
          /^sb-.*-auth-token$/.test(key)
        ) {
          window.localStorage.removeItem(key);
        }
      }
    } catch {
      /* Storage may be blocked. */
    }
  }

  client = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage:
        typeof window !== "undefined" ? window.sessionStorage : undefined,
    },
  });
  return client;
}

/**
 * Deterministically resolves the authenticated user ID from Supabase Auth.
 * Never relies on optional user_id fields in backend exam payloads.
 */
export async function resolveAuthenticatedUserId(): Promise<string | null> {
  try {
    const sb = getSupabase();
    const { data: sessionData } = await sb.auth.getSession();
    if (sessionData?.session?.user?.id) {
      return sessionData.session.user.id;
    }
    const { data: userData } = await sb.auth.getUser();
    return userData?.user?.id ?? null;
  } catch {
    return null;
  }
}

export interface UnsyncedExamSnapshot {
  userId: string;
  attemptId: string;
  baseRevision: number;
  editSeq: number;
  updatedAtClientIso: string;
  answers: Record<string, string | Record<string, string>>;
}

const EXAM_SESSION_PREFIX = "bytequest:exam-unsynced:";
const MAX_SNAPSHOT_BYTES = 256 * 1024; // 256 KB safety bound

export function getExamSessionKey(userId: string, attemptId: string): string {
  return `${EXAM_SESSION_PREFIX}${userId}:${attemptId}`;
}

/**
 * Canonical order-independent comparison of question->answer maps.
 * Handles both code strings and quiz option dictionaries.
 */
export function areExamAnswersCanonicallyEqual(
  a: Record<string, string | Record<string, string>> | undefined | null,
  b: Record<string, string | Record<string, string>> | undefined | null
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;

  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of allKeys) {
    const valA = a[key];
    const valB = b[key];

    if (valA === undefined && valB === undefined) continue;
    if (valA === undefined || valB === undefined) return false;

    if (
      typeof valA === "object" &&
      valA !== null &&
      typeof valB === "object" &&
      valB !== null
    ) {
      const subKeys = new Set([...Object.keys(valA), ...Object.keys(valB)]);
      for (const subKey of subKeys) {
        if ((valA[subKey] ?? "") !== (valB[subKey] ?? "")) {
          return false;
        }
      }
    } else {
      if ((valA ?? "") !== (valB ?? "")) {
        return false;
      }
    }
  }
  return true;
}

export function writeUnsyncedExamSnapshot(
  snapshot: UnsyncedExamSnapshot
): boolean {
  if (typeof window === "undefined" || !snapshot.userId || !snapshot.attemptId) {
    return false;
  }
  try {
    const serialized = JSON.stringify(snapshot);
    if (serialized.length > MAX_SNAPSHOT_BYTES) {
      return false;
    }
    window.sessionStorage.setItem(
      getExamSessionKey(snapshot.userId, snapshot.attemptId),
      serialized
    );
    return true;
  } catch {
    return false;
  }
}

export function readUnsyncedExamSnapshot(
  userId: string,
  attemptId: string
): UnsyncedExamSnapshot | null {
  if (typeof window === "undefined" || !userId || !attemptId) return null;
  const key = getExamSessionKey(userId, attemptId);
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UnsyncedExamSnapshot;
    if (
      parsed.userId !== userId ||
      parsed.attemptId !== attemptId ||
      typeof parsed.baseRevision !== "number" ||
      typeof parsed.editSeq !== "number" ||
      typeof parsed.answers !== "object" ||
      parsed.answers === null
    ) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Attempt-scoped removal: removes ONLY this specific attempt's snapshot,
 * preserving any other active exam attempts in the same browser session.
 */
export function clearUnsyncedExamSnapshot(
  userId: string,
  attemptId: string
): void {
  if (typeof window === "undefined" || !userId || !attemptId) return;
  try {
    window.sessionStorage.removeItem(getExamSessionKey(userId, attemptId));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Watermark-protected cleanup after a server save confirmation:
 * - Clears ONLY if the stored snapshot's editSeq is <= confirmedEditSeq AND
 *   its answers canonically match confirmedAnswers (strict conjunctive check).
 * - If a newer edit exists in sessionStorage (current.editSeq > confirmedEditSeq),
 *   preserves the newer edit and advances its baseRevision to confirmedServerRevision.
 */
export function clearUnsyncedExamSnapshotIfMatched(
  userId: string,
  attemptId: string,
  confirmedEditSeq: number,
  confirmedAnswers: Record<string, string | Record<string, string>>,
  confirmedServerRevision?: number
): boolean {
  if (typeof window === "undefined" || !userId || !attemptId) return false;
  const current = readUnsyncedExamSnapshot(userId, attemptId);
  if (!current) return true;

  const isNotNewerSeq = current.editSeq <= confirmedEditSeq;
  const isSameContent = areExamAnswersCanonicallyEqual(
    current.answers,
    confirmedAnswers
  );

  // Strict conjunctive check: an older save response can NEVER delete a newer edit
  if (isNotNewerSeq && isSameContent) {
    clearUnsyncedExamSnapshot(userId, attemptId);
    return true;
  }

  // A newer edit was typed while the save was in flight; rebase its baseRevision
  if (
    typeof confirmedServerRevision === "number" &&
    confirmedServerRevision > current.baseRevision
  ) {
    writeUnsyncedExamSnapshot({
      ...current,
      baseRevision: confirmedServerRevision,
    });
  }
  return false;
}

/**
 * Global purge reserved STRICTLY for shared-computer sign-out.
 * Never call this from individual exam attempt submission or expiry handlers.
 */
export function purgeAllExamSessionSnapshots(): void {
  if (typeof window === "undefined") return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (
        k &&
        (k.startsWith(EXAM_SESSION_PREFIX) || k.startsWith("bytequest:exam-"))
      ) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => window.sessionStorage.removeItem(k));
  } catch {
    /* Storage may be blocked. */
  }
}

/**
 * Classroom Shared-Computer Safe Sign-Out
 * Purges auth session, all local/session code drafts, and offline queues.
 * Non-sensitive accessibility preferences are device settings, so they are
 * preserved across account switches.
 */
const PRESERVED_LOCAL_PREFERENCES = new Set([
  "bytequest:a11y-contrast",
  "bytequest:a11y-font",
  "bytequest:a11y-scale",
  "bytequest:a11y-motion",
]);

export function clearSharedComputerData(): void {
  if (typeof window === "undefined") return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || PRESERVED_LOCAL_PREFERENCES.has(key)) continue;
      if (
        key.startsWith("bytequest:") ||
        key.startsWith("draft:") ||
        key.startsWith("exam:") ||
        key.startsWith("sb-")
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => window.localStorage.removeItem(key));
    purgeAllExamSessionSnapshots();
    window.sessionStorage.clear();
  } catch {
    /* Storage may be blocked. */
  }

  // Reset in-memory user scopes even if the provider sign-out request failed.
  try {
    window.dispatchEvent(new Event("bytequest:auth-cleared"));
  } catch {
    /* Event dispatch is best-effort. */
  }
}

export async function signOutSharedComputer(router?: {
  replace: (url: string) => void;
}): Promise<void> {
  try {
    const sb = getSupabase();
    await sb.auth.signOut({ scope: "local" });
  } catch (err) {
    console.warn("Sign-out error", err);
  } finally {
    clearSharedComputerData();
    client = undefined;
    if (router && typeof router.replace === "function") {
      router.replace("/onboarding");
    } else if (typeof window !== "undefined") {
      window.location.replace("/onboarding");
    }
  }
}
