from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
from enum import Enum

class Role(str, Enum):
    STUDENT = "student"
    FACULTY = "faculty"
    ADMIN = "admin"

class UserPreferences(BaseModel):
    language: str = "en"
    theme: str = "dark"

class UserProfile(BaseModel):
    avatar: Optional[str] = None
    bio: Optional[str] = None
    preferences: UserPreferences = Field(default_factory=UserPreferences)

class UserBase(BaseModel):
    name: str
    email: str

    @field_validator("email", mode="before")
    @classmethod
    def sanitize_email(cls, v: str) -> str:
        if isinstance(v, str):
            return v.strip()
        return v

class UserCreate(UserBase):
    password: str
    role: Role = Role.STUDENT

class UserLogin(BaseModel):
    email: str
    password: str

    @field_validator("email", mode="before")
    @classmethod
    def sanitize_email(cls, v: str) -> str:
        if isinstance(v, str):
            return v.strip()
        return v

class UserOut(UserBase):
    id: str
    role: Role = Role.STUDENT
    profile: UserProfile = Field(default_factory=UserProfile)
    created_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    name: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None

class GoogleAuthRequest(BaseModel):
    credential: Optional[str] = None
    access_token: Optional[str] = None
