import React, { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '../../context/AdminContext';
import { formatUTCDateOnly } from '../../utils/dateUtils';
import { AdminPageHeader, AdminStatGrid, AdminPanel } from '../../components/admin';

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
    { label: 'Total signups via referral', value: (stats.totalReferrals ?? 0).toLocaleString() },
    { label: 'Paid upgrades from referrals', value: (stats.totalUpgrades ?? 0).toLocaleString() },
    { label: 'Active referrers', value: (stats.activeReferrers ?? 0).toLocaleString() },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Referral Program"
        subtitle="Monitor referral signups, paid upgrades, tier rewards, and top referrers."
      />

      {loading ? (
        <p className="text-sm text-blaster-muted">Loading…</p>
      ) : (
        <>
          <AdminStatGrid items={cards} columns={3} className="mb-6" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AdminPanel title="Top referrers">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-blaster-muted border-b border-blaster-border">
                      <th className="px-4 py-3 font-medium">User</th>
                      <th className="px-4 py-3 font-medium">Code</th>
                      <th className="px-4 py-3 font-medium">Clicks</th>
                      <th className="px-4 py-3 font-medium">Signups</th>
                      <th className="px-4 py-3 font-medium">Upgrades</th>
                      <th className="px-4 py-3 font-medium">Tiers</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blaster-border/60">
                    {topReferrers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-blaster-muted">No referrers yet</td>
                      </tr>
                    ) : (
                      topReferrers.map((r) => (
                        <tr key={r.id} className="hover:bg-blaster-sidebar-hover/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium text-blaster-fg">{r.name || '—'}</div>
                            <div className="text-xs text-blaster-muted">{r.email}</div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">{r.referral_code}</td>
                          <td className="px-4 py-3">{r.referral_link_clicks ?? 0}</td>
                          <td className="px-4 py-3">{r.signup_referral_count ?? 0}</td>
                          <td className="px-4 py-3">{r.upgrade_referral_count ?? 0}</td>
                          <td className="px-4 py-3 text-xs">
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
            </AdminPanel>

            <AdminPanel title="Recent referral signups">
              <div className="overflow-x-auto max-h-[480px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-blaster-bg-card z-10">
                    <tr className="text-left text-blaster-muted border-b border-blaster-border">
                      <th className="px-4 py-3 font-medium">Referred</th>
                      <th className="px-4 py-3 font-medium">Referrer</th>
                      <th className="px-4 py-3 font-medium">Signed up</th>
                      <th className="px-4 py-3 font-medium">Upgraded</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blaster-border/60">
                    {recentReferrals.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-blaster-muted">No referrals yet</td>
                      </tr>
                    ) : (
                      recentReferrals.map((r) => (
                        <tr key={r.id} className="hover:bg-blaster-sidebar-hover/30 transition-colors">
                          <td className="px-4 py-3 text-xs">{r.referred_email}</td>
                          <td className="px-4 py-3 text-xs">
                            <div>{r.referrer_email}</div>
                            <div className="text-blaster-muted font-mono">{r.referrer_code}</div>
                          </td>
                          <td className="px-4 py-3 text-xs">{formatUTCDateOnly(r.signed_up_at)}</td>
                          <td className="px-4 py-3 text-xs">
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
            </AdminPanel>
          </div>
        </>
      )}
    </div>
  );
}
