import json
import re
import httpx
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.database.models import SysConfig
from app.config import settings

def get_ai_config(db: Session) -> Dict[str, str]:
    config_record = db.query(SysConfig).first()
    if config_record:
        return {
            "endpoint": config_record.endpoint or settings.DEFAULT_ENDPOINT,
            "apiKey": config_record.api_key or settings.DEFAULT_API_KEY,
            "model": config_record.model or settings.DEFAULT_MODEL
        }
    return {
        "endpoint": settings.DEFAULT_ENDPOINT,
        "apiKey": settings.DEFAULT_API_KEY,
        "model": settings.DEFAULT_MODEL
    }

async def chat_completion(
    messages: List[Dict[str, str]],
    db: Session,
    temperature: float = 0.3,
    max_tokens: int = 2000
) -> str:
    cfg = get_ai_config(db)
    api_key = cfg["apiKey"]
    if not api_key:
        raise ValueError("AI 服务未配置 API Key")

    endpoint = cfg["endpoint"].rstrip("/")
    if not endpoint.endswith("/v1"):
        url = f"{endpoint}/v1/chat/completions"
    else:
        url = f"{endpoint}/chat/completions"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": cfg["model"],
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(url, headers=headers, json=payload)
        if resp.status_code != 200:
            raise ValueError(f"AI 接口响应异常 [{resp.status_code}]: {resp.text}")
        data = resp.json()
        choices = data.get("choices", [])
        if not choices:
            raise ValueError("AI 未能输出有效内容")
        return choices[0]["message"]["content"] or ""

async def chat_completion_stream(
    messages: List[Dict[str, str]],
    db: Session,
    temperature: float = 0.5,
    max_tokens: int = 2000
):
    """Async generator that yields content chunks from a streaming LLM call."""
    cfg = get_ai_config(db)
    api_key = cfg["apiKey"]
    if not api_key:
        raise ValueError("AI 服务未配置 API Key")

    endpoint = cfg["endpoint"].rstrip("/")
    if not endpoint.endswith("/v1"):
        url = f"{endpoint}/v1/chat/completions"
    else:
        url = f"{endpoint}/chat/completions"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": cfg["model"],
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as resp:
            if resp.status_code != 200:
                body = await resp.aread()
                raise ValueError(f"AI 接口响应异常 [{resp.status_code}]: {body.decode('utf-8', errors='replace')[:200]}")
            async for line in resp.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data_str = line[5:].strip()
                if data_str == "[DONE]":
                    break
                try:
                    chunk = json.loads(data_str)
                    delta = chunk.get("choices", [{}])[0].get("delta", {})
                    content = delta.get("content")
                    if content:
                        yield content
                except (json.JSONDecodeError, IndexError, KeyError):
                    continue

def extract_json(text: str) -> Optional[Any]:
    if not text:
        return None
    cleaned = text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", cleaned)
    if match:
        cleaned = match.group(1).strip()
    try:
        return json.loads(cleaned)
    except Exception:
        obj_match = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", cleaned)
        if obj_match:
            try:
                return json.loads(obj_match.group(1))
            except Exception:
                pass
    return None

async def chat_json(
    messages: List[Dict[str, str]],
    db: Session,
    temperature: float = 0.2,
    max_tokens: int = 1500,
    fallback: Any = None
) -> Any:
    try:
        content = await chat_completion(messages, db, temperature=temperature, max_tokens=max_tokens)
        parsed = extract_json(content)
        if parsed is not None:
            return parsed
    except Exception:
        pass
    return fallback
