# Graph Report - ByteQuest-pilot-integration  (2026-11-22)

## Corpus Check
- 482 files · ~526,860 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 39 file(s) not represented in the graph (top: (none) 20, .bat 5, .example 5)

## Summary
- 4412 nodes · 14839 edges · 187 communities (161 shown, 26 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 1949 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1d994402`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ui.tsx
- ByteQuest 2.0: instructor activity analysis and class announcements
- faculty/materials.py
- WorkshopMutation
- WorkshopView
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
- dashboard/page.tsx
- ML evidence, operations and ML methodology: readiness plan
- exams/[id]/page.test.tsx
- submissions.py
- test_ml_exam_features.py
- predictor.py
- profiles.py
- request_size.py
- sqlalchemy
- pilot.py
- 6. Prioritized improvement backlog
- LearningActivity
- submit_conceptual_quiz
- chat_history.py
- submission-comparison.tsx
- progress_recap.py
- workshop-home.tsx
- Prioritized defects
- onboarding/page.tsx
- workshop-activities.tsx
- asyncio
- chat.py
- leaderboard.tsx
- lib/types.ts
- insights.py
- numpy
- ml_predictor/feature_engineering.py
- 4. Findings and implementation blueprint
- qa_live_multi_role.py
- compilerOptions
- Classroom pilot fixes and verification — 2026-10-28
- A. Add more code challenges
- Faculty and administrator workspace — implementation log and continued work
- package.json
- Phase 1 — ByteQuest instructor redesign plan
- get_db
- AppTooltips
- qa-responsive.mjs
- reveals_solution
- ByteQuest UI and UX harmonization plan
- chat-conversation.tsx
- vps_bootstrap.sh
- navigation.ts
- LegalDocument
- llm.py
- workshops.py
- exams.py
- profile/page.tsx
- useChatController
- ByteQuest machine-learning improvement plan
- retrieval.py
- train_compare.py
- ByteQuest 2.0 Classroom Pilot Operator Runbook
- solve_quality.py
- submissions/[id]/page.tsx
- ByteQuest local end-to-end flow
- accessibility-provider.tsx
- ByteQuest 2.0
- client.py
- ByteQuest 2.0 — Full system review
- Phase 0 — ByteQuest instructor audit
- StorageError
- SupabaseAvatarStorage
- ByteQuest 2.0 database review — 12 November 2026
- Profile
- SYSTEM_STATUS_AND_RELEASE_PLAN.md
- quiz-view.tsx
- ActivityAttempt
- ByteQuest 2.0: Master Architecture Plan & Execution Roadmap
- Phase 7 deployment readiness
- quests/page.tsx
- ProfileResponse
- typing
- Settings
- arena.tsx
- workspace.ts
- Instructor activity analysis and class announcements
- Desktop and Mobile Pilot Flows (`pilot-v2.html`)
- dockable-navigation.tsx
- upload_my_avatar
- next
- account-menu.tsx
- ML pipeline synthetic verification — 2026-10-25
- codex.py
- preflight-host.sh
- Phase 6 shadow rollout implementation record
- httpx
- ML feature engineering and training
- monitoring.py
- ByteQuest Gemini tutor pilot evaluation
- ByteQuest — Security & AI-Abuse Hardening (implementation brief)
- ByteQuest navigation
- ByteQuest UI/UX harmonization: slices 1–3 and ML slice planning
- Judge0 Hyper-V Ubuntu boot incident and recovery
- zerotier-relay.mjs
- Python demo journey — 2026-10-28
- Phase 7 local production-mode runtime verification
- ByteQuest 2.0 system status and weekly change log
- devDependencies
- Local API security verification — 2026-10-28
- Phase 7 database pool budget hardening
- ByteQuest system review: 22 November 2026
- workshop-progress.tsx
- ByteQuest 2.0 before and after
- smoke-vps.sh
- ByteQuest pilot remediation checklist
- preflight-vps.sh
- seed_local_showcase_activity.py
- getErrorMessage
- ByteQuest 2.0 system critique — 21 November 2026
- Step C — Instructor visual verification
- ByteQuest manuscript and system alignment checklist
- mastery_map
- ByteQuest 2.0 live deployment stack
- home-redirect.tsx
- ML features and prediction unit: manuscript vs. code
- ByteQuest KVM 2 live pilot
- reserve
- ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash
- ByteQuest — Security & AI-Abuse Hardening (implementation brief)
- FastAPI
- 5. Slices
- Local API security contract
- Phase 7 dependency security review (2026-10-26)
- dependencies
- Phase 7 synthetic deployment preflight — 2026-10-26
- api.ts
- account_provisioning.py
- performance/page.tsx
- Phase 7 backend image build verification
- components/student-preview.tsx
- flow
- Phase 7 frontend build evidence
- Phase 7 Vercel setup verification — 2026-10-26
- CLAUDE.md
- ByteQuest Insights, part 3 of 4: instructors
- Workshops: Create, Join and the Workshop page
- test_memory_rules.py
- Production instructor access
- Wireframes
- Make ByteQuest fit every phone and tablet
- ByteQuest 2.0: close the manuscript gaps, tidy the structure, then review and rate the system
- ByteQuest Insights, part 1 of 4: shared foundation
- instructor/page.tsx
- frontend/AGENTS.md
- ByteQuest Insights, part 2 of 4: students
- Analytics
- ByteQuest system status — 21 November 2026
- reviews.py
- services/materials.py
- test_gemini_embeddings.py
- test_every_public_timestamp_column_is_aware
- Course data model and grade integrity
- sqlalchemy
- course_access.py

## God Nodes (most connected - your core abstractions)
1. `Profile` - 363 edges
2. `Session` - 363 edges
3. `LearningActivity` - 226 edges
4. `getErrorMessage()` - 152 edges
5. `ActivityAttempt` - 125 edges
6. `apiRequest()` - 122 edges
7. `ReviewState` - 112 edges
8. `ProgrammingLang` - 97 edges
9. `UserRole` - 94 edges
10. `react` - 91 edges

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

## Communities (187 total, 26 thin omitted)

### Community 0 - "ui.tsx"
Cohesion: 0.05
Nodes (104): Design system and data flow, Frontend, Stack and layout, Medium, 5.1 Shared library and components, AdminAccounts(), confirmDeactivate(), confirmReactivate() (+96 more)

### Community 1 - "ByteQuest 2.0: instructor activity analysis and class announcements"
Cohesion: 0.17
Nodes (11): ByteQuest 2.0: instructor activity analysis and class announcements, Database, Double-check before you report, Final report, Frontend, Hard rules, Part 1: Activity analysis, Part 2: Class announcements (+3 more)

### Community 2 - "faculty/materials.py"
Cohesion: 0.25
Nodes (13): _material_for_user(), archive_material(), create_material(), download_material(), list_materials(), _material_rows(), MaterialMetadataUpdate, replace_material_version() (+5 more)

### Community 3 - "WorkshopMutation"
Cohesion: 0.28
Nodes (10): _announcement_for_update(), delete_workshop_announcement(), leave_workshop(), _remove_student(), remove_workshop_activity(), remove_workshop_student(), require_open(), update_workshop_announcement() (+2 more)

### Community 4 - "WorkshopView"
Cohesion: 0.20
Nodes (15): archive_workshop(), create_workshop(), CreateWorkshop, join_workshop(), JoinWorkshop, _new_code(), reset_workshop_code(), restore_workshop() (+7 more)

### Community 5 - "chat-provider.tsx"
Cohesion: 0.10
Nodes (29): chatHistory, ChatMode, ConversationPage, ConversationSummary, SavedReply, SavedTurn, Transcript, TurnStatus (+21 more)

### Community 6 - "app-shell.tsx"
Cohesion: 0.13
Nodes (27): checkExistingAuth(), WorkspaceLayout(), AppShell(), AuthenticatedLayout(), isActiveDestination(), ProfileContext, useScrollResetOnRouteChange(), destinationFor() (+19 more)

### Community 7 - "test_faculty_admin.py"
Cohesion: 0.05
Nodes (70): AuditEvent, CourseMember, GradingWorkerHeartbeat, HintUse, ResearchConsent, course_open_clause(), student_activity_clause(), workshop_shareable_activity_clause() (+62 more)

### Community 8 - "activities/[id]/page.tsx"
Cohesion: 0.04
Nodes (80): Step A checkpoint and caller verification, 4.5 Administrator API (`backend/app/api/admin.py`, prefix `/api/v1/admin`), ActivityEditor(), confirmPublish(), createVersion(), diffPayload(), runVerification(), save() (+72 more)

### Community 9 - "start-bytequest.ps1"
Cohesion: 0.07
Nodes (44): ConvertTo-EncodedPowerShellCommand(), ConvertTo-PowerShellLiteral(), Get-BackendFingerprint(), Get-DockerDesktopFile(), Get-FrontendFingerprint(), Get-Judge0VmIPv4(), Get-Judge0VmIPv4FromNeighbor(), Get-ListenerPidMap() (+36 more)

### Community 10 - "drafts.py"
Cohesion: 0.07
Nodes (56): _admin_activity_item(), ActivityCreate, ActivityUpdate, create_activity(), create_activity_version(), get_activity(), _grading_fields(), preview_activity() (+48 more)

### Community 11 - "get"
Cohesion: 0.08
Nodes (47): admin_activities(), admin_dashboard(), _admin_material_items(), admin_materials(), admin_user(), course_reference_brief(), list_course_operations(), list_activity_workspace() (+39 more)

### Community 12 - "supabase.ts"
Cohesion: 0.10
Nodes (33): Interrupted Exam Autosave & Browser Recovery (Checklist Item #3), cleared, localMap, mockLocalStorage, mockSessionStorage, remaining, storageMap, Attempt (+25 more)

### Community 13 - "test_learning_flow_integration.py"
Cohesion: 0.05
Nodes (112): ChallengeHint, PlatformSetting, ReviewState, test_chat_requires_active_enrollment_only_for_students(), _challenge(), _chat_payload(), _course_pdf(), _enroll_chat_students() (+104 more)

### Community 14 - "chat-workspace.tsx"
Cohesion: 0.17
Nodes (17): ChatPage(), useChat(), ChatConversation, ChatIcon(), ChatPanel(), ChatShell(), close(), ChatDialog() (+9 more)

### Community 15 - "dashboard/page.tsx"
Cohesion: 0.07
Nodes (36): activityHref(), closesIn(), Dashboard, DashboardContent(), DashboardPage(), kindLabel(), localTime(), Progress (+28 more)

### Community 16 - "ML evidence, operations and ML methodology: readiness plan"
Cohesion: 0.08
Nodes (25): 1. Where things stand, 2. Decisions you need to make, 3. Workstream A: operations and reliability, 4. Workstream B: ML evidence and readiness, 5. Workstream C: ML methodology (all supplementary), 6. Order and timeline, 7. Which skill flow to use for each piece, 8. Done means (+17 more)

### Community 17 - "exams/[id]/page.test.tsx"
Cohesion: 0.25
Nodes (5): answerSaves(), Call, mocks, savedBodies(), seedUnsyncedSnapshot()

### Community 18 - "submissions.py"
Cohesion: 0.06
Nodes (39): compare_submission(), ComparedAttempt, get_job(), _retry_failed_job(), retry_job(), SubmissionComparison, submit_job(), SubmitJob (+31 more)

### Community 19 - "test_ml_exam_features.py"
Cohesion: 0.22
Nodes (7): _attempt(), test_faculty_forecast_uses_the_recorded_winner_and_hides_legacy_probability(), test_hint_exports_reject_identifying_columns(), test_older_feature_schema_artifacts_are_rejected(), test_rows_are_first_submissions_on_challenges_with_strictly_prior_history(), test_training_rejects_ids_that_encode_an_account(), prepare_ml_dataset()

### Community 20 - "predictor.py"
Cohesion: 0.07
Nodes (20): api_health_check(), health_check(), lifespan(), readiness_check(), load_ml_models(), ModelArtifactError, ModelArtifactsUnavailable, ModelBundle (+12 more)

### Community 21 - "profiles.py"
Cohesion: 0.16
Nodes (20): ActivityDay, AdminAnalytics, AnalyticsResponse, AuditEntry, BadgeEntry, complete_staff_setup(), complete_student_onboarding(), _enum_value() (+12 more)

### Community 22 - "request_size.py"
Cohesion: 0.18
Nodes (8): RequestSizeLimitMiddleware, limited_receive(), tracked_send(), _TooLarge, test_streamed_body_without_content_length_is_limited(), read_body(), receive(), send()

### Community 23 - "sqlalchemy"
Cohesion: 0.10
Nodes (17): _starter_username(), _encoded_id(), is_starter_username(), starter_username(), pytest_sessionstart(), _export_queries(), test_documented_exports_require_latest_current_consent(), session_factory() (+9 more)

### Community 24 - "pilot.py"
Cohesion: 0.15
Nodes (22): require_practice_help_available(), challenge(), choose_consent(), close_challenge(), ConsentChoice, DraftPayload, _expired_hint_reservation(), get_draft() (+14 more)

### Community 25 - "6. Prioritized improvement backlog"
Cohesion: 0.08
Nodes (26): 1. Where the project stands, 2. Progress percentages and how they were calculated, 3. What exists today and where evidence stops, 4. Verification evidence and its limits, 5. Six gates before a live classroom pilot, 6. Prioritized improvement backlog, 7. Execution order, AI, LLM, RAG and provider handling (+18 more)

### Community 26 - "LearningActivity"
Cohesion: 0.09
Nodes (39): QuizSubmissionRequest, AddWorkshopActivities, ActivityKind, LearningActivity, ProgrammingLang, TestCase, UserRole, Workshop (+31 more)

### Community 27 - "submit_conceptual_quiz"
Cohesion: 0.12
Nodes (20): _ensure_student(), get_codex(), get_student_progress(), LeaderboardEntry, LeaderboardResponse, LeaderboardStanding, list_published_quests(), _load_quiz_questions() (+12 more)

### Community 28 - "chat_history.py"
Cohesion: 0.16
Nodes (26): _check_revision(), Conversation, ConversationPage, create_conversation(), CreateConversation, delete_conversation(), delete_history(), _find_conversation() (+18 more)

### Community 29 - "submission-comparison.tsx"
Cohesion: 0.15
Nodes (17): Editor, Draft, AttemptSummary(), CodeDiff(), loadEditor(), ComparedAttempt, Comparison, ComparisonResult() (+9 more)

### Community 30 - "progress_recap.py"
Cohesion: 0.10
Nodes (15): get_gamification_state(), get_progress_recap(), _utcnow(), _day(), _manila(), _practice_days(), progress_recap(), ProgressRecap (+7 more)

### Community 31 - "workshop-home.tsx"
Cohesion: 0.08
Nodes (45): WorkshopDetailLayout(), WorkshopInvitePage(), WorkshopsPage(), useShellProfile(), Announcement, AnnouncementDialog, Announcements(), merge() (+37 more)

### Community 32 - "Prioritized defects"
Cohesion: 0.11
Nodes (18): 10. [P3] Hidden-case aggregate summary incorrectly reports zero, 1. [P1] A workshop can expose another instructor's course activity, 2. [P1] Verification can certify content that Judge0 never checked, 3. [P1] Unreleased exam successes can affect visible rewards, 4. [P1] The current release build exits with a dependency security warning, 5. [P2] Challenges with no visible sample can be published, 6. [P2] The dashboard recommends a closed quest that cannot be submitted, 7. [P2] Completing one exam can hide another due exam on the dashboard (+10 more)

### Community 33 - "onboarding/page.tsx"
Cohesion: 0.11
Nodes (35): 2. Lab Station & Shared-Computer Protocol, Student Sign-Out Procedure, AuthMode, OnboardingContent(), authenticate(), changeAuthMode(), continueToAgreement(), finishPasswordSetup() (+27 more)

### Community 34 - "workshop-activities.tsx"
Cohesion: 0.15
Nodes (14): ActivityDialog, ActivityEditor(), save(), ActivityLink, ActivityOption, ActivityPicker(), mocks, quests (+6 more)

### Community 35 - "asyncio"
Cohesion: 0.16
Nodes (11): cleanup(), main(), one_student(), require_local(), run_load(), main(), student(), ask() (+3 more)

### Community 36 - "chat.py"
Cohesion: 0.08
Nodes (25): _chat_activity(), ChatLimits, ChatMessageRequest, ChatMessageResponse, ChatSource, ChatStatus, ChatTurn, _course_passages() (+17 more)

### Community 37 - "leaderboard.tsx"
Cohesion: 0.20
Nodes (12): CHOOSE_HANDLE_HREF, Leaderboard(), LeaderboardData, LeaderboardEntry, LeaderboardStanding, LearnerName(), MEDAL, Row() (+4 more)

### Community 38 - "lib/types.ts"
Cohesion: 0.06
Nodes (32): loops, mocks, quest, ERROR_LABELS, MEMORY_LABELS, STATE_LABELS, mocks, result (+24 more)

### Community 39 - "insights.py"
Cohesion: 0.17
Nodes (16): practice_errors(), recoveries_for(), CategoryCount, course_insights(), _event_days(), GamificationInsights, HelpSeeking, _manila_day() (+8 more)

### Community 40 - "numpy"
Cohesion: 0.12
Nodes (18): test_adequacy_flags_a_small_test_partition(), test_bootstrap_intervals_are_reproducible_and_resample_learners(), _adequacy(), _atomic_joblib_dump(), _atomic_json_write(), _atomic_write(), _bootstrap_intervals(), _build_pipeline() (+10 more)

### Community 41 - "ml_predictor/feature_engineering.py"
Cohesion: 0.22
Nodes (7): _as_bool(), _before(), _enum_value(), extract_features_from_dataframe(), _frame(), _mean(), _rate()

### Community 42 - "4. Findings and implementation blueprint"
Cohesion: 0.08
Nodes (24): 1. Where ByteQuest stands, 2. How the system fits together, 3. Work order, 4. Findings and implementation blueprint, 5. Local completion checklist, 6. Which existing document answers which question, BQ-01 — Award completion XP at the first eligible event, BQ-02 — Give submission jobs one owner per claim (+16 more)

### Community 43 - "qa_live_multi_role.py"
Cohesion: 0.09
Nodes (31): api_base(), cleanup(), create_accounts(), instructor_builds_course(), letters(), main(), password_token(), print_report() (+23 more)

### Community 44 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 45 - "Classroom pilot fixes and verification — 2026-10-28"
Cohesion: 0.33
Nodes (5): Changes checked locally, Classroom pilot fixes and verification — 2026-10-28, Evidence, Other Remaining Pilot Verification Gates, Verification Status & Remaining Gates

### Community 46 - "A. Add more code challenges"
Cohesion: 0.10
Nodes (16): GeneratedChallengeSchema, GeneratedQuizOptionSchema, GeneratedQuizQuestionSchema, GeneratedQuizSchema, _serialize_challenge(), TestCaseSchema, Suggested API contract, 2. Exact code touchpoints (+8 more)

### Community 47 - "Faculty and administrator workspace — implementation log and continued work"
Cohesion: 0.11
Nodes (17): 10. Files created or modified (this work), 11. Quick current-state checklist, 1. Status at handoff, 6. Tests added, 7. Verification evidence (live app), 8. How to continue (commands, accounts, cleanup), 9. Remaining work, Additional navigation fix (+9 more)

### Community 48 - "package.json"
Cohesion: 0.06
Nodes (29): engines, node, name, overrides, dompurify, private, scripts, build (+21 more)

### Community 49 - "Phase 1 — ByteQuest instructor redesign plan"
Cohesion: 0.17
Nodes (12): Assumptions, Courses and Workshops, Dashboard and Analytics division, Files changed, How to test this plan, Main user flows, Next step, Other instructor API contracts (+4 more)

### Community 50 - "get_db"
Cohesion: 0.11
Nodes (24): course_health(), _accuracy(), _course_activities(), dashboard(), evaluation(), _faculty(), _forecast(), forecast_readiness() (+16 more)

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

### Community 55 - "chat-conversation.tsx"
Cohesion: 0.18
Nodes (12): availabilityCopy, ChatConversation(), onInputKey(), submit(), languageNames, suggestedPrompts(), ChatMessageContent(), CodeBlock() (+4 more)

### Community 56 - "vps_bootstrap.sh"
Cohesion: 0.24
Nodes (15): active_ssh_port(), configure_cgroup_v1(), configure_docker(), configure_firewall(), configure_swap(), DEBIAN_FRONTEND, die(), DOCKER_KEYRING (+7 more)

### Community 57 - "navigation.ts"
Cohesion: 0.23
Nodes (9): WorkshopsLayout(), CourseNavigationLinks(), CourseSwitcher(), InstructorCourseShell(), InstructorShell(), MoreNavigation(), InstructorIcon(), instructorNavigation (+1 more)

### Community 58 - "LegalDocument"
Cohesion: 0.24
Nodes (9): metadata, Page(), metadata, Page(), LegalDocument(), LegalKind, LegalModal(), PolicyPanel() (+1 more)

### Community 59 - "llm.py"
Cohesion: 0.07
Nodes (21): get_settings(), ErrorExplanationSchema, explain_code_error(), _client_for_key(), GeminiConfigurationError, get_gemini_client(), _chat_failure(), GeminiAPIError (+13 more)

### Community 60 - "workshops.py"
Cohesion: 0.16
Nodes (31): _activity_links(), add_workshop_activities(), AnnouncementView, can_manage(), CreateAnnouncement, get_workshop(), list_workshop_announcements(), list_workshops() (+23 more)

### Community 61 - "exams.py"
Cohesion: 0.12
Nodes (44): assigned(), assigned_exam_numbers(), _assigned_exams_with_state(), create_exam(), DraftExam, DraftItem, _exam_access(), exam_sample_run() (+36 more)

### Community 62 - "profile/page.tsx"
Cohesion: 0.06
Nodes (52): AccountPanel(), AdminSections(), ConsentStatus, habitsMessage(), InstructorSections(), PersonalTimeline(), ProfilePage(), ProfilePageContent() (+44 more)

### Community 63 - "useChatController"
Cohesion: 0.14
Nodes (23): RFC-4122, Hard rules, requestAiHint(), turnMessages(), mapChatError(), useChatController(), applySavedReply(), canSend() (+15 more)

### Community 64 - "ByteQuest machine-learning improvement plan"
Cohesion: 0.11
Nodes (18): 1. Goal, 2. Where things stand, 3. Decisions, 4.1 Prediction unit and label, 4.2 History, 4.3 The ten features, in this order, 4.4 Live shadow scoring, 4.5 Reporting (+10 more)

### Community 65 - "retrieval.py"
Cohesion: 0.09
Nodes (30): _gemini_unavailable_http_exception(), generate_ai_coding_challenge(), generate_ai_conceptual_quiz(), _generation_payload(), _get_owned_activity(), _get_owned_document(), _may_manage_activity(), _may_manage_document() (+22 more)

### Community 66 - "train_compare.py"
Cohesion: 0.10
Nodes (12): _as_binary_label(), _check_columns(), _encodes_account_id(), _fit_baselines(), _format_metric(), generate_synthetic_thesis_dataset(), main(), _require_pseudonymous() (+4 more)

### Community 67 - "ByteQuest 2.0 Classroom Pilot Operator Runbook"
Cohesion: 0.20
Nodes (10): 1. Hard Safety Gates (Enforced by Configuration), 3. Network Resilience & Live Draft Sync, 4. Timed Exam Operations, 5. Verification Commands, 6. Incident Troubleshooting, ByteQuest 2.0 Classroom Pilot Operator Runbook, Classroom Wi-Fi Reconnect Banner, Idempotent Submissions & Double-Click Protection (+2 more)

### Community 68 - "solve_quality.py"
Cohesion: 0.23
Nodes (6): best_challenge_stars(), challenge_stars(), help_pattern(), hint_timing(), solve_stars(), tried_before_hint()

### Community 69 - "submissions/[id]/page.tsx"
Cohesion: 0.13
Nodes (16): Job, nextStarTip(), SubmissionStatusPage(), refresh(), retryGrading(), currentAttempt, mocks, oldSubmission (+8 more)

### Community 70 - "ByteQuest local end-to-end flow"
Cohesion: 0.12
Nodes (17): 8 Required Acceptance Checks, Account-synced progression check, Before deployment, ByteQuest local end-to-end flow, Durability Boundary & Concurrency Guarantees, Exam Autosave & Conflict-Safe Recovery Verification, Instructor account, Local Quest Map demos (+9 more)

### Community 71 - "accessibility-provider.tsx"
Cohesion: 0.08
Nodes (29): Repo map: exact files to inspect and change, byteBounce, metadata, RootLayout(), viewport, ACCESSIBILITY_STORAGE_KEYS, AccessibilityContext, AccessibilityContextValue (+21 more)

### Community 72 - "ByteQuest 2.0"
Cohesion: 0.22
Nodes (9): Architecture, ByteQuest 2.0, Configuration and security, Documentation, Repository layout, Stack and deployment, Start locally on Windows, Test and verify (+1 more)

### Community 73 - "client.py"
Cohesion: 0.06
Nodes (23): _b64_decode(), _b64_encode(), BatchEvaluationSummary, CircuitBreaker, classify_judge0_status(), Judge0CircuitOpenError, Judge0Client, Judge0UnavailableError (+15 more)

### Community 74 - "ByteQuest 2.0 — Full system review"
Cohesion: 0.07
Nodes (23): ByteQuest 2.0 engineering and UX review, Findings, Performance evidence, Recommended sequence, Verification and limits, Already strong (checked, not assumed), ByteQuest 2.0 — Full system review, Evidence (+15 more)

### Community 75 - "Phase 0 — ByteQuest instructor audit"
Cohesion: 0.22
Nodes (8): Current FastAPI inventory, Current screens and feature coverage, Decisions for Phase 1, Desktop scorecard, Findings, Phase 0 — ByteQuest instructor audit, Supabase data and authorization, Verification

### Community 76 - "StorageError"
Cohesion: 0.23
Nodes (5): StorageError, SupabasePDFStorage, test_accepts_absolute_signed_url_from_configured_origin(), test_rejects_untrusted_signed_url(), test_resolves_supabase_relative_signed_path()

### Community 78 - "ByteQuest 2.0 database review — 12 November 2026"
Cohesion: 0.18
Nodes (11): _id(), B. Findings, ByteQuest 2.0 database review — 12 November 2026, C. Migration plan, D. Index recommendations, E. Organisation and documentation, G. Explicitly out of scope, Must fix (+3 more)

### Community 79 - "Profile"
Cohesion: 0.07
Nodes (66): account_emails_for_email(), account_impact(), _account_needs_action(), AccountCreate, activity_impact(), _admin_activity(), admin_archive_activity(), admin_archive_material() (+58 more)

### Community 81 - "quiz-view.tsx"
Cohesion: 0.18
Nodes (7): QuizPage(), getActivityHref(), QuizResult, QuizView(), handleSubmitQuiz(), load(), QuizQuestion

### Community 82 - "ActivityAttempt"
Cohesion: 0.08
Nodes (27): dashboard(), submit_conceptual_quiz(), ActivityAttempt, activity_accepts_submissions_clause(), activity_has_opened(), activity_is_closed(), _as_utc(), guard_solution_reopen() (+19 more)

### Community 83 - "ByteQuest 2.0: Master Architecture Plan & Execution Roadmap"
Cohesion: 0.08
Nodes (24): 1. Project Tracking & Thesis Collaboration Strategy, 2. Core Architectural Rules (Non-Negotiable), 3. Repository Directory Structure, 4. Course-Sequence & Curriculum Alignment, 5. Database Schema Blueprint (Supabase PostgreSQL + pgvector), 6. 7-Phase Development Plan, 7. Thesis Objectives Mapping (Chapter 1 Alignment), 8. Development Environment & Quickstart Commands (+16 more)

### Community 84 - "Phase 7 deployment readiness"
Cohesion: 0.18
Nodes (11): Decisions required before production setup, Deployment order after the decisions are made, Evidence still needed, Local Judge0 runtime smoke check (2026-10-26), Notes on local verification, Phase 7 deployment readiness, Prepared in the repository, Production settings and network boundaries (+3 more)

### Community 85 - "quests/page.tsx"
Cohesion: 0.18
Nodes (15): ExamCard, ExamsPage(), localTime(), QuestsPage(), QuestsPageContent(), changeView(), handleKeyDown(), QuestStatusFilter (+7 more)

### Community 86 - "ProfileResponse"
Cohesion: 0.17
Nodes (6): delete_my_avatar(), get_my_profile(), ProfileResponse, ProfileUpdateRequest, update_my_profile(), normalize_username()

### Community 87 - "typing"
Cohesion: 0.24
Nodes (6): _coerce(), list_settings(), _range_error(), serialize_setting(), _typed_value(), update_setting()

### Community 88 - "Settings"
Cohesion: 0.16
Nodes (3): Settings, test_pdf_page_and_character_limits(), test_production_cors_requires_exact_https_origin()

### Community 89 - "arena.tsx"
Cohesion: 0.09
Nodes (35): ArenaPage(), Arena(), checkStatus(), confirmResetCode(), endSegment(), handleCodeChange(), handleCopyOutput(), load() (+27 more)

### Community 90 - "workspace.ts"
Cohesion: 0.04
Nodes (76): retry(), openStudent(), describe(), EnrollStudents(), enroll(), runPreview(), GROUPS, courses (+68 more)

### Community 91 - "Instructor activity analysis and class announcements"
Cohesion: 0.33
Nodes (6): Activity analysis, Browser verification, Class announcements, Instructor activity analysis and class announcements, Remaining verification, Verification

### Community 92 - "Desktop and Mobile Pilot Flows (`pilot-v2.html`)"
Cohesion: 0.22
Nodes (8): 1. Offline / Network Reconnect Banner, 2. Pending / Queued Grading State, 3. Research Consent & Withdrawal State (Disabled Collection Notice), 4. Active Exam Priority Banner & Timed Attempt Lock, ByteQuest web app wireframes, Coverage, Desktop and Mobile Pilot Flows (`pilot-v2.html`), Review checklist

### Community 93 - "dockable-navigation.tsx"
Cohesion: 0.13
Nodes (19): 5.2 Faculty routes, 5.3 Administrator routes, 5.4 Navigation and shell integration, 5. Frontend changes, AccessibilityPage(), AccessibilityPreferenceKey, ACCESSIBILITY_SETTINGS, AccessibilitySettingDefinition (+11 more)

### Community 94 - "upload_my_avatar"
Cohesion: 0.18
Nodes (6): _detect_avatar_content_type(), school_id_availability(), SchoolIdCheck, upload_my_avatar(), test_detect_avatar_content_type_recognizes_supported_signatures(), test_detect_avatar_content_type_rejects_metadata_only_and_truncated_files()

### Community 95 - "next"
Cohesion: 0.07
Nodes (36): nextConfig, AdminCoursesPage(), blank, Courses(), askArchive(), changed(), confirmArchive(), submit() (+28 more)

### Community 96 - "account-menu.tsx"
Cohesion: 0.33
Nodes (8): AccountMenu(), subscribeToSheetBreakpoint(), usesAccountSheet(), hueFromSeed(), identiconCells(), UserAvatar(), UserAvatarProps, useSignOut()

### Community 97 - "ML pipeline synthetic verification — 2026-10-25"
Cohesion: 0.29
Nodes (6): Artifact and activation checks, Execution, ML pipeline synthetic verification — 2026-10-25, Observed grouped metrics, Remaining Phase 5 work, Scope

### Community 98 - "codex.py"
Cohesion: 0.33
Nodes (7): ChallengeRecovery, codex_summary(), CodexCategory, CodexRecovery, CodexSummary, recoveries(), recovery_news()

### Community 99 - "preflight-host.sh"
Cohesion: 0.38
Nodes (6): fail(), MIN_MEMORY_BYTES, MIN_ROOT_FREE_BYTES, MIN_SWAP_BYTES, pass(), preflight-host.sh script

### Community 100 - "Phase 6 shadow rollout implementation record"
Cohesion: 0.40
Nodes (5): Implemented, Phase 6 shadow rollout implementation record, Phase 7 handoff, Safety and current state, Verification still required

### Community 101 - "httpx"
Cohesion: 0.17
Nodes (11): _evaluate(), _failed_sample(), main(), _request(), TutorCase, challenge_specs(), foundation_id(), main() (+3 more)

### Community 102 - "ML feature engineering and training"
Cohesion: 0.40
Nodes (5): Comparison protocol, Export an attempt dataset, ML feature engineering and training, Prepare an Ubuntu VPS, Safe pipeline setup

### Community 103 - "monitoring.py"
Cohesion: 0.18
Nodes (18): _check_judge0(), _grading_worker_health(), _minutes(), overall_health(), _prediction_health(), _rag_health(), _runner_health(), runner_status() (+10 more)

### Community 104 - "ByteQuest Gemini tutor pilot evaluation"
Cohesion: 0.50
Nodes (4): ByteQuest Gemini tutor pilot evaluation, Reply quality, Token use and estimated Gemini cost, What was tested

### Community 105 - "ByteQuest — Security & AI-Abuse Hardening (implementation brief)"
Cohesion: 0.20
Nodes (9): ByteQuest — Security & AI-Abuse Hardening (implementation brief), Final report (keep it short), Order and verification, Out of scope: do not do these, Rules for every task, Stack, Task 4 — Administrators can never self-register, Task 6 — Frontend security headers (+1 more)

### Community 106 - "ByteQuest navigation"
Cohesion: 0.40
Nodes (5): ByteQuest navigation, Compatibility and new destinations, Existing routes, Local verification, Workshops (11/21/26)

### Community 107 - "ByteQuest UI/UX harmonization: slices 1–3 and ML slice planning"
Cohesion: 0.15
Nodes (12): Bugs found and fixed, ByteQuest UI/UX harmonization: slices 1–3 and ML slice planning, Checkpoint, Decisions made today, How it was checked, Next steps, Not checked, Slice 1: shared foundation and help (+4 more)

### Community 108 - "Judge0 Hyper-V Ubuntu boot incident and recovery"
Cohesion: 0.05
Nodes (39): 1. Start and open the known-good VM, 2. Confirm the Judge0 services and volume inside Ubuntu, 3. Get the current guest IP and check the port, 4. Update ByteQuest if the VM IP changed, 5. Restart FastAPI and leave it running, 6. Verify service integration without exposing secrets, Current verified state, Disk and data safety (+31 more)

### Community 110 - "Python demo journey — 2026-10-28"
Cohesion: 0.40
Nodes (4): Browser walkthrough, Implemented, Local evidence, Python demo journey — 2026-10-28

### Community 111 - "Phase 7 local production-mode runtime verification"
Cohesion: 0.17
Nodes (10): Boundaries and remaining work, Phase 7 local production-mode runtime verification, Procedure, Reproduction, Results, Changes, Limits, Local runtime spot check — 2026-10-26 (+2 more)

### Community 112 - "ByteQuest 2.0 system status and weekly change log"
Cohesion: 0.29
Nodes (7): ByteQuest 2.0 system status and weekly change log, Current feature and deployment map, How close is ByteQuest to finished?, Latest local verification, UI and UX review, What changed this week, Work left before the next milestone

### Community 113 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, eslint, eslint-config-next, jsdom, @testing-library/react, @types/node, @types/react, @types/react-dom (+2 more)

### Community 114 - "Local API security verification — 2026-10-28"
Cohesion: 0.50
Nodes (3): 30-student local load, Checks, Local API security verification — 2026-10-28

### Community 115 - "Phase 7 database pool budget hardening"
Cohesion: 0.50
Nodes (3): Change, Checks performed, Phase 7 database pool budget hardening

### Community 116 - "ByteQuest system review: 22 November 2026"
Cohesion: 0.20
Nodes (10): ByteQuest system review: 22 November 2026, Findings, How to run this (skill flows), Low, Medium, Recommended order, Scorecard, Verdict (+2 more)

### Community 117 - "workshop-progress.tsx"
Cohesion: 0.31
Nodes (7): labels, LearnerProgress, Progress, ProgressStatus(), Status, StudentName(), WorkshopProgress()

### Community 118 - "ByteQuest 2.0 before and after"
Cohesion: 0.12
Nodes (16): AI and the browser experience, ByteQuest 2.0 before and after, Current local evidence, Curriculum, grading interruptions, tutoring, and exam accessibility, Exam-grading slot comparison · 19 November 2026, Grading, exams, and course records, How to decide whether the work paid off, Implementation and local verification (+8 more)

### Community 119 - "smoke-vps.sh"
Cohesion: 0.83
Nodes (3): check_health(), smoke-vps.sh script, usage()

### Community 120 - "ByteQuest pilot remediation checklist"
Cohesion: 0.29
Nodes (7): 1. Fix release blockers, 2. Correct grading, dashboard, and accessibility behavior, 3. Restore live grading and fill the content gaps, 4. Verify feature availability and role workflows, 5. Decide whether the pilot can start, ByteQuest pilot remediation checklist, Resume the Judge0 checks

### Community 123 - "seed_local_showcase_activity.py"
Cohesion: 0.08
Nodes (33): Badge, DocumentChunk, ExamSampleRun, StudentBadge, WorkshopAnnouncement, WorkshopMember, award_badges(), evaluate_and_award_badges() (+25 more)

### Community 124 - "getErrorMessage"
Cohesion: 0.06
Nodes (49): CHOICE_LABEL, ResearchConsentSettingsPage(), choose(), ExamsPage(), ExamInfo, ExamPage(), handleRunSample(), handleStartExam() (+41 more)

### Community 126 - "ByteQuest 2.0 system critique — 21 November 2026"
Cohesion: 0.25
Nodes (8): ByteQuest 2.0 system critique — 21 November 2026, Findings by severity, Low, Not verified in this review, Scorecard, Top 5 things to do next, Verdict, What is working well (keep)

### Community 127 - "Step C — Instructor visual verification"
Cohesion: 0.33
Nodes (6): Current routes and behavior, Phase 2 API and rollout list, Reference tokens and icons, Screenshot comparisons, Step C — Instructor visual verification, Test target checks

### Community 128 - "ByteQuest manuscript and system alignment checklist"
Cohesion: 0.20
Nodes (10): 1. Scope decisions, 2. Chapter 1 — Introduction and scope, 3. Chapter 2 — Literature and synthesis, 4. Chapter 3 — Roles, practice, and AI, 5. Chapter 3 — Assessment and architecture, 6. Chapter 3 — Consent, research data, and ML, 7. Study records and final sign-off, ByteQuest manuscript and system alignment checklist (+2 more)

### Community 132 - "mastery_map"
Cohesion: 0.60
Nodes (4): get_mastery_map(), mastery_map(), MasteryConcept, MasteryMapResponse

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

### Community 137 - "reserve"
Cohesion: 0.10
Nodes (14): reserve(), Rule, window_bounds(), test_ai_global_budgets_are_independent(), test_chat_has_dedicated_account_and_global_quota(), test_costly_action_pauses_if_quota_storage_is_unavailable(), test_daily_window_resets_at_manila_midnight(), test_global_ai_cap_rejects_without_spending_account_buckets() (+6 more)

### Community 138 - "ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash"
Cohesion: 0.22
Nodes (8): Behavior and scope of the assistant, ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash, Placement and responsive layout, Product decision, Quality gates and acceptance tests, Ready-to-paste DeepSeek V4.1 Flash implementation prompt, State and error rules, Window states and exact controls

### Community 139 - "ByteQuest — Security & AI-Abuse Hardening (implementation brief)"
Cohesion: 0.05
Nodes (24): get_current_user_payload(), TokenPayload, deliver_one(), check(), main(), auth(), verify(), claims() (+16 more)

### Community 140 - "FastAPI"
Cohesion: 0.13
Nodes (12): AnnouncementCreate, AnnouncementExpiry, AnnouncementPatch, _audit_change(), _authorize_announcement(), create_announcement(), delete_announcement(), list_announcements() (+4 more)

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

### Community 148 - "Phase 7 synthetic deployment preflight — 2026-10-26"
Cohesion: 0.33
Nodes (5): Evidence, Limits, Phase 7 synthetic deployment preflight — 2026-10-26, Result, Scope and method

### Community 149 - "api.ts"
Cohesion: 0.04
Nodes (48): 2. Repository discovery (recorded before changes), mocks, Page(), mocks, monitoring, mock, mocks, CurveChart() (+40 more)

### Community 150 - "account_provisioning.py"
Cohesion: 0.42
Nodes (7): create_account(), _admin_headers(), build_profile(), delete_auth_user(), DuplicateAccount, invite_auth_user(), ProvisioningUnavailable

### Community 151 - "performance/page.tsx"
Cohesion: 0.07
Nodes (45): Student Progress: the only roster and learner drawer, AdequacyNotice(), ComparisonTable(), ConfusionMatrix(), Intervals, Methodology(), metric(), METRIC_COLUMNS (+37 more)

### Community 152 - "Phase 7 backend image build verification"
Cohesion: 0.40
Nodes (4): Limits, Phase 7 backend image build verification, Recorded evidence, Work completed

### Community 154 - "flow"
Cohesion: 0.25
Nodes (3): flow(), cleanup(), override_db()

### Community 156 - "Phase 7 frontend build evidence"
Cohesion: 0.50
Nodes (3): Command and result, Phase 7 frontend build evidence, Scope and limits

### Community 157 - "Phase 7 Vercel setup verification — 2026-10-26"
Cohesion: 0.50
Nodes (3): Evidence and limits, Phase 7 Vercel setup verification — 2026-10-26, Verified state

### Community 159 - "ByteQuest Insights, part 3 of 4: instructors"
Cohesion: 0.18
Nodes (10): Activity health in the Activities list, ByteQuest Insights, part 3 of 4: instructors, Exam class summary, Goal, Handheld rules, Inactive 7+ days, Model evaluation, Out of scope (+2 more)

### Community 160 - "Workshops: Create, Join and the Workshop page"
Cohesion: 0.20
Nodes (10): 10. Decisions to critique, 1. What exists today, 2. Screen map, 3. Rules, 5. API changes (all under `/api/v1/workshops`), 6. Frontend structure, 7. Delivery slices (each ships with tests), 8. Out of scope for v1 (+2 more)

### Community 161 - "test_memory_rules.py"
Cohesion: 0.38
Nodes (3): review_passed(), test_review_passes_at_two_thirds(), test_review_size_uses_up_to_four_questions()

### Community 162 - "Production instructor access"
Cohesion: 0.67
Nodes (3): Grant access to one account, Production instructor access, Safety boundaries

### Community 163 - "Wireframes"
Cohesion: 0.22
Nodes (9): Activity editor, Analytics desktop, Analytics phone, Dashboard desktop, Dashboard phone, Learner drill-down, Other screen layouts, Submission review (+1 more)

### Community 164 - "Make ByteQuest fit every phone and tablet"
Cohesion: 0.20
Nodes (10): Already in place: extend, do not rebuild, Goal, Layout system, Make ByteQuest fit every phone and tablet, Menu docking: finish what exists, Out of scope, Screens, Side navigation on handheld screens: already built (+2 more)

### Community 165 - "ByteQuest 2.0: close the manuscript gaps, tidy the structure, then review and rate the system"
Cohesion: 0.22
Nodes (8): ByteQuest 2.0: close the manuscript gaps, tidy the structure, then review and rate the system, Do not, Final report, Part 1: AI tutoring (highest priority), Part 3: Code structure (targeted; behaviour must stay identical), Part 4: Review and targeted fixes, Stack and layout, Verification

### Community 166 - "ByteQuest Insights, part 1 of 4: shared foundation"
Cohesion: 0.20
Nodes (9): ByteQuest Insights, part 1 of 4: shared foundation, Charts: two primitives, Goal, Handheld rules, Metric labels, Out of scope, Profile: one role tab, each figure once, Remove the duplicate Sequencer evaluation (+1 more)

### Community 167 - "instructor/page.tsx"
Cohesion: 0.05
Nodes (93): Course health on System Overview, Already in place: extend, do not rebuild, Shared insight widgets, Verification and rollout, Already in place: extend, do not rebuild, One kit: course-ui, Already in place: extend, do not rebuild, Implementation status (21 November 2026, same day) (+85 more)

### Community 169 - "ByteQuest Insights, part 2 of 4: students"
Cohesion: 0.22
Nodes (8): ByteQuest Insights, part 2 of 4: students, Goal, Handheld rules, One badge list, Out of scope, Score trend and breakdowns, Topic practice links, Verification and rollout

### Community 170 - "Analytics"
Cohesion: 0.40
Nodes (5): Analytics, API and data performance, Chart library and motion, Filters and shared facts, Metric dictionary

### Community 172 - "ByteQuest system status — 21 November 2026"
Cohesion: 0.40
Nodes (5): ByteQuest system status, Checkout, runtime and release, Machine learning — status on 11/21/26, Verification and remaining checks, What changed

### Community 174 - "reviews.py"
Cohesion: 0.12
Nodes (33): get_review(), get_reviews(), _locked_student(), _public_review(), _question_id(), _require_memory(), ReviewOverviewResponse, ReviewResponse (+25 more)

### Community 175 - "services/materials.py"
Cohesion: 0.10
Nodes (21): ProcessingJob, embed_chunks_bounded(), embed_one(), extract_chunks_from_pdf(), extract_pdf_chunks(), _file_too_large(), _index_stored_pdf(), material_version_rows() (+13 more)

### Community 179 - "Course data model and grade integrity"
Cohesion: 0.67
Nodes (3): Course data model and grade integrity, Migration and rollback, RLS and authorization

### Community 188 - "sqlalchemy"
Cohesion: 0.11
Nodes (6): destroy(), main(), ensure_student(), letters(), main(), student_account()

### Community 189 - "course_access.py"
Cohesion: 0.07
Nodes (29): get_chat_status(), exam_catalog(), instructor_exams(), consent_status(), instructor_hints(), student_announcements(), username_availability(), get_gamification_leaderboard() (+21 more)

## Knowledge Gaps
- **18 isolated node(s):** `monaco-editor`, `react-is`, `@types/node`, `@types/react`, `@types/react-dom` (+13 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1448 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **26 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `4. Read these before writing any code` connect `seed_local_showcase_activity.py` to `ui.tsx`, `test_faculty_admin.py`, `flow`, `client.py`, `test_learning_flow_integration.py`, `services/materials.py`, `ActivityAttempt`, `profiles.py`, `profile/page.tsx`, `LearningActivity`, `submit_conceptual_quiz`, `progress_recap.py`?**
  _High betweenness centrality (0.165) - this node is a cross-community bridge._
- **Are the 296 inferred relationships involving `Profile` (e.g. with `account_impact()` and `_account_needs_action()`) actually correct?**
  _`Profile` has 296 INFERRED edges - model-reasoned connections that need verification._
- **What connects `monaco-editor`, `react-is`, `@types/node` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ui.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.052688953488372096 - nodes in this community are weakly interconnected._
- **Why does `LearningActivity` connect `LearningActivity` to `faculty/materials.py`, `test_faculty_admin.py`, `drafts.py`, `get`, `test_learning_flow_integration.py`, `submissions.py`, `predictor.py`, `profiles.py`, `pilot.py`, `submit_conceptual_quiz`, `progress_recap.py`, `asyncio`, `chat.py`, `insights.py`, `qa_live_multi_role.py`, `A. Add more code challenges`, `reviews.py`, `services/materials.py`, `get_db`, `workshops.py`, `exams.py`, `course_access.py`, `retrieval.py`, `solve_quality.py`, `client.py`, `Profile`, `ActivityAttempt`, `codex.py`, `httpx`, `monitoring.py`, `seed_local_showcase_activity.py`?**
  _High betweenness centrality (0.134) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `Session` (e.g. with `smoke_demo_quest()` and `test_two_concurrent_saves_cannot_commit_the_same_activity_version()`) actually correct?**
  _`Session` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Should `chat-provider.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10483870967741936 - nodes in this community are weakly interconnected._