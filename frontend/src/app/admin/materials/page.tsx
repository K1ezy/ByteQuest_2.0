"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { getErrorMessage } from "@/lib/api";
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
  adminArchiveMaterial,
  adminGetMaterialDownload,
  adminRestoreMaterial,
  adminRetryMaterial,
  adminUpdateMaterial,
  adminUploadMaterial,
  formatDateTime,
  materialStateLabel,
  type AdminMaterialList,
  type MaterialSummary,
} from "@/lib/workspace";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "attention", label: "Needs attention" },
  { value: "ready", label: "Ready" },
  { value: "processing", label: "Processing" },
  { value: "needs_review", label: "Needs review" },
  { value: "failed", label: "Failed" },
  { value: "archived", label: "Archived" },
];

function AdminMaterials() {
  const { courses } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const courseFilter = searchParams.get("course") || "";
  const status = searchParams.get("status") || "all";
  const appliedSearch = searchParams.get("q") || "";
  const [search, setSearch] = useState(appliedSearch);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "warning"; text: string } | null>(null);
  const [busy, setBusy] = useState<"upload" | "edit" | "archive" | "restore" | "retry" | "download" | "">("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadOpen, setUploadOpen] = useState(false);
  const [upload, setUpload] = useState({ course_id: "", title: "", description: "", language: "python", topic: "", file: null as File | null });
  const [editing, setEditing] = useState<MaterialSummary | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", topic: "" });
  const [archiveTarget, setArchiveTarget] = useState<MaterialSummary | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(appliedSearch);
  }, [appliedSearch]);

  const path = useMemo(
    () =>
      `/admin/materials?${new URLSearchParams({
        ...(courseFilter ? { course_id: courseFilter } : {}),
        ...(status && status !== "all" ? { status } : {}),
        ...(appliedSearch ? { search: appliedSearch } : {}),
      }).toString()}`,
    [appliedSearch, courseFilter, status],
  );
  const { data, error, loading, reload } = useApi<AdminMaterialList>(path);

  function updateQuery(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  async function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!upload.course_id) found.course_id = "Choose a course.";
    if (upload.title.trim().length < 2) found.title = "Enter a title of at least 2 characters.";
    if (!upload.file) found.file = "Choose a PDF file.";
    else if (!upload.file.name.toLowerCase().endsWith(".pdf")) found.file = "Only PDF files are supported.";
    setErrors(found);
    if (Object.keys(found).length > 0 || !upload.file) return;
    const formData = new FormData();
    formData.append("course_id", upload.course_id);
    formData.append("title", upload.title.trim());
    formData.append("language_tag", upload.language);
    formData.append("file", upload.file);
    if (upload.description.trim()) formData.append("description", upload.description.trim());
    if (upload.topic.trim()) formData.append("topic_concept", upload.topic.trim());
    setBusy("upload");
    setNotice(null);
    try {
      const result = await adminUploadMaterial(formData);
      setNotice({ tone: result.material.state === "ready" ? "success" : "warning", text: result.message });
      setUploadOpen(false);
      setUpload({ ...upload, title: "", description: "", topic: "", file: null });
      if (fileRef.current) fileRef.current.value = "";
      reload();
    } catch (caught) {
      setNotice({ tone: "error", text: `${getErrorMessage(caught)} Your form values are still here.` });
    } finally {
      setBusy("");
    }
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    if (editForm.title.trim().length < 2) {
      setErrors({ title: "Enter a title of at least 2 characters." });
      return;
    }
    setBusy("edit");
    try {
      const result = await adminUpdateMaterial(editing.document_id, {
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        topic_concept: editForm.topic.trim() || null,
      });
      setNotice({ tone: "success", text: result.message });
      setEditing(null);
      reload();
    } catch (caught) {
      setNotice({ tone: "error", text: getErrorMessage(caught) });
    } finally {
      setBusy("");
    }
  }

  async function confirmArchive() {
    if (!archiveTarget) return;
    setBusy("archive");
    try {
      const result = await adminArchiveMaterial(archiveTarget.document_id);
      setNotice({ tone: "success", text: result.message });
      setArchiveTarget(null);
      reload();
    } catch (caught) {
      setNotice({ tone: "error", text: getErrorMessage(caught) });
    } finally {
      setBusy("");
    }
  }

  async function doRestore(material: MaterialSummary) {
    setBusy("restore");
    try {
      const result = await adminRestoreMaterial(material.document_id);
      setNotice({ tone: "success", text: result.message });
      reload();
    } catch (caught) {
      setNotice({ tone: "error", text: getErrorMessage(caught) });
    } finally {
      setBusy("");
    }
  }

  async function doRetry(material: MaterialSummary) {
    setBusy("retry");
    try {
      const result = await adminRetryMaterial(material.document_id);
      setNotice({ tone: result.material.state === "ready" ? "success" : "error", text: result.message });
      reload();
    } catch (caught) {
      setNotice({ tone: "error", text: getErrorMessage(caught) });
    } finally {
      setBusy("");
    }
  }

  async function doDownload(material: MaterialSummary) {
    setBusy("download");
    try {
      const result = await adminGetMaterialDownload(material.document_id);
      window.location.assign(result.download_url);
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
        title="Materials"
        description="Operational status across courses. Administrators upload, edit metadata, retry safe failures and archive; academic review stays with faculty."
        status={data ? <StatusChip state="active" label={`${data.total} in this view`} /> : undefined}
        actions={
          <Button variant="primary" onClick={() => setUploadOpen((open) => !open)}>
            {uploadOpen ? "Close form" : "Upload PDF"}
          </Button>
        }
      />

      {notice ? <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Notice> : null}

      {uploadOpen ? (
        <section className="ws-panel" aria-labelledby="admin-upload-title">
          <div className="ws-panel-head">
            <div>
              <p className="eyebrow-label">NEW MATERIAL</p>
              <h2 id="admin-upload-title">Upload a course PDF</h2>
            </div>
            <button type="button" className="ws-inline-link" onClick={() => setUploadOpen(false)}>Cancel</button>
          </div>
          <form className="ws-form-grid" onSubmit={(event) => void submitUpload(event)} noValidate>
            <div className="ws-field">
              <label htmlFor="admin-material-course">Course</label>
              <select id="admin-material-course" value={upload.course_id} onChange={(event) => setUpload({ ...upload, course_id: event.target.value })} aria-invalid={Boolean(errors.course_id)}>
                <option value="">Choose a course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
              <FieldError>{errors.course_id}</FieldError>
            </div>
            <div className="ws-field">
              <label htmlFor="admin-material-title">Title</label>
              <input id="admin-material-title" value={upload.title} onChange={(event) => setUpload({ ...upload, title: event.target.value })} aria-invalid={Boolean(errors.title)} />
              <FieldError>{errors.title}</FieldError>
            </div>
            <div className="ws-field">
              <label htmlFor="admin-material-file">PDF file</label>
              <input ref={fileRef} id="admin-material-file" type="file" accept="application/pdf,.pdf" onChange={(event) => setUpload({ ...upload, file: event.target.files?.[0] || null })} aria-invalid={Boolean(errors.file)} />
              <FieldError>{errors.file}</FieldError>
            </div>
            <div className="ws-field">
              <label htmlFor="admin-material-topic">Topic (optional)</label>
              <input id="admin-material-topic" maxLength={100} value={upload.topic} onChange={(event) => setUpload({ ...upload, topic: event.target.value })} />
            </div>
            <div className="ws-field full">
              <label htmlFor="admin-material-description">Description (optional)</label>
              <textarea id="admin-material-description" rows={2} maxLength={4000} value={upload.description} onChange={(event) => setUpload({ ...upload, description: event.target.value })} />
            </div>
            <div className="ws-inline-actions full">
              <Button variant="primary" type="submit" disabled={busy !== ""}>
                {busy === "upload" ? "Uploading and indexing…" : "Upload PDF"}
              </Button>
              <span className="ws-muted">The file is validated before processing; failures are recorded with a trace.</span>
            </div>
          </form>
        </section>
      ) : null}

      {editing ? (
        <section className="ws-panel" aria-labelledby="admin-edit-title">
          <div className="ws-panel-head">
            <div>
              <p className="eyebrow-label">METADATA</p>
              <h2 id="admin-edit-title">Edit {editing.title}</h2>
            </div>
            <button type="button" className="ws-inline-link" onClick={() => setEditing(null)}>Cancel</button>
          </div>
          <form className="ws-form-grid" onSubmit={(event) => void submitEdit(event)} noValidate>
            <div className="ws-field">
              <label htmlFor="admin-edit-title-input">Title</label>
              <input id="admin-edit-title-input" value={editForm.title} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} aria-invalid={Boolean(errors.title)} />
              <FieldError>{errors.title}</FieldError>
            </div>
            <div className="ws-field">
              <label htmlFor="admin-edit-topic">Topic (optional)</label>
              <input id="admin-edit-topic" maxLength={100} value={editForm.topic} onChange={(event) => setEditForm({ ...editForm, topic: event.target.value })} />
            </div>
            <div className="ws-field full">
              <label htmlFor="admin-edit-description">Description (optional)</label>
              <textarea id="admin-edit-description" rows={2} maxLength={4000} value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} />
            </div>
            <div className="ws-inline-actions full">
              <Button variant="primary" type="submit" disabled={busy !== ""}>
                {busy === "edit" ? "Saving…" : "Save metadata"}
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <Toolbar label="Material filters">
        <SearchField value={search} onChange={setSearch} onSubmit={() => updateQuery({ q: search || null })} placeholder="Search materials" label="Search materials" />
        <SelectField label="Course" value={courseFilter} onChange={(value) => updateQuery({ course: value || null })} options={courses.map((course) => ({ value: course.id, label: course.title }))} includeAll allLabel="All courses" />
        <SelectField label="Processing" value={status} onChange={(value) => updateQuery({ status: value === "all" ? null : value })} options={STATUS_OPTIONS} />
        {courseFilter || status !== "all" || appliedSearch ? (
          <Button variant="quiet" onClick={() => { setSearch(""); updateQuery({ course: null, status: null, q: null }); }}>
            Clear filters
          </Button>
        ) : null}
      </Toolbar>

      {error ? (
        <Notice tone="error">
          Materials could not load. {error}{" "}
          <button type="button" className="ws-inline-link" onClick={reload}>Retry</button>
        </Notice>
      ) : null}
      {loading && !data ? <LoadingPanel label="Loading materials…" /> : null}

      {!loading && data && rows.length === 0 ? (
        <EmptyState
          title="No materials match this view"
          action={<Button variant="primary" onClick={() => setUploadOpen(true)}>Upload PDF</Button>}
        >
          Change the course or processing status, or clear the filters.
        </EmptyState>
      ) : null}

      {rows.length > 0 ? (
        <div className="ws-table-wrap">
          <table className="ws-table">
            <caption className="sr-only">Course materials</caption>
            <thead>
              <tr>
                <th scope="col">Material</th>
                <th scope="col">Course</th>
                <th scope="col">Version</th>
                <th scope="col">Processing</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((material) => (
                <tr key={material.document_id}>
                  <td data-label="Material">
                    <strong>{material.title}</strong>
                    <span className="ws-row-meta">{material.filename || "Stored PDF"} · {material.total_chunks} passages · uploaded by {material.uploaded_by}</span>
                    <span className="ws-row-meta">Uploaded {formatDateTime(material.created_at)}</span>
                    {material.processing_error ? <span className="ws-row-meta">Cause: {material.processing_error}</span> : null}
                  </td>
                  <td data-label="Course">{material.course?.title || "Unassigned"}</td>
                  <td data-label="Version">v{material.version_number}</td>
                  <td data-label="Processing">
                    <StatusChip state={material.state} label={materialStateLabel[material.state]} />
                    <span className="ws-row-meta">{material.draft_count} linked draft(s)</span>
                  </td>
                  <td data-label="Action">
                    <div className="ws-inline-actions">
                      <Button variant="outline" disabled={busy !== ""} onClick={() => void doDownload(material)}>
                        {busy === "download" ? "Preparing…" : "Download"}
                      </Button>
                      {material.state === "failed" && material.can_retry ? (
                        <Button variant="outline" disabled={busy !== ""} onClick={() => void doRetry(material)}>
                          {busy === "retry" ? "Retrying…" : "Retry"}
                        </Button>
                      ) : null}
                      <Button
                        variant="quiet"
                        disabled={busy !== ""}
                        onClick={() => {
                          setEditing(material);
                          setEditForm({ title: material.title, description: material.description || "", topic: material.topic_concept || "" });
                          setErrors({});
                        }}
                      >
                        Edit metadata
                      </Button>
                      {material.archived_at ? (
                        <Button variant="quiet" disabled={busy !== ""} onClick={() => void doRestore(material)}>
                          Restore
                        </Button>
                      ) : (
                        <Button variant="danger" disabled={busy !== ""} onClick={() => setArchiveTarget(material)}>
                          Archive
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="ws-footnote">Administrators do not approve drafts, edit quiz keys, edit hidden tests or change grades.</p>

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="Archive this material"
        confirmLabel="Archive material"
        tone="danger"
        busy={busy === "archive"}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => void confirmArchive()}
      >
        {archiveTarget ? (
          <>
            <p>
              <strong>{archiveTarget.title}</strong> version {archiveTarget.version_number} stops being available for new
              generated drafts.
            </p>
            <ul className="ws-plain-list">
              <li>{archiveTarget.draft_count} linked draft(s) keep their cited pages.</li>
              <li>The stored PDF stays downloadable for audit.</li>
              <li>Existing activities and student attempts are unchanged.</li>
            </ul>
          </>
        ) : null}
      </ConfirmDialog>
    </>
  );
}

export default function Page() {
  return (
    <WorkspaceSuspense label="materials">
      <AdminMaterials />
    </WorkspaceSuspense>
  );
}
