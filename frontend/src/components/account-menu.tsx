"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { UserAvatar } from "@/components/user-avatar";
import { useSignOut } from "@/hooks/use-sign-out";
import { roleLabels } from "@/lib/navigation";
import type { Profile } from "@/lib/types";

/** Below this width the menu opens as a bottom sheet, within thumb reach. */
const SHEET_QUERY = "(max-width: 850px)";

/**
 * The account button in the top bar. It opens a dropdown on wide screens and a bottom
 * sheet on phones. Unlike the native <details> element it replaced, it closes when the
 * user taps outside it, presses Escape, or picks an item.
 */
export function AccountMenu({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const { signOut, isSigningOut, error } = useSignOut();
  const handle = profile.username ? "@" + profile.username : "";
  const name = profile.display_name?.trim() || handle || roleLabels[profile.role];
  const seed = profile.pseudonym_id || profile.id || profile.username || "bytequest";

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    // A bottom sheet is modal on a phone: keep the page behind it from scrolling.
    const isSheet = window.matchMedia?.(SHEET_QUERY).matches ?? false;
    const previousOverflow = document.body.style.overflow;
    if (isSheet) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      if (isSheet) document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const close = () => setOpen(false);

  return <div className="bq-account" ref={rootRef}>
    <button ref={triggerRef} type="button" className="bq-account-trigger" aria-label="Account"
      aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => setOpen((value) => !value)}
      data-tooltip={open ? undefined : "Open your profile, accessibility settings, or sign out."}>
      <UserAvatar seed={seed} name={name} url={profile.avatar_url} />
      <span className="bq-account-trigger-label" aria-hidden="true">Account</span>
      <svg className="bq-account-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    {open && <>
      <div className="bq-account-backdrop" aria-hidden="true" onClick={close} />
      <div id={panelId} className="bq-account-actions" role="region" aria-label="Account">
        <span className="bq-sheet-handle" aria-hidden="true" />
        <div className="bq-account-identity">
          <UserAvatar seed={seed} name={name} url={profile.avatar_url} />
          <div>
            <strong>{name}</strong>
            {handle && handle !== name && <span>{handle}</span>}
          </div>
        </div>
        <div className="bq-account-context">
          {profile.role === "student" && profile.enrolled_language && <span className="tag">{profile.enrolled_language.toUpperCase()}</span>}
          <span className="tag">{roleLabels[profile.role]}</span>
        </div>
        <Link href="/profile" onClick={close}>Profile</Link>
        <Link href="/account/accessibility" onClick={close}>Accessibility</Link>
        <button type="button" className="bq-account-signout" disabled={isSigningOut} onClick={() => void signOut()}>
          {isSigningOut ? "Signing out…" : "Sign out"}
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
    </>}
  </div>;
}
