'use client';

import React from 'react';
import { 
  Clock, Calendar, Filter, Share2, Download, Play, Pause, 
  RotateCcw, ZoomIn, Layers, Users, MapPin, Sparkles, AlertTriangle, 
  ArrowLeft, ArrowLeftRight, Activity, Search, LayoutList, Columns
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
  displayMode?: 'feed' | 'canvas';
  setDisplayMode?: (mode: 'feed' | 'canvas') => void;
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
  caseReference = 'CASE-2026-041',
  caseTitle = 'Temporal Footprint Reconstruction',
  summary,
  entities,
  onRefresh,
  displayMode = 'feed',
  setDisplayMode
}) => {
  const {
    activeMode,
    setActiveMode,
    zoomLevel,
    setZoomLevel,
    isFilterOpen,
    setIsFilterOpen,
    setIsExportModalOpen,
    selectedEntityIds,
    setSelectedEntityIds
  } = useTimelineStore();

  return (
    <div className="flex flex-col border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-20 shadow-sm shrink-0">
      
      {/* Top Banner: Breadcrumbs & Stats Chips */}
      <div className="flex flex-wrap items-center justify-between px-6 py-3.5 gap-4 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-5">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer mb-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Case</span>
            </div>
            
            <div className="flex items-center gap-3">
              <h1 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>TIMELINE RECONSTRUCTION</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                  {caseReference}
                </span>
              </h1>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Chronological Multi-Domain Digital Footprint Reconstruction
            </p>
          </div>

          <div className="h-9 w-px bg-slate-200 dark:bg-slate-800 hidden lg:block" />

          {/* Metric Chips with Breathable Whitespace */}
          <div className="hidden lg:flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 px-3 py-1.5 rounded-xl font-medium">
              <Activity className="w-3.5 h-3.5 text-blue-600" />
              <span className="font-bold text-slate-800 dark:text-slate-100">{summary.total_events}</span>
              <span className="text-slate-500 text-[11px]">Events</span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 px-3 py-1.5 rounded-xl font-medium">
              <Users className="w-3.5 h-3.5 text-purple-600" />
              <span className="font-bold text-slate-800 dark:text-slate-100">{summary.total_entities}</span>
              <span className="text-slate-500 text-[11px]">Entities</span>
            </div>

            {summary.total_anomalies > 0 && (
              <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 px-3 py-1.5 rounded-xl text-red-600 dark:text-red-400 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="font-bold">{summary.total_anomalies}</span>
                <span className="text-[11px]">Anomalies</span>
              </div>
            )}
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5">
          {/* View Mode Toggle (Structured Feed vs Swimlane Canvas) */}
          {setDisplayMode && activeMode !== 'storyline' && activeMode !== 'map_sync' && (
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
              <button
                onClick={() => setDisplayMode('feed')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                  displayMode === 'feed'
                    ? 'bg-blue-600 text-white shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>Feed</span>
              </button>

              <button
                onClick={() => setDisplayMode('canvas')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                  displayMode === 'canvas'
                    ? 'bg-blue-600 text-white shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                <span>Swimlanes</span>
              </button>
            </div>
          )}

          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              isFilterOpen 
                ? "bg-blue-600 text-white border-blue-600 shadow-sm" 
                : "bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
          </button>

          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Dossier</span>
          </button>
        </div>
      </div>

      {/* Mode Selector & Control Strip */}
      <div className="flex flex-wrap items-center justify-between px-6 py-2.5 gap-4 bg-slate-50/50 dark:bg-slate-900/50">
        {/* Mode Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setActiveMode(mode.id)}
              title={mode.tooltip}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                activeMode === mode.id
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <mode.icon className="w-3.5 h-3.5" />
              <span>{mode.label}</span>
            </button>
          ))}
        </div>

        {/* Zoom Granularity (for Swimlane Canvas) */}
        {activeMode !== 'storyline' && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Granularity:</span>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              {ZOOMS.map((z) => (
                <button
                  key={z.id}
                  onClick={() => setZoomLevel(z.id)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    zoomLevel === z.id
                      ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                  }`}
                >
                  {z.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TimelineHeader;
