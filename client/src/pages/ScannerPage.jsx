import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UrlInput } from '../components/UrlInput';
import { ResultsDashboard } from '../components/ResultsDashboard';
import { useToolState } from '../context/ToolStateContext';
import { useAuth } from '../context/AuthContext.jsx';
import { API } from '../api.js';

function UpgradePrompt() {
  const navigate = useNavigate();
  
  return (
    <div className="bg-blaster-bg-card rounded-lg border border-blaster-border p-6 text-center">
      <div className="mb-4">
        <div className="w-16 h-16 mx-auto mb-4 bg-blaster-accent/10 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-blaster-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-blaster-fg mb-2">Upgrade Required</h3>
        <p className="text-blaster-muted mb-6">
          You need an active subscription to use the scanner service. Choose a plan to get started with email extraction and automated outreach.
        </p>
      </div>
      <div className="space-y-3">
        <button
          onClick={() => navigate('/app/account/pricing')}
          className="w-full bg-blaster-accent hover:bg-blaster-accent/90 text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          Choose Plan
        </button>
        <button
          onClick={() => navigate('/app/account/settings/usage')}
          className="w-full bg-blaster-bg hover:bg-blaster-bg/80 text-blaster-fg border border-blaster-border px-6 py-3 rounded-lg font-medium transition-colors"
        >
          View Current Plan
        </button>
      </div>
    </div>
  );
}

export function ScannerPage() {
  const {
    scanId,
    setScanId,
    scanStatus,
    setScanStatus,
    results,
    setResults,
    setAutomationOpen,
  } = useToolState();
  const { authFetch, subscription, user } = useAuth();
  const navigate = useNavigate();

  // HARDCODED BYPASS - Manual admin upgrades (temporary fix)
  const MANUALLY_UPGRADED_USERS = [
    'dkelaroma@gmail.com', // Add other manually upgraded users here
  ];

  // Ultimate bypass - check if user is in manually upgraded list
  const shouldShowUpgradePrompt = () => {
    // HARDCODED CHECK: If user email is in manually upgraded list, NO upgrade prompt
    if (user && MANUALLY_UPGRADED_USERS.includes(user.email)) {
      console.log('BYPASS: User is in manually upgraded list:', user.email);
      return false;
    }
    
    // FIRST PRIORITY: Check user object directly (most reliable for admin upgrades)
    if (user) {
      // If user has admin or premium role, NO upgrade prompt
      if (user.role === 'admin' || user.role === 'premium') return false;
      
      // If user has planId that's not free, NO upgrade prompt
      if (user.planId && user.planId !== 'free') return false;
      
      // If user has any plan property that indicates paid status
      if (user.plan && user.plan !== 'free') return false;
    }
    
    // SECOND PRIORITY: Check subscription object (for Paystack users)
    if (subscription) {
      // If admin manually upgraded flag is set, NO upgrade prompt
      if (subscription.adminUpgraded) return false;
      
      // If subscription has any planId that's not free, NO upgrade prompt
      if (subscription.planId && subscription.planId !== 'free') return false;
      
      // If explicitly free plan, show upgrade prompt
      if (subscription.planId === 'free') return true;
    }
    
    // FALLBACK: If no data, show upgrade prompt
    return true;
  };

  // Debug logging (remove in production)
  console.log('ScannerPage Debug - HARDCODED BYPASS:', {
    userEmail: user?.email,
    isInManualList: user && MANUALLY_UPGRADED_USERS.includes(user.email),
    manuallyUpgradedUsers: MANUALLY_UPGRADED_USERS,
    user: user ? { 
      id: user.id, 
      role: user.role, 
      planId: user.planId,
      plan: user.plan,
      email: user.email 
    } : null,
    subscription: subscription ? { 
      status: subscription.status, 
      planId: subscription.planId, 
      adminUpgraded: subscription.adminUpgraded 
    } : null,
    shouldShowUpgradePrompt: shouldShowUpgradePrompt(),
    userRole: user?.role,
    userPlanId: user?.planId,
    userPlan: user?.plan
  });

  // Show upgrade prompt only for free users
  if (shouldShowUpgradePrompt()) {
    return (
      <div className="p-4 sm:p-6 md:p-8 bg-[#f5f6fb] min-h-full">
        <div className="mb-4 md:mb-6">
          <h1 className="page-title-mobile">Scanner</h1>
          <p className="text-xs md:text-sm text-blaster-muted mt-0.5">Fetch store pages and extract contact emails</p>
        </div>
        <UpgradePrompt />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-[#f5f6fb] min-h-full">
      <div className="mb-4 md:mb-6">
        <h1 className="page-title-mobile">Scanner</h1>
        <p className="text-xs md:text-sm text-blaster-muted mt-0.5">Fetch store pages and extract contact emails</p>
      </div>
      <div className="space-y-4 md:space-y-6">
        <UrlInput
          onScanStart={(id) => {
            setScanId(id);
            setScanStatus({ scanId: id, status: 'running', processed: 0, totalUrls: 0, foundCount: 0 });
          }}
          onScanStatus={setScanStatus}
          scanId={scanId}
          scanStatus={scanStatus}
          existingResults={results}
          existingScanId={scanId}
        />
        {scanId && (
          <ResultsDashboard
            scanId={scanId}
            scanStatus={scanStatus}
            results={results}
            onResults={setResults}
            onExportExcel={async (fields) => {
              if (!scanId) return;
              const params = new URLSearchParams();
              if (fields && fields.length) params.set('fields', fields.join(','));
              const qs = params.toString();
              const url = `${API}/export/excel/${scanId}${qs ? `?${qs}` : ''}`;
              try {
                const res = await authFetch(url, { method: 'GET' });
                if (!res.ok) {
                  const data = await res.json().catch(() => ({}));
                  alert(data?.error || `Export failed (${res.status})`);
                  return;
                }
                const blob = await res.blob();
                const contentDisposition = res.headers.get('content-disposition') || '';
                const fileNameMatch = contentDisposition.match(/filename="([^"]+)"/i);
                const fileName = fileNameMatch?.[1] || `storereach-${scanId}.xlsx`;
                const objectUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = objectUrl;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(objectUrl);
              } catch (e) {
                alert(e?.message || 'Export failed');
              }
            }}
            onStartAutomation={() => {
              navigate('/app/campaigns');
              setAutomationOpen(true);
            }}
            onClearResults={() => {
              setScanId(null);
              setResults([]);
              setScanStatus(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
