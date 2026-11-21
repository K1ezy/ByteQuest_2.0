"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/workspace/ui";
import { getErrorMessage } from "@/lib/api";
import type { ProgrammingLanguage, Workshop } from "@/lib/types";

export const workshopLanguages = { python: "Python", cpp: "C++", java: "Java" } as const;
const languageMarks = { python: ">>>", cpp: "::", java: "{ }" } as const;
const dialogControls = "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)";

const manilaDateTime = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
});

export function workshopDateTime(value: string) {
  return manilaDateTime.format(new Date(value));
}

export function WorkshopBanner({ language, children, eager = false }: {
  language: ProgrammingLanguage;
  children: ReactNode;
  eager?: boolean;
}) {
  return <div className="workshop-banner" data-language={language}>
    <div className="workshop-banner-content">{children}</div>
    <span className="workshop-banner-mark" aria-hidden="true">{languageMarks[language]}</span>
    <Image src="/illustrations/quest-scroll-purple.png" alt="" width={148} height={148} loading={eager ? "eager" : "lazy"} />
  </div>;
}

export function WorkshopError({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="workshop-panel">
    <p role="alert" className="notice error">{message}</p>
    {retry && <Button onClick={retry}>Retry</Button>}
  </div>;
}

export function WorkshopDialog({ title, children, close, fullscreen = false, entry = false }: {
  title: string;
  children: ReactNode;
  close: () => void;
  fullscreen?: boolean;
  entry?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-initial-focus]")?.focus();
    return () => {
      dialog.close();
      if (trigger?.isConnected && !trigger.matches(":disabled")) trigger.focus();
      else Array.from(document.querySelectorAll<HTMLElement>("[data-workshop-focus]")).at(-1)?.focus();
    };
  }, []);
  function dismiss() {
    if (!ref.current?.querySelector('form[aria-busy="true"]')) close();
  }

  return <dialog ref={ref} className={`workshop-dialog${fullscreen ? " workshop-projector" : ""}${entry ? " workshop-entry-dialog" : ""}`}
    aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); dismiss(); }}
    onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(dialogControls))
        .filter((element) => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
    }}>
    <div className="workshop-heading">
      <h2 id={titleId}>{title}</h2>
      {!entry && <Button aria-label="Close dialog" onClick={dismiss}>Close</Button>}
    </div>
    {children}
  </dialog>;
}

export function WorkshopForm({ children, submitLabel, onSubmit, close, danger = false, className = "", busyLabel = "Saving…" }: {
  children: ReactNode;
  submitLabel: string;
  onSubmit: (values: FormData) => Promise<void>;
  close?: () => void;
  danger?: boolean;
  className?: string;
  busyLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await onSubmit(new FormData(event.currentTarget));
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return <form className={`workshop-form ${className}`} onSubmit={(event) => void submit(event)}
    onInput={() => { if (error) setError(""); }} aria-busy={busy}>
    {children}
    {error && <p className="notice error" role="alert">{error}</p>}
    <div className="workshop-actions">
      {close && <Button onClick={close} disabled={busy}>Cancel</Button>}
      <Button type="submit" variant={danger ? "danger" : "primary"} disabled={busy}>{submitLabel}</Button>
      {busy && <span role="status">{busyLabel}</span>}
    </div>
  </form>;
}

export function WorkshopInvite({ workshop, showTitle = true }: { workshop: Workshop; showTitle?: boolean }) {
  const [project, setProject] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [manualLink, setManualLink] = useState("");
  if (!workshop.join_code) return null;
  const code = workshop.join_code;
  const invite = `/workshops/join/${code}`;
  const open = workshop.joining_enabled && !workshop.archived;
  const Container = showTitle ? "section" : "div";

  async function copy(value: string, message: string, isLink = false) {
    setNotice("");
    setError("");
    setManualLink("");
    try {
      await navigator.clipboard.writeText(value);
      setNotice(message);
    } catch {
      setError(isLink ? "Could not copy the link. You can select it below." : "Could not copy the code. You can select it above.");
      if (isLink) setManualLink(value);
    }
  }

  return <Container id={showTitle ? "workshop-invitation" : undefined}
    className={showTitle ? "workshop-panel workshop-invitation" : "workshop-invitation"}>
    {showTitle && <h2>Invite students</h2>}
    <div className="workshop-invite-ticket">
      <span>Workshop code</span>
      <code className="workshop-invite-code">{code}</code>
    </div>
    {open ? <>
      <div className="workshop-actions">
        <Button variant="primary" onClick={() => void copy(new URL(invite, window.location.origin).href, "Invite link copied.", true)}>Copy invite link</Button>
        <Button variant="quiet" onClick={() => void copy(code, "Code copied.")}>Copy code</Button>
        <Button variant="quiet" onClick={() => setProject(true)}>Show full screen</Button>
      </div>
      {error && <p role="alert">{error}</p>}
      {manualLink && <input className="workshop-manual-link" aria-label="Invite link" readOnly value={manualLink}
        onFocus={(event) => event.currentTarget.select()} />}
      {notice && <p role="status">{notice}</p>}
    </> : <p>Joining is closed.</p>}
    {project && open && <WorkshopDialog title="Workshop code" close={() => setProject(false)} fullscreen>
      <div className="workshop-projector-body">
        <p>{workshop.name}</p>
        <code>{code}</code>
        <p>{window.location.host}{invite}</p>
      </div>
    </WorkshopDialog>}
  </Container>;
}
