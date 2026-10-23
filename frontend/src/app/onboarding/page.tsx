"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { apiRequest, getErrorMessage } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import type { Profile, ProgrammingLanguage } from "@/lib/types";

export default function OnboardingPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [language, setLanguage] = useState<ProgrammingLanguage>("python");
  const [yearLevel, setYearLevel] = useState("1");
  const [semester, setSemester] = useState("1");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) setProfile(null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    let active = true;
    void apiRequest<Profile>("/profile/me")
      .then((value) => { if (active) { setProfile(value); setLanguage(value.enrolled_language); setYearLevel(String(value.year_level)); setSemester(String(value.semester)); } })
      .catch((error: unknown) => { if (active) { setIsError(true); setMessage(getErrorMessage(error)); } });
    return () => { active = false; };
  }, [session]);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(""); setIsError(false);
    try {
      const supabase = getSupabase();
      const result = authMode === "signup"
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      if (authMode === "signup" && !result.data.session) {
        setMessage("Check your email to confirm the account, then sign in. Local email messages appear in Supabase Inbucket.");
      } else if (result.data.session) {
        setSession(result.data.session);
        setMessage("Account ready. Choose your learning track to continue.");
      }
    } catch (error) {
      setIsError(true); setMessage(getErrorMessage(error));
    } finally { setBusy(false); }
  }

  async function completeOnboarding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(""); setIsError(false);
    try {
      const value = await apiRequest<Profile>("/profile/onboarding", {
        method: "PUT",
        body: JSON.stringify({ enrolled_language: language, year_level: Number(yearLevel), semester: Number(semester) }),
      });
      setProfile(value);
      if (value.role === "instructor" || value.role === "admin") router.push("/instructor");
      else router.push("/quests");
    } catch (error) {
      setIsError(true); setMessage(getErrorMessage(error));
    } finally { setBusy(false); }
  }

  async function signOut() {
    await getSupabase().auth.signOut();
    setSession(null); setProfile(null); setMessage("You have signed out.");
  }

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div><p className="eyebrow-label">YOUR BYTEQUEST ACCOUNT</p><h1>{session ? "Choose your learning track" : authMode === "signup" ? "Create your account" : "Welcome back"}</h1><p>Save your progress and open your programming quest map.</p></div>
        {profile && <span className="role-pill">{profile.role} · level {profile.current_level}</span>}
      </div>
      {loadingSession ? <div className="panel">Checking your sign-in…</div> : !session ? (
        <section className="panel" style={{ maxWidth: 520 }}>
          <div className="step-line"><span>1</span> ACCOUNT</div>
          <form className="stack" onSubmit={handleAuth}>
            <div className="field"><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.edu" /></div>
            <div className="field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete={authMode === "signup" ? "new-password" : "current-password"} minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" /></div>
            <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Please wait…" : authMode === "signup" ? "Create account" : "Sign in"}</button>
          </form>
          <p className="auth-switch">{authMode === "signup" ? "Already have an account? " : "New to ByteQuest? "}<button className="text-button" onClick={() => { setAuthMode(authMode === "signup" ? "login" : "signup"); setMessage(""); }} type="button">{authMode === "signup" ? "Sign in" : "Create an account"}</button></p>
          {message && <p className={`notice ${isError ? "error" : ""}`} role="status">{message}</p>}
        </section>
      ) : (
        <div className="two-column">
          <section className="panel">
            <div className="step-line"><span>2</span> LEARNING TRACK</div>
            <p className="panel-subtitle">Signed in as <strong>{session.user.email}</strong>. Choose the language and term you are studying.</p>
            {profile?.role !== "student" && profile && <p className="notice">This account has instructor access. <Link href="/instructor"><strong>Open instructor studio →</strong></Link></p>}
            <form onSubmit={completeOnboarding}>
              <div className="form-grid">
                <div className="field full"><label htmlFor="language">Programming language</label><select id="language" value={language} onChange={(e) => setLanguage(e.target.value as ProgrammingLanguage)}><option value="python">Python</option><option value="cpp">C++</option><option value="java">Java</option></select></div>
                <div className="field"><label htmlFor="year">Year level</label><select id="year" value={yearLevel} onChange={(e) => setYearLevel(e.target.value)}>{[1,2,3,4].map((year) => <option key={year} value={year}>Year {year}</option>)}</select></div>
                <div className="field"><label htmlFor="semester">Semester</label><select id="semester" value={semester} onChange={(e) => setSemester(e.target.value)}><option value="1">Semester 1</option><option value="2">Semester 2</option></select></div>
              </div>
              <div className="form-actions"><button className="button button-primary" type="submit" disabled={busy || !profile}>{busy ? "Saving…" : "Save and open quests"}</button><button className="button button-quiet" type="button" onClick={signOut}>Sign out</button></div>
            </form>
            {message && <p className={`notice ${isError ? "error" : ""}`} role="status">{message}</p>}
          </section>
          <aside className="stack"><div className="callout"><h3>Made for your course</h3><p>Your language choice determines which instructor-approved activities appear on your quest map.</p></div><div className="callout"><h3>Your profile stays private</h3><p>The leaderboard uses a generated pseudonym. Your email and name are not shown there.</p></div></aside>
        </div>
      )}
    </div>
  );
}
