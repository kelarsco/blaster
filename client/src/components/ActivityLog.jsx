import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/SupabaseAuthContext';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function typeLabel(type) {
  const labels = {
    scan_start: 'Scan started',
    scan_complete: 'Scan completed',
    campaign_start: 'Campaign started',
    sender_add: 'Sender added',
    sender_remove: 'Sender removed',
    sender_group_add: 'Sender group added',
    sender_group_remove: 'Sender group removed',
    export_excel: 'Data exported',
    preset_save: 'Preset saved',
  };
  return labels[type] || type;
}

function payloadSummary(type, payload) {
  if (!payload || typeof payload !== 'object') return '';
  const p = payload;
  switch (type) {
    case 'scan_start':
    case 'scan_complete':
      if (p.totalUrls != null) return `${p.totalUrls} store${p.totalUrls === 1 ? '' : 's'} scanned`;
      break;
    case 'campaign_start':
      if (p.totalQueued != null) return `${p.totalQueued} recipient${p.totalQueued === 1 ? '' : 's'} in queue`;
      break;
    case 'sender_add':
      if (p.email) return p.email;
      break;
    case 'sender_group_add':
    case 'preset_save':
      if (p.name) return p.name;
      break;
    case 'export_excel':
      return 'Results exported to Excel';
    default:
      return '';
  }
  return '';
}

function typeColor(type) {
  if (type?.includes('scan')) return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200';
  if (type?.includes('campaign')) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  if (type?.includes('sender')) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
}

export function ActivityLog({ onClose }) {
  const auth = useAuth();
  const authFetch = auth?.authFetch;
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (!authFetch) return;
    authFetch(`${API}/activity/logs?limit=100`)
      .then((r) => r.json())
      .then((d) => setLogs(d.logs || []));
  }, [authFetch]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Activity Log</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 dark:hover:text-slate-200">
            ✕
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto p-4 space-y-3">
          {logs.length === 0 ? (
            <li className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">No activity yet.</li>
          ) : (
            logs.map((log) => (
              <li
                key={log.id}
                className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/80 p-3 text-sm"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`shrink-0 px-2 py-0.5 rounded-md text-xs font-medium ${typeColor(log.type)}`}>
                    {typeLabel(log.type)}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-xs">{formatDate(log.createdAt)}</span>
                </div>
                {payloadSummary(log.type, log.payload) && (
                  <p className="mt-2 text-slate-600 dark:text-slate-300 text-sm">{payloadSummary(log.type, log.payload)}</p>
                )}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
