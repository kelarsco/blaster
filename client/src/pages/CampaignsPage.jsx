import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Clipboard } from 'react-feather';
import { useToolState } from '../context/ToolStateContext';
import { useAuth } from '../context/AuthContext';
import { usePlanAccess } from '../context/PlanAccessContext.jsx';
import { RecipientSourceModal } from '../components/RecipientSourceModal';
import { CampaignSetupSheet } from '../components/campaigns/CampaignSetupSheet.jsx';
import { CampaignNameModal } from '../components/scanner/CampaignNameModal.jsx';
import { ExecutionDashboard } from '../components/ExecutionDashboard';
import { API } from '../api.js';
import { createEmailList } from '../utils/createEmailList.js';
import { useConfirm } from '../context/ConfirmDialogContext.jsx';
import { readPageCache, writePageCache } from '../utils/pageCache.js';

const CAMPAIGNS_CACHE_KEY = 'campaigns';

function DotsIcon({ className }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
    </svg>
  );
}

function CheckIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function SavedCampaignTile({ list, onClick, onRemove, allMessaged }) {
  const clickTimer = useRef(null);
  const count = list.recipients?.length ?? 0;

  const handleClick = () => {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      onClick();
    }, 250);
  };

  const handleDoubleClick = (e) => {
    e.preventDefault();
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    onRemove?.();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      title="Click to open. Double-click to remove."
      className="group relative flex flex-col items-center justify-center aspect-square w-[148px] sm:w-[156px] rounded-2xl border border-blaster-border bg-white shadow-sm hover:shadow-md hover:border-blaster-accent/35 hover:-translate-y-0.5 transition-all duration-300 p-4"
    >
      <span className="absolute top-2.5 left-2.5 min-w-[1.5rem] px-1.5 py-0.5 rounded-full bg-gradient-to-r from-blaster-accent/20 to-blaster-orange/30 border border-blaster-accent/20 text-[10px] font-semibold text-blaster-fg">
        {count}
      </span>
      {allMessaged ? (
        <span
          className="absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-black"
          aria-label="All contacts messaged"
        >
          <CheckIcon className="w-3 h-3 text-white" />
        </span>
      ) : null}
      <span className="text-sm font-semibold text-blaster-fg text-center line-clamp-3 leading-snug px-1">
        {list.name}
      </span>
      <span className="text-[10px] text-blaster-muted mt-1">contacts</span>
    </button>
  );
}

export function CampaignsPage() {
  const auth = useAuth();
  const authFetch = auth?.authFetch;
  const userId = auth?.user?.id;
  const confirm = useConfirm();
  const location = useLocation();
  const { status, openUpgradeModal } = usePlanAccess();
  const { activeCampaignId, setActiveCampaignId } = useToolState();

  const cached = userId ? readPageCache(userId, CAMPAIGNS_CACHE_KEY) : null;
  const hadCacheRef = useRef(Boolean(cached));

  const [campaigns, setCampaigns] = useState(cached?.campaigns ?? []);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [recipientSourceOpen, setRecipientSourceOpen] = useState(false);
  const [pendingRecipients, setPendingRecipients] = useState(null);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [savingList, setSavingList] = useState(false);
  const [listCreateError, setListCreateError] = useState('');
  const [emailLists, setEmailLists] = useState(cached?.emailLists ?? []);
  const [viewingList, setViewingList] = useState(null);
  const [messagedEmails, setMessagedEmails] = useState(
    () => new Set(Array.isArray(cached?.messagedEmails) ? cached.messagedEmails : [])
  );
  const menuRef = useRef(null);

  const revalidateCampaigns = useCallback(async () => {
    if (!authFetch) return;
    try {
      const [listsRes, campaignsRes, messagedRes] = await Promise.all([
        authFetch(`${API}/email-lists`),
        authFetch(`${API}/campaigns`),
        authFetch(`${API}/campaigns/messaged-emails`),
      ]);
      let nextLists = [];
      let nextCampaigns = [];
      let nextMessaged = [];
      if (listsRes.ok) {
        const data = await listsRes.json().catch(() => ({}));
        nextLists = Array.isArray(data?.lists) ? data.lists : [];
        setEmailLists(nextLists);
      }
      if (campaignsRes.ok) {
        const data = await campaignsRes.json().catch(() => ({}));
        nextCampaigns = data.campaigns || [];
        setCampaigns(nextCampaigns);
      }
      if (messagedRes.ok) {
        const data = await messagedRes.json().catch(() => ({}));
        nextMessaged = Array.isArray(data?.emails) ? data.emails : [];
        setMessagedEmails(new Set(nextMessaged.map((e) => String(e).toLowerCase())));
      }
      if (userId) {
        writePageCache(userId, CAMPAIGNS_CACHE_KEY, {
          emailLists: nextLists,
          campaigns: nextCampaigns,
          messagedEmails: nextMessaged.map((e) => String(e).toLowerCase()),
        });
      }
      hadCacheRef.current = true;
    } catch (_) {}
  }, [authFetch, userId]);

  const fetchLists = useCallback(() => {
    revalidateCampaigns();
  }, [revalidateCampaigns]);

  const archiveList = useCallback(async (list) => {
    if (!authFetch || !list?.id) return;
    const ok = await confirm({
      title: 'Remove campaign',
      message: `Remove "${list.name}" from campaigns? Contact data is kept for analytics.`,
      confirmLabel: 'Remove',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const res = await authFetch(`${API}/email-lists/${list.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to remove campaign');
      }
      if (viewingList?.id === list.id) setViewingList(null);
      setEmailLists((prev) => prev.filter((item) => item.id !== list.id));
    } catch (e) {
      window.alert(e?.message || 'Failed to remove campaign');
    }
  }, [authFetch, confirm, viewingList?.id]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  useEffect(() => {
    const highlightId = location.state?.highlightListId;
    if (!highlightId || !emailLists.length) return;
    const found = emailLists.find((l) => l.id === highlightId);
    if (found) setViewingList(found);
    window.history.replaceState({}, document.title);
  }, [location.state, emailLists]);

  const fetchMessagedEmails = useCallback(() => {
    if (!authFetch) return;
    authFetch(`${API}/campaigns/messaged-emails`)
      .then((r) => (r.ok ? r.json() : { emails: [] }))
      .then((data) => {
        const set = new Set((Array.isArray(data?.emails) ? data.emails : []).map((e) => String(e).toLowerCase()));
        setMessagedEmails(set);
      })
      .catch(() => {});
  }, [authFetch]);

  useEffect(() => {
    fetchMessagedEmails();
  }, [fetchMessagedEmails, campaigns.length]);

  useEffect(() => {
    if (!viewingList) return undefined;
    fetchMessagedEmails();
    const intervalId = setInterval(fetchMessagedEmails, 5000);
    return () => clearInterval(intervalId);
  }, [viewingList, fetchMessagedEmails]);

  const fetchCampaigns = useCallback(() => {
    revalidateCampaigns();
  }, [revalidateCampaigns]);

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
    const ok = await confirm({
      title: 'Delete campaigns',
      message: `Delete ${selectedIds.size} selected campaign(s)? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
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

  const isMessaged = (email) => messagedEmails.has(String(email || '').toLowerCase());

  const tryNewCampaign = () => {
    if ((status?.campaignsActive ?? 0) >= (status?.campaignsActiveMax ?? 999999)) {
      openUpgradeModal({
        title: 'Campaign limit reached',
        message: 'Upgrade to run more active campaigns.',
        tierName: 'Basic',
        tierPrice: '$19/month',
      });
      return;
    }
    setRecipientSourceOpen(true);
  };

  const handleCsvReady = (recipients) => {
    setRecipientSourceOpen(false);
    setPendingRecipients(recipients);
    setListCreateError('');
    setNameModalOpen(true);
  };

  const handleOpenList = (list) => {
    setRecipientSourceOpen(false);
    setViewingList(list);
  };

  const handleCreateList = async (name) => {
    if (!authFetch || !pendingRecipients?.length) return;
    setSavingList(true);
    setListCreateError('');
    try {
      const list = await createEmailList(authFetch, { name, recipients: pendingRecipients });
      setEmailLists((prev) => [list, ...prev.filter((item) => item.id !== list.id)]);
      setPendingRecipients(null);
      setNameModalOpen(false);
      setViewingList(list);
      revalidateCampaigns();
    } catch (e) {
      setListCreateError(e?.message || 'Failed to save list');
    } finally {
      setSavingList(false);
    }
  };

  return (
    <div className="min-h-full bg-blaster-sidebar p-4 sm:p-6 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="page-title-mobile">Campaigns</h1>
          <p className="text-xs md:text-sm text-blaster-muted mt-0.5">Saved scan lists and outreach campaigns</p>
        </div>
        <button
          type="button"
          onClick={tryNewCampaign}
          className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 rounded-xl bg-black border border-blaster-orange text-[#faf8f5] text-sm font-medium shadow-blaster-cta hover:opacity-90 transition shrink-0"
        >
          + New Campaign
        </button>
      </div>

      <section className="mb-8 md:mb-10">
        {emailLists.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-blaster-border bg-white/60 py-14 px-6 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blaster-accent/10 to-blaster-orange/20 mb-3 mx-auto" aria-hidden>
              <Clipboard className="w-6 h-6 text-blaster-muted" strokeWidth={1.75} />
            </span>
            <p className="text-sm font-medium text-blaster-fg">No saved campaigns yet</p>
            <p className="text-xs text-blaster-muted mt-1 max-w-sm mx-auto">
              Complete a scan and use Move to Campaign on the Scanner page.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 justify-center sm:justify-start">
            {emailLists.map((list) => {
              const recipients = list.recipients || [];
              const allMessaged =
                recipients.length > 0 &&
                recipients.every((r) => messagedEmails.has(String(r.email || '').toLowerCase()));
              return (
                <SavedCampaignTile
                  key={list.id}
                  list={list}
                  allMessaged={allMessaged}
                  onClick={() => setViewingList(list)}
                  onRemove={() => archiveList(list)}
                />
              );
            })}
          </div>
        )}
      </section>

      {campaigns.length > 0 && (
        <section className="rounded-2xl border border-blaster-border bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-blaster-border">
            <h2 className="text-base font-semibold text-blaster-fg">Outreach history</h2>
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
                <div className="absolute right-0 top-full mt-1 py-1 min-w-[160px] bg-white border border-blaster-border rounded-lg shadow-lg z-10">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectionMode(true);
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-blaster-fg hover:bg-gray-50"
                  >
                    Select campaigns
                  </button>
                </div>
              )}
            </div>
          </div>
          {selectionMode && (
            <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-blaster-border bg-gray-50/80">
              <button type="button" onClick={selectAll} className="text-sm text-blaster-accent hover:underline">
                {selectedIds.size === campaigns.length ? 'Deselect all' : 'Select all'}
              </button>
              <span className="text-sm text-blaster-muted">{selectedIds.size} selected</span>
              {selectedIds.size > 0 && (
                <button type="button" onClick={deleteSelected} disabled={deleting} className="text-sm text-red-600 hover:underline disabled:opacity-50">
                  {deleting ? 'Deleting…' : 'Delete selected'}
                </button>
              )}
              <button type="button" onClick={exitSelectionMode} className="text-sm text-blaster-muted hover:text-blaster-fg ml-auto">
                Done
              </button>
            </div>
          )}
          <ul className="divide-y divide-blaster-border">
            {campaigns.map((c) => (
              <li key={c.id}>
                <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 hover:bg-gray-50/50">
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
                      className="text-sm text-blaster-fg hover:underline shrink-0"
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
        </section>
      )}

      {recipientSourceOpen && (
        <RecipientSourceModal
          emailLists={emailLists}
          onClose={() => setRecipientSourceOpen(false)}
          onCsvReady={handleCsvReady}
          onOpenList={handleOpenList}
        />
      )}

      {nameModalOpen && pendingRecipients?.length > 0 && (
        <CampaignNameModal
          onClose={() => {
            setNameModalOpen(false);
            setPendingRecipients(null);
            setListCreateError('');
          }}
          onConfirm={handleCreateList}
          saving={savingList}
        />
      )}

      {listCreateError && nameModalOpen && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 shadow-lg">
          {listCreateError}
        </div>
      )}

      {viewingList ? (
        <CampaignSetupSheet
          list={viewingList}
          onClose={() => setViewingList(null)}
          isMessaged={isMessaged}
          authFetch={authFetch}
          onListUpdated={revalidateCampaigns}
        />
      ) : null}
    </div>
  );
}
