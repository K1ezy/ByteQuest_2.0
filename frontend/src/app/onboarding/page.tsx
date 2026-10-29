"use client";

import React, { useState, useId, useEffect, FormEvent, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { SiteHeader } from "@/components/site-header";
import { apiRequest, getAuthErrorMessage, getErrorMessage } from "@/lib/api";
import { clearSharedComputerData, getSupabase } from "@/lib/supabase";
import { usePasswordReset } from "@/hooks/use-password-reset";
import type { Profile, ProgrammingLanguage } from "@/lib/types";
import { LegalModal } from "@/components/legal-modal";
import type { LegalKind } from "@/components/legal-document";

type AuthMode = "signin" | "signup" | "reset-request" | "reset-update";

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

/**
 * Directive #5: Consistent, robust, WCAG 2.2 AA compliant Password Reveal Input
 */
function PasswordInput({ label, id, ...props }: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div>
      <label
        htmlFor={inputId}
        className="block text-xs font-bold text-slate-800 mb-1.5"
      >
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          {...props}
          id={inputId}
          type={showPassword ? "text" : "password"}
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-12 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#156046] focus:outline-none"
        />
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setShowPassword((prev) => !prev);
          }}
          aria-pressed={showPassword}
          aria-label={showPassword ? "Hide password" : "Show password"}
          data-tooltip={showPassword ? "Hide the password characters." : "Show the password characters."}
          className="auth-password-toggle absolute right-1.5 flex h-9 w-9 min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-slate-500 transition hover:text-slate-800"
        >
          {showPassword ? (
            /* Eye Off SVG */
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          ) : (
            /* Eye SVG */
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f7f9f7] flex items-center justify-center p-6">
          <div className="text-slate-500 font-medium text-sm" role="status">
            Loading sign-in…
          </div>
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const isChangeTrackMode = searchParams.get("mode") === "change_track";
  const isInstructorMode = searchParams.get("mode") === "instructor";
  const isRecoveryMode = searchParams.get("mode") === "reset";
  const isResetSuccess = searchParams.get("reset") === "success";
  const emailEnabled = process.env.NEXT_PUBLIC_EMAIL_ENABLED === "true";

  // Toggle between unauthenticated Auth view and post-login Learning Track view
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>(isRecoveryMode ? "reset-update" : isInstructorMode || isResetSuccess ? "signin" : "signup");
  const [legalKind, setLegalKind] = useState<LegalKind | null>(null);

  // Authentication & session states
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [, setProfile] = useState<Profile | null>(null);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  // Supabase Auth recovery link flow
  const {
    isLoading: isResetLoading,
    error: resetError,
    statusMessage: resetStatusMessage,
    setError: setResetError,
    setStatusMessage: setResetStatusMessage,
    requestResetLink,
    updatePassword,
  } = usePasswordReset();

  // Learning Track states
  const [languageTrack, setLanguageTrack] = useState<ProgrammingLanguage>("python");
  const [yearLevel, setYearLevel] = useState("1");
  const [semester, setSemester] = useState("1");

  // Initial Auth & Session Synchronization
  useEffect(() => {
    let active = true;
    const supabase = getSupabase();

    async function checkExistingAuth() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (data.session && active) {
          setSession(data.session);
          if (isRecoveryMode) {
            setAuthMode("reset-update");
            return;
          }
          if (data.session.user.email) {
            setEmail(data.session.user.email);
          }

          try {
            const userProfile = await apiRequest<Profile>("/profile/me");
            if (active) {
              setProfile(userProfile);
              if (userProfile.enrolled_language) {
                setLanguageTrack(userProfile.enrolled_language);
              }
              if (userProfile.year_level) {
                setYearLevel(String(userProfile.year_level));
              }
              if (userProfile.semester) {
                setSemester(String(userProfile.semester));
              }

              // Directive #8: Returning students with saved tracks bypass onboarding unless explicitly changing track
              if (userProfile.enrolled_language && !isChangeTrackMode) {
                if (userProfile.role === "instructor" || userProfile.role === "admin") {
                  router.replace(userProfile.role === "admin" ? "/admin" : "/faculty");
                  return;
                }
                router.replace("/dashboard");
                return;
              }

              if ((userProfile.role === "instructor" || userProfile.role === "admin") && !isChangeTrackMode) {
                router.replace(userProfile.role === "admin" ? "/admin" : "/faculty");
                return;
              }

              setIsAuthenticated(true);
            }
          } catch {
            if (active) {
              setIsAuthenticated(true);
            }
          }
        }
      } catch {
        // Remain on unauthenticated auth screen
      } finally {
        if (active) {
          setLoadingSession(false);
        }
      }
    }

    void checkExistingAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") setAuthMode("reset-update");
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setIsAuthenticated(false);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [router, isChangeTrackMode, isRecoveryMode]);

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setIsError(false);
    setBusy(true);

    try {
      const supabase = getSupabase();
      const trimmedEmail = email.trim();
      const result =
        authMode === "signup"
          ? await supabase.auth.signUp({ email: trimmedEmail, password })
          : await supabase.auth.signInWithPassword({ email: trimmedEmail, password });

      if (result.error) throw result.error;

      if (authMode === "signup" && !result.data.session) {
        setStatusMessage("Check your email to confirm the account, then sign in. Local emails appear in Supabase Inbucket.");
        setAuthMode("signin");
        return;
      }

      if (result.data.session) {
        setSession(result.data.session);

        // Directive #8: If returning student already has saved learning track, redirect immediately
        try {
          const userProfile = await apiRequest<Profile>("/profile/me");
          setProfile(userProfile);
          if (userProfile.enrolled_language) {
            setLanguageTrack(userProfile.enrolled_language);
          }
          if (userProfile.year_level) {
            setYearLevel(String(userProfile.year_level));
          }
          if (userProfile.semester) {
            setSemester(String(userProfile.semester));
          }

          if (userProfile.role === "instructor" || userProfile.role === "admin") {
            router.push(userProfile.role === "admin" ? "/admin" : "/faculty");
            return;
          }

          if (userProfile.enrolled_language && !isChangeTrackMode) {
            router.push("/dashboard");
            return;
          }
        } catch {
          // If profile fetch fails or first-time student, proceed to track selection
        }

        setIsAuthenticated(true);
      }
    } catch (err) {
      setIsError(true);
      setStatusMessage(getAuthErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSendResetCode = async (e: FormEvent) => {
    e.preventDefault();
    await requestResetLink(email.trim());
  };

  const handleVerifyReset = async (e: FormEvent) => {
    e.preventDefault();
    const success = await updatePassword(newPassword);
    if (success) {
      setPassword("");
      setNewPassword("");
      router.replace("/onboarding?mode=signin&reset=success");
      setAuthMode("signin");
    }
  };

  const handleSaveTrack = async (e: FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setIsError(false);
    setBusy(true);

    try {
      const value = await apiRequest<Profile>("/profile/onboarding", {
        method: "PUT",
        body: JSON.stringify({
          enrolled_language: languageTrack,
          year_level: Number(yearLevel),
          semester: Number(semester),
        }),
      });
      setProfile(value);
      if (value.role === "instructor" || value.role === "admin") {
        router.push(value.role === "admin" ? "/admin" : "/faculty");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setIsError(true);
      setStatusMessage(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    setStatusMessage(null);
    setIsError(false);

    try {
      const { error } = await getSupabase().auth.signOut({ scope: "local" });
      if (error) throw error;
      clearSharedComputerData();
      setSession(null);
      setProfile(null);
      setIsAuthenticated(false);
      setPassword("");
      setStatusMessage("You have signed out.");
      setAuthMode("signin");
    } catch (err) {
      setIsError(true);
      setStatusMessage(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-[#f7f9f7] flex items-center justify-center p-6">
        <div className="text-slate-500 font-medium text-sm" role="status">
          Checking your sign-in…
        </div>
      </div>
    );
  }

  // Active feedback messages
  const isResetFlow = authMode === "reset-request" || authMode === "reset-update";
  const displayStatus = isResetSuccess
    ? "Password updated successfully. Please sign in with your new password."
    : isResetFlow
    ? resetStatusMessage
    : (!isError ? statusMessage : null);
  const displayError = isResetFlow ? resetError : (isError ? statusMessage : null);

  return (
    <div className="min-h-screen bg-[#f7f9f7] flex flex-col">
      {/* Directive #1: Top navigation bar is ONLY shown after logging in */}
      {isAuthenticated && <SiteHeader isAuthenticated={true} />}

      <main
        id="main-content"
        className="flex flex-1 flex-col items-center justify-center px-4 py-10"
      >
        {!isAuthenticated ? (
          /* ================= AUTHENTICATION VIEW (No Top Navbar) ================= */
          <div className="w-full max-w-md">
            {/* Minimal centered brand identity (Hick's Law) */}
            <div className="auth-brand-header mb-6 flex flex-col items-center text-center">
              <Link href="/" className="auth-brand-link" aria-label="ByteQuest home" data-tooltip="Go to the ByteQuest home page.">
                <Image
                  src="/branding/ByteQuest_title.svg"
                  width={340}
                  height={75}
                  alt="ByteQuest"
                  priority
                  className="auth-brand-logo"
                />
              </Link>

              <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900${authMode === "signup" ? " auth-signup-title" : ""}`}>
                {authMode === "signup" && "Create your account"}
                {authMode === "signin" && "Welcome back"}
                {(authMode === "reset-request" || authMode === "reset-update") && "Reset your password"}
              </h1>
              {authMode !== "signup" && (
                <p className="mt-1.5 text-sm text-slate-600">
                  {authMode === "signin" && "Sign in to continue your programming quest map."}
                  {authMode === "reset-request" && "Enter your email to receive a secure recovery link."}
                  {authMode === "reset-update" && "Choose a new password for your account."}
                </p>
              )}
            </div>

            <div className="auth-form-card rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-sm">
              {/* Dynamic accessible feedback banner */}
              {(displayStatus || displayError) && (
                <div
                  role="status"
                  aria-live="polite"
                  className={`mb-4 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
                    displayError
                      ? "border-rose-200 bg-rose-50/80 text-rose-700"
                      : "border-emerald-200 bg-emerald-50/70 text-[#156046]"
                  }`}
                >
                  {displayError || displayStatus}
                </div>
              )}

              {/* Sign Up / Sign In Form */}
              {(authMode === "signup" || authMode === "signin") && (
                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="auth-email"
                      className="block text-xs font-bold text-slate-800 mb-1.5"
                    >
                      Email address
                    </label>
                    <input
                      id="auth-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.edu"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#156046] focus:outline-none"
                    />
                  </div>

                  <PasswordInput
                    label="Password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                    placeholder="At least 6 characters"
                  />

                  <button
                    type="submit"
                    disabled={busy}
                    className="auth-primary-button w-full rounded-xl py-3 text-sm font-bold text-white shadow-xs transition disabled:opacity-60"
                  >
                    {busy ? "Please wait…" : authMode === "signup" ? "Create account" : "Sign in"}
                  </button>

                  {/* Mode Switcher */}
                  <div className="space-y-2 pt-1 text-center text-xs text-slate-600">
                    {authMode === "signup" ? (
                      <p>
                        Already have an account?{" "}
                        <button
                          type="button"
                          onClick={() => {
                            setStatusMessage(null);
                            setIsError(false);
                            setResetError(null);
                            setResetStatusMessage(null);
                            setAuthMode("signin");
                          }}
                          className="auth-text-action auth-purple-action"
                        >
                          Sign in here
                        </button>
                      </p>
                    ) : (
                      <p>
                        Need a student account?{" "}
                        <button
                          type="button"
                          onClick={() => {
                            setStatusMessage(null);
                            setIsError(false);
                            setResetError(null);
                            setResetStatusMessage(null);
                            setAuthMode("signup");
                          }}
                          className="auth-text-action auth-purple-action"
                        >
                          Create account
                        </button>
                      </p>
                    )}
                    {authMode === "signup" && (
                      <p>
                        Forgot password?{" "}
                        <button
                          type="button"
                          onClick={() => {
                            setStatusMessage(null);
                            setIsError(false);
                            setResetError(null);
                            setResetStatusMessage(null);
                            setAuthMode("reset-request");
                          }}
                          className="auth-text-action auth-purple-action"
                        >
                          Reset it here
                        </button>
                      </p>
                    )}
                  </div>

                  {/* Directives #2 & #3: Terms of Service & Privacy Policy Notice */}
                  <p className="auth-legal-copy border-t border-slate-100 pt-3.5 text-center text-[11px] leading-relaxed text-slate-500">
                    By creating an account, I accept the{" "}
                    <button type="button" onClick={() => setLegalKind("terms")}
                      className="auth-text-action auth-purple-action">
                      Terms of Service
                    </button>{" "}
                    and{" "}
                    <button type="button" onClick={() => setLegalKind("privacy")}
                      className="auth-text-action auth-purple-action">
                      Privacy Policy
                    </button>{" "}
                    of ByteQuest.
                  </p>
                </form>
              )}

              {/* Directive #4 (Step 1): Request Verification Code by Email */}
              {authMode === "reset-request" && (
                <form onSubmit={handleSendResetCode} className="space-y-4">
                  {!emailEnabled && (
                    <div
                      role="status"
                      className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 leading-relaxed"
                    >
                      <p className="font-bold">Classroom Pilot Notice (Email Offline)</p>
                      <p className="mt-1">
                        Institutional outbound email delivery is currently disabled. If you need to reset your password, please request a temporary reset code or credential reset directly from your instructor.
                      </p>
                    </div>
                  )}
                  <div>
                    <label
                      htmlFor="reset-email"
                      className="block text-xs font-bold text-slate-800 mb-1.5"
                    >
                      Registered email address
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.edu"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#156046] focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isResetLoading}
                    className="w-full rounded-xl bg-[#156046] py-3 text-sm font-bold text-white shadow-xs transition hover:bg-[#114f39] disabled:opacity-60"
                  >
                    {isResetLoading ? "Sending link…" : "Send recovery link"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setResetError(null);
                      setResetStatusMessage(null);
                      setAuthMode("signin");
                    }}
                    className="auth-text-action auth-purple-action auth-back-action text-xs"
                  >
                    ← Back to sign in
                  </button>
                </form>
              )}

              {/* Password recovery link returns here with a Supabase recovery session. */}
              {authMode === "reset-update" && (
                <form onSubmit={handleVerifyReset} className="space-y-4">
                  <PasswordInput
                    label="New password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="At least 6 characters"
                  />

                  <button
                    type="submit"
                    disabled={isResetLoading}
                    className="w-full rounded-xl bg-[#156046] py-3 text-sm font-bold text-white shadow-xs transition hover:bg-[#114f39] disabled:opacity-60"
                  >
                    {isResetLoading ? "Updating password…" : "Update password"}
                  </button>
                </form>
              )}
            </div>
          </div>
        ) : (
          /* ================= LEARNING TRACK VIEW (Post-Login) ================= */
          <div className="w-full max-w-md">
            {/* Directive #6: Removed "YOUR BYTEQUEST ACCOUNT" eyebrow text */}
            <div className="mb-6 text-center">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Choose your learning track
              </h1>
              <p className="mt-1.5 text-sm text-slate-600">
                Signed in as{" "}
                <span className="font-semibold text-slate-900">
                  {session?.user?.email || email || "student@example.edu"}
                </span>
                . Select your course language and academic term to configure your quest map.
              </p>
            </div>

            <form
              onSubmit={handleSaveTrack}
              className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-sm space-y-5"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#156046] text-[11px] font-bold text-white">
                  2
                </span>
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Learning Track
                </span>
              </div>

              {statusMessage && (
                <div
                  role="status"
                  aria-live="polite"
                  className={`rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
                    isError
                      ? "border-rose-200 bg-rose-50/80 text-rose-700"
                      : "border-emerald-200 bg-emerald-50/70 text-[#156046]"
                  }`}
                >
                  {statusMessage}
                </div>
              )}

              {/* Directive #9: Removed programming language helper description below select */}
              <div>
                <label
                  htmlFor="language-track"
                  className="block text-xs font-bold text-slate-800 mb-1.5"
                >
                  Programming language track
                </label>
                <select
                  id="language-track"
                  value={languageTrack}
                  onChange={(e) => setLanguageTrack(e.target.value as ProgrammingLanguage)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-[#156046] focus:outline-none"
                >
                  <option value="python">Python — General &amp; Data Science</option>
                  <option value="cpp">C++ — Systems &amp; Algorithms</option>
                  <option value="java">Java — Object-Oriented Programming</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="year-level"
                    className="block text-xs font-bold text-slate-800 mb-1.5"
                  >
                    Year level
                  </label>
                  <select
                    id="year-level"
                    value={yearLevel}
                    onChange={(e) => setYearLevel(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-[#156046] focus:outline-none"
                  >
                    <option value="1">Year 1</option>
                    <option value="2">Year 2</option>
                    <option value="3">Year 3</option>
                    <option value="4">Year 4</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="semester"
                    className="block text-xs font-bold text-slate-800 mb-1.5"
                  >
                    Semester
                  </label>
                  <select
                    id="semester"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-[#156046] focus:outline-none"
                  >
                    <option value="1">Semester 1</option>
                    <option value="2">Semester 2</option>
                  </select>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-xs">
                <p className="font-bold text-slate-800">
                  <span className="text-[#156046]">✦</span> Private &amp; course-aligned
                </p>
                <p className="mt-1 leading-relaxed text-slate-600">
                  Quests are matched to your curriculum. Your leaderboard identity
                  uses a pseudonym so your progress remains private.
                </p>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-[#156046] py-3 text-sm font-bold text-white shadow-xs transition hover:bg-[#114f39] disabled:opacity-60"
              >
                {busy ? "Saving track…" : "Save and open quests →"}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={busy}
                  className="text-xs font-medium text-slate-600 hover:text-rose-600"
                >
                  Sign out of {session?.user?.email || email || "account"}
                </button>
              </div>

              {/* Directive #7: Removed "Account ready. Choose your learning track to continue." banner */}
            </form>
          </div>
        )}
      </main>
      {legalKind && <LegalModal kind={legalKind} onClose={() => setLegalKind(null)} />}
    </div>
  );
}
