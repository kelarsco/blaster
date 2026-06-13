import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext.jsx';
import { API } from '../api.js';
import { mapScanStatus, parseScanResultsPayload } from '../utils/scanStatus.js';

const ToolStateContext = createContext();

export function useToolState() {
  const ctx = useContext(ToolStateContext);
  if (!ctx) throw new Error('useToolState must be used within ToolStateProvider');
  return ctx;
}

export function ToolStateProvider({ children }) {
  const { user, authFetch } = useAuth();
  const prevUserId = useRef(null);
  const [scanId, setScanId] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('storereach-scanId') : null) || null);
  const [scanStatus, setScanStatus] = useState(null);
  const [results, setResults] = useState([]);
  const [automationOpen, setAutomationOpen] = useState(false);
  const [activeCampaignId, setActiveCampaignId] = useState(null);

  // Only clear scan when switching to a different user (logout or login as another). Do not clear on initial load when user becomes available (so reload keeps same scan).
  useEffect(() => {
    const uid = user?.id ?? null;
    const prev = prevUserId.current;
    if (prev === uid) return;
    const isSwitch = prev != null && uid !== prev;
    prevUserId.current = uid;
    if (isSwitch) {
      if (typeof window !== 'undefined') localStorage.removeItem('storereach-scanId');
      setScanId(null);
      setScanStatus(null);
      setResults([]);
    }
  }, [user?.id]);

  useEffect(() => {
    if (scanId) localStorage.setItem('storereach-scanId', scanId);
    else localStorage.removeItem('storereach-scanId');
  }, [scanId]);

  const clearStoredScan = () => {
    if (typeof window !== 'undefined') localStorage.removeItem('storereach-scanId');
    setScanId(null);
    setScanStatus(null);
    setResults([]);
  };

  const fetchScanResults = useCallback(
    async (id) => {
      const resultsRes = await authFetch(`${API}/scan/results/${id}`);
      if (!resultsRes.ok) return;
      const resultsData = await resultsRes.json();
      const parsed = parseScanResultsPayload(resultsData);
      if (parsed.length > 0) setResults(parsed);
    },
    [authFetch]
  );

  const fetchScanStatus = useCallback(
    async (id) => {
      if (!user || !id) return;

      try {
        const res = await authFetch(`${API}/scan/status/${id}`);
        if (res.status === 404) {
          setScanStatus({ scanId: id, status: 'not_found' });
          return;
        }
        if (!res.ok) throw new Error('Failed to fetch scan status');

        const data = await res.json();
        const currentScan = mapScanStatus(data);
        setScanStatus(currentScan);

        await fetchScanResults(id);
      } catch (error) {
        console.error('Failed to fetch scan status:', error);
        setScanStatus({ scanId: id, status: 'error', error: error.message });
      }
    },
    [user, authFetch, fetchScanResults]
  );

  useEffect(() => {
    if (!scanId || !user) return;

    let intervalId;
    let stopped = false;

    const poll = async () => {
      try {
        const res = await authFetch(`${API}/scan/status/${scanId}`);
        if (res.status === 404) return;
        if (!res.ok) throw new Error('Failed to fetch scan status');

        const data = await res.json();
        const currentScan = mapScanStatus(data);
        setScanStatus(currentScan);

        await fetchScanResults(scanId);

        if (currentScan.status === 'completed' || currentScan.status === 'failed') {
          stopped = true;
          if (intervalId) clearInterval(intervalId);
        }
      } catch (error) {
        console.error('Error polling scan:', error);
      }
    };

    poll();
    intervalId = setInterval(() => {
      if (!stopped) poll();
    }, 3000);

    return () => {
      stopped = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [scanId, user, authFetch, fetchScanResults]);

  const refreshScan = () => {
    if (scanId) fetchScanStatus(scanId);
  };

  const value = {
    scanId,
    setScanId,
    scanStatus,
    setScanStatus,
    results,
    setResults,
    refreshScan,
    automationOpen,
    setAutomationOpen,
    activeCampaignId,
    setActiveCampaignId,
  };

  return <ToolStateContext.Provider value={value}>{children}</ToolStateContext.Provider>;
}
