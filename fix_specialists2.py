import re

with open('backend/app/agents/specialists.py', 'r') as f:
    content = f.read()

new_code = """
from app.core.neo4j_client import neo4j_client
import json
import time

def execute_cypher_query(query: str) -> str:
    \"\"\"Executes a Cypher query against the Neo4j Knowledge Graph to find real-time insights.\"\"\"
    try:
        with neo4j_client.driver.session() as session:
            result = session.run(query)
            data = [record.data() for record in result]
            return json.dumps(data, default=str)
    except Exception as e:
        return f"Error executing query: {str(e)}"

@retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=2, min=4, max=30))
def call_agent_with_tools(role_prompt: str, community_json: dict) -> str:
    time.sleep(5)
    llm = get_llm()
    
    # Manual loop for Tool Calling to support old Langchain versions
    prompt = role_prompt + "\\n\\nHere is the strict JSON data contract for the targeted syndicate subgraph (with pre-computed GDS metrics):\\n\\n" + json.dumps(community_json, indent=2) + "\\n\\nYou have the ability to query the Neo4j database. If you need to run a query, output EXACTLY:\\nTOOL_CALL: <your_cypher_query_here>\\n\\nOtherwise, synthesize the findings and output your final HTML snippet."
    
    messages = [
        SystemMessage(content=prompt)
    ]
    
    for _ in range(3): # Max 3 tool iterations
        try:
            response = llm.invoke(messages)
            content = response.content
            
            if "TOOL_CALL:" in content:
                query = content.split("TOOL_CALL:")[1].strip().split("\\n")[0]
                db_result = execute_cypher_query(query)
                messages.append(HumanMessage(content=f"TOOL_RESULT: {db_result}"))
                time.sleep(5) # Rate limit respect
            else:
                return content
        except Exception as e:
            return f"<div class='error text-red-500'>Error executing agent with tools: {str(e)}</div>"
            
    return "<div class='error text-red-500'>Agent hit maximum tool iterations.</div>"
"""

parts = content.split("from langchain.agents import initialize_agent")
if len(parts) > 1:
    before = parts[0]
    aggregator = "\ndef aggregator_agent_node" + content.split("def aggregator_agent_node")[1]
    new_content = before + new_code + aggregator
    with open('backend/app/agents/specialists.py', 'w') as f:
        f.write(new_content)
    print("Fixed specialists with manual loop")
else:
    print("Could not find the target string")
