UPDATE public.platform_settings
SET description = 'Distinct prior graded activities in the same topic required before a next-task shadow prediction is recorded. Predictions stay advisory.'
WHERE key = 'prediction_min_history';
