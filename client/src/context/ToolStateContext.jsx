import React, { createContext, useContext, useState, useEffect } from 'react';
import { API } from '../api.js';
const ToolStateContext = createContext();

export function useToolState() {
  const ctx = useContext(ToolStateContext);
  if (!ctx) throw new Error('useToolState must be used within ToolStateProvider');
  return ctx;
}

export function ToolStateProvider({ children }) {
  const [scanId, setScanId] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('storereach-scanId') : null) || null);
  const [scanStatus, setScanStatus] = useState(null);
  const [results, setResults] = useState([]);
  const [automationOpen, setAutomationOpen] = useState(false);
  const [activeCampaignId, setActiveCampaignId] = useState(null);

  useEffect(() => {
    if (scanId) localStorage.setItem('storereach-scanId', scanId);
    else localStorage.removeItem('storereach-scanId');
  }, [scanId]);

  useEffect(() => {
    if (!scanId) return;
    fetch(`${API}/scan/status/${scanId}`).then((r) => (r.ok ? r.json() : null)).then((data) => data && setScanStatus(data));
    fetch(`${API}/scan/results/${scanId}`).then((r) => (r.ok ? r.json() : null)).then((data) => data?.results && setResults(data.results));
  }, [scanId]);

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
