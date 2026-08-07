import asyncio

import pytest

from app.agent import llm
from app.database.models import SysConfig


class Query:
    def __init__(self, value):
        self.value = value

    def first(self):
        return self.value


class DB:
    def __init__(self, config=None):
        self.config = config

    def query(self, model):
        assert model is SysConfig
        return Query(self.config)


class Response:
    def __init__(self, status=200, data=None, text="error", lines=None):
        self.status_code = status
        self._data = data or {}
        self.text = text
        self.lines = lines or []

    def json(self):
        return self._data

    async def aread(self):
        return self.text.encode()

    async def aiter_lines(self):
        for line in self.lines:
            yield line

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False


class Client:
    response = Response()
    last_request = None

    def __init__(self, timeout):
        self.timeout = timeout

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def post(self, url, **kwargs):
        Client.last_request = (url, kwargs)
        return Client.response

    def stream(self, method, url, **kwargs):
        Client.last_request = (url, kwargs)
        return Client.response


def run(awaitable):
    return asyncio.run(awaitable)


def test_get_ai_config_uses_database_values_and_defaults(monkeypatch):
    monkeypatch.setattr(llm.settings, "DEFAULT_ENDPOINT", "https://default")
    monkeypatch.setattr(llm.settings, "DEFAULT_API_KEY", "default-key")
    monkeypatch.setattr(llm.settings, "DEFAULT_MODEL", "default-model")

    assert llm.get_ai_config(DB()) == {
        "endpoint": "https://default",
        "apiKey": "default-key",
        "model": "default-model",
    }
    record = type("Config", (), {"endpoint": "https://custom/v1", "api_key": "key", "model": "model"})()
    assert llm.get_ai_config(DB(record))["endpoint"] == "https://custom/v1"


def test_chat_completion_success_and_endpoint_variants(monkeypatch):
    monkeypatch.setattr(llm.httpx, "AsyncClient", Client)
    Client.response = Response(data={"choices": [{"message": {"content": "answer"}}]})
    db = DB(type("Config", (), {"endpoint": "https://api.test", "api_key": "key", "model": "m"})())

    assert run(llm.chat_completion([{"role": "user", "content": "hi"}], db)) == "answer"
    assert Client.last_request[0] == "https://api.test/v1/chat/completions"

    db.config.endpoint = "https://api.test/v1"
    assert run(llm.chat_completion([], db)) == "answer"
    assert Client.last_request[0] == "https://api.test/v1/chat/completions"


def test_chat_completion_rejects_missing_key_and_bad_responses(monkeypatch):
    monkeypatch.setattr(llm.httpx, "AsyncClient", Client)
    no_key = DB(type("Config", (), {"endpoint": "x", "api_key": "", "model": "m"})())
    monkeypatch.setattr(llm.settings, "DEFAULT_API_KEY", "")
    with pytest.raises(ValueError, match="API Key"):
        run(llm.chat_completion([], no_key))

    db = DB(type("Config", (), {"endpoint": "https://api", "api_key": "key", "model": "m"})())
    Client.response = Response(status=500, text="broken")
    with pytest.raises(ValueError, match="500"):
        run(llm.chat_completion([], db))

    Client.response = Response(data={"choices": []})
    with pytest.raises(ValueError, match="有效内容"):
        run(llm.chat_completion([], db))


def test_chat_completion_stream_yields_valid_chunks(monkeypatch):
    monkeypatch.setattr(llm.httpx, "AsyncClient", Client)
    Client.response = Response(lines=[
        "ignored",
        "data: not-json",
        'data: {"choices":[{"delta":{"content":"A"}}]}',
        'data: {"choices":[{"delta":{}}]}',
        "data: [DONE]",
    ])
    db = DB(type("Config", (), {"endpoint": "https://api/v1", "api_key": "key", "model": "m"})())

    async def collect():
        return [part async for part in llm.chat_completion_stream([], db)]

    assert run(collect()) == ["A"]


def test_chat_completion_stream_errors(monkeypatch):
    monkeypatch.setattr(llm.httpx, "AsyncClient", Client)
    monkeypatch.setattr(llm.settings, "DEFAULT_API_KEY", "")
    no_key = DB(type("Config", (), {"endpoint": "x", "api_key": "", "model": "m"})())

    async def collect(db):
        return [part async for part in llm.chat_completion_stream([], db)]

    with pytest.raises(ValueError, match="API Key"):
        run(collect(no_key))

    db = DB(type("Config", (), {"endpoint": "https://api", "api_key": "key", "model": "m"})())
    Client.response = Response(status=429, text="limited")
    with pytest.raises(ValueError, match="429"):
        run(collect(db))


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (None, None),
        ('{"a": 1}', {"a": 1}),
        ('```json\n[1, 2]\n```', [1, 2]),
        ('prefix {"ok": true} suffix', {"ok": True}),
        ("not json", None),
        ("prefix {bad} suffix", None),
    ],
)
def test_extract_json(value, expected):
    assert llm.extract_json(value) == expected


def test_chat_json_returns_parsed_content_or_fallback(monkeypatch):
    async def valid(*args, **kwargs):
        return '```json\n{"ok": true}\n```'

    monkeypatch.setattr(llm, "chat_completion", valid)
    assert run(llm.chat_json([], object(), fallback="fallback")) == {"ok": True}

    async def invalid(*args, **kwargs):
        return "invalid"

    monkeypatch.setattr(llm, "chat_completion", invalid)
    assert run(llm.chat_json([], object(), fallback="fallback")) == "fallback"

    async def broken(*args, **kwargs):
        raise RuntimeError("down")

    monkeypatch.setattr(llm, "chat_completion", broken)
    assert run(llm.chat_json([], object(), fallback=123)) == 123

