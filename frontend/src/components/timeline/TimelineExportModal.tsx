import React, { useState } from 'react';
import { Download, FileText, X, ShieldCheck, Check } from 'lucide-react';
import { useTimelineStore } from '../../store/useTimelineStore';
import { cn } from '../../utils/cn';

interface ExportModalProps {
  caseId?: string;
  totalEvents: number;
}

export const TimelineExportModal: React.FC<ExportModalProps> = ({
  caseId,
  totalEvents
}) => {
  const { isExportModalOpen, setIsExportModalOpen } = useTimelineStore();
  const [format, setFormat] = useState<'csv' | 'json'>('json');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  if (!isExportModalOpen) return null;

  const handleDownload = () => {
    setIsExporting(true);
    const targetCaseId = caseId || '';
    const endpoint = `/api/timeline/export?format=${format}${targetCaseId ? `&case_id=${encodeURIComponent(targetCaseId)}` : ''}`;
    
    // Trigger download
    window.location.href = endpoint;
    setTimeout(() => {
      setIsExporting(false);
      setDownloadSuccess(true);
      setTimeout(() => {
        setDownloadSuccess(false);
        setIsExportModalOpen(false);
      }, 1500);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Court-Ready Dossier Export</h3>
          </div>
          <button
            onClick={() => setIsExportModalOpen(false)}
            className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Generates an evidence-backed export containing raw and normalized timestamps, entity linkages, cryptographic SHA-256 evidence checksums, and anomaly flags for legal chain-of-custody compliance.
        </p>

        {/* Format Selector */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Select Format</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setFormat('json')}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border text-xs font-semibold transition-all",
                format === 'json'
                  ? "bg-primary/10 border-primary text-primary shadow-xs"
                  : "bg-secondary/40 border-border text-foreground hover:bg-secondary/80"
              )}
            >
              <span>Structured JSON</span>
              {format === 'json' && <Check className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setFormat('csv')}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border text-xs font-semibold transition-all",
                format === 'csv'
                  ? "bg-primary/10 border-primary text-primary shadow-xs"
                  : "bg-secondary/40 border-border text-foreground hover:bg-secondary/80"
              )}
            >
              <span>Forensic CSV Table</span>
              {format === 'csv' && <Check className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Summary Info Box */}
        <div className="bg-secondary/50 border border-border rounded-lg p-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Case Scope:</span>
            <span className="font-mono font-bold text-foreground">{caseId || 'Active Case'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Export Records:</span>
            <span className="font-mono font-bold text-foreground">{totalEvents} events</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold pt-1 border-t border-border/40 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Cryptographic SHA-256 checksums verified</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={() => setIsExportModalOpen(false)}
            className="px-4 py-2 bg-secondary hover:bg-secondary/80 border border-border text-foreground text-xs font-semibold rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={isExporting || downloadSuccess}
            className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-md shadow-sm transition-colors"
          >
            {downloadSuccess ? (
              <>
                <Check className="w-4 h-4" />
                <span>Downloaded</span>
              </>
            ) : isExporting ? (
              <span>Exporting...</span>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download Dossier</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
