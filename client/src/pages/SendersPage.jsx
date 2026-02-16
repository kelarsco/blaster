import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext';

function DotsIcon({ className }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
    </svg>
  );
}

const MAX_SENDERS_PER_GROUP = 10;
const GMAIL_SMTP_HOSTS = new Set(['smtp.gmail.com', 'smtp-relay.gmail.com']);

function defaultSmtpSenderState() {
  return {
    email: '',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    user: '',
    pass: '',
    maxPerMinute: 10,
  };
}

function normalizePort(value, fallback = 465) {
  const port = Number(value);
  return Number.isFinite(port) && port > 0 ? port : fallback;
}

export function SendersPage() {
  const auth = useAuth();
  const authFetch = auth?.authFetch;
  const [senders, setSenders] = useState([]);
  const [domainRecords, setDomainRecords] = useState([]);
  const [groups, setGroups] = useState([]);
  const [maxSendersPerGroup, setMaxSendersPerGroup] = useState(MAX_SENDERS_PER_GROUP);
  const [senderLimit, setSenderLimit] = useState(1);
  const [senderCount, setSenderCount] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [newSender, setNewSender] = useState(defaultSmtpSenderState);
  const [error, setError] = useState('');
  const [domainSenderForm, setDomainSenderForm] = useState({ domainId: '', fromName: '', fromEmail: '' });
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);

  const fetchData = useCallback(() => {
    if (!authFetch) return;
    authFetch(`${API}/automation/senders`).then((r) => r.json()).then((d) => setSenders(d.senders || []));
    authFetch(`${API}/automation/senders/groups`).then((r) => r.json()).then((d) => {
      setGroups(d.groups || []);
      if (d.maxSendersPerGroup != null) setMaxSendersPerGroup(d.maxSendersPerGroup);
    });
    authFetch(`${API}/automation/senders/limit`).then((r) => r.json()).then((d) => {
      setSenderLimit(d.limit ?? 1);
      setSenderCount(d.count ?? 0);
    });
    authFetch(`${API}/domain-email/domains`).then((r) => (r.ok ? r.json() : { domains: [] })).then((d) => {
      setDomainRecords(d.domains || []);
    });
  }, [authFetch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!openMenuId) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenuId]);

  const addSender = async () => {
    if (!newSender.email || !authFetch) return;
    setError('');
    try {
      const res = await authFetch(`${API}/automation/senders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify((() => {
          const host = String(newSender.host || '').trim().toLowerCase();
          const isGmailHost = GMAIL_SMTP_HOSTS.has(host);
          const selectedPort = normalizePort(newSender.port, isGmailHost ? 465 : 587);
          const useStartTls = selectedPort === 587;
          return {
            email: newSender.email,
            config: {
              host: newSender.host,
              port: selectedPort,
              secure: selectedPort === 465 ? true : newSender.secure,
              requireTLS: useStartTls,
              auth: { user: newSender.user, pass: newSender.pass },
            },
            maxPerMinute: Number(newSender.maxPerMinute) || 10,
          };
        })()),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403 && data.code === 'SENDER_LIMIT_REACHED') {
          setError(data.error || 'Sender limit reached for your plan. Upgrade to add more senders.');
          fetchData();
        } else throw new Error(data.error || 'Failed');
        return;
      }
      setSenders((prev) => [...prev, { id: data.id, email: data.email, maxPerMinute: data.maxPerMinute }]);
      setNewSender(defaultSmtpSenderState());
      setShowAdd(false);
      fetchData();
    } catch (e) {
      setError(e.message);
    }
  };

  const removeSender = async (senderId) => {
    if (!authFetch) return;
    try {
      const res = await authFetch(`${API}/automation/senders/${senderId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to remove');
      setSenders((prev) => prev.filter((s) => s.id !== senderId));
      fetchData();
    } catch (e) {
      setError(e.message);
    }
  };

  const addGroup = async () => {
    if (!newGroupName.trim() || !authFetch) return;
    setError('');
    try {
      const res = await authFetch(`${API}/automation/senders/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGroupName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setGroups((prev) => [...prev, { id: data.id, name: data.name, senders: [] }]);
      setNewGroupName('');
      setShowAddGroup(false);
    } catch (e) {
      setError(e.message);
    }
  };

  const removeGroup = async (groupId) => {
    if (!authFetch) return;
    try {
      const res = await authFetch(`${API}/automation/senders/groups/${groupId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to remove');
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      setEditingGroupId(null);
    } catch (e) {
      setError(e.message);
    }
  };

  const addSenderToGroup = async (groupId, senderId) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;

    // Prevent adding the same sender to more than one group at a time
    const alreadyInGroup = groups.some((g) =>
      (g.senders || []).some((s) => String(s.id) === String(senderId))
    );
    if (alreadyInGroup) {
      setError('Each sender can only belong to one group at a time. Remove it from the other group first.');
      return;
    }

    if (group.senders?.some((s) => String(s.id) === String(senderId))) return;
    const senderIds = [...(group.senders || []).map((s) => s.id), senderId];
    if (!authFetch) return;
    try {
      const res = await authFetch(`${API}/automation/senders/groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderIds }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      fetchData();
    } catch (e) {
      setError(e.message);
    }
  };

  const removeSenderFromGroup = async (groupId, senderId) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const senderIds = (group.senders || []).filter((s) => s.id !== senderId).map((s) => s.id);
    if (!authFetch) return;
    try {
      const res = await authFetch(`${API}/automation/senders/groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderIds }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      fetchData();
    } catch (e) {
      setError(e.message);
    }
  };

  const addDomainSender = async () => {
    if (!authFetch) return;
    setError('');
    try {
      const res = await authFetch(`${API}/domain-email/senders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(domainSenderForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to add domain sender identity');
      setDomainSenderForm({ domainId: '', fromName: '', fromEmail: '' });
      fetchData();
    } catch (e) {
      setError(e?.message || 'Failed to add domain sender identity');
    }
  };

  const removeDomainSender = async (senderId) => {
    if (!authFetch) return;
    setError('');
    try {
      const res = await authFetch(`${API}/domain-email/senders/${senderId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to remove domain sender identity');
      fetchData();
    } catch (e) {
      setError(e?.message || 'Failed to remove domain sender identity');
    }
  };

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-blaster-border bg-blaster-bg-card text-blaster-fg placeholder-blaster-muted focus:ring-2 focus:ring-blaster-accent/40 focus:border-blaster-accent';
  const verifiedDomains = domainRecords.filter((d) => d.status === 'verified');

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4 mb-4 md:mb-6">
        <div>
          <h1 className="page-title-mobile">Senders</h1>
          <p className="text-xs md:text-sm text-blaster-muted mt-0.5">
            Manage email accounts and group them for campaigns
            {senderLimit < 999 && (
              <span className="ml-1">— {senderCount} / {senderLimit} senders</span>
            )}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => { setShowAddGroup(true); setError(''); }}
            className="btn-blaster-accent"
          >
            + Add Group
          </button>
          <button
            type="button"
            onClick={() => { setShowAdd(true); setError(''); }}
            disabled={senderCount >= senderLimit}
            title={senderCount >= senderLimit ? 'Sender limit reached. Upgrade your plan to add more.' : ''}
            className="px-4 py-2 rounded-xl border border-blaster-border text-blaster-fg hover:bg-blaster-sidebar-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Add Sender
          </button>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-6 md:mb-8">
        <h2 className="card-title-mobile mb-2 md:mb-3">Domain sender identities</h2>
        <p className="text-xs md:text-sm text-blaster-muted mb-3">
          Add sender identities for verified domains. No SMTP or inbox passwords are needed.
        </p>
        {verifiedDomains.length === 0 ? (
          <div className="bg-blaster-bg-card rounded-xl border border-blaster-border p-4 text-sm text-blaster-muted">
            No verified domains yet. Complete domain onboarding first in{' '}
            <a href="/app/domain-email-sending" className="text-blaster-accent hover:underline">
              Domain Email Sending
            </a>
            .
          </div>
        ) : (
          <>
            <div className="bg-blaster-bg-card rounded-xl border border-blaster-border p-4 grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
              <select
                value={domainSenderForm.domainId}
                onChange={(e) => setDomainSenderForm((prev) => ({ ...prev, domainId: e.target.value }))}
                className={inputClass}
              >
                <option value="">Select verified domain</option>
                {verifiedDomains.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.domain}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={domainSenderForm.fromName}
                onChange={(e) => setDomainSenderForm((prev) => ({ ...prev, fromName: e.target.value }))}
                placeholder="From name"
                className={inputClass}
              />
              <input
                type="email"
                value={domainSenderForm.fromEmail}
                onChange={(e) => setDomainSenderForm((prev) => ({ ...prev, fromEmail: e.target.value }))}
                placeholder="sales@example.com"
                className={inputClass}
              />
              <button type="button" onClick={addDomainSender} className="btn-blaster-accent">
                Add Domain Sender
              </button>
            </div>
            <p className="text-xs text-blaster-muted mb-1">
              Added domain senders appear in All senders below and can be added to groups for campaigns.
            </p>
          </>
        )}
      </div>

      {/* Sender groups */}
      <div className="mb-6 md:mb-8">
        <h2 className="card-title-mobile mb-2 md:mb-3">Sender groups</h2>
        {showAddGroup && (
          <div className="mb-4 p-4 rounded-xl border border-blaster-border bg-blaster-bg-card flex gap-2 items-center">
            <input
              type="text"
              placeholder="Group name (e.g. morning, afternoon)"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addGroup()}
              className={inputClass + ' max-w-xs'}
              autoFocus
            />
            <button type="button" onClick={addGroup} className="btn-blaster-accent shrink-0">
              Create
            </button>
            <button type="button" onClick={() => { setShowAddGroup(false); setNewGroupName(''); }} className="px-4 py-2 rounded-lg border border-blaster-border text-blaster-fg hover:bg-blaster-sidebar-hover">
              Cancel
            </button>
          </div>
        )}
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.id} className="rounded-xl border border-blaster-border bg-blaster-bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => setEditingGroupId((id) => (id === group.id ? null : group.id))}
                className="w-full px-4 py-3 md:px-6 md:py-4 flex items-center justify-between text-left hover:bg-blaster-bg/50 transition"
              >
                <div>
                  <span className="font-semibold text-blaster-fg">{group.name}</span>
                  <span className="ml-2 text-sm text-blaster-muted">
                    ({(group.senders || []).length}/{maxSendersPerGroup} senders)
                  </span>
                </div>
                <span className="text-blaster-muted">{editingGroupId === group.id ? '▼' : '▶'}</span>
              </button>
              {editingGroupId === group.id && (
                <div className="border-t border-blaster-border p-4 bg-blaster-bg/30">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-blaster-fg">Senders in this group</span>
                    <button
                      type="button"
                      onClick={() => removeGroup(group.id)}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Delete group
                    </button>
                  </div>
                  <ul className="space-y-2 mb-4">
                    {(group.senders || []).map((s) => (
                      <li key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-blaster-bg-card border border-blaster-border">
                        <span className="font-medium text-blaster-fg">{s.email}</span>
                        <button
                          type="button"
                          onClick={() => removeSenderFromGroup(group.id, s.id)}
                          className="text-sm text-blaster-muted hover:text-red-600"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2 items-center flex-wrap">
                    {(group.senders || []).length >= maxSendersPerGroup ? (
                      <span className="text-sm text-amber-600 dark:text-amber-400">
                        Group is full (max {maxSendersPerGroup} senders). Remove one to add another.
                      </span>
                    ) : (
                      <>
                        <span className="text-sm text-blaster-muted">Add sender:</span>
                        <select
                          value=""
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v) addSenderToGroup(group.id, v);
                            e.target.value = '';
                          }}
                          className="px-3 py-2 rounded-lg border border-blaster-border bg-blaster-bg-card text-blaster-fg"
                        >
                          <option value="">Select…</option>
                          {senders
                            // A sender can only belong to one group globally
                            .filter(
                              (s) =>
                                !groups.some((g) =>
                                  (g.senders || []).some((gs) => gs.id === s.id)
                                )
                            )
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.email}
                              </option>
                            ))}
                        </select>
                        {senders.filter(
                          (s) =>
                            !groups.some((g) =>
                              (g.senders || []).some((gs) => gs.id === s.id)
                            )
                        ).length === 0 &&
                          senders.length > 0 && (
                            <span className="text-sm text-blaster-muted">
                              All senders are already assigned to a group
                            </span>
                          )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          {groups.length === 0 && !showAddGroup && (
            <p className="text-blaster-muted py-6 text-center">No groups yet. Create one to organize your senders.</p>
          )}
        </div>
      </div>

      {/* Individual senders */}
      <div>
        <h2 className="text-lg font-semibold text-blaster-fg mb-3">All senders</h2>
        <div className="bg-blaster-bg-card rounded-xl border border-blaster-border overflow-hidden">
          {senders.length === 0 && !showAdd ? (
            <div className="p-12 text-center text-blaster-muted">
              <p>No senders yet. Add one, then add it to a group.</p>
            </div>
          ) : (
            <ul className="divide-y divide-blaster-border">
              {senders.map((s) => (
                <li key={s.id} className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4">
                  <div>
                    <span className="font-medium text-blaster-fg">{s.email}</span>
                    {s.provider === 'domain' && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full border border-blaster-border text-blaster-muted">
                        Domain
                      </span>
                    )}
                    <span className="ml-2 text-sm text-blaster-muted">(max {s.maxPerMinute}/min)</span>
                  </div>
                  <div className="relative shrink-0" ref={openMenuId === s.id ? menuRef : null}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setOpenMenuId((id) => (id === s.id ? null : s.id)); }}
                      className="p-1.5 rounded-lg text-blaster-muted hover:text-blaster-fg hover:bg-blaster-border/50 transition"
                      aria-label="Options"
                    >
                      <DotsIcon className="w-5 h-5" />
                    </button>
                    {openMenuId === s.id && (
                      <div className="absolute right-0 top-full mt-1 py-1 min-w-[120px] bg-blaster-bg-card border border-blaster-border rounded-lg shadow-lg z-10">
                        <button
                          type="button"
                          onClick={() => {
                            if (s.provider === 'domain') {
                              removeDomainSender(s.id);
                            } else {
                              removeSender(s.id);
                            }
                            setOpenMenuId(null);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-blaster-bg-app"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {showAdd && (
            <div className="card-body-mobile border-t border-blaster-border space-y-4">
              <h3 className="font-semibold text-blaster-fg">New sender</h3>
              <input
                type="email"
                placeholder="Sender email"
                value={newSender.email}
                onChange={(e) => setNewSender((prev) => ({ ...prev, email: e.target.value }))}
                className={inputClass}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="SMTP host"
                  value={newSender.host}
                  onChange={(e) => {
                    const host = e.target.value;
                    const isGmailHost = GMAIL_SMTP_HOSTS.has(String(host || '').trim().toLowerCase());
                    setNewSender((prev) => ({
                      ...prev,
                      host,
                      ...(isGmailHost ? { port: 465, secure: true } : {}),
                    }));
                  }}
                  className={inputClass}
                />
                <input
                  type="number"
                  placeholder="Port"
                  value={newSender.port}
                  onChange={(e) => setNewSender((prev) => ({ ...prev, port: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setNewSender((prev) => ({ ...prev, port: 465, secure: true }))}
                  className="px-2.5 py-1 rounded-md border border-blaster-border text-blaster-fg hover:bg-blaster-bg-app"
                >
                  Use 465 (SSL/TLS)
                </button>
                <button
                  type="button"
                  onClick={() => setNewSender((prev) => ({ ...prev, port: 587, secure: false }))}
                  className="px-2.5 py-1 rounded-md border border-blaster-border text-blaster-fg hover:bg-blaster-bg-app"
                >
                  Use 587 (STARTTLS)
                </button>
                <span className="self-center text-blaster-muted">
                  Port 587 enables STARTTLS automatically.
                </span>
              </div>
              <label className="flex items-center gap-2 text-sm text-blaster-fg">
                <input
                  type="checkbox"
                  checked={newSender.secure}
                  onChange={(e) => setNewSender((prev) => ({ ...prev, secure: e.target.checked }))}
                  className="rounded border-blaster-border"
                />
                TLS/SSL
              </label>
              <input
                type="text"
                placeholder="SMTP user"
                value={newSender.user}
                onChange={(e) => setNewSender((prev) => ({ ...prev, user: e.target.value }))}
                className={inputClass}
              />
              <input
                type="password"
                placeholder="SMTP password / app password"
                value={newSender.pass}
                onChange={(e) => setNewSender((prev) => ({ ...prev, pass: e.target.value }))}
                className={inputClass}
              />
              <input
                type="number"
                min={1}
                max={60}
                placeholder="Max per minute"
                value={newSender.maxPerMinute}
                onChange={(e) => setNewSender((prev) => ({ ...prev, maxPerMinute: e.target.value }))}
                className={inputClass}
              />
              <div className="flex gap-2">
                <button type="button" onClick={addSender} className="btn-blaster-accent">
                  Save sender
                </button>
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg border border-blaster-border text-blaster-fg hover:bg-blaster-sidebar-hover">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
