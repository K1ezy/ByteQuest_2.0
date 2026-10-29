"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { apiRequest, getErrorMessage } from "@/lib/api";

/* ------------------------------------------------------------------ hooks */

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(path));
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!path) return;
    let active = true;
    // Synchronizing fetch state with a new request path is intentional here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    apiRequest<T>(path)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((caught) => {
        if (active) setError(getErrorMessage(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  return { data, error, loading, reload, setData };
}

export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/* --------------------------------------------------------------- controls */

type ButtonVariant = "primary" | "outline" | "quiet" | "danger";

export function Button({
  variant = "outline",
  className = "",
  type = "button",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; children: ReactNode }) {
  const variantClass =
    variant === "primary"
      ? "button-primary"
      : variant === "quiet"
        ? "button-quiet"
        : variant === "danger"
          ? "ws-danger-button"
          : "button-outline";
  return (
    <button type={type} className={`button ${variantClass} ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  status,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="ws-page-heading">
      <div className="ws-page-heading-copy">
        <p className="eyebrow-label">{eyebrow}</p>
        <h1>{title}</h1>
        {description ? <p className="ws-page-description">{description}</p> : null}
      </div>
      <div className="ws-page-heading-side">
        {status}
        {actions ? <div className="ws-page-actions">{actions}</div> : null}
      </div>
    </header>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  href,
  tone = "info",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  href?: string;
  tone?: "info" | "good" | "wait" | "bad";
}) {
  const inner = (
    <>
      <div className="ws-stat-top">
        <span className="ws-stat-label">{label}</span>
        {icon ? (
          <span className={`ws-stat-icon ${tone}`} aria-hidden="true">
            {icon}
          </span>
        ) : null}
      </div>
      <p className="ws-stat-value">{value}</p>
      {hint ? <p className={`ws-stat-hint ${tone}`}>{hint}</p> : null}
    </>
  );
  return href ? (
    <Link className="ws-stat-card" href={href}>
      {inner}
    </Link>
  ) : (
    <div className="ws-stat-card">{inner}</div>
  );
}

export type StatusTone = "good" | "wait" | "bad" | "info" | "muted";

export function StatusChip({ state, label, tone }: { state: string; label?: string; tone?: StatusTone }) {
  const resolvedTone = tone || stateTone(state);
  return <span className={`ws-chip ${resolvedTone}`}>{label || prettify(state)}</span>;
}

export function stateTone(state: string): StatusTone {
  if (["ready", "open", "published", "healthy", "active", "complete", "ready_for_review"].includes(state)) return "good";
  if (["processing", "scheduled", "pending", "stale", "draft_ready"].includes(state)) return "wait";
  if (["failed", "rejected", "closed", "deactivated", "unavailable"].includes(state)) return "bad";
  if (["draft"].includes(state)) return "info";
  return "muted";
}

export function prettify(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bApi\b/g, "API")
    .replace(/\bRag\b/g, "RAG")
    .replace(/\bPdf\b/g, "PDF");
}

export function Notice({
  tone = "success",
  children,
  onDismiss,
}: {
  tone?: "success" | "error" | "warning" | "info";
  children: ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div className={`ws-notice ${tone}`} role={tone === "error" ? "alert" : "status"} aria-live={tone === "error" ? "assertive" : "polite"}>
      <span className="ws-notice-text">{children}</span>
      {onDismiss ? (
        <button type="button" className="ws-notice-dismiss" aria-label="Dismiss message" onClick={onDismiss}>
          ×
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
  tone = "neutral",
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "success" | "warning";
}) {
  return (
    <div className={`ws-empty ${tone}`}>
      <strong>{title}</strong>
      {children ? <div className="ws-empty-copy">{children}</div> : null}
      {action ? <div className="ws-empty-action">{action}</div> : null}
    </div>
  );
}

export function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="ws-loading-panel" role="status">
      <span className="ws-spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

export function Toolbar({ children, label = "Filters" }: { children: ReactNode; label?: string }) {
  return (
    <section className="ws-toolbar" aria-label={label}>
      {children}
    </section>
  );
}

export function SearchField({
  value,
  onChange,
  onSubmit,
  placeholder,
  label = "Search",
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <form
      className="ws-search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <label>
        <span className="sr-only">{label}</span>
        <input
          type="search"
          value={value}
          placeholder={placeholder || "Search this view"}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <button type="submit" className="button button-outline small">
        Search
      </button>
    </form>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  includeAll = false,
  allLabel = "All",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  includeAll?: boolean;
  allLabel?: string;
}) {
  const id = useId();
  return (
    <label className="ws-select" htmlFor={id}>
      <span>{label}</span>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {includeAll ? <option value="">{allLabel}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p className="ws-field-error" role="alert">
      {children}
    </p>
  );
}

/* ----------------------------------------------------------------- dialog */

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "primary",
  busy = false,
  hideConfirm = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  busy?: boolean;
  hideConfirm?: boolean;
  onConfirm?: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => cancelRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
      previousFocus.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const nodes = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (node) => node.offsetParent !== null || node === document.activeElement,
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="ws-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div className="ws-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialogRef}>
        <div className="ws-dialog-heading">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="ws-dialog-close" aria-label="Close dialog" onClick={onCancel} disabled={busy}>
            ×
          </button>
        </div>
        <div className="ws-dialog-body">{children}</div>
        <div className="ws-dialog-actions">
          <button type="button" className="button button-outline" ref={cancelRef} onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          {hideConfirm ? null : (
            <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} disabled={busy}>
              {busy ? "Working…" : confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ table */

export function TableShell({ children, caption }: { children: ReactNode; caption: string }) {
  return (
    <div className="ws-table-wrap">
      <table className="ws-table">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}
