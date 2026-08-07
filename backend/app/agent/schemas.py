"""
Agent Context & Data Schemas
Strongly typed models for Agent Execution Context, Decisions, and Verdicts.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class DecisionItem(BaseModel):
    dimension_id: str
    option_index: int = 0
    reason: str = ""


class RedflagItem(BaseModel):
    dimension_id: str
    dimension_title: str
    option_label: str
    reason: str = ""


class VerdictDetail(BaseModel):
    dimension_id: str
    dimension_title: str
    option_index: int
    option_label: str
    score: int
    redflag: bool = False
    reason: str = ""


class VerdictResult(BaseModel):
    verdict: str  # "can", "maybe", "no"
    total: int
    hasRedFlag: bool = False
    redflagDimensions: List[str] = Field(default_factory=list)
    details: List[VerdictDetail] = Field(default_factory=list)


class RecommendedPackage(BaseModel):
    key: str
    title: str
    duration: str
    status: str
    desc: str


class AgentContext(BaseModel):
    text: str = ""
    imageDataUrl: Optional[str] = None
    docText: Optional[str] = None
    dimensions: List[Dict[str, Any]] = Field(default_factory=list)
    db: Any = None
    similarCases: List[Dict[str, Any]] = Field(default_factory=list)
    lessons: List[Dict[str, Any]] = Field(default_factory=list)
    results: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        arbitrary_types_allowed = True

    def get_decisions(self) -> List[Dict[str, Any]]:
        analyze_res = self.results.get("analyze_dimensions", {})
        return analyze_res.get("decisions", []) if isinstance(analyze_res, dict) else []

    def get_verdict(self) -> Dict[str, Any]:
        return self.results.get("calculate_verdict", {})
