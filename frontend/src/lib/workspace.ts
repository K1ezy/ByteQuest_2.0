"use client";

import { apiRequest } from "@/lib/api";

/** Typed calls for the faculty and administrator workspace. All of them use
 * the application's single API client so auth, errors and retries stay
 * consistent with the student screens. */

export type WorkspaceRole = "faculty" | "admin";

export interface CourseSummary {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  status?: string;
  student_count?: number;
  instructor_count?: number;
  draft_count?: number;
  attention_count?: number;
  activity_count?: number;
  material_count?: number;
}

export interface CourseList {
  courses: CourseSummary[];
  default_course_id: string | null;
  timezone?: string;
}

export function queryString(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
}

export function getFacultyCourses() {
  return apiRequest<CourseList>("/faculty/courses");
}

export function getAdminCourses() {
  return apiRequest<{ courses: CourseSummary[] }>("/admin/courses");
}

export function createCourse(payload: { code: string; title: string; description?: string }) {
  return apiRequest<{ course: CourseSummary; message: string }>("/admin/courses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* ------------------------------------------------------------------ faculty */

export interface QueueItem {
  kind: "draft" | "material" | "activity" | "account" | "job";
  id: string;
  title: string;
  detail: string;
  status: string;
  severity: "bad" | "wait" | "info";
  course: CourseSummary | null;
  updated_at: string | null;
  href: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  summary: string;
  actor: string;
  created_at: string | null;
}

export interface FacultyDashboard {
  course: CourseSummary;
  counts: {
    drafts_awaiting_review: number;
    materials_needing_attention: number;
    upcoming_activities: number;
    class_progress_percent: number;
    active_learners: number;
  };
  action_queue: QueueItem[];
  queue_hrefs: { drafts: string; materials: string; activities: string; performance: string };
  upcoming: {
    id: string;
    title: string;
    activity_type: string;
    opens_at: string | null;
    closes_at: string | null;
    state: string;
    href: string;
  }[];
  class_snapshot: {
    active_learners: number;
    published_activities: number;
    average_completion_percent: number;
    average_score: number | null;
    need_follow_up: number;
  };
  recent_changes: AuditEntry[];
}

export interface MaterialSummary {
  document_id: string;
  document_family_id: string;
  title: string;
  filename: string | null;
  description?: string | null;
  topic_concept?: string | null;
  language?: string;
  version_number: number;
  is_current: boolean;
  archived_at: string | null;
  processing_status: string;
  state: "ready" | "processing" | "needs_review" | "failed" | "archived";
  processing_error: string | null;
  total_chunks: number;
  file_size_bytes: number | null;
  indexed_at: string | null;
  created_at: string | null;
  course_id?: string | null;
  draft_count: number;
  can_retry: boolean;
  versions?: { document_id: string; version_number: number; state: string; created_at: string | null; is_current: boolean }[];
  course?: { id: string; code: string; title: string } | null;
  uploaded_by?: string;
  downloadable?: boolean;
}

export interface MaterialList {
  course: CourseSummary;
  items: MaterialSummary[];
  total: number;
  counts: Record<string, number>;
  filters: { statuses: string[] };
}

export interface DraftListItem {
  activity_id: string;
  title: string | null;
  activity_type: "quiz" | "challenge";
  topic_concept: string;
  draft_state: "pending" | "ready" | "rejected" | "published";
  review_status: string;
  rejection_reason: string | null;
  content_version: number;
  version_number: number;
  judge0_verified: boolean;
  attempt_count: number;
  citation_count: number;
  question_count: number;
  test_case_count: number;
  created_at: string | null;
  updated_at: string | null;
  course: CourseSummary;
  material: {
    document_id: string;
    title: string;
    version_number: number;
    state: string;
    archived_at: string | null;
  } | null;
}

export interface Citation {
  id: string;
  chunk_id: string | null;
  document_id: string | null;
  document_title: string;
  version_number: number | null;
  page_number: number | null;
  excerpt: string;
  available: boolean;
}

export interface TestCasePayload {
  order_index: number;
  stdin: string;
  expected_stdout: string;
  time_limit_ms: number;
  memory_limit_kb: number;
  is_hidden: boolean;
  weight: number;
}

export interface StudentPreview {
  activity_id: string;
  activity_type: "quiz" | "challenge";
  title: string | null;
  topic_concept: string;
  problem_statement: string | null;
  difficulty_level: number;
  xp_reward: number;
  state: string;
  opens_at: string | null;
  closes_at: string | null;
  starter_code?: string | null;
  sample_cases?: { order_index: number; stdin: string; expected_stdout: string }[];
  hidden_case_count?: number;
  questions?: { id: string; prompt: string; options: { key: string; text: string }[] }[];
}

export interface ActivityDetail {
  activity_id: string;
  activity_type: "quiz" | "challenge";
  course_id: string | null;
  course: CourseSummary;
  title: string | null;
  topic_concept: string;
  problem_statement: string | null;
  difficulty_level: number;
  xp_reward: number;
  review_status: string;
  draft_state?: string;
  state: string;
  judge0_verified: boolean;
  reviewed_by: string | null;
  rejection_reason?: string | null;
  content_version: number;
  version_number: number;
  version_of: string | null;
  opens_at: string | null;
  closes_at: string | null;
  published_at: string | null;
  archived_at: string | null;
  created_at: string | null;
  updated_at?: string | null;
  source_document_id: string | null;
  generation: { model_version: string | null; prompt_version: string | null; generated_at: string | null; citation_count: number };
  citations: Citation[];
  student_preview: StudentPreview;
  starter_code?: string | null;
  reference_solution_code?: string | null;
  test_cases?: TestCasePayload[];
  quiz_questions?: { questions: { id: string; prompt: string; options: { key: string; text: string }[]; correct_answer: string }[] } | null;
  verification_log?: Record<string, unknown>;
  attempt_count?: number;
  grading_locked?: boolean;
  material?: MaterialSummary | null;
  versions?: { activity_id: string; version_number: number; state: string; created_at: string | null }[];
}

export interface DraftList {
  course: CourseSummary;
  items: DraftListItem[];
  total: number;
  counts: Record<string, number>;
  filters: { materials: { document_id: string; title: string; version_number: number }[]; statuses: string[] };
}

export interface ActivityListItem {
  activity_id: string;
  title: string | null;
  activity_type: "quiz" | "challenge";
  topic_concept: string;
  state: "draft" | "scheduled" | "open" | "closed" | "archived";
  review_status: string;
  version_number: number;
  version_of: string | null;
  judge0_verified: boolean;
  attempt_count: number;
  grading_locked: boolean;
  question_count: number;
  test_case_count: number;
  opens_at: string | null;
  closes_at: string | null;
  created_at: string | null;
  course: CourseSummary;
}

export interface ActivityList {
  course: CourseSummary;
  items: ActivityListItem[];
  total: number;
  counts: Record<string, number>;
  filters: { statuses: string[] };
}

export interface PredictionView {
  status: "saved" | "unavailable";
  as_of: string | null;
  target_activity?: string | null;
  probability?: number;
  random_forest_probability?: number;
  label?: string;
  model_version?: string;
  advisory?: string;
  reason?: string;
}

export interface PerformanceRow {
  student_id: string;
  pseudonym: string;
  display_name: string | null;
  enrolled_language: string;
  completed_count: number;
  total_activities: number;
  attempt_count: number;
  latest_score: number | null;
  latest_at: string | null;
  prediction: PredictionView;
}

export interface PerformanceResponse {
  course: CourseSummary;
  activities: { activity_id: string; title: string; state: string }[];
  summary: {
    active_learners: number;
    published_activities: number;
    average_score: number | null;
    average_completion_percent: number | null;
    need_follow_up: number;
    selected_activity_id: string | null;
  };
  students: PerformanceRow[];
  empty_reason: string | null;
}

export interface StudentPerformance {
  student: {
    student_id: string;
    pseudonym: string;
    display_name: string | null;
    enrolled_language: string;
    xp_points: number;
    current_level: number;
  };
  course: CourseSummary;
  progress: { completed: number; total: number; percent: number };
  attempts: {
    attempt_id: string;
    activity_id: string;
    title: string;
    activity_type: string;
    score_percentage: number;
    is_successful: boolean;
    xp_awarded: number;
    created_at: string | null;
  }[];
  prediction: PredictionView;
}

export function getFacultyDashboard(courseId: string | null) {
  return apiRequest<FacultyDashboard>(`/faculty/dashboard${queryString({ course_id: courseId })}`);
}

export function getDrafts(params: {
  courseId: string | null;
  status?: string;
  materialId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}) {
  return apiRequest<DraftList>(
    `/faculty/drafts${queryString({
      course_id: params.courseId,
      status: params.status,
      material_id: params.materialId,
      date_from: params.dateFrom,
      date_to: params.dateTo,
      search: params.search,
    })}`,
  );
}

export function getDraft(activityId: string) {
  return apiRequest<ActivityDetail>(`/faculty/drafts/${activityId}`);
}

export function saveDraft(
  activityId: string,
  body: {
    content_version: number;
    title?: string;
    topic_concept?: string;
    problem_statement?: string;
    difficulty_level?: number;
    xp_reward?: number;
    starter_code?: string;
    reference_solution_code?: string;
    test_cases?: TestCasePayload[];
    quiz_questions?: unknown;
  },
) {
  return apiRequest<{ draft: ActivityDetail; saved: boolean; message: string }>(`/faculty/drafts/${activityId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function rejectDraft(activityId: string, reason: string) {
  return apiRequest<{ message: string; draft_state: string }>(`/faculty/drafts/${activityId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function approveDraft(activityId: string) {
  return apiRequest<{ message: string; review_status: string; published_at: string | null }>(
    `/faculty/drafts/${activityId}/approve`,
    { method: "POST", body: JSON.stringify({ confirm: true, student_preview_confirmed: true }) },
  );
}

export function getMaterials(params: { courseId: string | null; status?: string; search?: string }) {
  return apiRequest<MaterialList>(
    `/faculty/materials${queryString({ course_id: params.courseId, status: params.status, search: params.search })}`,
  );
}

export function uploadMaterial(formData: FormData, documentId?: string) {
  const path = documentId ? `/faculty/materials/${documentId}/versions` : "/faculty/materials";
  return apiRequest<{ message: string; material: MaterialSummary; job: { status: string; cause: string | null; trace_id: string } }>(
    path,
    { method: "POST", body: formData },
  );
}

export function updateMaterial(
  documentId: string,
  body: { title: string; description: string | null; language_tag: string; topic_concept: string | null },
) {
  return apiRequest<{ material: MaterialSummary; message: string }>(`/faculty/materials/${documentId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function archiveMaterial(documentId: string) {
  return apiRequest<{ material: MaterialSummary; message: string }>(`/faculty/materials/${documentId}/archive`, { method: "POST" });
}

export function restoreMaterial(documentId: string) {
  return apiRequest<{ material: MaterialSummary; message: string }>(`/faculty/materials/${documentId}/restore`, { method: "POST" });
}

export function retryMaterial(documentId: string) {
  return apiRequest<{ material: MaterialSummary; message: string; job: { status: string; cause: string | null; trace_id: string } }>(
    `/faculty/materials/${documentId}/retry`,
    { method: "POST" },
  );
}

export function getMaterialDownload(documentId: string) {
  return apiRequest<{ download_url: string }>(`/faculty/materials/${documentId}/download`);
}

export function getFacultyActivities(params: { courseId: string | null; status?: string; type?: string; search?: string }) {
  return apiRequest<ActivityList>(
    `/faculty/activities${queryString({
      course_id: params.courseId,
      status: params.status,
      type: params.type,
      search: params.search,
    })}`,
  );
}

export function createActivity(body: Record<string, unknown>) {
  return apiRequest<{ activity: ActivityDetail; message: string }>("/faculty/activities", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getActivity(activityId: string) {
  return apiRequest<ActivityDetail>(`/faculty/activities/${activityId}`);
}

export function updateActivity(activityId: string, body: Record<string, unknown>) {
  return apiRequest<{ activity: ActivityDetail; message: string }>(`/faculty/activities/${activityId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function scheduleActivity(activityId: string, opensAt: string | null, closesAt: string | null) {
  return apiRequest<{ activity: ActivityDetail; message: string }>(`/faculty/activities/${activityId}/schedule`, {
    method: "POST",
    body: JSON.stringify({ opens_at: opensAt, closes_at: closesAt }),
  });
}

export function publishActivity(activityId: string) {
  return apiRequest<{ activity: ActivityDetail; message: string }>(`/faculty/activities/${activityId}/publish`, {
    method: "POST",
    body: JSON.stringify({ confirm: true, preview_confirmed: true }),
  });
}

export function createActivityVersion(activityId: string) {
  return apiRequest<{ activity: ActivityDetail; message: string }>(`/faculty/activities/${activityId}/versions`, { method: "POST" });
}

export function verifyActivity(activityId: string) {
  return apiRequest<{ activity: ActivityDetail; message: string }>(`/faculty/activities/${activityId}/verify`, { method: "POST" });
}

export function getActivityPreview(activityId: string) {
  return apiRequest<{
    preview: StudentPreview;
    schedule: { opens_at: string | null; closes_at: string | null; state: string; timezone: string };
    grading: { hidden_test_cases: number; answer_key_questions: number; attempt_count: number };
    note: string;
  }>(`/faculty/activities/${activityId}/preview`);
}

export function getPerformance(params: { courseId: string | null; activityId?: string; search?: string }) {
  return apiRequest<PerformanceResponse>(
    `/faculty/performance${queryString({
      course_id: params.courseId,
      activity_id: params.activityId,
      search: params.search,
    })}`,
  );
}

export function getStudentPerformance(studentId: string, courseId: string | null) {
  return apiRequest<StudentPerformance>(`/faculty/performance/students/${studentId}${queryString({ course_id: courseId })}`);
}

/* -------------------------------------------------------------------- admin */

export interface AdminCounts {
  accounts_needing_action: number;
  failed_jobs: number;
  availability_changes: number;
  service_status: string;
  healthy_services: number;
  total_services: number;
}

export interface AdminDashboard {
  counts: AdminCounts;
  action_queue: QueueItem[];
  recent_changes: AuditEntry[];
  services: ServiceHealth[];
  overall: string;
}

export interface ServiceHealth {
  service: string;
  label: string;
  status: "healthy" | "stale" | "failed" | "unavailable";
  detail: string;
  last_checked_at: string | null;
  trace_id: string | null;
}

export interface AccountRecord {
  account_id: string;
  email: string | null;
  display_name: string | null;
  pseudonym: string;
  role: "student" | "instructor" | "admin";
  account_status: "active" | "deactivated";
  created_at: string | null;
  deactivated_at: string | null;
  course_access: {
    membership_id: string;
    course_id: string;
    course_code: string | null;
    course_title: string;
    member_role: string;
    status: string;
    assigned_at: string | null;
  }[];
  needs_action: boolean;
  action_reason: string | null;
}

export interface AccountList {
  items: AccountRecord[];
  total: number;
  counts: { all: number; attention: number; active: number; deactivated: number };
  filters: { roles: string[]; statuses: string[] };
}

export interface AdminMaterialList {
  items: MaterialSummary[];
  total: number;
  counts: Record<string, number>;
  courses: CourseSummary[];
}

export interface AdminActivity {
  activity_id: string;
  title: string | null;
  activity_type: string;
  topic_concept: string;
  state: string;
  review_status: string;
  opens_at: string | null;
  closes_at: string | null;
  closed_at: string | null;
  archived_at: string | null;
  published_at: string | null;
  version_number: number;
  attempt_count: number;
  enrolled_students: number | null;
  course: { id: string; code: string; title: string } | null;
}

export interface AdminActivityList {
  items: AdminActivity[];
  total: number;
  counts: Record<string, number>;
  courses: CourseSummary[];
  filters: { statuses: string[] };
}

export interface SettingRecord {
  key: string;
  service: string;
  service_label: string;
  label: string;
  description: string;
  value: number | string | boolean;
  value_type: "integer" | "string" | "boolean";
  min_value: number | null;
  max_value: number | null;
  version: number;
  updated_at: string | null;
  last_editor: string | null;
  last_editor_id: string | null;
}

export interface SettingsResponse {
  groups: { service: string; label: string; settings: SettingRecord[] }[];
  total: number;
}

export interface AssignmentRecord {
  membership_id: string;
  profile_id: string;
  email: string | null;
  display_name: string | null;
  pseudonym: string;
  account_role: string;
  account_status: string;
  member_role: "instructor" | "student";
  status: "active" | "pending" | "removed";
  assigned_at: string | null;
  course: { id: string; code: string; title: string };
}

export interface AssignmentList {
  items: AssignmentRecord[];
  total: number;
  counts: { all: number; active: number; pending: number };
}

export interface JobRecord {
  id: string;
  service: string;
  job_type: string;
  status: string;
  attempts: number;
  max_attempts: number;
  retryable: boolean;
  cause: string | null;
  trace_id: string;
  document_id: string | null;
  document_title: string | null;
  material_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_checked_at: string | null;
}

export interface MonitoringResponse {
  services: ServiceHealth[];
  overall: string;
  checked_at: string | null;
  jobs: JobRecord[];
  job_counts: { all: number; failed: number; retryable: number; running: number };
  audit: { id: string; action: string; entity_type: string; summary: string; actor: string; created_at: string | null }[];
  filter_options: { services: string[] };
}

export function getAdminDashboard() {
  return apiRequest<AdminDashboard>("/admin/dashboard");
}

export function getAdminAccounts(params: { search?: string; role?: string; status?: string }) {
  return apiRequest<AccountList>(
    `/admin/accounts${queryString({ search: params.search, role: params.role, status: params.status })}`,
  );
}

export function getAccountImpact(accountId: string) {
  return apiRequest<{ account: AccountRecord; already_deactivated: boolean; effect: string }>(
    `/admin/accounts/${accountId}/impact`,
  );
}

export function createAccount(body: { email: string; role: string; display_name?: string; course_ids?: string[] }) {
  return apiRequest<{ account: { account_id: string; email: string; role: string }; message: string }>("/admin/accounts", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function deactivateAccount(accountId: string) {
  return apiRequest<{ message: string }>(`/admin/accounts/${accountId}/deactivate`, {
    method: "POST",
    body: JSON.stringify({ confirm: true }),
  });
}

export function reactivateAccount(accountId: string) {
  return apiRequest<{ message: string }>(`/admin/accounts/${accountId}/reactivate`, { method: "POST" });
}

export function getAssignments(params: { courseId?: string; role?: string; status?: string; search?: string }) {
  return apiRequest<AssignmentList>(
    `/admin/assignments${queryString({
      course_id: params.courseId,
      role: params.role,
      status: params.status,
      search: params.search,
    })}`,
  );
}

export function createAssignment(body: { profile_id: string; course_id: string; member_role: "instructor" | "student" }) {
  return apiRequest<{ assignment: { membership_id: string }; message: string }>("/admin/assignments", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function confirmAssignment(membershipId: string) {
  return apiRequest<{ message: string }>(`/admin/assignments/${membershipId}/confirm`, { method: "POST" });
}

export function removeAssignment(membershipId: string) {
  return apiRequest<{ message: string }>(`/admin/assignments/${membershipId}/remove`, { method: "POST" });
}

export function getAdminMaterials(params: { courseId?: string; status?: string; search?: string }) {
  return apiRequest<AdminMaterialList>(
    `/admin/materials${queryString({ course_id: params.courseId, status: params.status, search: params.search })}`,
  );
}

export function adminUploadMaterial(formData: FormData) {
  return apiRequest<{ material: MaterialSummary; message: string }>("/admin/materials", { method: "POST", body: formData });
}

export function adminUpdateMaterial(documentId: string, body: { title: string; description: string | null; topic_concept: string | null }) {
  return apiRequest<{ material: MaterialSummary; message: string }>(`/admin/materials/${documentId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function adminArchiveMaterial(documentId: string) {
  return apiRequest<{ material: MaterialSummary; message: string }>(`/admin/materials/${documentId}/archive`, { method: "POST" });
}

export function adminRestoreMaterial(documentId: string) {
  return apiRequest<{ material: MaterialSummary; message: string }>(`/admin/materials/${documentId}/restore`, { method: "POST" });
}

export function adminRetryMaterial(documentId: string) {
  return apiRequest<{ material: MaterialSummary; message: string }>(`/admin/materials/${documentId}/retry`, { method: "POST" });
}

export function adminGetMaterialDownload(documentId: string) {
  return apiRequest<{ download_url: string }>(`/admin/materials/${documentId}/download`);
}

export function getAdminActivities(params: { courseId?: string; status?: string; type?: string; search?: string }) {
  return apiRequest<AdminActivityList>(
    `/admin/activities${queryString({
      course_id: params.courseId,
      status: params.status,
      type: params.type,
      search: params.search,
    })}`,
  );
}

export function getActivityImpact(activityId: string) {
  return apiRequest<{
    activity: AdminActivity;
    effect: { enrolled_students: number; attempts_recorded: number; note: string };
  }>(`/admin/activities/${activityId}/impact`);
}

export function updateAvailability(
  activityId: string,
  body: { opens_at: string | null; closes_at: string | null; closed: boolean | null },
) {
  return apiRequest<{ message: string; state: string }>(`/admin/activities/${activityId}/availability`, {
    method: "POST",
    body: JSON.stringify({ ...body, confirm: true }),
  });
}

export function adminArchiveActivity(activityId: string) {
  return apiRequest<{ message: string }>(`/admin/activities/${activityId}/archive`, { method: "POST" });
}

export function getSettings() {
  return apiRequest<SettingsResponse>("/admin/settings");
}

export function updateSetting(key: string, value: number | string | boolean, expectedVersion: number) {
  return apiRequest<{ setting: SettingRecord; message: string }>(`/admin/settings/${key}`, {
    method: "PATCH",
    body: JSON.stringify({ value, expected_version: expectedVersion }),
  });
}

export function getMonitoring(params: { service?: string; status?: string; search?: string; auditSearch?: string }) {
  return apiRequest<MonitoringResponse>(
    `/admin/monitoring${queryString({
      service: params.service,
      status: params.status,
      search: params.search,
      audit_search: params.auditSearch,
    })}`,
  );
}

export function retryJob(jobId: string) {
  return apiRequest<{ message: string }>(`/admin/jobs/${jobId}/retry`, { method: "POST" });
}

/* ------------------------------------------------------------------ helpers */

export const activityStateLabel: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  open: "Open",
  closed: "Closed",
  archived: "Archived",
};

export const draftStateLabel: Record<string, string> = {
  pending: "Awaiting review",
  ready: "Review confirmed",
  rejected: "Rejected",
  published: "Published",
};

export const materialStateLabel: Record<string, string> = {
  ready: "Ready",
  processing: "Processing",
  needs_review: "Needs review",
  failed: "Failed",
  archived: "Archived",
};

export const serviceStateLabel: Record<string, string> = {
  healthy: "Healthy",
  stale: "Stale",
  failed: "Failed",
  unavailable: "Unavailable",
};

export function friendlyLoadError(message: string): string {
  if (/input should be a valid uuid|invalid character/i.test(message)) {
    return "That link is not valid. Open the item from its list instead.";
  }
  return message;
}

export function formatDateTime(value: string | null | undefined): string {  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export function toDateTimeInput(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

export function fromDateTimeInput(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}
