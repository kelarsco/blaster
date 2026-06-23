import React, { useState, useEffect, useRef } from 'react';
import { useAdmin } from '../../context/AdminContext';
import { AdminPageHeader, adminPanel, adminHoverBg } from '../../components/admin';

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function AdminMessagesPage() {
  const { adminFetch } = useAdmin();
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const listRef = useRef(null);

  const fetchThreads = () => {
    adminFetch('/messages/threads')
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => setThreads(d.threads || []))
      .catch(() => setThreads([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchThreads();
  }, [adminFetch]);

  useEffect(() => {
    if (!selectedThread) {
      setMessages([]);
      return;
    }
    adminFetch(`/messages/threads/${selectedThread.threadId}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => setMessages(d.messages || []))
      .catch(() => setMessages([]));
  }, [adminFetch, selectedThread?.threadId]);

  useEffect(() => {
    if (listRef.current && messages.length) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async () => {
    const body = input.trim();
    if (!body || !selectedThread || sending) return;
    setSending(true);
    setInput('');
    try {
      const res = await adminFetch(`/messages/threads/${selectedThread.threadId}`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
      }
    } catch (_) {}
    setSending(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <AdminPageHeader title="Messages" subtitle="Support conversations" />
      <div className={`flex-1 flex min-h-0 ${adminPanel} overflow-hidden`}>
        {/* Thread list: on mobile hide when a thread is selected so chat can be full width */}
        <div className={`w-80 border-r border-blaster-border flex flex-col overflow-hidden flex-shrink-0 ${selectedThread ? 'hidden md:flex' : ''}`}>
          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 rounded-lg bg-blaster-border/40 animate-pulse" />
              ))}
            </div>
          ) : threads.length === 0 ? (
            <p className="p-4 text-blaster-muted text-sm">No support conversations yet</p>
          ) : (
            <div className="overflow-y-auto flex-1">
              {threads.map((t) => (
                <button
                  key={t.threadId}
                  type="button"
                  onClick={() => setSelectedThread(t)}
                  className={`w-full text-left px-4 py-3 border-b border-blaster-border/60 ${adminHoverBg} transition-colors ${
                    selectedThread?.threadId === t.threadId ? 'bg-black/5 border-l-2 border-l-black' : ''
                  }`}
                >
                  <p className="font-medium text-blaster-fg truncate">{t.userName || t.userEmail}</p>
                  <p className="text-xs text-blaster-muted truncate">{t.lastMessage || 'No messages'}</p>
                  <p className="text-xs text-blaster-muted mt-0.5">{formatTime(t.lastAt)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {!selectedThread ? (
            <div className="flex-1 flex items-center justify-center text-blaster-muted text-sm">
              Select a conversation
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-blaster-border bg-blaster-bg-app flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedThread(null)}
                  className={`md:hidden p-2 -ml-2 rounded-lg text-blaster-fg ${adminHoverBg}`}
                  aria-label="Back to list"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-blaster-fg truncate">{selectedThread.userName || selectedThread.userEmail}</p>
                  <p className="text-xs text-blaster-muted truncate">{selectedThread.userEmail}</p>
                </div>
              </div>
              <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.sender === 'support' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                        m.sender === 'support'
                          ? 'bg-black text-white'
                          : 'bg-blaster-border/30 text-blaster-fg'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <p className="text-xs opacity-70 mt-1">{formatTime(m.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-blaster-border">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                    placeholder="Type a message…"
                    className="flex-1 px-4 py-2.5 rounded-full border border-blaster-border bg-blaster-bg-card text-blaster-fg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                  />
                  <button
                    type="button"
                    onClick={sendMessage}
                    disabled={!input.trim() || sending}
                    className="px-5 py-2.5 rounded-full bg-black text-white text-sm font-medium shadow-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
