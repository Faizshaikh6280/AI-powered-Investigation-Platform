import codecs
with codecs.open('backend/app/agents/prompts.py', 'r', 'utf-8', errors='ignore') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if "USE MODERN, COLORFUL SVG ICONS OR EMOJIS" in line:
        new_lines.append("5. USE MODERN, COLORFUL EMOJIS for each section and target card to make the UI feel modern and visually appealing.\n")
    else:
        new_lines.append(line)

with codecs.open('backend/app/agents/prompts.py', 'w', 'utf-8') as f:
    f.writelines(new_lines)
print("Fixed prompts syntax error")
