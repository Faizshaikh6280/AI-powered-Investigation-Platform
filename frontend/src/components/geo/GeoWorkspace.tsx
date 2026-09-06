'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Map as MapIcon, Users, Landmark, BookOpen, Crosshair, Filter, 
  Download, Layers, RefreshCw, Activity, ShieldCheck, Sparkles, Navigation 
} from 'lucide-react';

import { useCase } from '../../context/CaseContext';
import { useTimelineStore } from '../../store/useTimelineStore';
import { 
  api, GeoCanonicalEvent, MovementSegment, CoLocationFinding, 
  CommonPlace, SpatialStoryCard, ActivityDensityCell, GeoInvestigationResponse 
} from '../../services/apiClient';

import { GeoDeckGLMap } from './GeoDeckGLMap';
import { GeoPlaybackControls } from './GeoPlaybackControls';
import { GeoLegend } from './GeoLegend';
import { GeoFilterPanel } from './GeoFilterPanel';
import { GeoCoLocationDrawer } from './GeoCoLocationDrawer';
import { GeoCommonPlacesPanel } from './GeoCommonPlacesPanel';
import { GeoSpatialStoryPanel } from './GeoSpatialStoryPanel';
import { GeoEventDetailDrawer } from './GeoEventDetailDrawer';
import { GeoAreaInvestigationModal } from './GeoAreaInvestigationModal';

// Entity color palette for visually distinct trajectories
const ENTITY_COLOR_PALETTE: Array<[number, number, number]> = [
  [6, 182, 212],   // Cyan
  [239, 68, 68],   // Crimson
  [52, 211, 153],  // Emerald
  [251, 191, 36],  // Amber
  [168, 85, 247],  // Purple
  [244, 114, 182], // Pink
  [59, 130, 246],  // Blue
  [249, 115, 22],  // Orange
  [163, 230, 53],  // Lime
  [14, 165, 233],  // Sky
];

export const GeoWorkspace: React.FC<{ onViewOnGraph?: (entityId: string) => void }> = ({
  onViewOnGraph
}) => {
  const { activeCase, cases, setActiveCaseId } = useCase();
  const { currentTime, setCurrentTime, timeRange, setTimeRange } = useTimelineStore();

  const [investigation, setInvestigation] = useState<GeoInvestigationResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Active side panel tab: 'NONE' | 'COLOCATIONS' | 'COMMON_PLACES' | 'STORY'
  const [activeSidePanel, setActiveSidePanel] = useState<'NONE' | 'COLOCATIONS' | 'COMMON_PLACES' | 'STORY'>('NONE');

  // Modals & Panels toggle
  const [isAreaModalOpen, setIsAreaModalOpen] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showLegend, setShowLegend] = useState(true);

  // Layer Toggles
  const [showWaypoints, setShowWaypoints] = useState(true);
  const [showMovements, setShowMovements] = useState(true);
  const [showTrips, setShowTrips] = useState(true);
  const [showCoverage, setShowCoverage] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(10);

  // Selection state
  const [selectedEvent, setSelectedEvent] = useState<GeoCanonicalEvent | null>(null);
  const [areaModalCenter, setAreaModalCenter] = useState<[number, number]>([30.7410, 76.7680]);

  // Filters
  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [minConfidence, setMinConfidence] = useState<number>(0);

  const targetCaseId = activeCase?.case_id || 'INV-2026-BLACK-CIRCUIT';

  // Load geo investigation data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getGeoInvestigation(targetCaseId, {
        entity_ids: selectedEntities.length > 0 ? selectedEntities : undefined,
        domains: selectedDomains.length > 0 ? selectedDomains : undefined,
        min_confidence: minConfidence > 0 ? minConfidence : undefined,
      });
      setInvestigation(res);

      // Sync timeline range if available
      if (res.events.length > 0) {
        const timestamps = res.events.map(e => e.timestamp_ms);
        const minT = Math.min(...timestamps);
        const maxT = Math.max(...timestamps);
        setTimeRange([minT, maxT]);
        if (currentTime < minT || currentTime > maxT) {
          setCurrentTime(minT);
        }
      }
    } catch (err) {
      console.error("Failed to load geospatial investigation:", err);
    } finally {
      setLoading(false);
    }
  }, [targetCaseId, selectedEntities, selectedDomains, minConfidence, currentTime, setCurrentTime, setTimeRange]);

  useEffect(() => {
    loadData();
  }, [targetCaseId]);

  // Map entities to stable colors
  const entityColors = useMemo(() => {
    const colors: Record<string, [number, number, number]> = {};
    if (!investigation) return colors;

    const uniqueEnts = Array.from(new Set(investigation.events.map(e => e.entity_name || e.entity_id || 'UNKNOWN')));
    uniqueEnts.forEach((ent, idx) => {
      colors[ent] = ENTITY_COLOR_PALETTE[idx % ENTITY_COLOR_PALETTE.length];
    });
    return colors;
  }, [investigation]);

  const availableEntities = useMemo(() => {
    if (!investigation) return [];
    const map = new Map<string, string>();
    investigation.events.forEach(e => {
      const id = e.entity_id || 'UNKNOWN';
      const name = e.entity_name || id;
      map.set(id, name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({
      id,
      name,
      color: entityColors[name] || [6, 182, 212],
    }));
  }, [investigation, entityColors]);

  const availableDomains = useMemo(() => {
    if (!investigation) return [];
    return Array.from(new Set(investigation.events.map(e => e.domain)));
  }, [investigation]);

  // Format waypoints for TripsLayer
  const tripsWaypoints = useMemo(() => {
    if (!investigation) return [];
    const groups: Record<string, { cluster_id: string; entity_name: string; path: number[][]; timestamps: number[] }> = {};

    investigation.events.forEach(ev => {
      const key = ev.entity_name || ev.entity_id || 'UNKNOWN';
      if (!groups[key]) {
        groups[key] = {
          cluster_id: key,
          entity_name: key,
          path: [],
          timestamps: [],
        };
      }
      groups[key].path.push([ev.longitude, ev.latitude]);
      groups[key].timestamps.push(ev.timestamp_ms);
    });

    return Object.values(groups).map(g => {
      const sorted = g.timestamps.map((t, i) => ({ t, p: g.path[i] })).sort((a, b) => a.t - b.t);
      return {
        cluster_id: g.cluster_id,
        entity_name: g.entity_name,
        path: sorted.map(s => s.p),
        timestamps: sorted.map(s => s.t),
      };
    });
  }, [investigation]);

  // Export handlers
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

  const resetFilters = () => {
    setSelectedEntities([]);
    setSelectedDomains([]);
    setMinConfidence(0);
  };

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden relative">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-border/80 bg-[#080d1a]/95 px-4 flex items-center justify-between z-20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-bold text-foreground tracking-tight">
            <div className="p-1.5 rounded-lg bg-primary/20 text-primary border border-primary/40">
              <MapIcon className="w-4 h-4" />
            </div>
            <span className="text-sm">Geospatial Intelligence Engine</span>
          </div>

          <div className="h-4 w-px bg-border mx-1" />

          {/* Case Selector Dropdown */}
          <select
            value={targetCaseId}
            onChange={e => setActiveCaseId(e.target.value)}
            className="bg-secondary/70 border border-border/70 rounded-md px-2.5 py-1 text-xs text-foreground font-medium focus:outline-none focus:border-primary"
          >
            {cases.map(c => (
              <option key={c.case_id} value={c.case_id}>
                {c.title || c.case_id}
              </option>
            ))}
            {cases.length === 0 && (
              <option value="INV-2026-BLACK-CIRCUIT">Operation Black Circuit</option>
            )}
          </select>
        </div>

        {/* Investigative Module Switchers */}
        <div className="flex items-center gap-1.5 bg-secondary/40 p-1 rounded-xl border border-border/60 text-xs">
          <button
            onClick={() => setActiveSidePanel(activeSidePanel === 'COLOCATIONS' ? 'NONE' : 'COLOCATIONS')}
            className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
              activeSidePanel === 'COLOCATIONS'
                ? 'bg-primary text-primary-foreground font-bold shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Co-Locations</span>
            {investigation && (
              <span className="px-1.5 py-0.2 rounded-full bg-black/30 text-[10px] font-mono">
                {investigation.co_locations.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSidePanel(activeSidePanel === 'COMMON_PLACES' ? 'NONE' : 'COMMON_PLACES')}
            className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
              activeSidePanel === 'COMMON_PLACES'
                ? 'bg-primary text-primary-foreground font-bold shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
            }`}
          >
            <Landmark className="w-3.5 h-3.5" />
            <span>Common Places</span>
            {investigation && (
              <span className="px-1.5 py-0.2 rounded-full bg-black/30 text-[10px] font-mono">
                {investigation.common_places.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSidePanel(activeSidePanel === 'STORY' ? 'NONE' : 'STORY')}
            className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
              activeSidePanel === 'STORY'
                ? 'bg-primary text-primary-foreground font-bold shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Spatial Story</span>
          </button>

          <button
            onClick={() => setIsAreaModalOpen(true)}
            className="px-3 py-1.5 rounded-lg font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 flex items-center gap-1.5 transition-all"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Geofence Area Scan</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className={`p-2 rounded-lg border text-xs flex items-center gap-1.5 transition-colors ${
              showFilterPanel
                ? 'bg-primary/20 border-primary text-primary'
                : 'bg-secondary/50 border-border text-muted-foreground hover:text-foreground'
            }`}
            title="Toggle Filter Sidebar"
          >
            <Filter className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowLegend(!showLegend)}
            className={`p-2 rounded-lg border text-xs flex items-center gap-1.5 transition-colors ${
              showLegend
                ? 'bg-primary/20 border-primary text-primary'
                : 'bg-secondary/50 border-border text-muted-foreground hover:text-foreground'
            }`}
            title="Toggle Map Layers & Legend"
          >
            <Layers className="w-4 h-4" />
          </button>

          <button
            onClick={handleExportGeoJSON}
            className="p-2 rounded-lg bg-secondary/50 border border-border text-muted-foreground hover:text-foreground transition-colors"
            title="Export GeoJSON Dossier"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={loadData}
            className="p-2 rounded-lg bg-secondary/50 border border-border text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh Geospatial Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Investigation Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Side Sliding Drawers */}
        {activeSidePanel === 'COLOCATIONS' && investigation && (
          <GeoCoLocationDrawer
            coLocations={investigation.co_locations}
            onSelectCoLocation={co => {
              setSelectedEvent({
                geo_event_id: `COLOC-MID-${co.co_location_id}`,
                event_id: co.supporting_events[0] || '',
                case_id: targetCaseId,
                latitude: co.latitude,
                longitude: co.longitude,
                timestamp: co.start_time,
                timestamp_ms: new Date(co.start_time).getTime(),
                raw_timestamp: co.start_time,
                location_type: 'GPS' as any,
                accuracy_radius_meters: co.distance_between_meters || 100,
                location_confidence: 0.9,
                location_name: co.location_name,
                domain: 'CORRELATION',
                event_type: 'CO_LOCATION',
                raw_evidence_id: co.co_location_id,
                anomaly_score: co.correlation_score,
                anomaly_reasons: [`Co-location observed between ${co.entity_names.join(' & ')}`],
                epistemic_status: 'OBSERVED',
                metadata: { co_location: co },
              });
            }}
            onViewOnGraph={onViewOnGraph}
          />
        )}

        {activeSidePanel === 'COMMON_PLACES' && investigation && (
          <GeoCommonPlacesPanel
            commonPlaces={investigation.common_places}
            onSelectPlace={place => {
              setSelectedEvent({
                geo_event_id: `HUB-${place.place_id}`,
                event_id: place.place_id,
                case_id: targetCaseId,
                latitude: place.latitude,
                longitude: place.longitude,
                timestamp: place.time_spans[0] || new Date().toISOString(),
                timestamp_ms: new Date(place.time_spans[0] || Date.now()).getTime(),
                raw_timestamp: place.time_spans[0] || '',
                location_type: place.location_type,
                accuracy_radius_meters: place.radius_meters,
                location_confidence: 0.95,
                location_name: place.place_name,
                domain: place.dominant_domain,
                event_type: 'SPATIAL_HUB',
                raw_evidence_id: place.place_id,
                anomaly_score: 0,
                anomaly_reasons: [],
                epistemic_status: 'DERIVED',
                metadata: { place },
              });
            }}
          />
        )}

        {activeSidePanel === 'STORY' && investigation && (
          <GeoSpatialStoryPanel
            storyCards={investigation.story_cards}
            onSelectCard={card => {
              setSelectedEvent({
                geo_event_id: card.card_id,
                event_id: card.card_id,
                case_id: targetCaseId,
                entity_id: card.entity_id,
                entity_name: card.entity_name,
                latitude: card.coordinates[0],
                longitude: card.coordinates[1],
                timestamp: card.timestamp,
                timestamp_ms: new Date(card.timestamp).getTime(),
                raw_timestamp: card.timestamp,
                location_type: 'GPS' as any,
                accuracy_radius_meters: 50,
                location_confidence: 0.95,
                location_name: card.location_name,
                domain: 'LOCATION',
                event_type: 'STORY_MILESTONE',
                raw_evidence_id: card.evidence_refs[0] || 'STORY',
                anomaly_score: card.anomalies.length > 0 ? 80 : 0,
                anomaly_reasons: card.anomalies,
                epistemic_status: 'OBSERVED',
                metadata: { story: card },
              });
            }}
          />
        )}

        {/* Center: Interactive DeckGL Map */}
        <div className="flex-1 h-full w-full relative">
          <GeoDeckGLMap
            events={investigation?.events || []}
            movements={investigation?.movements || []}
            tripsWaypoints={tripsWaypoints}
            densityGrid={investigation?.density_grid || []}
            selectedEvent={selectedEvent}
            onSelectEvent={ev => setSelectedEvent(ev)}
            onMapClickCoordinates={handleMapClick}
            currentTime={currentTime}
            timeRange={timeRange}
            entityColors={entityColors}
            showWaypoints={showWaypoints}
            showMovements={showMovements}
            showTrips={showTrips}
            showCoverage={showCoverage}
            showHeatmap={showHeatmap}
            initialCenter={investigation?.summary_metrics?.center}
          />

          {/* Floating Filter Panel (Top Left) */}
          {showFilterPanel && (
            <div className="absolute top-4 left-4 z-30 max-w-sm">
              <GeoFilterPanel
                availableEntities={availableEntities}
                selectedEntities={selectedEntities}
                setSelectedEntities={setSelectedEntities}
                availableDomains={availableDomains}
                selectedDomains={selectedDomains}
                setSelectedDomains={setSelectedDomains}
                minConfidence={minConfidence}
                setMinConfidence={setMinConfidence}
                onResetFilters={resetFilters}
              />
            </div>
          )}

          {/* Floating Map Legend & Layer Visibility (Bottom Left) */}
          {showLegend && (
            <div className="absolute bottom-4 left-4 z-30">
              <GeoLegend
                showWaypoints={showWaypoints}
                setShowWaypoints={setShowWaypoints}
                showMovements={showMovements}
                setShowMovements={setShowMovements}
                showTrips={showTrips}
                setShowTrips={setShowTrips}
                showCoverage={showCoverage}
                setShowCoverage={setShowCoverage}
                showHeatmap={showHeatmap}
                setShowHeatmap={setShowHeatmap}
              />
            </div>
          )}

          {/* Floating Playback Scrubber (Bottom Center) */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-full max-w-xl px-4">
            <GeoPlaybackControls
              currentTime={currentTime}
              setCurrentTime={setCurrentTime}
              timeRange={timeRange}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              playbackSpeed={playbackSpeed}
              setPlaybackSpeed={setPlaybackSpeed}
            />
          </div>

          {/* Loading Indicator */}
          {loading && (
            <div className="absolute top-4 right-4 z-30 bg-[#0b101b]/90 border border-primary/40 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-mono text-primary shadow-xl backdrop-blur-md">
              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Synthesizing Geo Intelligence...</span>
            </div>
          )}
        </div>

        {/* Right Event Detail Drawer */}
        {selectedEvent && (
          <GeoEventDetailDrawer
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            onViewOnGraph={onViewOnGraph}
          />
        )}
      </div>

      {/* Geofence Area Investigation Modal */}
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
          }}
        />
      )}
    </div>
  );
};
