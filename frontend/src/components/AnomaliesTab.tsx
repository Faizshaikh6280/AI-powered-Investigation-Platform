import React, { useState, useEffect } from 'react';
import { AlertTriangle, Filter, Search, ShieldAlert, FileText, ChevronRight, PlayCircle, Loader2 } from 'lucide-react';
import { cn } from '../utils/cn';

export default function AnomaliesTab({ onAnomalySelect }: { onAnomalySelect: (id: string) => void }) {
  const [stats, setStats] = useState({ total: 0, critical: 0, high: 0, medium: 0, low: 0 });
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchStats = () => {
    fetch('http://localhost:8000/api/anomalies/stats')
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(console.error);
  };

  const fetchAnomalies = () => {
    setLoading(true);
    fetch(`http://localhost:8000/api/anomalies?search=${search}`)
      .then(r => r.json())
      .then(d => { setAnomalies(d.anomalies || []); setLoading(false); })
      .catch(err => { console.error(err); setLoading(false); });
  };

  useEffect(() => {
    fetchStats();
    fetchAnomalies();
  }, [search]);



  const getSeverityColor = (sev: string) => {
    switch(sev) {
      case 'CRITICAL': return 'bg-destructive/20 text-destructive border-destructive/50';
      case 'HIGH': return 'bg-orange-500/20 text-orange-500 border-orange-500/50';
      case 'MEDIUM': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50';
      default: return 'bg-blue-500/20 text-blue-500 border-blue-500/50';
    }
  };

  return (
    <div className="flex flex-col h-full bg-background font-sans p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <ShieldAlert className="w-7 h-7 text-destructive" /> 
            Automated Threat & Anomaly Radar
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Real-time graph analytics, behavioral tracking, and Isolation Forest ML.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 px-4 py-2 rounded-full border border-border">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Analytics Engine Active
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-8">
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm text-center">
          <div className="text-4xl font-black text-foreground mb-1">{stats.total}</div>
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Detected</div>
        </div>
        <div className="bg-destructive/5 border border-destructive/20 p-5 rounded-xl shadow-sm text-center">
          <div className="text-4xl font-black text-destructive mb-1">{stats.critical}</div>
          <div className="text-xs font-bold text-destructive/80 uppercase tracking-widest">Critical</div>
        </div>
        <div className="bg-orange-500/5 border border-orange-500/20 p-5 rounded-xl shadow-sm text-center">
          <div className="text-4xl font-black text-orange-500 mb-1">{stats.high}</div>
          <div className="text-xs font-bold text-orange-500/80 uppercase tracking-widest">High</div>
        </div>
        <div className="bg-yellow-500/5 border border-yellow-500/20 p-5 rounded-xl shadow-sm text-center">
          <div className="text-4xl font-black text-yellow-500 mb-1">{stats.medium}</div>
          <div className="text-xs font-bold text-yellow-500/80 uppercase tracking-widest">Medium</div>
        </div>
        <div className="bg-blue-500/5 border border-blue-500/20 p-5 rounded-xl shadow-sm text-center">
          <div className="text-4xl font-black text-blue-500 mb-1">{stats.low}</div>
          <div className="text-xs font-bold text-blue-500/80 uppercase tracking-widest">Low</div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm flex-1 flex flex-col min-h-[500px]">
        <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/30">
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search anomalies by entity or reason..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-background border border-border outline-none text-sm text-foreground pl-9 pr-4 py-2 w-80 rounded-lg focus:border-primary transition-colors"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground bg-background border border-border rounded-lg hover:bg-secondary transition-colors">
            <Filter className="w-4 h-4" /> Filter Results
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-secondary/50 sticky top-0 z-10">
              <tr>
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border">Severity</th>
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border">Entity</th>
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border">Entity Type</th>
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border">Anomaly Type</th>
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border">Score</th>
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border">Status</th>
                <th className="p-4 border-b border-border"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-muted-foreground">Loading anomaly database...</td>
                </tr>
              ) : anomalies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-muted-foreground font-medium">No anomalies detected for the selected dataset/time range.</td>
                </tr>
              ) : (
                anomalies.map((a, i) => (
                  <tr key={i} onClick={() => onAnomalySelect(a)} className="hover:bg-secondary/30 transition-colors border-b border-border cursor-pointer group">
                    <td className="p-4">
                      <span className={cn("px-3 py-1 rounded-full text-[10px] font-black tracking-widest border", getSeverityColor(a.severity))}>
                        {a.severity}
                      </span>
                    </td>
                    <td className="p-4 font-semibold text-foreground">{a.entityId}</td>
                    <td className="p-4 text-sm text-muted-foreground">{a.entityType}</td>
                    <td className="p-4 text-sm font-medium text-foreground">{a.type}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{a.score.toFixed(0)}</span>
                        <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className={cn("h-full", getSeverityColor(a.severity).split(' ')[0].replace('/20',''))} style={{width: `${a.score}%`}} />
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">
                        {a.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button className="text-muted-foreground group-hover:text-primary transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
