'use client';
import React, { useMemo, useState, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import Map from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ScatterplotLayer, PathLayer } from '@deck.gl/layers';
import { TripsLayer } from '@deck.gl/geo-layers';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';

import { 
  GeoCanonicalEvent, MovementSegment, CoLocationFinding, 
  ActivityDensityCell, GeoLocationType 
} from '../../services/apiClient';

interface GeoDeckGLMapProps {
  events: GeoCanonicalEvent[];
  movements: MovementSegment[];
  tripsWaypoints: any[];
  densityGrid: ActivityDensityCell[];
  selectedEvent: GeoCanonicalEvent | null;
  onSelectEvent: (event: GeoCanonicalEvent) => void;
  onMapClickCoordinates?: (lat: number, lng: number) => void;
  currentTime: number;
  timeRange: [number, number];
  entityColors: Record<string, [number, number, number]>;
  
  // Layer Toggles
  showWaypoints: boolean;
  showMovements: boolean;
  showTrips: boolean;
  showCoverage: boolean;
  showHeatmap: boolean;
  
  initialCenter?: { lat: number; lng: number };
}

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export const GeoDeckGLMap: React.FC<GeoDeckGLMapProps> = ({
  events,
  movements,
  tripsWaypoints,
  densityGrid,
  selectedEvent,
  onSelectEvent,
  onMapClickCoordinates,
  currentTime,
  timeRange,
  entityColors,
  showWaypoints,
  showMovements,
  showTrips,
  showCoverage,
  showHeatmap,
  initialCenter = { lat: 28.6139, lng: 77.2090 },
}) => {
  const [viewState, setViewState] = useState({
    longitude: initialCenter.lng,
    latitude: initialCenter.lat,
    zoom: 11.5,
    pitch: 45,
    bearing: 0,
  });

  // Re-center when initialCenter changes
  useEffect(() => {
    if (initialCenter && initialCenter.lat && initialCenter.lng) {
      setViewState(prev => ({
        ...prev,
        latitude: initialCenter.lat,
        longitude: initialCenter.lng,
        transitionDuration: 1000,
      }));
    }
  }, [initialCenter?.lat, initialCenter?.lng]);

  // Center on selected event if changed
  useEffect(() => {
    if (selectedEvent && selectedEvent.latitude && selectedEvent.longitude) {
      setViewState(prev => ({
        ...prev,
        latitude: selectedEvent.latitude,
        longitude: selectedEvent.longitude,
        zoom: Math.max(prev.zoom, 13),
        transitionDuration: 800,
      }));
    }
  }, [selectedEvent?.geo_event_id]);

  const layers = useMemo(() => {
    const activeLayers: any[] = [];

    // 1. Activity Density Heatmap Layer
    if (showHeatmap && densityGrid.length > 0) {
      activeLayers.push(
        new HeatmapLayer({
          id: 'geo-activity-heatmap',
          data: densityGrid,
          getPosition: (d: ActivityDensityCell) => [d.longitude, d.latitude],
          getWeight: (d: ActivityDensityCell) => d.event_count,
          radiusPixels: 40,
          intensity: 1.5,
          threshold: 0.1,
          opacity: 0.7,
        })
      );
    }

    // 2. Trajectories & Movement Tracks (PathLayer)
    if (showMovements && movements.length > 0) {
      activeLayers.push(
        new PathLayer({
          id: 'geo-movement-paths',
          data: movements,
          getPath: (d: MovementSegment) => d.path_points,
          getColor: (d: MovementSegment) => {
            const entKey = d.entity_name || d.entity_id;
            const c = entityColors[entKey] || [6, 182, 212];
            return d.is_gap ? [239, 68, 68, 160] : [c[0], c[1], c[2], 220];
          },
          getWidth: (d: MovementSegment) => (d.is_gap ? 2 : 3.5),
          widthMinPixels: 2,
          widthMaxPixels: 6,
          getDashArray: (d: MovementSegment) => (d.is_gap ? [8, 4] : [0, 0]),
          dashJustified: true,
          pickable: true,
        })
      );
    }

    // 3. Animated Trips Layer
    if (showTrips && tripsWaypoints.length > 0) {
      const trailDuration = Math.max(3600000, (timeRange[1] - timeRange[0]) * 0.05); // 5% trail window
      activeLayers.push(
        new TripsLayer({
          id: 'geo-trips-animated',
          data: tripsWaypoints,
          getPath: (d: any) => d.path,
          getTimestamps: (d: any) => d.timestamps,
          getColor: (d: any) => {
            const entKey = d.entity_name || d.cluster_id;
            return entityColors[entKey] || [251, 191, 36];
          },
          opacity: 1.0,
          widthMinPixels: 4,
          trailLength: trailDuration,
          currentTime: currentTime,
          shadowEnabled: false,
        })
      );
    }

    // 4. Cell Tower Coverage Radii (Scatterplot with large translucent radius)
    if (showCoverage) {
      const towerEvents = events.filter(e => e.location_type === GeoLocationType.CELL_TOWER || e.cell_tower_id);
      if (towerEvents.length > 0) {
        activeLayers.push(
          new ScatterplotLayer({
            id: 'geo-cell-coverage-sectors',
            data: towerEvents,
            getPosition: (d: GeoCanonicalEvent) => [d.longitude, d.latitude],
            getFillColor: [168, 85, 247, 40], // Translucent purple
            getLineColor: [168, 85, 247, 180],
            getLineWidth: 2,
            stroked: true,
            filled: true,
            getRadius: (d: GeoCanonicalEvent) => d.accuracy_radius_meters || 750,
            radiusMinPixels: 15,
            radiusMaxPixels: 60,
            pickable: false,
          })
        );
      }
    }

    // 5. Canonical Geo Waypoints (ScatterplotLayer)
    if (showWaypoints && events.length > 0) {
      activeLayers.push(
        new ScatterplotLayer({
          id: 'geo-waypoints-scatterplot',
          data: events,
          getPosition: (d: GeoCanonicalEvent) => [d.longitude, d.latitude],
          getFillColor: (d: GeoCanonicalEvent) => {
            if (selectedEvent && selectedEvent.geo_event_id === d.geo_event_id) {
              return [255, 255, 255, 255]; // Pure white highlight
            }
            if (d.anomaly_score > 0) {
              return [239, 68, 68, 240]; // Crimson Red anomaly
            }
            const entKey = d.entity_name || d.entity_id || 'UNKNOWN';
            const c = entityColors[entKey];
            if (c) return [c[0], c[1], c[2], 210];

            if (d.location_type === GeoLocationType.ATM) return [52, 211, 153, 220]; // Emerald
            if (d.location_type === GeoLocationType.CELL_TOWER) return [192, 132, 252, 220]; // Purple
            return [6, 182, 212, 220]; // Cyan default
          },
          getLineColor: (d: GeoCanonicalEvent) => {
            if (selectedEvent && selectedEvent.geo_event_id === d.geo_event_id) {
              return [6, 182, 212, 255];
            }
            return [0, 0, 0, 180];
          },
          getLineWidth: 2,
          stroked: true,
          getRadius: (d: GeoCanonicalEvent) => {
            if (selectedEvent && selectedEvent.geo_event_id === d.geo_event_id) return 200;
            if (d.anomaly_score > 0) return 140;
            return 80;
          },
          radiusMinPixels: 5,
          radiusMaxPixels: 18,
          pickable: true,
          onClick: (info: any) => {
            if (info.object) {
              onSelectEvent(info.object);
            }
          },
        })
      );
    }

    return activeLayers;
  }, [
    events,
    movements,
    tripsWaypoints,
    densityGrid,
    selectedEvent,
    entityColors,
    showWaypoints,
    showMovements,
    showTrips,
    showCoverage,
    showHeatmap,
    currentTime,
    timeRange,
    onSelectEvent,
  ]);

  return (
    <div className="relative w-full h-full bg-[#020617] overflow-hidden select-none">
      <DeckGL
        viewState={viewState as any}
        onViewStateChange={({ viewState: vs }: any) => setViewState(vs)}
        controller={true}
        layers={layers}
        onClick={(info: any) => {
          if (!info.object && info.coordinate && onMapClickCoordinates) {
            // Clicked map canvas -> coordinates for geofence query
            onMapClickCoordinates(info.coordinate[1], info.coordinate[0]);
          }
        }}
      >
        <Map mapStyle={MAP_STYLE} />
      </DeckGL>
    </div>
  );
};
