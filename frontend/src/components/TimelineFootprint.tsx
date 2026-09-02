import React, { useState, useEffect } from 'react';
import { 
  Smartphone, CreditCard, Globe, Users, MapPin, 
  Filter, Calendar, Search, ArrowRight, Clock, Settings2
} from 'lucide-react';
import { cn } from '../utils/cn';

export default function TimelineFootprint() {
  const [filterOpen, setFilterOpen] = useState(false);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    fetch('http://localhost:8000/api/geo/sync-data')
      .then(r => r.json())
      .then(data => {
        if (data.timeline && data.timeline.length > 0) {
          const formatted = data.timeline.map((ev: any) => {
            const dateObj = new Date(ev.time_ms);
            let icon = Globe;
            let color = 'text-blue-500';
            let bg = 'bg-blue-500/10';
            let border = 'border-blue-500/20';

            if (ev.domain === 'TELECOM') {
              icon = Smartphone; color = 'text-indigo-500'; bg = 'bg-indigo-500/10'; border = 'border-indigo-500/20';
            } else if (ev.domain === 'BANKING') {
              icon = CreditCard; color = 'text-emerald-500'; bg = 'bg-emerald-500/10'; border = 'border-emerald-500/20';
            }

            return {
              id: ev.id,
              time: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              date: dateObj.toLocaleDateString(),
              type: ev.event_type.replace('_', ' '),
              icon, color, bg, border,
              content: <span className="text-sm font-medium text-foreground">{ev.identity?.phone || ev.financial?.account_number || ev.telemetry?.client_ip || 'System Event'}</span>,
              details: ev.telemetry?.tower_address ? [{ label: 'Location', value: ev.telemetry.tower_address }] : []
            };
          });
          setEvents(formatted);
        } else {
          // Fallback static
          setEvents([
            { id: '1', time: '08:14', date: 'Today', type: 'PHONE CALL', icon: Smartphone, color: 'text-indigo-500', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', content: <span className="font-mono text-foreground font-medium">+91 98765 43210</span>, details: [{label: 'Cell Tower', value: 'Mohali Sector 62'}] },
            { id: '2', time: '08:28', date: 'Today', type: 'BANK TRANSFER', icon: CreditCard, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', content: <span className="text-emerald-500 font-bold text-lg">₹85,000</span>, details: [] }
          ]);
        }
      })
      .catch(() => {
        setEvents([
          { id: '1', time: '08:14', date: 'Today', type: 'PHONE CALL', icon: Smartphone, color: 'text-indigo-500', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', content: <span className="font-mono text-foreground font-medium">+91 98765 43210</span>, details: [{label: 'Cell Tower', value: 'Mohali Sector 62'}] },
        ]);
      });
  }, []);

  return (
    <div className="flex flex-col h-full bg-background relative">
      
      {/* Top Bar */}
      <div className="flex justify-between items-center p-4 border-b border-border bg-card shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search timeline..." 
              className="pl-9 pr-4 py-1.5 w-64 bg-secondary border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
            />
          </div>
          <div className="flex items-center gap-2 border-l border-border pl-4">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Timeline</span>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => setFilterOpen(!filterOpen)}
            className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 border", 
              filterOpen ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-foreground border-border hover:bg-secondary/80"
            )}
          >
            <Settings2 className="w-4 h-4" /> Filters
          </button>
        </div>
      </div>

      {/* Floating Filter Panel (Progressive Disclosure) */}
      {filterOpen && (
        <div className="absolute top-16 right-4 w-64 bg-card border border-border shadow-xl rounded-lg p-4 z-20 animate-in fade-in slide-in-from-top-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Event Type</h4>
          <div className="space-y-2 mb-4">
            {['Telecom (CDR)', 'Banking & Finance', 'Digital Footprint (IP)', 'Social Media', 'Physical Location'].map(f => (
              <label key={f} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded border-border text-primary focus:ring-primary" />
                {f}
              </label>
            ))}
          </div>
          <button className="w-full py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors">
            Apply
          </button>
        </div>
      )}

      {/* Timeline Area */}
      <div className="flex-1 overflow-y-auto p-8 relative">
        <div className="max-w-3xl mx-auto relative py-4">
          {/* Main Vertical Line */}
          <div className="absolute left-[100px] top-0 bottom-0 w-px bg-border" />
          
          <div className="space-y-12">
            {events.map((event) => (
              <div key={event.id} className="relative flex group">
                {/* Time */}
                <div className="w-[100px] pt-4 pr-6 text-right flex-shrink-0">
                  <div className="text-lg font-mono font-medium text-foreground">{event.time}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">{event.date}</div>
                </div>
                
                {/* Node Marker */}
                <div className={cn(
                  "absolute left-[100px] top-5 -translate-x-1/2 w-4 h-4 rounded-full border-[3px] border-background transition-transform duration-200 z-10",
                  event.bg, "group-hover:scale-125"
                )} />
                
                {/* Event Card */}
                <div className="flex-1 pl-8">
                  <div className={cn(
                    "bg-card rounded-xl border p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer group-hover:border-primary/50",
                    event.border
                  )}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={cn("p-1.5 rounded-md", event.bg, event.color)}>
                        <event.icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{event.type}</span>
                    </div>
                    
                    <div className="mb-3">
                      {event.content}
                    </div>
                    
                    {event.details.length > 0 && (
                      <div className="flex flex-wrap gap-4 pt-3 border-t border-border/50">
                        {event.details.map((detail: any, j: number) => (
                          <div key={j} className="flex flex-col">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{detail.label}</span>
                            <span className="text-sm text-foreground font-medium mt-0.5">{detail.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* End cap */}
          <div className="relative flex justify-center mt-12">
             <div className="absolute left-[100px] -translate-x-1/2 w-3 h-3 rounded-full bg-border border-2 border-background" />
          </div>
        </div>
      </div>
    </div>
  );
}
