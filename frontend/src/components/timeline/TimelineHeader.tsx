import React from 'react';
import { 
  Clock, Calendar, Filter, Share2, Download, Play, Pause, 
  RotateCcw, ZoomIn, Layers, Users, MapPin, Sparkles, AlertTriangle, 
  ChevronRight, ArrowLeftRight, Activity, Search
} from 'lucide-react';
import { useTimelineStore, TimelineMode, TimelineZoom } from '../../store/useTimelineStore';
import { TimelineSummaryStats } from '../../services/apiClient';
import { cn } from '../../utils/cn';

interface TimelineHeaderProps {
  caseReference?: string;
  caseTitle?: string;
  summary: TimelineSummaryStats;
  entities: Array<{ id: string; name: string; cluster_id?: string; event_count: number }>;
  onRefresh?: () => void;
}

const MODES: Array<{ id: TimelineMode; label: string; icon: any; tooltip: string }> = [
  { id: 'cross_domain', label: 'Cross-Domain', icon: Layers, tooltip: 'Correlated streams across Telecom, Banking, Social & Location' },
  { id: 'subject', label: 'Subject POI', icon: Users, tooltip: 'Single person / entity digital footprint' },
  { id: 'network', label: 'Network Multi-Lane', icon: Share2, tooltip: 'Parallel timelines of connected entities' },
  { id: 'map_sync', label: 'Map + Timeline', icon: MapPin, tooltip: 'Synchronized geographic waypoint tracking' },
  { id: 'storyline', label: 'Storyline Reconstruction', icon: Sparkles, tooltip: 'Evidence-backed chronological narrative sequences' },
];

const ZOOMS: Array<{ id: TimelineZoom; label: string }> = [
  { id: 'month', label: 'Month' },
  { id: 'day', label: 'Day' },
  { id: 'hour', label: 'Hour' },
  { id: 'minute', label: 'Minute' },
];

export const TimelineHeader: React.FC<TimelineHeaderProps> = ({
  caseReference = 'ACTIVE CASE',
  caseTitle = 'Investigation',
  summary,
  entities,
  onRefresh
}) => {
  const {
    activeMode,
    setActiveMode,
    zoomLevel,
    setZoomLevel,
    isFilterOpen,
    setIsFilterOpen,
    setIsExportModalOpen,
    isPlaying,
    togglePlay,
    playbackSpeed,
    setPlaybackSpeed,
    selectedEntityIds,
    setSelectedEntityIds
  } = useTimelineStore();

  return (
    <div className="flex flex-col border-b border-border bg-card/80 backdrop-blur-md z-20">
      {/* Top Banner: Case Context & Stats */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 gap-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-2.5 py-1 rounded-md text-xs font-mono font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span>{caseReference}</span>
          </div>
          <div className="flex flex-col">
            <h2 className="text-sm font-bold text-foreground tracking-tight line-clamp-1">{caseTitle}</h2>
            <span className="text-[11px] text-muted-foreground">Unified Temporal Investigation Engine</span>
          </div>
        </div>

        {/* Investigation Summary Stat Counters */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 bg-secondary/70 border border-border px-2.5 py-1 rounded-md">
            <Activity className="w-3.5 h-3.5 text-primary" />
            <span className="font-mono font-bold text-foreground">{summary.total_events}</span>
            <span className="text-muted-foreground">Events</span>
          </div>
          <div className="flex items-center gap-1.5 bg-secondary/70 border border-border px-2.5 py-1 rounded-md">
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-mono font-bold text-foreground">{summary.total_entities}</span>
            <span className="text-muted-foreground">Entities</span>
          </div>
          {summary.total_anomalies > 0 && (
            <div className="flex items-center gap-1.5 bg-destructive/10 border border-destructive/20 text-destructive px-2.5 py-1 rounded-md">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="font-mono font-bold">{summary.total_anomalies}</span>
              <span>Anomalies</span>
            </div>
          )}
          {summary.total_correlations > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 px-2.5 py-1 rounded-md">
              <Share2 className="w-3.5 h-3.5" />
              <span className="font-mono font-bold">{summary.total_correlations}</span>
              <span>Correlations</span>
            </div>
          )}
          {summary.total_inconsistencies > 0 && (
            <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 px-2.5 py-1 rounded-md animate-pulse">
              <span className="font-mono font-bold">{summary.total_inconsistencies}</span>
              <span>Geo Inconsistencies</span>
            </div>
          )}
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors",
              isFilterOpen 
                ? "bg-primary text-primary-foreground border-primary" 
                : "bg-secondary hover:bg-secondary/80 text-foreground border-border"
            )}
            title="Toggle Filter Sidebar"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
          </button>
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 border border-border text-foreground rounded-md text-xs font-semibold transition-colors"
            title="Court-Ready Dossier Export"
          >
            <Download className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Export Dossier</span>
          </button>
        </div>
      </div>

      {/* Mode Selector & Control Strip */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 gap-4">
        {/* Mode Tabs */}
        <div className="flex items-center gap-1 bg-secondary/80 p-1 rounded-lg border border-border">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setActiveMode(mode.id)}
              title={mode.tooltip}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all duration-200",
                activeMode === mode.id
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50"
              )}
            >
              <mode.icon className="w-3.5 h-3.5" />
              <span>{mode.label}</span>
            </button>
          ))}
        </div>

        {/* Entity Focus Selector for Subject Mode */}
        {activeMode === 'subject' && (
          <div className="flex items-center gap-2 bg-secondary/60 border border-border px-2.5 py-1 rounded-md">
            <span className="text-[11px] font-semibold text-muted-foreground">Subject:</span>
            <select
              value={selectedEntityIds[0] || ''}
              onChange={(e) => setSelectedEntityIds(e.target.value ? [e.target.value] : [])}
              className="bg-transparent text-xs font-bold text-foreground border-none outline-none cursor-pointer"
            >
              <option value="" className="bg-card">All Entities</option>
              {entities.map(ent => (
                <option key={ent.id} value={ent.id} className="bg-card">
                  {ent.name} ({ent.event_count} events)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-secondary/60 p-1 rounded-md border border-border">
          <span className="text-[10px] font-bold text-muted-foreground uppercase px-2">Zoom:</span>
          {ZOOMS.map(z => (
            <button
              key={z.id}
              onClick={() => setZoomLevel(z.id)}
              className={cn(
                "px-2 py-0.5 rounded text-[11px] font-mono transition-colors",
                zoomLevel === z.id
                  ? "bg-card text-primary font-bold shadow-xs border border-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {z.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
