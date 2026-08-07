import asyncio

import pytest

from app.agent import planner
from app.agent import tools as tools_package
from app.agent.nanobot import NanobotAgentAdapter
from app.agent.tools import analyze, recommend, redlines, validate
from app.agent.tools.base import FDEAgentTool, verdict_label


def run(awaitable):
    return asyncio.run(awaitable)


def dimension():
    return {
        "id": "risk",
        "title": "风险",
        "options": [
            {"label": "安全", "score": 2, "redflag": False},
            {"label": "越界", "score": -5, "redflag": True},
        ],
    }


def test_fde_tool_properties_and_execution():
    async def handler(ctx):
        return {"seen": ctx["value"]}

    tool = FDEAgentTool("demo", "演示", handler)
    assert tool.name == "demo"
    assert tool.description == tool.label == "演示"
    assert tool.parameters["properties"]["ctx"]["type"] == "object"
    assert run(tool.execute(ctx={"value": 3})) == {"seen": 3}
    assert verdict_label("can").startswith("可以做")
    assert verdict_label("unknown") == "unknown"


def test_validate_short_input_parsed_and_fallback(monkeypatch):
    assert run(validate.tool_validate_requirement({"text": "短", "db": object()}))["valid"] is False

    async def parsed(*args, **kwargs):
        return {"valid": False, "reason": "不属于范围"}

    monkeypatch.setattr(validate, "chat_json", parsed)
    result = run(validate.tool_validate_requirement({"text": "这是一个足够长的需求", "db": object()}))
    assert result == {"valid": False, "reason": "不属于范围"}

    async def missing(*args, **kwargs):
        return None

    monkeypatch.setattr(validate, "chat_json", missing)
    result = run(validate.tool_validate_requirement({"imageDataUrl": "data:image/png", "db": object()}))
    assert result["valid"] is True


def test_analyze_normalizes_decisions(monkeypatch):
    async def fake(*args, **kwargs):
        return {"decisions": [
            {"dimension_id": "risk", "option_index": "1", "reason": "命中红线"},
            {"dimension_id": "bad", "option_index": "invalid"},
        ]}

    monkeypatch.setattr(analyze, "chat_json", fake)
    ctx = {"text": "需求", "docText": "文档", "dimensions": [dimension(), {"id": "other", "title": "其他", "options": []}], "lessons": [{"lesson": "经验"}], "db": object()}
    result = run(analyze.tool_analyze_dimensions(ctx))
    assert result["decisions"][0]["option_index"] == 1
    assert result["decisions"][1]["option_index"] == 0

    async def out_of_range(*args, **kwargs):
        return {"decisions": [{"dimension_id": "risk", "option_index": 9}]}

    monkeypatch.setattr(analyze, "chat_json", out_of_range)
    assert run(analyze.tool_analyze_dimensions({**ctx, "docText": ""}))["decisions"][0]["option_index"] == 0


def test_redlines_and_recommendation_variants():
    ctx = {"dimensions": [dimension()], "results": {"analyze_dimensions": {"decisions": [None, {"dimension_id": "risk", "option_index": 1, "reason": "危险"}]}}}
    result = run(redlines.tool_check_redlines(ctx))
    assert result["hasRedFlag"] is True
    assert result["redflags"][0]["option_label"] == "越界"

    safe = run(redlines.tool_check_redlines({"dimensions": [], "results": {}}))
    assert safe["note"] == "未发现触犯红线场景"

    for verdict, count in [("can", 3), ("maybe", 2), ("no", 1)]:
        packages = run(recommend.tool_recommend_packages({"results": {"calculate_verdict": {"verdict": verdict}}}))
        assert len(packages["packages"]) == count
    assert len(run(recommend.tool_recommend_packages({"results": {"calculate_verdict": None}}))["packages"]) == 3


def test_reflect_success_failure_and_template(monkeypatch):
    ctx = {"text": "需求", "db": object(), "results": {"calculate_verdict": {"verdict": "maybe", "total": 5, "details": [{"dimension_title": "风险", "option_label": "待确认"}, None]}}}

    async def success(*args, **kwargs):
        return "  摘要  "

    monkeypatch.setattr(tools_package, "chat_completion", success)
    assert run(tools_package.reflect(ctx))["summary"] == "摘要"

    async def failure(*args, **kwargs):
        raise RuntimeError("down")

    monkeypatch.setattr(tools_package, "chat_completion", failure)
    assert "5 分" in run(tools_package.reflect(ctx))["summary"]
    assert "5 分" in tools_package.template_summary(ctx)
    assert "0 分" in tools_package.template_summary({"results": {"calculate_verdict": None}})


def test_planner_custom_and_default(monkeypatch):
    ctx = {"text": "需求", "docText": "文档", "imageDataUrl": "img", "similarCases": [{"similarity": 0.8, "aiVerdict": "can", "requirementText": "历史需求"}], "lessons": [{"lesson": "经验"}]}

    async def custom(*args, **kwargs):
        return {"reasoning": "定制", "steps": [{"tool": "a"}, {"tool": "b"}, {"tool": "c"}]}

    monkeypatch.setattr(planner, "chat_json", custom)
    assert run(planner.create_plan(ctx, object()))["fallback"] is False

    async def invalid(*args, **kwargs):
        return {"steps": []}

    monkeypatch.setattr(planner, "chat_json", invalid)
    result = run(planner.create_plan({}, object()))
    assert result["fallback"] is True
    assert len(result["steps"]) == 5


def test_nanobot_adapter_missing_success_and_error():
    events = []

    async def emit(event, data):
        events.append((event, data))

    class Registry:
        tool = None

        def get(self, name):
            return self.tool

    registry = Registry()
    adapter = object.__new__(NanobotAgentAdapter)
    adapter.registry = registry
    assert run(adapter.execute_tool("missing", {}, emit)) is None

    class Tool:
        label = "工具"
        description = "描述"

        async def execute(self, **kwargs):
            return {"ok": kwargs["ctx"]["ok"]}

    registry.tool = Tool()
    assert run(adapter.execute_tool("demo", {"ok": True}, emit)) == {"ok": True}
    assert events[-1][0] == "tool_start"

    class Broken(Tool):
        async def execute(self, **kwargs):
            raise RuntimeError("boom")

    registry.tool = Broken()
    with pytest.raises(RuntimeError, match="boom"):
        run(adapter.execute_tool("demo", {}, emit))
    assert events[-1][0] == "tool_error"

