# Graph Report - ByteQuest_2.0  (2026-11-22)

## Corpus Check
- 470 files · ~511,225 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 38 file(s) not represented in the graph (top: (none) 19, .bat 5, .example 5)

## Summary
- 4291 nodes · 14403 edges · 186 communities (159 shown, 27 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 1897 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `38f92bbe`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ui.tsx
- ByteQuest 2.0: instructor activity analysis and class announcements
- Session
- _token
- workshops.py
- chat-workspace.tsx
- LearningActivity
- test_faculty_admin.py
- activities/[id]/page.tsx
- start-bytequest.ps1
- drafts.py
- drafts.py
- supabase.ts
- _enroll_chat_students
- attempt_visibility.py
- course_access.py
- account-menu.tsx
- exams/[id]/page.test.tsx
- entities.py
- test_ml_exam_features.py
- predictor.py
- profiles.py
- test_api_security.py
- sqlalchemy
- pilot.py
- 6. Prioritized improvement backlog
- entities.py
- submit_conceptual_quiz
- chat_history.py
- submission-comparison.tsx
- lib/types.ts
- workshop-home.tsx
- Prioritized defects
- onboarding/page.tsx
- chat.py
- course-shell.tsx
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
- workshop-activities.tsx
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
- evaluation.tsx
- exams.py
- profile/page.tsx
- useChatController
- ByteQuest machine-learning improvement plan
- rag_instructor.py
- train_compare.py
- ByteQuest 2.0 Classroom Pilot Operator Runbook
- _TooLarge
- AuditEvent
- ByteQuest local end-to-end flow
- accessibility-provider.tsx
- ByteQuest 2.0
- ProgrammingLang
- ByteQuest 2.0 — Full system review
- Phase 0 — ByteQuest instructor audit
- StorageError
- ActivityKind
- ByteQuest 2.0 database review — 12 November 2026
- Session
- SYSTEM_STATUS_AND_RELEASE_PLAN.md
- account_provisioning.py
- entities.py
- ByteQuest 2.0: Master Architecture Plan & Execution Roadmap
- Phase 7 deployment readiness
- quests/page.tsx
- submissions/[id]/page.tsx
- pdf_processor.py
- asyncio
- test_pilot_drafts_jobs_hints_and_consent_gate
- workspace.ts
- Instructor activity analysis and class announcements
- Desktop and Mobile Pilot Flows (`pilot-v2.html`)
- workspace-provider.test.tsx
- ByteQuest Insights, part 4 of 4: administrators
- app-shell.tsx
- quiz-view.tsx
- ML pipeline synthetic verification — 2026-10-25
- enroll-students.tsx
- preflight-host.sh
- Phase 6 shadow rollout implementation record
- httpx
- ML feature engineering and training
- monitoring.py
- ByteQuest Gemini tutor pilot evaluation
- arena.tsx
- ByteQuest navigation
- ByteQuest UI/UX harmonization: slices 1–3 and ML slice planning
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
- getErrorMessage
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
- ByteQuest — Security & AI-Abuse Hardening (implementation brief)
- FastAPI
- settings_service.py
- Local API security contract
- prepare_ml_dataset
- MLPrediction
- test_learning_flow_integration.py
- GeminiConfigurationError
- review-runner.tsx
- performance/page.tsx
- workshop-progress.tsx
- dependencies
- flow
- starter_username
- retrieval.py
- 1. Current architecture
- test_monitoring_distinguishes_worker_and_sandbox_outages
- components/student-preview.tsx
- SandboxHealth
- app-tooltips.tsx
- Phase 7 backend image build verification
- ByteQuest Insights, part 1 of 4: shared foundation
- instructor/page.tsx
- ByteQuest Insights, part 2 of 4: students
- Phase 7 frontend build evidence
- Phase 7 Vercel setup verification — 2026-10-26
- ByteQuest system status — 21 November 2026
- Phase 7 dependency security review (2026-10-26)
- reviews.py
- Phase 7 synthetic deployment preflight — 2026-10-26
- CLAUDE.md
- Production instructor access
- frontend/AGENTS.md

## God Nodes (most connected - your core abstractions)
1. `Session` - 362 edges
2. `Profile` - 355 edges
3. `LearningActivity` - 221 edges
4. `getErrorMessage()` - 148 edges
5. `ActivityAttempt` - 121 edges
6. `apiRequest()` - 121 edges
7. `ReviewState` - 110 edges
8. `ProgrammingLang` - 95 edges
9. `UserRole` - 92 edges
10. `react` - 88 edges

## Surprising Connections (you probably didn't know these)
- `Supabase data and authorization` --references--> `audit_events()`  [INFERRED]
  .design/checkup-report.md → backend/app/api/admin.py
- `Double-check before you report` --references--> `faculty_user()`  [INFERRED]
  docs/prompts/chatgpt-instructor-analysis-and-announcements.md → backend/app/api/faculty/common.py
- `P1 — functional gaps / decisions` --references--> `performance()`  [INFERRED]
  docs/verification/faculty-admin-workspace-2026-10-29.md → backend/app/api/faculty/performance.py
- `C. Improve Create Quest` --references--> `_published_activities()`  [INFERRED]
  docs/DEEPSEEK_V4_1_FLASH_QUEST_EXPANSION_GUIDE.md → backend/app/api/workshops.py
- `End-to-end traces` --references--> `get_db()`  [INFERRED]
  docs/DATABASE_REVIEW_2026-11-12.md → backend/app/core/database.py

## Import Cycles
- None detected.

## Communities (186 total, 27 thin omitted)

### Community 0 - "ui.tsx"
Cohesion: 0.08
Nodes (77): Design system and data flow, Frontend, Stack and layout, 5.1 Shared library and components, AdminAccounts(), confirmDeactivate(), openImpact(), Page() (+69 more)

### Community 1 - "ByteQuest 2.0: instructor activity analysis and class announcements"
Cohesion: 0.15
Nodes (12): Backend, ByteQuest 2.0: instructor activity analysis and class announcements, Database, Double-check before you report, Final report, Frontend, Hard rules, Part 1: Activity analysis (+4 more)

### Community 2 - "Session"
Cohesion: 0.11
Nodes (34): _admin_material_items(), admin_materials(), retry_job(), _material_for_user(), archive_material(), create_material(), download_material(), list_materials() (+26 more)

### Community 3 - "_token"
Cohesion: 0.15
Nodes (25): PlatformSetting, _challenge(), _graded_job(), _published_activity(), _reveal_reviewed_hint(), test_a_closed_challenge_cannot_reopen_after_its_solution_was_shown(), test_codex_recovers_distinct_practice_errors_on_the_first_pass(), test_instructor_gate_and_student_submission_contract() (+17 more)

### Community 4 - "workshops.py"
Cohesion: 0.05
Nodes (92): _activity_links(), add_workshop_activities(), _announcement_for_update(), AnnouncementView, archive_workshop(), can_manage(), create_workshop(), CreateAnnouncement (+84 more)

### Community 5 - "chat-workspace.tsx"
Cohesion: 0.12
Nodes (25): ChatPage(), useChat(), openConversation(), startChat(), updateHistory(), activityFromPath(), ChatConversation, ChatIcon() (+17 more)

### Community 6 - "LearningActivity"
Cohesion: 0.15
Nodes (34): LearningActivity, ReviewState, test_prediction_history_counts_distinct_prior_tasks_not_retries(), new_session(), _quiz(), _recall_concept(), _review_and_publish(), _run_queued_job() (+26 more)

### Community 7 - "test_faculty_admin.py"
Cohesion: 0.09
Nodes (30): test_account_creation_provisions_a_profile_and_course_access(), admin_row(), test_activity_editor_preview_hides_answer_keys_and_hidden_tests(), test_admin_course_health_suppresses_small_groups_and_restricts_access(), test_admin_creates_course_and_duplicate_code_is_rejected(), test_administrator_cannot_use_academic_faculty_routes(), test_course_announcement_validation_and_limits(), test_deactivation_blocks_the_account_and_self_deactivation_is_refused() (+22 more)

### Community 8 - "activities/[id]/page.tsx"
Cohesion: 0.04
Nodes (73): Step A checkpoint and caller verification, ActivityEditor(), confirmPublish(), createVersion(), diffPayload(), runVerification(), save(), saveSchedule() (+65 more)

### Community 9 - "start-bytequest.ps1"
Cohesion: 0.07
Nodes (42): ConvertTo-EncodedPowerShellCommand(), ConvertTo-PowerShellLiteral(), Get-BackendFingerprint(), Get-FrontendFingerprint(), Get-Judge0VmIPv4(), Get-Judge0VmIPv4FromNeighbor(), Get-ListenerPidMap(), Get-PageScriptPaths() (+34 more)

### Community 10 - "drafts.py"
Cohesion: 0.11
Nodes (30): ActivityCreate, ActivityUpdate, create_activity(), create_activity_version(), get_activity(), _grading_fields(), preview_activity(), publish_activity() (+22 more)

### Community 11 - "drafts.py"
Cohesion: 0.09
Nodes (42): admin_activities(), _admin_activity_item(), list_activity_workspace(), _activity_brief(), _course_brief(), _draft_item(), _draft_response(), faculty_user() (+34 more)

### Community 12 - "supabase.ts"
Cohesion: 0.08
Nodes (36): Interrupted Exam Autosave & Browser Recovery (Checklist Item #3), Other Remaining Pilot Verification Gates, Verification Status & Remaining Gates, cleared, localMap, mockLocalStorage, mockSessionStorage, remaining (+28 more)

### Community 13 - "_enroll_chat_students"
Cohesion: 0.08
Nodes (31): DocumentChunk, GeminiAPIError, test_chat_requires_active_enrollment_only_for_students(), _chat_payload(), _course_pdf(), _enroll_chat_students(), test_chat_and_hints_are_grounded_in_own_course_pdfs(), test_chat_answers_without_sources_when_retrieval_fails() (+23 more)

### Community 14 - "attempt_visibility.py"
Cohesion: 0.10
Nodes (19): activity_accepts_submissions_clause(), activity_has_opened(), activity_is_closed(), _as_utc(), learner_visible_attempt_clause(), published_track_clause(), student_visible_activity_clause(), completed_activity_ids() (+11 more)

### Community 15 - "course_access.py"
Cohesion: 0.12
Nodes (21): list_course_operations(), get_instructor_workspace(), _serialize_document(), active_membership_course_ids(), courses_for_user(), default_instructor_course_id(), ensure_owned_or_admin(), has_course_role() (+13 more)

### Community 16 - "account-menu.tsx"
Cohesion: 0.15
Nodes (17): 5.2 Faculty routes, 5.3 Administrator routes, 5.4 Navigation and shell integration, 5. Frontend changes, AccessibilityPage(), AccessibilityPreferenceKey, ACCESSIBILITY_SETTINGS, AccessibilitySettingDefinition (+9 more)

### Community 17 - "exams/[id]/page.test.tsx"
Cohesion: 0.25
Nodes (5): answerSaves(), Call, mocks, savedBodies(), seedUnsyncedSnapshot()

### Community 18 - "entities.py"
Cohesion: 0.07
Nodes (20): CodeSubmissionRequest, run_code_submission(), _shadow_scoring_ready(), deliver_one(), ExamGradingClaim, _grade_claimed_exam(), grade_exam(), _lock_exam_claim() (+12 more)

### Community 19 - "test_ml_exam_features.py"
Cohesion: 0.13
Nodes (16): _forecast(), _attempt(), test_adequacy_flags_a_small_test_partition(), test_bootstrap_intervals_are_reproducible_and_resample_learners(), test_faculty_forecast_uses_the_recorded_winner_and_hides_legacy_probability(), test_hint_exports_reject_identifying_columns(), test_older_feature_schema_artifacts_are_rejected(), test_rows_are_first_submissions_on_challenges_with_strictly_prior_history() (+8 more)

### Community 20 - "predictor.py"
Cohesion: 0.11
Nodes (16): lifespan(), load_ml_models(), ModelArtifactError, ModelArtifactsUnavailable, ModelBundle, _partition_report(), _positive_probability(), predict_student_success() (+8 more)

### Community 21 - "profiles.py"
Cohesion: 0.06
Nodes (38): ActivityDay, _admin_analytics(), AdminAnalytics, AnalyticsResponse, AuditEntry, BadgeEntry, complete_staff_setup(), complete_student_onboarding() (+30 more)

### Community 22 - "test_api_security.py"
Cohesion: 0.07
Nodes (17): Settings, get_db(), reserve(), Rule, window_bounds(), RequestSizeLimitMiddleware, test_ai_global_budgets_are_independent(), test_chat_has_dedicated_account_and_global_quota() (+9 more)

### Community 23 - "sqlalchemy"
Cohesion: 0.09
Nodes (13): pytest_sessionstart(), test_failed_jwks_verification_falls_back(), test_non_asymmetric_algorithms_never_use_jwks(), test_embedding_request_matches_selected_model(), _make_profile(), test_badge_code_is_required(), test_concurrent_username_claims_allow_only_one_winner(), test_core_timestamps_are_aware_and_comparable() (+5 more)

### Community 24 - "pilot.py"
Cohesion: 0.17
Nodes (24): require_practice_help_available(), challenge(), choose_consent(), close_challenge(), ConsentChoice, DraftPayload, _expired_hint_reservation(), get_draft() (+16 more)

### Community 25 - "6. Prioritized improvement backlog"
Cohesion: 0.08
Nodes (26): 1. Where the project stands, 2. Progress percentages and how they were calculated, 3. What exists today and where evidence stops, 4. Verification evidence and its limits, 5. Six gates before a live classroom pilot, 6. Prioritized improvement backlog, 7. Execution order, AI, LLM, RAG and provider handling (+18 more)

### Community 26 - "entities.py"
Cohesion: 0.13
Nodes (21): AddWorkshopActivities, ProgrammingLang, apply_publish_rules(), challenge_is_verified(), challenge_validation_fingerprint(), run_reference_check(), verify_saved_challenge(), _grade_item() (+13 more)

### Community 27 - "submit_conceptual_quiz"
Cohesion: 0.09
Nodes (26): dashboard(), _ensure_student(), get_gamification_leaderboard(), get_gamification_state(), get_student_progress(), LeaderboardEntry, LeaderboardResponse, LeaderboardStanding (+18 more)

### Community 28 - "chat_history.py"
Cohesion: 0.16
Nodes (26): ChatSource, ChatTurn, _check_revision(), Conversation, ConversationPage, create_conversation(), CreateConversation, delete_conversation() (+18 more)

### Community 29 - "submission-comparison.tsx"
Cohesion: 0.18
Nodes (14): Editor, AttemptSummary(), CodeDiff(), loadEditor(), ComparedAttempt, ComparisonResult(), isDesktop(), PanelState (+6 more)

### Community 30 - "lib/types.ts"
Cohesion: 0.09
Nodes (21): ERROR_LABELS, MEMORY_LABELS, STATE_LABELS, item, mocks, workshop, item, mocks (+13 more)

### Community 31 - "workshop-home.tsx"
Cohesion: 0.08
Nodes (45): 4.4 Faculty API (`backend/app/api/faculty.py`, prefix `/api/v1/faculty`), WorkshopDetailLayout(), WorkshopInvitePage(), WorkshopsPage(), useShellProfile(), Announcement, AnnouncementDialog, Announcements() (+37 more)

### Community 32 - "Prioritized defects"
Cohesion: 0.12
Nodes (17): 10. [P3] Hidden-case aggregate summary incorrectly reports zero, 2. [P1] Verification can certify content that Judge0 never checked, 3. [P1] Unreleased exam successes can affect visible rewards, 4. [P1] The current release build exits with a dependency security warning, 5. [P2] Challenges with no visible sample can be published, 6. [P2] The dashboard recommends a closed quest that cannot be submitted, 7. [P2] Completing one exam can hide another due exam on the dashboard, 8. [P2] A failed quiz is labeled completed (+9 more)

### Community 33 - "onboarding/page.tsx"
Cohesion: 0.12
Nodes (35): AuthMode, OnboardingContent(), authenticate(), changeAuthMode(), checkExistingAuth(), continueToAgreement(), finishPasswordSetup(), OnboardingPage() (+27 more)

### Community 34 - "chat.py"
Cohesion: 0.07
Nodes (24): _chat_activity(), ChatLimits, ChatMessageRequest, ChatMessageResponse, ChatStatus, _course_passages(), create_chat_message(), generate_chat_reply() (+16 more)

### Community 35 - "course-shell.tsx"
Cohesion: 0.24
Nodes (10): WorkshopsLayout(), CourseNavigationLinks(), CourseSwitcher(), InstructorCourseShell(), InstructorShell(), MoreNavigation(), InstructorIcon(), AppNavIcon() (+2 more)

### Community 36 - "workspace-provider.tsx"
Cohesion: 0.19
Nodes (11): AdminLayout(), FacultyLayout(), ADMIN_SECTION_GROUPS, AdminSectionNav(), path, WorkspaceContext, WorkspaceContextValue, WorkspaceProvider() (+3 more)

### Community 37 - "leaderboard.tsx"
Cohesion: 0.20
Nodes (12): CHOOSE_HANDLE_HREF, Leaderboard(), LeaderboardData, LeaderboardEntry, LeaderboardStanding, LearnerName(), MEDAL, Row() (+4 more)

### Community 38 - "vitest"
Cohesion: 0.03
Nodes (62): 2. Repository discovery (recorded before changes), nextConfig, active, archived, mocks, activityHref(), closesIn(), Dashboard (+54 more)

### Community 39 - "insights.py"
Cohesion: 0.07
Nodes (38): get_codex(), get_mastery_map(), ActivityAttempt, ChallengeRecovery, codex_summary(), CodexCategory, CodexRecovery, CodexResponse (+30 more)

### Community 40 - "numpy"
Cohesion: 0.19
Nodes (9): _bootstrap_intervals(), _build_pipeline(), _evaluate_partition(), _finite_or_none(), _fit_tuned_model(), _point_metrics(), _probability_for_success(), split_students_disjoint() (+1 more)

### Community 41 - "ml_predictor/feature_engineering.py"
Cohesion: 0.22
Nodes (7): _as_bool(), _before(), _enum_value(), extract_features_from_dataframe(), _frame(), _mean(), _rate()

### Community 42 - "4. Findings and implementation blueprint"
Cohesion: 0.08
Nodes (24): 1. Where ByteQuest stands, 2. How the system fits together, 3. Work order, 4. Findings and implementation blueprint, 5. Local completion checklist, 6. Which existing document answers which question, BQ-01 — Award completion XP at the first eligible event, BQ-02 — Give submission jobs one owner per claim (+16 more)

### Community 43 - "qa_mixed_exam_load.py"
Cohesion: 0.09
Nodes (32): require_local(), api_base(), cleanup(), create_accounts(), instructor_builds_course(), letters(), main(), password_token() (+24 more)

### Community 44 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 45 - "Classroom pilot fixes and verification — 2026-10-28"
Cohesion: 0.50
Nodes (3): Changes checked locally, Classroom pilot fixes and verification — 2026-10-28, Evidence

### Community 46 - "workshop-activities.tsx"
Cohesion: 0.15
Nodes (14): ActivityDialog, ActivityEditor(), save(), ActivityLink, ActivityOption, ActivityPicker(), mocks, quests (+6 more)

### Community 47 - "Faculty and administrator workspace — implementation log and continued work"
Cohesion: 0.11
Nodes (18): test_configuration_version_conflict_and_validation(), 10. Files created or modified (this work), 11. Quick current-state checklist, 1. Status at handoff, 6. Tests added, 7. Verification evidence (live app), 8. How to continue (commands, accounts, cleanup), 9. Remaining work (+10 more)

### Community 48 - "package.json"
Cohesion: 0.11
Nodes (17): engines, node, name, overrides, dompurify, private, version, eslint (+9 more)

### Community 49 - "Phase 1 — ByteQuest instructor redesign plan"
Cohesion: 0.07
Nodes (29): Activity editor, Analytics, Analytics desktop, Analytics phone, API and data performance, Assumptions, Chart library and motion, Course data model and grade integrity (+21 more)

### Community 50 - "get"
Cohesion: 0.09
Nodes (34): admin_user(), course_health(), _accuracy(), _course_activities(), dashboard(), evaluation(), _faculty(), forecast_readiness() (+26 more)

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
Cohesion: 0.09
Nodes (14): get_settings(), ErrorExplanationSchema, explain_code_error(), _client_for_key(), get_gemini_client(), _chat_failure(), GeminiLLMService, _retry_after() (+6 more)

### Community 60 - "evaluation.tsx"
Cohesion: 0.09
Nodes (29): Activity health in the Activities list, ByteQuest Insights, part 3 of 4: instructors, Exam class summary, Goal, Handheld rules, Inactive 7+ days, Model evaluation, Out of scope (+21 more)

### Community 61 - "exams.py"
Cohesion: 0.11
Nodes (46): assigned(), assigned_exam_numbers(), _assigned_exams_with_state(), create_exam(), DraftExam, DraftItem, _exam_access(), exam_sample_run() (+38 more)

### Community 62 - "profile/page.tsx"
Cohesion: 0.06
Nodes (51): AccountPanel(), AdminSections(), ConsentStatus, habitsMessage(), InstructorSections(), PersonalTimeline(), ProfilePage(), ProfilePageContent() (+43 more)

### Community 63 - "useChatController"
Cohesion: 0.12
Nodes (25): RFC-4122, ByteQuest 2.0: close the manuscript gaps, tidy the structure, then review and rate the system, Do not, Final report, Hard rules, Part 3: Code structure (targeted; behaviour must stay identical), Part 4: Review and targeted fixes, Stack and layout (+17 more)

### Community 64 - "ByteQuest machine-learning improvement plan"
Cohesion: 0.14
Nodes (14): 1. Goal, 2. Where things stand, 3. Decisions, 4.1 Prediction unit and label, 4.2 History, 4.3 The ten features, in this order, 4.4 Live shadow scoring, 4.5 Reporting (+6 more)

### Community 65 - "rag_instructor.py"
Cohesion: 0.15
Nodes (17): _gemini_unavailable_http_exception(), generate_ai_coding_challenge(), generate_ai_conceptual_quiz(), _generation_payload(), _get_owned_activity(), _get_owned_document(), _may_manage_activity(), _may_manage_document() (+9 more)

### Community 66 - "train_compare.py"
Cohesion: 0.11
Nodes (9): _atomic_joblib_dump(), _atomic_json_write(), _atomic_write(), _format_metric(), generate_synthetic_thesis_dataset(), main(), run_training_and_comparison(), _select_winner() (+1 more)

### Community 67 - "ByteQuest 2.0 Classroom Pilot Operator Runbook"
Cohesion: 0.17
Nodes (12): 1. Hard Safety Gates (Enforced by Configuration), 2. Lab Station & Shared-Computer Protocol, 3. Network Resilience & Live Draft Sync, 4. Timed Exam Operations, 5. Verification Commands, 6. Incident Troubleshooting, ByteQuest 2.0 Classroom Pilot Operator Runbook, Classroom Wi-Fi Reconnect Banner (+4 more)

### Community 68 - "_TooLarge"
Cohesion: 0.27
Nodes (7): limited_receive(), tracked_send(), _TooLarge, test_streamed_body_without_content_length_is_limited(), read_body(), receive(), send()

### Community 69 - "AuditEvent"
Cohesion: 0.13
Nodes (17): AuditEvent, _set_school_ids(), test_archive_is_blocked_while_an_exam_using_the_course_is_open_or_scheduled(), test_archiving_a_course_closes_its_activities_keeps_history_and_restores(), visible(), test_bulk_enrollment_previews_each_group_then_enrolls_each_student_once(), test_course_announcements_crud_is_scoped_and_audited(), test_course_edit_changes_title_and_description_with_an_audit_entry() (+9 more)

### Community 70 - "ByteQuest local end-to-end flow"
Cohesion: 0.11
Nodes (18): 8 Required Acceptance Checks, Account-synced progression check, Before deployment, ByteQuest local end-to-end flow, Durability Boundary & Concurrency Guarantees, Exam Autosave & Conflict-Safe Recovery Verification, Instructor account, Local Quest Map demos (+10 more)

### Community 71 - "accessibility-provider.tsx"
Cohesion: 0.08
Nodes (29): Repo map: exact files to inspect and change, byteBounce, metadata, RootLayout(), viewport, ACCESSIBILITY_STORAGE_KEYS, AccessibilityContext, AccessibilityContextValue (+21 more)

### Community 72 - "ByteQuest 2.0"
Cohesion: 0.22
Nodes (9): Architecture, ByteQuest 2.0, Configuration and security, Documentation, Repository layout, Stack and deployment, Start locally on Windows, Test and verify (+1 more)

### Community 73 - "ProgrammingLang"
Cohesion: 0.09
Nodes (19): _b64_decode(), _b64_encode(), BatchEvaluationSummary, classify_judge0_status(), Judge0Client, Judge0UnavailableError, _parse_completed_result(), metric() (+11 more)

### Community 74 - "ByteQuest 2.0 — Full system review"
Cohesion: 0.07
Nodes (23): ByteQuest 2.0 engineering and UX review, Findings, Performance evidence, Recommended sequence, Verification and limits, Already strong (checked, not assumed), ByteQuest 2.0 — Full system review, Evidence (+15 more)

### Community 75 - "Phase 0 — ByteQuest instructor audit"
Cohesion: 0.22
Nodes (8): Current FastAPI inventory, Current screens and feature coverage, Decisions for Phase 1, Desktop scorecard, Findings, Phase 0 — ByteQuest instructor audit, Supabase data and authorization, Verification

### Community 76 - "StorageError"
Cohesion: 0.14
Nodes (6): StorageError, SupabaseAvatarStorage, SupabasePDFStorage, test_accepts_absolute_signed_url_from_configured_origin(), test_rejects_untrusted_signed_url(), test_resolves_supabase_relative_signed_path()

### Community 77 - "ActivityKind"
Cohesion: 0.10
Nodes (21): get_progress_recap(), compare_submission(), ComparedAttempt, get_job(), _retry_failed_job(), retry_job(), SubmissionComparison, submit_job() (+13 more)

### Community 78 - "ByteQuest 2.0 database review — 12 November 2026"
Cohesion: 0.14
Nodes (12): test_every_public_timestamp_column_is_aware(), A. Inventory, B. Findings, ByteQuest 2.0 database review — 12 November 2026, C. Migration plan, D. Index recommendations, End-to-end traces, F. Verification (+4 more)

### Community 79 - "Session"
Cohesion: 0.08
Nodes (70): account_emails_for_email(), account_impact(), _account_needs_action(), activity_impact(), _admin_activity(), admin_archive_activity(), admin_archive_material(), admin_dashboard() (+62 more)

### Community 81 - "account_provisioning.py"
Cohesion: 0.29
Nodes (8): AccountCreate, create_account(), _admin_headers(), build_profile(), delete_auth_user(), DuplicateAccount, invite_auth_user(), ProvisioningUnavailable

### Community 82 - "entities.py"
Cohesion: 0.13
Nodes (8): get_current_user(), course_exam_ids(), released_exam_history(), _utc(), has_required_prediction_history(), prior_graded_task_count(), record_shadow_prediction(), _rollback_quietly()

### Community 83 - "ByteQuest 2.0: Master Architecture Plan & Execution Roadmap"
Cohesion: 0.09
Nodes (23): 1. Project Tracking & Thesis Collaboration Strategy, 2. Core Architectural Rules (Non-Negotiable), 3. Repository Directory Structure, 4. Course-Sequence & Curriculum Alignment, 5. Database Schema Blueprint (Supabase PostgreSQL + pgvector), 6. 7-Phase Development Plan, 7. Thesis Objectives Mapping (Chapter 1 Alignment), 8. Development Environment & Quickstart Commands (+15 more)

### Community 84 - "Phase 7 deployment readiness"
Cohesion: 0.18
Nodes (11): Decisions required before production setup, Deployment order after the decisions are made, Evidence still needed, Local Judge0 runtime smoke check (2026-10-26), Notes on local verification, Phase 7 deployment readiness, Prepared in the repository, Production settings and network boundaries (+3 more)

### Community 85 - "quests/page.tsx"
Cohesion: 0.14
Nodes (19): ExamCard, ExamsPage(), localTime(), QuestsPage(), QuestsPageContent(), changeView(), handleKeyDown(), QuestStatusFilter (+11 more)

### Community 86 - "submissions/[id]/page.tsx"
Cohesion: 0.13
Nodes (16): Job, nextStarTip(), SubmissionStatusPage(), refresh(), retryGrading(), currentAttempt, mocks, oldSubmission (+8 more)

### Community 87 - "pdf_processor.py"
Cohesion: 0.18
Nodes (4): extract_chunks_from_pdf(), extract_pdf_chunks(), reader(), test_pdf_page_and_character_limits()

### Community 88 - "asyncio"
Cohesion: 0.29
Nodes (7): lock_activity_for_publication(), record_challenge_verification(), challenge_specs(), foundation_id(), main(), publish_verified(), save_drafts()

### Community 89 - "test_pilot_drafts_jobs_hints_and_consent_gate"
Cohesion: 0.18
Nodes (9): claim(), recover_stale_submission_jobs(), test_pilot_drafts_jobs_hints_and_consent_gate(), test_expired_submission_cannot_replace_a_new_claim_result(), judge(), replace_claim(), test_review_queue_requires_judge0_verification_for_saved_content(), test_verification_rejects_stale_content() (+1 more)

### Community 90 - "workspace.ts"
Cohesion: 0.04
Nodes (82): 4.5 Administrator API (`backend/app/api/admin.py`, prefix `/api/v1/admin`), copyActivity(), remove(), EMPTY_UPLOAD, LANGUAGE_OPTIONS, STATUS_OPTIONS, UploadState, apiRequest() (+74 more)

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
Cohesion: 0.15
Nodes (21): WorkspaceLayout(), AppShell(), AuthenticatedLayout(), isActiveDestination(), ProfileContext, useScrollResetOnRouteChange(), InstructorIconName, LegacyQuestRedirect() (+13 more)

### Community 96 - "quiz-view.tsx"
Cohesion: 0.16
Nodes (8): QuizPage(), getActivityHref(), QuizResult, QuizView(), handleSubmitQuiz(), load(), { api }, QuizQuestion

### Community 97 - "ML pipeline synthetic verification — 2026-10-25"
Cohesion: 0.29
Nodes (6): Artifact and activation checks, Execution, ML pipeline synthetic verification — 2026-10-25, Observed grouped metrics, Remaining Phase 5 work, Scope

### Community 98 - "enroll-students.tsx"
Cohesion: 0.22
Nodes (12): describe(), EnrollStudents(), enroll(), runPreview(), GROUPS, courses, plan, setup() (+4 more)

### Community 99 - "preflight-host.sh"
Cohesion: 0.38
Nodes (6): fail(), MIN_MEMORY_BYTES, MIN_ROOT_FREE_BYTES, MIN_SWAP_BYTES, pass(), preflight-host.sh script

### Community 100 - "Phase 6 shadow rollout implementation record"
Cohesion: 0.40
Nodes (5): Implemented, Phase 6 shadow rollout implementation record, Phase 7 handoff, Safety and current state, Verification still required

### Community 101 - "httpx"
Cohesion: 0.15
Nodes (11): _evaluate(), _failed_sample(), main(), _request(), TutorCase, main(), student(), evaluate() (+3 more)

### Community 102 - "ML feature engineering and training"
Cohesion: 0.40
Nodes (5): Comparison protocol, Export an attempt dataset, ML feature engineering and training, Prepare an Ubuntu VPS, Safe pipeline setup

### Community 103 - "monitoring.py"
Cohesion: 0.16
Nodes (19): monitoring(), _check_judge0(), _grading_worker_health(), job_query(), _minutes(), overall_health(), _prediction_health(), _rag_health() (+11 more)

### Community 104 - "ByteQuest Gemini tutor pilot evaluation"
Cohesion: 0.50
Nodes (4): ByteQuest Gemini tutor pilot evaluation, Reply quality, Token use and estimated Gemini cost, What was tested

### Community 105 - "arena.tsx"
Cohesion: 0.09
Nodes (35): ArenaPage(), Arena(), checkStatus(), confirmResetCode(), endSegment(), handleCodeChange(), handleCopyOutput(), load() (+27 more)

### Community 106 - "ByteQuest navigation"
Cohesion: 0.40
Nodes (5): ByteQuest navigation, Compatibility and new destinations, Existing routes, Local verification, Workshops (11/21/26)

### Community 107 - "ByteQuest UI/UX harmonization: slices 1–3 and ML slice planning"
Cohesion: 0.15
Nodes (12): Bugs found and fixed, ByteQuest UI/UX harmonization: slices 1–3 and ML slice planning, Checkpoint, Decisions made today, How it was checked, Next steps, Not checked, Slice 1: shared foundation and help (+4 more)

### Community 108 - "ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash"
Cohesion: 0.15
Nodes (10): GeneratedChallengeSchema, GeneratedQuizOptionSchema, GeneratedQuizQuestionSchema, GeneratedQuizSchema, TestCaseSchema, 2. Exact code touchpoints, A. Add more code challenges, B. Expand Lessons Review (+2 more)

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
Cohesion: 0.15
Nodes (17): Badge, StudentBadge, evaluate_and_award_badges(), _qualifies(), _requirement_for(), test_badge_awards_are_idempotent_and_grant_their_bonus_once(), test_codex_ignores_exam_tries_and_awards_bug_hunter_once_at_five(), test_exam_pass_counts_toward_badges_only_after_release() (+9 more)

### Community 124 - "getErrorMessage"
Cohesion: 0.05
Nodes (57): Phase 3: Document-Grounded RAG & Gemini Content Generation (Days 12–18), ConsentStatus, ResearchConsentSettingsPage(), confirmReactivate(), submitCreate(), confirmArchive(), doConfirm(), doRemove() (+49 more)

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

### Community 139 - "ByteQuest — Security & AI-Abuse Hardening (implementation brief)"
Cohesion: 0.06
Nodes (28): get_current_user_payload(), TokenPayload, auth(), verify(), claims(), test_es256_verifies_locally_off_the_event_loop(), ByteQuest — Security & AI-Abuse Hardening (implementation brief), Final report (keep it short) (+20 more)

### Community 140 - "FastAPI"
Cohesion: 0.12
Nodes (13): AnnouncementCreate, AnnouncementExpiry, AnnouncementPatch, _audit_change(), _authorize_announcement(), create_announcement(), delete_announcement(), list_announcements() (+5 more)

### Community 141 - "settings_service.py"
Cohesion: 0.24
Nodes (6): _coerce(), get_settings_int(), _range_error(), serialize_setting(), _typed_value(), update_setting()

### Community 142 - "Local API security contract"
Cohesion: 0.40
Nodes (5): Access matrix, Local API security contract, Local verification and future deployment, Quotas and validation, School-issued IDs for student sign-up

### Community 143 - "prepare_ml_dataset"
Cohesion: 0.17
Nodes (9): _as_binary_label(), _check_columns(), _encodes_account_id(), _fit_baselines(), _require_pseudonymous(), _sort_attempts(), _strip_text(), _validate_hint_frame() (+1 more)

### Community 146 - "MLPrediction"
Cohesion: 0.22
Nodes (9): MLPrediction, record_prediction_outcome(), _consent(), test_forecast_history_and_quality_never_cross_course_boundaries(), test_ml_evaluation_excludes_learners_without_current_consent(), test_ml_evaluation_keeps_model_versions_apart_and_scores_both_models(), test_ml_reads_never_record_a_prediction(), test_prediction_outcome_links_only_earlier_snapshots() (+1 more)

### Community 148 - "test_learning_flow_integration.py"
Cohesion: 0.09
Nodes (27): claim_exam(), _grade_queued_exam(), _letters(), _ranked_student(), _set_due_at(), _started_quiz_exam(), test_admin_can_unlock_both_mechanics_immediately_with_validated_settings(), test_exam_answer_after_the_cutoff_is_rejected_as_expired() (+19 more)

### Community 149 - "GeminiConfigurationError"
Cohesion: 0.22
Nodes (6): GeminiConfigurationError, test_ai_failures_leave_drafts_and_hint_allowance_intact(), get_client(), search_embedding(), test_concurrent_saved_sends_reach_gemini_once(), provider()

### Community 150 - "review-runner.tsx"
Cohesion: 0.27
Nodes (8): ReviewPage(), ReviewRunner(), submit(), mocks, result, review, RecallReview, ReviewResult

### Community 151 - "performance/page.tsx"
Cohesion: 0.06
Nodes (59): Student Progress: the only roster and learner drawer, CourseRef, Curve, Dashboard, Detail, Evaluation, Forecast, FORECAST_REASONS (+51 more)

### Community 152 - "workshop-progress.tsx"
Cohesion: 0.31
Nodes (7): labels, LearnerProgress, Progress, ProgressStatus(), Status, StudentName(), WorkshopProgress()

### Community 153 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, monaco-editor, @monaco-editor/react, next, react, react-dom, react-is, recharts (+1 more)

### Community 154 - "flow"
Cohesion: 0.25
Nodes (3): flow(), cleanup(), override_db()

### Community 156 - "starter_username"
Cohesion: 0.12
Nodes (10): public_handle(), _starter_username(), _encoded_id(), is_starter_username(), starter_username(), destroy(), main(), _export_queries() (+2 more)

### Community 157 - "retrieval.py"
Cohesion: 0.10
Nodes (15): embed_chunks_bounded(), embed_one(), GeminiEmbeddingService, generate_embedding(), activity_document_ids(), _chat_excerpt(), cited_sources(), course_document_ids() (+7 more)

### Community 158 - "1. Current architecture"
Cohesion: 0.29
Nodes (6): 1. Current architecture, 3. Recommended implementation order, 4. Ready-to-paste prompt for DeepSeek V4.1 Flash, 5. Manual acceptance checklist, ByteQuest 2.0: implementation guide and DeepSeek V4.1 Flash prompt, Existing API contracts

### Community 159 - "test_monitoring_distinguishes_worker_and_sandbox_outages"
Cohesion: 0.40
Nodes (5): GradingWorkerHeartbeat, record_grading_worker_heartbeat(), test_local_rls_hides_unassigned_course_and_roster(), test_monitoring_distinguishes_worker_and_sandbox_outages(), sandbox_unavailable()

### Community 162 - "app-tooltips.tsx"
Cohesion: 0.50
Nodes (4): hasVisibleText(), tooltipFor(), TooltipState, react-dom

### Community 164 - "Phase 7 backend image build verification"
Cohesion: 0.40
Nodes (4): Limits, Phase 7 backend image build verification, Recorded evidence, Work completed

### Community 166 - "ByteQuest Insights, part 1 of 4: shared foundation"
Cohesion: 0.20
Nodes (9): ByteQuest Insights, part 1 of 4: shared foundation, Charts: two primitives, Goal, Handheld rules, Metric labels, Out of scope, Profile: one role tab, each figure once, Remove the duplicate Sequencer evaluation (+1 more)

### Community 167 - "instructor/page.tsx"
Cohesion: 0.05
Nodes (89): Course health on System Overview, Already in place: extend, do not rebuild, Shared insight widgets, Verification and rollout, Already in place: extend, do not rebuild, One kit: course-ui, Already in place: extend, do not rebuild, Implementation status (21 November 2026, same day) (+81 more)

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
Cohesion: 0.09
Nodes (41): get_review(), get_reviews(), _locked_student(), _public_review(), _question_id(), _require_memory(), ReviewOverviewResponse, ReviewResponse (+33 more)

### Community 176 - "Phase 7 synthetic deployment preflight — 2026-10-26"
Cohesion: 0.33
Nodes (5): Evidence, Limits, Phase 7 synthetic deployment preflight — 2026-10-26, Result, Scope and method

### Community 179 - "Production instructor access"
Cohesion: 0.67
Nodes (3): Grant access to one account, Production instructor access, Safety boundaries

## Knowledge Gaps
- **18 isolated node(s):** `monaco-editor`, `react-is`, `@types/node`, `@types/react`, `@types/react-dom` (+13 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1400 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `4. Read these before writing any code` connect `_token` to `ui.tsx`, `Session`, `LearningActivity`, `insights.py`, `submit_conceptual_quiz`, `ProgrammingLang`, `FastAPI`, `attempt_visibility.py`, `entities.py`, `test_learning_flow_integration.py`, `profiles.py`, `pilot.py`, `flow`, `4. Read these before writing any code`, `profile/page.tsx`?**
  _High betweenness centrality (0.183) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `Session` (e.g. with `smoke_demo_quest()` and `test_two_concurrent_saves_cannot_commit_the_same_activity_version()`) actually correct?**
  _`Session` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `monaco-editor`, `react-is`, `@types/node` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ui.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07879014189693802 - nodes in this community are weakly interconnected._
- **Why does `LearningActivity` connect `LearningActivity` to `Session`, `_token`, `workshops.py`, `test_faculty_admin.py`, `drafts.py`, `drafts.py`, `_enroll_chat_students`, `attempt_visibility.py`, `course_access.py`, `entities.py`, `test_ml_exam_features.py`, `predictor.py`, `profiles.py`, `MLPrediction`, `test_learning_flow_integration.py`, `pilot.py`, `GeminiConfigurationError`, `entities.py`, `submit_conceptual_quiz`, `retrieval.py`, `1. Current architecture`, `chat.py`, `insights.py`, `qa_mixed_exam_load.py`, `reviews.py`, `get`, `exams.py`, `rag_instructor.py`, `AuditEvent`, `ActivityKind`, `Session`, `entities.py`, `asyncio`, `test_pilot_drafts_jobs_hints_and_consent_gate`, `httpx`, `monitoring.py`, `4. Read these before writing any code`?**
  _High betweenness centrality (0.128) - this node is a cross-community bridge._
- **Are the 290 inferred relationships involving `Profile` (e.g. with `account_impact()` and `_account_needs_action()`) actually correct?**
  _`Profile` has 290 INFERRED edges - model-reasoned connections that need verification._
- **Should `Session` be split into smaller, more focused modules?**
  _Cohesion score 0.11479591836734694 - nodes in this community are weakly interconnected._