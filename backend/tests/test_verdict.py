import asyncio

from app.agent.tools.verdict import tool_calculate_verdict


def _run_verdict(options, decisions):
    context = {
        "dimensions": [
            {"id": "scope", "title": "范围", "options": options},
        ],
        "results": {"analyze_dimensions": {"decisions": decisions}},
    }
    return asyncio.run(tool_calculate_verdict(context))


def test_verdict_is_can_when_score_reaches_threshold():
    result = _run_verdict(
        [{"label": "适合", "score": 8, "redflag": False}],
        [{"dimension_id": "scope", "option_index": 0, "reason": "匹配"}],
    )

    assert result["verdict"] == "can"
    assert result["total"] == 8
    assert result["details"][0]["reason"] == "匹配"


def test_redflag_forces_no_verdict_even_with_positive_score():
    result = _run_verdict(
        [{"label": "越界", "score": 10, "redflag": True}],
        [{"dimension_id": "scope", "option_index": 0}],
    )

    assert result["verdict"] == "no"
    assert result["hasRedFlag"] is True
    assert result["redflagDimensions"] == ["scope"]


def test_invalid_decision_is_ignored():
    result = _run_verdict(
        [{"label": "适合", "score": 8, "redflag": False}],
        [{"dimension_id": "scope", "option_index": 99}],
    )

    assert result["verdict"] == "no"
    assert result["total"] == 0
    assert result["details"] == []

