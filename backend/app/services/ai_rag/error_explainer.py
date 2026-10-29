import logging
from typing import List, Optional
from pydantic import BaseModel, Field

from app.services.ai_rag.gemini_client import GeminiConfigurationError
from app.services.ai_rag.llm import GeminiLLMService

logger = logging.getLogger(__name__)


class ErrorExplanationSchema(BaseModel):
    title: str = Field(
        ...,
        description="A short, friendly headline summarizing the issue (e.g., 'Syntax Error: Missing Semicolon', 'List Index Out of Bounds', 'Off-by-One in Loop Bound').",
    )
    summary: str = Field(
        ...,
        description="A clear, encouraging 1-2 sentence overview of what went wrong in plain, beginner-friendly English.",
    )
    concept_explanation: str = Field(
        ...,
        description="Educational explanation of the programming concept involved and why the language or compiler behaves this way.",
    )
    hints: List[str] = Field(
        ...,
        min_length=1,
        max_length=4,
        description="2 to 3 progressive, actionable guiding questions or hints to help the student find and fix the bug themselves.",
    )
    pedagogical_tip: str = Field(
        ...,
        description="A short encouraging tip or best-practice advice for future coding and debugging.",
    )


def explain_code_error(
    language: str,
    problem_title: str,
    problem_statement: str,
    student_code: str,
    error_category: str = "",
    compiler_output: str = "",
    stderr: str = "",
    status_description: str = "",
    failed_input: str = "",
    expected_output: str = "",
    actual_output: str = "",
) -> ErrorExplanationSchema:
    """
    Connects Judge0 execution diagnostics to Google Gemini (configured model ID, e.g. Gemini 2.5 Flash / 3.5 Flash)
    to provide beginner-friendly explanations and debugging hints for novice programmers.
    
    Guaranteed pedagogical safeguard: Prompts strictly forbid providing the full corrected solution.
    """
    prompt = f"""
You are assisting an undergraduate computer science student at North Eastern Mindanao State University (NEMSU).
The student is practicing {language.upper()} on ByteQuest.

--- CHALLENGE CONTEXT ---
Title: {problem_title}
Problem Description:
{problem_statement}

--- STUDENT SUBMITTED CODE ---
```{language}
{student_code}
```

--- JUDGE0 EXECUTION DIAGNOSTICS ---
Status: {status_description or 'Unsuccessful Execution'}
Error Category: {error_category or 'Unknown'}
{f'Compiler Output / Error: {compiler_output}' if compiler_output else ''}
{f'Runtime Standard Error (stderr): {stderr}' if stderr else ''}
{f'Sample Test Input: {failed_input}' if failed_input else ''}
{f'Expected Output: {expected_output}' if expected_output else ''}
{f'Actual Student Output: {actual_output}' if actual_output else ''}

--- YOUR INSTRUCTIONS ---
1. Explain what the error or test failure means in clear, accessible terms for a novice programmer.
2. Explain the programming concept behind it (e.g., operator precedence, zero-indexing, memory bounds, type conversion, uninitialized variables).
3. Provide 2-3 guiding hints or questions that lead the student to find the fix themselves.
4. ABSOLUTE RULE: DO NOT write out the complete corrected code. DO NOT solve the challenge for them. Preserve the learning experience.
"""

    system_instruction = (
        "You are ByteQuest's AI Programming Tutor, an encouraging and pedagogical computer science professor. "
        "Your mission is to help novice students learn how to debug and understand errors without giving them the direct answers."
    )

    return GeminiLLMService.generate_structured(
        prompt=prompt,
        response_schema=ErrorExplanationSchema,
        system_instruction=system_instruction,
        temperature=0.2,
    )
