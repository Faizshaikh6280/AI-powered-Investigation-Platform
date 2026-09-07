import React from 'react';
import { 
  Search, Filter, Smartphone, CreditCard, MessagesSquare, MapPin, 
  Globe, AlertTriangle, ShieldCheck, X, Check, RotateCcw
} from 'lucide-react';
import { useTimelineStore } from '../../store/useTimelineStore';
import { cn } from '../../utils/cn';

interface FilterSidebarProps {
  entities: Array<{ id: string; name: string; cluster_id?: string; event_count: number; risk_score?: number }>;
  domainCounts: Record<string, number>;
}

const DOMAIN_CONFIG: Record<string, { label: string; icon: any; color: string; border: string; bg: string }> = {
  TELECOM: { label: 'Telecom (CDR/SMS)', icon: Smartphone, color: 'text-indigo-400', border: 'border-indigo-500/30', bg: 'bg-indigo-500/10' },
  FINANCIAL: { label: 'Banking & Financial', icon: CreditCard, color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
  SOCIAL: { label: 'Social & Messaging', icon: MessagesSquare, color: 'text-pink-400', border: 'border-pink-500/30', bg: 'bg-pink-500/10' },
  LOCATION: { label: 'Geospatial Telemetry', icon: MapPin, color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10' },
  NETWORK: { label: 'IPDR / Network', icon: Globe, color: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10' },
  ANALYTICAL: { label: 'Analytical Signals', icon: AlertTriangle, color: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-500/10' },
};

const RISK_LEVELS = [
  { id: 'CRITICAL', label: 'Critical Risk', color: 'text-rose-500 bg-rose-500/10 border-rose-500/30' },
  { id: 'HIGH', label: 'High Risk', color: 'text-orange-500 bg-orange-500/10 border-orange-500/30' },
  { id: 'MEDIUM', label: 'Medium Risk', color: 'text-amber-500 bg-amber-500/10 border-amber-500/30' },
  { id: 'LOW', label: 'Low Risk', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' }
];

export const TimelineFilterSidebar: React.FC<FilterSidebarProps> = ({
  entities,
  domainCounts
}) => {
  const {
    isFilterOpen,
    setIsFilterOpen,
    searchQuery,
    setSearchQuery,
    selectedDomains,
    toggleDomain,
    selectedRiskLevels,
    toggleRiskLevel,
    onlyAnomalies,
    setOnlyAnomalies,
    selectedEntityIds,
    toggleEntityId,
    resetFilters
  } = useTimelineStore();

  if (!isFilterOpen) return null;

  return (
    <aside className="w-72 flex-shrink-0 border-r border-border bg-card/95 flex flex-col h-full z-10 animate-in slide-in-from-left duration-200">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Investigation Filters</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={resetFilters}
            className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-secondary transition-colors"
            title="Reset all filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsFilterOpen(false)}
            className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Search */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Keyword Search</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search actors, notes, IPs..."
              className="w-full bg-secondary/80 border border-border rounded-md pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Anomalies Only Toggle */}
        <div className="flex items-center justify-between p-2.5 bg-destructive/5 border border-destructive/20 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <span className="text-xs font-bold text-foreground">Anomalies Only</span>
          </div>
          <button
            onClick={() => setOnlyAnomalies(!onlyAnomalies)}
            className={cn(
              "w-9 h-5 rounded-full transition-colors relative p-0.5",
              onlyAnomalies ? "bg-destructive" : "bg-muted border border-border"
            )}
          >
            <div className={cn(
              "w-4 h-4 rounded-full bg-white transition-transform",
              onlyAnomalies ? "translate-x-4" : "translate-x-0"
            )} />
          </button>
        </div>

        {/* Investigative Domains */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Domains</label>
          <div className="space-y-1">
            {Object.entries(DOMAIN_CONFIG).map(([domKey, cfg]) => {
              const isSelected = selectedDomains.includes(domKey);
              const count = domainCounts[domKey] || 0;
              const Icon = cfg.icon;

              return (
                <button
                  key={domKey}
                  onClick={() => toggleDomain(domKey)}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-all border",
                    isSelected
                      ? cn("bg-secondary/90 text-foreground", cfg.border)
                      : "bg-transparent text-muted-foreground border-transparent hover:bg-secondary/40"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={cn("w-3.5 h-3.5", cfg.color)} />
                    <span className="font-medium text-[11px]">{cfg.label}</span>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground bg-card/60 px-1.5 py-0.5 rounded border border-border/50">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Entities (Golden Profiles) */}
        {entities.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Entities ({entities.length})</label>
              {selectedEntityIds.length > 0 && (
                <button
                  onClick={() => useTimelineStore.getState().setSelectedEntityIds([])}
                  className="text-[10px] text-primary hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {entities.map(ent => {
                const isSelected = selectedEntityIds.includes(ent.id);
                return (
                  <button
                    key={ent.id}
                    onClick={() => toggleEntityId(ent.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-all border",
                      isSelected
                        ? "bg-primary/10 border-primary text-primary font-semibold"
                        : "bg-transparent text-foreground border-transparent hover:bg-secondary"
                    )}
                  >
                    <span className="truncate max-w-[140px] text-left text-[11px]">{ent.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {ent.event_count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Risk Levels */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Severity</label>
          <div className="grid grid-cols-2 gap-1.5">
            {RISK_LEVELS.map(r => {
              const isSelected = selectedRiskLevels.includes(r.id);
              return (
                <button
                  key={r.id}
                  onClick={() => toggleRiskLevel(r.id)}
                  className={cn(
                    "flex items-center justify-between px-2 py-1 rounded text-[11px] font-semibold border transition-all",
                    isSelected ? r.color : "border-border text-muted-foreground hover:text-foreground bg-secondary/30"
                  )}
                >
                  <span>{r.label}</span>
                  {isSelected && <Check className="w-3 h-3" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
};
