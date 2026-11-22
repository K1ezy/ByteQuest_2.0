# Graph Report - ByteQuest_2.0  (2026-11-21)

## Corpus Check
- 465 files · ~505,231 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 38 file(s) not represented in the graph (top: (none) 19, .bat 5, .example 5)

## Summary
- 4223 nodes · 14159 edges · 190 communities (162 shown, 28 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 1868 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5e3602b0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ui.tsx
- ByteQuest 2.0: instructor activity analysis and class announcements
- Session
- _token
- workshops.py
- chat-shell.tsx
- LearningActivity
- test_faculty_admin.py
- activities/[id]/page.tsx
- start-bytequest.ps1
- drafts.py
- drafts.py
- supabase.ts
- _enroll_chat_students
- attempt_visibility.py
- faculty_ml.py
- account-menu.tsx
- exams/[id]/page.test.tsx
- entities.py
- test_ml_exam_features.py
- predictor.py
- profiles.py
- test_api_security.py
- sqlalchemy
- get
- 6. Prioritized improvement backlog
- entities.py
- submit_conceptual_quiz
- chat_history.py
- CodeDiff
- activity-analysis.tsx
- workshop-home.tsx
- Prioritized defects
- onboarding/page.tsx
- chat.py
- test_auth_jwks.py
- workspace-provider.tsx
- leaderboard.tsx
- vitest
- insights.py
- numpy
- ml_predictor/feature_engineering.py
- 4. Findings and implementation blueprint
- qa_mixed_exam_load.py
- compilerOptions
- Classroom pilot fixes and verification — 2026-10-28
- run_training_and_comparison
- Faculty and administrator workspace — implementation log and continued work
- package.json
- Phase 1 — ByteQuest instructor redesign plan
- get
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
- profile/page.tsx
- useChatController
- ByteQuest machine-learning improvement plan
- rag_instructor.py
- train_compare.py
- ByteQuest 2.0 Classroom Pilot Operator Runbook
- _TooLarge
- test_gamification_insights_are_course_scoped_class_aggregates
- ByteQuest local end-to-end flow
- accessibility-provider.tsx
- ByteQuest 2.0
- ProgrammingLang
- ByteQuest 2.0 — Full system review
- Phase 0 — ByteQuest instructor audit
- StorageError
- submission_jobs.py
- ByteQuest 2.0 database review — 12 November 2026
- Session
- SYSTEM_STATUS_AND_RELEASE_PLAN.md
- qa_live_multi_role.py
- codex.py
- ByteQuest 2.0: Master Architecture Plan & Execution Roadmap
- Phase 7 deployment readiness
- lib/types.ts
- arena.tsx
- chat-workspace.tsx
- asyncio
- generate_embedding
- workspace.ts
- Instructor activity analysis and class announcements
- Desktop and Mobile Pilot Flows (`pilot-v2.html`)
- workspace-provider.test.tsx
- ByteQuest Insights, part 4 of 4: administrators
- app-shell.tsx
- quiz-view.tsx
- ML pipeline synthetic verification — 2026-10-25
- 5. Slices
- preflight-host.sh
- Phase 6 shadow rollout implementation record
- qa_starter_tutoring.py
- ML feature engineering and training
- monitoring.py
- ByteQuest Gemini tutor pilot evaluation
- Arena
- ByteQuest navigation
- ProgrammingLang
- ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash
- zerotier-relay.mjs
- Python demo journey — 2026-10-28
- Phase 7 local production-mode runtime verification
- ByteQuest 2.0 system status and weekly change log
- scripts
- Local API security verification — 2026-10-28
- Phase 7 database pool budget hardening
- test_profile_analytics.py
- Judge0CircuitOpenError
- ByteQuest 2.0 before and after
- smoke-vps.sh
- ByteQuest pilot remediation checklist
- preflight-vps.sh
- 4. Read these before writing any code
- newRequestId
- ByteQuest 2.0 system critique — 21 November 2026
- Judge0 Hyper-V Ubuntu boot incident and recovery
- ByteQuest manuscript and system alignment checklist
- devDependencies
- ByteQuest 2.0 live deployment stack
- home-redirect.tsx
- ML features and prediction unit: manuscript vs. code
- ByteQuest KVM 2 live pilot
- Step C — Instructor visual verification
- ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash
- Phase 7 database and file backup/restore runbook
- FastAPI
- settings_service.py
- Local API security contract
- prepare_ml_dataset
- MLPrediction
- test_learning_flow_integration.py
- ByteQuest 2.0 — Review remediation plan
- runner_status
- performance/page.tsx
- chat-provider.test.tsx
- dependencies
- app/layout.tsx
- destroy_research_link.py
- retrieval.py
- ByteQuest 2.0 engineering and UX review
- audit_events
- ByteQuest backend runtime review
- plot.tsx
- app-tooltips.tsx
- ByteQuest 2.0: close the manuscript gaps, tidy the structure, then review and rate the system
- Phase 7 backend image build verification
- runCode
- ByteQuest Insights, part 1 of 4: shared foundation
- instructor/page.tsx
- problem-statement.ts
- ByteQuest Insights, part 2 of 4: students
- Phase 7 frontend build evidence
- Phase 7 Vercel setup verification — 2026-10-26
- ByteQuest system status — 21 November 2026
- Phase 7 dependency security review (2026-10-26)
- reviews.py
- Phase 7 synthetic deployment preflight — 2026-10-26
- CLAUDE.md
- Production instructor access
- _fit_baselines
- frontend/AGENTS.md

## God Nodes (most connected - your core abstractions)
1. `Session` - 352 edges
2. `Profile` - 345 edges
3. `LearningActivity` - 217 edges
4. `getErrorMessage()` - 140 edges
5. `ActivityAttempt` - 120 edges
6. `apiRequest()` - 117 edges
7. `ReviewState` - 110 edges
8. `ProgrammingLang` - 94 edges
9. `UserRole` - 92 edges
10. `ActivityKind` - 87 edges

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

## Communities (190 total, 28 thin omitted)

### Community 0 - "ui.tsx"
Cohesion: 0.08
Nodes (76): Design system and data flow, Frontend, Stack and layout, 5.1 Shared library and components, AdminAccounts(), submitCreate(), Page(), AdminActivities() (+68 more)

### Community 1 - "ByteQuest 2.0: instructor activity analysis and class announcements"
Cohesion: 0.17
Nodes (11): ByteQuest 2.0: instructor activity analysis and class announcements, Database, Double-check before you report, Final report, Frontend, Hard rules, Part 1: Activity analysis, Part 2: Class announcements (+3 more)

### Community 2 - "Session"
Cohesion: 0.09
Nodes (43): _admin_material_items(), admin_materials(), admin_retry_material(), admin_update_material(), monitoring(), patch_setting(), retry_job(), _material_for_user() (+35 more)

### Community 3 - "_token"
Cohesion: 0.12
Nodes (33): ChallengeHint, HintUse, _challenge(), _graded_job(), _published_activity(), _reveal_reviewed_hint(), test_a_closed_challenge_cannot_reopen_after_its_solution_was_shown(), test_chat_uses_only_safe_public_activity_context() (+25 more)

### Community 4 - "workshops.py"
Cohesion: 0.12
Nodes (52): _activity_links(), _announcement_for_update(), AnnouncementView, archive_workshop(), can_manage(), create_workshop(), CreateAnnouncement, CreateWorkshop (+44 more)

### Community 5 - "chat-shell.tsx"
Cohesion: 0.27
Nodes (8): ChatConversation, ChatIcon(), ChatPanel(), ChatShell(), close(), subscribeToBreakpoint(), useChatViewport(), useCompactChatLayout()

### Community 6 - "LearningActivity"
Cohesion: 0.15
Nodes (36): ActivityAttempt, LearningActivity, ReviewState, test_prediction_history_counts_distinct_prior_tasks_not_retries(), new_session(), _quiz(), _recall_concept(), _review_and_publish() (+28 more)

### Community 7 - "test_faculty_admin.py"
Cohesion: 0.09
Nodes (37): AuditEvent, ResearchConsent, test_account_creation_provisions_a_profile_and_course_access(), test_activity_analysis_totals_and_practice_scope(), admin_row(), test_activity_editor_preview_hides_answer_keys_and_hidden_tests(), test_admin_course_health_suppresses_small_groups_and_restricts_access(), test_admin_creates_course_and_duplicate_code_is_rejected() (+29 more)

### Community 8 - "activities/[id]/page.tsx"
Cohesion: 0.05
Nodes (73): ActivityEditor(), confirmPublish(), createVersion(), diffPayload(), runVerification(), save(), saveSchedule(), validate() (+65 more)

### Community 9 - "start-bytequest.ps1"
Cohesion: 0.07
Nodes (42): ConvertTo-EncodedPowerShellCommand(), ConvertTo-PowerShellLiteral(), Get-BackendFingerprint(), Get-FrontendFingerprint(), Get-Judge0VmIPv4(), Get-Judge0VmIPv4FromNeighbor(), Get-ListenerPidMap(), Get-PageScriptPaths() (+34 more)

### Community 10 - "drafts.py"
Cohesion: 0.12
Nodes (29): ActivityCreate, ActivityUpdate, create_activity(), create_activity_version(), get_activity(), _grading_fields(), preview_activity(), publish_activity() (+21 more)

### Community 11 - "drafts.py"
Cohesion: 0.09
Nodes (43): admin_dashboard(), list_course_operations(), list_activity_workspace(), _activity_brief(), _course_brief(), _draft_item(), _draft_response(), faculty_user() (+35 more)

### Community 12 - "supabase.ts"
Cohesion: 0.07
Nodes (45): 8 Required Acceptance Checks, Durability Boundary & Concurrency Guarantees, Exam Autosave & Conflict-Safe Recovery Verification, Interrupted Exam Autosave & Browser Recovery (Checklist Item #3), cleared, localMap, mockLocalStorage, mockSessionStorage (+37 more)

### Community 13 - "_enroll_chat_students"
Cohesion: 0.06
Nodes (38): DocumentChunk, GeminiAPIError, test_chat_requires_active_enrollment_only_for_students(), workspace(), cleanup(), new_session(), override_db(), _chat_payload() (+30 more)

### Community 14 - "attempt_visibility.py"
Cohesion: 0.18
Nodes (11): dashboard(), activity_accepts_submissions_clause(), activity_has_opened(), activity_is_closed(), _as_utc(), learner_visible_attempt_clause(), published_track_clause(), student_visible_activity_clause() (+3 more)

### Community 15 - "faculty_ml.py"
Cohesion: 0.18
Nodes (15): _accuracy(), _course_activities(), dashboard(), evaluation(), _faculty(), forecast_readiness(), _period_cutoff(), _snapshot() (+7 more)

### Community 16 - "account-menu.tsx"
Cohesion: 0.15
Nodes (17): 5.2 Faculty routes, 5.3 Administrator routes, 5.4 Navigation and shell integration, 5. Frontend changes, AccessibilityPage(), AccessibilityPreferenceKey, ACCESSIBILITY_SETTINGS, AccessibilitySettingDefinition (+9 more)

### Community 17 - "exams/[id]/page.test.tsx"
Cohesion: 0.25
Nodes (5): answerSaves(), Call, mocks, savedBodies(), seedUnsyncedSnapshot()

### Community 18 - "entities.py"
Cohesion: 0.08
Nodes (19): CodeSubmissionRequest, run_code_submission(), _shadow_scoring_ready(), SubmissionJob, deliver_one(), attempt_quality(), submission_passes(), finish_submission() (+11 more)

### Community 19 - "test_ml_exam_features.py"
Cohesion: 0.16
Nodes (11): _forecast(), _attempt(), test_adequacy_flags_a_small_test_partition(), test_faculty_forecast_uses_the_recorded_winner_and_hides_legacy_probability(), test_hint_exports_reject_identifying_columns(), test_older_feature_schema_artifacts_are_rejected(), test_rows_are_first_submissions_on_challenges_with_strictly_prior_history(), test_training_rejects_ids_that_encode_an_account() (+3 more)

### Community 20 - "predictor.py"
Cohesion: 0.06
Nodes (26): api_health_check(), health_check(), lifespan(), readiness_check(), load_ml_models(), ModelArtifactError, ModelArtifactsUnavailable, ModelBundle (+18 more)

### Community 21 - "profiles.py"
Cohesion: 0.06
Nodes (38): ActivityDay, _admin_analytics(), AdminAnalytics, AnalyticsResponse, AuditEntry, BadgeEntry, complete_staff_setup(), complete_student_onboarding() (+30 more)

### Community 22 - "test_api_security.py"
Cohesion: 0.05
Nodes (27): Settings, reserve(), Rule, window_bounds(), extract_chunks_from_pdf(), extract_pdf_chunks(), test_ai_global_budgets_are_independent(), test_chat_has_dedicated_account_and_global_quota() (+19 more)

### Community 23 - "sqlalchemy"
Cohesion: 0.09
Nodes (18): public_handle(), _starter_username(), _encoded_id(), is_starter_username(), starter_username(), pytest_sessionstart(), _export_queries(), test_documented_exports_require_latest_current_consent() (+10 more)

### Community 24 - "get"
Cohesion: 0.08
Nodes (47): admin_user(), exam_catalog(), instructor_exams(), challenge(), choose_consent(), close_challenge(), consent_status(), ConsentChoice (+39 more)

### Community 25 - "6. Prioritized improvement backlog"
Cohesion: 0.08
Nodes (26): 1. Where the project stands, 2. Progress percentages and how they were calculated, 3. What exists today and where evidence stops, 4. Verification evidence and its limits, 5. Six gates before a live classroom pilot, 6. Prioritized improvement backlog, 7. Execution order, AI, LLM, RAG and provider handling (+18 more)

### Community 26 - "entities.py"
Cohesion: 0.11
Nodes (31): add_workshop_activities(), AddWorkshopActivities, ActivityKind, TestCase, UserRole, WorkshopActivity, apply_publish_rules(), lock_activity_for_publication() (+23 more)

### Community 27 - "submit_conceptual_quiz"
Cohesion: 0.06
Nodes (28): get_gamification_leaderboard(), get_student_progress(), LeaderboardEntry, LeaderboardResponse, LeaderboardStanding, list_published_quests(), _load_quiz_questions(), NextStepRecommendation (+20 more)

### Community 28 - "chat_history.py"
Cohesion: 0.13
Nodes (29): ChatMessageRequest, ChatMessageResponse, ChatSource, ChatTurn, _check_revision(), Conversation, ConversationPage, create_conversation() (+21 more)

### Community 29 - "CodeDiff"
Cohesion: 0.40
Nodes (6): Editor, CodeDiff(), loadEditor(), isDesktop(), subscribeToDesktop(), @monaco-editor/react

### Community 30 - "activity-analysis.tsx"
Cohesion: 0.08
Nodes (43): Already in place: extend, do not rebuild, Course health on System Overview, Already in place: extend, do not rebuild, Shared insight widgets, Verification and rollout, Already in place: extend, do not rebuild, Page(), READINESS_MESSAGES (+35 more)

### Community 31 - "workshop-home.tsx"
Cohesion: 0.04
Nodes (80): ConsentStatus, WorkshopDetailLayout(), WorkshopInvitePage(), WorkshopsPage(), useShellProfile(), Hint, ActivityDialog, ActivityEditor() (+72 more)

### Community 32 - "Prioritized defects"
Cohesion: 0.12
Nodes (17): 10. [P3] Hidden-case aggregate summary incorrectly reports zero, 2. [P1] Verification can certify content that Judge0 never checked, 3. [P1] Unreleased exam successes can affect visible rewards, 4. [P1] The current release build exits with a dependency security warning, 5. [P2] Challenges with no visible sample can be published, 6. [P2] The dashboard recommends a closed quest that cannot be submitted, 7. [P2] Completing one exam can hide another due exam on the dashboard, 8. [P2] A failed quiz is labeled completed (+9 more)

### Community 33 - "onboarding/page.tsx"
Cohesion: 0.11
Nodes (37): AuthMode, OnboardingContent(), authenticate(), changeAuthMode(), checkExistingAuth(), continueToAgreement(), finishPasswordSetup(), OnboardingPage() (+29 more)

### Community 34 - "chat.py"
Cohesion: 0.09
Nodes (22): _chat_activity(), ChatLimits, ChatStatus, _course_passages(), create_chat_message(), generate_chat_reply(), _generate_chat_reply(), get_chat_status() (+14 more)

### Community 35 - "test_auth_jwks.py"
Cohesion: 0.13
Nodes (6): get_current_user_payload(), TokenPayload, test_es256_verifies_locally_off_the_event_loop(), test_failed_jwks_verification_falls_back(), test_non_asymmetric_algorithms_never_use_jwks(), Task 3 — Verify Supabase's asymmetric JWTs locally (performance)

### Community 36 - "workspace-provider.tsx"
Cohesion: 0.20
Nodes (12): AdminLayout(), FacultyLayout(), AdminSectionNav(), SECTIONS, WorkspaceContext, WorkspaceContextValue, WorkspaceProvider(), Profile (+4 more)

### Community 37 - "leaderboard.tsx"
Cohesion: 0.20
Nodes (12): CHOOSE_HANDLE_HREF, Leaderboard(), LeaderboardData, LeaderboardEntry, LeaderboardStanding, LearnerName(), MEDAL, Row() (+4 more)

### Community 38 - "vitest"
Cohesion: 0.04
Nodes (47): nextConfig, activityHref(), closesIn(), Dashboard, DashboardContent(), DashboardPage(), kindLabel(), localTime() (+39 more)

### Community 39 - "insights.py"
Cohesion: 0.10
Nodes (22): CategoryCount, course_insights(), _event_days(), GamificationInsights, HelpSeeking, _manila_day(), MemoryRetention, _rate() (+14 more)

### Community 40 - "numpy"
Cohesion: 0.17
Nodes (10): test_bootstrap_intervals_are_reproducible_and_resample_learners(), _bootstrap_intervals(), _build_pipeline(), _evaluate_partition(), _finite_or_none(), _fit_tuned_model(), _point_metrics(), _probability_for_success() (+2 more)

### Community 41 - "ml_predictor/feature_engineering.py"
Cohesion: 0.22
Nodes (7): _as_bool(), _before(), _enum_value(), extract_features_from_dataframe(), _frame(), _mean(), _rate()

### Community 42 - "4. Findings and implementation blueprint"
Cohesion: 0.08
Nodes (24): 1. Where ByteQuest stands, 2. How the system fits together, 3. Work order, 4. Findings and implementation blueprint, 5. Local completion checklist, 6. Which existing document answers which question, BQ-01 — Award completion XP at the first eligible event, BQ-02 — Give submission jobs one owner per claim (+16 more)

### Community 43 - "qa_mixed_exam_load.py"
Cohesion: 0.13
Nodes (15): require_local(), summary(), verify(), main(), measure_exam_samples(), prepare_exam(), report_exam_grading(), run() (+7 more)

### Community 44 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 45 - "Classroom pilot fixes and verification — 2026-10-28"
Cohesion: 0.33
Nodes (5): Changes checked locally, Classroom pilot fixes and verification — 2026-10-28, Evidence, Other Remaining Pilot Verification Gates, Verification Status & Remaining Gates

### Community 46 - "run_training_and_comparison"
Cohesion: 0.30
Nodes (6): _atomic_joblib_dump(), _atomic_json_write(), _atomic_write(), run_training_and_comparison(), _select_winner(), _sha256_file()

### Community 47 - "Faculty and administrator workspace — implementation log and continued work"
Cohesion: 0.11
Nodes (17): 10. Files created or modified (this work), 11. Quick current-state checklist, 1. Status at handoff, 6. Tests added, 7. Verification evidence (live app), 8. How to continue (commands, accounts, cleanup), 9. Remaining work, Additional navigation fix (+9 more)

### Community 48 - "package.json"
Cohesion: 0.12
Nodes (16): engines, node, name, overrides, dompurify, private, version, eslint (+8 more)

### Community 49 - "Phase 1 — ByteQuest instructor redesign plan"
Cohesion: 0.07
Nodes (30): Activity editor, Analytics, Analytics desktop, Analytics phone, API and data performance, Assumptions, Chart library and motion, Course data model and grade integrity (+22 more)

### Community 50 - "get"
Cohesion: 0.17
Nodes (19): course_health(), sandbox_health(), activity_analysis(), _first_try_questions(), gamification_insights(), gradebook(), performance(), student_performance() (+11 more)

### Community 51 - "AppTooltips"
Cohesion: 0.28
Nodes (17): AppTooltips(), clearTimers(), findTarget(), hide(), onClick(), onContextMenu(), onFocusIn(), onFocusOut() (+9 more)

### Community 52 - "qa-responsive.mjs"
Cohesion: 0.08
Nodes (27): Already in place: extend, do not rebuild, Goal, Layout system, Make ByteQuest fit every phone and tablet, Menu docking: finish what exists, Out of scope, Screens, Side navigation on handheld screens: already built (+19 more)

### Community 53 - "reveals_solution"
Cohesion: 0.22
Nodes (13): _contains_tokens(), _ngrams(), reveals_solution(), _single_line_repair(), _tokens(), test_challenge_chat_rejects_alternate_code_even_without_reference_overlap(), test_exact_repair_to_failed_sample_is_withheld_even_if_it_is_in_the_starter(), test_full_solution_is_blocked_even_with_renamed_variables() (+5 more)

### Community 54 - "ByteQuest UI and UX harmonization plan"
Cohesion: 0.17
Nodes (12): 1. What the review found, 2. How work moves through ByteQuest, 3. Student journey, 4. Instructor journey, 5. Administrator journey, 6. Shared visual and interaction system, 7. Contextual help and tooltips, 8. Delivery order (+4 more)

### Community 55 - "chat-provider.tsx"
Cohesion: 0.10
Nodes (30): Already strong (checked, not assumed), chatHistory, ChatMode, ConversationPage, ConversationSummary, SavedReply, SavedTurn, Transcript (+22 more)

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
Cohesion: 0.08
Nodes (16): get_settings(), ErrorExplanationSchema, explain_code_error(), _client_for_key(), GeminiConfigurationError, get_gemini_client(), _chat_failure(), GeminiLLMService (+8 more)

### Community 60 - "ByteQuest Insights, part 3 of 4: instructors"
Cohesion: 0.18
Nodes (10): Activity health in the Activities list, ByteQuest Insights, part 3 of 4: instructors, Exam class summary, Goal, Handheld rules, Inactive 7+ days, Model evaluation, Out of scope (+2 more)

### Community 61 - "exams.py"
Cohesion: 0.09
Nodes (47): assigned(), assigned_exam_numbers(), _assigned_exams_with_state(), create_exam(), DraftExam, DraftItem, _exam_access(), exam_sample_run() (+39 more)

### Community 62 - "profile/page.tsx"
Cohesion: 0.06
Nodes (51): AdminSections(), ConsentStatus, habitsMessage(), InstructorSections(), PersonalTimeline(), ProfilePage(), ProfilePageContent(), SolvingHabits() (+43 more)

### Community 63 - "useChatController"
Cohesion: 0.24
Nodes (17): turnMessages(), mapChatError(), useChatController(), applySavedReply(), canSend(), checkReply(), handleFailure(), openConversation() (+9 more)

### Community 64 - "ByteQuest machine-learning improvement plan"
Cohesion: 0.14
Nodes (14): 1. Goal, 2. Where things stand, 3. Decisions, 4.1 Prediction unit and label, 4.2 History, 4.3 The ten features, in this order, 4.4 Live shadow scoring, 4.5 Reporting (+6 more)

### Community 65 - "rag_instructor.py"
Cohesion: 0.17
Nodes (16): _gemini_unavailable_http_exception(), generate_ai_coding_challenge(), generate_ai_conceptual_quiz(), _generation_payload(), _get_owned_activity(), _get_owned_document(), _may_manage_activity(), _may_manage_document() (+8 more)

### Community 66 - "train_compare.py"
Cohesion: 0.10
Nodes (3): _format_metric(), generate_synthetic_thesis_dataset(), main()

### Community 67 - "ByteQuest 2.0 Classroom Pilot Operator Runbook"
Cohesion: 0.17
Nodes (12): 1. Hard Safety Gates (Enforced by Configuration), 2. Lab Station & Shared-Computer Protocol, 3. Network Resilience & Live Draft Sync, 4. Timed Exam Operations, 5. Verification Commands, 6. Incident Troubleshooting, ByteQuest 2.0 Classroom Pilot Operator Runbook, Classroom Wi-Fi Reconnect Banner (+4 more)

### Community 68 - "_TooLarge"
Cohesion: 0.18
Nodes (8): RequestSizeLimitMiddleware, limited_receive(), tracked_send(), _TooLarge, test_streamed_body_without_content_length_is_limited(), read_body(), receive(), send()

### Community 69 - "test_gamification_insights_are_course_scoped_class_aggregates"
Cohesion: 0.50
Nodes (4): test_gamification_insights_are_course_scoped_class_aggregates(), attempt(), challenge(), review()

### Community 70 - "ByteQuest local end-to-end flow"
Cohesion: 0.14
Nodes (14): Account-synced progression check, Before deployment, ByteQuest local end-to-end flow, Instructor account, Local Quest Map demos, Manual startup, One-click Windows startup, Open ByteQuest on a phone over ZeroTier (+6 more)

### Community 71 - "accessibility-provider.tsx"
Cohesion: 0.20
Nodes (15): ACCESSIBILITY_STORAGE_KEYS, AccessibilityContext, AccessibilityContextValue, AccessibilityPreferences, AccessibilityProvider(), applyPreferences(), commitPreferences(), DEFAULT_PREFERENCES (+7 more)

### Community 72 - "ByteQuest 2.0"
Cohesion: 0.22
Nodes (9): Architecture, ByteQuest 2.0, Configuration and security, Documentation, Repository layout, Stack and deployment, Start locally on Windows, Test and verify (+1 more)

### Community 73 - "ProgrammingLang"
Cohesion: 0.08
Nodes (23): ProgrammingLang, _grade_item(), _b64_decode(), _b64_encode(), BatchEvaluationSummary, classify_judge0_status(), Judge0Client, Judge0UnavailableError (+15 more)

### Community 74 - "ByteQuest 2.0 — Full system review"
Cohesion: 0.22
Nodes (9): ByteQuest 2.0 — Full system review, Evidence, Must fix, Nice to have, Not checked, Ratings, Should fix, Verdict (+1 more)

### Community 75 - "Phase 0 — ByteQuest instructor audit"
Cohesion: 0.22
Nodes (8): Current FastAPI inventory, Current screens and feature coverage, Decisions for Phase 1, Desktop scorecard, Findings, Phase 0 — ByteQuest instructor audit, Supabase data and authorization, Verification

### Community 76 - "StorageError"
Cohesion: 0.13
Nodes (6): StorageError, SupabaseAvatarStorage, SupabasePDFStorage, test_accepts_absolute_signed_url_from_configured_origin(), test_rejects_untrusted_signed_url(), test_resolves_supabase_relative_signed_path()

### Community 77 - "submission_jobs.py"
Cohesion: 0.20
Nodes (11): require_practice_help_available(), compare_submission(), ComparedAttempt, get_job(), _retry_failed_job(), retry_job(), SubmissionComparison, submit_job() (+3 more)

### Community 78 - "ByteQuest 2.0 database review — 12 November 2026"
Cohesion: 0.18
Nodes (10): test_every_public_timestamp_column_is_aware(), B. Findings, ByteQuest 2.0 database review — 12 November 2026, C. Migration plan, D. Index recommendations, F. Verification, G. Explicitly out of scope, Must fix (+2 more)

### Community 79 - "Session"
Cohesion: 0.08
Nodes (51): account_emails_for_email(), account_impact(), _account_needs_action(), AccountCreate, activity_impact(), admin_activities(), _admin_activity(), _admin_activity_item() (+43 more)

### Community 81 - "qa_live_multi_role.py"
Cohesion: 0.18
Nodes (15): api_base(), cleanup(), create_accounts(), instructor_builds_course(), letters(), main(), password_token(), print_report() (+7 more)

### Community 82 - "codex.py"
Cohesion: 0.07
Nodes (26): get_codex(), get_gamification_state(), get_mastery_map(), ChallengeRecovery, codex_summary(), CodexCategory, CodexRecovery, CodexResponse (+18 more)

### Community 83 - "ByteQuest 2.0: Master Architecture Plan & Execution Roadmap"
Cohesion: 0.08
Nodes (25): 1. Project Tracking & Thesis Collaboration Strategy, 2. Core Architectural Rules (Non-Negotiable), 3. Repository Directory Structure, 4. Course-Sequence & Curriculum Alignment, 5. Database Schema Blueprint (Supabase PostgreSQL + pgvector), 6. 7-Phase Development Plan, 7. Thesis Objectives Mapping (Chapter 1 Alignment), 8. Development Environment & Quickstart Commands (+17 more)

### Community 84 - "Phase 7 deployment readiness"
Cohesion: 0.18
Nodes (11): Decisions required before production setup, Deployment order after the decisions are made, Evidence still needed, Local Judge0 runtime smoke check (2026-10-26), Notes on local verification, Phase 7 deployment readiness, Prepared in the repository, Production settings and network boundaries (+3 more)

### Community 85 - "lib/types.ts"
Cohesion: 0.04
Nodes (65): ExamCard, ExamsPage(), localTime(), QuestsPage(), QuestsPageContent(), changeView(), handleKeyDown(), QuestStatusFilter (+57 more)

### Community 86 - "arena.tsx"
Cohesion: 0.16
Nodes (14): load(), draftKey(), HintStatus, LANGUAGE_NAMES, OutputBlock(), readLocalDraft(), readSampleRun(), SampleRun (+6 more)

### Community 87 - "chat-workspace.tsx"
Cohesion: 0.32
Nodes (9): ChatPage(), useChat(), ChatDialog(), ChatSettings(), ChatWorkspace(), select(), start(), HistoryAction (+1 more)

### Community 88 - "asyncio"
Cohesion: 0.17
Nodes (11): cleanup(), main(), make_students(), one_student(), require_local(), run_load(), main(), student() (+3 more)

### Community 89 - "generate_embedding"
Cohesion: 0.18
Nodes (5): embed_chunks_bounded(), embed_one(), GeminiEmbeddingService, generate_embedding(), test_embedding_request_matches_selected_model()

### Community 90 - "workspace.ts"
Cohesion: 0.03
Nodes (106): ResearchConsentSettingsPage(), confirmDeactivate(), confirmReactivate(), openImpact(), doConfirm(), submitAssign(), save(), submit() (+98 more)

### Community 91 - "Instructor activity analysis and class announcements"
Cohesion: 0.33
Nodes (6): Activity analysis, Browser verification, Class announcements, Instructor activity analysis and class announcements, Remaining verification, Verification

### Community 92 - "Desktop and Mobile Pilot Flows (`pilot-v2.html`)"
Cohesion: 0.22
Nodes (8): 1. Offline / Network Reconnect Banner, 2. Pending / Queued Grading State, 3. Research Consent & Withdrawal State (Disabled Collection Notice), 4. Active Exam Priority Banner & Timed Attempt Lock, ByteQuest web app wireframes, Coverage, Desktop and Mobile Pilot Flows (`pilot-v2.html`), Review checklist

### Community 93 - "workspace-provider.test.tsx"
Cohesion: 0.18
Nodes (13): DockableNavigation(), finish(), MenuPositionSetting(), readMenuSide(), setMenuSide(), Side, sideListeners, storageKey() (+5 more)

### Community 94 - "ByteQuest Insights, part 4 of 4: administrators"
Cohesion: 0.33
Nodes (5): ByteQuest Insights, part 4 of 4: administrators, Goal, Handheld rules, Out of scope, Verification and rollout

### Community 95 - "app-shell.tsx"
Cohesion: 0.11
Nodes (28): WorkspaceLayout(), WorkshopsLayout(), AppShell(), AuthenticatedLayout(), isActiveDestination(), ProfileContext, useScrollResetOnRouteChange(), CourseNavigationLinks() (+20 more)

### Community 96 - "quiz-view.tsx"
Cohesion: 0.18
Nodes (7): QuizPage(), getActivityHref(), QuizResult, QuizView(), handleSubmitQuiz(), load(), QuizQuestion

### Community 97 - "ML pipeline synthetic verification — 2026-10-25"
Cohesion: 0.29
Nodes (6): Artifact and activation checks, Execution, ML pipeline synthetic verification — 2026-10-25, Observed grouped metrics, Remaining Phase 5 work, Scope

### Community 98 - "5. Slices"
Cohesion: 0.12
Nodes (15): 1. Read these first, in this order, 3. Hard rules, 4. Decided behaviour (W1–W12, all accepted by the user), 5. Slices, 6. How to verify each slice, 7. Report after each slice, ChatGPT 6.2 prompt: finish the ByteQuest Workshop classroom (slices 1–8), Slice 1: data and API (start here) (+7 more)

### Community 99 - "preflight-host.sh"
Cohesion: 0.38
Nodes (6): fail(), MIN_MEMORY_BYTES, MIN_ROOT_FREE_BYTES, MIN_SWAP_BYTES, pass(), preflight-host.sh script

### Community 100 - "Phase 6 shadow rollout implementation record"
Cohesion: 0.40
Nodes (5): Implemented, Phase 6 shadow rollout implementation record, Phase 7 handoff, Safety and current state, Verification still required

### Community 101 - "qa_starter_tutoring.py"
Cohesion: 0.23
Nodes (10): _evaluate(), _failed_sample(), main(), _request(), TutorCase, challenge_specs(), cleanup(), evaluate() (+2 more)

### Community 102 - "ML feature engineering and training"
Cohesion: 0.40
Nodes (5): Comparison protocol, Export an attempt dataset, ML feature engineering and training, Prepare an Ubuntu VPS, Safe pipeline setup

### Community 103 - "monitoring.py"
Cohesion: 0.16
Nodes (13): GradingWorkerHeartbeat, _check_judge0(), _grading_worker_health(), _minutes(), _prediction_health(), _rag_health(), record_grading_worker_heartbeat(), _runner_health() (+5 more)

### Community 104 - "ByteQuest Gemini tutor pilot evaluation"
Cohesion: 0.50
Nodes (4): ByteQuest Gemini tutor pilot evaluation, Reply quality, Token use and estimated Gemini cost, What was tested

### Community 105 - "Arena"
Cohesion: 0.16
Nodes (15): ArenaPage(), Arena(), confirmResetCode(), endSegment(), handleCodeChange(), handleCopyOutput(), onVisibilityChange(), retryHintStatus() (+7 more)

### Community 106 - "ByteQuest navigation"
Cohesion: 0.40
Nodes (5): ByteQuest navigation, Compatibility and new destinations, Existing routes, Local verification, Workshops (11/21/26)

### Community 107 - "ProgrammingLang"
Cohesion: 0.09
Nodes (25): join_workshop(), JoinWorkshop, list_workshops(), Workshop, WorkshopMember, student_activity_clause(), workshop_shareable_activity_clause(), main() (+17 more)

### Community 108 - "ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash"
Cohesion: 0.10
Nodes (16): GeneratedChallengeSchema, GeneratedQuizOptionSchema, GeneratedQuizQuestionSchema, GeneratedQuizSchema, TestCaseSchema, 1. Current architecture, 2. Exact code touchpoints, 3. Recommended implementation order (+8 more)

### Community 110 - "Python demo journey — 2026-10-28"
Cohesion: 0.40
Nodes (4): Browser walkthrough, Implemented, Local evidence, Python demo journey — 2026-10-28

### Community 111 - "Phase 7 local production-mode runtime verification"
Cohesion: 0.17
Nodes (10): Boundaries and remaining work, Phase 7 local production-mode runtime verification, Procedure, Reproduction, Results, Changes, Limits, Local runtime spot check — 2026-10-26 (+2 more)

### Community 112 - "ByteQuest 2.0 system status and weekly change log"
Cohesion: 0.29
Nodes (7): ByteQuest 2.0 system status and weekly change log, Current feature and deployment map, How close is ByteQuest to finished?, Latest local verification, UI and UX review, What changed this week, Work left before the next milestone

### Community 113 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, build, dev, lint, prebuild, predev, prestart, start (+3 more)

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

### Community 123 - "4. Read these before writing any code"
Cohesion: 0.14
Nodes (14): Badge, PlatformSetting, StudentBadge, evaluate_and_award_badges(), _qualifies(), _requirement_for(), flow(), cleanup() (+6 more)

### Community 124 - "newRequestId"
Cohesion: 0.27
Nodes (7): RFC-4122, Hard rules, requestAiHint(), revealReviewedHint(), LOOPBACK_HOSTS, newRequestId(), reachableServiceUrl()

### Community 126 - "ByteQuest 2.0 system critique — 21 November 2026"
Cohesion: 0.25
Nodes (8): ByteQuest 2.0 system critique — 21 November 2026, Findings by severity, Low, Not verified in this review, Scorecard, Top 5 things to do next, Verdict, What is working well (keep)

### Community 127 - "Judge0 Hyper-V Ubuntu boot incident and recovery"
Cohesion: 0.05
Nodes (39): 1. Start and open the known-good VM, 2. Confirm the Judge0 services and volume inside Ubuntu, 3. Get the current guest IP and check the port, 4. Update ByteQuest if the VM IP changed, 5. Restart FastAPI and leave it running, 6. Verify service integration without exposing secrets, Current verified state, Disk and data safety (+31 more)

### Community 128 - "ByteQuest manuscript and system alignment checklist"
Cohesion: 0.20
Nodes (10): 1. Scope decisions, 2. Chapter 1 — Introduction and scope, 3. Chapter 2 — Literature and synthesis, 4. Chapter 3 — Roles, practice, and AI, 5. Chapter 3 — Assessment and architecture, 6. Chapter 3 — Consent, research data, and ML, 7. Study records and final sign-off, ByteQuest manuscript and system alignment checklist (+2 more)

### Community 132 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, eslint, eslint-config-next, jsdom, @testing-library/react, @types/node, @types/react, @types/react-dom (+2 more)

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

### Community 137 - "Step C — Instructor visual verification"
Cohesion: 0.33
Nodes (6): Current routes and behavior, Phase 2 API and rollout list, Reference tokens and icons, Screenshot comparisons, Step C — Instructor visual verification, Test target checks

### Community 138 - "ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash"
Cohesion: 0.22
Nodes (8): Behavior and scope of the assistant, ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash, Placement and responsive layout, Product decision, Quality gates and acceptance tests, Ready-to-paste DeepSeek V4.1 Flash implementation prompt, State and error rules, Window states and exact controls

### Community 139 - "Phase 7 database and file backup/restore runbook"
Cohesion: 0.13
Nodes (15): auth(), verify(), claims(), A. Provider database backup, B. Supplementary logical database export, Backup procedure, ByteQuest recovery acceptance checklist, C. Separate export of instructional PDF objects (+7 more)

### Community 140 - "FastAPI"
Cohesion: 0.13
Nodes (12): AnnouncementCreate, AnnouncementExpiry, AnnouncementPatch, _audit_change(), _authorize_announcement(), create_announcement(), delete_announcement(), list_announcements() (+4 more)

### Community 141 - "settings_service.py"
Cohesion: 0.23
Nodes (7): get_settings(), _coerce(), list_settings(), _range_error(), serialize_setting(), _typed_value(), update_setting()

### Community 142 - "Local API security contract"
Cohesion: 0.40
Nodes (5): Access matrix, Local API security contract, Local verification and future deployment, Quotas and validation, School-issued IDs for student sign-up

### Community 143 - "prepare_ml_dataset"
Cohesion: 0.23
Nodes (8): _as_binary_label(), _check_columns(), _encodes_account_id(), _require_pseudonymous(), _sort_attempts(), _strip_text(), _validate_hint_frame(), _validate_training_frame()

### Community 146 - "MLPrediction"
Cohesion: 0.22
Nodes (9): MLPrediction, record_prediction_outcome(), PredictionResult, _consent(), test_ml_evaluation_excludes_learners_without_current_consent(), test_ml_evaluation_keeps_model_versions_apart_and_scores_both_models(), test_ml_reads_never_record_a_prediction(), test_prediction_outcome_links_only_earlier_snapshots() (+1 more)

### Community 148 - "test_learning_flow_integration.py"
Cohesion: 0.08
Nodes (27): claim_exam(), ExamGradingClaim, _grade_claimed_exam(), grade_exam(), _lock_exam_claim(), _grade_queued_exam(), _letters(), _ranked_student() (+19 more)

### Community 149 - "ByteQuest 2.0 — Review remediation plan"
Cohesion: 0.33
Nodes (4): ByteQuest 2.0 — Review remediation plan, Done, Outside code, Still open

### Community 150 - "runner_status"
Cohesion: 0.36
Nodes (8): runner_status(), job(), test_a_failing_latest_job_is_a_current_failure(), test_a_job_stuck_in_the_queue_marks_the_queue_stale(), test_a_job_that_just_arrived_is_not_a_stall(), test_a_service_switched_off_on_purpose_does_not_degrade_overall_health(), test_old_activity_reads_in_hours_and_days_not_hundreds_of_minutes(), test_old_failures_do_not_hide_a_recovered_runner()

### Community 151 - "performance/page.tsx"
Cohesion: 0.06
Nodes (59): Student Progress: the only roster and learner drawer, CourseRef, Curve, Dashboard, Detail, Evaluation, Forecast, FORECAST_REASONS (+51 more)

### Community 152 - "chat-provider.test.tsx"
Cohesion: 0.17
Nodes (9): Repo map: exact files to inspect and change, ChatProvider(), auth, bodies(), openChat(), ready, routeApi(), savedChat (+1 more)

### Community 153 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, monaco-editor, @monaco-editor/react, next, react, react-dom, react-is, recharts (+1 more)

### Community 154 - "app/layout.tsx"
Cohesion: 0.33
Nodes (5): byteBounce, metadata, RootLayout(), viewport, ToastProvider()

### Community 157 - "retrieval.py"
Cohesion: 0.13
Nodes (12): activity_document_ids(), _chat_excerpt(), cited_sources(), course_document_ids(), is_query_vector(), leading_chunks(), nearest_chunks(), search_settings() (+4 more)

### Community 158 - "ByteQuest 2.0 engineering and UX review"
Cohesion: 0.40
Nodes (5): ByteQuest 2.0 engineering and UX review, Findings, Performance evidence, Recommended sequence, Verification and limits

### Community 159 - "audit_events"
Cohesion: 0.29
Nodes (6): audit_events(), audit_query(), A. Inventory, End-to-end traces, 4.1 Migration, 4. Backend changes

### Community 160 - "ByteQuest backend runtime review"
Cohesion: 0.40
Nodes (4): ByteQuest backend runtime review, Mixed local workload, Pending measurements and review, Ranked findings

### Community 161 - "plot.tsx"
Cohesion: 0.50
Nodes (4): useAccessibility(), ChartProps, Plot(), recharts

### Community 162 - "app-tooltips.tsx"
Cohesion: 0.50
Nodes (4): hasVisibleText(), tooltipFor(), TooltipState, react-dom

### Community 163 - "ByteQuest 2.0: close the manuscript gaps, tidy the structure, then review and rate the system"
Cohesion: 0.25
Nodes (7): ByteQuest 2.0: close the manuscript gaps, tidy the structure, then review and rate the system, Do not, Final report, Part 3: Code structure (targeted; behaviour must stay identical), Part 4: Review and targeted fixes, Stack and layout, Verification

### Community 164 - "Phase 7 backend image build verification"
Cohesion: 0.40
Nodes (4): Limits, Phase 7 backend image build verification, Recorded evidence, Work completed

### Community 165 - "runCode"
Cohesion: 0.50
Nodes (5): checkStatus(), runCode(), workedSeconds(), removeStoredRun(), sampleRunStatus()

### Community 166 - "ByteQuest Insights, part 1 of 4: shared foundation"
Cohesion: 0.20
Nodes (9): ByteQuest Insights, part 1 of 4: shared foundation, Charts: two primitives, Goal, Handheld rules, Metric labels, Out of scope, Profile: one role tab, each figure once, Remove the duplicate Sequencer evaluation (+1 more)

### Community 167 - "instructor/page.tsx"
Cohesion: 0.06
Nodes (79): Already in place: extend, do not rebuild, One kit: course-ui, Implementation status (21 November 2026, same day), Medium, 4.4 Faculty API (`backend/app/api/faculty.py`, prefix `/api/v1/faculty`), 4.5 Administrator API (`backend/app/api/admin.py`, prefix `/api/v1/admin`), FacultyActivities(), copyActivity() (+71 more)

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
Nodes (41): _ensure_student(), get_review(), get_reviews(), _locked_student(), _public_review(), _question_id(), _require_memory(), ReviewOverviewResponse (+33 more)

### Community 176 - "Phase 7 synthetic deployment preflight — 2026-10-26"
Cohesion: 0.33
Nodes (5): Evidence, Limits, Phase 7 synthetic deployment preflight — 2026-10-26, Result, Scope and method

### Community 179 - "Production instructor access"
Cohesion: 0.50
Nodes (3): Grant access to one account, Production instructor access, Safety boundaries

## Knowledge Gaps
- **18 isolated node(s):** `monaco-editor`, `react-is`, `@types/node`, `@types/react`, `@types/react-dom` (+13 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1379 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **28 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `4. Read these before writing any code` connect `4. Read these before writing any code` to `ui.tsx`, `Session`, `_token`, `LearningActivity`, `ProgrammingLang`, `reviews.py`, `attempt_visibility.py`, `test_learning_flow_integration.py`, `profiles.py`, `submit_conceptual_quiz`, `profile/page.tsx`?**
  _High betweenness centrality (0.182) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `Session` (e.g. with `smoke_demo_quest()` and `test_two_concurrent_saves_cannot_commit_the_same_activity_version()`) actually correct?**
  _`Session` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `monaco-editor`, `react-is`, `@types/node` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ui.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07881210736721873 - nodes in this community are weakly interconnected._
- **Why does `LearningActivity` connect `LearningActivity` to `Session`, `_token`, `workshops.py`, `test_faculty_admin.py`, `drafts.py`, `drafts.py`, `_enroll_chat_students`, `attempt_visibility.py`, `faculty_ml.py`, `entities.py`, `test_ml_exam_features.py`, `predictor.py`, `profiles.py`, `MLPrediction`, `test_learning_flow_integration.py`, `get`, `entities.py`, `submit_conceptual_quiz`, `retrieval.py`, `chat.py`, `insights.py`, `reviews.py`, `get`, `exams.py`, `rag_instructor.py`, `test_gamification_insights_are_course_scoped_class_aggregates`, `submission_jobs.py`, `Session`, `codex.py`, `asyncio`, `qa_starter_tutoring.py`, `monitoring.py`, `ProgrammingLang`, `ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash`, `4. Read these before writing any code`?**
  _High betweenness centrality (0.125) - this node is a cross-community bridge._
- **Are the 280 inferred relationships involving `Profile` (e.g. with `account_impact()` and `_account_needs_action()`) actually correct?**
  _`Profile` has 280 INFERRED edges - model-reasoned connections that need verification._
- **Should `Session` be split into smaller, more focused modules?**
  _Cohesion score 0.09216589861751152 - nodes in this community are weakly interconnected._