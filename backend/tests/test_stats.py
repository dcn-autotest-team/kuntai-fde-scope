from types import SimpleNamespace

from app.database.models import Case, Lesson
from app.routers.agent_router import calculate_stats


class FakeQuery:
    def __init__(self, rows):
        self.rows = rows

    def all(self):
        return self.rows


class FakeSession:
    def __init__(self, cases, lessons):
        self.rows = {Case: cases, Lesson: lessons}

    def query(self, model):
        return FakeQuery(self.rows[model])


def test_calculate_stats_counts_confirmations_and_acceptance_rate():
    cases = [
        SimpleNamespace(
            confirmations=[{"dimension_id": "value", "option_index": 0}],
            ai_decisions=[{}, {}],
            corrections=[{}],
        ),
        SimpleNamespace(
            confirmations=[{"dimension_id": "risk", "option_index": 0}],
            ai_decisions=[{}, {}, {}],
            corrections=[],
        ),
        SimpleNamespace(confirmations=None, ai_decisions=[{}], corrections=None),
    ]
    session = FakeSession(cases, [SimpleNamespace(), SimpleNamespace()])

    result = calculate_stats(session)

    assert result["totalCases"] == 3
    assert result["confirmedCases"] == 2
    assert result["lessonCount"] == 2
    assert result["totalSuggestions"] == 5
    assert result["acceptedSuggestions"] == 4
    assert result["acceptanceRate"] == 80


def test_calculate_stats_has_no_rate_without_confirmed_suggestions():
    session = FakeSession([], [])

    result = calculate_stats(session)

    assert result["acceptanceRate"] is None
    assert result["weekly"] == []

