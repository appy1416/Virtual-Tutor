from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum

class MaterialType(str, Enum):
    PDF = "pdf"
    PPTX = "pptx"
    DOCX = "docx"
    IMAGE = "image"
    TEXT = "text"

class CourseCreate(BaseModel):
    title: str
    description: str
    subject: str

class CourseOut(BaseModel):
    id: str
    title: str
    description: str
    subject: str
    created_by: str
    created_at: datetime
    students_enrolled: List[str] = []

    class Config:
        from_attributes = True
        populate_by_name = True

class MaterialOut(BaseModel):
    id: str
    course_id: str
    title: str
    type: MaterialType
    file_path: Optional[str] = None
    uploaded_by: str
    uploaded_at: datetime
    summary: Optional[str] = None
    vector_status: str = "pending"

    class Config:
        from_attributes = True
        populate_by_name = True
