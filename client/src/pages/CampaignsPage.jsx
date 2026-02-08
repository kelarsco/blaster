import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useToolState } from '../context/ToolStateContext';
import { useAuth } from '../context/AuthContext';
import { AutomationModal } from '../components/AutomationModal';
import { RecipientSourceModal } from '../components/RecipientSourceModal';
import { ExecutionDashboard } from '../components/ExecutionDashboard';
import { API } from '../api.js';

const EMAIL_LISTS_KEY = 'storereach-email-lists';

function loadEmailLists() {
  try {
    const raw = localStorage.getItem(EMAIL_LISTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function recipientsFromResults(results) {
  if (!results || !Array.isArray(results)) return [];
  return results.flatMap((s) =>
    (s.emails || []).map((e) => ({ storeUrl: s.storeUrl || s.store_url || '', email: e.email }))
  );
}

function DotsIcon({ className }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
    </svg>
  );
}

export function CampaignsPage() {
  const auth = useAuth();
  const authFetch = auth?.authFetch;
  const { scanId, results, setScanId, setResults, setScanStatus, automationOpen, setAutomationOpen, activeCampaignId, setActiveCampaignId } = useToolState();
  const [campaigns, setCampaigns] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [recipientSourceOpen, setRecipientSourceOpen] = useState(false);
  const [csvRecipients, setCsvRecipients] = useState([]);
  const [emailLists, setEmailLists] = useState(loadEmailLists);
  const [expandedListId, setExpandedListId] = useState(null);
  const [saveListName, setSaveListName] = useState('');
  const [savingList, setSavingList] = useState(false);
  const menuRef = useRef(null);

  const scannedRecipients = recipientsFromResults(results);
  const scannedEmailCount = scannedRecipients.length;

  useEffect(() => {
    try {
      localStorage.setItem(EMAIL_LISTS_KEY, JSON.stringify(emailLists));
    } catch (_) {}
  }, [emailLists]);

  const saveCurrentScanAsList = () => {
    const name = (saveListName || `Scan ${new Date().toLocaleDateString()}`).trim();
    if (!name || scannedRecipients.length === 0) return;
    setSavingList(true);
    setEmailLists((prev) => [
      ...prev,
      {
        id: `list-${Date.now()}`,
        name,
        createdAt: new Date().toISOString(),
        recipients: [...scannedRecipients],
      },
    ]);
    setSaveListName('');
    setSavingList(false);
  };

  const removeEmailList = (id) => {
    setEmailLists((prev) => prev.filter((l) => l.id !== id));
    if (expandedListId === id) setExpandedListId(null);
  };

  const fetchCampaigns = useCallback(() => {
    if (!authFetch) return;
    authFetch(`${API}/campaigns`).then((r) => (r.ok ? r.json() : { campaigns: [] })).then((d) => setCampaigns(d.campaigns || []));
  }, [authFetch]);

  useEffect(() => {
    fetchCampaigns();
  }, [activeCampaignId, fetchCampaigns]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = (e) => {
    e?.preventDefault();
    if (selectedIds.size === campaigns.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(campaigns.map((c) => c.id)));
    if (typeof window !== 'undefined' && window.getSelection) window.getSelection().removeAllRanges();
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0 || !authFetch) return;
    setDeleting(true);
    try {
      const res = await authFetch(`${API}/campaigns/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selectedIds] }),
      });
      if (res.ok) {
        if (activeCampaignId && selectedIds.has(activeCampaignId)) setActiveCampaignId(null);
        fetchCampaigns();
        exitSelectionMode();
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4 mb-4 md:mb-6">
        <div>
          <h1 className="page-title-mobile">Campaigns</h1>
          <p className="text-xs md:text-sm text-blaster-muted mt-0.5">Manage your email outreach campaigns</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRecipientSourceOpen(true)}
            className="inline-flex items-center gap-2 btn-blaster-accent shrink-0"
          >
            + New Campaign
          </button>
        </div>
      </div>

      <section className="mb-6 md:mb-8">
        <h2 className="card-title-mobile mb-2 md:mb-3">Email lists</h2>
        <p className="text-xs md:text-sm text-blaster-muted mb-2 md:mb-3">Saved lists you can use for campaigns. Click a list to see emails.</p>
        {scannedEmailCount > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-xl border border-blaster-border bg-blaster-bg px-3 py-2">
              <span className="text-sm font-medium text-blaster-fg">Current scan: {scannedEmailCount} email{scannedEmailCount !== 1 ? 's' : ''}</span>
              <input
                type="text"
                value={saveListName}
                onChange={(e) => setSaveListName(e.target.value)}
                placeholder="List name (optional)"
                className="w-40 px-2 py-1 text-sm rounded-lg border border-blaster-border bg-blaster-bg-card text-blaster-fg placeholder-blaster-muted"
              />
              <button
                type="button"
                onClick={saveCurrentScanAsList}
                disabled={savingList}
                className="text-sm btn-blaster-accent py-1 px-3 disabled:opacity-50"
              >
                Save as list
              </button>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          {emailLists.length === 0 && scannedEmailCount === 0 && (
            <p className="text-sm text-blaster-muted">No saved lists. Run a scan and save it, or upload a CSV when creating a campaign.</p>
          )}
          {emailLists.map((list) => (
            <div
              key={list.id}
              className="rounded-xl border border-blaster-border bg-blaster-bg-card overflow-hidden shadow-sm min-w-[140px] max-w-[200px]"
            >
              <button
                type="button"
                onClick={() => setExpandedListId((id) => (id === list.id ? null : list.id))}
                className="w-full p-4 text-left hover:bg-blaster-bg-app/50 transition"
              >
                <div className="font-medium text-blaster-fg truncate text-sm" title={list.name}>{list.name}</div>
                <div className="text-lg font-semibold text-blaster-accent mt-1">{list.recipients?.length ?? 0}</div>
                <div className="text-xs text-blaster-muted">emails</div>
              </button>
              {expandedListId === list.id && (
                <div className="border-t border-blaster-border p-3 max-h-48 overflow-y-auto bg-blaster-bg/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-blaster-muted">Emails in this list</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeEmailList(list.id); }}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete list
                    </button>
                  </div>
                  <ul className="text-xs text-blaster-fg space-y-1">
                    {(list.recipients || []).slice(0, 50).map((r, i) => (
                      <li key={i} className="truncate" title={r.email}>{r.email}</li>
                    ))}
                    {(list.recipients?.length || 0) > 50 && (
                      <li className="text-blaster-muted">+ {(list.recipients?.length || 0) - 50} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {campaigns.length === 0 ? (
        <div className="bg-blaster-bg-card rounded-xl border border-blaster-border p-12 text-center">
          <h2 className="text-base md:text-xl font-semibold text-blaster-fg">No campaigns yet</h2>
          <p className="text-blaster-muted mt-2">Run a scan, then start a campaign to send emails to extracted addresses.</p>
          <button
            type="button"
            onClick={() => setRecipientSourceOpen(true)}
            className="mt-6 btn-blaster-accent"
          >
            Create Your First Campaign
          </button>
        </div>
      ) : (
        <>
          {selectionMode && (
            <div className="flex flex-wrap items-center gap-2 mb-3 px-1">
              <button
                type="button"
                onClick={selectAll}
                className="text-sm text-blaster-accent hover:underline select-none"
              >
                {selectedIds.size === campaigns.length ? 'Deselect all' : 'Select all'}
              </button>
              <span className="text-sm text-blaster-muted">
                {selectedIds.size} selected
              </span>
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={deleteSelected}
                  disabled={deleting}
                  className="text-sm text-red-600 hover:underline disabled:opacity-50"
                >
                  {deleting ? 'Deleting…' : 'Delete selected'}
                </button>
              )}
              <button
                type="button"
                onClick={exitSelectionMode}
                className="text-sm text-blaster-muted hover:text-blaster-fg"
              >
                Done
              </button>
            </div>
          )}
          <div className="bg-blaster-bg-card rounded-xl border border-blaster-border overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-blaster-border">
              <h2 className="text-base font-semibold text-blaster-fg">Campaign list</h2>
              <div className="relative shrink-0" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  className="p-2 rounded-lg text-blaster-muted hover:text-blaster-fg hover:bg-blaster-border/50 transition"
                  aria-label="Options"
                >
                  <DotsIcon className="w-5 h-5" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 py-1 min-w-[160px] bg-blaster-bg-card border border-blaster-border rounded-lg shadow-lg z-10">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectionMode(true);
                        setMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-blaster-fg hover:bg-blaster-bg-app"
                    >
                      Select campaigns
                    </button>
                  </div>
                )}
              </div>
            </div>
            <ul className="divide-y divide-blaster-border">
              {campaigns.map((c) => (
                <li key={c.id}>
                  <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 hover:bg-blaster-bg/50">
                    <div className="flex items-center gap-3 min-w-0">
                      {selectionMode && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleSelect(c.id)}
                          className="rounded border-blaster-border text-blaster-accent focus:ring-blaster-accent shrink-0"
                        />
                      )}
                      <div>
                        <span className="font-medium text-blaster-fg">{c.sent} / {c.totalQueued} sent</span>
                        <span className="ml-3 text-sm text-blaster-muted capitalize">
                          {c.status === 'running' && c.sent >= (c.totalQueued || 0) ? 'completed' : c.status}
                        </span>
                      </div>
                    </div>
                    {!selectionMode && (
                      <button
                        type="button"
                        onClick={() => setActiveCampaignId(activeCampaignId === c.id ? null : c.id)}
                        className="text-sm text-blaster-accent hover:underline shrink-0"
                      >
                        {activeCampaignId === c.id ? 'Hide' : 'View'}
                      </button>
                    )}
                  </div>
                  {activeCampaignId === c.id && (
                    <div className="px-4 pb-4 pt-0">
                      <ExecutionDashboard campaignId={c.id} onClose={() => setActiveCampaignId(null)} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {recipientSourceOpen && (
        <RecipientSourceModal
          scannedCount={scannedEmailCount}
          emailLists={emailLists}
          onClose={() => setRecipientSourceOpen(false)}
          onContinueScanned={() => {
            setRecipientSourceOpen(false);
            setCsvRecipients([]);
            setAutomationOpen(true);
          }}
          onContinueCsv={(recipients) => {
            setRecipientSourceOpen(false);
            setCsvRecipients(recipients);
            setAutomationOpen(true);
          }}
          onContinueSavedLists={(recipients) => {
            setRecipientSourceOpen(false);
            setCsvRecipients(recipients);
            setAutomationOpen(true);
          }}
        />
      )}

      {automationOpen && (
        <AutomationModal
          scanId={csvRecipients.length > 0 ? null : scanId}
          results={csvRecipients.length > 0 ? [] : results}
          recipientsOverride={csvRecipients.length > 0 ? csvRecipients : undefined}
          onClose={() => {
            setAutomationOpen(false);
            setCsvRecipients([]);
          }}
          onCampaignStart={(campaignId) => {
            setAutomationOpen(false);
            setCsvRecipients([]);
            setActiveCampaignId(campaignId);
            if (csvRecipients.length === 0) {
              setScanId(null);
              setResults([]);
              setScanStatus(null);
            }
            // Refresh the Campaigns page so the Automation card closes and the new campaign is visible
            if (typeof window !== 'undefined') {
              window.location.reload();
            }
          }}
        />
      )}

    </div>
  );
}
