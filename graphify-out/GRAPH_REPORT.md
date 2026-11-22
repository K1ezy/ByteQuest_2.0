# Graph Report - ByteQuest-pilot-integration  (2026-11-22)

## Corpus Check
- 475 files · ~516,886 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 39 file(s) not represented in the graph (top: (none) 20, .bat 5, .example 5)

## Summary
- 4343 nodes · 14674 edges · 188 communities (161 shown, 27 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 1931 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2a7e6378`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ui.tsx
- ByteQuest 2.0: instructor activity analysis and class announcements
- Session
- LearningActivity
- workshops.py
- chat-provider.tsx
- performance/page.tsx
- test_faculty_admin.py
- activities/[id]/page.tsx
- start-bytequest.ps1
- drafts.py
- performance.py
- supabase.ts
- test_learning_flow_integration.py
- chat-workspace.tsx
- dashboard/page.tsx
- rag_instructor.py
- exams/[id]/page.test.tsx
- entities.py
- test_ml_exam_features.py
- faculty_ml.py
- profiles.py
- test_api_security.py
- sqlalchemy
- Session
- 6. Prioritized improvement backlog
- challenge_verification.py
- submit_conceptual_quiz
- chat.py
- submission-comparison.tsx
- start_process
- workshop-home.tsx
- Prioritized defects
- onboarding/page.tsx
- test_tutor_replies.py
- asyncio
- workspace-provider.tsx
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
- course-shell.tsx
- LegalDocument
- test_error_explainer.py
- Judge0Client
- exams.py
- profile/page.tsx
- useChatController
- ByteQuest machine-learning improvement plan
- retrieval.py
- train_compare.py
- ByteQuest 2.0 Classroom Pilot Operator Runbook
- student-signup.ts
- submissions/[id]/page.tsx
- ByteQuest local end-to-end flow
- accessibility-provider.tsx
- ByteQuest 2.0
- Judge0UnavailableError
- ByteQuest 2.0 — Full system review
- Phase 0 — ByteQuest instructor audit
- StorageError
- SupabaseAvatarStorage
- ByteQuest 2.0 database review — 12 November 2026
- Profile
- SYSTEM_STATUS_AND_RELEASE_PLAN.md
- scripts
- has_required_prediction_history
- ByteQuest 2.0: Master Architecture Plan & Execution Roadmap
- Phase 7 deployment readiness
- lib/types.ts
- ProfileResponse
- typing
- asyncio
- arena.tsx
- workspace.ts
- Instructor activity analysis and class announcements
- Desktop and Mobile Pilot Flows (`pilot-v2.html`)
- dockable-navigation.tsx
- upload_my_avatar
- next
- profile_attention.py
- ML pipeline synthetic verification — 2026-10-25
- codex.py
- preflight-host.sh
- Phase 6 shadow rollout implementation record
- httpx
- ML feature engineering and training
- monitoring.py
- ByteQuest Gemini tutor pilot evaluation
- runCode
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
- test_profile_analytics.py
- judge0/__init__.py
- ByteQuest 2.0 before and after
- smoke-vps.sh
- ByteQuest pilot remediation checklist
- preflight-vps.sh
- seed_local_showcase_activity.py
- getErrorMessage
- ByteQuest 2.0 system critique — 21 November 2026
- Judge0 Hyper-V Ubuntu VM: troubleshooting handoff
- ByteQuest manuscript and system alignment checklist
- test_sandbox_internal_error_is_unavailability_not_a_student_failure
- ByteQuest 2.0 live deployment stack
- home-redirect.tsx
- ML features and prediction unit: manuscript vs. code
- ByteQuest KVM 2 live pilot
- Step C — Instructor visual verification
- ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash
- ByteQuest — Security & AI-Abuse Hardening (implementation brief)
- FastAPI
- Judge0 Hyper-V Ubuntu VM: troubleshooting handoff
- Local API security contract
- prepare_ml_dataset
- dependencies
- ActivityAttempt
- test_judge0_privacy.py
- submissions/[id]/page.test.tsx
- performance/page.tsx
- update_my_profile
- generate_embedding
- flow
- _validate_form_keys
- CLAUDE.md
- 1. Current architecture
- frontend/AGENTS.md
- Workshops: Create, Join and the Workshop page
- app-tooltips.tsx
- Phase 7 backend image build verification
- ByteQuest 2.0: close the manuscript gaps, tidy the structure, then review and rate the system
- ByteQuest Insights, part 1 of 4: shared foundation
- instructor/page.tsx
- Milestones 1A–1C Status and Verification Log
- ByteQuest Insights, part 2 of 4: students
- Phase 7 frontend build evidence
- Phase 7 Vercel setup verification — 2026-10-26
- ByteQuest system status — 21 November 2026
- Phase 7 dependency security review (2026-10-26)
- reviews.py
- Phase 7 synthetic deployment preflight — 2026-10-26
- Production instructor access
- qa_mixed_exam_load.py
- course_access.py
- problem-statement.ts
- _fit_baselines

## God Nodes (most connected - your core abstractions)
1. `Profile` - 363 edges
2. `Session` - 362 edges
3. `LearningActivity` - 226 edges
4. `getErrorMessage()` - 148 edges
5. `ActivityAttempt` - 125 edges
6. `apiRequest()` - 121 edges
7. `ReviewState` - 112 edges
8. `ProgrammingLang` - 97 edges
9. `UserRole` - 94 edges
10. `react` - 90 edges

## Surprising Connections (you probably didn't know these)
- `Supabase data and authorization` --references--> `audit_events()`  [INFERRED]
  .design/checkup-report.md → backend/app/api/admin.py
- `4.1 Migration` --references--> `audit_events()`  [INFERRED]
  docs/verification/faculty-admin-workspace-2026-10-29.md → backend/app/api/admin.py
- `Double-check before you report` --references--> `faculty_user()`  [INFERRED]
  docs/prompts/chatgpt-instructor-analysis-and-announcements.md → backend/app/api/faculty/common.py
- `P1 — functional gaps / decisions` --references--> `performance()`  [INFERRED]
  docs/verification/faculty-admin-workspace-2026-10-29.md → backend/app/api/faculty/performance.py
- `C. Improve Create Quest` --references--> `_published_activities()`  [INFERRED]
  docs/DEEPSEEK_V4_1_FLASH_QUEST_EXPANSION_GUIDE.md → backend/app/api/workshops.py

## Import Cycles
- None detected.

## Communities (188 total, 27 thin omitted)

### Community 0 - "ui.tsx"
Cohesion: 0.06
Nodes (101): Design system and data flow, Course health on System Overview, Frontend, Stack and layout, 5.1 Shared library and components, AdminAccounts(), confirmDeactivate(), confirmReactivate() (+93 more)

### Community 1 - "ByteQuest 2.0: instructor activity analysis and class announcements"
Cohesion: 0.15
Nodes (12): Backend, ByteQuest 2.0: instructor activity analysis and class announcements, Database, Double-check before you report, Final report, Frontend, Hard rules, Part 1: Activity analysis (+4 more)

### Community 2 - "Session"
Cohesion: 0.10
Nodes (38): admin_retry_material(), admin_upload_material(), monitoring(), retry_job(), _draft_response(), _material_brief(), _material_for_user(), archive_material() (+30 more)

### Community 3 - "LearningActivity"
Cohesion: 0.10
Nodes (58): LearningActivity, PlatformSetting, ReviewState, SubmissionJob, save_drafts(), _challenge(), _graded_job(), _published_activity() (+50 more)

### Community 4 - "workshops.py"
Cohesion: 0.05
Nodes (97): QuizSubmissionRequest, _activity_links(), add_workshop_activities(), AddWorkshopActivities, _announcement_for_update(), AnnouncementView, archive_workshop(), can_manage() (+89 more)

### Community 5 - "chat-provider.tsx"
Cohesion: 0.10
Nodes (30): Already strong (checked, not assumed), chatHistory, ChatMode, ConversationPage, ConversationSummary, SavedReply, SavedTurn, Transcript (+22 more)

### Community 6 - "performance/page.tsx"
Cohesion: 0.11
Nodes (31): Student Progress: the only roster and learner drawer, isPeriod(), compareNumbers(), ForecastDetails(), forecastTone(), LearnerForecast(), outlookOf(), SavedForecastItem() (+23 more)

### Community 7 - "test_faculty_admin.py"
Cohesion: 0.05
Nodes (74): _trend(), QuestCard, ActivityKind, AuditEvent, CourseMember, GradingWorkerHeartbeat, ProgrammingLang, ResearchConsent (+66 more)

### Community 8 - "activities/[id]/page.tsx"
Cohesion: 0.05
Nodes (67): ActivityEditor(), confirmPublish(), createVersion(), diffPayload(), runVerification(), save(), saveSchedule(), validate() (+59 more)

### Community 9 - "start-bytequest.ps1"
Cohesion: 0.07
Nodes (42): ConvertTo-EncodedPowerShellCommand(), ConvertTo-PowerShellLiteral(), Get-BackendFingerprint(), Get-FrontendFingerprint(), Get-Judge0VmIPv4(), Get-Judge0VmIPv4FromNeighbor(), Get-ListenerPidMap(), Get-PageScriptPaths() (+34 more)

### Community 10 - "drafts.py"
Cohesion: 0.06
Nodes (70): admin_activities(), _admin_activity_item(), admin_dashboard(), _admin_material_items(), admin_materials(), course_reference_brief(), list_course_operations(), ActivityCreate (+62 more)

### Community 11 - "performance.py"
Cohesion: 0.11
Nodes (26): admin_user(), activity_analysis(), _first_try_questions(), gradebook(), student_performance(), practice_attempt_clause(), consented_student_ids(), account_course_access() (+18 more)

### Community 12 - "supabase.ts"
Cohesion: 0.09
Nodes (36): Durability Boundary & Concurrency Guarantees, Interrupted Exam Autosave & Browser Recovery (Checklist Item #3), cleared, localMap, mockLocalStorage, mockSessionStorage, remaining, storageMap (+28 more)

### Community 13 - "test_learning_flow_integration.py"
Cohesion: 0.05
Nodes (54): _chat_failure(), GeminiAPIError, test_chat_requires_active_enrollment_only_for_students(), _chat_payload(), _course_pdf(), _enroll_chat_students(), new_session(), _letters() (+46 more)

### Community 14 - "chat-workspace.tsx"
Cohesion: 0.17
Nodes (17): ChatPage(), useChat(), ChatConversation, ChatIcon(), ChatPanel(), ChatShell(), close(), ChatDialog() (+9 more)

### Community 15 - "dashboard/page.tsx"
Cohesion: 0.08
Nodes (30): activityHref(), closesIn(), Dashboard, DashboardContent(), DashboardPage(), kindLabel(), localTime(), Progress (+22 more)

### Community 16 - "rag_instructor.py"
Cohesion: 0.20
Nodes (12): _gemini_unavailable_http_exception(), generate_ai_coding_challenge(), generate_ai_conceptual_quiz(), _generation_payload(), _get_owned_activity(), _get_owned_document(), _may_manage_document(), _serialize_document() (+4 more)

### Community 17 - "exams/[id]/page.test.tsx"
Cohesion: 0.25
Nodes (5): answerSaves(), Call, mocks, savedBodies(), seedUnsyncedSnapshot()

### Community 18 - "entities.py"
Cohesion: 0.07
Nodes (19): CodeSubmissionRequest, run_code_submission(), _shadow_scoring_ready(), deliver_one(), _grade_item(), submission_passes(), finish_submission(), lock_submission_claim() (+11 more)

### Community 19 - "test_ml_exam_features.py"
Cohesion: 0.19
Nodes (8): _attempt(), test_adequacy_flags_a_small_test_partition(), test_faculty_forecast_uses_the_recorded_winner_and_hides_legacy_probability(), test_hint_exports_reject_identifying_columns(), test_older_feature_schema_artifacts_are_rejected(), test_rows_are_first_submissions_on_challenges_with_strictly_prior_history(), test_training_rejects_ids_that_encode_an_account(), _adequacy()

### Community 20 - "faculty_ml.py"
Cohesion: 0.06
Nodes (30): _accuracy(), _forecast(), api_health_check(), health_check(), lifespan(), readiness_check(), MLPrediction, record_prediction_outcome() (+22 more)

### Community 21 - "profiles.py"
Cohesion: 0.15
Nodes (23): ActivityDay, _admin_analytics(), AdminAnalytics, AnalyticsResponse, AuditEntry, BadgeEntry, complete_staff_setup(), _enum_value() (+15 more)

### Community 22 - "test_api_security.py"
Cohesion: 0.05
Nodes (23): Settings, Rule, window_bounds(), RequestSizeLimitMiddleware, limited_receive(), tracked_send(), _TooLarge, test_ai_global_budgets_are_independent() (+15 more)

### Community 23 - "sqlalchemy"
Cohesion: 0.09
Nodes (18): public_handle(), _starter_username(), _encoded_id(), is_starter_username(), starter_username(), pytest_sessionstart(), _export_queries(), test_documented_exports_require_latest_current_consent() (+10 more)

### Community 24 - "Session"
Cohesion: 0.05
Nodes (61): audit_events(), gamification_insights(), challenge(), choose_consent(), close_challenge(), consent_status(), ConsentChoice, dashboard() (+53 more)

### Community 25 - "6. Prioritized improvement backlog"
Cohesion: 0.08
Nodes (26): 1. Where the project stands, 2. Progress percentages and how they were calculated, 3. What exists today and where evidence stops, 4. Verification evidence and its limits, 5. Six gates before a live classroom pilot, 6. Prioritized improvement backlog, 7. Execution order, AI, LLM, RAG and provider handling (+18 more)

### Community 26 - "challenge_verification.py"
Cohesion: 0.33
Nodes (4): challenge_validation_fingerprint(), record_challenge_verification(), run_reference_check(), verify_saved_challenge()

### Community 27 - "submit_conceptual_quiz"
Cohesion: 0.11
Nodes (17): LeaderboardEntry, LeaderboardResponse, LeaderboardStanding, list_published_quests(), _load_quiz_questions(), NextStepRecommendation, ProgressAttempt, ProgressBadge (+9 more)

### Community 28 - "chat.py"
Cohesion: 0.06
Nodes (46): _chat_activity(), ChatLimits, ChatMessageRequest, ChatMessageResponse, ChatSource, ChatStatus, ChatTurn, _course_passages() (+38 more)

### Community 29 - "submission-comparison.tsx"
Cohesion: 0.17
Nodes (15): Editor, AttemptSummary(), CodeDiff(), loadEditor(), ComparedAttempt, Comparison, ComparisonResult(), isDesktop() (+7 more)

### Community 30 - "start_process"
Cohesion: 0.33
Nodes (4): restart_worker(), start_process(), stop_process(), wait_for_api()

### Community 31 - "workshop-home.tsx"
Cohesion: 0.06
Nodes (63): WorkshopDetailLayout(), WorkshopInvitePage(), WorkshopsPage(), useShellProfile(), ActivityDialog, ActivityEditor(), save(), ActivityLink (+55 more)

### Community 32 - "Prioritized defects"
Cohesion: 0.11
Nodes (18): 10. [P3] Hidden-case aggregate summary incorrectly reports zero, 1. [P1] A workshop can expose another instructor's course activity, 2. [P1] Verification can certify content that Judge0 never checked, 3. [P1] Unreleased exam successes can affect visible rewards, 4. [P1] The current release build exits with a dependency security warning, 5. [P2] Challenges with no visible sample can be published, 6. [P2] The dashboard recommends a closed quest that cannot be submitted, 7. [P2] Completing one exam can hide another due exam on the dashboard (+10 more)

### Community 33 - "onboarding/page.tsx"
Cohesion: 0.17
Nodes (21): AuthMode, OnboardingContent(), authenticate(), changeAuthMode(), continueToAgreement(), finishPasswordSetup(), OnboardingPage(), PasswordInput() (+13 more)

### Community 34 - "test_tutor_replies.py"
Cohesion: 0.27
Nodes (6): choose_tutor_turn(), _is_follow_up(), test_course_follow_up_uses_the_recent_topic_and_a_new_question_drops_it(), test_graded_context_always_uses_hint_mode(), test_tutor_sends_one_generation_with_the_expected_budget_and_logs_usage(), test_tutor_strips_unverified_markers_and_multi_page_citations()

### Community 35 - "asyncio"
Cohesion: 0.19
Nodes (11): cleanup(), main(), make_students(), one_student(), require_local(), run_load(), main(), student() (+3 more)

### Community 36 - "workspace-provider.tsx"
Cohesion: 0.18
Nodes (12): AdminLayout(), FacultyLayout(), ADMIN_SECTION_GROUPS, AdminSectionNav(), path, WorkspaceContext, WorkspaceContextValue, WorkspaceProvider() (+4 more)

### Community 37 - "leaderboard.tsx"
Cohesion: 0.20
Nodes (12): CHOOSE_HANDLE_HREF, Leaderboard(), LeaderboardData, LeaderboardEntry, LeaderboardStanding, LearnerName(), MEDAL, Row() (+4 more)

### Community 38 - "api.ts"
Cohesion: 0.04
Nodes (48): nextConfig, mocks, active, archived, mocks, mocks, monitoring, mocks (+40 more)

### Community 39 - "insights.py"
Cohesion: 0.09
Nodes (23): CategoryCount, course_insights(), _event_days(), GamificationInsights, HelpSeeking, _manila_day(), MemoryRetention, _rate() (+15 more)

### Community 40 - "numpy"
Cohesion: 0.17
Nodes (10): test_bootstrap_intervals_are_reproducible_and_resample_learners(), _bootstrap_intervals(), _build_pipeline(), _evaluate_partition(), _finite_or_none(), _fit_tuned_model(), _point_metrics(), _probability_for_success() (+2 more)

### Community 41 - "ml_predictor/feature_engineering.py"
Cohesion: 0.22
Nodes (7): _as_bool(), _before(), _enum_value(), extract_features_from_dataframe(), _frame(), _mean(), _rate()

### Community 42 - "4. Findings and implementation blueprint"
Cohesion: 0.08
Nodes (24): 1. Where ByteQuest stands, 2. How the system fits together, 3. Work order, 4. Findings and implementation blueprint, 5. Local completion checklist, 6. Which existing document answers which question, BQ-01 — Award completion XP at the first eligible event, BQ-02 — Give submission jobs one owner per claim (+16 more)

### Community 43 - "qa_live_multi_role.py"
Cohesion: 0.13
Nodes (23): api_base(), cleanup(), create_accounts(), instructor_builds_course(), letters(), main(), password_token(), print_report() (+15 more)

### Community 44 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 45 - "Classroom pilot fixes and verification — 2026-10-28"
Cohesion: 0.33
Nodes (5): Changes checked locally, Classroom pilot fixes and verification — 2026-10-28, Evidence, Other Remaining Pilot Verification Gates, Verification Status & Remaining Gates

### Community 46 - "A. Add more code challenges"
Cohesion: 0.15
Nodes (10): GeneratedChallengeSchema, GeneratedQuizOptionSchema, GeneratedQuizQuestionSchema, GeneratedQuizSchema, TestCaseSchema, 2. Exact code touchpoints, A. Add more code challenges, B. Expand Lessons Review (+2 more)

### Community 47 - "Faculty and administrator workspace — implementation log and continued work"
Cohesion: 0.11
Nodes (17): 10. Files created or modified (this work), 11. Quick current-state checklist, 1. Status at handoff, 6. Tests added, 7. Verification evidence (live app), 8. How to continue (commands, accounts, cleanup), 9. Remaining work, Additional navigation fix (+9 more)

### Community 48 - "package.json"
Cohesion: 0.11
Nodes (17): engines, node, name, overrides, dompurify, private, version, eslint (+9 more)

### Community 49 - "Phase 1 — ByteQuest instructor redesign plan"
Cohesion: 0.07
Nodes (29): Activity editor, Analytics, Analytics desktop, Analytics phone, API and data performance, Assumptions, Chart library and motion, Course data model and grade integrity (+21 more)

### Community 50 - "get_db"
Cohesion: 0.24
Nodes (10): _course_activities(), dashboard(), evaluation(), _faculty(), forecast_readiness(), _period_cutoff(), _snapshot(), student_detail() (+2 more)

### Community 51 - "AppTooltips"
Cohesion: 0.28
Nodes (17): AppTooltips(), clearTimers(), findTarget(), hide(), onClick(), onContextMenu(), onFocusIn(), onFocusOut() (+9 more)

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

### Community 57 - "course-shell.tsx"
Cohesion: 0.27
Nodes (9): WorkshopsLayout(), CourseNavigationLinks(), CourseSwitcher(), InstructorCourseShell(), InstructorShell(), MoreNavigation(), InstructorIcon(), instructorNavigation (+1 more)

### Community 58 - "LegalDocument"
Cohesion: 0.24
Nodes (9): metadata, Page(), metadata, Page(), LegalDocument(), LegalKind, LegalModal(), PolicyPanel() (+1 more)

### Community 59 - "test_error_explainer.py"
Cohesion: 0.17
Nodes (9): ErrorExplanationSchema, explain_code_error(), GeminiLLMService, test_concurrent_first_use_shares_the_gemini_transport(), second_caller(), test_disabled_gemini_refuses_before_opening_a_provider_client(), test_error_explanation_schema_validation(), test_explain_code_error_uses_structured_prompt_without_external_call() (+1 more)

### Community 60 - "Judge0Client"
Cohesion: 0.25
Nodes (7): _b64_decode(), _b64_encode(), Judge0Client, TestCaseInput, main(), publish_verified(), verify_compilers()

### Community 61 - "exams.py"
Cohesion: 0.10
Nodes (42): assigned(), assigned_exam_numbers(), _assigned_exams_with_state(), create_exam(), DraftExam, DraftItem, _exam_access(), exam_catalog() (+34 more)

### Community 62 - "profile/page.tsx"
Cohesion: 0.05
Nodes (65): Already in place: extend, do not rebuild, Shared insight widgets, Verification and rollout, Already in place: extend, do not rebuild, AccountPanel(), AdminSections(), ConsentStatus, habitsMessage() (+57 more)

### Community 63 - "useChatController"
Cohesion: 0.21
Nodes (19): requestAiHint(), turnMessages(), mapChatError(), useChatController(), applySavedReply(), canSend(), checkReply(), handleFailure() (+11 more)

### Community 64 - "ByteQuest machine-learning improvement plan"
Cohesion: 0.11
Nodes (18): 1. Goal, 2. Where things stand, 3. Decisions, 4.1 Prediction unit and label, 4.2 History, 4.3 The ten features, in this order, 4.4 Live shadow scoring, 4.5 Reporting (+10 more)

### Community 65 - "retrieval.py"
Cohesion: 0.13
Nodes (12): _retrieve_document_sources(), activity_document_ids(), _chat_excerpt(), cited_sources(), course_document_ids(), is_query_vector(), leading_chunks(), nearest_chunks() (+4 more)

### Community 66 - "train_compare.py"
Cohesion: 0.11
Nodes (9): _as_binary_label(), _atomic_joblib_dump(), _atomic_json_write(), _atomic_write(), _format_metric(), main(), run_training_and_comparison(), _select_winner() (+1 more)

### Community 67 - "ByteQuest 2.0 Classroom Pilot Operator Runbook"
Cohesion: 0.17
Nodes (12): 1. Hard Safety Gates (Enforced by Configuration), 2. Lab Station & Shared-Computer Protocol, 3. Network Resilience & Live Draft Sync, 4. Timed Exam Operations, 5. Verification Commands, 6. Incident Troubleshooting, ByteQuest 2.0 Classroom Pilot Operator Runbook, Classroom Wi-Fi Reconnect Banner (+4 more)

### Community 68 - "student-signup.ts"
Cohesion: 0.24
Nodes (12): checkSchoolIdAvailability(), checkUsernameAvailability(), isStudentSchoolId(), STUDENT_SCHOOL_ID_ERROR, STUDENT_SCHOOL_ID_PATTERN, checkStudentSignup(), Registration, SCHOOL_ID_TAKEN_ERROR (+4 more)

### Community 69 - "submissions/[id]/page.tsx"
Cohesion: 0.22
Nodes (12): Job, nextStarTip(), SubmissionStatusPage(), refresh(), retryGrading(), SubmissionResponse, MAX_STARS, SolveStars() (+4 more)

### Community 70 - "ByteQuest local end-to-end flow"
Cohesion: 0.12
Nodes (16): 8 Required Acceptance Checks, Account-synced progression check, Before deployment, ByteQuest local end-to-end flow, Exam Autosave & Conflict-Safe Recovery Verification, Instructor account, Local Quest Map demos, Manual startup (+8 more)

### Community 71 - "accessibility-provider.tsx"
Cohesion: 0.08
Nodes (29): Repo map: exact files to inspect and change, byteBounce, metadata, RootLayout(), viewport, ACCESSIBILITY_STORAGE_KEYS, AccessibilityContext, AccessibilityContextValue (+21 more)

### Community 72 - "ByteQuest 2.0"
Cohesion: 0.22
Nodes (9): Architecture, ByteQuest 2.0, Configuration and security, Documentation, Repository layout, Stack and deployment, Start locally on Windows, Test and verify (+1 more)

### Community 73 - "Judge0UnavailableError"
Cohesion: 0.17
Nodes (3): Judge0UnavailableError, sandbox_unavailable(), unavailable()

### Community 74 - "ByteQuest 2.0 — Full system review"
Cohesion: 0.08
Nodes (22): ByteQuest 2.0 engineering and UX review, Findings, Performance evidence, Recommended sequence, Verification and limits, ByteQuest 2.0 — Full system review, Evidence, Must fix (+14 more)

### Community 75 - "Phase 0 — ByteQuest instructor audit"
Cohesion: 0.22
Nodes (8): Current FastAPI inventory, Current screens and feature coverage, Decisions for Phase 1, Desktop scorecard, Findings, Phase 0 — ByteQuest instructor audit, Supabase data and authorization, Verification

### Community 76 - "StorageError"
Cohesion: 0.23
Nodes (5): StorageError, SupabasePDFStorage, test_accepts_absolute_signed_url_from_configured_origin(), test_rejects_untrusted_signed_url(), test_resolves_supabase_relative_signed_path()

### Community 78 - "ByteQuest 2.0 database review — 12 November 2026"
Cohesion: 0.14
Nodes (12): test_every_public_timestamp_column_is_aware(), A. Inventory, B. Findings, ByteQuest 2.0 database review — 12 November 2026, C. Migration plan, D. Index recommendations, End-to-end traces, F. Verification (+4 more)

### Community 79 - "Profile"
Cohesion: 0.07
Nodes (64): account_emails_for_email(), account_impact(), _account_needs_action(), AccountCreate, activity_impact(), _admin_activity(), admin_archive_activity(), admin_archive_material() (+56 more)

### Community 81 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, build, dev, lint, prebuild, predev, prestart, start (+3 more)

### Community 82 - "has_required_prediction_history"
Cohesion: 0.60
Nodes (3): has_required_prediction_history(), prior_graded_task_count(), test_prediction_history_counts_distinct_prior_tasks_not_retries()

### Community 83 - "ByteQuest 2.0: Master Architecture Plan & Execution Roadmap"
Cohesion: 0.08
Nodes (24): 1. Project Tracking & Thesis Collaboration Strategy, 2. Core Architectural Rules (Non-Negotiable), 3. Repository Directory Structure, 4. Course-Sequence & Curriculum Alignment, 5. Database Schema Blueprint (Supabase PostgreSQL + pgvector), 6. 7-Phase Development Plan, 7. Thesis Objectives Mapping (Chapter 1 Alignment), 8. Development Environment & Quickstart Commands (+16 more)

### Community 84 - "Phase 7 deployment readiness"
Cohesion: 0.18
Nodes (11): Decisions required before production setup, Deployment order after the decisions are made, Evidence still needed, Local Judge0 runtime smoke check (2026-10-26), Notes on local verification, Phase 7 deployment readiness, Prepared in the repository, Production settings and network boundaries (+3 more)

### Community 85 - "lib/types.ts"
Cohesion: 0.05
Nodes (51): 1. Current architecture, Existing API contracts, ExamCard, ExamsPage(), localTime(), QuestsPage(), QuestsPageContent(), changeView() (+43 more)

### Community 86 - "ProfileResponse"
Cohesion: 0.20
Nodes (5): complete_student_onboarding(), delete_my_avatar(), get_my_profile(), ProfileResponse, _require_student()

### Community 87 - "typing"
Cohesion: 0.12
Nodes (6): get_settings(), _client_for_key(), get_gemini_client(), _retry_after(), extract_chunks_from_pdf(), extract_pdf_chunks()

### Community 88 - "asyncio"
Cohesion: 0.21
Nodes (6): destroy(), main(), challenge_specs(), foundation_id(), main(), require_local()

### Community 89 - "arena.tsx"
Cohesion: 0.12
Nodes (27): ArenaPage(), Arena(), confirmResetCode(), endSegment(), handleCodeChange(), handleCopyOutput(), load(), onVisibilityChange() (+19 more)

### Community 90 - "workspace.ts"
Cohesion: 0.03
Nodes (92): Step A checkpoint and caller verification, 4.5 Administrator API (`backend/app/api/admin.py`, prefix `/api/v1/admin`), retry(), AnnouncementsPage(), revealReviewedHint(), AnnouncementDialog(), markErrors(), remove() (+84 more)

### Community 91 - "Instructor activity analysis and class announcements"
Cohesion: 0.33
Nodes (6): Activity analysis, Browser verification, Class announcements, Instructor activity analysis and class announcements, Remaining verification, Verification

### Community 92 - "Desktop and Mobile Pilot Flows (`pilot-v2.html`)"
Cohesion: 0.22
Nodes (8): 1. Offline / Network Reconnect Banner, 2. Pending / Queued Grading State, 3. Research Consent & Withdrawal State (Disabled Collection Notice), 4. Active Exam Priority Banner & Timed Attempt Lock, ByteQuest web app wireframes, Coverage, Desktop and Mobile Pilot Flows (`pilot-v2.html`), Review checklist

### Community 93 - "dockable-navigation.tsx"
Cohesion: 0.08
Nodes (30): Already in place: extend, do not rebuild, Goal, Layout system, Make ByteQuest fit every phone and tablet, Menu docking: finish what exists, Out of scope, Screens, Side navigation on handheld screens: already built (+22 more)

### Community 94 - "upload_my_avatar"
Cohesion: 0.24
Nodes (4): _detect_avatar_content_type(), upload_my_avatar(), test_detect_avatar_content_type_recognizes_supported_signatures(), test_detect_avatar_content_type_rejects_metadata_only_and_truncated_files()

### Community 95 - "next"
Cohesion: 0.10
Nodes (32): WorkspaceLayout(), AccountMenu(), subscribeToSheetBreakpoint(), usesAccountSheet(), AppShell(), AuthenticatedLayout(), isActiveDestination(), ProfileContext (+24 more)

### Community 96 - "profile_attention.py"
Cohesion: 0.27
Nodes (4): account_needs_action(), membership_rows(), personal_audit(), role_value()

### Community 97 - "ML pipeline synthetic verification — 2026-10-25"
Cohesion: 0.29
Nodes (6): Artifact and activation checks, Execution, ML pipeline synthetic verification — 2026-10-25, Observed grouped metrics, Remaining Phase 5 work, Scope

### Community 98 - "codex.py"
Cohesion: 0.12
Nodes (15): ChallengeRecovery, codex_summary(), CodexCategory, CodexRecovery, CodexResponse, CodexSummary, practice_errors(), recoveries() (+7 more)

### Community 99 - "preflight-host.sh"
Cohesion: 0.38
Nodes (6): fail(), MIN_MEMORY_BYTES, MIN_ROOT_FREE_BYTES, MIN_SWAP_BYTES, pass(), preflight-host.sh script

### Community 100 - "Phase 6 shadow rollout implementation record"
Cohesion: 0.40
Nodes (5): Implemented, Phase 6 shadow rollout implementation record, Phase 7 handoff, Safety and current state, Verification still required

### Community 101 - "httpx"
Cohesion: 0.26
Nodes (9): _evaluate(), _failed_sample(), main(), _request(), TutorCase, cleanup(), evaluate(), main() (+1 more)

### Community 102 - "ML feature engineering and training"
Cohesion: 0.40
Nodes (5): Comparison protocol, Export an attempt dataset, ML feature engineering and training, Prepare an Ubuntu VPS, Safe pipeline setup

### Community 103 - "monitoring.py"
Cohesion: 0.15
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

### Community 107 - "ByteQuest UI/UX harmonization: slices 1–3 and ML slice planning"
Cohesion: 0.15
Nodes (12): Bugs found and fixed, ByteQuest UI/UX harmonization: slices 1–3 and ML slice planning, Checkpoint, Decisions made today, How it was checked, Next steps, Not checked, Slice 1: shared foundation and help (+4 more)

### Community 108 - "Judge0 Hyper-V Ubuntu boot incident and recovery"
Cohesion: 0.13
Nodes (15): 1. Start and open the known-good VM, 2. Confirm the Judge0 services and volume inside Ubuntu, 3. Get the current guest IP and check the port, 4. Update ByteQuest if the VM IP changed, 5. Restart FastAPI and leave it running, 6. Verify service integration without exposing secrets, Current verified state, Disk and data safety (+7 more)

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

### Community 116 - "test_profile_analytics.py"
Cohesion: 0.26
Nodes (8): _add_audit(), _analytics(), test_each_role_receives_only_its_own_branch(), test_existing_admin_fields_remain_compatible(), test_existing_instructor_fields_remain_compatible(), test_faculty_without_courses_gets_a_calm_fallback(), test_personal_timeline_only_includes_own_actions(), test_student_branch_has_no_staff_fields()

### Community 117 - "judge0/__init__.py"
Cohesion: 0.17
Nodes (4): BatchEvaluationSummary, CircuitBreaker, Judge0CircuitOpenError, SingleTestResult

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
Cohesion: 0.09
Nodes (29): Badge, DocumentChunk, StudentBadge, TestCase, award_badges(), evaluate_and_award_badges(), _qualifies(), _requirement_for() (+21 more)

### Community 124 - "getErrorMessage"
Cohesion: 0.05
Nodes (54): ConsentStatus, ResearchConsentSettingsPage(), ExamsPage(), ExamInfo, ExamPage(), handleRunSample(), handleStartExam(), hydrateAndReconcileOnce() (+46 more)

### Community 126 - "ByteQuest 2.0 system critique — 21 November 2026"
Cohesion: 0.22
Nodes (9): ByteQuest 2.0 system critique — 21 November 2026, Findings by severity, Implementation status (21 November 2026, same day), Low, Not verified in this review, Scorecard, Top 5 things to do next, Verdict (+1 more)

### Community 127 - "Judge0 Hyper-V Ubuntu VM: troubleshooting handoff"
Cohesion: 0.22
Nodes (6): Code and quality checks, Corrected Lesson to Student Progress Verification, Earlier student workflow verification (historical run), Environment and source, Follow-up and known boundaries, Instructor workflow

### Community 128 - "ByteQuest manuscript and system alignment checklist"
Cohesion: 0.20
Nodes (10): 1. Scope decisions, 2. Chapter 1 — Introduction and scope, 3. Chapter 2 — Literature and synthesis, 4. Chapter 3 — Roles, practice, and AI, 5. Chapter 3 — Assessment and architecture, 6. Chapter 3 — Consent, research data, and ML, 7. Study records and final sign-off, ByteQuest manuscript and system alignment checklist (+2 more)

### Community 132 - "test_sandbox_internal_error_is_unavailability_not_a_student_failure"
Cohesion: 0.28
Nodes (5): test_hidden_case_contributes_to_score_without_exposing_details(), language_ids(), poll_batch(), submit_batch(), test_sandbox_internal_error_is_unavailability_not_a_student_failure()

### Community 133 - "ByteQuest 2.0 live deployment stack"
Cohesion: 0.40
Nodes (5): Before the 30-student session, ByteQuest 2.0 live deployment stack, PHP budget, What ByteQuest runs, What to pay for

### Community 134 - "home-redirect.tsx"
Cohesion: 0.23
Nodes (10): checkExistingAuth(), HomePage(), FEATURED_SLIDES, FeaturedQuestWindow(), FeaturedSlide, destinationFor(), HomeRedirect(), consumeInviteCallback() (+2 more)

### Community 135 - "ML features and prediction unit: manuscript vs. code"
Cohesion: 0.40
Nodes (5): 1. The two feature sets, 2. The prediction unit and label, 3. Decisions for the adviser, 4. Files that would change, ML features and prediction unit: manuscript vs. code

### Community 136 - "ByteQuest KVM 2 live pilot"
Cohesion: 0.40
Nodes (5): Before provisioning, ByteQuest KVM 2 live pilot, Configure and start the stack, Decide whether to start the classroom pilot, Local verification on 20 November 2026

### Community 137 - "Step C — Instructor visual verification"
Cohesion: 0.33
Nodes (6): Current routes and behavior, Phase 2 API and rollout list, Reference tokens and icons, Screenshot comparisons, Step C — Instructor visual verification, Test target checks

### Community 138 - "ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash"
Cohesion: 0.17
Nodes (10): _serialize_challenge(), Behavior and scope of the assistant, ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash, Placement and responsive layout, Product decision, Quality gates and acceptance tests, Ready-to-paste DeepSeek V4.1 Flash implementation prompt, State and error rules (+2 more)

### Community 139 - "ByteQuest — Security & AI-Abuse Hardening (implementation brief)"
Cohesion: 0.05
Nodes (31): get_current_user_payload(), TokenPayload, auth(), verify(), claims(), test_es256_verifies_locally_off_the_event_loop(), test_failed_jwks_verification_falls_back(), test_non_asymmetric_algorithms_never_use_jwks() (+23 more)

### Community 140 - "FastAPI"
Cohesion: 0.16
Nodes (12): AnnouncementCreate, AnnouncementExpiry, AnnouncementPatch, _audit_change(), _authorize_announcement(), create_announcement(), delete_announcement(), list_announcements() (+4 more)

### Community 141 - "Judge0 Hyper-V Ubuntu VM: troubleshooting handoff"
Cohesion: 0.22
Nodes (9): Confirmed project and Judge0 setup, Current state, Direct-shell recovery method that worked, Historical recommendation written before the Install VM recovery, Judge0 Hyper-V Ubuntu VM: troubleshooting handoff, Known guest settings and identifiers, Sources, Timeline of important events and changes (+1 more)

### Community 142 - "Local API security contract"
Cohesion: 0.40
Nodes (5): Access matrix, Local API security contract, Local verification and future deployment, Quotas and validation, School-issued IDs for student sign-up

### Community 143 - "prepare_ml_dataset"
Cohesion: 0.20
Nodes (9): _check_columns(), _encodes_account_id(), generate_synthetic_thesis_dataset(), prepare_ml_dataset(), _require_pseudonymous(), _sort_attempts(), _strip_text(), _validate_hint_frame() (+1 more)

### Community 146 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, monaco-editor, @monaco-editor/react, next, react, react-dom, react-is, recharts (+1 more)

### Community 148 - "ActivityAttempt"
Cohesion: 0.13
Nodes (31): ActivityAttempt, ChallengeHint, Exam, ExamAssignment, ExamAttempt, HintUse, claim_exam(), ExamGradingClaim (+23 more)

### Community 149 - "test_judge0_privacy.py"
Cohesion: 0.32
Nodes (4): classify_judge0_status(), _parse_completed_result(), metric(), test_program_crash_is_still_graded_as_a_runtime_error()

### Community 150 - "submissions/[id]/page.test.tsx"
Cohesion: 0.29
Nodes (4): currentAttempt, mocks, oldSubmission, previousAttempt

### Community 151 - "performance/page.tsx"
Cohesion: 0.05
Nodes (59): Activity health in the Activities list, ByteQuest Insights, part 3 of 4: instructors, Exam class summary, Goal, Handheld rules, Inactive 7+ days, Model evaluation, Out of scope (+51 more)

### Community 152 - "update_my_profile"
Cohesion: 0.33
Nodes (3): ProfileUpdateRequest, update_my_profile(), normalize_username()

### Community 153 - "generate_embedding"
Cohesion: 0.40
Nodes (3): embed_one(), GeminiEmbeddingService, generate_embedding()

### Community 154 - "flow"
Cohesion: 0.25
Nodes (3): flow(), cleanup(), override_db()

### Community 158 - "1. Current architecture"
Cohesion: 0.40
Nodes (4): 3. Recommended implementation order, 4. Ready-to-paste prompt for DeepSeek V4.1 Flash, 5. Manual acceptance checklist, ByteQuest 2.0: implementation guide and DeepSeek V4.1 Flash prompt

### Community 160 - "Workshops: Create, Join and the Workshop page"
Cohesion: 0.20
Nodes (10): 10. Decisions to critique, 1. What exists today, 2. Screen map, 3. Rules, 5. API changes (all under `/api/v1/workshops`), 6. Frontend structure, 7. Delivery slices (each ships with tests), 8. Out of scope for v1 (+2 more)

### Community 162 - "app-tooltips.tsx"
Cohesion: 0.50
Nodes (4): hasVisibleText(), tooltipFor(), TooltipState, react-dom

### Community 164 - "Phase 7 backend image build verification"
Cohesion: 0.40
Nodes (4): Limits, Phase 7 backend image build verification, Recorded evidence, Work completed

### Community 165 - "ByteQuest 2.0: close the manuscript gaps, tidy the structure, then review and rate the system"
Cohesion: 0.14
Nodes (11): RFC-4122, ByteQuest 2.0: close the manuscript gaps, tidy the structure, then review and rate the system, Do not, Final report, Hard rules, Part 3: Code structure (targeted; behaviour must stay identical), Part 4: Review and targeted fixes, Stack and layout (+3 more)

### Community 166 - "ByteQuest Insights, part 1 of 4: shared foundation"
Cohesion: 0.20
Nodes (9): ByteQuest Insights, part 1 of 4: shared foundation, Charts: two primitives, Goal, Handheld rules, Metric labels, Out of scope, Profile: one role tab, each figure once, Remove the duplicate Sequencer evaluation (+1 more)

### Community 167 - "instructor/page.tsx"
Cohesion: 0.07
Nodes (67): Already in place: extend, do not rebuild, One kit: course-ui, Medium, Page(), CourseInsights(), Insights(), ModelEvaluation(), CourseWorkspace() (+59 more)

### Community 168 - "Milestones 1A–1C Status and Verification Log"
Cohesion: 0.22
Nodes (9): Environment, Follow-up verification — 2026-10-25, Milestone 1A: Judge0 execution, Milestone 1B: Local Supabase schema and fixtures, Milestone 1C: Browser-to-database walkthrough — Complete, verified, Milestones 1A–1C Status and Verification Log, Official milestone disposition, Submission-flow corrections made (+1 more)

### Community 169 - "ByteQuest Insights, part 2 of 4: students"
Cohesion: 0.22
Nodes (8): ByteQuest Insights, part 2 of 4: students, Goal, Handheld rules, One badge list, Out of scope, Score trend and breakdowns, Topic practice links, Verification and rollout

### Community 170 - "Phase 7 frontend build evidence"
Cohesion: 0.50
Nodes (3): Command and result, Phase 7 frontend build evidence, Scope and limits

### Community 171 - "Phase 7 Vercel setup verification — 2026-10-26"
Cohesion: 0.50
Nodes (3): Evidence and limits, Phase 7 Vercel setup verification — 2026-10-26, Verified state

### Community 172 - "ByteQuest system status — 21 November 2026"
Cohesion: 0.40
Nodes (5): ByteQuest system status — 21 November 2026, Checkout, runtime and release, Machine learning — status on 11/21/26, Verification and remaining checks, What changed

### Community 173 - "Phase 7 dependency security review (2026-10-26)"
Cohesion: 0.33
Nodes (5): Findings and changes, Phase 7 dependency security review (2026-10-26), Remaining checks and limits, Scope, Verification performed

### Community 174 - "reviews.py"
Cohesion: 0.08
Nodes (45): get_review(), get_reviews(), _locked_student(), _public_review(), _question_id(), _require_memory(), ReviewOverviewResponse, ReviewResponse (+37 more)

### Community 176 - "Phase 7 synthetic deployment preflight — 2026-10-26"
Cohesion: 0.33
Nodes (5): Evidence, Limits, Phase 7 synthetic deployment preflight — 2026-10-26, Result, Scope and method

### Community 179 - "Production instructor access"
Cohesion: 0.67
Nodes (3): Grant access to one account, Production instructor access, Safety boundaries

### Community 188 - "qa_mixed_exam_load.py"
Cohesion: 0.12
Nodes (6): ensure_student(), letters(), main(), student_account(), utcnow(), held_grade()

### Community 189 - "course_access.py"
Cohesion: 0.08
Nodes (29): _may_manage_activity(), get_current_user(), require_instructor(), active_membership_course_ids(), courses_for_user(), default_instructor_course_id(), ensure_owned_or_admin(), has_course_role() (+21 more)

## Knowledge Gaps
- **18 isolated node(s):** `monaco-editor`, `react-is`, `@types/node`, `@types/react`, `@types/react-dom` (+13 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1414 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `4. Read these before writing any code` connect `LearningActivity` to `ui.tsx`, `Session`, `test_faculty_admin.py`, `submit_conceptual_quiz`, `reviews.py`, `ActivityAttempt`, `profiles.py`, `test_judge0_privacy.py`, `Session`, `flow`, `seed_local_showcase_activity.py`, `profile/page.tsx`?**
  _High betweenness centrality (0.183) - this node is a cross-community bridge._
- **Are the 296 inferred relationships involving `Profile` (e.g. with `account_impact()` and `_account_needs_action()`) actually correct?**
  _`Profile` has 296 INFERRED edges - model-reasoned connections that need verification._
- **What connects `monaco-editor`, `react-is`, `@types/node` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ui.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05741935483870968 - nodes in this community are weakly interconnected._
- **Why does `LearningActivity` connect `LearningActivity` to `Session`, `workshops.py`, `test_faculty_admin.py`, `drafts.py`, `performance.py`, `ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash`, `test_learning_flow_integration.py`, `rag_instructor.py`, `entities.py`, `faculty_ml.py`, `profiles.py`, `ActivityAttempt`, `Session`, `challenge_verification.py`, `submit_conceptual_quiz`, `chat.py`, `asyncio`, `insights.py`, `reviews.py`, `get_db`, `Judge0Client`, `course_access.py`, `exams.py`, `retrieval.py`, `Profile`, `has_required_prediction_history`, `lib/types.ts`, `asyncio`, `codex.py`, `httpx`, `monitoring.py`, `seed_local_showcase_activity.py`?**
  _High betweenness centrality (0.131) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `Session` (e.g. with `smoke_demo_quest()` and `test_two_concurrent_saves_cannot_commit_the_same_activity_version()`) actually correct?**
  _`Session` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Should `Session` be split into smaller, more focused modules?**
  _Cohesion score 0.10482180293501048 - nodes in this community are weakly interconnected._