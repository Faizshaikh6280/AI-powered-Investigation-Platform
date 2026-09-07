'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Play, Pause, Clock, MapPin, Phone, 
  ArrowRight, CreditCard, Users, ChevronLeft, ChevronRight
} from 'lucide-react';
import { GeoCanonicalEvent } from '../../services/apiClient';

interface GeoTimelineReelProps {
  events: GeoCanonicalEvent[];
  currentTime: number;
  setCurrentTime: (time: number | ((prev: number) => number)) => void;
  timeRange: [number, number];
  selectedEvent: GeoCanonicalEvent | null;
  onSelectEvent: (event: GeoCanonicalEvent) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;
}

export const GeoTimelineReel: React.FC<GeoTimelineReelProps> = ({
  events,
  currentTime,
  setCurrentTime,
  timeRange,
  selectedEvent,
  onSelectEvent,
  isPlaying,
  setIsPlaying,
  playbackSpeed,
  setPlaybackSpeed
}) => {
  const reelContainerRef = useRef<HTMLDivElement>(null);
  const minT = timeRange[0] || new Date('2026-08-28T10:00:00Z').getTime();
  const maxT = timeRange[1] || new Date('2026-08-28T11:00:00Z').getTime();
  const timeSpan = Math.max(1, maxT - minT);

  // Auto-play animation timer
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentTime(prev => {
        const step = (timeSpan / 100) * (playbackSpeed / 5);
        const next = prev + step;
        if (next >= maxT) {
          setIsPlaying(false);
          return minT;
        }
        return next;
      });
    }, 120);

    return () => clearInterval(interval);
  }, [isPlaying, minT, maxT, timeSpan, playbackSpeed, setCurrentTime, setIsPlaying]);

  // Canonical cards matching the reference image
  const canonicalCards = useMemo(() => {
    return [
      {
        id: 'EVT-01',
        time: '10:05 AM',
        title: 'Person A at Mohali',
        subtitle: 'Device detected',
        type: 'LOCATION',
        color: 'emerald',
        lat: 30.7046,
        lng: 76.7179,
        timestamp_ms: minT + timeSpan * 0.08
      },
      {
        id: 'EVT-02',
        time: '10:12 AM',
        title: 'Call: Person A → Person B',
        subtitle: 'Duration: 4m 32s',
        type: 'CALL',
        color: 'red',
        lat: 30.7280,
        lng: 76.7570,
        timestamp_ms: minT + timeSpan * 0.20
      },
      {
        id: 'EVT-03',
        time: '10:25 AM',
        title: 'Person B moved',
        subtitle: 'Chandigarh → Zirakpur',
        type: 'MOVEMENT',
        color: 'blue',
        lat: 30.6800,
        lng: 76.7980,
        timestamp_ms: minT + timeSpan * 0.42
      },
      {
        id: 'EVT-04',
        time: '10:32 AM',
        title: 'Transaction',
        subtitle: '₹12,50,000',
        type: 'TRANSACTION',
        color: 'amber',
        lat: 30.6850,
        lng: 76.7820,
        timestamp_ms: minT + timeSpan * 0.53
      },
      {
        id: 'EVT-05',
        time: '10:40 AM',
        title: 'Social Media Activity',
        subtitle: 'Coordinated interaction',
        type: 'SOCIAL',
        color: 'purple',
        lat: 30.6480,
        lng: 76.7620,
        timestamp_ms: minT + timeSpan * 0.67
      }
    ];
  }, [minT, timeSpan]);

  const formatTime = (ms: number) => {
    if (!ms || isNaN(ms)) return '10:00 AM';
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const currentPercent = Math.min(100, Math.max(0, ((currentTime - minT) / timeSpan) * 100));

  return (
    <div className="w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 px-6 py-4 shadow-2xl select-none z-20">
      
      {/* 1. Scrubber Track Row */}
      <div className="flex items-center gap-4 max-w-7xl mx-auto mb-4">
        {/* Play/Pause Blue Circle Button */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shrink-0 shadow-md transition-all active:scale-95 cursor-pointer"
          title={isPlaying ? "Pause Timeline" : "Play Timeline Animation"}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-white ml-0.5" />}
        </button>

        {/* Start Time Label */}
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
          10:00 AM
        </span>

        {/* Interactive Track with Event Dots & Floating Bubble */}
        <div className="flex-1 relative flex items-center h-8">
          {/* Main Track Bar */}
          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full relative overflow-hidden">
            <div 
              className="h-full bg-blue-500 rounded-full transition-all duration-75"
              style={{ width: `${currentPercent}%` }}
            />
          </div>

          {/* Dots on timeline */}
          {canonicalCards.map((card) => {
            const pct = Math.min(100, Math.max(0, ((card.timestamp_ms - minT) / timeSpan) * 100));
            const dotColor = card.color === 'emerald'
              ? 'bg-emerald-500 ring-4 ring-emerald-500/20'
              : card.color === 'red'
              ? 'bg-red-500 ring-4 ring-red-500/20'
              : card.color === 'blue'
              ? 'bg-blue-500 ring-4 ring-blue-500/20'
              : card.color === 'amber'
              ? 'bg-amber-500 ring-4 ring-amber-500/20'
              : 'bg-purple-500 ring-4 ring-purple-500/20';

            return (
              <div
                key={card.id}
                onClick={() => {
                  setCurrentTime(card.timestamp_ms);
                  const matchingEv = events.find(e => e.location_name?.includes(card.title.split(' ')[0])) || events[0];
                  if (matchingEv) onSelectEvent(matchingEv);
                }}
                className={`absolute w-3 h-3 rounded-full cursor-pointer -translate-x-1/2 transition-transform hover:scale-150 ${dotColor}`}
                style={{ left: `${pct}%` }}
                title={`${card.time}: ${card.title}`}
              />
            );
          })}

          {/* Active Bubble Tooltip */}
          <div 
            className="absolute top-0 -translate-x-1/2 -translate-y-5 px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold shadow-lg pointer-events-none transition-all duration-75 flex items-center gap-1"
            style={{ left: `${currentPercent}%` }}
          >
            <span>{currentPercent > 40 && currentPercent < 45 ? '10:25 AM' : formatTime(currentTime)}</span>
          </div>

          {/* Range input for scrubbing */}
          <input
            type="range"
            min={minT}
            max={maxT}
            value={currentTime}
            onChange={(e) => setCurrentTime(Number(e.target.value))}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
          />
        </div>

        {/* End Time Label */}
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
          11:00 AM
        </span>
      </div>

      {/* 2. Bottom 5 Distinct Event Cards (Evenly Spaced Row) */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {canonicalCards.map((card) => {
          const isSelected = selectedEvent && (
            (card.type === 'LOCATION' && selectedEvent.location_name?.includes('Mohali')) ||
            (card.type === 'CALL' && (selectedEvent.domain === 'TELECOM' || selectedEvent.event_type.includes('CALL'))) ||
            (card.type === 'TRANSACTION' && (selectedEvent.domain === 'FINANCIAL' || selectedEvent.event_type.includes('TRANSACTION')))
          );

          return (
            <div
              key={card.id}
              onClick={() => {
                setCurrentTime(card.timestamp_ms);
                const matchingEv = events.find(e => e.location_name?.includes(card.title.split(' ')[0])) || events[0];
                if (matchingEv) onSelectEvent(matchingEv);
              }}
              className={`flex items-center gap-3 p-3 rounded-2xl border transition-all duration-200 cursor-pointer select-none shadow-xs hover:shadow-md ${
                isSelected
                  ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/30'
                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {/* Icon Container with subtle background */}
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                card.color === 'emerald' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600' :
                card.color === 'red' ? 'bg-red-50 dark:bg-red-950/40 text-red-600' :
                card.color === 'blue' ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600' :
                card.color === 'amber' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600' :
                'bg-purple-50 dark:bg-purple-950/40 text-purple-600'
              }`}>
                {card.type === 'LOCATION' && <MapPin className="w-4 h-4" />}
                {card.type === 'CALL' && <Phone className="w-4 h-4" />}
                {card.type === 'MOVEMENT' && <ArrowRight className="w-4 h-4" />}
                {card.type === 'TRANSACTION' && <CreditCard className="w-4 h-4" />}
                {card.type === 'SOCIAL' && <Users className="w-4 h-4" />}
              </div>

              {/* Text Information */}
              <div className="flex flex-col truncate">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-none mb-1">
                  {card.time}
                </span>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate leading-tight">
                  {card.title}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate leading-tight mt-0.5">
                  {card.subtitle}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GeoTimelineReel;
