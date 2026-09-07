import re

with open('backend/app/agents/specialists.py', 'r') as f:
    content = f.read()

# Fix the manual loop to append the AI message
old_loop = """            if "TOOL_CALL:" in content:
                query = content.split("TOOL_CALL:")[1].strip().split("\\n")[0]
                db_result = execute_cypher_query(query)
                messages.append(HumanMessage(content=f"TOOL_RESULT: {db_result}"))
                time.sleep(5) # Rate limit respect"""

new_loop = """            if "TOOL_CALL:" in content:
                query = content.split("TOOL_CALL:")[1].strip().split("\\n")[0]
                db_result = execute_cypher_query(query)
                messages.append(response) # Append AI message
                messages.append(HumanMessage(content=f"TOOL_RESULT: {db_result}"))
                time.sleep(5) # Rate limit respect"""

if old_loop in content:
    content = content.replace(old_loop, new_loop)
    with open('backend/app/agents/specialists.py', 'w') as f:
        f.write(content)
    print("Fixed agent loop")
else:
    print("Could not find loop to fix")
