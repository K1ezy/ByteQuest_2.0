"use client";

import React, { useState, useId, useEffect, useRef, FormEvent, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import type { Session } from "@supabase/auth-js";
import { AppShell } from "@/components/app-shell";
import { destinationFor } from "@/components/home-redirect";
import { authReturnTo, roleLabels } from "@/lib/navigation";
import { apiRequest, getAuthErrorMessage, getErrorMessage } from "@/lib/api";
import { clearSharedComputerData, getSupabase } from "@/lib/supabase";
import { checkStudentSignup, signUpStudent } from "@/lib/student-signup";
import { formatStudentSchoolId, STUDENT_SCHOOL_ID_ERROR, STUDENT_SCHOOL_ID_PATTERN } from "@/lib/school-id";
import { usePasswordReset } from "@/hooks/use-password-reset";
import type { Profile, ProgrammingLanguage } from "@/lib/types";
import { SignupAgreement } from "@/components/signup-agreement";

type AuthMode = "choices" | "signin" | "roles" | "signup" | "faculty-info" | "admin-info" | "agreement" | "reset-request" | "reset-update";

function SchoolIdInput({ value, onChange, student = false }: { value: string; onChange: (value: string) => void; student?: boolean }) {
  return (
    <div>
      <label htmlFor="auth-school-id" className="auth-label">School ID</label>
      <input id="auth-school-id" className="auth-input" type="text" required maxLength={student ? 8 : 64}
        pattern={student ? STUDENT_SCHOOL_ID_PATTERN : ".*\\S.*"}
        inputMode={student ? "numeric" : undefined}
        aria-describedby={student ? "auth-school-id-help" : undefined}
        title={student ? STUDENT_SCHOOL_ID_ERROR : undefined}
        value={value} onChange={(event) => {
          const next = student ? formatStudentSchoolId(event.target.value) : event.target.value;
          if (next !== null) onChange(next);
        }} />
      {student && <p id="auth-school-id-help" className="auth-field-help">
        Use the School ID you received when you enrolled, for example 26-00001.
      </p>}
    </div>
  );
}

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
        className="auth-label"
      >
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          {...props}
          id={inputId}
          type={showPassword ? "text" : "password"}
          className="auth-input auth-input-password"
        />
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setShowPassword((prev) => !prev);
          }}
          aria-pressed={showPassword}
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="auth-password-toggle absolute flex items-center justify-center text-slate-500 transition hover:text-slate-800"
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

  const returnTo = searchParams.get("redirect");
  const isChangeTrackMode = searchParams.get("mode") === "change_track";
  const isInstructorMode = searchParams.get("mode") === "instructor";
  const isSignInMode = searchParams.get("mode") === "signin";
  const isRecoveryMode = searchParams.get("mode") === "reset";
  const isInviteMode = searchParams.get("mode") === "invite";
  const isResetSuccess = searchParams.get("reset") === "success";
  const emailEnabled = process.env.NEXT_PUBLIC_EMAIL_ENABLED === "true";

  // Toggle between unauthenticated Auth view and post-login Learning Track view
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>(isRecoveryMode || isInviteMode ? "reset-update" : isInstructorMode || isSignInMode || isResetSuccess ? "signin" : "choices");
  const authHeading = useRef<HTMLHeadingElement>(null);
  const focusNextScreen = useRef(false);
  const authPending = useRef(false);

  // Authentication & session states
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Form states
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [signupYear, setSignupYear] = useState("");
  const [blockSection, setBlockSection] = useState("");
  const [registrationRole, setRegistrationRole] = useState<"student" | "instructor">("student");
  const staffSelfSignup = process.env.NEXT_PUBLIC_LOCAL_STAFF_REGISTRATION === "true";
  const [inviteRole, setInviteRole] = useState<Profile["role"] | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [signupEmailExists, setSignupEmailExists] = useState(false);
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
          if (isRecoveryMode || isInviteMode) {
            setAuthMode("reset-update");
            if (isInviteMode) {
              try {
                const invitedProfile = await apiRequest<Profile>("/profile/me");
                if (active) setInviteRole(invitedProfile.role);
              } catch (error) {
                if (active) setResetError(getErrorMessage(error));
              }
            }
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

              if (isChangeTrackMode && userProfile.role !== "student") return;
              if (userProfile.role !== "student" || (!userProfile.needs_track_setup && !isChangeTrackMode)) {
                router.replace(authReturnTo(userProfile, returnTo) ?? destinationFor(userProfile));
                return;
              }

              setIsAuthenticated(true);
            }
          } catch (error) {
            if (active) {
              setIsError(true);
              setStatusMessage(getErrorMessage(error));
              setAuthMode("signin");
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
  }, [router, isChangeTrackMode, isRecoveryMode, isInviteMode, setResetError, returnTo]);

  function changeAuthMode(mode: AuthMode) {
    setStatusMessage(null);
    setIsError(false);
    setResetError(null);
    setResetStatusMessage(null);
    if (mode !== "agreement" && !(authMode === "agreement" && mode === "signup")) setPassword("");
    focusNextScreen.current = true;
    setAuthMode(mode);
  }

  useEffect(() => {
    if (focusNextScreen.current) {
      authHeading.current?.focus();
      focusNextScreen.current = false;
    }
  }, [authMode]);

  const registration = {
    schoolId, yearLevel: Number(signupYear), blockSection,
    ...(registrationRole === "student" ? {} : { role: registrationRole }),
  };

  const handleAuthSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (authMode === "signup") void continueToAgreement();
    if (authMode === "signin") void authenticate(false);
  };

  // A taken or unapproved School ID, or a taken username, is reported here instead of after the Terms.
  async function continueToAgreement() {
    if (authPending.current) return;
    authPending.current = true;
    setStatusMessage(null);
    setIsError(false);
    setBusy(true);
    try {
      await checkStudentSignup(email, password, username, registration);
      changeAuthMode("agreement");
    } catch (error) {
      setIsError(true);
      setStatusMessage(getAuthErrorMessage(error));
    } finally {
      authPending.current = false;
      setBusy(false);
    }
  }

  async function authenticate(createAccount: boolean, research = false) {
    if (authPending.current) return;
    authPending.current = true;
    setStatusMessage(null);
    setIsError(false);
    setSignupEmailExists(false);
    setBusy(true);

    try {
      const supabase = getSupabase();
      const trimmedEmail = email.trim();
      const result =
        createAccount
          ? await signUpStudent(trimmedEmail, password, username, { ...registration, research })
          : await supabase.auth.signInWithPassword({ email: trimmedEmail, password });

      if (result.error) throw result.error;

      if (createAccount && !result.data.session) {
        changeAuthMode("signin");
        setStatusMessage("Check your email to confirm the account, then sign in. Local emails appear in Supabase Inbucket.");
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

          if (isChangeTrackMode && userProfile.role !== "student") return;
          if (userProfile.role !== "student" || (!userProfile.needs_track_setup && !isChangeTrackMode)) {
            router.push(authReturnTo(userProfile, returnTo) ?? destinationFor(userProfile));
            return;
          }
        } catch (error) {
          changeAuthMode("signin");
          setIsError(true);
          setStatusMessage(getErrorMessage(error));
          return;
        }

        setIsAuthenticated(true);
      }
    } catch (err) {
      const existingEmail = createAccount && typeof err === "object" && err !== null && "code" in err
        && (err.code === "user_already_exists" || err.code === "email_exists");
      setSignupEmailExists(existingEmail);
      setIsError(true);
      setStatusMessage(existingEmail ? "An account already uses this email. Sign in or reset your password to continue." : getAuthErrorMessage(err));
    } finally {
      authPending.current = false;
      setBusy(false);
    }
  }

  const handleSendResetCode = async (e: FormEvent) => {
    e.preventDefault();
    await requestResetLink(email.trim());
  };

  const handleVerifyReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!session || (isInviteMode && !inviteRole) || authPending.current) return;
    authPending.current = true;
    setBusy(true);
    try {
      if (isInviteMode && inviteRole !== "student") {
        setResetError(null);
        await apiRequest<void>("/profile/staff-setup", {
          method: "PUT", body: JSON.stringify({ school_id: schoolId.trim() }),
        });
      }
      await finishPasswordSetup();
    } catch (error) {
      setResetError(getErrorMessage(error));
    } finally {
      authPending.current = false;
      setBusy(false);
    }
  };

  async function finishPasswordSetup() {
    const success = await updatePassword(newPassword);
    if (success) {
      setPassword("");
      setNewPassword("");
      router.replace("/onboarding?mode=signin&reset=success");
      setAuthMode("signin");
    }
  }

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
      router.push(authReturnTo(value, returnTo) ?? destinationFor(value));
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

  if (isChangeTrackMode && profile && profile.role !== "student") {
    return (
      <AppShell profile={profile}>
        <section className="panel">
          <h1>Learning tracks are for students</h1>
          <p>You are signed in as an {roleLabels[profile.role]}.</p>
          <Link className="button button-primary" href={destinationFor(profile)}>Back to your workspace</Link>
        </section>
      </AppShell>
    );
  }

  // Active feedback messages
  const isResetFlow = authMode === "reset-request" || authMode === "reset-update";
  const isStaffInfo = authMode === "faculty-info" || authMode === "admin-info";
  const displayStatus = isResetSuccess && authMode === "signin" && !statusMessage
    ? "Password saved. Sign in with your new password."
    : isResetFlow
    ? resetStatusMessage
    : (!isError ? statusMessage : null);
  const displayError = isResetFlow ? resetError : (isError ? statusMessage : null);

  const content = (
    <div className={isAuthenticated ? "" : "auth-page"}>

      <div className="auth-stage" id={isAuthenticated ? undefined : "main-content"}>
        {!isAuthenticated ? (
          /* ================= AUTHENTICATION VIEW (No Top Navbar) ================= */
          <section className={`auth-form-card${authMode === "agreement" ? " auth-form-card-wide" : ""}`} aria-labelledby="auth-heading">
            <div className="auth-brand-header">
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

              <h1 id="auth-heading" ref={authHeading} tabIndex={-1}>
                {authMode === "choices" && "Welcome to ByteQuest"}
                {authMode === "agreement" && "Review the terms and privacy policy"}
                {(authMode === "roles" || authMode === "signup") && "Create your ByteQuest account"}
                {isStaffInfo && (authMode === "faculty-info" ? "Instructor account" : "Administrator account")}
                {authMode === "signin" && "Welcome back"}
                {isResetFlow && (isInviteMode && authMode === "reset-update" ? "Set your account password" : "Reset your password")}
              </h1>
              {authMode !== "agreement" && (
                <p className="mt-1.5 text-sm text-slate-600">
                  {authMode === "choices" && "Sign in or choose your role to get started."}
                  {authMode === "roles" && "Choose your role."}
                  {authMode === "signin" && "Use the email address associated with your account."}
                  {authMode === "signup" && "You’ll review the terms and privacy policy before creating your account."}
                  {authMode === "reset-request" && "Enter your email to receive a secure recovery link."}
                  {authMode === "reset-update" && (isInviteMode ? "Choose a password for your invited account." : "Choose a new password for your account.")}
                </p>
              )}
            </div>

            <div className="auth-card-body">
              {/* Dynamic accessible feedback banner */}
              {authMode !== "agreement" && (displayStatus || displayError) && (
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

              {authMode === "choices" && (
                <div className="auth-choice-actions">
                  <button type="button" onClick={() => changeAuthMode("signin")}
                    className="auth-action auth-primary-button">Sign in</button>
                  <button type="button" onClick={() => changeAuthMode("roles")}
                    className="auth-action auth-secondary-button">Sign up</button>
                  {!staffSelfSignup && <p className="auth-role-note">Instructor and administrators join by invitation and use the same sign-in.</p>}
                </div>
              )}

              {authMode === "roles" && (
                <div className="auth-choice-actions">
                  <button type="button" className="auth-action auth-secondary-button" onClick={() => { setRegistrationRole("student"); changeAuthMode("signup"); }}>Student</button>
                  <button type="button" className="auth-action auth-secondary-button" onClick={() => { setRegistrationRole("instructor"); changeAuthMode(staffSelfSignup ? "signup" : "faculty-info"); }}>Instructor</button>
                  <button type="button" className="auth-action auth-secondary-button" onClick={() => changeAuthMode("admin-info")}>Administrator</button>
                  <button type="button" className="auth-text-action auth-purple-action auth-back-action" onClick={() => changeAuthMode("choices")}>Back to menu</button>
                </div>
              )}

              {isStaffInfo && (
                <div className="auth-choice-actions">
                  <p>{authMode === "faculty-info"
                    ? "Give your institutional email and the course you’ll manage to your school’s ByteQuest administrator."
                    : "Give your work email to an existing ByteQuest administrator."}</p>
                  <p>Once your administrator sends the invitation, open the email and enter your School ID and a new password.</p>
                  {authMode === "admin-info" && staffSelfSignup && (
                    <p>For local setup, register as a student and run <code>infra/grant-local-instructor.ps1 -Role admin</code> with your signup email.</p>
                  )}
                  <button type="button" className="auth-action auth-primary-button" onClick={() => changeAuthMode("signin")}>Sign in</button>
                  <button type="button" className="auth-text-action auth-purple-action auth-back-action" onClick={() => changeAuthMode("roles")}>Back to roles</button>
                </div>
              )}

              {authMode === "agreement" && (
                <SignupAgreement busy={busy} error={displayError} onAgree={(research) => void authenticate(true, research)}
                  askResearch={registrationRole === "student"}
                  onDisagree={() => changeAuthMode("signup")}
                  recoveryActions={signupEmailExists && displayError ? <>
                    <button type="button" className="auth-text-action auth-purple-action" onClick={() => changeAuthMode("signin")}>Sign in</button>
                    <button type="button" className="auth-text-action auth-purple-action" onClick={() => changeAuthMode("reset-request")}>Reset password</button>
                  </> : null} />
              )}

              {(authMode === "signup" || authMode === "signin") && (
                <form key={authMode} onSubmit={handleAuthSubmit} className="space-y-4">
                  {authMode === "signup" && <div>
                    <label htmlFor="auth-username" className="auth-label">Username</label>
                    <input id="auth-username" type="text" required minLength={3} maxLength={44}
                      pattern="[A-Za-z]{3,44}" autoComplete="username" value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      aria-describedby="auth-username-help"
                      placeholder="Your public username"
                      className="auth-input" />
                    <p id="auth-username-help" className="auth-field-help">3–44 letters only. Your username is public and can be changed later.</p>
                  </div>}
                  <div>
                    <label
                      htmlFor="auth-email"
                      className="auth-label"
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
                      className="auth-input"
                    />
                  </div>

                  <PasswordInput
                    label="Password"
                    required
                    minLength={authMode === "signup" ? 8 : undefined}
                    aria-describedby={authMode === "signup" ? "auth-password-help" : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                  />
                  {authMode === "signup" && <p id="auth-password-help" className="auth-field-help">Use at least 8 characters.</p>}
                  {authMode === "signup" && <>
                    <SchoolIdInput value={schoolId} onChange={setSchoolId} student={registrationRole === "student"} />
                    {registrationRole === "student" && <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="signup-year" className="auth-label">Year level</label>
                        <select id="signup-year" required className="auth-input" value={signupYear} onChange={(event) => setSignupYear(event.target.value)}>
                          <option value="" disabled>Select year</option>
                          {[1, 2, 3, 4].map((year) => <option key={year} value={year}>Year {year}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="signup-block" className="auth-label">Block section</label>
                        <select id="signup-block" required className="auth-input" value={blockSection} onChange={(event) => setBlockSection(event.target.value)}>
                          <option value="" disabled>Select block</option>
                          {["A", "B", "C", "D", "E", "F"].map((block) => <option key={block} value={block}>{block}</option>)}
                        </select>
                      </div>
                    </div>}
                  </>}

                  <button
                    type="submit"
                    disabled={busy}
                    className="auth-action auth-primary-button"
                  >
                    {busy ? (authMode === "signup" ? "Please wait…" : "Signing in…") : authMode === "signup" ? "Continue" : "Sign in"}
                  </button>

                  <div className="space-y-2 pt-1 text-center text-xs text-slate-600">
                    {authMode !== "signup" && <p>Forgot password?{" "}<button type="button" disabled={busy}
                      onClick={() => changeAuthMode("reset-request")} className="auth-text-action auth-purple-action">
                      Reset it here
                    </button></p>}
                    <button type="button" disabled={busy} onClick={() => changeAuthMode(authMode === "signup" ? "roles" : "choices")}
                      className="auth-text-action auth-purple-action auth-back-action">{authMode === "signup" ? "Back to roles" : "Back to menu"}</button>
                  </div>
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
                      className="auth-label"
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
                      className="auth-input"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isResetLoading}
                    className="auth-action auth-primary-button"
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
                    className="auth-text-action auth-purple-action auth-back-action"
                  >
                    ← Back to sign in
                  </button>
                </form>
              )}

              {/* Password recovery link returns here with a Supabase recovery session. */}
              {authMode === "reset-update" && (
                <form onSubmit={handleVerifyReset} className="space-y-4">
                  {isInviteMode && session?.user.email && <p className="auth-field-help">Invited email: {session.user.email}</p>}
                  {isInviteMode && inviteRole && inviteRole !== "student" && <SchoolIdInput value={schoolId} onChange={setSchoolId} />}
                  <PasswordInput
                    label="New password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                  />

                  {!session && <p role="status" className="auth-field-help">Open a valid {isInviteMode ? "invitation" : "password reset"} link from your email to continue.</p>}
                  <button
                    type="submit"
                    disabled={busy || isResetLoading || !session || (isInviteMode && !inviteRole)}
                    className="auth-action auth-primary-button"
                  >
                    {busy || isResetLoading ? "Saving…" : isInviteMode ? "Set password" : "Update password"}
                  </button>
                  {!session && <button type="button" onClick={() => changeAuthMode("signin")} className="auth-text-action auth-purple-action auth-back-action">Back to sign in</button>}
                </form>
              )}
            </div>
          </section>
        ) : (
          /* ================= LEARNING TRACK VIEW (Post-Login) ================= */
          <section className="auth-form-card" aria-labelledby="auth-track-heading">
            <div className="auth-brand-header">
              <h1 id="auth-track-heading">
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
              className="space-y-5"
            >

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
                  className="auth-label"
                >
                  Programming language track
                </label>
                <select
                  id="language-track"
                  value={languageTrack}
                  onChange={(e) => setLanguageTrack(e.target.value as ProgrammingLanguage)}
                  className="auth-input"
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
                    className="auth-label"
                  >
                    Year level
                  </label>
                  <select
                    id="year-level"
                    value={yearLevel}
                    onChange={(e) => setYearLevel(e.target.value)}
                    className="auth-input"
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
                    className="auth-label"
                  >
                    Semester
                  </label>
                  <select
                    id="semester"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="auth-input"
                  >
                    <option value="1">Semester 1</option>
                    <option value="2">Semester 2</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="auth-action auth-primary-button"
              >
                {busy ? "Saving track…" : "Save and open quests →"}
              </button>

              {isChangeTrackMode && <Link href="/dashboard" className="button button-outline">Cancel</Link>}
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
          </section>
        )}
      </div>
    </div>
  );
  return isAuthenticated && profile ? <AppShell profile={profile}>{content}</AppShell> : content;
}
