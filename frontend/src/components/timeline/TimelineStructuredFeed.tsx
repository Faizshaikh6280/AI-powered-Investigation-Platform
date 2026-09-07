'use client';

import React, { useMemo } from 'react';
import { 
  Smartphone, CreditCard, MessagesSquare, MapPin, Globe, 
  AlertTriangle, ShieldAlert, ArrowRight, User, ExternalLink, 
  CheckCircle2, Clock, Share2, Compass, PhoneCall
} from 'lucide-react';
import { TimelineCanonicalEvent } from '../../services/apiClient';

interface TimelineStructuredFeedProps {
  events: TimelineCanonicalEvent[];
  selectedEventId: string | null;
  onSelectEvent: (event: TimelineCanonicalEvent) => void;
  onNavigateToMap?: (entityId?: string) => void;
  onNavigateToGraph?: (entityId: string) => void;
}

const DOMAIN_THEMES: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  TELECOM: { label: 'Telecom', icon: Smartphone, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/40', border: 'border-indigo-200 dark:border-indigo-800' },
  FINANCIAL: { label: 'Financial', icon: CreditCard, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-800' },
  LOCATION: { label: 'Location', icon: MapPin, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-800' },
  SOCIAL: { label: 'Social & Comms', icon: MessagesSquare, color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-950/40', border: 'border-pink-200 dark:border-pink-800' },
  NETWORK: { label: 'Network & IP', icon: Globe, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-950/40', border: 'border-cyan-200 dark:border-cyan-800' },
  ANALYTICAL: { label: 'Anomaly & Risk', icon: AlertTriangle, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40', border: 'border-rose-200 dark:border-rose-800' }
};

export const TimelineStructuredFeed: React.FC<TimelineStructuredFeedProps> = ({
  events,
  selectedEventId,
  onSelectEvent,
  onNavigateToMap,
  onNavigateToGraph
}) => {
  // Group events by day for spacious chronological sections
  const groupedEvents = useMemo(() => {
    const groups: Record<string, TimelineCanonicalEvent[]> = {};
    const sorted = [...events].sort((a, b) => a.timestamp_ms - b.timestamp_ms);

    sorted.forEach(ev => {
      const dateKey = new Date(ev.timestamp_ms).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(ev);
    });

    return groups;
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400">
        <Clock className="w-10 h-10 mb-2 stroke-1" />
        <p className="text-sm font-semibold">No events matching current timeline filters</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8 max-w-6xl mx-auto w-full">
      {Object.entries(groupedEvents).map(([dateLabel, dayEvents]) => (
        <div key={dateLabel} className="space-y-4">
          
          {/* Day Header Pill */}
          <div className="sticky top-0 z-10 flex items-center gap-3 py-1.5 backdrop-blur-md">
            <span className="px-3.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-sm">
              {dateLabel}
            </span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {dayEvents.length} events
            </span>
          </div>

          {/* Cards Stream with Spacious Gaps ("Khula Khula") */}
          <div className="grid grid-cols-1 gap-4 pl-2 md:pl-6 border-l-2 border-slate-200 dark:border-slate-800 ml-4">
            {dayEvents.map(ev => {
              const theme = DOMAIN_THEMES[ev.domain] || DOMAIN_THEMES.ANALYTICAL;
              const Icon = theme.icon;
              const isSelected = selectedEventId === ev.event_id;
              const isAnomaly = ev.anomaly_score > 0;
              const timeFormatted = new Date(ev.timestamp_ms).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              });

              return (
                <div
                  key={ev.event_id}
                  onClick={() => onSelectEvent(ev)}
                  className={`relative p-5 rounded-2xl border transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md ${
                    isSelected
                      ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                      : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {/* Left Timeline Anchor Dot */}
                  <div className={`absolute -left-[27px] md:-left-[39px] top-6 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 shadow-sm ${
                    isAnomaly ? 'bg-red-500' : 'bg-blue-600'
                  }`} />

                  {/* Card Header Row */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      {/* Domain Icon Pill */}
                      <div className={`p-2 rounded-xl flex items-center gap-1.5 ${theme.bg} ${theme.color} border ${theme.border}`}>
                        <Icon className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">{theme.label}</span>
                      </div>

                      {/* Event Type */}
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        {ev.event_type}
                      </span>
                    </div>

                    {/* Timestamp */}
                    <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{timeFormatted}</span>
                    </div>
                  </div>

                  {/* Subject Entity & Headline */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                          {ev.entity_name || ev.actor_entities?.[0] || 'Unknown Subject'}
                        </span>
                        {ev.z_cluster_id && (
                          <span className="text-[10px] font-mono text-slate-400">({ev.z_cluster_id})</span>
                        )}
                      </div>

                      {/* Location / Counterparty line */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                        {ev.location_name && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                            <span>{ev.location_name}</span>
                          </span>
                        )}
                        {ev.counterparty && (
                          <span className="flex items-center gap-1 text-slate-500">
                            <span>↔</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{ev.counterparty}</span>
                          </span>
                        )}
                        {ev.amount_inr && ev.amount_inr > 0 && (
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            ₹{ev.amount_inr.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions: Map & Graph Links */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {onNavigateToMap && ev.location_name && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToMap(ev.entity_name);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          title="Locate on Geospatial Map"
                        >
                          <Compass className="w-4 h-4" />
                        </button>
                      )}
                      {onNavigateToGraph && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToGraph(ev.entity_name || ev.actor_entities?.[0] || '');
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                          title="View on Relationship Graph"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Anomaly Banner if flagged */}
                  {isAnomaly && (
                    <div className="mt-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
                      <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Temporal / Forensic Anomaly Flagged</span>
                        <span className="text-[11px] text-red-600/90 dark:text-red-400">
                          {ev.anomaly_reasons?.[0] || 'Unusual cross-domain co-occurrence or velocity deviation'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TimelineStructuredFeed;
