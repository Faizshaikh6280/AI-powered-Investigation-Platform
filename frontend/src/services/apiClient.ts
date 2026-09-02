/**
 * Centralized API Client for Cyber Investigation & Intelligence Platform
 * Purely backend-driven: Zero mock data.
 */

const API_BASE = '';

export interface Case {
  case_id: string;
  case_reference: string;
  title: string;
  description?: string;
  status: string;
  created_at: string;
  created_by: string;
}

export interface CaseCreatePayload {
  title: string;
  description?: string;
  case_reference?: string;
  created_by?: string;
}

export interface EvidenceItem {
  evidence_id: string;
  filename: string;
  source_type: string;
  confidence: number;
  status: string;
  records: number;
  quality_score: number;
  sha256: string;
}

export interface CaseDetail extends Case {
  evidence_count: number;
  evidence: EvidenceItem[];
}

export interface GoldenProfile {
  z_cluster_id: string;
  primary_name: string;
  known_aliases: string[];
  known_phones: string[];
  known_accounts: string[];
  social_handles: Array<{ handle: string; platform: string }>;
  risk_score: number;
  source_records?: number;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  riskScore?: number;
  color?: string;
  properties?: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label: string;
  properties?: Record<string, any>;
}

export interface GraphTopology {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface TimelineEventItem {
  id: string;
  time_ms: number;
  domain: string;
  event_type: string;
  identity?: { phone?: string; name?: string; social_handle?: string };
  financial?: { account_number?: string; amount_inr?: number; txn_type?: string };
  telemetry?: { client_ip?: string; tower_address?: string; destination_ip?: string; lat?: number; lng?: number };
}

export interface GeospatialWaypoint {
  cluster_id: string;
  path: number[][];
  timestamps: number[];
}

export interface GeoSyncData {
  timeline: TimelineEventItem[];
  waypoints: GeospatialWaypoint[];
}

export interface AnomalyStats {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface DetectorEngineMeta {
  detector_id: string;
  name: string;
  type: string;
  domain: string;
  version: string;
  applicable_domains: string[];
  description: string;
}

export interface DetectorHealthResponse {
  status: string;
  total_detectors: number;
  engines: DetectorEngineMeta[];
}

export interface AnomalyFinding {
  id: string;
  entityId: string;
  entityType: string;
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
  confidence?: number;
  investigativePriority?: string;
  domain?: string;
  title?: string;
  status: string;
  reasons: string[];
  contributingDetectors?: string[];
  metrics: Record<string, any>;
  evidence_refs?: string[];
  canonical_event_refs?: string[];
  detectedAt?: string;
}

export interface AnomalyRunResult {
  status: string;
  run_id: string;
  case_id: string;
  summary: {
    total_entities_analyzed: number;
    total_findings: number;
    critical_count: number;
    high_count: number;
    medium_count: number;
    low_count: number;
    duration_seconds: number;
  };
  detectors_executed: string[];
  detectors_failed: string[];
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorDetail = res.statusText;
    try {
      const errJson = await res.json();
      errorDetail = errJson.detail || errJson.message || JSON.stringify(errJson);
    } catch {
      // Keep default statusText
    }
    throw new Error(`API Error (${res.status}): ${errorDetail}`);
  }
  return res.json();
}

export const apiClient = {
  // === CASES & EVIDENCE ===
  async listCases(): Promise<Case[]> {
    const res = await fetch(`${API_BASE}/api/cases`);
    return handleResponse<Case[]>(res);
  },

  async getCaseDetails(caseId: string): Promise<CaseDetail> {
    const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}`);
    return handleResponse<CaseDetail>(res);
  },

  async createCase(payload: CaseCreatePayload): Promise<Case> {
    const res = await fetch(`${API_BASE}/api/cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<Case>(res);
  },

  async uploadEvidenceFile(caseId: string, file: File, notes?: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    if (notes) formData.append('notes', notes);

    const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}/evidence`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse<any>(res);
  },

  // === INGESTION & PIPELINE ===
  async triggerAllIngestion(): Promise<any> {
    const res = await fetch(`${API_BASE}/api/ingest/trigger_all`, {
      method: 'POST',
    });
    return handleResponse<any>(res);
  },

  async getIngestedEvents(caseId?: string, limit: number = 20): Promise<any[]> {
    const url = caseId 
      ? `${API_BASE}/api/ingest/events?case_id=${encodeURIComponent(caseId)}&limit=${limit}`
      : `${API_BASE}/api/ingest/events?limit=${limit}`;
    const res = await fetch(url);
    return handleResponse<any[]>(res);
  },

  // === ENTITY RESOLUTION ===
  async executeZinggER(): Promise<any> {
    const res = await fetch(`${API_BASE}/api/zingg/execute`, {
      method: 'POST',
    });
    return handleResponse<any>(res);
  },

  async getGoldenProfiles(): Promise<GoldenProfile[]> {
    const res = await fetch(`${API_BASE}/api/system/golden_profiles`);
    return handleResponse<GoldenProfile[]>(res);
  },

  // === GRAPH TOPOLOGY ===
  async syncGraph(): Promise<any> {
    const res = await fetch(`${API_BASE}/api/graph/sync`, {
      method: 'POST',
    });
    return handleResponse<any>(res);
  },

  async getGraphTopology(): Promise<GraphTopology> {
    const res = await fetch(`${API_BASE}/api/graph/topology`);
    return handleResponse<GraphTopology>(res);
  },

  // === TIMELINE & GEOSPATIAL ===
  async getGeoSyncData(): Promise<GeoSyncData> {
    const res = await fetch(`${API_BASE}/api/geo/sync-data`);
    return handleResponse<GeoSyncData>(res);
  },

  // === ANOMALY INTELLIGENCE ===
  async getDetectorHealth(): Promise<DetectorHealthResponse> {
    const res = await fetch(`${API_BASE}/api/anomalies/health`);
    return handleResponse<DetectorHealthResponse>(res);
  },

  async getAnomalyStats(): Promise<AnomalyStats> {
    const res = await fetch(`${API_BASE}/api/anomalies/stats`);
    return handleResponse<AnomalyStats>(res);
  },

  async getAnomalies(params?: { search?: string; limit?: number; caseId?: string }): Promise<{ anomalies: AnomalyFinding[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.caseId) query.append('case_id', params.caseId);

    const url = `${API_BASE}/api/anomalies${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await fetch(url);
    return handleResponse<{ anomalies: AnomalyFinding[]; total: number }>(res);
  },

  async getAnomalyById(findingId: string): Promise<AnomalyFinding> {
    const res = await fetch(`${API_BASE}/api/anomalies/${encodeURIComponent(findingId)}`);
    return handleResponse<AnomalyFinding>(res);
  },

  async runAnomalyAnalysis(caseId?: string): Promise<{ message: string; result: AnomalyRunResult }> {
    const url = caseId 
      ? `${API_BASE}/api/anomalies/analyze?case_id=${encodeURIComponent(caseId)}&sync=true`
      : `${API_BASE}/api/anomalies/analyze?sync=true`;
    const res = await fetch(url, { method: 'POST' });
    return handleResponse<{ message: string; result: AnomalyRunResult }>(res);
  },

  // === SYSTEM RESET ===
  async resetSystem(): Promise<any> {
    const res = await fetch(`${API_BASE}/api/system/reset`, { method: 'POST' });
    return handleResponse<any>(res);
  }
};
