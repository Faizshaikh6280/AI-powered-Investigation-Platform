import React, { useState } from 'react';
import { 
  Users, Smartphone, Building, Globe, Search, ChevronRight, CheckCircle2, Filter
} from 'lucide-react';
import { cn } from '../utils/cn';

export default function EntityResolutionMatrix() {
  const [activeTab, setActiveTab] = useState('All');

  const entities = [
    { id: '1', name: 'Raj Kumar', type: 'PERSON', risk: 'HIGH', conns: 24, lastActive: '2h ago', status: 'Active', icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
    { id: '2', name: '+91 98765 43210', type: 'PHONE', risk: 'MEDIUM', conns: 12, lastActive: '5h ago', status: 'Active', icon: Smartphone, color: 'text-muted-foreground', bg: 'bg-secondary' },
    { id: '3', name: 'XXXX-4821', type: 'ACCOUNT', risk: 'CRITICAL', conns: 42, lastActive: '1h ago', status: 'Flagged', icon: Building, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { id: '4', name: '103.24.X.X', type: 'IP', risk: 'LOW', conns: 8, lastActive: '12h ago', status: 'Active', icon: Globe, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  ];

  return (
    <div className="flex flex-col h-full bg-background p-6 md:p-8 max-w-7xl mx-auto w-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Entity Explorer</h2>
          <p className="text-sm text-muted-foreground mt-1">Cross-domain entity management and resolution</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search entities..." 
              className="pl-9 pr-4 py-1.5 w-64 bg-secondary border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
            />
          </div>
          <button className="px-3 py-1.5 rounded-md bg-secondary border border-border text-sm font-medium hover:bg-secondary/80 transition-colors flex items-center gap-2 text-foreground">
            <Filter className="w-4 h-4 text-muted-foreground" /> Filters
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-border">
        {['All', 'People', 'Phones', 'Devices', 'Accounts', 'IPs', 'Locations', 'Social'].map((tab) => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 bg-card border border-border shadow-sm rounded-xl overflow-hidden flex flex-col">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Entity</th>
              <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Risk</th>
              <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Connections</th>
              <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Activity</th>
              <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entities.map((e) => (
              <tr key={e.id} className="hover:bg-secondary/50 transition-colors cursor-pointer group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-md border border-border shadow-sm", e.bg)}>
                      <e.icon className={cn("w-4 h-4", e.color)} />
                    </div>
                    <span className="font-medium text-foreground">{e.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-1 rounded border border-border">{e.type}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", 
                      e.risk === 'CRITICAL' ? 'bg-red-500' :
                      e.risk === 'HIGH' ? 'bg-orange-500' :
                      e.risk === 'MEDIUM' ? 'bg-amber-500' : 'bg-emerald-500'
                    )} />
                    <span className="text-sm font-medium text-foreground">{e.risk}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-foreground">{e.conns} nodes</td>
                <td className="px-6 py-4 text-sm text-muted-foreground">{e.lastActive}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    {e.status}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors inline-block" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
