'use client';

import React from 'react';
import { 
  X, Network, ExternalLink, ShieldAlert, FileText, Activity, 
  Clock, MapPin, Hash, Sparkles, CheckCircle2, ChevronRight, Layers,
  Compass, AlertCircle, Phone, ArrowLeftRight, Landmark
} from 'lucide-react';
import { AnomalyFinding } from '../services/apiClient';
import { cn } from '../utils/cn';

interface AnomalyInvestigationDrawerProps {
  anomaly: AnomalyFinding | null;
  onClose: () => void;
  onViewOnGraph: (entityId: string) => void;
  onViewInTimeline?: (entityId: string) => void;
  onViewOnMap?: (entityId: string) => void;
}

export default function AnomalyInvestigationDrawer({
  anomaly,
  onClose,
  onViewOnGraph,
  onViewInTimeline,
  onViewOnMap,
}: AnomalyInvestigationDrawerProps) {
  if (!anomaly) return null;

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return 'text-destructive bg-destructive/10 border-destructive/30';
      case 'HIGH':
        return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
      case 'MEDIUM':
        return 'text-amber-500 bg-amber-500/10 border-amber-500/30';
      default:
        return 'text-blue-500 bg-blue-500/10 border-blue-500/30';
    }
  };

  const contributing = anomaly.contributingDetectors || [anomaly.type];
  const metrics = anomaly.metrics || {};
  const collisions = Array.isArray(metrics.collisions) ? metrics.collisions : [];
  const aliases = Array.isArray(metrics.aliases) ? metrics.aliases : [];

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[520px] bg-background border-l border-border shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Drawer Header */}
      <div className="flex items-center justify-between p-5 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg border", getSeverityBadge(anomaly.severity))}>
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-base">
              Anomaly Intelligence Finding
            </h3>
            <span className="text-xs font-mono text-muted-foreground">{anomaly.id}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Title & Entity Overview Card */}
        <div className="bg-card border border-border p-5 rounded-xl space-y-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Target Entity
              </div>
              <div className="text-xl font-black text-foreground font-mono">
                {anomaly.entityId}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Type: <span className="text-foreground font-semibold">{anomaly.entityType || 'Person'}</span>
                {anomaly.domain && ` • Domain: ${anomaly.domain}`}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Unified Score
              </div>
              <div className={cn("text-3xl font-black", 
                anomaly.severity === 'CRITICAL' ? 'text-destructive' :
                anomaly.severity === 'HIGH' ? 'text-orange-500' : 'text-amber-500'
              )}>
                {anomaly.score?.toFixed(0) || 0}
                <span className="text-xs font-bold text-muted-foreground">/100</span>
              </div>
              {anomaly.confidence && (
                <div className="text-[11px] font-mono text-emerald-500 font-bold">
                  {(anomaly.confidence * 100).toFixed(0)}% Confidence
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
            <span className={cn("text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded border", getSeverityBadge(anomaly.severity))}>
              {anomaly.severity}
            </span>
            {anomaly.investigativePriority && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
                Priority: {anomaly.investigativePriority}
              </span>
            )}
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
              Status: {anomaly.status || 'NEW'}
            </span>
          </div>

          {/* Quick Cross-Domain Actions */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
            <button
              onClick={() => onViewOnGraph(anomaly.entityId)}
              className="py-2 px-3 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Network className="w-3.5 h-3.5" /> View on Graph
            </button>

            {onViewInTimeline && (
              <button
                onClick={() => onViewInTimeline(anomaly.entityId)}
                className="py-2 px-3 bg-secondary text-foreground text-xs font-bold rounded-lg hover:bg-secondary/80 border border-border transition-all flex items-center justify-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5 text-primary" /> Timeline
              </button>
            )}

            {onViewOnMap && (
              <button
                onClick={() => onViewOnMap(anomaly.entityId)}
                className="py-2 px-3 bg-secondary text-foreground text-xs font-bold rounded-lg hover:bg-secondary/80 border border-border transition-all flex items-center justify-center gap-1.5"
              >
                <Compass className="w-3.5 h-3.5 text-emerald-500" /> Map
              </button>
            )}
          </div>
        </div>

        {/* WHY FLAGGED (Factual Observations) */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <FileText className="w-4 h-4 text-primary" />
            Why Flagged (Investigative Reasoning)
          </div>

          <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-5 space-y-2.5">
            {anomaly.reasons && anomaly.reasons.length > 0 ? (
              <ul className="space-y-2 text-xs text-foreground">
                {anomaly.reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2.5 leading-relaxed">
                    <span className="text-destructive font-bold mt-0.5">•</span>
                    <span className="font-medium">{r}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-muted-foreground italic">
                Pattern flagged based on multivariate distribution deviation across population feature vectors.
              </div>
            )}
          </div>
        </div>

        {/* CONTRIBUTING DETECTOR ENGINES */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Activity className="w-4 h-4 text-emerald-500" />
            Contributing Detector Engines ({contributing.length})
          </div>

          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            {contributing.map((det, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-border/50 last:border-none">
                <span className="font-mono font-bold text-foreground">
                  {det}
                </span>
                <span className="text-emerald-500 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Corroborated
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* MULTI-DOMAIN COLLISIONS IF PRESENT */}
        {collisions.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Cross-Domain Temporal Collisions ({collisions.length})
            </div>

            <div className="space-y-2">
              {collisions.map((col: any, i: number) => (
                <div key={i} className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg text-xs space-y-1">
                  <div className="flex justify-between font-bold text-foreground">
                    <span>Amount: ₹{col.amount_inr?.toLocaleString() || 0}</span>
                    <span className="text-amber-500">Δt: {col.delta_minutes} min</span>
                  </div>
                  <div className="text-muted-foreground text-[11px]">
                    Correlated with <span className="font-bold text-foreground">{col.comm_domain}</span>
                    {col.tower && ` near Tower ${col.tower}`}
                    {col.ip && ` from IP ${col.ip}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ALIAS PROLIFERATION IF PRESENT */}
        {aliases.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Operating Aliases Discovered
            </div>
            <div className="flex flex-wrap gap-1.5">
              {aliases.map((alias: string, i: number) => (
                <span key={i} className="text-xs bg-secondary border border-border px-2.5 py-1 rounded-md text-foreground font-semibold">
                  {alias}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* COMPUTED METRICS TABLE */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Layers className="w-4 h-4 text-primary" />
            Computed Feature Metrics
          </div>

          <div className="bg-card border border-border rounded-xl p-4 overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <tbody className="divide-y divide-border font-mono">
                {Object.entries(metrics)
                  .filter(([k]) => !['collisions', 'aliases', 'reasons'].includes(k))
                  .slice(0, 12)
                  .map(([key, value], i) => (
                    <tr key={i} className="hover:bg-secondary/30">
                      <td className="py-2 text-muted-foreground pr-4 font-sans font-medium">
                        {key.replace(/_/g, ' ')}
                      </td>
                      <td className="py-2 text-foreground font-bold text-right truncate max-w-[200px]">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* EVIDENCE REFERENCES */}
        {((anomaly.evidence_refs && anomaly.evidence_refs.length > 0) || (anomaly.canonical_event_refs && anomaly.canonical_event_refs.length > 0)) && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Hash className="w-4 h-4 text-primary" />
              Evidence & Canonical Event Links
            </div>

            <div className="bg-secondary/40 border border-border rounded-xl p-4 text-xs font-mono text-muted-foreground space-y-1.5">
              {anomaly.evidence_refs?.map((ref, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-primary font-bold">Evidence:</span> {ref}
                </div>
              ))}
              {anomaly.canonical_event_refs?.slice(0, 5).map((ref, i) => (
                <div key={i} className="flex items-center gap-1.5 truncate">
                  <span className="text-emerald-500 font-bold">Event:</span> {ref}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
