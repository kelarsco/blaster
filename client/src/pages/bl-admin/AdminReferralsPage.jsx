import React, { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '../../context/AdminContext';
import { formatUTCDateOnly } from '../../utils/dateUtils';

export function AdminReferralsPage() {
  const { adminFetch } = useAdmin();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/referrals');
      if (res.ok) setData(await res.json());
    } catch (_) {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [adminFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = data?.stats || {};
  const topReferrers = data?.topReferrers || [];
  const recentReferrals = data?.recentReferrals || [];

  const cards = [
    { label: 'Total signups via referral', value: stats.totalReferrals ?? 0 },
    { label: 'Paid upgrades from referrals', value: stats.totalUpgrades ?? 0 },
    { label: 'Active referrers', value: stats.activeReferrers ?? 0 },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-blaster-fg">Referral Program</h1>
        <p className="text-sm text-blaster-muted mt-1">
          Monitor referral signups, paid upgrades, tier rewards, and top referrers.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-blaster-muted">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-blaster-border border border-blaster-border rounded-2xl bg-white mb-6">
            {cards.map((c) => (
              <div key={c.label} className="px-5 py-6">
                <p className="text-sm text-blaster-muted mb-2">{c.label}</p>
                <p className="text-2xl font-semibold text-blaster-fg">{Number(c.value).toLocaleString()}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="border border-blaster-border rounded-2xl bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-blaster-border bg-blaster-sidebar/30">
                <h2 className="text-sm font-semibold text-blaster-fg">Top referrers</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-blaster-muted border-b border-blaster-border">
                      <th className="px-4 py-2">User</th>
                      <th className="px-4 py-2">Code</th>
                      <th className="px-4 py-2">Clicks</th>
                      <th className="px-4 py-2">Signups</th>
                      <th className="px-4 py-2">Upgrades</th>
                      <th className="px-4 py-2">Tiers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topReferrers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-blaster-muted">No referrers yet</td>
                      </tr>
                    ) : (
                      topReferrers.map((r) => (
                        <tr key={r.id} className="border-b border-blaster-border/60 last:border-0">
                          <td className="px-4 py-2">
                            <div className="font-medium text-blaster-fg">{r.name || '—'}</div>
                            <div className="text-xs text-blaster-muted">{r.email}</div>
                          </td>
                          <td className="px-4 py-2 font-mono text-xs">{r.referral_code}</td>
                          <td className="px-4 py-2">{r.referral_link_clicks ?? 0}</td>
                          <td className="px-4 py-2">{r.signup_referral_count ?? 0}</td>
                          <td className="px-4 py-2">{r.upgrade_referral_count ?? 0}</td>
                          <td className="px-4 py-2 text-xs">
                            {r.tier_1_claimed ? 'T1 ' : ''}
                            {r.tier_2_claimed ? 'T2 ' : ''}
                            {r.tier_3_claimed ? 'T3' : ''}
                            {!r.tier_1_claimed && !r.tier_2_claimed && !r.tier_3_claimed ? '—' : ''}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="border border-blaster-border rounded-2xl bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-blaster-border bg-blaster-sidebar/30">
                <h2 className="text-sm font-semibold text-blaster-fg">Recent referral signups</h2>
              </div>
              <div className="overflow-x-auto max-h-[480px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-left text-blaster-muted border-b border-blaster-border">
                      <th className="px-4 py-2">Referred</th>
                      <th className="px-4 py-2">Referrer</th>
                      <th className="px-4 py-2">Signed up</th>
                      <th className="px-4 py-2">Upgraded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentReferrals.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-blaster-muted">No referrals yet</td>
                      </tr>
                    ) : (
                      recentReferrals.map((r) => (
                        <tr key={r.id} className="border-b border-blaster-border/60 last:border-0">
                          <td className="px-4 py-2 text-xs">{r.referred_email}</td>
                          <td className="px-4 py-2 text-xs">
                            <div>{r.referrer_email}</div>
                            <div className="text-blaster-muted font-mono">{r.referrer_code}</div>
                          </td>
                          <td className="px-4 py-2 text-xs">{formatUTCDateOnly(r.signed_up_at)}</td>
                          <td className="px-4 py-2 text-xs">
                            {r.counts_toward_reward
                              ? `${r.plan_upgraded_to || 'paid'} · ${formatUTCDateOnly(r.upgraded_at)}`
                              : 'Free'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
