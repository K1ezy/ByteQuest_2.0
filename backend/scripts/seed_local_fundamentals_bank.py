r"""Release every track-practice activity through instructor@gmail.com's Workshops, then top
each language up to 30 coding challenges and 20 concept check quizzes. Local Supabase only.

Run from the repository root with:
    .\backend\.venv\Scripts\python.exe .\backend\scripts\seed_local_fundamentals_bank.py

Idempotent: activity IDs are fixed, existing activities are reused, and student progress is kept.
"""

from __future__ import annotations

import asyncio
import sys
import uuid
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.engine import make_url

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import settings  # noqa: E402

url = make_url(settings.DATABASE_URL)
if settings.ENVIRONMENT.lower() != "development" or url.host not in {"localhost", "127.0.0.1"} or url.port not in {54322, 15432}:
    raise SystemExit("Refusing to seed outside the local development Supabase database (port 54322 or 15432).")

from app.api.workshops import AddWorkshopActivities, add_workshop_activities  # noqa: E402
from app.core.database import SessionLocal  # noqa: E402
from app.models.entities import (  # noqa: E402
    ActivityKind, CourseMember, LearningActivity, Profile, ProgrammingLang, ReviewState, TestCase, Workshop, WorkshopActivity,
)
from app.services.attempt_visibility import workshop_shareable_activity_clause  # noqa: E402
from app.services.activity_publishing import apply_publish_rules  # noqa: E402
from app.services.challenge_verification import challenge_is_verified, verify_saved_challenge  # noqa: E402
from app.services.gamification.quiz_content import parse_quiz_questions  # noqa: E402

INSTRUCTOR = "instructor@gmail.com"
TARGET_CHALLENGES, TARGET_QUIZZES = 30, 20
PY, CPP, JAVA = ProgrammingLang.python, ProgrammingLang.cpp, ProgrammingLang.java
LABEL = {PY: "Python", CPP: "C++", JAVA: "Java"}
STARTER = {
    PY: "# Read the input, solve the task, and print the answer.\n",
    CPP: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // Read the input, solve the task, and print the answer.\n    return 0;\n}\n",
    JAVA: "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner in = new Scanner(System.in);\n        // Read the input, solve the task, and print the answer.\n    }\n}\n",
}


def cpp(body: str) -> str:
    return "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n" + body + "\n    return 0;\n}\n"


def java(body: str) -> str:
    return ("import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n"
            "        Scanner in = new Scanner(System.in);\n" + body + "\n    }\n}\n")


def lines(values) -> str:
    return "\n".join(str(v) for v in values)


def fizz(n: int) -> str:
    return lines("FizzBuzz" if i % 15 == 0 else "Fizz" if i % 3 == 0 else "Buzz" if i % 5 == 0 else i for i in range(1, n + 1))


# (key, title, topic, difficulty, statement, cases, python, c++ body, java body). The first two cases are samples.
CHALLENGES = [
    ("rectangle-area", "Rectangle Area", "Variables and arithmetic", 1,
     "Read two integers w and h (1 to 1000) on one line. Print the area of a w by h rectangle.",
     [("4 5", "20"), ("7 3", "21"), ("1 1", "1"), ("1000 1000", "1000000")],
     "w, h = map(int, input().split())\nprint(w * h)\n",
     "    int w, h;\n    cin >> w >> h;\n    cout << w * h << endl;",
     "        int w = in.nextInt(), h = in.nextInt();\n        System.out.println(w * h);"),
    ("minutes-seconds", "Minutes and Seconds", "Integer division and modulo", 1,
     "Read a number of seconds s (0 to 100000). Print the whole minutes and the remaining seconds, separated by one space.",
     [("125", "2 5"), ("60", "1 0"), ("0", "0 0"), ("99999", "1666 39")],
     "s = int(input())\nprint(s // 60, s % 60)\n",
     "    int s;\n    cin >> s;\n    cout << s / 60 << \" \" << s % 60 << endl;",
     "        int s = in.nextInt();\n        System.out.println(s / 60 + \" \" + s % 60);"),
    ("larger-of-two", "Larger of Two", "Conditionals", 1,
     "Read two integers a and b on one line. Print the larger one (either, if they are equal).",
     [("3 9", "9"), ("-2 -8", "-2"), ("5 5", "5"), ("-1000 1000", "1000")],
     "a, b = map(int, input().split())\nprint(a if a > b else b)\n",
     "    int a, b;\n    cin >> a >> b;\n    cout << (a > b ? a : b) << endl;",
     "        int a = in.nextInt(), b = in.nextInt();\n        System.out.println(a > b ? a : b);"),
    ("largest-of-three", "Largest of Three", "Conditionals", 1,
     "Read three integers on one line. Print the largest.",
     [("3 9 4", "9"), ("-5 -2 -9", "-2"), ("7 7 7", "7"), ("1 2 3", "3")],
     "a, b, c = map(int, input().split())\nbest = a\nif b > best:\n    best = b\nif c > best:\n    best = c\nprint(best)\n",
     "    int a, b, c;\n    cin >> a >> b >> c;\n    int best = a;\n    if (b > best) best = b;\n    if (c > best) best = c;\n    cout << best << endl;",
     "        int a = in.nextInt(), b = in.nextInt(), c = in.nextInt();\n        int best = a;\n        if (b > best) best = b;\n        if (c > best) best = c;\n        System.out.println(best);"),
    ("absolute-value", "Absolute Value", "Conditionals", 1,
     "Read one integer n (-1000000 to 1000000). Print its absolute value without using a library function.",
     [("-7", "7"), ("12", "12"), ("0", "0"), ("-1000000", "1000000")],
     "n = int(input())\nif n < 0:\n    n = -n\nprint(n)\n",
     "    int n;\n    cin >> n;\n    if (n < 0) n = -n;\n    cout << n << endl;",
     "        int n = in.nextInt();\n        if (n < 0) n = -n;\n        System.out.println(n);"),
    ("leap-year", "Leap Year", "Logical operators", 2,
     "Read a year (1 to 9999). Print Leap if it is divisible by 4 and not by 100, or divisible by 400. Otherwise print Common.",
     [("2024", "Leap"), ("2023", "Common"), ("1900", "Common"), ("2000", "Leap")],
     "y = int(input())\nprint(\"Leap\" if (y % 4 == 0 and y % 100 != 0) or y % 400 == 0 else \"Common\")\n",
     "    int y;\n    cin >> y;\n    cout << (((y % 4 == 0 && y % 100 != 0) || y % 400 == 0) ? \"Leap\" : \"Common\") << endl;",
     "        int y = in.nextInt();\n        System.out.println(((y % 4 == 0 && y % 100 != 0) || y % 400 == 0) ? \"Leap\" : \"Common\");"),
    ("letter-grade", "Letter Grade", "Conditionals", 1,
     "Read a score from 0 to 100. Print A for 90 and above, B for 80-89, C for 70-79, D for 60-69, and F below 60.",
     [("95", "A"), ("72", "C"), ("60", "D"), ("59", "F"), ("80", "B"), ("100", "A")],
     "s = int(input())\nif s >= 90:\n    print(\"A\")\nelif s >= 80:\n    print(\"B\")\nelif s >= 70:\n    print(\"C\")\nelif s >= 60:\n    print(\"D\")\nelse:\n    print(\"F\")\n",
     "    int s;\n    cin >> s;\n    if (s >= 90) cout << \"A\";\n    else if (s >= 80) cout << \"B\";\n    else if (s >= 70) cout << \"C\";\n    else if (s >= 60) cout << \"D\";\n    else cout << \"F\";\n    cout << endl;",
     "        int s = in.nextInt();\n        if (s >= 90) System.out.println(\"A\");\n        else if (s >= 80) System.out.println(\"B\");\n        else if (s >= 70) System.out.println(\"C\");\n        else if (s >= 60) System.out.println(\"D\");\n        else System.out.println(\"F\");"),
    ("multiplication-table", "Multiplication Table", "For loops", 1,
     "Read an integer n (1 to 20). Print ten lines in the form \"n x i = product\" for i from 1 to 10.",
     [(str(n), lines(f"{n} x {i} = {n * i}" for i in range(1, 11))) for n in (3, 7, 1, 20)],
     "n = int(input())\nfor i in range(1, 11):\n    print(f\"{n} x {i} = {n * i}\")\n",
     "    int n;\n    cin >> n;\n    for (int i = 1; i <= 10; i++) cout << n << \" x \" << i << \" = \" << n * i << endl;",
     "        int n = in.nextInt();\n        for (int i = 1; i <= 10; i++) System.out.println(n + \" x \" + i + \" = \" + n * i);"),
    ("factorial", "Factorial", "Loops and accumulators", 1,
     "Read an integer n (0 to 12). Print n! (the product 1 x 2 x ... x n). 0! is 1.",
     [("5", "120"), ("0", "1"), ("12", "479001600"), ("1", "1")],
     "n = int(input())\nresult = 1\nfor i in range(2, n + 1):\n    result *= i\nprint(result)\n",
     "    int n;\n    cin >> n;\n    int result = 1;\n    for (int i = 2; i <= n; i++) result *= i;\n    cout << result << endl;",
     "        int n = in.nextInt();\n        int result = 1;\n        for (int i = 2; i <= n; i++) result *= i;\n        System.out.println(result);"),
    ("sum-of-digits", "Sum of Digits", "While loops", 2,
     "Read a non-negative integer n (up to 1000000000). Print the sum of its digits.",
     [("1234", "10"), ("0", "0"), ("1000000000", "1"), ("987654321", "45")],
     "n = int(input())\ntotal = 0\nwhile n > 0:\n    total += n % 10\n    n //= 10\nprint(total)\n",
     "    int n;\n    cin >> n;\n    int total = 0;\n    while (n > 0) { total += n % 10; n /= 10; }\n    cout << total << endl;",
     "        int n = in.nextInt();\n        int total = 0;\n        while (n > 0) { total += n % 10; n /= 10; }\n        System.out.println(total);"),
    ("reverse-number", "Reverse a Number", "While loops", 2,
     "Read a non-negative integer n (up to 1000000). Print its digits in reverse order as a number, so 1200 becomes 21.",
     [("1234", "4321"), ("1200", "21"), ("7", "7"), ("100000", "1")],
     "n = int(input())\nresult = 0\nwhile n > 0:\n    result = result * 10 + n % 10\n    n //= 10\nprint(result)\n",
     "    int n;\n    cin >> n;\n    int result = 0;\n    while (n > 0) { result = result * 10 + n % 10; n /= 10; }\n    cout << result << endl;",
     "        int n = in.nextInt();\n        int result = 0;\n        while (n > 0) { result = result * 10 + n % 10; n /= 10; }\n        System.out.println(result);"),
    ("fizzbuzz", "FizzBuzz", "Loops and conditionals", 2,
     "Read n (1 to 100). For each i from 1 to n print FizzBuzz if i is divisible by 15, Fizz if by 3, Buzz if by 5, otherwise i.",
     [(str(n), fizz(n)) for n in (5, 15, 1, 30)],
     "n = int(input())\nfor i in range(1, n + 1):\n    if i % 15 == 0:\n        print(\"FizzBuzz\")\n    elif i % 3 == 0:\n        print(\"Fizz\")\n    elif i % 5 == 0:\n        print(\"Buzz\")\n    else:\n        print(i)\n",
     "    int n;\n    cin >> n;\n    for (int i = 1; i <= n; i++) {\n        if (i % 15 == 0) cout << \"FizzBuzz\";\n        else if (i % 3 == 0) cout << \"Fizz\";\n        else if (i % 5 == 0) cout << \"Buzz\";\n        else cout << i;\n        cout << endl;\n    }",
     "        int n = in.nextInt();\n        for (int i = 1; i <= n; i++) {\n            if (i % 15 == 0) System.out.println(\"FizzBuzz\");\n            else if (i % 3 == 0) System.out.println(\"Fizz\");\n            else if (i % 5 == 0) System.out.println(\"Buzz\");\n            else System.out.println(i);\n        }"),
    ("prime-check", "Prime Check", "Loops and conditionals", 2,
     "Read an integer n (1 to 1000000). Print Prime if n is prime, otherwise print Not prime.",
     [("7", "Prime"), ("1", "Not prime"), ("2", "Prime"), ("999983", "Prime"), ("1000000", "Not prime")],
     "n = int(input())\nprime = n >= 2\ni = 2\nwhile i * i <= n:\n    if n % i == 0:\n        prime = False\n        break\n    i += 1\nprint(\"Prime\" if prime else \"Not prime\")\n",
     "    int n;\n    cin >> n;\n    bool prime = n >= 2;\n    for (int i = 2; i * i <= n; i++) if (n % i == 0) { prime = false; break; }\n    cout << (prime ? \"Prime\" : \"Not prime\") << endl;",
     "        int n = in.nextInt();\n        boolean prime = n >= 2;\n        for (int i = 2; i * i <= n; i++) if (n % i == 0) { prime = false; break; }\n        System.out.println(prime ? \"Prime\" : \"Not prime\");"),
    ("fibonacci", "Nth Fibonacci Number", "Loops and variables", 2,
     "Read n (0 to 40). Print the nth Fibonacci number, where F(0) = 0, F(1) = 1, and F(n) = F(n-1) + F(n-2).",
     [("10", "55"), ("0", "0"), ("1", "1"), ("40", "102334155")],
     "n = int(input())\na, b = 0, 1\nfor _ in range(n):\n    a, b = b, a + b\nprint(a)\n",
     "    int n;\n    cin >> n;\n    int a = 0, b = 1;\n    for (int i = 0; i < n; i++) { int t = a + b; a = b; b = t; }\n    cout << a << endl;",
     "        int n = in.nextInt();\n        int a = 0, b = 1;\n        for (int i = 0; i < n; i++) { int t = a + b; a = b; b = t; }\n        System.out.println(a);"),
    ("gcd", "Greatest Common Divisor", "While loops", 2,
     "Read two positive integers a and b (up to 1000000000). Print their greatest common divisor.",
     [("12 18", "6"), ("7 13", "1"), ("1000000000 500000000", "500000000"), ("36 36", "36")],
     "a, b = map(int, input().split())\nwhile b:\n    a, b = b, a % b\nprint(a)\n",
     "    int a, b;\n    cin >> a >> b;\n    while (b != 0) { int t = a % b; a = b; b = t; }\n    cout << a << endl;",
     "        int a = in.nextInt(), b = in.nextInt();\n        while (b != 0) { int t = a % b; a = b; b = t; }\n        System.out.println(a);"),
    ("power", "Power with a Loop", "For loops", 1,
     "Read a base a (0 to 10) and an exponent b (0 to 9). Print a raised to b using a loop.",
     [("2 10", "1024"), ("5 0", "1"), ("10 9", "1000000000"), ("0 5", "0")],
     "a, b = map(int, input().split())\nresult = 1\nfor _ in range(b):\n    result *= a\nprint(result)\n",
     "    int a, b;\n    cin >> a >> b;\n    int result = 1;\n    for (int i = 0; i < b; i++) result *= a;\n    cout << result << endl;",
     "        int a = in.nextInt(), b = in.nextInt();\n        int result = 1;\n        for (int i = 0; i < b; i++) result *= a;\n        System.out.println(result);"),
    ("list-sum", "Sum of a List", "Arrays and lists", 1,
     "Read n (0 to 100), then n integers (-1000 to 1000). Print their sum.",
     [("5\n1 2 3 4 5", "15"), ("1\n-7", "-7"), ("3\n-1000 0 1000", "0"), ("0", "0")],
     "n = int(input())\nvalues = list(map(int, input().split())) if n else []\nprint(sum(values))\n",
     "    int n;\n    cin >> n;\n    int total = 0;\n    for (int i = 0; i < n; i++) { int x; cin >> x; total += x; }\n    cout << total << endl;",
     "        int n = in.nextInt();\n        int total = 0;\n        for (int i = 0; i < n; i++) total += in.nextInt();\n        System.out.println(total);"),
    ("list-maximum", "Maximum in a List", "Arrays and lists", 1,
     "Read n (1 to 100), then n integers. Print the largest value.",
     [("5\n3 9 -2 9 4", "9"), ("1\n-5", "-5"), ("4\n-8 -3 -9 -4", "-3")],
     "n = int(input())\nvalues = list(map(int, input().split()))\nbest = values[0]\nfor v in values:\n    if v > best:\n        best = v\nprint(best)\n",
     "    int n;\n    cin >> n;\n    int best;\n    cin >> best;\n    for (int i = 1; i < n; i++) { int x; cin >> x; if (x > best) best = x; }\n    cout << best << endl;",
     "        int n = in.nextInt();\n        int best = in.nextInt();\n        for (int i = 1; i < n; i++) { int x = in.nextInt(); if (x > best) best = x; }\n        System.out.println(best);"),
    ("count-evens", "Count Even Numbers", "Arrays and lists", 1,
     "Read n (0 to 100), then n integers. Print how many of them are even.",
     [("6\n1 2 3 4 5 6", "3"), ("0", "0"), ("4\n-2 -3 0 7", "2")],
     "n = int(input())\nvalues = list(map(int, input().split())) if n else []\nprint(sum(1 for v in values if v % 2 == 0))\n",
     "    int n;\n    cin >> n;\n    int count = 0;\n    for (int i = 0; i < n; i++) { int x; cin >> x; if (x % 2 == 0) count++; }\n    cout << count << endl;",
     "        int n = in.nextInt();\n        int count = 0;\n        for (int i = 0; i < n; i++) if (in.nextInt() % 2 == 0) count++;\n        System.out.println(count);"),
    ("reverse-word", "Reverse a Word", "Strings", 1,
     "Read one word with no spaces. Print it reversed.",
     [("hello", "olleh"), ("ByteQuest", "tseuQetyB"), ("a", "a"), ("racecar", "racecar")],
     "word = input().strip()\nprint(word[::-1])\n",
     "    string s;\n    cin >> s;\n    cout << string(s.rbegin(), s.rend()) << endl;",
     "        String s = in.next();\n        System.out.println(new StringBuilder(s).reverse().toString());"),
    ("palindrome", "Palindrome Word", "Strings", 2,
     "Read one lowercase word. Print Yes if it reads the same forwards and backwards, otherwise No.",
     [("level", "Yes"), ("hello", "No"), ("a", "Yes"), ("abba", "Yes"), ("ab", "No")],
     "word = input().strip()\nprint(\"Yes\" if word == word[::-1] else \"No\")\n",
     "    string s;\n    cin >> s;\n    cout << (s == string(s.rbegin(), s.rend()) ? \"Yes\" : \"No\") << endl;",
     "        String s = in.next();\n        System.out.println(new StringBuilder(s).reverse().toString().equals(s) ? \"Yes\" : \"No\");"),
    ("count-letter", "Count a Letter", "Strings", 1,
     "Read a lowercase word on the first line and one letter on the second. Print how many times the letter appears in the word.",
     [("banana\na", "3"), ("hello\nz", "0"), ("mississippi\ns", "4")],
     "word = input().strip()\nletter = input().strip()\nprint(word.count(letter))\n",
     "    string s;\n    char c;\n    cin >> s >> c;\n    int count = 0;\n    for (char x : s) if (x == c) count++;\n    cout << count << endl;",
     "        String s = in.next();\n        char c = in.next().charAt(0);\n        int count = 0;\n        for (int i = 0; i < s.length(); i++) if (s.charAt(i) == c) count++;\n        System.out.println(count);"),
    ("uppercase-word", "Uppercase Word", "Strings", 1,
     "Read one lowercase word. Print it in uppercase letters.",
     [("hello", "HELLO"), ("python", "PYTHON"), ("a", "A")],
     "print(input().strip().upper())\n",
     "    string s;\n    cin >> s;\n    for (char &c : s) c = toupper(c);\n    cout << s << endl;",
     "        System.out.println(in.next().toUpperCase());"),
    ("star-triangle", "Star Triangle", "Nested loops", 2,
     "Read n (1 to 20). Print n lines; line i has i asterisks (*).",
     [(str(n), lines("*" * i for i in range(1, n + 1))) for n in (3, 1, 5, 20)],
     "n = int(input())\nfor i in range(1, n + 1):\n    print(\"*\" * i)\n",
     "    int n;\n    cin >> n;\n    for (int i = 1; i <= n; i++) {\n        for (int j = 0; j < i; j++) cout << '*';\n        cout << endl;\n    }",
     "        int n = in.nextInt();\n        for (int i = 1; i <= n; i++) {\n            StringBuilder row = new StringBuilder();\n            for (int j = 0; j < i; j++) row.append('*');\n            System.out.println(row);\n        }"),
    ("linear-search", "Linear Search", "Arrays and searching", 2,
     "Read n (1 to 100), then n integers on one line, then a target on the next line. Print the 0-based index of the first match, or -1.",
     [("5\n4 8 15 16 23\n15", "2"), ("3\n1 2 3\n9", "-1"), ("4\n7 7 7 7\n7", "0"), ("1\n5\n5", "0")],
     "n = int(input())\nvalues = list(map(int, input().split()))\ntarget = int(input())\nanswer = -1\nfor i, v in enumerate(values):\n    if v == target:\n        answer = i\n        break\nprint(answer)\n",
     "    int n;\n    cin >> n;\n    vector<int> a(n);\n    for (int &x : a) cin >> x;\n    int target, answer = -1;\n    cin >> target;\n    for (int i = 0; i < n; i++) if (a[i] == target) { answer = i; break; }\n    cout << answer << endl;",
     "        int n = in.nextInt();\n        int[] a = new int[n];\n        for (int i = 0; i < n; i++) a[i] = in.nextInt();\n        int target = in.nextInt(), answer = -1;\n        for (int i = 0; i < n; i++) if (a[i] == target) { answer = i; break; }\n        System.out.println(answer);"),
    ("sort-ascending", "Sort Ascending", "Arrays and sorting", 2,
     "Read n (1 to 100), then n integers. Print them in ascending order, separated by single spaces.",
     [("5\n5 3 9 1 4", "1 3 4 5 9"), ("1\n7", "7"), ("4\n-2 8 -2 0", "-2 -2 0 8")],
     "n = int(input())\nprint(\" \".join(map(str, sorted(map(int, input().split())))))\n",
     "    int n;\n    cin >> n;\n    vector<int> a(n);\n    for (int &x : a) cin >> x;\n    sort(a.begin(), a.end());\n    for (int i = 0; i < n; i++) cout << (i ? \" \" : \"\") << a[i];\n    cout << endl;",
     "        int n = in.nextInt();\n        int[] a = new int[n];\n        for (int i = 0; i < n; i++) a[i] = in.nextInt();\n        Arrays.sort(a);\n        StringJoiner out = new StringJoiner(\" \");\n        for (int x : a) out.add(String.valueOf(x));\n        System.out.println(out);"),
]

# Quizzes: (key, title, topic, [(prompt, [A, B, C, D], correct index)]).
CPP_QUIZZES = [
    ("cpp-types", "C++ Variables and Data Types", "Variables and data types", [
        ("Which type stores a whole number?", ["double", "int", "char", "bool"], 1),
        ("Which type stores a single character such as 'A'?", ["string", "char", "int", "float"], 1),
        ("What does `bool done = false;` declare?", ["A number", "A text value", "A true/false value", "A constant"], 2)]),
    ("cpp-io", "C++ Input and Output", "Input and output", [
        ("Which object prints to the screen?", ["cin", "cout", "printf()", "print"], 1),
        ("Which operator reads a value with cin?", ["<<", ">>", "->", "=="], 1),
        ("Which header provides cin and cout?", ["<string>", "<iostream>", "<cmath>", "<vector>"], 1)]),
    ("cpp-arithmetic", "C++ Arithmetic Operators", "Variables and arithmetic", [
        ("What is 7 / 2 when both are int?", ["3.5", "3", "4", "2"], 1),
        ("What is 7 % 3?", ["1", "2", "0", "3"], 0),
        ("What is the value of x after `int x = 5; x += 3;`?", ["5", "3", "8", "15"], 2)]),
    ("cpp-relational", "C++ Relational and Logical Operators", "Logical operators", [
        ("Which operator tests equality?", ["=", "==", "!=", "=>"], 1),
        ("What is `true && false`?", ["true", "false", "1", "An error"], 1),
        ("Which operator means logical OR?", ["&&", "||", "!", "|="], 1)]),
    ("cpp-if", "C++ If and Else", "Conditionals", [
        ("Which block runs when an if condition is false?", ["else", "then", "case", "default"], 0),
        ("What prints for x = 5 in `if (x > 3) cout << \"A\"; else cout << \"B\";`?", ["A", "B", "AB", "Nothing"], 0),
        ("Which keyword tests a second condition after if?", ["elif", "else if", "elseif", "then if"], 1)]),
    ("cpp-switch", "C++ Switch Statements", "Conditionals", [
        ("Which keyword stops a case from falling through?", ["stop", "exit", "break", "end"], 2),
        ("Which label runs when no case matches?", ["else", "default", "otherwise", "none"], 1),
        ("A switch compares its value with each...", ["loop", "case", "function", "array"], 1)]),
    ("cpp-while", "C++ While Loops", "While loops", [
        ("When does a while loop stop?", ["After one run", "When its condition is false", "Never", "When it reaches 10"], 1),
        ("How many times does `int i = 0; while (i < 3) i++;` run the body?", ["2", "3", "4", "0"], 1),
        ("Which loop always runs its body at least once?", ["while", "for", "do-while", "range-for"], 2)]),
    ("cpp-for", "C++ For Loops", "For loops", [
        ("What does `for (int i = 1; i <= 3; i++) cout << i;` print?", ["123", "012", "0123", "1234"], 0),
        ("Which part of a for loop runs only once?", ["The condition", "The update", "The initialization", "The body"], 2),
        ("What does i++ do?", ["Doubles i", "Adds 1 to i", "Subtracts 1", "Resets i"], 1)]),
    ("cpp-break", "C++ Break and Continue", "Loops", [
        ("What does break do inside a loop?", ["Skips one round", "Leaves the loop", "Restarts the loop", "Pauses"], 1),
        ("What does continue do?", ["Leaves the loop", "Skips to the next round", "Ends the program", "Repeats the round"], 1),
        ("In nested loops, break leaves...", ["Every loop", "Only the innermost loop", "The function", "Nothing"], 1)]),
    ("cpp-arrays", "C++ Arrays", "Arrays and lists", [
        ("What is the index of the first element?", ["1", "0", "-1", "It depends"], 1),
        ("For `int a[5];`, what is the last valid index?", ["5", "4", "6", "0"], 1),
        ("What is a[1] for `int a[] = {4, 7, 9};`?", ["4", "7", "9", "1"], 1)]),
    ("cpp-strings", "C++ Strings", "Strings", [
        ("Which method returns a string's length?", ["size()", "count()", "len()", "total()"], 0),
        ("What is s[0] when s = \"code\"?", ["'o'", "'c'", "'e'", "\"code\""], 1),
        ("Which operator joins two strings?", ["+", "&", ".", "*"], 0)]),
    ("cpp-functions", "C++ Functions", "Functions", [
        ("What return type means a function returns nothing?", ["null", "void", "none", "empty"], 1),
        ("What does `int sq(int x) { return x * x; }` return for sq(4)?", ["8", "16", "4", "44"], 1),
        ("Where must a function be declared before it is called?", ["After main", "Before the call", "Anywhere", "In a header only"], 1)]),
    ("cpp-parameters", "C++ Parameters and Return Values", "Functions", [
        ("Which parameter lets a function change the caller's variable?", ["int x", "int &x", "const int x", "int x = 0"], 1),
        ("How many values can a C++ function return directly?", ["One", "Two", "Any number", "None"], 0),
        ("What is passed by default to `void f(int x)`?", ["A reference", "A copy of the value", "A pointer", "Nothing"], 1)]),
    ("cpp-scope", "C++ Variable Scope", "Functions", [
        ("Where can a variable declared inside a loop body be used?", ["Anywhere", "Only inside that body", "Only in main", "In every function"], 1),
        ("A variable declared outside all functions is...", ["Local", "Global", "Constant", "Static only"], 1),
        ("Two functions may each declare a local variable named x.", ["True", "False", "Only if both are int", "Only in main"], 0)]),
    ("cpp-casting", "C++ Constants and Type Casting", "Variables and data types", [
        ("Which keyword makes a variable read-only?", ["static", "const", "final", "fixed"], 1),
        ("What is `(double) 7 / 2`?", ["3", "3.5", "4", "3.0"], 1),
        ("What is `(int) 9.8`?", ["10", "9", "9.8", "An error"], 1)]),
    ("cpp-vectors", "C++ Vectors", "Arrays and lists", [
        ("Which method adds an item to the end of a vector?", ["add()", "push_back()", "append()", "insert_end()"], 1),
        ("What does v.size() return?", ["The last item", "The number of items", "The capacity in bytes", "The first index"], 1),
        ("Which header provides vector?", ["<array>", "<vector>", "<list>", "<iostream>"], 1)]),
    ("cpp-comments", "C++ Comments and Program Structure", "Program structure", [
        ("Which function runs first in a C++ program?", ["start()", "main()", "run()", "init()"], 1),
        ("Which starts a single-line comment?", ["#", "//", "--", "/*"], 1),
        ("What ends most C++ statements?", ["A period", "A semicolon", "A colon", "A new line"], 1)]),
]

JAVA_QUIZZES = [
    ("java-types", "Java Variables and Data Types", "Variables and data types", [
        ("Which type stores a whole number?", ["double", "int", "String", "boolean"], 1),
        ("Which type holds text such as \"Hi\"?", ["char", "String", "text", "Text"], 1),
        ("Which type stores true or false?", ["bool", "boolean", "Bit", "int"], 1)]),
    ("java-io", "Java Input and Output", "Input and output", [
        ("Which statement prints and moves to a new line?", ["System.out.print()", "System.out.println()", "console.log()", "echo"], 1),
        ("Which class is commonly used to read keyboard input?", ["Reader", "Scanner", "Input", "Keyboard"], 1),
        ("Which Scanner method reads the next int?", ["readInt()", "nextInt()", "getInt()", "int()"], 1)]),
    ("java-arithmetic", "Java Arithmetic Operators", "Variables and arithmetic", [
        ("What is 9 / 2 when both are int?", ["4.5", "4", "5", "4.0"], 1),
        ("What is 10 % 4?", ["2", "4", "0", "2.5"], 0),
        ("What is x after `int x = 6; x *= 2;`?", ["8", "12", "6", "3"], 1)]),
    ("java-logic", "Java Relational and Logical Operators", "Logical operators", [
        ("Which operator means not equal?", ["<>", "!=", "=!", "~="], 1),
        ("What is `!(5 > 3)`?", ["true", "false", "5", "An error"], 1),
        ("Which operator means logical AND?", ["&&", "||", "and", "&="], 0)]),
    ("java-if", "Java If and Else", "Conditionals", [
        ("Which block runs when the if condition is false?", ["else", "otherwise", "default", "catch"], 0),
        ("Which method compares two Strings' contents?", ["==", "equals()", "compare()", "same()"], 1),
        ("What prints for n = 0 in `if (n > 0) print(\"+\") else if (n < 0) print(\"-\") else print(\"0\")`?", ["+", "-", "0", "Nothing"], 2)]),
    ("java-switch", "Java Switch Statements", "Conditionals", [
        ("Which keyword stops fall-through in a classic switch case?", ["break", "stop", "exit", "return only"], 0),
        ("Which label handles values that match no case?", ["else", "default", "other", "finally"], 1),
        ("Can a Java switch test a String value?", ["Yes", "No", "Only in loops", "Only constants named STRING"], 0)]),
    ("java-while", "Java While Loops", "While loops", [
        ("A while loop repeats while its condition is...", ["false", "true", "zero", "null"], 1),
        ("Which loop checks its condition after the body?", ["while", "for", "do-while", "for-each"], 2),
        ("How many times does `int i = 5; while (i < 5) i++;` run the body?", ["0", "1", "5", "Forever"], 0)]),
    ("java-for", "Java For Loops", "For loops", [
        ("What does `for (int i = 0; i < 3; i++) System.out.print(i);` print?", ["123", "012", "0123", "3"], 1),
        ("Which loop visits every element of an array without an index?", ["while", "for-each", "do-while", "switch"], 1),
        ("Which part of a for loop runs after each round?", ["Initialization", "Condition", "Update", "Body only"], 2)]),
    ("java-arrays", "Java Arrays", "Arrays and lists", [
        ("How do you read the length of array a?", ["a.length", "a.size()", "a.length()", "len(a)"], 0),
        ("What is the index of the last element in `int[] a = new int[4];`?", ["4", "3", "5", "0"], 1),
        ("What is the default value of a new int array element?", ["null", "0", "1", "Undefined"], 1)]),
    ("java-strings", "Java Strings", "Strings", [
        ("Which method returns a String's length?", ["length()", "size()", "length", "count()"], 0),
        ("What does \"code\".charAt(1) return?", ["'c'", "'o'", "'d'", "\"o\""], 1),
        ("What does \"Hi\".toUpperCase() return?", ["\"hi\"", "\"HI\"", "\"Hi\"", "\"hI\""], 1)]),
    ("java-methods", "Java Methods", "Functions", [
        ("Which return type means a method returns nothing?", ["null", "void", "none", "empty"], 1),
        ("What does `static int twice(int x) { return 2 * x; }` return for twice(5)?", ["7", "10", "25", "5"], 1),
        ("Which keyword lets main call a method without an object?", ["public", "static", "final", "new"], 1)]),
    ("java-parameters", "Java Parameters and Return Values", "Functions", [
        ("Java passes a primitive argument such as int by...", ["Reference", "Value (a copy)", "Pointer", "Name"], 1),
        ("Which statement sends a value back to the caller?", ["send", "return", "yield", "output"], 1),
        ("Two methods with the same name but different parameters are...", ["Overloaded", "Overridden", "Illegal", "Static"], 0)]),
    ("java-casting", "Java Constants and Type Casting", "Variables and data types", [
        ("Which keyword makes a variable a constant?", ["const", "final", "static", "fixed"], 1),
        ("What is `(int) 7.9`?", ["8", "7", "7.9", "An error"], 1),
        ("What is `(double) 5 / 2`?", ["2", "2.5", "3", "2.0"], 1)]),
    ("java-structure", "Java Program Structure", "Program structure", [
        ("Which method runs first in a Java program?", ["start()", "main()", "run()", "init()"], 1),
        ("Which starts a single-line comment?", ["#", "//", "--", "<!--"], 1),
        ("A public class named Main must be saved in...", ["main.txt", "Main.java", "Main.class only", "Any file"], 1)]),
    ("java-break", "Java Break and Continue", "Loops", [
        ("What does break do inside a loop?", ["Skips one round", "Leaves the loop", "Restarts it", "Pauses"], 1),
        ("What does continue do?", ["Leaves the loop", "Skips to the next round", "Ends main", "Repeats the round"], 1),
        ("In nested loops, a plain break leaves...", ["Every loop", "Only the innermost loop", "The method", "Nothing"], 1)]),
    ("java-scope", "Java Variable Scope", "Functions", [
        ("Where can a variable declared inside a for loop be used?", ["Anywhere", "Only inside that loop", "In every method", "Only in main"], 1),
        ("A local variable must be... before it is read.", ["Printed", "Assigned a value", "Made static", "Made final"], 1),
        ("Two methods may each declare a local variable named x.", ["True", "False", "Only if static", "Only in main"], 0)]),
    ("java-arraylist", "Java ArrayList Basics", "Arrays and lists", [
        ("Which method adds an item to an ArrayList?", ["push()", "add()", "append()", "insert()"], 1),
        ("Which method returns the number of items in an ArrayList?", ["length", "size()", "count()", "length()"], 1),
        ("Which method reads the item at index i?", ["get(i)", "at(i)", "[i]", "item(i)"], 0)]),
]

PY_QUIZZES = [
    ("py-dicts", "Python Dictionaries Basics", "Dictionaries", [
        ("What does {\"a\": 1}[\"a\"] return?", ["\"a\"", "1", "None", "KeyError"], 1),
        ("Which method returns a default instead of raising KeyError?", ["get()", "find()", "fetch()", "read()"], 0),
        ("How do you check if key k is in dict d?", ["k in d", "d.has(k)", "d.contains(k)", "k of d"], 0)]),
    ("py-break-continue", "Python Break and Continue", "Loops", [
        ("What does break do inside a loop?", ["Skips one round", "Leaves the loop", "Restarts it", "Pauses"], 1),
        ("What does continue do?", ["Leaves the loop", "Skips to the next round", "Ends the program", "Repeats the round"], 1),
        ("What does `for i in range(5): if i == 2: break; print(i)` print?", ["0 1", "0 1 2", "2", "0 1 3 4"], 0)]),
    ("py-types", "Python Variables and Types", "Variables and data types", [
        ("What is type(3.0)?", ["int", "float", "str", "bool"], 1),
        ("Which name is a valid variable?", ["2nd", "my-score", "my_score", "class"], 2),
        ("What does input() always return?", ["int", "str", "float", "None"], 1)]),
    ("py-arithmetic", "Python Arithmetic Operators", "Variables and arithmetic", [
        ("What is 7 // 2?", ["3.5", "3", "4", "1"], 1),
        ("What is 7 % 2?", ["1", "3", "0", "3.5"], 0),
        ("What is 2 ** 3?", ["6", "8", "9", "5"], 1)]),
    ("py-logic", "Python Comparison and Logical Operators", "Logical operators", [
        ("What is `3 > 2 and 2 > 5`?", ["True", "False", "None", "An error"], 1),
        ("Which keyword negates a condition?", ["!", "not", "no", "~"], 1),
        ("What is `5 != 5`?", ["True", "False", "0", "None"], 1)]),
    ("py-if", "Python If, Elif and Else", "Conditionals", [
        ("Which keyword checks another condition after if?", ["else if", "elif", "elseif", "then"], 1),
        ("What marks the body of an if statement?", ["Braces", "Indentation", "Semicolons", "end"], 1),
        ("For x = 0, what does `print(\"pos\" if x > 0 else \"not pos\")` print?", ["pos", "not pos", "0", "Nothing"], 1)]),
    ("py-while", "Python While Loops", "While loops", [
        ("A while loop repeats while its condition is...", ["False", "True", "None", "0"], 1),
        ("How many times does `i = 0\\nwhile i < 3: i += 1` run its body?", ["2", "3", "4", "0"], 1),
        ("What usually causes an infinite while loop?", ["A break", "A condition that never becomes False", "range()", "print()"], 1)]),
    ("py-for-range", "Python For Loops and range()", "For loops", [
        ("What does range(3) produce?", ["1, 2, 3", "0, 1, 2", "0, 1, 2, 3", "3"], 1),
        ("What does range(2, 10, 3) produce?", ["2, 5, 8", "2, 3, 4", "3, 6, 9", "2, 5, 8, 11"], 0),
        ("A for loop over \"abc\" visits...", ["Each character", "Only \"abc\"", "Indexes only", "Nothing"], 0)]),
    ("py-lists", "Python Lists", "Arrays and lists", [
        ("What is len([1, 2, 3])?", ["2", "3", "4", "6"], 1),
        ("What is [10, 20, 30][-1]?", ["10", "20", "30", "IndexError"], 2),
        ("Which method removes and returns the last item?", ["pop()", "remove()", "del()", "cut()"], 0)]),
    ("py-strings", "Python String Methods", "Strings", [
        ("What does \"hi\".upper() return?", ["\"hi\"", "\"HI\"", "\"Hi\"", "None"], 1),
        ("What does \"a,b\".split(\",\") return?", ["\"ab\"", "[\"a\", \"b\"]", "(\"a\", \"b\")", "[\"a,b\"]"], 1),
        ("What does \"  x \".strip() return?", ["\"x\"", "\"  x\"", "\"x \"", "\" x \""], 0)]),
    ("py-functions", "Python Functions", "Functions", [
        ("Which keyword defines a function?", ["func", "def", "function", "fn"], 1),
        ("What does a function return without a return statement?", ["0", "None", "\"\"", "An error"], 1),
        ("For `def add(a, b=2): return a + b`, what is add(3)?", ["3", "5", "6", "An error"], 1)]),
]

QUIZZES = {CPP: CPP_QUIZZES, JAVA: JAVA_QUIZZES, PY: PY_QUIZZES}
CODE = {PY: 6, CPP: 7, JAVA: 8}  # field index of each language's solution in a CHALLENGES row


def _id(lang, key):
    return uuid.uuid5(uuid.NAMESPACE_URL, f"bytequest:local-fundamentals:{lang.value}:{key}:v1")


def quiz_json(questions):
    return {"questions": [{"id": f"q{i + 1}", "prompt": prompt,
                           "options": [{"key": k, "text": t} for k, t in zip("ABCD", options)],
                           "correct_answer": "ABCD"[answer]}
                          for i, (prompt, options, answer) in enumerate(questions)]}


def publish(db, activity, owner):
    if activity.review_status == ReviewState.draft:
        if activity.activity_type == ActivityKind.challenge and not challenge_is_verified(activity):
            checked = asyncio.run(verify_saved_challenge(db, activity))
            db.commit()
            if checked is None or not checked.judge0_verified:
                raise SystemExit(f"Judge0 could not verify {activity.language.value} '{activity.title}'; left as a draft.")
            activity = checked
        activity.reviewed_by = owner.id
        apply_publish_rules(db, activity, owner)
        db.commit()
    return activity


def new_challenge(db, lang, row, owner):
    key, title, topic, difficulty, statement, cases, *_ = row
    activity = db.get(LearningActivity, _id(lang, key))
    if activity is None:
        sample_in, sample_out = cases[0]
        activity = LearningActivity(
            id=_id(lang, key), created_by=owner.id, activity_type=ActivityKind.challenge, language=lang,
            topic_concept=topic, title=title, difficulty_level=difficulty, sequence_order=1, xp_reward=50,
            problem_statement=f"{statement}\n\nExample input:\n{sample_in}\nExample output:\n{sample_out}",
            starter_code=STARTER[lang], reference_solution_code=row[CODE[lang]] if lang == PY else
            (cpp if lang == CPP else java)(row[CODE[lang]]), review_status=ReviewState.draft,
            test_cases=[TestCase(order_index=i, stdin=f"{stdin}\n", expected_stdout=f"{out}\n", is_hidden=i >= 2)
                        for i, (stdin, out) in enumerate(cases)])
        db.add(activity)
        db.commit()
    return publish(db, activity, owner)


def new_quiz(db, lang, row, owner):
    key, title, topic, questions = row
    activity = db.get(LearningActivity, _id(lang, key))
    if activity is None:
        body = quiz_json(questions)
        parse_quiz_questions(body)
        activity = LearningActivity(
            id=_id(lang, key), created_by=owner.id, activity_type=ActivityKind.quiz, language=lang,
            topic_concept=topic, title=title, difficulty_level=1, sequence_order=1, xp_reward=30,
            problem_statement=f"Answer {len(questions)} {LABEL[lang]} fundamentals questions about {topic.lower()}.",
            quiz_questions_json=body, review_status=ReviewState.draft)
        db.add(activity)
        db.commit()
    return publish(db, activity, owner)


# Real content for the empty "Synthetic …" shells the ML scenario created (topic -> challenge / quiz).
# Challenge rows: (statement, cases, python solution, java body).
SYNTHETIC_CHALLENGES = {
    "variables": ("Swap Two Numbers: read two integers a and b on one line and print them in swapped order, separated by a space.",
                  [("3 8", "8 3"), ("-1 5", "5 -1"), ("0 0", "0 0"), ("1000 -1000", "-1000 1000")],
                  "a, b = map(int, input().split())\na, b = b, a\nprint(a, b)\n",
                  "        int a = in.nextInt(), b = in.nextInt();\n        int t = a; a = b; b = t;\n        System.out.println(a + \" \" + b);"),
    "conditionals": ("Triangle Type: read three positive side lengths. Print Equilateral if all are equal, Isosceles if exactly two are equal, otherwise Scalene.",
                     [("3 3 3", "Equilateral"), ("3 4 5", "Scalene"), ("5 5 8", "Isosceles"), ("2 7 7", "Isosceles"), ("6 1 6", "Isosceles")],
                     "a, b, c = map(int, input().split())\nif a == b == c:\n    print(\"Equilateral\")\nelif a == b or b == c or a == c:\n    print(\"Isosceles\")\nelse:\n    print(\"Scalene\")\n",
                     "        int a = in.nextInt(), b = in.nextInt(), c = in.nextInt();\n        if (a == b && b == c) System.out.println(\"Equilateral\");\n        else if (a == b || b == c || a == c) System.out.println(\"Isosceles\");\n        else System.out.println(\"Scalene\");"),
    "loops": ("Countdown: read n (1 to 50). Print n, n-1, ..., 1 on separate lines, then Go!",
              [(str(n), lines([*range(n, 0, -1), "Go!"])) for n in (3, 1, 10)],
              "n = int(input())\nfor i in range(n, 0, -1):\n    print(i)\nprint(\"Go!\")\n",
              "        int n = in.nextInt();\n        for (int i = n; i >= 1; i--) System.out.println(i);\n        System.out.println(\"Go!\");"),
    "nested loops": ("Number Square: read n (1 to 9). Print n lines, each containing the numbers 1 to n separated by single spaces.",
                     [(str(n), lines(" ".join(map(str, range(1, n + 1))) for _ in range(n))) for n in (3, 1, 9)],
                     "n = int(input())\nfor _ in range(n):\n    print(\" \".join(str(i) for i in range(1, n + 1)))\n",
                     "        int n = in.nextInt();\n        for (int r = 0; r < n; r++) {\n            StringBuilder row = new StringBuilder();\n            for (int i = 1; i <= n; i++) row.append(i == 1 ? \"\" : \" \").append(i);\n            System.out.println(row);\n        }"),
    "lists": ("Count Above a Threshold: read n (1 to 100), then n integers on one line, then a threshold t. Print how many values are greater than t.",
              [("5\n1 7 3 9 4\n4", "2"), ("3\n1 2 3\n5", "0"), ("4\n-1 -2 0 5\n-2", "3")],
              "n = int(input())\nvalues = list(map(int, input().split()))\nt = int(input())\nprint(sum(1 for v in values if v > t))\n",
              "        int n = in.nextInt();\n        int[] a = new int[n];\n        for (int i = 0; i < n; i++) a[i] = in.nextInt();\n        int t = in.nextInt(), count = 0;\n        for (int x : a) if (x > t) count++;\n        System.out.println(count);"),
    "searching": ("Position of the Minimum: read n (1 to 100), then n integers. Print the 0-based index of the first smallest value.",
                  [("5\n4 2 8 2 9", "1"), ("1\n7", "0"), ("4\n5 4 3 -1", "3")],
                  "n = int(input())\nvalues = list(map(int, input().split()))\nprint(values.index(min(values)))\n",
                  "        int n = in.nextInt();\n        int best = 0;\n        int[] a = new int[n];\n        for (int i = 0; i < n; i++) { a[i] = in.nextInt(); if (a[i] < a[best]) best = i; }\n        System.out.println(best);"),
    "sorting": ("Sort Descending: read n (1 to 100), then n integers. Print them from largest to smallest, separated by single spaces.",
                [("4\n3 9 1 5", "9 5 3 1"), ("1\n4", "4"), ("5\n2 -2 2 0 7", "7 2 2 0 -2")],
                "n = int(input())\nprint(\" \".join(map(str, sorted(map(int, input().split()), reverse=True))))\n",
                "        int n = in.nextInt();\n        int[] a = new int[n];\n        for (int i = 0; i < n; i++) a[i] = in.nextInt();\n        Arrays.sort(a);\n        StringJoiner out = new StringJoiner(\" \");\n        for (int i = n - 1; i >= 0; i--) out.add(String.valueOf(a[i]));\n        System.out.println(out);"),
    "strings": ("Count Words: read one line of words separated by single spaces. Print how many words it contains.",
                [("the quick brown fox", "4"), ("hello", "1"), ("a b c d e f", "6")],
                "print(len(input().split()))\n",
                "        System.out.println(in.nextLine().trim().split(\" \").length);"),
    "recursion": ("Power of Two with Recursion: read n (0 to 30). Print 2 to the power n, computed with a recursive function.",
                  [("3", "8"), ("0", "1"), ("10", "1024"), ("30", "1073741824")],
                  "def power(n):\n    return 1 if n == 0 else 2 * power(n - 1)\n\nprint(power(int(input())))\n",
                  "        System.out.println(power(in.nextInt()));\n    }\n\n    static int power(int n) {\n        return n == 0 ? 1 : 2 * power(n - 1);"),
    "functions": ("Celsius to Fahrenheit: read a Celsius temperature c that is a multiple of 5 (-100 to 100). Write a function that converts it and print the whole-number Fahrenheit value (F = C x 9 / 5 + 32).",
                  [("100", "212"), ("0", "32"), ("-40", "-40"), ("35", "95")],
                  "def to_fahrenheit(c):\n    return c * 9 // 5 + 32\n\nprint(to_fahrenheit(int(input())))\n",
                  "        System.out.println(toFahrenheit(in.nextInt()));\n    }\n\n    static int toFahrenheit(int c) {\n        return c * 9 / 5 + 32;"),
}
SYNTHETIC_QUIZZES = {
    "diagnostic": [
        ("What does a variable do?", ["Repeats code", "Stores a value", "Prints text", "Ends a program"], 1),
        ("Which structure runs code only when a condition is true?", ["A loop", "An if statement", "A list", "A comment"], 1),
        ("Which structure repeats a block of code?", ["A loop", "A variable", "A string", "A constant"], 0)],
    "lists": [
        ("At what index does the first element of a list or array sit?", ["1", "0", "-1", "It varies"], 1),
        ("A list of 5 items has its last item at index...", ["5", "4", "6", "0"], 1),
        ("What usually happens when you read an index equal to the length?", ["You get the last item", "An index error", "You get 0", "The list grows"], 1)],
    "loops": [
        ("How many times does a loop from 1 to 5 inclusive run?", ["4", "5", "6", "1"], 1),
        ("What usually causes an infinite loop?", ["A condition that never becomes false", "A break statement", "Using a counter", "Printing inside it"], 0),
        ("Which loop suits a known number of repetitions?", ["for", "while with no counter", "if", "switch"], 0)],
    "searching": [
        ("Linear search checks items...", ["Only the middle", "One by one", "Only the last", "Randomly"], 1),
        ("What must be true before binary search works?", ["The data is sorted", "The data has no zeros", "The list is short", "Nothing"], 0),
        ("In the worst case, linear search over n items makes about how many comparisons?", ["1", "log n", "n", "n squared"], 2)],
}


def fill_synthetic(db, owner):
    """Give the ML scenario's empty activities real content and let the instructor teach their courses."""
    shells = db.query(LearningActivity).filter(LearningActivity.title.like("Synthetic %"),
                                               LearningActivity.review_status == ReviewState.published).all()
    for course_id in {a.course_id for a in shells if a.course_id}:
        if not db.query(CourseMember).filter_by(course_id=course_id, profile_id=owner.id, member_role="instructor").first():
            db.add(CourseMember(course_id=course_id, profile_id=owner.id, member_role="instructor",
                                status="active", assigned_by=owner.id))
    for activity in shells:
        topic = activity.title.split(": ", 1)[1]
        activity.created_by, activity.reviewed_by = owner.id, owner.id
        if activity.activity_type == ActivityKind.quiz and not (activity.quiz_questions_json or {}).get("questions"):
            questions = SYNTHETIC_QUIZZES[topic]
            activity.quiz_questions_json = quiz_json(questions)
            activity.problem_statement = f"Answer {len(questions)} fundamentals questions about {topic}."
        elif activity.activity_type == ActivityKind.challenge and not activity.test_cases:
            statement, cases, py_code, java_body = SYNTHETIC_CHALLENGES[topic]
            sample_in, sample_out = cases[0]
            activity.problem_statement = f"{statement}\n\nExample input:\n{sample_in}\nExample output:\n{sample_out}"
            activity.starter_code = STARTER[activity.language]
            activity.reference_solution_code = py_code if activity.language == PY else java(java_body)
            activity.test_cases = [TestCase(order_index=i, stdin=f"{a}\n", expected_stdout=f"{b}\n", is_hidden=i >= 2)
                                   for i, (a, b) in enumerate(cases)]
            activity.judge0_verified = False
        if activity.activity_type == ActivityKind.challenge and not activity.judge0_verified:
            activity.review_status = ReviewState.draft  # Judge0 verification and publishing only run on drafts
    db.commit()
    for activity in shells:
        publish(db, activity, owner)


def link(db, workshop, owner, activity_id):
    if not db.query(WorkshopActivity).filter_by(workshop_id=workshop.id, activity_id=activity_id).first():
        add_workshop_activities(workshop.id, AddWorkshopActivities(activity_ids=[activity_id]), owner, db)


def counts(db, workshop):
    rows = (db.query(LearningActivity.activity_type).join(WorkshopActivity, WorkshopActivity.activity_id == LearningActivity.id)
            .filter(WorkshopActivity.workshop_id == workshop.id, LearningActivity.review_status == ReviewState.published).all())
    return (sum(r[0] == ActivityKind.challenge for r in rows), sum(r[0] == ActivityKind.quiz for r in rows))


def main() -> None:
    db = SessionLocal()
    try:
        owner_id = db.execute(text("select id from auth.users where email = :e"), {"e": INSTRUCTOR}).scalar_one()
        owner = db.get(Profile, owner_id)
        fill_synthetic(db, owner)
        for lang in (PY, CPP, JAVA):
            workshop = (db.query(Workshop).filter(Workshop.created_by == owner.id, Workshop.language == lang,
                                                  Workshop.archived_at.is_(None)).order_by(Workshop.created_at).first())
            if workshop is None:
                raise SystemExit(f"{INSTRUCTOR} has no active {LABEL[lang]} Workshop.")
            # 1. Every shareable published activity in this language is released through this Workshop,
            #    authored by the instructor, so nothing is left as unexplained track practice.
            existing = (db.query(LearningActivity).filter(
                LearningActivity.language == lang, LearningActivity.review_status == ReviewState.published,
                LearningActivity.archived_at.is_(None), LearningActivity.exam_only.is_(False),
                LearningActivity.destination_workshop_id.is_(None)).order_by(LearningActivity.published_at).all())
            shareable = {row[0] for row in db.query(LearningActivity.id).filter(
                LearningActivity.id.in_([a.id for a in existing]), workshop_shareable_activity_clause(owner.id))}
            for skipped in [a for a in existing if a.id not in shareable]:
                print(f"Skipped (course not shareable by {INSTRUCTOR}): {skipped.title}")
            existing = [a for a in existing if a.id in shareable]
            for activity in existing:
                activity.created_by = owner.id
                activity.reviewed_by = activity.reviewed_by or owner.id
            db.commit()
            for activity in existing:
                link(db, workshop, owner, activity.id)
            # 2. Top up with fundamentals until the Workshop meets the targets.
            have = {a.title for a in existing}
            challenges, quizzes = counts(db, workshop)
            for row in CHALLENGES:
                if challenges >= TARGET_CHALLENGES:
                    break
                if row[1] not in have:
                    link(db, workshop, owner, new_challenge(db, lang, row, owner).id)
                    challenges += 1
            for row in QUIZZES[lang]:
                if quizzes >= TARGET_QUIZZES:
                    break
                if row[1] not in have:
                    link(db, workshop, owner, new_quiz(db, lang, row, owner).id)
                    quizzes += 1
            challenges, quizzes = counts(db, workshop)
            print(f"{workshop.name}: {challenges} coding challenges, {quizzes} concept check quizzes")
            if challenges < TARGET_CHALLENGES or quizzes < TARGET_QUIZZES:
                raise SystemExit(f"{LABEL[lang]} is below target; add more items to the bank.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
