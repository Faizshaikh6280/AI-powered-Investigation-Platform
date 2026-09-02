import React, { useState, useEffect } from 'react';
import { 
  Users, Share2, AlertTriangle, FileText, Smartphone, Globe, 
  ChevronRight, ArrowRight, MoreHorizontal, Filter, Calendar
} from 'lucide-react';
import { cn } from '../utils/cn';

const KPI = ({ title, value, icon: Icon, trend }: any) => (
  <div className="bg-card border border-border p-5 rounded-xl flex flex-col hover:border-primary/50 transition-colors cursor-pointer group shadow-sm">
    <div className="flex justify-between items-start mb-4">
      <div className="p-2 rounded-md bg-secondary text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
        <Icon className="w-5 h-5" />
      </div>
      {trend && (
        <span className="text-xs font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-full border border-destructive/20">
          {trend}
        </span>
      )}
    </div>
    <h4 className="text-3xl font-semibold text-foreground mb-1">{value}</h4>
    <p className="text-sm font-medium text-muted-foreground">{title}</p>
  </div>
);

export default function OverviewDashboard() {
  const [stats, setStats] = useState({ entities: 0, relationships: 0, anomalies: 0, transactions: 0 });

  useEffect(() => {
    Promise.all([
      fetch('http://localhost:8000/api/system/golden_profiles').then(r => r.json()).catch(() => []),
      fetch('http://localhost:8000/api/graph/topology').then(r => r.json()).catch(() => ({nodes: [], edges: []}))
    ]).then(([profiles, graph]) => {
      setStats({
        entities: profiles.length || graph.nodes?.length || 1248,
        relationships: graph.edges?.length || 8432,
        anomalies: 37,
        transactions: 24892
      });
    });
  }, []);

  return (
    <div className="p-6 md:p-8 flex flex-col gap-8 h-full max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Investigation Overview</h2>
          <p className="text-sm text-muted-foreground mt-1">Cross-domain activity and intelligence summary</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-md bg-secondary border border-border text-sm font-medium hover:bg-secondary/80 transition-colors flex items-center gap-2 text-foreground">
            <Calendar className="w-4 h-4 text-muted-foreground" /> Date Range
          </button>
          <button className="px-3 py-1.5 rounded-md bg-secondary border border-border text-sm font-medium hover:bg-secondary/80 transition-colors flex items-center gap-2 text-foreground">
            <Filter className="w-4 h-4 text-muted-foreground" /> Filter
          </button>
          <button className="p-1.5 rounded-md bg-secondary border border-border hover:bg-secondary/80 transition-colors text-foreground">
            <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI title="Entities Resolved" value={stats.entities} icon={Users} />
        <KPI title="Graph Relationships" value={stats.relationships} icon={Share2} />
        <KPI title="Anomalies Detected" value={stats.anomalies} icon={AlertTriangle} trend="12 High" />
        <KPI title="Transactions Analyzed" value={stats.transactions} icon={FileText} />
      </div>

      {/* Main Two-Column Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[400px]">
        
        {/* Main Area: Cross-Domain Activity */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 flex flex-col shadow-sm">
          <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
            <h3 className="text-lg font-medium text-foreground">Cross-Domain Activity</h3>
            <button className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">View Timeline</button>
          </div>
          
          <div className="flex-1 space-y-4">
            {[
              { time: '08:32', type: 'PHONE CALL', desc: '+91 XXXXX to +91 XXXXX', icon: Smartphone, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
              { time: '08:47', type: 'BANK TRANSFER', desc: '₹85,000 from XXXX4821', icon: FileText, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
              { time: '09:03', type: 'IP LOGIN', desc: '103.X.X.X (Delhi)', icon: Globe, color: 'text-blue-500', bg: 'bg-blue-500/10' },
              { time: '09:12', type: 'SOCIAL MEDIA POST', desc: '@username interaction', icon: Users, color: 'text-amber-500', bg: 'bg-amber-500/10' }
            ].map((event, i) => (
              <div key={i} className="flex items-start gap-4 p-3 rounded-lg hover:bg-secondary transition-colors cursor-pointer group">
                <span className="text-xs font-mono text-muted-foreground pt-1.5 w-12">{event.time}</span>
                <div className={cn("p-2 rounded-md", event.bg, event.color)}>
                  <event.icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-foreground uppercase tracking-wide">{event.type}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">{event.desc}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity self-center" />
              </div>
            ))}
          </div>
        </div>

        {/* Secondary Area: Risk Summary */}
        <div className="bg-card border border-border rounded-xl p-6 flex flex-col shadow-sm">
          <h3 className="text-lg font-medium text-foreground mb-6 border-b border-border pb-4">Investigation Risk</h3>
          
          <div className="flex items-center gap-6 mb-8">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" className="stroke-secondary" strokeWidth="10" fill="none" />
                <circle cx="50" cy="50" r="40" className="stroke-destructive" strokeWidth="10" fill="none" strokeDasharray="251.2" strokeDashoffset="45.2" strokeLinecap="round" />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-2xl font-bold text-foreground">82</span>
              </div>
            </div>
            <div>
              <div className="text-sm font-bold text-destructive uppercase tracking-widest mb-1">High Risk</div>
              <p className="text-xs text-muted-foreground">Based on cross-domain anomalies</p>
            </div>
          </div>

          <div className="flex-1">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Primary Risk Drivers</h4>
            <div className="space-y-3">
              {[
                { label: 'Rapid fund movement', risk: 'bg-red-500' },
                { label: 'Unusual communication', risk: 'bg-orange-500' },
                { label: 'Multiple device identities', risk: 'bg-amber-500' }
              ].map((driver, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={cn("w-1.5 h-1.5 rounded-full", driver.risk)} />
                  <span className="text-sm text-foreground">{driver.label}</span>
                </div>
              ))}
            </div>
          </div>
          
          <button className="w-full mt-6 py-2 bg-secondary text-foreground text-sm font-medium rounded-md hover:bg-secondary/80 transition-colors">
            View All Alerts
          </button>
        </div>
        
      </div>
    </div>
  );
}
