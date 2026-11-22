from app.services.ai_rag.solution_guard import reveals_solution

REFERENCE = """
n = int(input())
total = 0
for i in range(1, n + 1):
    if i % 2 == 0:
        total += i
print(total)
"""
STARTER = "n = int(input())"


def test_full_solution_is_blocked_even_with_renamed_variables():
    reply = (
        "Here you go:\n"
        "count = int(input())\n"
        "acc = 0\n"
        "for k in range(1, count + 1):\n"
        "    if k % 2 == 0:\n"
        "        acc += k\n"
        "print(acc)\n"
    )
    assert reveals_solution(reply, REFERENCE, STARTER)


def test_short_illustrative_snippet_passes():
    reply = "A loop can step through numbers, for example: for i in range(3): print(i)"
    assert not reveals_solution(reply, REFERENCE, STARTER)


def test_plain_explanation_passes():
    reply = (
        "Think about which numbers between 1 and n are even. The remainder operator tells you "
        "whether a number divides evenly. Keep a running total and add to it only when the "
        "condition holds, then print the total once the loop ends."
    )
    assert not reveals_solution(reply, REFERENCE, STARTER)


def test_starter_code_alone_is_not_a_solution():
    assert not reveals_solution("Start from your starter line: n = int(input())", REFERENCE, STARTER)


def test_no_reference_or_tiny_reference_never_blocks():
    assert not reveals_solution(REFERENCE, None)
    # Too small to tell apart from an everyday example such as echoing input.
    assert not reveals_solution("Echo it back: print(input())", "print(input())")
    # A one-liner that is literally the reference is still a giveaway.
    assert reveals_solution("print(2 * int(input()))", "print(2 * int(input()))")


def test_short_missing_statement_is_withheld_but_conceptual_hint_is_allowed():
    starter = "a, b = map(int, input().split())\n# Print the sum here."
    reference = "a, b = map(int, input().split())\nprint(a + b)"

    assert reveals_solution("Fill in `print(left + right)`.", reference, starter)
    assert not reveals_solution("How could you combine the two integer inputs?", reference, starter)
    assert not reveals_solution("Here is an example of output: `print(1 - 2)`.", reference, starter)


def test_exact_repair_to_failed_sample_is_withheld_even_if_it_is_in_the_starter():
    starter = "int n;\nstd::cin >> n;"
    reference = f'{starter}\nif (n > 0) std::cout << "Positive";'
    failed = reference.replace("std::cin >> n;", "std::cin >> n")

    assert reveals_solution("Use `std::cin >> n;`.", reference, starter, failed_sample=failed)
    assert not reveals_solution("Check the previous line for missing punctuation.", reference, starter,
                                failed_sample=failed)
    assert not reveals_solution("Use `std::cin >> n;`.", reference, starter)


def test_challenge_chat_rejects_alternate_code_even_without_reference_overlap():
    alternate = "word = 'Banana'\ncount = sum(c.lower() in 'aeiou' for c in word)\nprint(count)"
    assert reveals_solution(f"For example:\n```python\n{alternate}\n```", None, prose_only=True)
    assert reveals_solution(f"For example:\n{alternate}", None, prose_only=True)
    assert not reveals_solution("Try the sample with an uppercase character and trace your counter.", None, prose_only=True)
