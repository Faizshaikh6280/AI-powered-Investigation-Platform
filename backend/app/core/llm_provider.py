import os
from app.core.config import settings

def resolve_ollama_base_url() -> str:
    """Auto-detect Ollama URL, routing to host.docker.internal when executing inside a Docker container."""
    base_url = os.getenv("OLLAMA_BASE_URL") or getattr(settings, "OLLAMA_BASE_URL", "http://localhost:11434")
    if os.path.exists("/.dockerenv") and ("localhost" in base_url or "127.0.0.1" in base_url):
        return base_url.replace("localhost", "host.docker.internal").replace("127.0.0.1", "host.docker.internal")
    return base_url

def get_llm(num_predict: int = 2000, num_ctx: int = 8192):
    """Return a LangChain ChatModel based on the LLM_PROVIDER setting with configurable token parameters."""
    provider = (os.getenv("LLM_PROVIDER") or settings.LLM_PROVIDER or "ollama").lower()

    if provider in ("local", "ollama"):
        from langchain_ollama import ChatOllama
        base_url = resolve_ollama_base_url()
        model_name = os.getenv("LLM_MODEL") or settings.LLM_MODEL or "qwen2.5:7b-instruct"
        return ChatOllama(
            base_url=base_url,
            model=model_name,
            temperature=0.0,
            num_ctx=num_ctx,
            num_predict=num_predict
        )
    else:
        # Google Gemini fallback
        from langchain_google_genai import ChatGoogleGenerativeAI
        api_key = os.getenv("GOOGLE_API_KEY") or settings.GOOGLE_API_KEY or ""
        return ChatGoogleGenerativeAI(
            model="gemini-1.5-flash",
            google_api_key=api_key,
            temperature=0.0,
            max_retries=10
        )

