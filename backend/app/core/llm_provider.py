import os
from app.core.config import settings

def get_llm():
    """Return a LangChain ChatModel based on the LLM_PROVIDER setting."""
    provider = settings.LLM_PROVIDER.lower()

    if provider in ("local", "ollama"):
        from langchain_ollama import ChatOllama
        return ChatOllama(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.LLM_MODEL,
            temperature=0.0,
            num_ctx=8192,
            num_predict=3000
        )
    else:
        # Google Gemini
        from langchain_google_genai import ChatGoogleGenerativeAI
        api_key = settings.GOOGLE_API_KEY or os.getenv("GOOGLE_API_KEY", "")
        # The user has issues with 1.5-flash, but wait, I tested 1.5-flash and it gave 404!
        # The ONLY model that existed in the test was 'gemini-3.6-flash'. Let's use it.
        return ChatGoogleGenerativeAI(
            model="gemini-3.6-flash",
            google_api_key=api_key,
            temperature=0.0,
            max_retries=10
        )
