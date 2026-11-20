"""Verify the configured Judge0 sandbox without reading learner data or writing grades."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.models.entities import ProgrammingLang
from app.services.judge0.client import Judge0Client, TestCaseInput


# Every solution here is a small synthetic program. The first and second cases
# distinguish passing a visible sample from passing official hidden cases.
PROGRAMS = {
    ProgrammingLang.python: {
        "reference": "print(int(input()) * 2)",
        "wrong answer": "print(-1)",
        "hidden case failure": "print(6)",
        "runtime error": "raise RuntimeError('pilot check')",
        "timeout": "while True: pass",
        "syntax error": "if True print(6)",
    },
    ProgrammingLang.cpp: {
        "reference": "#include <iostream>\nint main(){ int n; std::cin >> n; std::cout << n * 2; }",
        "wrong answer": "#include <iostream>\nint main(){ std::cout << -1; }",
        "hidden case failure": "#include <iostream>\nint main(){ std::cout << 6; }",
        "runtime error": "#include <cstdlib>\nint main(){ std::abort(); }",
        "timeout": "int main(){ volatile unsigned n = 0; for(;;) n = n + 1; }",
        "syntax error": "int main( {",
    },
    ProgrammingLang.java: {
        "reference": "import java.util.Scanner; class Main { public static void main(String[] a) { System.out.println(new Scanner(System.in).nextInt() * 2); } }",
        "wrong answer": "class Main { public static void main(String[] a) { System.out.println(-1); } }",
        "hidden case failure": "class Main { public static void main(String[] a) { System.out.println(6); } }",
        "runtime error": "class Main { public static void main(String[] a) { throw new RuntimeException(); } }",
        "timeout": "class Main { static volatile long n; public static void main(String[] a) { while(true) n++; } }",
        "syntax error": "class Main { public static void main(String[] a) { int n = ; } }",
    },
}
EXPECTED = {
    "reference": (2, {"none"}),
    "wrong answer": (0, {"logic_error"}),
    "hidden case failure": (1, {"logic_error"}),
    "runtime error": (0, {"runtime_error"}),
    "timeout": (0, {"timeout"}),
    "syntax error": (0, {"syntax_error"}),
}


async def verify_compilers() -> int:
    judge = Judge0Client()
    cases = [
        TestCaseInput("visible", 0, "3\n", "6", time_limit_ms=1000),
        TestCaseInput("hidden", 1, "4\n", "8", time_limit_ms=1000, is_hidden=True),
    ]
    failures = []
    for language, programs in PROGRAMS.items():
        for kind, source in programs.items():
            expected_count, categories = EXPECTED[kind]
            # Judge0 classifies Python parser errors as a nonzero runtime exit.
            if language == ProgrammingLang.python and kind == "syntax error":
                categories = categories | {"runtime_error"}
            try:
                result = await judge.evaluate_submission(language, source, cases)
            except Exception as exc:
                print(f"Judge0 request failed ({type(exc).__name__}); check the private VM and sandbox services.")
                return 1
            passed = (
                result.total_test_cases == len(cases)
                and result.passed_test_cases == expected_count
                and result.dominant_error_category in categories
                and [case.test_case_id for case in result.test_results] == ["visible"]
            )
            print(f"{language.value} {kind}: {'PASS' if passed else 'FAIL'} "
                  f"({result.passed_test_cases}/{result.total_test_cases}, {result.dominant_error_category})")
            if not passed:
                failures.append((language.value, kind))
    return int(bool(failures))


if __name__ == "__main__":
    raise SystemExit(asyncio.run(verify_compilers()))
