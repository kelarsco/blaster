import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { Download } from 'react-feather';
import { API } from '../../api.js';
import {
  domainFromUrl,
  exportScanResultsCsv,
  recipientsToScanResults,
  filterCampaignRecipients,
  countCampaignEmailsByType,
} from '../../utils/scannerUrls.js';
import { saveManualCampaignDeck } from '../../utils/manualCampaignDeck.js';
import { ExportFieldsModal } from '../scanner/ExportFieldsModal.jsx';

function CheckIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function formatEmailMobile(email) {
  const value = String(email || '').trim();
  if (!value) return '';
  if (value.length <= 4) return value;
  return `${value.slice(0, 4)}..`;
}

const setupChipDefault =
  'px-3 py-2 rounded-xl text-sm font-medium border border-[#e3e3ed] bg-white text-[#1a1a21] hover:border-blaster-accent/30 transition';
const setupChipSelected =
  'px-3 py-2 rounded-xl text-sm font-medium border border-blaster-accent/25 bg-gradient-to-r from-blaster-accent/20 to-blaster-orange/30 text-[#1a1a21] shadow-sm transition';

function MailTypeOption({ label, hint, count, selected, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`flex flex-1 min-w-[148px] items-center gap-3 rounded-xl border p-3 text-left transition ${
        selected
          ? 'border-blaster-accent/35 bg-gradient-to-r from-blaster-accent/15 to-blaster-orange/25 shadow-sm ring-1 ring-blaster-accent/20'
          : 'border-blaster-border bg-white hover:border-blaster-accent/25'
      }`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
          selected
            ? 'border-transparent bg-gradient-to-br from-blaster-accent to-blaster-orange text-white'
            : 'border-blaster-border bg-white'
        }`}
      >
        {selected ? <CheckIcon className="w-3 h-3" /> : null}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-blaster-fg">{label}</span>
        <span className="block text-[11px] text-blaster-muted">{hint}</span>
        <span className="block text-[11px] font-medium text-blaster-fg/80 mt-0.5">{count} in list</span>
      </span>
    </button>
  );
}

function ChipRowSkeleton({ count = 3 }) {
  const widths = ['w-24', 'w-28', 'w-20', 'w-32'];
  return (
    <div className="mt-2 flex flex-wrap gap-2" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`h-9 rounded-xl bg-gray-100 animate-pulse ${widths[i % widths.length]}`} />
      ))}
    </div>
  );
}

function MailTypeSkeleton() {
  return (
    <div className="flex flex-wrap gap-2 mt-2" aria-hidden>
      <div className="h-[72px] flex-1 min-w-[148px] rounded-xl bg-gray-100 animate-pulse" />
      <div className="h-[72px] flex-1 min-w-[148px] rounded-xl bg-gray-100 animate-pulse" />
    </div>
  );
}

function SetupOptionsSkeleton() {
  return (
    <div className="relative rounded-xl border border-blaster-border overflow-hidden bg-white">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-blaster-orange/10 via-blaster-accent/10 to-transparent"
        aria-hidden
      />
      <div className="relative p-4 space-y-4">
        <div>
          <label className="text-xs font-medium text-blaster-muted uppercase tracking-wide">Select Templates</label>
          <ChipRowSkeleton count={4} />
          <div className="h-3 w-48 rounded bg-gray-100 animate-pulse mt-2" aria-hidden />
        </div>
        <div>
          <label className="text-xs font-medium text-blaster-muted uppercase tracking-wide">Select Mail</label>
          <div className="h-3 w-56 rounded bg-gray-100 animate-pulse mt-1 mb-2" aria-hidden />
          <MailTypeSkeleton />
        </div>
      </div>
    </div>
  );
}

/**
 * Unified campaign setup: templates, mail-type filter, contact table, start/resume.
 */
export function CampaignSetupSheet({ list, onClose, isMessaged, authFetch, onListUpdated }) {
  const navigate = useNavigate();
  const [exportOpen, setExportOpen] = useState(false);
  const [presets, setPresets] = useState([]);
  const [selectedPresetIds, setSelectedPresetIds] = useState(() => new Set());
  const [activeRun, setActiveRun] = useState(null);
  const [starting, setStarting] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [includeProviderEmails, setIncludeProviderEmails] = useState(true);
  const [includeDomainEmails, setIncludeDomainEmails] = useState(true);
  const [setupLoading, setSetupLoading] = useState(true);

  useEffect(() => {
    if (!authFetch || !list?.id) return undefined;
    let cancelled = false;
    setSetupLoading(true);

    Promise.all([
      authFetch(`${API}/automation/presets`).then((r) => r.json()),
      authFetch(`${API}/manual-campaigns?emailListId=${list.id}`).then((r) => r.json()),
    ])
      .then(([presetsRes, runRes]) => {
        if (cancelled) return;
        setPresets(presetsRes.presets || []);
        setActiveRun(runRes.run || null);
      })
      .catch(() => {
        if (!cancelled) {
          setPresets([]);
          setActiveRun(null);
        }
      })
      .finally(() => {
        if (!cancelled) setSetupLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authFetch, list?.id]);

  if (!list) return null;

  const allRecipients = list.recipients || [];
  const emailTypeCounts = countCampaignEmailsByType(allRecipients);
  const filteredRecipients = filterCampaignRecipients(allRecipients, {
    includeProvider: includeProviderEmails,
    includeDomain: includeDomainEmails,
  });
  const hasExportable = allRecipients.length > 0;
  const hasFilteredRecipients = filteredRecipients.length > 0;
  const canStart = hasFilteredRecipients && selectedPresetIds.size > 0;
  const hasActiveRun = activeRun && activeRun.status !== 'completed';
  const scanResults = recipientsToScanResults(list.recipients);
  const extractOptions = { email: true, phone: false, whatsapp: false, instagram: false, tiktok: false };
  const tableRecipients = hasActiveRun ? allRecipients : filteredRecipients;

  const togglePreset = (id) => {
    setSelectedPresetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleProviderEmails = () => {
    setIncludeProviderEmails((prev) => {
      if (prev && !includeDomainEmails) return prev;
      return !prev;
    });
  };

  const toggleDomainEmails = () => {
    setIncludeDomainEmails((prev) => {
      if (prev && !includeProviderEmails) return prev;
      return !prev;
    });
  };

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
          templateIds: [...selectedPresetIds],
          recipients: filteredRecipients,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start');
      if (Array.isArray(data.deck)) {
        saveManualCampaignDeck(data.run.id, data.deck);
      }
      onListUpdated?.();
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
        aria-labelledby="campaign-setup-title"
      >
        <div className="flex min-h-full min-h-[100dvh] items-center justify-center p-4 sm:p-6">
          <div
            className="w-full max-w-2xl max-h-[min(90vh,90dvh)] min-h-0 flex flex-col rounded-2xl border border-blaster-border bg-white shadow-xl animate-[fadeIn_0.25s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-blaster-border shrink-0">
              <div>
                <h3 id="campaign-setup-title" className="text-base font-semibold text-blaster-fg">{list.name}</h3>
                <p className="text-xs text-blaster-muted mt-0.5">
                  {hasActiveRun
                    ? `${list.recipients?.length ?? 0} contacts`
                    : `${filteredRecipients.length} of ${allRecipients.length} contacts selected`}
                </p>
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
                  disabled={!hasExportable || (!hasActiveRun && (!canStart || setupLoading)) || starting}
                  className="px-3 py-1.5 rounded-xl bg-black border border-blaster-orange text-[#faf8f5] text-sm font-medium shadow-blaster-cta hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {starting ? 'Starting…' : hasActiveRun ? 'Resume Campaign' : 'Start Campaign'}
                </button>
              </div>
            </div>

            <div className="px-5 py-4 border-b border-blaster-border shrink-0 bg-gray-50/40">
              {setupError && <p className="text-sm text-red-600 mb-4">{setupError}</p>}
              {setupLoading ? (
                <SetupOptionsSkeleton />
              ) : hasActiveRun ? (
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
                    <div>
                      <label className="text-xs font-medium text-blaster-muted uppercase tracking-wide">Select Mail</label>
                      <p className="text-[11px] text-blaster-muted mt-1 mb-2">
                        Choose which email types to include in this campaign run.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <MailTypeOption
                          label="Provider email"
                          hint="Gmail, Outlook, Yahoo, etc."
                          count={emailTypeCounts.provider}
                          selected={includeProviderEmails}
                          onToggle={toggleProviderEmails}
                        />
                        <MailTypeOption
                          label="Domain email"
                          hint="Store / business domain addresses"
                          count={emailTypeCounts.domain}
                          selected={includeDomainEmails}
                          onToggle={toggleDomainEmails}
                        />
                      </div>
                      {!hasFilteredRecipients && (
                        <p className="text-xs text-amber-700 mt-2">Select at least one mail type with contacts in this list.</p>
                      )}
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
                    {tableRecipients.map((r, i) => (
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
                          {isMessaged?.(r.email) ? (
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
