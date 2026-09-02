import React from 'react';
import { X, Network, ExternalLink, ShieldAlert, FileText, Activity } from 'lucide-react';
import { cn } from '../utils/cn';

export default function AnomalyInvestigationDrawer({ anomaly, onClose, onViewOnGraph }: { anomaly: any, onClose: () => void, onViewOnGraph: (id: string) => void }) {
  if (!anomaly) return null;

  const getSeverityColor = (sev: string) => {
    switch(sev) {
      case 'CRITICAL': return 'text-destructive';
      case 'HIGH': return 'text-orange-500';
      case 'MEDIUM': return 'text-yellow-500';
      default: return 'text-blue-500';
    }
  };

  return (
    <div className="absolute top-0 right-0 bottom-0 w-[450px] bg-background border-l border-border shadow-2xl z-30 flex flex-col">
      <div className="flex items-center justify-between p-5 border-b border-border bg-card">
        <h3 className="font-bold text-foreground flex items-center gap-2 text-lg">
          <ShieldAlert className={cn("w-5 h-5", getSeverityColor(anomaly.severity))} /> 
          Anomaly Investigation
        </h3>
        <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        
        {/* Header Block */}
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] font-black tracking-widest uppercase text-muted-foreground mb-1">Entity Flagged</div>
              <div className="text-2xl font-black text-foreground">{anomaly.entityId}</div>
              <div className="text-sm font-medium text-muted-foreground mt-0.5">{anomaly.entityType}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-black tracking-widest uppercase text-muted-foreground mb-1">Score</div>
              <div className={cn("text-3xl font-black", getSeverityColor(anomaly.severity))}>
                {anomaly.score.toFixed(0)}
              </div>
            </div>
          </div>
          
          <button 
            onClick={() => onViewOnGraph(anomaly.entityId)}
            className="w-full py-3 px-4 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
          >
            <Network className="w-4 h-4" /> View on Graph
          </button>
        </div>

        {/* Explainability Block */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <FileText className="w-4 h-4" /> Why was this detected?
          </h4>
          <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-5 space-y-3">
            {anomaly.reasons && anomaly.reasons.length > 0 ? (
              <ul className="space-y-2">
                {anomaly.reasons.map((r: string, i: number) => (
                  <li key={i} className="text-sm text-foreground flex items-start gap-2">
                    <span className="text-destructive mt-0.5">•</span>
                    <span className="font-medium leading-relaxed">{r}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-muted-foreground">No specific reasons provided by engine.</div>
            )}
          </div>
        </div>

        {/* Algorithmic Breakdown */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <Activity className="w-4 h-4" /> Detection Methods
          </h4>
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground font-medium">Machine Learning (IF)</span>
              <span className="font-bold text-foreground">Triggered</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground font-medium">Graph Structural (GDS)</span>
              <span className="font-bold text-foreground">Triggered</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground font-medium">Temporal Deviation</span>
              <span className="font-bold text-muted-foreground opacity-50">N/A</span>
            </div>
          </div>
        </div>

        {/* Raw Metadata (Metrics) */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Calculated Features</h4>
          <div className="bg-secondary/30 rounded-xl p-4 text-xs font-mono text-muted-foreground overflow-x-auto border border-border">
            {anomaly.metrics ? JSON.stringify(anomaly.metrics, null, 2) : 'No metrics logged.'}
          </div>
        </div>

      </div>
    </div>
  );
}
