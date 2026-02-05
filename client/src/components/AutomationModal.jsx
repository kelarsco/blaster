import React, { useState, useEffect } from 'react';
import { API } from '../api.js';

export function AutomationModal({ scanId, results, onClose, onCampaignStart }) {
  const [senders, setSenders] = useState([]);
  const [presets, setPresets] = useState([]);
  const [subjectLines, setSubjectLines] = useState([{ id: 1, value: '{{store_url}}' }]);
  const [templates, setTemplates] = useState([
    { id: 1, body: 'Hi,\n\nI noticed your store: {{store_url}}\n\nBest regards' },
  ]);
  const [delayMin, setDelayMin] = useState(2);
  const [delayMax, setDelayMax] = useState(5);
  const [onePerStore, setOnePerStore] = useState(true);
  const [confirmCompliance, setConfirmCompliance] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAddSender, setShowAddSender] = useState(false);
  const [newSender, setNewSender] = useState({ email: '', host: 'smtp.gmail.com', port: 587, secure: false, user: '', pass: '', maxPerMinute: 10 });
  const [presetName, setPresetName] = useState('');
  const [savingPreset, setSavingPreset] = useState(false);

  useEffect(() => {
    fetch(`${API}/automation/senders`).then((r) => r.json()).then((d) => setSenders(d.senders || []));
    fetch(`${API}/automation/presets`).then((r) => r.json()).then((d) => setPresets(d.presets || []));
  }, []);

  const addSender = async () => {
    if (!newSender.email) return;
    try {
      const res = await fetch(`${API}/automation/senders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newSender.email,
          config: { host: newSender.host, port: Number(newSender.port), secure: newSender.secure, auth: { user: newSender.user, pass: newSender.pass } },
          maxPerMinute: Number(newSender.maxPerMinute) || 10,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setSenders((prev) => [...prev, { id: data.id, email: data.email, maxPerMinute: data.maxPerMinute }]);
      setNewSender({ email: '', host: 'smtp.gmail.com', port: 587, secure: false, user: '', pass: '', maxPerMinute: 10 });
      setShowAddSender(false);
    } catch (e) {
      setError(e.message);
    }
  };

  const removeSender = async (senderId) => {
    try {
      const res = await fetch(`${API}/automation/senders/${senderId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to remove');
      setSenders((prev) => prev.filter((s) => s.id !== senderId));
    } catch (e) {
      setError(e.message);
    }
  };

  const savePreset = async () => {
    if (!presetName.trim()) return;
    setSavingPreset(true);
    setError('');
    try {
      const res = await fetch(`${API}/automation/presets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: presetName.trim(),
          senders: senders.map((s) => s.id),
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

  const recipients = results
    .filter((s) => s.emails?.length)
    .flatMap((s) => s.emails.map((e) => ({ storeUrl: s.storeUrl, email: e.email })));

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
    if (preset.delayMin != null) setDelayMin(preset.delayMin);
    if (preset.delayMax != null) setDelayMax(preset.delayMax);
  };

  const startCampaign = async () => {
    setError('');
    if (!confirmCompliance) {
      setError('Please confirm compliance with outreach regulations.');
      return;
    }
    if (senders.length === 0) {
      setError('Add at least one sender email.');
      return;
    }
    if (recipients.length === 0) {
      setError('No recipients. Run a scan first.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/campaigns/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scanId,
          recipients,
          senders: senders.map((s) => s.id),
          subjects: subjectLines.map((s) => s.value),
          templates: templates.map((t) => ({ body: t.body })),
          delayMin,
          delayMax,
          onePerStore,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start campaign');
      onCampaignStart(data.campaignId);
      onClose();
    } catch (e) {
      setError(e.message);
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

          {/* Sender pool */}
          <section className={sectionClass}>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Sender pool ({senders.length})</h3>
            {senders.length > 0 && (
              <ul className="text-sm text-slate-600 dark:text-slate-300 mb-3 space-y-2">
                {senders.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                    <span className="font-medium text-slate-700 dark:text-slate-200 truncate">{s.email} <span className="font-normal text-slate-500">(max {s.maxPerMinute}/min)</span></span>
                    <button type="button" onClick={() => removeSender(s.id)} className="shrink-0 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 text-xs font-medium" title="Remove from sender pool">Remove</button>
                  </li>
                ))}
              </ul>
            )}
            {senders.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">No senders. Add one below.</p>}
            {!showAddSender ? (
              <button type="button" onClick={() => setShowAddSender(true)} className="btn-secondary text-sm">+ Add sender</button>
            ) : (
              <div className="space-y-3 pt-2">
                <input type="email" placeholder="Sender email" value={newSender.email} onChange={(e) => setNewSender((s) => ({ ...s, email: e.target.value }))} className={inputClass} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="SMTP host" value={newSender.host} onChange={(e) => setNewSender((s) => ({ ...s, host: e.target.value }))} className={inputClass} />
                  <input type="number" placeholder="Port" value={newSender.port} onChange={(e) => setNewSender((s) => ({ ...s, port: e.target.value }))} className={inputClass} />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={newSender.secure} onChange={(e) => setNewSender((s) => ({ ...s, secure: e.target.checked }))} className="rounded border-slate-300" />
                  TLS/SSL
                </label>
                <input type="text" placeholder="SMTP user" value={newSender.user} onChange={(e) => setNewSender((s) => ({ ...s, user: e.target.value }))} className={inputClass} />
                <input type="password" placeholder="SMTP password / app password" value={newSender.pass} onChange={(e) => setNewSender((s) => ({ ...s, pass: e.target.value }))} className={inputClass} />
                <input type="number" min={1} max={60} placeholder="Max per minute" value={newSender.maxPerMinute} onChange={(e) => setNewSender((s) => ({ ...s, maxPerMinute: e.target.value }))} className={inputClass} />
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={addSender} className="btn-primary text-sm">Save sender</button>
                  <button type="button" onClick={() => setShowAddSender(false)} className="btn-secondary text-sm">Cancel</button>
                </div>
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
            <div className="flex flex-wrap gap-6 items-center">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <span className="font-medium">Delay between emails (sec):</span>
                <input type="number" min={1} max={60} value={delayMin} onChange={(e) => setDelayMin(Number(e.target.value))} className="w-14 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100" />
                <span>min</span>
                <input type="number" min={1} max={60} value={delayMax} onChange={(e) => setDelayMax(Number(e.target.value))} className="w-14 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100" />
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
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
              <strong className="text-slate-800 dark:text-slate-100">{recipients.length}</strong> recipients from current scan
            </p>
            <label className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" checked={confirmCompliance} onChange={(e) => setConfirmCompliance(e.target.checked)} className="rounded mt-0.5 border-slate-300 shrink-0" />
              <span>I confirm I am responsible for complying with outreach regulations.</span>
            </label>
          </section>

          {error && <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>}
        </div>

        {/* Sticky footer */}
        <div className="shrink-0 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 rounded-b-2xl flex gap-2">
          <button type="button" onClick={startCampaign} disabled={loading || senders.length === 0} className="btn-primary">
            {loading ? 'Starting…' : 'Start campaign'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}
