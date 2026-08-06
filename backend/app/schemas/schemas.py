from typing import List, Optional, Any, Dict
from pydantic import BaseModel

class HealthResponse(BaseModel):
    ok: bool
    agent: bool
    time: int

class PublicConfigResponse(BaseModel):
    endpoint: str
    model: str
    hasKey: bool

class AdminLoginRequest(BaseModel):
    password: str

class AdminLoginResponse(BaseModel):
    ok: bool
    token: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    message: Optional[str] = None

class UpdateConfigRequest(BaseModel):
    endpoint: Optional[str] = None
    apiKey: Optional[str] = None
    model: Optional[str] = None

class AnalyzeRequest(BaseModel):
    text: Optional[str] = ""
    imageDataUrl: Optional[str] = None
    docText: Optional[str] = None
    dimensions: List[Dict[str, Any]] = []

class FeedbackItem(BaseModel):
    dimension_id: str
    option_index: int

class FeedbackRequest(BaseModel):
    caseId: str
    confirmations: List[FeedbackItem]

class UpdateLessonRequest(BaseModel):
    lesson: str
    context: Optional[str] = None
    dimensionId: Optional[str] = None

class GeneratePageRequest(BaseModel):
    userText: Optional[str] = ""
    verdict: Optional[str] = None
    answers: Optional[List[Dict[str, Any]]] = []
    packages: Optional[List[Dict[str, Any]]] = []
    dimensions: List[Dict[str, Any]] = []
