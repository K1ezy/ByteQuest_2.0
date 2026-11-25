"""Choose a tutor reply style and decide whether the turn needs course material."""

import re
from dataclasses import dataclass
from typing import Literal

TutorMode = Literal["quick_fact", "explanation", "debugging", "challenge_hint"]

_COURSE_REFERENCE = re.compile(
    r"\b(?:py\s*4\s*e|[\w-]+\.pdf|(?:my|our|the|this|that|uploaded|course|class) (?:pdfs?|slides?|"
    r"handouts?|readers?|textbook|lesson|chapter|module|lecture|materials?)|"
    r"(?:course|class) (?:notes?|content)|(?:lesson|chapter|module|lecture|unit|week)\s+\d+|"
    r"(?:lesson|chapter|module|lecture)\s+(?:on|about|titled|called))\b",
    re.IGNORECASE,
)
_FOLLOW_UP = re.compile(
    r"^(?:why|how so|what else|more)\W*$|\b(?:another (?:example|hint)|"
    r"(?:explain|show|expand on|elaborate on|what about|what does|how does) (?:that|this|it)|"
    r"(?:that|this|the previous|your) (?:example|explanation|error|code|answer)|"
    r"(?:say|explain) (?:it|that) again)\b",
    re.IGNORECASE,
)
_DEBUG_REQUEST = re.compile(
    r"\b(?:debug|troubleshoot|traceback|my (?:code|program|script)|what went wrong|"
    r"why (?:did|does|is|was) .{0,110}(?:fail|crash|error|wrong|not work)|"
    r"(?:fix|getting|gives?|throws?|raises?) (?:[\w ]{0,28} )?(?:\w*error|exception|bug))\b",
    re.IGNORECASE,
)
_ERROR_TRACE = re.compile(r"\b(?:traceback\b|(?:\w*error|\w*exception)\s*:)", re.IGNORECASE)
_CODE = re.compile(r"```|\n\s*\w+\s*=|\b(?:print|input|int|range)\s*\(")
_BRIEF = re.compile(r"\b(?:briefly|short and concise|keep it (?:short|concise)|in one sentence|in a sentence|just the (?:answer|output))\b", re.IGNORECASE)
_EXPLAIN = re.compile(r"\b(?:explain|why|how|example|compare|difference|walk me through|teach|show me)\b", re.IGNORECASE)
_FACT = re.compile(
    r"^(?:(?:is|are|do|does|can|will|has|have)\b|which\b|"
    r"what (?:keyword|operator|symbol|file extension|version|type|value|output)\b|"
    r"what does .{1,75} (?:return|print|output|stand for)\b)",
    re.IGNORECASE,
)


def _is_follow_up(question: str) -> bool:
    return len(question) <= 180 and bool(_FOLLOW_UP.search(question))


@dataclass(frozen=True)
class TutorTurn:
    mode: TutorMode
    search_query: str | None
    thinking_level: Literal["minimal", "low"] = "minimal"


def choose_tutor_turn(
    messages: list[tuple[str, str]], *, is_challenge: bool = False, activity_topic: str | None = None,
) -> TutorTurn:
    question = messages[-1][1].strip()
    topic = ""
    if _is_follow_up(question):
        topic = next(
            (content for role, content in reversed(messages[:-1]) if role == "user" and not _is_follow_up(content)),
            "",
        )
    subject = f"{topic[:900]}\n{question}" if topic else question

    search_query = None
    if activity_topic or _COURSE_REFERENCE.search(subject):
        search_query = f"{activity_topic[:240]}\n{subject}" if activity_topic else subject

    if is_challenge:
        return TutorTurn("challenge_hint", search_query)
    error_trace = _ERROR_TRACE.search(subject)
    if error_trace or _DEBUG_REQUEST.search(subject):
        level = "low" if error_trace or _CODE.search(subject) else "minimal"
        return TutorTurn("debugging", search_query, level)
    if _BRIEF.search(question) or (_FACT.match(question) and not _EXPLAIN.search(question)):
        return TutorTurn("quick_fact", search_query)
    return TutorTurn("explanation", search_query)
