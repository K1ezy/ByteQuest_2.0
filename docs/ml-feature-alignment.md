# ML features and prediction unit: manuscript vs. code

**Status:** superseded on 11/21/26 by the [ML improvement plan](ML_IMPROVEMENT_PLAN.md).
The code now uses the manuscript's ten features and one row per learner and challenge
at its first graded submission. This note is kept as the record of the gap it describes.

## 1. The two feature sets

The manuscript (Chapter 3, PDF p. 48; Algorithms 3 and 4) names ten canonical features.
The code (`backend/app/services/ml_predictor/feature_engineering.py`, `FEATURE_NAMES`)
uses thirteen.

| # | Manuscript feature | Closest current feature | Match |
|---|---|---|---|
| 1 | `prior_attempt_count` | `prior_attempts_total` | Same |
| 2 | `prior_pass_rate` | `historical_pass_rate` | Same |
| 3 | `prior_mean_score_ratio` | none | Missing. `score_percentage` is already exported. |
| 4 | `recent_3_pass_rate` | none | Missing. Computable from the existing export. |
| 5 | `prior_compile_error_rate` | `syntax_error_rate` | Close: same idea, different name. |
| 6 | `prior_runtime_error_rate` | `logic_and_runtime_error_rate` | Different: the code merges logic errors, runtime errors and timeouts. |
| 7 | `mean_attempts_per_task` | `avg_attempts_per_success` | Different denominator: per success, not per task. |
| 8 | `prior_quiz_score_mean` | `preceding_quiz_score_pct` | Different: the code uses the quiz just before, not the mean. |
| 9 | `prior_hint_usage_rate` | none | Missing. Needs `hint_uses` added to the export (counts only). |
| 10 | `days_since_last_attempt` | none | Missing. Computable from `created_at`. |

Current features with no manuscript counterpart:
- `avg_execution_time_ms`
- `avg_time_spent_seconds`
- `target_difficulty_level`
- `difficulty_delta`
- `released_exam_count`
- `released_exam_average_score_pct`
- `released_exam_latest_score_pct`

## 2. The prediction unit and label

| | Manuscript | Code today |
|---|---|---|
| Row | One per task assignment, evaluated at cutoff `t0`, before any submission on that task | One per attempt, retries included |
| Features | Only history strictly before `t0` | History before that attempt, including earlier failed tries on the same task |
| Label | The evaluated submission meets the pass mark | That attempt's `is_successful` |

Counting retries as rows over-represents struggling students. It also lets earlier
failures on the same task leak into that task's own prediction, which inflates
the scores the manuscript reports.

There is no task-assignment table, so `t0` must be derived. Proposal:

- **Cutoff `t0`:** the time of the student's first official submission on that task.
  Features use only attempts and quizzes completed before it.
- **Label:** the first graded official submission on that task passes (`is_successful`,
  which now applies the activity's pass mark). Ungraded infrastructure failures are
  excluded, as now.
- **Exams:** keep exam attempts out of the rows, as now.

## 3. Decisions for the adviser

1. Adopt the manuscript's ten features exactly, or update the manuscript to the
   thirteen in the code. Matching the manuscript is the cleaner defence.
2. Keep or drop the three released-exam features. They are not in the manuscript.
   Keeping them means documenting them.
3. Confirm the cutoff and label in section 2.

## 4. Files that would change

- `backend/app/services/ml_predictor/feature_engineering.py`: `FEATURE_NAMES` and extraction.
- `backend/app/services/ml_predictor/predictor.py` and `shadow.py`: build features at `t0`
  for live shadow predictions.
- `backend/app/services/ml_predictor/exam_history.py`: only if the exam features are dropped.
- `ml_pipeline/train_compare.py`:
  - one row per student and task, labelled by the first graded submission;
  - the synthetic bootstrap generator.
- `ml_pipeline/README.md`: add per-attempt hint counts to the export query.
- `backend/tests/test_ml_*.py`: update the feature and dataset tests.
- Model artifacts: bump the metadata `schema_version` and retrain. Current artifacts are
  synthetic, so nothing real is lost.

Estimated effort: one to two days including tests, once the decisions above are made.
