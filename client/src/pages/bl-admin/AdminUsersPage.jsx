import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../../context/AdminContext';
import { MoreVertical, Edit2, UserX, AlertCircle, Trash2, Mail } from 'react-feather';
import { AdminConfirmModal } from '../../components/AdminConfirmModal';
import { AdminMessage } from '../../components/AdminMessage';
import { ADMIN_PLAN_OPTIONS, normalizeAdminPlanId } from '../../data/adminPlanOptions.js';
import {
  AdminPageHeader,
  AdminFilterSelect,
  AdminSearchToggle,
  AdminListCard,
  AdminListSkeleton,
  adminPrimaryBtn,
  adminGhostBtn,
} from '../../components/admin';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'plan_asc', label: 'Plan A→Z' },
  { value: 'plan_desc', label: 'Plan Z→A' },
  { value: 'name_asc', label: 'Name A→Z' },
];

const PLAN_FILTER_OPTIONS = [
  { value: '', label: 'All plans' },
  ...ADMIN_PLAN_OPTIONS.map((p) => ({ value: p.id, label: p.label })),
];

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

export function AdminUsersPage() {
  const { adminFetch } = useAdmin();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sort, setSort] = useState('newest');
  const [planFilter, setPlanFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [menuUserId, setMenuUserId] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [detailUser, setDetailUser] = useState(null);
  const [otherActionUser, setOtherActionUser] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'error'|'success', text }
  const [confirmDelete, setConfirmDelete] = useState(null); // { kind: 'single'|'bulk', id?: string, count?: number }

  const fetchUsers = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (sort) params.set('sort', sort);
    if (planFilter) params.set('planId', planFilter);
    const qs = params.toString();
    adminFetch(`/users${qs ? `?${qs}` : ''}`)
      .then((r) => (r.ok ? r.json() : { users: [], total: 0 }))
      .then((d) => {
        setUsers(d.users || []);
        setTotal(d.total ?? 0);
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [adminFetch, search, sort, planFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

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

  const handleReactivate = async (id) => {
    try {
      await adminFetch(`/users/${id}/reactivate`, { method: 'POST' });
      setOtherActionUser(null);
      setMenuUserId(null);
      fetchUsers();
    } catch (_) {}
  };

  const handleDeleteClick = (id) => {
    setConfirmDelete({ kind: 'single', id });
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete?.id) return;
    const id = confirmDelete.id;
    setConfirmDelete(null);
    setMessage(null);
    try {
      const res = await adminFetch(`/users/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setMessage({ type: 'error', text: d.error || 'Delete failed' });
        return;
      }
      setOtherActionUser(null);
      setMenuUserId(null);
      setEditUser(null);
      setDetailUser(null);
      setMessage({ type: 'success', text: 'User deleted.' });
      fetchUsers();
    } catch (_) {
      setMessage({ type: 'error', text: 'Delete failed' });
    }
  };

  const handleBulkDeleteClick = () => {
    if (selectedIds.size === 0) return;
    setConfirmDelete({ kind: 'bulk', count: selectedIds.size });
  };

  const handleBulkDeleteConfirm = async () => {
    if (confirmDelete?.kind !== 'bulk' || selectedIds.size === 0) return;
    setMessage(null);
    const ids = [...selectedIds];
    setConfirmDelete(null);
    try {
      const res = await adminFetch('/users/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Bulk delete failed' });
        return;
      }
      setSelectedIds(new Set());
      setMessage({ type: 'success', text: `Deleted ${data.deleted ?? ids.length} user(s).` });
      fetchUsers();
    } catch (e) {
      setMessage({ type: 'error', text: e?.message || 'Bulk delete failed' });
    }
  };

  const handleSaveEdit = async (payload) => {
    if (!editUser?.id) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await adminFetch(`/users/${editUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setMessage({ type: 'error', text: d.error || 'Update failed' });
        return;
      }
      setEditUser(null);
      setMessage({ type: 'success', text: 'User updated.' });
      fetchUsers();
    } catch (e) {
      setMessage({ type: 'error', text: e?.message || 'Update failed' });
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

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelectAll = () => {
    if (selectedIds.size >= users.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(users.map((u) => u.id)));
  };

  const handleMessageSelected = () => {
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds].join(',');
    navigate(`/bl-admin/campaign?userIds=${encodeURIComponent(ids)}`);
  };

  return (
    <div>
      <AdminPageHeader
        title="Users"
        subtitle={`${total} total`}
        actions={
          <>
            <AdminSearchToggle
              value={search}
              onChange={setSearch}
              open={searchOpen}
              onOpenChange={setSearchOpen}
              placeholder="Search by name or email…"
              ariaLabel="Search users"
            />
            <AdminFilterSelect value={sort} onChange={setSort} options={SORT_OPTIONS} ariaLabel="Sort users" />
            <AdminFilterSelect
              value={planFilter}
              onChange={setPlanFilter}
              options={PLAN_FILTER_OPTIONS}
              ariaLabel="Filter by plan"
            />
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
                <button type="button" onClick={exitSelectionMode} className={adminGhostBtn}>
                  Done
                </button>
              </>
            )}
            {selectionMode && selectedIds.size > 0 && (
              <>
                <button type="button" onClick={handleMessageSelected} className={adminPrimaryBtn}>
                  <Mail className="w-4 h-4" />
                  Message {selectedIds.size}
                </button>
                <button
                  type="button"
                  onClick={handleBulkDeleteClick}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  Delete {selectedIds.size} selected
                </button>
              </>
            )}
          </>
        }
      />
      <AdminMessage
        type={message?.type}
        message={message?.text}
        onDismiss={message ? () => setMessage(null) : undefined}
      />
      {loading ? (
        <AdminListSkeleton rows={5} />
      ) : (
        <div className="space-y-2">
          {users.length === 0 ? (
            <p className="text-blaster-muted py-8 text-center">No users found</p>
          ) : (
            users.map((user) => (
              <AdminListCard key={user.id} onDoubleClick={() => fetchUserDetail(user.id)}>
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
                <div className="flex flex-col items-end sm:items-center justify-center min-w-[120px] shrink-0">
                  <span className="text-sm font-medium text-blaster-fg">{user.planName}</span>
                  <span className="text-xs text-blaster-muted mt-0.5">{formatDate(user.createdAt)}</span>
                  {(user.deactivatedAt || user.suspendedAt) && (
                    <span className="text-xs text-amber-600 mt-0.5">
                      {user.deactivatedAt ? 'disabled' : 'suspended'}
                    </span>
                  )}
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
              </AdminListCard>
            ))
          )}
        </div>
      )}

      {/* Edit modal */}
      {editUser && (
        <EditUserModal
          user={editUser}
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

      {/* Confirm delete (single or bulk) – custom modal, no window.confirm */}
      <AdminConfirmModal
        open={confirmDelete !== null}
        title={confirmDelete?.kind === 'bulk' ? 'Delete users' : 'Delete user'}
        message={confirmDelete?.kind === 'bulk'
          ? `Permanently delete ${confirmDelete.count} user(s) and all their data? This cannot be undone.`
          : 'Permanently delete this user and all their data? This cannot be undone.'}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={confirmDelete?.kind === 'bulk' ? handleBulkDeleteConfirm : handleDeleteConfirm}
        onCancel={() => setConfirmDelete(null)}
      />

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
              {otherActionUser.suspendedAt ? (
                <button type="button" onClick={() => handleReactivate(otherActionUser.id)} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-emerald-600 text-emerald-600 hover:bg-emerald-600/10 text-sm">
                  <AlertCircle className="w-4 h-4" /> Reactivate
                </button>
              ) : (
                <button type="button" onClick={() => handleSuspend(otherActionUser.id)} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-blaster-border hover:bg-blaster-border/30 text-sm">
                  <AlertCircle className="w-4 h-4" /> Suspend
                </button>
              )}
              <button type="button" onClick={() => { handleDeleteClick(otherActionUser.id); setOtherActionUser(null); }} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm">
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

function EditUserModal({ user, onClose, onSave, saving }) {
  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [planId, setPlanId] = useState(() => normalizeAdminPlanId(user.planId));

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
              {ADMIN_PLAN_OPTIONS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <p className="text-xs text-blaster-muted mt-1.5">
              Saves immediately to subscription quotas (campaign limits, filters, analytics access, etc.).
            </p>
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
