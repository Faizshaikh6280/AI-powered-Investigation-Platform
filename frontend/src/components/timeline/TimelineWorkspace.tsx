import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  AlertTriangle, Loader2, RefreshCw, Sparkles, Filter, 
  Layers, Clock, Search, RotateCcw, MapPin, Share2, Compass
} from 'lucide-react';
import { useTimelineStore } from '../../store/useTimelineStore';
import { 
  apiClient, 
  TimelineCanonicalEvent, 
  TemporalCorrelation, 
  ActivityBurst, 
  TemporalInconsistency, 
  TimeBucketDensity, 
  TimelineSummaryStats 
} from '../../services/apiClient';
import { useCase } from '../../context/CaseContext';
import { TimelineHeader } from './TimelineHeader';
import { TimelineFilterSidebar } from './TimelineFilterSidebar';
import { TimelineMasterCanvas } from './TimelineMasterCanvas';
import { TimelinePlaybackControls } from './TimelinePlaybackControls';
import { TimelineEventDrawer } from './TimelineEventDrawer';
import { TimelineContextModal } from './TimelineContextModal';
import { TimelineExportModal } from './TimelineExportModal';
import { TimelineStorylinePanel } from './TimelineStorylinePanel';
import { TimelineCompareView } from './TimelineCompareView';
import { TimelineMapPanel } from './TimelineMapPanel';
import { cn } from '../../utils/cn';

interface TimelineWorkspaceProps {
  caseId?: string;
  caseReference?: string;
  caseTitle?: string;
  onNavigateToGraph?: (entityId: string) => void;
  onNavigateToMap?: (entityId?: string) => void;
}

const INITIAL_SUMMARY: TimelineSummaryStats = {
  total_events: 0,
  total_entities: 0,
  total_anomalies: 0,
  total_correlations: 0,
  total_bursts: 0,
  total_inconsistencies: 0,
  domain_breakdown: {}
};

export const TimelineWorkspace: React.FC<TimelineWorkspaceProps> = ({
  caseId,
  caseReference,
  caseTitle,
  onNavigateToGraph,
  onNavigateToMap
}) => {
  const { activeCase } = useCase();
  const effectiveCaseId = caseId || activeCase?.case_id;
  const effectiveCaseRef = caseReference || activeCase?.case_reference || 'ACTIVE CASE';
  const effectiveCaseTitle = caseTitle || activeCase?.title || 'Temporal Footprint Reconstruction';

  const {
    activeMode,
    setActiveMode,
    zoomLevel,
    selectedDomains,
    selectedEntityIds,
    selectedRiskLevels,
    onlyAnomalies,
    searchQuery,
    selectedEventId,
    setSelectedEventId,
    timeRange,
    setTimeRange,
    resetFilters
  } = useTimelineStore();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [events, setEvents] = useState<TimelineCanonicalEvent[]>([]);
  const [correlations, setCorrelations] = useState<TemporalCorrelation[]>([]);
  const [bursts, setBursts] = useState<ActivityBurst[]>([]);
  const [inconsistencies, setInconsistencies] = useState<TemporalInconsistency[]>([]);
  const [densityBuckets, setDensityBuckets] = useState<TimeBucketDensity[]>([]);
  const [entities, setEntities] = useState<Array<{ id: string; name: string; cluster_id?: string; event_count: number; risk_score?: number }>>([]);
  const [summary, setSummary] = useState<TimelineSummaryStats>(INITIAL_SUMMARY);

  // Fetch timeline events and computed artifacts from backend API
  const fetchTimelineData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const resp = await apiClient.getTimelineEvents({
        case_id: effectiveCaseId,
        domains: selectedDomains.length > 0 ? selectedDomains : undefined,
        entities: selectedEntityIds.length > 0 ? selectedEntityIds : undefined,
        risk: selectedRiskLevels.length > 0 ? selectedRiskLevels : undefined,
        only_anomalies: onlyAnomalies ? true : undefined,
        search: searchQuery.trim() ? searchQuery.trim() : undefined,
        zoom: zoomLevel,
        limit: 1000
      });

      setEvents(resp.events || []);
      setCorrelations(resp.correlations || []);
      setBursts(resp.bursts || []);
      setInconsistencies(resp.inconsistencies || []);
      setDensityBuckets(resp.density_buckets || []);
      setEntities(resp.entities || []);
      setSummary(resp.summary || INITIAL_SUMMARY);

      // Auto-calibrate time range when first loaded or when events expand
      if (resp.events && resp.events.length > 0) {
        const minMs = Math.min(...resp.events.map(e => e.timestamp_ms));
        const maxMs = Math.max(...resp.events.map(e => e.timestamp_ms));
        if (minMs > 0 && maxMs >= minMs) {
          // If range is default or outside, sync to event range
          if (timeRange[0] === 0 || timeRange[1] <= timeRange[0] || minMs < timeRange[0] || maxMs > timeRange[1]) {
            setTimeRange([minMs, maxMs]);
          }
        }
      }
    } catch (err: any) {
      console.error("Failed to load timeline events:", err);
      setError(err?.message || "Failed to load timeline events. Please verify backend service.");
    } finally {
      setLoading(false);
    }
  }, [
    effectiveCaseId,
    selectedDomains,
    selectedEntityIds,
    selectedRiskLevels,
    onlyAnomalies,
    searchQuery,
    zoomLevel,
    timeRange,
    setTimeRange
  ]);

  useEffect(() => {
    fetchTimelineData();
  }, [fetchTimelineData]);

  // Selected event resolution
  const selectedEvent = useMemo(() => {
    if (!selectedEventId) return null;
    return events.find(e => e.event_id === selectedEventId) || null;
  }, [events, selectedEventId]);

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden text-foreground">
      {/* Top Header Strip */}
      <TimelineHeader
        caseReference={effectiveCaseRef}
        caseTitle={effectiveCaseTitle}
        summary={summary}
        entities={entities}
        onRefresh={fetchTimelineData}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Filter Sidebar */}
        <TimelineFilterSidebar
          entities={entities}
          domainCounts={summary.domain_breakdown}
        />

        {/* Central Investigation Canvas */}
        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
          {loading && events.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-muted-foreground space-y-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <div className="text-sm font-semibold text-foreground">Reconstructing Digital Footprint Timeline...</div>
              <p className="text-xs max-w-sm text-muted-foreground">
                Synthesizing canonical events across Telecom, Financial, Social, and Geospatial domains.
              </p>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-foreground">Failed to Load Investigation Timeline</h3>
              <p className="text-xs text-muted-foreground max-w-md">{error}</p>
              <button
                onClick={fetchTimelineData}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-md hover:bg-primary/90 transition-colors shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Connection</span>
              </button>
            </div>
          ) : events.length === 0 && activeMode !== 'storyline' ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-3 text-muted-foreground">
              <div className="w-12 h-12 rounded-full bg-secondary border border-border flex items-center justify-center text-muted-foreground">
                <Clock className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-foreground">No Canonical Events Matched</h4>
              <p className="text-xs max-w-sm">
                No temporal events match the active domain, entity, or anomaly filters for this case.
              </p>
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 border border-border text-foreground text-xs font-semibold rounded-md transition-colors mt-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            </div>
          ) : (
            <>
              {/* Storyline Mode */}
              {activeMode === 'storyline' && (
                <TimelineStorylinePanel
                  caseId={effectiveCaseId}
                  onSelectEvent={(eid) => setSelectedEventId(eid)}
                />
              )}

              {/* Map + Timeline Synchronized View Mode */}
              {activeMode === 'map_sync' && (
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                  {/* Top: Synchronized Map */}
                  <div className="h-1/2 min-h-[260px] border-b border-border relative">
                    <TimelineMapPanel
                      events={events}
                      onSelectEvent={(ev) => setSelectedEventId(ev.event_id)}
                    />
                  </div>
                  {/* Bottom: Synchronized Master Canvas */}
                  <div className="h-1/2 min-h-[260px] relative">
                    <TimelineMasterCanvas
                      events={events}
                      correlations={correlations}
                      bursts={bursts}
                      inconsistencies={inconsistencies}
                      densityBuckets={densityBuckets}
                      onSelectEvent={(ev) => setSelectedEventId(ev.event_id)}
                    />
                  </div>
                </div>
              )}

              {/* Compare Mode */}
              {activeMode === 'network' && entities.length > 1 && (
                // When in network mode with multiple entities, MasterCanvas automatically handles multi-lane layout per entity
                <TimelineMasterCanvas
                  events={events}
                  correlations={correlations}
                  bursts={bursts}
                  inconsistencies={inconsistencies}
                  densityBuckets={densityBuckets}
                  onSelectEvent={(ev) => setSelectedEventId(ev.event_id)}
                />
              )}

              {/* Cross-Domain & Subject POI Modes */}
              {(activeMode === 'cross_domain' || activeMode === 'subject' || (activeMode === 'network' && entities.length <= 1)) && (
                <TimelineMasterCanvas
                  events={events}
                  correlations={correlations}
                  bursts={bursts}
                  inconsistencies={inconsistencies}
                  densityBuckets={densityBuckets}
                  onSelectEvent={(ev) => setSelectedEventId(ev.event_id)}
                />
              )}
            </>
          )}

          {/* Bottom Playback Controls */}
          {activeMode !== 'storyline' && (
            <TimelinePlaybackControls />
          )}
        </div>

        {/* Slide-in Event Detail Drawer */}
        <TimelineEventDrawer
          event={selectedEvent}
          onClose={() => setSelectedEventId(null)}
          onNavigateToGraph={onNavigateToGraph}
          onNavigateToMap={() => {
            setActiveMode('map_sync');
            if (onNavigateToMap) onNavigateToMap(selectedEvent?.z_cluster_id || selectedEvent?.entity_name);
          }}
        />
      </div>

      {/* Global Modals */}
      <TimelineContextModal />
      <TimelineExportModal
        caseId={effectiveCaseId}
        totalEvents={summary.total_events}
      />
    </div>
  );
};
export default TimelineWorkspace;
