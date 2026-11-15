# Graph Report - ByteQuest_2.0  (2026-11-15)

## Corpus Check
- 326 files · ~366,033 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 36 file(s) not represented in the graph (top: (none) 19, .bat 5, .example 5)

## Summary
- 3051 nodes · 10002 edges · 148 communities (135 shown, 13 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 1335 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bd89275d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ui.tsx
- api.ts
- train_compare.py
- LearningActivity
- Profile
- reviews.py
- rag_instructor.py
- test_faculty_admin.py
- instructor/materials/page.tsx
- start-bytequest.ps1
- getErrorMessage
- test_schema_integrity.py
- supabase.ts
- InstructionalDocument
- workspace_queries.py
- publish_learning_activity
- app-shell.tsx
- configuration/page.tsx
- load_test_local_synthetic.py
- profile/page.tsx
- predictor.py
- profiles.py
- test_streamed_body_without_content_length_is_limited
- CourseMember
- numpy
- quiz-view.tsx
- ml_predictor/feature_engineering.py
- iso
- insights.tsx
- starter_username
- pilot.py
- chat-provider.tsx
- profile_attention.py
- onboarding/page.tsx
- quests/page.tsx
- review/[id]/page.tsx
- ByteQuest 2.0 database review — 12 November 2026
- next
- test_profile_analytics.py
- create_chat_message
- quest_groups.py
- test_api_security.py
- BaseModel
- quests_gamification.py
- compilerOptions
- _snapshot
- accessibility-provider.tsx
- Faculty and administrator workspace — implementation log and continued work
- package.json
- accounts/page.tsx
- submissions.py
- AppTooltips
- StorageError
- Judge0Client
- Phase 7 database and file backup/restore runbook
- admin/materials/page.tsx
- vps_bootstrap.sh
- Judge0 Hyper-V Ubuntu boot incident and recovery
- LegalDocument
- review/[id]/page.tsx
- test_auth_jwks.py
- exams.py
- app/layout.tsx
- leaderboard.tsx
- test_learning_flow_integration.py
- ByteQuest 2.0 engineering and UX review
- ByteQuest — Security & AI-Abuse Hardening (implementation brief)
- ByteQuest 2.0 Classroom Pilot Operator Runbook
- insights.py
- settings_service.py
- ByteQuest local end-to-end flow
- home-redirect.tsx
- ByteQuest 2.0
- Judge0CircuitOpenError
- get_current_user_payload
- accessibility-settings.tsx
- Prompt for ChatGPT: ByteQuest gamification, Phases 2 and 3
- GeminiConfigurationError
- ByteQuest 2.0 — Full system review
- 4. Read these before writing any code
- LOCAL_E2E.md
- ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash
- submissions/[id]/page.tsx
- ByteQuest 2.0: Master Architecture Plan & Execution Roadmap
- Phase 7 deployment readiness
- Corrected Lesson to Student Progress Verification
- reserve
- prepare-monaco.mjs
- Judge0UnavailableError
- gamification-insights.tsx
- Judge0 Hyper-V Ubuntu VM: troubleshooting handoff
- Milestones 1A–1C Status and Verification Log
- Desktop and Mobile Pilot Flows (`pilot-v2.html`)
- test_pilot_drafts_jobs_hints_and_consent_gate
- codex.py
- test_ml_exam_features.py
- test_sandbox_internal_error_is_unavailability_not_a_student_failure
- ML pipeline synthetic verification — 2026-10-25
- components/student-preview.tsx
- preflight-host.sh
- ProfileResponse
- Classroom pilot fixes and verification — 2026-10-28
- Phase 7 synthetic deployment preflight — 2026-10-26
- runner_status
- get_ml_analytics_summary
- SupabaseAvatarStorage
- ByteQuest navigation
- 6. 7-Phase Development Plan
- run_training_and_comparison
- zerotier-relay.mjs
- Python demo journey — 2026-10-28
- Phase 7 dependency security review (2026-10-26)
- PHASE7_DEPLOYMENT_READINESS.md
- LearningActivity
- Local API security verification — 2026-10-28
- Phase 7 database pool budget hardening
- entities.py
- account_provisioning.py
- test_chat_rejects_nonvisible_student_activity
- smoke-vps.sh
- _validate_form_keys
- preflight-vps.sh
- _admin_analytics
- upload_my_avatar
- CLAUDE.md
- AGENTS.md
- ByteQuest manuscript and system alignment checklist
- test_memory_rules.py
- TestCaseInput
- Phase 7 readiness hardening
- arena.tsx
- record_prediction_outcome
- flow
- ByteQuest 2.0 — Review remediation plan
- Phase 6 shadow rollout implementation record
- complete_student_onboarding
- test_configuration_version_conflict_and_validation
- ByteQuest backend runtime review
- Phase 7 backend image build verification
- Phase 7 local production-mode runtime verification
- Phase 7 frontend build evidence
- Phase 7 Vercel setup verification — 2026-10-26

## God Nodes (most connected - your core abstractions)
1. `Profile` - 284 edges
2. `LearningActivity` - 167 edges
3. `getErrorMessage()` - 141 edges
4. `apiRequest()` - 115 edges
5. `ReviewState` - 93 edges
6. `ActivityAttempt` - 92 edges
7. `ProgrammingLang` - 80 edges
8. `UserRole` - 72 edges
9. `ActivityKind` - 69 edges
10. `react` - 64 edges

## Surprising Connections (you probably didn't know these)
- `4.1 Migration` --references--> `audit_events()`  [INFERRED]
  docs/verification/faculty-admin-workspace-2026-10-29.md → backend/app/api/admin.py
- `P1 — functional gaps / decisions` --references--> `performance()`  [INFERRED]
  docs/verification/faculty-admin-workspace-2026-10-29.md → backend/app/api/faculty.py
- `Suggested API contract` --references--> `_serialize_challenge()`  [INFERRED]
  docs/CHATBOT_IMPLEMENTATION_PLAN_FOR_DEEPSEEK.md → backend/app/api/rag_instructor.py
- `End-to-end traces` --references--> `get_db()`  [INFERRED]
  docs/DATABASE_REVIEW_2026-11-12.md → backend/app/core/database.py
- `8. Phase 3A — Mastery Memory (quests + points, spaced retrieval)` --references--> `evaluate_and_award_badges()`  [INFERRED]
  docs/prompts/chatgpt-gamification-phases-2-3.md → backend/app/services/gamification/badges.py

## Import Cycles
- None detected.

## Communities (148 total, 13 thin omitted)

### Community 0 - "ui.tsx"
Cohesion: 0.06
Nodes (76): AdminAssignments(), doConfirm(), doRemove(), submitAssign(), Page(), AdminCoursesPage(), blank, Courses() (+68 more)

### Community 1 - "api.ts"
Cohesion: 0.06
Nodes (39): nextConfig, mocks, CourseInsights(), Insights(), Page(), mocks, mocks, report (+31 more)

### Community 2 - "train_compare.py"
Cohesion: 0.10
Nodes (3): _format_metric(), generate_synthetic_thesis_dataset(), main()

### Community 3 - "LearningActivity"
Cohesion: 0.12
Nodes (44): _activity_response(), ActivityCreate, ActivityUpdate, _apply_quiz_payload(), _apply_test_cases(), approve_draft(), ApproveRequest, archive_material() (+36 more)

### Community 4 - "Profile"
Cohesion: 0.10
Nodes (49): account_emails_for_email(), account_impact(), _account_needs_action(), AccountCreate, activity_impact(), admin_activities(), _admin_activity(), _admin_activity_item() (+41 more)

### Community 5 - "reviews.py"
Cohesion: 0.08
Nodes (42): get_review(), get_reviews(), _locked_student(), _public_review(), _question_id(), _require_memory(), ReviewOverviewResponse, ReviewResponse (+34 more)

### Community 6 - "rag_instructor.py"
Cohesion: 0.12
Nodes (22): archive_document(), create_document_version(), _gemini_unavailable_http_exception(), generate_ai_coding_challenge(), generate_ai_conceptual_quiz(), _generation_payload(), get_document_download_url(), get_instructor_workspace() (+14 more)

### Community 7 - "test_faculty_admin.py"
Cohesion: 0.13
Nodes (25): _consent(), test_account_creation_provisions_a_profile_and_course_access(), test_activity_editor_preview_hides_answer_keys_and_hidden_tests(), test_admin_creates_course_and_duplicate_code_is_rejected(), test_administrator_cannot_use_academic_faculty_routes(), test_deactivation_blocks_the_account_and_self_deactivation_is_refused(), test_draft_save_never_publishes_and_approval_publishes(), test_duplicate_email_and_assignment_conflicts_are_inline() (+17 more)

### Community 8 - "instructor/materials/page.tsx"
Cohesion: 0.14
Nodes (19): EMPTY_UPLOAD, FacultyMaterials(), confirmArchive(), doDownload(), doRestore(), doRetry(), submitEdit(), submitUpload() (+11 more)

### Community 9 - "start-bytequest.ps1"
Cohesion: 0.08
Nodes (36): ConvertTo-EncodedPowerShellCommand(), ConvertTo-PowerShellLiteral(), Get-FrontendFingerprint(), Get-Judge0VmIPv4(), Get-Judge0VmIPv4FromNeighbor(), Get-ListenerPidMap(), Get-PageScriptPaths(), Get-PortListenerPids() (+28 more)

### Community 10 - "getErrorMessage"
Cohesion: 0.05
Nodes (57): B. Expand Lessons Review, ConsentStatus, ResearchConsentSettingsPage(), Catalog, Exam, ExamDetail, InstructorExamsPage(), act() (+49 more)

### Community 11 - "test_schema_integrity.py"
Cohesion: 0.18
Nodes (11): _make_profile(), test_badge_code_is_required(), test_concurrent_username_claims_allow_only_one_winner(), test_core_timestamps_are_aware_and_comparable(), test_database_rejects_invalid_public_usernames(), test_every_public_timestamp_column_is_aware(), test_processing_status_accepts_documented_states(), test_processing_status_rejects_unknown_state() (+3 more)

### Community 12 - "supabase.ts"
Cohesion: 0.08
Nodes (39): 8 Required Acceptance Checks, Durability Boundary & Concurrency Guarantees, Exam Autosave & Conflict-Safe Recovery Verification, Interrupted Exam Autosave & Browser Recovery (Checklist Item #3), cleared, localMap, mockLocalStorage, mockSessionStorage (+31 more)

### Community 13 - "InstructionalDocument"
Cohesion: 0.24
Nodes (13): retry_job(), InstructionalDocument, ProcessingJob, _index_stored_pdf(), material_version_rows(), retry_material(), serialize_job(), _store_chunks() (+5 more)

### Community 14 - "workspace_queries.py"
Cohesion: 0.17
Nodes (27): _course_brief(), _draft_item(), faculty_dashboard(), list_activity_workspace(), list_courses(), list_drafts(), list_materials(), _material_rows() (+19 more)

### Community 15 - "publish_learning_activity"
Cohesion: 0.16
Nodes (15): _challenge_validation_fingerprint(), DraftChallengeUpdate, get_instructor_challenge(), _get_owned_activity(), _may_manage_activity(), publish_learning_activity(), reverify_instructor_draft(), _serialize_challenge() (+7 more)

### Community 16 - "app-shell.tsx"
Cohesion: 0.13
Nodes (27): WorkspaceLayout(), AccountMenu(), AppShell(), AuthenticatedLayout(), isActiveDestination(), ProfileContext, useScrollResetOnRouteChange(), LegacyQuestRedirect() (+19 more)

### Community 17 - "configuration/page.tsx"
Cohesion: 0.25
Nodes (9): Configuration(), openReview(), save(), validate(), Conflict, Page(), SettingRecord, SettingsResponse (+1 more)

### Community 18 - "load_test_local_synthetic.py"
Cohesion: 0.18
Nodes (9): cleanup(), main(), one_student(), require_local(), run_load(), main(), student(), join_new_workshop() (+1 more)

### Community 19 - "profile/page.tsx"
Cohesion: 0.04
Nodes (89): AdminOverview(), AdminSections(), AttentionSummary(), BarList(), ConsentStatus, habitsMessage(), InstructorOverview(), InstructorSections() (+81 more)

### Community 20 - "predictor.py"
Cohesion: 0.11
Nodes (15): lifespan(), load_ml_models(), ModelArtifactError, ModelArtifactsUnavailable, ModelBundle, _partition_report(), _positive_probability(), predict_student_success() (+7 more)

### Community 21 - "profiles.py"
Cohesion: 0.19
Nodes (18): ActivityDay, AdminAnalytics, AdminAttention, AnalyticsResponse, BadgeEntry, _enum_value(), ExamHistoryEntry, HelpPattern (+10 more)

### Community 22 - "test_streamed_body_without_content_length_is_limited"
Cohesion: 0.20
Nodes (9): RequestSizeLimitMiddleware, limited_receive(), reject(), tracked_send(), _TooLarge, test_streamed_body_without_content_length_is_limited(), read_body(), receive() (+1 more)

### Community 23 - "CourseMember"
Cohesion: 0.14
Nodes (19): admin_user(), list_course_operations(), faculty_user(), active_membership_course_ids(), courses_for_user(), default_instructor_course_id(), ensure_owned_or_admin(), has_course_role() (+11 more)

### Community 24 - "numpy"
Cohesion: 0.16
Nodes (12): _as_binary_label(), _build_pipeline(), _evaluate_partition(), _finite_or_none(), _fit_baselines(), _fit_tuned_model(), prepare_ml_dataset(), _probability_for_success() (+4 more)

### Community 25 - "quiz-view.tsx"
Cohesion: 0.18
Nodes (7): QuizPage(), getActivityHref(), QuizResult, QuizView(), handleSubmitQuiz(), load(), QuizQuestion

### Community 26 - "ml_predictor/feature_engineering.py"
Cohesion: 0.22
Nodes (11): _as_bool(), _as_float(), _attempts_per_success(), _enum_value(), extract_features_from_dataframe(), extract_student_features(), feature_dict_to_vector(), _mean_nonnegative() (+3 more)

### Community 27 - "iso"
Cohesion: 0.16
Nodes (16): _activity_brief(), _material_brief(), preview_activity(), activity_detail(), activity_state(), activity_states(), as_aware(), attempt_counts() (+8 more)

### Community 28 - "insights.tsx"
Cohesion: 0.07
Nodes (52): ComparisonTable(), ConfusionMatrix(), CURVE_COLORS, CURVE_DASH, CurveChart(), Methodology(), metric(), METRIC_COLUMNS (+44 more)

### Community 29 - "starter_username"
Cohesion: 0.16
Nodes (7): public_handle(), _starter_username(), _encoded_id(), is_starter_username(), starter_username(), _export_queries(), test_documented_exports_require_latest_current_consent()

### Community 30 - "pilot.py"
Cohesion: 0.18
Nodes (25): challenge(), choose_consent(), close_challenge(), consent_status(), ConsentChoice, dashboard(), DraftPayload, get_draft() (+17 more)

### Community 31 - "chat-provider.tsx"
Cohesion: 0.13
Nodes (18): Repo map: exact files to inspect and change, ChatPage(), ChatConversation(), ChatConversationProps, CHAT_MAX_MESSAGE_CHARS, ChatContext, ChatContextValue, ChatError (+10 more)

### Community 32 - "profile_attention.py"
Cohesion: 0.12
Nodes (15): AuditEvent, account_needs_action(), _action(), admin_attention(), instructor_attention(), instructor_course_ids(), membership_rows(), personal_audit() (+7 more)

### Community 33 - "onboarding/page.tsx"
Cohesion: 0.13
Nodes (27): AuthMode, OnboardingContent(), authenticate(), changeAuthMode(), checkExistingAuth(), finishPasswordSetup(), OnboardingPage(), PasswordInput() (+19 more)

### Community 34 - "quests/page.tsx"
Cohesion: 0.13
Nodes (15): ExamCard, ExamsPage(), localTime(), getBriefDescription(), QuestsPage(), QuestsPageContent(), clearFilters(), handleCategorySelect() (+7 more)

### Community 35 - "review/[id]/page.tsx"
Cohesion: 0.09
Nodes (41): 5.1 Shared library and components, AdminActivities(), confirmArchive(), openAvailability(), saveAvailability(), Page(), STATUS_OPTIONS, ActivityEditor() (+33 more)

### Community 36 - "ByteQuest 2.0 database review — 12 November 2026"
Cohesion: 0.15
Nodes (12): _id(), A. Inventory, B. Findings, ByteQuest 2.0 database review — 12 November 2026, C. Migration plan, D. Index recommendations, E. Organisation and documentation, End-to-end traces (+4 more)

### Community 37 - "next"
Cohesion: 0.10
Nodes (26): activityHref(), closesIn(), Dashboard, DashboardPage(), kindLabel(), localTime(), Progress, relative (+18 more)

### Community 38 - "test_profile_analytics.py"
Cohesion: 0.21
Nodes (10): _add_audit(), _analytics(), test_admin_priority_puts_failed_jobs_first(), test_each_role_receives_only_its_own_branch(), test_existing_admin_fields_remain_compatible(), test_existing_instructor_fields_remain_compatible(), test_faculty_attention_covers_only_assigned_courses(), test_faculty_without_courses_gets_a_calm_fallback() (+2 more)

### Community 39 - "create_chat_message"
Cohesion: 0.22
Nodes (5): ChatMessageRequest, ChatMessageResponse, ChatTurn, create_chat_message(), _system_instruction()

### Community 40 - "quest_groups.py"
Cohesion: 0.12
Nodes (34): add_group_activities(), AddGroupActivities, create_quest_group(), CreateQuestGroup, _group_view(), _group_views(), join_quest_group(), JoinQuestGroup (+26 more)

### Community 41 - "test_api_security.py"
Cohesion: 0.10
Nodes (13): Settings, Rule, window_bounds(), test_ai_global_budgets_are_independent(), test_chat_has_dedicated_account_and_global_quota(), test_chat_requires_active_enrollment_only_for_students(), test_daily_window_resets_at_manila_midnight(), test_global_ai_cap_rejects_without_spending_account_buckets() (+5 more)

### Community 42 - "BaseModel"
Cohesion: 0.15
Nodes (7): DocumentMetadataUpdate, DraftQuizUpdate, GeneratedChallengeSchema, GeneratedQuizOptionSchema, GeneratedQuizQuestionSchema, GeneratedQuizSchema, TestCaseSchema

### Community 43 - "quests_gamification.py"
Cohesion: 0.08
Nodes (30): _ensure_student(), get_codex(), get_gamification_leaderboard(), get_gamification_state(), get_mastery_map(), get_progress_recap(), get_student_progress(), LeaderboardEntry (+22 more)

### Community 44 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 45 - "_snapshot"
Cohesion: 0.25
Nodes (9): _course_activities(), dashboard(), evaluation(), _faculty(), _period_cutoff(), _snapshot(), student_detail(), _topic_key() (+1 more)

### Community 46 - "accessibility-provider.tsx"
Cohesion: 0.20
Nodes (15): ACCESSIBILITY_STORAGE_KEYS, AccessibilityContext, AccessibilityContextValue, AccessibilityPreferences, AccessibilityProvider(), applyPreferences(), commitPreferences(), DEFAULT_PREFERENCES (+7 more)

### Community 47 - "Faculty and administrator workspace — implementation log and continued work"
Cohesion: 0.15
Nodes (12): 10. Files created or modified (this work), 11. Quick current-state checklist, 1. Status at handoff, 6. Tests added, 7. Verification evidence (live app), 8. How to continue (commands, accounts, cleanup), Additional navigation fix, Continuation decision on student course scope (+4 more)

### Community 48 - "package.json"
Cohesion: 0.05
Nodes (43): dependencies, monaco-editor, @monaco-editor/react, next, react, react-dom, @supabase/auth-js, devDependencies (+35 more)

### Community 49 - "accounts/page.tsx"
Cohesion: 0.19
Nodes (13): AdminAccounts(), confirmDeactivate(), confirmReactivate(), openImpact(), submitCreate(), Page(), ConfirmDialog(), AccountList (+5 more)

### Community 50 - "submissions.py"
Cohesion: 0.10
Nodes (12): CodeSubmissionRequest, run_code_submission(), _shadow_scoring_ready(), attempt_quality(), best_challenge_stars(), challenge_stars(), help_pattern(), hint_timing() (+4 more)

### Community 51 - "AppTooltips"
Cohesion: 0.27
Nodes (17): AppTooltips(), clearTimers(), findTarget(), hide(), onClick(), onContextMenu(), onFocusIn(), onFocusOut() (+9 more)

### Community 52 - "StorageError"
Cohesion: 0.23
Nodes (5): StorageError, SupabasePDFStorage, test_accepts_absolute_signed_url_from_configured_origin(), test_rejects_untrusted_signed_url(), test_resolves_supabase_relative_signed_path()

### Community 54 - "Phase 7 database and file backup/restore runbook"
Cohesion: 0.15
Nodes (14): auth(), verify(), A. Provider database backup, B. Supplementary logical database export, Backup procedure, ByteQuest recovery acceptance checklist, C. Separate export of instructional PDF objects, Logical-export recovery limits (+6 more)

### Community 55 - "admin/materials/page.tsx"
Cohesion: 0.17
Nodes (18): AdminMaterials(), confirmArchive(), doDownload(), doRestore(), doRetry(), submitEdit(), submitUpload(), Page() (+10 more)

### Community 56 - "vps_bootstrap.sh"
Cohesion: 0.24
Nodes (15): active_ssh_port(), configure_cgroup_v1(), configure_docker(), configure_firewall(), configure_swap(), DEBIAN_FRONTEND, die(), DOCKER_KEYRING (+7 more)

### Community 57 - "Judge0 Hyper-V Ubuntu boot incident and recovery"
Cohesion: 0.13
Nodes (15): 1. Start and open the known-good VM, 2. Confirm the Judge0 services and volume inside Ubuntu, 3. Get the current guest IP and check the port, 4. Update ByteQuest if the VM IP changed, 5. Restart FastAPI and leave it running, 6. Verify service integration without exposing secrets, Current verified state, Disk and data safety (+7 more)

### Community 58 - "LegalDocument"
Cohesion: 0.24
Nodes (9): metadata, Page(), metadata, Page(), LegalDocument(), LegalKind, LegalModal(), PolicyPanel() (+1 more)

### Community 59 - "review/[id]/page.tsx"
Cohesion: 0.14
Nodes (18): DraftForm, DraftWorkspace(), confirmApprove(), confirmReject(), focusFirstError(), payloadFor(), saveRevision(), validate() (+10 more)

### Community 60 - "test_auth_jwks.py"
Cohesion: 0.18
Nodes (3): claims(), test_failed_jwks_verification_falls_back(), test_non_asymmetric_algorithms_never_use_jwks()

### Community 61 - "exams.py"
Cohesion: 0.10
Nodes (43): assigned(), assigned_exam_numbers(), create_exam(), DraftExam, DraftItem, exam_catalog(), exam_sample_run(), get_attempt() (+35 more)

### Community 62 - "app/layout.tsx"
Cohesion: 0.16
Nodes (11): byteBounce, metadata, RootLayout(), viewport, TooltipState, ToastApi, ToastContext, ToastItem (+3 more)

### Community 63 - "leaderboard.tsx"
Cohesion: 0.20
Nodes (12): CHOOSE_HANDLE_HREF, Leaderboard(), LeaderboardData, LeaderboardEntry, LeaderboardStanding, LearnerName(), MEDAL, Row() (+4 more)

### Community 64 - "test_learning_flow_integration.py"
Cohesion: 0.11
Nodes (37): answer_grace(), claim_exam(), new_session(), _letters(), _quiz(), _recall_concept(), _set_due_at(), _started_quiz_exam() (+29 more)

### Community 65 - "ByteQuest 2.0 engineering and UX review"
Cohesion: 0.40
Nodes (5): ByteQuest 2.0 engineering and UX review, Findings, Performance evidence, Recommended sequence, Verification and limits

### Community 66 - "ByteQuest — Security & AI-Abuse Hardening (implementation brief)"
Cohesion: 0.14
Nodes (12): _generate_chat_reply(), ByteQuest — Security & AI-Abuse Hardening (implementation brief), Final report (keep it short), Order and verification, Out of scope: do not do these, Rules for every task, Stack, Task 1 — Only enrolled students can use the AI chat tutor (+4 more)

### Community 67 - "ByteQuest 2.0 Classroom Pilot Operator Runbook"
Cohesion: 0.15
Nodes (12): 1. Hard Safety Gates (Enforced by Configuration), 2. Lab Station & Shared-Computer Protocol, 3. Network Resilience & Live Draft Sync, 4. Timed Exam Operations, 5. Verification Commands, 6. Incident Troubleshooting, ByteQuest 2.0 Classroom Pilot Operator Runbook, Classroom Wi-Fi Reconnect Banner (+4 more)

### Community 68 - "insights.py"
Cohesion: 0.19
Nodes (15): CategoryCount, course_insights(), _event_days(), GamificationInsights, HelpSeeking, _manila_day(), MemoryRetention, _rate() (+7 more)

### Community 69 - "settings_service.py"
Cohesion: 0.35
Nodes (9): PlatformSetting, _coerce(), get_setting_int(), get_settings_int(), list_settings(), _range_error(), serialize_setting(), _typed_value() (+1 more)

### Community 70 - "ByteQuest local end-to-end flow"
Cohesion: 0.17
Nodes (12): Account-synced progression check, Before deployment, ByteQuest local end-to-end flow, Instructor account, Local Quest Map demos, Manual startup, One-click Windows startup, Phase 6 shadow scoring status (+4 more)

### Community 71 - "home-redirect.tsx"
Cohesion: 0.33
Nodes (6): HomePage(), FEATURED_SLIDES, FeaturedQuestWindow(), FeaturedSlide, SafeNavigationOptions, useSafeWindowNavigation()

### Community 72 - "ByteQuest 2.0"
Cohesion: 0.17
Nodes (12): Architecture, ByteQuest 2.0, Documentation, Manual, One-click, Overview, Quick start (Windows), Repository layout (+4 more)

### Community 73 - "Judge0CircuitOpenError"
Cohesion: 0.18
Nodes (6): _b64_decode(), _b64_encode(), BatchEvaluationSummary, CircuitBreaker, Judge0CircuitOpenError, SingleTestResult

### Community 74 - "get_current_user_payload"
Cohesion: 0.29
Nodes (4): get_current_user_payload(), TokenPayload, test_es256_verifies_locally_off_the_event_loop(), Task 3 — Verify Supabase's asymmetric JWTs locally (performance)

### Community 75 - "accessibility-settings.tsx"
Cohesion: 0.25
Nodes (9): 5.2 Faculty routes, 5.3 Administrator routes, 5.4 Navigation and shell integration, 5. Frontend changes, AccessibilityPreferenceKey, useAccessibility(), ACCESSIBILITY_SETTINGS, AccessibilitySettingDefinition (+1 more)

### Community 76 - "Prompt for ChatGPT: ByteQuest gamification, Phases 2 and 3"
Cohesion: 0.20
Nodes (9): 10. Definition of done (for each part), 11. Double-check everything you implemented (mandatory), 12. Final report format, 1. Your role and mission, 3. Stack, layout and commands, 6. Phase 2A — Debugger's Codex (badges + progress indicator), 8. Phase 3A — Mastery Memory (quests + points, spaced retrieval), 9. Phase 3B — Staged mechanic rollout (counters the novelty dip) (+1 more)

### Community 77 - "GeminiConfigurationError"
Cohesion: 0.11
Nodes (12): get_settings(), ErrorExplanationSchema, explain_code_error(), _client_for_key(), GeminiConfigurationError, get_gemini_client(), GeminiAPIError, GeminiLLMService (+4 more)

### Community 78 - "ByteQuest 2.0 — Full system review"
Cohesion: 0.20
Nodes (10): Already strong (checked, not assumed), ByteQuest 2.0 — Full system review, Evidence, Must fix, Nice to have, Not checked, Ratings, Should fix (+2 more)

### Community 79 - "4. Read these before writing any code"
Cohesion: 0.21
Nodes (17): HintUse, _challenge(), _graded_job(), _published_activity(), _ranked_student(), _reveal_reviewed_hint(), test_codex_ignores_exam_tries_and_awards_bug_hunter_once_at_five(), test_codex_recovers_distinct_practice_errors_on_the_first_pass() (+9 more)

### Community 80 - "LOCAL_E2E.md"
Cohesion: 0.16
Nodes (9): Access matrix, Local API security contract, Local verification and future deployment, Quotas and validation, Comparison protocol, Export an attempt dataset, ML feature engineering and training, Prepare an Ubuntu VPS (+1 more)

### Community 81 - "ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash"
Cohesion: 0.20
Nodes (9): Behavior and scope of the assistant, ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash, Placement and responsive layout, Product decision, Quality gates and acceptance tests, Ready-to-paste DeepSeek V4.1 Flash implementation prompt, State and error rules, Suggested API contract (+1 more)

### Community 82 - "submissions/[id]/page.tsx"
Cohesion: 0.08
Nodes (31): loops, mocks, quest, Job, nextStarTip(), SubmissionStatusPage(), refresh(), mocks (+23 more)

### Community 83 - "ByteQuest 2.0: Master Architecture Plan & Execution Roadmap"
Cohesion: 0.13
Nodes (15): 1. Project Tracking & Thesis Collaboration Strategy, 2. Core Architectural Rules (Non-Negotiable), 3. Repository Directory Structure, 4. Course-Sequence & Curriculum Alignment, 5. Database Schema Blueprint (Supabase PostgreSQL + pgvector), 7. Thesis Objectives Mapping (Chapter 1 Alignment), 8. Development Environment & Quickstart Commands, Backend Setup (+7 more)

### Community 84 - "Phase 7 deployment readiness"
Cohesion: 0.20
Nodes (10): Decisions required before production setup, Deployment order after the decisions are made, Evidence still needed, Local Judge0 runtime smoke check (2026-10-26), Notes on local verification, Phase 7 deployment readiness, Prepared in the repository, Production settings and network boundaries (+2 more)

### Community 85 - "Corrected Lesson to Student Progress Verification"
Cohesion: 0.22
Nodes (6): Code and quality checks, Corrected Lesson to Student Progress Verification, Earlier student workflow verification (historical run), Environment and source, Follow-up and known boundaries, Instructor workflow

### Community 86 - "reserve"
Cohesion: 0.08
Nodes (10): _embed_chunks(), _embed_document_chunk(), reserve(), embed_chunks_bounded(), embed_one(), GeminiEmbeddingService, generate_embedding(), extract_chunks_from_pdf() (+2 more)

### Community 87 - "prepare-monaco.mjs"
Cohesion: 0.20
Nodes (5): frontend, marker, packageDir, source, target

### Community 88 - "Judge0UnavailableError"
Cohesion: 0.29
Nodes (5): classify_judge0_status(), Judge0UnavailableError, _parse_completed_result(), metric(), test_program_crash_is_still_graded_as_a_runtime_error()

### Community 89 - "gamification-insights.tsx"
Cohesion: 0.15
Nodes (15): CategoryCount, EngagementChart(), GamificationInsightsData, GamificationInsightsView(), MARGIN, MeterList(), percent(), RecallStage (+7 more)

### Community 90 - "Judge0 Hyper-V Ubuntu VM: troubleshooting handoff"
Cohesion: 0.22
Nodes (9): Confirmed project and Judge0 setup, Current state, Direct-shell recovery method that worked, Historical recommendation written before the Install VM recovery, Judge0 Hyper-V Ubuntu VM: troubleshooting handoff, Known guest settings and identifiers, Sources, Timeline of important events and changes (+1 more)

### Community 91 - "Milestones 1A–1C Status and Verification Log"
Cohesion: 0.22
Nodes (9): Environment, Follow-up verification — 2026-10-25, Milestone 1A: Judge0 execution, Milestone 1B: Local Supabase schema and fixtures, Milestone 1C: Browser-to-database walkthrough — Complete, verified, Milestones 1A–1C Status and Verification Log, Official milestone disposition, Submission-flow corrections made (+1 more)

### Community 92 - "Desktop and Mobile Pilot Flows (`pilot-v2.html`)"
Cohesion: 0.22
Nodes (8): 1. Offline / Network Reconnect Banner, 2. Pending / Queued Grading State, 3. Research Consent & Withdrawal State (Disabled Collection Notice), 4. Active Exam Priority Banner & Timed Attempt Lock, ByteQuest web app wireframes, Coverage, Desktop and Mobile Pilot Flows (`pilot-v2.html`), Review checklist

### Community 93 - "test_pilot_drafts_jobs_hints_and_consent_gate"
Cohesion: 0.33
Nodes (4): claim(), main(), recover_stale_submission_jobs(), test_pilot_drafts_jobs_hints_and_consent_gate()

### Community 94 - "codex.py"
Cohesion: 0.13
Nodes (16): ChallengeRecovery, codex_summary(), CodexCategory, CodexRecovery, CodexResponse, CodexSummary, practice_errors(), recoveries() (+8 more)

### Community 95 - "test_ml_exam_features.py"
Cohesion: 0.29
Nodes (4): _forecast(), test_exam_inputs_only_appear_after_release_in_the_same_course(), test_faculty_forecast_uses_the_recorded_winner_and_hides_legacy_probability(), test_older_feature_schema_artifacts_are_rejected()

### Community 96 - "test_sandbox_internal_error_is_unavailability_not_a_student_failure"
Cohesion: 0.28
Nodes (5): test_hidden_case_contributes_to_score_without_exposing_details(), language_ids(), poll_batch(), submit_batch(), test_sandbox_internal_error_is_unavailability_not_a_student_failure()

### Community 97 - "ML pipeline synthetic verification — 2026-10-25"
Cohesion: 0.29
Nodes (6): Artifact and activation checks, Execution, ML pipeline synthetic verification — 2026-10-25, Observed grouped metrics, Remaining Phase 5 work, Scope

### Community 98 - "components/student-preview.tsx"
Cohesion: 0.16
Nodes (10): 1. Current architecture, 2. Exact code touchpoints, 3. Recommended implementation order, 4. Ready-to-paste prompt for DeepSeek V4.1 Flash, 5. Manual acceptance checklist, ByteQuest 2.0: implementation guide and DeepSeek V4.1 Flash prompt, Existing API contracts, StudentPreview() (+2 more)

### Community 99 - "preflight-host.sh"
Cohesion: 0.38
Nodes (6): fail(), MIN_MEMORY_BYTES, MIN_ROOT_FREE_BYTES, MIN_SWAP_BYTES, pass(), preflight-host.sh script

### Community 100 - "ProfileResponse"
Cohesion: 0.14
Nodes (7): delete_my_avatar(), get_my_profile(), ProfileResponse, ProfileUpdateRequest, update_my_profile(), username_availability(), normalize_username()

### Community 101 - "Classroom pilot fixes and verification — 2026-10-28"
Cohesion: 0.33
Nodes (5): Changes checked locally, Classroom pilot fixes and verification — 2026-10-28, Evidence, Other Remaining Pilot Verification Gates, Verification Status & Remaining Gates

### Community 102 - "Phase 7 synthetic deployment preflight — 2026-10-26"
Cohesion: 0.33
Nodes (5): Evidence, Limits, Phase 7 synthetic deployment preflight — 2026-10-26, Result, Scope and method

### Community 103 - "runner_status"
Cohesion: 0.28
Nodes (9): _minutes(), runner_status(), job(), test_a_failing_latest_job_is_a_current_failure(), test_a_job_stuck_in_the_queue_means_the_worker_is_down(), test_a_job_that_just_arrived_is_not_a_stall(), test_a_service_switched_off_on_purpose_does_not_degrade_overall_health(), test_old_activity_reads_in_hours_and_days_not_hundreds_of_minutes() (+1 more)

### Community 104 - "get_ml_analytics_summary"
Cohesion: 0.25
Nodes (3): get_ml_analytics_summary(), InstructorAnalyticsResponse, ModelVersionCount

### Community 106 - "ByteQuest navigation"
Cohesion: 0.40
Nodes (4): ByteQuest navigation, Compatibility and new destinations, Existing routes, Local verification

### Community 107 - "6. 7-Phase Development Plan"
Cohesion: 0.22
Nodes (9): 6. 7-Phase Development Plan, Phase 1: Core Infrastructure, Auth & Database Setup (Days 1–5), Phase 2: Automated Code Assessment Subsystem — Judge0 (Days 6–11), Phase 3: Document-Grounded RAG & Gemini Content Generation (Days 12–18), Phase 4: Gamification Engine & Cold-Start Sequencing (Days 19–23), Phase 5: Feature Engineering & Comparative ML Pipeline (Days 24–30), Phase 6: Shadow ML Evaluation for Task Sequencing (Days 31–34), Phase 7: VPS Deployment, Classroom Study & Evaluation (Days 35–42) (+1 more)

### Community 108 - "run_training_and_comparison"
Cohesion: 0.30
Nodes (6): _atomic_joblib_dump(), _atomic_json_write(), _atomic_write(), run_training_and_comparison(), _select_winner(), _sha256_file()

### Community 110 - "Python demo journey — 2026-10-28"
Cohesion: 0.40
Nodes (4): Browser walkthrough, Implemented, Local evidence, Python demo journey — 2026-10-28

### Community 111 - "Phase 7 dependency security review (2026-10-26)"
Cohesion: 0.33
Nodes (5): Findings and changes, Phase 7 dependency security review (2026-10-26), Remaining checks and limits, Scope, Verification performed

### Community 112 - "PHASE7_DEPLOYMENT_READINESS.md"
Cohesion: 0.24
Nodes (3): Grant access to one account, Production instructor access, Safety boundaries

### Community 113 - "LearningActivity"
Cohesion: 0.08
Nodes (28): _safe_public_activity_context(), ActivityAttempt, LearningActivity, ReviewState, apply_publish_rules(), activity_has_opened(), activity_is_closed(), _as_utc() (+20 more)

### Community 114 - "Local API security verification — 2026-10-28"
Cohesion: 0.50
Nodes (3): 30-student local load, Checks, Local API security verification — 2026-10-28

### Community 115 - "Phase 7 database pool budget hardening"
Cohesion: 0.50
Nodes (3): Change, Checks performed, Phase 7 database pool budget hardening

### Community 116 - "entities.py"
Cohesion: 0.06
Nodes (21): _accuracy(), _faculty(), get_job(), submit_job(), SubmitJob, view(), get_db(), get_current_user() (+13 more)

### Community 117 - "account_provisioning.py"
Cohesion: 0.38
Nodes (6): _admin_headers(), build_profile(), delete_auth_user(), DuplicateAccount, invite_auth_user(), ProvisioningUnavailable

### Community 118 - "test_chat_rejects_nonvisible_student_activity"
Cohesion: 0.20
Nodes (7): _chat_payload(), _enroll_chat_students(), test_chat_provider_failure_and_quota_are_generic(), test_chat_rejects_nonvisible_student_activity(), test_chat_rejects_unauthenticated_and_invalid_payloads(), fake_reply(), test_class_snapshot_counts_mastery_and_a_true_average()

### Community 119 - "smoke-vps.sh"
Cohesion: 0.83
Nodes (3): check_health(), smoke-vps.sh script, usage()

### Community 120 - "_validate_form_keys"
Cohesion: 0.83
Nodes (3): validate_document_form(), _validate_form_keys(), validate_generation_form()

### Community 123 - "_admin_analytics"
Cohesion: 0.33
Nodes (6): _admin_analytics(), AuditEntry, get_my_analytics(), _instructor_analytics(), _personal_audit_entries(), ProfileAction

### Community 124 - "upload_my_avatar"
Cohesion: 0.24
Nodes (4): _detect_avatar_content_type(), upload_my_avatar(), test_detect_avatar_content_type_recognizes_supported_signatures(), test_detect_avatar_content_type_rejects_metadata_only_and_truncated_files()

### Community 128 - "ByteQuest manuscript and system alignment checklist"
Cohesion: 0.20
Nodes (10): 1. Scope decisions, 2. Chapter 1 — Introduction and scope, 3. Chapter 2 — Literature and synthesis, 4. Chapter 3 — Roles, practice, and AI, 5. Chapter 3 — Assessment and architecture, 6. Chapter 3 — Consent, research data, and ML, 7. Study records and final sign-off, ByteQuest manuscript and system alignment checklist (+2 more)

### Community 132 - "test_memory_rules.py"
Cohesion: 0.31
Nodes (4): review_passed(), review_size(), test_review_passes_at_two_thirds(), test_review_size_uses_up_to_four_questions()

### Community 133 - "TestCaseInput"
Cohesion: 0.33
Nodes (3): TestCaseInput, main(), verify_compilers()

### Community 134 - "Phase 7 readiness hardening"
Cohesion: 0.40
Nodes (5): Changes, Limits, Local runtime spot check — 2026-10-26, Phase 7 readiness hardening, Verification performed

### Community 135 - "arena.tsx"
Cohesion: 0.09
Nodes (34): RFC-4122, ArenaPage(), Arena(), confirmResetCode(), endSegment(), handleCodeChange(), handleCopyOutput(), load() (+26 more)

### Community 137 - "flow"
Cohesion: 0.25
Nodes (3): flow(), cleanup(), override_db()

### Community 138 - "ByteQuest 2.0 — Review remediation plan"
Cohesion: 0.33
Nodes (4): ByteQuest 2.0 — Review remediation plan, Done, Outside code, Still open

### Community 139 - "Phase 6 shadow rollout implementation record"
Cohesion: 0.33
Nodes (5): Implemented, Phase 6 shadow rollout implementation record, Phase 7 handoff, Safety and current state, Verification still required

### Community 140 - "complete_student_onboarding"
Cohesion: 0.40
Nodes (3): complete_staff_setup(), complete_student_onboarding(), _require_student()

### Community 141 - "test_configuration_version_conflict_and_validation"
Cohesion: 0.40
Nodes (5): test_configuration_version_conflict_and_validation(), 9. Remaining work, P0 — finish verification (no new features), P1 — functional gaps / decisions, P2 — tests and cleanup

### Community 142 - "ByteQuest backend runtime review"
Cohesion: 0.40
Nodes (4): ByteQuest backend runtime review, Mixed local workload, Pending measurements and review, Ranked findings

### Community 143 - "Phase 7 backend image build verification"
Cohesion: 0.40
Nodes (4): Limits, Phase 7 backend image build verification, Recorded evidence, Work completed

### Community 144 - "Phase 7 local production-mode runtime verification"
Cohesion: 0.40
Nodes (5): Boundaries and remaining work, Phase 7 local production-mode runtime verification, Procedure, Reproduction, Results

### Community 145 - "Phase 7 frontend build evidence"
Cohesion: 0.50
Nodes (3): Command and result, Phase 7 frontend build evidence, Scope and limits

### Community 146 - "Phase 7 Vercel setup verification — 2026-10-26"
Cohesion: 0.50
Nodes (3): Evidence and limits, Phase 7 Vercel setup verification — 2026-10-26, Verified state

## Knowledge Gaps
- **17 isolated node(s):** `monaco-editor`, `@types/node`, `@types/react`, `@types/react-dom`, `jsdom` (+12 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 958 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `4. Read these before writing any code` connect `4. Read these before writing any code` to `test_learning_flow_integration.py`, `api.ts`, `ui.tsx`, `reviews.py`, `settings_service.py`, `flow`, `quests_gamification.py`, `Prompt for ChatGPT: ByteQuest gamification, Phases 2 and 3`, `LearningActivity`, `profile/page.tsx`, `profiles.py`, `Judge0UnavailableError`?**
  _High betweenness centrality (0.178) - this node is a cross-community bridge._
- **Are the 230 inferred relationships involving `Profile` (e.g. with `account_impact()` and `_account_needs_action()`) actually correct?**
  _`Profile` has 230 INFERRED edges - model-reasoned connections that need verification._
- **What connects `monaco-editor`, `@types/node`, `@types/react` to the rest of the system?**
  _17 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ui.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05722701451714707 - nodes in this community are weakly interconnected._
- **Why does `LearningActivity` connect `LearningActivity` to `LearningActivity`, `Profile`, `reviews.py`, `rag_instructor.py`, `TestCaseInput`, `test_faculty_admin.py`, `InstructionalDocument`, `workspace_queries.py`, `publish_learning_activity`, `predictor.py`, `profiles.py`, `iso`, `pilot.py`, `profile_attention.py`, `quest_groups.py`, `quests_gamification.py`, `_snapshot`, `submissions.py`, `exams.py`, `test_learning_flow_integration.py`, `insights.py`, `4. Read these before writing any code`, `test_pilot_drafts_jobs_hints_and_consent_gate`, `codex.py`, `test_ml_exam_features.py`, `components/student-preview.tsx`, `get_ml_analytics_summary`, `entities.py`, `test_chat_rejects_nonvisible_student_activity`, `_admin_analytics`?**
  _High betweenness centrality (0.153) - this node is a cross-community bridge._
- **Are the 115 inferred relationships involving `LearningActivity` (e.g. with `_admin_activity()` and `_admin_activity_item()`) actually correct?**
  _`LearningActivity` has 115 INFERRED edges - model-reasoned connections that need verification._
- **Should `api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06386946386946386 - nodes in this community are weakly interconnected._