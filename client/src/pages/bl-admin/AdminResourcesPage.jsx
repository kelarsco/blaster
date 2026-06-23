import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, Star } from 'react-feather';
import { useAdmin } from '../../context/AdminContext';
import { ResourceTypeToggle } from '../../components/resources/ResourceTypeToggle.jsx';
import { getYoutubeVideoId } from '../../utils/youtube.js';
import { useConfirm } from '../../context/ConfirmDialogContext.jsx';
import { AdminPageHeader, AdminPanel, adminInput, adminPrimaryBtn } from '../../components/admin';

function formatAddedAt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminResourcesPage() {
  const { adminFetch } = useAdmin();
  const confirm = useConfirm();
  const [listTab, setListTab] = useState('video');
  const [addType, setAddType] = useState('video');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [isPriority, setIsPriority] = useState(false);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const fetchResources = useCallback(
    (type) => {
      return adminFetch(`/resources?type=${type}`)
        .then((r) => (r.ok ? r.json() : { resources: [] }))
        .then((data) => (Array.isArray(data?.resources) ? data.resources : []))
        .catch(() => []);
    },
    [adminFetch]
  );

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([fetchResources('video'), fetchResources('document')])
      .then(([videos, documents]) => {
        setResources([...videos, ...documents]);
      })
      .finally(() => setLoading(false));
  }, [fetchResources]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const filtered = resources.filter((r) => r.type === listTab);

  const addResource = async (e) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedUrl = url.trim();
    if (!trimmedTitle || !trimmedUrl) {
      setError('Title and URL are required.');
      return;
    }
    if (addType === 'video' && !getYoutubeVideoId(trimmedUrl)) {
      setError('Enter a valid YouTube link.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await adminFetch('/resources', {
        method: 'POST',
        body: JSON.stringify({
          type: addType,
          title: trimmedTitle,
          url: trimmedUrl,
          isPriority: addType === 'video' ? isPriority : false,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to add resource');
      setTitle('');
      setUrl('');
      setIsPriority(false);
      setMessage('Resource added.');
      setListTab(addType);
      loadAll();
    } catch (err) {
      setError(err.message || 'Failed to add resource');
    } finally {
      setSaving(false);
    }
  };

  const togglePriority = async (resource) => {
    if (resource.type !== 'video') return;
    setError('');
    try {
      const res = await adminFetch(`/resources/${resource.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPriority: !resource.isPriority }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      loadAll();
    } catch (err) {
      setError(err.message || 'Failed to update priority');
    }
  };

  const deleteResource = async (id) => {
    const ok = await confirm({
      title: 'Delete resource',
      message: 'Delete this resource? This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    setError('');
    try {
      const res = await adminFetch(`/resources/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete');
      }
      loadAll();
    } catch (err) {
      setError(err.message || 'Failed to delete');
    }
  };

  const urlLabel = addType === 'video' ? 'YouTube link' : 'PDF link';
  const urlPlaceholder =
    addType === 'video' ? 'https://www.youtube.com/watch?v=…' : 'https://example.com/guide.pdf';

  return (
    <div className="max-w-3xl">
      <AdminPageHeader
        title="Resources"
        subtitle="Add videos and PDFs shown on the app Resources page."
      />

      <AdminPanel title="Add resource" className="mb-6" bodyClassName="p-5 sm:p-6">
        <form onSubmit={addResource} className="space-y-4">
          <div>
            <span className="text-xs font-medium text-blaster-muted block mb-2">Type</span>
            <ResourceTypeToggle
              value={addType}
              onChange={(t) => {
                setAddType(t);
                if (t !== 'video') setIsPriority(false);
              }}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-blaster-muted block mb-1.5" htmlFor="resource-title">
              Title
            </label>
            <input
              id="resource-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Getting started with wiblaster"
              className={adminInput}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-blaster-muted block mb-1.5" htmlFor="resource-url">
              {urlLabel}
            </label>
            <input
              id="resource-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={urlPlaceholder}
              className={adminInput}
            />
          </div>
          {addType === 'video' ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsPriority((v) => !v)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                  isPriority
                    ? 'border-amber-400 bg-amber-50 text-amber-700'
                    : 'border-blaster-border text-blaster-muted hover:text-blaster-fg hover:bg-blaster-bg-app'
                }`}
                aria-pressed={isPriority}
              >
                <Star
                  className="w-4 h-4"
                  strokeWidth={1.75}
                  fill={isPriority ? 'currentColor' : 'none'}
                />
                Priority announcement
              </button>
              <p className="text-xs text-blaster-muted">
                Shows a highlighted popup on user dashboards.
              </p>
            </div>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
          <button type="submit" disabled={saving} className={adminPrimaryBtn}>
            {saving ? 'Adding…' : 'Add resource'}
          </button>
        </form>
      </AdminPanel>

      <AdminPanel
        title="Published"
        actions={<ResourceTypeToggle value={listTab} onChange={setListTab} />}
        bodyClassName="p-5 sm:p-6"
      >
        {loading ? (
          <p className="text-sm text-blaster-muted">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-blaster-muted">No {listTab === 'video' ? 'videos' : 'PDFs'} yet.</p>
        ) : (
          <ul className="divide-y divide-blaster-border">
            {filtered.map((r) => (
              <li key={r.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blaster-fg truncate">
                    {r.title}
                    {r.isPriority ? (
                      <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                        <Star className="w-3 h-3" fill="currentColor" strokeWidth={0} />
                        Priority
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-blaster-muted truncate mt-0.5">{r.url}</p>
                  <p className="text-xs text-blaster-muted mt-1">{formatAddedAt(r.createdAt)}</p>
                </div>
                {r.type === 'video' ? (
                  <button
                    type="button"
                    onClick={() => togglePriority(r)}
                    className={`p-2 rounded-lg shrink-0 transition-colors ${
                      r.isPriority
                        ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                        : 'text-blaster-muted hover:text-amber-600 hover:bg-amber-50'
                    }`}
                    aria-label={r.isPriority ? 'Remove priority' : 'Mark as priority'}
                    title={r.isPriority ? 'Remove priority' : 'Mark as priority announcement'}
                  >
                    <Star
                      className="w-4 h-4"
                      strokeWidth={1.75}
                      fill={r.isPriority ? 'currentColor' : 'none'}
                    />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => deleteResource(r.id)}
                  className="p-2 rounded-lg text-blaster-muted hover:text-red-600 hover:bg-red-50 shrink-0"
                  aria-label="Delete"
                >
                  <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </AdminPanel>
    </div>
  );
}
