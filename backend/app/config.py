import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    PORT: int = int(os.getenv("PORT", 8000))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    
    MONGODB_URL: str = os.getenv("MONGODB_URL", "mongodb://admin:adminpassword@localhost:27017")
    MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "ai_tutor_db")
    
    JWT_SECRET: str = os.getenv("JWT_SECRET", "your_super_secret_jwt_key_here_change_in_production")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", 1440))
    
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "gemini")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    WHISPER_API_KEY: str = os.getenv("WHISPER_API_KEY", "")
    WHISPER_API_URL: str = os.getenv("WHISPER_API_URL", "")
    WHISPER_MODEL: str = os.getenv("WHISPER_MODEL", "")

    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
