import React, { useEffect, useMemo, useState } from 'react';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext';

const infoCopy = 'This feature does not replace your email inbox. It connects to your domain to send campaigns and mirror replies in your dashboard.';

export function DomainEmailSendingPage() {
  const { authFetch } = useAuth();
  const [providers, setProviders] = useState([]);
  const [domains, setDomains] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDnsGuide, setShowDnsGuide] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');

  const [domainForm, setDomainForm] = useState({ domain: '', provider: 'resend', providerApiKey: '' });
  const verifiedDomains = useMemo(() => domains.filter((d) => d.status === 'verified'), [domains]);
  const hasVerifiedDomain = verifiedDomains.length > 0;
  const pendingDomains = useMemo(() => domains.filter((d) => d.status !== 'verified'), [domains]);

  async function loadAll() {
    if (!authFetch) return;
    const [p, d] = await Promise.all([
      authFetch(`${API}/domain-email/providers`).then((r) => (r.ok ? r.json() : { providers: [] })),
      authFetch(`${API}/domain-email/domains`).then((r) => (r.ok ? r.json() : { domains: [] })),
    ]);
    setProviders(p.providers || []);
    setDomains(d.domains || []);
  }

  useEffect(() => {
    loadAll().catch((e) => setError(e?.message || 'Failed to load domain sending data'));
  }, [authFetch]);

  useEffect(() => {
    if (!authFetch) return;
    const pending = pendingDomains.map((d) => d.id);
    if (!pending.length) return;
    const timer = setInterval(async () => {
      for (const id of pending) {
        await authFetch(`${API}/domain-email/domains/${id}/verify`, { method: 'POST' }).catch(() => null);
      }
      await loadAll().catch(() => null);
    }, 30000);
    return () => clearInterval(timer);
  }, [authFetch, pendingDomains]);

  async function addDomain() {
    setError('');
    setSuccess('');
    const domain = domainForm.domain.trim().toLowerCase();
    if (!domain) return setError('Enter a domain');
    const res = await authFetch(`${API}/domain-email/domains`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(domainForm),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error || 'Failed to add domain');
    setDomainForm({ domain: '', provider: domainForm.provider || 'resend', providerApiKey: '' });
    setSuccess('Domain added. Add DNS records and click Verify.');
    await loadAll();
  }

  async function verifyDomain(domainId) {
    setError('');
    setSuccess('');
    const res = await authFetch(`${API}/domain-email/domains/${domainId}/verify`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error || 'Verification check failed');
    setSuccess(data.status === 'verified' ? 'Domain verified successfully.' : `Domain still pending: ${data.reason || 'check DNS'}`);
    await loadAll();
  }

  async function syncDomainWithProvider(domainId) {
    setError('');
    setSuccess('');
    const res = await authFetch(`${API}/domain-email/domains/${domainId}/sync-provider`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error || 'Provider sync failed');
    setSuccess('Domain synced with provider. Re-run verify now.');
    await loadAll();
  }

  async function removeDomain(domainId) {
    setError('');
    const res = await authFetch(`${API}/domain-email/domains/${domainId}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error || 'Failed to remove domain');
    await loadAll();
  }

  async function copyText(value, key) {
    try {
      await navigator.clipboard.writeText(String(value || ''));
      setCopiedKey(String(key || ''));
      setTimeout(() => {
        setCopiedKey((prev) => (prev === String(key || '') ? '' : prev));
      }, 1200);
    } catch {
      setError('Copy failed. Please copy manually.');
    }
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border p-4 md:p-6">
        <h1 className="page-title-mobile">Domain Email Sending</h1>
        <p className="text-xs md:text-sm text-blaster-muted mt-1">{infoCopy}</p>
      </section>

      {error ? <div className="rounded-lg border border-red-300 bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div> : null}
      {success ? <div className="rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 text-sm px-3 py-2">{success}</div> : null}

      {hasVerifiedDomain && (
        <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border p-4 md:p-6">
          <h2 className="card-title-mobile">Verified domains</h2>
          <div className="mt-3 space-y-2">
            {verifiedDomains.map((d) => (
              <div key={`${d.id}-verified`} className="rounded-lg border border-blaster-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-blaster-fg">
                    <span className="font-semibold">{d.domain}</span> - {String(d.provider || '').toUpperCase()} -{' '}
                    <span className="text-emerald-600">verified</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => syncDomainWithProvider(d.id)}
                      className="px-3 py-1.5 rounded-lg border border-blaster-border text-sm"
                    >
                      Re-sync
                    </button>
                    <button type="button" onClick={() => removeDomain(d.id)} className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-sm">
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border p-4 md:p-6">
        <h2 className="card-title-mobile">Step 1: Add sending domain</h2>
        <p className="text-sm text-blaster-muted mt-2">You can add more than one domain.</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
          <input
            value={domainForm.domain}
            onChange={(e) => setDomainForm((f) => ({ ...f, domain: e.target.value }))}
            placeholder="example.com"
            className="px-3 py-2 rounded-lg border border-blaster-border bg-white text-blaster-fg"
          />
          <select
            value={domainForm.provider}
            onChange={(e) => setDomainForm((f) => ({ ...f, provider: e.target.value }))}
            className="px-3 py-2 rounded-lg border border-blaster-border bg-white text-blaster-fg"
          >
            {(providers || []).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <input
            value={domainForm.providerApiKey}
            onChange={(e) => setDomainForm((f) => ({ ...f, providerApiKey: e.target.value }))}
            placeholder="Provider API key (optional)"
            className="px-3 py-2 rounded-lg border border-blaster-border bg-white text-blaster-fg"
          />
          <button type="button" onClick={addDomain} className="btn-blaster-accent">Add Domain</button>
        </div>
      </section>

      {pendingDomains.length > 0 && (
        <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border p-4 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="card-title-mobile">Step 2: DNS verification</h2>
            <button
              type="button"
              onClick={() => setShowDnsGuide((v) => !v)}
              className="w-7 h-7 rounded-full border border-blaster-border text-sm font-semibold text-blaster-fg hover:bg-blaster-bg-app transition"
              title="How to add DNS records"
              aria-label="How to add DNS records"
            >
              ?
            </button>
          </div>
          {showDnsGuide && (
            <div className="mt-3 rounded-lg border border-blaster-border bg-blaster-bg-app/40 p-3">
              <p className="text-sm text-blaster-fg font-medium">How to add these DNS records</p>
              <ol className="mt-2 text-xs md:text-sm text-blaster-muted space-y-1 list-decimal list-inside">
                <li>Open your DNS provider (Cloudflare, GoDaddy, Namecheap, etc).</li>
                <li>Open DNS management for your domain.</li>
                <li>Create each record exactly as shown below (Type, Host, Value).</li>
                <li>Save records, wait for propagation (usually a few minutes to a few hours).</li>
                <li>Click Verify on this page.</li>
              </ol>
              <div className="mt-3 space-y-3">
                {pendingDomains.map((d) => (
                  <div key={`${d.id}-guide`} className="rounded-lg border border-blaster-border bg-white p-3">
                    <p className="text-sm font-medium text-blaster-fg mb-2">
                      {d.domain} ({String(d.provider || '').toUpperCase()})
                    </p>
                    <div className="space-y-2">
                      {(d.dnsRecords || []).map((r, idx) => (
                        <div key={`${d.id}-${idx}`} className="rounded-md border border-blaster-border p-2">
                          <p className="text-xs text-blaster-muted mb-1">
                            {r.purpose} - <span className="text-blaster-fg">{r.type}</span>
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div
                              className="relative rounded border border-blaster-border px-2 py-1 text-xs bg-blaster-bg-app/40 cursor-copy hover:bg-blaster-bg-app/60 transition"
                              onClick={() => copyText(r.host, `${d.id}-${idx}-host`)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') copyText(r.host, `${d.id}-${idx}-host`);
                              }}
                              title="Click to copy host"
                            >
                              {copiedKey === `${d.id}-${idx}-host` ? (
                                <span className="absolute right-1 top-1 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px]">
                                  Copied
                                </span>
                              ) : null}
                              <div className="text-[11px] text-blaster-muted mb-1">Host (copy/paste)</div>
                              <div className="break-all text-blaster-fg">{r.host}</div>
                            </div>
                            <div
                              className="relative rounded border border-blaster-border px-2 py-1 text-xs bg-blaster-bg-app/40 cursor-copy hover:bg-blaster-bg-app/60 transition"
                              onClick={() => copyText(r.value, `${d.id}-${idx}-value`)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') copyText(r.value, `${d.id}-${idx}-value`);
                              }}
                              title="Click to copy value"
                            >
                              {copiedKey === `${d.id}-${idx}-value` ? (
                                <span className="absolute right-1 top-1 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px]">
                                  Copied
                                </span>
                              ) : null}
                              <div className="text-[11px] text-blaster-muted mb-1">Value (copy/paste)</div>
                              <div className="break-all text-blaster-fg">{r.value}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-4 mt-3">
            {pendingDomains.map((d) => (
              <div key={d.id} className="rounded-lg border border-blaster-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="text-sm text-blaster-fg">
                    <span className="font-semibold">{d.domain}</span> - {String(d.provider || '').toUpperCase()} -{' '}
                    <span className={d.status === 'verified' ? 'text-emerald-600' : 'text-amber-600'}>{d.status}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => syncDomainWithProvider(d.id)}
                      className="px-3 py-1.5 rounded-lg border border-blaster-border text-sm"
                    >
                      Re-sync
                    </button>
                    <button type="button" onClick={() => verifyDomain(d.id)} className="px-3 py-1.5 rounded-lg border border-blaster-border text-sm">
                      Verify
                    </button>
                    <button type="button" onClick={() => removeDomain(d.id)} className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-sm">
                      Remove
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-blaster-muted">
                        <th className="py-1 pr-2">Type</th>
                        <th className="py-1 pr-2">Host</th>
                        <th className="py-1 pr-2">Value</th>
                        <th className="py-1">Purpose</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(d.dnsRecords || []).map((r, idx) => (
                        <tr key={idx} className="border-t border-blaster-border">
                          <td className="py-1 pr-2">{r.type}</td>
                          <td className="py-1 pr-2">{r.host}</td>
                          <td className="py-1 pr-2 break-all">{r.value}</td>
                          <td className="py-1">{r.purpose}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-blaster-muted mt-2 break-all">
                  Inbound webhook URL: <span className="text-blaster-fg">{`${API}/domain-email/webhooks/${d.provider}/${d.id}`}</span>
                </p>
                {d.verificationError ? <p className="text-xs text-amber-700 mt-2">Verification note: {d.verificationError}</p> : null}
              </div>
            ))}
          </div>
        </section>
      )}

      {hasVerifiedDomain && (
        <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border p-4 md:p-6">
          <h2 className="card-title-mobile">Step 3: Add sender identities</h2>
          <p className="text-sm text-blaster-muted mt-2">
            Great — your domain is verified. Next, go to the Senders page to add domain sender identities.
          </p>
          <div className="mt-3">
            <a href="/app/senders" className="btn-blaster-accent inline-flex">
              Go to Senders
            </a>
          </div>
        </section>
      )}

      {pendingDomains.length > 0 && !hasVerifiedDomain && (
        <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border p-4 md:p-6">
          <h2 className="card-title-mobile">Next step</h2>
          <p className="text-sm text-blaster-muted mt-2">
            Verify your DNS records first. Once a domain is verified, you will be prompted to add sender identities in the Senders page.
          </p>
        </section>
      )}
    </div>
  );
}
