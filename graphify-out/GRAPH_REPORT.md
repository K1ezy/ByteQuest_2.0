# Graph Report - ByteQuest_2.0  (2026-11-20)

## Corpus Check
- 415 files · ~469,982 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 37 file(s) not represented in the graph (top: (none) 19, .bat 5, .example 5)

## Summary
- 3924 nodes · 13240 edges · 168 communities (155 shown, 13 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 1724 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `059f633f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ui.tsx
- ByteQuest 2.0: instructor activity analysis and class announcements
- ml_predictor/feature_engineering.py
- llm.py
- test_learning_flow_integration.py
- reviews.py
- rag_instructor.py
- test_faculty_admin.py
- workspace.ts
- start-bytequest.ps1
- activities/[id]/page.tsx
- workspace_queries.py
- supabase.ts
- retrieval.py
- announcements.py
- faculty_ml.py
- app-shell.tsx
- test_api_security.py
- entities.py
- StorageError
- predictor.py
- profiles.py
- evaluation.tsx
- quest_groups.py
- course_access.py
- 6. Prioritized improvement backlog
- Judge0Client
- activities.py
- qa_mixed_exam_load.py
- getErrorMessage
- api.ts
- chat-shell.tsx
- Prioritized defects
- onboarding/page.tsx
- Phase 7 dependency security review (2026-10-26)
- dashboard/page.tsx
- UserRole
- _enroll_chat_students
- ProgrammingLang
- insights.py
- starter_username
- progress_recap.py
- 4. Findings and implementation blueprint
- attempt_visibility.py
- compilerOptions
- _save_turn
- accessibility-provider.tsx
- Faculty and administrator workspace — implementation log and continued work
- package.json
- Phase 1 — ByteQuest instructor redesign plan
- accessibility-settings.tsx
- AppTooltips
- request_size.py
- reveals_solution
- codex.py
- chat-provider.tsx
- vps_bootstrap.sh
- test_schema_integrity.py
- LegalDocument
- InstructorPage
- app/layout.tsx
- exams.py
- instructor/materials/page.tsx
- leaderboard.tsx
- numpy
- test_ml_exam_features.py
- ByteQuest 2.0 database review — 12 November 2026
- ByteQuest 2.0 Classroom Pilot Operator Runbook
- Session
- gamification-insights.tsx
- ByteQuest local end-to-end flow
- Phase 0 — ByteQuest instructor audit
- ByteQuest 2.0
- httpx
- activity-analysis.tsx
- use-exam-answer-sync.ts
- useChatController
- _detect_avatar_content_type
- ByteQuest 2.0 — Full system review
- Profile
- SYSTEM_STATUS_AND_RELEASE_PLAN.md
- ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash
- Phase 7 database and file backup/restore runbook
- ByteQuest 2.0: Master Architecture Plan & Execution Roadmap
- Phase 7 deployment readiness
- account-menu.tsx
- mastery_map.py
- prepare-monaco.mjs
- exams/[id]/page.test.tsx
- instructor/page.tsx
- qa_starter_tutoring.py
- Instructor activity analysis and class announcements
- Desktop and Mobile Pilot Flows (`pilot-v2.html`)
- qa_live_multi_role.py
- ByteQuest 2.0: close the manuscript gaps, tidy the structure, then review and rate the system
- get
- Phase 7 synthetic deployment preflight — 2026-10-26
- ML pipeline synthetic verification — 2026-10-25
- arena.tsx
- preflight-host.sh
- ProfileResponse
- Classroom pilot fixes and verification — 2026-10-28
- ML feature engineering and training
- monitoring.py
- ByteQuest Gemini tutor pilot evaluation
- ByteQuest navigation
- home-redirect.tsx
- quests_gamification.py
- zerotier-relay.mjs
- Python demo journey — 2026-10-28
- Judge0 Hyper-V Ubuntu boot incident and recovery
- ByteQuest 2.0 system status and weekly change log
- solve_quality.py
- Local API security verification — 2026-10-28
- Phase 7 database pool budget hardening
- test_profile_analytics.py
- chat-conversation.tsx
- ByteQuest 2.0 before and after
- smoke-vps.sh
- ByteQuest pilot remediation checklist
- preflight-vps.sh
- ActivityAttempt
- test_learning_flow_integration.py
- instructor-dashboard.ts
- SubmissionJob
- ByteQuest manuscript and system alignment checklist
- workspace-provider.tsx
- ByteQuest 2.0 live deployment stack
- chat-workspace.tsx
- ML features and prediction unit: manuscript vs. code
- ByteQuest KVM 2 live pilot
- submission-comparison.tsx
- Step C — Instructor visual verification
- judge0/__init__.py
- Judge0UnavailableError
- pilot.py
- Local API security contract
- SupabaseAvatarStorage
- instructor-studio.tsx
- chat-provider.test.tsx
- settings_service.py
- newRequestId
- Phase 7 backend image build verification
- Phase 7 local production-mode runtime verification
- next
- Prompt for ChatGPT: ByteQuest gamification, Phases 2 and 3
- Phase 6 shadow rollout implementation record
- Corrected Lesson to Student Progress Verification
- train_compare.py
- test_memory_rules.py
- Production instructor access
- Phase 7 frontend build evidence
- Phase 7 Vercel setup verification — 2026-10-26
- test_sandbox_internal_error_is_unavailability_not_a_student_failure
- Judge0 Hyper-V Ubuntu VM: troubleshooting handoff
- Milestones 1A–1C Status and Verification Log
- update_my_profile
- test_pdf_page_and_character_limits
- runCode
- SandboxHealth
- problem-statement.ts

## God Nodes (most connected - your core abstractions)
1. `Session` - 343 edges
2. `Profile` - 335 edges
3. `LearningActivity` - 211 edges
4. `getErrorMessage()` - 156 edges
5. `apiRequest()` - 122 edges
6. `ActivityAttempt` - 114 edges
7. `ReviewState` - 109 edges
8. `ProgrammingLang` - 95 edges
9. `UserRole` - 87 edges
10. `ActivityKind` - 82 edges

## Surprising Connections (you probably didn't know these)
- `Supabase data and authorization` --references--> `audit_events()`  [INFERRED]
  .design/checkup-report.md → backend/app/api/admin.py
- `Double-check before you report` --references--> `faculty_user()`  [INFERRED]
  docs/prompts/chatgpt-instructor-analysis-and-announcements.md → backend/app/api/faculty/common.py
- `P1 — functional gaps / decisions` --references--> `performance()`  [INFERRED]
  docs/verification/faculty-admin-workspace-2026-10-29.md → backend/app/api/faculty/performance.py
- `Suggested API contract` --references--> `_serialize_challenge()`  [INFERRED]
  docs/CHATBOT_IMPLEMENTATION_PLAN_FOR_DEEPSEEK.md → backend/app/api/rag_instructor.py
- `End-to-end traces` --references--> `get_db()`  [INFERRED]
  docs/DATABASE_REVIEW_2026-11-12.md → backend/app/core/database.py

## Import Cycles
- None detected.

## Communities (168 total, 13 thin omitted)

### Community 0 - "ui.tsx"
Cohesion: 0.07
Nodes (93): Design system and data flow, Frontend, Stack and layout, 5.1 Shared library and components, AdminAccounts(), confirmDeactivate(), confirmReactivate(), openImpact() (+85 more)

### Community 1 - "ByteQuest 2.0: instructor activity analysis and class announcements"
Cohesion: 0.17
Nodes (11): ByteQuest 2.0: instructor activity analysis and class announcements, Database, Double-check before you report, Final report, Frontend, Hard rules, Part 1: Activity analysis, Part 2: Class announcements (+3 more)

### Community 2 - "ml_predictor/feature_engineering.py"
Cohesion: 0.23
Nodes (11): _as_bool(), _as_float(), _attempts_per_success(), _enum_value(), extract_features_from_dataframe(), extract_student_features(), feature_dict_to_vector(), _mean_nonnegative() (+3 more)

### Community 3 - "llm.py"
Cohesion: 0.10
Nodes (13): ErrorExplanationSchema, explain_code_error(), _client_for_key(), get_gemini_client(), GeminiLLMService, _retry_after(), test_concurrent_first_use_shares_the_gemini_transport(), second_caller() (+5 more)

### Community 4 - "test_learning_flow_integration.py"
Cohesion: 0.08
Nodes (55): _challenge(), new_session(), _graded_job(), _published_activity(), _quiz(), _recall_concept(), test_a_closed_challenge_cannot_reopen_after_its_solution_was_shown(), test_chat_and_hints_are_grounded_in_own_course_pdfs() (+47 more)

### Community 5 - "reviews.py"
Cohesion: 0.12
Nodes (32): get_review(), _locked_student(), _public_review(), _question_id(), _require_memory(), ReviewOverviewResponse, ReviewResponse, ReviewResult (+24 more)

### Community 6 - "rag_instructor.py"
Cohesion: 0.08
Nodes (38): archive_document(), create_document_version(), DocumentMetadataUpdate, _embed_chunks(), _gemini_unavailable_http_exception(), generate_ai_coding_challenge(), generate_ai_conceptual_quiz(), _generation_payload() (+30 more)

### Community 7 - "test_faculty_admin.py"
Cohesion: 0.07
Nodes (40): GradingWorkerHeartbeat, MLPrediction, record_prediction_outcome(), course_exam_ids(), released_exam_history(), _utc(), record_grading_worker_heartbeat(), _consent() (+32 more)

### Community 8 - "workspace.ts"
Cohesion: 0.04
Nodes (97): AccountPanel(), AdminOverview(), AdminSections(), AttentionSummary(), BarList(), ConsentStatus, habitsMessage(), InstructorOverview() (+89 more)

### Community 9 - "start-bytequest.ps1"
Cohesion: 0.07
Nodes (40): ConvertTo-EncodedPowerShellCommand(), ConvertTo-PowerShellLiteral(), Get-FrontendFingerprint(), Get-Judge0VmIPv4(), Get-Judge0VmIPv4FromNeighbor(), Get-ListenerPidMap(), Get-PageScriptPaths(), Get-PortListenerPids() (+32 more)

### Community 10 - "activities/[id]/page.tsx"
Cohesion: 0.05
Nodes (66): ActivityEditor(), confirmPublish(), createVersion(), diffPayload(), runVerification(), save(), saveSchedule(), validate() (+58 more)

### Community 11 - "workspace_queries.py"
Cohesion: 0.10
Nodes (39): admin_activities(), admin_dashboard(), list_course_operations(), list_activity_workspace(), _course_brief(), faculty_dashboard(), list_courses(), activity_analysis() (+31 more)

### Community 12 - "supabase.ts"
Cohesion: 0.11
Nodes (26): 8 Required Acceptance Checks, Durability Boundary & Concurrency Guarantees, Exam Autosave & Conflict-Safe Recovery Verification, Interrupted Exam Autosave & Browser Recovery (Checklist Item #3), cleared, localMap, mockLocalStorage, mockSessionStorage (+18 more)

### Community 13 - "retrieval.py"
Cohesion: 0.11
Nodes (13): GeminiEmbeddingService, generate_embedding(), activity_document_ids(), _chat_excerpt(), cited_sources(), course_document_ids(), is_query_vector(), leading_chunks() (+5 more)

### Community 14 - "announcements.py"
Cohesion: 0.13
Nodes (13): AnnouncementCreate, AnnouncementExpiry, AnnouncementPatch, _audit_change(), _authorize_announcement(), create_announcement(), delete_announcement(), list_announcements() (+5 more)

### Community 15 - "faculty_ml.py"
Cohesion: 0.15
Nodes (17): faculty_user(), _accuracy(), _course_activities(), dashboard(), evaluation(), _faculty(), _period_cutoff(), _snapshot() (+9 more)

### Community 16 - "app-shell.tsx"
Cohesion: 0.17
Nodes (19): WorkspaceLayout(), AppShell(), AuthenticatedLayout(), isActiveDestination(), ProfileContext, useScrollResetOnRouteChange(), LegacyQuestRedirect(), AppNavIcon() (+11 more)

### Community 17 - "test_api_security.py"
Cohesion: 0.08
Nodes (17): _embed_document_chunk(), Settings, reserve(), Rule, window_bounds(), extract_chunks_from_pdf(), test_ai_global_budgets_are_independent(), test_chat_has_dedicated_account_and_global_quota() (+9 more)

### Community 18 - "entities.py"
Cohesion: 0.05
Nodes (20): CodeSubmissionRequest, run_code_submission(), _shadow_scoring_ready(), get_settings(), RequestSizeLimitMiddleware, require_instructor(), build_profile(), student_activity_clause() (+12 more)

### Community 19 - "StorageError"
Cohesion: 0.25
Nodes (5): StorageError, SupabasePDFStorage, test_accepts_absolute_signed_url_from_configured_origin(), test_rejects_untrusted_signed_url(), test_resolves_supabase_relative_signed_path()

### Community 20 - "predictor.py"
Cohesion: 0.11
Nodes (15): lifespan(), load_ml_models(), ModelArtifactError, ModelArtifactsUnavailable, ModelBundle, _partition_report(), _positive_probability(), predict_student_success() (+7 more)

### Community 21 - "profiles.py"
Cohesion: 0.14
Nodes (24): ActivityDay, _admin_analytics(), AdminAnalytics, AdminAttention, AnalyticsResponse, AuditEntry, BadgeEntry, _enum_value() (+16 more)

### Community 22 - "evaluation.tsx"
Cohesion: 0.06
Nodes (48): ComparisonTable(), ConfusionMatrix(), CURVE_COLORS, CURVE_DASH, CurveChart(), Methodology(), metric(), METRIC_COLUMNS (+40 more)

### Community 23 - "quest_groups.py"
Cohesion: 0.11
Nodes (20): create_quest_group(), CreateQuestGroup, _group_view(), _group_views(), join_quest_group(), JoinQuestGroup, list_quest_groups(), _published_activities() (+12 more)

### Community 24 - "course_access.py"
Cohesion: 0.14
Nodes (14): admin_user(), instructor_exams(), student_announcements(), active_membership_course_ids(), default_instructor_course_id(), ensure_owned_or_admin(), has_course_role(), is_admin() (+6 more)

### Community 25 - "6. Prioritized improvement backlog"
Cohesion: 0.08
Nodes (26): 1. Where the project stands, 2. Progress percentages and how they were calculated, 3. What exists today and where evidence stops, 4. Verification evidence and its limits, 5. Six gates before a live classroom pilot, 6. Prioritized improvement backlog, 7. Execution order, AI, LLM, RAG and provider handling (+18 more)

### Community 26 - "Judge0Client"
Cohesion: 0.15
Nodes (5): _b64_decode(), _b64_encode(), Judge0Client, main(), verify_compilers()

### Community 27 - "activities.py"
Cohesion: 0.07
Nodes (50): ActivityCreate, ActivityUpdate, create_activity(), create_activity_version(), get_activity(), _grading_fields(), preview_activity(), publish_activity() (+42 more)

### Community 28 - "qa_mixed_exam_load.py"
Cohesion: 0.12
Nodes (13): require_local(), main(), measure_exam_samples(), prepare_exam(), report_exam_grading(), run(), restart_worker(), save_exam() (+5 more)

### Community 29 - "getErrorMessage"
Cohesion: 0.04
Nodes (66): 4.5 Administrator API (`backend/app/api/admin.py`, prefix `/api/v1/admin`), ConsentStatus, ResearchConsentSettingsPage(), save(), confirmArchive(), doConfirm(), doRemove(), submitAssign() (+58 more)

### Community 30 - "api.ts"
Cohesion: 0.04
Nodes (55): Step A checkpoint and caller verification, 2. Repository discovery (recorded before changes), AnnouncementsPage(), mocks, mocks, report, ProfilePage(), adminAnalytics (+47 more)

### Community 31 - "chat-shell.tsx"
Cohesion: 0.24
Nodes (9): Repo map: exact files to inspect and change, ChatConversation, ChatIcon(), ChatPanel(), ChatShell(), close(), subscribeToBreakpoint(), useChatViewport() (+1 more)

### Community 32 - "Prioritized defects"
Cohesion: 0.12
Nodes (17): 10. [P3] Hidden-case aggregate summary incorrectly reports zero, 2. [P1] Verification can certify content that Judge0 never checked, 3. [P1] Unreleased exam successes can affect visible rewards, 4. [P1] The current release build exits with a dependency security warning, 5. [P2] Challenges with no visible sample can be published, 6. [P2] The dashboard recommends a closed quest that cannot be submitted, 7. [P2] Completing one exam can hide another due exam on the dashboard, 8. [P2] A failed quiz is labeled completed (+9 more)

### Community 33 - "onboarding/page.tsx"
Cohesion: 0.13
Nodes (30): AuthMode, OnboardingContent(), authenticate(), changeAuthMode(), checkExistingAuth(), finishPasswordSetup(), OnboardingPage(), PasswordInput() (+22 more)

### Community 34 - "Phase 7 dependency security review (2026-10-26)"
Cohesion: 0.33
Nodes (5): Findings and changes, Phase 7 dependency security review (2026-10-26), Remaining checks and limits, Scope, Verification performed

### Community 35 - "dashboard/page.tsx"
Cohesion: 0.07
Nodes (32): activityHref(), closesIn(), Dashboard, DashboardContent(), DashboardPage(), kindLabel(), localTime(), Progress (+24 more)

### Community 36 - "UserRole"
Cohesion: 0.05
Nodes (42): _chat_activity(), ChatLimits, ChatMessageRequest, ChatMessageResponse, ChatSource, ChatStatus, ChatTurn, _course_passages() (+34 more)

### Community 37 - "_enroll_chat_students"
Cohesion: 0.07
Nodes (29): _chat_failure(), GeminiAPIError, test_chat_requires_active_enrollment_only_for_students(), _chat_payload(), _course_pdf(), _enroll_chat_students(), test_ai_failures_leave_drafts_and_hint_allowance_intact(), get_client() (+21 more)

### Community 38 - "ProgrammingLang"
Cohesion: 0.10
Nodes (42): exam_catalog(), add_group_activities(), AddGroupActivities, ActivityReviewUpdate, publish_learning_activity(), reverify_instructor_draft(), update_activity_review(), update_instructor_draft() (+34 more)

### Community 39 - "insights.py"
Cohesion: 0.21
Nodes (14): CategoryCount, course_insights(), _event_days(), GamificationInsights, HelpSeeking, _manila_day(), MemoryRetention, _rate() (+6 more)

### Community 40 - "starter_username"
Cohesion: 0.16
Nodes (8): public_handle(), _starter_username(), _encoded_id(), is_starter_username(), starter_username(), _export_queries(), test_documented_exports_require_latest_current_consent(), session_factory()

### Community 41 - "progress_recap.py"
Cohesion: 0.13
Nodes (12): get_gamification_state(), _day(), _manila(), _practice_days(), progress_recap(), RecapMetric, first_practice_days(), mechanic_state() (+4 more)

### Community 42 - "4. Findings and implementation blueprint"
Cohesion: 0.08
Nodes (24): 1. Where ByteQuest stands, 2. How the system fits together, 3. Work order, 4. Findings and implementation blueprint, 5. Local completion checklist, 6. Which existing document answers which question, BQ-01 — Award completion XP at the first eligible event, BQ-02 — Give submission jobs one owner per claim (+16 more)

### Community 43 - "attempt_visibility.py"
Cohesion: 0.11
Nodes (19): dashboard(), activity_accepts_submissions_clause(), activity_has_opened(), activity_is_closed(), _as_utc(), guard_solution_reopen(), learner_visible_attempt_clause(), student_visible_activity_clause() (+11 more)

### Community 44 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 45 - "_save_turn"
Cohesion: 0.17
Nodes (20): _check_revision(), Conversation, ConversationPage, delete_conversation(), _find_conversation(), get_conversation(), get_turn_status(), _owned_conversation() (+12 more)

### Community 46 - "accessibility-provider.tsx"
Cohesion: 0.20
Nodes (15): ACCESSIBILITY_STORAGE_KEYS, AccessibilityContext, AccessibilityContextValue, AccessibilityPreferences, AccessibilityProvider(), applyPreferences(), commitPreferences(), DEFAULT_PREFERENCES (+7 more)

### Community 47 - "Faculty and administrator workspace — implementation log and continued work"
Cohesion: 0.11
Nodes (17): 10. Files created or modified (this work), 11. Quick current-state checklist, 1. Status at handoff, 6. Tests added, 7. Verification evidence (live app), 8. How to continue (commands, accounts, cleanup), 9. Remaining work, Additional navigation fix (+9 more)

### Community 48 - "package.json"
Cohesion: 0.04
Nodes (46): dependencies, monaco-editor, @monaco-editor/react, next, react, react-dom, react-is, recharts (+38 more)

### Community 49 - "Phase 1 — ByteQuest instructor redesign plan"
Cohesion: 0.07
Nodes (28): Activity editor, Analytics, Analytics desktop, Analytics phone, API and data performance, Assumptions, Chart library and motion, Dashboard and Analytics division (+20 more)

### Community 50 - "accessibility-settings.tsx"
Cohesion: 0.27
Nodes (8): 5.2 Faculty routes, 5.3 Administrator routes, 5.4 Navigation and shell integration, 5. Frontend changes, AccessibilityPreferenceKey, ACCESSIBILITY_SETTINGS, AccessibilitySettingDefinition, AccessibilitySettings()

### Community 51 - "AppTooltips"
Cohesion: 0.27
Nodes (17): AppTooltips(), clearTimers(), findTarget(), hide(), onClick(), onContextMenu(), onFocusIn(), onFocusOut() (+9 more)

### Community 52 - "request_size.py"
Cohesion: 0.27
Nodes (7): limited_receive(), tracked_send(), _TooLarge, test_streamed_body_without_content_length_is_limited(), read_body(), receive(), send()

### Community 53 - "reveals_solution"
Cohesion: 0.22
Nodes (13): _contains_tokens(), _ngrams(), reveals_solution(), _single_line_repair(), _tokens(), test_challenge_chat_rejects_alternate_code_even_without_reference_overlap(), test_exact_repair_to_failed_sample_is_withheld_even_if_it_is_in_the_starter(), test_full_solution_is_blocked_even_with_renamed_variables() (+5 more)

### Community 54 - "codex.py"
Cohesion: 0.23
Nodes (11): get_codex(), ChallengeRecovery, codex_summary(), CodexCategory, CodexRecovery, CodexResponse, CodexSummary, practice_errors() (+3 more)

### Community 55 - "chat-provider.tsx"
Cohesion: 0.10
Nodes (31): Already strong (checked, not assumed), chatHistory, ChatMode, ConversationPage, ConversationSummary, SavedReply, SavedTurn, Transcript (+23 more)

### Community 56 - "vps_bootstrap.sh"
Cohesion: 0.24
Nodes (15): active_ssh_port(), configure_cgroup_v1(), configure_docker(), configure_firewall(), configure_swap(), DEBIAN_FRONTEND, die(), DOCKER_KEYRING (+7 more)

### Community 57 - "test_schema_integrity.py"
Cohesion: 0.18
Nodes (9): pytest_sessionstart(), _make_profile(), test_badge_code_is_required(), test_core_timestamps_are_aware_and_comparable(), test_database_rejects_invalid_public_usernames(), test_processing_status_accepts_documented_states(), test_processing_status_rejects_unknown_state(), test_signup_roles_with_local_staff_registration_enabled() (+1 more)

### Community 58 - "LegalDocument"
Cohesion: 0.25
Nodes (8): metadata, Page(), metadata, Page(), LegalDocument(), LegalKind, LegalModal(), PolicyPanel()

### Community 59 - "InstructorPage"
Cohesion: 0.08
Nodes (26): DraftChallengeUpdate, DraftQuizUpdate, GeneratedChallengeSchema, GeneratedQuizOptionSchema, GeneratedQuizQuestionSchema, GeneratedQuizSchema, TestCaseSchema, A. Add more code challenges (+18 more)

### Community 60 - "app/layout.tsx"
Cohesion: 0.16
Nodes (11): byteBounce, metadata, RootLayout(), viewport, TooltipState, ToastApi, ToastContext, ToastItem (+3 more)

### Community 61 - "exams.py"
Cohesion: 0.09
Nodes (42): assigned(), assigned_exam_numbers(), _assigned_exams_with_state(), create_exam(), DraftExam, DraftItem, _exam_access(), exam_sample_run() (+34 more)

### Community 62 - "instructor/materials/page.tsx"
Cohesion: 0.12
Nodes (21): EMPTY_UPLOAD, FacultyMaterials(), confirmArchive(), doDownload(), doRestore(), doRetry(), submitEdit(), submitUpload() (+13 more)

### Community 63 - "leaderboard.tsx"
Cohesion: 0.20
Nodes (12): CHOOSE_HANDLE_HREF, Leaderboard(), LeaderboardData, LeaderboardEntry, LeaderboardStanding, LearnerName(), MEDAL, Row() (+4 more)

### Community 64 - "numpy"
Cohesion: 0.23
Nodes (7): _build_pipeline(), _evaluate_partition(), _finite_or_none(), _fit_tuned_model(), _probability_for_success(), split_students_disjoint(), _validate_group_splits()

### Community 65 - "test_ml_exam_features.py"
Cohesion: 0.15
Nodes (11): _forecast(), test_exam_inputs_only_appear_after_release_in_the_same_course(), test_faculty_forecast_uses_the_recorded_winner_and_hides_legacy_probability(), test_older_feature_schema_artifacts_are_rejected(), test_training_rejects_ids_that_encode_an_account(), Part 2: Pilot-data changes (must land before any student data is collected), _as_binary_label(), _encodes_account_id() (+3 more)

### Community 66 - "ByteQuest 2.0 database review — 12 November 2026"
Cohesion: 0.08
Nodes (21): _id(), test_every_public_timestamp_column_is_aware(), ByteQuest 2.0 engineering and UX review, Findings, Performance evidence, Recommended sequence, Verification and limits, ByteQuest backend runtime review (+13 more)

### Community 67 - "ByteQuest 2.0 Classroom Pilot Operator Runbook"
Cohesion: 0.17
Nodes (12): 1. Hard Safety Gates (Enforced by Configuration), 2. Lab Station & Shared-Computer Protocol, 3. Network Resilience & Live Draft Sync, 4. Timed Exam Operations, 5. Verification Commands, 6. Incident Troubleshooting, ByteQuest 2.0 Classroom Pilot Operator Runbook, Classroom Wi-Fi Reconnect Banner (+4 more)

### Community 68 - "Session"
Cohesion: 0.10
Nodes (41): admin_retry_material(), admin_update_material(), monitoring(), retry_job(), delete_history(), _history_user(), _draft_response(), _material_for_user() (+33 more)

### Community 69 - "gamification-insights.tsx"
Cohesion: 0.15
Nodes (16): useAccessibility(), EngagementChart(), CategoryCount, EngagementChart, GamificationInsightsData, GamificationInsightsView(), InsufficientData(), MeterList() (+8 more)

### Community 70 - "ByteQuest local end-to-end flow"
Cohesion: 0.17
Nodes (12): Account-synced progression check, Before deployment, ByteQuest local end-to-end flow, Instructor account, Local Quest Map demos, Manual startup, One-click Windows startup, Phase 6 shadow scoring status (+4 more)

### Community 71 - "Phase 0 — ByteQuest instructor audit"
Cohesion: 0.22
Nodes (8): Current FastAPI inventory, Current screens and feature coverage, Decisions for Phase 1, Desktop scorecard, Findings, Phase 0 — ByteQuest instructor audit, Supabase data and authorization, Verification

### Community 72 - "ByteQuest 2.0"
Cohesion: 0.22
Nodes (9): Architecture, ByteQuest 2.0, Configuration and security, Documentation, Repository layout, Stack and deployment, Start locally on Windows, Test and verify (+1 more)

### Community 73 - "httpx"
Cohesion: 0.19
Nodes (8): challenge_specs(), main(), student(), main(), ask(), join_new_workshop(), queries_to_list_workshops(), test_concurrent_username_claims_allow_only_one_winner()

### Community 74 - "activity-analysis.tsx"
Cohesion: 0.26
Nodes (10): Page(), ActivityAnalysisView(), AnalysisChart(), analysisReading(), errorReadings, percent, percentOrDash(), analysis (+2 more)

### Community 75 - "use-exam-answer-sync.ts"
Cohesion: 0.19
Nodes (14): Attempt, AttemptResult, AttemptResultItem, ExamAnswers, ExamItem, ExamSyncBannerState, formatClockTime(), QuizQuestion (+6 more)

### Community 76 - "useChatController"
Cohesion: 0.24
Nodes (17): turnMessages(), mapChatError(), useChatController(), applySavedReply(), canSend(), checkReply(), handleFailure(), openConversation() (+9 more)

### Community 77 - "_detect_avatar_content_type"
Cohesion: 0.24
Nodes (4): _detect_avatar_content_type(), upload_my_avatar(), test_detect_avatar_content_type_recognizes_supported_signatures(), test_detect_avatar_content_type_rejects_metadata_only_and_truncated_files()

### Community 78 - "ByteQuest 2.0 — Full system review"
Cohesion: 0.13
Nodes (13): ByteQuest 2.0 — Full system review, Evidence, Must fix, Nice to have, Not checked, Ratings, Should fix, Verdict (+5 more)

### Community 79 - "Profile"
Cohesion: 0.07
Nodes (55): account_emails_for_email(), account_impact(), _account_needs_action(), AccountCreate, activity_impact(), _admin_activity(), _admin_activity_item(), admin_archive_activity() (+47 more)

### Community 80 - "SYSTEM_STATUS_AND_RELEASE_PLAN.md"
Cohesion: 0.17
Nodes (4): ByteQuest repository guidance, Current system status, graphify, This is NOT the Next.js you know

### Community 81 - "ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash"
Cohesion: 0.20
Nodes (9): Behavior and scope of the assistant, ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash, Placement and responsive layout, Product decision, Quality gates and acceptance tests, Ready-to-paste DeepSeek V4.1 Flash implementation prompt, State and error rules, Suggested API contract (+1 more)

### Community 82 - "Phase 7 database and file backup/restore runbook"
Cohesion: 0.05
Nodes (31): get_current_user_payload(), TokenPayload, auth(), verify(), claims(), test_es256_verifies_locally_off_the_event_loop(), test_failed_jwks_verification_falls_back(), test_non_asymmetric_algorithms_never_use_jwks() (+23 more)

### Community 83 - "ByteQuest 2.0: Master Architecture Plan & Execution Roadmap"
Cohesion: 0.08
Nodes (24): 1. Project Tracking & Thesis Collaboration Strategy, 2. Core Architectural Rules (Non-Negotiable), 3. Repository Directory Structure, 4. Course-Sequence & Curriculum Alignment, 5. Database Schema Blueprint (Supabase PostgreSQL + pgvector), 6. 7-Phase Development Plan, 7. Thesis Objectives Mapping (Chapter 1 Alignment), 8. Development Environment & Quickstart Commands (+16 more)

### Community 84 - "Phase 7 deployment readiness"
Cohesion: 0.18
Nodes (11): Decisions required before production setup, Deployment order after the decisions are made, Evidence still needed, Local Judge0 runtime smoke check (2026-10-26), Notes on local verification, Phase 7 deployment readiness, Prepared in the repository, Production settings and network boundaries (+3 more)

### Community 85 - "account-menu.tsx"
Cohesion: 0.33
Nodes (8): AccountMenu(), subscribeToSheetBreakpoint(), usesAccountSheet(), hueFromSeed(), identiconCells(), UserAvatar(), UserAvatarProps, useSignOut()

### Community 86 - "mastery_map.py"
Cohesion: 0.24
Nodes (9): get_mastery_map(), get_reviews(), _utcnow(), published_track_clause(), first_visible_completions(), mastery_map(), MasteryConcept, MasteryMapResponse (+1 more)

### Community 87 - "prepare-monaco.mjs"
Cohesion: 0.12
Nodes (13): frontend, marker, packageDir, source, target, fixture, capture(), failures (+5 more)

### Community 88 - "exams/[id]/page.test.tsx"
Cohesion: 0.15
Nodes (10): ExamPage(), handleRunSample(), handleStartExam(), hydrateAndReconcileOnce(), answerSaves(), Call, mocks, savedBodies() (+2 more)

### Community 89 - "instructor/page.tsx"
Cohesion: 0.17
Nodes (27): CourseInsights(), Insights(), AttentionRow(), Dashboard(), loadQueue(), Page(), AnnounceButton(), CourseSwitcher() (+19 more)

### Community 90 - "qa_starter_tutoring.py"
Cohesion: 0.21
Nodes (8): destroy(), main(), _evaluate(), _failed_sample(), main(), _request(), TutorCase, evaluate()

### Community 91 - "Instructor activity analysis and class announcements"
Cohesion: 0.33
Nodes (6): Activity analysis, Browser verification, Class announcements, Instructor activity analysis and class announcements, Remaining verification, Verification

### Community 92 - "Desktop and Mobile Pilot Flows (`pilot-v2.html`)"
Cohesion: 0.22
Nodes (8): 1. Offline / Network Reconnect Banner, 2. Pending / Queued Grading State, 3. Research Consent & Withdrawal State (Disabled Collection Notice), 4. Active Exam Priority Banner & Timed Attempt Lock, ByteQuest web app wireframes, Coverage, Desktop and Mobile Pilot Flows (`pilot-v2.html`), Review checklist

### Community 93 - "qa_live_multi_role.py"
Cohesion: 0.15
Nodes (18): api_base(), cleanup(), create_accounts(), instructor_builds_course(), letters(), main(), password_token(), print_report() (+10 more)

### Community 94 - "ByteQuest 2.0: close the manuscript gaps, tidy the structure, then review and rate the system"
Cohesion: 0.25
Nodes (7): ByteQuest 2.0: close the manuscript gaps, tidy the structure, then review and rate the system, Do not, Final report, Part 3: Code structure (targeted; behaviour must stay identical), Part 4: Review and targeted fixes, Stack and layout, Verification

### Community 95 - "get"
Cohesion: 0.07
Nodes (20): audit_events(), get_settings(), list_conversations(), get_ml_analytics_summary(), InstructorAnalyticsResponse, ModelVersionCount, consent_status(), username_availability() (+12 more)

### Community 96 - "Phase 7 synthetic deployment preflight — 2026-10-26"
Cohesion: 0.33
Nodes (5): Evidence, Limits, Phase 7 synthetic deployment preflight — 2026-10-26, Result, Scope and method

### Community 97 - "ML pipeline synthetic verification — 2026-10-25"
Cohesion: 0.29
Nodes (6): Artifact and activation checks, Execution, ML pipeline synthetic verification — 2026-10-25, Observed grouped metrics, Remaining Phase 5 work, Scope

### Community 98 - "arena.tsx"
Cohesion: 0.12
Nodes (27): ArenaPage(), Arena(), confirmResetCode(), endSegment(), handleCodeChange(), handleCopyOutput(), load(), onVisibilityChange() (+19 more)

### Community 99 - "preflight-host.sh"
Cohesion: 0.38
Nodes (6): fail(), MIN_MEMORY_BYTES, MIN_ROOT_FREE_BYTES, MIN_SWAP_BYTES, pass(), preflight-host.sh script

### Community 100 - "ProfileResponse"
Cohesion: 0.17
Nodes (7): complete_staff_setup(), complete_student_onboarding(), delete_my_avatar(), get_my_profile(), OnboardingRequest, ProfileResponse, _require_student()

### Community 101 - "Classroom pilot fixes and verification — 2026-10-28"
Cohesion: 0.33
Nodes (5): Changes checked locally, Classroom pilot fixes and verification — 2026-10-28, Evidence, Other Remaining Pilot Verification Gates, Verification Status & Remaining Gates

### Community 102 - "ML feature engineering and training"
Cohesion: 0.40
Nodes (5): Comparison protocol, Export an attempt dataset, ML feature engineering and training, Prepare an Ubuntu VPS, Safe pipeline setup

### Community 103 - "monitoring.py"
Cohesion: 0.17
Nodes (17): _check_judge0(), _grading_worker_health(), _minutes(), overall_health(), _prediction_health(), _rag_health(), _runner_health(), runner_status() (+9 more)

### Community 104 - "ByteQuest Gemini tutor pilot evaluation"
Cohesion: 0.50
Nodes (4): ByteQuest Gemini tutor pilot evaluation, Reply quality, Token use and estimated Gemini cost, What was tested

### Community 106 - "ByteQuest navigation"
Cohesion: 0.50
Nodes (4): ByteQuest navigation, Compatibility and new destinations, Existing routes, Local verification

### Community 107 - "home-redirect.tsx"
Cohesion: 0.27
Nodes (8): HomePage(), FEATURED_SLIDES, FeaturedQuestWindow(), FeaturedSlide, HomeRedirect(), consumeInviteCallback(), SafeNavigationOptions, useSafeWindowNavigation()

### Community 108 - "quests_gamification.py"
Cohesion: 0.10
Nodes (21): _ensure_student(), get_gamification_leaderboard(), get_progress_recap(), get_student_progress(), LeaderboardEntry, LeaderboardResponse, LeaderboardStanding, list_published_quests() (+13 more)

### Community 110 - "Python demo journey — 2026-10-28"
Cohesion: 0.40
Nodes (4): Browser walkthrough, Implemented, Local evidence, Python demo journey — 2026-10-28

### Community 111 - "Judge0 Hyper-V Ubuntu boot incident and recovery"
Cohesion: 0.13
Nodes (15): 1. Start and open the known-good VM, 2. Confirm the Judge0 services and volume inside Ubuntu, 3. Get the current guest IP and check the port, 4. Update ByteQuest if the VM IP changed, 5. Restart FastAPI and leave it running, 6. Verify service integration without exposing secrets, Current verified state, Disk and data safety (+7 more)

### Community 112 - "ByteQuest 2.0 system status and weekly change log"
Cohesion: 0.29
Nodes (7): ByteQuest 2.0 system status and weekly change log, Current feature and deployment map, How close is ByteQuest to finished?, Latest local verification, UI and UX review, What changed this week, Work left before the next milestone

### Community 113 - "solve_quality.py"
Cohesion: 0.23
Nodes (6): best_challenge_stars(), challenge_stars(), help_pattern(), hint_timing(), solve_stars(), tried_before_hint()

### Community 114 - "Local API security verification — 2026-10-28"
Cohesion: 0.50
Nodes (3): 30-student local load, Checks, Local API security verification — 2026-10-28

### Community 115 - "Phase 7 database pool budget hardening"
Cohesion: 0.50
Nodes (3): Change, Checks performed, Phase 7 database pool budget hardening

### Community 116 - "test_profile_analytics.py"
Cohesion: 0.21
Nodes (10): _add_audit(), _analytics(), test_admin_priority_puts_failed_jobs_first(), test_each_role_receives_only_its_own_branch(), test_existing_admin_fields_remain_compatible(), test_existing_instructor_fields_remain_compatible(), test_faculty_attention_covers_only_assigned_courses(), test_faculty_without_courses_gets_a_calm_fallback() (+2 more)

### Community 117 - "chat-conversation.tsx"
Cohesion: 0.19
Nodes (11): availabilityCopy, ChatConversation(), onInputKey(), submit(), languageNames, suggestedPrompts(), ChatMessageContent(), CodeBlock() (+3 more)

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
Cohesion: 0.08
Nodes (36): ActivityAttempt, Badge, Exam, HintUse, PlatformSetting, StudentBadge, evaluate_and_award_badges(), _qualifies() (+28 more)

### Community 124 - "test_learning_flow_integration.py"
Cohesion: 0.11
Nodes (24): ChallengeHint, ExamAttempt, claim_exam(), ExamGradingClaim, _grade_claimed_exam(), grade_exam(), _lock_exam_claim(), _grade_queued_exam() (+16 more)

### Community 126 - "instructor-dashboard.ts"
Cohesion: 0.17
Nodes (14): activityVerbs, attentionPriority(), caughtUp, clock, dashboardDay, dashboardHeading(), feedDay, hourInManila (+6 more)

### Community 127 - "SubmissionJob"
Cohesion: 0.20
Nodes (11): SubmissionJob, claim(), main(), process(), recover_stale_submission_jobs(), _write_heartbeat(), _run_queued_job(), test_pilot_drafts_jobs_hints_and_consent_gate() (+3 more)

### Community 128 - "ByteQuest manuscript and system alignment checklist"
Cohesion: 0.20
Nodes (10): 1. Scope decisions, 2. Chapter 1 — Introduction and scope, 3. Chapter 2 — Literature and synthesis, 4. Chapter 3 — Roles, practice, and AI, 5. Chapter 3 — Assessment and architecture, 6. Chapter 3 — Consent, research data, and ML, 7. Study records and final sign-off, ByteQuest manuscript and system alignment checklist (+2 more)

### Community 132 - "workspace-provider.tsx"
Cohesion: 0.22
Nodes (10): AdminLayout(), FacultyLayout(), useShellProfile(), WorkspaceContext, WorkspaceContextValue, WorkspaceProvider(), CourseSummary, getAdminCourses() (+2 more)

### Community 133 - "ByteQuest 2.0 live deployment stack"
Cohesion: 0.40
Nodes (5): Before the 30-student session, ByteQuest 2.0 live deployment stack, PHP budget, What ByteQuest runs, What to pay for

### Community 134 - "chat-workspace.tsx"
Cohesion: 0.30
Nodes (10): ChatPage(), useChat(), ChatDialog(), ChatSettings(), ChatWorkspace(), select(), start(), HistoryAction (+2 more)

### Community 135 - "ML features and prediction unit: manuscript vs. code"
Cohesion: 0.40
Nodes (5): 1. The two feature sets, 2. The prediction unit and label, 3. Decisions for the adviser, 4. Files that would change, ML features and prediction unit: manuscript vs. code

### Community 136 - "ByteQuest KVM 2 live pilot"
Cohesion: 0.40
Nodes (5): Before provisioning, ByteQuest KVM 2 live pilot, Configure and start the stack, Decide whether to start the classroom pilot, Local verification on 20 November 2026

### Community 137 - "submission-comparison.tsx"
Cohesion: 0.21
Nodes (12): Editor, AttemptSummary(), CodeDiff(), loadEditor(), ComparedAttempt, ComparisonResult(), isDesktop(), PanelState (+4 more)

### Community 138 - "Step C — Instructor visual verification"
Cohesion: 0.33
Nodes (6): Current routes and behavior, Phase 2 API and rollout list, Reference tokens and icons, Screenshot comparisons, Step C — Instructor visual verification, Test target checks

### Community 139 - "judge0/__init__.py"
Cohesion: 0.17
Nodes (4): BatchEvaluationSummary, CircuitBreaker, Judge0CircuitOpenError, SingleTestResult

### Community 140 - "Judge0UnavailableError"
Cohesion: 0.23
Nodes (7): classify_judge0_status(), Judge0UnavailableError, _parse_completed_result(), metric(), sandbox_unavailable(), test_program_crash_is_still_graded_as_a_runtime_error(), unavailable()

### Community 141 - "pilot.py"
Cohesion: 0.16
Nodes (23): challenge(), choose_consent(), close_challenge(), ConsentChoice, DraftPayload, _expired_hint_reservation(), get_draft(), group_students() (+15 more)

### Community 142 - "Local API security contract"
Cohesion: 0.40
Nodes (5): Access matrix, Local API security contract, Local verification and future deployment, Quotas and validation, School-issued IDs for student sign-up

### Community 144 - "instructor-studio.tsx"
Cohesion: 0.17
Nodes (9): BusyAction, emptyWorkspace, languageName, QuizQuestion, TestCase, Workspace, WorkspaceActivity, WorkspaceDocument (+1 more)

### Community 145 - "chat-provider.test.tsx"
Cohesion: 0.18
Nodes (8): ChatProvider(), auth, bodies(), openChat(), ready, routeApi(), savedChat, CHAT_STORAGE_KEY

### Community 146 - "settings_service.py"
Cohesion: 0.38
Nodes (6): _coerce(), list_settings(), _range_error(), serialize_setting(), _typed_value(), update_setting()

### Community 147 - "newRequestId"
Cohesion: 0.27
Nodes (7): RFC-4122, Hard rules, requestAiHint(), revealReviewedHint(), LOOPBACK_HOSTS, newRequestId(), reachableServiceUrl()

### Community 148 - "Phase 7 backend image build verification"
Cohesion: 0.40
Nodes (4): Limits, Phase 7 backend image build verification, Recorded evidence, Work completed

### Community 149 - "Phase 7 local production-mode runtime verification"
Cohesion: 0.17
Nodes (10): Boundaries and remaining work, Phase 7 local production-mode runtime verification, Procedure, Reproduction, Results, Changes, Limits, Local runtime spot check — 2026-10-26 (+2 more)

### Community 150 - "next"
Cohesion: 0.04
Nodes (56): nextConfig, ExamCard, ExamsPage(), localTime(), getBriefDescription(), QuestsPage(), QuestsPageContent(), clearFilters() (+48 more)

### Community 151 - "Prompt for ChatGPT: ByteQuest gamification, Phases 2 and 3"
Cohesion: 0.20
Nodes (9): 10. Definition of done (for each part), 11. Double-check everything you implemented (mandatory), 12. Final report format, 1. Your role and mission, 3. Stack, layout and commands, 6. Phase 2A — Debugger's Codex (badges + progress indicator), 8. Phase 3A — Mastery Memory (quests + points, spaced retrieval), 9. Phase 3B — Staged mechanic rollout (counters the novelty dip) (+1 more)

### Community 152 - "Phase 6 shadow rollout implementation record"
Cohesion: 0.40
Nodes (5): Implemented, Phase 6 shadow rollout implementation record, Phase 7 handoff, Safety and current state, Verification still required

### Community 153 - "Corrected Lesson to Student Progress Verification"
Cohesion: 0.22
Nodes (6): Code and quality checks, Corrected Lesson to Student Progress Verification, Earlier student workflow verification (historical run), Environment and source, Follow-up and known boundaries, Instructor workflow

### Community 154 - "train_compare.py"
Cohesion: 0.10
Nodes (10): _atomic_joblib_dump(), _atomic_json_write(), _atomic_write(), _fit_baselines(), _format_metric(), generate_synthetic_thesis_dataset(), main(), run_training_and_comparison() (+2 more)

### Community 155 - "test_memory_rules.py"
Cohesion: 0.31
Nodes (4): review_passed(), review_size(), test_review_passes_at_two_thirds(), test_review_size_uses_up_to_four_questions()

### Community 156 - "Production instructor access"
Cohesion: 0.67
Nodes (3): Grant access to one account, Production instructor access, Safety boundaries

### Community 157 - "Phase 7 frontend build evidence"
Cohesion: 0.50
Nodes (3): Command and result, Phase 7 frontend build evidence, Scope and limits

### Community 158 - "Phase 7 Vercel setup verification — 2026-10-26"
Cohesion: 0.50
Nodes (3): Evidence and limits, Phase 7 Vercel setup verification — 2026-10-26, Verified state

### Community 159 - "test_sandbox_internal_error_is_unavailability_not_a_student_failure"
Cohesion: 0.28
Nodes (5): test_hidden_case_contributes_to_score_without_exposing_details(), language_ids(), poll_batch(), submit_batch(), test_sandbox_internal_error_is_unavailability_not_a_student_failure()

### Community 160 - "Judge0 Hyper-V Ubuntu VM: troubleshooting handoff"
Cohesion: 0.22
Nodes (9): Confirmed project and Judge0 setup, Current state, Direct-shell recovery method that worked, Historical recommendation written before the Install VM recovery, Judge0 Hyper-V Ubuntu VM: troubleshooting handoff, Known guest settings and identifiers, Sources, Timeline of important events and changes (+1 more)

### Community 161 - "Milestones 1A–1C Status and Verification Log"
Cohesion: 0.22
Nodes (9): Environment, Follow-up verification — 2026-10-25, Milestone 1A: Judge0 execution, Milestone 1B: Local Supabase schema and fixtures, Milestone 1C: Browser-to-database walkthrough — Complete, verified, Milestones 1A–1C Status and Verification Log, Official milestone disposition, Submission-flow corrections made (+1 more)

### Community 162 - "update_my_profile"
Cohesion: 0.33
Nodes (3): ProfileUpdateRequest, update_my_profile(), normalize_username()

### Community 164 - "runCode"
Cohesion: 0.50
Nodes (5): checkStatus(), runCode(), workedSeconds(), removeStoredRun(), sampleRunStatus()

## Knowledge Gaps
- **18 isolated node(s):** `monaco-editor`, `react-is`, `@types/node`, `@types/react`, `@types/react-dom` (+13 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1258 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `4. Read these before writing any code` connect `ActivityAttempt` to `ui.tsx`, `Session`, `test_learning_flow_integration.py`, `ProgrammingLang`, `attempt_visibility.py`, `quests_gamification.py`, `Judge0UnavailableError`, `profiles.py`, `mastery_map.py`, `Prompt for ChatGPT: ByteQuest gamification, Phases 2 and 3`, `test_learning_flow_integration.py`?**
  _High betweenness centrality (0.188) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `Session` (e.g. with `smoke_demo_quest()` and `test_two_concurrent_saves_cannot_commit_the_same_activity_version()`) actually correct?**
  _`Session` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `monaco-editor`, `react-is`, `@types/node` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ui.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07421289355322339 - nodes in this community are weakly interconnected._
- **Why does `LearningActivity` connect `ProgrammingLang` to `test_learning_flow_integration.py`, `reviews.py`, `rag_instructor.py`, `test_faculty_admin.py`, `workspace_queries.py`, `pilot.py`, `retrieval.py`, `faculty_ml.py`, `entities.py`, `predictor.py`, `profiles.py`, `quest_groups.py`, `activities.py`, `UserRole`, `_enroll_chat_students`, `insights.py`, `attempt_visibility.py`, `codex.py`, `exams.py`, `test_ml_exam_features.py`, `Session`, `Profile`, `mastery_map.py`, `qa_starter_tutoring.py`, `qa_live_multi_role.py`, `get`, `monitoring.py`, `quests_gamification.py`, `solve_quality.py`, `ActivityAttempt`, `test_learning_flow_integration.py`, `SubmissionJob`?**
  _High betweenness centrality (0.142) - this node is a cross-community bridge._
- **Are the 269 inferred relationships involving `Profile` (e.g. with `account_impact()` and `_account_needs_action()`) actually correct?**
  _`Profile` has 269 INFERRED edges - model-reasoned connections that need verification._
- **Should `llm.py` be split into smaller, more focused modules?**
  _Cohesion score 0.0957983193277311 - nodes in this community are weakly interconnected._