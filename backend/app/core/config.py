from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "ByteQuest 2.0 API"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Environment
    ENVIRONMENT: str = "development"
    
    # Database (Supabase PostgreSQL + pgvector)
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:54322/postgres"
    
    # Supabase Auth
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = "super-secret-jwt-token-replace-in-env"
    
    # Gemini AI (Rule 1 & Rule 2)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL_ID: str = "gemini-2.5-flash"
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-2"
    GEMINI_EMBEDDING_DIM: int = 768
    
    # Judge0 CE (Rule 3)
    JUDGE0_BASE_URL: str = "http://localhost:2358"
    JUDGE0_API_KEY: str = ""
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "https://bytequest.vercel.app",
        "https://bytequest-2-0.vercel.app",
    ]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
