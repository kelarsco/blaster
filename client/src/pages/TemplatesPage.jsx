import React, { useState, useCallback, useEffect, useRef } from 'react';
import { FileText, Trash2, MoreVertical, Edit2 } from 'react-feather';
import { useAuth } from '../context/AuthContext';
import { usePlanAccess } from '../context/PlanAccessContext.jsx';
import { API } from '../api.js';
import { useConfirm } from '../context/ConfirmDialogContext.jsx';
import { useStaleWhileRevalidate } from '../hooks/useStaleWhileRevalidate.js';

export function TemplatesPage() {
  const { authFetch, user } = useAuth();
  const { requireActivePlan } = usePlanAccess();
  const confirm = useConfirm();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('{{store_url}}');
  const [body, setBody] = useState('Hi,\n\nI noticed your store: {{store_url}}\n\nBest regards');
  const [editingId, setEditingId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchPresets = useCallback(async () => {
    const res = await authFetch(`${API}/automation/presets`);
    if (!res.ok) return { presets: [] };
    const data = await res.json().catch(() => ({}));
    return { presets: Array.isArray(data?.presets) ? data.presets : [] };
  }, [authFetch]);

  const { data, loading, refetch: refetchPresets } = useStaleWhileRevalidate('templates', fetchPresets, {
    userId: user?.id,
    enabled: Boolean(authFetch),
  });

  const presets = data?.presets ?? [];

  const saveTemplate = async (e) => {
    e.preventDefault();
    if (!authFetch || !name.trim()) return;
    if (!requireActivePlan()) return;
    setSaving(true);
    setError('');
    try {
      const isEdit = editingId !== null;
      const url = isEdit ? `${API}/automation/presets/${editingId}` : `${API}/automation/presets`;
      const method = isEdit ? 'PUT' : 'POST';
      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          subjects: [subject.trim() || '{{store_url}}'],
          templates: [{ body: body.trim() }],
          delayMin: 10,
          delayMax: 30,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save template');
      setName('');
      setSubject('{{store_url}}');
      setBody('Hi,\n\nI noticed your store: {{store_url}}\n\nBest regards');
      setEditingId(null);
      refetchPresets();
    } catch (err) {
      setError(err?.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (preset) => {
    if (!authFetch || !preset?.id) return;
    if (!requireActivePlan()) return;
    const ok = await confirm({
      title: 'Delete template',
      message: `Delete template "${preset.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    setError('');
    setMenuOpen(null);
    try {
      const res = await authFetch(`${API}/automation/presets/${preset.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete template');
      }
      refetchPresets();
    } catch (err) {
      setError(err?.message || 'Failed to delete template');
    }
  };

  const editTemplate = (preset) => {
    setEditingId(preset.id);
    setName(preset.name);
    const subjectValue = typeof preset.subjects?.[0] === 'string' ? preset.subjects[0] : preset.subjects?.[0]?.value || '{{store_url}}';
    setSubject(subjectValue);
    const bodyValue = preset.templates?.[0]?.body || preset.templates?.[0]?.text || 'Hi,\n\nI noticed your store: {{store_url}}\n\nBest regards';
    setBody(bodyValue);
    setMenuOpen(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName('');
    setSubject('{{store_url}}');
    setBody('Hi,\n\nI noticed your store: {{store_url}}\n\nBest regards');
  };

  const inputClass =
    'w-full px-3 py-2 rounded-xl border border-blaster-border bg-white text-blaster-fg text-sm focus:ring-2 focus:ring-blaster-accent/30 focus:border-transparent';

  const templateSectionOuter =
    'rounded-2xl p-[1px] bg-gradient-to-br from-blaster-accent/50 via-blaster-accent/25 to-blaster-orange/60 shadow-sm';
  const templateSectionOuterLight =
    'rounded-2xl p-[1px] bg-gradient-to-br from-blaster-accent/25 via-blaster-accent/12 to-blaster-orange/30 shadow-sm';
  const templateSectionInner =
    'relative rounded-2xl bg-white p-5 sm:p-6 overflow-hidden';
  const templateSectionGlow =
    'pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_75%_at_bottom_right,rgba(252,176,76,0.14),rgba(99,102,241,0.06)_42%,transparent_72%)]';
  const templateSectionGlowLight =
    'pointer-events-none absolute inset-0 bg-gradient-to-tl from-blaster-orange/[0.08] via-blaster-accent/[0.03] to-transparent';

  return (
    <div className="min-h-full bg-blaster-sidebar p-4 sm:p-6 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="page-title-mobile">Templates</h1>
        <p className="text-xs md:text-sm text-blaster-muted mt-0.5">
          Save subject lines and email bodies for quick campaign setup
        </p>
      </div>

      <div className="max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
        <section className={templateSectionOuter}>
          <div className={templateSectionInner}>
            <div className={templateSectionGlow} aria-hidden />
            <div className="relative">
              <h2 className="text-sm font-semibold text-blaster-fg mb-4">
                {editingId ? 'Edit template' : 'Create template'}
              </h2>
              <form onSubmit={saveTemplate} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-blaster-muted mb-1.5">Template name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. First outreach"
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-blaster-muted mb-1.5">Subject line</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="{{store_url}}"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-blaster-muted mb-1.5">Email body</label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={6}
                    className={`${inputClass} min-h-[140px] resize-y`}
                  />
                  <p className="text-[11px] text-blaster-muted mt-1.5">
                    Variables: {'{{store_url}}'}, {'{{store_domain}}'}, {'{{brand_name}}'}
                  </p>
                </div>
                {error ? <p className="text-xs text-red-600">{error}</p> : null}
                <div className="flex gap-2">
                  {editingId && (
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={saving}
                      className="px-5 py-2.5 rounded-xl border border-blaster-border text-blaster-fg text-sm font-medium hover:bg-gray-50 transition disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={saving || !name.trim()}
                    className="px-5 py-2.5 rounded-xl bg-black border border-blaster-orange text-[#faf8f5] text-sm font-medium shadow-blaster-cta hover:opacity-90 transition disabled:opacity-40"
                  >
                    {saving ? 'Saving…' : editingId ? 'Update template' : 'Save template'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>

        <section className={templateSectionOuterLight}>
          <div className={templateSectionInner}>
            <div className={templateSectionGlowLight} aria-hidden />
            <div className="relative">
              <h2 className="text-sm font-semibold text-blaster-fg mb-4">Saved templates</h2>
              {loading ? (
                <p className="text-sm text-blaster-muted">Loading…</p>
              ) : presets.length === 0 ? (
                <div className="text-center py-10">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blaster-accent/10 to-blaster-orange/20 mb-3 mx-auto" aria-hidden>
                    <FileText className="w-6 h-6 text-blaster-accent" strokeWidth={1.75} />
                  </span>
                  <p className="text-sm font-medium text-blaster-fg">No templates yet</p>
                  <p className="text-xs text-blaster-muted mt-1">Create your first template on the left</p>
                </div>
              ) : (
                <div
                  className={`templates-list-scroll rounded-xl border border-blaster-border/70 bg-white/50 ${
                    presets.length > 4 ? 'overflow-y-auto max-h-[23rem] pr-1' : ''
                  }`}
                >
                  <ul className="divide-y divide-blaster-border/70">
                    {presets.map((preset) => {
                      const subjectPreview = preset.subjects?.[0];
                      const bodyPreview = preset.templates?.[0]?.body || preset.templates?.[0]?.text;
                      return (
                        <li
                          key={preset.id}
                          className="p-4 bg-white/40 hover:bg-white/60 transition min-h-[5.75rem]"
                        >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-blaster-fg">{preset.name}</p>
                            {subjectPreview ? (
                              <p className="text-xs text-blaster-muted mt-1 truncate">
                                Subject: {typeof subjectPreview === 'string' ? subjectPreview : subjectPreview.value}
                              </p>
                            ) : null}
                            {bodyPreview ? (
                              <p className="text-xs text-blaster-muted mt-1 line-clamp-2">{bodyPreview}</p>
                            ) : null}
                          </div>
                          <div className="relative shrink-0" ref={menuOpen === preset.id ? menuRef : null}>
                            <button
                              type="button"
                              onClick={() => setMenuOpen(menuOpen === preset.id ? null : preset.id)}
                              className="p-2 rounded-lg text-blaster-muted hover:text-blaster-fg hover:bg-gray-100 transition"
                              aria-label="Options"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {menuOpen === preset.id && (
                              <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg border border-blaster-border shadow-lg z-10">
                                <button
                                  type="button"
                                  onClick={() => editTemplate(preset)}
                                  className="w-full px-3 py-2 text-left text-sm text-blaster-fg hover:bg-gray-50 flex items-center gap-2 rounded-t-lg"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteTemplate(preset)}
                                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 rounded-b-lg"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
