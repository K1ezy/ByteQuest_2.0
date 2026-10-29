"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import { useSignOut } from "@/hooks/use-sign-out";
import type { Profile } from "@/lib/types";

export interface SiteHeaderProps {
  isAuthenticated?: boolean;
}

export function SiteHeader({ isAuthenticated }: SiteHeaderProps) {
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const { isSigningOut, error: signOutError, signOut } = useSignOut();
  const hidden = (pathname === "/onboarding" && !isAuthenticated) || pathname === "/quests" ||
    pathname === "/faculty" || pathname.startsWith("/faculty/") ||
    pathname === "/admin" || pathname.startsWith("/admin/");

  useEffect(() => {
    if (hidden) return;
    let active = true;
    const loadProfile = async () => {
      try {
        const { data } = await getSupabase().auth.getSession();
        if (!active) return;
        if (!data.session) { setProfile(null); return; }
        const current = await apiRequest<Profile>("/profile/me");
        if (active) setProfile(current);
      } catch {
        if (active) setProfile(null);
      }
    };
    void loadProfile();
    return () => { active = false; };
  }, [hidden, pathname]);

  useEffect(() => {
    if (!accountOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountOpen]);

  // The authenticated onboarding page renders its own header instance.
  if (hidden) {
    return null;
  }

  return (
    <header className="site-header-redesign">
      <div className="site-header-container">
        <Link
          href="/"
          className="brand-link"
          aria-label="ByteQuest home"
          data-tooltip="Go to the ByteQuest home page."
        >
          <span className="brand-icon-box">
            <Image
              src="/branding/ByteQuest_websitelogo.svg"
              alt="ByteQuest logo"
              width={28}
              height={28}
              priority
            />
          </span>
          <span className="brand-wordmark">
            ByteQuest<span className="brand-dot">.</span>
          </span>
        </Link>

        <div className="site-header-actions">
          <nav aria-label="Main Navigation" className="top-nav-links">
            <Link
              href="/dashboard"
              className={`top-nav-item ${pathname === "/dashboard" ? "active" : ""}`}
              aria-current={pathname === "/dashboard" ? "page" : undefined}
            >
              Dashboard
            </Link>
            <Link
              href="/quests"
              className="top-nav-item"
            >
              Quest map
            </Link>
            <Link
              href="/exams"
              className={`top-nav-item ${pathname.startsWith("/exams") ? "active" : ""}`}
              aria-current={pathname.startsWith("/exams") ? "page" : undefined}
            >
              Exams
            </Link>
            <Link href="/quests?view=leaderboard" className="top-nav-item">
              Leaderboard
            </Link>
          </nav>
          {profile && (
            <div className="ws-account" ref={accountRef}>
              <button
                type="button"
                className="qm-avatar ws-avatar-button"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                aria-label={`Account menu for ${profile.display_name || profile.pseudonym_id}`}
                onClick={() => setAccountOpen((open) => !open)}
              >
                {(profile.display_name || profile.pseudonym_id).slice(0, 1).toUpperCase()}
              </button>
              {accountOpen && (
                <div className="ws-account-menu" role="menu">
                  <div className="ws-account-identity">
                    <strong>{profile.display_name || profile.pseudonym_id}</strong>
                    <span>{profile.role === "admin" ? "Administrator" : profile.role === "instructor" ? "Faculty" : "Student"}</span>
                  </div>
                  <Link role="menuitem" href="/quests?view=accessibility" onClick={() => setAccountOpen(false)}>Accessibility settings</Link>
                  <Link role="menuitem" href="/quests" onClick={() => setAccountOpen(false)}>Student Quest Map</Link>
                  <button role="menuitem" type="button" disabled={isSigningOut} onClick={() => void signOut()}>
                    {isSigningOut ? "Signing out…" : "Sign out"}
                  </button>
                  {signOutError && <p className="ws-account-error" role="alert">{signOutError}</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
