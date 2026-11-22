# Graph Report - ByteQuest_2.0  (2026-11-22)

## Corpus Check
- 470 files · ~512,089 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 38 file(s) not represented in the graph (top: (none) 19, .bat 5, .example 5)

## Summary
- 4268 nodes · 14266 edges · 184 communities (162 shown, 22 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 1879 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9ee6bcf6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ui.tsx
- ByteQuest 2.0: instructor activity analysis and class announcements
- Session
- getErrorMessage
- workshops.py
- chat-workspace.tsx
- gamification-insights.tsx
- test_faculty_admin.py
- activities/[id]/page.tsx
- start-bytequest.ps1
- useShellProfile
- drafts.py
- supabase.ts
- test_learning_flow_integration.py
- ActivityAttempt
- faculty_ml.py
- account-menu.tsx
- exams/[id]/page.test.tsx
- sqlalchemy_orm
- test_ml_exam_features.py
- SandboxHealth
- profiles.py
- test_api_security.py
- sqlalchemy
- Profile
- 6. Prioritized improvement backlog
- entities.py
- quests_gamification.py
- chat_history.py
- submission-comparison.tsx
- next
- workshop-home.tsx
- workshop-ui.tsx
- onboarding/page.tsx
- chat.py
- security.py
- WorkspaceProvider
- leaderboard.tsx
- api.ts
- insights.py
- train_compare.py
- ml_predictor/feature_engineering.py
- 4. Findings and implementation blueprint
- qa_mixed_exam_load.py
- compilerOptions
- Classroom pilot fixes and verification — 2026-10-28
- react
- Faculty and administrator workspace — implementation log and continued work
- package.json
- Phase 1 — ByteQuest instructor redesign plan
- performance.py
- AppTooltips
- qa-responsive.mjs
- reveals_solution
- ByteQuest UI and UX harmonization plan
- chat-provider.tsx
- vps_bootstrap.sh
- chat-conversation.tsx
- LegalDocument
- llm.py
- ByteQuest Insights, part 3 of 4: instructors
- exams.py
- lib/types.ts
- useChatController
- ByteQuest machine-learning improvement plan
- rag_instructor.py
- os
- ByteQuest 2.0 Classroom Pilot Operator Runbook
- _TooLarge
- workshop-activities.tsx
- ByteQuest local end-to-end flow
- accessibility-provider.tsx
- ByteQuest 2.0
- ProgrammingLang
- ByteQuest 2.0 — Full system review
- Phase 0 — ByteQuest instructor audit
- StorageError
- entities.py
- status
- Session
- SYSTEM_STATUS_AND_RELEASE_PLAN.md
- qa_live_multi_role.py
- progress_recap.py
- ByteQuest 2.0: Master Architecture Plan & Execution Roadmap
- Phase 7 deployment readiness
- submissions/[id]/page.tsx
- arena.tsx
- codex.py
- load_test_local_synthetic.py
- activities.py
- workspace.ts
- Instructor activity analysis and class announcements
- Desktop and Mobile Pilot Flows (`pilot-v2.html`)
- workspace-provider.test.tsx
- ByteQuest Insights, part 4 of 4: administrators
- app-shell.tsx
- LearningActivity
- ML pipeline synthetic verification — 2026-10-25
- _enroll_chat_students
- preflight-host.sh
- Phase 6 shadow rollout implementation record
- httpx
- ML feature engineering and training
- monitoring.py
- ByteQuest Gemini tutor pilot evaluation
- runCode
- ByteQuest navigation
- Workshops: Create, Join and the Workshop page
- test_pilot_regressions.py
- zerotier-relay.mjs
- Python demo journey — 2026-10-28
- PHASE7_DEPLOYMENT_READINESS.md
- ByteQuest 2.0 system status and weekly change log
- retrieval.py
- Local API security verification — 2026-10-28
- Phase 7 database pool budget hardening
- test_profile_analytics.py
- badges.py
- ByteQuest 2.0 before and after
- smoke-vps.sh
- ByteQuest pilot remediation checklist
- preflight-vps.sh
- flow
- newRequestId
- ByteQuest 2.0 system critique — 21 November 2026
- Judge0 Hyper-V Ubuntu boot incident and recovery
- ByteQuest manuscript and system alignment checklist
- upload_my_avatar
- ByteQuest 2.0 live deployment stack
- home-redirect.tsx
- ML features and prediction unit: manuscript vs. code
- ByteQuest KVM 2 live pilot
- get_current_user
- ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash
- ByteQuest 2.0: implementation guide and DeepSeek V4.1 Flash prompt
- FastAPI
- settings_service.py
- Local API security contract
- ActivityKind
- predictor.py
- ByteQuest UI/UX harmonization: slices 1–3 and ML slice planning
- ProfileResponse
- numpy
- performance/page.tsx
- chat-provider.test.tsx
- SupabaseAvatarStorage
- claim
- Prioritized defects
- pilot.py
- review-report.md
- 5. Slices
- Wireframes
- progress-recap.tsx
- workshop-progress.tsx
- student
- B. Findings
- complete_student_onboarding
- ByteQuest Insights, part 1 of 4: shared foundation
- profile/page.tsx
- problem-statement.ts
- ByteQuest Insights, part 2 of 4: students
- ByteQuest system status — 21 November 2026
- Phase 7 dependency security review (2026-10-26)
- reviews.py
- Phase 7 synthetic deployment preflight — 2026-10-26
- Analytics
- ByteQuest 2.0 database review — 12 November 2026

## God Nodes (most connected - your core abstractions)
1. `Session` - 352 edges
2. `Profile` - 345 edges
3. `LearningActivity` - 217 edges
4. `getErrorMessage()` - 144 edges
5. `ActivityAttempt` - 120 edges
6. `apiRequest()` - 118 edges
7. `ReviewState` - 110 edges
8. `ProgrammingLang` - 94 edges
9. `UserRole` - 92 edges
10. `ActivityKind` - 87 edges

## Surprising Connections (you probably didn't know these)
- `Supabase data and authorization` --references--> `audit_events()`  [INFERRED]
  .design/checkup-report.md → backend/app/api/admin.py
- `4.1 Migration` --references--> `audit_events()`  [INFERRED]
  docs/verification/faculty-admin-workspace-2026-10-29.md → backend/app/api/admin.py
- `Double-check before you report` --references--> `faculty_user()`  [INFERRED]
  docs/prompts/chatgpt-instructor-analysis-and-announcements.md → backend/app/api/faculty/common.py
- `P1 — functional gaps / decisions` --references--> `performance()`  [INFERRED]
  docs/verification/faculty-admin-workspace-2026-10-29.md → backend/app/api/faculty/performance.py
- `Slice 1: data and API (start here)` --references--> `WorkshopView`  [INFERRED]
  docs/prompts/chatgpt-workshop-classroom.md → backend/app/api/workshops.py

## Import Cycles
- None detected.

## Communities (184 total, 22 thin omitted)

### Community 0 - "ui.tsx"
Cohesion: 0.09
Nodes (68): Design system and data flow, Course health on System Overview, Frontend, Stack and layout, 5.1 Shared library and components, AdminAccounts(), confirmReactivate(), submitCreate() (+60 more)

### Community 1 - "ByteQuest 2.0: instructor activity analysis and class announcements"
Cohesion: 0.15
Nodes (12): Backend, ByteQuest 2.0: instructor activity analysis and class announcements, Database, Double-check before you report, Final report, Frontend, Hard rules, Part 1: Activity analysis (+4 more)

### Community 2 - "Session"
Cohesion: 0.09
Nodes (40): _admin_material_items(), admin_materials(), _material_for_user(), archive_material(), create_material(), download_material(), list_materials(), _material_rows() (+32 more)

### Community 3 - "getErrorMessage"
Cohesion: 0.05
Nodes (49): Phase 3: Document-Grounded RAG & Gemini Content Generation (Days 12–18), confirmDeactivate(), openImpact(), confirmArchive(), doConfirm(), doRemove(), submitAssign(), save() (+41 more)

### Community 4 - "workshops.py"
Cohesion: 0.10
Nodes (60): _activity_links(), _announcement_for_update(), AnnouncementView, archive_workshop(), can_manage(), create_workshop(), CreateAnnouncement, CreateWorkshop (+52 more)

### Community 5 - "chat-workspace.tsx"
Cohesion: 0.12
Nodes (24): ChatPage(), useChat(), openConversation(), startChat(), updateHistory(), activityFromPath(), ChatConversation, ChatIcon() (+16 more)

### Community 6 - "gamification-insights.tsx"
Cohesion: 0.09
Nodes (36): Already in place: extend, do not rebuild, Shared insight widgets, Verification and rollout, Already in place: extend, do not rebuild, useAccessibility(), CourseHealth(), CourseHealthRow, healthAction() (+28 more)

### Community 7 - "test_faculty_admin.py"
Cohesion: 0.06
Nodes (49): GradingWorkerHeartbeat, ResearchConsent, record_grading_worker_heartbeat(), _consent(), test_account_creation_provisions_a_profile_and_course_access(), test_activity_analysis_totals_and_practice_scope(), admin_row(), test_activity_editor_preview_hides_answer_keys_and_hidden_tests() (+41 more)

### Community 8 - "activities/[id]/page.tsx"
Cohesion: 0.05
Nodes (61): Step A checkpoint and caller verification, ActivityEditor(), confirmPublish(), createVersion(), diffPayload(), runVerification(), save(), saveSchedule() (+53 more)

### Community 9 - "start-bytequest.ps1"
Cohesion: 0.07
Nodes (42): ConvertTo-EncodedPowerShellCommand(), ConvertTo-PowerShellLiteral(), Get-BackendFingerprint(), Get-FrontendFingerprint(), Get-Judge0VmIPv4(), Get-Judge0VmIPv4FromNeighbor(), Get-ListenerPidMap(), Get-PageScriptPaths() (+34 more)

### Community 10 - "useShellProfile"
Cohesion: 0.18
Nodes (15): Announcement, AnnouncementDialog, Announcements(), merge(), pin(), save(), item, mocks (+7 more)

### Community 11 - "drafts.py"
Cohesion: 0.09
Nodes (37): admin_activities(), _admin_activity_item(), admin_dashboard(), course_reference_brief(), _activity_brief(), _course_brief(), _draft_item(), _draft_response() (+29 more)

### Community 12 - "supabase.ts"
Cohesion: 0.09
Nodes (36): Durability Boundary & Concurrency Guarantees, Interrupted Exam Autosave & Browser Recovery (Checklist Item #3), cleared, localMap, mockLocalStorage, mockSessionStorage, remaining, storageMap (+28 more)

### Community 13 - "test_learning_flow_integration.py"
Cohesion: 0.07
Nodes (41): ExamAttempt, claim_exam(), _grade_queued_exam(), _letters(), _ranked_student(), _run_queued_job(), _set_due_at(), _started_quiz_exam() (+33 more)

### Community 14 - "ActivityAttempt"
Cohesion: 0.10
Nodes (20): dashboard(), ActivityAttempt, activity_accepts_submissions_clause(), activity_has_opened(), activity_is_closed(), _as_utc(), learner_visible_attempt_clause(), published_track_clause() (+12 more)

### Community 15 - "faculty_ml.py"
Cohesion: 0.19
Nodes (15): _accuracy(), _course_activities(), dashboard(), evaluation(), _faculty(), _forecast(), forecast_readiness(), _period_cutoff() (+7 more)

### Community 16 - "account-menu.tsx"
Cohesion: 0.16
Nodes (16): 5.2 Faculty routes, 5.3 Administrator routes, 5.4 Navigation and shell integration, 5. Frontend changes, AccessibilityPage(), AccessibilityPreferenceKey, ACCESSIBILITY_SETTINGS, AccessibilitySettingDefinition (+8 more)

### Community 17 - "exams/[id]/page.test.tsx"
Cohesion: 0.25
Nodes (5): answerSaves(), Call, mocks, savedBodies(), seedUnsyncedSnapshot()

### Community 18 - "sqlalchemy_orm"
Cohesion: 0.09
Nodes (13): CodeSubmissionRequest, run_code_submission(), _shadow_scoring_ready(), attempt_quality(), record_prediction_outcome(), submission_passes(), finish_submission(), lock_submission_claim() (+5 more)

### Community 19 - "test_ml_exam_features.py"
Cohesion: 0.12
Nodes (16): _attempt(), test_bootstrap_intervals_are_reproducible_and_resample_learners(), test_faculty_forecast_uses_the_recorded_winner_and_hides_legacy_probability(), test_hint_exports_reject_identifying_columns(), test_older_feature_schema_artifacts_are_rejected(), test_rows_are_first_submissions_on_challenges_with_strictly_prior_history(), test_training_rejects_ids_that_encode_an_account(), _as_binary_label() (+8 more)

### Community 21 - "profiles.py"
Cohesion: 0.18
Nodes (19): ActivityDay, _admin_analytics(), AdminAnalytics, AnalyticsResponse, AuditEntry, BadgeEntry, _enum_value(), ExamHistoryEntry (+11 more)

### Community 22 - "test_api_security.py"
Cohesion: 0.07
Nodes (17): Settings, reserve(), Rule, window_bounds(), extract_chunks_from_pdf(), test_ai_global_budgets_are_independent(), test_chat_has_dedicated_account_and_global_quota(), test_costly_action_pauses_if_quota_storage_is_unavailable() (+9 more)

### Community 23 - "sqlalchemy"
Cohesion: 0.11
Nodes (15): public_handle(), _starter_username(), _encoded_id(), is_starter_username(), normalize_username(), starter_username(), _make_profile(), test_badge_code_is_required() (+7 more)

### Community 24 - "Profile"
Cohesion: 0.08
Nodes (36): _account_needs_action(), course_health(), list_course_operations(), sandbox_health(), choose_consent(), close_challenge(), instructor_hints(), withdraw_research_consent() (+28 more)

### Community 25 - "6. Prioritized improvement backlog"
Cohesion: 0.08
Nodes (26): 1. Where the project stands, 2. Progress percentages and how they were calculated, 3. What exists today and where evidence stops, 4. Verification evidence and its limits, 5. Six gates before a live classroom pilot, 6. Prioritized improvement backlog, 7. Execution order, AI, LLM, RAG and provider handling (+18 more)

### Community 26 - "entities.py"
Cohesion: 0.12
Nodes (27): add_workshop_activities(), AddWorkshopActivities, UserRole, WorkshopActivity, apply_publish_rules(), lock_activity_for_publication(), challenge_is_verified(), challenge_validation_fingerprint() (+19 more)

### Community 27 - "quests_gamification.py"
Cohesion: 0.09
Nodes (23): get_gamification_leaderboard(), get_student_progress(), LeaderboardEntry, LeaderboardResponse, LeaderboardStanding, list_published_quests(), _load_quiz_questions(), NextStepRecommendation (+15 more)

### Community 28 - "chat_history.py"
Cohesion: 0.18
Nodes (23): _check_revision(), Conversation, ConversationPage, create_conversation(), CreateConversation, delete_conversation(), _find_conversation(), get_conversation() (+15 more)

### Community 29 - "submission-comparison.tsx"
Cohesion: 0.17
Nodes (15): Editor, AttemptSummary(), CodeDiff(), loadEditor(), ComparedAttempt, Comparison, ComparisonResult(), isDesktop() (+7 more)

### Community 30 - "next"
Cohesion: 0.06
Nodes (75): Already in place: extend, do not rebuild, One kit: course-ui, Implementation status (21 November 2026, same day), Medium, Page(), CourseInsights(), Insights(), mocks (+67 more)

### Community 31 - "workshop-home.tsx"
Cohesion: 0.19
Nodes (16): WorkshopInvitePage(), WorkshopsPage(), useShellProfile(), classroomSummary(), readClassroomDetails(), WorkshopClassroomFields(), yearLevels, CreateWorkshop() (+8 more)

### Community 32 - "workshop-ui.tsx"
Cohesion: 0.13
Nodes (18): 4.4 Faculty API (`backend/app/api/faculty.py`, prefix `/api/v1/faculty`), WorkshopDetailLayout(), pages, WorkshopContext, WorkshopLayout(), ManagedStudent, People, StudentAlias (+10 more)

### Community 33 - "onboarding/page.tsx"
Cohesion: 0.11
Nodes (35): AuthMode, OnboardingContent(), authenticate(), changeAuthMode(), checkExistingAuth(), continueToAgreement(), finishPasswordSetup(), OnboardingPage() (+27 more)

### Community 34 - "chat.py"
Cohesion: 0.07
Nodes (27): _chat_activity(), ChatLimits, ChatMessageRequest, ChatMessageResponse, ChatSource, ChatStatus, ChatTurn, _course_passages() (+19 more)

### Community 35 - "security.py"
Cohesion: 0.08
Nodes (19): auth(), verify(), claims(), test_es256_verifies_locally_off_the_event_loop(), test_failed_jwks_verification_falls_back(), test_non_asymmetric_algorithms_never_use_jwks(), test_embedding_request_matches_selected_model(), A. Provider database backup (+11 more)

### Community 36 - "WorkspaceProvider"
Cohesion: 0.21
Nodes (6): AdminLayout(), FacultyLayout(), WorkshopsLayout(), AdminSectionNav(), SECTIONS, WorkspaceProvider()

### Community 37 - "leaderboard.tsx"
Cohesion: 0.20
Nodes (12): CHOOSE_HANDLE_HREF, Leaderboard(), LeaderboardData, LeaderboardEntry, LeaderboardStanding, LearnerName(), MEDAL, Row() (+4 more)

### Community 38 - "api.ts"
Cohesion: 0.04
Nodes (66): 4.5 Administrator API (`backend/app/api/admin.py`, prefix `/api/v1/admin`), CHOICE_LABEL, ResearchConsentSettingsPage(), choose(), activityHref(), closesIn(), Dashboard, DashboardContent() (+58 more)

### Community 39 - "insights.py"
Cohesion: 0.12
Nodes (20): CategoryCount, course_insights(), _event_days(), GamificationInsights, HelpSeeking, _manila_day(), MemoryRetention, _rate() (+12 more)

### Community 40 - "train_compare.py"
Cohesion: 0.09
Nodes (12): test_adequacy_flags_a_small_test_partition(), _adequacy(), _atomic_joblib_dump(), _atomic_json_write(), _atomic_write(), _fit_baselines(), _format_metric(), generate_synthetic_thesis_dataset() (+4 more)

### Community 41 - "ml_predictor/feature_engineering.py"
Cohesion: 0.22
Nodes (7): _as_bool(), _before(), _enum_value(), extract_features_from_dataframe(), _frame(), _mean(), _rate()

### Community 42 - "4. Findings and implementation blueprint"
Cohesion: 0.08
Nodes (24): 1. Where ByteQuest stands, 2. How the system fits together, 3. Work order, 4. Findings and implementation blueprint, 5. Local completion checklist, 6. Which existing document answers which question, BQ-01 — Award completion XP at the first eligible event, BQ-02 — Give submission jobs one owner per claim (+16 more)

### Community 43 - "qa_mixed_exam_load.py"
Cohesion: 0.13
Nodes (15): require_local(), main(), summary(), verify(), main(), measure_exam_samples(), prepare_exam(), report_exam_grading() (+7 more)

### Community 44 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 45 - "Classroom pilot fixes and verification — 2026-10-28"
Cohesion: 0.33
Nodes (5): Changes checked locally, Classroom pilot fixes and verification — 2026-10-28, Evidence, Other Remaining Pilot Verification Gates, Verification Status & Remaining Gates

### Community 46 - "react"
Cohesion: 0.11
Nodes (18): nextConfig, ExamCard, ExamsPage(), localTime(), QuestStatusFilter, ActivityDateFilter(), CourseNavigationLinks(), CourseSwitcher() (+10 more)

### Community 47 - "Faculty and administrator workspace — implementation log and continued work"
Cohesion: 0.11
Nodes (17): 10. Files created or modified (this work), 11. Quick current-state checklist, 1. Status at handoff, 6. Tests added, 7. Verification evidence (live app), 8. How to continue (commands, accounts, cleanup), 9. Remaining work, Additional navigation fix (+9 more)

### Community 48 - "package.json"
Cohesion: 0.04
Nodes (47): dependencies, monaco-editor, @monaco-editor/react, next, react, react-dom, react-is, recharts (+39 more)

### Community 49 - "Phase 1 — ByteQuest instructor redesign plan"
Cohesion: 0.17
Nodes (12): Assumptions, Courses and Workshops, Dashboard and Analytics division, Files changed, How to test this plan, Main user flows, Next step, Other instructor API contracts (+4 more)

### Community 50 - "performance.py"
Cohesion: 0.15
Nodes (24): admin_user(), list_activity_workspace(), activity_analysis(), _first_try_questions(), gamification_insights(), gradebook(), performance(), student_performance() (+16 more)

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

### Community 55 - "chat-provider.tsx"
Cohesion: 0.11
Nodes (27): chatHistory, ChatMode, ConversationPage, ConversationSummary, SavedReply, SavedTurn, Transcript, TurnStatus (+19 more)

### Community 56 - "vps_bootstrap.sh"
Cohesion: 0.24
Nodes (15): active_ssh_port(), configure_cgroup_v1(), configure_docker(), configure_firewall(), configure_swap(), DEBIAN_FRONTEND, die(), DOCKER_KEYRING (+7 more)

### Community 57 - "chat-conversation.tsx"
Cohesion: 0.18
Nodes (12): availabilityCopy, ChatConversation(), onInputKey(), submit(), languageNames, suggestedPrompts(), ChatMessageContent(), CodeBlock() (+4 more)

### Community 58 - "LegalDocument"
Cohesion: 0.24
Nodes (9): metadata, Page(), metadata, Page(), LegalDocument(), LegalKind, LegalModal(), PolicyPanel() (+1 more)

### Community 59 - "llm.py"
Cohesion: 0.06
Nodes (17): get_settings(), get_db(), embed_chunks_bounded(), embed_one(), GeminiEmbeddingService, generate_embedding(), ErrorExplanationSchema, _client_for_key() (+9 more)

### Community 60 - "ByteQuest Insights, part 3 of 4: instructors"
Cohesion: 0.18
Nodes (10): Activity health in the Activities list, ByteQuest Insights, part 3 of 4: instructors, Exam class summary, Goal, Handheld rules, Inactive 7+ days, Model evaluation, Out of scope (+2 more)

### Community 61 - "exams.py"
Cohesion: 0.10
Nodes (40): assigned(), assigned_exam_numbers(), _assigned_exams_with_state(), create_exam(), DraftExam, DraftItem, _exam_access(), exam_sample_run() (+32 more)

### Community 62 - "lib/types.ts"
Cohesion: 0.07
Nodes (28): 1. Current architecture, Existing API contracts, QuestsPage(), loops, mocks, quest, StudentPreview(), tracks (+20 more)

### Community 63 - "useChatController"
Cohesion: 0.38
Nodes (12): turnMessages(), mapChatError(), useChatController(), applySavedReply(), canSend(), checkReply(), handleFailure(), recoverTurn() (+4 more)

### Community 64 - "ByteQuest machine-learning improvement plan"
Cohesion: 0.11
Nodes (18): 1. Goal, 2. Where things stand, 3. Decisions, 4.1 Prediction unit and label, 4.2 History, 4.3 The ten features, in this order, 4.4 Live shadow scoring, 4.5 Reporting (+10 more)

### Community 65 - "rag_instructor.py"
Cohesion: 0.08
Nodes (29): _gemini_unavailable_http_exception(), generate_ai_coding_challenge(), generate_ai_conceptual_quiz(), GeneratedChallengeSchema, GeneratedQuizOptionSchema, GeneratedQuizQuestionSchema, GeneratedQuizSchema, _generation_payload() (+21 more)

### Community 66 - "os"
Cohesion: 0.13
Nodes (6): destroy(), main(), pytest_sessionstart(), _export_queries(), test_documented_exports_require_latest_current_consent(), session_factory()

### Community 67 - "ByteQuest 2.0 Classroom Pilot Operator Runbook"
Cohesion: 0.17
Nodes (12): 1. Hard Safety Gates (Enforced by Configuration), 2. Lab Station & Shared-Computer Protocol, 3. Network Resilience & Live Draft Sync, 4. Timed Exam Operations, 5. Verification Commands, 6. Incident Troubleshooting, ByteQuest 2.0 Classroom Pilot Operator Runbook, Classroom Wi-Fi Reconnect Banner (+4 more)

### Community 68 - "_TooLarge"
Cohesion: 0.11
Nodes (11): RequestSizeLimitMiddleware, limited_receive(), tracked_send(), _TooLarge, api_health_check(), health_check(), readiness_check(), test_streamed_body_without_content_length_is_limited() (+3 more)

### Community 69 - "workshop-activities.tsx"
Cohesion: 0.15
Nodes (14): ActivityDialog, ActivityEditor(), save(), ActivityLink, ActivityOption, ActivityPicker(), mocks, quests (+6 more)

### Community 70 - "ByteQuest local end-to-end flow"
Cohesion: 0.12
Nodes (16): 8 Required Acceptance Checks, Account-synced progression check, Before deployment, ByteQuest local end-to-end flow, Exam Autosave & Conflict-Safe Recovery Verification, Instructor account, Local Quest Map demos, Manual startup (+8 more)

### Community 71 - "accessibility-provider.tsx"
Cohesion: 0.18
Nodes (16): Repo map: exact files to inspect and change, ACCESSIBILITY_STORAGE_KEYS, AccessibilityContext, AccessibilityContextValue, AccessibilityPreferences, AccessibilityProvider(), applyPreferences(), commitPreferences() (+8 more)

### Community 72 - "ByteQuest 2.0"
Cohesion: 0.22
Nodes (9): Architecture, ByteQuest 2.0, Configuration and security, Documentation, Repository layout, Stack and deployment, Start locally on Windows, Test and verify (+1 more)

### Community 73 - "ProgrammingLang"
Cohesion: 0.06
Nodes (23): ProgrammingLang, _grade_item(), _b64_decode(), _b64_encode(), BatchEvaluationSummary, CircuitBreaker, classify_judge0_status(), Judge0CircuitOpenError (+15 more)

### Community 74 - "ByteQuest 2.0 — Full system review"
Cohesion: 0.12
Nodes (14): Already strong (checked, not assumed), ByteQuest 2.0 — Full system review, Evidence, Must fix, Nice to have, Not checked, Ratings, Should fix (+6 more)

### Community 75 - "Phase 0 — ByteQuest instructor audit"
Cohesion: 0.25
Nodes (8): Current FastAPI inventory, Current screens and feature coverage, Decisions for Phase 1, Desktop scorecard, Findings, Phase 0 — ByteQuest instructor audit, Supabase data and authorization, Verification

### Community 76 - "StorageError"
Cohesion: 0.25
Nodes (5): StorageError, SupabasePDFStorage, test_accepts_absolute_signed_url_from_configured_origin(), test_rejects_untrusted_signed_url(), test_resolves_supabase_relative_signed_path()

### Community 77 - "entities.py"
Cohesion: 0.24
Nodes (7): ActivityDraft, DocumentChunk, ExamAssignment, ExamSampleRun, NotificationOutbox, TestCase, 2. What already exists (verified 11/21/26)

### Community 78 - "status"
Cohesion: 0.25
Nodes (7): _id(), C. Migration plan, E. Organisation and documentation, Course data model and grade integrity, Migration and rollback, RLS and authorization, status()

### Community 79 - "Session"
Cohesion: 0.08
Nodes (59): account_emails_for_email(), account_impact(), AccountCreate, activity_impact(), _admin_activity(), admin_archive_activity(), admin_archive_material(), admin_download_material() (+51 more)

### Community 80 - "SYSTEM_STATUS_AND_RELEASE_PLAN.md"
Cohesion: 0.18
Nodes (4): ByteQuest repository guidance, Current system status, graphify, This is NOT the Next.js you know

### Community 81 - "qa_live_multi_role.py"
Cohesion: 0.16
Nodes (17): api_base(), cleanup(), create_accounts(), instructor_builds_course(), letters(), password_token(), print_report(), require_local() (+9 more)

### Community 82 - "progress_recap.py"
Cohesion: 0.12
Nodes (14): get_gamification_state(), get_progress_recap(), _day(), _manila(), _practice_days(), progress_recap(), ProgressRecap, RecapMetric (+6 more)

### Community 83 - "ByteQuest 2.0: Master Architecture Plan & Execution Roadmap"
Cohesion: 0.09
Nodes (23): 1. Project Tracking & Thesis Collaboration Strategy, 2. Core Architectural Rules (Non-Negotiable), 3. Repository Directory Structure, 4. Course-Sequence & Curriculum Alignment, 5. Database Schema Blueprint (Supabase PostgreSQL + pgvector), 6. 7-Phase Development Plan, 7. Thesis Objectives Mapping (Chapter 1 Alignment), 8. Development Environment & Quickstart Commands (+15 more)

### Community 84 - "Phase 7 deployment readiness"
Cohesion: 0.18
Nodes (11): Decisions required before production setup, Deployment order after the decisions are made, Evidence still needed, Local Judge0 runtime smoke check (2026-10-26), Notes on local verification, Phase 7 deployment readiness, Prepared in the repository, Production settings and network boundaries (+3 more)

### Community 85 - "submissions/[id]/page.tsx"
Cohesion: 0.09
Nodes (22): QuestsPageContent(), changeView(), handleKeyDown(), Job, nextStarTip(), SubmissionStatusPage(), refresh(), retryGrading() (+14 more)

### Community 86 - "arena.tsx"
Cohesion: 0.11
Nodes (28): ArenaPage(), Arena(), confirmResetCode(), endSegment(), handleCodeChange(), handleCopyOutput(), load(), onVisibilityChange() (+20 more)

### Community 87 - "codex.py"
Cohesion: 0.23
Nodes (11): get_codex(), ChallengeRecovery, codex_summary(), CodexCategory, CodexRecovery, CodexResponse, CodexSummary, practice_errors() (+3 more)

### Community 88 - "load_test_local_synthetic.py"
Cohesion: 0.33
Nodes (6): cleanup(), main(), make_students(), one_student(), require_local(), run_load()

### Community 89 - "activities.py"
Cohesion: 0.12
Nodes (29): ActivityCreate, ActivityUpdate, create_activity(), create_activity_version(), get_activity(), _grading_fields(), preview_activity(), publish_activity() (+21 more)

### Community 90 - "workspace.ts"
Cohesion: 0.03
Nodes (110): Page(), Page(), Page(), loadQueue(), retry(), DraftForm, DraftWorkspace(), confirmApprove() (+102 more)

### Community 91 - "Instructor activity analysis and class announcements"
Cohesion: 0.33
Nodes (6): Activity analysis, Browser verification, Class announcements, Instructor activity analysis and class announcements, Remaining verification, Verification

### Community 92 - "Desktop and Mobile Pilot Flows (`pilot-v2.html`)"
Cohesion: 0.22
Nodes (8): 1. Offline / Network Reconnect Banner, 2. Pending / Queued Grading State, 3. Research Consent & Withdrawal State (Disabled Collection Notice), 4. Active Exam Priority Banner & Timed Attempt Lock, ByteQuest web app wireframes, Coverage, Desktop and Mobile Pilot Flows (`pilot-v2.html`), Review checklist

### Community 93 - "workspace-provider.test.tsx"
Cohesion: 0.11
Nodes (21): Already in place: extend, do not rebuild, Goal, Layout system, Make ByteQuest fit every phone and tablet, Menu docking: finish what exists, Out of scope, Screens, Side navigation on handheld screens: already built (+13 more)

### Community 94 - "ByteQuest Insights, part 4 of 4: administrators"
Cohesion: 0.33
Nodes (5): ByteQuest Insights, part 4 of 4: administrators, Goal, Handheld rules, Out of scope, Verification and rollout

### Community 95 - "app-shell.tsx"
Cohesion: 0.13
Nodes (26): WorkspaceLayout(), AppShell(), AuthenticatedLayout(), isActiveDestination(), ProfileContext, useScrollResetOnRouteChange(), InstructorIconName, LegacyQuestRedirect() (+18 more)

### Community 96 - "LearningActivity"
Cohesion: 0.16
Nodes (34): LearningActivity, ReviewState, test_shadow_saves_first_submission_forecasts_and_blank_features_as_null(), new_session(), _quiz(), _recall_concept(), _review_and_publish(), test_class_snapshot_counts_mastery_and_a_true_average() (+26 more)

### Community 97 - "ML pipeline synthetic verification — 2026-10-25"
Cohesion: 0.29
Nodes (6): Artifact and activation checks, Execution, ML pipeline synthetic verification — 2026-10-25, Observed grouped metrics, Remaining Phase 5 work, Scope

### Community 98 - "_enroll_chat_students"
Cohesion: 0.09
Nodes (28): GeminiAPIError, test_chat_requires_active_enrollment_only_for_students(), _chat_payload(), _course_pdf(), _enroll_chat_students(), test_ai_failures_leave_drafts_and_hint_allowance_intact(), get_client(), test_chat_and_hints_are_grounded_in_own_course_pdfs() (+20 more)

### Community 99 - "preflight-host.sh"
Cohesion: 0.38
Nodes (6): fail(), MIN_MEMORY_BYTES, MIN_ROOT_FREE_BYTES, MIN_SWAP_BYTES, pass(), preflight-host.sh script

### Community 100 - "Phase 6 shadow rollout implementation record"
Cohesion: 0.33
Nodes (5): Implemented, Phase 6 shadow rollout implementation record, Phase 7 handoff, Safety and current state, Verification still required

### Community 101 - "httpx"
Cohesion: 0.16
Nodes (9): deliver_one(), _evaluate(), _failed_sample(), main(), _request(), TutorCase, main(), evaluate() (+1 more)

### Community 102 - "ML feature engineering and training"
Cohesion: 0.40
Nodes (5): Comparison protocol, Export an attempt dataset, ML feature engineering and training, Prepare an Ubuntu VPS, Safe pipeline setup

### Community 103 - "monitoring.py"
Cohesion: 0.17
Nodes (18): _check_judge0(), _grading_worker_health(), _minutes(), overall_health(), _prediction_health(), _rag_health(), _runner_health(), runner_status() (+10 more)

### Community 104 - "ByteQuest Gemini tutor pilot evaluation"
Cohesion: 0.50
Nodes (4): ByteQuest Gemini tutor pilot evaluation, Reply quality, Token use and estimated Gemini cost, What was tested

### Community 105 - "runCode"
Cohesion: 0.50
Nodes (5): checkStatus(), runCode(), workedSeconds(), removeStoredRun(), sampleRunStatus()

### Community 106 - "ByteQuest navigation"
Cohesion: 0.40
Nodes (5): ByteQuest navigation, Compatibility and new destinations, Existing routes, Local verification, Workshops (11/21/26)

### Community 107 - "Workshops: Create, Join and the Workshop page"
Cohesion: 0.20
Nodes (10): 10. Decisions to critique, 1. What exists today, 2. Screen map, 3. Rules, 5. API changes (all under `/api/v1/workshops`), 6. Frontend structure, 7. Delivery slices (each ships with tests), 8. Out of scope for v1 (+2 more)

### Community 108 - "test_pilot_regressions.py"
Cohesion: 0.14
Nodes (29): Badge, ChallengeHint, HintUse, PlatformSetting, StudentBadge, _challenge(), _graded_job(), _published_activity() (+21 more)

### Community 110 - "Python demo journey — 2026-10-28"
Cohesion: 0.40
Nodes (4): Browser walkthrough, Implemented, Local evidence, Python demo journey — 2026-10-28

### Community 111 - "PHASE7_DEPLOYMENT_READINESS.md"
Cohesion: 0.06
Nodes (29): Current routes and behavior, Phase 2 API and rollout list, Reference tokens and icons, Screenshot comparisons, Step C — Instructor visual verification, Test target checks, Grant access to one account, Production instructor access (+21 more)

### Community 112 - "ByteQuest 2.0 system status and weekly change log"
Cohesion: 0.29
Nodes (7): ByteQuest 2.0 system status and weekly change log, Current feature and deployment map, How close is ByteQuest to finished?, Latest local verification, UI and UX review, What changed this week, Work left before the next milestone

### Community 113 - "retrieval.py"
Cohesion: 0.13
Nodes (13): activity_document_ids(), _chat_excerpt(), cited_sources(), course_document_ids(), is_query_vector(), leading_chunks(), nearest_chunks(), search_settings() (+5 more)

### Community 114 - "Local API security verification — 2026-10-28"
Cohesion: 0.50
Nodes (3): 30-student local load, Checks, Local API security verification — 2026-10-28

### Community 115 - "Phase 7 database pool budget hardening"
Cohesion: 0.50
Nodes (3): Change, Checks performed, Phase 7 database pool budget hardening

### Community 116 - "test_profile_analytics.py"
Cohesion: 0.26
Nodes (8): _add_audit(), _analytics(), test_each_role_receives_only_its_own_branch(), test_existing_admin_fields_remain_compatible(), test_existing_instructor_fields_remain_compatible(), test_faculty_without_courses_gets_a_calm_fallback(), test_personal_timeline_only_includes_own_actions(), test_student_branch_has_no_staff_fields()

### Community 117 - "badges.py"
Cohesion: 0.11
Nodes (16): award_badges(), evaluate_and_award_badges(), _qualifies(), _requirement_for(), grant_xp(), 10. Definition of done (for each part), 12. Final report format, 1. Your role and mission (+8 more)

### Community 118 - "ByteQuest 2.0 before and after"
Cohesion: 0.12
Nodes (16): AI and the browser experience, ByteQuest 2.0 before and after, Current local evidence, Curriculum, grading interruptions, tutoring, and exam accessibility, Exam-grading slot comparison · 19 November 2026, Grading, exams, and course records, How to decide whether the work paid off, Implementation and local verification (+8 more)

### Community 119 - "smoke-vps.sh"
Cohesion: 0.83
Nodes (3): check_health(), smoke-vps.sh script, usage()

### Community 120 - "ByteQuest pilot remediation checklist"
Cohesion: 0.29
Nodes (7): 1. Fix release blockers, 2. Correct grading, dashboard, and accessibility behavior, 3. Restore live grading and fill the content gaps, 4. Verify feature availability and role workflows, 5. Decide whether the pilot can start, ByteQuest pilot remediation checklist, Resume the Judge0 checks

### Community 123 - "flow"
Cohesion: 0.25
Nodes (3): flow(), cleanup(), override_db()

### Community 124 - "newRequestId"
Cohesion: 0.13
Nodes (14): RFC-4122, ByteQuest 2.0: close the manuscript gaps, tidy the structure, then review and rate the system, Do not, Final report, Hard rules, Part 3: Code structure (targeted; behaviour must stay identical), Part 4: Review and targeted fixes, Stack and layout (+6 more)

### Community 126 - "ByteQuest 2.0 system critique — 21 November 2026"
Cohesion: 0.10
Nodes (19): ByteQuest 2.0 system critique — 21 November 2026, Findings by severity, Low, Not verified in this review, Scorecard, Top 5 things to do next, Verdict, What is working well (keep) (+11 more)

### Community 127 - "Judge0 Hyper-V Ubuntu boot incident and recovery"
Cohesion: 0.05
Nodes (39): 1. Start and open the known-good VM, 2. Confirm the Judge0 services and volume inside Ubuntu, 3. Get the current guest IP and check the port, 4. Update ByteQuest if the VM IP changed, 5. Restart FastAPI and leave it running, 6. Verify service integration without exposing secrets, Current verified state, Disk and data safety (+31 more)

### Community 128 - "ByteQuest manuscript and system alignment checklist"
Cohesion: 0.20
Nodes (10): 1. Scope decisions, 2. Chapter 1 — Introduction and scope, 3. Chapter 2 — Literature and synthesis, 4. Chapter 3 — Roles, practice, and AI, 5. Chapter 3 — Assessment and architecture, 6. Chapter 3 — Consent, research data, and ML, 7. Study records and final sign-off, ByteQuest manuscript and system alignment checklist (+2 more)

### Community 132 - "upload_my_avatar"
Cohesion: 0.18
Nodes (6): _detect_avatar_content_type(), school_id_availability(), SchoolIdCheck, upload_my_avatar(), test_detect_avatar_content_type_recognizes_supported_signatures(), test_detect_avatar_content_type_rejects_metadata_only_and_truncated_files()

### Community 133 - "ByteQuest 2.0 live deployment stack"
Cohesion: 0.40
Nodes (5): Before the 30-student session, ByteQuest 2.0 live deployment stack, PHP budget, What ByteQuest runs, What to pay for

### Community 134 - "home-redirect.tsx"
Cohesion: 0.27
Nodes (8): HomePage(), FEATURED_SLIDES, FeaturedQuestWindow(), FeaturedSlide, HomeRedirect(), consumeInviteCallback(), SafeNavigationOptions, useSafeWindowNavigation()

### Community 135 - "ML features and prediction unit: manuscript vs. code"
Cohesion: 0.40
Nodes (5): 1. The two feature sets, 2. The prediction unit and label, 3. Decisions for the adviser, 4. Files that would change, ML features and prediction unit: manuscript vs. code

### Community 136 - "ByteQuest KVM 2 live pilot"
Cohesion: 0.40
Nodes (5): Before provisioning, ByteQuest KVM 2 live pilot, Configure and start the stack, Decide whether to start the classroom pilot, Local verification on 20 November 2026

### Community 137 - "get_current_user"
Cohesion: 0.09
Nodes (16): get_current_user(), get_current_user_payload(), require_instructor(), TokenPayload, ByteQuest — Security & AI-Abuse Hardening (implementation brief), Final report (keep it short), Order and verification, Out of scope: do not do these (+8 more)

### Community 138 - "ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash"
Cohesion: 0.22
Nodes (8): Behavior and scope of the assistant, ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash, Placement and responsive layout, Product decision, Quality gates and acceptance tests, Ready-to-paste DeepSeek V4.1 Flash implementation prompt, State and error rules, Window states and exact controls

### Community 139 - "ByteQuest 2.0: implementation guide and DeepSeek V4.1 Flash prompt"
Cohesion: 0.40
Nodes (4): 3. Recommended implementation order, 4. Ready-to-paste prompt for DeepSeek V4.1 Flash, 5. Manual acceptance checklist, ByteQuest 2.0: implementation guide and DeepSeek V4.1 Flash prompt

### Community 140 - "FastAPI"
Cohesion: 0.13
Nodes (12): AnnouncementCreate, AnnouncementExpiry, AnnouncementPatch, _audit_change(), _authorize_announcement(), create_announcement(), delete_announcement(), list_announcements() (+4 more)

### Community 141 - "settings_service.py"
Cohesion: 0.27
Nodes (5): _coerce(), _range_error(), serialize_setting(), _typed_value(), update_setting()

### Community 142 - "Local API security contract"
Cohesion: 0.40
Nodes (5): Access matrix, Local API security contract, Local verification and future deployment, Quotas and validation, School-issued IDs for student sign-up

### Community 143 - "ActivityKind"
Cohesion: 0.24
Nodes (12): compare_submission(), ComparedAttempt, get_job(), _retry_failed_job(), retry_job(), SubmissionComparison, submit_job(), SubmitJob (+4 more)

### Community 146 - "predictor.py"
Cohesion: 0.11
Nodes (16): lifespan(), load_ml_models(), ModelArtifactError, ModelArtifactsUnavailable, ModelBundle, _partition_report(), _positive_probability(), predict_student_success() (+8 more)

### Community 148 - "ByteQuest UI/UX harmonization: slices 1–3 and ML slice planning"
Cohesion: 0.15
Nodes (12): Bugs found and fixed, ByteQuest UI/UX harmonization: slices 1–3 and ML slice planning, Checkpoint, Decisions made today, How it was checked, Next steps, Not checked, Slice 1: shared foundation and help (+4 more)

### Community 149 - "ProfileResponse"
Cohesion: 0.18
Nodes (5): delete_my_avatar(), get_my_profile(), ProfileResponse, ProfileUpdateRequest, update_my_profile()

### Community 150 - "numpy"
Cohesion: 0.19
Nodes (9): _bootstrap_intervals(), _build_pipeline(), _evaluate_partition(), _finite_or_none(), _fit_tuned_model(), _point_metrics(), _probability_for_success(), split_students_disjoint() (+1 more)

### Community 151 - "performance/page.tsx"
Cohesion: 0.07
Nodes (53): Student Progress: the only roster and learner drawer, CourseRef, Curve, Dashboard, Detail, Evaluation, Forecast, FORECAST_REASONS (+45 more)

### Community 152 - "chat-provider.test.tsx"
Cohesion: 0.12
Nodes (13): byteBounce, metadata, RootLayout(), viewport, ChatProvider(), auth, bodies(), openChat() (+5 more)

### Community 154 - "claim"
Cohesion: 0.14
Nodes (15): ExamGradingClaim, _grade_claimed_exam(), grade_exam(), _lock_exam_claim(), claim(), main(), process(), recover_stale_submission_jobs() (+7 more)

### Community 156 - "Prioritized defects"
Cohesion: 0.11
Nodes (18): 10. [P3] Hidden-case aggregate summary incorrectly reports zero, 1. [P1] A workshop can expose another instructor's course activity, 2. [P1] Verification can certify content that Judge0 never checked, 3. [P1] Unreleased exam successes can affect visible rewards, 4. [P1] The current release build exits with a dependency security warning, 5. [P2] Challenges with no visible sample can be published, 6. [P2] The dashboard recommends a closed quest that cannot be submitted, 7. [P2] Completing one exam can hide another due exam on the dashboard (+10 more)

### Community 157 - "pilot.py"
Cohesion: 0.15
Nodes (18): require_practice_help_available(), challenge(), ConsentChoice, DraftPayload, _expired_hint_reservation(), get_draft(), hint_status(), _hint_uses() (+10 more)

### Community 158 - "review-report.md"
Cohesion: 0.18
Nodes (9): ByteQuest 2.0 engineering and UX review, Findings, Performance evidence, Recommended sequence, Verification and limits, ByteQuest backend runtime review, Mixed local workload, Pending measurements and review (+1 more)

### Community 159 - "5. Slices"
Cohesion: 0.12
Nodes (15): 1. Read these first, in this order, 3. Hard rules, 4. Decided behaviour (W1–W12, all accepted by the user), 5. Slices, 6. How to verify each slice, 7. Report after each slice, ChatGPT 6.2 prompt: finish the ByteQuest Workshop classroom (slices 1–8), Slice 1: data and API (start here) (+7 more)

### Community 160 - "Wireframes"
Cohesion: 0.22
Nodes (9): Activity editor, Analytics desktop, Analytics phone, Dashboard desktop, Dashboard phone, Learner drill-down, Other screen layouts, Submission review (+1 more)

### Community 161 - "progress-recap.tsx"
Cohesion: 0.18
Nodes (14): changeText(), dayFormat, formatDay(), ProgressRecap(), ProgressRecapData, range(), readStoredDays(), RECAP_PERIODS (+6 more)

### Community 162 - "workshop-progress.tsx"
Cohesion: 0.25
Nodes (8): labels, LearnerProgress, Progress, ProgressStatus(), Status, StudentName(), mocks, WorkshopProgress()

### Community 163 - "student"
Cohesion: 0.33
Nodes (6): student(), check_paused(), submit(), ask(), join_new_workshop(), queries_to_list_workshops()

### Community 164 - "B. Findings"
Cohesion: 0.50
Nodes (4): B. Findings, Must fix, Nice to have, Should fix

### Community 165 - "complete_student_onboarding"
Cohesion: 0.29
Nodes (5): complete_staff_setup(), complete_student_onboarding(), OnboardingRequest, _require_student(), StaffSetupRequest

### Community 166 - "ByteQuest Insights, part 1 of 4: shared foundation"
Cohesion: 0.20
Nodes (9): ByteQuest Insights, part 1 of 4: shared foundation, Charts: two primitives, Goal, Handheld rules, Metric labels, Out of scope, Profile: one role tab, each figure once, Remove the duplicate Sequencer evaluation (+1 more)

### Community 167 - "profile/page.tsx"
Cohesion: 0.07
Nodes (46): AccountPanel(), AdminSections(), ConsentStatus, habitsMessage(), InstructorSections(), PersonalTimeline(), ProfilePage(), ProfilePageContent() (+38 more)

### Community 169 - "ByteQuest Insights, part 2 of 4: students"
Cohesion: 0.22
Nodes (8): ByteQuest Insights, part 2 of 4: students, Goal, Handheld rules, One badge list, Out of scope, Score trend and breakdowns, Topic practice links, Verification and rollout

### Community 172 - "ByteQuest system status — 21 November 2026"
Cohesion: 0.40
Nodes (5): ByteQuest system status — 21 November 2026, Checkout, runtime and release, Machine learning — status on 11/21/26, Verification and remaining checks, What changed

### Community 173 - "Phase 7 dependency security review (2026-10-26)"
Cohesion: 0.33
Nodes (5): Findings and changes, Phase 7 dependency security review (2026-10-26), Remaining checks and limits, Scope, Verification performed

### Community 174 - "reviews.py"
Cohesion: 0.10
Nodes (38): _ensure_student(), get_mastery_map(), get_review(), get_reviews(), _locked_student(), _public_review(), _question_id(), _require_memory() (+30 more)

### Community 176 - "Phase 7 synthetic deployment preflight — 2026-10-26"
Cohesion: 0.33
Nodes (5): Evidence, Limits, Phase 7 synthetic deployment preflight — 2026-10-26, Result, Scope and method

### Community 178 - "Analytics"
Cohesion: 0.40
Nodes (5): Analytics, API and data performance, Chart library and motion, Filters and shared facts, Metric dictionary

### Community 189 - "ByteQuest 2.0 database review — 12 November 2026"
Cohesion: 0.22
Nodes (7): test_every_public_timestamp_column_is_aware(), A. Inventory, ByteQuest 2.0 database review — 12 November 2026, D. Index recommendations, End-to-end traces, F. Verification, G. Explicitly out of scope

## Knowledge Gaps
- **18 isolated node(s):** `monaco-editor`, `react-is`, `@types/node`, `@types/react`, `@types/react-dom` (+13 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1399 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `4. Read these before writing any code` connect `test_pilot_regressions.py` to `LearningActivity`, `ui.tsx`, `Session`, `profile/page.tsx`, `ProgrammingLang`, `flow`, `test_learning_flow_integration.py`, `reviews.py`, `ActivityAttempt`, `profiles.py`, `badges.py`, `quests_gamification.py`?**
  _High betweenness centrality (0.176) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `Session` (e.g. with `smoke_demo_quest()` and `test_two_concurrent_saves_cannot_commit_the_same_activity_version()`) actually correct?**
  _`Session` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `monaco-editor`, `react-is`, `@types/node` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ui.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09352142110762801 - nodes in this community are weakly interconnected._
- **Why does `LearningActivity` connect `LearningActivity` to `Session`, `workshops.py`, `test_faculty_admin.py`, `drafts.py`, `test_learning_flow_integration.py`, `ActivityAttempt`, `faculty_ml.py`, `ActivityKind`, `sqlalchemy_orm`, `predictor.py`, `profiles.py`, `Profile`, `entities.py`, `quests_gamification.py`, `claim`, `pilot.py`, `chat.py`, `insights.py`, `reviews.py`, `performance.py`, `exams.py`, `lib/types.ts`, `rag_instructor.py`, `entities.py`, `Session`, `qa_live_multi_role.py`, `codex.py`, `load_test_local_synthetic.py`, `activities.py`, `_enroll_chat_students`, `httpx`, `monitoring.py`, `test_pilot_regressions.py`, `retrieval.py`?**
  _High betweenness centrality (0.133) - this node is a cross-community bridge._
- **Are the 280 inferred relationships involving `Profile` (e.g. with `account_impact()` and `_account_needs_action()`) actually correct?**
  _`Profile` has 280 INFERRED edges - model-reasoned connections that need verification._
- **Should `Session` be split into smaller, more focused modules?**
  _Cohesion score 0.08531073446327683 - nodes in this community are weakly interconnected._