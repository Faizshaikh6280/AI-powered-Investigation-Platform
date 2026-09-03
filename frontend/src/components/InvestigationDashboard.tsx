import React, { useState, useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import { Play, Pause, Activity, User, Briefcase, FileWarning, Crosshair, Map, ShieldAlert, Cpu, Download } from 'lucide-react';
import { cn } from '../utils/cn';
import { apiClient } from '../services/apiClient';

interface Props {
  activeCaseId: string;
}

export function InvestigationDashboard({ activeCaseId }: Props) {
  const cyRef = useRef<HTMLDivElement>(null);
  const cyInstance = useRef<any>(null);

  const [communities, setCommunities] = useState<any[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<number | null>(null);
  
  const [dossierState, setDossierState] = useState<{
    status: 'idle' | 'running' | 'complete' | 'error';
    messages: string[];
    htmlContent: string;
  }>({ status: 'idle', messages: [], htmlContent: '' });

  const [graphData, setGraphData] = useState<any>(null);

  useEffect(() => {
    // Project graph then run algorithms on load
    apiClient.request('/api/v1/investigation/project-graph', { method: 'POST' })
      .then(() => apiClient.request('/api/v1/investigation/run-algorithms', { method: 'POST' }))
      .then(res => setCommunities(res.communities || []))
      .catch(err => console.error('Failed to run GDS pipeline', err));
  }, []);

  useEffect(() => {
    if (!selectedCommunity) return;

    // Fetch subgraph data
    apiClient.request(`/api/v1/investigation/community/${selectedCommunity}/extract`)
      .then(res => {
        setGraphData(res);
        renderGraph(res);
      })
      .catch(err => console.error('Failed to extract subgraph', err));
  }, [selectedCommunity]);

  const renderGraph = (data: any) => {
    if (!cyRef.current) return;
    
    if (cyInstance.current) {
      cyInstance.current.destroy();
    }

    const elements: any[] = [];
    const offenders = data.offenders || [];
    const transactions = data.financial_transactions || [];
    const cdrs = data.communications_cdr || [];
    
    offenders.forEach((o: any) => {
      elements.push({
        data: {
          id: o.entity_id,
          label: o.display_name,
          pagerank: o.pagerank,
          betweenness: o.betweenness,
          role: o.pagerank > 2.5 ? 'boss' : (o.betweenness > 150 ? 'broker' : 'soldier')
        }
      });
    });

    transactions.forEach((tx: any) => {
      elements.push({
        data: {
          id: tx.tx_id,
          source: tx.sender_id,
          target: tx.receiver_id,
          label: `₹${tx.amount}`,
          type: 'tx'
        }
      });
    });

    cdrs.forEach((c: any) => {
      elements.push({
        data: {
          id: c.call_id,
          source: c.caller_id,
          target: c.callee_id,
          label: `${c.duration_sec}s`,
          type: 'call'
        }
      });
    });

    cyInstance.current = cytoscape({
      container: cyRef.current,
      elements: elements,
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'color': '#fff',
            'font-size': '10px',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'background-color': (ele: any) => {
              const role = ele.data('role');
              if (role === 'boss') return '#ef4444'; // Crimson
              if (role === 'broker') return '#f59e0b'; // Amber
              return '#10b981'; // Emerald
            },
            'width': (ele: any) => Math.max(20, ele.data('pagerank') * 10),
            'height': (ele: any) => Math.max(20, ele.data('pagerank') * 10),
            'border-width': (ele: any) => ele.data('betweenness') > 150 ? 4 : 0,
            'border-color': '#f59e0b',
            'border-style': 'solid'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#475569',
            'target-arrow-color': '#475569',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier'
          }
        }
      ],
      layout: {
        name: 'cose',
        animate: false
      }
    });
  };

  const runSynthesis = () => {
    if (!selectedCommunity) return;
    setDossierState({ status: 'running', messages: [], htmlContent: '' });

    const eventSource = new EventSource(`http://localhost:8000/api/v1/investigation/community/${selectedCommunity}/synthesize`);
    
    eventSource.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.status) {
        setDossierState(prev => ({ ...prev, messages: [...prev.messages, parsed.status] }));
      }
      if (parsed.dossier) {
        setDossierState(prev => ({ ...prev, htmlContent: parsed.dossier, status: 'complete' }));
        eventSource.close();
      }
    };
    
    eventSource.onerror = (err) => {
      console.error("SSE Error:", err);
      eventSource.close();
      setDossierState(prev => ({ ...prev, status: 'error' }));
    };
  };

  return (
    <div className="flex h-full w-full bg-[#0a0f1d] text-slate-200">
      {/* LEFT PANEL */}
      <div className="w-[35%] flex flex-col border-r border-slate-800 bg-slate-900/80 backdrop-blur-md overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-bold tracking-wider text-slate-100">MULTI-AGENT DOSSIER</h2>
        </div>

        {/* Controls */}
        <div className="p-4 border-b border-slate-800 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Select Detected Syndicate</label>
            <select 
              className="w-full bg-slate-800 border border-slate-700 rounded-md p-2 text-sm text-slate-200"
              value={selectedCommunity || ''}
              onChange={(e) => setSelectedCommunity(Number(e.target.value))}
            >
              <option value="" disabled>-- Select a Community Cluster --</option>
              {communities.map(c => (
                <option key={c.communityId} value={c.communityId}>
                  Cluster #{c.communityId} ({c.size} nodes)
                </option>
              ))}
            </select>
          </div>
          
          <button 
            onClick={runSynthesis}
            disabled={!selectedCommunity || dossierState.status === 'running'}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-md flex items-center justify-center gap-2 transition-colors"
          >
            {dossierState.status === 'running' ? <Activity className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
            Synthesize Intelligence
          </button>
        </div>

        {/* Dossier Output */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {dossierState.status === 'running' && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-amber-400 animate-pulse">Running Graph-RAG Agents...</div>
              {dossierState.messages.map((msg, i) => (
                <div key={i} className="text-xs text-slate-400 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {msg}
                </div>
              ))}
            </div>
          )}
          
          {dossierState.status === 'complete' && (
            <div 
              className="prose prose-invert prose-sm max-w-none agent-dossier" 
              dangerouslySetInnerHTML={{ __html: dossierState.htmlContent }} 
            />
          )}
        </div>
        
        {/* Export Footer */}
        {dossierState.status === 'complete' && (
          <div className="p-3 border-t border-slate-800">
            <button className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded flex items-center justify-center gap-2 text-sm">
              <Download className="w-4 h-4" /> Export Warrant Briefing (PDF)
            </button>
          </div>
        )}
      </div>

      {/* RIGHT PANEL */}
      <div className="w-[65%] flex flex-col relative bg-[#0f1523]">
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <div className="bg-slate-900/90 border border-slate-700 px-3 py-1.5 rounded-md text-xs font-mono flex items-center gap-2 shadow-lg">
            <div className="w-2 h-2 rounded-full bg-red-500" /> Kingpin (PageRank)
          </div>
          <div className="bg-slate-900/90 border border-slate-700 px-3 py-1.5 rounded-md text-xs font-mono flex items-center gap-2 shadow-lg">
            <div className="w-2 h-2 rounded-full bg-amber-500" /> Broker (Betweenness)
          </div>
        </div>

        {/* Cytoscape Canvas */}
        <div ref={cyRef} className="w-full h-full" />
      </div>
    </div>
  );
}
