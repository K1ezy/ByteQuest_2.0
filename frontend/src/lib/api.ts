"use client";

import { getSupabase } from "@/lib/supabase";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: unknown;
  public readonly retryAfterSeconds?: number;

  constructor(message: string, status: number, code?: string, details?: unknown, retryAfterSeconds?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function formatApiErrorDetail(detail: unknown): string | null {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (!Array.isArray(detail)) return null;

  const messages = detail
    .map((item) => {
      if (typeof item !== "object" || item === null) return null;
      const error = item as { loc?: unknown; msg?: unknown };
      const location = Array.isArray(error.loc)
        ? error.loc.filter((part): part is string | number => typeof part === "string" || typeof part === "number")
        : [];
      const field = location.filter((part) => part !== "body" && part !== "query").join(".");
      const message = typeof error.msg === "string" ? error.msg : "Invalid value.";
      return field ? `${field}: ${message}` : message;
    })
    .filter((message): message is string => Boolean(message));

  return messages.length ? messages.slice(0, 3).join(" ") : null;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!apiBaseUrl) throw new Error("Set NEXT_PUBLIC_API_URL in frontend/.env.local.");

  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw new Error(error.message);
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session has expired. Sign in again to continue.");

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch (cause) {
    if (cause instanceof ApiError) throw cause;
    throw new ApiError(
      "The ByteQuest API is unavailable. Start the local backend and try again.",
      0,
      "network_error",
      cause
    );
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const payload = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
    const detail = payload && "detail" in payload ? payload.detail : null;
    let detailMsg: string | null = null;
    let errorCode: string | undefined;

    if (typeof detail === "string") {
      detailMsg = detail;
    } else if (Array.isArray(detail)) {
      detailMsg = formatApiErrorDetail(detail);
    } else if (typeof detail === "object" && detail !== null) {
      if ("message" in detail && typeof (detail as { message?: unknown }).message === "string") {
        detailMsg = (detail as { message: string }).message;
      }
      if ("code" in detail && typeof (detail as { code?: unknown }).code === "string") {
        errorCode = (detail as { code: string }).code;
      }
    }

    if (!detailMsg && payload && "error" in payload && typeof payload.error === "string") {
      detailMsg = payload.error;
    }
    if (!errorCode && payload && "code" in payload && typeof payload.code === "string") {
      errorCode = payload.code;
    }

    const retryHeader = response.headers.get("Retry-After");
    const retryValue = retryHeader === null ? NaN : Number(retryHeader);
    const retryAfterSeconds = Number.isFinite(retryValue) && retryValue > 0 ? Math.ceil(retryValue) : undefined;
    const message = detailMsg ?? (response.status === 429 && retryAfterSeconds
      ? `Limit reached. Try again in ${retryAfterSeconds} seconds.`
      : `Request failed (${response.status}).`);
    throw new ApiError(message, response.status, errorCode, body, retryAfterSeconds);
  }
  return body as T;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export function getAuthErrorMessage(error: unknown): string {
  const message = getErrorMessage(error);
  if (/failed to fetch|fetch failed|networkerror|network request failed|load failed/i.test(message)) {
    return "ByteQuest could not reach local Supabase authentication. Make sure Docker Desktop is running, run `supabase start` from the project folder, then refresh and try again.";
  }
  return message;
}
