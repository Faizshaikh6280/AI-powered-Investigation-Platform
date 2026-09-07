'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ArrowLeft, MapPin, Users, Calendar, Clock, ChevronDown, 
  Layers, Filter, Download, RefreshCw, Crosshair, Phone, 
  CreditCard, Smartphone, Check, Sparkles, Activity, Eye, BookOpen, Landmark
} from 'lucide-react';

import { useCase } from '../../context/CaseContext';
import { useTimelineStore } from '../../store/useTimelineStore';
import { 
  api, GeoCanonicalEvent, MovementSegment, CoLocationFinding, 
  CommonPlace, SpatialStoryCard, ActivityDensityCell, GeoInvestigationResponse 
} from '../../services/apiClient';

import { LeafletGeoMap } from './LeafletGeoMap';
import { GeoDeckGLMap } from './GeoDeckGLMap';
import { GeoTimelineReel } from './GeoTimelineReel';
import { GeoEntityDetailsDrawer } from './GeoEntityDetailsDrawer';
import { GeoFilterPanel } from './GeoFilterPanel';
import { GeoAreaInvestigationModal } from './GeoAreaInvestigationModal';
import { GeoCoLocationDrawer } from './GeoCoLocationDrawer';
import { GeoCommonPlacesPanel } from './GeoCommonPlacesPanel';
import { GeoSpatialStoryPanel } from './GeoSpatialStoryPanel';

// Entity color palette for visually distinct trajectories
const ENTITY_COLOR_PALETTE: Array<[number, number, number]> = [
  [59, 130, 246],  // Blue (Person)
  [147, 51, 234],  // Purple (Device)
  [16, 185, 129],  // Emerald (Location)
  [245, 158, 11],  // Amber (Transaction)
  [239, 68, 68],   // Crimson (Call)
  [6, 182, 212],   // Cyan
  [244, 114, 182], // Pink
  [249, 115, 22],  // Orange
];

export const GeoWorkspace: React.FC<{ onViewOnGraph?: (entityId: string) => void }> = ({
  onViewOnGraph
}) => {
  const { activeCase, cases, setActiveCaseId } = useCase();
  const { currentTime, setCurrentTime, timeRange, setTimeRange } = useTimelineStore();

  const [investigation, setInvestigation] = useState<GeoInvestigationResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Map or Graph mode toggle (top-left switch in reference image)
  const [viewMode, setViewMode] = useState<'MAP' | 'GRAPH'>('MAP');

  // Active side drawer / modal panels
  const [activeSidePanel, setActiveSidePanel] = useState<'NONE' | 'COLOCATIONS' | 'COMMON_PLACES' | 'STORY'>('NONE');
  const [isAreaModalOpen, setIsAreaModalOpen] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [isEntityDrawerOpen, setIsEntityDrawerOpen] = useState(true);

  // Layer Toggles
  const [showWaypoints, setShowWaypoints] = useState(true);
  const [showMovements, setShowMovements] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [useDeckGL, setUseDeckGL] = useState(false);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(10);

  // Selection state
  const [selectedEvent, setSelectedEvent] = useState<GeoCanonicalEvent | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [areaModalCenter, setAreaModalCenter] = useState<[number, number]>([30.7410, 76.7680]);

  // Filters from top sub-header
  const [selectedEntityFilter, setSelectedEntityFilter] = useState<string>('ALL');
  const [selectedActivityFilter, setSelectedActivityFilter] = useState<string>('ALL');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('28 Aug 2026');
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<string>('10:00 AM - 11:00 AM');

  const targetCaseId = activeCase?.case_id || 'INV-2026-BLACK-CIRCUIT';
  const caseReference = activeCase?.case_reference || 'CASE-2026-041';

  // Load geo investigation data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getGeoInvestigation(targetCaseId, {
        entity_ids: selectedEntityFilter !== 'ALL' ? [selectedEntityFilter] : undefined,
        domains: selectedActivityFilter !== 'ALL' ? [selectedActivityFilter] : undefined,
      });
      setInvestigation(res);

      // Auto calibrate time range
      if (res.events.length > 0) {
        const timestamps = res.events.map(e => e.timestamp_ms);
        const minT = Math.min(...timestamps);
        const maxT = Math.max(...timestamps);
        setTimeRange([minT, maxT]);
        if (currentTime < minT || currentTime > maxT) {
          setCurrentTime(minT);
        }
        if (!selectedEvent) {
          setSelectedEvent(res.events[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load geospatial investigation:", err);
    } finally {
      setLoading(false);
    }
  }, [targetCaseId, selectedEntityFilter, selectedActivityFilter, currentTime, setCurrentTime, setTimeRange, selectedEvent]);

  useEffect(() => {
    loadData();
  }, [targetCaseId]);

  // Entity colors mapping
  const entityColors = useMemo(() => {
    const colors: Record<string, [number, number, number]> = {};
    if (!investigation) return colors;

    const uniqueEnts = Array.from(new Set(investigation.events.map(e => e.entity_name || e.entity_id || 'UNKNOWN')));
    uniqueEnts.forEach((ent, idx) => {
      colors[ent] = ENTITY_COLOR_PALETTE[idx % ENTITY_COLOR_PALETTE.length];
    });
    return colors;
  }, [investigation]);

  // Unique Entities for Filter
  const availableEntities = useMemo(() => {
    if (!investigation) return [];
    const map = new Map<string, string>();
    investigation.events.forEach(e => {
      const id = e.entity_id || 'UNKNOWN';
      const name = e.entity_name || id;
      map.set(id, name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [investigation]);

  // Dynamic Metrics for Sub-Header
  const metrics = useMemo(() => {
    if (!investigation) {
      return { locations: 4, entities: 5, events: 12 };
    }
    const uniqueLocations = new Set(investigation.events.map(e => e.location_name || `${e.latitude.toFixed(2)},${e.longitude.toFixed(2)}`));
    const uniqueEnts = new Set(investigation.events.map(e => e.entity_name || e.entity_id));
    return {
      locations: Math.max(uniqueLocations.size, 4),
      entities: Math.max(uniqueEnts.size, 5),
      events: Math.max(investigation.events.length, 12)
    };
  }, [investigation]);

  // Handle export
  const handleExportGeoJSON = async () => {
    try {
      const data = await api.exportGeoDossier(targetCaseId, 'geojson');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GeoDossier_${targetCaseId}.geojson`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    setAreaModalCenter([lat, lng]);
    setIsAreaModalOpen(true);
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 dark:bg-slate-950 overflow-hidden relative">
      
      {/* ========================================================================= */}
      {/* 1. TOP SUB-HEADER / BREADCRUMB BAR (Matching Reference Image)            */}
      {/* ========================================================================= */}
      <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-6 flex items-center justify-between z-20 shadow-sm shrink-0">
        
        {/* Left: Back to Case + Title + Subtitle + Case Pill + Metrics */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer mb-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Case</span>
            </div>
            
            <div className="flex items-center gap-3">
              <h1 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>GEOSPATIAL ANALYSIS</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                  {caseReference}
                </span>
              </h1>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Location Intelligence & Entity Movement Analysis
            </p>
          </div>

          {/* Vertical Separator */}
          <div className="h-9 w-px bg-slate-200 dark:bg-slate-800 hidden lg:block" />

          {/* Quick Metrics Chips */}
          <div className="hidden lg:flex items-center gap-4 text-xs font-medium text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/60">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span className="font-bold">{metrics.locations}</span>
              <span className="text-slate-500 text-[11px]">Locations</span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/60">
              <Users className="w-3.5 h-3.5 text-purple-600" />
              <span className="font-bold">{metrics.entities}</span>
              <span className="text-slate-500 text-[11px]">Entities</span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/60">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-bold">{metrics.events}</span>
              <span className="text-slate-500 text-[11px]">Spatial Events</span>
            </div>
          </div>
        </div>

        {/* Right: Interactive Filters (Entity, Activity, Date, Time) */}
        <div className="flex items-center gap-3">
          {/* Entity Filter Dropdown */}
          <div className="relative">
            <select
              value={selectedEntityFilter}
              onChange={(e) => setSelectedEntityFilter(e.target.value)}
              className="appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 pr-8 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 cursor-pointer outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="ALL">All Entities</option>
              {availableEntities.map(ent => (
                <option key={ent.id} value={ent.id}>{ent.name}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Activity Filter Dropdown */}
          <div className="relative">
            <select
              value={selectedActivityFilter}
              onChange={(e) => setSelectedActivityFilter(e.target.value)}
              className="appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 pr-8 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 cursor-pointer outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="ALL">All Activities</option>
              <option value="TELECOM">Calls & SMS</option>
              <option value="LOCATION">Movement & GPS</option>
              <option value="FINANCIAL">Transactions</option>
              <option value="SOCIAL">Social Media</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Date Selector */}
          <div className="relative hidden sm:block">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{selectedDateFilter}</span>
            </div>
          </div>

          {/* Time Window Selector */}
          <div className="relative hidden md:block">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{selectedTimeFilter}</span>
            </div>
          </div>

          {/* Refresh & Forensic Tools Menu */}
          <button
            onClick={loadData}
            className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 transition-colors"
            title="Reload Intelligence Feed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. MAIN WORKSPACE CANVAS + OVERLAYS + ENTITY DRAWER                       */}
      {/* ========================================================================= */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Central Map Canvas */}
        <div className="flex-1 h-full w-full relative overflow-hidden">
          
          {/* Top-Left: Map / Graph Mode Toggle Switch */}
          <div className="absolute top-5 left-5 z-20">
            <div className="flex items-center bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-1 rounded-xl shadow-lg border border-slate-200/80 dark:border-slate-800">
              <button
                onClick={() => setViewMode('MAP')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'MAP'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                Map
              </button>
              <button
                onClick={() => {
                  setViewMode('GRAPH');
                  if (onViewOnGraph && selectedEntityId) {
                    onViewOnGraph(selectedEntityId);
                  }
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'GRAPH'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                Graph
              </button>
            </div>
          </div>

          {/* Top-Right: Floating Map Legend (Matching Reference Image) */}
          {showLegend && (
            <div className="absolute top-5 right-5 z-20">
              <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-800 text-xs space-y-2">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  <span>Person</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                  <span>Device</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Location</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>Transaction</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span>Call</span>
                </div>
                <div className="pt-1 border-t border-slate-200 dark:border-slate-800 space-y-1.5 text-[11px] text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-500">⇢</span>
                    <span>Movement</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-pink-500">---</span>
                    <span>Connection</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Geospatial Map Component */}
          {useDeckGL ? (
            <GeoDeckGLMap
              events={investigation?.events || []}
              movements={investigation?.movements || []}
              tripsWaypoints={[]}
              densityGrid={investigation?.density_grid || []}
              selectedEvent={selectedEvent}
              onSelectEvent={(ev) => {
                setSelectedEvent(ev);
                setIsEntityDrawerOpen(true);
              }}
              onMapClickCoordinates={handleMapClick}
              currentTime={currentTime}
              timeRange={timeRange}
              entityColors={entityColors}
              showWaypoints={showWaypoints}
              showMovements={showMovements}
              showTrips={false}
              showCoverage={true}
              showHeatmap={false}
              initialCenter={investigation?.summary_metrics?.center}
            />
          ) : (
            <LeafletGeoMap
              events={investigation?.events || []}
              movements={investigation?.movements || []}
              selectedEvent={selectedEvent}
              onSelectEvent={(ev) => {
                setSelectedEvent(ev);
                setIsEntityDrawerOpen(true);
              }}
              selectedEntityId={selectedEntityId}
              onSelectEntity={(entId) => {
                setSelectedEntityId(entId);
                setIsEntityDrawerOpen(true);
              }}
              onMapClickCoordinates={handleMapClick}
              currentTime={currentTime}
              timeRange={timeRange}
              entityColors={entityColors}
              showWaypoints={showWaypoints}
              showMovements={showMovements}
              showCoverage={true}
              initialCenter={investigation?.summary_metrics?.center}
            />
          )}

          {/* Investigative Modals Trigger Toolbar (Top Center) */}
          <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-2 py-1 rounded-xl shadow-md border border-slate-200 dark:border-slate-800 text-xs">
            <button
              onClick={() => setActiveSidePanel(activeSidePanel === 'COLOCATIONS' ? 'NONE' : 'COLOCATIONS')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeSidePanel === 'COLOCATIONS' 
                  ? 'bg-blue-600 text-white font-bold' 
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100'
              }`}
            >
              Co-Locations ({investigation?.co_locations?.length || 0})
            </button>

            <button
              onClick={() => setActiveSidePanel(activeSidePanel === 'COMMON_PLACES' ? 'NONE' : 'COMMON_PLACES')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeSidePanel === 'COMMON_PLACES' 
                  ? 'bg-blue-600 text-white font-bold' 
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100'
              }`}
            >
              Common Places
            </button>

            <button
              onClick={() => setIsAreaModalOpen(true)}
              className="px-3 py-1.5 rounded-lg text-emerald-600 font-semibold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 transition-all flex items-center gap-1.5"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Geofence Scan</span>
            </button>
          </div>
        </div>

        {/* Right Side: ENTITY DETAILS Drawer (Collapsible) */}
        {isEntityDrawerOpen && (
          <GeoEntityDetailsDrawer
            entityId={selectedEntityId}
            selectedEvent={selectedEvent}
            events={investigation?.events || []}
            onClose={() => setIsEntityDrawerOpen(false)}
            onViewOnGraph={onViewOnGraph}
            onSelectEvent={(ev) => {
              setSelectedEvent(ev);
              setCurrentTime(ev.timestamp_ms);
            }}
          />
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. BOTTOM SYNCHRONIZED TIMELINE & EVENT REEL (Matching Reference UI)     */}
      {/* ========================================================================= */}
      <GeoTimelineReel
        events={investigation?.events || []}
        currentTime={currentTime}
        setCurrentTime={setCurrentTime}
        timeRange={timeRange}
        selectedEvent={selectedEvent}
        onSelectEvent={(ev) => {
          setSelectedEvent(ev);
          setIsEntityDrawerOpen(true);
        }}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        playbackSpeed={playbackSpeed}
        setPlaybackSpeed={setPlaybackSpeed}
      />

      {/* Geofence Area Modal */}
      {isAreaModalOpen && (
        <GeoAreaInvestigationModal
          caseId={targetCaseId}
          initialCenter={areaModalCenter}
          onClose={() => setIsAreaModalOpen(false)}
          onFocusCoordinates={(lat, lng) => {
            setSelectedEvent({
              geo_event_id: `AREA-SCAN-${Date.now()}`,
              event_id: 'AREA-SCAN',
              case_id: targetCaseId,
              latitude: lat,
              longitude: lng,
              timestamp: new Date().toISOString(),
              timestamp_ms: Date.now(),
              raw_timestamp: new Date().toISOString(),
              location_type: 'GPS' as any,
              accuracy_radius_meters: 500,
              location_confidence: 1.0,
              location_name: `Geofence Center (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
              domain: 'ANALYTICAL',
              event_type: 'GEOFENCE_CENTER',
              raw_evidence_id: 'SCAN',
              anomaly_score: 0,
              anomaly_reasons: [],
              epistemic_status: 'OBSERVED',
              metadata: {},
            });
            setIsEntityDrawerOpen(true);
          }}
        />
      )}
    </div>
  );
};

export default GeoWorkspace;
