"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError, getErrorMessage } from "@/lib/api";
import { useWorkspace, WorkspaceSuspense } from "@/components/workspace/workspace-provider";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  FieldError,
  LoadingPanel,
  Notice,
  PageHeading,
  SearchField,
  SelectField,
  StatusChip,
  Toolbar,
  useApi,
} from "@/components/workspace/ui";
import {
  createAccount,
  deactivateAccount,
  formatDateTime,
  getAccountImpact,
  reactivateAccount,
  type AccountList,
  type AccountRecord,
} from "@/lib/workspace";

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function AdminAccounts() {
  const { profile, courses } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const role = searchParams.get("role") || "";
  const status = searchParams.get("status") || "all";
  const appliedSearch = searchParams.get("q") || "";
  const [search, setSearch] = useState(appliedSearch);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "info" | "warning"; text: string } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState<"create" | "deactivate" | "reactivate" | "">("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ email: "", role: "student", display_name: "", course_ids: [] as string[] });
  const [impact, setImpact] = useState<{ account: AccountRecord; effect: string } | null>(null);
  const [impactTarget, setImpactTarget] = useState<AccountRecord | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [reactivateTarget, setReactivateTarget] = useState<AccountRecord | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(appliedSearch);
  }, [appliedSearch]);

  const path = useMemo(
    () =>
      `/admin/accounts?${new URLSearchParams({
        ...(role ? { role } : {}),
        ...(status && status !== "all" ? { status } : {}),
        ...(appliedSearch ? { search: appliedSearch } : {}),
      }).toString()}`,
    [appliedSearch, role, status],
  );
  const { data, error, loading, reload } = useApi<AccountList>(path);

  function updateQuery(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function toggleCourse(courseId: string) {
    setForm((current) => ({
      ...current,
      course_ids: current.course_ids.includes(courseId)
        ? current.course_ids.filter((id) => id !== courseId)
        : [...current.course_ids, courseId],
    }));
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found: Record<string, string> = {};
    const email = form.email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) found.email = "Enter a valid email address, for example name@example.edu.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy("create");
    setNotice(null);
    try {
      const result = await createAccount({
        email,
        role: form.role,
        display_name: form.display_name.trim() || undefined,
        course_ids: form.course_ids,
      });
      setNotice({ tone: "success", text: result.message });
      setCreateOpen(false);
      setForm({ email: "", role: "student", display_name: "", course_ids: [] });
      reload();
    } catch (caught) {
      if (caught instanceof ApiError) {
        const detail = (caught.details as { detail?: { field?: string; message?: string; code?: string } } | undefined)?.detail;
        if (detail?.field) {
          setErrors({ [detail.field]: detail.message || caught.message });
          window.requestAnimationFrame(() => document.getElementById(`account-${detail.field}`)?.focus());
        }
      }
      setNotice({ tone: "error", text: `${getErrorMessage(caught)} Your form values are still here.` });
    } finally {
      setBusy("");
    }
  }

  async function openImpact(account: AccountRecord) {
    setImpactTarget(account);
    setImpact(null);
    setImpactLoading(true);
    try {
      const result = await getAccountImpact(account.account_id);
      setImpact({ account: result.account, effect: result.effect });
    } catch (caught) {
      setNotice({ tone: "error", text: getErrorMessage(caught) });
      setImpactTarget(null);
    } finally {
      setImpactLoading(false);
    }
  }

  async function confirmDeactivate() {
    if (!impactTarget) return;
    setBusy("deactivate");
    try {
      const result = await deactivateAccount(impactTarget.account_id);
      setNotice({ tone: "success", text: result.message });
      setImpactTarget(null);
      setImpact(null);
      reload();
    } catch (caught) {
      setNotice({ tone: "error", text: getErrorMessage(caught) });
    } finally {
      setBusy("");
    }
  }

  async function confirmReactivate() {
    if (!reactivateTarget) return;
    setBusy("reactivate");
    try {
      const result = await reactivateAccount(reactivateTarget.account_id);
      setNotice({ tone: "success", text: result.message });
      setReactivateTarget(null);
      reload();
    } catch (caught) {
      setNotice({ tone: "error", text: getErrorMessage(caught) });
    } finally {
      setBusy("");
    }
  }

  const rows = data?.items || [];

  return (
    <>
      <PageHeading
        eyebrow="ADMINISTRATION"
        title="Accounts"
        description="Find, provision and manage accounts. Public registration creates students only; instructors and administrators are provisioned here."
        status={data ? <StatusChip state="active" label={`${data.counts.all} accounts`} /> : undefined}
        actions={
          <Button variant="primary" onClick={() => setCreateOpen((open) => !open)}>
            {createOpen ? "Close form" : "Create account"}
          </Button>
        }
      />

      {notice ? <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Notice> : null}

      {createOpen ? (
        <section className="ws-panel" aria-labelledby="create-account-title">
          <div className="ws-panel-head">
            <div>
              <p className="eyebrow-label">PROVISION ACCOUNT</p>
              <h2 id="create-account-title">Create an account</h2>
            </div>
            <button type="button" className="ws-inline-link" onClick={() => setCreateOpen(false)}>Cancel</button>
          </div>
          <form className="ws-form-grid" onSubmit={(event) => void submitCreate(event)} noValidate>
            <div className="ws-field">
              <label htmlFor="account-email">Email</label>
              <input
                id="account-email"
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                aria-invalid={Boolean(errors.email)}
                autoComplete="off"
              />
              <FieldError>{errors.email}</FieldError>
            </div>
            <div className="ws-field">
              <label htmlFor="account-role">Role</label>
              <select id="account-role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
                <option value="student">Student</option>
                <option value="instructor">Instructor (faculty)</option>
                <option value="admin">Administrator</option>
              </select>
              <p className="ws-muted">This is an administrator action. Public registration cannot choose a role.</p>
            </div>
            <div className="ws-field">
              <label htmlFor="account-name">Display name (optional)</label>
              <input id="account-name" value={form.display_name} maxLength={120} onChange={(event) => setForm({ ...form, display_name: event.target.value })} />
            </div>
            <fieldset className="ws-field full ws-course-picker">
              <legend>Course access (optional)</legend>
              {courses.length === 0 ? <p className="ws-muted">No courses exist yet.</p> : null}
              <div className="ws-check-grid">
                {courses.map((course) => (
                  <label className="ws-check" key={course.id}>
                    <input
                      type="checkbox"
                      checked={form.course_ids.includes(course.id)}
                      onChange={() => toggleCourse(course.id)}
                    />
                    <span>{course.title}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="ws-inline-actions full">
              <Button variant="primary" type="submit" disabled={busy !== ""}>
                {busy === "create" ? "Provisioning…" : "Create account"}
              </Button>
              <span className="ws-muted">An invitation email lets the new account set a password.</span>
            </div>
          </form>
        </section>
      ) : null}

      <Toolbar label="Account filters">
        <SearchField value={search} onChange={setSearch} onSubmit={() => updateQuery({ q: search || null })} placeholder="Search email, name or role" label="Search accounts" />
        <SelectField
          label="Role"
          value={role}
          onChange={(value) => updateQuery({ role: value || null })}
          options={[
            { value: "student", label: "Student" },
            { value: "instructor", label: "Instructor" },
            { value: "admin", label: "Administrator" },
          ]}
          includeAll
          allLabel="All roles"
        />
        <SelectField
          label="Status"
          value={status}
          onChange={(value) => updateQuery({ status: value === "all" ? null : value })}
          options={[
            { value: "all", label: "All statuses" },
            { value: "attention", label: "Needs action" },
            { value: "active", label: "Active" },
            { value: "deactivated", label: "Deactivated" },
          ]}
        />
        {role || status !== "all" || appliedSearch ? (
          <Button variant="quiet" onClick={() => { setSearch(""); updateQuery({ role: null, status: null, q: null }); }}>
            Clear filters
          </Button>
        ) : null}
      </Toolbar>

      {error ? (
        <Notice tone="error">
          Accounts could not load. {error}{" "}
          <button type="button" className="ws-inline-link" onClick={reload}>Retry</button>
        </Notice>
      ) : null}
      {loading && !data ? <LoadingPanel label="Loading accounts…" /> : null}

      {!loading && data && rows.length === 0 ? (
        <EmptyState
          title={role || status !== "all" || appliedSearch ? "No accounts match these filters" : "No accounts yet"}
          action={
            role || status !== "all" || appliedSearch ? (
              <Button variant="outline" onClick={() => updateQuery({ role: null, status: null, q: null })}>Clear filters</Button>
            ) : undefined
          }
        >
          {role || status !== "all" || appliedSearch
            ? "Try another role or status, or clear the filters. Your selection stays until cleared."
            : "Create the first provisioned account above."}
        </EmptyState>
      ) : null}

      {rows.length > 0 ? (
        <div className="ws-table-wrap">
          <table className="ws-table">
            <caption className="sr-only">Platform accounts</caption>
            <thead>
              <tr>
                <th scope="col">Account</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Course access</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((account) => {
                const self = account.account_id === profile.id;
                return (
                  <tr key={account.account_id}>
                    <td data-label="Account">
                      <strong>{account.display_name || account.pseudonym}</strong>
                      <span className="ws-row-meta">{account.email || "No email on record"}</span>
                      {account.needs_action ? <span className="ws-row-meta">⚠ {account.action_reason}</span> : null}
                    </td>
                    <td data-label="Role"><StatusChip state={account.role === "admin" ? "info" : account.role} label={account.role} /></td>
                    <td data-label="Status">
                      <StatusChip state={account.account_status} label={account.account_status === "active" ? "Active" : "Deactivated"} tone={account.account_status === "active" ? "good" : "bad"} />
                    </td>
                    <td data-label="Course access">
                      {account.course_access.length === 0 ? (
                        <span className="ws-muted">No course access</span>
                      ) : (
                        <ul className="ws-tag-list">
                          {account.course_access.map((access) => (
                            <li key={access.membership_id}>
                              {access.course_title}{" "}
                              <span className={`ws-mini-chip ${access.status}`}>{access.status}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <span className="ws-row-meta">Joined {formatDateTime(account.created_at)}</span>
                    </td>
                    <td data-label="Action">
                      <div className="ws-inline-actions">
                        <Link className="button button-outline small" href={`/admin/assignments?profile=${account.account_id}`}>
                          Assign course
                        </Link>
                        {account.account_status === "active" ? (
                          <Button variant="danger" disabled={self} onClick={() => void openImpact(account)}>
                            Deactivate
                          </Button>
                        ) : (
                          <Button variant="outline" onClick={() => setReactivateTarget(account)}>
                            Reactivate
                          </Button>
                        )}
                      </div>
                      {self ? <p className="ws-muted">You cannot deactivate your own account.</p> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="ws-footnote">Administrators manage access and operational records; they do not edit grades, answer keys or hidden tests.</p>

      <ConfirmDialog
        open={Boolean(impactTarget)}
        title="Deactivate this account"
        confirmLabel="Deactivate account"
        tone="danger"
        busy={busy === "deactivate" || impactLoading}
        onCancel={() => { setImpactTarget(null); setImpact(null); }}
        onConfirm={() => void confirmDeactivate()}
      >
        {impactLoading ? <LoadingPanel label="Calculating access impact…" /> : null}
        {impact ? (
          <>
            <p>{impact.effect}</p>
            <ul className="ws-plain-list">
              <li>
                <strong>{impact.account.display_name || impact.account.pseudonym}</strong> ({impact.account.email})
              </li>
              {impact.account.course_access.map((access) => (
                <li key={access.membership_id}>
                  Loses {access.member_role} access to {access.course_title}
                </li>
              ))}
              <li>Existing materials, activity versions, attempts and audit events are preserved.</li>
            </ul>
          </>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(reactivateTarget)}
        title="Reactivate this account"
        confirmLabel="Reactivate account"
        busy={busy === "reactivate"}
        onCancel={() => setReactivateTarget(null)}
        onConfirm={() => void confirmReactivate()}
      >
        {reactivateTarget ? (
          <p>
            <strong>{reactivateTarget.email || reactivateTarget.pseudonym}</strong> regains its previous course assignments
            when the account is reactivated.
          </p>
        ) : null}
      </ConfirmDialog>
    </>
  );
}

export default function Page() {
  return (
    <WorkspaceSuspense label="accounts">
      <AdminAccounts />
    </WorkspaceSuspense>
  );
}
