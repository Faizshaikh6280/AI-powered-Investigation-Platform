import re

with open('backend/app/agents/specialists.py', 'r') as f:
    content = f.read()

new_agent_code = """
from langchain.agents import initialize_agent, AgentType
from langchain.tools import tool
from app.core.neo4j_client import neo4j_client

@tool
def execute_cypher_query(query: str) -> str:
    \"\"\"Executes a Cypher query against the Neo4j Knowledge Graph to find real-time insights.\"\"\"
    try:
        with neo4j_client.driver.session() as session:
            result = session.run(query)
            data = [record.data() for record in result]
            import json
            return json.dumps(data, default=str)
    except Exception as e:
        return f"Error executing query: {str(e)}"

@retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=2, min=4, max=30))
def call_agent_with_tools(role_prompt: str, community_json: dict) -> str:
    time.sleep(5)
    llm = get_llm()
    tools = [execute_cypher_query]
    
    agent = initialize_agent(
        tools, 
        llm, 
        agent=AgentType.STRUCTURED_CHAT_ZERO_SHOT_REACT_DESCRIPTION,
        verbose=True,
        handle_parsing_errors=True
    )
    
    import json
    prompt = role_prompt + "\\n\\nHere is the strict JSON data contract for the targeted syndicate subgraph (with pre-computed GDS metrics):\\n\\n" + json.dumps(community_json, indent=2) + "\\n\\nSynthesize the findings and use tools if needed to explore the graph further. Provide a structured HTML output snippet."
    
    try:
        response = agent.run(prompt)
        return response
    except Exception as e:
        return f"<div class='error text-red-500'>Error executing agent with tools: {str(e)}</div>"
"""

parts = content.split("from langchain.tools import tool")
if len(parts) > 1:
    before = parts[0]
    aggregator = "\ndef aggregator_agent_node" + content.split("def aggregator_agent_node")[1]
    new_content = before + new_agent_code + aggregator
    with open('backend/app/agents/specialists.py', 'w') as f:
        f.write(new_content)
    print("Fixed specialists")
else:
    print("Could not find the target string")
