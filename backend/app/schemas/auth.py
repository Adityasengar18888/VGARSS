"""Authentication & User Pydantic Schemas."""
from pydantic import BaseModel, Field, field_validator


class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="Unique username")
    email: str = Field(..., min_length=5, max_length=100, description="User email address")
    password: str = Field(..., min_length=6, max_length=100, description="Account password")

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed.isalnum() and "_" not in trimmed:
            raise ValueError("Username must contain only alphanumeric characters and underscores.")
        return trimmed

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        trimmed = v.strip().lower()
        if "@" not in trimmed or "." not in trimmed.split("@")[-1]:
            raise ValueError("Invalid email format.")
        return trimmed


class UserLogin(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    created_at: str


class TokenResponse(BaseModel):
    token: str
    expires_at: str
    user: UserResponse
