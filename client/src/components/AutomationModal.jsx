import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext';
import { domainFromUrl } from '../utils/scannerUrls.js';

function getEmailProvider(email) {
  if (!email || typeof email !== 'string') return 'domain';
  const atIndex = email.lastIndexOf('@');
  if (atIndex === -1) return 'domain';
  const domain = email.slice(atIndex + 1).toLowerCase();
  if (!domain) return 'domain';
  if (domain.includes('gmail.')) return 'gmail';
  if (domain.includes('outlook.')) return 'outlook';
  if (domain.includes('yahoo.')) return 'yahoo';
  if (domain.includes('hotmail.')) return 'hotmail';
  return 'domain';
}

function recipientDomain(r) {
  if (r.storeUrl) return domainFromUrl(r.storeUrl);
  const email = r.email || '';
  const at = email.lastIndexOf('@');
  return at >= 0 ? email.slice(at + 1) : '—';
}

function mergePresets(presetList) {
  const subjects = [];
  const templates = [];
  let delayMin = 10;
  let delayMax = 30;
  let senderGroupId = null;

  for (const preset of presetList) {
    for (const s of preset.subjects || []) {
      const value = typeof s === 'string' ? s : s?.value;
      if (value && !subjects.some((row) => row.value === value)) {
        subjects.push({ id: subjects.length + 1, value });
      }
    }
    for (const t of preset.templates || []) {
      const body = typeof t === 'string' ? t : t?.body || t?.text;
      if (body && !templates.some((row) => row.body === body)) {
        templates.push({ id: templates.length + 1, body });
      }
    }
    if (preset.delayMin != null) delayMin = Math.max(10, Number(preset.delayMin));
    if (preset.delayMax != null) delayMax = Math.max(10, Number(preset.delayMax));
    if (!senderGroupId && preset.senders?.length === 1) senderGroupId = preset.senders[0];
  }

  return { subjects, templates, delayMin, delayMax, senderGroupId };
}

export function AutomationModal({ scanId, results, recipientsOverride, onClose, onCampaignStart }) {
  const auth = useAuth();
  const authFetch = auth?.authFetch;
  const [groups, setGroups] = useState([]);
  const [inUseGroupIds, setInUseGroupIds] = useState(new Set());
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [presets, setPresets] = useState([]);
  const [selectedPresetIds, setSelectedPresetIds] = useState(() => new Set());
  const [subjectLines, setSubjectLines] = useState([{ id: 1, value: '{{store_url}}' }]);
  const [templates, setTemplates] = useState([
    { id: 1, body: 'Hi,\n\nI noticed your store: {{store_url}}\n\nBest regards' },
  ]);
  const [delayMin, setDelayMin] = useState(10);
  const [delayMax, setDelayMax] = useState(30);
  const [onePerStore, setOnePerStore] = useState(true);
  const [includeProviderEmails, setIncludeProviderEmails] = useState(true);
  const [includeDomain, setIncludeDomain] = useState(true);
  const [confirmCompliance, setConfirmCompliance] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [upgradeRequired, setUpgradeRequired] = useState(false);

  useEffect(() => {
    if (!authFetch) return;
    authFetch(`${API}/automation/senders/groups`).then((r) => r.json()).then((d) => setGroups(d.groups || []));
    authFetch(`${API}/automation/senders/groups/in-use`).then((r) => r.json()).then((d) => setInUseGroupIds(new Set(d.groupIds || [])));
    authFetch(`${API}/automation/presets`).then((r) => r.json()).then((d) => setPresets(d.presets || []));
  }, [authFetch]);

  useEffect(() => {
    const selected = presets.filter((p) => selectedPresetIds.has(p.id));
    if (!selected.length) return;
    const merged = mergePresets(selected);
    if (merged.subjects.length) setSubjectLines(merged.subjects);
    if (merged.templates.length) setTemplates(merged.templates);
    setDelayMin(merged.delayMin);
    setDelayMax(merged.delayMax);
    if (merged.senderGroupId && groups.some((g) => g.id === merged.senderGroupId)) {
      setSelectedGroupId(merged.senderGroupId);
    }
  }, [selectedPresetIds, presets, groups]);

  const deletePreset = async (preset) => {
    if (!preset?.id || !authFetch) return;
    const ok = window.confirm(`Delete template "${preset.name}"?`);
    if (!ok) return;
    setError('');
    try {
      const res = await authFetch(`${API}/automation/presets/${preset.id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete template');
      setPresets((prev) => prev.filter((p) => p.id !== preset.id));
      setSelectedPresetIds((prev) => {
        const next = new Set(prev);
        next.delete(preset.id);
        return next;
      });
    } catch (e) {
      setError(e?.message || 'Failed to delete template');
    }
  };

  const recipients = recipientsOverride != null && Array.isArray(recipientsOverride)
    ? recipientsOverride
    : (results || [])
        .filter((s) => s.emails?.length)
        .flatMap((s) => s.emails.map((e) => ({ storeUrl: s.storeUrl || s.store_url, email: e.email })));

  const filteredRecipients = recipients.filter((r) => {
    const type = getEmailProvider(r.email);
    if (type === 'domain') return includeDomain;
    return includeProviderEmails;
  });

  const previewRecipients = filteredRecipients.slice(0, 3);
  const remainingRecipients = filteredRecipients.length - previewRecipients.length;

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || null;

  const togglePreset = (preset) => {
    setSelectedPresetIds((prev) => {
      const next = new Set(prev);
      if (next.has(preset.id)) next.delete(preset.id);
      else next.add(preset.id);
      return next;
    });
  };

  const startCampaign = async () => {
    setError('');
    if (!authFetch) return;
    if (!confirmCompliance) {
      setError('Please confirm compliance with outreach regulations.');
      return;
    }
    if (!selectedGroupId) {
      setError('Select a sender group.');
      return;
    }
    if (!selectedGroup || (selectedGroup.senders?.length || 0) === 0) {
      setError('Selected group has no senders. Add senders to the group on the Senders page.');
      return;
    }
    if (!filteredRecipients.length) {
      setError('No recipients to send to. Adjust your email filters or add contacts first.');
      return;
    }
    setLoading(true);
    setError('');
    setUpgradeRequired(false);
    try {
      const res = await authFetch(`${API}/campaigns/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scanId,
          recipients: filteredRecipients,
          senderGroupId: selectedGroupId,
          subjects: subjectLines.map((s) => s.value),
          templates: templates.map((t) => ({ body: t.body })),
          delayMin,
          delayMax,
          onePerStore,
        }),
      });
      const text = await res.text();
      let data = {};
      try {
        if (text && text.trim()) data = JSON.parse(text);
      } catch (_) {
        if (res.ok) {
          onCampaignStart(undefined);
          onClose();
          return;
        }
        setError(data.error || 'Invalid response from server');
        return;
      }
      if (!res.ok) {
        setError(data.error || 'Failed to start campaign');
        if (data.upgradeRequired) setUpgradeRequired(true);
        return;
      }
      onCampaignStart(data.campaignId);
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to start campaign');
    } finally {
      setLoading(false);
    }
  };

  const sectionClass = 'rounded-xl border border-blaster-border bg-white p-4';
  const chipSelected = 'border-blaster-accent/35 bg-gradient-to-r from-blaster-accent/10 to-blaster-orange/15 text-blaster-fg ring-1 ring-blaster-accent/20';
  const chipDefault = 'border-gray-900 bg-white text-[#1a1a1a] hover:bg-gray-50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-blaster-bg-card rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl border border-blaster-border animate-[fadeIn_0.25s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-header-mobile flex items-center justify-between shrink-0">
          <h2 className="text-base font-semibold text-blaster-fg">Campaign Setup</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-blaster-muted hover:text-blaster-fg hover:bg-blaster-border/50">
            ×
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          <section className={sectionClass}>
            <h3 className="text-sm font-semibold text-blaster-fg mb-1">Select template</h3>
            <p className="text-xs text-blaster-muted mb-3">Choose one or more — subjects and bodies rotate per send.</p>
            {presets.length === 0 ? (
              <p className="text-xs text-blaster-muted">No templates yet. Create one on the Templates page.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {presets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePreset(p)}
                    onDoubleClick={() => deletePreset(p)}
                    title="Click to select. Double-click to delete."
                    className={`px-3 py-1.5 rounded-xl border-2 text-sm font-semibold transition ${
                      selectedPresetIds.has(p.id) ? chipSelected : chipDefault
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className={sectionClass}>
            <h3 className="text-sm font-semibold text-blaster-fg mb-2">Sender group</h3>
            {groups.length === 0 ? (
              <p className="text-xs text-blaster-muted">
                No sender groups yet.{' '}
                <Link to="/app/senders" className="text-blaster-accent hover:underline">
                  Create one on the Senders page
                </Link>
                .
              </p>
            ) : (
              <div className="space-y-2">
                {groups.map((g) => {
                  const inUse = inUseGroupIds.has(g.id);
                  const count = g.senders?.length || 0;
                  const isSelected = selectedGroupId === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      disabled={inUse || count === 0}
                      onClick={() => !inUse && count > 0 && setSelectedGroupId(isSelected ? null : g.id)}
                      className={`w-full flex items-center justify-between py-2.5 px-3 rounded-xl border text-left text-sm transition ${
                        inUse || count === 0
                          ? 'border-blaster-border opacity-50 cursor-not-allowed'
                          : isSelected
                            ? chipSelected
                            : chipDefault
                      }`}
                    >
                      <span className="font-medium text-blaster-fg">{g.name}</span>
                      <span className="text-xs text-blaster-muted">
                        {inUse ? 'In use' : `${count} sender${count !== 1 ? 's' : ''}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className={sectionClass}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p className="text-sm font-semibold text-blaster-fg">
                {filteredRecipients.length} recipient{filteredRecipients.length !== 1 ? 's' : ''}
              </p>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 text-xs text-blaster-fg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeProviderEmails}
                    onChange={(e) => setIncludeProviderEmails(e.target.checked)}
                    className="blaster-checkbox"
                  />
                  Emails
                </label>
                <label className="flex items-center gap-2 text-xs text-blaster-fg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeDomain}
                    onChange={(e) => setIncludeDomain(e.target.checked)}
                    className="blaster-checkbox"
                  />
                  Domain mail
                </label>
              </div>
            </div>
            {filteredRecipients.length > 0 ? (
              <div className="rounded-xl border border-blaster-border overflow-hidden">
                <ul className="divide-y divide-blaster-border">
                  {previewRecipients.map((r, i) => (
                    <li key={`${r.email}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm bg-white">
                      <span className="text-blaster-fg truncate">{r.email}</span>
                      <span className="text-xs text-blaster-muted shrink-0">{recipientDomain(r)}</span>
                    </li>
                  ))}
                </ul>
                {remainingRecipients > 0 && (
                  <p className="px-3 py-2 text-xs text-blaster-muted bg-gray-50/80 border-t border-blaster-border">
                    +{remainingRecipients} more recipient{remainingRecipients !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-blaster-muted">No recipients match the selected filters.</p>
            )}
            <label className="flex items-start gap-3 text-sm text-blaster-muted cursor-pointer mt-3">
              <input
                type="checkbox"
                checked={confirmCompliance}
                onChange={(e) => setConfirmCompliance(e.target.checked)}
                className="blaster-checkbox mt-0.5"
              />
              <span>I confirm I am responsible for complying with outreach regulations.</span>
            </label>
          </section>

          {error && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              <p className="font-medium">{error}</p>
              {upgradeRequired && (
                <Link to="/app/account/billing/monthly-plan" className="mt-2 inline-block font-medium text-blaster-accent hover:underline">
                  Upgrade plan →
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-blaster-border flex gap-2">
          <button
            type="button"
            onClick={startCampaign}
            disabled={loading || !selectedGroupId}
            className="px-5 py-2.5 rounded-xl bg-black border border-blaster-orange text-[#faf8f5] text-sm font-medium shadow-blaster-cta hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Starting…' : 'Start campaign'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-blaster-border text-sm text-blaster-muted hover:text-blaster-fg hover:border-blaster-accent/30 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
