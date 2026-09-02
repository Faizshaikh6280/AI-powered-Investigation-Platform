import os

content = r'''import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Users, Smartphone, Building, Laptop, Globe, Search, Filter, 
  Layers, Settings, Download, ZoomIn, ZoomOut, Maximize,
  ChevronRight, X, AlertTriangle, Phone, FileText, Share2,
  MapPin, AtSign, Mail, ArrowRight, Clock, Network, 
  UserRound, Landmark, WalletCards, ArrowLeftRight, MessagesSquare, Building2,
  RefreshCcw, Activity
} from 'lucide-react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import cola from 'cytoscape-cola';
import fcose from 'cytoscape-fcose';
import { useTheme } from 'next-themes';
import { cn } from '../utils/cn';

// Register layouts
if (!cytoscape.layouts || !cytoscape.layouts.some((l: any) => l.name === 'dagre')) {
  cytoscape.use(dagre);
  cytoscape.use(cola);
  cytoscape.use(fcose);
}

// Map types to icons/colors
const getTypeConfig = (type: string) => {
  const configs: Record<string, { icon: any, color: string, iconStr: string }> = {
    Person: { icon: UserRound, color: '#ef4444', iconStr: '<path d="M2 21a8 8 0 0 1 10.82-7.5"/><circle cx="12" cy="8" r="5"/>' },
    Phone: { icon: Phone, color: '#0ea5e9', iconStr: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>' },
    Bank: { icon: Landmark, color: '#10b981', iconStr: '<path d="M3 22h18"/><path d="M6 18v-7"/><path d="M10 18v-7"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M12 2l8 5H4z"/>' },
    BankAccount: { icon: WalletCards, color: '#10b981', iconStr: '<rect width="18" height="12" x="3" y="6" rx="2"/><path d="M3 10h18"/><path d="M7 15h.01"/><path d="M11 15h2"/>' },
    Transaction: { icon: ArrowLeftRight, color: '#f59e0b', iconStr: '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>' },
    Device: { icon: Smartphone, color: '#f59e0b', iconStr: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>' },
    IPAddress: { icon: Globe, color: '#6366f1', iconStr: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>' },
    Location: { icon: MapPin, color: '#d946ef', iconStr: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>' },
    SocialAccount: { icon: MessagesSquare, color: '#ec4899', iconStr: '<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5Z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>' },
    Email: { icon: Mail, color: '#8b5cf6', iconStr: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>' },
    Organization: { icon: Building2, color: '#64748b', iconStr: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>' },
  };
  return configs[type] || { icon: Layers, color: '#94a3b8', iconStr: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>' };
};

// SVG Icon generator for cytoscape background
const getSvgDataUri = (type: string, isDark: boolean) => {
  const config = getTypeConfig(type);
  // Pure white icon for maximum contrast against the solid colored node
  const svg = <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%23ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>;
  return 'data:image/svg+xml;utf8,' + svg; // %23ffffff is URL encoded #ffffff
};

// Drawer Component
const Drawer = ({ isOpen, onClose, title, children, width = 'w-96' }: any) => (
  <div className={cn(
    "absolute top-0 right-0 bottom-0 bg-background border-l border-border shadow-2xl z-20 transition-transform duration-300 ease-in-out flex flex-col",
    width, isOpen ? "translate-x-0" : "translate-x-full"
  )}>
    <div className="flex items-center justify-between p-4 border-b border-border bg-card sticky top-0 z-10">
      <h3 className="font-semibold text-foreground flex items-center gap-2">{title}</h3>
      <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
    <div className="flex-1 overflow-y-auto p-0 bg-background">
      {children}
    </div>
  </div>
);

export default function GraphTopologyViewer() {
  const { theme } = useTheme();
  const isDark = theme === 'dark' || (typeof window !== 'undefined' && document.documentElement.classList.contains('dark'));
  
  const [activeDrawer, setActiveDrawer] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [selectedEdge, setSelectedEdge] = useState<any>(null);
  const [graphData, setGraphData] = useState<{nodes: any[], edges: any[]}>({nodes: [], edges: []});
  const [loading, setLoading] = useState(true);
  const [layoutName, setLayoutName] = useState('fcose');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filters
  const [activeFilters, setActiveFilters] = useState<Record<string, boolean>>({
    Person: true, Phone: true, BankAccount: true, Device: true, IPAddress: true, Location: true, SocialAccount: true, Transaction: true, Organization: true, Bank: true, Email: true
  });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<any>(null);

  // Colors based on theme
  const canvasBg = isDark ? '#020617' : '#f8fafc'; // slightly darker canvas for better contrast
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const edgeColor = isDark ? '#334155' : '#cbd5e1';
  const highlightColor = isDark ? '#818cf8' : '#4f46e5';

  const fetchData = () => {
    setLoading(true);
    fetch('http://localhost:8000/api/graph/topology')
      .then(r => r.json())
      .then(data => {
        setGraphData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Graph fetch error", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute stats
  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    if(graphData.nodes) {
      graphData.nodes.forEach(n => {
        counts[n.type] = (counts[n.type] || 0) + 1;
      });
    }
    return {
      total: graphData.nodes?.length || 0,
      counts
    };
  }, [graphData]);

  useEffect(() => {
    if (!containerRef.current || loading || !graphData.nodes) return;

    // Filter nodes and edges based on active filters and search
    const filteredNodes = graphData.nodes.filter(n => {
      const passesFilter = activeFilters[n.type] !== false;
      const passesSearch = searchQuery === '' || 
        (n.label?.toLowerCase() || n.id.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        Object.values(n.properties || {}).some(v => String(v).toLowerCase().includes(searchQuery.toLowerCase()));
      return passesFilter && passesSearch;
    });
    
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = graphData.edges.filter(e => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target));

    const elements: any[] = [];
    filteredNodes.forEach((n: any) => {
      elements.push({
        data: { 
          id: n.id, 
          label: n.label || n.properties?.id || n.id, 
          type: n.type, 
          properties: n.properties,
          risk: n.properties?.risk_level || 'LOW',
          color: getTypeConfig(n.type).color
        }
      });
    });
    filteredEdges.forEach((e: any) => {
      elements.push({
        data: { 
          id: e.id, 
          source: e.source, 
          target: e.target, 
          label: e.relationship,
          properties: e.properties || {} 
        }
      });
    });

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    cyRef.current = cytoscape({
      container: containerRef.current,
      elements: elements,
      style: [
        {
          selector: 'node',
          style: {
            'shape': 'ellipse',
            'width': 56,
            'height': 56,
            'background-color': 'data(color)',
            'border-width': 2,
            'border-color': 'data(color)',
            'border-opacity': 0.8,
            'label': 'data(label)',
            'color': textColor,
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 8,
            'font-size': '12px',
            'font-weight': '600',
            'text-wrap': 'wrap',
            'text-max-width': '120px',
            'background-image': (ele: any) => getSvgDataUri(ele.data('type'), isDark),
            'background-width': '24px',
            'background-height': '24px',
            'background-position-x': '50%',
            'background-position-y': '50%',
            'shadow-blur': 10,
            'shadow-color': 'data(color)',
            'shadow-opacity': 0.2
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 1.5,
            'line-color': edgeColor,
            'target-arrow-color': edgeColor,
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '10px',
            'font-weight': 'bold',
            'color': textColor,
            'text-background-color': canvasBg,
            'text-background-opacity': 1,
            'text-background-padding': '4px',
            'text-background-shape': 'roundrectangle',
            'text-border-color': edgeColor,
            'text-border-width': 1,
            'text-border-opacity': 0.5,
            'edge-text-rotation': 'autorotate'
          }
        },
        {
          selector: 'node.highlighted',
          style: {
            'border-color': highlightColor,
            'border-width': 4,
            'width': 64,
            'height': 64,
            'shadow-blur': 20,
            'shadow-color': highlightColor,
            'shadow-opacity': 0.5
          }
        },
        {
          selector: 'node.dimmed',
          style: {
            'opacity': 0.15,
            'label': ''
          }
        },
        {
          selector: 'edge.highlighted',
          style: {
            'line-color': highlightColor,
            'target-arrow-color': highlightColor,
            'width': 2.5,
            'z-index': 999
          }
        },
        {
          selector: 'edge.dimmed',
          style: {
            'opacity': 0.1
          }
        }
      ],
      layout: {
        name: layoutName,
        animate: true,
        animationDuration: 500,
        nodeDimensionsIncludeLabels: true,
        // Enforce strong repulsion and spacing
        idealEdgeLength: 150,
        nodeRepulsion: 400000,
        padding: 50,
        nodeSeparation: 100, // dagre
        rankSep: 100, // dagre
        minNodeSpacing: 50 // concentric
      }
    });

    cyRef.current.on('tap', 'node', (evt: any) => {
      const node = evt.target;
      const connectedEdges = node.connectedEdges();
      const connectedNodes = connectedEdges.connectedNodes();
      
      cyRef.current.elements().removeClass('highlighted dimmed');
      cyRef.current.elements().not(node).not(connectedNodes).not(connectedEdges).addClass('dimmed');
      
      node.addClass('highlighted');
      connectedNodes.addClass('highlighted');
      connectedEdges.addClass('highlighted');
      
      setSelectedNode(node.data());
      setSelectedEdge(null);
      setActiveDrawer('node');
      
      // Pan to center the selected node (optional smooth transition)
      cyRef.current.animate({
        center: { eles: node },
        duration: 300
      });
    });

    cyRef.current.on('tap', 'edge', (evt: any) => {
      const edge = evt.target;
      const connectedNodes = edge.connectedNodes();
      
      cyRef.current.elements().removeClass('highlighted dimmed');
      cyRef.current.elements().not(edge).not(connectedNodes).addClass('dimmed');
      
      edge.addClass('highlighted');
      connectedNodes.addClass('highlighted');
      
      setSelectedEdge(edge.data());
      setSelectedNode(null);
      setActiveDrawer('edge');
    });

    cyRef.current.on('tap', (evt: any) => {
      if (evt.target === cyRef.current) {
        cyRef.current.elements().removeClass('highlighted dimmed');
        setSelectedNode(null);
        setSelectedEdge(null);
        setActiveDrawer(null);
      }
    });

  }, [graphData, layoutName, activeFilters, searchQuery, isDark]);

  const toggleDrawer = (drawer: string) => {
    setActiveDrawer(activeDrawer === drawer ? null : drawer);
  };

  const handleFilterToggle = (type: string) => {
    setActiveFilters(prev => ({...prev, [type]: !prev[type]}));
  };

  return (
    <div className="absolute inset-0 flex bg-background overflow-hidden font-sans">
      <div className="flex-1 relative w-full h-full transition-colors duration-300" style={{ backgroundColor: canvasBg }}>
        
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-50 bg-background/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 bg-card p-6 rounded-xl border border-border shadow-xl">
              <Network className="w-8 h-8 text-primary animate-pulse" />
              <p className="text-sm font-medium text-foreground">Loading investigation network...</p>
            </div>
          </div>
        )}

        {/* Floating Top Toolbar */}
        <div className="absolute top-4 left-4 flex items-center gap-1 p-1.5 bg-card/80 backdrop-blur-md border border-border rounded-xl shadow-lg z-10 transition-all">
          <div className="relative flex items-center border-r border-border pr-2">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3" />
            <input 
              type="text" 
              placeholder="Search entities..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-sm text-foreground pl-9 pr-3 py-1.5 w-48 focus:w-64 transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          
          <button 
            onClick={() => toggleDrawer('filters')}
            className={cn("px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ml-1", 
              activeDrawer === 'filters' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            <Filter className="w-4 h-4" /> Filters
          </button>
          
          <button 
            onClick={() => toggleDrawer('layout')}
            className={cn("px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-2", 
              activeDrawer === 'layout' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            <Layers className="w-4 h-4" /> Layout
          </button>

          <button 
            onClick={fetchData}
            className="px-3 py-1.5 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center gap-2 border-l border-border ml-1 pl-3"
            title="Refresh Data"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Floating Legend / Summary */}
        <div className="absolute bottom-4 left-4 bg-card/80 backdrop-blur-md border border-border rounded-xl shadow-lg p-4 z-10 hidden md:block w-64">
          <div className="flex items-center justify-between mb-3 border-b border-border pb-2">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Network className="w-3.5 h-3.5" /> Network Summary
            </h4>
            <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">{stats.total} total</span>
          </div>
          <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
            {Object.entries(stats.counts).sort((a,b) => b[1] - a[1]).map(([type, count]) => {
              const config = getTypeConfig(type);
              const Icon = config.icon;
              return (
                <div key={type} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                    <span className="text-muted-foreground">{type}</span>
                  </div>
                  <span className="font-semibold text-foreground">{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Floating Bottom Controls */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10">
          <div className="flex bg-card/80 backdrop-blur-md border border-border rounded-xl shadow-lg overflow-hidden">
            <button onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.2)} className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border-r border-border">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 0.8)} className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border-r border-border">
              <ZoomOut className="w-4 h-4" />
            </button>
            <button onClick={() => cyRef.current?.fit()} className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-xs font-bold px-4">
              FIT
            </button>
          </div>
        </div>

        {/* Cytoscape Container */}
        <div ref={containerRef} className="absolute inset-0 z-0" />
      </div>

      {/* Filter Drawer */}
      <Drawer isOpen={activeDrawer === 'filters'} onClose={() => setActiveDrawer(null)} title={<><Filter className="w-4 h-4"/> Entity Filters</>} width="w-80">
        <div className="p-5 space-y-6">
          <div>
            <div className="space-y-2">
              {Object.keys(activeFilters).map(type => {
                const count = stats.counts[type] || 0;
                if (count === 0 && !activeFilters[type]) return null; // hide completely unused filters if off
                const config = getTypeConfig(type);
                const Icon = config.icon;
                return (
                  <label key={type} className={cn(
                    "flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors border",
                    activeFilters[type] ? "bg-primary/5 border-primary/20" : "hover:bg-secondary border-transparent opacity-60"
                  )}>
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={activeFilters[type]} 
                        onChange={() => handleFilterToggle(type)}
                        className="rounded border-border text-primary focus:ring-primary focus:ring-offset-background" 
                      />
                      <Icon className="w-4 h-4" style={{ color: config.color }} />
                      <span className="text-sm font-medium text-foreground">{type}</span>
                    </div>
                    <span className="text-xs font-semibold bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">{count}</span>
                  </label>
                )
              })}
            </div>
          </div>
          <div className="pt-4 border-t border-border">
            <button onClick={() => {
              const allOn: Record<string, boolean> = {};
              Object.keys(activeFilters).forEach(k => allOn[k] = true);
              setActiveFilters(allOn);
            }} className="w-full py-2 bg-secondary text-foreground text-sm font-medium rounded-lg hover:bg-secondary/80 transition-colors border border-border">
              Select All
            </button>
          </div>
        </div>
      </Drawer>

      {/* Layout Drawer */}
      <Drawer isOpen={activeDrawer === 'layout'} onClose={() => setActiveDrawer(null)} title={<><Layers className="w-4 h-4"/> Graph Layout</>} width="w-80">
        <div className="p-5 space-y-3">
          {[
            { id: 'fcose', name: 'Force Directed', desc: 'Prioritizes extreme spacing and natural clusters.' },
            { id: 'dagre', name: 'Hierarchical', desc: 'Arranges relationships directionally top-to-bottom.' },
            { id: 'cola', name: 'Physics (Cola)', desc: 'Constraint-based layout preventing overlaps.' },
            { id: 'concentric', name: 'Concentric', desc: 'Circular rings grouping dense connections.' },
            { id: 'breadthfirst', name: 'Tree', desc: 'Branching tree from central roots.' }
          ].map(layout => (
            <button 
              key={layout.id}
              onClick={() => { setLayoutName(layout.id); setActiveDrawer(null); }}
              className={cn(
                "w-full text-left p-4 rounded-xl border transition-all duration-200",
                layoutName === layout.id 
                  ? "bg-primary/10 border-primary shadow-sm" 
                  : "bg-card border-border hover:border-primary/50 hover:bg-secondary/50"
              )}
            >
              <div className={cn("text-sm font-bold mb-1", layoutName === layout.id ? "text-primary" : "text-foreground")}>{layout.name}</div>
              <div className="text-xs text-muted-foreground leading-relaxed">{layout.desc}</div>
            </button>
          ))}
        </div>
      </Drawer>

      {/* Node Details Drawer */}
      <Drawer isOpen={activeDrawer === 'node'} onClose={() => {setActiveDrawer(null); setSelectedNode(null);}} title={<><FileText className="w-4 h-4"/> Entity Profile</>} width="w-96">
        {selectedNode ? (
          <div className="flex flex-col h-full">
            <div className="p-6 bg-card border-b border-border shadow-sm z-10 relative">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg" style={{ backgroundColor: getTypeConfig(selectedNode.type).color }}>
                  {React.createElement(getTypeConfig(selectedNode.type).icon, { className: "w-7 h-7 text-white" })}
                </div>
                <div className="flex-1 overflow-hidden">
                  <h2 className="text-xl font-bold text-foreground leading-tight truncate" title={selectedNode.label}>{selectedNode.label}</h2>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-[10px] font-bold bg-secondary px-2.5 py-0.5 rounded-full text-muted-foreground uppercase tracking-wider border border-border">
                      {selectedNode.type}
                    </span>
                    {selectedNode.risk === 'HIGH' && (
                      <span className="text-[10px] font-bold bg-destructive/10 text-destructive px-2.5 py-0.5 rounded-full border border-destructive/20 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" /> HIGH RISK
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5" /> Entity Metadata
                </h4>
                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                  {Object.entries(selectedNode.properties || {}).map(([k, v]: any, idx) => (
                    <div key={k} className={cn("flex flex-col p-3.5 text-sm hover:bg-secondary/40 transition-colors", idx !== 0 && "border-t border-border")}>
                      <span className="text-xs text-muted-foreground capitalize mb-1">{k.replace(/_/g, ' ')}</span>
                      <span className="text-foreground font-semibold break-all">{String(v)}</span>
                    </div>
                  ))}
                  {Object.keys(selectedNode.properties || {}).length === 0 && (
                    <div className="p-6 text-sm text-muted-foreground text-center">No metadata available</div>
                  )}
                </div>
              </div>
              
              <div className="pt-2 space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button className="py-2.5 px-3 bg-secondary text-foreground text-sm font-semibold rounded-lg hover:bg-secondary/80 transition-colors border border-border flex items-center justify-center gap-2 shadow-sm">
                    <Clock className="w-4 h-4" /> Timeline
                  </button>
                  <button className="py-2.5 px-3 bg-secondary text-foreground text-sm font-semibold rounded-lg hover:bg-secondary/80 transition-colors border border-border flex items-center justify-center gap-2 shadow-sm">
                    <Share2 className="w-4 h-4" /> Network
                  </button>
                  <button className="col-span-2 py-3 px-3 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-md">
                    <AlertTriangle className="w-4 h-4" /> Add to Investigation Case
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-sm text-muted-foreground text-center flex flex-col items-center mt-20">
            <Network className="w-10 h-10 mb-4 opacity-20" />
            Select an entity in the graph to view its detailed profile.
          </div>
        )}
      </Drawer>

      {/* Edge Details Drawer */}
      <Drawer isOpen={activeDrawer === 'edge'} onClose={() => {setActiveDrawer(null); setSelectedEdge(null);}} title={<><Share2 className="w-4 h-4"/> Relationship Profile</>} width="w-96">
        {selectedEdge ? (
          <div className="flex flex-col h-full">
            <div className="p-6 bg-card border-b border-border shadow-sm relative z-10">
              <div className="flex items-center justify-between mb-5">
                 <h2 className="text-xl font-black text-foreground uppercase tracking-wider">{selectedEdge.label}</h2>
                 <span className="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20">RELATIONSHIP</span>
              </div>
              <div className="flex items-center justify-between bg-secondary/30 p-4 rounded-xl border border-border shadow-inner">
                <div className="text-center w-[42%] overflow-hidden">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Source Node</div>
                  <div className="text-sm font-bold text-foreground truncate" title={selectedEdge.source}>{selectedEdge.source}</div>
                </div>
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <ArrowRight className="w-4 h-4 text-primary" />
                </div>
                <div className="text-center w-[42%] overflow-hidden">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Target Node</div>
                  <div className="text-sm font-bold text-foreground truncate" title={selectedEdge.target}>{selectedEdge.target}</div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" /> Evidence & Context
                </h4>
                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                  {Object.entries(selectedEdge.properties || {}).length > 0 ? (
                    Object.entries(selectedEdge.properties).map(([k, v]: any, idx) => (
                      <div key={k} className={cn("flex flex-col p-3.5 text-sm hover:bg-secondary/40 transition-colors", idx !== 0 && "border-t border-border")}>
                        <span className="text-xs text-muted-foreground capitalize mb-1">{k.replace(/_/g, ' ')}</span>
                        <span className="text-foreground font-semibold break-words">{String(v)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-sm text-muted-foreground text-center">No metadata logged for this relationship.</div>
                  )}
                </div>
              </div>
              
              <div className="pt-2 space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</h4>
                <button className="w-full py-3 px-3 bg-secondary text-foreground text-sm font-semibold rounded-lg hover:bg-secondary/80 transition-colors border border-border flex items-center justify-center gap-2 shadow-sm">
                  <FileText className="w-4 h-4" /> View Raw Source Record
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-sm text-muted-foreground text-center flex flex-col items-center mt-20">
            <Share2 className="w-10 h-10 mb-4 opacity-20" />
            Select a relationship arrow to view its evidence details.
          </div>
        )}
      </Drawer>

    </div>
  );
}
'''

with open('src/components/GraphTopologyViewer.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

