# Graph Report - ByteQuest_2.0  (2026-11-22)

## Corpus Check
- 467 files · ~507,643 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 38 file(s) not represented in the graph (top: (none) 19, .bat 5, .example 5)

## Summary
- 4244 nodes · 14217 edges · 176 communities (153 shown, 23 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 1874 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `38f92bbe`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- workspace-provider.tsx
- ByteQuest 2.0: instructor activity analysis and class announcements
- Session
- _token
- workshops.py
- api.ts
- getErrorMessage
- test_faculty_admin.py
- activities/[id]/page.tsx
- start-bytequest.ps1
- solve_quality.py
- get
- supabase.ts
- test_learning_flow_integration.py
- progress_recap.py
- faculty_ml.py
- shadow.py
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
- Judge0UnavailableError
- activity-analysis.tsx
- workshop-home.tsx
- Prioritized defects
- onboarding/page.tsx
- chat.py
- test_auth_jwks.py
- upload_my_avatar
- leaderboard.tsx
- workspace/ui.tsx
- insights.py
- train_compare.py
- ml_predictor/feature_engineering.py
- 4. Findings and implementation blueprint
- qa_mixed_exam_load.py
- compilerOptions
- json
- ByteQuest UI/UX harmonization: slices 1–3 and ML slice planning
- Faculty and administrator workspace — implementation log and continued work
- package.json
- Phase 1 — ByteQuest instructor redesign plan
- SupabaseAvatarStorage
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
- profile-header.tsx
- account_provisioning.py
- ByteQuest machine-learning improvement plan
- rag_instructor.py
- ByteQuest — Security & AI-Abuse Hardening (implementation brief)
- ByteQuest 2.0 Classroom Pilot Operator Runbook
- _TooLarge
- memory.py
- ByteQuest local end-to-end flow
- accessibility-provider.tsx
- ByteQuest 2.0
- ByteQuest 2.0 — Full system review
- Phase 0 — ByteQuest instructor audit
- StorageError
- Prompt for ChatGPT: ByteQuest gamification, Phases 2 and 3
- ByteQuest 2.0 database review — 12 November 2026
- CourseMember
- SYSTEM_STATUS_AND_RELEASE_PLAN.md
- qa_live_multi_role.py
- entities.py
- ByteQuest 2.0: Master Architecture Plan & Execution Roadmap
- Phase 7 deployment readiness
- lib/types.ts
- Corrected Lesson to Student Progress Verification
- ProfileResponse
- asyncio
- test_memory_rules.py
- workspace.ts
- Instructor activity analysis and class announcements
- Desktop and Mobile Pilot Flows (`pilot-v2.html`)
- test_sandbox_internal_error_is_unavailability_not_a_student_failure
- ByteQuest Insights, part 4 of 4: administrators
- app-shell.tsx
- quiz-view.tsx
- ML pipeline synthetic verification — 2026-10-25
- Judge0 Hyper-V Ubuntu VM: troubleshooting handoff
- preflight-host.sh
- Phase 6 shadow rollout implementation record
- qa_starter_tutoring.py
- ML feature engineering and training
- monitoring.py
- ByteQuest Gemini tutor pilot evaluation
- arena.tsx
- ByteQuest navigation
- Workshops: Create, Join and the Workshop page
- Milestones 1A–1C Status and Verification Log
- zerotier-relay.mjs
- Python demo journey — 2026-10-28
- Phase 7 local production-mode runtime verification
- ByteQuest 2.0 system status and weekly change log
- scripts
- Local API security verification — 2026-10-28
- Phase 7 database pool budget hardening
- test_profile_analytics.py
- client.py
- ByteQuest 2.0 before and after
- smoke-vps.sh
- ByteQuest pilot remediation checklist
- preflight-vps.sh
- flow
- get_current_user_payload
- ByteQuest 2.0 system critique — 21 November 2026
- Judge0 Hyper-V Ubuntu boot incident and recovery
- ByteQuest manuscript and system alignment checklist
- devDependencies
- ByteQuest 2.0 live deployment stack
- complete_student_onboarding
- ML features and prediction unit: manuscript vs. code
- ByteQuest KVM 2 live pilot
- Step C — Instructor visual verification
- ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash
- Phase 7 database and file backup/restore runbook
- FastAPI
- SandboxHealth
- Local API security contract
- record_prediction_outcome
- runner_status
- performance/page.tsx
- dependencies
- app/layout.tsx
- destroy_research_link.py
- retrieval.py
- review-report.md
- ByteQuest 2.0: close the manuscript gaps, tidy the structure, then review and rate the system
- Phase 7 backend image build verification
- ByteQuest Insights, part 1 of 4: shared foundation
- instructor/page.tsx
- ByteQuest Insights, part 2 of 4: students
- Phase 7 frontend build evidence
- Phase 7 Vercel setup verification — 2026-10-26
- ByteQuest system status — 21 November 2026
- Phase 7 dependency security review (2026-10-26)
- reviews.py
- Judge0Client
- Phase 7 synthetic deployment preflight — 2026-10-26
- Production instructor access

## God Nodes (most connected - your core abstractions)
1. `Session` - 352 edges
2. `Profile` - 347 edges
3. `LearningActivity` - 217 edges
4. `getErrorMessage()` - 140 edges
5. `ActivityAttempt` - 120 edges
6. `apiRequest()` - 117 edges
7. `ReviewState` - 110 edges
8. `ProgrammingLang` - 96 edges
9. `UserRole` - 94 edges
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

## Communities (176 total, 23 thin omitted)

### Community 0 - "workspace-provider.tsx"
Cohesion: 0.05
Nodes (65): AdminActivities(), confirmArchive(), openAvailability(), saveAvailability(), Page(), STATUS_OPTIONS, AdminAssignments(), doConfirm() (+57 more)

### Community 1 - "ByteQuest 2.0: instructor activity analysis and class announcements"
Cohesion: 0.17
Nodes (11): ByteQuest 2.0: instructor activity analysis and class announcements, Database, Double-check before you report, Final report, Frontend, Hard rules, Part 1: Activity analysis, Part 2: Class announcements (+3 more)

### Community 2 - "Session"
Cohesion: 0.06
Nodes (86): account_emails_for_email(), account_impact(), AccountCreate, activity_impact(), _admin_activity(), admin_archive_activity(), admin_archive_material(), admin_dashboard() (+78 more)

### Community 3 - "_token"
Cohesion: 0.09
Nodes (42): ActivityAttempt, Badge, ChallengeHint, DocumentChunk, HintUse, PlatformSetting, StudentBadge, evaluate_and_award_badges() (+34 more)

### Community 4 - "workshops.py"
Cohesion: 0.07
Nodes (69): exam_catalog(), _activity_links(), _announcement_for_update(), AnnouncementView, archive_workshop(), can_manage(), create_workshop(), CreateAnnouncement (+61 more)

### Community 5 - "api.ts"
Cohesion: 0.04
Nodes (52): nextConfig, mocks, mocks, mocks, report, mocks, dashboard(), detail() (+44 more)

### Community 6 - "getErrorMessage"
Cohesion: 0.08
Nodes (36): ConsentStatus, ResearchConsentSettingsPage(), ExamsPage(), ExamInfo, ExamPage(), handleRunSample(), handleStartExam(), hydrateAndReconcileOnce() (+28 more)

### Community 7 - "test_faculty_admin.py"
Cohesion: 0.07
Nodes (44): MLPrediction, ResearchConsent, next_course_activity(), _consent(), test_account_creation_provisions_a_profile_and_course_access(), test_activity_analysis_totals_and_practice_scope(), admin_row(), test_activity_editor_preview_hides_answer_keys_and_hidden_tests() (+36 more)

### Community 8 - "activities/[id]/page.tsx"
Cohesion: 0.04
Nodes (90): Design system and data flow, Step A checkpoint and caller verification, Frontend, Stack and layout, 5.1 Shared library and components, Configuration(), openReview(), save() (+82 more)

### Community 9 - "start-bytequest.ps1"
Cohesion: 0.07
Nodes (42): ConvertTo-EncodedPowerShellCommand(), ConvertTo-PowerShellLiteral(), Get-BackendFingerprint(), Get-FrontendFingerprint(), Get-Judge0VmIPv4(), Get-Judge0VmIPv4FromNeighbor(), Get-ListenerPidMap(), Get-PageScriptPaths() (+34 more)

### Community 10 - "solve_quality.py"
Cohesion: 0.20
Nodes (7): attempt_quality(), best_challenge_stars(), challenge_stars(), help_pattern(), hint_timing(), solve_stars(), tried_before_hint()

### Community 11 - "get"
Cohesion: 0.05
Nodes (90): admin_activities(), _admin_activity_item(), admin_user(), course_health(), list_course_operations(), ActivityCreate, ActivityUpdate, create_activity() (+82 more)

### Community 12 - "supabase.ts"
Cohesion: 0.07
Nodes (43): 8 Required Acceptance Checks, Durability Boundary & Concurrency Guarantees, Exam Autosave & Conflict-Safe Recovery Verification, Changes checked locally, Classroom pilot fixes and verification — 2026-10-28, Evidence, Interrupted Exam Autosave & Browser Recovery (Checklist Item #3), Other Remaining Pilot Verification Gates (+35 more)

### Community 13 - "test_learning_flow_integration.py"
Cohesion: 0.05
Nodes (91): ReviewState, WorkshopAnnouncement, GeminiAPIError, test_chat_requires_active_enrollment_only_for_students(), _chat_payload(), _course_pdf(), _enroll_chat_students(), new_session() (+83 more)

### Community 14 - "progress_recap.py"
Cohesion: 0.19
Nodes (7): _day(), _manila(), _practice_days(), progress_recap(), ProgressRecap, RecapMetric, first_practice_days()

### Community 15 - "faculty_ml.py"
Cohesion: 0.14
Nodes (16): _accuracy(), _course_activities(), dashboard(), evaluation(), _faculty(), forecast_readiness(), _period_cutoff(), _snapshot() (+8 more)

### Community 16 - "shadow.py"
Cohesion: 0.20
Nodes (8): has_required_prediction_history(), prior_graded_task_count(), record_shadow_prediction(), _rollback_quietly(), 5. Work, Phase A: before pilot data collection (has a deadline), Phase B: Model evaluation page (no deadline), Phase C: after the pilot

### Community 17 - "exams/[id]/page.test.tsx"
Cohesion: 0.25
Nodes (5): answerSaves(), Call, mocks, savedBodies(), seedUnsyncedSnapshot()

### Community 18 - "entities.py"
Cohesion: 0.06
Nodes (31): CodeSubmissionRequest, run_code_submission(), _shadow_scoring_ready(), NotificationOutbox, SubmissionJob, deliver_one(), answer_grace(), claim_exam() (+23 more)

### Community 19 - "test_ml_exam_features.py"
Cohesion: 0.11
Nodes (18): _forecast(), _attempt(), test_bootstrap_intervals_are_reproducible_and_resample_learners(), test_faculty_forecast_uses_the_recorded_winner_and_hides_legacy_probability(), test_hint_exports_reject_identifying_columns(), test_older_feature_schema_artifacts_are_rejected(), test_rows_are_first_submissions_on_challenges_with_strictly_prior_history(), test_training_rejects_ids_that_encode_an_account() (+10 more)

### Community 20 - "predictor.py"
Cohesion: 0.09
Nodes (18): api_health_check(), health_check(), lifespan(), readiness_check(), load_ml_models(), ModelArtifactError, ModelArtifactsUnavailable, ModelBundle (+10 more)

### Community 21 - "profiles.py"
Cohesion: 0.19
Nodes (18): ActivityDay, _admin_analytics(), AdminAnalytics, AnalyticsResponse, AuditEntry, BadgeEntry, _enum_value(), ExamHistoryEntry (+10 more)

### Community 22 - "test_api_security.py"
Cohesion: 0.07
Nodes (17): reserve(), Rule, window_bounds(), extract_chunks_from_pdf(), extract_pdf_chunks(), test_ai_global_budgets_are_independent(), test_chat_has_dedicated_account_and_global_quota(), test_costly_action_pauses_if_quota_storage_is_unavailable() (+9 more)

### Community 23 - "sqlalchemy"
Cohesion: 0.09
Nodes (18): public_handle(), _starter_username(), _encoded_id(), is_starter_username(), starter_username(), pytest_sessionstart(), _export_queries(), test_documented_exports_require_latest_current_consent() (+10 more)

### Community 24 - "get"
Cohesion: 0.07
Nodes (44): get_chat_status(), challenge(), choose_consent(), close_challenge(), consent_status(), ConsentChoice, dashboard(), DraftPayload (+36 more)

### Community 25 - "6. Prioritized improvement backlog"
Cohesion: 0.08
Nodes (26): 1. Where the project stands, 2. Progress percentages and how they were calculated, 3. What exists today and where evidence stops, 4. Verification evidence and its limits, 5. Six gates before a live classroom pilot, 6. Prioritized improvement backlog, 7. Execution order, AI, LLM, RAG and provider handling (+18 more)

### Community 26 - "entities.py"
Cohesion: 0.08
Nodes (46): compare_submission(), SubmissionComparison, add_workshop_activities(), AddWorkshopActivities, WorkshopQuest, ActivityKind, LearningActivity, ProgrammingLang (+38 more)

### Community 27 - "submit_conceptual_quiz"
Cohesion: 0.09
Nodes (27): get_gamification_leaderboard(), get_student_progress(), LeaderboardEntry, LeaderboardResponse, LeaderboardStanding, list_published_quests(), _load_quiz_questions(), NextStepRecommendation (+19 more)

### Community 28 - "chat_history.py"
Cohesion: 0.16
Nodes (26): _check_revision(), Conversation, ConversationPage, create_conversation(), CreateConversation, delete_conversation(), delete_history(), _find_conversation() (+18 more)

### Community 29 - "Judge0UnavailableError"
Cohesion: 0.20
Nodes (8): classify_judge0_status(), Judge0UnavailableError, _parse_completed_result(), metric(), test_monitoring_distinguishes_worker_and_sandbox_outages(), sandbox_unavailable(), test_program_crash_is_still_graded_as_a_runtime_error(), unavailable()

### Community 30 - "activity-analysis.tsx"
Cohesion: 0.05
Nodes (74): Course health on System Overview, Already in place: extend, do not rebuild, Shared insight widgets, Verification and rollout, Already in place: extend, do not rebuild, ACTION_LABEL, AdminDashboardPage(), Page() (+66 more)

### Community 31 - "workshop-home.tsx"
Cohesion: 0.06
Nodes (67): WorkshopDetailLayout(), WorkshopInvitePage(), WorkshopsPage(), useShellProfile(), MasteryMap(), hueFromSeed(), identiconCells(), UserAvatar() (+59 more)

### Community 32 - "Prioritized defects"
Cohesion: 0.12
Nodes (17): 10. [P3] Hidden-case aggregate summary incorrectly reports zero, 2. [P1] Verification can certify content that Judge0 never checked, 3. [P1] Unreleased exam successes can affect visible rewards, 4. [P1] The current release build exits with a dependency security warning, 5. [P2] Challenges with no visible sample can be published, 6. [P2] The dashboard recommends a closed quest that cannot be submitted, 7. [P2] Completing one exam can hide another due exam on the dashboard, 8. [P2] A failed quiz is labeled completed (+9 more)

### Community 33 - "onboarding/page.tsx"
Cohesion: 0.08
Nodes (43): AuthMode, OnboardingContent(), authenticate(), changeAuthMode(), checkExistingAuth(), continueToAgreement(), finishPasswordSetup(), OnboardingPage() (+35 more)

### Community 34 - "chat.py"
Cohesion: 0.08
Nodes (25): _chat_activity(), ChatLimits, ChatMessageRequest, ChatMessageResponse, ChatSource, ChatStatus, ChatTurn, _course_passages() (+17 more)

### Community 35 - "test_auth_jwks.py"
Cohesion: 0.16
Nodes (4): test_es256_verifies_locally_off_the_event_loop(), test_failed_jwks_verification_falls_back(), test_non_asymmetric_algorithms_never_use_jwks(), test_embedding_request_matches_selected_model()

### Community 36 - "upload_my_avatar"
Cohesion: 0.18
Nodes (6): _detect_avatar_content_type(), school_id_availability(), SchoolIdCheck, upload_my_avatar(), test_detect_avatar_content_type_recognizes_supported_signatures(), test_detect_avatar_content_type_rejects_metadata_only_and_truncated_files()

### Community 37 - "leaderboard.tsx"
Cohesion: 0.20
Nodes (12): CHOOSE_HANDLE_HREF, Leaderboard(), LeaderboardData, LeaderboardEntry, LeaderboardStanding, LearnerName(), MEDAL, Row() (+4 more)

### Community 38 - "workspace/ui.tsx"
Cohesion: 0.05
Nodes (55): activityHref(), closesIn(), Dashboard, DashboardContent(), DashboardPage(), kindLabel(), localTime(), Progress (+47 more)

### Community 39 - "insights.py"
Cohesion: 0.18
Nodes (16): practice_errors(), CategoryCount, course_insights(), _event_days(), GamificationInsights, HelpSeeking, _manila_day(), MemoryRetention (+8 more)

### Community 40 - "train_compare.py"
Cohesion: 0.07
Nodes (21): test_adequacy_flags_a_small_test_partition(), _adequacy(), _atomic_joblib_dump(), _atomic_json_write(), _atomic_write(), _bootstrap_intervals(), _build_pipeline(), _evaluate_partition() (+13 more)

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

### Community 45 - "json"
Cohesion: 0.22
Nodes (6): ensure_student(), main(), student(), ask(), join_new_workshop(), queries_to_list_workshops()

### Community 46 - "ByteQuest UI/UX harmonization: slices 1–3 and ML slice planning"
Cohesion: 0.15
Nodes (12): Bugs found and fixed, ByteQuest UI/UX harmonization: slices 1–3 and ML slice planning, Checkpoint, Decisions made today, How it was checked, Next steps, Not checked, Slice 1: shared foundation and help (+4 more)

### Community 47 - "Faculty and administrator workspace — implementation log and continued work"
Cohesion: 0.11
Nodes (18): 10. Files created or modified (this work), 11. Quick current-state checklist, 1. Status at handoff, 2. Repository discovery (recorded before changes), 6. Tests added, 7. Verification evidence (live app), 8. How to continue (commands, accounts, cleanup), 9. Remaining work (+10 more)

### Community 48 - "package.json"
Cohesion: 0.11
Nodes (17): engines, node, name, overrides, dompurify, private, version, eslint (+9 more)

### Community 49 - "Phase 1 — ByteQuest instructor redesign plan"
Cohesion: 0.07
Nodes (29): Activity editor, Analytics, Analytics desktop, Analytics phone, API and data performance, Assumptions, Chart library and motion, Course data model and grade integrity (+21 more)

### Community 51 - "AppTooltips"
Cohesion: 0.28
Nodes (17): AppTooltips(), clearTimers(), findTarget(), hide(), onClick(), onContextMenu(), onFocusIn(), onFocusOut() (+9 more)

### Community 52 - "qa-responsive.mjs"
Cohesion: 0.09
Nodes (26): Goal, Layout system, Make ByteQuest fit every phone and tablet, Menu docking: finish what exists, Out of scope, Screens, Side navigation on handheld screens: already built, Touch and input (+18 more)

### Community 53 - "reveals_solution"
Cohesion: 0.09
Nodes (28): _contains_tokens(), _ngrams(), reveals_solution(), _single_line_repair(), _tokens(), test_challenge_chat_rejects_alternate_code_even_without_reference_overlap(), test_exact_repair_to_failed_sample_is_withheld_even_if_it_is_in_the_starter(), test_full_solution_is_blocked_even_with_renamed_variables() (+20 more)

### Community 54 - "ByteQuest UI and UX harmonization plan"
Cohesion: 0.17
Nodes (12): 1. What the review found, 2. How work moves through ByteQuest, 3. Student journey, 4. Instructor journey, 5. Administrator journey, 6. Shared visual and interaction system, 7. Contextual help and tooltips, 8. Delivery order (+4 more)

### Community 55 - "chat-provider.tsx"
Cohesion: 0.07
Nodes (50): chatHistory, ChatMode, ConversationPage, ConversationSummary, SavedReply, SavedTurn, Transcript, turnMessages() (+42 more)

### Community 56 - "vps_bootstrap.sh"
Cohesion: 0.24
Nodes (15): active_ssh_port(), configure_cgroup_v1(), configure_docker(), configure_firewall(), configure_swap(), DEBIAN_FRONTEND, die(), DOCKER_KEYRING (+7 more)

### Community 57 - "chat-conversation.tsx"
Cohesion: 0.08
Nodes (34): ChatPage(), availabilityCopy, ChatConversation(), onInputKey(), submit(), languageNames, suggestedPrompts(), ChatMessageContent() (+26 more)

### Community 58 - "LegalDocument"
Cohesion: 0.24
Nodes (9): metadata, Page(), metadata, Page(), LegalDocument(), LegalKind, LegalModal(), PolicyPanel() (+1 more)

### Community 59 - "llm.py"
Cohesion: 0.06
Nodes (17): get_settings(), Settings, ErrorExplanationSchema, explain_code_error(), _client_for_key(), GeminiConfigurationError, get_gemini_client(), _chat_failure() (+9 more)

### Community 60 - "ByteQuest Insights, part 3 of 4: instructors"
Cohesion: 0.18
Nodes (10): Activity health in the Activities list, ByteQuest Insights, part 3 of 4: instructors, Exam class summary, Goal, Handheld rules, Inactive 7+ days, Model evaluation, Out of scope (+2 more)

### Community 61 - "exams.py"
Cohesion: 0.09
Nodes (46): assigned(), assigned_exam_numbers(), _assigned_exams_with_state(), create_exam(), DraftExam, DraftItem, _exam_access(), exam_sample_run() (+38 more)

### Community 62 - "profile-header.tsx"
Cohesion: 0.12
Nodes (22): Draft, draftFrom(), handleProblem(), LANGUAGES, pendingChanges(), AttemptSummary(), CodeDiff(), loadEditor() (+14 more)

### Community 63 - "account_provisioning.py"
Cohesion: 0.42
Nodes (7): create_account(), _admin_headers(), build_profile(), delete_auth_user(), DuplicateAccount, invite_auth_user(), ProvisioningUnavailable

### Community 64 - "ByteQuest machine-learning improvement plan"
Cohesion: 0.14
Nodes (14): 1. Goal, 2. Where things stand, 3. Decisions, 4.1 Prediction unit and label, 4.2 History, 4.3 The ten features, in this order, 4.4 Live shadow scoring, 4.5 Reporting (+6 more)

### Community 65 - "rag_instructor.py"
Cohesion: 0.08
Nodes (29): _gemini_unavailable_http_exception(), generate_ai_coding_challenge(), generate_ai_conceptual_quiz(), GeneratedChallengeSchema, GeneratedQuizOptionSchema, GeneratedQuizQuestionSchema, GeneratedQuizSchema, _generation_payload() (+21 more)

### Community 66 - "ByteQuest — Security & AI-Abuse Hardening (implementation brief)"
Cohesion: 0.20
Nodes (9): ByteQuest — Security & AI-Abuse Hardening (implementation brief), Final report (keep it short), Order and verification, Out of scope: do not do these, Rules for every task, Stack, Task 4 — Administrators can never self-register, Task 5 — Chat activity context uses the shared visibility rule (+1 more)

### Community 67 - "ByteQuest 2.0 Classroom Pilot Operator Runbook"
Cohesion: 0.17
Nodes (12): 1. Hard Safety Gates (Enforced by Configuration), 2. Lab Station & Shared-Computer Protocol, 3. Network Resilience & Live Draft Sync, 4. Timed Exam Operations, 5. Verification Commands, 6. Incident Troubleshooting, ByteQuest 2.0 Classroom Pilot Operator Runbook, Classroom Wi-Fi Reconnect Banner (+4 more)

### Community 68 - "_TooLarge"
Cohesion: 0.18
Nodes (8): RequestSizeLimitMiddleware, limited_receive(), tracked_send(), _TooLarge, test_streamed_body_without_content_length_is_limited(), read_body(), receive(), send()

### Community 69 - "memory.py"
Cohesion: 0.25
Nodes (11): ConceptReview, eligible_concepts(), memory_schedule(), MemoryConcept, review_histories(), review_is_due(), review_overview(), ReviewHistory (+3 more)

### Community 70 - "ByteQuest local end-to-end flow"
Cohesion: 0.14
Nodes (14): Account-synced progression check, Before deployment, ByteQuest local end-to-end flow, Instructor account, Local Quest Map demos, Manual startup, One-click Windows startup, Open ByteQuest on a phone over ZeroTier (+6 more)

### Community 71 - "accessibility-provider.tsx"
Cohesion: 0.18
Nodes (16): Repo map: exact files to inspect and change, ACCESSIBILITY_STORAGE_KEYS, AccessibilityContext, AccessibilityContextValue, AccessibilityPreferences, AccessibilityProvider(), applyPreferences(), commitPreferences() (+8 more)

### Community 72 - "ByteQuest 2.0"
Cohesion: 0.22
Nodes (9): Architecture, ByteQuest 2.0, Configuration and security, Documentation, Repository layout, Stack and deployment, Start locally on Windows, Test and verify (+1 more)

### Community 74 - "ByteQuest 2.0 — Full system review"
Cohesion: 0.12
Nodes (14): Already strong (checked, not assumed), ByteQuest 2.0 — Full system review, Evidence, Must fix, Nice to have, Not checked, Ratings, Should fix (+6 more)

### Community 75 - "Phase 0 — ByteQuest instructor audit"
Cohesion: 0.22
Nodes (8): Current FastAPI inventory, Current screens and feature coverage, Decisions for Phase 1, Desktop scorecard, Findings, Phase 0 — ByteQuest instructor audit, Supabase data and authorization, Verification

### Community 76 - "StorageError"
Cohesion: 0.23
Nodes (5): StorageError, SupabasePDFStorage, test_accepts_absolute_signed_url_from_configured_origin(), test_rejects_untrusted_signed_url(), test_resolves_supabase_relative_signed_path()

### Community 77 - "Prompt for ChatGPT: ByteQuest gamification, Phases 2 and 3"
Cohesion: 0.20
Nodes (9): 10. Definition of done (for each part), 12. Final report format, 1. Your role and mission, 3. Stack, layout and commands, 6. Phase 2A — Debugger's Codex (badges + progress indicator), 7. Phase 2B — Concept Mastery Map (progress indicator, open learner model), 8. Phase 3A — Mastery Memory (quests + points, spaced retrieval), 9. Phase 3B — Staged mechanic rollout (counters the novelty dip) (+1 more)

### Community 78 - "ByteQuest 2.0 database review — 12 November 2026"
Cohesion: 0.12
Nodes (14): _id(), test_every_public_timestamp_column_is_aware(), A. Inventory, B. Findings, ByteQuest 2.0 database review — 12 November 2026, C. Migration plan, D. Index recommendations, E. Organisation and documentation (+6 more)

### Community 79 - "CourseMember"
Cohesion: 0.08
Nodes (24): _account_needs_action(), instructor_exams(), get_my_analytics(), _instructor_analytics(), get_instructor_workspace(), _serialize_document(), CourseMember, active_membership_course_ids() (+16 more)

### Community 80 - "SYSTEM_STATUS_AND_RELEASE_PLAN.md"
Cohesion: 0.17
Nodes (4): ByteQuest repository guidance, Current system status, graphify, This is NOT the Next.js you know

### Community 81 - "qa_live_multi_role.py"
Cohesion: 0.14
Nodes (20): challenge_specs(), api_base(), cleanup(), create_accounts(), instructor_builds_course(), letters(), main(), password_token() (+12 more)

### Community 82 - "entities.py"
Cohesion: 0.07
Nodes (28): get_settings(), ComparedAttempt, get_job(), _retry_failed_job(), retry_job(), submit_job(), SubmitJob, view() (+20 more)

### Community 83 - "ByteQuest 2.0: Master Architecture Plan & Execution Roadmap"
Cohesion: 0.08
Nodes (24): 1. Project Tracking & Thesis Collaboration Strategy, 2. Core Architectural Rules (Non-Negotiable), 3. Repository Directory Structure, 4. Course-Sequence & Curriculum Alignment, 5. Database Schema Blueprint (Supabase PostgreSQL + pgvector), 6. 7-Phase Development Plan, 7. Thesis Objectives Mapping (Chapter 1 Alignment), 8. Development Environment & Quickstart Commands (+16 more)

### Community 84 - "Phase 7 deployment readiness"
Cohesion: 0.18
Nodes (11): Decisions required before production setup, Deployment order after the decisions are made, Evidence still needed, Local Judge0 runtime smoke check (2026-10-26), Notes on local verification, Phase 7 deployment readiness, Prepared in the repository, Production settings and network boundaries (+3 more)

### Community 85 - "lib/types.ts"
Cohesion: 0.04
Nodes (57): 1. Current architecture, Existing API contracts, ExamCard, ExamsPage(), localTime(), QuestsPage(), QuestsPageContent(), changeView() (+49 more)

### Community 86 - "Corrected Lesson to Student Progress Verification"
Cohesion: 0.22
Nodes (6): Code and quality checks, Corrected Lesson to Student Progress Verification, Earlier student workflow verification (historical run), Environment and source, Follow-up and known boundaries, Instructor workflow

### Community 87 - "ProfileResponse"
Cohesion: 0.22
Nodes (5): get_my_profile(), ProfileResponse, ProfileUpdateRequest, update_my_profile(), normalize_username()

### Community 88 - "asyncio"
Cohesion: 0.36
Nodes (6): cleanup(), main(), make_students(), one_student(), require_local(), run_load()

### Community 89 - "test_memory_rules.py"
Cohesion: 0.31
Nodes (4): review_passed(), review_size(), test_review_passes_at_two_thirds(), test_review_size_uses_up_to_four_questions()

### Community 90 - "workspace.ts"
Cohesion: 0.04
Nodes (84): 4.4 Faculty API (`backend/app/api/faculty.py`, prefix `/api/v1/faculty`), 4.5 Administrator API (`backend/app/api/admin.py`, prefix `/api/v1/admin`), AdminAccounts(), confirmDeactivate(), confirmReactivate(), openImpact(), submitCreate(), Page() (+76 more)

### Community 91 - "Instructor activity analysis and class announcements"
Cohesion: 0.33
Nodes (6): Activity analysis, Browser verification, Class announcements, Instructor activity analysis and class announcements, Remaining verification, Verification

### Community 92 - "Desktop and Mobile Pilot Flows (`pilot-v2.html`)"
Cohesion: 0.22
Nodes (8): 1. Offline / Network Reconnect Banner, 2. Pending / Queued Grading State, 3. Research Consent & Withdrawal State (Disabled Collection Notice), 4. Active Exam Priority Banner & Timed Attempt Lock, ByteQuest web app wireframes, Coverage, Desktop and Mobile Pilot Flows (`pilot-v2.html`), Review checklist

### Community 93 - "test_sandbox_internal_error_is_unavailability_not_a_student_failure"
Cohesion: 0.28
Nodes (5): test_hidden_case_contributes_to_score_without_exposing_details(), language_ids(), poll_batch(), submit_batch(), test_sandbox_internal_error_is_unavailability_not_a_student_failure()

### Community 94 - "ByteQuest Insights, part 4 of 4: administrators"
Cohesion: 0.33
Nodes (5): ByteQuest Insights, part 4 of 4: administrators, Goal, Handheld rules, Out of scope, Verification and rollout

### Community 95 - "app-shell.tsx"
Cohesion: 0.06
Nodes (57): Already in place: extend, do not rebuild, 5.2 Faculty routes, 5.3 Administrator routes, 5.4 Navigation and shell integration, 5. Frontend changes, AccessibilityPage(), WorkspaceLayout(), WorkshopsLayout() (+49 more)

### Community 96 - "quiz-view.tsx"
Cohesion: 0.16
Nodes (8): QuizPage(), getActivityHref(), QuizResult, QuizView(), handleSubmitQuiz(), load(), { api }, QuizQuestion

### Community 97 - "ML pipeline synthetic verification — 2026-10-25"
Cohesion: 0.29
Nodes (6): Artifact and activation checks, Execution, ML pipeline synthetic verification — 2026-10-25, Observed grouped metrics, Remaining Phase 5 work, Scope

### Community 98 - "Judge0 Hyper-V Ubuntu VM: troubleshooting handoff"
Cohesion: 0.22
Nodes (9): Confirmed project and Judge0 setup, Current state, Direct-shell recovery method that worked, Historical recommendation written before the Install VM recovery, Judge0 Hyper-V Ubuntu VM: troubleshooting handoff, Known guest settings and identifiers, Sources, Timeline of important events and changes (+1 more)

### Community 99 - "preflight-host.sh"
Cohesion: 0.38
Nodes (6): fail(), MIN_MEMORY_BYTES, MIN_ROOT_FREE_BYTES, MIN_SWAP_BYTES, pass(), preflight-host.sh script

### Community 100 - "Phase 6 shadow rollout implementation record"
Cohesion: 0.40
Nodes (5): Implemented, Phase 6 shadow rollout implementation record, Phase 7 handoff, Safety and current state, Verification still required

### Community 101 - "qa_starter_tutoring.py"
Cohesion: 0.22
Nodes (5): _evaluate(), _failed_sample(), main(), _request(), TutorCase

### Community 102 - "ML feature engineering and training"
Cohesion: 0.40
Nodes (5): Comparison protocol, Export an attempt dataset, ML feature engineering and training, Prepare an Ubuntu VPS, Safe pipeline setup

### Community 103 - "monitoring.py"
Cohesion: 0.32
Nodes (8): GradingWorkerHeartbeat, _grading_worker_health(), _minutes(), _prediction_health(), _rag_health(), _runner_health(), service_health(), _status()

### Community 104 - "ByteQuest Gemini tutor pilot evaluation"
Cohesion: 0.50
Nodes (4): ByteQuest Gemini tutor pilot evaluation, Reply quality, Token use and estimated Gemini cost, What was tested

### Community 105 - "arena.tsx"
Cohesion: 0.08
Nodes (37): ArenaPage(), Arena(), checkStatus(), confirmResetCode(), endSegment(), handleCodeChange(), handleCopyOutput(), load() (+29 more)

### Community 106 - "ByteQuest navigation"
Cohesion: 0.40
Nodes (5): ByteQuest navigation, Compatibility and new destinations, Existing routes, Local verification, Workshops (11/21/26)

### Community 107 - "Workshops: Create, Join and the Workshop page"
Cohesion: 0.20
Nodes (10): 10. Decisions to critique, 1. What exists today, 2. Screen map, 3. Rules, 5. API changes (all under `/api/v1/workshops`), 6. Frontend structure, 7. Delivery slices (each ships with tests), 8. Out of scope for v1 (+2 more)

### Community 108 - "Milestones 1A–1C Status and Verification Log"
Cohesion: 0.22
Nodes (9): Environment, Follow-up verification — 2026-10-25, Milestone 1A: Judge0 execution, Milestone 1B: Local Supabase schema and fixtures, Milestone 1C: Browser-to-database walkthrough — Complete, verified, Milestones 1A–1C Status and Verification Log, Official milestone disposition, Submission-flow corrections made (+1 more)

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

### Community 117 - "client.py"
Cohesion: 0.15
Nodes (6): _b64_decode(), _b64_encode(), BatchEvaluationSummary, CircuitBreaker, Judge0CircuitOpenError, SingleTestResult

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

### Community 124 - "get_current_user_payload"
Cohesion: 0.33
Nodes (3): get_current_user_payload(), TokenPayload, Task 3 — Verify Supabase's asymmetric JWTs locally (performance)

### Community 126 - "ByteQuest 2.0 system critique — 21 November 2026"
Cohesion: 0.33
Nodes (6): ByteQuest 2.0 system critique — 21 November 2026, Not verified in this review, Scorecard, Top 5 things to do next, Verdict, What is working well (keep)

### Community 127 - "Judge0 Hyper-V Ubuntu boot incident and recovery"
Cohesion: 0.13
Nodes (15): 1. Start and open the known-good VM, 2. Confirm the Judge0 services and volume inside Ubuntu, 3. Get the current guest IP and check the port, 4. Update ByteQuest if the VM IP changed, 5. Restart FastAPI and leave it running, 6. Verify service integration without exposing secrets, Current verified state, Disk and data safety (+7 more)

### Community 128 - "ByteQuest manuscript and system alignment checklist"
Cohesion: 0.20
Nodes (10): 1. Scope decisions, 2. Chapter 1 — Introduction and scope, 3. Chapter 2 — Literature and synthesis, 4. Chapter 3 — Roles, practice, and AI, 5. Chapter 3 — Assessment and architecture, 6. Chapter 3 — Consent, research data, and ML, 7. Study records and final sign-off, ByteQuest manuscript and system alignment checklist (+2 more)

### Community 132 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, eslint, eslint-config-next, jsdom, @testing-library/react, @types/node, @types/react, @types/react-dom (+2 more)

### Community 133 - "ByteQuest 2.0 live deployment stack"
Cohesion: 0.40
Nodes (5): Before the 30-student session, ByteQuest 2.0 live deployment stack, PHP budget, What ByteQuest runs, What to pay for

### Community 134 - "complete_student_onboarding"
Cohesion: 0.33
Nodes (4): complete_staff_setup(), complete_student_onboarding(), _require_student(), StaffSetupRequest

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
Cohesion: 0.17
Nodes (11): AnnouncementCreate, AnnouncementExpiry, AnnouncementPatch, _audit_change(), _authorize_announcement(), create_announcement(), delete_announcement(), list_announcements() (+3 more)

### Community 142 - "Local API security contract"
Cohesion: 0.40
Nodes (5): Access matrix, Local API security contract, Local verification and future deployment, Quotas and validation, School-issued IDs for student sign-up

### Community 150 - "runner_status"
Cohesion: 0.36
Nodes (8): runner_status(), job(), test_a_failing_latest_job_is_a_current_failure(), test_a_job_stuck_in_the_queue_marks_the_queue_stale(), test_a_job_that_just_arrived_is_not_a_stall(), test_a_service_switched_off_on_purpose_does_not_degrade_overall_health(), test_old_activity_reads_in_hours_and_days_not_hundreds_of_minutes(), test_old_failures_do_not_hide_a_recovered_runner()

### Community 151 - "performance/page.tsx"
Cohesion: 0.08
Nodes (48): Student Progress: the only roster and learner drawer, ComparisonTable(), ConfusionMatrix(), CurveChart(), Methodology(), metric(), METRIC_COLUMNS, METRIC_DEFINITIONS (+40 more)

### Community 153 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, monaco-editor, @monaco-editor/react, next, react, react-dom, react-is, recharts (+1 more)

### Community 154 - "app/layout.tsx"
Cohesion: 0.15
Nodes (13): byteBounce, metadata, RootLayout(), viewport, hasVisibleText(), tooltipFor(), TooltipState, ToastApi (+5 more)

### Community 156 - "destroy_research_link.py"
Cohesion: 0.38
Nodes (3): destroy(), main(), main()

### Community 157 - "retrieval.py"
Cohesion: 0.10
Nodes (16): _retrieve_document_sources(), embed_one(), GeminiEmbeddingService, generate_embedding(), activity_document_ids(), _chat_excerpt(), cited_sources(), course_document_ids() (+8 more)

### Community 158 - "review-report.md"
Cohesion: 0.18
Nodes (9): ByteQuest 2.0 engineering and UX review, Findings, Performance evidence, Recommended sequence, Verification and limits, ByteQuest backend runtime review, Mixed local workload, Pending measurements and review (+1 more)

### Community 163 - "ByteQuest 2.0: close the manuscript gaps, tidy the structure, then review and rate the system"
Cohesion: 0.14
Nodes (11): RFC-4122, ByteQuest 2.0: close the manuscript gaps, tidy the structure, then review and rate the system, Do not, Final report, Hard rules, Part 3: Code structure (targeted; behaviour must stay identical), Part 4: Review and targeted fixes, Stack and layout (+3 more)

### Community 164 - "Phase 7 backend image build verification"
Cohesion: 0.40
Nodes (4): Limits, Phase 7 backend image build verification, Recorded evidence, Work completed

### Community 166 - "ByteQuest Insights, part 1 of 4: shared foundation"
Cohesion: 0.20
Nodes (9): ByteQuest Insights, part 1 of 4: shared foundation, Charts: two primitives, Goal, Handheld rules, Metric labels, Out of scope, Profile: one role tab, each figure once, Remove the duplicate Sequencer evaluation (+1 more)

### Community 167 - "instructor/page.tsx"
Cohesion: 0.08
Nodes (60): Already in place: extend, do not rebuild, One kit: course-ui, Implementation status (21 November 2026, same day), Medium, FacultyActivities(), copyActivity(), submitCreate(), Page() (+52 more)

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
Cohesion: 0.14
Nodes (24): get_review(), get_reviews(), _locked_student(), _public_review(), _question_id(), _require_memory(), ReviewOverviewResponse, ReviewResponse (+16 more)

### Community 175 - "Judge0Client"
Cohesion: 0.24
Nodes (4): Judge0Client, TestCaseInput, main(), verify_compilers()

### Community 176 - "Phase 7 synthetic deployment preflight — 2026-10-26"
Cohesion: 0.33
Nodes (5): Evidence, Limits, Phase 7 synthetic deployment preflight — 2026-10-26, Result, Scope and method

### Community 179 - "Production instructor access"
Cohesion: 0.67
Nodes (3): Grant access to one account, Production instructor access, Safety boundaries

## Knowledge Gaps
- **18 isolated node(s):** `monaco-editor`, `react-is`, `@types/node`, `@types/react`, `@types/react-dom` (+13 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1390 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `4. Read these before writing any code` connect `_token` to `Session`, `workspace/ui.tsx`, `activities/[id]/page.tsx`, `flow`, `test_learning_flow_integration.py`, `reviews.py`, `Prompt for ChatGPT: ByteQuest gamification, Phases 2 and 3`, `profiles.py`, `get`, `entities.py`, `submit_conceptual_quiz`, `Judge0UnavailableError`, `activity-analysis.tsx`, `workshop-home.tsx`?**
  _High betweenness centrality (0.182) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `Session` (e.g. with `smoke_demo_quest()` and `test_two_concurrent_saves_cannot_commit_the_same_activity_version()`) actually correct?**
  _`Session` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `monaco-editor`, `react-is`, `@types/node` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `workspace-provider.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05092592592592592 - nodes in this community are weakly interconnected._
- **Why does `LearningActivity` connect `entities.py` to `Session`, `_token`, `workshops.py`, `test_faculty_admin.py`, `solve_quality.py`, `get`, `test_learning_flow_integration.py`, `faculty_ml.py`, `shadow.py`, `entities.py`, `test_ml_exam_features.py`, `predictor.py`, `profiles.py`, `get`, `submit_conceptual_quiz`, `retrieval.py`, `chat.py`, `insights.py`, `reviews.py`, `exams.py`, `rag_instructor.py`, `memory.py`, `CourseMember`, `qa_live_multi_role.py`, `entities.py`, `lib/types.ts`, `asyncio`, `monitoring.py`?**
  _High betweenness centrality (0.128) - this node is a cross-community bridge._
- **Are the 281 inferred relationships involving `Profile` (e.g. with `account_impact()` and `_account_needs_action()`) actually correct?**
  _`Profile` has 281 INFERRED edges - model-reasoned connections that need verification._
- **Should `Session` be split into smaller, more focused modules?**
  _Cohesion score 0.05924960162248298 - nodes in this community are weakly interconnected._