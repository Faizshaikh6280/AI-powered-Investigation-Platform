'use client';

import React from 'react';

const LOGS = [
  { time: '2026-08-14 20:10:05', user: 'SYSTEM', action: 'Deduplication engine resolved IP 192.168.1.10 to entity Tariq' },
  { time: '2026-08-14 20:05:12', user: 'ADMIN', action: 'Accessed Case OP-SHADOW-SYNDICATE-001' },
  { time: '2026-08-14 19:45:00', user: 'SYSTEM', action: 'Ingested 1,450 CDR records from Provider A' },
  { time: '2026-08-14 19:40:22', user: 'SYSTEM', action: 'Generated Alert ALT-991 (CRITICAL)' },
];

export default function AuditTrailLogs() {
  return (
    <div className="h-full flex flex-col">
      <h2 className="text-2xl font-bold text-white tracking-widest mb-6">SYSTEM AUDIT TRAIL</h2>
      
      <div className="flex-1 cyber-panel p-2 rounded-lg border border-gray-800 bg-panel overflow-hidden">
        <div className="h-full overflow-auto rounded bg-obsidian">
          <table className="w-full text-left border-collapse font-mono text-sm">
            <thead className="bg-gray-900 sticky top-0 z-10 border-b border-gray-700">
              <tr>
                <th className="p-3 text-gray-400 font-medium w-48">Timestamp</th>
                <th className="p-3 text-gray-400 font-medium w-32">User</th>
                <th className="p-3 text-gray-400 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 text-gray-300">
              {LOGS.map((log, i) => (
                <tr key={i} className="hover:bg-gray-800/50 transition-colors">
                  <td className="p-3 text-cyanNeon">{log.time}</td>
                  <td className="p-3 text-amberGold">{log.user}</td>
                  <td className="p-3">{log.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
