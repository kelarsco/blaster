import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../api.js';

const SUGGESTED_QUESTIONS = [
  'I need help with billing or payments',
  'Scan is not finding emails on my store',
  'Campaign is not sending or is stuck',
  'Account, login, or password issue',
];

function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function SupportChatPanel({ onClose }) {
  const { authFetch } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [introVisible, setIntroVisible] = useState(true);
  const listRef = useRef(null);

  const hasMessages = messages.length > 0;

  useEffect(() => {
    if (!authFetch) return;
    authFetch(`${API}/support/thread`)
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((d) => {
        setMessages(d.messages || []);
        setIntroVisible((d.messages || []).length === 0);
      })
      .catch(() => setIntroVisible(true))
      .finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => {
    if (!listRef.current || !messages.length) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async (body) => {
    const trimmed = (body || input).trim();
    if (!trimmed || !authFetch || sending) return;
    setSending(true);
    if (!body) setInput('');
    const optimistic = {
      id: 'opt-' + Date.now(),
      sender: 'user',
      body: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setIntroVisible(false);
    try {
      const res = await authFetch(`${API}/support/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: trimmed }),
      });
      const data = res.ok ? await res.json() : null;
      if (data?.message) {
        setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? data.message : m)));
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(); // no arg = use and clear textarea
  };

  const handleSuggestion = (text) => {
    sendMessage(text);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative w-full max-w-lg bg-white border-l border-blaster-border shadow-2xl flex flex-col animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between gap-4 px-4 py-3 border-b border-blaster-border bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[#1a1a21] flex items-center justify-center text-white font-semibold shrink-0">
              ?
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-blaster-fg truncate">Support</h2>
              <p className="text-xs text-blaster-muted truncate">File a complaint or ask a question</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-blaster-muted hover:text-blaster-fg hover:bg-gray-100 transition shrink-0"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div ref={listRef} className="flex-1 overflow-y-auto min-h-0 flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="w-10 h-10 border-2 border-blaster-fg border-t-transparent rounded-full animate-spin" />
            </div>
          ) : introVisible && !hasMessages ? (
            /* Intro: suggested questions + skip */
            <div className="flex-1 flex flex-col p-4">
              <p className="text-sm text-blaster-muted mb-4">How can we help? Choose a topic or type your own.</p>
              <div className="space-y-2 mb-6">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleSuggestion(q)}
                    className="w-full text-left px-4 py-3 rounded-2xl bg-gray-50 hover:bg-gray-100 border border-gray-100 text-sm text-blaster-fg transition"
                  >
                    {q}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setIntroVisible(false)}
                className="text-sm text-blaster-muted hover:text-blaster-fg underline"
              >
                Skip intro — start with a blank message
              </button>
            </div>
          ) : (
            /* Chat thread: Instagram-style bubbles */
            <div className="flex-1 p-4 space-y-3">
              {messages.length === 0 && !introVisible && (
                <p className="text-sm text-blaster-muted text-center py-4">No messages yet. Type below to start.</p>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                      m.sender === 'user'
                        ? 'bg-[#1a1a21] text-white rounded-br-md'
                        : 'bg-gray-100 text-blaster-fg rounded-bl-md'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={`text-[10px] mt-1 ${m.sender === 'user' ? 'text-gray-400' : 'text-blaster-muted'}`}>
                      {formatTime(m.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input: only when not loading and not intro (or after skip) */}
        {!loading && (!introVisible || hasMessages) && (
          <form onSubmit={handleSubmit} className="shrink-0 p-4 pt-2 border-t border-blaster-border bg-white">
            <div className="flex items-end gap-2 rounded-2xl bg-gray-50 border border-gray-200 focus-within:border-gray-700 focus-within:ring-1 focus-within:ring-gray-700 transition">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Type your message..."
                rows={1}
                className="flex-1 min-h-[44px] max-h-32 resize-none bg-transparent px-4 py-3 text-sm text-blaster-fg placeholder-blaster-muted outline-none rounded-2xl"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className="p-2.5 rounded-full text-blaster-fg hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none transition shrink-0 mb-1 mr-1"
                aria-label="Send"
              >
                <SendIcon />
              </button>
            </div>
            <p className="text-xs text-blaster-muted mt-2">Support will reply to this thread. You can also email support@wiblaster.com.</p>
          </form>
        )}
      </div>
    </div>
  );
}
