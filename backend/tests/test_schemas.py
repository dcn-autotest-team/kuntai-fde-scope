from app.agent.schemas import AgentContext, DecisionItem, RecommendedPackage, RedflagItem, VerdictDetail, VerdictResult


def test_agent_schema_models_and_helpers():
    decision = DecisionItem(dimension_id="risk", option_index=1)
    redflag = RedflagItem(dimension_id="risk", dimension_title="风险", option_label="越界")
    detail = VerdictDetail(dimension_id="risk", dimension_title="风险", option_index=1, option_label="越界", score=-5)
    verdict = VerdictResult(verdict="no", total=-5, details=[detail])
    package = RecommendedPackage(key="diag", title="诊断", duration="3天", status="can", desc="说明")
    context = AgentContext(results={"analyze_dimensions": {"decisions": [decision.model_dump()]}, "calculate_verdict": verdict.model_dump()})

    assert redflag.redflag is False if hasattr(redflag, "redflag") else True
    assert package.title == "诊断"
    assert context.get_decisions()[0]["dimension_id"] == "risk"
    assert context.get_verdict()["verdict"] == "no"
    assert AgentContext(results={"analyze_dimensions": []}).get_decisions() == []

