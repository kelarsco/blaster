import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext';

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

export function AutomationModal({ scanId, results, recipientsOverride, onClose, onCampaignStart }) {
  const auth = useAuth();
  const authFetch = auth?.authFetch;
  const [groups, setGroups] = useState([]);
  const [inUseGroupIds, setInUseGroupIds] = useState(new Set());
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [presets, setPresets] = useState([]);
  const [subjectLines, setSubjectLines] = useState([{ id: 1, value: '{{store_url}}' }]);
  const [templates, setTemplates] = useState([
    { id: 1, body: 'Hi,\n\nI noticed your store: {{store_url}}\n\nBest regards' },
  ]);
  const [delayMin, setDelayMin] = useState(() => {
    try {
      const raw = localStorage.getItem('blaster-settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        const d = Number(parsed.delayBetweenEmails);
        if (d >= 20 && d <= 300) return d;
      }
    } catch (_) {}
    return 20;
  });
  const [delayMax, setDelayMax] = useState(() => {
    try {
      const raw = localStorage.getItem('blaster-settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        const d = Number(parsed.delayBetweenEmails);
        if (d >= 20 && d <= 300) return Math.max(20, d);
      }
    } catch (_) {}
    return 30;
  });
  const [onePerStore, setOnePerStore] = useState(true);
  const [providerFilter, setProviderFilter] = useState({
    includeGmail: true,
    includeOutlook: true,
    includeYahoo: true,
    includeHotmail: true,
    includeDomain: true,
  });
  const [confirmCompliance, setConfirmCompliance] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [savingPreset, setSavingPreset] = useState(false);

  useEffect(() => {
    if (!authFetch) return;
    authFetch(`${API}/automation/senders/groups`).then((r) => r.json()).then((d) => setGroups(d.groups || []));
    authFetch(`${API}/automation/senders/groups/in-use`).then((r) => r.json()).then((d) => setInUseGroupIds(new Set(d.groupIds || [])));
    authFetch(`${API}/automation/presets`).then((r) => r.json()).then((d) => setPresets(d.presets || []));
  }, [authFetch]);

  const savePreset = async () => {
    if (!presetName.trim() || !authFetch) return;
    setSavingPreset(true);
    setError('');
    try {
      const res = await authFetch(`${API}/automation/presets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: presetName.trim(),
          senders: selectedGroupId ? [selectedGroupId] : [],
          subjects: subjectLines.map((s) => s.value),
          templates: templates.map((t) => ({ body: t.body })),
          delayMin,
          delayMax,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setPresets((prev) => [...prev, { id: data.id, name: data.name }]);
      setPresetName('');
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingPreset(false);
    }
  };

  const recipients = recipientsOverride != null && Array.isArray(recipientsOverride)
    ? recipientsOverride
    : (results || [])
        .filter((s) => s.emails?.length)
        .flatMap((s) => s.emails.map((e) => ({ storeUrl: s.storeUrl || s.store_url, email: e.email })));

  const filteredRecipients = recipients.filter((r) => {
    const type = getEmailProvider(r.email);
    if (type === 'gmail') return providerFilter.includeGmail;
    if (type === 'outlook') return providerFilter.includeOutlook;
    if (type === 'yahoo') return providerFilter.includeYahoo;
    if (type === 'hotmail') return providerFilter.includeHotmail;
    return providerFilter.includeDomain;
  });

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || null;

  const addSubject = () => {
    setSubjectLines((prev) => [...prev, { id: Date.now(), value: '{{store_url}}' }]);
  };
  const addTemplate = () => {
    setTemplates((prev) => [...prev, { id: Date.now(), body: 'Hi,\n\n{{store_url}}\n\nBest regards' }]);
  };
  const removeSubject = (id) => setSubjectLines((prev) => prev.filter((p) => p.id !== id));
  const removeTemplate = (id) => setTemplates((prev) => prev.filter((p) => p.id !== id));
  const updateSubject = (id, value) => {
    setSubjectLines((prev) => prev.map((p) => (p.id === id ? { ...p, value } : p)));
  };
  const updateTemplate = (id, body) => {
    setTemplates((prev) => prev.map((p) => (p.id === id ? { ...p, body } : p)));
  };

  const loadPreset = (preset) => {
    if (preset.subjects?.length) setSubjectLines(preset.subjects.map((v, i) => ({ id: i + 1, value: typeof v === 'string' ? v : v.value })));
    if (preset.templates?.length) setTemplates(preset.templates.map((t, i) => ({ id: i + 1, body: typeof t === 'string' ? t : t.body || t.text })));
    if (preset.delayMin != null) setDelayMin(Math.max(20, Number(preset.delayMin)));
    if (preset.delayMax != null) setDelayMax(Math.max(20, Number(preset.delayMax)));
    if (preset.senders?.length === 1 && groups.some((g) => g.id === preset.senders[0])) {
      setSelectedGroupId(preset.senders[0]);
    }
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
      setError('No recipients to send to. Check your email type filters or run a scan first.');
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

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent';
  const sectionClass = 'rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/80 p-4';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="flex items-center justify-between shrink-0 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Automation Setup</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 dark:hover:text-slate-200">
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {/* Presets */}
          <section className={sectionClass}>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Campaign Presets</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {presets.map((p) => (
                <button key={p.id} type="button" onClick={() => loadPreset(p)} className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600">
                  {p.name}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Save current as preset…"
                className={inputClass + ' flex-1'}
              />
              <button type="button" onClick={savePreset} disabled={savingPreset || !presetName.trim()} className="btn-secondary text-sm shrink-0 disabled:opacity-50">
                {savingPreset ? 'Saving…' : 'Save'}
              </button>
            </div>
          </section>

          {/* Sender group selection */}
          <section className={sectionClass}>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Sender group</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Select one group. All senders in that group will rotate for this campaign. Groups in use by running campaigns cannot be selected.</p>
            {selectedGroupId && filteredRecipients.length > 500 && (groups.find((g) => g.id === selectedGroupId)?.senders?.length || 0) === 1 && (
              <div className="mb-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-sm text-amber-800 dark:text-amber-200">
                You're sending to {filteredRecipients.length} recipients with 1 sender. Many providers (e.g. Gmail) limit ~500 emails/day per account. Add more senders to this group on the Senders page.
              </div>
            )}
            {groups.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No groups yet. Create groups and add senders on the Senders page.</p>
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
                      className={`w-full flex items-center justify-between py-2.5 px-3 rounded-lg border text-left transition ${
                        inUse
                          ? 'border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700/50 opacity-60 cursor-not-allowed'
                          : count === 0
                            ? 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 opacity-60 cursor-not-allowed'
                            : isSelected
                              ? 'border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                              : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-600/50'
                      }`}
                    >
                      <div>
                        <span className="font-medium text-slate-700 dark:text-slate-200">{g.name}</span>
                        <span className="ml-2 text-sm text-slate-500">({count} sender{count !== 1 ? 's' : ''})</span>
                      </div>
                      {inUse && <span className="text-xs text-amber-600 dark:text-amber-400">In use</span>}
                      {!inUse && count === 0 && <span className="text-xs text-slate-400">Empty</span>}
                      {!inUse && count > 0 && isSelected && <span className="text-indigo-600 dark:text-indigo-400 text-sm font-medium">✓ Selected</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Subject lines */}
          <section className={sectionClass}>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Subject line</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Use {'{{store_url}}'} to insert the store URL.</p>
            <div className="space-y-2">
              {subjectLines.map((s) => (
                <div key={s.id} className="flex gap-2">
                  <input type="text" value={s.value} onChange={(e) => updateSubject(s.id, e.target.value)} placeholder="e.g. {{store_url}}" className={inputClass + ' flex-1'} />
                  <button type="button" onClick={() => removeSubject(s.id)} className="btn-secondary text-sm shrink-0">Remove</button>
                </div>
              ))}
              <button type="button" onClick={addSubject} className="btn-secondary text-sm">+ Add subject</button>
            </div>
          </section>

          {/* Email body */}
          <section className={sectionClass}>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Email body</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Variables: {'{{store_url}}'}, {'{{store_domain}}'}</p>
            <div className="space-y-3">
              {templates.map((t) => (
                <div key={t.id}>
                  <textarea value={t.body} onChange={(e) => updateTemplate(t.id, e.target.value)} rows={5} className={inputClass + ' min-h-[100px]'} placeholder={'Hi,\n\nI noticed your store: {{store_url}}\n\nBest regards'} />
                  <button type="button" onClick={() => removeTemplate(t.id)} className="btn-secondary text-sm mt-1">Remove template</button>
                </div>
              ))}
              <button type="button" onClick={addTemplate} className="btn-secondary text-sm">+ Add template</button>
            </div>
          </section>

          {/* Delay & options */}
          <section className={sectionClass}>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Sending options</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Minimum 20 sec between emails is enforced. Set your own min/max above that.</p>
            <div className="flex flex-wrap gap-6 items-center">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <span className="font-medium">Delay between emails (sec):</span>
                <input type="number" min={20} max={300} step={1} value={delayMin} onChange={(e) => setDelayMin(Math.max(20, Number(e.target.value) || 20))} className="w-14 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100" />
                <span>min</span>
                <input type="number" min={20} max={300} step={1} value={delayMax} onChange={(e) => setDelayMax(Math.max(20, Number(e.target.value) || 20))} className="w-14 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100" />
                <span>max</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={onePerStore} onChange={(e) => setOnePerStore(e.target.checked)} className="rounded border-slate-300" />
                One email per store (dedupe)
              </label>
            </div>
          </section>

          {/* Recipients & compliance */}
          <section className={sectionClass}>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
              <strong className="text-slate-800 dark:text-slate-100">{filteredRecipients.length}</strong> recipients will be emailed
              {recipientsOverride != null ? ' from CSV' : ' from current scan'}
              {filteredRecipients.length !== recipients.length && (
                <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
                  ({recipients.length} total before email type filters)
                </span>
              )}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Choose which email types to include in this campaign:</p>
            <div className="flex flex-wrap gap-3 mb-3">
              <label className="flex items-center gap-2 text-xs sm:text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={providerFilter.includeGmail}
                  onChange={(e) => setProviderFilter((f) => ({ ...f, includeGmail: e.target.checked }))}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Gmail
              </label>
              <label className="flex items-center gap-2 text-xs sm:text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={providerFilter.includeOutlook}
                  onChange={(e) => setProviderFilter((f) => ({ ...f, includeOutlook: e.target.checked }))}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Outlook
              </label>
              <label className="flex items-center gap-2 text-xs sm:text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={providerFilter.includeYahoo}
                  onChange={(e) => setProviderFilter((f) => ({ ...f, includeYahoo: e.target.checked }))}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Yahoo Mail
              </label>
              <label className="flex items-center gap-2 text-xs sm:text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={providerFilter.includeHotmail}
                  onChange={(e) => setProviderFilter((f) => ({ ...f, includeHotmail: e.target.checked }))}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Hotmail
              </label>
              <label className="flex items-center gap-2 text-xs sm:text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={providerFilter.includeDomain}
                  onChange={(e) => setProviderFilter((f) => ({ ...f, includeDomain: e.target.checked }))}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Domain mail
              </label>
            </div>
            <label className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" checked={confirmCompliance} onChange={(e) => setConfirmCompliance(e.target.checked)} className="rounded mt-0.5 border-slate-300 shrink-0" />
              <span>I confirm I am responsible for complying with outreach regulations.</span>
            </label>
          </section>

          {error && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-sm">
              <p className="font-medium">{error}</p>
              {upgradeRequired && (
                <Link to="/app/account/billing/monthly-plan" className="mt-2 inline-block font-medium text-blaster-accent hover:underline">
                  Upgrade plan →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div className="shrink-0 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 rounded-b-2xl flex gap-2">
          <button type="button" onClick={startCampaign} disabled={loading || !selectedGroupId} className="btn-primary">
            {loading ? 'Starting…' : 'Start campaign'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}
