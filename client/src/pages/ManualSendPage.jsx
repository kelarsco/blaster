import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'react-feather';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext';
import { domainFromUrl } from '../utils/scannerUrls.js';
import { buildMailtoUrl } from '../utils/campaignSend.js';

function cardFromPayload(data) {
  if (!data || data.completed) return null;
  return {
    recipient: data.recipient,
    senderEmail: data.senderEmail,
    subject: data.subject,
    body: data.body,
    senderOrder: data.senderOrder,
    senderPickIndex: data.senderPickIndex,
  };
}

function nextCardFromPayload(data) {
  if (!data) return null;
  return cardFromPayload({ ...data, completed: false });
}

function SendProgress({ totalSent, totalQueued, progress }) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-semibold text-blaster-muted mb-1">
        {totalSent}/{totalQueued || 0} sent
      </p>
      <div className="relative h-[6px] rounded-full bg-gray-100 overflow-hidden border border-blaster-border/60">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blaster-accent to-blaster-orange transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function ManualSendPage() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const authFetch = auth?.authFetch;

  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [card, setCard] = useState(null);
  const [nextCard, setNextCard] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [stats, setStats] = useState({ totalSent: 0, totalQueued: 0 });

  const refreshStats = useCallback(async () => {
    if (!authFetch || !runId) return;
    try {
      const res = await authFetch(`${API}/manual-campaigns/${runId}/stats`);
      const data = await res.json();
      if (res.ok) {
        setStats((prev) => ({
          totalSent: Math.max(prev.totalSent, data.totalSent ?? 0),
          totalQueued: data.totalQueued ?? prev.totalQueued,
        }));
      }
    } catch (_) {}
  }, [authFetch, runId]);

  const loadCurrent = useCallback(async () => {
    if (!authFetch || !runId) return;
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
      setCard(cardFromPayload(data));
      setNextCard(nextCardFromPayload(data.next));
      setStats({ totalSent: data.totalSent, totalQueued: data.totalQueued });
    } catch (e) {
      setError(e.message);
    } finally {
      setInitialLoading(false);
    }
  }, [authFetch, runId]);

  useEffect(() => {
    loadCurrent();
  }, [loadCurrent]);

  useEffect(() => {
    if (!authFetch || !runId) return;
    const id = setInterval(refreshStats, 10000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshStats();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [authFetch, runId, refreshStats]);

  const handleSend = async () => {
    if (!authFetch || !card) return;
    setError('');

    const sendingCard = card;
    const mailto = buildMailtoUrl({
      to: sendingCard.recipient.email,
      subject: sendingCard.subject,
      body: sendingCard.body,
    });

    try {
      const preRes = await authFetch(`${API}/manual-campaigns/${runId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderEmail: sendingCard.senderEmail,
          subject: sendingCard.subject,
          body: sendingCard.body,
          senderOrder: sendingCard.senderOrder,
          senderPickIndex: sendingCard.senderPickIndex,
        }),
      });
      const preData = await preRes.json();
      if (!preRes.ok) throw new Error(preData.error || 'Failed to log send');

      setStats({ totalSent: preData.totalSent, totalQueued: preData.totalQueued });
      if (preData.completed) {
        setCompleted(true);
        setCard(null);
        setNextCard(null);
      } else {
        setCard(nextCardFromPayload(preData.next));
        setNextCard(nextCardFromPayload(preData.prefetch));
      }

      window.location.href = mailto;
    } catch (e) {
      setError(e.message);
    }
  };

  const handlePause = async () => {
    if (!authFetch) return;
    await authFetch(`${API}/manual-campaigns/${runId}/pause`, { method: 'POST' });
    navigate('/app/campaigns');
  };

  const progress =
    stats.totalQueued > 0 ? Math.min(100, (stats.totalSent / stats.totalQueued) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[60] bg-blaster-sidebar flex flex-col">
      <div className="shrink-0 px-4 sm:px-8 pt-4">
        <button
          type="button"
          onClick={handlePause}
          className="inline-flex items-center gap-1 text-sm text-blaster-muted hover:text-blaster-fg transition"
        >
          <ChevronLeft className="w-4 h-4 shrink-0" strokeWidth={2} aria-hidden />
          Back
        </button>
      </div>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8 overflow-auto">
        {initialLoading ? (
          <p className="text-blaster-muted animate-pulse">Loading…</p>
        ) : completed ? (
          <div className="max-w-lg w-full">
            <div className="-translate-y-12 mb-4">
              <SendProgress
                totalSent={stats.totalSent}
                totalQueued={stats.totalQueued}
                progress={100}
              />
            </div>
            <div className="text-center bg-white rounded-2xl border border-blaster-border shadow-lg p-10">
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
          </div>
        ) : card ? (
          <div className="max-w-lg w-full">
            <div className="-translate-y-12 mb-4">
              <SendProgress
                totalSent={stats.totalSent}
                totalQueued={stats.totalQueued}
                progress={progress}
              />
            </div>
            <div className="bg-white rounded-2xl border border-blaster-border shadow-xl overflow-hidden">
            <div className="p-6 space-y-6">
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

              <button
                type="button"
                onClick={handleSend}
                className="w-full py-4 rounded-xl bg-black border-2 border-blaster-orange text-[#faf8f5] text-lg font-semibold shadow-blaster-cta hover:opacity-90 transition"
              >
                SEND
              </button>
            </div>
            </div>
          </div>
        ) : (
          <p className="text-blaster-muted">{error || 'Nothing to send.'}</p>
        )}
      </main>
    </div>
  );
}
