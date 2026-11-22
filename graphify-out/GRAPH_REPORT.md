# Graph Report - ByteQuest-pilot-integration  (2026-11-22)

## Corpus Check
- 478 files · ~519,403 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 39 file(s) not represented in the graph (top: (none) 20, .bat 5, .example 5)

## Summary
- 4364 nodes · 14752 edges · 191 communities (164 shown, 27 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 1938 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d74fc618`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ui.tsx
- ByteQuest 2.0: instructor activity analysis and class announcements
- Session
- UUID
- UserRole
- chat-provider.tsx
- gradebook.tsx
- test_faculty_admin.py
- activities/[id]/page.tsx
- start-bytequest.ps1
- drafts.py
- get
- supabase.ts
- test_learning_flow_integration.py
- chat-workspace.tsx
- progress-recap.tsx
- rag_instructor.py
- exams/[id]/page.test.tsx
- entities.py
- test_ml_exam_features.py
- predictor.py
- profiles.py
- test_api_security.py
- sqlalchemy
- pilot.py
- 6. Prioritized improvement backlog
- LearningActivity
- submit_conceptual_quiz
- chat_history.py
- CodeDiff
- progress_recap.py
- workshop-home.tsx
- Prioritized defects
- onboarding/page.tsx
- test_tutor_replies.py
- asyncio
- chat.py
- leaderboard.tsx
- api.ts
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
- exams/[id]/page.tsx
- mastery-map.tsx
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
- scripts
- shadow.py
- ByteQuest 2.0: Master Architecture Plan & Execution Roadmap
- Phase 7 deployment readiness
- quests/page.tsx
- ProfileResponse
- typing
- attempt_visibility.py
- arena.tsx
- workspace.ts
- Instructor activity analysis and class announcements
- Desktop and Mobile Pilot Flows (`pilot-v2.html`)
- dockable-navigation.tsx
- upload_my_avatar
- react
- courses/page.tsx
- ML pipeline synthetic verification — 2026-10-25
- codex.py
- preflight-host.sh
- Phase 6 shadow rollout implementation record
- httpx
- ML feature engineering and training
- monitoring.py
- ByteQuest Gemini tutor pilot evaluation
- evaluation.tsx
- ByteQuest navigation
- ByteQuest UI/UX harmonization: slices 1–3 and ML slice planning
- Judge0 Hyper-V Ubuntu boot incident and recovery
- zerotier-relay.mjs
- Python demo journey — 2026-10-28
- PHASE7_DEPLOYMENT_READINESS.md
- ByteQuest 2.0 system status and weekly change log
- devDependencies
- Local API security verification — 2026-10-28
- Phase 7 database pool budget hardening
- test_profile_analytics.py
- judge0/__init__.py
- ByteQuest 2.0 before and after
- smoke-vps.sh
- ByteQuest pilot remediation checklist
- preflight-vps.sh
- seed_local_showcase_activity.py
- getErrorMessage
- forecasts.test.tsx
- submission_jobs.py
- ByteQuest manuscript and system alignment checklist
- mastery_map.py
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
- UpdatedAt
- dependencies
- exam_worker.py
- line-chart.tsx
- account_provisioning.py
- performance/page.tsx
- update_my_profile
- prepare-monaco.mjs
- flow
- chat-provider.test.tsx
- run_training_and_comparison
- accessibility-settings.tsx
- ByteQuest Insights, part 3 of 4: instructors
- Workshops: Create, Join and the Workshop page
- test_memory_rules.py
- app/layout.tsx
- Wireframes
- Make ByteQuest fit every phone and tablet
- ByteQuest 2.0: close the manuscript gaps, tidy the structure, then review and rate the system
- activity-analysis.tsx
- instructor/page.tsx
- ByteQuest Insights, part 4 of 4: administrators
- ByteQuest Insights, part 2 of 4: students
- Analytics
- Phase 7 local production-mode runtime verification
- ByteQuest system status — 21 November 2026
- reviews.py
- read_pdf_upload
- SandboxHealth
- test_gemini_embeddings.py
- test_every_public_timestamp_column_is_aware
- Course data model and grade integrity
- sqlalchemy
- course_access.py

## God Nodes (most connected - your core abstractions)
1. `Profile` - 363 edges
2. `Session` - 362 edges
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
- `Double-check before you report` --references--> `faculty_user()`  [INFERRED]
  docs/prompts/chatgpt-instructor-analysis-and-announcements.md → backend/app/api/faculty/common.py
- `P1 — functional gaps / decisions` --references--> `performance()`  [INFERRED]
  docs/verification/faculty-admin-workspace-2026-10-29.md → backend/app/api/faculty/performance.py
- `Slice 1: data and API (start here)` --references--> `WorkshopView`  [INFERRED]
  docs/prompts/chatgpt-workshop-classroom.md → backend/app/api/workshops.py
- `C. Improve Create Quest` --references--> `_published_activities()`  [INFERRED]
  docs/DEEPSEEK_V4_1_FLASH_QUEST_EXPANSION_GUIDE.md → backend/app/api/workshops.py

## Import Cycles
- None detected.

## Communities (191 total, 27 thin omitted)

### Community 0 - "ui.tsx"
Cohesion: 0.05
Nodes (96): Design system and data flow, Frontend, Stack and layout, 5.1 Shared library and components, AdminAccounts(), confirmDeactivate(), confirmReactivate(), openImpact() (+88 more)

### Community 1 - "ByteQuest 2.0: instructor activity analysis and class announcements"
Cohesion: 0.17
Nodes (11): ByteQuest 2.0: instructor activity analysis and class announcements, Database, Double-check before you report, Final report, Frontend, Hard rules, Part 1: Activity analysis, Part 2: Class announcements (+3 more)

### Community 2 - "Session"
Cohesion: 0.13
Nodes (31): _admin_material_items(), admin_materials(), retry_job(), _material_for_user(), archive_material(), create_material(), download_material(), list_materials() (+23 more)

### Community 3 - "UUID"
Cohesion: 0.22
Nodes (24): add_workshop_activities(), _announcement_for_update(), archive_workshop(), CreateAnnouncement, delete_workshop_announcement(), get_workshop(), leave_workshop(), list_workshop_announcements() (+16 more)

### Community 4 - "UserRole"
Cohesion: 0.16
Nodes (21): _activity_links(), create_workshop(), CreateWorkshop, join_workshop(), JoinWorkshop, list_workshops(), _published_exam_dates(), workshop_upcoming() (+13 more)

### Community 5 - "chat-provider.tsx"
Cohesion: 0.10
Nodes (30): Already strong (checked, not assumed), chatHistory, ChatMode, ConversationPage, ConversationSummary, SavedReply, SavedTurn, Transcript (+22 more)

### Community 6 - "gradebook.tsx"
Cohesion: 0.26
Nodes (11): Cell, CourseGradebook(), download(), Gradebook(), gradebookCsv(), GradebookProps, GradebookResponse, quote() (+3 more)

### Community 7 - "test_faculty_admin.py"
Cohesion: 0.06
Nodes (54): AuditEvent, ResearchConsent, record_grading_worker_heartbeat(), _consent(), _set_school_ids(), test_account_creation_provisions_a_profile_and_course_access(), test_activity_analysis_totals_and_practice_scope(), admin_row() (+46 more)

### Community 8 - "activities/[id]/page.tsx"
Cohesion: 0.04
Nodes (86): Step A checkpoint and caller verification, 4.5 Administrator API (`backend/app/api/admin.py`, prefix `/api/v1/admin`), ActivityEditor(), confirmPublish(), createVersion(), diffPayload(), runVerification(), save() (+78 more)

### Community 9 - "start-bytequest.ps1"
Cohesion: 0.07
Nodes (42): ConvertTo-EncodedPowerShellCommand(), ConvertTo-PowerShellLiteral(), Get-BackendFingerprint(), Get-FrontendFingerprint(), Get-Judge0VmIPv4(), Get-Judge0VmIPv4FromNeighbor(), Get-ListenerPidMap(), Get-PageScriptPaths() (+34 more)

### Community 10 - "drafts.py"
Cohesion: 0.08
Nodes (50): ActivityCreate, ActivityUpdate, create_activity(), create_activity_version(), get_activity(), _grading_fields(), preview_activity(), publish_activity() (+42 more)

### Community 11 - "get"
Cohesion: 0.11
Nodes (41): admin_activities(), _admin_activity_item(), admin_user(), course_health(), list_activity_workspace(), list_drafts(), faculty_dashboard(), list_courses() (+33 more)

### Community 12 - "supabase.ts"
Cohesion: 0.13
Nodes (23): Interrupted Exam Autosave & Browser Recovery (Checklist Item #3), cleared, localMap, mockLocalStorage, mockSessionStorage, remaining, storageMap, useExamAnswerSync() (+15 more)

### Community 13 - "test_learning_flow_integration.py"
Cohesion: 0.05
Nodes (113): PlatformSetting, GeminiAPIError, claim_exam(), test_chat_requires_active_enrollment_only_for_students(), _challenge(), _chat_payload(), _course_pdf(), _enroll_chat_students() (+105 more)

### Community 14 - "chat-workspace.tsx"
Cohesion: 0.15
Nodes (19): Repo map: exact files to inspect and change, ChatPage(), useChat(), ChatConversation, ChatIcon(), ChatPanel(), ChatShell(), close() (+11 more)

### Community 15 - "progress-recap.tsx"
Cohesion: 0.18
Nodes (14): changeText(), dayFormat, formatDay(), ProgressRecap(), ProgressRecapData, range(), readStoredDays(), RECAP_PERIODS (+6 more)

### Community 16 - "rag_instructor.py"
Cohesion: 0.28
Nodes (9): generate_ai_coding_challenge(), generate_ai_conceptual_quiz(), _generation_payload(), _get_owned_activity(), _get_owned_document(), _may_manage_activity(), _may_manage_document(), 3. Architecture and conflict decisions (+1 more)

### Community 17 - "exams/[id]/page.test.tsx"
Cohesion: 0.25
Nodes (5): answerSaves(), Call, mocks, savedBodies(), seedUnsyncedSnapshot()

### Community 18 - "entities.py"
Cohesion: 0.09
Nodes (19): CodeSubmissionRequest, run_code_submission(), _shadow_scoring_ready(), SubmissionJob, attempt_quality(), solve_stars(), record_prediction_outcome(), finish_submission() (+11 more)

### Community 19 - "test_ml_exam_features.py"
Cohesion: 0.16
Nodes (10): _attempt(), test_adequacy_flags_a_small_test_partition(), test_bootstrap_intervals_are_reproducible_and_resample_learners(), test_faculty_forecast_uses_the_recorded_winner_and_hides_legacy_probability(), test_hint_exports_reject_identifying_columns(), test_older_feature_schema_artifacts_are_rejected(), test_rows_are_first_submissions_on_challenges_with_strictly_prior_history(), test_training_rejects_ids_that_encode_an_account() (+2 more)

### Community 20 - "predictor.py"
Cohesion: 0.11
Nodes (16): lifespan(), load_ml_models(), ModelArtifactError, ModelArtifactsUnavailable, ModelBundle, _partition_report(), _positive_probability(), predict_student_success() (+8 more)

### Community 21 - "profiles.py"
Cohesion: 0.19
Nodes (18): ActivityDay, AdminAnalytics, AnalyticsResponse, AuditEntry, BadgeEntry, _enum_value(), ExamHistoryEntry, HelpPattern (+10 more)

### Community 22 - "test_api_security.py"
Cohesion: 0.06
Nodes (15): Settings, RequestSizeLimitMiddleware, limited_receive(), tracked_send(), _TooLarge, extract_chunks_from_pdf(), extract_pdf_chunks(), test_nested_quiz_content_rejects_unknown_fields() (+7 more)

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
Cohesion: 0.08
Nodes (45): _public_activity_context(), dashboard(), AddWorkshopActivities, ActivityKind, LearningActivity, ProgrammingLang, ReviewState, TestCase (+37 more)

### Community 27 - "submit_conceptual_quiz"
Cohesion: 0.11
Nodes (19): get_gamification_leaderboard(), public_handle(), get_student_progress(), LeaderboardEntry, LeaderboardResponse, LeaderboardStanding, list_published_quests(), _load_quiz_questions() (+11 more)

### Community 28 - "chat_history.py"
Cohesion: 0.17
Nodes (25): _check_revision(), Conversation, ConversationPage, create_conversation(), CreateConversation, delete_conversation(), delete_history(), _find_conversation() (+17 more)

### Community 29 - "CodeDiff"
Cohesion: 0.40
Nodes (6): Editor, CodeDiff(), loadEditor(), isDesktop(), subscribeToDesktop(), @monaco-editor/react

### Community 30 - "progress_recap.py"
Cohesion: 0.13
Nodes (12): get_gamification_state(), _day(), _manila(), _practice_days(), progress_recap(), ProgressRecap, RecapMetric, first_practice_days() (+4 more)

### Community 31 - "workshop-home.tsx"
Cohesion: 0.06
Nodes (70): WorkshopDetailLayout(), WorkshopInvitePage(), WorkshopsPage(), useShellProfile(), MasteryMap(), briefDescription(), QuestCard(), StudentPreview() (+62 more)

### Community 32 - "Prioritized defects"
Cohesion: 0.12
Nodes (17): 10. [P3] Hidden-case aggregate summary incorrectly reports zero, 2. [P1] Verification can certify content that Judge0 never checked, 3. [P1] Unreleased exam successes can affect visible rewards, 4. [P1] The current release build exits with a dependency security warning, 5. [P2] Challenges with no visible sample can be published, 6. [P2] The dashboard recommends a closed quest that cannot be submitted, 7. [P2] Completing one exam can hide another due exam on the dashboard, 8. [P2] A failed quiz is labeled completed (+9 more)

### Community 33 - "onboarding/page.tsx"
Cohesion: 0.13
Nodes (29): AuthMode, OnboardingContent(), authenticate(), changeAuthMode(), checkExistingAuth(), continueToAgreement(), finishPasswordSetup(), OnboardingPage() (+21 more)

### Community 34 - "test_tutor_replies.py"
Cohesion: 0.16
Nodes (10): _system_instruction(), cited_sources(), validate_tutor_citations(), choose_tutor_turn(), _is_follow_up(), TutorTurn, test_course_follow_up_uses_the_recent_topic_and_a_new_question_drops_it(), test_graded_context_always_uses_hint_mode() (+2 more)

### Community 35 - "asyncio"
Cohesion: 0.15
Nodes (11): cleanup(), main(), make_students(), one_student(), require_local(), run_load(), main(), student() (+3 more)

### Community 36 - "chat.py"
Cohesion: 0.14
Nodes (14): ChatLimits, ChatMessageRequest, ChatMessageResponse, ChatSource, ChatStatus, ChatTurn, _course_passages(), create_chat_message() (+6 more)

### Community 37 - "leaderboard.tsx"
Cohesion: 0.20
Nodes (12): CHOOSE_HANDLE_HREF, Leaderboard(), LeaderboardData, LeaderboardEntry, LeaderboardStanding, LearnerName(), MEDAL, Row() (+4 more)

### Community 38 - "api.ts"
Cohesion: 0.04
Nodes (65): activityHref(), closesIn(), Dashboard, DashboardContent(), DashboardPage(), kindLabel(), localTime(), Progress (+57 more)

### Community 39 - "insights.py"
Cohesion: 0.14
Nodes (18): CategoryCount, course_insights(), _event_days(), GamificationInsights, HelpSeeking, _manila_day(), MemoryRetention, _rate() (+10 more)

### Community 40 - "numpy"
Cohesion: 0.19
Nodes (9): _bootstrap_intervals(), _build_pipeline(), _evaluate_partition(), _finite_or_none(), _fit_tuned_model(), _point_metrics(), _probability_for_success(), split_students_disjoint() (+1 more)

### Community 41 - "ml_predictor/feature_engineering.py"
Cohesion: 0.17
Nodes (10): _as_bool(), _before(), _enum_value(), extract_features_from_dataframe(), _frame(), _mean(), _rate(), _format_metric() (+2 more)

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
Cohesion: 0.11
Nodes (14): GeneratedChallengeSchema, GeneratedQuizOptionSchema, GeneratedQuizQuestionSchema, GeneratedQuizSchema, TestCaseSchema, 2. Exact code touchpoints, 3. Recommended implementation order, 4. Ready-to-paste prompt for DeepSeek V4.1 Flash (+6 more)

### Community 47 - "Faculty and administrator workspace — implementation log and continued work"
Cohesion: 0.11
Nodes (17): 10. Files created or modified (this work), 11. Quick current-state checklist, 1. Status at handoff, 6. Tests added, 7. Verification evidence (live app), 8. How to continue (commands, accounts, cleanup), 9. Remaining work, Additional navigation fix (+9 more)

### Community 48 - "package.json"
Cohesion: 0.11
Nodes (17): engines, node, name, overrides, dompurify, private, version, eslint (+9 more)

### Community 49 - "Phase 1 — ByteQuest instructor redesign plan"
Cohesion: 0.17
Nodes (12): Assumptions, Courses and Workshops, Dashboard and Analytics division, Files changed, How to test this plan, Main user flows, Next step, Other instructor API contracts (+4 more)

### Community 50 - "get_db"
Cohesion: 0.14
Nodes (20): _accuracy(), _course_activities(), dashboard(), evaluation(), _faculty(), _forecast(), forecast_readiness(), _period_cutoff() (+12 more)

### Community 51 - "AppTooltips"
Cohesion: 0.28
Nodes (17): AppTooltips(), clearTimers(), findTarget(), hide(), onClick(), onContextMenu(), onFocusIn(), onFocusOut() (+9 more)

### Community 52 - "qa-responsive.mjs"
Cohesion: 0.31
Nodes (11): assertRail(), capture(), checkDocking(), examViewports(), failures, fixture, inspectProfile(), measure() (+3 more)

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
Cohesion: 0.12
Nodes (20): WorkshopsLayout(), AppShell(), isActiveDestination(), useScrollResetOnRouteChange(), CourseNavigationLinks(), CourseSwitcher(), InstructorCourseShell(), InstructorShell() (+12 more)

### Community 58 - "LegalDocument"
Cohesion: 0.24
Nodes (9): metadata, Page(), metadata, Page(), LegalDocument(), LegalKind, LegalModal(), PolicyPanel() (+1 more)

### Community 59 - "llm.py"
Cohesion: 0.08
Nodes (16): get_settings(), ErrorExplanationSchema, explain_code_error(), _client_for_key(), GeminiConfigurationError, get_gemini_client(), _chat_failure(), GeminiLLMService (+8 more)

### Community 60 - "workshops.py"
Cohesion: 0.16
Nodes (19): AnnouncementView, can_manage(), ManagedWorkshopStudent, _new_code(), _save_with_new_code(), UpcomingItem, UpdateWorkshop, workshop_activity_catalog() (+11 more)

### Community 61 - "exams.py"
Cohesion: 0.10
Nodes (45): assigned(), assigned_exam_numbers(), _assigned_exams_with_state(), create_exam(), DraftExam, DraftItem, _exam_access(), exam_sample_run() (+37 more)

### Community 62 - "profile/page.tsx"
Cohesion: 0.07
Nodes (45): AccountPanel(), AdminSections(), ConsentStatus, habitsMessage(), InstructorSections(), PersonalTimeline(), ProfilePage(), ProfilePageContent() (+37 more)

### Community 63 - "useChatController"
Cohesion: 0.23
Nodes (18): turnMessages(), mapChatError(), useChatController(), applySavedReply(), canSend(), checkReply(), handleFailure(), openConversation() (+10 more)

### Community 64 - "ByteQuest machine-learning improvement plan"
Cohesion: 0.11
Nodes (18): 1. Goal, 2. Where things stand, 3. Decisions, 4.1 Prediction unit and label, 4.2 History, 4.3 The ten features, in this order, 4.4 Live shadow scoring, 4.5 Reporting (+10 more)

### Community 65 - "retrieval.py"
Cohesion: 0.09
Nodes (20): _gemini_unavailable_http_exception(), _retrieve_document_sources(), _serialize_quiz(), _validate_form_keys(), validate_generation_form(), embed_chunks_bounded(), embed_one(), GeminiEmbeddingService (+12 more)

### Community 66 - "train_compare.py"
Cohesion: 0.10
Nodes (9): _as_binary_label(), _check_columns(), _encodes_account_id(), _fit_baselines(), _require_pseudonymous(), _sort_attempts(), _strip_text(), _validate_hint_frame() (+1 more)

### Community 67 - "ByteQuest 2.0 Classroom Pilot Operator Runbook"
Cohesion: 0.12
Nodes (16): 8 Required Acceptance Checks, Durability Boundary & Concurrency Guarantees, Exam Autosave & Conflict-Safe Recovery Verification, 1. Hard Safety Gates (Enforced by Configuration), 2. Lab Station & Shared-Computer Protocol, 3. Network Resilience & Live Draft Sync, 4. Timed Exam Operations, 5. Verification Commands (+8 more)

### Community 68 - "exams/[id]/page.tsx"
Cohesion: 0.13
Nodes (20): Attempt, AttemptResult, AttemptResultItem, ExamAnswers, ExamItem, ExamSyncBannerState, formatClockTime(), QuizQuestion (+12 more)

### Community 69 - "mastery-map.tsx"
Cohesion: 0.07
Nodes (34): Job, nextStarTip(), SubmissionStatusPage(), refresh(), retryGrading(), currentAttempt, mocks, oldSubmission (+26 more)

### Community 70 - "ByteQuest local end-to-end flow"
Cohesion: 0.14
Nodes (14): Account-synced progression check, Before deployment, ByteQuest local end-to-end flow, Instructor account, Local Quest Map demos, Manual startup, One-click Windows startup, Open ByteQuest on a phone over ZeroTier (+6 more)

### Community 71 - "accessibility-provider.tsx"
Cohesion: 0.20
Nodes (15): ACCESSIBILITY_STORAGE_KEYS, AccessibilityContext, AccessibilityContextValue, AccessibilityPreferences, AccessibilityProvider(), applyPreferences(), commitPreferences(), DEFAULT_PREFERENCES (+7 more)

### Community 72 - "ByteQuest 2.0"
Cohesion: 0.22
Nodes (9): Architecture, ByteQuest 2.0, Configuration and security, Documentation, Repository layout, Stack and deployment, Start locally on Windows, Test and verify (+1 more)

### Community 73 - "client.py"
Cohesion: 0.07
Nodes (21): _b64_decode(), _b64_encode(), BatchEvaluationSummary, classify_judge0_status(), Judge0Client, Judge0UnavailableError, _parse_completed_result(), metric() (+13 more)

### Community 74 - "ByteQuest 2.0 — Full system review"
Cohesion: 0.08
Nodes (22): ByteQuest 2.0 engineering and UX review, Findings, Performance evidence, Recommended sequence, Verification and limits, ByteQuest 2.0 — Full system review, Evidence, Must fix (+14 more)

### Community 75 - "Phase 0 — ByteQuest instructor audit"
Cohesion: 0.22
Nodes (8): Current FastAPI inventory, Current screens and feature coverage, Decisions for Phase 1, Desktop scorecard, Findings, Phase 0 — ByteQuest instructor audit, Supabase data and authorization, Verification

### Community 76 - "StorageError"
Cohesion: 0.25
Nodes (5): StorageError, SupabasePDFStorage, test_accepts_absolute_signed_url_from_configured_origin(), test_rejects_untrusted_signed_url(), test_resolves_supabase_relative_signed_path()

### Community 78 - "ByteQuest 2.0 database review — 12 November 2026"
Cohesion: 0.18
Nodes (11): _id(), B. Findings, ByteQuest 2.0 database review — 12 November 2026, C. Migration plan, D. Index recommendations, E. Organisation and documentation, G. Explicitly out of scope, Must fix (+3 more)

### Community 79 - "Profile"
Cohesion: 0.07
Nodes (63): account_impact(), _account_needs_action(), AccountCreate, activity_impact(), _admin_activity(), admin_archive_activity(), admin_archive_material(), admin_download_material() (+55 more)

### Community 80 - "SYSTEM_STATUS_AND_RELEASE_PLAN.md"
Cohesion: 0.19
Nodes (4): ByteQuest repository guidance, Current system status, graphify, This is NOT the Next.js you know

### Community 81 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, build, dev, lint, prebuild, predev, prestart, start (+3 more)

### Community 82 - "shadow.py"
Cohesion: 0.29
Nodes (5): has_required_prediction_history(), prior_graded_task_count(), record_shadow_prediction(), _rollback_quietly(), test_prediction_history_counts_distinct_prior_tasks_not_retries()

### Community 83 - "ByteQuest 2.0: Master Architecture Plan & Execution Roadmap"
Cohesion: 0.08
Nodes (25): 1. Project Tracking & Thesis Collaboration Strategy, 2. Core Architectural Rules (Non-Negotiable), 3. Repository Directory Structure, 4. Course-Sequence & Curriculum Alignment, 5. Database Schema Blueprint (Supabase PostgreSQL + pgvector), 6. 7-Phase Development Plan, 7. Thesis Objectives Mapping (Chapter 1 Alignment), 8. Development Environment & Quickstart Commands (+17 more)

### Community 84 - "Phase 7 deployment readiness"
Cohesion: 0.18
Nodes (11): Decisions required before production setup, Deployment order after the decisions are made, Evidence still needed, Local Judge0 runtime smoke check (2026-10-26), Notes on local verification, Phase 7 deployment readiness, Prepared in the repository, Production settings and network boundaries (+3 more)

### Community 85 - "quests/page.tsx"
Cohesion: 0.20
Nodes (11): ExamCard, ExamsPage(), localTime(), QuestsPageContent(), changeView(), handleKeyDown(), QuestStatusFilter, ActivityDateFilter() (+3 more)

### Community 86 - "ProfileResponse"
Cohesion: 0.18
Nodes (6): complete_staff_setup(), complete_student_onboarding(), delete_my_avatar(), get_my_profile(), ProfileResponse, _require_student()

### Community 87 - "typing"
Cohesion: 0.20
Nodes (8): get_settings(), _coerce(), get_settings_int(), list_settings(), _range_error(), serialize_setting(), _typed_value(), update_setting()

### Community 88 - "attempt_visibility.py"
Cohesion: 0.16
Nodes (12): _published_activities(), _shareable_activity_filters(), workshop_activity_details(), activity_has_opened(), activity_is_closed(), _as_utc(), course_open_clause(), guard_solution_reopen() (+4 more)

### Community 89 - "arena.tsx"
Cohesion: 0.08
Nodes (37): ArenaPage(), Arena(), checkStatus(), confirmResetCode(), endSegment(), handleCodeChange(), handleCopyOutput(), load() (+29 more)

### Community 90 - "workspace.ts"
Cohesion: 0.04
Nodes (81): 2. Repository discovery (recorded before changes), describe(), EnrollStudents(), enroll(), runPreview(), GROUPS, courses, plan (+73 more)

### Community 91 - "Instructor activity analysis and class announcements"
Cohesion: 0.33
Nodes (6): Activity analysis, Browser verification, Class announcements, Instructor activity analysis and class announcements, Remaining verification, Verification

### Community 92 - "Desktop and Mobile Pilot Flows (`pilot-v2.html`)"
Cohesion: 0.22
Nodes (8): 1. Offline / Network Reconnect Banner, 2. Pending / Queued Grading State, 3. Research Consent & Withdrawal State (Disabled Collection Notice), 4. Active Exam Priority Banner & Timed Attempt Lock, ByteQuest web app wireframes, Coverage, Desktop and Mobile Pilot Flows (`pilot-v2.html`), Review checklist

### Community 93 - "dockable-navigation.tsx"
Cohesion: 0.20
Nodes (12): Already in place: extend, do not rebuild, choose(), DockableNavigation(), finish(), MenuPositionSetting(), readMenuSide(), setMenuSide(), Side (+4 more)

### Community 94 - "upload_my_avatar"
Cohesion: 0.20
Nodes (5): _detect_avatar_content_type(), school_id_availability(), upload_my_avatar(), test_detect_avatar_content_type_recognizes_supported_signatures(), test_detect_avatar_content_type_rejects_metadata_only_and_truncated_files()

### Community 95 - "react"
Cohesion: 0.07
Nodes (37): nextConfig, AdminLayout(), FacultyLayout(), WorkspaceLayout(), AccountMenu(), subscribeToSheetBreakpoint(), usesAccountSheet(), ADMIN_SECTION_GROUPS (+29 more)

### Community 96 - "courses/page.tsx"
Cohesion: 0.17
Nodes (19): AdminCoursesPage(), blank, Courses(), askArchive(), changed(), confirmArchive(), submit(), EditCourse() (+11 more)

### Community 97 - "ML pipeline synthetic verification — 2026-10-25"
Cohesion: 0.29
Nodes (6): Artifact and activation checks, Execution, ML pipeline synthetic verification — 2026-10-25, Observed grouped metrics, Remaining Phase 5 work, Scope

### Community 98 - "codex.py"
Cohesion: 0.23
Nodes (11): get_codex(), ChallengeRecovery, codex_summary(), CodexCategory, CodexRecovery, CodexResponse, CodexSummary, practice_errors() (+3 more)

### Community 99 - "preflight-host.sh"
Cohesion: 0.38
Nodes (6): fail(), MIN_MEMORY_BYTES, MIN_ROOT_FREE_BYTES, MIN_SWAP_BYTES, pass(), preflight-host.sh script

### Community 100 - "Phase 6 shadow rollout implementation record"
Cohesion: 0.33
Nodes (5): Implemented, Phase 6 shadow rollout implementation record, Phase 7 handoff, Safety and current state, Verification still required

### Community 101 - "httpx"
Cohesion: 0.17
Nodes (11): _evaluate(), _failed_sample(), main(), _request(), TutorCase, challenge_specs(), foundation_id(), main() (+3 more)

### Community 102 - "ML feature engineering and training"
Cohesion: 0.40
Nodes (5): Comparison protocol, Export an attempt dataset, ML feature engineering and training, Prepare an Ubuntu VPS, Safe pipeline setup

### Community 103 - "monitoring.py"
Cohesion: 0.10
Nodes (32): admin_dashboard(), audit_events(), monitoring(), sandbox_health(), ProcessingJob, audit_query(), _check_judge0(), _grading_worker_health() (+24 more)

### Community 104 - "ByteQuest Gemini tutor pilot evaluation"
Cohesion: 0.50
Nodes (4): ByteQuest Gemini tutor pilot evaluation, Reply quality, Token use and estimated Gemini cost, What was tested

### Community 105 - "evaluation.tsx"
Cohesion: 0.18
Nodes (17): Model evaluation, AdequacyNotice(), ComparisonTable(), ConfusionMatrix(), CurveChart(), Intervals, Methodology(), metric() (+9 more)

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

### Community 111 - "PHASE7_DEPLOYMENT_READINESS.md"
Cohesion: 0.05
Nodes (34): Current routes and behavior, Phase 2 API and rollout list, Reference tokens and icons, Screenshot comparisons, Step C — Instructor visual verification, Test target checks, Grant access to one account, Production instructor access (+26 more)

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

### Community 116 - "test_profile_analytics.py"
Cohesion: 0.26
Nodes (8): _add_audit(), _analytics(), test_each_role_receives_only_its_own_branch(), test_existing_admin_fields_remain_compatible(), test_existing_instructor_fields_remain_compatible(), test_faculty_without_courses_gets_a_calm_fallback(), test_personal_timeline_only_includes_own_actions(), test_student_branch_has_no_staff_fields()

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
Cohesion: 0.06
Nodes (44): ActivityAttempt, Badge, ChallengeHint, DocumentChunk, ExamSampleRun, GradingWorkerHeartbeat, HintUse, NotificationOutbox (+36 more)

### Community 124 - "getErrorMessage"
Cohesion: 0.06
Nodes (44): CHOICE_LABEL, ResearchConsentSettingsPage(), choose(), ExamsPage(), ExamsPage(), QuizPage(), AttemptResult, Catalog (+36 more)

### Community 126 - "forecasts.test.tsx"
Cohesion: 0.14
Nodes (14): ByteQuest 2.0 system critique — 21 November 2026, Findings by severity, High, Low, Not verified in this review, Scorecard, Top 5 things to do next, Verdict (+6 more)

### Community 127 - "submission_jobs.py"
Cohesion: 0.23
Nodes (10): compare_submission(), ComparedAttempt, get_job(), _retry_failed_job(), retry_job(), SubmissionComparison, submit_job(), SubmitJob (+2 more)

### Community 128 - "ByteQuest manuscript and system alignment checklist"
Cohesion: 0.20
Nodes (10): 1. Scope decisions, 2. Chapter 1 — Introduction and scope, 3. Chapter 2 — Literature and synthesis, 4. Chapter 3 — Roles, practice, and AI, 5. Chapter 3 — Assessment and architecture, 6. Chapter 3 — Consent, research data, and ML, 7. Study records and final sign-off, ByteQuest manuscript and system alignment checklist (+2 more)

### Community 132 - "mastery_map.py"
Cohesion: 0.24
Nodes (9): get_mastery_map(), get_reviews(), _utcnow(), published_track_clause(), first_visible_completions(), mastery_map(), MasteryConcept, MasteryMapResponse (+1 more)

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
Cohesion: 0.17
Nodes (11): reserve(), Rule, window_bounds(), test_ai_global_budgets_are_independent(), test_chat_has_dedicated_account_and_global_quota(), test_costly_action_pauses_if_quota_storage_is_unavailable(), test_daily_window_resets_at_manila_midnight(), test_global_ai_cap_rejects_without_spending_account_buckets() (+3 more)

### Community 138 - "ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash"
Cohesion: 0.17
Nodes (10): _serialize_challenge(), Behavior and scope of the assistant, ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash, Placement and responsive layout, Product decision, Quality gates and acceptance tests, Ready-to-paste DeepSeek V4.1 Flash implementation prompt, State and error rules (+2 more)

### Community 139 - "ByteQuest — Security & AI-Abuse Hardening (implementation brief)"
Cohesion: 0.05
Nodes (31): get_current_user_payload(), TokenPayload, deliver_one(), auth(), verify(), claims(), test_es256_verifies_locally_off_the_event_loop(), test_failed_jwks_verification_falls_back() (+23 more)

### Community 140 - "FastAPI"
Cohesion: 0.13
Nodes (12): AnnouncementCreate, AnnouncementExpiry, AnnouncementPatch, _audit_change(), _authorize_announcement(), create_announcement(), delete_announcement(), list_announcements() (+4 more)

### Community 141 - "5. Slices"
Cohesion: 0.12
Nodes (15): 1. Read these first, in this order, 3. Hard rules, 4. Decided behaviour (W1–W12, all accepted by the user), 5. Slices, 6. How to verify each slice, 7. Report after each slice, ChatGPT 6.2 prompt: finish the ByteQuest Workshop classroom (slices 1–8), Slice 1: data and API (start here) (+7 more)

### Community 142 - "Local API security contract"
Cohesion: 0.40
Nodes (5): Access matrix, Local API security contract, Local verification and future deployment, Quotas and validation, School-issued IDs for student sign-up

### Community 143 - "UpdatedAt"
Cohesion: 0.19
Nodes (7): Course health on System Overview, mocks, phaseB, report, CourseWorkspace(), Page(), UpdatedAt()

### Community 146 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, monaco-editor, @monaco-editor/react, next, react, react-dom, react-is, recharts (+1 more)

### Community 148 - "exam_worker.py"
Cohesion: 0.24
Nodes (7): ExamGradingClaim, _grade_claimed_exam(), grade_exam(), _grade_item(), _lock_exam_claim(), submission_passes(), test_submission_passes()

### Community 149 - "line-chart.tsx"
Cohesion: 0.31
Nodes (11): useAccessibility(), ChartProps, ChartRow, ChartSkeleton(), InsightLineChart(), Plot, Series, SeriesSwatch() (+3 more)

### Community 150 - "account_provisioning.py"
Cohesion: 0.36
Nodes (8): account_emails_for_email(), create_account(), _admin_headers(), build_profile(), delete_auth_user(), DuplicateAccount, invite_auth_user(), ProvisioningUnavailable

### Community 151 - "performance/page.tsx"
Cohesion: 0.08
Nodes (43): Student Progress: the only roster and learner drawer, CourseRef, Curve, Dashboard, Detail, Forecast, FORECAST_REASONS, HistoryEvent (+35 more)

### Community 152 - "update_my_profile"
Cohesion: 0.33
Nodes (3): ProfileUpdateRequest, update_my_profile(), normalize_username()

### Community 153 - "prepare-monaco.mjs"
Cohesion: 0.18
Nodes (6): frontend, marker, packageDir, source, target, fixture

### Community 154 - "flow"
Cohesion: 0.25
Nodes (3): flow(), cleanup(), override_db()

### Community 156 - "chat-provider.test.tsx"
Cohesion: 0.18
Nodes (8): ChatProvider(), auth, bodies(), openChat(), ready, routeApi(), savedChat, CHAT_STORAGE_KEY

### Community 157 - "run_training_and_comparison"
Cohesion: 0.30
Nodes (6): _atomic_joblib_dump(), _atomic_json_write(), _atomic_write(), run_training_and_comparison(), _select_winner(), _sha256_file()

### Community 158 - "accessibility-settings.tsx"
Cohesion: 0.25
Nodes (9): 5.2 Faculty routes, 5.3 Administrator routes, 5.4 Navigation and shell integration, 5. Frontend changes, AccessibilityPage(), AccessibilityPreferenceKey, ACCESSIBILITY_SETTINGS, AccessibilitySettingDefinition (+1 more)

### Community 159 - "ByteQuest Insights, part 3 of 4: instructors"
Cohesion: 0.20
Nodes (9): Activity health in the Activities list, ByteQuest Insights, part 3 of 4: instructors, Exam class summary, Goal, Handheld rules, Inactive 7+ days, Out of scope, Renamed figures (+1 more)

### Community 160 - "Workshops: Create, Join and the Workshop page"
Cohesion: 0.22
Nodes (9): 10. Decisions to critique, 2. Screen map, 3. Rules, 5. API changes (all under `/api/v1/workshops`), 6. Frontend structure, 7. Delivery slices (each ships with tests), 8. Out of scope for v1, 9. Conflicts and risks (+1 more)

### Community 161 - "test_memory_rules.py"
Cohesion: 0.31
Nodes (4): review_passed(), review_size(), test_review_passes_at_two_thirds(), test_review_size_uses_up_to_four_questions()

### Community 162 - "app/layout.tsx"
Cohesion: 0.15
Nodes (13): byteBounce, metadata, RootLayout(), viewport, hasVisibleText(), tooltipFor(), TooltipState, ToastApi (+5 more)

### Community 163 - "Wireframes"
Cohesion: 0.22
Nodes (9): Activity editor, Analytics desktop, Analytics phone, Dashboard desktop, Dashboard phone, Learner drill-down, Other screen layouts, Submission review (+1 more)

### Community 164 - "Make ByteQuest fit every phone and tablet"
Cohesion: 0.22
Nodes (9): Goal, Layout system, Make ByteQuest fit every phone and tablet, Menu docking: finish what exists, Out of scope, Screens, Side navigation on handheld screens: already built, Touch and input (+1 more)

### Community 165 - "ByteQuest 2.0: close the manuscript gaps, tidy the structure, then review and rate the system"
Cohesion: 0.13
Nodes (12): RFC-4122, ByteQuest 2.0: close the manuscript gaps, tidy the structure, then review and rate the system, Do not, Final report, Hard rules, Part 1: AI tutoring (highest priority), Part 3: Code structure (targeted; behaviour must stay identical), Part 4: Review and targeted fixes (+4 more)

### Community 166 - "activity-analysis.tsx"
Cohesion: 0.07
Nodes (41): Already in place: extend, do not rebuild, ByteQuest Insights, part 1 of 4: shared foundation, Charts: two primitives, Goal, Handheld rules, Metric labels, Out of scope, Profile: one role tab, each figure once (+33 more)

### Community 167 - "instructor/page.tsx"
Cohesion: 0.09
Nodes (50): Already in place: extend, do not rebuild, One kit: course-ui, Implementation status (21 November 2026, same day), Medium, CourseInsights(), Insights(), AboutForecasts(), ModelEvaluation() (+42 more)

### Community 168 - "ByteQuest Insights, part 4 of 4: administrators"
Cohesion: 0.33
Nodes (5): ByteQuest Insights, part 4 of 4: administrators, Goal, Handheld rules, Out of scope, Verification and rollout

### Community 169 - "ByteQuest Insights, part 2 of 4: students"
Cohesion: 0.22
Nodes (8): ByteQuest Insights, part 2 of 4: students, Goal, Handheld rules, One badge list, Out of scope, Score trend and breakdowns, Topic practice links, Verification and rollout

### Community 170 - "Analytics"
Cohesion: 0.40
Nodes (5): Analytics, API and data performance, Chart library and motion, Filters and shared facts, Metric dictionary

### Community 171 - "Phase 7 local production-mode runtime verification"
Cohesion: 0.40
Nodes (5): Boundaries and remaining work, Phase 7 local production-mode runtime verification, Procedure, Reproduction, Results

### Community 172 - "ByteQuest system status — 21 November 2026"
Cohesion: 0.40
Nodes (5): ByteQuest system status — 21 November 2026, Checkout, runtime and release, Machine learning — status on 11/21/26, Verification and remaining checks, What changed

### Community 174 - "reviews.py"
Cohesion: 0.11
Nodes (34): _ensure_student(), get_review(), _locked_student(), _public_review(), _question_id(), _require_memory(), ReviewOverviewResponse, ReviewResponse (+26 more)

### Community 179 - "Course data model and grade integrity"
Cohesion: 0.67
Nodes (3): Course data model and grade integrity, Migration and rollback, RLS and authorization

### Community 188 - "sqlalchemy"
Cohesion: 0.10
Nodes (9): api_health_check(), health_check(), readiness_check(), destroy(), main(), ensure_student(), letters(), main() (+1 more)

### Community 189 - "course_access.py"
Cohesion: 0.11
Nodes (24): list_course_operations(), _chat_activity(), exam_catalog(), instructor_exams(), instructor_hints(), CourseMember, active_membership_course_ids(), courses_for_user() (+16 more)

## Knowledge Gaps
- **18 isolated node(s):** `monaco-editor`, `react-is`, `@types/node`, `@types/react`, `@types/react-dom` (+13 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1418 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `4. Read these before writing any code` connect `seed_local_showcase_activity.py` to `ui.tsx`, `Session`, `mastery_map.py`, `flow`, `client.py`, `test_learning_flow_integration.py`, `profiles.py`, `LearningActivity`, `submit_conceptual_quiz`, `workshop-home.tsx`?**
  _High betweenness centrality (0.190) - this node is a cross-community bridge._
- **Are the 296 inferred relationships involving `Profile` (e.g. with `account_impact()` and `_account_needs_action()`) actually correct?**
  _`Profile` has 296 INFERRED edges - model-reasoned connections that need verification._
- **What connects `monaco-editor`, `react-is`, `@types/node` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ui.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05135483870967742 - nodes in this community are weakly interconnected._
- **Why does `LearningActivity` connect `LearningActivity` to `Session`, `UserRole`, `mastery_map.py`, `test_faculty_admin.py`, `drafts.py`, `get`, `ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash`, `test_learning_flow_integration.py`, `rag_instructor.py`, `entities.py`, `predictor.py`, `profiles.py`, `pilot.py`, `submit_conceptual_quiz`, `asyncio`, `chat.py`, `insights.py`, `qa_live_multi_role.py`, `reviews.py`, `get_db`, `workshops.py`, `course_access.py`, `exams.py`, `retrieval.py`, `Profile`, `shadow.py`, `attempt_visibility.py`, `codex.py`, `httpx`, `monitoring.py`, `seed_local_showcase_activity.py`, `submission_jobs.py`?**
  _High betweenness centrality (0.135) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `Session` (e.g. with `smoke_demo_quest()` and `test_two_concurrent_saves_cannot_commit_the_same_activity_version()`) actually correct?**
  _`Session` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Should `Session` be split into smaller, more focused modules?**
  _Cohesion score 0.12525252525252525 - nodes in this community are weakly interconnected._