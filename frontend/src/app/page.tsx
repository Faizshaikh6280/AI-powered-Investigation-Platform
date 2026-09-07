'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, Bell, HelpCircle, User, Activity, FolderOpen, Database, 
  Users, Share2, Clock, Map, AlertTriangle, FileText, Smartphone, 
  Globe, BarChart3, ShieldCheck, Settings, LogOut, ChevronRight,
  Sun, Moon, Menu, Command, X, Cpu, Plus, Layers, Crosshair, Camera,
  Shield, LogIn
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '../utils/cn';
import { CaseProvider, useCase } from '../context/CaseContext';
import { AuthProvider, useAuth, SEEDED_DEV_ACCOUNTS } from '../context/AuthContext';

// Modules
import OverviewDashboard from '../components/OverviewDashboard';
import CaseManagementView from '../components/CaseManagementView';
import DataIngestionVault from '../components/DataIngestionVault';
import ProcessingPipelineView from '../components/ProcessingPipelineView';
import EntityResolutionMatrix from '../components/EntityResolutionMatrix';
import GraphTopologyViewer from '../components/GraphTopologyViewer';
import TimelineFootprint from '../components/TimelineFootprint';
import GeospatialMap from '../components/GeospatialMap';
import { CCTVIntelligenceWorkspace } from '../components/cctv/CCTVIntelligenceWorkspace';
import AnomaliesTab from '../components/AnomaliesTab';
import AnomalyInvestigationDrawer from '../components/AnomalyInvestigationDrawer';
import CaseDossierExporter from '../components/CaseDossierExporter';
import AuditTrailLogs from '../components/AuditTrailLogs';
import { InvestigationDashboard } from '../components/InvestigationDashboard';
import CreateCaseModal from '../components/CreateCaseModal';
import LoginModal from '../components/auth/LoginModal';
import UserProfileModal from '../components/auth/UserProfileModal';
import UserManagementView from '../components/admin/UserManagementView';

interface NavItem {
  id: string;
  label: string;
  icon: any;
  permission?: string;
}

const navigation: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'agentic', label: 'Agentic Forensics', icon: Crosshair },
  { id: 'investigations', label: 'Case Dossiers', icon: FolderOpen, permission: 'case.read' },
  { id: 'data-sources', label: 'Evidence Intake', icon: Database, permission: 'evidence.view' },
  { id: 'pipeline', label: 'Processing Pipeline', icon: Cpu, permission: 'evidence.view' },
  { id: 'entity-explorer', label: 'Entity Explorer', icon: Users, permission: 'entity.view' },
  { id: 'relationship-graph', label: 'Relationship Graph', icon: Share2, permission: 'graph.view' },
  { id: 'timeline', label: 'Timeline', icon: Clock, permission: 'timeline.view' },
  { id: 'geospatial', label: 'Geospatial Map', icon: Map, permission: 'geospatial.view' },
  { id: 'cctv', label: 'CCTV Intelligence', icon: Camera, permission: 'cctv.view' },
  { id: 'anomalies', label: 'Anomalies & Radar', icon: AlertTriangle, permission: 'anomaly.view' },
  { id: 'reports', label: 'Reports & Export', icon: BarChart3, permission: 'report.view' },
  { id: 'audit', label: 'Audit Trail', icon: ShieldCheck, permission: 'audit.view' },
  { id: 'personnel', label: 'Personnel & IAM', icon: Shield, permission: 'user.view' },
];

function InvestigationWorkspace() {
  const { cases, activeCase, setActiveCaseId } = useCase();
  const { 
    user, 
    role, 
    permissions, 
    isAuthenticated, 
    can, 
    logout, 
    switchDevRole, 
    setIsProfileModalOpen, 
    setIsLoginModalOpen 
  } = useAuth();

  const [activeTab, setActiveTab] = useState('overview');
  const [isSidebarExpanded, setSidebarExpanded] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  
  const [selectedAnomaly, setSelectedAnomaly] = useState<any>(null);
  const [focusAnomalyEntityId, setFocusAnomalyEntityId] = useState<string | null>(null);

  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Handle case_id redirect from NFC authentication
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const targetCase = params.get('case_id') || params.get('case');
      if (targetCase) {
        setActiveCaseId(targetCase);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [setActiveCaseId]);

  // Redirect if current tab becomes unauthorized on role switch
  useEffect(() => {
    if (!isAuthenticated) return;
    const currentNav = navigation.find(n => n.id === activeTab);
    if (currentNav && currentNav.permission && !can(currentNav.permission)) {
      setActiveTab('overview');
    }
  }, [role, permissions, activeTab, can, isAuthenticated]);

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

  const visibleNavItems = navigation.filter(item => !item.permission || can(item.permission));

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
          {visibleNavItems.map((item) => (
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
              {can('case.create') && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="p-0.5 text-muted-foreground hover:text-primary transition-colors ml-1"
                  title="Create New Case Dossier"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            
            {activeCase?.status && (
              <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {activeCase.status}
              </span>
            )}
          </div>

          {/* Quick Search */}
          <div className="flex-1 max-w-xl px-4 hidden md:block">
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

          {/* Right Header Controls & IAM Profile Badge */}
          <div className="flex items-center gap-2">
            {/* Dev Quick Role Switcher */}
            <div className="hidden lg:flex items-center gap-1.5 bg-secondary/70 border border-border px-2 py-1 rounded-lg">
              <Shield className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Role:</span>
              <select
                value={role || ''}
                onChange={(e) => switchDevRole(e.target.value)}
                className="bg-transparent text-xs font-semibold text-foreground border-none outline-none cursor-pointer pr-1"
                title="Law Enforcement Role Switcher (RBAC Test Bed)"
              >
                {Object.entries(SEEDED_DEV_ACCOUNTS).map(([key, acc]) => (
                  <option key={key} value={key} className="bg-card text-foreground">
                    {acc.display_name} ({acc.badge})
                  </option>
                ))}
              </select>
            </div>

            {/* Anomalies Bell */}
            <button 
              onClick={() => setActiveTab('anomalies')}
              className="relative p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
              title="Anomalies Radar"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 block h-1.5 w-1.5 rounded-full bg-destructive ring-2 ring-background animate-pulse" />
            </button>

            {/* Theme Toggle */}
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className="w-px h-5 bg-border mx-1" />

            {/* Authenticated Officer Badge OR Login Trigger */}
            {isAuthenticated && user ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsProfileModalOpen(true)}
                  className="flex items-center gap-2 px-2.5 py-1 bg-secondary/50 hover:bg-secondary border border-border rounded-lg transition-colors group text-left"
                  title="View Officer Profile, Sessions & Security"
                >
                  <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary group-hover:border-primary transition-colors">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="hidden xl:flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-foreground truncate max-w-[110px]">
                        {user.full_name}
                      </span>
                      <span className={cn(
                        "text-[9px] font-bold px-1.5 py-0.2 rounded border font-mono tracking-wider",
                        role === 'SYSTEM_ADMIN' ? "bg-red-500/15 text-red-400 border-red-500/30" :
                        role === 'SUPERINTENDENT' || role === 'IPS_OFFICER' ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
                        role === 'INSPECTOR' || role === 'SUB_INSPECTOR' ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30" :
                        role === 'ANALYST' ? "bg-purple-500/15 text-purple-400 border-purple-500/30" :
                        "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      )}>
                        {user.role_display || user.role}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {user.employee_id} • {user.unit || 'CCID-HQ'}
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => logout()}
                  className="p-2 text-muted-foreground hover:text-destructive rounded-md hover:bg-destructive/10 transition-colors"
                  title="Logout / Terminate Session"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5" /> Sign In
              </button>
            )}
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
            <DataIngestionVault 
              onNavigateToPipeline={() => setActiveTab('pipeline')}
              onNavigateToGraph={(entityId) => {
                setFocusAnomalyEntityId(entityId || null);
                setActiveTab('relationship-graph');
              }}
              onNavigateToTimeline={() => setActiveTab('timeline')}
              onNavigateToMap={() => setActiveTab('geospatial')}
              onNavigateToFindings={() => setActiveTab('anomalies')}
            />
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
            <TimelineFootprint 
              onNavigateToGraph={(entityId) => {
                setFocusAnomalyEntityId(entityId);
                setActiveTab('relationship-graph');
              }}
              onNavigateToMap={() => {
                setActiveTab('geospatial');
              }}
            />
          )}

          {activeTab === 'geospatial' && (
            <GeospatialMap 
              onViewOnGraph={(entityId) => {
                setFocusAnomalyEntityId(entityId);
                setActiveTab('relationship-graph');
              }}
            />
          )}

          {activeTab === 'cctv' && (
            <CCTVIntelligenceWorkspace activeCase={activeCase} />
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

          {activeTab === 'personnel' && (
            <UserManagementView />
          )}

          {activeTab === 'agentic' && (
            <InvestigationDashboard activeCaseId={activeCase?.case_id || ""} />
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

      {/* Officer IAM Modals */}
      <LoginModal />
      <UserProfileModal />

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
                { label: 'Create New Case Dossier', action: () => { setCmdOpen(false); setIsCreateModalOpen(true); }, perm: 'case.create' },
                { label: 'Open Multi-Engine Anomaly Radar', action: () => { setCmdOpen(false); setActiveTab('anomalies'); }, perm: 'anomaly.view' },
                { label: 'View Relationship Graph Topology', action: () => { setCmdOpen(false); setActiveTab('relationship-graph'); }, perm: 'graph.view' },
                { label: 'View Zingg Entity Resolution', action: () => { setCmdOpen(false); setActiveTab('entity-explorer'); }, perm: 'entity.view' },
                { label: 'Ingest Evidence Files', action: () => { setCmdOpen(false); setActiveTab('data-sources'); }, perm: 'evidence.upload' },
                { label: 'Run Processing Pipeline', action: () => { setCmdOpen(false); setActiveTab('pipeline'); }, perm: 'evidence.view' },
                { label: 'Personnel Directory & IAM', action: () => { setCmdOpen(false); setActiveTab('personnel'); }, perm: 'user.view' },
                { label: 'Inspect Audit Trail Logs', action: () => { setCmdOpen(false); setActiveTab('audit'); }, perm: 'audit.view' },
                { label: 'Officer Profile & Active Sessions', action: () => { setCmdOpen(false); setIsProfileModalOpen(true); } },
              ].filter(item => !item.perm || can(item.perm)).map((cmd, i) => (
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
    <AuthProvider>
      <CaseProvider>
        <InvestigationWorkspace />
      </CaseProvider>
    </AuthProvider>
  );
}
