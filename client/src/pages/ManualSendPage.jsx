import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API, API_BASE } from '../api.js';
import { useAuth } from '../context/AuthContext';
import { domainFromUrl } from '../utils/scannerUrls.js';
import { buildMailtoUrl, appendTrackingPixel } from '../utils/campaignSend.js';

export function ManualSendPage() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const authFetch = auth?.authFetch;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [card, setCard] = useState(null);
  const [subjectEdit, setSubjectEdit] = useState('');
  const [bodyEdit, setBodyEdit] = useState('');
  const [sending, setSending] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [stats, setStats] = useState({ totalSent: 0, totalQueued: 0 });

  const loadCurrent = useCallback(async () => {
    if (!authFetch || !runId) return;
    setLoading(true);
    setError('');
    try {
      const res = await authFetch(`${API}/manual-campaigns/${runId}/current`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      if (data.completed) {
        setCompleted(true);
        setStats({ totalSent: data.totalSent, totalQueued: data.totalQueued });
        setCard(null);
        return;
      }
      setCard(data);
      setSubjectEdit(data.subject || '');
      setBodyEdit(data.body || '');
      setStats({ totalSent: data.totalSent, totalQueued: data.totalQueued });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, runId]);

  useEffect(() => {
    loadCurrent();
  }, [loadCurrent]);

  const handleSend = async () => {
    if (!authFetch || !card || sending) return;
    setSending(true);
    setError('');
    try {
      const preRes = await authFetch(`${API}/manual-campaigns/${runId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderEmail: card.senderEmail,
          subject: subjectEdit,
          body: bodyEdit,
          senderOrder: card.senderOrder,
          senderPickIndex: card.senderPickIndex,
        }),
      });
      const preData = await preRes.json();
      if (!preRes.ok) throw new Error(preData.error || 'Failed to log send');

      const trackUrl = `${API_BASE}/api/track/open/${preData.trackingToken}`;
      const bodyWithPixel = appendTrackingPixel(bodyEdit, trackUrl);
      const mailto = buildMailtoUrl({
        to: card.recipient.email,
        subject: subjectEdit,
        body: bodyWithPixel,
      });
      window.location.href = mailto;

      setStats({ totalSent: preData.totalSent, totalQueued: preData.totalQueued });
      if (preData.completed) {
        setCompleted(true);
        setCard(null);
      } else {
        setTimeout(() => loadCurrent(), 300);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const handlePause = async () => {
    if (!authFetch) return;
    await authFetch(`${API}/manual-campaigns/${runId}/pause`, { method: 'POST' });
    navigate('/app/campaigns');
  };

  const progress = stats.totalQueued > 0 ? Math.min(100, (stats.totalSent / stats.totalQueued) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[60] bg-blaster-sidebar flex flex-col">
      <header className="shrink-0 px-4 sm:px-8 py-4 border-b border-blaster-border bg-white/80 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-3">
            <button
              type="button"
              onClick={handlePause}
              className="text-sm text-blaster-muted hover:text-blaster-fg transition"
            >
              ← Exit session
            </button>
            <span className="text-sm font-medium text-blaster-fg">
              Sent {stats.totalSent} of {stats.totalQueued}
            </span>
          </div>
          <div className="h-2 rounded-full bg-blaster-border overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blaster-accent to-blaster-orange transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8 overflow-auto">
        {loading ? (
          <p className="text-blaster-muted animate-pulse">Loading…</p>
        ) : completed ? (
          <div className="max-w-md w-full text-center bg-white rounded-2xl border border-blaster-border shadow-lg p-10">
            <p className="text-2xl font-semibold text-blaster-fg mb-2">Campaign complete</p>
            <p className="text-sm text-blaster-muted mb-6">
              You sent {stats.totalSent} of {stats.totalQueued} emails.
            </p>
            <button
              type="button"
              onClick={() => navigate('/app/campaigns')}
              className="px-6 py-2.5 rounded-xl bg-black border border-blaster-orange text-[#faf8f5] text-sm font-medium shadow-blaster-cta hover:opacity-90 transition"
            >
              Back to Campaigns
            </button>
          </div>
        ) : card ? (
          <div className="max-w-lg w-full bg-white rounded-2xl border border-blaster-border shadow-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-blaster-border bg-gradient-to-r from-blaster-accent/5 to-blaster-orange/10">
              <p className="text-xs font-medium text-blaster-muted uppercase tracking-wide">Manual send</p>
              <p className="text-sm text-blaster-muted mt-1">One sender · one recipient</p>
            </div>
            <div className="p-6 space-y-5">
              {error && <p className="text-sm text-red-600">{error}</p>}

              <div>
                <label className="text-xs font-medium text-blaster-muted uppercase">From</label>
                <p className="mt-1 text-base font-medium text-blaster-fg">{card.senderEmail}</p>
              </div>

              <div>
                <label className="text-xs font-medium text-blaster-muted uppercase">To</label>
                <p className="mt-1 text-base font-medium text-blaster-fg">{card.recipient.email}</p>
                <p className="text-xs text-blaster-muted mt-0.5">
                  {domainFromUrl(card.recipient.storeUrl || card.recipient.store_url || '')}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-blaster-muted uppercase">Subject</label>
                <input
                  type="text"
                  value={subjectEdit}
                  onChange={(e) => setSubjectEdit(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-blaster-border bg-blaster-bg-card text-blaster-fg text-sm focus:ring-2 focus:ring-blaster-accent/40"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-blaster-muted uppercase">Body</label>
                <textarea
                  value={bodyEdit}
                  onChange={(e) => setBodyEdit(e.target.value)}
                  rows={8}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-blaster-border bg-blaster-bg-card text-blaster-fg text-sm focus:ring-2 focus:ring-blaster-accent/40 resize-y"
                />
              </div>

              <button
                type="button"
                onClick={handleSend}
                disabled={sending}
                className="w-full py-4 rounded-xl bg-black border-2 border-blaster-orange text-[#faf8f5] text-lg font-semibold shadow-blaster-cta hover:opacity-90 transition disabled:opacity-50"
              >
                {sending ? 'Opening email app…' : 'SEND'}
              </button>
              <p className="text-[11px] text-center text-blaster-muted">
                Opens your email app with fields pre-filled. Hit send there, then return here for the next contact.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-blaster-muted">{error || 'Nothing to send.'}</p>
        )}
      </main>
    </div>
  );
}
