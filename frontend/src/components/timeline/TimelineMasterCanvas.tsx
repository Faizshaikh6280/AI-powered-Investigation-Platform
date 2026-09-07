import React, { useRef, useMemo } from 'react';
import { 
  Smartphone, CreditCard, MessagesSquare, MapPin, Globe, AlertTriangle, 
  Users, Share2, Zap, ShieldAlert, Sparkles
} from 'lucide-react';
import { 
  TimelineCanonicalEvent, TemporalCorrelation, ActivityBurst, 
  TemporalInconsistency, TimeBucketDensity 
} from '../../services/apiClient';
import { useTimelineStore } from '../../store/useTimelineStore';
import { TimelineEventMarker } from './TimelineEventMarker';
import { TimelineCorrelationConnector } from './TimelineCorrelationConnector';
import { cn } from '../../utils/cn';

interface MasterCanvasProps {
  events: TimelineCanonicalEvent[];
  correlations: TemporalCorrelation[];
  bursts: ActivityBurst[];
  inconsistencies: TemporalInconsistency[];
  densityBuckets: TimeBucketDensity[];
  onSelectEvent: (event: TimelineCanonicalEvent) => void;
}

const DEFAULT_DOMAIN_LANES = [
  { id: 'TELECOM', label: 'Telecom', icon: Smartphone, color: 'text-indigo-400', border: 'border-indigo-500/20', bg: 'bg-indigo-500/5' },
  { id: 'FINANCIAL', label: 'Financial', icon: CreditCard, color: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5' },
  { id: 'LOCATION', label: 'Location', icon: MapPin, color: 'text-amber-400', border: 'border-amber-500/20', bg: 'bg-amber-500/5' },
  { id: 'SOCIAL', label: 'Social & Comms', icon: MessagesSquare, color: 'text-pink-400', border: 'border-pink-500/20', bg: 'bg-pink-500/5' },
  { id: 'NETWORK', label: 'Network & IP', icon: Globe, color: 'text-cyan-400', border: 'border-cyan-500/20', bg: 'bg-cyan-500/5' },
  { id: 'ANALYTICAL', label: 'Analytical & Risk', icon: AlertTriangle, color: 'text-rose-400', border: 'border-rose-500/20', bg: 'bg-rose-500/5' }
];

export const TimelineMasterCanvas: React.FC<MasterCanvasProps> = ({
  events,
  correlations,
  bursts,
  inconsistencies,
  densityBuckets,
  onSelectEvent
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    activeMode,
    zoomLevel,
    currentTime,
    setCurrentTime,
    timeRange,
    selectedEventId,
    selectedDomains,
    selectedEntityIds
  } = useTimelineStore();

  const minMs = timeRange[0];
  const maxMs = timeRange[1];
  const timeSpan = Math.max(1, maxMs - minMs);

  // Compute Active Lanes based on Mode
  const lanes = useMemo(() => {
    if (activeMode === 'network' || activeMode === 'subject') {
      // Group events by Entity
      const entityMap: Record<string, { label: string; count: number }> = {};
      events.forEach(e => {
        const entName = e.entity_name || (e.actor_entities[0] || 'Unknown Entity');
        if (!entityMap[entName]) {
          entityMap[entName] = { label: entName, count: 0 };
        }
        entityMap[entName].count++;
      });

      const sortedEnts = Object.keys(entityMap).sort((a, b) => entityMap[b].count - entityMap[a].count);
      return sortedEnts.slice(0, 8).map((name, idx) => ({
        id: name,
        label: name,
        icon: Users,
        color: 'text-indigo-400',
        border: 'border-border/60',
        bg: idx % 2 === 0 ? 'bg-secondary/20' : 'bg-transparent'
      }));
    }

    // Default: Cross-Domain Lanes
    return DEFAULT_DOMAIN_LANES.filter(l => selectedDomains.includes(l.id));
  }, [activeMode, events, selectedDomains]);

  // Compute Time Axis Ticks
  const timeTicks = useMemo(() => {
    const tickCount = 8;
    const ticks: Array<{ timeMs: number; label: string; xPct: number }> = [];
    for (let i = 0; i <= tickCount; i++) {
      const t = minMs + (i / tickCount) * timeSpan;
      const d = new Date(t);
      let label = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (zoomLevel === 'month') {
        label = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      } else if (zoomLevel === 'day') {
        label = `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
      ticks.push({
        timeMs: t,
        label,
        xPct: (i / tickCount) * 100
      });
    }
    return ticks;
  }, [minMs, timeSpan, zoomLevel]);

  // Map events to coordinates for SVG connectors
  const eventCoordMap = useMemo(() => {
    const coords: Record<string, { xPct: number; laneIndex: number }> = {};
    events.forEach(ev => {
      const xPct = Math.min(100, Math.max(0, ((ev.timestamp_ms - minMs) / timeSpan) * 100));
      let lIdx = -1;
      if (activeMode === 'network' || activeMode === 'subject') {
        const entName = ev.entity_name || (ev.actor_entities[0] || 'Unknown Entity');
        lIdx = lanes.findIndex(l => l.id === entName);
      } else {
        lIdx = lanes.findIndex(l => l.id === ev.domain);
      }
      if (lIdx !== -1) {
        coords[ev.event_id] = { xPct, laneIndex: lIdx };
      }
    });
    return coords;
  }, [events, minMs, timeSpan, activeMode, lanes]);

  // Scrubber cursor position
  const cursorXPct = Math.min(100, Math.max(0, ((currentTime - minMs) / timeSpan) * 100));

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickPct = Math.min(1, Math.max(0, clickX / rect.width));
    const targetMs = minMs + clickPct * timeSpan;
    setCurrentTime(targetMs);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background select-none overflow-hidden relative">
      {/* Master Time Axis Header */}
      <div className="h-10 flex-shrink-0 border-b border-border bg-card/60 relative flex items-center">
        {timeTicks.map((tick, idx) => (
          <div
            key={idx}
            className="absolute top-0 bottom-0 flex flex-col justify-end pb-1.5 -translate-x-1/2 pointer-events-none"
            style={{ left: `${tick.xPct}%` }}
          >
            <div className="w-px h-2 bg-border mx-auto mb-0.5" />
            <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap px-1">
              {tick.label}
            </span>
          </div>
        ))}
      </div>

      {/* Density Histogram strip for Month/Day/Hour zoom */}
      {(zoomLevel === 'month' || zoomLevel === 'day' || zoomLevel === 'hour') && densityBuckets.length > 0 && (
        <div className="h-12 flex-shrink-0 border-b border-border bg-card/30 flex items-end px-2 gap-1 relative">
          {densityBuckets.map((b, idx) => {
            const maxVal = Math.max(...densityBuckets.map(d => d.event_count), 1);
            const heightPct = Math.max(8, (b.event_count / maxVal) * 100);
            const hasAnom = b.anomaly_count > 0;

            return (
              <div
                key={idx}
                className="flex-1 flex flex-col justify-end items-center group relative h-full"
                title={`${b.bucket_key}: ${b.event_count} events${hasAnom ? ` (${b.anomaly_count} anomalies)` : ''}`}
              >
                <div
                  className={cn(
                    "w-full rounded-t transition-all",
                    hasAnom
                      ? "bg-destructive/70 group-hover:bg-destructive"
                      : "bg-primary/40 group-hover:bg-primary/70"
                  )}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Main Multi-Lane Canvas Area */}
      <div
        ref={containerRef}
        onClick={handleCanvasClick}
        className="flex-1 overflow-y-auto relative cursor-crosshair"
      >
        {/* Activity Burst Highlight Zones */}
        {bursts.map(b => {
          const bStart = new Date(b.start_time).getTime();
          const bEnd = new Date(b.end_time).getTime();
          const leftPct = Math.max(0, ((bStart - minMs) / timeSpan) * 100);
          const rightPct = Math.min(100, ((bEnd - minMs) / timeSpan) * 100);
          const widthPct = Math.max(1.5, rightPct - leftPct);

          return (
            <div
              key={b.burst_id}
              className="absolute top-0 bottom-0 bg-amber-500/10 border-x border-dashed border-amber-500/30 pointer-events-none z-0"
              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              title={b.description}
            >
              <div className="sticky top-2 left-1 bg-amber-500/20 text-amber-400 text-[9px] font-mono px-1 py-0.5 rounded border border-amber-500/30 w-max">
                BURST ({b.event_count})
              </div>
            </div>
          );
        })}

        {/* Lanes List */}
        <div className="flex flex-col min-h-full">
          {lanes.map((lane, lIdx) => {
            const LaneIcon = lane.icon;

            // Filter events belonging to this lane
            const laneEvents = events.filter(ev => {
              if (activeMode === 'network' || activeMode === 'subject') {
                const entName = ev.entity_name || (ev.actor_entities[0] || 'Unknown Entity');
                return entName === lane.id;
              }
              return ev.domain === lane.id;
            });

            return (
              <div
                key={lane.id}
                className={cn(
                  "flex-1 min-h-[72px] border-b border-border/50 relative flex items-center transition-colors group",
                  lane.bg
                )}
              >
                {/* Lane Label / Badge */}
                <div className="absolute left-3 top-2 z-10 flex items-center gap-1.5 px-2 py-0.5 rounded bg-card/80 border border-border text-xs font-semibold backdrop-blur-xs pointer-events-none">
                  <LaneIcon className={cn("w-3.5 h-3.5", lane.color)} />
                  <span className="text-[11px] text-foreground font-bold">{lane.label}</span>
                  <span className="text-[10px] font-mono text-muted-foreground ml-1">({laneEvents.length})</span>
                </div>

                {/* Sub-grid Guidelines */}
                <div className="absolute inset-0 flex items-center pointer-events-none">
                  <div className="w-full h-px border-t border-dashed border-border/30" />
                </div>

                {/* Event Markers in Lane */}
                {laneEvents.map(ev => {
                  const xPct = Math.min(100, Math.max(0, ((ev.timestamp_ms - minMs) / timeSpan) * 100));
                  return (
                    <TimelineEventMarker
                      key={ev.event_id}
                      event={ev}
                      xPosition={xPct}
                      laneIndex={lIdx}
                      isSelected={selectedEventId === ev.event_id}
                      onSelect={onSelectEvent}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Global Vertical Playback Scrubber Line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 z-30 pointer-events-none shadow-[0_0_12px_rgba(6,182,212,0.8)] transition-all duration-75"
          style={{ left: `${cursorXPct}%` }}
        >
          <div className="w-3 h-3 rounded-full bg-cyan-400 -translate-x-[5px] -translate-y-1 shadow-[0_0_8px_rgba(6,182,212,1)]" />
        </div>
      </div>
    </div>
  );
};
