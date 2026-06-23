import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'react-feather';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext';
import { domainFromUrl } from '../utils/scannerUrls.js';
import { buildMailtoUrl, openMailtoUrl } from '../utils/campaignSend.js';
import {
  clearManualCampaignDeck,
  deckCardToUi,
  loadManualCampaignDeck,
  saveManualCampaignDeck,
} from '../utils/manualCampaignDeck.js';

const SEND_LOG_MAX_WAIT_MS = 2000;

async function readJsonResponse(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error('Server returned an invalid response. Restart the API server and try again.');
  }
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

function applyDeckHead(deck) {
  if (!deck?.length) {
    return { card: null, nextCard: null, completed: true };
  }
  return {
    card: deckCardToUi(deck[0]),
    nextCard: deckCardToUi(deck[1]),
    completed: false,
  };
}

function templatePreviewLines(body, maxLines = 3) {
  return String(body || '').split(/\r?\n/).slice(0, maxLines);
}

export function ManualSendPage() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const authFetch = auth?.authFetch;

  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [deck, setDeck] = useState([]);
  const [card, setCard] = useState(null);
  const [nextCard, setNextCard] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [stats, setStats] = useState({ totalSent: 0, totalQueued: 0 });
  const deckRef = useRef([]);

  useEffect(() => {
    deckRef.current = deck;
  }, [deck]);

  const syncFromDeck = useCallback((nextDeck, totalSent, totalQueued) => {
    setDeck(nextDeck);
    saveManualCampaignDeck(runId, nextDeck);
    const view = applyDeckHead(nextDeck);
    setCard(view.card);
    setNextCard(view.nextCard);
    setCompleted(view.completed);
    setStats({ totalSent, totalQueued });
  }, [runId]);

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

  const loadCampaign = useCallback(async () => {
    if (!authFetch || !runId) return;
    setError('');

    const cachedDeck = loadManualCampaignDeck(runId);
    if (cachedDeck?.length) {
      syncFromDeck(cachedDeck, 0, cachedDeck.length);
      setInitialLoading(false);
      refreshStats().then(() => {});
      return;
    }

    try {
      const res = await authFetch(`${API}/manual-campaigns/${runId}/deck`);
      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Failed to load campaign');

      if (data.completed || !data.deck?.length) {
        setCompleted(true);
        setStats({ totalSent: data.totalSent ?? 0, totalQueued: data.totalQueued ?? 0 });
        setCard(null);
        clearManualCampaignDeck(runId);
        return;
      }

      syncFromDeck(data.deck, data.totalSent ?? 0, data.totalQueued ?? data.deck.length);
    } catch (e) {
      setError(e.message);
    } finally {
      setInitialLoading(false);
    }
  }, [authFetch, runId, refreshStats, syncFromDeck]);

  useEffect(() => {
    loadCampaign();
  }, [loadCampaign]);

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

  const advanceLocal = useCallback((sentDelta = 0) => {
    const remaining = deckRef.current.slice(1);
    deckRef.current = remaining;
    setDeck(remaining);
    saveManualCampaignDeck(runId, remaining);
    const view = applyDeckHead(remaining);
    setCard(view.card);
    setNextCard(view.nextCard);
    setCompleted(view.completed);
    if (sentDelta) {
      setStats((prev) => ({
        totalSent: prev.totalSent + sentDelta,
        totalQueued: prev.totalQueued,
      }));
    }
    if (view.completed) {
      clearManualCampaignDeck(runId);
    }
  }, [runId]);

  const handleSend = async () => {
    if (!authFetch || !card) return;
    setError('');

    const sendingCard = card;
    const mailto = buildMailtoUrl({
      to: sendingCard.recipient.email,
      subject: sendingCard.subject,
      body: sendingCard.body,
    });

    const sendPromise = authFetch(`${API}/manual-campaigns/${runId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        subject: sendingCard.subject,
        body: sendingCard.body,
      }),
    })
      .then(readJsonResponse)
      .then((preData) => {
        if (preData.error) throw new Error(preData.error);
        return preData;
      });

    const timeout = new Promise((resolve) => {
      setTimeout(() => resolve(null), SEND_LOG_MAX_WAIT_MS);
    });

    const preData = await Promise.race([sendPromise, timeout]);
    advanceLocal(1);

    if (preData) {
      setStats({ totalSent: preData.totalSent, totalQueued: preData.totalQueued });
      if (preData.completed) {
        setCompleted(true);
        setCard(null);
        setNextCard(null);
        clearManualCampaignDeck(runId);
      }
    } else {
      sendPromise
        .then((data) => {
          setStats({ totalSent: data.totalSent, totalQueued: data.totalQueued });
        })
        .catch((e) => {
          setError(e.message);
          loadCampaign();
        });
    }

    openMailtoUrl(mailto);
  };

  const handleSkip = async () => {
    if (!authFetch || !card) return;
    setError('');
    advanceLocal(0);

    try {
      const res = await authFetch(`${API}/manual-campaigns/${runId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skip: true }),
      });
      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Failed to skip');
      if (!data.skipped) {
        throw new Error('Skip is not available yet — restart or redeploy the API server.');
      }
      setStats({ totalSent: data.totalSent, totalQueued: data.totalQueued });
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
            <div className="relative bg-white rounded-2xl border border-blaster-border shadow-xl overflow-hidden">
            <button
              type="button"
              onClick={handleSkip}
              className="absolute top-4 right-4 text-xs text-blaster-muted hover:text-blaster-fg transition"
            >
              skip
            </button>
            <div className="p-6 space-y-6">
              {error && <p className="text-sm text-red-600">{error}</p>}

              <div>
                <label className="text-xs font-medium text-blaster-muted uppercase">To</label>
                <p className="mt-1 text-base font-medium text-blaster-fg">{card.recipient.email}</p>
                <p className="text-xs text-blaster-muted mt-0.5">
                  {domainFromUrl(card.recipient.storeUrl || card.recipient.store_url || '')}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-blaster-muted uppercase">Message preview</label>
                <p className="mt-1 text-sm font-medium text-blaster-fg">{card.subject}</p>
                <div
                  className="mt-2 rounded-xl border border-blaster-border bg-gray-50/80 px-4 py-3 text-sm text-blaster-muted whitespace-pre-wrap"
                  aria-readonly="true"
                >
                  {templatePreviewLines(card.body).join('\n')}
                  {String(card.body || '').split(/\r?\n/).length > 3 ? (
                    <span>{'\n'}…</span>
                  ) : null}
                </div>
                <p className="text-[11px] text-blaster-muted mt-1.5">Opens in your email app when you tap Send.</p>
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
