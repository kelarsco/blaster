import React, { useState, useEffect } from 'react';
import { useToolState } from '../context/ToolStateContext';
import { AutomationModal } from '../components/AutomationModal';
import { ExecutionDashboard } from '../components/ExecutionDashboard';
import { API } from '../api.js';

export function CampaignsPage() {
  const { scanId, results, setScanId, setResults, setScanStatus, automationOpen, setAutomationOpen, activeCampaignId, setActiveCampaignId } = useToolState();
  const [campaigns, setCampaigns] = useState([]);

  useEffect(() => {
    fetch(`${API}/campaigns`).then((r) => (r.ok ? r.json() : { campaigns: [] })).then((d) => setCampaigns(d.campaigns || []));
  }, [activeCampaignId]);

  return (
    <div className="p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-blaster-fg">Campaigns</h1>
          <p className="text-blaster-muted mt-0.5">Manage your email outreach campaigns</p>
        </div>
        <button
          type="button"
          onClick={() => setAutomationOpen(true)}
          className="inline-flex items-center gap-2 btn-blaster-accent shrink-0"
        >
          + New Campaign
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-blaster-bg-card rounded-xl border border-blaster-border p-12 text-center">
          <div className="text-6xl mb-4 opacity-40">✈️</div>
          <h2 className="text-xl font-semibold text-blaster-fg">No campaigns yet</h2>
          <p className="text-blaster-muted mt-2">Run a scan, then start a campaign to send emails to extracted addresses.</p>
          <button
            type="button"
            onClick={() => setAutomationOpen(true)}
            className="mt-6 btn-blaster-accent"
          >
            Create Your First Campaign
          </button>
        </div>
      ) : (
        <div className="bg-blaster-bg-card rounded-xl border border-blaster-border overflow-hidden">
          <ul className="divide-y divide-blaster-border">
            {campaigns.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-6 py-4 hover:bg-blaster-bg/50">
                <div>
                  <span className="font-medium text-blaster-fg">{c.sent} / {c.totalQueued} sent</span>
                  <span className="ml-3 text-sm text-blaster-muted capitalize">{c.status}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveCampaignId(c.id)}
                  className="text-sm text-blaster-accent hover:underline"
                >
                  View
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {automationOpen && (
        <AutomationModal
          scanId={scanId}
          results={results}
          onClose={() => setAutomationOpen(false)}
          onCampaignStart={(campaignId) => {
            setAutomationOpen(false);
            setActiveCampaignId(campaignId);
            setScanId(null);
            setResults([]);
            setScanStatus(null);
          }}
        />
      )}

      {activeCampaignId && (
        <ExecutionDashboard campaignId={activeCampaignId} onClose={() => setActiveCampaignId(null)} />
      )}
    </div>
  );
}
