"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, getErrorMessage } from "@/lib/api";
import { WorkspaceSuspense } from "@/components/workspace/workspace-provider";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  FieldError,
  LoadingPanel,
  Notice,
  PageHeading,
  StatusChip,
  useApi,
} from "@/components/workspace/ui";
import { formatDateTime, updateSetting, type SettingRecord, type SettingsResponse } from "@/lib/workspace";

type Conflict = { key: string; proposed: string; latest: SettingRecord };
type Saved = { key: string; label: string; from: string; to: string; version: number };

function Configuration() {
  const { data, error, loading, reload } = useApi<SettingsResponse>("/admin/settings");
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "warning" | "info"; text: string } | null>(null);
  const [editing, setEditing] = useState<{ setting: SettingRecord; value: string } | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);

  useEffect(() => {
    // A stale conflict notice should not survive a data reload.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!data) setConflict(null);
  }, [data]);

  function startEdit(setting: SettingRecord) {
    setEditing({ setting, value: String(setting.value) });
    setFieldError("");
    setConflict(null);
    setNotice(null);
    setSaved(null);
  }

  function validate(): string {
    if (!editing) return "";
    const { setting, value } = editing;
    if (!value.trim()) return "Enter a value.";
    if (value.trim() === String(setting.value)) return "Enter a different value. This one is already saved.";
    if (setting.value_type === "integer") {
      const parsed = Number(value);
      if (!Number.isInteger(parsed)) return "Enter a whole number.";
      if (setting.min_value !== null && parsed < setting.min_value) return `Enter at least ${setting.min_value}.`;
      if (setting.max_value !== null && parsed > setting.max_value) return `Enter at most ${setting.max_value}.`;
    }
    if (setting.value_type === "string" && (setting.min_value !== null || setting.max_value !== null)) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return "Enter a number.";
      if (setting.min_value !== null && parsed < setting.min_value) return `Enter at least ${setting.min_value}.`;
      if (setting.max_value !== null && parsed > setting.max_value) return `Enter at most ${setting.max_value}.`;
    }
    return "";
  }

  function openReview() {
    const message = validate();
    setFieldError(message);
    if (message) return;
    setReviewOpen(true);
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      const value = editing.setting.value_type === "integer" ? Number(editing.value) : editing.value.trim();
      const result = await updateSetting(editing.setting.key, value, editing.setting.version);
      setSaved({ key: editing.setting.key, label: editing.setting.label, from: String(editing.setting.value),
        to: String(result.setting?.value ?? value), version: result.setting?.version ?? editing.setting.version + 1 });
      setReviewOpen(false);
      setEditing(null);
      reload();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "version_conflict") {
        const payload = caught.details as { detail?: { latest?: SettingRecord; message?: string } } | undefined;
        const latest = payload?.detail?.latest;
        if (latest) {
          setConflict({ key: editing.setting.key, proposed: editing.value, latest });
          setReviewOpen(false);
        } else {
          setNotice({ tone: "error", text: caught.message });
        }
      } else if (caught instanceof ApiError) {
        const payload = caught.details as { detail?: { field?: string; message?: string } } | undefined;
        setFieldError(payload?.detail?.message || caught.message);
        setReviewOpen(false);
      } else {
        setNotice({ tone: "error", text: getErrorMessage(caught) });
        setReviewOpen(false);
      }
    } finally {
      setBusy(false);
    }
  }

  function renderConflict(current: Conflict) {
    return (
      <div className="ws-setting-inline ws-conflict" role="alert" aria-labelledby={`conflict-${current.key}`}>
        <div className="ws-panel-head">
          <strong id={`conflict-${current.key}`}>Another administrator saved this setting first</strong>
          <StatusChip state="pending" label="Not saved" tone="wait" />
        </div>
        <p>Your value was not saved and nothing was overwritten. Compare the two, then reload the latest version to try again.</p>
        <div className="ws-form-grid">
          <div className="ws-soft"><strong>Your proposed value</strong><p>{current.proposed}</p></div>
          <div className="ws-soft">
            <strong>Latest saved value (version {current.latest.version})</strong>
            <p>{String(current.latest.value)}</p>
            <p className="ws-muted">Edited by {current.latest.last_editor || "unknown"} · {formatDateTime(current.latest.updated_at)}</p>
          </div>
        </div>
        <div className="ws-inline-actions">
          <Button variant="primary" onClick={() => {
            const latestSetting = current.latest;
            setConflict(null);
            setEditing({ setting: latestSetting, value: String(latestSetting.value) });
            reload();
          }}>Reload latest value</Button>
          <Button variant="quiet" onClick={() => setConflict(null)}>Close</Button>
        </div>
      </div>
    );
  }

  function renderEditor(current: { setting: SettingRecord; value: string }) {
    const { setting } = current;
    return (
      <div className="ws-setting-inline">
        <div className="ws-field">
          <label htmlFor="setting-value">New value for {setting.label}</label>
          <input
            id="setting-value"
            type={setting.value_type === "integer" ? "number" : "text"}
            min={setting.min_value ?? undefined}
            max={setting.max_value ?? undefined}
            value={current.value}
            onChange={(event) => setEditing({ ...current, value: event.target.value })}
            aria-invalid={Boolean(fieldError)}
            autoFocus
          />
          <FieldError>{fieldError}</FieldError>
        </div>
        <div className="ws-inline-actions">
          <Button variant="primary" onClick={openReview}>Review change</Button>
          <Button variant="quiet" onClick={() => setEditing(null)}>Cancel</Button>
          <span className="ws-muted">You&apos;ll see a summary before anything is saved.</span>
        </div>
      </div>
    );
  }

  if (loading && !data) return <LoadingPanel label="Loading operational settings…" />;
  if (error && !data) {
    return (
      <section className="ws-panel" role="alert">
        <PageHeading eyebrow="ADMINISTRATION" title="Configuration unavailable" description={error} />
        <div className="ws-inline-actions">
          <Button variant="primary" onClick={reload}>Try again</Button>
        </div>
      </section>
    );
  }

  return (
    <>
      <PageHeading
        eyebrow="ADMINISTRATION"
        title="Configuration"
        description="Operational settings, grouped by the service they affect. Each change is validated, reviewed before saving and recorded in the audit trail."
        status={data ? <StatusChip state="active" label={`${data.total} settings`} /> : undefined}
        actions={<Button variant="outline" onClick={reload}>Refresh</Button>}
      />

      {notice ? <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Notice> : null}

      {data && data.groups.length === 0 ? (
        <EmptyState title="No operational settings are configured">Settings appear here once the platform seeds them.</EmptyState>
      ) : null}

      <div className="ws-settings-groups">
        {(data?.groups || []).map((group) => (
          <section className="ws-panel" key={group.service} aria-labelledby={`group-${group.service}`}>
            <div className="ws-panel-head">
              <div>
                <p className="eyebrow-label">SERVICE</p>
                <h2 id={`group-${group.service}`}>{group.label}</h2>
              </div>
              <StatusChip state="info" label={`${group.settings.length} settings`} tone="info" />
            </div>
            <ul className="ws-setting-list">
              {group.settings.map((setting) => (
                <li key={setting.key}>
                  <div className="ws-setting-main">
                    <strong>{setting.label}</strong>
                    <p>{setting.description}</p>
                    <span className="ws-row-meta">
                      Current: <code>{String(setting.value)}</code> · version {setting.version} ·{" "}
                      {setting.last_editor ? `last edited by ${setting.last_editor}` : "never edited"}{" "}
                      {setting.updated_at ? `· ${formatDateTime(setting.updated_at)}` : ""}
                    </span>
                    {setting.min_value !== null || setting.max_value !== null ? (
                      <span className="ws-row-meta">Allowed range: {setting.min_value ?? "—"} to {setting.max_value ?? "—"}</span>
                    ) : null}
                    {saved?.key === setting.key ? (
                      <p className="ws-setting-saved" role="status">
                        Saved: changed from <code>{saved.from}</code> to <code>{saved.to}</code> (version {saved.version}).{" "}
                        <Link href={`/admin/monitoring?audit=${encodeURIComponent(saved.label)}`}>See it in the audit trail</Link>
                      </p>
                    ) : null}
                  </div>
                  {editing?.setting.key === setting.key ? null : (
                    <Button variant="outline" onClick={() => startEdit(setting)} disabled={busy}>Change</Button>
                  )}
                  {editing?.setting.key === setting.key ? renderEditor(editing) : null}
                  {conflict?.key === setting.key ? renderConflict(conflict) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="ws-footnote">
        Configuration covers operational settings only. It never contains grade overrides, quiz keys or hidden tests.
      </p>

      <ConfirmDialog
        open={reviewOpen}
        title="Review configuration change"
        confirmLabel="Save setting"
        busy={busy}
        onCancel={() => setReviewOpen(false)}
        onConfirm={() => void save()}
      >
        {editing ? (
          <>
            <dl className="ws-summary-list">
              <div><dt>Setting</dt><dd>{editing.setting.label}</dd></div>
              <div><dt>Current value</dt><dd>{String(editing.setting.value)} (version {editing.setting.version})</dd></div>
              <div><dt>New value</dt><dd>{editing.value}</dd></div>
              <div><dt>Effect</dt><dd>{editing.setting.description}</dd></div>
            </dl>
            <p className="ws-muted">Saving records a new version, the editor and an audit event. Existing grades are unchanged.</p>
          </>
        ) : null}
      </ConfirmDialog>
    </>
  );
}

export default function Page() {
  return (
    <WorkspaceSuspense label="configuration">
      <Configuration />
    </WorkspaceSuspense>
  );
}
