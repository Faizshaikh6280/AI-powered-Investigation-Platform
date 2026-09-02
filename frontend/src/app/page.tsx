'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, Bell, HelpCircle, User, Activity, FolderOpen, Database, 
  Users, Share2, Clock, Map, AlertTriangle, FileText, Smartphone, 
  Globe, BarChart3, ShieldCheck, Settings, LogOut, ChevronRight,
  Sun, Moon, Menu, Command, X
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '../utils/cn';

// Modules
import OverviewDashboard from '../components/OverviewDashboard';
import GraphTopologyViewer from '../components/GraphTopologyViewer';
import TimelineFootprint from '../components/TimelineFootprint';
import AnomaliesTab from '../components/AnomaliesTab';
import AnomalyInvestigationDrawer from '../components/AnomalyInvestigationDrawer';

const navigation = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'investigations', label: 'Investigations', icon: FolderOpen },
  { id: 'data-sources', label: 'Data Sources', icon: Database },
  { id: 'entity-explorer', label: 'Entity Explorer', icon: Users },
  { id: 'relationship-graph', label: 'Relationship Graph', icon: Share2 },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'geospatial', label: 'Geospatial', icon: Map },
  { id: 'anomalies', label: 'Anomalies & Alerts', icon: AlertTriangle },
  { id: 'transactions', label: 'Transactions', icon: FileText },
  { id: 'telecom', label: 'Telecom Analysis', icon: Smartphone },
  { id: 'social', label: 'Social Intelligence', icon: Globe },
  { id: 'reports', label: 'Reports & Evidence', icon: BarChart3 },
  { id: 'audit', label: 'Audit Logs', icon: ShieldCheck },
  { id: 'administration', label: 'Administration', icon: Settings },
];

export default function Page() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isSidebarExpanded, setSidebarExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
            <ShieldCheck className="w-6 h-6 flex-shrink-0" />
            <div className={cn("transition-opacity duration-300", isSidebarExpanded ? "opacity-100" : "opacity-0 w-0")}>
              TRACE
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
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>INV-2026-0142</span>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground font-medium">Cross-Domain Network</span>
          </div>

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

          <div className="flex items-center gap-2">
            <button className="relative p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 block h-1.5 w-1.5 rounded-full bg-destructive ring-2 ring-background" />
            </button>
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="w-px h-5 bg-border mx-2" />
            <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center cursor-pointer">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </header>

        {/* Dynamic Canvas - Always gives max space */}
        <main className="flex-1 overflow-auto relative">
          {activeTab === 'overview' && <OverviewDashboard />}
          {activeTab === 'relationship-graph' && <GraphTopologyViewer focusEntityId={focusAnomalyEntityId} />}
          {activeTab === 'timeline' && <TimelineFootprint />}
          {activeTab === 'anomalies' && <AnomaliesTab onAnomalySelect={(a) => setSelectedAnomaly(a)} />}
          
          {/* Fallback for unbuilt components */}
          {!['overview', 'relationship-graph', 'timeline', 'anomalies'].includes(activeTab) && (
            <div className="p-8 flex items-center justify-center h-full">
              <div className="max-w-md text-center space-y-3">
                <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                  <Activity className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground">{navigation.find(n => n.id === activeTab)?.label}</h3>
                <p className="text-sm text-muted-foreground">This module is part of the advanced functional workspace. Toggle advanced functionality to view.</p>
              </div>
            </div>
          )}
        </main>
      </div>

      <AnomalyInvestigationDrawer 
        anomaly={selectedAnomaly} 
        onClose={() => setSelectedAnomaly(null)}
        onViewOnGraph={(entityId) => {
           setFocusAnomalyEntityId(entityId);
           setSelectedAnomaly(null);
           setActiveTab('relationship-graph');
        }}
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
                placeholder="Search TRACE..." 
                className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
              />
              <kbd className="font-mono text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded border border-border">ESC</kbd>
            </div>
            <div className="p-2 max-h-[60vh] overflow-y-auto">
              <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Actions</div>
              {['Search Entity', 'Open Investigation', 'Open Graph', 'Generate Report'].map((cmd, i) => (
                <button key={i} className="w-full text-left px-3 py-2 rounded-md text-sm text-foreground hover:bg-secondary hover:text-primary transition-colors flex items-center gap-2">
                  <Command className="w-4 h-4 text-muted-foreground" /> {cmd}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
