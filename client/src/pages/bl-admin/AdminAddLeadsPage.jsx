import React, { useState } from 'react';
import { useAdmin } from '../../context/AdminContext.jsx';
import { AdminPageHeader, AdminPanel, adminInput, adminPrimaryBtn } from '../../components/admin';

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
      <AdminPageHeader
        backTo="/bl-admin/lead-engine"
        backLabel="Back to Lead Engine"
        title="Add leads"
        subtitle="Paste store URLs (one per line). Each store enters the qualification pipeline and only appears on the Leads page after passing Phase 1 and completing categorization."
      />

      <AdminPanel bodyClassName="p-5 sm:p-6">
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-blaster-fg">Store URLs</span>
            <textarea
              value={urlsText}
              onChange={(e) => setUrlsText(e.target.value)}
              rows={12}
              placeholder={'https://example-store.com\nwww.another-store.com'}
              className={`${adminInput} mt-2 font-mono resize-y min-h-[200px]`}
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {result && (
            <div className="text-sm text-blaster-muted bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <p>
                <strong>{result.added}</strong> store(s) queued for qualification.
                {result.skipped > 0 && ` ${result.skipped} duplicate(s) skipped.`}
              </p>
              <p className="mt-1 text-xs">The pipeline will score and categorize each store automatically.</p>
            </div>
          )}

          <button type="submit" disabled={submitting} className={adminPrimaryBtn}>
            {submitting ? 'Adding…' : 'Add to leads pipeline'}
          </button>
        </form>
      </AdminPanel>
    </div>
  );
}
