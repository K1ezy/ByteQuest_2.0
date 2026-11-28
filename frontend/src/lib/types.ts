export type ProgrammingLanguage = "cpp" | "python" | "java";
export type UserRole = "student" | "instructor" | "admin";

export interface Profile {
  id: string;
  pseudonym_id: string;
  username: string;
  role: UserRole;
  /** Languages of the active Workshops this account belongs to (ADR 0001); students choose none separately. */
  workshop_languages: ProgrammingLanguage[];
  year_level: number;
  semester: number;
  xp_points: number;
  current_level: number;
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  email?: string | null;
  created_at?: string | null;
  /** False while the account still has its generated starter handle; the server owns this rule. */
  handle_chosen?: boolean;
}

export interface QuizOption {
  key: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
}

export interface Quest {
  id: string;
  title: string | null;
  activity_type: "quiz" | "challenge";
  language: ProgrammingLanguage;
  topic_concept: string;
  difficulty_level: number;
  sequence_order: number;
  /** Place in this learner's own quest list (the "#" number on its card). */
  position?: number;
  added_at: string;
  added_at_estimated: boolean;
  /** Scheduled deadline, if the instructor set one. */
  closes_at?: string | null;
  /** Best solve-quality stars (1-3) on a solved code challenge; null otherwise. */
  stars?: number | null;
  xp_reward: number;
  problem_statement: string | null;
  starter_code: string | null;
  is_completed: boolean;
  completed_at?: string | null;
  is_closed?: boolean;
  pass_mark_percent?: number | null;
  quiz_questions?: QuizQuestion[] | null;
  /** Visible grading cases for a challenge; hidden cases are never sent. */
  sample_cases?: { stdin: string; expected_stdout: string }[] | null;
}

export interface WorkshopClassroomDetails {
  block?: string | null;
  year_level?: number | null;
  subject?: string | null;
  room?: string | null;
}

export interface Workshop extends WorkshopClassroomDetails {
  id: string;
  name: string;
  description: string | null;
  language: ProgrammingLanguage;
  is_owner: boolean;
  owned_by_me: boolean;
  join_code: string | null;
  joining_enabled: boolean;
  archived: boolean;
  owner_name: string;
  owner_avatar_url?: string | null;
  cover_image?: string | null;
  member_count: number;
  activity_ids: string[];
  activities: { activity_id: string; topic: string | null; position: number; added_at: string }[];
  next_closes_at?: string | null;
}

export interface WorkshopLesson {
  document_id: string;
  title: string;
  description: string | null;
  practice_status: "ready" | "indexing" | "unavailable";
}

export interface Evaluation {
  is_successful: boolean;
  passed_test_cases: number;
  total_test_cases: number;
  score_percentage: number;
  test_results?: EvaluationTestResult[];
  [key: string]: unknown;
}

export interface EvaluationTestResult {
  order_index: number;
  passed: boolean;
  status_description: string;
  error_category: string;
  stdout: string;
  stderr: string;
  compile_output: string;
  execution_time_ms: number;
  memory_used_kb: number;
  is_hidden: false;
  stdin?: string;
  expected_stdout?: string;
}

export interface ErrorExplanation {
  title: string;
  summary: string;
  concept_explanation: string;
  hints: string[];
  pedagogical_tip: string;
}
export type PracticeError = "syntax_error" | "logic_error" | "runtime_error" | "timeout";
export type CodexRecovery = { category: PracticeError; label: string };
export type CodexCategory = CodexRecovery & {
  recoveries: number;
  tier: number;
  next_tier_at: number | null;
  topics: string[];
  first_recovered_at: string | null;
};
export type CodexResponse = {
  locked: boolean;
  day: number;
  unlock: MechanicUnlock;
  categories: CodexCategory[];
  total_recoveries: number | null;
  comebacks: number | null;
};

export type MasteryConcept = {
  concept: string;
  total: number;
  completed: number;
  mastery_percent: number;
  state: "not_started" | "in_progress" | "mastered";
  average_stars: number | null;
  weak_spot: PracticeError | null;
  activity_ids: string[];
  memory?: MemoryConcept | null;
};
export type MasteryMapResponse = { track: ProgrammingLanguage | null; concepts: MasteryConcept[] };

export type MemoryState = "fresh" | "due" | "fading" | "long_term";
export type MemoryConcept = {
  concept: string;
  stage: number;
  state: MemoryState;
  due_at: string;
  open_review_id: string | null;
};
export type MechanicUnlock = { unlocked: boolean; unlock_day: number; unlocks_on: string | null };
export type ReviewOverview = {
  locked: boolean;
  day: number;
  unlock: MechanicUnlock;
  concepts: MemoryConcept[];
  due_count: number;
};
export type ReviewResult = {
  correct: number;
  total: number;
  passed: boolean;
  xp_awarded: number;
  new_total_xp: number;
  new_level: number;
  level_up: boolean;
  new_badges_unlocked: string[];
  badge_xp_awarded?: number;
  next_due_at: string;
  next_check_days: number;
  stage: number;
};
export type RecallReview = {
  id: string;
  concept: string;
  stage: number;
  questions: QuizQuestion[];
  result: ReviewResult | null;
};
