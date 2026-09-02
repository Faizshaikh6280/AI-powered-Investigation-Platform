import React from 'react';
import { 
  UploadCloud, Smartphone, CreditCard, Globe, 
  CheckCircle2, AlertCircle, Clock
} from 'lucide-react';
import { cn } from '../utils/cn';

export default function DataIngestionVault() {
  const sources = [
    { name: 'CDR Data', icon: Smartphone, records: '142,841', status: 'Healthy', error: 0, date: '2 hours ago', color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
    { name: 'IPDR Logs', icon: Globe, records: '84,192', status: 'Warning', error: 12, date: '5 hours ago', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { name: 'Bank Statements', icon: CreditCard, records: '4,812', status: 'Healthy', error: 0, date: '1 day ago', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  ];

  return (
    <div className="flex flex-col h-full bg-background p-6 md:p-8 max-w-7xl mx-auto w-full">
      <div className="flex justify-between items-center mb-8 border-b border-border pb-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Data Sources</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage and import investigative data</p>
        </div>
        <button className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm">
          <UploadCloud className="w-4 h-4" /> Import Dataset
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {sources.map((src, i) => (
          <div key={i} className="bg-card border border-border p-6 rounded-xl flex flex-col hover:border-primary/50 transition-colors cursor-pointer shadow-sm group">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className={cn("p-2.5 rounded-md border border-border", src.bg, src.color)}>
                  <src.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-foreground">{src.name}</h3>
              </div>
              <div className={cn(
                "px-2.5 py-0.5 rounded text-xs font-bold tracking-wider uppercase border",
                src.status === 'Healthy' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20"
              )}>
                {src.status}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Records</p>
                <p className="text-xl font-bold text-foreground">{src.records}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Errors</p>
                <p className={cn("text-xl font-bold", src.error > 0 ? "text-amber-500" : "text-foreground")}>{src.error}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-auto pt-4 border-t border-border">
              <Clock className="w-3.5 h-3.5" /> Last imported {src.date}
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1 bg-secondary/30 rounded-xl p-6 flex flex-col items-center justify-center border-dashed border-2 border-border hover:border-primary/50 hover:bg-secondary/50 transition-colors cursor-pointer group">
        <div className="w-16 h-16 rounded-full bg-card border border-border shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
          <UploadCloud className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Drag & drop files to import</h3>
        <p className="text-sm text-muted-foreground max-w-sm text-center mb-6">
          Supported formats: CSV, Excel, PDF, JSON, TXT. Data fields will be automatically mapped to entities.
        </p>
        <button className="px-4 py-2 bg-card text-foreground text-sm font-medium rounded-md border border-border shadow-sm hover:bg-secondary transition-colors">
          Browse Files
        </button>
      </div>
    </div>
  );
}
