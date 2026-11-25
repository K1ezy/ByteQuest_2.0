"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useShellProfile } from "@/components/app-shell";
import { InstructorIcon, PageHeader } from "@/components/instructor/course-ui";
import { UserAvatar } from "@/components/user-avatar";
import { Button, useApi } from "@/components/workspace/ui";
import { ApiError, apiRequest } from "@/lib/api";
import { reachableServiceUrl } from "@/lib/network";
import { publishProfileUpdate } from "@/lib/profile-events";
import { roleLabels } from "@/lib/navigation";
import type { Workshop } from "@/lib/types";
import { classroomSummary, readClassroomDetails, WorkshopClassroomFields } from "./workshop-classroom-details";
import { WorkshopBanner, WorkshopDialog, WorkshopError, WorkshopForm, workshopDateTime, workshopLanguages } from "./workshop-ui";

function WorkshopGrid({ archived }: { archived: boolean }) {
  const { role } = useShellProfile();
  const { data, loading, error, reload } = useApi<Workshop[]>(archived ? "/workshops?archived=true" : "/workshops", true);
  if (loading) return <p className="workshop-panel" role="status">Loading workshops…</p>;
  if (error) return <WorkshopError message={error} retry={reload} />;
  if (!data?.length) return <section className="workshop-empty">
    <Image src="/illustrations/quest-scroll-purple.png" alt="" width={144} height={144} />
    <div>
      <h2>{archived ? "No archived workshops" : "No workshops yet"}</h2>
      {!archived && <p>{role === "student"
        ? "Ask your instructor for an invite code. Then choose Join Workshop above."
        : "Choose Create Workshop above to set up a practice space and get a code to share with students."}</p>}
    </div>
  </section>;

  const teaching = data.filter((item) => item.owned_by_me);
  const other = data.filter((item) => !item.owned_by_me);
  return <>{[
    { name: "Teaching", rows: teaching },
    { name: role === "admin" ? "Managed workshops" : "Joined", rows: other },
  ].map(({ name, rows }) => rows.length > 0 && <section className="workshop-list-section" key={name}>
    <h2>{name}</h2>
    <div className="workshop-grid">
      {rows.map((item, index) => {
        const classroom = classroomSummary(item);
        return <Link href={`/workshops/${item.id}`} className="workshop-card" key={item.id}>
          <div className="workshop-card-cover">
            <WorkshopBanner language={item.language} eager={index === 0}>
              <span className="workshop-language">{workshopLanguages[item.language]}</span>
            </WorkshopBanner>
            <span className="workshop-card-avatar" aria-hidden="true">
              <UserAvatar seed={item.owner_name} name={item.owner_name} loading="lazy"
                url={item.owner_avatar_url ? reachableServiceUrl(item.owner_avatar_url) : null} />
            </span>
          </div>
          <div className="workshop-card-copy">
            <h3>{item.name}</h3>
            <p>{item.owner_name}</p>
            {classroom && <p className="workshop-classroom-summary">{classroom}</p>}
            <p>{item.member_count} {item.member_count === 1 ? "member" : "members"} · {item.activity_ids.length} {item.activity_ids.length === 1 ? "activity" : "activities"}</p>
            {item.next_closes_at && <p>Next close <time dateTime={item.next_closes_at}>{workshopDateTime(item.next_closes_at)}</time></p>}
          </div>
        </Link>;
      })}
    </div>
  </section>)}</>;
}

function CreateWorkshop({ close }: { close: () => void }) {
  const profile = useShellProfile();
  const router = useRouter();

  return <WorkshopDialog title="Create Workshop" close={close} entry>
    <WorkshopForm className="workshop-entry-form" submitLabel="Create Workshop" busyLabel="Creating workshop…" close={close} onSubmit={async (fields) => {
      const name = String(fields.get("name") ?? "").trim();
      if (name.length < 3) throw new Error("Enter a workshop name with at least 3 characters.");
      const item = await apiRequest<Workshop>("/workshops", {
        method: "POST",
        body: JSON.stringify({ name, language: fields.get("language"), ...readClassroomDetails(fields) }),
      });
      close();
      router.push(`/workshops/${item.id}`);
    }}>
      <p className="workshop-entry-intro">Set up a practice space. ByteQuest creates the invite code when you save.</p>
      <div className="workshop-field">
        <label htmlFor="workshop-create-name">Workshop name</label>
        <input id="workshop-create-name" name="name" data-initial-focus required minLength={3} maxLength={80}
          placeholder="e.g. CS 414 Thesis Writing 1" aria-describedby="workshop-create-name-help" />
        <small id="workshop-create-name-help">Use a name students will recognize. 3–80 characters.</small>
      </div>
      <fieldset className="workshop-track-picker" aria-describedby="workshop-create-track-help">
        <legend>Programming language</legend>
        <div>
          {Object.entries(workshopLanguages).map(([id, label]) => <label key={id}>
            <input type="radio" name="language" value={id} required
              defaultChecked={profile.role === "student" && id === profile.enrolled_language} />
            {label}
          </label>)}
        </div>
        <small id="workshop-create-track-help">Students on this track can join and open the shared activities.</small>
      </fieldset>
      <WorkshopClassroomFields />
    </WorkshopForm>
  </WorkshopDialog>;
}

export function JoinWorkshopForm({ code = "", cancel }: { code?: string; cancel?: () => void }) {
  const profile = useShellProfile();
  const router = useRouter();
  const codeId = useId();
  const chooseLanguage = profile.role === "student" && !profile.enrolled_language;
  const [invalidCode, setInvalidCode] = useState(false);
  const [trackMismatch, setTrackMismatch] = useState(false);
  const displayName = profile.display_name?.trim();
  const handle = `@${profile.username}`;
  const close = cancel ?? (code ? () => router.push("/workshops") : undefined);

  return <WorkshopForm className="workshop-entry-form" submitLabel="Join Workshop" busyLabel="Joining workshop…" close={close} onSubmit={async (fields) => {
    const entered = String(fields.get("code") ?? "").replace(/[\s-]/g, "").toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{8}$/.test(entered)) {
      setInvalidCode(true);
      throw new Error("Check the code your instructor shared. It should contain 8 letters or numbers.");
    }
    setTrackMismatch(false);
    const item = await apiRequest<Workshop>("/workshops/join", {
      method: "POST",
      body: JSON.stringify({ code: entered, ...(chooseLanguage ? { language: fields.get("language") } : {}) }),
    }).catch((cause: unknown) => {
      // The API's 409 for this case names the track; offer the one action that resolves it.
      if (cause instanceof ApiError && cause.status === 409 && /language track/i.test(cause.message)) setTrackMismatch(true);
      throw cause;
    });
    if (chooseLanguage) publishProfileUpdate({ ...profile, enrolled_language: item.language });
    cancel?.();
    if (code) router.replace(`/workshops/${item.id}`);
    else router.push(`/workshops/${item.id}`);
  }}>
    <div className="workshop-signed-in">
      <p>Signed in as</p>
      <div className="workshop-signed-in-profile">
        <span aria-hidden="true"><UserAvatar seed={profile.pseudonym_id || profile.id || profile.username} name={displayName || handle} url={profile.avatar_url} /></span>
        <div>
          <strong>{displayName || handle}</strong>
          {displayName && <span>{handle}</span>}
        </div>
        <span className="workshop-account-track">{profile.role === "student" && profile.enrolled_language
          ? `${workshopLanguages[profile.enrolled_language]} track` : roleLabels[profile.role]}</span>
      </div>
    </div>
    <div className="workshop-field">
      <label htmlFor={codeId}>Workshop code</label>
      <input id={codeId} name="code" className="workshop-code-input" data-initial-focus
        aria-describedby={`${codeId}-help`} aria-invalid={invalidCode || undefined}
        autoCapitalize="characters" autoComplete="off" spellCheck={false} required
        defaultValue={code} placeholder="ABCD-2345" onChange={() => setInvalidCode(false)} />
      <small id={`${codeId}-help`}>{code ? "Your invite filled in the code. Confirm below to join." : "Enter or paste the 8-character code from your instructor."}</small>
    </div>
    {chooseLanguage && <fieldset className="workshop-track-picker" aria-describedby={`${codeId}-language-help`}>
      <legend>Programming language</legend>
      <div>
        {Object.entries(workshopLanguages).map(([id, label]) => <label key={id}>
          <input type="radio" name="language" value={id} required />
          {label}
        </label>)}
      </div>
      <small id={`${codeId}-language-help`}>Choose the language your instructor uses in this workshop.</small>
    </fieldset>}
    {profile.role === "student" && !chooseLanguage && <p className="workshop-join-note">The workshop must use the same programming track as your account.
      {trackMismatch && <> <Link href="/profile?edit=track">Change learning track</Link></>}</p>}
  </WorkshopForm>;
}

export function WorkshopHome() {
  const { role } = useShellProfile();
  const [archived, setArchived] = useState(false);
  const [dialog, setDialog] = useState<"create" | "join" | null>(null);
  const instructor = role === "instructor";
  const subtitle = role === "student" ? "Join a practice space with the code from your instructor." : "Organize practice activities and invite students by code.";
  const openCreate = () => setDialog("create");
  const openJoin = () => setDialog("join");

  return <div className={`workshop-page${instructor ? " workshop-instructor-home" : ""}`}>
    {instructor ? <PageHeader title="Workshops" subtitle={subtitle} actions={<>
      <button type="button" className="ic-button ic-primary" onClick={openCreate}><InstructorIcon name="plus" />Create Workshop</button>
      <button type="button" className="ic-button" onClick={openJoin}>Join Workshop</button>
    </>} /> : <header className="workshop-home-header">
      <div>
        <h1 data-workshop-focus tabIndex={-1}>Workshops</h1>
        <p>{subtitle}</p>
      </div>
      <div className="workshop-actions workshop-home-actions">
        {role !== "student" && <Button variant="primary" onClick={openCreate}><span aria-hidden="true">+</span> Create Workshop</Button>}
        <Button variant={role === "student" ? "primary" : "outline"} onClick={openJoin}>Join Workshop</Button>
      </div>
    </header>}
    <div className={instructor ? "ws-chip-row" : "workshop-filter"} role="group" aria-label="Workshop status">
      {[{ label: "Active", value: false }, { label: "Archived", value: true }].map(({ label, value }) =>
        instructor ? <button key={label} type="button" className={`ws-filter-chip${archived === value ? " is-selected" : ""}`}
          aria-pressed={archived === value} onClick={() => setArchived(value)}>{label}</button>
          : <Button key={label} aria-pressed={archived === value} onClick={() => setArchived(value)}>{label}</Button>)}
    </div>
    <WorkshopGrid key={archived ? "archived" : "active"} archived={archived} />
    {dialog === "create" && <CreateWorkshop close={() => setDialog(null)} />}
    {dialog === "join" && <WorkshopDialog title="Join Workshop" close={() => setDialog(null)} entry>
      <JoinWorkshopForm cancel={() => setDialog(null)} />
    </WorkshopDialog>}
  </div>;
}
