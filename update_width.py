import re

with open('frontend/src/components/InvestigationDashboard.tsx', 'r') as f:
    content = f.read()

# Change w-[450px] to w-[35vw] max-w-[600px] min-w-[450px]
content = content.replace('w-[450px]', 'w-[35vw] max-w-[600px] min-w-[450px]')

# Make typography better in prose
content = content.replace('prose prose-sm dark:prose-invert max-w-none', 'prose prose-base dark:prose-invert max-w-none prose-headings:font-black prose-p:leading-relaxed prose-a:text-indigo-500')

with open('frontend/src/components/InvestigationDashboard.tsx', 'w') as f:
    f.write(content)
print("Updated panel width and typography")
