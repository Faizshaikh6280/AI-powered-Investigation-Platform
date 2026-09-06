import React, { useState, useEffect } from 'react';
import { 
  X, Clock, ArrowRight, Smartphone, CreditCard, MessagesSquare, 
  MapPin, Globe, AlertTriangle, ChevronRight, Filter
} from 'lucide-react';
import { useTimelineStore } from '../../store/useTimelineStore';
import { apiClient, TimelineCanonicalEvent } from '../../services/apiClient';
import { cn } from '../../utils/cn';

const WINDOWS = [5, 15, 30, 60];

const DOMAIN_ICONS: Record<string, any> = {
  TELECOM: Smartphone,
  FINANCIAL: CreditCard,
  SOCIAL: MessagesSquare,
  LOCATION: MapPin,
  NETWORK: Globe,
  ANALYTICAL: AlertTriangle
};

export const TimelineContextModal: React.FC = () => {
  const {
    contextEventId,
    contextWindowMinutes,
    isContextModalOpen,
    closeContextModal,
    setSelectedEventId
  } = useTimelineStore();

  const [activeWindow, setActiveWindow] = useState<number>(contextWindowMinutes || 15);
  const [targetEvent, setTargetEvent] = useState<TimelineCanonicalEvent | null>(null);
  const [contextEvents, setContextEvents] = useState<TimelineCanonicalEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!contextEventId || !isContextModalOpen) return;

    setLoading(true);
    apiClient.getTimelineEventContext(contextEventId, activeWindow)
      .then(res => {
        setTargetEvent(res.target_event);
        setContextEvents(res.context_events || []);
      })
      .catch(err => {
        console.error("Failed to load event context:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [contextEventId, activeWindow, isContextModalOpen]);

  if (!isContextModalOpen || !contextEventId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-primary" />
            <div>
              <h3 className="text-base font-bold text-foreground">Temporal Neighborhood Context</h3>
              <p className="text-xs text-muted-foreground">Chronological sequence immediately surrounding the target event</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Window Size Switcher */}
            <div className="flex items-center gap-1 bg-secondary/80 p-1 rounded-lg border border-border">
              {WINDOWS.map(w => (
                <button
                  key={w}
                  onClick={() => setActiveWindow(w)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-mono font-bold rounded-md transition-colors",
                    activeWindow === w
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  ±{w}m
                </button>
              ))}
            </div>

            <button
              onClick={closeContextModal}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-xs animate-pulse">
              Reconstructing surrounding temporal neighborhood...
            </div>
          ) : contextEvents.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              No other events detected within ±{activeWindow} minutes.
            </div>
          ) : (
            <div className="relative border-l border-border/80 ml-4 space-y-6">
              {contextEvents.map((ev) => {
                const isTarget = ev.event_id === contextEventId;
                const Icon = DOMAIN_ICONS[ev.domain] || DOMAIN_ICONS.ANALYTICAL;
                const isAnom = ev.anomaly_score > 0;

                return (
                  <div key={ev.event_id} className="relative pl-6 group">
                    {/* Node marker on vertical timeline */}
                    <div
                      className={cn(
                        "absolute -left-2 top-2.5 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center transition-transform",
                        isTarget
                          ? "bg-primary ring-4 ring-primary/30 scale-125"
                          : isAnom
                            ? "bg-destructive ring-2 ring-destructive/30"
                            : "bg-muted border-border"
                      )}
                    />

                    {/* Event Card */}
                    <div
                      onClick={() => {
                        setSelectedEventId(ev.event_id);
                        closeContextModal();
                      }}
                      className={cn(
                        "p-3.5 rounded-lg border transition-all cursor-pointer shadow-xs",
                        isTarget
                          ? "bg-primary/5 border-primary shadow-sm"
                          : "bg-card hover:bg-secondary/40 border-border"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <Icon className={cn("w-4 h-4", isTarget ? "text-primary" : "text-muted-foreground")} />
                          <span className="text-xs font-bold text-foreground uppercase tracking-wider">{ev.event_type}</span>
                          {isTarget && (
                            <span className="text-[10px] bg-primary text-primary-foreground font-bold px-1.5 py-0.5 rounded">
                              TARGET
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">
                          {ev.normalized_timestamp.slice(11, 19)} UTC
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between text-xs gap-2">
                        <div className="text-muted-foreground">
                          {ev.entity_name && <span className="font-semibold text-foreground mr-2">{ev.entity_name}</span>}
                          {ev.counterparty && <span>to {ev.counterparty}</span>}
                          {ev.location_name && <span className="text-amber-400 ml-2">@ {ev.location_name}</span>}
                        </div>
                        {ev.amount_inr && ev.amount_inr > 0 ? (
                          <div className="font-mono font-bold text-emerald-400">
                            ₹{ev.amount_inr.toLocaleString()}
                          </div>
                        ) : null}
                      </div>

                      {ev.anomaly_reasons.length > 0 && (
                        <div className="mt-2 text-[11px] text-destructive flex items-center gap-1 font-medium">
                          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                          <span>{ev.anomaly_reasons[0]}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
