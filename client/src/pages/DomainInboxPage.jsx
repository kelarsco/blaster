import React, { useEffect, useMemo, useState } from 'react';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext';

const infoCopy = 'This feature does not replace your email inbox. It connects to your domain to send campaigns and mirror replies in your dashboard.';
const ALL_MAILBOXES_ID = '__all_mailboxes__';

export function DomainInboxPage() {
  const { authFetch } = useAuth();
  const [threads, setThreads] = useState([]);
  const [selectedThreadId, setSelectedThreadId] = useState('');
  const [selectedMailbox, setSelectedMailbox] = useState(ALL_MAILBOXES_ID);
  const [mailboxMenuOpen, setMailboxMenuOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const mailboxOptions = useMemo(() => {
    const senderSet = new Set(threads.map((t) => t.senderEmail).filter(Boolean));
    const list = Array.from(senderSet).sort((a, b) => a.localeCompare(b));
    return [{ id: ALL_MAILBOXES_ID, label: 'All messages' }, ...list.map((email) => ({ id: email, label: email }))];
  }, [threads]);

  const filteredThreads = useMemo(() => {
    if (selectedMailbox === ALL_MAILBOXES_ID) return threads;
    return threads.filter((t) => t.senderEmail === selectedMailbox);
  }, [threads, selectedMailbox]);

  const selectedThread = useMemo(
    () => filteredThreads.find((t) => t.id === selectedThreadId) || null,
    [filteredThreads, selectedThreadId]
  );

  async function loadThreads() {
    if (!authFetch) return;
    const res = await authFetch(`${API}/domain-email/inbox/threads`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to load inbox threads');
    setThreads(data.threads || []);
  }

  async function loadMessages(threadId) {
    if (!authFetch || !threadId) return;
    const res = await authFetch(`${API}/domain-email/inbox/threads/${threadId}/messages`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to load thread messages');
    setMessages(data.messages || []);
  }

  useEffect(() => {
    loadThreads().catch((e) => setError(e?.message || 'Failed to load inbox'));
  }, [authFetch]);

  useEffect(() => {
    loadMessages(selectedThreadId).catch((e) => setError(e?.message || 'Failed to load messages'));
  }, [selectedThreadId]);

  useEffect(() => {
    if (!filteredThreads.length) {
      setSelectedThreadId('');
      setMessages([]);
      return;
    }
    if (!filteredThreads.some((t) => t.id === selectedThreadId)) {
      setSelectedThreadId(filteredThreads[0].id);
    }
  }, [filteredThreads, selectedThreadId]);

  useEffect(() => {
    if (selectedMailbox !== ALL_MAILBOXES_ID && !mailboxOptions.some((m) => m.id === selectedMailbox)) {
      setSelectedMailbox(ALL_MAILBOXES_ID);
    }
  }, [mailboxOptions, selectedMailbox]);

  async function sendReply() {
    if (!selectedThreadId || !draft.trim()) return;
    setError('');
    setSuccess('');
    const res = await authFetch(`${API}/domain-email/inbox/threads/${selectedThreadId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: draft }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error || 'Failed to send reply');
    setDraft('');
    setSuccess('Reply sent.');
    await loadMessages(selectedThreadId);
    await loadThreads();
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-4 md:mb-6 rounded-2xl border border-blaster-border bg-gradient-to-r from-white to-blaster-bg-app px-4 py-4 md:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs md:text-sm text-blaster-muted">{infoCopy}</p>
            <p className="text-xs text-blaster-muted mt-2">
              Tip: set your provider inbound webhook to mirror replies from Gmail and other inboxes into these threads.
            </p>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMailboxMenuOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full border border-blaster-border bg-white px-3 py-2 text-sm text-blaster-fg hover:bg-blaster-bg-app"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blaster-bg-app text-xs font-semibold text-blaster-fg">
                {(selectedMailbox === ALL_MAILBOXES_ID ? 'All' : selectedMailbox.charAt(0).toUpperCase()).slice(0, 2)}
              </span>
              <span className="max-w-[180px] truncate">
                {selectedMailbox === ALL_MAILBOXES_ID ? 'All mailboxes' : selectedMailbox}
              </span>
              <span aria-hidden>▾</span>
            </button>
            {mailboxMenuOpen ? (
              <div className="absolute right-0 z-10 mt-2 w-72 rounded-xl border border-blaster-border bg-white shadow-lg">
                <div className="max-h-64 overflow-auto py-1">
                  {mailboxOptions.map((mailbox) => (
                    <button
                      type="button"
                      key={mailbox.id}
                      onClick={() => {
                        setSelectedMailbox(mailbox.id);
                        setMailboxMenuOpen(false);
                      }}
                      className={`block w-full px-3 py-2 text-left text-sm hover:bg-blaster-bg-app ${
                        mailbox.id === selectedMailbox ? 'font-semibold text-blaster-fg bg-blaster-bg-app/60' : 'text-blaster-fg'
                      }`}
                    >
                      {mailbox.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {error ? <div className="mb-3 rounded-lg border border-red-300 bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div> : null}
      {success ? <div className="mb-3 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 text-sm px-3 py-2">{success}</div> : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="bg-blaster-bg-card rounded-xl border border-blaster-border">
          <div className="px-4 py-3 border-b border-blaster-border font-semibold text-sm text-blaster-fg flex items-center justify-between">
            <span>Threads</span>
            <span className="text-xs text-blaster-muted">{filteredThreads.length}</span>
          </div>
          <div className="max-h-[65vh] overflow-auto">
            {filteredThreads.length === 0 ? (
              <div className="p-5">
                <p className="text-sm font-medium text-blaster-fg">No message threads yet</p>
                <p className="text-xs text-blaster-muted mt-1">
                  {selectedMailbox === ALL_MAILBOXES_ID
                    ? 'Configure inbound webhook on a verified domain to mirror replies here.'
                    : `No messages found for ${selectedMailbox}.`}
                </p>
              </div>
            ) : (
              filteredThreads.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setSelectedThreadId(t.id)}
                  className={`w-full text-left px-4 py-3 border-b border-blaster-border hover:bg-blaster-bg-app/40 ${
                    selectedThreadId === t.id ? 'bg-blaster-bg-app/60' : ''
                  }`}
                >
                  <div className="text-sm font-medium text-blaster-fg truncate">{t.contactEmail}</div>
                  <div className="text-xs text-blaster-muted truncate">{t.subject}</div>
                  <div className="text-xs text-blaster-muted truncate">{t.lastBody}</div>
                  <div className="text-[11px] text-blaster-muted truncate mt-1">via {t.senderEmail}</div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="lg:col-span-2 bg-blaster-bg-card rounded-xl border border-blaster-border flex flex-col min-h-[65vh]">
          <div className="px-4 py-3 border-b border-blaster-border text-sm text-blaster-fg">
            {selectedThread ? (
              <>
                <span className="font-semibold">{selectedThread.contactEmail}</span>
                <span className="text-blaster-muted"> - Reply-To sender: {selectedThread.senderEmail}</span>
              </>
            ) : (
              'Select a thread'
            )}
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <p className="text-sm text-blaster-muted">No messages in this thread yet.</p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`max-w-3xl rounded-lg border p-3 ${m.direction === 'outbound' ? 'ml-auto border-blaster-accent/40 bg-blaster-accent/5' : 'border-blaster-border bg-white'}`}>
                  <div className="text-xs text-blaster-muted mb-1">
                    {m.direction === 'outbound' ? 'You' : m.fromEmail} - {new Date(m.createdAt).toLocaleString()}
                  </div>
                  <div className="text-sm text-blaster-fg whitespace-pre-wrap">{m.bodyText}</div>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-blaster-border p-3 space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              placeholder="Type your response..."
              className="w-full px-3 py-2 rounded-lg border border-blaster-border bg-white text-blaster-fg"
            />
            <button type="button" onClick={sendReply} disabled={!selectedThreadId || !draft.trim()} className="btn-blaster-accent disabled:opacity-50">
              Send response
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
