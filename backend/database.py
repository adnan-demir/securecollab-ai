"""
Database configuration using SQLAlchemy with SQLite.
SQLite is used for simplicity; in production, switch to PostgreSQL.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.pool import StaticPool

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./securecollab.db")

# SQLite-specific settings: check_same_thread=False allows multi-thread access
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """Dependency: yields a DB session, ensures it is always closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
