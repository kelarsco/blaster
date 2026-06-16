import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useToolState } from '../context/ToolStateContext';
import { useAuth } from '../context/AuthContext';
import { API } from '../api.js';
import { exportScanResultsCsv } from '../utils/scannerUrls.js';
import { StoreCard } from '../components/stores/StoreCard.jsx';
import { StoresBulkActions } from '../components/stores/StoresBulkActions.jsx';
import { StoresPagination } from '../components/stores/StoresPagination.jsx';

const DEFAULT_ITEMS_PER_PAGE = 50;

export function StoresPage() {
  const { scanId, results, setResults } = useToolState();
  const { authFetch } = useAuth();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [loading, setLoading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [scanId, search, itemsPerPage]);

  useEffect(() => {
    if (!scanId || !authFetch) return;
    let cancelled = false;
    setLoading(true);
    authFetch(`${API}/scan/results/${scanId}`)
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setResults(data.results || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scanId, authFetch, setResults]);

  const filtered = useMemo(() => {
    const list = results || [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (store) =>
        (store.storeUrl && store.storeUrl.toLowerCase().includes(q)) ||
        (store.emails || []).some(
          (e) => e.email?.toLowerCase().includes(q) || e.sourcePage?.toLowerCase().includes(q)
        ) ||
        (store.phone && store.phone.toLowerCase().includes(q))
    );
  }, [results, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const pageStores = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  const withEmailCount = filtered.filter((s) => s.hasEmail || (s.emails && s.emails.length > 0)).length;
  const canExport = filtered.some((s) => s.hasEmail || (s.emails && s.emails.length > 0));

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCopyLinks = useCallback(async () => {
    const urls = filtered.map((s) => s.storeUrl).filter(Boolean);
    if (!urls.length) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(urls.join('\n'));
    } catch (_) {}
    setCopying(false);
  }, [filtered]);

  const handleExportCsv = useCallback(() => {
    if (!canExport) return;
    setExporting(true);
    try {
      exportScanResultsCsv(
        filtered,
        { storeUrl: true, email: true, phone: true, whatsapp: true, instagram: true, tiktok: true },
        { email: true, phone: true, whatsapp: true, instagram: true, tiktok: true }
      );
    } finally {
      setExporting(false);
    }
  }, [filtered, canExport]);

  return (
    <div className="stores-page min-h-full bg-blaster-sidebar p-4 sm:p-6 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="page-title-mobile">Stores</h1>
        <p className="text-xs md:text-sm text-blaster-muted mt-0.5">
          Browse store links and contact details from your scans
        </p>
        {scanId && !loading ? (
          <p className="text-xs text-blaster-muted mt-1">
            {filtered.length} stores · {withEmailCount} with email
          </p>
        ) : null}
      </div>

      {!scanId ? (
        <div className="stores-glass text-center p-8 md:p-12">
          <p className="text-blaster-muted mb-4">No scan in progress. Run a scan to collect store contacts.</p>
          <Link
            to="/app/scanner"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-black border border-blaster-orange text-[#faf8f5] text-sm font-medium shadow-blaster-cta hover:opacity-90 transition"
          >
            Go to Scanner
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <StoresBulkActions
            visibleCount={pageStores.length}
            totalCount={filtered.length}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={setItemsPerPage}
            search={search}
            onSearchChange={setSearch}
            onCopyLinks={handleCopyLinks}
            onExportCsv={handleExportCsv}
            copying={copying}
            exporting={exporting}
            canExport={canExport}
          />

          {loading ? (
            <div className="stores-loading">
              <div className="stores-spinner" aria-hidden />
              <span>Loading stores…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="stores-glass text-center p-10">
              <p className="text-sm font-medium text-blaster-fg">
                {search.trim() ? 'No stores match your search' : 'No stores scanned yet'}
              </p>
              <p className="text-sm text-blaster-muted mt-1">
                {search.trim() ? 'Try a different search term.' : 'Results appear after your scan completes.'}
              </p>
            </div>
          ) : (
            <>
              <div className={viewMode === 'grid' ? 'stores-grid' : 'stores-list'}>
                {pageStores.map((store) => (
                  <StoreCard key={store.storeUrl} store={store} viewMode={viewMode} />
                ))}
              </div>
              <StoresPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
