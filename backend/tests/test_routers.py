import asyncio
import hashlib
import sys
import time
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import main
from app.database.models import AdminToken, Base, Case, Lesson, SysConfig
from app.database import session as session_module
from app.routers import admin_router, agent_router, chat_router, config_router, page_router
from app.schemas.schemas import AdminLoginRequest, CreateLessonRequest, FeedbackItem, FeedbackRequest, GeneratePageRequest, UpdateConfigRequest, UpdateLessonRequest


def run(awaitable):
    return asyncio.run(awaitable)


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()


def test_main_root_health_and_session_generator():
    assert main.root()["docs"] == "/docs"
    assert page_router.health_check().ok is True

    generator = session_module.get_db()
    generated = next(generator)
    assert generated is not None
    generator.close()


def test_admin_token_lifecycle_and_login(db, monkeypatch):
    with pytest.raises(HTTPException, match="Token"):
        admin_router.verify_token(None, db)
    with pytest.raises(HTTPException, match="Token"):
        admin_router.verify_token("missing", db)

    db.add(AdminToken(token="expired", expire_at=0))
    db.commit()
    with pytest.raises(HTTPException, match="过期"):
        admin_router.verify_token("expired", db)

    token = admin_router.issue_token(db)
    assert admin_router.verify_token(token, db).token == token
    assert admin_router.hash_password("secret") == hashlib.sha256(b"secret").hexdigest()

    monkeypatch.setattr(admin_router.settings, "ADMIN_PWD_HASH", admin_router.hash_password("secret"))
    wrong = admin_router.admin_login(AdminLoginRequest(password="bad"), db)
    assert wrong.ok is False

    db.add(SysConfig(endpoint="https://api", api_key="key", model="m"))
    db.commit()
    success = admin_router.admin_login(AdminLoginRequest(password="secret"), db)
    assert success.ok is True
    assert success.config["model"] == "m"


def test_admin_lesson_crud_and_seed_data(db):
    seeded = admin_router.get_admin_lessons(db, auth=True)
    assert len(seeded["lessons"]) == len(admin_router.INITIAL_SEED_LESSONS)

    with pytest.raises(HTTPException, match="不能为空"):
        admin_router.create_lesson(CreateLessonRequest(lesson=" "), db, auth=True)

    created = admin_router.create_lesson(CreateLessonRequest(lesson="经验", context="上下文", dimensionId="risk"), db, auth=True)
    lesson_id = created["lesson"]["id"]
    updated = admin_router.update_lesson(lesson_id, UpdateLessonRequest(lesson="新经验", context="新上下文", dimensionId="value"), db, auth=True)
    assert updated["lesson"]["lesson"] == "新经验"

    with pytest.raises(HTTPException, match="不存在"):
        admin_router.update_lesson("missing", UpdateLessonRequest(lesson="x"), db, auth=True)
    with pytest.raises(HTTPException, match="不能为空"):
        admin_router.update_lesson(lesson_id, UpdateLessonRequest(lesson=" "), db, auth=True)

    assert admin_router.delete_lesson(lesson_id, db, auth=True)["ok"] is True
    with pytest.raises(HTTPException, match="不存在"):
        admin_router.delete_lesson(lesson_id, db, auth=True)


def test_admin_lessons_attach_source_case(db):
    case = Case(requirement_text="匹配上下文", ai_verdict="can", corrections=[], created_at=1)
    db.add(case)
    db.add(Lesson(lesson="经验", context="匹配上下文", dimension_id="risk"))
    db.commit()
    result = admin_router.get_admin_lessons(db, auth=True)
    assert result["lessons"][0]["sourceCase"]["aiVerdict"] == "can"


def test_config_get_and_update(db, monkeypatch):
    monkeypatch.setattr(config_router.settings, "DEFAULT_ENDPOINT", "https://default")
    monkeypatch.setattr(config_router.settings, "DEFAULT_MODEL", "default")
    monkeypatch.setattr(config_router.settings, "DEFAULT_API_KEY", "key")
    assert config_router.get_public_config(db).endpoint == "https://default"

    result = config_router.update_config(UpdateConfigRequest(endpoint=" https://new ", apiKey=" secret ", model=" model "), db, auth=True)
    assert result["config"] == {"endpoint": "https://new", "model": "model", "hasKey": True}
    assert config_router.get_public_config(db).hasKey is True

    unchanged = config_router.update_config(UpdateConfigRequest(endpoint=" ", model=" "), db, auth=True)
    assert unchanged["config"]["endpoint"] == "https://new"


def test_page_generation_success_and_errors(db, monkeypatch):
    with pytest.raises(HTTPException, match="维度"):
        run(page_router.generate_page(GeneratePageRequest(dimensions=[]), db))

    async def fenced(*args, **kwargs):
        return "```html\n<html>ok</html>\n```"

    monkeypatch.setattr(page_router, "chat_completion", fenced)
    request = GeneratePageRequest(
        userText="需求",
        verdict="can",
        answers=[{"dimension_id": "risk", "option_index": 0}],
        packages=[{"title": "诊断", "duration": "3天"}],
        dimensions=[{"id": "risk", "title": "风险", "options": [{"label": "安全", "score": 2, "redflag": False}]}],
    )
    assert run(page_router.generate_page(request, db))["html"] == "<html>ok</html>"

    async def plain(*args, **kwargs):
        return "<html>plain</html>"

    monkeypatch.setattr(page_router, "chat_completion", plain)
    assert "plain" in run(page_router.generate_page(request.model_copy(update={"verdict": "maybe", "answers": [{"dimension_id": "risk", "option_index": "bad"}]}), db))["html"]

    async def empty(*args, **kwargs):
        return ""

    monkeypatch.setattr(page_router, "chat_completion", empty)
    with pytest.raises(HTTPException, match="HTML"):
        run(page_router.generate_page(request, db))


def test_agent_feedback_and_stats(db, monkeypatch):
    with pytest.raises(HTTPException, match="参数"):
        run(agent_router.agent_feedback(FeedbackRequest(caseId="", confirmations=[]), db))
    with pytest.raises(HTTPException, match="不存在"):
        run(agent_router.agent_feedback(FeedbackRequest(caseId="missing", confirmations=[]), db))

    case = Case(id="case-1", ai_decisions=[{"dimension_id": "risk", "option_index": 0}], requirement_text="需求")
    db.add(case)
    db.commit()

    async def lessons(*args):
        return ["经验"]

    monkeypatch.setattr(agent_router, "generate_lessons_from_corrections", lessons)
    request = FeedbackRequest(caseId="case-1", confirmations=[FeedbackItem(dimension_id="risk", option_index=1)])
    result = run(agent_router.agent_feedback(request, db))
    assert result["corrections"] == 1
    assert result["lessons"] == ["经验"]
    assert agent_router.get_agent_stats(db)["confirmedCases"] == 1

    async def broken(*args):
        raise RuntimeError("llm down")

    monkeypatch.setattr(agent_router, "generate_lessons_from_corrections", broken)
    result = run(agent_router.agent_feedback(request, db))
    assert result["lessons"] == []


def test_web_search_success_and_failure(monkeypatch):
    class DDGS:
        def text(self, query, max_results):
            return [{"title": "T", "href": "https://x", "body": "S"}, "bad"]

    monkeypatch.setitem(sys.modules, "ddgs", SimpleNamespace(DDGS=DDGS))
    assert chat_router.perform_web_search("query")[0]["title"] == "T"

    class BrokenDDGS:
        def text(self, *args, **kwargs):
            raise RuntimeError("down")

    monkeypatch.setitem(sys.modules, "ddgs", SimpleNamespace(DDGS=BrokenDDGS))
    assert chat_router.perform_web_search("query") == []


def test_chat_stream_with_search_and_error(db, monkeypatch):
    monkeypatch.setattr(chat_router, "perform_web_search", lambda *args, **kwargs: [{"title": "T", "url": "https://x", "snippet": "S"}])

    async def chunks(*args, **kwargs):
        yield "A"
        yield "B"

    monkeypatch.setattr(chat_router, "chat_completion_stream", chunks)
    request = chat_router.ChatRequest(messages=[chat_router.ChatMessage(role="assistant", content="old"), chat_router.ChatMessage(role="user", content="question")], web_search=True)
    response = run(chat_router.chat_stream(request, db))

    async def consume(body):
        return "".join([part.decode() if isinstance(part, bytes) else part async for part in body])

    body = run(consume(response.body_iterator))
    assert '"type": "search"' in body
    assert '"content": "A"' in body
    assert "[DONE]" in body

    async def bad_chunks(*args, **kwargs):
        raise ValueError("bad config")
        yield

    monkeypatch.setattr(chat_router, "chat_completion_stream", bad_chunks)
    response = run(chat_router.chat_stream(chat_router.ChatRequest(messages=[]), db))
    assert "bad config" in run(consume(response.body_iterator))


def test_analyze_stream_success_and_error(monkeypatch):
    class Request:
        async def is_disconnected(self):
            return False

    async def successful(params, db, emit):
        await emit("done", {"valid": True})

    class Session:
        def close(self):
            self.closed = True

    monkeypatch.setattr(agent_router, "SessionLocal", Session)
    monkeypatch.setattr(agent_router, "run_agent", successful)
    response = run(agent_router.analyze_agent(SimpleNamespace(model_dump=lambda: {}), Request()))

    async def consume(body):
        return "".join([part.decode() if isinstance(part, bytes) else part async for part in body])

    body = run(consume(response.body_iterator))
    assert "event: done" in body

    async def broken(*args):
        raise RuntimeError("analysis failed")

    monkeypatch.setattr(agent_router, "run_agent", broken)
    response = run(agent_router.analyze_agent(SimpleNamespace(model_dump=lambda: {}), Request()))
    assert "event: error" in run(consume(response.body_iterator))
