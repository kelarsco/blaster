const STORAGE_PREFIX = 'manual-campaign-deck:';

export function saveManualCampaignDeck(runId, deck) {
  if (!runId || !Array.isArray(deck)) return;
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${runId}`, JSON.stringify(deck));
  } catch (_) {}
}

export function loadManualCampaignDeck(runId) {
  if (!runId) return null;
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${runId}`);
    if (!raw) return null;
    const deck = JSON.parse(raw);
    return Array.isArray(deck) ? deck : null;
  } catch {
    return null;
  }
}

export function clearManualCampaignDeck(runId) {
  if (!runId) return;
  try {
    sessionStorage.removeItem(`${STORAGE_PREFIX}${runId}`);
  } catch (_) {}
}

export function deckCardToUi(card) {
  if (!card) return null;
  return {
    recipient: card.recipient,
    subject: card.subject,
    body: card.body,
  };
}
