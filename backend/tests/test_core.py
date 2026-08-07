import asyncio
from types import SimpleNamespace

import pytest

from app.agent import core
from app.database.models import Lesson


def run(awaitable):
    return asyncio.run(awaitable)


class FakeDB:
    def __init__(self):
        self.added = []
        self.commits = 0
        self.existing = None

    def add(self, value):
        self.added.append(value)

    def commit(self):
        self.commits += 1

    def query(self, model):
        assert model is Lesson
        return self

    def filter(self, *args):
        return self

    def first(self):
        return self.existing


def test_safe_data_all_tool_types():
    retrieval = {"cases": [{"requirementText": "x" * 100, "aiVerdict": "can", "similarity": 0.8}], "lessons": [{"lesson": "rule"}]}
    assert len(core.safe_data("retrieve_similar_cases", retrieval)["cases"][0]["excerpt"]) == 80
    assert core.safe_data("validate_requirement", {"valid": True, "reason": "ok"})["valid"] is True
    assert core.safe_data("analyze_dimensions", {"decisions": [1]}) == {"decisions": [1]}
    assert core.safe_data("check_redlines", {"redflags": [], "note": "safe"})["note"] == "safe"
    assert core.safe_data("calculate_verdict", {"verdict": "can", "total": 8, "hasRedFlag": False, "redflagDimensions": []})["total"] == 8
    assert core.safe_data("recommend_packages", {"packages": [1]}) == {"packages": [1]}
    assert core.safe_data("reflect", {"summary": "s", "consistent": True, "corrected": False})["summary"] == "s"
    assert core.safe_data("unknown", {}) == {}


@pytest.mark.parametrize(
    ("tool", "result", "fragment"),
    [
        ("retrieve_similar_cases", {"cases": [{}], "lessonCount": 2}, "命中 1"),
        ("retrieve_similar_cases", {"cases": []}, "暂无"),
        ("validate_requirement", {"valid": True}, "有效"),
        ("validate_requirement", {"valid": False, "reason": "短"}, "短"),
        ("analyze_dimensions", {"decisions": [1, 2]}, "2 个"),
        ("check_redlines", {"redflags": [1]}, "1 处"),
        ("check_redlines", {"redflags": []}, "未发现"),
        ("calculate_verdict", {"verdict": "can", "total": 9}, "总分 9"),
        ("recommend_packages", {"packages": [{"title": "A"}, {"title": "B"}]}, "A、B"),
        ("reflect", {}, "摘要"),
        ("unknown", {}, ""),
    ],
)
def test_summarize_result(tool, result, fragment):
    assert fragment in core.summarize_result(tool, result)


def base_params():
    return {
        "text": "企业知识库需求",
        "docText": "补充文档",
        "imageDataUrl": None,
        "dimensions": [{"id": "risk", "title": "风险", "options": [{"label": "安全", "score": 8, "redflag": False}]}],
    }


def test_run_agent_validates_required_input():
    async def emit(*args):
        pass

    with pytest.raises(ValueError, match="维度"):
        run(core.run_agent({}, FakeDB(), emit))
    with pytest.raises(ValueError, match="请输入"):
        run(core.run_agent({"dimensions": [{}]}, FakeDB(), emit))


def test_run_agent_happy_path(monkeypatch):
    events = []
    db = FakeDB()

    async def emit(event, data):
        events.append((event, data))

    monkeypatch.setattr(core, "retrieve_similar_cases", lambda *args, **kwargs: [{"requirementText": "历史", "aiVerdict": "can", "similarity": 0.9}])
    monkeypatch.setattr(core, "retrieve_lessons", lambda *args, **kwargs: [{"lesson": "经验"}])

    async def plan(*args):
        return {"reasoning": "计划", "steps": [
            {"tool": "validate_requirement", "purpose": "校验"},
            {"tool": "analyze_dimensions", "purpose": "分析"},
            {"tool": "calculate_verdict", "purpose": "计算"},
            {"tool": "recommend_packages", "purpose": "推荐"},
            {"tool": "skip", "purpose": "跳过"},
        ], "fallback": False}

    monkeypatch.setattr(core, "create_plan", plan)
    results = {
        "validate_requirement": {"valid": True, "reason": "ok"},
        "analyze_dimensions": {"decisions": [{"dimension_id": "risk", "option_index": 0}]},
        "calculate_verdict": {"verdict": "can", "total": 8, "hasRedFlag": False, "redflagDimensions": [], "details": [{"dimension_id": "risk"}]},
        "recommend_packages": {"packages": [{"title": "诊断"}]},
        "skip": None,
    }

    class Agent:
        async def execute_tool(self, name, ctx, emit_func):
            return results[name]

    monkeypatch.setattr(core, "nanobot", Agent())

    async def reflect(ctx):
        return {"summary": "总结", "consistent": True, "corrected": False}

    monkeypatch.setattr(core, "reflect", reflect)
    run(core.run_agent(base_params(), db, emit))

    assert db.commits == 1
    assert db.added[0].ai_verdict == "can"
    assert events[-1][0] == "done"
    assert events[-1][1]["valid"] is True


def test_run_agent_short_circuits_invalid_requirement(monkeypatch):
    events = []

    async def emit(event, data):
        events.append((event, data))

    monkeypatch.setattr(core, "retrieve_similar_cases", lambda *args, **kwargs: [])
    monkeypatch.setattr(core, "retrieve_lessons", lambda *args, **kwargs: [])

    async def plan(*args):
        return {"reasoning": "p", "steps": [{"tool": "validate_requirement", "purpose": "p"}]}

    monkeypatch.setattr(core, "create_plan", plan)

    class Agent:
        async def execute_tool(self, *args):
            return {"valid": False, "reason": "无效"}

    monkeypatch.setattr(core, "nanobot", Agent())
    run(core.run_agent(base_params(), FakeDB(), emit))
    assert events[-1] == ("done", {"caseId": None, "valid": False, "validityReason": "无效"})


def test_run_agent_fallback_plan_calculation_and_reflection(monkeypatch):
    events = []
    db = FakeDB()

    async def emit(event, data):
        events.append((event, data))

    monkeypatch.setattr(core, "retrieve_similar_cases", lambda *args, **kwargs: [])
    monkeypatch.setattr(core, "retrieve_lessons", lambda *args, **kwargs: [])

    async def broken_plan(*args):
        raise RuntimeError("planner down")

    monkeypatch.setattr(core, "create_plan", broken_plan)
    monkeypatch.setattr(core, "default_plan", lambda: {"reasoning": "fallback", "steps": [{"tool": "analyze_dimensions", "purpose": "分析"}], "fallback": True})

    class Agent:
        async def execute_tool(self, name, ctx, emit_func):
            if name == "analyze_dimensions":
                return {"decisions": []}
            return {"verdict": "no", "total": 0, "hasRedFlag": False, "redflagDimensions": [], "details": []}

    monkeypatch.setattr(core, "nanobot", Agent())

    async def broken_reflect(ctx):
        raise RuntimeError("reflect down")

    monkeypatch.setattr(core, "reflect", broken_reflect)
    run(core.run_agent({**base_params(), "text": "", "docText": "文档需求"}, db, emit))
    assert "综合评估结果" in events[-1][1]["summary"]
    assert db.added[0].requirement_text.startswith("[文档]")


def test_run_agent_requires_verdict(monkeypatch):
    async def emit(*args):
        pass

    monkeypatch.setattr(core, "retrieve_similar_cases", lambda *args, **kwargs: [])
    monkeypatch.setattr(core, "retrieve_lessons", lambda *args, **kwargs: [])

    async def plan(*args):
        return {"reasoning": "p", "steps": [{"tool": "unknown", "purpose": "p"}]}

    monkeypatch.setattr(core, "create_plan", plan)

    class Agent:
        async def execute_tool(self, *args):
            return None

    monkeypatch.setattr(core, "nanobot", Agent())
    with pytest.raises(ValueError, match="未能完成"):
        run(core.run_agent(base_params(), FakeDB(), emit))


def test_generate_lessons_saves_only_new_nonempty_items(monkeypatch):
    db = FakeDB()
    case = SimpleNamespace(requirement_text="客户需求", ai_decisions=[{"dimension_id": "risk", "reason": "原因"}])
    corrections = [{"dimension_id": "risk", "ai_option_index": 0, "user_option_index": 1}]

    async def parsed(*args, **kwargs):
        return {"lessons": [{"dimension_id": "risk", "lesson": " 新经验 "}, {"lesson": ""}]}

    monkeypatch.setattr(core, "chat_json", parsed)
    saved = run(core.generate_lessons_from_corrections(case, corrections, db))
    assert saved == ["新经验"]
    assert db.commits == 1

    db.existing = object()
    assert run(core.generate_lessons_from_corrections(case, corrections, db)) == []

    async def no_lessons(*args, **kwargs):
        return None

    monkeypatch.setattr(core, "chat_json", no_lessons)
    assert run(core.generate_lessons_from_corrections(case, corrections, db)) == []

