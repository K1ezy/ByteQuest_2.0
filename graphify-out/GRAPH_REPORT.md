# Graph Report - ByteQuest_2.0  (2026-11-22)

## Corpus Check
- 473 files · ~516,446 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 38 file(s) not represented in the graph (top: (none) 19, .bat 5, .example 5)

## Summary
- 4304 nodes · 14334 edges · 192 communities (167 shown, 25 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 1887 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d74fc618`
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
- activity-analysis.tsx
- drafts.py
- supabase.ts
- test_learning_flow_integration.py
- ActivityAttempt
- faculty_ml.py
- account-menu.tsx
- exams/[id]/page.test.tsx
- entities.py
- test_ml_exam_features.py
- ML evidence, operations and ML methodology: readiness plan
- profiles.py
- test_api_security.py
- sqlalchemy
- course_access.py
- 6. Prioritized improvement backlog
- LearningActivity
- quests_gamification.py
- chat_history.py
- supabase.ts
- next
- workshop-home.tsx
- 4. Backend changes
- onboarding/page.tsx
- chat.py
- security.py
- evaluation.tsx
- leaderboard.tsx
- api.ts
- insights.py
- train_compare.py
- ml_predictor/feature_engineering.py
- 4. Findings and implementation blueprint
- qa_mixed_exam_load.py
- compilerOptions
- Classroom pilot fixes and verification — 2026-10-28
- navigation.ts
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
- Judge0Client
- useChatController
- ByteQuest machine-learning improvement plan
- GeneratedChallengeSchema
- argparse
- ByteQuest 2.0 Classroom Pilot Operator Runbook
- _TooLarge
- predict_student_success
- ByteQuest local end-to-end flow
- accessibility-provider.tsx
- ByteQuest 2.0
- Judge0UnavailableError
- ByteQuest 2.0 — Full system review
- Phase 0 — ByteQuest instructor audit
- StorageError
- client.py
- ByteQuest 2.0 database review — 12 November 2026
- Session
- SYSTEM_STATUS_AND_RELEASE_PLAN.md
- qa_live_multi_role.py
- progress_recap
- ByteQuest 2.0: Master Architecture Plan & Execution Roadmap
- Phase 7 deployment readiness
- lib/types.ts
- arena.tsx
- test_ml_exam_features.py
- asyncio
- UpdatedAt
- workspace.ts
- Instructor activity analysis and class announcements
- Desktop and Mobile Pilot Flows (`pilot-v2.html`)
- workspace-provider.test.tsx
- ByteQuest Insights, part 4 of 4: administrators
- react
- prepare-monaco.mjs
- ML pipeline synthetic verification — 2026-10-25
- _enroll_chat_students
- preflight-host.sh
- Phase 6 shadow rollout implementation record
- httpx
- ML feature engineering and training
- monitoring.py
- ByteQuest Gemini tutor pilot evaluation
- profile_attention.py
- ByteQuest system status — 21 November 2026
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
- chat-shell.tsx
- ByteQuest 2.0 before and after
- smoke-vps.sh
- ByteQuest pilot remediation checklist
- preflight-vps.sh
- flow
- ByteQuest 2.0: close the manuscript gaps, tidy the structure, then review and rate the system
- ByteQuest 2.0 system critique — 21 November 2026
- Judge0 Hyper-V Ubuntu boot incident and recovery
- ByteQuest manuscript and system alignment checklist
- upload_my_avatar
- ByteQuest 2.0 live deployment stack
- home-redirect.tsx
- ML features and prediction unit: manuscript vs. code
- ByteQuest KVM 2 live pilot
- student-signup.ts
- ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash
- ByteQuest 2.0: implementation guide and DeepSeek V4.1 Flash prompt
- FastAPI
- settings_service.py
- Local API security contract
- run_training_and_comparison
- main.py
- ByteQuest UI/UX harmonization: slices 1–3 and ML slice planning
- ProfileResponse
- numpy
- ml/types.ts
- chat-provider.test.tsx
- SupabaseAvatarStorage
- claim_exam
- Prioritized defects
- pilot.py
- _sanitized_report
- 5. Slices
- Wireframes
- Judge0CircuitOpenError
- StatStrip
- Corrected Lesson to Student Progress Verification
- line-chart.tsx
- test_sandbox_internal_error_is_unavailability_not_a_student_failure
- ByteQuest Insights, part 1 of 4: shared foundation
- image.ts
- Make ByteQuest fit every phone and tablet
- ByteQuest Insights, part 2 of 4: students
- Judge0 Hyper-V Ubuntu VM: troubleshooting handoff
- Milestones 1A–1C Status and Verification Log
- update_my_profile
- test-recovery.mjs
- reviews.py
- Settings
- validate_tutor_citations
- Phase 7 backend image build verification
- Analytics
- Phase 7 readiness hardening
- test_every_public_timestamp_column_is_aware
- Course data model and grade integrity
- _fit_baselines

## God Nodes (most connected - your core abstractions)
1. `Session` - 353 edges
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
- `Suggested API contract` --references--> `_serialize_challenge()`  [INFERRED]
  docs/CHATBOT_IMPLEMENTATION_PLAN_FOR_DEEPSEEK.md → backend/app/api/rag_instructor.py

## Import Cycles
- None detected.

## Communities (192 total, 25 thin omitted)

### Community 0 - "ui.tsx"
Cohesion: 0.05
Nodes (114): Design system and data flow, Course health on System Overview, Frontend, Stack and layout, Medium, 5.1 Shared library and components, AdminAccounts(), confirmDeactivate() (+106 more)

### Community 1 - "ByteQuest 2.0: instructor activity analysis and class announcements"
Cohesion: 0.15
Nodes (12): Backend, ByteQuest 2.0: instructor activity analysis and class announcements, Database, Double-check before you report, Final report, Frontend, Hard rules, Part 1: Activity analysis (+4 more)

### Community 2 - "Session"
Cohesion: 0.10
Nodes (36): _admin_material_items(), admin_retry_material(), admin_upload_material(), monitoring(), retry_job(), _material_for_user(), archive_material(), create_material() (+28 more)

### Community 3 - "getErrorMessage"
Cohesion: 0.05
Nodes (51): CHOICE_LABEL, ResearchConsentSettingsPage(), choose(), ExamsPage(), ExamInfo, ExamPage(), handleRunSample(), handleStartExam() (+43 more)

### Community 4 - "workshops.py"
Cohesion: 0.10
Nodes (65): exam_catalog(), _activity_links(), add_workshop_activities(), _announcement_for_update(), AnnouncementView, archive_workshop(), can_manage(), create_workshop() (+57 more)

### Community 5 - "chat-workspace.tsx"
Cohesion: 0.18
Nodes (16): ChatPage(), useChat(), openConversation(), startChat(), updateHistory(), activityFromPath(), ChatDialog(), ChatSettings() (+8 more)

### Community 6 - "gamification-insights.tsx"
Cohesion: 0.19
Nodes (12): SMALL_SAMPLE, EngagementChart(), CategoryCount, GamificationInsightsData, GamificationInsightsView(), percent(), RecallStage, RecoveryTable() (+4 more)

### Community 7 - "test_faculty_admin.py"
Cohesion: 0.06
Nodes (60): AuditEvent, CourseMember, GradingWorkerHeartbeat, MLPrediction, PlatformSetting, ResearchConsent, PredictionResult, has_required_prediction_history() (+52 more)

### Community 8 - "activities/[id]/page.tsx"
Cohesion: 0.04
Nodes (84): Step A checkpoint and caller verification, ActivityEditor(), confirmPublish(), createVersion(), diffPayload(), runVerification(), save(), saveSchedule() (+76 more)

### Community 9 - "start-bytequest.ps1"
Cohesion: 0.07
Nodes (44): ConvertTo-EncodedPowerShellCommand(), ConvertTo-PowerShellLiteral(), Get-BackendFingerprint(), Get-DockerDesktopFile(), Get-FrontendFingerprint(), Get-Judge0VmIPv4(), Get-Judge0VmIPv4FromNeighbor(), Get-ListenerPidMap() (+36 more)

### Community 10 - "activity-analysis.tsx"
Cohesion: 0.15
Nodes (22): Already in place: extend, do not rebuild, Already in place: extend, do not rebuild, Shared insight widgets, Verification and rollout, Exam class summary, Already in place: extend, do not rebuild, Page(), MeasureDefinitions() (+14 more)

### Community 11 - "drafts.py"
Cohesion: 0.07
Nodes (50): ActivityCreate, ActivityUpdate, create_activity(), create_activity_version(), get_activity(), _grading_fields(), preview_activity(), publish_activity() (+42 more)

### Community 12 - "supabase.ts"
Cohesion: 0.15
Nodes (22): Interrupted Exam Autosave & Browser Recovery (Checklist Item #3), Attempt, AttemptResult, AttemptResultItem, ExamAnswers, ExamItem, ExamSyncBannerState, formatClockTime() (+14 more)

### Community 13 - "test_learning_flow_integration.py"
Cohesion: 0.07
Nodes (66): SubmissionJob, claim(), recover_stale_submission_jobs(), new_session(), _grade_queued_exam(), _letters(), _quiz(), _ranked_student() (+58 more)

### Community 14 - "ActivityAttempt"
Cohesion: 0.11
Nodes (16): dashboard(), activity_accepts_submissions_clause(), activity_has_opened(), activity_is_closed(), _as_utc(), guard_solution_reopen(), learner_visible_attempt_clause(), student_activity_clause() (+8 more)

### Community 15 - "faculty_ml.py"
Cohesion: 0.11
Nodes (22): course_health(), _accuracy(), _course_activities(), dashboard(), evaluation(), _faculty(), forecast_readiness(), _period_cutoff() (+14 more)

### Community 16 - "account-menu.tsx"
Cohesion: 0.25
Nodes (9): 5.2 Faculty routes, 5.3 Administrator routes, 5.4 Navigation and shell integration, 5. Frontend changes, AccessibilityPage(), AccessibilityPreferenceKey, ACCESSIBILITY_SETTINGS, AccessibilitySettingDefinition (+1 more)

### Community 17 - "exams/[id]/page.test.tsx"
Cohesion: 0.25
Nodes (5): answerSaves(), Call, mocks, savedBodies(), seedUnsyncedSnapshot()

### Community 18 - "entities.py"
Cohesion: 0.06
Nodes (16): CodeSubmissionRequest, run_code_submission(), _shadow_scoring_ready(), deliver_one(), _grade_item(), award_badges(), grant_xp(), attempt_quality() (+8 more)

### Community 19 - "test_ml_exam_features.py"
Cohesion: 0.20
Nodes (9): _check_columns(), _encodes_account_id(), generate_synthetic_thesis_dataset(), prepare_ml_dataset(), _require_pseudonymous(), _sort_attempts(), _strip_text(), _validate_hint_frame() (+1 more)

### Community 20 - "ML evidence, operations and ML methodology: readiness plan"
Cohesion: 0.08
Nodes (25): 1. Where things stand, 2. Decisions you need to make, 3. Workstream A: operations and reliability, 4. Workstream B: ML evidence and readiness, 5. Workstream C: ML methodology (all supplementary), 6. Order and timeline, 7. Which skill flow to use for each piece, 8. Done means (+17 more)

### Community 21 - "profiles.py"
Cohesion: 0.16
Nodes (21): ActivityDay, _admin_analytics(), AdminAnalytics, AnalyticsResponse, AuditEntry, BadgeEntry, complete_staff_setup(), _enum_value() (+13 more)

### Community 22 - "test_api_security.py"
Cohesion: 0.07
Nodes (27): compare_submission(), ComparedAttempt, get_job(), _retry_failed_job(), retry_job(), SubmissionComparison, submit_job(), SubmitJob (+19 more)

### Community 23 - "sqlalchemy"
Cohesion: 0.08
Nodes (18): public_handle(), _starter_username(), _encoded_id(), is_starter_username(), starter_username(), pytest_sessionstart(), _export_queries(), test_documented_exports_require_latest_current_consent() (+10 more)

### Community 24 - "course_access.py"
Cohesion: 0.12
Nodes (20): student_announcements(), get_instructor_workspace(), _serialize_document(), active_membership_course_ids(), courses_for_user(), default_instructor_course_id(), ensure_owned_or_admin(), has_course_role() (+12 more)

### Community 25 - "6. Prioritized improvement backlog"
Cohesion: 0.08
Nodes (26): 1. Where the project stands, 2. Progress percentages and how they were calculated, 3. What exists today and where evidence stops, 4. Verification evidence and its limits, 5. Six gates before a live classroom pilot, 6. Prioritized improvement backlog, 7. Execution order, AI, LLM, RAG and provider handling (+18 more)

### Community 26 - "LearningActivity"
Cohesion: 0.08
Nodes (51): _load_quiz_questions(), _gemini_unavailable_http_exception(), generate_ai_coding_challenge(), generate_ai_conceptual_quiz(), _generation_payload(), _get_owned_activity(), _get_owned_document(), _may_manage_activity() (+43 more)

### Community 27 - "quests_gamification.py"
Cohesion: 0.08
Nodes (21): get_gamification_leaderboard(), get_student_progress(), LeaderboardEntry, LeaderboardResponse, LeaderboardStanding, list_published_quests(), NextStepRecommendation, ProgressAttempt (+13 more)

### Community 28 - "chat_history.py"
Cohesion: 0.13
Nodes (29): ChatMessageRequest, ChatMessageResponse, ChatSource, ChatTurn, _check_revision(), Conversation, ConversationPage, create_conversation() (+21 more)

### Community 29 - "supabase.ts"
Cohesion: 0.17
Nodes (17): 8 Required Acceptance Checks, Durability Boundary & Concurrency Guarantees, Exam Autosave & Conflict-Safe Recovery Verification, finishPasswordSetup(), usePasswordReset(), requestResetLink(), updatePassword(), clearSharedComputerData() (+9 more)

### Community 30 - "next"
Cohesion: 0.10
Nodes (44): Already in place: extend, do not rebuild, One kit: course-ui, CourseInsights(), Insights(), AttentionRow(), Dashboard(), loadQueue(), Page() (+36 more)

### Community 31 - "workshop-home.tsx"
Cohesion: 0.06
Nodes (65): WorkshopDetailLayout(), WorkshopInvitePage(), WorkshopsPage(), useShellProfile(), ActivityDialog, ActivityEditor(), save(), ActivityLink (+57 more)

### Community 32 - "4. Backend changes"
Cohesion: 0.50
Nodes (4): 4.1 Migration, 4.4 Faculty API (`backend/app/api/faculty.py`, prefix `/api/v1/faculty`), 4. Backend changes, confirm()

### Community 33 - "onboarding/page.tsx"
Cohesion: 0.19
Nodes (18): AuthMode, OnboardingContent(), authenticate(), changeAuthMode(), checkExistingAuth(), continueToAgreement(), OnboardingPage(), PasswordInput() (+10 more)

### Community 34 - "chat.py"
Cohesion: 0.09
Nodes (21): _chat_activity(), ChatLimits, ChatStatus, _course_passages(), create_chat_message(), generate_chat_reply(), _generate_chat_reply(), get_chat_status() (+13 more)

### Community 35 - "security.py"
Cohesion: 0.05
Nodes (30): get_current_user_payload(), TokenPayload, auth(), verify(), claims(), test_es256_verifies_locally_off_the_event_loop(), test_failed_jwks_verification_falls_back(), test_non_asymmetric_algorithms_never_use_jwks() (+22 more)

### Community 36 - "evaluation.tsx"
Cohesion: 0.21
Nodes (15): AdequacyNotice(), ComparisonTable(), ConfusionMatrix(), CurveChart(), Intervals, Methodology(), metric(), METRIC_COLUMNS (+7 more)

### Community 37 - "leaderboard.tsx"
Cohesion: 0.20
Nodes (12): CHOOSE_HANDLE_HREF, Leaderboard(), LeaderboardData, LeaderboardEntry, LeaderboardStanding, LearnerName(), MEDAL, Row() (+4 more)

### Community 38 - "api.ts"
Cohesion: 0.04
Nodes (69): activityHref(), closesIn(), Dashboard, DashboardContent(), DashboardPage(), kindLabel(), localTime(), Progress (+61 more)

### Community 39 - "insights.py"
Cohesion: 0.07
Nodes (32): get_codex(), ChallengeRecovery, codex_summary(), CodexCategory, CodexRecovery, CodexResponse, CodexSummary, practice_errors() (+24 more)

### Community 40 - "train_compare.py"
Cohesion: 0.11
Nodes (3): _as_binary_label(), _format_metric(), main()

### Community 41 - "ml_predictor/feature_engineering.py"
Cohesion: 0.22
Nodes (7): _as_bool(), _before(), _enum_value(), extract_features_from_dataframe(), _frame(), _mean(), _rate()

### Community 42 - "4. Findings and implementation blueprint"
Cohesion: 0.08
Nodes (24): 1. Where ByteQuest stands, 2. How the system fits together, 3. Work order, 4. Findings and implementation blueprint, 5. Local completion checklist, 6. Which existing document answers which question, BQ-01 — Award completion XP at the first eligible event, BQ-02 — Give submission jobs one owner per claim (+16 more)

### Community 43 - "qa_mixed_exam_load.py"
Cohesion: 0.14
Nodes (14): require_local(), summary(), verify(), main(), measure_exam_samples(), prepare_exam(), report_exam_grading(), run() (+6 more)

### Community 44 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 45 - "Classroom pilot fixes and verification — 2026-10-28"
Cohesion: 0.33
Nodes (5): Changes checked locally, Classroom pilot fixes and verification — 2026-10-28, Evidence, Other Remaining Pilot Verification Gates, Verification Status & Remaining Gates

### Community 46 - "navigation.ts"
Cohesion: 0.12
Nodes (20): WorkshopsLayout(), AppShell(), isActiveDestination(), useScrollResetOnRouteChange(), CourseNavigationLinks(), CourseSwitcher(), InstructorCourseShell(), InstructorShell() (+12 more)

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
Cohesion: 0.12
Nodes (40): admin_activities(), _admin_activity_item(), admin_materials(), admin_user(), list_course_operations(), list_activity_workspace(), _course_brief(), list_drafts() (+32 more)

### Community 51 - "AppTooltips"
Cohesion: 0.21
Nodes (20): AppTooltips(), clearTimers(), findTarget(), hide(), onClick(), onContextMenu(), onFocusIn(), onFocusOut() (+12 more)

### Community 52 - "qa-responsive.mjs"
Cohesion: 0.31
Nodes (11): assertRail(), capture(), checkDocking(), examViewports(), failures, fixture, inspectProfile(), measure() (+3 more)

### Community 53 - "reveals_solution"
Cohesion: 0.22
Nodes (13): _contains_tokens(), _ngrams(), reveals_solution(), _single_line_repair(), _tokens(), test_challenge_chat_rejects_alternate_code_even_without_reference_overlap(), test_exact_repair_to_failed_sample_is_withheld_even_if_it_is_in_the_starter(), test_full_solution_is_blocked_even_with_renamed_variables() (+5 more)

### Community 54 - "ByteQuest UI and UX harmonization plan"
Cohesion: 0.17
Nodes (12): 1. What the review found, 2. How work moves through ByteQuest, 3. Student journey, 4. Instructor journey, 5. Administrator journey, 6. Shared visual and interaction system, 7. Contextual help and tooltips, 8. Delivery order (+4 more)

### Community 55 - "chat-provider.tsx"
Cohesion: 0.11
Nodes (28): chatHistory, ChatMode, ConversationPage, ConversationSummary, SavedReply, SavedTurn, Transcript, TurnStatus (+20 more)

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
Cohesion: 0.07
Nodes (16): get_settings(), ErrorExplanationSchema, explain_code_error(), _client_for_key(), GeminiConfigurationError, get_gemini_client(), _chat_failure(), GeminiLLMService (+8 more)

### Community 60 - "ByteQuest Insights, part 3 of 4: instructors"
Cohesion: 0.20
Nodes (9): Activity health in the Activities list, ByteQuest Insights, part 3 of 4: instructors, Goal, Handheld rules, Inactive 7+ days, Model evaluation, Out of scope, Renamed figures (+1 more)

### Community 61 - "exams.py"
Cohesion: 0.11
Nodes (44): assigned(), assigned_exam_numbers(), _assigned_exams_with_state(), create_exam(), DraftExam, DraftItem, _exam_access(), exam_sample_run() (+36 more)

### Community 62 - "Judge0Client"
Cohesion: 0.24
Nodes (4): Judge0Client, TestCaseInput, main(), verify_compilers()

### Community 63 - "useChatController"
Cohesion: 0.20
Nodes (17): RFC-4122, Hard rules, turnMessages(), mapChatError(), useChatController(), applySavedReply(), canSend(), checkReply() (+9 more)

### Community 64 - "ByteQuest machine-learning improvement plan"
Cohesion: 0.14
Nodes (14): 1. Goal, 2. Where things stand, 3. Decisions, 4.1 Prediction unit and label, 4.2 History, 4.3 The ten features, in this order, 4.4 Live shadow scoring, 4.5 Reporting (+6 more)

### Community 65 - "GeneratedChallengeSchema"
Cohesion: 0.22
Nodes (5): GeneratedChallengeSchema, GeneratedQuizOptionSchema, GeneratedQuizQuestionSchema, GeneratedQuizSchema, TestCaseSchema

### Community 66 - "argparse"
Cohesion: 0.38
Nodes (3): destroy(), main(), main()

### Community 67 - "ByteQuest 2.0 Classroom Pilot Operator Runbook"
Cohesion: 0.17
Nodes (12): 1. Hard Safety Gates (Enforced by Configuration), 2. Lab Station & Shared-Computer Protocol, 3. Network Resilience & Live Draft Sync, 4. Timed Exam Operations, 5. Verification Commands, 6. Incident Troubleshooting, ByteQuest 2.0 Classroom Pilot Operator Runbook, Classroom Wi-Fi Reconnect Banner (+4 more)

### Community 68 - "_TooLarge"
Cohesion: 0.18
Nodes (8): RequestSizeLimitMiddleware, limited_receive(), tracked_send(), _TooLarge, test_streamed_body_without_content_length_is_limited(), read_body(), receive(), send()

### Community 69 - "predict_student_success"
Cohesion: 0.16
Nodes (7): _forecast(), _positive_probability(), predict_student_success(), classify_success(), recommended_action(), test_faculty_forecast_uses_the_recorded_winner_and_hides_legacy_probability(), Part 2: Pilot-data changes (must land before any student data is collected)

### Community 70 - "ByteQuest local end-to-end flow"
Cohesion: 0.14
Nodes (14): Account-synced progression check, Before deployment, ByteQuest local end-to-end flow, Instructor account, Local Quest Map demos, Manual startup, One-click Windows startup, Open ByteQuest on a phone over ZeroTier (+6 more)

### Community 71 - "accessibility-provider.tsx"
Cohesion: 0.10
Nodes (27): Repo map: exact files to inspect and change, byteBounce, metadata, RootLayout(), viewport, ACCESSIBILITY_STORAGE_KEYS, AccessibilityContext, AccessibilityContextValue (+19 more)

### Community 72 - "ByteQuest 2.0"
Cohesion: 0.22
Nodes (9): Architecture, ByteQuest 2.0, Configuration and security, Documentation, Repository layout, Stack and deployment, Start locally on Windows, Test and verify (+1 more)

### Community 73 - "Judge0UnavailableError"
Cohesion: 0.18
Nodes (4): Judge0UnavailableError, metric(), sandbox_unavailable(), unavailable()

### Community 74 - "ByteQuest 2.0 — Full system review"
Cohesion: 0.07
Nodes (23): ByteQuest 2.0 engineering and UX review, Findings, Performance evidence, Recommended sequence, Verification and limits, Already strong (checked, not assumed), ByteQuest 2.0 — Full system review, Evidence (+15 more)

### Community 75 - "Phase 0 — ByteQuest instructor audit"
Cohesion: 0.22
Nodes (8): Current FastAPI inventory, Current screens and feature coverage, Decisions for Phase 1, Desktop scorecard, Findings, Phase 0 — ByteQuest instructor audit, Supabase data and authorization, Verification

### Community 76 - "StorageError"
Cohesion: 0.25
Nodes (5): StorageError, SupabasePDFStorage, test_accepts_absolute_signed_url_from_configured_origin(), test_rejects_untrusted_signed_url(), test_resolves_supabase_relative_signed_path()

### Community 77 - "client.py"
Cohesion: 0.25
Nodes (7): _b64_decode(), _b64_encode(), BatchEvaluationSummary, classify_judge0_status(), _parse_completed_result(), SingleTestResult, test_program_crash_is_still_graded_as_a_runtime_error()

### Community 78 - "ByteQuest 2.0 database review — 12 November 2026"
Cohesion: 0.18
Nodes (11): _id(), B. Findings, ByteQuest 2.0 database review — 12 November 2026, C. Migration plan, D. Index recommendations, E. Organisation and documentation, G. Explicitly out of scope, Must fix (+3 more)

### Community 79 - "Session"
Cohesion: 0.08
Nodes (52): account_emails_for_email(), account_impact(), _account_needs_action(), AccountCreate, activity_impact(), _admin_activity(), admin_archive_activity(), admin_archive_material() (+44 more)

### Community 80 - "SYSTEM_STATUS_AND_RELEASE_PLAN.md"
Cohesion: 0.18
Nodes (4): ByteQuest repository guidance, Current system status, graphify, This is NOT the Next.js you know

### Community 81 - "qa_live_multi_role.py"
Cohesion: 0.17
Nodes (15): api_base(), cleanup(), create_accounts(), instructor_builds_course(), letters(), main(), password_token(), print_report() (+7 more)

### Community 82 - "progress_recap"
Cohesion: 0.21
Nodes (7): get_progress_recap(), _day(), _manila(), _practice_days(), progress_recap(), ProgressRecap, RecapMetric

### Community 83 - "ByteQuest 2.0: Master Architecture Plan & Execution Roadmap"
Cohesion: 0.08
Nodes (25): 1. Project Tracking & Thesis Collaboration Strategy, 2. Core Architectural Rules (Non-Negotiable), 3. Repository Directory Structure, 4. Course-Sequence & Curriculum Alignment, 5. Database Schema Blueprint (Supabase PostgreSQL + pgvector), 6. 7-Phase Development Plan, 7. Thesis Objectives Mapping (Chapter 1 Alignment), 8. Development Environment & Quickstart Commands (+17 more)

### Community 84 - "Phase 7 deployment readiness"
Cohesion: 0.18
Nodes (11): Decisions required before production setup, Deployment order after the decisions are made, Evidence still needed, Local Judge0 runtime smoke check (2026-10-26), Notes on local verification, Phase 7 deployment readiness, Prepared in the repository, Production settings and network boundaries (+3 more)

### Community 85 - "lib/types.ts"
Cohesion: 0.05
Nodes (55): ExamCard, ExamsPage(), localTime(), QuestsPage(), QuestsPageContent(), changeView(), handleKeyDown(), QuestStatusFilter (+47 more)

### Community 86 - "arena.tsx"
Cohesion: 0.05
Nodes (55): ArenaPage(), Arena(), checkStatus(), confirmResetCode(), endSegment(), handleCodeChange(), handleCopyOutput(), load() (+47 more)

### Community 87 - "test_ml_exam_features.py"
Cohesion: 0.20
Nodes (8): _attempt(), test_adequacy_flags_a_small_test_partition(), test_bootstrap_intervals_are_reproducible_and_resample_learners(), test_hint_exports_reject_identifying_columns(), test_rows_are_first_submissions_on_challenges_with_strictly_prior_history(), test_training_rejects_ids_that_encode_an_account(), _adequacy(), _bootstrap_intervals()

### Community 88 - "asyncio"
Cohesion: 0.13
Nodes (9): extract_chunks_from_pdf(), extract_pdf_chunks(), cleanup(), main(), one_student(), require_local(), run_load(), held_grade() (+1 more)

### Community 89 - "UpdatedAt"
Cohesion: 0.19
Nodes (8): AboutForecasts(), ModelEvaluation(), mocks, phaseB, report, CourseWorkspace(), Page(), UpdatedAt()

### Community 90 - "workspace.ts"
Cohesion: 0.03
Nodes (114): 4.5 Administrator API (`backend/app/api/admin.py`, prefix `/api/v1/admin`), doConfirm(), doRemove(), save(), submit(), retry(), openStudent(), AccountPanel() (+106 more)

### Community 91 - "Instructor activity analysis and class announcements"
Cohesion: 0.33
Nodes (6): Activity analysis, Browser verification, Class announcements, Instructor activity analysis and class announcements, Remaining verification, Verification

### Community 92 - "Desktop and Mobile Pilot Flows (`pilot-v2.html`)"
Cohesion: 0.22
Nodes (8): 1. Offline / Network Reconnect Banner, 2. Pending / Queued Grading State, 3. Research Consent & Withdrawal State (Disabled Collection Notice), 4. Active Exam Priority Banner & Timed Attempt Lock, ByteQuest web app wireframes, Coverage, Desktop and Mobile Pilot Flows (`pilot-v2.html`), Review checklist

### Community 93 - "workspace-provider.test.tsx"
Cohesion: 0.20
Nodes (12): Already in place: extend, do not rebuild, choose(), DockableNavigation(), finish(), MenuPositionSetting(), readMenuSide(), setMenuSide(), Side (+4 more)

### Community 94 - "ByteQuest Insights, part 4 of 4: administrators"
Cohesion: 0.33
Nodes (5): ByteQuest Insights, part 4 of 4: administrators, Goal, Handheld rules, Out of scope, Verification and rollout

### Community 95 - "react"
Cohesion: 0.07
Nodes (32): nextConfig, AdminLayout(), FacultyLayout(), WorkspaceLayout(), AccountMenu(), subscribeToSheetBreakpoint(), usesAccountSheet(), AdminSectionNav() (+24 more)

### Community 96 - "prepare-monaco.mjs"
Cohesion: 0.17
Nodes (6): frontend, marker, packageDir, source, target, fixture

### Community 97 - "ML pipeline synthetic verification — 2026-10-25"
Cohesion: 0.29
Nodes (6): Artifact and activation checks, Execution, ML pipeline synthetic verification — 2026-10-25, Observed grouped metrics, Remaining Phase 5 work, Scope

### Community 98 - "_enroll_chat_students"
Cohesion: 0.07
Nodes (33): DocumentChunk, GeminiAPIError, test_chat_requires_active_enrollment_only_for_students(), _chat_payload(), _course_pdf(), _enroll_chat_students(), test_ai_failures_leave_drafts_and_hint_allowance_intact(), get_client() (+25 more)

### Community 99 - "preflight-host.sh"
Cohesion: 0.38
Nodes (6): fail(), MIN_MEMORY_BYTES, MIN_ROOT_FREE_BYTES, MIN_SWAP_BYTES, pass(), preflight-host.sh script

### Community 100 - "Phase 6 shadow rollout implementation record"
Cohesion: 0.33
Nodes (5): Implemented, Phase 6 shadow rollout implementation record, Phase 7 handoff, Safety and current state, Verification still required

### Community 101 - "httpx"
Cohesion: 0.14
Nodes (15): _evaluate(), _failed_sample(), main(), _request(), TutorCase, challenge_specs(), main(), student() (+7 more)

### Community 102 - "ML feature engineering and training"
Cohesion: 0.40
Nodes (5): Comparison protocol, Export an attempt dataset, ML feature engineering and training, Prepare an Ubuntu VPS, Safe pipeline setup

### Community 103 - "monitoring.py"
Cohesion: 0.13
Nodes (20): _check_judge0(), _grading_worker_health(), _minutes(), overall_health(), _prediction_health(), _rag_health(), _runner_health(), runner_status() (+12 more)

### Community 104 - "ByteQuest Gemini tutor pilot evaluation"
Cohesion: 0.50
Nodes (4): ByteQuest Gemini tutor pilot evaluation, Reply quality, Token use and estimated Gemini cost, What was tested

### Community 105 - "profile_attention.py"
Cohesion: 0.23
Nodes (5): account_needs_action(), instructor_course_ids(), membership_rows(), personal_audit(), role_value()

### Community 106 - "ByteQuest system status — 21 November 2026"
Cohesion: 0.18
Nodes (10): ByteQuest system status — 21 November 2026, Checkout, runtime and release, Machine learning — status on 11/21/26, Verification and remaining checks, What changed, ByteQuest navigation, Compatibility and new destinations, Existing routes (+2 more)

### Community 107 - "Workshops: Create, Join and the Workshop page"
Cohesion: 0.20
Nodes (10): 10. Decisions to critique, 1. What exists today, 2. Screen map, 3. Rules, 5. API changes (all under `/api/v1/workshops`), 6. Frontend structure, 7. Delivery slices (each ships with tests), 8. Out of scope for v1 (+2 more)

### Community 108 - "test_pilot_regressions.py"
Cohesion: 0.07
Nodes (51): ActivityAttempt, Badge, ChallengeHint, HintUse, StudentBadge, evaluate_and_award_badges(), _qualifies(), _requirement_for() (+43 more)

### Community 110 - "Python demo journey — 2026-10-28"
Cohesion: 0.40
Nodes (4): Browser walkthrough, Implemented, Local evidence, Python demo journey — 2026-10-28

### Community 111 - "PHASE7_DEPLOYMENT_READINESS.md"
Cohesion: 0.05
Nodes (30): Current routes and behavior, Phase 2 API and rollout list, Reference tokens and icons, Screenshot comparisons, Step C — Instructor visual verification, Test target checks, Grant access to one account, Production instructor access (+22 more)

### Community 112 - "ByteQuest 2.0 system status and weekly change log"
Cohesion: 0.29
Nodes (7): ByteQuest 2.0 system status and weekly change log, Current feature and deployment map, How close is ByteQuest to finished?, Latest local verification, UI and UX review, What changed this week, Work left before the next milestone

### Community 113 - "retrieval.py"
Cohesion: 0.11
Nodes (15): _retrieve_document_sources(), embed_one(), GeminiEmbeddingService, generate_embedding(), activity_document_ids(), _chat_excerpt(), course_document_ids(), is_query_vector() (+7 more)

### Community 114 - "Local API security verification — 2026-10-28"
Cohesion: 0.50
Nodes (3): 30-student local load, Checks, Local API security verification — 2026-10-28

### Community 115 - "Phase 7 database pool budget hardening"
Cohesion: 0.50
Nodes (3): Change, Checks performed, Phase 7 database pool budget hardening

### Community 116 - "test_profile_analytics.py"
Cohesion: 0.17
Nodes (11): workspace(), new_session(), override_db(), _add_audit(), _analytics(), test_each_role_receives_only_its_own_branch(), test_existing_admin_fields_remain_compatible(), test_existing_instructor_fields_remain_compatible() (+3 more)

### Community 117 - "chat-shell.tsx"
Cohesion: 0.29
Nodes (7): ChatConversation, ChatIcon(), ChatPanel(), ChatShell(), subscribeToBreakpoint(), useChatViewport(), useCompactChatLayout()

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

### Community 124 - "ByteQuest 2.0: close the manuscript gaps, tidy the structure, then review and rate the system"
Cohesion: 0.22
Nodes (8): ByteQuest 2.0: close the manuscript gaps, tidy the structure, then review and rate the system, Do not, Final report, Part 1: AI tutoring (highest priority), Part 3: Code structure (targeted; behaviour must stay identical), Part 4: Review and targeted fixes, Stack and layout, Verification

### Community 126 - "ByteQuest 2.0 system critique — 21 November 2026"
Cohesion: 0.18
Nodes (11): ByteQuest system review: 22 November 2026, Findings, High, How to run this (skill flows), Low, Medium, Recommended order, Scorecard (+3 more)

### Community 127 - "Judge0 Hyper-V Ubuntu boot incident and recovery"
Cohesion: 0.13
Nodes (15): 1. Start and open the known-good VM, 2. Confirm the Judge0 services and volume inside Ubuntu, 3. Get the current guest IP and check the port, 4. Update ByteQuest if the VM IP changed, 5. Restart FastAPI and leave it running, 6. Verify service integration without exposing secrets, Current verified state, Disk and data safety (+7 more)

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

### Community 137 - "student-signup.ts"
Cohesion: 0.30
Nodes (10): checkSchoolIdAvailability(), checkUsernameAvailability(), isStudentSchoolId(), checkStudentSignup(), Registration, SCHOOL_ID_TAKEN_ERROR, signUpStudent(), mocks (+2 more)

### Community 138 - "ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash"
Cohesion: 0.20
Nodes (9): Behavior and scope of the assistant, ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash, Placement and responsive layout, Product decision, Quality gates and acceptance tests, Ready-to-paste DeepSeek V4.1 Flash implementation prompt, State and error rules, Suggested API contract (+1 more)

### Community 139 - "ByteQuest 2.0: implementation guide and DeepSeek V4.1 Flash prompt"
Cohesion: 0.40
Nodes (4): 3. Recommended implementation order, 4. Ready-to-paste prompt for DeepSeek V4.1 Flash, 5. Manual acceptance checklist, ByteQuest 2.0: implementation guide and DeepSeek V4.1 Flash prompt

### Community 140 - "FastAPI"
Cohesion: 0.13
Nodes (12): AnnouncementCreate, AnnouncementExpiry, AnnouncementPatch, _audit_change(), _authorize_announcement(), create_announcement(), delete_announcement(), list_announcements() (+4 more)

### Community 141 - "settings_service.py"
Cohesion: 0.43
Nodes (5): _coerce(), _range_error(), serialize_setting(), _typed_value(), update_setting()

### Community 142 - "Local API security contract"
Cohesion: 0.40
Nodes (5): Access matrix, Local API security contract, Local verification and future deployment, Quotas and validation, School-issued IDs for student sign-up

### Community 143 - "run_training_and_comparison"
Cohesion: 0.30
Nodes (6): _atomic_joblib_dump(), _atomic_json_write(), _atomic_write(), run_training_and_comparison(), _select_winner(), _sha256_file()

### Community 146 - "main.py"
Cohesion: 0.13
Nodes (11): api_health_check(), health_check(), lifespan(), readiness_check(), load_ml_models(), ModelArtifactError, ModelArtifactsUnavailable, ModelBundle (+3 more)

### Community 148 - "ByteQuest UI/UX harmonization: slices 1–3 and ML slice planning"
Cohesion: 0.15
Nodes (12): Bugs found and fixed, ByteQuest UI/UX harmonization: slices 1–3 and ML slice planning, Checkpoint, Decisions made today, How it was checked, Next steps, Not checked, Slice 1: shared foundation and help (+4 more)

### Community 149 - "ProfileResponse"
Cohesion: 0.18
Nodes (6): complete_student_onboarding(), delete_my_avatar(), get_my_profile(), OnboardingRequest, ProfileResponse, _require_student()

### Community 150 - "numpy"
Cohesion: 0.21
Nodes (8): _build_pipeline(), _evaluate_partition(), _finite_or_none(), _fit_tuned_model(), _point_metrics(), _probability_for_success(), split_students_disjoint(), _validate_group_splits()

### Community 151 - "ml/types.ts"
Cohesion: 0.11
Nodes (26): Student Progress: the only roster and learner drawer, CourseRef, Curve, Dashboard, Detail, Forecast, FORECAST_REASONS, HistoryEvent (+18 more)

### Community 152 - "chat-provider.test.tsx"
Cohesion: 0.18
Nodes (7): auth, bodies(), openChat(), ready, routeApi(), savedChat, CHAT_STORAGE_KEY

### Community 154 - "claim_exam"
Cohesion: 0.31
Nodes (9): claim_exam(), ExamGradingClaim, _grade_claimed_exam(), grade_exam(), _lock_exam_claim(), main(), process(), _write_heartbeat() (+1 more)

### Community 156 - "Prioritized defects"
Cohesion: 0.12
Nodes (17): 10. [P3] Hidden-case aggregate summary incorrectly reports zero, 2. [P1] Verification can certify content that Judge0 never checked, 3. [P1] Unreleased exam successes can affect visible rewards, 4. [P1] The current release build exits with a dependency security warning, 5. [P2] Challenges with no visible sample can be published, 6. [P2] The dashboard recommends a closed quest that cannot be submitted, 7. [P2] Completing one exam can hide another due exam on the dashboard, 8. [P2] A failed quiz is labeled completed (+9 more)

### Community 157 - "pilot.py"
Cohesion: 0.17
Nodes (22): challenge(), choose_consent(), close_challenge(), consent_status(), ConsentChoice, DraftPayload, _expired_hint_reservation(), get_draft() (+14 more)

### Community 158 - "_sanitized_report"
Cohesion: 0.22
Nodes (8): _partition_report(), _sanitized_report(), _scores_only(), test_offline_report_allowlist_drops_paths_and_training_internals(), 5. Work, Phase A: before pilot data collection (has a deadline), Phase B: Model evaluation page (no deadline), Phase C: after the pilot

### Community 159 - "5. Slices"
Cohesion: 0.12
Nodes (15): 1. Read these first, in this order, 3. Hard rules, 4. Decided behaviour (W1–W12, all accepted by the user), 5. Slices, 6. How to verify each slice, 7. Report after each slice, ChatGPT 6.2 prompt: finish the ByteQuest Workshop classroom (slices 1–8), Slice 1: data and API (start here) (+7 more)

### Community 160 - "Wireframes"
Cohesion: 0.22
Nodes (9): Activity editor, Analytics desktop, Analytics phone, Dashboard desktop, Dashboard phone, Learner drill-down, Other screen layouts, Submission review (+1 more)

### Community 162 - "StatStrip"
Cohesion: 0.22
Nodes (10): ByteQuest 2.0 system critique — 21 November 2026, Findings by severity, Implementation status (21 November 2026, same day), Low, Not verified in this review, Scorecard, Top 5 things to do next, Verdict (+2 more)

### Community 163 - "Corrected Lesson to Student Progress Verification"
Cohesion: 0.22
Nodes (6): Code and quality checks, Corrected Lesson to Student Progress Verification, Earlier student workflow verification (historical run), Environment and source, Follow-up and known boundaries, Instructor workflow

### Community 164 - "line-chart.tsx"
Cohesion: 0.31
Nodes (8): useAccessibility(), ChartProps, ChartRow, ChartSkeleton(), InsightLineChart(), Plot, Series, Plot()

### Community 165 - "test_sandbox_internal_error_is_unavailability_not_a_student_failure"
Cohesion: 0.28
Nodes (5): test_hidden_case_contributes_to_score_without_exposing_details(), language_ids(), poll_batch(), submit_batch(), test_sandbox_internal_error_is_unavailability_not_a_student_failure()

### Community 166 - "ByteQuest Insights, part 1 of 4: shared foundation"
Cohesion: 0.20
Nodes (9): ByteQuest Insights, part 1 of 4: shared foundation, Charts: two primitives, Goal, Handheld rules, Metric labels, Out of scope, Profile: one role tab, each figure once, Remove the duplicate Sequencer evaluation (+1 more)

### Community 167 - "image.ts"
Cohesion: 0.60
Nodes (4): canvasToBlob(), cropCompressImage(), CropCompressOptions, loadImage()

### Community 168 - "Make ByteQuest fit every phone and tablet"
Cohesion: 0.22
Nodes (9): Goal, Layout system, Make ByteQuest fit every phone and tablet, Menu docking: finish what exists, Out of scope, Screens, Side navigation on handheld screens: already built, Touch and input (+1 more)

### Community 169 - "ByteQuest Insights, part 2 of 4: students"
Cohesion: 0.22
Nodes (8): ByteQuest Insights, part 2 of 4: students, Goal, Handheld rules, One badge list, Out of scope, Score trend and breakdowns, Topic practice links, Verification and rollout

### Community 170 - "Judge0 Hyper-V Ubuntu VM: troubleshooting handoff"
Cohesion: 0.22
Nodes (9): Confirmed project and Judge0 setup, Current state, Direct-shell recovery method that worked, Historical recommendation written before the Install VM recovery, Judge0 Hyper-V Ubuntu VM: troubleshooting handoff, Known guest settings and identifiers, Sources, Timeline of important events and changes (+1 more)

### Community 171 - "Milestones 1A–1C Status and Verification Log"
Cohesion: 0.22
Nodes (9): Environment, Follow-up verification — 2026-10-25, Milestone 1A: Judge0 execution, Milestone 1B: Local Supabase schema and fixtures, Milestone 1C: Browser-to-database walkthrough — Complete, verified, Milestones 1A–1C Status and Verification Log, Official milestone disposition, Submission-flow corrections made (+1 more)

### Community 172 - "update_my_profile"
Cohesion: 0.25
Nodes (4): ProfileUpdateRequest, update_my_profile(), username_availability(), normalize_username()

### Community 173 - "test-recovery.mjs"
Cohesion: 0.29
Nodes (6): cleared, localMap, mockLocalStorage, mockSessionStorage, remaining, storageMap

### Community 174 - "reviews.py"
Cohesion: 0.08
Nodes (48): _ensure_student(), get_gamification_state(), get_mastery_map(), get_review(), get_reviews(), _locked_student(), _public_review(), _question_id() (+40 more)

### Community 176 - "validate_tutor_citations"
Cohesion: 0.33
Nodes (3): cited_sources(), validate_tutor_citations(), test_tutor_strips_unverified_markers_and_multi_page_citations()

### Community 177 - "Phase 7 backend image build verification"
Cohesion: 0.40
Nodes (4): Limits, Phase 7 backend image build verification, Recorded evidence, Work completed

### Community 178 - "Analytics"
Cohesion: 0.40
Nodes (5): Analytics, API and data performance, Chart library and motion, Filters and shared facts, Metric dictionary

### Community 179 - "Phase 7 readiness hardening"
Cohesion: 0.40
Nodes (5): Changes, Limits, Local runtime spot check — 2026-10-26, Phase 7 readiness hardening, Verification performed

### Community 190 - "Course data model and grade integrity"
Cohesion: 0.67
Nodes (3): Course data model and grade integrity, Migration and rollback, RLS and authorization

## Knowledge Gaps
- **18 isolated node(s):** `monaco-editor`, `react-is`, `@types/node`, `@types/react`, `@types/react-dom` (+13 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1421 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `4. Read these before writing any code` connect `test_pilot_regressions.py` to `ui.tsx`, `Session`, `workspace.ts`, `test_faculty_admin.py`, `flow`, `client.py`, `reviews.py`, `ActivityAttempt`, `test_learning_flow_integration.py`, `entities.py`, `profiles.py`, `LearningActivity`, `quests_gamification.py`?**
  _High betweenness centrality (0.177) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `Session` (e.g. with `smoke_demo_quest()` and `test_two_concurrent_saves_cannot_commit_the_same_activity_version()`) actually correct?**
  _`Session` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `monaco-editor`, `react-is`, `@types/node` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ui.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.053544061302681994 - nodes in this community are weakly interconnected._
- **Why does `LearningActivity` connect `LearningActivity` to `Session`, `workshops.py`, `test_faculty_admin.py`, `drafts.py`, `test_learning_flow_integration.py`, `ActivityAttempt`, `faculty_ml.py`, `entities.py`, `profiles.py`, `test_api_security.py`, `course_access.py`, `quests_gamification.py`, `pilot.py`, `chat.py`, `insights.py`, `reviews.py`, `performance.py`, `exams.py`, `predict_student_success`, `Session`, `_enroll_chat_students`, `httpx`, `monitoring.py`, `test_pilot_regressions.py`, `retrieval.py`, `test_profile_analytics.py`?**
  _High betweenness centrality (0.134) - this node is a cross-community bridge._
- **Are the 280 inferred relationships involving `Profile` (e.g. with `account_impact()` and `_account_needs_action()`) actually correct?**
  _`Profile` has 280 INFERRED edges - model-reasoned connections that need verification._
- **Should `Session` be split into smaller, more focused modules?**
  _Cohesion score 0.1048265460030166 - nodes in this community are weakly interconnected._