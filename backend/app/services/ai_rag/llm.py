"""
Gemini LLM Service (Rule 1 & Rule 7)
Generates curriculum-grounded quizzes and programming challenges.
Configured for gemini-3.5-flash-lite with Structured Outputs (Pydantic)
and exponential backoff for resilience against rate limits.
"""

from typing import List, Optional
import json
from pydantic import BaseModel, Field
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.core.config import settings

# Structured Output Schemas (Rule 1)
class QuizQuestion(BaseModel):
    question: str = Field(description="The conceptual question text")
    options: List[str] = Field(description="Exactly 4 multiple choice options", min_items=4, max_items=4)
    correct_option_index: int = Field(description="Zero-based index (0-3) of the correct option", ge=0, le=3)
    explanation: str = Field(description="Pedagogical explanation of why this answer is correct")


class GeneratedQuiz(BaseModel):
    topic: str
    difficulty_level: int = Field(ge=1, le=5)
    language: str
    questions: List[QuizQuestion]


class ChallengeTestCase(BaseModel):
    stdin: str = Field(default="", description="Standard input passed to the program")
    expected_stdout: str = Field(description="Exact expected standard output (trimmed)")
    is_hidden: bool = Field(default=False, description="Whether this is a hidden assessment test case")


class GeneratedChallenge(BaseModel):
    title: str = Field(description="Concise title for the programming challenge")
    topic_concept: str
    language: str = Field(description="Target programming language: cpp, python, or java")
    difficulty_level: int = Field(ge=1, le=5)
    problem_statement: str = Field(description="Clear problem description with input/output format and constraints")
    reference_solution_code: str = Field(description="Complete, working reference solution that passes all test cases")
    test_cases: List[ChallengeTestCase] = Field(description="Comprehensive test cases including edge cases", min_items=3)


class GeminiLLMService:
    def __init__(self, model_id: Optional[str] = None):
        self.model_id = model_id or settings.GEMINI_MODEL_ID
        self.api_key = settings.GEMINI_API_KEY
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"

    @retry(
        wait=wait_exponential(multiplier=1, min=2, max=10),
        stop=stop_after_attempt(3),
        reraise=True,
    )
    async def _call_gemini_structured(self, system_instruction: str, user_prompt: str, response_schema: dict) -> dict:
        """Calls Gemini API with structured JSON output enforcement (Rule 1 & Rule 7)."""
        import httpx

        url = f"{self.base_url}/models/{self.model_id}:generateContent?key={self.api_key}"
        
        payload = {
            "system_instruction": {
                "parts": [{"text": system_instruction}]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": user_prompt}]
                }
            ],
            "generationConfig": {
                "response_mime_type": "application/json",
                "response_schema": response_schema,
                "temperature": 0.2,
            }
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 429:
                raise Exception(f"HTTP 429 Rate Limited on model {self.model_id}")
            resp.raise_for_status()
            
            data = resp.json()
            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(raw_text)

    async def generate_quiz(
        self,
        topic: str,
        language: str,
        difficulty_level: int = 1,
        context_chunks: Optional[List[str]] = None,
    ) -> GeneratedQuiz:
        """Generates conceptual multiple-choice quiz questions grounded in curriculum text."""
        context_block = "\n---\n".join(context_chunks) if context_chunks else "Standard introductory curriculum."
        
        system_instruction = (
            "You are an expert Computer Science university instructor creating conceptual quizzes. "
            "Base your questions strictly on the provided syllabus/module context chunks. "
            "Ensure questions test deep understanding rather than mere memorization."
        )

        user_prompt = (
            f"Topic: {topic}\n"
            f"Programming Language: {language}\n"
            f"Difficulty Level (1-5): {difficulty_level}\n\n"
            f"Instructional Context:\n{context_block}\n\n"
            f"Generate 3 to 5 high-quality conceptual quiz questions."
        )

        result_dict = await self._call_gemini_structured(
            system_instruction=system_instruction,
            user_prompt=user_prompt,
            response_schema=GeneratedQuiz.model_json_schema(),
        )
        return GeneratedQuiz.model_validate(result_dict)

    async def generate_challenge(
        self,
        topic: str,
        language: str,
        difficulty_level: int = 1,
        context_chunks: Optional[List[str]] = None,
    ) -> GeneratedChallenge:
        """
        Generates a programming challenge with problem statement, reference code, and test cases.
        Output must be pre-validated in Judge0 before publication (Rule 6).
        """
        context_block = "\n---\n".join(context_chunks) if context_chunks else "Standard introductory curriculum."

        system_instruction = (
            f"You are an expert Computer Science professor designing a coding quest for {language}. "
            "Produce a complete problem statement, a reference solution code in the target language, "
            "and at least 3 test cases with exact stdin and expected stdout. "
            "The reference code must compile cleanly and match the expected output format exactly."
        )

        user_prompt = (
            f"Topic: {topic}\n"
            f"Target Language: {language}\n"
            f"Difficulty Level (1-5): {difficulty_level}\n\n"
            f"Instructional Module Context:\n{context_block}\n\n"
            f"Generate a programming challenge matching the specified criteria."
        )

        result_dict = await self._call_gemini_structured(
            system_instruction=system_instruction,
            user_prompt=user_prompt,
            response_schema=GeneratedChallenge.model_json_schema(),
        )
        return GeneratedChallenge.model_validate(result_dict)


gemini_service = GeminiLLMService()
