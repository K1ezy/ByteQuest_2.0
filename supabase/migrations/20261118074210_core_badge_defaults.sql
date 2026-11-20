-- Core progression is available in deployments that apply migrations only.
-- Preserve any existing definitions and awards on an upgraded installation.
INSERT INTO public.badges (code, name, description, icon_url, xp_bonus, criteria_json)
VALUES
    ('FIRST_BLOOD', 'First Steps', 'Complete your first learning activity.', '/badges/first-steps.svg', 25, '{"successful_activities": 1}'::jsonb),
    ('CODE_WARRIOR', 'Code Warrior', 'Complete five learning activities.', '/badges/code-warrior.svg', 50, '{"successful_activities": 5}'::jsonb),
    ('XP_MASTER', 'XP Master', 'Earn 250 experience points.', '/badges/xp-master.svg', 75, '{"xp_points": 250}'::jsonb)
ON CONFLICT (code) DO NOTHING;
