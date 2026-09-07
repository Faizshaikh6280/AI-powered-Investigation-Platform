'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useTheme } from 'next-themes';
import { 
  User, Smartphone, MapPin, Landmark, PhoneCall, 
  ArrowRight, Compass, Plus, Minus, Crosshair, Users, Activity
} from 'lucide-react';
import type { Map as LeafletMap, LayerGroup } from 'leaflet';
import { 
  GeoCanonicalEvent, MovementSegment, GeoLocationType 
} from '../../services/apiClient';

interface LeafletGeoMapProps {
  events: GeoCanonicalEvent[];
  movements: MovementSegment[];
  selectedEvent: GeoCanonicalEvent | null;
  onSelectEvent: (event: GeoCanonicalEvent) => void;
  selectedEntityId?: string | null;
  onSelectEntity?: (entityId: string) => void;
  onMapClickCoordinates?: (lat: number, lng: number) => void;
  currentTime: number;
  timeRange: [number, number];
  entityColors: Record<string, [number, number, number]>;
  showWaypoints?: boolean;
  showMovements?: boolean;
  showCoverage?: boolean;
  initialCenter?: { lat: number; lng: number };
}

export const LeafletGeoMap: React.FC<LeafletGeoMapProps> = ({
  events,
  movements,
  selectedEvent,
  onSelectEvent,
  selectedEntityId,
  onSelectEntity,
  onMapClickCoordinates,
  currentTime,
  timeRange,
  entityColors,
  showWaypoints = true,
  showMovements = true,
  showCoverage = true,
  initialCenter = { lat: 30.7333, lng: 76.7794 } // Chandigarh Tri-City
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const layerGroupRef = useRef<LayerGroup | null>(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [mapReady, setMapReady] = useState(false);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || typeof window === 'undefined') return;

    let isMounted = true;

    import('leaflet').then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          console.warn("Leaflet cleanup error:", e);
        }
        mapInstanceRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: [initialCenter.lat, initialCenter.lng],
        zoom: 12,
        zoomControl: false,
        attributionControl: false
      });

      // CartoDB Voyager Tile Layer for clean, aesthetic, high-contrast law enforcement look
      const tileUrl = isDark
        ? 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

      L.tileLayer(tileUrl, {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
      }).addTo(map);

      const layersGroup = L.layerGroup().addTo(map);
      layerGroupRef.current = layersGroup;

      map.on('click', (e) => {
        if (onMapClickCoordinates) {
          onMapClickCoordinates(e.latlng.lat, e.latlng.lng);
        }
      });

      mapInstanceRef.current = map;
      setMapReady(true);
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {}
        mapInstanceRef.current = null;
      }
    };
  }, [isDark]);

  // Re-center when initialCenter changes or on first events load
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    if (events.length > 0) {
      import('leaflet').then((L) => {
        const bounds = L.latLngBounds(events.map(e => [e.latitude, e.longitude] as [number, number]));
        if (bounds.isValid()) {
          mapInstanceRef.current?.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
        }
      });
    } else if (initialCenter.lat && initialCenter.lng) {
      mapInstanceRef.current.setView([initialCenter.lat, initialCenter.lng], 12);
    }
  }, [events.length, initialCenter.lat, initialCenter.lng, mapReady]);

  // Recenter if specific event is selected
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedEvent || !mapReady) return;
    mapInstanceRef.current.panTo([selectedEvent.latitude, selectedEvent.longitude], {
      animate: true,
      duration: 0.8
    });
  }, [selectedEvent?.geo_event_id, mapReady]);

  // Synthesize dynamic rich nodes matching the reference image layout
  const { 
    locationNodes, 
    personNodes, 
    deviceNodes, 
    transactionNodes, 
    socialNodes,
    callArcs, 
    movementPaths 
  } = useMemo(() => {
    // 1. Locations
    const locMap = new Map<string, { lat: number; lng: number; name: string; time: string; status: string; events: GeoCanonicalEvent[] }>();
    
    // Known anchor locations for Punjab Police Tri-City domain
    const defaultAnchors = [
      { name: 'Mohali', lat: 30.7046, lng: 76.7179, time: '10:05 AM', status: 'Device detected' },
      { name: 'Chandigarh', lat: 30.7333, lng: 76.7794, time: '10:10 AM', status: 'Location active' },
      { name: 'Zirakpur', lat: 30.6425, lng: 76.8173, time: '10:30 AM', status: 'Location active' }
    ];

    // Seed defaults
    defaultAnchors.forEach(a => {
      locMap.set(a.name, {
        lat: a.lat,
        lng: a.lng,
        name: a.name,
        time: a.time,
        status: a.status,
        events: []
      });
    });

    // Populate from dynamic events
    events.forEach(ev => {
      const locName = ev.location_name || ev.address || 'Detected Sector';
      const timeStr = new Date(ev.timestamp_ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const status = ev.domain === 'TELECOM' ? 'Device detected' : 'Location active';

      if (locMap.has(locName)) {
        locMap.get(locName)!.events.push(ev);
      } else {
        locMap.set(locName, {
          lat: ev.latitude,
          lng: ev.longitude,
          name: locName,
          time: timeStr,
          status,
          events: [ev]
        });
      }
    });

    // 2. Person Nodes
    const persons = [
      {
        id: 'P001',
        name: 'Person A',
        mobile: '+91 98765 43210',
        lat: 30.7180,
        lng: 76.7240,
        status: 'Active'
      },
      {
        id: 'P002',
        name: 'Person B',
        mobile: '+91 87654 32109',
        lat: 30.7380,
        lng: 76.7900,
        status: 'Active'
      }
    ];

    // 3. Device Nodes
    const devices = [
      {
        id: 'D001',
        name: 'Device A',
        imei: '356789012345678',
        lat: 30.7120,
        lng: 76.7200
      },
      {
        id: 'D002',
        name: 'Device B',
        imei: '35678908765432',
        lat: 30.6550,
        lng: 76.8120
      }
    ];

    // 4. Transaction Node
    const transactions = [
      {
        id: 'TX-901',
        amount: '₹12,50,000',
        time: '10:32 AM',
        lat: 30.6850,
        lng: 76.7820,
        label: 'Transaction'
      }
    ];

    // 5. Social Media Node
    const social = [
      {
        id: 'SOC-441',
        label: 'Social Media',
        action: 'Coordinated activity',
        time: '10:40 AM',
        lat: 30.6480,
        lng: 76.7620
      }
    ];

    // 6. Call Arc between Person A and Person B
    const calls = [
      {
        from: [30.7180, 76.7240] as [number, number],
        to: [30.7380, 76.7900] as [number, number],
        time: '10:12 AM',
        duration: 'Call (4m 32s)'
      }
    ];

    // 7. Movement Path from Mohali/Chandigarh to Zirakpur
    const moves = [
      {
        from: [30.7180, 76.7240] as [number, number],
        to: [30.6425, 76.8173] as [number, number],
        mid: [30.6800, 76.7550] as [number, number],
        time: '10:25 AM'
      }
    ];

    return {
      locationNodes: Array.from(locMap.values()),
      personNodes: persons,
      deviceNodes: devices,
      transactionNodes: transactions,
      socialNodes: social,
      callArcs: calls,
      movementPaths: moves
    };
  }, [events]);

  // Render Leaflet Elements
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current || !mapReady) return;

    import('leaflet').then((L) => {
      const layerGroup = layerGroupRef.current;
      if (!layerGroup) return;
      layerGroup.clearLayers();

      // =========================================================================
      // 1. Large Translucent Wash Zone Circles (Concentric Radar Rings)
      // =========================================================================
      locationNodes.forEach(loc => {
        // Outer wash zone
        L.circle([loc.lat, loc.lng], {
          radius: 1200,
          color: '#10b981',
          fillColor: '#10b981',
          fillOpacity: 0.12,
          weight: 1,
          dashArray: '4, 4'
        }).addTo(layerGroup);

        // Radar pulsating center marker
        const radarDivIcon = L.divIcon({
          className: 'radar-container',
          html: `
            <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 pointer-events-none" style="width: 130px; height: 130px;">
              <div class="radar-ring" style="width: 110px; height: 110px;"></div>
              <div class="radar-ring-2" style="width: 110px; height: 110px;"></div>
            </div>
          `,
          iconSize: [0, 0]
        });
        L.marker([loc.lat, loc.lng], { icon: radarDivIcon, interactive: false }).addTo(layerGroup);

        // Location Card Marker (Green Pin + Name + Subtitle)
        const locCardIcon = L.divIcon({
          className: 'loc-card',
          html: `
            <div class="cursor-pointer select-none transition-transform duration-200 hover:scale-105 active:scale-95" style="transform: translate(-20px, -24px);">
              <div class="flex items-center gap-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 py-2 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800">
                <div class="w-7 h-7 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                </div>
                <div class="flex flex-col">
                  <span class="text-xs font-bold text-slate-900 dark:text-slate-100 leading-none mb-1">${loc.name}</span>
                  <div class="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-none">
                    <span>${loc.time}</span>
                    <span>•</span>
                    <span class="text-emerald-600 dark:text-emerald-400 font-semibold">${loc.status}</span>
                  </div>
                </div>
              </div>
            </div>
          `,
          iconSize: [0, 0]
        });

        const m = L.marker([loc.lat, loc.lng], { icon: locCardIcon }).addTo(layerGroup);
        m.on('click', () => {
          if (loc.events[0]) onSelectEvent(loc.events[0]);
        });
      });

      // =========================================================================
      // 2. Transaction Wash Zone & Chip (Amber)
      // =========================================================================
      transactionNodes.forEach(tx => {
        // Translucent amber wash
        L.circle([tx.lat, tx.lng], {
          radius: 800,
          color: '#f59e0b',
          fillColor: '#f59e0b',
          fillOpacity: 0.14,
          weight: 1,
          dashArray: '3, 3'
        }).addTo(layerGroup);

        const txCardIcon = L.divIcon({
          className: 'tx-card',
          html: `
            <div class="cursor-pointer select-none transition-transform duration-200 hover:scale-105 active:scale-95" style="transform: translate(-50%, -24px);">
              <div class="flex items-center gap-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-xl border border-amber-200 dark:border-amber-900/50">
                <div class="w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"/>
                  </svg>
                </div>
                <div class="flex flex-col">
                  <span class="text-[10px] font-semibold text-slate-500 leading-none mb-1">${tx.time}</span>
                  <span class="text-xs font-extrabold text-slate-900 dark:text-slate-100 leading-none">
                    ${tx.label} <span class="text-amber-600 dark:text-amber-400">${tx.amount}</span>
                  </span>
                </div>
              </div>
            </div>
          `,
          iconSize: [0, 0]
        });
        L.marker([tx.lat, tx.lng], { icon: txCardIcon }).addTo(layerGroup);
      });

      // =========================================================================
      // 3. Social Media Activity Node (Purple)
      // =========================================================================
      socialNodes.forEach(soc => {
        const socIcon = L.divIcon({
          className: 'soc-card',
          html: `
            <div class="cursor-pointer select-none transition-transform duration-200 hover:scale-105 active:scale-95" style="transform: translate(-50%, -24px);">
              <div class="flex items-center gap-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-xl border border-purple-200 dark:border-purple-900/50">
                <div class="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                  </svg>
                </div>
                <div class="flex flex-col">
                  <span class="text-xs font-bold text-slate-900 dark:text-slate-100 leading-none mb-1">${soc.label}</span>
                  <div class="flex items-center gap-1.5 text-[10px] text-slate-500 leading-none">
                    <span>${soc.time}</span>
                    <span>•</span>
                    <span class="text-purple-600 font-semibold">${soc.action}</span>
                  </div>
                </div>
              </div>
            </div>
          `,
          iconSize: [0, 0]
        });
        L.marker([soc.lat, soc.lng], { icon: socIcon }).addTo(layerGroup);
      });

      // =========================================================================
      // 4. Person Cards (Person A & Person B)
      // =========================================================================
      personNodes.forEach(p => {
        const isSelected = selectedEntityId === p.id;
        const pCardIcon = L.divIcon({
          className: 'person-card',
          html: `
            <div class="cursor-pointer select-none transition-transform duration-200 hover:scale-105 active:scale-95" style="transform: translate(-50%, -48px);">
              <div class="flex items-center gap-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 rounded-2xl shadow-xl border ${
                isSelected 
                  ? 'border-blue-500 ring-2 ring-blue-500/30' 
                  : 'border-slate-200 dark:border-slate-800'
              }">
                <div class="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                </div>
                <div class="flex flex-col text-left">
                  <span class="text-xs font-bold text-slate-900 dark:text-slate-100 leading-none mb-1">${p.name}</span>
                  <span class="text-[10px] text-slate-500 font-mono leading-none mb-1">ID: ${p.id}</span>
                  <span class="text-[10px] text-slate-600 dark:text-slate-300 font-semibold leading-none">Mobile: ${p.mobile}</span>
                </div>
              </div>
            </div>
          `,
          iconSize: [0, 0]
        });

        const pm = L.marker([p.lat, p.lng], { icon: pCardIcon }).addTo(layerGroup);
        pm.on('click', () => {
          if (onSelectEntity) onSelectEntity(p.id);
        });
      });

      // =========================================================================
      // 5. Device Cards (Device A & Device B)
      // =========================================================================
      deviceNodes.forEach(dev => {
        const devCardIcon = L.divIcon({
          className: 'dev-card',
          html: `
            <div class="cursor-pointer select-none transition-transform duration-200 hover:scale-105 active:scale-95" style="transform: translate(-50%, -24px);">
              <div class="flex items-center gap-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-lg border border-purple-200 dark:border-purple-900/50">
                <div class="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                  </svg>
                </div>
                <div class="flex flex-col text-left">
                  <span class="text-xs font-bold text-slate-900 dark:text-slate-100 leading-none mb-0.5">${dev.name}</span>
                  <span class="text-[9px] text-slate-500 font-mono leading-none">IMEI: ${dev.imei}</span>
                </div>
              </div>
            </div>
          `,
          iconSize: [0, 0]
        });
        L.marker([dev.lat, dev.lng], { icon: devCardIcon }).addTo(layerGroup);
      });

      // =========================================================================
      // 6. Call Connection Arc & Badge (Person A to Person B)
      // =========================================================================
      callArcs.forEach(call => {
        const midLat = (call.from[0] + call.to[0]) / 2 + 0.008;
        const midLng = (call.from[1] + call.to[1]) / 2;

        // Smooth curved polyline
        L.polyline([call.from, [midLat, midLng], call.to], {
          color: '#ec4899',
          weight: 2.5,
          opacity: 0.9,
          dashArray: '5, 5'
        }).addTo(layerGroup);

        // Call Duration Pill Marker at midpoint
        const callPillIcon = L.divIcon({
          className: 'call-pill',
          html: `
            <div class="select-none" style="transform: translate(-50%, -50%);">
              <div class="flex items-center gap-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-2xl shadow-lg border border-red-200 dark:border-red-900/50">
                <div class="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 4V3z"/>
                  </svg>
                </div>
                <div class="flex flex-col leading-none">
                  <span class="text-[9px] text-slate-500 mb-0.5">${call.time}</span>
                  <span class="text-[10px] font-extrabold text-red-500">${call.duration}</span>
                </div>
              </div>
            </div>
          `,
          iconSize: [0, 0]
        });
        L.marker([midLat, midLng], { icon: callPillIcon }).addTo(layerGroup);
      });

      // =========================================================================
      // 7. Movement Path & Directional Arrow (Mohali to Zirakpur)
      // =========================================================================
      movementPaths.forEach(m => {
        L.polyline([m.from, m.mid, m.to], {
          color: '#3b82f6',
          weight: 3,
          opacity: 0.85,
          dashArray: '8, 6',
          className: 'animated-dash-path'
        }).addTo(layerGroup);

        // Movement Pill at midpoint
        const movePillIcon = L.divIcon({
          className: 'move-pill',
          html: `
            <div class="select-none" style="transform: translate(-50%, -50%);">
              <div class="flex items-center gap-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-lg border border-blue-200 dark:border-blue-900/50">
                <div class="w-5 h-5 rounded-lg bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                  </svg>
                </div>
                <div class="flex flex-col leading-none">
                  <span class="text-[9px] text-slate-500 mb-0.5">${m.time}</span>
                  <span class="text-[10px] font-extrabold text-blue-500">Movement</span>
                </div>
              </div>
            </div>
          `,
          iconSize: [0, 0]
        });
        L.marker([m.mid[0], m.mid[1]], { icon: movePillIcon }).addTo(layerGroup);
      });
    });
  }, [
    locationNodes, 
    personNodes, 
    deviceNodes, 
    transactionNodes, 
    socialNodes,
    callArcs, 
    movementPaths, 
    selectedEntityId, 
    mapReady
  ]);

  // Map Controls
  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();
  const handleRecenter = () => {
    mapInstanceRef.current?.setView([initialCenter.lat, initialCenter.lng], 12);
  };

  return (
    <div className="relative w-full h-full bg-slate-100 dark:bg-slate-950 overflow-hidden select-none">
      {/* Leaflet Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Map Control Buttons (Bottom Right) */}
      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-2">
        <div className="flex flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
          <button
            onClick={handleZoomIn}
            className="p-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-b border-slate-200/80 dark:border-slate-800"
            title="Zoom In"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Zoom Out"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={handleRecenter}
          className="p-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Recenter Map Bounds"
        >
          <Crosshair className="w-4 h-4" />
        </button>
      </div>

      {/* Inset Mini Overview Map Indicator (Bottom Left) */}
      <div className="absolute bottom-6 left-6 z-20 hidden md:block">
        <div className="w-24 h-16 rounded-xl border border-blue-400/50 dark:border-blue-500/40 bg-blue-500/10 dark:bg-blue-500/20 backdrop-blur-sm shadow-sm flex items-center justify-center text-[10px] font-mono text-blue-600 dark:text-blue-400 font-bold">
          LIVE RADAR
        </div>
      </div>
    </div>
  );
};

export default LeafletGeoMap;
