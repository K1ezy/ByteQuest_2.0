"use client";

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
  confirmAssignment,
  createAssignment,
  formatDateTime,
  removeAssignment,
  type AccountList,
  type AssignmentList,
  type AssignmentRecord,
} from "@/lib/workspace";

function AdminAssignments() {
  const { courses } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const courseFilter = searchParams.get("course") || "";
  const roleFilter = searchParams.get("role") || "";
  const statusFilter = searchParams.get("status") || "all";
  const appliedSearch = searchParams.get("q") || "";
  const presetProfile = searchParams.get("profile") || "";
  const [search, setSearch] = useState(appliedSearch);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "warning"; text: string } | null>(null);
  const [assignOpen, setAssignOpen] = useState(Boolean(presetProfile));
  const [busy, setBusy] = useState<"assign" | "remove" | "confirm" | "">("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ profile_id: presetProfile, course_id: "", member_role: "instructor" });
  const [removeTarget, setRemoveTarget] = useState<AssignmentRecord | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(appliedSearch);
  }, [appliedSearch]);

  const path = useMemo(
    () =>
      `/admin/assignments?${new URLSearchParams({
        ...(courseFilter ? { course_id: courseFilter } : {}),
        ...(roleFilter ? { role: roleFilter } : {}),
        ...(statusFilter && statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(appliedSearch ? { search: appliedSearch } : {}),
      }).toString()}`,
    [appliedSearch, courseFilter, roleFilter, statusFilter],
  );
  const { data, error, loading, reload } = useApi<AssignmentList>(path);
  const { data: accountsData } = useApi<AccountList>("/admin/accounts");

  function updateQuery(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  async function submitAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!form.profile_id) found.profile_id = "Choose an account.";
    if (!form.course_id) found.course_id = "Choose a course.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy("assign");
    setNotice(null);
    try {
      const result = await createAssignment({
        profile_id: form.profile_id,
        course_id: form.course_id,
        member_role: form.member_role as "instructor" | "student",
      });
      setNotice({ tone: "success", text: result.message });
      setAssignOpen(false);
      setForm({ profile_id: "", course_id: "", member_role: "instructor" });
      reload();
    } catch (caught) {
      if (caught instanceof ApiError) {
        const detail = (caught.details as { detail?: { field?: string; message?: string } } | undefined)?.detail;
        if (detail?.field) {
          setErrors({ [detail.field]: detail.message || caught.message });
          window.requestAnimationFrame(() => document.getElementById(`assignment-${detail.field}`)?.focus());
        }
      }
      setNotice({ tone: "error", text: `${getErrorMessage(caught)} Your selection is still here.` });
    } finally {
      setBusy("");
    }
  }

  async function doConfirm(row: AssignmentRecord) {
    setBusy("confirm");
    try {
      const result = await confirmAssignment(row.membership_id);
      setNotice({ tone: "success", text: result.message });
      reload();
    } catch (caught) {
      setNotice({ tone: "error", text: getErrorMessage(caught) });
    } finally {
      setBusy("");
    }
  }

  async function doRemove() {
    if (!removeTarget) return;
    setBusy("remove");
    try {
      const result = await removeAssignment(removeTarget.membership_id);
      setNotice({ tone: "success", text: result.message });
      setRemoveTarget(null);
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
        title="Course assignments"
        description="Grant or remove course access with clear role boundaries. Students can only be enrolled as students; instructors need an instructor account."
        status={data ? <StatusChip state="active" label={`${data.counts.active} active assignments`} /> : undefined}
        actions={
          <Button variant="primary" onClick={() => setAssignOpen((open) => !open)}>
            {assignOpen ? "Close form" : "Assign course"}
          </Button>
        }
      />

      {notice ? <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Notice> : null}

      {assignOpen ? (
        <section className="ws-panel" aria-labelledby="assign-title">
          <div className="ws-panel-head">
            <div>
              <p className="eyebrow-label">COURSE ACCESS</p>
              <h2 id="assign-title">Assign a course</h2>
            </div>
            <button type="button" className="ws-inline-link" onClick={() => setAssignOpen(false)}>Cancel</button>
          </div>
          <form className="ws-form-grid" onSubmit={(event) => void submitAssign(event)} noValidate>
            <div className="ws-field">
              <label htmlFor="assignment-profile_id">Account</label>
              <select
                id="assignment-profile_id"
                value={form.profile_id}
                onChange={(event) => {
                  const account = accountsData?.items.find((item) => item.account_id === event.target.value);
                  setForm({
                    ...form,
                    profile_id: event.target.value,
                    member_role: account?.role === "student" ? "student" : "instructor",
                  });
                }}
                aria-invalid={Boolean(errors.profile_id)}
              >
                <option value="">Choose an account</option>
                {(accountsData?.items || []).map((account) => (
                  <option key={account.account_id} value={account.account_id} disabled={account.account_status !== "active"}>
                    {account.display_name || account.pseudonym} · {account.email || account.role}
                    {account.account_status !== "active" ? " (deactivated)" : ""}
                  </option>
                ))}
              </select>
              <FieldError>{errors.profile_id}</FieldError>
            </div>
            <div className="ws-field">
              <label htmlFor="assignment-course_id">Course</label>
              <select id="assignment-course_id" value={form.course_id} onChange={(event) => setForm({ ...form, course_id: event.target.value })} aria-invalid={Boolean(errors.course_id)}>
                <option value="">Choose a course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
              <FieldError>{errors.course_id}</FieldError>
            </div>
            <div className="ws-field">
              <label htmlFor="assignment-member_role">Assignment role</label>
              <select id="assignment-member_role" value={form.member_role} onChange={(event) => setForm({ ...form, member_role: event.target.value })}>
                <option value="instructor">Instructor (faculty)</option>
                <option value="student">Student enrollment</option>
              </select>
              <p className="ws-muted">A student account cannot be assigned as an instructor.</p>
            </div>
            <div className="ws-inline-actions full">
              <Button variant="primary" type="submit" disabled={busy !== ""}>
                {busy === "assign" ? "Saving…" : "Save assignment"}
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <Toolbar label="Assignment filters">
        <SearchField value={search} onChange={setSearch} onSubmit={() => updateQuery({ q: search || null })} placeholder="Search account or course" label="Search assignments" />
        <SelectField
          label="Course"
          value={courseFilter}
          onChange={(value) => updateQuery({ course: value || null })}
          options={courses.map((course) => ({ value: course.id, label: course.title }))}
          includeAll
          allLabel="All courses"
        />
        <SelectField
          label="Role"
          value={roleFilter}
          onChange={(value) => updateQuery({ role: value || null })}
          options={[
            { value: "instructor", label: "Instructor" },
            { value: "student", label: "Student" },
          ]}
          includeAll
          allLabel="All roles"
        />
        <SelectField
          label="Status"
          value={statusFilter}
          onChange={(value) => updateQuery({ status: value === "all" ? null : value })}
          options={[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "pending", label: "Pending" },
          ]}
        />
        {courseFilter || roleFilter || statusFilter !== "all" || appliedSearch ? (
          <Button variant="quiet" onClick={() => { setSearch(""); updateQuery({ course: null, role: null, status: null, q: null }); }}>
            Clear filters
          </Button>
        ) : null}
      </Toolbar>

      {error ? (
        <Notice tone="error">
          Assignments could not load. {error}{" "}
          <button type="button" className="ws-inline-link" onClick={reload}>Retry</button>
        </Notice>
      ) : null}
      {loading && !data ? <LoadingPanel label="Loading course assignments…" /> : null}

      {!loading && data && rows.length === 0 ? (
        <EmptyState
          title="No assignments in this view"
          action={<Button variant="primary" onClick={() => setAssignOpen(true)}>Assign course</Button>}
        >
          {courseFilter || roleFilter || appliedSearch
            ? "Change the course, role or search, or clear the filters."
            : "Assign an instructor or enroll a student to give them course access."}
        </EmptyState>
      ) : null}

      {rows.length > 0 ? (
        <div className="ws-table-wrap">
          <table className="ws-table">
            <caption className="sr-only">Course assignments</caption>
            <thead>
              <tr>
                <th scope="col">Account</th>
                <th scope="col">Role</th>
                <th scope="col">Course</th>
                <th scope="col">Status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.membership_id}>
                  <td data-label="Account">
                    <strong>{row.display_name || row.pseudonym}</strong>
                    <span className="ws-row-meta">{row.email || "No email on record"} · {row.account_role}</span>
                  </td>
                  <td data-label="Role">{row.member_role === "instructor" ? "Instructor" : "Student"}</td>
                  <td data-label="Course">
                    {row.course.title}
                    <span className="ws-row-meta">{row.course.code}</span>
                  </td>
                  <td data-label="Status">
                    <StatusChip state={row.status} label={row.status === "active" ? "Active" : row.status === "pending" ? "Pending" : "Removed"} tone={row.status === "active" ? "good" : row.status === "pending" ? "wait" : "muted"} />
                    <span className="ws-row-meta">Assigned {formatDateTime(row.assigned_at)}</span>
                  </td>
                  <td data-label="Action">
                    <div className="ws-inline-actions">
                      {row.status === "pending" ? (
                        <Button variant="outline" disabled={busy !== ""} onClick={() => void doConfirm(row)}>
                          {busy === "confirm" ? "Confirming…" : "Confirm assignment"}
                        </Button>
                      ) : null}
                      <Button variant="danger" disabled={busy !== ""} onClick={() => setRemoveTarget(row)}>
                        Remove access
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="ws-footnote">Removing access preserves the account, its submissions and every audit event.</p>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Remove course access"
        confirmLabel="Remove access"
        tone="danger"
        busy={busy === "remove"}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => void doRemove()}
      >
        {removeTarget ? (
          <>
            <p>
              <strong>{removeTarget.display_name || removeTarget.pseudonym}</strong> loses {removeTarget.member_role} access
              to <strong>{removeTarget.course.title}</strong>.
            </p>
            <ul className="ws-plain-list">
              <li>Existing attempts, materials and activity versions are preserved.</li>
              <li>The account and its other course assignments are unchanged.</li>
            </ul>
          </>
        ) : null}
      </ConfirmDialog>
    </>
  );
}

export default function Page() {
  return (
    <WorkspaceSuspense label="assignments">
      <AdminAssignments />
    </WorkspaceSuspense>
  );
}
