import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { API } from '../api.js';
import { useAuth } from './AuthContext.jsx';

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

  // Only clear scan when switching to a different user (logout or login as another). Do not clear on initial load when user becomes available (so reload keeps the same scan).
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

  const refreshScan = React.useCallback(async () => {
    if (!scanId || !authFetch) return;
    const statusRes = await authFetch(`${API}/scan/status/${scanId}`);
    if (!statusRes.ok) {
      if (statusRes.status === 404) clearStoredScan();
      return;
    }
    const statusData = await statusRes.json();
    setScanStatus(statusData);
    const resultsRes = await authFetch(`${API}/scan/results/${scanId}`);
    if (resultsRes.ok) {
      const resultsData = await resultsRes.json();
      if (resultsData?.results != null) setResults(resultsData.results);
    }
  }, [scanId, authFetch]);

  useEffect(() => {
    if (!scanId || !authFetch) return;
    const fetchStatus = () =>
      authFetch(`${API}/scan/status/${scanId}`).then((r) => (r.ok ? r.json() : r.status === 404 ? { _notFound: true } : null));
    const fetchResults = () =>
      authFetch(`${API}/scan/results/${scanId}`).then((r) => (r.ok ? r.json() : null));
    fetchStatus().then((data) => {
      if (data?._notFound) {
        clearStoredScan();
        return;
      }
      if (data) setScanStatus(data);
    });
    fetchResults().then((data) => data?.results != null && setResults(data.results));
    let intervalId;
    const poll = () => {
      fetchStatus().then((data) => {
        if (data?._notFound) {
          clearStoredScan();
          if (intervalId) clearInterval(intervalId);
          return;
        }
        if (!data) return;
        setScanStatus(data);
        if (data.status === 'completed' || data.status === 'failed') {
          if (intervalId) clearInterval(intervalId);
          fetchResults().then((res) => res?.results != null && setResults(res.results));
          return;
        }
        fetchResults().then((res) => res?.results != null && setResults(res.results));
      });
    };
    intervalId = setInterval(poll, 2000);
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [scanId, authFetch]);

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
