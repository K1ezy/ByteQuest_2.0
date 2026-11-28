"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ApiError, getErrorMessage } from "@/lib/api";
import { StatusChip } from "@/components/workspace/ui";
import { useToast } from "@/components/toast";
import { formatDate, updateMyAcademicDetails, updateMyProfile } from "@/lib/workspace";
import { languageList } from "@/components/workshops/workshop-ui";
import { isValidHandle, suggestHandle } from "@/lib/username";
import type { Profile } from "@/lib/types";

export const ROLE_LABEL: Record<Profile["role"], string> = {
  student: "Student",
  instructor: "Instructor",
  admin: "Administrator",
};

const BIO_MAX = 500;

interface Draft {
  name: string;
  handle: string;
  bio: string;
  yearLevel: number;
  semester: number;
}

function draftFrom(profile: Profile): Draft {
  return {
    name: profile.display_name ?? "",
    // A generated starter handle is never shown or re-saved; the field starts empty.
    handle: profile.handle_chosen === false ? "" : profile.username,
    bio: profile.bio ?? "",
    yearLevel: profile.year_level || 1,
    semester: profile.semester || 1,
  };
}

function pendingChanges(profile: Profile, draft: Draft) {
  const base = draftFrom(profile);
  const identity: { display_name?: string; bio?: string; username?: string } = {};
  if (draft.name.trim() !== base.name.trim()) identity.display_name = draft.name.trim();
  if (draft.bio.trim() !== base.bio.trim()) identity.bio = draft.bio.trim();
  const handle = draft.handle.trim().toLowerCase();
  if (handle && handle !== base.handle) identity.username = handle;
  const academicChanged = profile.role === "student" && (draft.yearLevel !== base.yearLevel || draft.semester !== base.semester);
  return { identity, academicChanged };
}

function handleProblem(profile: Profile, value: string): string {
  if (!value.trim()) {
    return profile.handle_chosen === false ? "" : `Enter a handle, or cancel to keep @${profile.username}.`;
  }
  return isValidHandle(value) ? "" : "Use 3–44 letters only, with no numbers, spaces or symbols.";
}

export function ProfileHeader({ profile, avatar, onUpdated, editOnOpen }: {
  profile: Profile;
  avatar: ReactNode;
  onUpdated: (profile: Profile) => void;
  editOnOpen?: "handle" | "track";
}) {
  const toast = useToast();
  const id = useId();
  const [editing, setEditing] = useState<"name" | "handle" | "track" | null>(editOnOpen ?? null);
  const [lastEditRequest, setLastEditRequest] = useState(editOnOpen);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(profile));
  const [saving, setSaving] = useState(false);
  const [handleTouched, setHandleTouched] = useState(false);
  const [serverHandleError, setServerHandleError] = useState("");
  const [formError, setFormError] = useState("");
  const editButton = useRef<HTMLButtonElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const handleInput = useRef<HTMLInputElement>(null);
  const firstFieldInput = useRef<HTMLSelectElement>(null);
  const restoreFocus = useRef(false);

  if (lastEditRequest !== editOnOpen) {
    setLastEditRequest(editOnOpen);
    if (editOnOpen) {
      setDraft(draftFrom(profile));
      setHandleTouched(false);
      setServerHandleError("");
      setFormError("");
      setEditing(editOnOpen);
    }
  }

  const student = profile.role === "student";
  const hasHandle = profile.handle_chosen !== false;
  const suggestedHandle = suggestHandle(profile.display_name);
  const name = profile.display_name?.trim() ?? "";
  const bio = profile.bio?.trim() ?? "";
  const memberSince = profile.created_at ? formatDate(profile.created_at) : null;
  const languages = languageList(profile.workshop_languages);

  const { identity, academicChanged } = pendingChanges(profile, draft);
  const dirty = Object.keys(identity).length > 0 || academicChanged;
  const handleError = serverHandleError || (handleTouched ? handleProblem(profile, draft.handle) : "");

  useEffect(() => {
    if (editing) (editing === "track" ? firstFieldInput : editing === "handle" ? handleInput : nameInput).current?.focus();
    else if (restoreFocus.current) {
      restoreFocus.current = false;
      editButton.current?.focus();
    }
  }, [editing]);

  const open = () => {
    setDraft(draftFrom(profile));
    setHandleTouched(false);
    setServerHandleError("");
    setFormError("");
    setEditing("name");
  };

  const close = () => {
    restoreFocus.current = true;
    setEditing(null);
  };

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setFormError("");
    if (key === "handle") setServerHandleError("");
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || !dirty) return;
    setHandleTouched(true);
    if (handleProblem(profile, draft.handle)) {
      handleInput.current?.focus();
      return;
    }
    setSaving(true);
    setFormError("");
    let latest = profile;
    try {
      if (Object.keys(identity).length) {
        try {
          latest = await updateMyProfile(identity);
        } catch (caught) {
          if (identity.username && caught instanceof ApiError && (caught.status === 409 || caught.status === 422)) {
            setServerHandleError(caught.status === 409 ? "That handle is already taken. Try another." : getErrorMessage(caught));
            handleInput.current?.focus();
          } else {
            setFormError(getErrorMessage(caught));
          }
          return;
        }
        onUpdated(latest);
      }
      if (academicChanged) {
        try {
          latest = await updateMyAcademicDetails({ year_level: draft.yearLevel, semester: draft.semester });
        } catch (caught) {
          // The identity request above is already committed, so only the academic details are left pending here.
          setFormError(`${Object.keys(identity).length ? "Your details were saved, but your year and semester were not" : "Your year and semester were not saved"}: ${getErrorMessage(caught)}`);
          return;
        }
        onUpdated(latest);
      }
      toast.show("Profile updated", "success");
      close();
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="profile-header ws-panel" aria-labelledby={`${id}-title`}>
      {avatar}
      <div className="profile-header-main">
        {editing ? (
          <form
            className="profile-edit-form"
            aria-labelledby={`${id}-title`}
            noValidate
            onSubmit={(event) => void save(event)}
            onKeyDown={(event) => { if (event.key === "Escape" && !saving) close(); }}
          >
            <h1 id={`${id}-title`} className="profile-edit-title">Edit profile</h1>
            <div className="ws-form-grid">
              <div className="ws-field">
                <label htmlFor={`${id}-name`}>Name</label>
                <input
                  id={`${id}-name`}
                  ref={nameInput}
                  value={draft.name}
                  maxLength={120}
                  autoComplete="name"
                  placeholder="Your name"
                  disabled={saving}
                  aria-describedby={`${id}-name-hint`}
                  onChange={(event) => update("name", event.target.value)}
                />
                <p id={`${id}-name-hint`} className="ws-muted">
                  {student ? "Visible to you and your instructors. Never shown on the leaderboard." : "How you appear across ByteQuest."}
                </p>
              </div>

              <div className="ws-field">
                <label htmlFor={`${id}-handle`}>Public handle</label>
                <div className="profile-handle-input" data-invalid={Boolean(handleError) || undefined}>
                  <span aria-hidden="true">@</span>
                  <input
                    id={`${id}-handle`}
                    ref={handleInput}
                    value={draft.handle}
                    maxLength={44}
                    autoCapitalize="none"
                    autoComplete="username"
                    spellCheck={false}
                    placeholder="Choose a handle"
                    disabled={saving}
                    aria-invalid={Boolean(handleError)}
                    aria-describedby={`${id}-handle-hint`}
                    onChange={(event) => update("handle", event.target.value)}
                    onBlur={() => setHandleTouched(true)}
                  />
                </div>
                {handleError ? (
                  <p id={`${id}-handle-hint`} className="ws-field-error" role="alert">{handleError}</p>
                ) : (
                  <p id={`${id}-handle-hint`} className="ws-muted">
                    {student ? "Public: classmates see it on the leaderboard. " : ""}3–44 letters.
                  </p>
                )}
                {!draft.handle.trim() && suggestedHandle ? (
                  <button
                    type="button"
                    className="profile-handle-suggestion"
                    disabled={saving}
                    onClick={() => { update("handle", suggestedHandle); handleInput.current?.focus(); }}
                  >
                    Use @{suggestedHandle}
                  </button>
                ) : null}
              </div>

              <div className="ws-field full">
                <label htmlFor={`${id}-bio`}>Bio <span className="profile-optional">optional</span></label>
                <textarea
                  id={`${id}-bio`}
                  value={draft.bio}
                  rows={3}
                  maxLength={BIO_MAX}
                  placeholder="A short line about you, like what you want to learn."
                  disabled={saving}
                  aria-describedby={`${id}-bio-count`}
                  onChange={(event) => update("bio", event.target.value)}
                />
                <p id={`${id}-bio-count`} className="ws-muted profile-bio-count">{draft.bio.length}/{BIO_MAX}</p>
              </div>

              {student ? (
                <fieldset className="ws-field full profile-track-fieldset">
                  <legend>Academic details</legend>
                  <div className="profile-track-grid">
                    <label className="ws-field">
                      <span>Year level</span>
                      <select ref={firstFieldInput} value={draft.yearLevel} disabled={saving} onChange={(event) => update("yearLevel", Number(event.target.value))}>
                        {[1, 2, 3, 4].map((value) => <option key={value} value={value}>Year {value}</option>)}
                      </select>
                    </label>
                    <label className="ws-field">
                      <span>Semester</span>
                      <select value={draft.semester} disabled={saving} onChange={(event) => update("semester", Number(event.target.value))}>
                        {[1, 2].map((value) => <option key={value} value={value}>Semester {value}</option>)}
                      </select>
                    </label>
                  </div>
                  <p className="ws-muted">Your languages come from the workshops you join.</p>
                </fieldset>
              ) : null}
            </div>

            {formError ? <p className="notice error" role="alert">{formError}</p> : null}
            <div className="profile-edit-actions">
              <button type="submit" className="button button-primary" disabled={saving || !dirty} aria-busy={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button type="button" className="button button-quiet" disabled={saving} onClick={close}>Cancel</button>
              <span className="ws-muted">{dirty ? "You have unsaved changes." : "No changes yet."}</span>
            </div>
          </form>
        ) : (
          <>
            <div className="profile-header-top">
              <div className="profile-title-group">
                <h1 id={`${id}-title`}>{name || (hasHandle ? `@${profile.username}` : "Your profile")}</h1>
                <StatusChip
                  state={profile.role}
                  label={ROLE_LABEL[profile.role]}
                  tone={profile.role === "admin" ? "muted" : profile.role === "instructor" ? "info" : "good"}
                />
              </div>
              <button ref={editButton} type="button" className="button button-outline small profile-edit-trigger" onClick={open}>
                <span aria-hidden="true">✎</span> Edit profile
              </button>
            </div>

            <p className="profile-header-meta">
              {hasHandle ? <><span className="profile-handle">@{profile.username}</span>{memberSince ? " · " : null}</> : null}
              {memberSince ? <>Member since {memberSince}</> : null}
            </p>
            {bio ? <p className="profile-bio">{bio}</p> : null}
            {student ? (
              <p className="profile-header-meta">
                {languages ? `${languages} · ` : ""}Year {profile.year_level} · Semester {profile.semester}
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
