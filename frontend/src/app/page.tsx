'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, Bell, HelpCircle, User, Activity, FolderOpen, Database, 
  Users, Share2, Clock, Map, AlertTriangle, FileText, Smartphone, 
  Globe, BarChart3, ShieldCheck, Settings, LogOut, ChevronRight,
  Sun, Moon, Menu, Command, X, Cpu, Plus, Layers
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '../utils/cn';
import { CaseProvider, useCase } from '../context/CaseContext';

// Modules
import OverviewDashboard from '../components/OverviewDashboard';
import CaseManagementView from '../components/CaseManagementView';
import DataIngestionVault from '../components/DataIngestionVault';
import ProcessingPipelineView from '../components/ProcessingPipelineView';
import EntityResolutionMatrix from '../components/EntityResolutionMatrix';
import GraphTopologyViewer from '../components/GraphTopologyViewer';
import TimelineFootprint from '../components/TimelineFootprint';
import GeospatialMap from '../components/GeospatialMap';
import AnomaliesTab from '../components/AnomaliesTab';
import AnomalyInvestigationDrawer from '../components/AnomalyInvestigationDrawer';
import CaseDossierExporter from '../components/CaseDossierExporter';
import AuditTrailLogs from '../components/AuditTrailLogs';
import CreateCaseModal from '../components/CreateCaseModal';

const navigation = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'investigations', label: 'Case Dossiers', icon: FolderOpen },
  { id: 'data-sources', label: 'Evidence Intake', icon: Database },
  { id: 'pipeline', label: 'Processing Pipeline', icon: Cpu },
  { id: 'entity-explorer', label: 'Entity Explorer', icon: Users },
  { id: 'relationship-graph', label: 'Relationship Graph', icon: Share2 },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'geospatial', label: 'Geospatial Map', icon: Map },
  { id: 'anomalies', label: 'Anomalies & Radar', icon: AlertTriangle },
  { id: 'reports', label: 'Reports & Export', icon: BarChart3 },
  { id: 'audit', label: 'Audit Trail', icon: ShieldCheck },
];

function InvestigationWorkspace() {
  const { cases, activeCase, setActiveCaseId } = useCase();
  const [activeTab, setActiveTab] = useState('overview');
  const [isSidebarExpanded, setSidebarExpanded] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  
  const [selectedAnomaly, setSelectedAnomaly] = useState<any>(null);
  const [focusAnomalyEntityId, setFocusAnomalyEntityId] = useState<string | null>(null);

  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdOpen(o => !o);
      }
      if (e.key === 'Escape') setCmdOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden relative">
      
      {/* Sidebar */}
      <aside 
        className={cn(
          "flex-shrink-0 flex flex-col border-r border-border bg-panel backdrop-blur-xl z-30 transition-all duration-300 ease-in-out",
          isSidebarExpanded ? "w-64" : "w-16"
        )}
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
      >
        <div className="h-14 flex items-center justify-center px-4 border-b border-border">
          <div className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight overflow-hidden whitespace-nowrap w-full">
            <ShieldCheck className="w-6 h-6 flex-shrink-0 text-primary" />
            <div className={cn("transition-opacity duration-300 font-mono tracking-widest", isSidebarExpanded ? "opacity-100" : "opacity-0 w-0")}>
              TRACE <span className="text-[10px] font-sans font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">V2</span>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4 px-2 space-y-1 scrollbar-hide hover:scrollbar-default">
          {navigation.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={!isSidebarExpanded ? item.label : undefined}
              className={cn(
                "w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium transition-colors",
                activeTab === item.id 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <item.icon className={cn("w-5 h-5 flex-shrink-0", activeTab === item.id ? "text-primary-foreground" : "text-muted-foreground")} />
              <span className={cn("whitespace-nowrap transition-opacity duration-300", isSidebarExpanded ? "opacity-100" : "opacity-0 w-0 hidden")}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative bg-background">
        
        {/* Top Header */}
        <header className="h-14 flex-shrink-0 flex items-center justify-between px-4 border-b border-border bg-background z-20">
          {/* Dynamic Active Case Switcher */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 bg-secondary/80 border border-border px-2.5 py-1 rounded-lg">
              <FolderOpen className="w-4 h-4 text-primary flex-shrink-0" />
              {cases.length > 0 ? (
                <select
                  value={activeCase?.case_id || ''}
                  onChange={(e) => setActiveCaseId(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs font-bold text-foreground cursor-pointer max-w-[220px] truncate"
                >
                  {cases.map((c) => (
                    <option key={c.case_id} value={c.case_id} className="bg-card text-foreground">
                      {c.case_reference}: {c.title}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs font-bold text-muted-foreground">No Cases</span>
              )}
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="p-0.5 text-muted-foreground hover:text-primary transition-colors ml-1"
                title="Create New Case Dossier"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            
            {activeCase?.status && (
              <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {activeCase.status}
              </span>
            )}
          </div>

          {/* Quick Search */}
          <div className="flex-1 max-w-xl px-8 hidden md:block">
            <button 
              onClick={() => setCmdOpen(true)}
              className="flex items-center w-full px-3 py-1.5 bg-secondary text-muted-foreground border border-border rounded-md hover:bg-secondary/80 transition-colors text-sm"
            >
              <Search className="h-4 w-4 mr-2" />
              <span>Search entities, phones, accounts, IPs...</span>
              <kbd className="ml-auto flex items-center gap-1 font-mono text-[10px] bg-background border border-border rounded px-1.5 py-0.5">
                <Command className="w-3 h-3" /> K
              </kbd>
            </button>
          </div>

          {/* Right Header Icons */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setActiveTab('anomalies')}
              className="relative p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
              title="Anomalies Radar"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 block h-1.5 w-1.5 rounded-full bg-destructive ring-2 ring-background animate-pulse" />
            </button>
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="w-px h-5 bg-border mx-2" />
            <div 
              onClick={() => setActiveTab('investigations')}
              className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
              title="Investigator Profile"
            >
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </header>

        {/* Dynamic Canvas */}
        <main className="flex-1 overflow-auto relative">
          {activeTab === 'overview' && (
            <OverviewDashboard onNavigateTab={(tab) => setActiveTab(tab)} />
          )}

          {activeTab === 'investigations' && (
            <CaseManagementView onSelectCaseTab={(tab) => setActiveTab(tab)} />
          )}

          {activeTab === 'data-sources' && (
            <DataIngestionVault onNavigateToPipeline={() => setActiveTab('pipeline')} />
          )}

          {activeTab === 'pipeline' && (
            <ProcessingPipelineView onNavigateToTab={(tab) => setActiveTab(tab)} />
          )}

          {activeTab === 'entity-explorer' && (
            <EntityResolutionMatrix 
              onViewOnGraph={(entityId) => {
                setFocusAnomalyEntityId(entityId);
                setActiveTab('relationship-graph');
              }}
              onNavigateToAnomalies={() => setActiveTab('anomalies')}
            />
          )}

          {activeTab === 'relationship-graph' && (
            <GraphTopologyViewer focusEntityId={focusAnomalyEntityId} />
          )}

          {activeTab === 'timeline' && (
            <TimelineFootprint />
          )}

          {activeTab === 'geospatial' && (
            <GeospatialMap />
          )}

          {activeTab === 'anomalies' && (
            <AnomaliesTab 
              onAnomalySelect={(anomaly) => setSelectedAnomaly(anomaly)} 
            />
          )}

          {activeTab === 'reports' && (
            <CaseDossierExporter />
          )}

          {activeTab === 'audit' && (
            <AuditTrailLogs />
          )}
        </main>
      </div>

      {/* Deep Anomaly Investigation Drawer */}
      <AnomalyInvestigationDrawer 
        anomaly={selectedAnomaly} 
        onClose={() => setSelectedAnomaly(null)}
        onViewOnGraph={(entityId) => {
          setFocusAnomalyEntityId(entityId);
          setSelectedAnomaly(null);
          setActiveTab('relationship-graph');
        }}
        onViewInTimeline={(entityId) => {
          setSelectedAnomaly(null);
          setActiveTab('timeline');
        }}
        onViewOnMap={(entityId) => {
          setSelectedAnomaly(null);
          setActiveTab('geospatial');
        }}
      />

      {/* Create Case Modal */}
      <CreateCaseModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
      />

      {/* Command Palette Modal */}
      {cmdOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-32 bg-black/40 backdrop-blur-sm" onClick={() => setCmdOpen(false)}>
          <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center px-4 py-3 border-b border-border">
              <Search className="w-5 h-5 text-muted-foreground mr-3" />
              <input 
                autoFocus
                type="text" 
                placeholder="Search TRACE entities, cases, phones, accounts..." 
                className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground text-sm"
              />
              <kbd className="font-mono text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded border border-border">ESC</kbd>
            </div>
            <div className="p-2 max-h-[60vh] overflow-y-auto space-y-1">
              <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Actions</div>
              {[
                { label: 'Create New Case Dossier', action: () => { setCmdOpen(false); setIsCreateModalOpen(true); } },
                { label: 'Open Multi-Engine Anomaly Radar', action: () => { setCmdOpen(false); setActiveTab('anomalies'); } },
                { label: 'View Relationship Graph Topology', action: () => { setCmdOpen(false); setActiveTab('relationship-graph'); } },
                { label: 'View Zingg Entity Resolution', action: () => { setCmdOpen(false); setActiveTab('entity-explorer'); } },
                { label: 'Ingest Evidence Files', action: () => { setCmdOpen(false); setActiveTab('data-sources'); } },
                { label: 'Run Processing Pipeline', action: () => { setCmdOpen(false); setActiveTab('pipeline'); } },
              ].map((cmd, i) => (
                <button 
                  key={i} 
                  onClick={cmd.action}
                  className="w-full text-left px-3 py-2 rounded-md text-sm text-foreground hover:bg-secondary hover:text-primary transition-colors flex items-center gap-2"
                >
                  <Command className="w-4 h-4 text-muted-foreground" /> {cmd.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <CaseProvider>
      <InvestigationWorkspace />
    </CaseProvider>
  );
}
