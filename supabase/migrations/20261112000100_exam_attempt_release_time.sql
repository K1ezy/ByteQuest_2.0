BEGIN;

ALTER TABLE public.exam_attempts
    ADD COLUMN result_released_at timestamptz;

-- The existing exam-level timestamp is the latest known release. For older
-- retakes this is conservative: it never makes a result available too early.
UPDATE public.exam_attempts AS ea
SET result_released_at = e.results_released_at
FROM public.exams AS e
WHERE ea.exam_id = e.id
  AND ea.status = 'submitted'
  AND ea.submitted_at <= e.results_released_at;

CREATE INDEX exam_attempts_student_release_idx
    ON public.exam_attempts (student_id, result_released_at)
    WHERE result_released_at IS NOT NULL;

COMMIT;
