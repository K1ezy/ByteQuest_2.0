INSERT INTO bytequest_private.local_staff_registration (enabled) VALUES (true)
ON CONFLICT DO NOTHING;

INSERT INTO public.badges (code, name, description, icon_url, xp_bonus, criteria_json)
VALUES
    ('BUG_HUNTER', 'Bug Hunter', 'Recover from 5 errors.', '/badges/bug-hunter.svg', 50, '{"metric":"recoveries_total","threshold":5}'::jsonb),
    ('COMEBACK', 'Comeback', 'Pass a challenge after two failed attempts.', '/badges/comeback.svg', 25, '{"metric":"comebacks","threshold":1}'::jsonb)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon_url = EXCLUDED.icon_url,
    xp_bonus = EXCLUDED.xp_bonus,
    criteria_json = EXCLUDED.criteria_json;

INSERT INTO public.platform_settings (key, service, label, description, value, value_type, min_value, max_value)
VALUES
    ('gamification_codex_unlock_day', 'gamification', 'Debugger''s Codex unlock day',
     'Manila calendar days from a learner''s first practice activity to unlock the Codex. Set to 0 to unlock immediately.', '21'::jsonb, 'integer', 0, 60),
    ('gamification_memory_unlock_day', 'gamification', 'Mastery Memory unlock day',
     'Manila calendar days from a learner''s first practice activity to unlock Recall quests. Set to 0 to unlock immediately.', '35'::jsonb, 'integer', 0, 60)
ON CONFLICT (key) DO NOTHING;

-- Note: Example learning activities and test cases have been cleared.
-- Instructors can generate and publish new course-aligned activities
-- via the Instructor Studio using course PDFs or text documents.
