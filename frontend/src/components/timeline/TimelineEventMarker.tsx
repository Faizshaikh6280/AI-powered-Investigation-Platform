import React, { useState } from 'react';
import { 
  Smartphone, CreditCard, MessagesSquare, MapPin, Globe, AlertTriangle, 
  Sparkles, Link2, ShieldAlert
} from 'lucide-react';
import { TimelineCanonicalEvent } from '../../services/apiClient';
import { useTimelineStore } from '../../store/useTimelineStore';
import { cn } from '../../utils/cn';

interface TimelineEventMarkerProps {
  event: TimelineCanonicalEvent;
  xPosition: number; // percentage or px along time axis
  laneIndex: number;
  isSelected: boolean;
  onSelect: (event: TimelineCanonicalEvent) => void;
}

const DOMAIN_STYLES: Record<string, { icon: any; color: string; bg: string; border: string; glow: string }> = {
  TELECOM: { icon: Smartphone, color: 'text-indigo-400', bg: 'bg-indigo-500', border: 'border-indigo-400', glow: 'shadow-[0_0_10px_rgba(99,102,241,0.5)]' },
  FINANCIAL: { icon: CreditCard, color: 'text-emerald-400', bg: 'bg-emerald-500', border: 'border-emerald-400', glow: 'shadow-[0_0_10px_rgba(16,185,129,0.5)]' },
  SOCIAL: { icon: MessagesSquare, color: 'text-pink-400', bg: 'bg-pink-500', border: 'border-pink-400', glow: 'shadow-[0_0_10px_rgba(236,72,153,0.5)]' },
  LOCATION: { icon: MapPin, color: 'text-amber-400', bg: 'bg-amber-500', border: 'border-amber-400', glow: 'shadow-[0_0_10px_rgba(245,158,11,0.5)]' },
  NETWORK: { icon: Globe, color: 'text-cyan-400', bg: 'bg-cyan-500', border: 'border-cyan-400', glow: 'shadow-[0_0_10px_rgba(6,182,212,0.5)]' },
  ANALYTICAL: { icon: AlertTriangle, color: 'text-rose-400', bg: 'bg-rose-500', border: 'border-rose-400', glow: 'shadow-[0_0_10px_rgba(244,63,94,0.5)]' },
};

export const TimelineEventMarker: React.FC<TimelineEventMarkerProps> = ({
  event,
  xPosition,
  laneIndex,
  isSelected,
  onSelect
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const cfg = DOMAIN_STYLES[event.domain] || DOMAIN_STYLES.ANALYTICAL;
  const isAnomaly = event.anomaly_score > 0 || event.anomaly_ids.length > 0;
  const hasCorrelation = event.correlation_ids.length > 0;
  const isDerived = event.epistemic_status === 'DERIVED';

  const Icon = cfg.icon;

  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-pointer transition-transform duration-150 z-10"
      style={{ left: `${xPosition}%` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect(event)}
    >
      {/* Visual Marker Node */}
      <div
        className={cn(
          "flex items-center justify-center transition-all duration-200 relative group",
          // Node Shape & Size based on Epistemic Status / Anomaly
          isAnomaly
            ? "w-6 h-6 rotate-45 rounded-sm bg-destructive text-white shadow-[0_0_12px_rgba(239,68,68,0.7)]"
            : isDerived
              ? "w-5 h-5 rounded-md bg-amber-500 text-black shadow-sm"
              : "w-4 h-4 rounded-full border-2 border-background shadow-sm",
          !isAnomaly && !isDerived && cfg.bg,
          isSelected && "ring-4 ring-primary ring-offset-2 ring-offset-background scale-125 z-30",
          isHovered && "scale-125 z-30"
        )}
      >
        {/* Core Icon in large/anomalous markers */}
        {isAnomaly ? (
          <ShieldAlert className="w-3.5 h-3.5 -rotate-45" />
        ) : hasCorrelation ? (
          <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
        ) : null}

        {/* Ring indicator for correlated events */}
        {hasCorrelation && !isAnomaly && (
          <span className="absolute -inset-1 rounded-full border border-dashed border-primary animate-spin-slow opacity-80 pointer-events-none" />
        )}
      </div>

      {/* Floating Hover Tooltip */}
      {isHovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl p-3 z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5 mb-2">
            <div className="flex items-center gap-1.5">
              <Icon className={cn("w-3.5 h-3.5", cfg.color)} />
              <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">{event.event_type}</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">{event.normalized_timestamp.slice(11, 19)} UTC</span>
          </div>

          <div className="space-y-1 text-xs">
            {event.entity_name && (
              <div className="font-semibold text-foreground truncate">
                {event.entity_name}
              </div>
            )}
            {event.amount_inr && event.amount_inr > 0 ? (
              <div className="text-emerald-400 font-mono font-bold">
                ₹{event.amount_inr.toLocaleString()} {event.channel ? `via ${event.channel}` : ''}
              </div>
            ) : null}
            {event.counterparty && (
              <div className="text-[11px] text-muted-foreground truncate">
                Counterparty: <span className="text-foreground">{event.counterparty}</span>
              </div>
            )}
            {event.location_name && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                <MapPin className="w-3 h-3 flex-shrink-0 text-amber-400" />
                <span className="truncate">{event.location_name}</span>
              </div>
            )}
            {isAnomaly && (
              <div className="mt-1.5 pt-1.5 border-t border-destructive/20 text-destructive text-[11px] font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{event.anomaly_reasons[0] || 'Flagged Anomaly'}</span>
              </div>
            )}
            {hasCorrelation && (
              <div className="text-[10px] text-primary flex items-center gap-1 mt-1">
                <Link2 className="w-3 h-3 flex-shrink-0" />
                <span>{event.correlation_ids.length} Temporal Correlation(s)</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
