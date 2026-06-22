import {
  getNextPendingLeadStore,
  updateLeadStorePhase,
  saveLeadStoreResult,
} from './leadStoreRepository.js';
import { runLeadStorePipeline } from './leadStorePipeline.js';
import { isLeadEngineEnabled } from './leadEngineGate.js';
import { isUserWorkloadActive } from './resourceCoordinator.js';

let processing = false;
let scheduled = false;

async function processOne() {
  if (isUserWorkloadActive()) {
    setTimeout(processOne, 3000);
    return;
  }
  const store = await getNextPendingLeadStore();
  if (!store) {
    processing = false;
    return;
  }
  processing = true;
  try {
    const result = await runLeadStorePipeline(store.storeUrl, {
      onPhase: (phase) => updateLeadStorePhase(store.id, phase),
    });
    await saveLeadStoreResult(store.id, {
      storeUrl: result.storeUrl,
      status: result.status,
      currentPhase: result.currentPhase,
      platform: result.platform,
      countryCode: result.countryCode,
      currency: result.currency,
      productCount: result.productCount,
      productCountRange: result.productCountRange,
      shopifyPlus: result.shopifyPlus,
      shopifyPlusConfidence: result.shopifyPlusConfidence,
      facebookAds: result.facebookAds,
      googleAds: result.googleAds,
      tiktokAds: result.tiktokAds,
      pinterestAds: result.pinterestAds,
      dropshippingScore: result.dropshippingScore,
      podScore: result.podScore,
      activeScore: result.activeScore,
      activeTier: result.activeTier,
      emailProvider: result.emailProvider,
      smsProvider: result.smsProvider,
      reviewApp: result.reviewApp,
      chatProvider: result.chatProvider,
      phaseData: result.phaseData,
      errorMessage: result.errorMessage,
      qualified: result.qualified ?? false,
    });
  } catch (e) {
    await saveLeadStoreResult(store.id, {
      status: 'failed',
      errorMessage: e?.message || 'Pipeline failed',
      qualified: false,
      currentPhase: 0,
      phaseData: {},
    });
  }
  setTimeout(processOne, 800);
}

export function kickLeadEngineWorker() {
  if (!isLeadEngineEnabled()) return;
  if (processing || scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    if (!processing) processOne();
  }, 100);
}

export async function resumeLeadEngineOnStartup() {
  if (!isLeadEngineEnabled()) {
    console.log('[lead-engine] Disabled — set ENABLE_LEAD_ENGINE=1 to process pending stores');
    return;
  }
  kickLeadEngineWorker();
}
