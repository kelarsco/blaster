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

  useEffect(() => {
    const uid = user?.id ?? null;
    if (prevUserId.current !== uid) {
      prevUserId.current = uid;
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

  useEffect(() => {
    if (!scanId || !authFetch) return;
    const fetchStatus = () =>
      authFetch(`${API}/scan/status/${scanId}`).then((r) => (r.ok ? r.json() : null));
    const fetchResults = () =>
      authFetch(`${API}/scan/results/${scanId}`).then((r) => (r.ok ? r.json() : null));
    fetchStatus().then((data) => data && setScanStatus(data));
    fetchResults().then((data) => data?.results != null && setResults(data.results));
    let intervalId;
    const poll = () => {
      fetchStatus().then((data) => {
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
    automationOpen,
    setAutomationOpen,
    activeCampaignId,
    setActiveCampaignId,
  };

  return <ToolStateContext.Provider value={value}>{children}</ToolStateContext.Provider>;
}
