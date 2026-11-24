/** Shapes shared by the exam page and its answer-sync hook. */

export type ExamSyncBannerState =
  | "saving"
  | "saved"
  | "unsaved_local"
  | "conflict"
  | "expired_submitted";

/** Quiz items map question id to option key; challenge items hold source code. */
export type ExamAnswers = Record<string, string | Record<string, string>>;

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: { key: string; text: string }[];
}

export interface ExamItem {
  id: string;
  position: number;
  points: number;
  kind: "quiz" | "challenge";
  title: string;
  problem_statement: string;
  questions?: QuizQuestion[];
  starter_code?: string;
  samples?: { stdin: string; expected_stdout: string }[];
  pass_mark_percent?: number;
}

export interface AttemptResultItem {
  item_id: string;
  points_earned: number;
  points_possible: number;
}

export interface AttemptResult {
  score: number;
  max_score: number;
  passed?: boolean | null;
  items: AttemptResultItem[];
}

export interface Attempt {
  id: string;
  user_id?: string;
  student_id?: string;
  exam_id: string;
  title: string;
  status: string;
  due_at: string;
  /** Server cutoff: saves that arrive before this instant still count. */
  answers_accepted_until?: string;
  revision: number;
  last_saved_at: string | null;
  server_now?: string;
  answers: ExamAnswers;
  items: ExamItem[];
  results_released: boolean;
  result: AttemptResult | null;
  score: number | null;
}

export interface SaveAnswersResponse {
  attempt_id?: string;
  revision: number;
  last_saved_at?: string;
  saved_at?: string;
  server_now?: string;
  status?: string;
}

export function formatClockTime(isoString: string | null | undefined): string | null {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
