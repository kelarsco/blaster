import React, { useState, useEffect } from 'react';
import { UserPlus, User } from 'react-feather';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { API } from '../api.js';

export function UsersPage() {
  const { user } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState(null);
  const [invites, setInvites] = useState([]);
  const [members, setMembers] = useState([]);

  const displayName = user?.name || user?.email?.split('@')[0] || 'You';

  const fetchInvites = () => {
    fetch(`${API}/invites`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { invites: [], members: [] }))
      .then((data) => {
        setInvites(data.invites || []);
        setMembers(data.members || []);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchInvites();
  }, [inviteOpen]);

  const sendInvite = async () => {
    const trimmed = (email || '').trim().toLowerCase();
    if (!trimmed) return;
    setSending(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/invites`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage({ type: 'success', text: data.message || 'Invite sent! A login link was sent to their email.' });
        setEmail('');
        fetchInvites();
        setTimeout(() => {
          setInviteOpen(false);
          setMessage(null);
        }, 2000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to send invite' });
      }
    } catch (_) {
      setMessage({ type: 'error', text: 'Failed to send invite' });
    } finally {
      setSending(false);
    }
  };

  const closeModal = () => {
    setInviteOpen(false);
    setEmail('');
    setMessage(null);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 md:mb-6">
        <div>
          <h1 className="page-title-mobile">Users</h1>
          <p className="text-blaster-muted mt-0.5">Collaborate with your team on wiblaster</p>
        </div>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="inline-flex items-center gap-2 btn-blaster-accent shrink-0"
        >
          <UserPlus className="w-5 h-5" strokeWidth={2} />
          Invite a user
        </button>
      </div>

      <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border overflow-hidden">
        <h2 className="card-header-mobile font-semibold text-blaster-fg card-title-mobile">Users in wiblaster</h2>
        <ul className="divide-y divide-blaster-border">
          <li className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 hover:bg-blaster-bg-app/50">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-blaster-accent/20 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 md:w-5 md:h-5 text-blaster-accent" strokeWidth={2} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-blaster-fg">{displayName}</span>
                  <span className="px-2 py-0.5 rounded-full bg-blaster-bg-app text-blaster-muted text-xs">You</span>
                </div>
                <p className="text-sm text-blaster-muted">{user?.email}</p>
                <span className="text-xs text-blaster-muted">owner</span>
              </div>
            </div>
          </li>
          {members.map((m) => (
            <li key={m.member_id} className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 hover:bg-blaster-bg-app/50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-blaster-border flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-blaster-muted" strokeWidth={2} />
                </div>
                <div>
                  <p className="font-medium text-blaster-fg">{m.member_email}</p>
                  <span className="text-xs text-blaster-muted">member</span>
                </div>
              </div>
            </li>
          ))}
          {invites.map((inv) => (
            <li key={inv.invitee_email} className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 hover:bg-blaster-bg-app/50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <UserPlus className="w-5 h-5 text-amber-600" strokeWidth={2} />
                </div>
                <div>
                  <p className="font-medium text-blaster-fg">{inv.invitee_email}</p>
                  <span className="text-xs text-amber-600">Pending invite</span>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="p-6 border-t border-dashed border-blaster-border">
          <Link
            to="/app/account/pricing"
            className="inline-flex items-center justify-center w-full py-4 rounded-xl btn-blaster-accent"
          >
            Upgrade to add more seats
          </Link>
          <button
            type="button"
            className="mt-2 text-sm text-blaster-accent hover:underline"
          >
            Why would I need to add more seats?
          </button>
        </div>
      </section>

      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border shadow-xl max-w-md w-full card-body-mobile">
            <h3 className="card-title-mobile mb-2">Invite a user</h3>
            <p className="text-sm text-blaster-muted mb-4">
              Enter a team member&apos;s email. A login link will be sent to their Gmail. They can sign in with Google and use all the features you&apos;re eligible for.
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@gmail.com"
              className="w-full px-4 py-2.5 rounded-lg border border-blaster-border bg-blaster-bg-card text-blaster-fg focus:ring-2 focus:ring-blaster-accent/40 mb-4"
              onKeyDown={(e) => e.key === 'Enter' && sendInvite()}
            />
            {message && (
              <p className={`text-sm mb-4 ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {message.text}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 rounded-lg border border-blaster-border text-blaster-fg hover:bg-blaster-bg-app"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={sendInvite}
                disabled={sending || !email.trim()}
                className="btn-blaster-accent px-4 py-2 rounded-lg text-sm disabled:opacity-60"
              >
                {sending ? 'Sending…' : 'Send invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
