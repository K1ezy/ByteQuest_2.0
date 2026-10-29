export type ProgrammingLanguage = "cpp" | "python" | "java";
export type UserRole = "student" | "instructor" | "admin";

export interface Profile {
  id: string;
  pseudonym_id: string;
  role: UserRole;
  enrolled_language: ProgrammingLanguage;
  year_level: number;
  semester: number;
  xp_points: number;
  current_level: number;
  display_name?: string | null;
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
  xp_reward: number;
  problem_statement: string | null;
  starter_code: string | null;
  is_completed: boolean;
  is_closed?: boolean;
  quiz_questions?: QuizQuestion[] | null;
}

export interface QuestGroup {
  id: string;
  name: string;
  description: string | null;
  language: ProgrammingLanguage;
  is_owner: boolean;
  join_code: string | null;
  member_count: number;
  activity_ids: string[];
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
