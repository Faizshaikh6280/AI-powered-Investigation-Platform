'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, Download, Search, Filter, RefreshCw, 
  Calendar, CheckCircle2, AlertTriangle, ShieldAlert, X, Eye, Loader2
} from 'lucide-react';
import { apiClient, AuditLogEntry } from '../services/apiClient';

export default function AuditTrailLogs() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [actorSearch, setActorSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [caseFilter, setCaseFilter] = useState('');
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  // Detail Drawer
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getAuditLogs({
        actor: actorSearch || undefined,
        action: actionFilter || undefined,
        result: resultFilter || undefined,
        case_id: caseFilter || undefined,
        limit,
        offset
      });
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.warn('Could not fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [actorSearch, actionFilter, resultFilter, caseFilter, limit, offset]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const blob = await apiClient.exportAuditLogs('csv');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TRACE_Audit_Trail_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const getActionBadgeColor = (action: string, result: string) => {
    if (result === 'DENIED' || result === 'FAILED') return 'bg-destructive/15 text-destructive border-destructive/30';
    if (action.includes('LOGIN') || action.includes('MFA')) return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    if (action.includes('EVIDENCE')) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    if (action.includes('CASE')) return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    if (action.includes('FINDING') || action.includes('REPORT')) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    return 'bg-secondary text-foreground border-border';
  };

  return (
    <div className="flex flex-col h-full bg-background p-6 md:p-8 max-w-7xl mx-auto w-full overflow-hidden relative">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-border pb-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2 font-mono">
            <ShieldCheck className="w-6 h-6 text-primary" />
            STATUTORY AUDIT TRAIL
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Append-only, cryptographically verifiable ledger tracking evidence custody, data access, and officer operations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-2 text-muted-foreground hover:text-foreground bg-secondary rounded-lg border border-border transition-colors"
            title="Refresh Logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export Certified Ledger (CSV)
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3 bg-card border border-border rounded-xl mb-4 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" />
            <input
              type="text"
              value={actorSearch}
              onChange={(e) => setActorSearch(e.target.value)}
              placeholder="Search actor email / ID..."
              className="w-full bg-secondary/50 border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full bg-secondary/50 border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Action Types</option>
              <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
              <option value="LOGIN_FAILURE">LOGIN_FAILURE</option>
              <option value="MFA_SUCCESS">MFA_SUCCESS</option>
              <option value="CASE_VIEWED">CASE_VIEWED</option>
              <option value="CASE_CREATED">CASE_CREATED</option>
              <option value="EVIDENCE_VIEWED">EVIDENCE_VIEWED</option>
              <option value="EVIDENCE_UPLOADED">EVIDENCE_UPLOADED</option>
              <option value="FINDING_APPROVED">FINDING_APPROVED</option>
              <option value="REPORT_EXPORTED">REPORT_EXPORTED</option>
              <option value="POLICY_DENIED">POLICY_DENIED</option>
              <option value="AUDIT_EXPORTED">AUDIT_EXPORTED</option>
            </select>
          </div>

          <div>
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className="w-full bg-secondary/50 border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Verification Results</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="DENIED">DENIED (Security Policy)</option>
              <option value="FAILED">FAILED (Authentication)</option>
            </select>
          </div>

          <div>
            <input
              type="text"
              value={caseFilter}
              onChange={(e) => setCaseFilter(e.target.value)}
              placeholder="Filter by Case Reference..."
              className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="flex-1 bg-card border border-border rounded-xl overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse font-sans text-xs">
            <thead className="bg-secondary/60 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider font-mono sticky top-0 z-10 backdrop-blur-md">
              <tr>
                <th className="p-3">Audit ID & Timestamp</th>
                <th className="p-3">Actor / Officer</th>
                <th className="p-3">Action</th>
                <th className="p-3">Target / Scope</th>
                <th className="p-3">Outcome</th>
                <th className="p-3">Client IP</th>
                <th className="p-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-foreground font-mono">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground text-xs font-sans">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    Querying audit ledger...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground text-xs font-sans">
                    No matching audit records found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr 
                    key={log.id} 
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-secondary/30 transition-colors cursor-pointer"
                  >
                    <td className="p-3">
                      <div className="font-bold text-foreground text-[11px]">{log.audit_id}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="text-foreground font-semibold truncate max-w-[160px]">{log.actor}</div>
                      {log.role && (
                        <div className="text-[10px] text-muted-foreground">{log.role}</div>
                      )}
                    </td>

                    <td className="p-3">
                      <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold ${getActionBadgeColor(log.action, log.result)}`}>
                        {log.action}
                      </span>
                    </td>

                    <td className="p-3 text-muted-foreground truncate max-w-[140px]">
                      {log.case_id || log.resource_type || '—'}
                    </td>

                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                        log.result === 'SUCCESS' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-destructive/10 text-destructive border-destructive/20'
                      }`}>
                        {log.result === 'SUCCESS' ? <CheckCircle2 className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                        {log.result}
                      </span>
                    </td>

                    <td className="p-3 text-muted-foreground text-[11px]">
                      {log.ip_address || '127.0.0.1'}
                    </td>

                    <td className="p-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                        className="p-1 text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="px-4 py-2 border-t border-border bg-secondary/30 flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing {logs.length} of {total} total audited events</span>
          <div className="flex gap-2">
            <button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              className="px-2.5 py-1 bg-secondary rounded border border-border disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={offset + limit >= total}
              onClick={() => setOffset(offset + limit)}
              className="px-2.5 py-1 bg-secondary rounded border border-border disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Log Detail Modal / Drawer */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedLog(null)}>
          <div className="relative w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-foreground font-mono">Event {selectedLog.audit_id}</h3>
              </div>
              <button onClick={() => setSelectedLog(null)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs max-h-[65vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-2 bg-secondary/30 p-3 rounded-lg border border-border">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Timestamp</span>
                  <span className="text-foreground">{selectedLog.timestamp}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Action</span>
                  <span className="text-primary font-bold">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Actor</span>
                  <span className="text-foreground">{selectedLog.actor}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Result</span>
                  <span className={selectedLog.result === 'SUCCESS' ? 'text-emerald-400' : 'text-destructive'}>
                    {selectedLog.result}
                  </span>
                </div>
                {selectedLog.case_id && (
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase block">Case Reference</span>
                    <span className="text-foreground">{selectedLog.case_id}</span>
                  </div>
                )}
                {selectedLog.ip_address && (
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase block">IP Address</span>
                    <span className="text-foreground">{selectedLog.ip_address}</span>
                  </div>
                )}
                {selectedLog.correlation_id && (
                  <div className="col-span-2">
                    <span className="text-[10px] text-muted-foreground uppercase block">Correlation ID</span>
                    <span className="text-muted-foreground break-all">{selectedLog.correlation_id}</span>
                  </div>
                )}
                {selectedLog.reason && (
                  <div className="col-span-2">
                    <span className="text-[10px] text-muted-foreground uppercase block">Policy Reason</span>
                    <span className="text-amber-400">{selectedLog.reason}</span>
                  </div>
                )}
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground uppercase block mb-1">Sanitized Event Metadata (JSON)</span>
                <pre className="p-3 bg-secondary/50 rounded-lg border border-border overflow-x-auto text-[11px] text-foreground">
                  {JSON.stringify(selectedLog.details || {}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
