import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { usePlanAccess } from '../context/PlanAccessContext.jsx';
import { API } from '../api.js';
import {
  emptyFilters,
  exportLeadStoresCsv,
  filtersEqual,
  buildFilterTags,
  buildStoresQuery,
} from '../utils/storeLeadFilters.js';
import { StoresFilterPanel } from '../components/stores/StoresFilterPanel.jsx';
import { StoreCard } from '../components/stores/StoreCard.jsx';
import { StoresBulkActions } from '../components/stores/StoresBulkActions.jsx';
import { StoresPagination } from '../components/stores/StoresPagination.jsx';
import { StoresPageSkeleton } from '../components/stores/StoresPageSkeleton.jsx';
import { StoresExportFieldsModal } from '../components/stores/StoresExportFieldsModal.jsx';
import {
  FeatureLockOverlay,
  PaygConfirmModal,
} from '../components/access/PlanAccessUI.jsx';

const DEFAULT_ITEMS_PER_PAGE = 50;
const MAX_EXPORT_BATCH = 50000;

export function StoresPage() {
  const { authFetch } = useAuth();
  const {
    status,
    loading: planLoading,
    access,
    trialExpired,
    recordFilterUse,
    activatePayg,
    openUpgradeModal,
  } = usePlanAccess();

  const [stores, setStores] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [filters, setFilters] = useState(emptyFilters());
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters());
  const [viewMode, setViewMode] = useState('list');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [copying, setCopying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [applyingFilters, setApplyingFilters] = useState(false);
  const [paygModalOpen, setPaygModalOpen] = useState(false);
  const [paygActivating, setPaygActivating] = useState(false);
  const [showPaygHint, setShowPaygHint] = useState(false);

  const storesAccess = access?.storesPage;
  const basicPageBlocked = storesAccess === 'blocked' || trialExpired;
  const filtersBlocked = status?.filtersBlocked ?? false;
  const exportCopyBlocked = status?.exportCopyBlocked ?? false;
  const paygActive = status?.paygActive ?? false;
  const filterUses = status?.filterUses ?? 0;
  const filterLimit = status?.filterLimit ?? 500;
  const paygChargesCents = status?.paygChargesCents ?? 0;
  const paygCapCents = status?.paygCapCents ?? 1000;
  const showPaygOffer =
    (status?.tier === 1 || status?.tier === 2) &&
    filterUses >= filterLimit &&
    !paygActive &&
    access?.paygAvailable;

  const promptFilterUpgrade = useCallback(() => {
    if (!filtersBlocked) return true;
    if (showPaygOffer) {
      setPaygModalOpen(true);
      return false;
    }
    const tier = status?.upgradeTierInfo?.[status?.tier === 0 ? 1 : status?.tier === 1 ? 2 : 3];
    openUpgradeModal({
      title: 'Filter limit reached',
      message: paygActive
        ? `You've reached your pay-as-you-go filter cap for this period. Upgrade for unlimited store filters.`
        : `You've used all ${filterLimit} store filters for this period. Upgrade your plan for more filters.`,
      tierName: tier?.name,
      tierPrice: tier?.price,
    });
    return false;
  }, [
    filtersBlocked,
    showPaygOffer,
    status?.tier,
    status?.upgradeTierInfo,
    paygActive,
    filterLimit,
    openUpgradeModal,
  ]);

  const fetchStoresPage = useCallback(
    async (activeFilters, page, limit) => {
      const qs = buildStoresQuery(activeFilters, { page, limit });
      const res = await authFetch(`${API}/leads/stores?${qs}`);
      if (!res.ok) return null;
      return res.json();
    },
    [authFetch]
  );

  const loadStores = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await fetchStoresPage(appliedFilters, currentPage, itemsPerPage);
      if (data) {
        setStores(Array.isArray(data.stores) ? data.stores : []);
        setTotalCount(Number(data.total) || 0);
      }
    } catch (_) {}
    setLoading(false);
    setListLoading(false);
  }, [appliedFilters, currentPage, itemsPerPage, fetchStoresPage]);

  useEffect(() => {
    if (basicPageBlocked || planLoading) return;
    loadStores();
  }, [loadStores, basicPageBlocked, planLoading]);

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedFilters, itemsPerPage]);

  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

  const fetchAllFilteredStores = useCallback(async () => {
    const batchLimit = Math.min(Math.max(totalCount, 1), MAX_EXPORT_BATCH);
    const data = await fetchStoresPage(appliedFilters, 1, batchLimit);
    return Array.isArray(data?.stores) ? data.stores : [];
  }, [appliedFilters, fetchStoresPage, totalCount]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFilterChange = (next) => {
    if (!promptFilterUpgrade()) return;
    setFilters(next);
    if (buildFilterTags(next).length === 0) {
      setAppliedFilters(next);
      setCurrentPage(1);
    }
  };

  const handleApplyFilters = async () => {
    if (!promptFilterUpgrade()) return;
    if (!hasPendingFilters) return;
    setApplyingFilters(true);
    try {
      const tags = buildFilterTags(filters);
      if (tags.length > 0 && (status?.tier === 0 || status?.tier === 1 || status?.tier === 2)) {
        const result = await recordFilterUse();
        if (!result.ok) {
          promptFilterUpgrade();
          return;
        }
      }
      setAppliedFilters(filters);
      setCurrentPage(1);
    } finally {
      setApplyingFilters(false);
    }
  };

  const handleClearFilters = () => {
    if (filtersBlocked) return;
    const cleared = emptyFilters();
    setFilters(cleared);
    setAppliedFilters(cleared);
    setCurrentPage(1);
  };

  const hasPendingFilters = !filtersEqual(filters, appliedFilters);

  const trackExportOrCopy = useCallback(async () => {
    if (status?.tier === 3) return { ok: true };
    if (status?.tier === 0 || status?.tier === 1 || status?.tier === 2) return recordFilterUse();
    return { ok: true };
  }, [status?.tier, recordFilterUse]);

  const handleCopyLinks = useCallback(async () => {
    if (exportCopyBlocked) {
      promptFilterUpgrade();
      return;
    }
    const urls = stores.map((s) => s.storeUrl).filter(Boolean);
    if (!urls.length) return;
    setCopying(true);
    try {
      const tracked = await trackExportOrCopy();
      if (!tracked.ok) return;
      await navigator.clipboard.writeText(urls.join('\n'));
    } catch (_) {}
    setCopying(false);
  }, [stores, exportCopyBlocked, promptFilterUpgrade, trackExportOrCopy]);

  const handleExportClick = useCallback(() => {
    if (exportCopyBlocked) {
      promptFilterUpgrade();
      return;
    }
    if (!totalCount) return;
    setExportModalOpen(true);
  }, [totalCount, exportCopyBlocked, promptFilterUpgrade]);

  const handleExportConfirm = useCallback(
    async (fields) => {
      setExportModalOpen(false);
      setExporting(true);
      try {
        const tracked = await trackExportOrCopy();
        if (!tracked.ok) return;
        const allFiltered = await fetchAllFilteredStores();
        exportLeadStoresCsv(allFiltered, fields);
      } finally {
        setExporting(false);
      }
    },
    [fetchAllFilteredStores, trackExportOrCopy]
  );

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
          message="Start a $1 trial or choose a plan to access the Stores page."
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
        onExportCsv={handleExportClick}
        copying={copying}
        exporting={exporting}
        canExport={totalCount > 0 && !exportCopyBlocked}
        hasStores={totalCount > 0}
      />

      {listLoading && stores.length === 0 ? (
        <div className="stores-glass text-center p-10">
          <p className="text-sm text-blaster-muted animate-pulse">Loading stores…</p>
        </div>
      ) : totalCount === 0 ? (
        <div className="stores-glass text-center p-10">
          <p className="text-sm font-medium text-blaster-fg">
            {buildFilterTags(appliedFilters).length === 0 ? 'No qualified stores yet' : 'No stores match your filters'}
          </p>
          <p className="text-sm text-blaster-muted mt-1">
            {buildFilterTags(appliedFilters).length === 0
              ? 'Stores appear here after passing the lead engine qualification pipeline.'
              : 'Try adjusting your filters or clear them to see all stores.'}
          </p>
        </div>
      ) : (
        <>
          <div className={viewMode === 'grid' ? 'stores-grid' : 'stores-list'}>
            {stores.map((store) => (
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
      {exportModalOpen && (
        <StoresExportFieldsModal
          onClose={() => setExportModalOpen(false)}
          onConfirm={handleExportConfirm}
        />
      )}

      <div className="flex flex-col gap-5">
        <StoresFilterPanel
          filters={filters}
          onChange={handleFilterChange}
          onApply={handleApplyFilters}
          onClear={handleClearFilters}
          hasPendingFilters={hasPendingFilters}
          applying={applyingFilters}
          resultCount={totalCount}
          onBlockedInteract={promptFilterUpgrade}
        />

        {(showPaygHint || showPaygOffer) && (
          <div className="plan-payg-hint">
            <span>Want more? Activate pay-as-you-go filtering ($1 per 100 searches).</span>
            <button type="button" onClick={() => setPaygModalOpen(true)}>
              Activate PAYG
            </button>
          </div>
        )}

        {paygActive && (
          <p className="plan-payg-balance">
            PAYG used: ${(paygChargesCents / 100).toFixed(2)} / ${(paygCapCents / 100).toFixed(2)}
          </p>
        )}

        {resultsSection}
      </div>
    </div>
  );
}
