import re

with open('frontend/src/components/InvestigationDashboard.tsx', 'r') as f:
    content = f.read()

start_idx = content.find('return (')
if start_idx == -1:
    print("Could not find 'return ('")
    exit(1)

new_return = """return (
      <div className="relative h-full w-full bg-slate-50 dark:bg-[#0a0f1d] text-slate-800 dark:text-slate-200 overflow-hidden">
        
        {/* FULL SCREEN CYTOSCAPE CANVAS */}
        <div ref={cyRef} className="absolute inset-0 w-full h-full z-0" />
        
        {/* GRAPH LEGEND - Top Right */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <div className="bg-white/80 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs font-mono flex items-center gap-2 shadow-lg">
            <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" /> Kingpin
          </div>
          <div className="bg-white/80 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs font-mono flex items-center gap-2 shadow-lg">
            <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" /> Broker
          </div>
        </div>

        {/* FLOATING GLASS DOSSIER - Left Side */}
        <div className="absolute top-4 left-4 bottom-4 w-[450px] flex flex-col border border-slate-200/50 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl rounded-2xl shadow-2xl z-10 overflow-hidden transition-all">
          
          {/* Header */}
          <div className="p-5 border-b border-slate-200/50 dark:border-slate-700/50 flex items-center gap-3 bg-gradient-to-r from-transparent to-slate-100/30 dark:to-slate-800/30">
            <ShieldAlert className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-black tracking-widest text-slate-800 dark:text-slate-100 uppercase">Agentic Forensics</h2>
          </div>
  
          {/* Controls */}
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-widest">Target Syndicate</label>
              <select 
                className="w-full bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={selectedCommunity || ''}
                onChange={(e) => setSelectedCommunity(Number(e.target.value))}
              >
                <option value="" disabled>-- Select Cluster --</option>
                {communities.map(c => (
                  <option key={c.communityId} value={c.communityId}>
                    Cell #{c.communityId} ({c.size} Targets)
                  </option>
                ))}
              </select>
            </div>
            
            <button 
              onClick={runSynthesis}
              disabled={!selectedCommunity || dossierState.status === 'running'}
              className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/30"
            >
              {dossierState.status === 'running' ? <Activity className="w-5 h-5 animate-spin" /> : <Cpu className="w-5 h-5" />}
              Execute AI Investigation
            </button>
          </div>
  
          {/* Dossier Output */}
          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
            {dossierState.status === 'running' && (
              <div className="space-y-3">
                <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400 animate-pulse flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Analyzing Graph Topologies...
                </div>
                {dossierState.messages.map((msg, i) => (
                  <div key={i} className="text-sm font-medium text-slate-600 dark:text-slate-300 flex items-center gap-3 bg-white/40 dark:bg-slate-800/40 p-2 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]" />
                    {msg}
                  </div>
                ))}
              </div>
            )}
            
            {dossierState.status === 'complete' && (
              <div 
                className="prose prose-sm dark:prose-invert max-w-none agent-dossier" 
                dangerouslySetInnerHTML={{ __html: dossierState.htmlContent }} 
              />
            )}
          </div>
          
          {/* Export Footer */}
          {dossierState.status === 'complete' && (
            <div className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200/50 dark:border-slate-700/50">
              <button 
                onClick={() => {
                  import('html2pdf.js').then((html2pdf) => {
                    const element = document.querySelector('.agent-dossier');
                    if (element) {
                      const opt = {
                        margin: 0.5,
                        filename: `Target_Dossier_${selectedCommunity}.pdf`,
                        image: { type: 'jpeg', quality: 0.98 },
                        html2canvas: { scale: 2 },
                        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
                      };
                      html2pdf.default().set(opt).from(element).save();
                    }
                  });
                }}
                disabled={dossierState.status !== 'complete'}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl transition-colors border border-slate-300 dark:border-slate-600 shadow-sm"
              >
                <Download className="w-4 h-4" />
                EXPORT WARRANT (PDF)
              </button>
            </div>
          )}
        </div>
      </div>
    );
}
"""

content = content[:start_idx] + new_return

with open('frontend/src/components/InvestigationDashboard.tsx', 'w') as f:
    f.write(content)
print("Updated InvestigationDashboard.tsx")
