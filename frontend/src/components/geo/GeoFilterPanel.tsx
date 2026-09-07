'use client';
import React from 'react';
import { Filter, Users, Globe, Shield, RefreshCw } from 'lucide-react';

interface GeoFilterPanelProps {
  availableEntities: Array<{ id: string; name: string; color: [number, number, number] }>;
  selectedEntities: string[];
  setSelectedEntities: (entities: string[]) => void;
  availableDomains: string[];
  selectedDomains: string[];
  setSelectedDomains: (domains: string[]) => void;
  minConfidence: number;
  setMinConfidence: (c: number) => void;
  onResetFilters: () => void;
}

export const GeoFilterPanel: React.FC<GeoFilterPanelProps> = ({
  availableEntities,
  selectedEntities,
  setSelectedEntities,
  availableDomains,
  selectedDomains,
  setSelectedDomains,
  minConfidence,
  setMinConfidence,
  onResetFilters,
}) => {
  const toggleEntity = (entId: string) => {
    if (selectedEntities.includes(entId)) {
      setSelectedEntities(selectedEntities.filter(id => id !== entId));
    } else {
      setSelectedEntities([...selectedEntities, entId]);
    }
  };

  const toggleDomain = (dom: string) => {
    if (selectedDomains.includes(dom)) {
      setSelectedDomains(selectedDomains.filter(d => d !== dom));
    } else {
      setSelectedDomains([...selectedDomains, dom]);
    }
  };

  const selectAllEntities = () => {
    setSelectedEntities(availableEntities.map(e => e.id));
  };

  const clearEntities = () => {
    setSelectedEntities([]);
  };

  return (
    <div className="bg-[#0b101b]/95 border border-border/80 rounded-xl p-3.5 backdrop-blur-lg shadow-xl space-y-3.5 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <div className="flex items-center gap-1.5 font-bold text-foreground text-[11px] uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5 text-primary" />
          <span>Investigation Filters</span>
        </div>
        <button
          onClick={onResetFilters}
          className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 hover:underline"
        >
          <RefreshCw className="w-2.5 h-2.5" />
          <span>Reset</span>
        </button>
      </div>

      {/* Entity Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
            <Users className="w-3 h-3 text-primary" />
            <span>Entities ({selectedEntities.length}/{availableEntities.length})</span>
          </span>
          <div className="flex items-center gap-2 text-[10px]">
            <button onClick={selectAllEntities} className="text-primary hover:underline">All</button>
            <span className="text-border">|</span>
            <button onClick={clearEntities} className="text-muted-foreground hover:underline">Clear</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
          {availableEntities.map(ent => {
            const isSelected = selectedEntities.length === 0 || selectedEntities.includes(ent.id);
            const rgbStr = `rgb(${ent.color[0]}, ${ent.color[1]}, ${ent.color[2]})`;
            return (
              <button
                key={ent.id}
                onClick={() => toggleEntity(ent.id)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1.5 border transition-all ${
                  isSelected
                    ? 'bg-secondary/90 border-border text-foreground shadow-sm'
                    : 'bg-secondary/20 border-border/30 text-muted-foreground opacity-50'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: rgbStr }}
                />
                <span className="truncate max-w-[110px]">{ent.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Domains Filter */}
      <div className="space-y-1.5 pt-1 border-t border-border/60">
        <span className="font-semibold text-muted-foreground text-[11px] flex items-center gap-1.5">
          <Globe className="w-3 h-3 text-primary" />
          <span>Evidence Domain</span>
        </span>
        <div className="flex flex-wrap gap-1.5">
          {availableDomains.map(dom => {
            const isSelected = selectedDomains.length === 0 || selectedDomains.includes(dom);
            return (
              <button
                key={dom}
                onClick={() => toggleDomain(dom)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase transition-all border ${
                  isSelected
                    ? 'bg-primary/20 border-primary/60 text-primary font-bold'
                    : 'bg-secondary/30 border-border/30 text-muted-foreground opacity-60'
                }`}
              >
                {dom}
              </button>
            );
          })}
        </div>
      </div>

      {/* Minimum Location Confidence Slider */}
      <div className="space-y-1 pt-1 border-t border-border/60">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-primary" />
            <span>Min Location Confidence</span>
          </span>
          <span className="font-mono text-primary font-bold">{Math.round(minConfidence * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={minConfidence}
          onChange={e => setMinConfidence(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-secondary rounded appearance-none cursor-pointer accent-primary"
        />
      </div>
    </div>
  );
};
