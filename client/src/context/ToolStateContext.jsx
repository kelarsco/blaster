import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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

  const fetchScanStatus = async (scanId) => {
    if (!user || !scanId) return;
    
    try {
      // Get scan status from Railway API
      const res = await authFetch(`${API}/scans`);
      if (!res.ok) throw new Error('Failed to fetch scan status');
      
      const scansData = await res.json();
      const currentScan = scansData?.find(s => s.id === scanId);
      
      if (!currentScan) {
        setScanStatus({ status: 'not_found' });
        return;
      }
      
      setScanStatus(currentScan);
      
      // Get scan results
      const resultsRes = await authFetch(`${API}/scan/results/${scanId}`);
      if (resultsRes.ok) {
        const resultsData = await resultsRes.json();
        if (resultsData?.length > 0) {
          setResults(resultsData);
        }
      }
    } catch (error) {
      console.error('Failed to fetch scan status:', error);
      setScanStatus({ status: 'error', error: error.message });
    }
  };

  useEffect(() => {
    if (!scanId || !user) return;
    
    let intervalId;
    
    const poll = async () => {
      try {
        // Get scan status from Railway API
        const res = await authFetch(`${API}/scans`);
        if (!res.ok) throw new Error('Failed to fetch scan status');
        
        const scansData = await res.json();
        const currentScan = scansData?.find(s => s.id === scanId);
        
        if (!currentScan) {
          clearStoredScan();
          if (intervalId) clearInterval(intervalId);
          return;
        }
        
        setScanStatus(currentScan);
        
        if (currentScan.status === 'completed' || currentScan.status === 'failed') {
          if (intervalId) clearInterval(intervalId);
          // Get final results
          const resultsRes = await authFetch(`${API}/scan/results/${scanId}`);
          if (resultsRes.ok) {
            const resultsData = await resultsRes.json();
            if (resultsData?.length > 0) {
              setResults(resultsData);
            }
          }
          return;
        }
        
        // Get results for in-progress scans
        const resultsRes = await authFetch(`${API}/scan/results/${scanId}`);
        if (resultsRes.ok) {
          const resultsData = await resultsRes.json();
          if (resultsData?.length > 0) {
            setResults(resultsData);
          }
        }
      } catch (error) {
        console.error('Error polling scan:', error);
      }
    };
    
    // Initial fetch
    poll();
    
    // Set up polling
    intervalId = setInterval(poll, 5000);
    
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [scanId, user]);

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
