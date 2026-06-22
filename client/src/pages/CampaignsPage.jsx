import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Download, Clipboard } from 'react-feather';
import { useToolState } from '../context/ToolStateContext';
import { useAuth } from '../context/AuthContext';
import { usePlanAccess } from '../context/PlanAccessContext.jsx';
import { AutomationModal } from '../components/AutomationModal';
import { RecipientSourceModal } from '../components/RecipientSourceModal';
import { ExecutionDashboard } from '../components/ExecutionDashboard';
import { ExportFieldsModal } from '../components/scanner/ExportFieldsModal.jsx';
import { API } from '../api.js';
import { domainFromUrl, exportScanResultsCsv, recipientsToScanResults } from '../utils/scannerUrls.js';
import { saveManualCampaignDeck } from '../utils/manualCampaignDeck.js';
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

/** Mobile: first 4 characters + .. */
function formatEmailMobile(email) {
  const value = String(email || '').trim();
  if (!value) return '';
  if (value.length <= 4) return value;
  return `${value.slice(0, 4)}..`;
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

function CampaignDetailSheet({ list, onClose, isMessaged, authFetch }) {
  const navigate = useNavigate();
  const [exportOpen, setExportOpen] = useState(false);
  const [groups, setGroups] = useState([]);
  const [presets, setPresets] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedPresetIds, setSelectedPresetIds] = useState(() => new Set());
  const [activeRun, setActiveRun] = useState(null);
  const [starting, setStarting] = useState(false);
  const [setupError, setSetupError] = useState('');

  useEffect(() => {
    if (!authFetch || !list?.id) return;
    authFetch(`${API}/automation/senders/groups`).then((r) => r.json()).then((d) => setGroups(d.groups || []));
    authFetch(`${API}/automation/presets`).then((r) => r.json()).then((d) => setPresets(d.presets || []));
    authFetch(`${API}/manual-campaigns?emailListId=${list.id}`)
      .then((r) => r.json())
      .then((d) => setActiveRun(d.run || null));
  }, [authFetch, list?.id]);

  if (!list) return null;

  const hasExportable = (list.recipients?.length ?? 0) > 0;
  const canStart = hasExportable && selectedGroupId && selectedPresetIds.size > 0;
  const hasActiveRun = activeRun && activeRun.status !== 'completed';
  const scanResults = recipientsToScanResults(list.recipients);
  const extractOptions = { email: true, phone: false, whatsapp: false, instagram: false, tiktok: false };

  const togglePreset = (id) => {
    setSelectedPresetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setupChipDefault =
    'px-3 py-2 rounded-xl text-sm font-medium border border-[#e3e3ed] bg-white text-[#1a1a21] hover:border-blaster-accent/30 transition';
  const setupChipSelected =
    'px-3 py-2 rounded-xl text-sm font-medium border border-blaster-accent/25 bg-gradient-to-r from-blaster-accent/20 to-blaster-orange/30 text-[#1a1a21] shadow-sm transition';

  const handleStartOrResume = async () => {
    if (!authFetch) return;
    setSetupError('');
    if (hasActiveRun) {
      setStarting(true);
      try {
        const deckRes = await authFetch(`${API}/manual-campaigns/${activeRun.id}/deck`);
        const deckData = await deckRes.json();
        if (deckRes.ok && Array.isArray(deckData.deck)) {
          saveManualCampaignDeck(activeRun.id, deckData.deck);
        }
        navigate(`/app/campaigns/send/${activeRun.id}`);
        onClose();
      } catch (e) {
        setSetupError(e.message);
      } finally {
        setStarting(false);
      }
      return;
    }
    if (!canStart) return;
    setStarting(true);
    try {
      const res = await authFetch(`${API}/manual-campaigns/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailListId: list.id,
          senderGroupId: selectedGroupId,
          templateIds: [...selectedPresetIds],
          recipients: list.recipients || [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start');
      if (Array.isArray(data.deck)) {
        saveManualCampaignDeck(data.run.id, data.deck);
      }
      navigate(`/app/campaigns/send/${data.run.id}`);
      onClose();
    } catch (e) {
      setSetupError(e.message);
    } finally {
      setStarting(false);
    }
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-50 overflow-y-auto bg-black/45 backdrop-blur-sm"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="campaign-detail-title"
      >
        <div className="flex min-h-full min-h-[100dvh] items-center justify-center p-4 sm:p-6">
          <div
            className="w-full max-w-2xl max-h-[min(90vh,90dvh)] min-h-0 flex flex-col rounded-2xl border border-blaster-border bg-white shadow-xl animate-[fadeIn_0.25s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
          <div className="flex items-center justify-between px-5 py-4 border-b border-blaster-border shrink-0">
            <div>
              <h3 id="campaign-detail-title" className="text-base font-semibold text-blaster-fg">{list.name}</h3>
              <p className="text-xs text-blaster-muted mt-0.5">{list.recipients?.length ?? 0} contacts</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setExportOpen(true)}
                disabled={!hasExportable}
                className="inline-flex items-center justify-center p-2 rounded-lg text-blaster-muted hover:text-blaster-fg border border-blaster-border hover:border-blaster-accent/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Download export"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleStartOrResume}
                disabled={!hasExportable || (!hasActiveRun && !canStart) || starting}
                className="px-3 py-1.5 rounded-xl bg-black border border-blaster-orange text-[#faf8f5] text-sm font-medium shadow-blaster-cta hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {starting ? 'Starting…' : hasActiveRun ? 'Resume Campaign' : 'Start Campaign'}
              </button>
            </div>
          </div>

          <div className="px-5 py-4 border-b border-blaster-border shrink-0 bg-gray-50/40">
            {setupError && <p className="text-sm text-red-600 mb-4">{setupError}</p>}
            {hasActiveRun ? (
              <p className="text-sm text-blaster-muted">
                In progress — {activeRun.totalSent} of {(activeRun.recipientQueue?.length ?? list.recipients?.length) || 0} sent.
                Resume to continue where you left off.
              </p>
            ) : (
              <div className="relative rounded-xl border border-blaster-border overflow-hidden bg-white">
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-blaster-orange/10 via-blaster-accent/10 to-transparent"
                  aria-hidden
                />
                <div className="relative p-4 space-y-4">
                <div>
                  <label className="text-xs font-medium text-blaster-muted uppercase tracking-wide">Select Sender Group</label>
                  {groups.length === 0 ? (
                    <p className="text-sm text-blaster-muted mt-1">
                      No groups yet.{' '}
                      <Link to="/app/senders" className="text-blaster-accent hover:underline" onClick={onClose}>
                        Create one on Senders
                      </Link>
                    </p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {groups.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setSelectedGroupId(g.id)}
                          className={selectedGroupId === g.id ? setupChipSelected : setupChipDefault}
                        >
                          {g.name}
                          <span className={`ml-1.5 text-xs ${selectedGroupId === g.id ? 'text-[#1a1a21]/70' : 'text-[#1a1a21]/55'}`}>
                            ({(g.senders || []).length})
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-blaster-muted uppercase tracking-wide">Select Templates</label>
                  {presets.length === 0 ? (
                    <p className="text-sm text-blaster-muted mt-1">
                      No templates yet.{' '}
                      <Link to="/app/templates" className="text-blaster-accent hover:underline" onClick={onClose}>
                        Create templates
                      </Link>
                    </p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {presets.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePreset(p.id)}
                          className={selectedPresetIds.has(p.id) ? setupChipSelected : setupChipDefault}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-blaster-muted mt-1.5">Templates rotate randomly per send.</p>
                </div>
                </div>
              </div>
            )}
          </div>
        <div className="overflow-y-auto flex-1 min-h-0 px-5 py-4">
          <div className="rounded-xl border border-blaster-border overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50/95 border-b border-blaster-border z-10">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-blaster-muted">Store</th>
                  <th className="text-left px-4 py-3 font-medium text-blaster-muted">Email</th>
                  <th className="w-11 px-3 py-3" aria-hidden />
                </tr>
              </thead>
              <tbody>
                {(list.recipients || []).map((r, i) => (
                  <tr key={`${r.email}-${i}`} className="border-b border-blaster-border/70 last:border-b-0 hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-blaster-fg align-top">
                      <span className="font-medium block">{domainFromUrl(r.storeUrl)}</span>
                      <span className="text-xs text-blaster-muted truncate block max-w-[140px] sm:max-w-[200px]">{r.storeUrl}</span>
                    </td>
                    <td className="px-4 py-3 text-blaster-fg align-top min-w-0">
                      <span className="sm:hidden block truncate" title={r.email}>{formatEmailMobile(r.email)}</span>
                      <span className="hidden sm:block truncate max-w-[200px]" title={r.email}>{r.email}</span>
                    </td>
                    <td className="px-3 py-3 align-top text-right shrink-0">
                      {isMessaged(r.email) ? (
                        <button
                          type="button"
                          disabled
                          title="Message sent"
                          aria-label="Message sent"
                          className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600"
                        >
                          <CheckIcon className="w-3.5 h-3.5" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </div>
        </div>
      </div>

      {exportOpen ? (
        <ExportFieldsModal
          onClose={() => setExportOpen(false)}
          onConfirm={(fields) => {
            exportScanResultsCsv(scanResults, fields, extractOptions);
            setExportOpen(false);
          }}
        />
      ) : null}
    </>,
    document.body
  );
}

export function CampaignsPage() {
  const auth = useAuth();
  const authFetch = auth?.authFetch;
  const userId = auth?.user?.id;
  const confirm = useConfirm();
  const location = useLocation();
  const { status, openUpgradeModal } = usePlanAccess();
  const { setAutomationOpen, activeCampaignId, setActiveCampaignId } = useToolState();

  const cached = userId ? readPageCache(userId, CAMPAIGNS_CACHE_KEY) : null;
  const hadCacheRef = useRef(Boolean(cached));

  const [campaigns, setCampaigns] = useState(cached?.campaigns ?? []);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [recipientSourceOpen, setRecipientSourceOpen] = useState(false);
  const [csvRecipients, setCsvRecipients] = useState([]);
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
        tierPrice: '$29/month',
      });
      return;
    }
    setRecipientSourceOpen(true);
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
          scannedCount={0}
          emailLists={emailLists}
          onClose={() => setRecipientSourceOpen(false)}
          onContinueScanned={() => setRecipientSourceOpen(false)}
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

      {csvRecipients.length > 0 && (
        <AutomationModal
          scanId={null}
          results={[]}
          recipientsOverride={csvRecipients}
          onClose={() => setCsvRecipients([])}
          onCampaignStart={(campaignId) => {
            setCsvRecipients([]);
            setActiveCampaignId(campaignId);
            fetchCampaigns();
            fetchMessagedEmails();
          }}
        />
      )}

      {viewingList ? (
        <CampaignDetailSheet
          list={viewingList}
          onClose={() => setViewingList(null)}
          isMessaged={isMessaged}
          authFetch={authFetch}
        />
      ) : null}
    </div>
  );
}
