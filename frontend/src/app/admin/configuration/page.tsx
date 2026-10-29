"use client";

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

function Configuration() {
  const { data, error, loading, reload } = useApi<SettingsResponse>("/admin/settings");
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "warning" | "info"; text: string } | null>(null);
  const [editing, setEditing] = useState<{ setting: SettingRecord; value: string } | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [conflict, setConflict] = useState<Conflict | null>(null);

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
  }

  function validate(): string {
    if (!editing) return "";
    const { setting, value } = editing;
    if (!value.trim()) return "Enter a value.";
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
      setNotice({ tone: "success", text: result.message });
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
          setNotice({ tone: "warning", text: payload?.detail?.message || "Another administrator saved this setting first." });
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
        description="Grouped operational settings with their current value, description, version and last editor. Changes are validated, reviewed and audited."
        status={data ? <StatusChip state="active" label={`${data.total} settings`} /> : undefined}
        actions={<Button variant="outline" onClick={reload}>Refresh</Button>}
      />

      {notice ? <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Notice> : null}

      {conflict ? (
        <section className="ws-panel ws-conflict" aria-labelledby="conflict-title">
          <div className="ws-panel-head">
            <div>
              <p className="eyebrow-label">VERSION CONFLICT</p>
              <h2 id="conflict-title">Another administrator saved this setting first</h2>
            </div>
            <StatusChip state="pending" label="Not saved" tone="wait" />
          </div>
          <p>
            Your proposed value was not saved. Compare it with the latest saved value, then reload the latest version and
            try again. Nothing was overwritten.
          </p>
          <div className="ws-form-grid">
            <div className="ws-soft">
              <strong>Your proposed value</strong>
              <p>{conflict.proposed}</p>
            </div>
            <div className="ws-soft">
              <strong>Latest saved value (version {conflict.latest.version})</strong>
              <p>{String(conflict.latest.value)}</p>
              <p className="ws-muted">
                Edited by {conflict.latest.last_editor || "unknown"} · {formatDateTime(conflict.latest.updated_at)}
              </p>
            </div>
          </div>
          <div className="ws-inline-actions">
            <Button
              variant="primary"
              onClick={() => {
                const latestSetting = conflict.latest;
                setConflict(null);
                setEditing({ setting: latestSetting, value: String(latestSetting.value) });
                reload();
              }}
            >
              Reload latest value
            </Button>
            <Button variant="quiet" onClick={() => setConflict(null)}>
              Keep comparing
            </Button>
          </div>
        </section>
      ) : null}

      {editing ? (
        <section className="ws-panel" aria-labelledby="edit-setting-title">
          <div className="ws-panel-head">
            <div>
              <p className="eyebrow-label">{editing.setting.service_label.toUpperCase()}</p>
              <h2 id="edit-setting-title">{editing.setting.label}</h2>
            </div>
            <button type="button" className="ws-inline-link" onClick={() => setEditing(null)}>Cancel</button>
          </div>
          <p className="ws-muted">{editing.setting.description}</p>
          <div className="ws-form-grid">
            <div className="ws-field">
              <label htmlFor="setting-value">New value</label>
              <input
                id="setting-value"
                type={editing.setting.value_type === "integer" ? "number" : "text"}
                min={editing.setting.min_value ?? undefined}
                max={editing.setting.max_value ?? undefined}
                value={editing.value}
                onChange={(event) => setEditing({ ...editing, value: event.target.value })}
                aria-invalid={Boolean(fieldError)}
              />
              <FieldError>{fieldError}</FieldError>
              <p className="ws-muted">
                Current value: {String(editing.setting.value)} · version {editing.setting.version} · last edited by{" "}
                {editing.setting.last_editor || "system"} {formatDateTime(editing.setting.updated_at)}
              </p>
            </div>
            <div className="ws-inline-actions full">
              <Button variant="primary" onClick={openReview}>Review change</Button>
              <span className="ws-muted">A review summary appears before anything is saved.</span>
            </div>
          </div>
        </section>
      ) : null}

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
                      <span className="ws-row-meta">
                        Allowed range: {setting.min_value ?? "—"} to {setting.max_value ?? "—"}
                      </span>
                    ) : null}
                  </div>
                  <Button variant="outline" onClick={() => startEdit(setting)} disabled={busy}>
                    Change
                  </Button>
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
