'use client';

import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, Filter, Search, ShieldAlert, FileText, ChevronRight, 
  Play, Loader2, RefreshCw, Layers, CheckCircle2, ShieldCheck, Sparkles,
  SlidersHorizontal, X
} from 'lucide-react';
import { useCase } from '../context/CaseContext';
import { apiClient, AnomalyFinding, AnomalyStats, DetectorEngineMeta } from '../services/apiClient';
import { cn } from '../utils/cn';

interface AnomaliesTabProps {
  onAnomalySelect: (anomaly: AnomalyFinding) => void;
}

export default function AnomaliesTab({ onAnomalySelect }: AnomaliesTabProps) {
  const { activeCase } = useCase();
  const [stats, setStats] = useState<AnomalyStats>({ total: 0, critical: 0, high: 0, medium: 0, low: 0 });
  const [engines, setEngines] = useState<DetectorEngineMeta[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisSummary, setAnalysisSummary] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedDomain, setSelectedDomain] = useState<string>('ALL');
  const [selectedEngine, setSelectedEngine] = useState<string>('ALL');

  const fetchStats = async () => {
    try {
      const data = await apiClient.getAnomalyStats();
      setStats(data || { total: 0, critical: 0, high: 0, medium: 0, low: 0 });
    } catch (err) {
      console.error('Failed to fetch anomaly stats:', err);
    }
  };

  const fetchHealth = async () => {
    try {
      const data = await apiClient.getDetectorHealth();
      setEngines(data.engines || []);
    } catch (err) {
      console.error('Failed to fetch detector health:', err);
    }
  };

  const fetchAnomalies = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getAnomalies({
        search: search.trim() || undefined,
        limit: 100,
        caseId: activeCase?.case_id
      });
      setAnomalies(data.anomalies || []);
    } catch (err) {
      console.error('Failed to fetch anomalies:', err);
      setAnomalies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchHealth();
  }, []);

  useEffect(() => {
    fetchAnomalies();
  }, [search, activeCase?.case_id]);

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisSummary(null);
    try {
      const res = await apiClient.runAnomalyAnalysis(activeCase?.case_id);
      const s = res.result?.summary;
      setAnalysisSummary(
        `Analysis complete in ${s?.duration_seconds || 0}s: Analyzed ${s?.total_entities_analyzed || 0} entities across ${res.result?.detectors_executed?.length || 0} engines. Found ${s?.total_findings || 0} findings (${s?.critical_count || 0} Critical).`
      );
      await fetchStats();
      await fetchAnomalies();
      setTimeout(() => setAnalysisSummary(null), 8000);
    } catch (err: any) {
      setAnalysisSummary(`Analysis failed: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const filteredAnomalies = anomalies.filter((a) => {
    if (selectedSeverity !== 'ALL' && a.severity !== selectedSeverity) return false;
    if (selectedDomain !== 'ALL' && a.domain !== selectedDomain) return false;
    if (selectedEngine !== 'ALL' && (!a.contributingDetectors || !a.contributingDetectors.includes(selectedEngine))) return false;
    return true;
  });

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-destructive/15 text-destructive border-destructive/30';
      case 'HIGH':
        return 'bg-orange-500/15 text-orange-500 border-orange-500/30';
      case 'MEDIUM':
        return 'bg-amber-500/15 text-amber-500 border-amber-500/30';
      default:
        return 'bg-blue-500/15 text-blue-500 border-blue-500/30';
    }
  };

  return (
    <div className="flex flex-col h-full bg-background p-6 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
              {activeCase?.case_reference || 'ACTIVE CASE'}
            </span>
            <span className="text-xs text-muted-foreground">• Multi-Engine Intelligence Subsystem</span>
          </div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-destructive" />
            Automated Threat & Hidden Anomaly Radar
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            21 analytical lenses discovering behavioral outliers, structuring patterns, spatial blackouts, Tor/VPN leaks, and graph cut-outs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 text-xs font-bold text-muted-foreground bg-secondary/80 px-3 py-1.5 rounded-lg border border-border">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {engines.length > 0 ? `${engines.length} Engines Registered` : 'Engines Active'}
          </div>

          <button
            onClick={fetchAnomalies}
            disabled={loading}
            className="p-2 text-muted-foreground hover:text-foreground bg-secondary border border-border rounded-lg hover:bg-secondary/80 transition-colors"
            title="Refresh Findings"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>

          <button
            onClick={handleRunAnalysis}
            disabled={isAnalyzing}
            className="px-4 py-2 bg-destructive text-destructive-foreground text-sm font-bold rounded-lg hover:bg-destructive/90 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Executing 21 Engines...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Multi-Engine Analysis
              </>
            )}
          </button>
        </div>
      </div>

      {analysisSummary && (
        <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-xl text-sm text-primary flex items-center gap-2 shadow-sm">
          <Sparkles className="w-4 h-4 flex-shrink-0" />
          <span>{analysisSummary}</span>
        </div>
      )}

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
        <div 
          onClick={() => setSelectedSeverity('ALL')}
          className={cn(
            "bg-card border p-5 rounded-xl shadow-sm text-center cursor-pointer transition-all hover:border-primary/50",
            selectedSeverity === 'ALL' ? "border-primary ring-1 ring-primary" : "border-border"
          )}
        >
          <div className="text-3xl font-black text-foreground mb-1">{stats.total}</div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Detected</div>
        </div>

        <div 
          onClick={() => setSelectedSeverity('CRITICAL')}
          className={cn(
            "bg-destructive/5 border p-5 rounded-xl shadow-sm text-center cursor-pointer transition-all hover:border-destructive/50",
            selectedSeverity === 'CRITICAL' ? "border-destructive ring-1 ring-destructive" : "border-destructive/20"
          )}
        >
          <div className="text-3xl font-black text-destructive mb-1">{stats.critical}</div>
          <div className="text-[10px] font-bold text-destructive uppercase tracking-widest">Critical</div>
        </div>

        <div 
          onClick={() => setSelectedSeverity('HIGH')}
          className={cn(
            "bg-orange-500/5 border p-5 rounded-xl shadow-sm text-center cursor-pointer transition-all hover:border-orange-500/50",
            selectedSeverity === 'HIGH' ? "border-orange-500 ring-1 ring-orange-500" : "border-orange-500/20"
          )}
        >
          <div className="text-3xl font-black text-orange-500 mb-1">{stats.high}</div>
          <div className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">High</div>
        </div>

        <div 
          onClick={() => setSelectedSeverity('MEDIUM')}
          className={cn(
            "bg-amber-500/5 border p-5 rounded-xl shadow-sm text-center cursor-pointer transition-all hover:border-amber-500/50",
            selectedSeverity === 'MEDIUM' ? "border-amber-500 ring-1 ring-amber-500" : "border-amber-500/20"
          )}
        >
          <div className="text-3xl font-black text-amber-500 mb-1">{stats.medium}</div>
          <div className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Medium</div>
        </div>

        <div 
          onClick={() => setSelectedSeverity('LOW')}
          className={cn(
            "bg-blue-500/5 border p-5 rounded-xl shadow-sm text-center cursor-pointer transition-all hover:border-blue-500/50",
            selectedSeverity === 'LOW' ? "border-blue-500 ring-1 ring-blue-500" : "border-blue-500/20"
          )}
        >
          <div className="text-3xl font-black text-blue-500 mb-1">{stats.low}</div>
          <div className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Low</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Severity Dropdown */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="font-bold">Severity:</span>
            <select
              value={selectedSeverity}
              onChange={e => setSelectedSeverity(e.target.value)}
              className="bg-secondary border border-border rounded-md px-2.5 py-1 text-xs text-foreground font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical Only</option>
              <option value="HIGH">High Only</option>
              <option value="MEDIUM">Medium Only</option>
              <option value="LOW">Low Only</option>
            </select>
          </div>

          {/* Domain Dropdown */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="font-bold">Domain:</span>
            <select
              value={selectedDomain}
              onChange={e => setSelectedDomain(e.target.value)}
              className="bg-secondary border border-border rounded-md px-2.5 py-1 text-xs text-foreground font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Domains</option>
              <option value="CROSS_DOMAIN">Cross Domain</option>
              <option value="TELECOM">Telecom</option>
              <option value="BANKING">Banking / Financial</option>
              <option value="NETWORK">Network / IPDR</option>
              <option value="SOCIAL">Social Intelligence</option>
            </select>
          </div>

          {/* Engine Dropdown */}
          {engines.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="font-bold">Engine Lens:</span>
              <select
                value={selectedEngine}
                onChange={e => setSelectedEngine(e.target.value)}
                className="bg-secondary border border-border rounded-md px-2.5 py-1 text-xs text-foreground font-semibold focus:outline-none focus:ring-1 focus:ring-primary max-w-[200px]"
              >
                <option value="ALL">All 21 Engines</option>
                {engines.map(eng => (
                  <option key={eng.detector_id} value={eng.detector_id}>
                    {eng.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(selectedSeverity !== 'ALL' || selectedDomain !== 'ALL' || selectedEngine !== 'ALL') && (
            <button
              onClick={() => {
                setSelectedSeverity('ALL');
                setSelectedDomain('ALL');
                setSelectedEngine('ALL');
              }}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1 rounded bg-secondary"
            >
              <X className="w-3 h-3" /> Reset
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by entity, reason, or lens..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-secondary border border-border outline-none text-xs text-foreground pl-9 pr-4 py-2 rounded-lg focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* Findings List */}
      <div className="flex-1 space-y-4">
        {loading ? (
          <div className="p-16 text-center text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
            Loading real anomaly findings from PostgreSQL & Neo4j...
          </div>
        ) : filteredAnomalies.length === 0 ? (
          <div className="p-16 border-2 border-dashed border-border rounded-xl text-center space-y-4 bg-card">
            <ShieldAlert className="w-12 h-12 text-muted-foreground mx-auto" />
            <h3 className="text-lg font-bold text-foreground">No Anomalies Found</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {stats.total === 0 
                ? 'No anomaly run has been recorded for this case. Click "Run Multi-Engine Analysis" to execute all 21 lenses.'
                : 'No findings match the selected severity, domain, or engine filters.'}
            </p>
            {stats.total === 0 && (
              <button
                onClick={handleRunAnalysis}
                disabled={isAnalyzing}
                className="px-4 py-2 bg-destructive text-destructive-foreground text-sm font-bold rounded-lg hover:bg-destructive/90 transition-colors inline-flex items-center gap-2"
              >
                <Play className="w-4 h-4" /> Run 21-Engine Analysis
              </button>
            )}
          </div>
        ) : (
          filteredAnomalies.map((a) => {
            const firstReason = a.reasons?.[0] || 'Behavioral pattern detected by multiple analytical engines.';
            const detectorList = a.contributingDetectors || [a.type];

            return (
              <div
                key={a.id}
                onClick={() => onAnomalySelect(a)}
                className="bg-card border border-border p-6 rounded-xl hover:border-primary/50 transition-all cursor-pointer shadow-sm relative group flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="space-y-3 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border flex items-center gap-1.5",
                      getSeverityBadge(a.severity)
                    )}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                      {a.severity}
                    </span>

                    {a.investigativePriority && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
                        Priority: {a.investigativePriority}
                      </span>
                    )}

                    <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                      Entity: {a.entityId}
                    </span>

                    <span className="text-xs text-muted-foreground">
                      ({a.entityType || 'Person'})
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                    {a.title || `${a.type} Anomaly Detected`}
                  </h3>

                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {firstReason}
                  </p>

                  {/* Contributing Engines Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground mr-1">Lenses:</span>
                    {detectorList.slice(0, 4).map((det, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-mono bg-secondary px-2 py-0.5 rounded border border-border text-foreground font-semibold"
                      >
                        {det.replace('DET-', '')}
                      </span>
                    ))}
                    {detectorList.length > 4 && (
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        +{detectorList.length - 4} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Score & Action Block */}
                <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-6 justify-between md:justify-end flex-shrink-0">
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Unified Score
                    </div>
                    <div className={cn(
                      "text-3xl font-black",
                      a.severity === 'CRITICAL' ? 'text-destructive' :
                      a.severity === 'HIGH' ? 'text-orange-500' :
                      a.severity === 'MEDIUM' ? 'text-amber-500' : 'text-blue-500'
                    )}>
                      {a.score?.toFixed(0) || '0'}
                      <span className="text-xs font-bold text-muted-foreground">/100</span>
                    </div>
                    {a.confidence && (
                      <div className="text-[10px] font-mono text-muted-foreground">
                        Conf: {(a.confidence * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAnomalySelect(a);
                    }}
                    className="p-3 bg-secondary group-hover:bg-primary group-hover:text-primary-foreground text-muted-foreground rounded-xl transition-all shadow-sm flex items-center justify-center"
                    title="Deep Investigation Drawer"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
