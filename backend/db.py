"""
Database layer: connects to Postgres (Supabase) and defines the
Transcription model used to persist transcript history.
"""

import os
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, String, Float, DateTime, JSON
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()  # reads a .env file in the backend/ directory, if present

# Supabase gives you a connection string like:
# postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
# Set it as DATABASE_URL in your environment (or a .env file loaded by main.py).
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./local_dev.db")

# SQLite fallback (local_dev.db) lets you run and test the backend without
# a Supabase project set up yet. Switch to DATABASE_URL once you have one.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Transcription(Base):
    __tablename__ = "transcriptions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    user_id = Column(String, index=True, nullable=True)  # Supabase user UUID; nullable for pre-auth records

    text = Column(String, nullable=False)
    language = Column(String)
    language_probability = Column(Float)
    duration_seconds = Column(Float)
    processing_time_seconds = Column(Float)

    # Stored as JSON: list of {word, start, end, confidence}
    words = Column(JSON)

    def to_dict(self):
        return {
            "id": self.id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "user_id": self.user_id,
            "text": self.text,
            "language": self.language,
            "language_probability": self.language_probability,
            "duration_seconds": self.duration_seconds,
            "processing_time_seconds": self.processing_time_seconds,
            "words": self.words,
        }


def init_db():
    """Create tables if they don't exist yet. Safe to call on every startup."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency: yields a DB session and ensures it's closed after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
