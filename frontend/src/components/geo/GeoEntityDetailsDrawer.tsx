'use client';

import React, { useState } from 'react';
import { 
  X, User, Phone, MapPin, Clock, Smartphone, 
  Activity, ChevronRight, Share2, CreditCard, Users, 
  ShieldCheck, AlertTriangle, ExternalLink, ArrowRight, CheckCircle2
} from 'lucide-react';
import { GeoCanonicalEvent } from '../../services/apiClient';

interface GeoEntityDetailsDrawerProps {
  entityId: string | null;
  entityName?: string;
  selectedEvent: GeoCanonicalEvent | null;
  events: GeoCanonicalEvent[];
  onClose: () => void;
  onViewOnGraph?: (entityId: string) => void;
  onSelectEvent?: (event: GeoCanonicalEvent) => void;
}

export const GeoEntityDetailsDrawer: React.FC<GeoEntityDetailsDrawerProps> = ({
  entityId,
  entityName,
  selectedEvent,
  events,
  onClose,
  onViewOnGraph,
  onSelectEvent,
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'ACTIVITY' | 'CONNECTIONS'>('OVERVIEW');

  if (!selectedEvent && !entityId && !entityName) return null;

  // Resolve entity information dynamically
  const resolvedName = entityName || selectedEvent?.entity_name || selectedEvent?.entity_id || 'Person A';
  const resolvedId = entityId || selectedEvent?.entity_id || 'P001';
  
  // Extract entity phone, IMEI, and status from event metadata
  const mobileNumber = selectedEvent?.metadata?.phone || 
    selectedEvent?.metadata?.target_phone || 
    (selectedEvent?.metadata?.msisdn ? `+91 ${selectedEvent.metadata.msisdn}` : '+91 98765 43210');
  
  const imeiNumber = selectedEvent?.metadata?.imei || selectedEvent?.device_id || '356789012345678';
  const deviceName = `Device ${resolvedName.replace('Person ', '')}`;
  
  const currentLocation = selectedEvent?.location_name || selectedEvent?.address || 'Mohali';
  const lastSeenFormatted = selectedEvent?.timestamp_ms 
    ? new Date(selectedEvent.timestamp_ms).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    : '28 Aug 2026, 10:05 AM';

  const activityDescription = selectedEvent?.domain === 'TELECOM'
    ? `Device detected at ${currentLocation}`
    : selectedEvent?.event_type === 'TRANSACTION'
    ? `Transaction executed at ${currentLocation}`
    : `Location active at ${currentLocation}`;

  // Filter all events associated with this entity or case
  const entityEvents = events.filter(e => 
    (e.entity_name && e.entity_name === resolvedName) || 
    (e.entity_id && e.entity_id === resolvedId)
  );

  // Dynamic Connections list
  const callsList = events.filter(e => e.domain === 'TELECOM' || e.event_type.includes('CALL'));
  const movementList = events.filter(e => e.domain === 'LOCATION' || e.location_type === 'GPS');
  const transactionList = events.filter(e => e.domain === 'FINANCIAL' || e.event_type.includes('TRANSACTION'));
  const socialList = events.filter(e => e.domain === 'SOCIAL' || e.domain === 'NETWORK');

  return (
    <div className="w-80 md:w-96 flex-shrink-0 h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-30 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      
      {/* Header */}
      <div className="h-14 px-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
        <h2 className="text-xs font-bold tracking-wider uppercase text-slate-700 dark:text-slate-200">
          ENTITY DETAILS
        </h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Close details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Profile Card */}
        <div className="flex items-center gap-3.5 pb-2">
          <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md font-bold text-base">
            <User className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {resolvedName}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Active
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              <span>ID: {resolvedId}</span>
              <span className="mx-1.5">•</span>
              <span>Mobile: {mobileNumber}</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`pb-2.5 px-3 transition-colors relative ${
              activeTab === 'OVERVIEW'
                ? 'text-blue-600 dark:text-blue-400 font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Overview
            {activeTab === 'OVERVIEW' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('ACTIVITY')}
            className={`pb-2.5 px-3 transition-colors relative ${
              activeTab === 'ACTIVITY'
                ? 'text-blue-600 dark:text-blue-400 font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Activity
            {activeTab === 'ACTIVITY' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('CONNECTIONS')}
            className={`pb-2.5 px-3 transition-colors relative ${
              activeTab === 'CONNECTIONS'
                ? 'text-blue-600 dark:text-blue-400 font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Connections
            {activeTab === 'CONNECTIONS' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
            )}
          </button>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'OVERVIEW' && (
          <div className="space-y-4">
            {/* Information Grid */}
            <div className="space-y-3.5 text-xs">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 text-[11px] block">Current Location</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{currentLocation}</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 text-[11px] block">Last Seen</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{lastSeenFormatted}</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 text-[11px] block">Device</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {deviceName} <span className="text-slate-400 font-normal">(IMEI: {imeiNumber})</span>
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 text-[11px] block">Activity</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{activityDescription}</span>
                </div>
              </div>
            </div>

            {/* View On Graph Action */}
            {onViewOnGraph && (
              <div className="pt-2">
                <button
                  onClick={() => onViewOnGraph(resolvedId)}
                  className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Inspect on Relationship Graph</span>
                </button>
              </div>
            )}

            {/* Connections Section */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                CONNECTIONS
              </h4>

              <div className="space-y-2">
                {/* 1. Contacted Person B */}
                <div 
                  onClick={() => callsList[0] && onSelectEvent?.(callsList[0])}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-500/15 text-red-500 flex items-center justify-center shrink-0">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Contacted {selectedEvent?.metadata?.counterpart || 'Person B'}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        10:12 AM | Call (4m 32s)
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform group-hover:translate-x-0.5" />
                </div>

                {/* 2. Moved to Chandigarh */}
                <div 
                  onClick={() => movementList[0] && onSelectEvent?.(movementList[0])}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Moved to Chandigarh
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        10:25 AM | Via IPDR
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform group-hover:translate-x-0.5" />
                </div>

                {/* 3. Related Transactions */}
                <div 
                  onClick={() => transactionList[0] && onSelectEvent?.(transactionList[0])}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Related Transactions
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        1 transaction | ₹12,50,000
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform group-hover:translate-x-0.5" />
                </div>

                {/* 4. Social Media Activity */}
                <div 
                  onClick={() => socialList[0] && onSelectEvent?.(socialList[0])}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-500/15 text-purple-500 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Social Media Activity
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        10:40 AM | Coordinated activity
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ACTIVITY CHRONOLOGY */}
        {activeTab === 'ACTIVITY' && (
          <div className="space-y-3">
            <span className="text-[11px] font-medium text-slate-400 block">
              Recorded Chronological Footprints ({entityEvents.length || events.length} events)
            </span>
            <div className="space-y-2">
              {(entityEvents.length > 0 ? entityEvents : events).slice(0, 8).map((ev, i) => (
                <div
                  key={ev.geo_event_id || i}
                  onClick={() => onSelectEvent?.(ev)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    selectedEvent?.geo_event_id === ev.geo_event_id
                      ? 'bg-blue-500/10 border-blue-500 dark:border-blue-500'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/60 hover:border-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10px] text-slate-500">
                      {new Date(ev.timestamp_ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {ev.domain}
                    </span>
                  </div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {ev.location_name || ev.event_type}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Lat: {ev.latitude.toFixed(4)}, Lng: {ev.longitude.toFixed(4)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: CONNECTIONS & GRAPH */}
        {activeTab === 'CONNECTIONS' && (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
              <span className="font-bold text-slate-700 dark:text-slate-200 block">Correlated Interlocutors</span>
              <p className="text-slate-500 text-[11px]">
                Target subject has direct telecom and geospatial co-location links with Person B and Device B.
              </p>
            </div>
            
            {onViewOnGraph && (
              <button
                onClick={() => onViewOnGraph(resolvedId)}
                className="w-full py-2 px-3 rounded-xl border border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Open Multi-hop Graph Viewer</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GeoEntityDetailsDrawer;
