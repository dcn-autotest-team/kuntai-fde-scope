from types import SimpleNamespace

from app.agent.retrieve import jaccard_similarity, retrieve_lessons, retrieve_similar_cases, tokenize
from app.database.models import Case, Lesson


class Query:
    def __init__(self, rows):
        self.rows = rows

    def order_by(self, *args):
        return self

    def limit(self, value):
        return self

    def all(self):
        return self.rows


class DB:
    def __init__(self, cases=None, lessons=None):
        self.rows = {Case: cases or [], Lesson: lessons or []}

    def query(self, model):
        return Query(self.rows[model])


def test_tokenize_normalizes_text_and_adds_chinese_bigrams():
    tokens = tokenize("RAG 知识库，RAG!")

    assert "rag" in tokens
    assert "知识" in tokens
    assert "识库" in tokens


def test_jaccard_similarity_is_symmetric_and_bounded():
    first = jaccard_similarity("企业 RAG 知识库", "企业知识库 RAG")
    second = jaccard_similarity("企业知识库 RAG", "企业 RAG 知识库")

    assert first == second
    assert 0 < first <= 1


def test_jaccard_similarity_returns_zero_for_empty_input():
    assert jaccard_similarity("", "知识库") == 0.0
    assert jaccard_similarity("", "") == 0.0


def test_retrieve_similar_cases_filters_sorts_and_limits_results():
    cases = [
        SimpleNamespace(id="1", requirement_text="企业 RAG 知识库", ai_verdict="can", created_at=2),
        SimpleNamespace(id="2", requirement_text="完全无关内容", ai_verdict="no", created_at=1),
    ]
    results = retrieve_similar_cases("企业 RAG 知识库", DB(cases=cases), top_k=1)
    assert results == [{
        "id": "1",
        "requirementText": "企业 RAG 知识库",
        "aiVerdict": "can",
        "similarity": 1.0,
    }]
    assert retrieve_similar_cases("", DB(cases=cases)) == []
    assert retrieve_similar_cases("query", DB()) == []


def test_retrieve_lessons_handles_empty_query_and_similarity_order():
    lessons = [
        SimpleNamespace(id="1", lesson="RAG 知识库经验", context="企业文档", dimension_id="risk", created_at=2),
        SimpleNamespace(id="2", lesson="部署经验", context=None, dimension_id=None, created_at=1),
    ]
    db = DB(lessons=lessons)
    assert retrieve_lessons("", db, top_k=1) == [{"id": "1", "lesson": "RAG 知识库经验", "dimensionId": "risk"}]
    ranked = retrieve_lessons("RAG 知识库", db)
    assert ranked[0]["id"] == "1"
    assert "similarity" in ranked[0]
    assert retrieve_lessons("anything", DB()) == []
