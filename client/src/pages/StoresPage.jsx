import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { usePlanAccess } from '../context/PlanAccessContext.jsx';
import { API } from '../api.js';
import {
  emptyFilters,
  filterLeadStores,
  exportLeadStoresCsv,
  filtersEqual,
  buildFilterTags,
} from '../utils/storeLeadFilters.js';
import { StoresFilterPanel } from '../components/stores/StoresFilterPanel.jsx';
import { StoreCard } from '../components/stores/StoreCard.jsx';
import { StoresBulkActions } from '../components/stores/StoresBulkActions.jsx';
import { StoresPagination } from '../components/stores/StoresPagination.jsx';
import { StoresPageSkeleton } from '../components/stores/StoresPageSkeleton.jsx';
import {
  FeatureLockOverlay,
  FeatureLockWrap,
  PaygConfirmModal,
} from '../components/access/PlanAccessUI.jsx';

const DEFAULT_ITEMS_PER_PAGE = 50;

export function StoresPage() {
  const { authFetch } = useAuth();
  const {
    status,
    loading: planLoading,
    access,
    recordFilterUse,
    activatePayg,
    showToast,
  } = usePlanAccess();

  const [allStores, setAllStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(emptyFilters());
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters());
  const [viewMode, setViewMode] = useState('list');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [copying, setCopying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [paygModalOpen, setPaygModalOpen] = useState(false);
  const [paygActivating, setPaygActivating] = useState(false);
  const [showPaygHint, setShowPaygHint] = useState(false);

  const storesAccess = access?.storesPage;
  const trialPartialLock = storesAccess === 'partial';
  const basicPageBlocked = storesAccess === 'blocked';
  const filtersBlocked = status?.filtersBlocked ?? false;
  const exportCopyBlocked = status?.exportCopyBlocked ?? false;
  const paygActive = status?.paygActive ?? false;
  const filterUses = status?.filterUses ?? 0;
  const filterLimit = status?.filterLimit ?? 500;
  const paygChargesCents = status?.paygChargesCents ?? 0;
  const paygCapCents = status?.paygCapCents ?? 1000;
  const showPaygOffer =
    status?.tier === 2 &&
    filterUses >= filterLimit &&
    !paygActive &&
    access?.paygAvailable;

  const loadStores = useCallback(async () => {
    try {
      const res = await authFetch(`${API}/leads/stores`);
      if (res.ok) {
        const data = await res.json();
        setAllStores(Array.isArray(data.stores) ? data.stores : []);
      }
    } catch (_) {}
    setLoading(false);
  }, [authFetch]);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedFilters, itemsPerPage]);

  const filtered = useMemo(
    () => filterLeadStores(allStores, appliedFilters),
    [allStores, appliedFilters]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const pageStores = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFilterChange = (next) => {
    if (filtersBlocked) {
      if (showPaygOffer) setShowPaygHint(true);
      return;
    }
    setFilters(next);
    if (buildFilterTags(next).length === 0) {
      setAppliedFilters(next);
      setCurrentPage(1);
    }
  };

  const handleApplyFilters = async () => {
    if (filtersBlocked) {
      if (showPaygOffer) setShowPaygHint(true);
      return;
    }
    const tags = buildFilterTags(filters);
    if (tags.length > 0 && status?.tier === 2) {
      const result = await recordFilterUse();
      if (!result.ok) {
        if (showPaygOffer) setShowPaygHint(true);
        return;
      }
    }
    setAppliedFilters(filters);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    if (filtersBlocked && trialPartialLock) return;
    const cleared = emptyFilters();
    setFilters(cleared);
    setAppliedFilters(cleared);
    setCurrentPage(1);
  };

  const hasPendingFilters = !filtersEqual(filters, appliedFilters);

  const trackExportOrCopy = useCallback(async () => {
    if (status?.tier !== 2) return { ok: true };
    return recordFilterUse();
  }, [status?.tier, recordFilterUse]);

  const handleCopyLinks = useCallback(async () => {
    if (exportCopyBlocked) {
      if (showPaygOffer) setShowPaygHint(true);
      showToast("You've reached your 500-filter limit for this month.");
      return;
    }
    const urls = filtered.map((s) => s.storeUrl).filter(Boolean);
    if (!urls.length) return;
    setCopying(true);
    try {
      const tracked = await trackExportOrCopy();
      if (!tracked.ok) return;
      await navigator.clipboard.writeText(urls.join('\n'));
    } catch (_) {}
    setCopying(false);
  }, [filtered, exportCopyBlocked, showPaygOffer, showToast, trackExportOrCopy]);

  const handleExportCsv = useCallback(async () => {
    if (exportCopyBlocked) {
      if (showPaygOffer) setShowPaygHint(true);
      showToast("You've reached your 500-filter limit for this month.");
      return;
    }
    if (!filtered.length) return;
    setExporting(true);
    try {
      const tracked = await trackExportOrCopy();
      if (!tracked.ok) return;
      exportLeadStoresCsv(filtered);
    } finally {
      setExporting(false);
    }
  }, [filtered, exportCopyBlocked, showPaygOffer, showToast, trackExportOrCopy]);

  const handlePaygConfirm = async () => {
    setPaygActivating(true);
    const result = await activatePayg();
    setPaygActivating(false);
    if (result.ok) {
      setPaygModalOpen(false);
      setShowPaygHint(false);
    }
  };

  if (loading || planLoading) {
    return (
      <div className="stores-page min-h-full bg-blaster-sidebar p-4 sm:p-6 md:p-8">
        <StoresPageSkeleton />
      </div>
    );
  }

  if (basicPageBlocked) {
    return (
      <div className="stores-page min-h-full bg-blaster-sidebar p-4 sm:p-6 md:p-8">
        <FeatureLockOverlay
          message="Upgrade to Growth to access the Stores page."
          minHeight="min(70vh, 32rem)"
          className="stores-glass"
        />
      </div>
    );
  }

  const resultsSection = (
    <>
      <StoresBulkActions
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={setItemsPerPage}
        onCopyLinks={handleCopyLinks}
        onExportCsv={handleExportCsv}
        copying={copying}
        exporting={exporting}
        canExport={filtered.length > 0 && !exportCopyBlocked}
        hasStores={filtered.length > 0}
      />

      {filtered.length === 0 ? (
        <div className="stores-glass text-center p-10">
          <p className="text-sm font-medium text-blaster-fg">
            {allStores.length === 0 ? 'No qualified stores yet' : 'No stores match your filters'}
          </p>
          <p className="text-sm text-blaster-muted mt-1">
            {allStores.length === 0
              ? 'Stores appear here after passing the lead engine qualification pipeline.'
              : 'Try adjusting your filters or clear them to see all stores.'}
          </p>
        </div>
      ) : (
        <>
          <div className={viewMode === 'grid' ? 'stores-grid' : 'stores-list'}>
            {pageStores.map((store) => (
              <StoreCard key={store.id} store={store} viewMode={viewMode} />
            ))}
          </div>
          <StoresPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </>
      )}
    </>
  );

  return (
    <div className="stores-page min-h-full bg-blaster-sidebar p-4 sm:p-6 md:p-8">
      <PaygConfirmModal
        open={paygModalOpen}
        onConfirm={handlePaygConfirm}
        onCancel={() => setPaygModalOpen(false)}
        loading={paygActivating}
      />

      <div className="flex flex-col gap-5">
        <FeatureLockWrap
          locked={trialPartialLock}
          message="Upgrade to access store filters and results."
        >
          <StoresFilterPanel
            filters={filters}
            onChange={handleFilterChange}
            onApply={handleApplyFilters}
            onClear={handleClearFilters}
            hasPendingFilters={hasPendingFilters}
            resultCount={filtered.length}
            totalCount={allStores.length}
            disabled={filtersBlocked && !trialPartialLock}
          />
        </FeatureLockWrap>

        {(showPaygHint || showPaygOffer) && !trialPartialLock && (
          <div className="plan-payg-hint">
            <span>Want more? Activate pay-as-you-go filtering.</span>
            <button type="button" onClick={() => setPaygModalOpen(true)}>
              Activate PAYG
            </button>
          </div>
        )}

        {paygActive && !trialPartialLock && (
          <p className="plan-payg-balance">
            PAYG used: ${(paygChargesCents / 100).toFixed(2)} / ${(paygCapCents / 100).toFixed(2)}
          </p>
        )}

        <FeatureLockWrap
          locked={trialPartialLock}
          message="Upgrade to access store filters and results."
        >
          {resultsSection}
        </FeatureLockWrap>
      </div>
    </div>
  );
}
