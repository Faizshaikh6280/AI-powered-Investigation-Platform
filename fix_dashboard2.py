import re

with open('frontend/src/components/InvestigationDashboard.tsx', 'r') as f:
    content = f.read()

new_logic = """
  useEffect(() => {
    // Fetch full graph initially, or subgraph if community selected
    const url = selectedCommunity 
      ? `/api/v1/investigation/community/${selectedCommunity}/extract`
      : '/api/graph/topology';
      
    apiClient.request(url)
      .then(res => {
        setGraphData(res);
        
        let elements = [];
        if (selectedCommunity) {
          elements = [
            ...res.nodes.map((n: any) => ({ data: { id: n.id, label: n.label, role: n.role, pagerank: n.pagerank, betweenness: n.betweenness } })),
            ...res.edges.map((e: any) => ({ data: { source: e.source, target: e.target, label: e.type } }))
          ];
        } else {
          // Full graph topology mapping
          elements = [
            ...res.nodes.map((n: any) => ({ data: { id: n.id, label: n.primary_name || n.id, role: 'member', pagerank: 1, betweenness: 0 } })),
            ...res.edges.map((e: any) => ({ data: { source: e.source, target: e.target, label: e.type } }))
          ];
        }
        
        if (cyInstance.current) {
            cyInstance.current.destroy();
        }
        
        cyInstance.current = cytoscape({
          container: cyRef.current,
          elements: elements,
          style: [
            {
              selector: 'node',
              style: {
                'label': 'data(label)',
                'color': theme === 'light' ? '#334155' : '#fff',
                'font-size': '10px',
                'text-valign': 'bottom',
                'text-halign': 'center',
                'background-color': (ele: any) => {
                  const role = ele.data('role');
                  if (role === 'boss') return '#ef4444'; 
                  if (role === 'broker') return '#f59e0b'; 
                  return '#10b981'; 
                },
                'width': (ele: any) => Math.max(20, (ele.data('pagerank') || 1) * 10),
                'height': (ele: any) => Math.max(20, (ele.data('pagerank') || 1) * 10),
                'border-width': (ele: any) => (ele.data('betweenness') || 0) > 150 ? 4 : 0,
                'border-color': '#f59e0b',
                'border-style': 'solid'
              }
            },
            {
              selector: 'edge',
              style: {
                'width': 1,
                'line-color': theme === 'light' ? '#cbd5e1' : '#334155',
                'curve-style': 'bezier',
                'target-arrow-shape': 'triangle',
                'target-arrow-color': theme === 'light' ? '#cbd5e1' : '#334155',
                'label': 'data(label)',
                'font-size': '8px',
                'color': theme === 'light' ? '#64748b' : '#64748b',
                'text-rotation': 'autorotate'
              }
            }
          ],
          layout: {
            name: 'cose',
            idealEdgeLength: 100,
            nodeOverlap: 20,
            refresh: 20,
            fit: true,
            padding: 30,
            randomize: false,
            componentSpacing: 100,
            nodeRepulsion: 400000,
            edgeElasticity: 100,
            nestingFactor: 5,
            gravity: 80,
            numIter: 1000,
            initialTemp: 200,
            coolingFactor: 0.95,
            minTemp: 1.0
          }
        });
      })
      .catch(err => console.error('Failed to extract subgraph', err));
  }, [selectedCommunity, theme]);
"""

# The chunk we want to replace
start_match = "useEffect(() => {\n    if (!selectedCommunity) return;"
start_idx = content.find(start_match)
end_idx = content.find("const runSynthesis = () => {")

if start_idx != -1 and end_idx != -1:
    new_content = content[:start_idx] + new_logic + "\n  " + content[end_idx:]
    with open('frontend/src/components/InvestigationDashboard.tsx', 'w') as f:
        f.write(new_content)
    print("Fixed dashboard logic")
else:
    print("Could not find boundaries")
