'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, Share2, AlertTriangle, FileText, Smartphone, Globe, 
  ChevronRight, ArrowRight, ShieldAlert, Database, RefreshCw,
  Clock, CheckCircle2, ShieldCheck, Sparkles, Network, CreditCard
} from 'lucide-react';
import { useCase } from '../context/CaseContext';
import { apiClient, AnomalyStats, GoldenProfile, TimelineEventItem } from '../services/apiClient';
import { cn } from '../utils/cn';

interface OverviewDashboardProps {
  onNavigateTab?: (tabId: string) => void;
}

export default function OverviewDashboard({ onNavigateTab }: OverviewDashboardProps) {
  const { activeCase, activeCaseDetail, refreshCases } = useCase();
  const [stats, setStats] = useState({
    entities: 0,
    relationships: 0,
    anomalies: 0,
    evidenceFiles: 0,
  });
  const [anomalyStats, setAnomalyStats] = useState<AnomalyStats>({ total: 0, critical: 0, high: 0, medium: 0, low: 0 });
  const [recentEvents, setRecentEvents] = useState<TimelineEventItem[]>([]);
  const [topProfiles, setTopProfiles] = useState<GoldenProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [profiles, graph, aStats, rawEvents] = await Promise.all([
        apiClient.getGoldenProfiles(activeCase?.case_id).catch(() => []),
        apiClient.getGraphTopology(activeCase?.case_id).catch(() => ({ nodes: [], edges: [] })),
        apiClient.getAnomalyStats(activeCase?.case_id).catch(() => ({ total: 0, critical: 0, high: 0, medium: 0, low: 0 })),
        apiClient.getIngestedEvents(activeCase?.case_id, 6).catch(() => [])
      ]);

      setStats({
        entities: profiles.length || graph.nodes?.length || 0,
        relationships: graph.edges?.length || 0,
        anomalies: aStats.total || 0,
        evidenceFiles: activeCaseDetail?.evidence_count || activeCaseDetail?.evidence?.length || 0,
      });
      setAnomalyStats(aStats);
      setTopProfiles(profiles.slice(0, 5));

      const mappedEvents: TimelineEventItem[] = (rawEvents || []).map((r: any) => ({
        id: r.event_id || Math.random().toString(),
        time_ms: r.timestamp ? new Date(r.timestamp).getTime() : Date.now(),
        domain: r.domain || r.source_type || 'UNKNOWN',
        event_type: r.event_type || 'EVENT',
        identity: {
          phone: r.normalized_identity?.phone,
          name: r.normalized_identity?.name,
          social_handle: r.normalized_identity?.social_handle
        },
        financial: {
          account_number: r.financial?.account_number,
          amount_inr: r.financial?.amount_inr,
          txn_type: r.financial?.txn_type
        },
        telemetry: {
          client_ip: r.telemetry?.assigned_ip,
          tower_address: r.telemetry?.address,
          destination_ip: r.telemetry?.destination_ip,
          lat: r.telemetry?.lat,
          lng: r.telemetry?.lng
        }
      }));
      setRecentEvents(mappedEvents);
    } catch (err) {
      console.error('Failed to load overview data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeCase?.case_id]);

  const getDomainIcon = (domain: string) => {
    switch (domain?.toUpperCase()) {
      case 'TELECOM': return Smartphone;
      case 'BANKING': return CreditCard;
      case 'NETWORK': return Globe;
      default: return FileText;
    }
  };

  const getDomainColor = (domain: string) => {
    switch (domain?.toUpperCase()) {
      case 'TELECOM': return 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20';
      case 'BANKING': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'NETWORK': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      default: return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    }
  };

  return (
    <div className="p-6 md:p-8 flex flex-col gap-8 h-full max-w-7xl mx-auto w-full overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
              {activeCase?.case_reference || 'ACTIVE CASE'}
            </span>
            <span className="text-xs text-muted-foreground">• {activeCase?.title || 'Investigation Workspace'}</span>
          </div>
          <h2 className="text-2xl font-bold text-foreground">Operational Intelligence Overview</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cross-domain activity, resolved identity clusters, and anomaly discoveries derived directly from backend warehouse.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 text-muted-foreground hover:text-foreground bg-secondary border border-border rounded-lg hover:bg-secondary/80 transition-colors"
            title="Refresh Overview"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div 
          onClick={() => onNavigateTab && onNavigateTab('entity-explorer')}
          className="bg-card border border-border p-5 rounded-xl flex flex-col justify-between hover:border-primary/50 transition-all cursor-pointer shadow-sm group"
        >
          <div className="flex justify-between items-start mb-3">
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary border border-primary/20 group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-muted-foreground group-hover:text-primary transition-colors flex items-center">
              Explore <ChevronRight className="w-3 h-3" />
            </span>
          </div>
          <div>
            <h4 className="text-3xl font-black text-foreground">{stats.entities}</h4>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Resolved Entities</p>
          </div>
        </div>

        <div 
          onClick={() => onNavigateTab && onNavigateTab('relationship-graph')}
          className="bg-card border border-border p-5 rounded-xl flex flex-col justify-between hover:border-primary/50 transition-all cursor-pointer shadow-sm group"
        >
          <div className="flex justify-between items-start mb-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20 group-hover:scale-110 transition-transform">
              <Share2 className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-muted-foreground group-hover:text-primary transition-colors flex items-center">
              Graph <ChevronRight className="w-3 h-3" />
            </span>
          </div>
          <div>
            <h4 className="text-3xl font-black text-foreground">{stats.relationships}</h4>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Graph Relationships</p>
          </div>
        </div>

        <div 
          onClick={() => onNavigateTab && onNavigateTab('anomalies')}
          className="bg-card border border-border p-5 rounded-xl flex flex-col justify-between hover:border-destructive/50 transition-all cursor-pointer shadow-sm group"
        >
          <div className="flex justify-between items-start mb-3">
            <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 group-hover:scale-110 transition-transform">
              <ShieldAlert className="w-5 h-5" />
            </div>
            {anomalyStats.critical > 0 && (
              <span className="text-[10px] font-black text-destructive bg-destructive/10 px-2 py-0.5 rounded-full border border-destructive/20 animate-pulse">
                {anomalyStats.critical} Critical
              </span>
            )}
          </div>
          <div>
            <h4 className="text-3xl font-black text-destructive">{stats.anomalies}</h4>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Anomalies Detected</p>
          </div>
        </div>

        <div 
          onClick={() => onNavigateTab && onNavigateTab('data-sources')}
          className="bg-card border border-border p-5 rounded-xl flex flex-col justify-between hover:border-primary/50 transition-all cursor-pointer shadow-sm group"
        >
          <div className="flex justify-between items-start mb-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 group-hover:scale-110 transition-transform">
              <Database className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-muted-foreground group-hover:text-primary transition-colors flex items-center">
              Evidence <ChevronRight className="w-3 h-3" />
            </span>
          </div>
          <div>
            <h4 className="text-3xl font-black text-foreground">{stats.evidenceFiles}</h4>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Evidence Files</p>
          </div>
        </div>
      </div>

      {/* Main 2-Column Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[400px]">
        {/* Left Column: Recent Cross-Domain Activity */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 flex flex-col shadow-sm">
          <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Recent Canonical Events</h3>
              <p className="text-xs text-muted-foreground">Chronological cross-domain telemetry and financial events</p>
            </div>
            {onNavigateTab && (
              <button 
                onClick={() => onNavigateTab('timeline')}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                Full Timeline <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex-1 space-y-3">
            {recentEvents.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-xs italic">
                No canonical events recorded yet. Ingest evidence files to populate timeline.
              </div>
            ) : (
              recentEvents.map((ev) => {
                const Icon = getDomainIcon(ev.domain);
                const colorClass = getDomainColor(ev.domain);
                const dateObj = new Date(ev.time_ms);
                const identityStr = ev.identity?.phone || ev.financial?.account_number || ev.identity?.name || ev.telemetry?.client_ip || 'Event Record';

                return (
                  <div
                    key={ev.id}
                    onClick={() => onNavigateTab && onNavigateTab('timeline')}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer group"
                  >
                    <span className="text-xs font-mono text-muted-foreground w-14 flex-shrink-0">
                      {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    <div className={cn("p-2 rounded-lg border flex-shrink-0", colorClass)}>
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-foreground truncate">
                        {identityStr}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {ev.domain} • {ev.event_type?.replace(/_/g, ' ')}
                        {ev.financial?.amount_inr ? ` • ₹${ev.financial.amount_inr.toLocaleString()}` : ''}
                        {ev.telemetry?.tower_address ? ` • ${ev.telemetry.tower_address}` : ''}
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Threat Distribution & Top Entities */}
        <div className="space-y-6">
          {/* Anomaly Distribution Card */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4 border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-destructive" /> Threat Distribution
              </h3>
              {onNavigateTab && (
                <button 
                  onClick={() => onNavigateTab('anomalies')}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  View Radar
                </button>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-destructive flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-destructive" /> Critical Priority
                </span>
                <span className="font-bold text-foreground">{anomalyStats.critical}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-orange-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-500" /> High Severity
                </span>
                <span className="font-bold text-foreground">{anomalyStats.high}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-amber-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> Medium Severity
                </span>
                <span className="font-bold text-foreground">{anomalyStats.medium}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-blue-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" /> Low / Baseline
                </span>
                <span className="font-bold text-foreground">{anomalyStats.low}</span>
              </div>
            </div>
          </div>

          {/* Top Resolved Entities Card */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4 border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Key Resolved Targets
              </h3>
              {onNavigateTab && (
                <button 
                  onClick={() => onNavigateTab('entity-explorer')}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  All Entities
                </button>
              )}
            </div>

            <div className="space-y-3">
              {topProfiles.length === 0 ? (
                <div className="text-xs text-muted-foreground italic text-center py-4">
                  No golden identity profiles resolved yet.
                </div>
              ) : (
                topProfiles.map((p) => {
                  const risk = Math.round((p.risk_score || 0) * 100);
                  return (
                    <div
                      key={p.z_cluster_id}
                      onClick={() => onNavigateTab && onNavigateTab('entity-explorer')}
                      className="p-2.5 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer flex items-center justify-between text-xs"
                    >
                      <div className="truncate pr-2">
                        <div className="font-bold text-foreground truncate">{p.primary_name || p.z_cluster_id}</div>
                        <div className="text-[10px] text-muted-foreground font-mono truncate">{p.z_cluster_id}</div>
                      </div>
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded border flex-shrink-0",
                        risk >= 60 ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-secondary text-foreground border-border"
                      )}>
                        {risk}% Risk
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
