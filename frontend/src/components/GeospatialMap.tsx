'use client';
import React, { useState, useEffect, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import Map from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ScatterplotLayer } from '@deck.gl/layers';
import { TripsLayer } from '@deck.gl/geo-layers';
import { useTimelineStore } from '../store/useTimelineStore';
import { useCase } from '../context/CaseContext';

const INITIAL_VIEW_STATE = {
  longitude: 77.2090,
  latitude: 28.6139,
  zoom: 11,
  pitch: 45,
  bearing: 0
};

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const colors = [
  [56, 189, 248], // sky
  [239, 68, 68],  // red
  [34, 197, 94],  // green
  [234, 179, 8],  // yellow
  [168, 85, 247], // purple
];
function getColorForCluster(cluster_id: string): [number, number, number] {
  const hash = cluster_id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length] as [number, number, number];
}

export default function GeospatialMap() {
  const { activeCase } = useCase();
  const [waypoints, setWaypoints] = useState<any[]>([]);
  const { currentTime, timeRange } = useTimelineStore();

  useEffect(() => {
    const url = activeCase?.case_id 
      ? `/api/geo/sync-data?case_id=${encodeURIComponent(activeCase.case_id)}`
      : '/api/geo/sync-data';
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.waypoints) {
          setWaypoints(data.waypoints);
        }
      })
      .catch(err => console.error("Geo sync error:", err));
  }, [activeCase?.case_id]);

  const layers = useMemo(() => {
    const allPoints: any[] = [];
    waypoints.forEach(wp => {
      wp.path.forEach((coords: number[]) => {
        allPoints.push({ position: coords, cluster_id: wp.cluster_id });
      });
    });

    return [
      new ScatterplotLayer({
        id: 'towers-layer',
        data: allPoints,
        getPosition: d => d.position,
        getFillColor: d => getColorForCluster(d.cluster_id),
        getRadius: 100,
        radiusMinPixels: 4,
        radiusMaxPixels: 10,
        opacity: 0.8,
        pickable: true
      }),
      new TripsLayer({
        id: 'trips-layer',
        data: waypoints,
        getPath: d => d.path,
        getTimestamps: d => d.timestamps,
        getColor: d => getColorForCluster(d.cluster_id),
        opacity: 1,
        widthMinPixels: 3,
        trailLength: (timeRange[1] - timeRange[0]) * 0.05, // 5% trail length
        currentTime: currentTime,
        shadowEnabled: false
      })
    ];
  }, [waypoints, currentTime, timeRange]);

  return (
    <div className="relative w-full h-full bg-[#020617] border border-cyanNeon/30 rounded overflow-hidden">
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE as any}
        controller={true}
        layers={layers}
      >
        <Map mapStyle={MAP_STYLE} />
      </DeckGL>
      <div className="absolute top-4 left-4 z-10 bg-obsidian/90 border border-cyanNeon/50 p-3 rounded backdrop-blur shadow-[0_0_15px_rgba(0,240,255,0.2)]">
        <h4 className="text-cyanNeon font-bold text-sm tracking-wide">GEOSPATIAL TRIPS ANALYSIS</h4>
        <p className="text-xs text-gray-400 mt-1">Real-time chronolocational tracking</p>
        <p className="text-[11px] font-mono text-crimsonRed mt-2 bg-black/50 p-1.5 rounded">
          TIME: {new Date(currentTime).toISOString().replace('T', ' ').split('.')[0]}
        </p>
      </div>
    </div>
  );
}
