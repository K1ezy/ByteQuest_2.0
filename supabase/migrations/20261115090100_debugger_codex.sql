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
