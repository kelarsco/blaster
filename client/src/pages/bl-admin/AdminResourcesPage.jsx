import React, { useState, useEffect, useCallback } from 'react';
import { Trash2 } from 'react-feather';
import { useAdmin } from '../../context/AdminContext';
import { ResourceTypeToggle } from '../../components/resources/ResourceTypeToggle.jsx';
import { getYoutubeVideoId } from '../../utils/youtube.js';

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
  const [listTab, setListTab] = useState('video');
  const [addType, setAddType] = useState('video');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
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
        body: JSON.stringify({ type: addType, title: trimmedTitle, url: trimmedUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to add resource');
      setTitle('');
      setUrl('');
      setMessage('Resource added.');
      setListTab(addType);
      loadAll();
    } catch (err) {
      setError(err.message || 'Failed to add resource');
    } finally {
      setSaving(false);
    }
  };

  const deleteResource = async (id) => {
    if (!window.confirm('Delete this resource?')) return;
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
      <h1 className="text-2xl font-bold text-blaster-fg mb-1">Resources</h1>
      <p className="text-sm text-blaster-muted mb-6">
        Add videos and PDFs shown on the app Resources page.
      </p>

      <section className="bg-white rounded-2xl border border-blaster-border p-5 sm:p-6 mb-6">
        <h2 className="text-sm font-semibold text-blaster-fg mb-4">Add resource</h2>
        <form onSubmit={addResource} className="space-y-4">
          <div>
            <span className="text-xs font-medium text-blaster-muted block mb-2">Type</span>
            <ResourceTypeToggle value={addType} onChange={setAddType} />
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
              className="w-full px-3 py-2.5 rounded-xl border border-blaster-border text-sm text-blaster-fg bg-white focus:outline-none focus:ring-2 focus:ring-blaster-accent/30"
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
              className="w-full px-3 py-2.5 rounded-xl border border-blaster-border text-sm text-blaster-fg bg-white focus:outline-none focus:ring-2 focus:ring-blaster-accent/30"
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-black border border-blaster-orange text-[#faf8f5] text-sm font-medium shadow-blaster-cta hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? 'Adding…' : 'Add resource'}
          </button>
        </form>
      </section>

      <section className="bg-white rounded-2xl border border-blaster-border p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold text-blaster-fg">Published</h2>
          <ResourceTypeToggle value={listTab} onChange={setListTab} />
        </div>
        {loading ? (
          <p className="text-sm text-blaster-muted">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-blaster-muted">No {listTab === 'video' ? 'videos' : 'PDFs'} yet.</p>
        ) : (
          <ul className="divide-y divide-blaster-border">
            {filtered.map((r) => (
              <li key={r.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blaster-fg truncate">{r.title}</p>
                  <p className="text-xs text-blaster-muted truncate mt-0.5">{r.url}</p>
                  <p className="text-xs text-blaster-muted mt-1">{formatAddedAt(r.createdAt)}</p>
                </div>
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
      </section>
    </div>
  );
}
