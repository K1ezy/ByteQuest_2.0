"""Exercise the three local Judge0 runtimes without changing learning progress."""

import asyncio

from app.models.entities import ProgrammingLang
from app.services.judge0.client import Judge0Client, TestCaseInput


SOURCES = {
    ProgrammingLang.python: "print(sum(map(int, input().split())))",
    ProgrammingLang.cpp: '#include <iostream>\nint main(){int a,b;std::cin>>a>>b;std::cout<<a+b<<"\\n";}',
    ProgrammingLang.java: (
        "import java.util.*; class Main { public static void main(String[] args) { "
        "Scanner s=new Scanner(System.in); System.out.println(s.nextInt()+s.nextInt()); } }"
    ),
}


async def main() -> None:
    client = Judge0Client()
    test_case = TestCaseInput(
        test_case_id="offline-runtime",
        order_index=0,
        stdin="2 3\n",
        expected_stdout="5\n",
    )
    for language, source in SOURCES.items():
        result = await client.evaluate_submission(language, source, [test_case])
        if not result.is_successful:
            raise RuntimeError(f"{language.value} grading failed: {result.dominant_error_category}")
        print(f"{language.value} grading passed")


if __name__ == "__main__":
    asyncio.run(main())
