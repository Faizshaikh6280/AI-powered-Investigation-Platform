import re

with open('frontend/src/components/InvestigationDashboard.tsx', 'r') as f:
    content = f.read()

# Add useTheme import
import_str = "import { Play, Pause, Activity, User, Briefcase, FileWarning, Crosshair, Map, ShieldAlert, Cpu, Download, Moon, Sun } from 'lucide-react';\nimport { useTheme } from 'next-themes';"
content = re.sub(r"import \{ Play.*?\} from 'lucide-react';", import_str, content, flags=re.DOTALL)

# Add useTheme hook inside component
content = content.replace(
    'const [graphData, setGraphData] = useState<any>(null);',
    "const [graphData, setGraphData] = useState<any>(null);\n  const { theme, setTheme } = useTheme();"
)

# Update cytoscape style to use theme colors
cy_style_light = """
              'color': theme === 'light' ? '#334155' : '#fff',
"""
content = content.replace("'color': '#fff',", cy_style_light)

# Add theme toggle button next to legend
legend = """          {/* GRAPH LEGEND - Top Right */}
          <div className="absolute top-4 right-4 z-10 flex gap-2">"""
          
new_legend = """          {/* GRAPH LEGEND & THEME TOGGLE - Top Right */}
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="bg-white/80 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-700 p-2 rounded-xl text-slate-800 dark:text-slate-200 shadow-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>"""
content = content.replace(legend, new_legend)

with open('frontend/src/components/InvestigationDashboard.tsx', 'w') as f:
    f.write(content)
print("Updated Theme")
