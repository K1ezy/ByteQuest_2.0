"""Validation for the server-side JSON payload used by conceptual quizzes."""

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator


class QuizOption(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="ignore")

    key: str = Field(min_length=1, max_length=32)
    text: str = Field(min_length=1, max_length=500)


class StoredQuizQuestion(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="ignore")

    id: str = Field(min_length=1, max_length=100)
    prompt: str = Field(min_length=1, max_length=2_000)
    options: list[QuizOption] = Field(min_length=2, max_length=12)
    correct_answer: str = Field(min_length=1, max_length=32)

    @model_validator(mode="after")
    def validate_answers(self) -> "StoredQuizQuestion":
        keys = [option.key.casefold() for option in self.options]
        if len(keys) != len(set(keys)):
            raise ValueError("Quiz option keys must be unique.")
        if self.correct_answer.casefold() not in keys:
            raise ValueError("The correct answer must match one of the option keys.")
        return self


def parse_quiz_questions(content: object) -> list[StoredQuizQuestion]:
    """Validate question IDs, options, and answer keys without exposing answers."""
    raw_questions = content.get("questions") if isinstance(content, dict) else None
    if not isinstance(raw_questions, list) or not raw_questions:
        raise ValueError("Quiz content must contain at least one question.")
    if len(raw_questions) > 100:
        raise ValueError("Quiz content cannot contain more than 100 questions.")

    try:
        questions = [StoredQuizQuestion.model_validate(item) for item in raw_questions]
    except ValidationError as exc:
        raise ValueError("Quiz question data is invalid.") from exc

    question_ids = [question.id.casefold() for question in questions]
    if len(question_ids) != len(set(question_ids)):
        raise ValueError("Quiz question IDs must be unique.")
    return questions
