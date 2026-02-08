import React, { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '../../context/AdminContext';
import { MoreVertical, Edit2, UserX, AlertCircle, Trash2 } from 'react-feather';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

export function AdminUsersPage() {
  const { adminFetch } = useAdmin();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [menuUserId, setMenuUserId] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [detailUser, setDetailUser] = useState(null);
  const [otherActionUser, setOtherActionUser] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [plans, setPlans] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchUsers = useCallback(() => {
    setLoading(true);
    const q = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : '';
    adminFetch(`/users${q}`)
      .then((r) => (r.ok ? r.json() : { users: [], total: 0 }))
      .then((d) => {
        setUsers(d.users || []);
        setTotal(d.total ?? 0);
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [adminFetch, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (editUser || detailUser) {
      adminFetch('/plans')
        .then((r) => (r.ok ? r.json() : {}))
        .then((d) => setPlans(d.plans || []))
        .catch(() => setPlans([]));
    }
  }, [adminFetch, editUser, detailUser]);

  const fetchUserDetail = useCallback((id) => {
    adminFetch(`/users/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setDetailUser)
      .catch(() => setDetailUser(null));
  }, [adminFetch]);

  const handleDisable = async (id) => {
    try {
      await adminFetch(`/users/${id}/disable`, { method: 'POST' });
      setOtherActionUser(null);
      setMenuUserId(null);
      fetchUsers();
    } catch (_) {}
  };

  const handleSuspend = async (id) => {
    try {
      await adminFetch(`/users/${id}/suspend`, { method: 'POST' });
      setOtherActionUser(null);
      setMenuUserId(null);
      fetchUsers();
    } catch (_) {}
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Permanently delete this user and all their data?')) return;
    try {
      await adminFetch(`/users/${id}`, { method: 'DELETE' });
      setOtherActionUser(null);
      setMenuUserId(null);
      setEditUser(null);
      setDetailUser(null);
      fetchUsers();
    } catch (_) {}
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || !window.confirm(`Delete ${selectedIds.size} user(s) permanently?`)) return;
    setError('');
    try {
      const res = await adminFetch('/users/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids: [...selectedIds] }),
      });
      if (!res.ok) throw new Error('Failed');
      setSelectedIds(new Set());
      fetchUsers();
    } catch (e) {
      setError(e?.message || 'Bulk delete failed');
    }
  };

  const handleSaveEdit = async (payload) => {
    if (!editUser?.id) return;
    setSaving(true);
    setError('');
    try {
      const res = await adminFetch(`/users/${editUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to update');
      }
      setEditUser(null);
      fetchUsers();
    } catch (e) {
      setError(e?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const enterSelectionMode = () => {
    setSelectionMode(true);
    setSelectedIds(new Set());
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelectAll = () => {
    if (selectedIds.size >= users.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(users.map((u) => u.id)));
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-blaster-fg">Users</h1>
        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 rounded-lg border border-blaster-border bg-blaster-input-bg text-blaster-fg w-full sm:w-64 text-sm"
          />
          {users.length > 0 && !selectionMode && (
            <label className="flex items-center gap-2 text-sm text-blaster-muted cursor-pointer">
              <input
                type="checkbox"
                checked={false}
                onChange={enterSelectionMode}
                className="rounded border-blaster-border"
              />
              Select multiple
            </label>
          )}
          {selectionMode && (
            <>
              <label className="flex items-center gap-2 text-sm text-blaster-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.size === users.length}
                  onChange={toggleSelectAll}
                  className="rounded border-blaster-border"
                />
                Select all
              </label>
              <button
                type="button"
                onClick={exitSelectionMode}
                className="text-sm text-blaster-muted hover:text-blaster-fg"
              >
                Done
              </button>
            </>
          )}
          {selectionMode && selectedIds.size > 0 && (
            <button
              type="button"
              onClick={handleBulkDelete}
              className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
            >
              Delete {selectedIds.size} selected
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 text-sm">
          {error}
        </div>
      )}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-blaster-border bg-blaster-bg-card">
              <div className="h-10 w-10 rounded-lg bg-blaster-border/40 animate-pulse shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-4 w-32 rounded bg-blaster-border/40 animate-pulse" />
                <div className="h-3 w-48 rounded bg-blaster-border/40 animate-pulse" />
              </div>
              <div className="h-4 w-24 rounded bg-blaster-border/40 animate-pulse shrink-0" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {users.length === 0 ? (
            <p className="text-blaster-muted py-8 text-center">No users found</p>
          ) : (
            users.map((user) => (
              <div
                key={user.id}
                onDoubleClick={() => fetchUserDetail(user.id)}
                className="flex items-center gap-4 p-4 rounded-xl border border-blaster-border bg-blaster-bg-card hover:border-blaster-border/80"
              >
                {selectionMode && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(user.id)}
                    onChange={() => toggleSelect(user.id)}
                    className="rounded border-blaster-border shrink-0"
                  />
                )}
                <div className="flex flex-col min-w-0 flex-1">
                  <p className="font-medium text-blaster-fg truncate">{user.name || user.email || user.id}</p>
                  <p className="text-sm text-blaster-muted truncate">{user.email}</p>
                </div>
                <div className="flex flex-1 flex-col items-center justify-center min-w-0">
                  <div className="flex flex-col text-left text-sm text-blaster-muted">
                  <span>{formatDate(user.createdAt)}</span>
                  <span className="mt-0.5">
                    {user.planName}
                    {user.deactivatedAt && <span className="text-amber-600 ml-1">(disabled)</span>}
                    {user.suspendedAt && <span className="text-amber-600 ml-1">(suspended)</span>}
                  </span>
                  </div>
                </div>
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setMenuUserId(menuUserId === user.id ? null : user.id)}
                    className="p-2 rounded-lg text-blaster-muted hover:bg-blaster-border/50"
                    aria-label="Actions"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                  {menuUserId === user.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuUserId(null)} aria-hidden />
                      <div className="absolute right-0 top-full mt-1 py-1 w-48 rounded-lg border border-blaster-border bg-blaster-bg-card shadow-lg z-20">
                        <button
                          type="button"
                          onClick={() => { setEditUser(user); setMenuUserId(null); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-blaster-fg hover:bg-blaster-border/50"
                        >
                          <Edit2 className="w-4 h-4" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => { setOtherActionUser(user); setMenuUserId(null); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-blaster-fg hover:bg-blaster-border/50"
                        >
                          <AlertCircle className="w-4 h-4" /> Others
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Edit modal */}
      {editUser && (
        <EditUserModal
          user={editUser}
          plans={plans}
          onClose={() => setEditUser(null)}
          onSave={handleSaveEdit}
          saving={saving}
        />
      )}

      {/* Detail drawer (double-click) */}
      {detailUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setDetailUser(null)}>
          <div
            className="bg-blaster-bg-card rounded-2xl border border-blaster-border shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-blaster-fg">User details</h2>
              <button type="button" onClick={() => setDetailUser(null)} className="p-2 rounded-lg hover:bg-blaster-border/50 text-blaster-muted">
                ✕
              </button>
            </div>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-blaster-muted">Name</dt><dd className="text-blaster-fg">{detailUser.name || '—'}</dd></div>
              <div><dt className="text-blaster-muted">Email</dt><dd className="text-blaster-fg">{detailUser.email}</dd></div>
              <div><dt className="text-blaster-muted">Plan</dt><dd className="text-blaster-fg">{detailUser.planName}</dd></div>
              <div><dt className="text-blaster-muted">Created</dt><dd className="text-blaster-fg">{formatDate(detailUser.createdAt)}</dd></div>
              <div><dt className="text-blaster-muted">Status</dt>
                <dd className="text-blaster-fg flex items-center gap-2">
                  {detailUser.deactivatedAt ? <span className="text-amber-600">Disabled</span> : detailUser.suspendedAt ? <span className="text-amber-600">Suspended</span> : <span className="text-emerald-600">Active</span>}
                  <span className={`w-2 h-2 rounded-full ${detailUser.deactivatedAt || detailUser.suspendedAt ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                </dd>
              </div>
              <div><dt className="text-blaster-muted">Login sessions</dt><dd className="text-blaster-fg">{detailUser.sessions?.length ? `${detailUser.sessions.length} token(s)` : '—'}</dd></div>
            </dl>
          </div>
        </div>
      )}

      {/* Others (disable / suspend / delete) */}
      {otherActionUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setOtherActionUser(null)}>
          <div className="bg-blaster-bg-card rounded-2xl border border-blaster-border shadow-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-blaster-fg mb-2">Actions</h2>
            <p className="text-sm text-blaster-muted mb-4">{otherActionUser.email}</p>
            <div className="space-y-2">
              <button type="button" onClick={() => handleDisable(otherActionUser.id)} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-blaster-border hover:bg-blaster-border/30 text-sm">
                <UserX className="w-4 h-4" /> Disable account
              </button>
              <button type="button" onClick={() => handleSuspend(otherActionUser.id)} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-blaster-border hover:bg-blaster-border/30 text-sm">
                <AlertCircle className="w-4 h-4" /> Suspend
              </button>
              <button type="button" onClick={() => handleDelete(otherActionUser.id)} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm">
                <Trash2 className="w-4 h-4" /> Delete user
              </button>
            </div>
            <button type="button" onClick={() => setOtherActionUser(null)} className="mt-4 w-full py-2 rounded-lg border border-blaster-border text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EditUserModal({ user, plans, onClose, onSave, saving }) {
  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [planId, setPlanId] = useState(user.planId || 'free');

  const submit = (e) => {
    e.preventDefault();
    onSave({ name: name.trim(), email: email.trim(), planId: planId || 'free' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-blaster-bg-card rounded-2xl border border-blaster-border shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-blaster-fg mb-4">Edit user</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-blaster-fg mb-1">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-blaster-border bg-blaster-input-bg text-blaster-fg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-blaster-fg mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-blaster-border bg-blaster-input-bg text-blaster-fg" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-blaster-fg mb-1">Plan</label>
            <select value={planId} onChange={(e) => setPlanId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-blaster-border bg-blaster-input-bg text-blaster-fg">
              <option value="free">Free</option>
              {(plans || []).filter((p) => p.id !== 'free').map((p) => (
                <option key={p.id} value={p.id}>{p.name} (${(p.amount / 100).toFixed(0)}/{p.interval})</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-blaster-border text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-blaster-accent text-white text-sm font-medium disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
