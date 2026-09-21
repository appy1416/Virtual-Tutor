from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class QuizQuestion(BaseModel):
    id: str
    question_text: str
    options: List[str]
    correct_answer: str

class QuizCreateRequest(BaseModel):
    subject_id: Optional[str] = None
    topic_id: Optional[str] = None
    subject: Optional[str] = None
    topic: Optional[str] = None
    difficulty: str = "easy"
    subtopic: Optional[str] = None
    question_type: Optional[str] = "MCQ"
    count: Optional[int] = 5
    question_count: Optional[int] = None

class QuizOut(BaseModel):
    id: str
    subject_id: str
    topic_id: str
    difficulty: str
    questions: List[QuizQuestion]
    created_at: datetime

    class Config:
        from_attributes = True

class QuestionAnswerSubmission(BaseModel):
    question_id: str
    submitted_answer: str

class QuizAttemptSubmission(BaseModel):
    answers: List[QuestionAnswerSubmission]
