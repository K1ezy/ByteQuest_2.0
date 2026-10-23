import asyncio
import base64
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.core.config import get_settings
from app.models.entities import ProgrammingLang

logger = logging.getLogger(__name__)
settings = get_settings()

# ============================================================================
# Judge0 CE v1.13.1 Official Language ID Mapping
# ============================================================================
JUDGE0_LANGUAGE_IDS: Dict[ProgrammingLang, int] = {
    ProgrammingLang.cpp: 54,     # C++ (GCC 9.2.0)
    ProgrammingLang.python: 71,  # Python (3.8.1)
    ProgrammingLang.java: 62,    # Java (OpenJDK 13.0.1)
}


# ============================================================================
# Custom Exceptions & Circuit Breaker (Rule 7)
# ============================================================================
class Judge0UnavailableError(Exception):
    """Raised when Judge0 times out or returns a 5xx server error."""


class Judge0CircuitOpenError(Exception):
    """Raised immediately when the Judge0 Circuit Breaker is in the OPEN state."""


@dataclass
class CircuitBreaker:
    failure_threshold: int = 3
    recovery_timeout_seconds: float = 30.0
    failure_count: int = 0
    last_failure_time: Optional[float] = None
    state: str = "CLOSED"  # CLOSED, OPEN, HALF_OPEN

    def before_request(self) -> None:
        if self.state == "OPEN":
            elapsed = time.monotonic() - (self.last_failure_time or 0.0)
            if elapsed >= self.recovery_timeout_seconds:
                logger.info("Judge0 Circuit Breaker entering HALF_OPEN state.")
                self.state = "HALF_OPEN"
            else:
                remaining = int(self.recovery_timeout_seconds - elapsed)
                raise Judge0CircuitOpenError(
                    f"Code execution sandbox is temporarily busy. Please retry in {remaining} seconds."
                )

    def record_success(self) -> None:
        if self.state != "CLOSED":
            logger.info("Judge0 Circuit Breaker reset to CLOSED state.")
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "CLOSED"

    def record_failure(self) -> None:
        self.failure_count += 1
        self.last_failure_time = time.monotonic()
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
            logger.error(
                f"Judge0 Circuit Breaker tripped to OPEN after {self.failure_count} failures."
            )


# Singleton circuit breaker instance across FastAPI worker requests
judge0_circuit_breaker = CircuitBreaker()


# ============================================================================
# Data Structures for Test Case Execution & Results
# ============================================================================
@dataclass
class TestCaseInput:
    test_case_id: str
    order_index: int
    stdin: str
    expected_stdout: str
    time_limit_ms: int = 2000
    memory_limit_kb: int = 256000
    is_hidden: bool = False
    weight: float = 1.0


@dataclass
class SingleTestResult:
    test_case_id: str
    order_index: int
    passed: bool
    status_id: int
    status_description: str
    error_category: str
    stdout: str
    stderr: str
    compile_output: str
    execution_time_ms: float
    memory_used_kb: float
    is_hidden: bool


@dataclass
class BatchEvaluationSummary:
    passed_test_cases: int
    total_test_cases: int
    score_percentage: float
    is_successful: bool
    avg_execution_time_ms: float
    max_memory_used_kb: float
    dominant_status_id: int
    dominant_error_category: str
    test_results: List[SingleTestResult] = field(default_factory=list)


# ============================================================================
# Base64 & Status Classification Helpers
# ============================================================================
def _b64_encode(text: Optional[str]) -> Optional[str]:
    if text is None:
        return None
    return base64.b64encode(text.encode("utf-8")).decode("ascii")


def _b64_decode(encoded: Optional[str]) -> str:
    if not encoded:
        return ""
    try:
        return base64.b64decode(encoded).decode("utf-8", errors="replace").strip()
    except Exception:
        return ""


def classify_judge0_status(status_id: int) -> str:
    """
    Maps Judge0 status IDs directly to the ML feature pipeline's error_category:
      3  -> 'none' (Accepted)
      4  -> 'logic_error' (Wrong Answer)
      5  -> 'timeout' (Time Limit Exceeded)
      6  -> 'syntax_error' (Compilation Error)
      7+ -> 'runtime_error' (SIGSEGV, SIGFPE, NZEC, etc.)
    """
    if status_id == 3:
        return "none"
    elif status_id == 4:
        return "logic_error"
    elif status_id == 5:
        return "timeout"
    elif status_id == 6:
        return "syntax_error"
    else:
        return "runtime_error"


# ============================================================================
# Judge0 Client Service
# ============================================================================
class Judge0Client:
    def __init__(self, base_url: Optional[str] = None, timeout: Optional[int] = None):
        self.base_url = (base_url or settings.JUDGE0_BASE_URL).rstrip("/")
        self.timeout = timeout or settings.JUDGE0_TIMEOUT_SECONDS

    @retry(
        retry=retry_if_exception_type(Judge0UnavailableError),
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=2.0),
        reraise=True,
    )
    async def _submit_batch_tokens(self, submissions_payload: List[Dict[str, Any]]) -> List[str]:
        """Submits a batch of test cases to Judge0 and returns their tracking tokens."""
        url = f"{self.base_url}/submissions/batch?base64_encoded=true"
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json={"submissions": submissions_payload})
                if response.status_code >= 500:
                    raise Judge0UnavailableError(f"Judge0 server error: HTTP {response.status_code}")
                response.raise_for_status()
                data = response.json()
                return [item["token"] for item in data if "token" in item]
        except (httpx.RequestError, httpx.TimeoutException) as exc:
            raise Judge0UnavailableError(f"Failed to connect to Judge0 at {self.base_url}: {exc}") from exc

    async def _poll_batch_results(
        self, tokens: List[str], max_polls: int = 20, poll_interval: float = 0.6
    ) -> List[Dict[str, Any]]:
        """Polls Judge0 until all batch tokens finish processing (status_id >= 3)."""
        token_csv = ",".join(tokens)
        fields = "token,stdout,stderr,status_id,status,compile_output,time,memory"
        url = f"{self.base_url}/submissions/batch?tokens={token_csv}&base64_encoded=true&fields={fields}"

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for _ in range(max_polls):
                try:
                    resp = await client.get(url)
                    if resp.status_code >= 500:
                        raise Judge0UnavailableError(f"Judge0 poll error: HTTP {resp.status_code}")
                    resp.raise_for_status()
                    submissions = resp.json().get("submissions", [])

                    # Status IDs 1 (In Queue) and 2 (Processing) mean still running
                    if all(sub.get("status", {}).get("id", 1) >= 3 for sub in submissions):
                        return submissions
                except (httpx.RequestError, httpx.TimeoutException) as exc:
                    raise Judge0UnavailableError(f"Judge0 polling interrupted: {exc}") from exc

                await asyncio.sleep(poll_interval)

        raise Judge0UnavailableError("Judge0 batch execution timed out waiting for worker queue.")

    async def evaluate_submission(
        self,
        language: ProgrammingLang,
        source_code: str,
        test_cases: List[TestCaseInput],
    ) -> BatchEvaluationSummary:
        """
        Executes student or reference source code against a list of test cases in Judge0.
        Protected by the Circuit Breaker (Rule 7).
        """
        if not test_cases:
            raise ValueError("At least one test case is required for evaluation.")

        # 1. Check Circuit Breaker state before making network calls
        judge0_circuit_breaker.before_request()

        language_id = JUDGE0_LANGUAGE_IDS[language]
        encoded_source = _b64_encode(source_code)

        submissions_payload = []
        for tc in test_cases:
            # Convert milliseconds to seconds for Judge0 (bounded between 0.5s and 15.0s)
            cpu_limit_sec = max(0.5, min(15.0, round(tc.time_limit_ms / 1000.0, 2)))
            # Ensure Java has at least 256MB memory ceiling so JVM startup succeeds
            mem_limit_kb = max(tc.memory_limit_kb, 256000) if language == ProgrammingLang.java else tc.memory_limit_kb

            submissions_payload.append(
                {
                    "language_id": language_id,
                    "source_code": encoded_source,
                    "stdin": _b64_encode(tc.stdin),
                    "expected_output": _b64_encode(tc.expected_stdout.strip()),
                    "cpu_time_limit": cpu_limit_sec,
                    "memory_limit": mem_limit_kb,
                }
            )

        try:
            tokens = await self._submit_batch_tokens(submissions_payload)
            raw_results = await self._poll_batch_results(tokens)
            judge0_circuit_breaker.record_success()
        except Exception as exc:
            judge0_circuit_breaker.record_failure()
            raise exc

        # 2. Parse and aggregate metrics across all test cases
        detailed_results: List[SingleTestResult] = []
        passed_count = 0
        total_weight = 0.0
        earned_weight = 0.0
        exec_times: List[float] = []
        memories: List[float] = []
        first_failure_status_id: Optional[int] = None

        for tc, raw in zip(test_cases, raw_results):
            status_obj = raw.get("status", {})
            status_id = int(status_obj.get("id", 13))
            status_desc = status_obj.get("description", "Unknown")
            error_cat = classify_judge0_status(status_id)

            passed = status_id == 3
            if passed:
                passed_count += 1
                earned_weight += tc.weight
            elif first_failure_status_id is None:
                first_failure_status_id = status_id

            total_weight += tc.weight

            # Judge0 returns 'time' in seconds (str) and 'memory' in KB (int/float)
            time_sec = float(raw.get("time") or 0.0)
            time_ms = round(time_sec * 1000.0, 3)
            mem_kb = float(raw.get("memory") or 0.0)

            exec_times.append(time_ms)
            memories.append(mem_kb)

            detailed_results.append(
                SingleTestResult(
                    test_case_id=tc.test_case_id,
                    order_index=tc.order_index,
                    passed=passed,
                    status_id=status_id,
                    status_description=status_desc,
                    error_category=error_cat,
                    stdout="" if tc.is_hidden else _b64_decode(raw.get("stdout")),
                    stderr="" if tc.is_hidden else _b64_decode(raw.get("stderr")),
                    compile_output=_b64_decode(raw.get("compile_output")),
                    execution_time_ms=time_ms,
                    memory_used_kb=mem_kb,
                    is_hidden=tc.is_hidden,
                )
            )

        total_cases = len(test_cases)
        score_pct = round((earned_weight / total_weight) * 100.0, 2) if total_weight > 0 else 0.0
        is_all_passed = passed_count == total_cases

        dominant_status = 3 if is_all_passed else (first_failure_status_id or 13)
        dominant_error = classify_judge0_status(dominant_status)

        return BatchEvaluationSummary(
            passed_test_cases=passed_count,
            total_test_cases=total_cases,
            score_percentage=score_pct,
            is_successful=is_all_passed,
            avg_execution_time_ms=round(sum(exec_times) / len(exec_times), 3) if exec_times else 0.0,
            max_memory_used_kb=round(max(memories), 2) if memories else 0.0,
            dominant_status_id=dominant_status,
            dominant_error_category=dominant_error,
            test_results=detailed_results,
        )

    async def verify_reference_solution(
        self,
        language: ProgrammingLang,
        reference_solution_code: str,
        test_cases: List[TestCaseInput],
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Rule 6: Pre-validates an AI-generated programming challenge by running its
        reference_solution_code against its generated test_cases in Judge0.
        Returns (judge0_verified: bool, judge0_verification_log: dict).
        """
        # Unhide outputs during internal verification so the instructor can see exact errors if it fails
        verification_inputs = [
            TestCaseInput(
                test_case_id=tc.test_case_id,
                order_index=tc.order_index,
                stdin=tc.stdin,
                expected_stdout=tc.expected_stdout,
                time_limit_ms=tc.time_limit_ms,
                memory_limit_kb=tc.memory_limit_kb,
                is_hidden=False,
                weight=tc.weight,
            )
            for tc in test_cases
        ]

        summary = await self.evaluate_submission(
            language=language,
            source_code=reference_solution_code,
            test_cases=verification_inputs,
        )

        verification_log = {
            "verified": summary.is_successful,
            "passed_test_cases": summary.passed_test_cases,
            "total_test_cases": summary.total_test_cases,
            "avg_execution_time_ms": summary.avg_execution_time_ms,
            "max_memory_used_kb": summary.max_memory_used_kb,
            "dominant_error_category": summary.dominant_error_category,
            "case_details": [
                {
                    "order_index": r.order_index,
                    "passed": r.passed,
                    "status": r.status_description,
                    "stdout": r.stdout[:500],
                    "stderr": r.stderr[:500],
                    "compile_output": r.compile_output[:500],
                }
                for r in summary.test_results
            ],
        }

        return summary.is_successful, verification_log
