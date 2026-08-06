import uuid
import time
from sqlalchemy import Column, String, Boolean, Text, JSON, Float, Integer, BigInteger
from app.database.session import Base

def generate_uuid():
    return str(uuid.uuid4())

class SysConfig(Base):
    __tablename__ = "sys_config"

    id = Column(Integer, primary_key=True, index=True)
    endpoint = Column(String(255), nullable=False)
    api_key = Column(String(255), nullable=True)
    model = Column(String(100), nullable=False)
    updated_at = Column(BigInteger, default=lambda: int(time.time() * 1000))

class Case(Base):
    __tablename__ = "cases"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    requirement_text = Column(Text, nullable=True)
    has_image = Column(Boolean, default=False)
    has_doc = Column(Boolean, default=False)
    ai_decisions = Column(JSON, nullable=True)
    ai_verdict = Column(String(32), nullable=True)
    ai_summary = Column(Text, nullable=True)
    ai_packages = Column(JSON, nullable=True)
    confirmations = Column(JSON, nullable=True)
    corrections = Column(JSON, nullable=True)
    created_at = Column(BigInteger, default=lambda: int(time.time() * 1000))
    feedback_at = Column(BigInteger, nullable=True)

class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    lesson = Column(Text, nullable=False)
    context = Column(Text, nullable=True)
    dimension_id = Column(String(64), nullable=True)
    created_at = Column(BigInteger, default=lambda: int(time.time() * 1000))

class AdminToken(Base):
    __tablename__ = "admin_tokens"

    token = Column(String(64), primary_key=True)
    expire_at = Column(BigInteger, nullable=False)
