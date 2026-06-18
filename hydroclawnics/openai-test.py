from __future__ import annotations

import asyncio

try:
    from hydroclawnics.agent.llm_client import build_async_client, load_llm_config
except ModuleNotFoundError:
    from agent.llm_client import build_async_client, load_llm_config


async def main() -> None:
    config = load_llm_config()
    client = build_async_client(config)
    print(f"provider={config.provider} model={config.model_for('supervisor')}")

    if client is None:
        print("LLM_PROVIDER=none; skipping hosted inference call.")
        return

    response = await client.chat.completions.create(
        model=config.model_for("supervisor"),
        messages=[{"role": "user", "content": "Reply with one short Hydroclawnics status line."}],
        temperature=0.2,
        max_tokens=120,
        **config.request_options(),
    )
    print(response.choices[0].message.content or "")


if __name__ == "__main__":
    asyncio.run(main())
