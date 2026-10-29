import asyncio
import base64
import logging
import math
import time
from dataclasses import dataclass, field
from threading import Lock
from typing import Any, Dict, List, Optional, Tuple
from contextlib import asynccontextmanager

import httpx

from app.core.config import get_settings
from app.models.entities import ProgrammingLang

logger = logging.getLogger(__name__)
settings = get_settings()

# ============================================================================
# Resolve runtimes by name instead of fixed IDs: CE and Extra CE expose
# different language IDs, and those IDs can vary between Judge0 releases.
# ============================================================================
JUDGE0_LANGUAGE_PREFIXES: Dict[ProgrammingLang, Tuple[str, ...]] = {
    ProgrammingLang.cpp: ("c++",),
    ProgrammingLang.python: ("python",),
    ProgrammingLang.java: ("java",),
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
    half_open_probe_active: bool = False
    _lock: Lock = field(default_factory=Lock, repr=False, compare=False)

    def before_request(self) -> None:
        with self._lock:
            if self.state == "OPEN":
                elapsed = time.monotonic() - (self.last_failure_time or 0.0)
                if elapsed < self.recovery_timeout_seconds:
                    remaining = max(1, int(self.recovery_timeout_seconds - elapsed))
                    raise Judge0CircuitOpenError(
                        f"Code execution sandbox is temporarily busy. Please retry in {remaining} seconds."
                    )
                logger.info("Judge0 Circuit Breaker entering HALF_OPEN state.")
                self.state = "HALF_OPEN"

            if self.state == "HALF_OPEN":
                if self.half_open_probe_active:
                    raise Judge0CircuitOpenError(
                        "Code execution sandbox is recovering. Please retry shortly."
                    )
                self.half_open_probe_active = True

    def record_success(self) -> None:
        with self._lock:
            if self.state != "CLOSED":
                logger.info("Judge0 Circuit Breaker reset to CLOSED state.")
            self.failure_count = 0
            self.last_failure_time = None
            self.half_open_probe_active = False
            self.state = "CLOSED"

    def record_failure(self) -> None:
        with self._lock:
            self.failure_count += 1
            self.last_failure_time = time.monotonic()
            self.half_open_probe_active = False
            if self.failure_count >= self.failure_threshold:
                self.state = "OPEN"
                logger.error(
                    "Judge0 Circuit Breaker tripped to OPEN after %s failures.",
                    self.failure_count,
                )

    def record_neutral(self) -> None:
        """Release a half-open probe after a non-service/internal error."""
        with self._lock:
            self.half_open_probe_active = False


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
    stdin: str = ""
    expected_stdout: str = ""


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


def _parse_completed_result(raw: Any) -> Tuple[int, str, float, float]:
    """Validate the fields used for grading and metrics in a completed Judge0 result."""
    if not isinstance(raw, dict):
        raise Judge0UnavailableError("Judge0 returned an invalid result item.")

    status = raw.get("status")
    status_id = status.get("id") if isinstance(status, dict) else None
    if isinstance(status_id, bool) or not isinstance(status_id, int) or status_id < 3:
        raise Judge0UnavailableError("Judge0 returned an invalid completed status.")

    description = status.get("description")
    if not isinstance(description, str) or not description.strip():
        description = "Unknown"

    def metric(name: str) -> float:
        value = raw.get(name)
        if value is None or value == "":
            return 0.0
        if isinstance(value, bool):
            raise Judge0UnavailableError(f"Judge0 returned an invalid {name} metric.")
        try:
            number = float(value)
        except (TypeError, ValueError, OverflowError) as exc:
            raise Judge0UnavailableError(f"Judge0 returned an invalid {name} metric.") from exc
        if not math.isfinite(number) or number < 0:
            raise Judge0UnavailableError(f"Judge0 returned an invalid {name} metric.")
        return number

    time_seconds = metric("time")
    # Judge0 execution is limited to seconds, so a value this large indicates a
    # corrupt response and would overflow when converted to milliseconds.
    if time_seconds > 86_400:
        raise Judge0UnavailableError("Judge0 returned an out-of-range time metric.")

    return status_id, description, time_seconds, metric("memory")


# ============================================================================
# Judge0 Client Service
# ============================================================================
class Judge0Client:
    def __init__(self, base_url: Optional[str] = None, timeout: Optional[int] = None):
        self.base_url = (base_url or settings.JUDGE0_BASE_URL).rstrip("/")
        self.timeout = timeout if timeout is not None else settings.JUDGE0_TIMEOUT_SECONDS
        api_key = settings.JUDGE0_API_KEY.strip()
        self.headers = {"X-Auth-Token": api_key} if api_key else {}
        self._language_ids: Optional[Dict[ProgrammingLang, int]] = None
        self._language_ids_lock = asyncio.Lock()
        self._http_client: Optional[httpx.AsyncClient] = None

    def set_http_client(self, client: Optional[httpx.AsyncClient]) -> None:
        """Use the application-lifespan client so requests reuse keep-alive connections."""
        self._http_client = client

    @asynccontextmanager
    async def _client(self):
        client = self._http_client
        if client is not None and not client.is_closed:
            yield client
            return

        # Keep direct service use (for CLI jobs and isolated callers) functional;
        # normal FastAPI requests use the pooled lifespan client above.
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(float(self.timeout), connect=min(3.0, float(self.timeout))),
            headers=self.headers,
        ) as temporary_client:
            yield temporary_client

    @staticmethod
    def _request_timeout(deadline: Optional[float] = None, default_timeout: float = 15.0) -> httpx.Timeout:
        remaining = default_timeout if deadline is None else deadline - time.monotonic()
        if remaining <= 0:
            raise Judge0UnavailableError("Judge0 execution exceeded its time limit.")
        bounded = min(default_timeout, remaining)
        return httpx.Timeout(bounded, connect=min(3.0, bounded))

    async def _get_language_ids(self, deadline: Optional[float] = None) -> Dict[ProgrammingLang, int]:
        """Fetch and cache compatible language IDs for this Judge0 instance."""
        if self._language_ids is not None:
            return self._language_ids

        async with self._language_ids_lock:
            if self._language_ids is not None:
                return self._language_ids
            return await self._load_language_ids(deadline)

    async def _load_language_ids(self, deadline: Optional[float] = None) -> Dict[ProgrammingLang, int]:
        """Load language IDs while the caller holds the cache lock."""
        try:
            async with self._client() as client:
                response = await client.get(
                    f"{self.base_url}/languages",
                    headers=self.headers,
                    timeout=self._request_timeout(deadline, float(self.timeout)),
                )
                if response.status_code >= 500:
                    raise Judge0UnavailableError(
                        f"Judge0 language lookup failed: HTTP {response.status_code}"
                    )
                response.raise_for_status()
                languages = response.json()
        except httpx.RequestError as exc:
            raise Judge0UnavailableError(
                f"Failed to load languages from Judge0 at {self.base_url}: {exc}"
            ) from exc
        except httpx.HTTPStatusError as exc:
            raise Judge0UnavailableError(
                f"Judge0 language lookup failed: HTTP {exc.response.status_code}"
            ) from exc
        except ValueError as exc:
            raise Judge0UnavailableError("Judge0 returned invalid language data.") from exc

        if not isinstance(languages, list):
            raise Judge0UnavailableError("Judge0 returned an invalid language list.")

        resolved: Dict[ProgrammingLang, int] = {}
        for language, prefixes in JUDGE0_LANGUAGE_PREFIXES.items():
            for entry in languages:
                if not isinstance(entry, dict):
                    continue
                name = str(entry.get("name", "")).strip().casefold()
                language_id = entry.get("id")
                if (
                    name.startswith(prefixes)
                    and "test" not in name
                    and isinstance(language_id, int)
                ):
                    resolved[language] = language_id
                    break

        missing = set(JUDGE0_LANGUAGE_PREFIXES) - set(resolved)
        if missing:
            names = ", ".join(sorted(language.value for language in missing))
            raise Judge0UnavailableError(
                f"Judge0 does not offer compatible runtimes for: {names}."
            )

        self._language_ids = resolved
        return resolved

    async def _submit_batch_tokens(
        self,
        submissions_payload: List[Dict[str, Any]],
        deadline: Optional[float] = None,
    ) -> List[str]:
        """Submit once; retrying a timed-out POST could execute code twice."""
        if not submissions_payload:
            raise ValueError("At least one Judge0 submission is required.")
        url = f"{self.base_url}/submissions/batch?base64_encoded=true"
        try:
            async with self._client() as client:
                response = await client.post(
                    url,
                    json={"submissions": submissions_payload},
                    headers=self.headers,
                    timeout=self._request_timeout(deadline, float(self.timeout)),
                )
                if response.status_code >= 500:
                    raise Judge0UnavailableError(f"Judge0 server error: HTTP {response.status_code}")
                response.raise_for_status()
                data = response.json()
                if not isinstance(data, list) or len(data) != len(submissions_payload):
                    raise Judge0UnavailableError("Judge0 returned an incomplete batch token list.")
                tokens = [item.get("token") if isinstance(item, dict) else None for item in data]
                if (
                    any(not isinstance(token, str) or not token.strip() for token in tokens)
                    or len(set(tokens)) != len(tokens)
                ):
                    raise Judge0UnavailableError("Judge0 returned invalid batch tracking tokens.")
                return tokens
        except httpx.RequestError as exc:
            raise Judge0UnavailableError(f"Failed to connect to Judge0 at {self.base_url}: {exc}") from exc
        except httpx.HTTPStatusError as exc:
            raise Judge0UnavailableError(
                f"Judge0 submission request failed: HTTP {exc.response.status_code}"
            ) from exc
        except ValueError as exc:
            raise Judge0UnavailableError("Judge0 returned invalid submission data.") from exc

    async def _poll_batch_results(
        self,
        tokens: List[str],
        max_polls: int = 100,
        poll_interval: float = 0.6,
        deadline: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """Poll to a bounded deadline and return results in submitted-token order."""
        if not tokens or len(set(tokens)) != len(tokens):
            raise Judge0UnavailableError("Judge0 returned an invalid set of batch tokens.")

        fields = "token,stdout,stderr,status_id,status,compile_output,time,memory"
        url = f"{self.base_url}/submissions/batch"
        deadline = deadline or (
            time.monotonic() + max(1.0, float(settings.JUDGE0_EXECUTION_TIMEOUT_SECONDS))
        )

        async with self._client() as client:
            for _ in range(max(1, max_polls)):
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    break
                try:
                    resp = await client.get(
                        url,
                        params={
                            "tokens": ",".join(tokens),
                            "base64_encoded": "true",
                            "fields": fields,
                        },
                        headers=self.headers,
                        timeout=self._request_timeout(deadline, float(self.timeout)),
                    )
                    if resp.status_code >= 500:
                        raise Judge0UnavailableError(f"Judge0 poll error: HTTP {resp.status_code}")
                    resp.raise_for_status()
                    payload = resp.json()
                    submissions = payload.get("submissions") if isinstance(payload, dict) else None
                    if not isinstance(submissions, list):
                        raise Judge0UnavailableError("Judge0 returned an invalid batch result payload.")

                    results_by_token = {
                        item.get("token"): item
                        for item in submissions
                        if isinstance(item, dict) and isinstance(item.get("token"), str)
                    }
                    if (
                        len(submissions) == len(tokens)
                        and len(results_by_token) == len(tokens)
                        and set(results_by_token) == set(tokens)
                    ):
                        ordered = [results_by_token[token] for token in tokens]
                        # Judge0 statuses 1 and 2 are pending. Reject malformed status
                        # data immediately instead of polling until the execution deadline.
                        status_ids = []
                        for item in ordered:
                            status = item.get("status")
                            status_id = status.get("id") if isinstance(status, dict) else None
                            if isinstance(status_id, bool) or not isinstance(status_id, int):
                                raise Judge0UnavailableError(
                                    "Judge0 returned an invalid batch result status."
                                )
                            if status_id not in (1, 2) and status_id < 3:
                                raise Judge0UnavailableError(
                                    "Judge0 returned an unsupported batch result status."
                                )
                            status_ids.append(status_id)
                        if all(status_id >= 3 for status_id in status_ids):
                            return ordered
                except httpx.RequestError as exc:
                    raise Judge0UnavailableError(f"Judge0 polling interrupted: {exc}") from exc
                except httpx.HTTPStatusError as exc:
                    raise Judge0UnavailableError(
                        f"Judge0 polling failed: HTTP {exc.response.status_code}"
                    ) from exc
                except ValueError as exc:
                    raise Judge0UnavailableError("Judge0 returned invalid batch result data.") from exc

                remaining = deadline - time.monotonic()
                if remaining > 0:
                    await asyncio.sleep(min(max(0.05, poll_interval), remaining))

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

        # Bound language lookup, batch submission, and worker polling as one operation.
        deadline = time.monotonic() + max(
            1.0, float(settings.JUDGE0_EXECUTION_TIMEOUT_SECONDS)
        )

        # 1. Check Circuit Breaker state before making network calls
        judge0_circuit_breaker.before_request()

        try:
            language_ids = await self._get_language_ids(deadline)
            try:
                language_id = language_ids[language]
            except KeyError as exc:
                raise ValueError(f"Unsupported programming language: {language}") from exc
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

            tokens = await self._submit_batch_tokens(submissions_payload, deadline)
            if len(tokens) != len(test_cases):
                raise Judge0UnavailableError("Judge0 returned a result count that does not match the test cases.")
            raw_results = await self._poll_batch_results(tokens, deadline=deadline)
            if len(raw_results) != len(test_cases):
                raise Judge0UnavailableError("Judge0 returned a result count that does not match the test cases.")
            parsed_results = [_parse_completed_result(raw) for raw in raw_results]
            judge0_circuit_breaker.record_success()
        except Judge0UnavailableError:
            judge0_circuit_breaker.record_failure()
            raise
        except Exception:
            # Input/programming errors must not make a healthy sandbox appear
            # unavailable; still release a half-open probe so future calls work.
            judge0_circuit_breaker.record_neutral()
            raise

        # 2. Parse and aggregate metrics across all test cases
        detailed_results: List[SingleTestResult] = []
        passed_count = 0
        total_weight = 0.0
        earned_weight = 0.0
        exec_times: List[float] = []
        memories: List[float] = []
        first_failure_status_id: Optional[int] = None

        for tc, raw, parsed in zip(test_cases, raw_results, parsed_results, strict=True):
            status_id, status_desc, time_sec, mem_kb = parsed
            error_cat = classify_judge0_status(status_id)

            passed = status_id == 3
            if passed:
                passed_count += 1
                earned_weight += tc.weight
            elif first_failure_status_id is None:
                first_failure_status_id = status_id

            total_weight += tc.weight

            # Judge0 returns 'time' in seconds and 'memory' in KB.
            time_ms = round(time_sec * 1000.0, 3)

            exec_times.append(time_ms)
            memories.append(mem_kb)

            # Keep hidden cases in the aggregate score and persisted attempt, but
            # never serialize their per-case metadata or compiler/runtime output
            # into the student-facing API response.
            if not tc.is_hidden:
                detailed_results.append(
                    SingleTestResult(
                        test_case_id=tc.test_case_id,
                        order_index=tc.order_index,
                        passed=passed,
                        status_id=status_id,
                        status_description=status_desc,
                        error_category=error_cat,
                        stdout=_b64_decode(raw.get("stdout")),
                        stderr=_b64_decode(raw.get("stderr")),
                        compile_output=_b64_decode(raw.get("compile_output")),
                        execution_time_ms=time_ms,
                        memory_used_kb=mem_kb,
                        is_hidden=False,
                        stdin=tc.stdin or "",
                        expected_stdout=tc.expected_stdout or "",
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


# One instance per API process shares runtime IDs and pooled connections.
judge0_client = Judge0Client()
