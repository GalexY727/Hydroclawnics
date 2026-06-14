from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Literal

from openai import AsyncOpenAI

Provider = Literal["none", "ollama", "nvidia", "openai"]

NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"
OLLAMA_BASE_URL = "http://localhost:11434/v1"


def _bool_env(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


def _provider_from_env() -> Provider:
    raw = os.getenv("LLM_PROVIDER", "").strip().lower()
    if raw in {"none", "mock", "deterministic", "off"}:
        return "none"
    if raw in {"ollama", "nvidia", "openai"}:
        return raw  # type: ignore[return-value]
    if os.getenv("NVIDIA_API_KEY") and not os.getenv("LLM_API_KEY"):
        return "nvidia"
    return "none"


@dataclass(frozen=True)
class LLMConfig:
    provider: Provider
    base_url: str | None
    api_key: str | None
    table_model: str
    supervisor_model: str
    table_interval_s: int
    supervisor_interval_s: int
    enable_thinking: bool
    demo_mode: bool

    @property
    def is_mock(self) -> bool:
        return self.provider == "none"

    @property
    def supports_tools(self) -> bool:
        return self.provider in {"ollama", "nvidia", "openai"}

    def model_for(self, role: Literal["table", "supervisor"]) -> str:
        return self.table_model if role == "table" else self.supervisor_model

    def request_options(self) -> dict[str, Any]:
        if self.provider == "nvidia" and self.enable_thinking:
            return {
                "extra_body": {
                    "chat_template_kwargs": {"enable_thinking": True},
                    "reasoning_budget": 4096,
                }
            }
        if self.provider == "ollama" and not self.enable_thinking:
            return {"extra_body": {"think": False}}
        return {}


def load_llm_config() -> LLMConfig:
    provider = _provider_from_env()
    api_key = os.getenv("LLM_API_KEY") or os.getenv("NVIDIA_API_KEY")

    if provider == "none":
        default_base_url = None
        default_api_key = None
        default_table_model = "deterministic-table-agent"
        default_supervisor_model = "deterministic-supervisor"
    elif provider == "ollama":
        default_base_url = OLLAMA_BASE_URL
        default_api_key = "ollama"
        default_table_model = "qwen3:8b"
        default_supervisor_model = "qwen3:8b"
    elif provider == "nvidia":
        default_base_url = NVIDIA_BASE_URL
        default_api_key = None
        default_table_model = "nvidia/nemotron-3-nano-30b-a3b"
        default_supervisor_model = "nvidia/nemotron-3-super-120b-a12b"
    else:
        default_base_url = None
        default_api_key = None
        default_table_model = "gpt-4o-mini"
        default_supervisor_model = "gpt-4o-mini"

    return LLMConfig(
        provider=provider,
        base_url=os.getenv("LLM_BASE_URL") or default_base_url,
        api_key=api_key or default_api_key,
        table_model=os.getenv("TABLE_AGENT_MODEL") or default_table_model,
        supervisor_model=os.getenv("SUPERVISOR_MODEL") or default_supervisor_model,
        table_interval_s=_int_env("TABLE_INTERVAL_S", 20),
        supervisor_interval_s=_int_env("SUPERVISOR_INTERVAL_S", 60),
        enable_thinking=_bool_env("LLM_ENABLE_THINKING", False),
        demo_mode=_bool_env("DEMO_MODE", provider == "none"),
    )


def build_async_client(config: LLMConfig) -> AsyncOpenAI | None:
    if config.is_mock:
        return None
    if config.provider in {"nvidia", "openai"} and not config.api_key:
        raise EnvironmentError(
            "LLM_API_KEY is required for this provider. "
            "NVIDIA users may keep using NVIDIA_API_KEY as a fallback."
        )
    kwargs: dict[str, Any] = {"api_key": config.api_key or "ollama"}
    if config.base_url:
        kwargs["base_url"] = config.base_url
    return AsyncOpenAI(**kwargs)
