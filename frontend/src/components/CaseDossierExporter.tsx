'use client';

import React from 'react';

export default function CaseDossierExporter() {
  const handleDownload = () => {
    window.open('/api/reports/pdf?case_id=SHADOW_SYNDICATE&title=Operation+Shadow+Syndicate', '_blank');
    alert('Generating PDF DOSSIER. Please wait...');
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="cyber-panel p-8 rounded-lg border border-cyanNeon/30 bg-panel shadow-[0_0_30px_rgba(0,240,255,0.1)]">
        <div className="text-center mb-8 border-b border-gray-800 pb-8">
          <h2 className="text-3xl font-bold text-white tracking-widest mb-2">CASE DOSSIER EXPORT</h2>
          <p className="text-gray-400 font-mono">GENERATE FINAL INTELLIGENCE REPORT</p>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-cyanNeon font-mono block mb-1">CASE ID</label>
              <div className="bg-obsidian border border-gray-700 p-2 rounded text-gray-300 font-mono text-sm">OP-SHADOW-SYNDICATE-001</div>
            </div>
            <div>
              <label className="text-xs text-cyanNeon font-mono block mb-1">LEAD INVESTIGATOR</label>
              <div className="bg-obsidian border border-gray-700 p-2 rounded text-gray-300 font-mono text-sm">System Admin</div>
            </div>
            <div>
              <label className="text-xs text-cyanNeon font-mono block mb-1">TARGET STATUS</label>
              <div className="bg-crimsonRed/10 border border-crimsonRed/30 p-2 rounded text-crimsonRed font-mono text-sm">KIDNAPPED / LOCATION IDENTIFIED</div>
            </div>
          </div>
          
          <div className="bg-obsidian/50 p-4 rounded border border-gray-800">
            <h4 className="text-cyanNeon font-mono text-sm mb-3">INCLUDED MODULES:</h4>
            <ul className="space-y-2 text-sm text-gray-400 font-mono">
              <li className="flex items-center"><span className="text-matrixGreen mr-2">✓</span> Executive Summary</li>
              <li className="flex items-center"><span className="text-matrixGreen mr-2">✓</span> Entity Resolution Profiles (5)</li>
              <li className="flex items-center"><span className="text-matrixGreen mr-2">✓</span> Link Analysis Graph</li>
              <li className="flex items-center"><span className="text-matrixGreen mr-2">✓</span> Chronological Timeline</li>
              <li className="flex items-center"><span className="text-matrixGreen mr-2">✓</span> Geospatial Evidence Map</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-center">
          <button 
            onClick={handleDownload}
            className="flex items-center px-8 py-4 bg-cyanNeon/10 border border-cyanNeon text-cyanNeon hover:bg-cyanNeon hover:text-black transition-all rounded shadow-[0_0_15px_rgba(0,240,255,0.2)] font-bold tracking-widest"
          >
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            GENERATE PDF DOSSIER
          </button>
        </div>
      </div>
    </div>
  );
}
