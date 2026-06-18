import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'react-feather';
import { useAdmin } from '../../context/AdminContext.jsx';

export function AdminAddLeadsPage() {
  const { adminFetch } = useAdmin();
  const [urlsText, setUrlsText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    const lines = urlsText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!lines.length) {
      setError('Paste at least one store URL.');
      return;
    }
    setSubmitting(true);
    setError('');
    setResult(null);
    try {
      const res = await adminFetch('/lead-engine/stores/manual', {
        method: 'POST',
        body: JSON.stringify({ urls: lines }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to add stores');
      setResult(data);
      setUrlsText('');
    } catch (err) {
      setError(err.message || 'Failed to add stores');
    }
    setSubmitting(false);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        to="/bl-admin/lead-engine"
        className="inline-flex items-center gap-2 text-sm text-blaster-muted hover:text-blaster-fg"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Lead Engine
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-blaster-fg">Add leads</h1>
        <p className="text-sm text-blaster-muted mt-1">
          Paste store URLs (one per line). Each store enters the qualification pipeline and only appears on the Leads
          page after passing Phase 1 (active score ≥ 21) and completing categorization.
        </p>
      </div>

      <form onSubmit={submit} className="rounded-xl border border-blaster-border bg-white p-5 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-blaster-fg">Store URLs</span>
          <textarea
            value={urlsText}
            onChange={(e) => setUrlsText(e.target.value)}
            rows={12}
            placeholder="https://example-store.com&#10;www.another-store.com"
            className="mt-2 w-full rounded-lg border border-blaster-border px-3 py-2 text-sm font-mono resize-y min-h-[200px] focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {result && (
          <div className="text-sm text-blaster-muted bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <p>
              <strong>{result.added}</strong> store(s) queued for qualification.
              {result.skipped > 0 && ` ${result.skipped} duplicate(s) skipped.`}
            </p>
            <p className="mt-1 text-xs">The pipeline will score and categorize each store automatically.</p>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2.5 text-sm font-medium rounded-lg bg-blaster-fg text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Adding…' : 'Add to leads pipeline'}
        </button>
      </form>
    </div>
  );
}
