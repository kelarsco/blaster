import React, { useState, useEffect, useCallback } from 'react';
import { Mail } from 'react-feather';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext';
import { usePlanAccess } from '../context/PlanAccessContext.jsx';

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
      ✓ Verified
    </span>
  );
}

function FailedBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">
      ✗ Failed
    </span>
  );
}

function statusBadge(sender) {
  const status = sender.verificationStatus || (sender.provider === 'google' ? 'verified' : 'pending');
  if (status === 'verified') return <VerifiedBadge />;
  if (status === 'failed') return <FailedBadge />;
  return <span className="text-[11px] text-blaster-muted">Pending</span>;
}

export function SendersPage() {
  const auth = useAuth();
  const authFetch = auth?.authFetch;
  const { status, openUpgradeModal, refresh } = usePlanAccess();

  const [groups, setGroups] = useState([]);
  const [maxPerGroup, setMaxPerGroup] = useState(10);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [manualEmail, setManualEmail] = useState({});
  const [manualError, setManualError] = useState({});
  const [addingGroupId, setAddingGroupId] = useState(null);
  const [expandedGroupId, setExpandedGroupId] = useState(null);

  const fetchGroups = useCallback(() => {
    if (!authFetch) return;
    authFetch(`${API}/automation/senders/groups`)
      .then((r) => r.json())
      .then((d) => {
        setGroups(d.groups || []);
        setMaxPerGroup(d.maxSendersPerGroup ?? 10);
      })
      .catch(() => {});
  }, [authFetch]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const createGroup = async () => {
    if (!newGroupName.trim() || !authFetch) return;
    if ((status?.groupsUsed ?? 0) >= (status?.groupsMax ?? 999999)) {
      openUpgradeModal({
        title: 'Group limit reached',
        message: 'Upgrade to add more sender groups.',
        tierName: 'Basic',
        tierPrice: '$3.99/month',
      });
      return;
    }
    setError('');
    try {
      const res = await authFetch(`${API}/automation/senders/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGroupName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setNewGroupName('');
      setShowNewGroup(false);
      setExpandedGroupId(data.id);
      fetchGroups();
      refresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const deleteGroup = async (groupId) => {
    if (!authFetch || !window.confirm('Delete this sender group and all its email links?')) return;
    try {
      const res = await authFetch(`${API}/automation/senders/groups/${groupId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      fetchGroups();
    } catch (e) {
      setError(e.message);
    }
  };

  const removeEmail = async (groupId, senderId) => {
    if (!authFetch) return;
    try {
      const res = await authFetch(`${API}/automation/senders/groups/${groupId}/emails/${senderId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      fetchGroups();
    } catch (e) {
      setError(e.message);
    }
  };

  const addManualEmail = async (groupId) => {
    const email = (manualEmail[groupId] || '').trim();
    if (!email || !authFetch) return;
    if ((status?.sendersUsed ?? 0) >= (status?.sendersMax ?? 999999)) {
      openUpgradeModal({
        title: 'Sender limit reached',
        message: 'Upgrade to add more senders.',
        tierName: 'Basic',
        tierPrice: '$3.99/month',
      });
      return;
    }
    setManualError((prev) => ({ ...prev, [groupId]: '' }));
    setAddingGroupId(groupId);
    try {
      const res = await authFetch(`${API}/automation/senders/groups/${groupId}/emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setManualError((prev) => ({
          ...prev,
          [groupId]: data.error || 'This email could not be verified. Please check the address or try a different one.',
        }));
        return;
      }
      setManualEmail((prev) => ({ ...prev, [groupId]: '' }));
      fetchGroups();
      refresh();
    } catch (e) {
      setManualError((prev) => ({ ...prev, [groupId]: e.message }));
    } finally {
      setAddingGroupId(null);
    }
  };

  const tryOpenNewGroup = () => {
    if ((status?.groupsUsed ?? 0) >= (status?.groupsMax ?? 999999)) {
      openUpgradeModal({
        title: 'Group limit reached',
        message: 'Upgrade to add more sender groups.',
        tierName: 'Basic',
        tierPrice: '$3.99/month',
      });
      return;
    }
    setShowNewGroup(true);
    setError('');
  };

  const inputClass =
    'w-full px-3 py-2 rounded-lg border border-blaster-border bg-blaster-bg-card text-blaster-fg placeholder-blaster-muted text-sm focus:ring-2 focus:ring-blaster-accent/40';

  return (
    <div className="min-h-full bg-blaster-sidebar p-4 sm:p-6 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4 mb-4 md:mb-6">
        <div>
          <h1 className="page-title-mobile">Senders</h1>
          <p className="text-xs md:text-sm text-blaster-muted mt-0.5">
            Build sender email groups for manual campaigns (up to {maxPerGroup} per group)
          </p>
        </div>
        <button
          type="button"
          onClick={tryOpenNewGroup}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-black border border-blaster-orange text-[#faf8f5] text-sm font-medium shadow-blaster-cta hover:opacity-90 transition shrink-0"
        >
          + Add Group
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {success && <p className="mb-4 text-sm text-emerald-600">{success}</p>}

      {showNewGroup && (
        <div className="mb-6 max-w-md bg-white rounded-xl border border-blaster-border p-4 flex gap-2">
          <input
            type="text"
            placeholder="Group name (e.g. Main Senders)"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            className={inputClass}
            onKeyDown={(e) => e.key === 'Enter' && createGroup()}
          />
          <button type="button" onClick={createGroup} className="btn-blaster-accent shrink-0 text-sm px-4">
            Create
          </button>
          <button
            type="button"
            onClick={() => setShowNewGroup(false)}
            className="shrink-0 px-3 text-sm text-blaster-muted hover:text-blaster-fg"
          >
            Cancel
          </button>
        </div>
      )}

      {groups.length === 0 && !showNewGroup ? (
        <div className="relative max-w-lg overflow-hidden rounded-2xl border border-blaster-accent/25 bg-gradient-to-br from-white via-white to-blaster-orange/5 py-14 px-6 text-center shadow-sm">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blaster-accent/[0.06] via-transparent to-blaster-orange/10"
            aria-hidden
          />
          <span
            className="relative inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blaster-accent/15 to-blaster-orange/25 border border-blaster-accent/20 mb-4 mx-auto shadow-sm"
            aria-hidden
          >
            <Mail className="w-7 h-7 text-blaster-accent" strokeWidth={1.75} />
          </span>
          <p className="relative text-base font-semibold text-blaster-fg">No sender groups yet</p>
          <p className="relative text-sm text-blaster-muted mt-2 max-w-xs mx-auto leading-relaxed">
            Create a group, then add emails via manual entry.
          </p>
          <button
            type="button"
            onClick={tryOpenNewGroup}
            className="relative mt-6 inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-black border border-blaster-orange text-[#faf8f5] text-sm font-medium shadow-blaster-cta hover:opacity-90 transition"
          >
            + Add Group
          </button>
        </div>
      ) : (
        <div className="space-y-4 max-w-3xl">
          {groups.map((group) => {
            const senders = group.senders || [];
            const atLimit = senders.length >= maxPerGroup;
            const expanded = expandedGroupId === group.id;
            return (
              <div key={group.id} className="bg-white rounded-xl border border-blaster-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedGroupId(expanded ? null : group.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition text-left"
                >
                  <div>
                    <h3 className="font-semibold text-blaster-fg">{group.name}</h3>
                    <p className="text-xs text-blaster-muted mt-0.5">
                      {senders.length} / {maxPerGroup} emails
                    </p>
                  </div>
                  <span className="text-blaster-muted text-lg">{expanded ? '−' : '+'}</span>
                </button>

                {expanded && (
                  <div className="border-t border-blaster-border px-5 py-4 space-y-4">
                    {senders.length > 0 ? (
                      <ul className="divide-y divide-blaster-border/70 rounded-lg border border-blaster-border overflow-hidden">
                        {senders.map((s) => (
                          <li key={s.id} className="flex items-center justify-between px-4 py-3 bg-blaster-bg-card/30">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-medium text-sm text-blaster-fg truncate">{s.email}</span>
                              {statusBadge(s)}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeEmail(group.id, s.id)}
                              className="text-xs text-red-600 hover:underline shrink-0 ml-2"
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-blaster-muted">No emails in this group yet.</p>
                    )}

                    {!atLimit && (
                      <div>
                        <div className="flex gap-2">
                          <input
                            type="email"
                            placeholder="sales@mybrand.com"
                            value={manualEmail[group.id] || ''}
                            onChange={(e) => setManualEmail((prev) => ({ ...prev, [group.id]: e.target.value }))}
                            className={inputClass}
                            onKeyDown={(e) => e.key === 'Enter' && addManualEmail(group.id)}
                          />
                          <button
                            type="button"
                            onClick={() => addManualEmail(group.id)}
                            disabled={addingGroupId === group.id}
                            className="btn-blaster-accent text-sm disabled:opacity-50"
                          >
                            {addingGroupId === group.id ? '…' : 'Add'}
                          </button>
                        </div>
                        {manualError[group.id] && (
                          <p className="mt-2 text-xs text-red-600">{manualError[group.id]}</p>
                        )}
                      </div>
                    )}

                    {atLimit && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        Group limit reached ({maxPerGroup} emails).
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => deleteGroup(group.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete entire group
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
