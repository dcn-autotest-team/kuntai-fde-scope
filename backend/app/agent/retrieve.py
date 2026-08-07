import re
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.database.models import Case, Lesson

def tokenize(text: str) -> set:
    if not text:
        return set()
    cleaned = re.sub(r"[^\w\u4e00-\u9fa5]+", " ", str(text).lower())
    words = set(cleaned.split())
    # 针对中文按双字切分提取 token
    chinese_chars = [c for c in cleaned if "\u4e00" <= c <= "\u9fa5"]
    for i in range(len(chinese_chars) - 1):
        words.add(chinese_chars[i] + chinese_chars[i + 1])
    return words

def jaccard_similarity(text1: str, text2: str) -> float:
    set1 = tokenize(text1)
    set2 = tokenize(text2)
    if not set1 or not set2:
        return 0.0
    intersection = len(set1.intersection(set2))
    union = len(set1.union(set2))
    return round(intersection / union, 3) if union > 0 else 0.0

def retrieve_similar_cases(query_text: str, db: Session, top_k: int = 3) -> List[Dict[str, Any]]:
    cases = db.query(Case).order_by(Case.created_at.desc()).limit(200).all()
    if not cases or not query_text:
        return []

    scored = []
    for c in cases:
        req_text = c.requirement_text or ""
        sim = jaccard_similarity(query_text, req_text)
        if sim > 0.05:
            scored.append({
                "id": c.id,
                "requirementText": req_text,
                "aiVerdict": c.aiVerdict if hasattr(c, 'aiVerdict') else c.ai_verdict,
                "similarity": sim
            })
    scored.sort(key=lambda x: x["similarity"], reverse=True)
    return scored[:top_k]

def retrieve_lessons(query_text: str, db: Session, top_k: int = 6) -> List[Dict[str, Any]]:
    lessons = db.query(Lesson).order_by(Lesson.created_at.desc()).limit(200).all()
    if not lessons:
        return []

    if not query_text:
        return [{"id": l.id, "lesson": l.lesson, "dimensionId": l.dimension_id} for l in lessons[:top_k]]

    scored = []
    for l in lessons:
        sim = jaccard_similarity(query_text, (l.lesson or "") + " " + (l.context or ""))
        scored.append({
            "id": l.id,
            "lesson": l.lesson,
            "dimensionId": l.dimension_id,
            "similarity": sim
        })
    scored.sort(key=lambda x: x["similarity"], reverse=True)
    return scored[:top_k]
