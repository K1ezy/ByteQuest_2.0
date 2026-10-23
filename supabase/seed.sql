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

-- Local coding-loop fixtures. These reference solutions are verified by
-- backend/scripts/verify_all_languages.py before a verification run is logged.
INSERT INTO public.learning_activities (
    id, activity_type, language, topic_concept, title, problem_statement,
    starter_code, difficulty_level, sequence_order, review_status,
    reference_solution_code, judge0_verified, judge0_verification_log, xp_reward
)
VALUES
    (
        'a0000000-0000-4000-8000-000000000001', 'challenge', 'cpp', 'input-output',
        'Double an Integer (C++)',
        'Read one integer and print twice its value.',
        E'#include <iostream>\nint main() {\n    int value;\n    std::cin >> value;\n    std::cout << value * 2 << std::endl;\n    return 0;\n}',
        1, 1, 'published',
        E'#include <iostream>\nint main() {\n    int value;\n    if (std::cin >> value) std::cout << value * 2 << std::endl;\n    return 0;\n}',
        TRUE, '{"verified":true,"passed_test_cases":2,"total_test_cases":2,"runtime_target":"Judge0 Extra CE 1.13.1","verification_script":"backend/scripts/verify_all_languages.py"}'::jsonb, 25
    ),
    (
        'a0000000-0000-4000-8000-000000000002', 'challenge', 'python', 'input-output',
        'Double an Integer (Python)',
        'Read one integer and print twice its value.',
        E'value = int(input())\nprint(value * 2)\n',
        1, 1, 'published',
        E'import sys\nprint(int(sys.stdin.read().strip()) * 2)\n',
        TRUE, '{"verified":true,"passed_test_cases":2,"total_test_cases":2,"runtime_target":"Judge0 Extra CE 1.13.1","verification_script":"backend/scripts/verify_all_languages.py"}'::jsonb, 25
    ),
    (
        'a0000000-0000-4000-8000-000000000003', 'challenge', 'java', 'input-output',
        'Double an Integer (Java)',
        'Read one integer and print twice its value.',
        E'import java.util.Scanner;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int value = sc.nextInt();\n        System.out.println(value * 2);\n    }\n}',
        1, 1, 'published',
        E'import java.util.Scanner;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (sc.hasNextInt()) System.out.println(sc.nextInt() * 2);\n    }\n}',
        TRUE, '{"verified":true,"passed_test_cases":2,"total_test_cases":2,"runtime_target":"Judge0 Extra CE 1.13.1","verification_script":"backend/scripts/verify_all_languages.py"}'::jsonb, 25
    )
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    problem_statement = EXCLUDED.problem_statement,
    starter_code = EXCLUDED.starter_code,
    reference_solution_code = EXCLUDED.reference_solution_code,
    review_status = EXCLUDED.review_status,
    judge0_verified = EXCLUDED.judge0_verified,
    judge0_verification_log = EXCLUDED.judge0_verification_log,
    xp_reward = EXCLUDED.xp_reward;

INSERT INTO public.test_cases (
    id, activity_id, order_index, stdin, expected_stdout, time_limit_ms,
    memory_limit_kb, is_hidden, weight
)
VALUES
    ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 1, E'21\n', '42', 5000, 512000, FALSE, 1.0),
    ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 2, E'-3\n', '-6', 5000, 512000, TRUE, 1.0),
    ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002', 1, E'21\n', '42', 5000, 512000, FALSE, 1.0),
    ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002', 2, E'-3\n', '-6', 5000, 512000, TRUE, 1.0),
    ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000003', 1, E'21\n', '42', 5000, 512000, FALSE, 1.0),
    ('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000003', 2, E'-3\n', '-6', 5000, 512000, TRUE, 1.0)
ON CONFLICT (id) DO UPDATE SET
    stdin = EXCLUDED.stdin,
    expected_stdout = EXCLUDED.expected_stdout,
    time_limit_ms = EXCLUDED.time_limit_ms,
    memory_limit_kb = EXCLUDED.memory_limit_kb,
    is_hidden = EXCLUDED.is_hidden,
    weight = EXCLUDED.weight;
