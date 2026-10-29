INSERT INTO public.badges (code, name, description, icon_url, xp_bonus, criteria_json)
VALUES
    ('FIRST_BLOOD', 'First Steps', 'Complete your first learning activity.', '/badges/first-steps.svg', 25, '{"successful_activities": 1}'::jsonb),
    ('CODE_WARRIOR', 'Code Warrior', 'Complete five learning activities.', '/badges/code-warrior.svg', 50, '{"successful_activities": 5}'::jsonb),
    ('XP_MASTER', 'XP Master', 'Earn 250 experience points.', '/badges/xp-master.svg', 75, '{"xp_points": 250}'::jsonb)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon_url = EXCLUDED.icon_url,
    xp_bonus = EXCLUDED.xp_bonus,
    criteria_json = EXCLUDED.criteria_json;

-- Note: Example learning activities and test cases have been cleared.
-- Instructors can generate and publish new course-aligned activities
-- via the Instructor Studio using course PDFs or text documents.
