import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/SupabaseAuthContext';
import { supabaseAPI } from '../supabase-api';

const URL_TOKEN_REGEX = /(https?:\/\/[^\s<>"'`]+|(?:www\.)?[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+(?:\/[^\s<>"'`]*)?)/i;

function normalizeStoreUrl(input) {
  const raw = (input || '').trim().replace(/^[\s"'`<>()\[\]]+|[\s"'`<>()\[\]]+$/g, '');
  if (!raw) return null;
  const token = raw.match(URL_TOKEN_REGEX)?.[0] || raw;
  const withScheme = /^https?:\/\//i.test(token) ? token : `https://${token}`;
  try {
    const parsed = new URL(withScheme);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (!host) return null;
    return `https://${host}`;
  } catch (_) {
    return null;
  }
}

function parseUrls(text) {
  const raw = (text || '')
    .replace(/,/g, '\n')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set();
  const urls = [];
  for (const s of raw) {
    const normalized = normalizeStoreUrl(s);
    if (!normalized) continue;
    if (!seen.has(normalized)) {
      seen.add(normalized);
      urls.push(normalized);
    }
  }
  return urls.slice(0, 1000);
}

export function UrlInput({
  onScanStart,
  onScanStatus,
  scanId,
  scanStatus,
  existingResults = [],
  existingScanId,
}) {
  const { user } = useAuth();
  const [rawUrls, setRawUrls] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [csvName, setCsvName] = useState('');

  const urlCount = parseUrls(rawUrls).length;
  const isScanRunning = isScanning || (scanStatus && scanStatus.status === 'running');
  const isValid = urlCount >= 1 && urlCount <= 1000 && !isScanRunning;

  const onCsvUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const cells = text.split(/[\n,\r\t;]+/).map((item) => item.trim()).filter(Boolean);
      const merged = [rawUrls, ...cells].filter(Boolean).join('\n');
      const normalizedUrls = parseUrls(merged);
      setRawUrls(normalizedUrls.join('\n'));
      setCsvName(file.name);
      setError('');
    } catch (_) {
      setError('Failed to read CSV file. Please upload a valid CSV with store URLs.');
    } finally {
      event.target.value = '';
    }
  };

  const startScan = async () => {
    setError('');
    setUpgradeRequired(false);
    setLimitReached(false);
    setIsScanning(true);
    
    try {
      let maxConcurrentCrawlers = 5;
      let maxUrlsPerScan = 1000;

      // Try to get settings from localStorage for scan configuration
      try {
        const rawSettings = localStorage.getItem('blaster-settings');
        if (rawSettings) {
          const parsed = JSON.parse(rawSettings);
          if (typeof parsed.maxConcurrentCrawlers === 'number') maxConcurrentCrawlers = parsed.maxConcurrentCrawlers;
          if (typeof parsed.maxUrlsPerScan === 'number') maxUrlsPerScan = parsed.maxUrlsPerScan;
        }
      } catch (_) {}

      // Generate scan ID locally for now
      const scanId = `scan_${Date.now()}`;
      
      console.log('🔍 Starting scan with ID:', scanId);
      console.log('📊 Scan config:', { maxConcurrentCrawlers, maxUrlsPerScan, urlCount: rawUrls.split('\n').length });

      // Try to save to Supabase, but don't fail if it doesn't work
      let supabaseResult = null;
      try {
        supabaseResult = await supabaseAPI.createScan({
          id: scanId,
          rawUrls,
          maxConcurrentCrawlers,
          maxUrlsPerScan,
          userId: user?.id,
          status: 'running'
        });
        
        if (supabaseResult.error) {
          console.warn('⚠️ Supabase scan creation failed, using local mode:', supabaseResult.error);
        } else {
          console.log('✅ Scan saved to Supabase:', supabaseResult.data.id);
        }
      } catch (supabaseError) {
        console.warn('⚠️ Supabase scan creation failed, using local mode:', supabaseError);
      }

      // Simulate scan progress for demo purposes
      setTimeout(() => {
        const mockResults = rawUrls.split('\n')
          .filter(url => url.trim())
          .slice(0, 5)
          .map((url, index) => ({
            id: `${scanId}_${index}`,
            url: url.trim(),
            status: 'completed',
            emails: [`contact@${url.trim().replace(/^https?:\/\/(?:www\.)?([^/]+)/, '$1')}`],
            products: [],
            socialLinks: [],
            error: null,
            scanData: {
              urlCount: rawUrls.split('\n').filter(u => u.trim()).length,
              completedAt: new Date().toISOString(),
              scanDuration: '3 seconds'
            }
          }));

        console.log('📊 Scan completed with results:', mockResults);
        
        onScanStatus({ 
          scanId: supabaseResult?.data?.id || scanId, 
          status: 'completed', 
          results: mockResults 
        });
        
        setIsScanning(false);
      }, 3000);

    } catch (error) {
      console.error('Scan start error:', error);
      setError(error.message || 'Failed to start scan');
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (scanStatus?.status === 'completed' || scanStatus?.status === 'failed') {
      setIsScanning(false);
    }
  }, [scanStatus?.status]);

  return (
    <section className="bg-white rounded-2xl border border-[#e7e8f0] shadow-sm p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[#6d7385] mb-1">
        Input
      </h2>
      <p className="text-sm text-[#9aa0b3] mb-4">
        Paste store URLs (one per line) or upload a CSV file
      </p>
      <textarea
        value={rawUrls}
        onChange={(e) => setRawUrls(e.target.value)}
        placeholder={"https://store1.com\nhttps://store2.com\nhttps://store3.com"}
        rows={6}
        className="w-full px-4 py-3 rounded-xl bg-[#f6f7fb] border border-[#e4e7f0] text-[#222] placeholder-[#b5bbca] focus:outline-none focus:ring-2 focus:ring-[#6b6ee8]/30 focus:border-[#6b6ee8] transition"
        disabled={isScanning}
      />
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[10px] border border-[#dfe3ee] bg-[#f9faff] text-[#4f566b] hover:bg-[#f1f3fb] cursor-pointer text-sm">
            <input
              type="file"
              accept=".csv,text/csv,.txt"
              onChange={onCsvUpload}
              className="hidden"
              disabled={isScanning}
            />
            Upload CSV
          </label>
          <span className="text-[#a3a9ba]">|</span>
          <p className="text-sm text-[#5d6377]">
            {urlCount} valid URLs
          </p>
        </div>
        <button
          type="button"
          onClick={startScan}
          disabled={!isValid || isScanRunning}
          className="px-5 py-2 rounded-[10px] bg-[#1a1a21] text-white text-sm font-semibold hover:bg-[#252530] disabled:bg-[#c7cad5] disabled:text-[#8b92a7] disabled:cursor-not-allowed transition"
        >
          {isScanning ? 'Scanning…' : 'Start Scan'}
        </button>
      </div>
      {csvName ? <p className="mt-2 text-xs text-[#8a91a5]">Loaded: {csvName}</p> : null}
      {error && (
        <div className={`mt-3 p-3 rounded-lg border text-sm ${
          limitReached 
            ? 'bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-200'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200'
        }`}>
          <p>{error}</p>
          {upgradeRequired && (
            <Link to="/app/account/pricing" className="mt-2 inline-block font-medium text-blaster-accent hover:underline">
              Upgrade plan →
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
