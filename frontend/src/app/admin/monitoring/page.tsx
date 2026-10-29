"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getErrorMessage } from "@/lib/api";
import { WorkspaceSuspense } from "@/components/workspace/workspace-provider";
import {
  Button,
  EmptyState,
  LoadingPanel,
  Notice,
  PageHeading,
  prettify,
  SearchField,
  SelectField,
  StatusChip,
  Toolbar,
  useApi,
} from "@/components/workspace/ui";
import {
  formatDateTime,
  retryJob,
  serviceStateLabel,
  type JobRecord,
  type MonitoringResponse,
} from "@/lib/workspace";

const SERVICE_OPTIONS = [
  { value: "api", label: "API" },
  { value: "rag_index", label: "RAG indexing" },
  { value: "code_runner", label: "Code-assessment runner" },
  { value: "prediction", label: "Prediction service" },
];

const JOB_STATUS_OPTIONS = [
  { value: "failed", label: "Failed" },
  { value: "running", label: "Running" },
  { value: "queued", label: "Queued" },
  { value: "completed", label: "Completed" },
];

function Monitoring() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const service = searchParams.get("service") || "";
  const jobStatus = searchParams.get("status") || "";
  const appliedSearch = searchParams.get("q") || "";
  const auditSearch = searchParams.get("audit") || "";
  const [search, setSearch] = useState(appliedSearch);
  const [auditQuery, setAuditQuery] = useState(auditSearch);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "warning"; text: string } | null>(null);
  const [busyJob, setBusyJob] = useState<string | null>(null);
  const [detailJob, setDetailJob] = useState<JobRecord | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(appliedSearch);
    setAuditQuery(auditSearch);
  }, [appliedSearch, auditSearch]);

  const path = useMemo(
    () =>
      `/admin/monitoring?${new URLSearchParams({
        ...(service ? { service } : {}),
        ...(jobStatus ? { status: jobStatus } : {}),
        ...(appliedSearch ? { search: appliedSearch } : {}),
        ...(auditSearch ? { audit_search: auditSearch } : {}),
      }).toString()}`,
    [appliedSearch, auditSearch, jobStatus, service],
  );
  const { data, error, loading, reload } = useApi<MonitoringResponse>(path);

  function updateQuery(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  async function doRetry(job: JobRecord) {
    setBusyJob(job.id);
    setNotice(null);
    try {
      const result = await retryJob(job.id);
      setNotice({ tone: "success", text: result.message });
      setDetailJob(null);
      reload();
    } catch (caught) {
      setNotice({ tone: "error", text: `${getErrorMessage(caught)} The job status is unchanged.` });
    } finally {
      setBusyJob(null);
    }
  }

  const jobs = data?.jobs || [];
  const hasJobFilters = Boolean(service || jobStatus || appliedSearch);

  return (
    <>
      <PageHeading
        eyebrow="ADMINISTRATION"
        title="Platform monitoring"
        description="Service health, retryable processing jobs and the read-only audit trail. States come from recorded activity, not static labels."
        status={
          data ? (
            <StatusChip
              state={data.overall}
              label={`Overall: ${serviceStateLabel[data.overall] || data.overall}`}
              tone={data.overall === "healthy" ? "good" : data.overall === "failed" ? "bad" : "wait"}
            />
          ) : undefined
        }
        actions={<Button variant="outline" onClick={reload}>Refresh</Button>}
      />

      {notice ? <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Notice> : null}

      {error ? (
        <Notice tone="error">
          Monitoring could not load. {error}{" "}
          <button type="button" className="ws-inline-link" onClick={reload}>Retry</button>
        </Notice>
      ) : null}
      {loading && !data ? <LoadingPanel label="Checking platform services…" /> : null}

      {data ? (
        <div className="ws-health-grid" aria-label="Service health">
          {data.services.map((health) => (
            <article className={`ws-health-card ${health.status}`} key={health.service}>
              <div className="ws-health-head">
                <h2>{health.label}</h2>
                <StatusChip state={health.status} label={serviceStateLabel[health.status]} tone={health.status === "healthy" ? "good" : health.status === "failed" ? "bad" : "wait"} />
              </div>
              <p>{health.detail}</p>
              <span className="ws-row-meta">Last checked {formatDateTime(health.last_checked_at)}</span>
              {health.trace_id ? <span className="ws-row-meta">Trace {health.trace_id}</span> : null}
            </article>
          ))}
        </div>
      ) : null}

      <section className="ws-panel" aria-labelledby="jobs-title">
        <div className="ws-panel-head">
          <div>
            <p className="eyebrow-label">PROCESSING</p>
            <h2 id="jobs-title">Jobs</h2>
          </div>
          {data ? (
            <span className="ws-chip-row">
              <StatusChip state="info" label={`${data.job_counts.failed} failed`} tone={data.job_counts.failed ? "bad" : "good"} />
              <StatusChip state="info" label={`${data.job_counts.retryable} retryable`} tone="wait" />
            </span>
          ) : null}
        </div>

        <Toolbar label="Job filters">
          <SearchField value={search} onChange={setSearch} onSubmit={() => updateQuery({ q: search || null })} placeholder="Search job or trace ID" label="Search jobs" />
          <SelectField label="Service" value={service} onChange={(value) => updateQuery({ service: value || null })} options={SERVICE_OPTIONS} includeAll allLabel="All services" />
          <SelectField label="Status" value={jobStatus} onChange={(value) => updateQuery({ status: value || null })} options={JOB_STATUS_OPTIONS} includeAll allLabel="All statuses" />
          {hasJobFilters ? (
            <Button variant="quiet" onClick={() => { setSearch(""); updateQuery({ service: null, status: null, q: null }); }}>
              Clear filters
            </Button>
          ) : null}
        </Toolbar>

        {!loading && data && jobs.length === 0 ? (
          <EmptyState title={hasJobFilters ? "No jobs match these filters" : "No processing jobs recorded"}>
            {hasJobFilters
              ? "Try another service, status or trace search. Filters stay until cleared."
              : "Jobs appear here when a PDF upload or reprocess starts."}
          </EmptyState>
        ) : null}

        {jobs.length > 0 ? (
          <div className="ws-table-wrap">
            <table className="ws-table">
              <caption className="sr-only">Processing jobs</caption>
              <thead>
                <tr>
                  <th scope="col">Job</th>
                  <th scope="col">Status</th>
                  <th scope="col">Attempts</th>
                  <th scope="col">Trace</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td data-label="Job">
                      <strong>{job.document_title || job.job_type}</strong>
                      <span className="ws-row-meta">{job.service} · {formatDateTime(job.created_at)}</span>
                      {job.cause ? <span className="ws-row-meta">Cause: {job.cause}</span> : null}
                    </td>
                    <td data-label="Status">
                      <StatusChip
                        state={job.status === "completed" ? "ready" : job.status === "failed" ? "failed" : "processing"}
                        label={prettify(job.status)}
                        tone={job.status === "completed" ? "good" : job.status === "failed" ? "bad" : "wait"}
                      />
                    </td>
                    <td data-label="Attempts">{job.attempts} / {job.max_attempts}</td>
                    <td data-label="Trace"><code>{job.trace_id}</code></td>
                    <td data-label="Action">
                      <div className="ws-inline-actions">
                        <Button variant="quiet" onClick={() => setDetailJob(job)}>View cause</Button>
                        {job.status === "failed" && job.retryable ? (
                          <Button variant="outline" disabled={busyJob !== null} onClick={() => void doRetry(job)}>
                            {busyJob === job.id ? "Retrying…" : "Retry job"}
                          </Button>
                        ) : job.status === "failed" ? (
                          <span className="ws-muted">Not retryable</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="ws-panel" aria-labelledby="audit-title">
        <div className="ws-panel-head">
          <div>
            <p className="eyebrow-label">GOVERNANCE</p>
            <h2 id="audit-title">Audit trail</h2>
          </div>
          <span className="ws-muted">Read-only</span>
        </div>
        <Toolbar label="Audit search">
          <SearchField value={auditQuery} onChange={setAuditQuery} onSubmit={() => updateQuery({ audit: auditQuery || null })} placeholder="Search audit events" label="Search audit events" />
          {auditSearch ? (
            <Button variant="quiet" onClick={() => { setAuditQuery(""); updateQuery({ audit: null }); }}>Clear search</Button>
          ) : null}
        </Toolbar>
        {data && data.audit.length === 0 ? (
          <EmptyState title="No audit events match this view">
            Consequential changes such as publication, deactivation, archival and configuration edits appear here.
          </EmptyState>
        ) : null}
        {data && data.audit.length > 0 ? (
          <ul className="ws-compact-list">
            {data.audit.map((event) => (
              <li key={event.id}>
                <strong>{event.summary}</strong>
                <span>{event.actor} · {event.action} · {formatDateTime(event.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <p className="ws-footnote">Retry appears only for a failed job the platform marks retryable; unsearchable PDFs need a replacement.</p>

      {detailJob ? (
        <section className="ws-panel ws-job-detail" role="region" aria-label="Job detail">
          <div className="ws-panel-head">
            <div>
              <p className="eyebrow-label">JOB DETAIL</p>
              <h2>{detailJob.document_title || detailJob.job_type}</h2>
            </div>
            <button type="button" className="ws-inline-link" onClick={() => setDetailJob(null)}>Close</button>
          </div>
          <dl className="ws-summary-list">
            <div><dt>Status</dt><dd>{detailJob.status}</dd></div>
            <div><dt>Human-readable cause</dt><dd>{detailJob.cause || "No failure cause is recorded for this job."}</dd></div>
            <div><dt>Trace identifier</dt><dd><code>{detailJob.trace_id}</code></dd></div>
            <div><dt>Attempts</dt><dd>{detailJob.attempts} of {detailJob.max_attempts}</dd></div>
            <div><dt>Retryable</dt><dd>{detailJob.retryable ? "Yes — safe to retry" : "No — correct the input instead"}</dd></div>
            <div><dt>Last checked</dt><dd>{formatDateTime(detailJob.last_checked_at)}</dd></div>
          </dl>
          {detailJob.status === "failed" && detailJob.retryable ? (
            <Button variant="primary" disabled={busyJob !== null} onClick={() => void doRetry(detailJob)}>
              {busyJob === detailJob.id ? "Retrying…" : "Retry this job"}
            </Button>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

export default function Page() {
  return (
    <WorkspaceSuspense label="monitoring">
      <Monitoring />
    </WorkspaceSuspense>
  );
}
