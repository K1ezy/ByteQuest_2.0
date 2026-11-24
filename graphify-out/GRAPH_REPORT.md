# Graph Report - ByteQuest_2.0  (2026-11-25)

## Corpus Check
- 504 files · ~541,650 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 38 file(s) not represented in the graph (top: (none) 19, .bat 5, .example 5)

## Summary
- 4566 nodes · 15335 edges · 186 communities (163 shown, 23 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 1997 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6d4de171`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- workspace/ui.tsx
- ByteQuest 2.0: instructor activity analysis and class announcements
- Profile
- profile_attention.py
- seed_local_ml_scenario.py
- chat-provider.tsx
- app-shell.tsx
- test_faculty_admin.py
- activities/[id]/page.tsx
- start-bytequest.ps1
- drafts.py
- get
- supabase.ts
- test_learning_flow_integration.py
- chat-workspace.tsx
- progress-recap.tsx
- ML evidence, operations and ML methodology: readiness plan
- exams/[id]/page.test.tsx
- submissions.py
- instructor-authoring.layout.ts
- predictor.py
- profiles.py
- request_size.py
- sqlalchemy
- pilot.py
- 6. Prioritized improvement backlog
- LearningActivity
- quests_gamification.py
- chat_history.py
- submission-comparison.tsx
- progress_recap.py
- workshop-home.tsx
- ByteQuest system readiness review — 17 November 2026
- onboarding/page.tsx
- client.py
- config.py
- chat.py
- leaderboard.tsx
- lib/types.ts
- insights.py
- train_compare.py
- ml_predictor/feature_engineering.py
- 4. Findings and implementation blueprint
- qa_live_multi_role.py
- compilerOptions
- GeminiAPIError
- A. Add more code challenges
- Faculty and administrator workspace — implementation log and continued work
- package.json
- Phase 1 — ByteQuest instructor redesign plan
- get_db
- AppTooltips
- qa-responsive.mjs
- reveals_solution
- ByteQuest UI and UX harmonization plan
- submission_jobs.py
- vps_bootstrap.sh
- navigation.ts
- LegalDocument
- llm.py
- workshops.py
- exams.py
- workspace.ts
- useChatController
- ByteQuest machine-learning improvement plan
- retrieval.py
- test_ml_exam_features.py
- ByteQuest 2.0 Classroom Pilot Operator Runbook
- shadow.py
- submissions/[id]/page.tsx
- ByteQuest local end-to-end flow
- accessibility-provider.tsx
- ByteQuest 2.0
- Judge0Client
- ByteQuest 2.0 — Full system review
- Phase 0 — ByteQuest instructor audit
- StorageError
- SupabaseAvatarStorage
- entities.py
- Profile
- SYSTEM_STATUS_AND_RELEASE_PLAN.md
- Judge0 Hyper-V Ubuntu boot incident and recovery
- attempt_visibility.py
- ByteQuest 2.0: Master Architecture Plan & Execution Roadmap
- Phase 7 deployment readiness
- quests/page.tsx
- ProfileResponse
- typing
- activity-performance-preview.tsx
- arena.tsx
- workspace-provider.tsx
- Instructor activity analysis and class announcements
- Desktop and Mobile Pilot Flows (`pilot-v2.html`)
- dockable-navigation.tsx
- upload_my_avatar
- getErrorMessage
- account-menu.tsx
- ML pipeline synthetic verification — 2026-10-25
- exam_worker.py
- preflight-host.sh
- use-exam-answer-sync.ts
- Judge0UnavailableError
- ML feature engineering and training
- monitoring.py
- ByteQuest Gemini tutor pilot evaluation
- ByteQuest — Security & AI-Abuse Hardening (implementation brief)
- ByteQuest navigation
- ByteQuest UI/UX harmonization: slices 1–3 and ML slice planning
- Judge0 Hyper-V Ubuntu VM: troubleshooting handoff
- zerotier-relay.mjs
- Python demo journey — 2026-10-28
- PHASE7_DEPLOYMENT_READINESS.md
- ByteQuest 2.0 system status and weekly change log
- devDependencies
- Local API security verification — 2026-10-28
- Phase 7 database pool budget hardening
- ByteQuest system review: 22 November 2026
- scripts
- ByteQuest 2.0 before and after
- smoke-vps.sh
- ByteQuest pilot remediation checklist
- preflight-vps.sh
- ActivityAttempt
- instructor-exams.tsx
- ByteQuest 2.0 system critique — 21 November 2026
- Phase 7 database and file backup/restore runbook
- ByteQuest manuscript and system alignment checklist
- runner_status
- ByteQuest 2.0 live deployment stack
- home-redirect.tsx
- ML features and prediction unit: manuscript vs. code
- ByteQuest KVM 2 live pilot
- reserve
- ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash
- auth
- FastAPI
- 5. Slices
- Local API security contract
- Phase 7 dependency security review (2026-10-26)
- dependencies
- Prompt for ChatGPT: ByteQuest gamification, Phases 2 and 3
- api.ts
- backup-supabase.sh
- performance/page.tsx
- test_sandbox_internal_error_is_unavailability_not_a_student_failure
- Milestones 1A–1C Status and Verification Log
- flow
- restore-supabase-backup.sh
- get_current_user_payload
- CLAUDE.md
- _detect_avatar_content_type
- Workshops: Create, Join and the Workshop page
- validate_tutor_citations
- ByteQuest Insights, part 4 of 4: administrators
- quiz-overflow.layout.ts
- Phase 7 readiness hardening
- ByteQuest 2.0: close the manuscript gaps, tidy the structure, then review and rate the system
- ByteQuest Insights, part 1 of 4: shared foundation
- instructor/page.tsx
- onboarding/page.test.tsx
- ByteQuest Insights, part 2 of 4: students
- verify-backup.sh
- ByteQuest system status — 21 November 2026
- reviews.py
- test_auth_jwks.py
- seed_local_4cs_workshops.py
- course_access.py

## God Nodes (most connected - your core abstractions)
1. `Session` - 372 edges
2. `Profile` - 370 edges
3. `LearningActivity` - 237 edges
4. `getErrorMessage()` - 148 edges
5. `ActivityAttempt` - 130 edges
6. `apiRequest()` - 121 edges
7. `ReviewState` - 113 edges
8. `ProgrammingLang` - 102 edges
9. `UserRole` - 95 edges
10. `react` - 95 edges

## Surprising Connections (you probably didn't know these)
- `Supabase data and authorization` --references--> `audit_events()`  [INFERRED]
  .design/checkup-report.md → backend/app/api/admin.py
- `4.1 Migration` --references--> `audit_events()`  [INFERRED]
  docs/verification/faculty-admin-workspace-2026-10-29.md → backend/app/api/admin.py
- `Double-check before you report` --references--> `faculty_user()`  [INFERRED]
  docs/prompts/chatgpt-instructor-analysis-and-announcements.md → backend/app/api/faculty/common.py
- `P1 — functional gaps / decisions` --references--> `performance()`  [INFERRED]
  docs/verification/faculty-admin-workspace-2026-10-29.md → backend/app/api/faculty/performance.py
- `Suggested API contract` --references--> `_serialize_challenge()`  [INFERRED]
  docs/CHATBOT_IMPLEMENTATION_PLAN_FOR_DEEPSEEK.md → backend/app/api/rag_instructor.py

## Import Cycles
- None detected.

## Communities (186 total, 23 thin omitted)

### Community 0 - "workspace/ui.tsx"
Cohesion: 0.05
Nodes (63): Design system and data flow, 5.1 Shared library and components, canRetry(), JOB_STATUS_OPTIONS, JobDrawer(), retry(), JobStatus(), jobTitle() (+55 more)

### Community 1 - "ByteQuest 2.0: instructor activity analysis and class announcements"
Cohesion: 0.15
Nodes (12): Backend, ByteQuest 2.0: instructor activity analysis and class announcements, Database, Double-check before you report, Final report, Frontend, Hard rules, Part 1: Activity analysis (+4 more)

### Community 2 - "Profile"
Cohesion: 0.10
Nodes (44): admin_archive_material(), admin_download_material(), _admin_material_items(), admin_materials(), admin_restore_material(), admin_retry_material(), admin_update_material(), admin_upload_material() (+36 more)

### Community 3 - "profile_attention.py"
Cohesion: 0.14
Nodes (10): _account_needs_action(), _admin_analytics(), get_my_analytics(), _instructor_analytics(), _personal_audit_entries(), account_needs_action(), instructor_course_ids(), membership_rows() (+2 more)

### Community 4 - "seed_local_ml_scenario.py"
Cohesion: 0.18
Nodes (10): _activities(), _letters(), main(), remove(), _require_local(), _row(), seed(), _simulate() (+2 more)

### Community 5 - "chat-provider.tsx"
Cohesion: 0.10
Nodes (30): Already strong (checked, not assumed), chatHistory, ChatMode, ConversationPage, ConversationSummary, SavedReply, SavedTurn, Transcript (+22 more)

### Community 6 - "app-shell.tsx"
Cohesion: 0.15
Nodes (22): WorkspaceLayout(), AppShell(), AuthenticatedLayout(), isActiveDestination(), ProfileContext, useScrollResetOnRouteChange(), InstructorIconName, LegacyQuestRedirect() (+14 more)

### Community 7 - "test_faculty_admin.py"
Cohesion: 0.04
Nodes (82): AuditEvent, CourseMember, GradingWorkerHeartbeat, MLPrediction, ProgrammingLang, ResearchConsent, record_prediction_outcome(), record_grading_worker_heartbeat() (+74 more)

### Community 8 - "activities/[id]/page.tsx"
Cohesion: 0.05
Nodes (68): Step A checkpoint and caller verification, ActivityEditor(), focusSection(), newVersion(), requestChanges(), reviewPreview(), runVerification(), ActivitySources() (+60 more)

### Community 9 - "start-bytequest.ps1"
Cohesion: 0.07
Nodes (44): ConvertTo-EncodedPowerShellCommand(), ConvertTo-PowerShellLiteral(), Get-BackendFingerprint(), Get-DockerDesktopFile(), Get-FrontendFingerprint(), Get-Judge0VmIPv4(), Get-Judge0VmIPv4FromNeighbor(), Get-ListenerPidMap() (+36 more)

### Community 10 - "drafts.py"
Cohesion: 0.10
Nodes (33): ActivityCreate, ActivityUpdate, create_activity(), create_activity_version(), get_activity(), _grading_fields(), preview_activity(), publish_activity() (+25 more)

### Community 11 - "get"
Cohesion: 0.08
Nodes (53): admin_activities(), _admin_activity_item(), admin_user(), list_activity_workspace(), _activity_brief(), _course_brief(), _draft_item(), faculty_user() (+45 more)

### Community 12 - "supabase.ts"
Cohesion: 0.11
Nodes (27): Durability Boundary & Concurrency Guarantees, Interrupted Exam Autosave & Browser Recovery (Checklist Item #3), Other Remaining Pilot Verification Gates, Verification Status & Remaining Gates, cleared, localMap, mockLocalStorage, mockSessionStorage (+19 more)

### Community 13 - "test_learning_flow_integration.py"
Cohesion: 0.06
Nodes (101): ChallengeHint, ReviewState, _challenge(), _chat_payload(), _course_pdf(), _enroll_chat_students(), new_session(), _grade_queued_exam() (+93 more)

### Community 14 - "chat-workspace.tsx"
Cohesion: 0.10
Nodes (27): ChatPage(), availabilityCopy, ChatConversation(), languageNames, suggestedPrompts(), ChatMessageContent(), CodeBlock(), messageParts() (+19 more)

### Community 15 - "progress-recap.tsx"
Cohesion: 0.18
Nodes (14): changeText(), dayFormat, formatDay(), ProgressRecap(), ProgressRecapData, range(), readStoredDays(), RECAP_PERIODS (+6 more)

### Community 16 - "ML evidence, operations and ML methodology: readiness plan"
Cohesion: 0.08
Nodes (25): 1. Where things stand, 2. Decisions you need to make, 3. Workstream A: operations and reliability, 4. Workstream B: ML evidence and readiness, 5. Workstream C: ML methodology (all supplementary), 6. Order and timeline, 7. Which skill flow to use for each piece, 8. Done means (+17 more)

### Community 17 - "exams/[id]/page.test.tsx"
Cohesion: 0.25
Nodes (5): answerSaves(), Call, mocks, savedBodies(), seedUnsyncedSnapshot()

### Community 18 - "submissions.py"
Cohesion: 0.09
Nodes (19): CodeSubmissionRequest, run_code_submission(), _shadow_scoring_ready(), SubmissionJob, completed_activity_ids(), attempt_quality(), submission_passes(), finish_submission() (+11 more)

### Community 19 - "instructor-authoring.layout.ts"
Cohesion: 0.13
Nodes (17): expectContentToFit(), course, dashboard, defaultCourse, draft, gradingCase, identifier, listItem() (+9 more)

### Community 20 - "predictor.py"
Cohesion: 0.08
Nodes (20): api_health_check(), health_check(), lifespan(), readiness_check(), load_ml_models(), ModelArtifactError, ModelArtifactsUnavailable, ModelBundle (+12 more)

### Community 21 - "profiles.py"
Cohesion: 0.15
Nodes (21): ActivityDay, AdminAnalytics, AnalyticsResponse, AuditEntry, BadgeEntry, complete_staff_setup(), complete_student_onboarding(), _enum_value() (+13 more)

### Community 22 - "request_size.py"
Cohesion: 0.18
Nodes (8): RequestSizeLimitMiddleware, limited_receive(), tracked_send(), _TooLarge, test_streamed_body_without_content_length_is_limited(), read_body(), receive(), send()

### Community 23 - "sqlalchemy"
Cohesion: 0.06
Nodes (24): public_handle(), require_instructor(), _starter_username(), _encoded_id(), is_starter_username(), normalize_username(), starter_username(), destroy() (+16 more)

### Community 24 - "pilot.py"
Cohesion: 0.14
Nodes (24): require_practice_help_available(), challenge(), choose_consent(), close_challenge(), ConsentChoice, dashboard(), DraftPayload, _expired_hint_reservation() (+16 more)

### Community 25 - "6. Prioritized improvement backlog"
Cohesion: 0.08
Nodes (26): 1. Where the project stands, 2. Progress percentages and how they were calculated, 3. What exists today and where evidence stops, 4. Verification evidence and its limits, 5. Six gates before a live classroom pilot, 6. Prioritized improvement backlog, 7. Execution order, AI, LLM, RAG and provider handling (+18 more)

### Community 26 - "LearningActivity"
Cohesion: 0.11
Nodes (31): _challenge_prompt(), generate_ai_coding_challenge(), _serialize_challenge(), ActivityKind, LearningActivity, TestCase, apply_publish_rules(), lock_activity_for_publication() (+23 more)

### Community 27 - "quests_gamification.py"
Cohesion: 0.08
Nodes (31): _ensure_student(), get_codex(), get_gamification_leaderboard(), get_gamification_state(), get_mastery_map(), get_student_progress(), LeaderboardEntry, LeaderboardResponse (+23 more)

### Community 28 - "chat_history.py"
Cohesion: 0.15
Nodes (27): ChatSource, ChatTurn, _check_revision(), Conversation, ConversationPage, create_conversation(), CreateConversation, delete_conversation() (+19 more)

### Community 29 - "submission-comparison.tsx"
Cohesion: 0.18
Nodes (15): Editor, AttemptSummary(), CodeDiff(), loadEditor(), ComparedAttempt, Comparison, ComparisonResult(), isDesktop() (+7 more)

### Community 30 - "progress_recap.py"
Cohesion: 0.13
Nodes (10): get_progress_recap(), _utcnow(), _day(), _manila(), _practice_days(), progress_recap(), ProgressRecap, RecapMetric (+2 more)

### Community 31 - "workshop-home.tsx"
Cohesion: 0.05
Nodes (74): WorkshopDetailLayout(), WorkshopInvitePage(), WorkshopsPage(), useShellProfile(), hueFromSeed(), identiconCells(), UserAvatar(), UserAvatarProps (+66 more)

### Community 32 - "ByteQuest system readiness review — 17 November 2026"
Cohesion: 0.29
Nodes (7): ByteQuest system readiness review — 17 November 2026, Coding challenge assessment, Feature and runtime availability, Release acceptance checklist, Reproducing the audit probes, UI/UX assessment, Verification performed

### Community 33 - "onboarding/page.tsx"
Cohesion: 0.13
Nodes (30): AuthMode, OnboardingContent(), authenticate(), changeAuthMode(), checkExistingAuth(), continueToAgreement(), finishPasswordSetup(), PasswordInput() (+22 more)

### Community 34 - "client.py"
Cohesion: 0.17
Nodes (6): _b64_decode(), _b64_encode(), BatchEvaluationSummary, CircuitBreaker, Judge0CircuitOpenError, SingleTestResult

### Community 35 - "config.py"
Cohesion: 0.14
Nodes (7): deliver_one(), cleanup(), main(), make_students(), one_student(), require_local(), run_load()

### Community 36 - "chat.py"
Cohesion: 0.09
Nodes (22): _chat_activity(), ChatLimits, ChatMessageRequest, ChatMessageResponse, ChatStatus, _course_passages(), create_chat_message(), generate_chat_reply() (+14 more)

### Community 37 - "leaderboard.tsx"
Cohesion: 0.21
Nodes (12): CHOOSE_HANDLE_HREF, Leaderboard(), LeaderboardData, LeaderboardEntry, LeaderboardStanding, LearnerName(), MEDAL, Row() (+4 more)

### Community 38 - "lib/types.ts"
Cohesion: 0.06
Nodes (41): 1. Current architecture, Existing API contracts, ReviewPage(), SaveConflict(), ERROR_LABELS, MasteryMap(), MasteryPath(), MEMORY_LABELS (+33 more)

### Community 39 - "insights.py"
Cohesion: 0.08
Nodes (30): ChallengeRecovery, codex_summary(), CodexCategory, CodexRecovery, CodexSummary, practice_errors(), recoveries(), recoveries_for() (+22 more)

### Community 40 - "train_compare.py"
Cohesion: 0.08
Nodes (22): test_adequacy_flags_a_small_test_partition(), test_bootstrap_intervals_are_reproducible_and_resample_learners(), _adequacy(), _as_binary_label(), _atomic_joblib_dump(), _atomic_json_write(), _atomic_write(), _bootstrap_intervals() (+14 more)

### Community 41 - "ml_predictor/feature_engineering.py"
Cohesion: 0.22
Nodes (7): _as_bool(), _before(), _enum_value(), extract_features_from_dataframe(), _frame(), _mean(), _rate()

### Community 42 - "4. Findings and implementation blueprint"
Cohesion: 0.08
Nodes (24): 1. Where ByteQuest stands, 2. How the system fits together, 3. Work order, 4. Findings and implementation blueprint, 5. Local completion checklist, 6. Which existing document answers which question, BQ-01 — Award completion XP at the first eligible event, BQ-02 — Give submission jobs one owner per claim (+16 more)

### Community 43 - "qa_live_multi_role.py"
Cohesion: 0.07
Nodes (45): _evaluate(), _failed_sample(), main(), _request(), TutorCase, require_local(), main(), student() (+37 more)

### Community 44 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 45 - "GeminiAPIError"
Cohesion: 0.14
Nodes (11): GeminiAPIError, get_client(), embedding(), slow_embedding(), test_chat_provider_failure_and_quota_are_generic(), provider_failure(), test_concurrent_saved_sends_reach_gemini_once(), provider() (+3 more)

### Community 46 - "A. Add more code challenges"
Cohesion: 0.11
Nodes (13): GeneratedChallengeSchema, GeneratedQuizOptionSchema, GeneratedQuizQuestionSchema, GeneratedQuizSchema, TestCaseSchema, 2. Exact code touchpoints, 3. Recommended implementation order, 4. Ready-to-paste prompt for DeepSeek V4.1 Flash (+5 more)

### Community 47 - "Faculty and administrator workspace — implementation log and continued work"
Cohesion: 0.11
Nodes (17): 10. Files created or modified (this work), 11. Quick current-state checklist, 1. Status at handoff, 6. Tests added, 7. Verification evidence (live app), 8. How to continue (commands, accounts, cleanup), 9. Remaining work, Additional navigation fix (+9 more)

### Community 48 - "package.json"
Cohesion: 0.11
Nodes (17): engines, node, name, overrides, dompurify, private, version, eslint (+9 more)

### Community 49 - "Phase 1 — ByteQuest instructor redesign plan"
Cohesion: 0.05
Nodes (43): test_every_public_timestamp_column_is_aware(), B. Findings, ByteQuest 2.0 database review — 12 November 2026, C. Migration plan, D. Index recommendations, F. Verification, G. Explicitly out of scope, Must fix (+35 more)

### Community 50 - "get_db"
Cohesion: 0.15
Nodes (17): course_health(), _accuracy(), _course_activities(), dashboard(), evaluation(), _faculty(), forecast_readiness(), _period_cutoff() (+9 more)

### Community 51 - "AppTooltips"
Cohesion: 0.20
Nodes (21): AppTooltips(), clearTimers(), findTarget(), hide(), onClick(), onContextMenu(), onFocusIn(), onFocusOut() (+13 more)

### Community 52 - "qa-responsive.mjs"
Cohesion: 0.13
Nodes (17): frontend, marker, packageDir, source, target, fixture, assertRail(), capture() (+9 more)

### Community 53 - "reveals_solution"
Cohesion: 0.22
Nodes (13): _contains_tokens(), _ngrams(), reveals_solution(), _single_line_repair(), _tokens(), test_challenge_chat_rejects_alternate_code_even_without_reference_overlap(), test_exact_repair_to_failed_sample_is_withheld_even_if_it_is_in_the_starter(), test_full_solution_is_blocked_even_with_renamed_variables() (+5 more)

### Community 54 - "ByteQuest UI and UX harmonization plan"
Cohesion: 0.17
Nodes (12): 1. What the review found, 2. How work moves through ByteQuest, 3. Student journey, 4. Instructor journey, 5. Administrator journey, 6. Shared visual and interaction system, 7. Contextual help and tooltips, 8. Delivery order (+4 more)

### Community 55 - "submission_jobs.py"
Cohesion: 0.26
Nodes (9): ComparedAttempt, get_job(), _retry_failed_job(), retry_job(), SubmissionComparison, submit_job(), SubmitJob, view() (+1 more)

### Community 56 - "vps_bootstrap.sh"
Cohesion: 0.24
Nodes (15): active_ssh_port(), configure_cgroup_v1(), configure_docker(), configure_firewall(), configure_swap(), DEBIAN_FRONTEND, die(), DOCKER_KEYRING (+7 more)

### Community 57 - "navigation.ts"
Cohesion: 0.19
Nodes (11): WorkshopsLayout(), CourseNavigationLinks(), CourseSwitcher(), InstructorCourseShell(), InstructorShell(), MoreNavigation(), InstructorIcon(), AppNavIcon() (+3 more)

### Community 58 - "LegalDocument"
Cohesion: 0.24
Nodes (9): metadata, Page(), metadata, Page(), LegalDocument(), LegalKind, LegalModal(), PolicyPanel() (+1 more)

### Community 59 - "llm.py"
Cohesion: 0.06
Nodes (21): get_settings(), embed_chunks_bounded(), embed_one(), ErrorExplanationSchema, explain_code_error(), _client_for_key(), GeminiConfigurationError, get_gemini_client() (+13 more)

### Community 60 - "workshops.py"
Cohesion: 0.10
Nodes (60): _activity_links(), _announcement_for_update(), AnnouncementView, archive_workshop(), can_manage(), create_workshop(), CreateAnnouncement, delete_workshop_announcement() (+52 more)

### Community 61 - "exams.py"
Cohesion: 0.08
Nodes (54): assigned(), assigned_exam_numbers(), _assigned_exams_with_state(), create_exam(), DraftExam, DraftItem, _exam_access(), exam_sample_run() (+46 more)

### Community 62 - "workspace.ts"
Cohesion: 0.04
Nodes (93): AdminActivities(), confirmArchive(), openAvailability(), saveAvailability(), STATUS_OPTIONS, confirmPublish(), AccountPanel(), AdminSections() (+85 more)

### Community 63 - "useChatController"
Cohesion: 0.12
Nodes (26): RFC-4122, Hard rules, requestAiHint(), onInputKey(), submit(), turnMessages(), mapChatError(), useChatController() (+18 more)

### Community 64 - "ByteQuest machine-learning improvement plan"
Cohesion: 0.14
Nodes (14): 1. Goal, 2. Where things stand, 3. Decisions, 4.1 Prediction unit and label, 4.2 History, 4.3 The ten features, in this order, 4.4 Live shadow scoring, 4.5 Reporting (+6 more)

### Community 65 - "retrieval.py"
Cohesion: 0.09
Nodes (21): _gemini_unavailable_http_exception(), generate_ai_conceptual_quiz(), _generation_payload(), _quiz_prompt(), _retrieve_document_sources(), _serialize_quiz(), _validate_form_keys(), validate_generation_form() (+13 more)

### Community 66 - "test_ml_exam_features.py"
Cohesion: 0.10
Nodes (21): _forecast(), _attempt(), test_faculty_forecast_uses_the_recorded_winner_and_hides_legacy_probability(), test_hint_exports_reject_identifying_columns(), test_older_feature_schema_artifacts_are_rejected(), test_rows_are_first_submissions_on_challenges_with_strictly_prior_history(), test_ten_model_input_table_is_what_training_uses(), test_training_rejects_ids_that_encode_an_account() (+13 more)

### Community 67 - "ByteQuest 2.0 Classroom Pilot Operator Runbook"
Cohesion: 0.17
Nodes (12): 1. Hard Safety Gates (Enforced by Configuration), 2. Lab Station & Shared-Computer Protocol, 3. Network Resilience & Live Draft Sync, 4. Timed Exam Operations, 5. Verification Commands, 6. Incident Troubleshooting, ByteQuest 2.0 Classroom Pilot Operator Runbook, Classroom Wi-Fi Reconnect Banner (+4 more)

### Community 68 - "shadow.py"
Cohesion: 0.20
Nodes (8): has_required_prediction_history(), prior_graded_task_count(), record_shadow_prediction(), _rollback_quietly(), 5. Work, Phase A: before pilot data collection (has a deadline), Phase B: Model evaluation page (no deadline), Phase C: after the pilot

### Community 69 - "submissions/[id]/page.tsx"
Cohesion: 0.13
Nodes (16): Job, nextStarTip(), SubmissionStatusPage(), refresh(), retryGrading(), currentAttempt, mocks, oldSubmission (+8 more)

### Community 70 - "ByteQuest local end-to-end flow"
Cohesion: 0.12
Nodes (16): 8 Required Acceptance Checks, Account-synced progression check, Before deployment, ByteQuest local end-to-end flow, Exam Autosave & Conflict-Safe Recovery Verification, Instructor account, Local Quest Map demos, Manual startup (+8 more)

### Community 71 - "accessibility-provider.tsx"
Cohesion: 0.07
Nodes (33): Repo map: exact files to inspect and change, byteBounce, metadata, RootLayout(), viewport, ACCESSIBILITY_STORAGE_KEYS, AccessibilityContext, AccessibilityContextValue (+25 more)

### Community 72 - "ByteQuest 2.0"
Cohesion: 0.22
Nodes (9): Architecture, ByteQuest 2.0, Configuration and security, Documentation, Repository layout, Stack and deployment, Start locally on Windows, Test and verify (+1 more)

### Community 73 - "Judge0Client"
Cohesion: 0.16
Nodes (4): Judge0Client, TestCaseInput, main(), verify_compilers()

### Community 74 - "ByteQuest 2.0 — Full system review"
Cohesion: 0.08
Nodes (22): ByteQuest 2.0 engineering and UX review, Findings, Performance evidence, Recommended sequence, Verification and limits, ByteQuest 2.0 — Full system review, Evidence, Must fix (+14 more)

### Community 75 - "Phase 0 — ByteQuest instructor audit"
Cohesion: 0.25
Nodes (8): Current FastAPI inventory, Current screens and feature coverage, Decisions for Phase 1, Desktop scorecard, Findings, Phase 0 — ByteQuest instructor audit, Supabase data and authorization, Verification

### Community 76 - "StorageError"
Cohesion: 0.25
Nodes (5): StorageError, SupabasePDFStorage, test_accepts_absolute_signed_url_from_configured_origin(), test_rejects_untrusted_signed_url(), test_resolves_supabase_relative_signed_path()

### Community 78 - "entities.py"
Cohesion: 0.10
Nodes (20): add_workshop_activities(), AddWorkshopActivities, CreateWorkshop, WorkshopActivity, WorkshopAnnouncement, ensure_group_activity(), get_demo_context(), _id() (+12 more)

### Community 79 - "Profile"
Cohesion: 0.07
Nodes (63): account_emails_for_email(), account_impact(), AccountCreate, activity_impact(), _admin_activity(), admin_archive_activity(), admin_dashboard(), AdminMaterialMetadata (+55 more)

### Community 80 - "SYSTEM_STATUS_AND_RELEASE_PLAN.md"
Cohesion: 0.20
Nodes (3): ByteQuest repository guidance, Text and layout containment, This is NOT the Next.js you know

### Community 81 - "Judge0 Hyper-V Ubuntu boot incident and recovery"
Cohesion: 0.13
Nodes (15): 1. Start and open the known-good VM, 2. Confirm the Judge0 services and volume inside Ubuntu, 3. Get the current guest IP and check the port, 4. Update ByteQuest if the VM IP changed, 5. Restart FastAPI and leave it running, 6. Verify service integration without exposing secrets, Current verified state, Disk and data safety (+7 more)

### Community 82 - "attempt_visibility.py"
Cohesion: 0.08
Nodes (24): activity_accepts_submissions_clause(), activity_has_opened(), activity_is_closed(), _as_utc(), course_open_clause(), guard_solution_reopen(), learner_visible_attempt_clause(), student_activity_clause() (+16 more)

### Community 83 - "ByteQuest 2.0: Master Architecture Plan & Execution Roadmap"
Cohesion: 0.08
Nodes (24): 1. Project Tracking & Thesis Collaboration Strategy, 2. Core Architectural Rules (Non-Negotiable), 3. Repository Directory Structure, 4. Course-Sequence & Curriculum Alignment, 5. Database Schema Blueprint (Supabase PostgreSQL + pgvector), 6. 7-Phase Development Plan, 7. Thesis Objectives Mapping (Chapter 1 Alignment), 8. Development Environment & Quickstart Commands (+16 more)

### Community 84 - "Phase 7 deployment readiness"
Cohesion: 0.18
Nodes (11): Decisions required before production setup, Deployment order after the decisions are made, Evidence still needed, Local Judge0 runtime smoke check (2026-10-26), Notes on local verification, Phase 7 deployment readiness, Prepared in the repository, Production settings and network boundaries (+3 more)

### Community 85 - "quests/page.tsx"
Cohesion: 0.18
Nodes (17): categories, PracticeCategory, PracticeQuestList(), handleKeyDown(), QuestsPage(), QuestsPageContent(), QuestStatusFilter, ActivityDateFilter() (+9 more)

### Community 86 - "ProfileResponse"
Cohesion: 0.18
Nodes (5): delete_my_avatar(), get_my_profile(), ProfileResponse, ProfileUpdateRequest, update_my_profile()

### Community 87 - "typing"
Cohesion: 0.24
Nodes (6): _coerce(), list_settings(), _range_error(), serialize_setting(), _typed_value(), update_setting()

### Community 88 - "activity-performance-preview.tsx"
Cohesion: 0.17
Nodes (12): ActivityHistory, ActivityKind, ActivityPerformancePreview(), place(), schedule(), ActivityPreviewDetails, kindLabels, kindNouns (+4 more)

### Community 89 - "arena.tsx"
Cohesion: 0.09
Nodes (34): ArenaPage(), Arena(), checkStatus(), confirmResetCode(), endSegment(), handleCodeChange(), handleCopyOutput(), load() (+26 more)

### Community 90 - "workspace-provider.tsx"
Cohesion: 0.05
Nodes (59): Page(), Configuration(), openReview(), renderConflict(), renderEditor(), save(), validate(), Conflict (+51 more)

### Community 91 - "Instructor activity analysis and class announcements"
Cohesion: 0.33
Nodes (6): Activity analysis, Browser verification, Class announcements, Instructor activity analysis and class announcements, Remaining verification, Verification

### Community 92 - "Desktop and Mobile Pilot Flows (`pilot-v2.html`)"
Cohesion: 0.22
Nodes (8): 1. Offline / Network Reconnect Banner, 2. Pending / Queued Grading State, 3. Research Consent & Withdrawal State (Disabled Collection Notice), 4. Active Exam Priority Banner & Timed Attempt Lock, ByteQuest web app wireframes, Coverage, Desktop and Mobile Pilot Flows (`pilot-v2.html`), Review checklist

### Community 93 - "dockable-navigation.tsx"
Cohesion: 0.11
Nodes (21): Already in place: extend, do not rebuild, Goal, Layout system, Make ByteQuest fit every phone and tablet, Menu docking: finish what exists, Out of scope, Screens, Side navigation on handheld screens: already built (+13 more)

### Community 94 - "upload_my_avatar"
Cohesion: 0.29
Nodes (3): school_id_availability(), SchoolIdCheck, upload_my_avatar()

### Community 95 - "getErrorMessage"
Cohesion: 0.04
Nodes (87): Frontend, Stack and layout, CHOICE_LABEL, ResearchConsentSettingsPage(), choose(), AdminAccounts(), confirmDeactivate(), confirmReactivate() (+79 more)

### Community 96 - "account-menu.tsx"
Cohesion: 0.19
Nodes (13): 5.2 Faculty routes, 5.3 Administrator routes, 5.4 Navigation and shell integration, 5. Frontend changes, AccessibilityPage(), AccessibilityPreferenceKey, ACCESSIBILITY_SETTINGS, AccessibilitySettingDefinition (+5 more)

### Community 97 - "ML pipeline synthetic verification — 2026-10-25"
Cohesion: 0.29
Nodes (6): Artifact and activation checks, Execution, ML pipeline synthetic verification — 2026-10-25, Observed grouped metrics, Remaining Phase 5 work, Scope

### Community 98 - "exam_worker.py"
Cohesion: 0.26
Nodes (8): answer_grace(), claim_exam(), ExamGradingClaim, _grade_claimed_exam(), grade_exam(), _grade_item(), _lock_exam_claim(), test_instructor_can_retry_exhausted_exam_grading_without_losing_answers()

### Community 99 - "preflight-host.sh"
Cohesion: 0.38
Nodes (6): fail(), MIN_MEMORY_BYTES, MIN_ROOT_FREE_BYTES, MIN_SWAP_BYTES, pass(), preflight-host.sh script

### Community 100 - "use-exam-answer-sync.ts"
Cohesion: 0.22
Nodes (12): Attempt, AttemptResult, AttemptResultItem, ExamAnswers, ExamItem, ExamSyncBannerState, formatClockTime(), QuizQuestion (+4 more)

### Community 101 - "Judge0UnavailableError"
Cohesion: 0.23
Nodes (7): classify_judge0_status(), Judge0UnavailableError, _parse_completed_result(), metric(), sandbox_unavailable(), test_program_crash_is_still_graded_as_a_runtime_error(), unavailable()

### Community 102 - "ML feature engineering and training"
Cohesion: 0.50
Nodes (4): Comparison protocol, ML feature engineering and training, Prepare an Ubuntu VPS, Safe pipeline setup

### Community 103 - "monitoring.py"
Cohesion: 0.29
Nodes (9): _check_judge0(), _grading_worker_health(), _minutes(), _prediction_health(), _rag_health(), _runner_health(), service_health(), _status() (+1 more)

### Community 104 - "ByteQuest Gemini tutor pilot evaluation"
Cohesion: 0.50
Nodes (4): ByteQuest Gemini tutor pilot evaluation, Reply quality, Token use and estimated Gemini cost, What was tested

### Community 105 - "ByteQuest — Security & AI-Abuse Hardening (implementation brief)"
Cohesion: 0.18
Nodes (10): ByteQuest — Security & AI-Abuse Hardening (implementation brief), Final report (keep it short), Order and verification, Out of scope: do not do these, Rules for every task, Stack, Task 4 — Administrators can never self-register, Task 5 — Chat activity context uses the shared visibility rule (+2 more)

### Community 106 - "ByteQuest navigation"
Cohesion: 0.33
Nodes (6): ByteQuest navigation, Compatibility and new destinations, Existing routes, Instructor authoring, Local verification, Workshops (11/21/26)

### Community 107 - "ByteQuest UI/UX harmonization: slices 1–3 and ML slice planning"
Cohesion: 0.12
Nodes (17): Bugs found and fixed, ByteQuest UI/UX harmonization: slices 1–3 and ML slice planning, Checkpoint, Decisions made today, Fix: searching by number, 24 November 2026, How it was checked, Implementation checklist checkpoint for 24 November 2026, Next steps (+9 more)

### Community 108 - "Judge0 Hyper-V Ubuntu VM: troubleshooting handoff"
Cohesion: 0.11
Nodes (15): Confirmed project and Judge0 setup, Current state, Direct-shell recovery method that worked, Historical recommendation written before the Install VM recovery, Judge0 Hyper-V Ubuntu VM: troubleshooting handoff, Known guest settings and identifiers, Sources, Timeline of important events and changes (+7 more)

### Community 110 - "Python demo journey — 2026-10-28"
Cohesion: 0.40
Nodes (4): Browser walkthrough, Implemented, Local evidence, Python demo journey — 2026-10-28

### Community 111 - "PHASE7_DEPLOYMENT_READINESS.md"
Cohesion: 0.05
Nodes (34): Current routes and behavior, Phase 2 API and rollout list, Reference tokens and icons, Screenshot comparisons, Step C — Instructor visual verification, Test target checks, Grant access to one account, Production instructor access (+26 more)

### Community 112 - "ByteQuest 2.0 system status and weekly change log"
Cohesion: 0.29
Nodes (7): ByteQuest 2.0 system status and weekly change log, Current feature and deployment map, How close is ByteQuest to finished?, Latest local verification, UI and UX review, What changed this week, Work left before the next milestone

### Community 113 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, eslint, eslint-config-next, jsdom, @playwright/test, @testing-library/react, @types/node, @types/react (+3 more)

### Community 114 - "Local API security verification — 2026-10-28"
Cohesion: 0.50
Nodes (3): 30-student local load, Checks, Local API security verification — 2026-10-28

### Community 115 - "Phase 7 database pool budget hardening"
Cohesion: 0.50
Nodes (3): Change, Checks performed, Phase 7 database pool budget hardening

### Community 116 - "ByteQuest system review: 22 November 2026"
Cohesion: 0.18
Nodes (11): ByteQuest system review: 22 November 2026, Findings, High, How to run this (skill flows), Low, Medium, Recommended order, Scorecard (+3 more)

### Community 117 - "scripts"
Cohesion: 0.17
Nodes (12): scripts, build, dev, lint, prebuild, predev, prestart, start (+4 more)

### Community 118 - "ByteQuest 2.0 before and after"
Cohesion: 0.12
Nodes (16): AI and the browser experience, ByteQuest 2.0 before and after, Current local evidence, Curriculum, grading interruptions, tutoring, and exam accessibility, Exam-grading slot comparison · 19 November 2026, Grading, exams, and course records, How to decide whether the work paid off, Implementation and local verification (+8 more)

### Community 119 - "smoke-vps.sh"
Cohesion: 0.83
Nodes (3): check_health(), smoke-vps.sh script, usage()

### Community 120 - "ByteQuest pilot remediation checklist"
Cohesion: 0.29
Nodes (7): 1. Fix release blockers, 2. Correct grading, dashboard, and accessibility behavior, 3. Restore live grading and fill the content gaps, 4. Verify feature availability and role workflows, 5. Decide whether the pilot can start, ByteQuest pilot remediation checklist, Resume the Judge0 checks

### Community 123 - "ActivityAttempt"
Cohesion: 0.14
Nodes (24): ActivityAttempt, Badge, DocumentChunk, HintUse, PlatformSetting, StudentBadge, evaluate_and_award_badges(), _qualifies() (+16 more)

### Community 124 - "instructor-exams.tsx"
Cohesion: 0.11
Nodes (24): ExamsPage(), ExamsPage(), AttemptResult, Catalog, Exam, ExamDetail, ExamMode, examStage() (+16 more)

### Community 126 - "ByteQuest 2.0 system critique — 21 November 2026"
Cohesion: 0.25
Nodes (8): ByteQuest 2.0 system critique — 21 November 2026, Findings by severity, Low, Not verified in this review, Scorecard, Top 5 things to do next, Verdict, What is working well (keep)

### Community 127 - "Phase 7 database and file backup/restore runbook"
Cohesion: 0.18
Nodes (11): ByteQuest recovery acceptance checklist, Every week, Limits and duties, Logical-export recovery limits, One-time setup on the VPS, Phase 7 database and file backup/restore runbook, Provider-native recovery rehearsal, Recovery design (+3 more)

### Community 128 - "ByteQuest manuscript and system alignment checklist"
Cohesion: 0.20
Nodes (10): 1. Scope decisions, 2. Chapter 1 — Introduction and scope, 3. Chapter 2 — Literature and synthesis, 4. Chapter 3 — Roles, practice, and AI, 5. Chapter 3 — Assessment and architecture, 6. Chapter 3 — Consent, research data, and ML, 7. Study records and final sign-off, ByteQuest manuscript and system alignment checklist (+2 more)

### Community 132 - "runner_status"
Cohesion: 0.42
Nodes (7): runner_status(), job(), test_a_failing_latest_job_is_a_current_failure(), test_a_job_stuck_in_the_queue_marks_the_queue_stale(), test_a_job_that_just_arrived_is_not_a_stall(), test_old_activity_reads_in_hours_and_days_not_hundreds_of_minutes(), test_old_failures_do_not_hide_a_recovered_runner()

### Community 133 - "ByteQuest 2.0 live deployment stack"
Cohesion: 0.40
Nodes (5): Before the 30-student session, ByteQuest 2.0 live deployment stack, PHP budget, What ByteQuest runs, What to pay for

### Community 134 - "home-redirect.tsx"
Cohesion: 0.26
Nodes (9): HomePage(), FEATURED_SLIDES, FeaturedQuestWindow(), FeaturedSlide, destinationFor(), HomeRedirect(), consumeInviteCallback(), SafeNavigationOptions (+1 more)

### Community 135 - "ML features and prediction unit: manuscript vs. code"
Cohesion: 0.40
Nodes (5): 1. The two feature sets, 2. The prediction unit and label, 3. Decisions for the adviser, 4. Files that would change, ML features and prediction unit: manuscript vs. code

### Community 136 - "ByteQuest KVM 2 live pilot"
Cohesion: 0.40
Nodes (5): Before provisioning, ByteQuest KVM 2 live pilot, Configure and start the stack, Decide whether to start the classroom pilot, Local verification on 20 November 2026

### Community 137 - "reserve"
Cohesion: 0.06
Nodes (19): Settings, reserve(), Rule, window_bounds(), extract_chunks_from_pdf(), extract_pdf_chunks(), test_ai_global_budgets_are_independent(), test_chat_has_dedicated_account_and_global_quota() (+11 more)

### Community 138 - "ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash"
Cohesion: 0.20
Nodes (9): Behavior and scope of the assistant, ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash, Placement and responsive layout, Product decision, Quality gates and acceptance tests, Ready-to-paste DeepSeek V4.1 Flash implementation prompt, State and error rules, Suggested API contract (+1 more)

### Community 139 - "auth"
Cohesion: 0.22
Nodes (8): auth(), verify(), claims(), A. Provider database backup, B. Supplementary logical database export, Backup procedure, C. Separate export of instructional PDF objects, Scope and recovery boundaries

### Community 140 - "FastAPI"
Cohesion: 0.14
Nodes (11): AnnouncementCreate, AnnouncementExpiry, AnnouncementPatch, _audit_change(), _authorize_announcement(), create_announcement(), delete_announcement(), list_announcements() (+3 more)

### Community 141 - "5. Slices"
Cohesion: 0.12
Nodes (15): 1. Read these first, in this order, 3. Hard rules, 4. Decided behaviour (W1–W12, all accepted by the user), 5. Slices, 6. How to verify each slice, 7. Report after each slice, ChatGPT 6.2 prompt: finish the ByteQuest Workshop classroom (slices 1–8), Slice 1: data and API (start here) (+7 more)

### Community 142 - "Local API security contract"
Cohesion: 0.40
Nodes (5): Access matrix, Local API security contract, Local verification and future deployment, Quotas and validation, School-issued IDs for student sign-up

### Community 143 - "Phase 7 dependency security review (2026-10-26)"
Cohesion: 0.33
Nodes (5): Findings and changes, Phase 7 dependency security review (2026-10-26), Remaining checks and limits, Scope, Verification performed

### Community 146 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, monaco-editor, @monaco-editor/react, next, react, react-dom, react-is, recharts (+1 more)

### Community 148 - "Prompt for ChatGPT: ByteQuest gamification, Phases 2 and 3"
Cohesion: 0.20
Nodes (9): 10. Definition of done (for each part), 12. Final report format, 1. Your role and mission, 3. Stack, layout and commands, 6. Phase 2A — Debugger's Codex (badges + progress indicator), 7. Phase 2B — Concept Mastery Map (progress indicator, open learner model), 8. Phase 3A — Mastery Memory (quests + points, spaced retrieval), 9. Phase 3B — Staged mechanic rollout (counters the novelty dip) (+1 more)

### Community 149 - "api.ts"
Cohesion: 0.04
Nodes (55): 2. Repository discovery (recorded before changes), 4.5 Administrator API (`backend/app/api/admin.py`, prefix `/api/v1/admin`), nextConfig, closesIn(), Dashboard, DashboardContent(), DashboardPage(), kindLabel() (+47 more)

### Community 150 - "backup-supabase.sh"
Cohesion: 0.40
Nodes (8): die(), env_value(), log(), pg(), psql_value(), backup-supabase.sh script, storage_get(), urlencode()

### Community 151 - "performance/page.tsx"
Cohesion: 0.05
Nodes (70): Activity health in the Activities list, ByteQuest Insights, part 3 of 4: instructors, Exam class summary, Goal, Handheld rules, Inactive 7+ days, Model evaluation, Out of scope (+62 more)

### Community 152 - "test_sandbox_internal_error_is_unavailability_not_a_student_failure"
Cohesion: 0.28
Nodes (5): test_hidden_case_contributes_to_score_without_exposing_details(), language_ids(), poll_batch(), submit_batch(), test_sandbox_internal_error_is_unavailability_not_a_student_failure()

### Community 153 - "Milestones 1A–1C Status and Verification Log"
Cohesion: 0.22
Nodes (9): Environment, Follow-up verification — 2026-10-25, Milestone 1A: Judge0 execution, Milestone 1B: Local Supabase schema and fixtures, Milestone 1C: Browser-to-database walkthrough — Complete, verified, Milestones 1A–1C Status and Verification Log, Official milestone disposition, Submission-flow corrections made (+1 more)

### Community 154 - "flow"
Cohesion: 0.25
Nodes (3): flow(), cleanup(), override_db()

### Community 156 - "restore-supabase-backup.sh"
Cohesion: 0.42
Nodes (6): die(), env_value(), log(), pg(), psql_value(), restore-supabase-backup.sh script

### Community 157 - "get_current_user_payload"
Cohesion: 0.29
Nodes (4): get_current_user_payload(), TokenPayload, test_es256_verifies_locally_off_the_event_loop(), Task 3 — Verify Supabase's asymmetric JWTs locally (performance)

### Community 159 - "_detect_avatar_content_type"
Cohesion: 0.47
Nodes (3): _detect_avatar_content_type(), test_detect_avatar_content_type_recognizes_supported_signatures(), test_detect_avatar_content_type_rejects_metadata_only_and_truncated_files()

### Community 160 - "Workshops: Create, Join and the Workshop page"
Cohesion: 0.20
Nodes (10): 10. Decisions to critique, 1. What exists today, 2. Screen map, 3. Rules, 5. API changes (all under `/api/v1/workshops`), 6. Frontend structure, 7. Delivery slices (each ships with tests), 8. Out of scope for v1 (+2 more)

### Community 161 - "validate_tutor_citations"
Cohesion: 0.33
Nodes (3): cited_sources(), validate_tutor_citations(), test_tutor_strips_unverified_markers_and_multi_page_citations()

### Community 162 - "ByteQuest Insights, part 4 of 4: administrators"
Cohesion: 0.33
Nodes (5): ByteQuest Insights, part 4 of 4: administrators, Goal, Handheld rules, Out of scope, Verification and rollout

### Community 163 - "quiz-overflow.layout.ts"
Cohesion: 0.40
Nodes (3): identifier, quest, @playwright/test

### Community 164 - "Phase 7 readiness hardening"
Cohesion: 0.40
Nodes (5): Changes, Limits, Local runtime spot check — 2026-10-26, Phase 7 readiness hardening, Verification performed

### Community 165 - "ByteQuest 2.0: close the manuscript gaps, tidy the structure, then review and rate the system"
Cohesion: 0.22
Nodes (8): ByteQuest 2.0: close the manuscript gaps, tidy the structure, then review and rate the system, Do not, Final report, Part 1: AI tutoring (highest priority), Part 3: Code structure (targeted; behaviour must stay identical), Part 4: Review and targeted fixes, Stack and layout, Verification

### Community 166 - "ByteQuest Insights, part 1 of 4: shared foundation"
Cohesion: 0.20
Nodes (9): ByteQuest Insights, part 1 of 4: shared foundation, Charts: two primitives, Goal, Handheld rules, Metric labels, Out of scope, Profile: one role tab, each figure once, Remove the duplicate Sequencer evaluation (+1 more)

### Community 167 - "instructor/page.tsx"
Cohesion: 0.06
Nodes (91): Course health on System Overview, Already in place: extend, do not rebuild, Shared insight widgets, Verification and rollout, Already in place: extend, do not rebuild, One kit: course-ui, Already in place: extend, do not rebuild, Implementation status (21 November 2026, same day) (+83 more)

### Community 168 - "onboarding/page.test.tsx"
Cohesion: 0.67
Nodes (3): OnboardingPage(), auth, openAuth()

### Community 169 - "ByteQuest Insights, part 2 of 4: students"
Cohesion: 0.22
Nodes (8): ByteQuest Insights, part 2 of 4: students, Goal, Handheld rules, One badge list, Out of scope, Score trend and breakdowns, Topic practice links, Verification and rollout

### Community 170 - "verify-backup.sh"
Cohesion: 0.83
Nodes (3): fail(), host_path(), verify-backup.sh script

### Community 172 - "ByteQuest system status — 21 November 2026"
Cohesion: 0.40
Nodes (5): ByteQuest system status, Checkout, runtime and release, Machine learning — status on 11/21/26, Verification and remaining checks, What changed

### Community 174 - "reviews.py"
Cohesion: 0.08
Nodes (43): get_review(), get_reviews(), _locked_student(), _public_review(), _question_id(), _require_memory(), ReviewOverviewResponse, ReviewResponse (+35 more)

### Community 177 - "test_auth_jwks.py"
Cohesion: 0.18
Nodes (3): test_failed_jwks_verification_falls_back(), test_non_asymmetric_algorithms_never_use_jwks(), test_embedding_request_matches_selected_model()

### Community 188 - "seed_local_4cs_workshops.py"
Cohesion: 0.13
Nodes (8): overall_health(), check(), main(), ensure_student(), letters(), main(), student_account(), test_a_service_switched_off_on_purpose_does_not_degrade_overall_health()

### Community 189 - "course_access.py"
Cohesion: 0.09
Nodes (32): list_course_operations(), student_announcements(), get_instructor_workspace(), _get_owned_activity(), _may_manage_activity(), _serialize_document(), Course, active_membership_course_ids() (+24 more)

## Knowledge Gaps
- **18 isolated node(s):** `monaco-editor`, `react-is`, `@types/node`, `@types/react`, `@types/react-dom` (+13 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1499 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `4. Read these before writing any code` connect `ActivityAttempt` to `workspace/ui.tsx`, `Profile`, `Judge0UnavailableError`, `flow`, `test_learning_flow_integration.py`, `attempt_visibility.py`, `Prompt for ChatGPT: ByteQuest gamification, Phases 2 and 3`, `profiles.py`, `LearningActivity`, `quests_gamification.py`, `progress_recap.py`, `workshop-home.tsx`?**
  _High betweenness centrality (0.202) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `Session` (e.g. with `smoke_demo_quest()` and `test_two_concurrent_saves_cannot_commit_the_same_activity_version()`) actually correct?**
  _`Session` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `monaco-editor`, `react-is`, `@types/node` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `workspace/ui.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05368421052631579 - nodes in this community are weakly interconnected._
- **Why does `LearningActivity` connect `LearningActivity` to `Profile`, `profile_attention.py`, `test_faculty_admin.py`, `drafts.py`, `get`, `test_learning_flow_integration.py`, `submissions.py`, `predictor.py`, `profiles.py`, `pilot.py`, `quests_gamification.py`, `config.py`, `chat.py`, `lib/types.ts`, `insights.py`, `qa_live_multi_role.py`, `reviews.py`, `get_db`, `submission_jobs.py`, `workshops.py`, `course_access.py`, `exams.py`, `retrieval.py`, `test_ml_exam_features.py`, `shadow.py`, `entities.py`, `Profile`, `attempt_visibility.py`, `monitoring.py`, `ActivityAttempt`?**
  _High betweenness centrality (0.143) - this node is a cross-community bridge._
- **Are the 303 inferred relationships involving `Profile` (e.g. with `account_impact()` and `_account_needs_action()`) actually correct?**
  _`Profile` has 303 INFERRED edges - model-reasoned connections that need verification._
- **Should `Profile` be split into smaller, more focused modules?**
  _Cohesion score 0.10461718293395675 - nodes in this community are weakly interconnected._