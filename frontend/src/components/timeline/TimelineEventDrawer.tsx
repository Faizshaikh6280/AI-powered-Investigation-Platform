import React, { useState } from 'react';
import { 
  X, Clock, MapPin, Smartphone, CreditCard, MessagesSquare, Globe, 
  AlertTriangle, ShieldCheck, Share2, FileText, Bookmark, ExternalLink, 
  Compass, Link2, Hash, Database, CheckCircle2, Copy, Check
} from 'lucide-react';
import { TimelineCanonicalEvent } from '../../services/apiClient';
import { useTimelineStore } from '../../store/useTimelineStore';
import { cn } from '../../utils/cn';

interface EventDrawerProps {
  event: TimelineCanonicalEvent | null;
  onClose: () => void;
  onNavigateToGraph?: (entityId: string) => void;
  onNavigateToMap?: () => void;
}

export const TimelineEventDrawer: React.FC<EventDrawerProps> = ({
  event,
  onClose,
  onNavigateToGraph,
  onNavigateToMap
}) => {
  const { setContextEventId } = useTimelineStore();
  const [copiedHash, setCopiedHash] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [reportAdded, setReportAdded] = useState(false);

  if (!event) return null;

  const copyHash = () => {
    if (event.evidence_sha256) {
      navigator.clipboard.writeText(event.evidence_sha256);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const isAnomaly = event.anomaly_score > 0 || event.anomaly_ids.length > 0;

  return (
    <div className="w-96 flex-shrink-0 border-l border-border bg-card/95 backdrop-blur-xl flex flex-col h-full z-20 shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-primary">{event.event_id}</span>
          <span className={cn(
            "text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase",
            event.epistemic_status === 'OBSERVED' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
            event.epistemic_status === 'CORRELATED' ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" :
            "bg-amber-500/10 text-amber-400 border-amber-500/20"
          )}>
            {event.epistemic_status}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsBookmarked(!isBookmarked)}
            className={cn(
              "p-1.5 rounded hover:bg-secondary transition-colors",
              isBookmarked ? "text-amber-400 fill-current" : "text-muted-foreground hover:text-foreground"
            )}
            title="Bookmark Event"
          >
            <Bookmark className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Event Title & Timestamp */}
        <div className="space-y-2">
          <h3 className="text-base font-bold text-foreground">{event.event_type}</h3>
          <div className="bg-secondary/60 border border-border rounded-lg p-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">UTC Timestamp:</span>
              <span className="font-mono font-bold text-foreground">{event.normalized_timestamp}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Raw Recorded:</span>
              <span className="font-mono text-muted-foreground">{event.raw_timestamp}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Timezone Offset:</span>
              <span className="font-mono text-foreground font-semibold">{event.timezone_offset || 'UNKNOWN'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Precision & Confidence:</span>
              <span className="font-mono text-foreground">{event.timestamp_precision} ({(event.timestamp_confidence * 100).toFixed(0)}%)</span>
            </div>
          </div>
        </div>

        {/* Involved Parties */}
        <div className="space-y-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Entity Identification</h4>
          <div className="bg-secondary/40 border border-border rounded-lg p-3 space-y-2">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Primary Actor:</span>
              <div className="text-sm font-bold text-foreground mt-0.5">
                {event.entity_name || (event.actor_entities[0] || 'Unresolved Entity')}
              </div>
              {event.z_cluster_id && (
                <span className="inline-block mt-1 text-[10px] font-mono bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded">
                  Cluster: {event.z_cluster_id}
                </span>
              )}
            </div>

            {event.actor_entities.length > 0 && (
              <div className="pt-2 border-t border-border/40">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Associated Identifiers:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {event.actor_entities.map((a, i) => (
                    <span key={i} className="text-[11px] font-mono bg-card px-1.5 py-0.5 rounded border border-border text-foreground">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {event.counterparty && (
              <div className="pt-2 border-t border-border/40">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Counterparty:</span>
                <div className="text-xs font-mono font-bold text-foreground mt-0.5">
                  {event.counterparty}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Domain Telemetry / Financial Details */}
        {event.domain === 'FINANCIAL' && (
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Financial Telemetry</h4>
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Amount:</span>
                <span className="text-base font-mono font-bold text-emerald-400">
                  ₹{event.amount_inr ? event.amount_inr.toLocaleString() : '0.00'}
                </span>
              </div>
              {event.channel && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Channel:</span>
                  <span className="font-mono font-bold text-foreground">{event.channel}</span>
                </div>
              )}
              {event.txn_type && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-mono text-foreground">{event.txn_type}</span>
                </div>
              )}
              {event.narration && (
                <div className="pt-1 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Narration: </span>
                  {event.narration}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Geospatial Telemetry */}
        {(event.location_name || event.latitude !== null) && (
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Geospatial Telemetry</h4>
            <div className="bg-secondary/40 border border-border rounded-lg p-3 space-y-2">
              {event.location_name && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span className="text-xs font-medium text-foreground">{event.location_name}</span>
                </div>
              )}
              {event.latitude !== null && event.longitude !== null && (
                <div className="flex items-center justify-between text-xs font-mono text-muted-foreground pt-1 border-t border-border/40">
                  <span>Coordinates:</span>
                  <span className="text-foreground">{event.latitude?.toFixed(4)}, {event.longitude?.toFixed(4)}</span>
                </div>
              )}
              {event.cell_tower_id && (
                <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                  <span>Cell Tower ID:</span>
                  <span className="text-foreground">{event.cell_tower_id}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Anomaly Finding Details */}
        {isAnomaly && (
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-destructive flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Analytical Anomaly Flag</span>
            </h4>
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-destructive font-bold">Severity:</span>
                <span className="font-mono font-bold uppercase text-destructive">{event.risk_level}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Anomaly Score:</span>
                <span className="font-mono font-bold text-destructive">{event.anomaly_score.toFixed(1)} / 100</span>
              </div>
              {event.anomaly_reasons.length > 0 && (
                <div className="text-xs text-foreground font-medium pt-1 border-t border-destructive/20">
                  {event.anomaly_reasons.map((r, i) => (
                    <div key={i} className="flex items-start gap-1 mt-1">
                      <span className="text-destructive">•</span>
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cryptographic Evidence Lineage */}
        <div className="space-y-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Chain of Custody Provenance</span>
          </h4>
          <div className="bg-secondary/50 border border-border rounded-lg p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Source Evidence ID:</span>
              <span className="font-mono font-bold text-foreground">{event.evidence_id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">File Source:</span>
              <span className="font-mono text-foreground truncate max-w-[160px]">{event.evidence_filename || 'evidence.raw'}</span>
            </div>
            {event.evidence_sha256 && (
              <div className="pt-2 border-t border-border/40">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">SHA-256 Checksum:</span>
                  <button onClick={copyHash} className="text-[10px] text-primary flex items-center gap-1 hover:underline">
                    {copiedHash ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedHash ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="font-mono text-[10px] text-muted-foreground break-all bg-card/60 p-1.5 rounded border border-border">
                  {event.evidence_sha256}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions Strip */}
        <div className="space-y-2 pt-2 border-t border-border">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Investigation Actions</h4>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setContextEventId(event.event_id, 15)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-secondary hover:bg-secondary/80 border border-border text-foreground text-xs font-semibold rounded-md transition-colors"
            >
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span>±15m Context</span>
            </button>

            {onNavigateToGraph && (
              <button
                onClick={() => onNavigateToGraph(event.z_cluster_id || event.entity_name || event.actor_entities[0])}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-secondary hover:bg-secondary/80 border border-border text-foreground text-xs font-semibold rounded-md transition-colors"
              >
                <Share2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Open in Graph</span>
              </button>
            )}

            {onNavigateToMap && (event.latitude !== null || event.location_name) && (
              <button
                onClick={onNavigateToMap}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-secondary hover:bg-secondary/80 border border-border text-foreground text-xs font-semibold rounded-md transition-colors"
              >
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>Center Map</span>
              </button>
            )}

            <button
              onClick={() => {
                setReportAdded(true);
                setTimeout(() => setReportAdded(false), 2000);
              }}
              className={cn(
                "flex items-center justify-center gap-1.5 px-3 py-2 border text-xs font-semibold rounded-md transition-colors",
                reportAdded
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-secondary hover:bg-secondary/80 border-border text-foreground"
              )}
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span>{reportAdded ? 'Added to Report' : 'Add to Report'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
