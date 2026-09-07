import re

with open('backend/app/agents/specialists.py', 'r') as f:
    content = f.read()

import_str = """
from tenacity import retry, stop_after_attempt, wait_exponential
"""

content = content.replace('import time', 'import time' + import_str)

retry_dec = """
@retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=2, min=4, max=30))
def call_agent(role_prompt: str, community_json: dict) -> str:
"""
content = content.replace('def call_agent(role_prompt: str, community_json: dict) -> str:', retry_dec)

retry_dec2 = """
@retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=2, min=4, max=30))
def call_agent_with_tools(role_prompt: str, community_json: dict) -> str:
"""
content = content.replace('def call_agent_with_tools(role_prompt: str, community_json: dict) -> str:', retry_dec2)

with open('backend/app/agents/specialists.py', 'w') as f:
    f.write(content)
print("Updated Specialists")
