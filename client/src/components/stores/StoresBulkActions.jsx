import React from 'react';
import { Copy, Download, Grid, List } from 'react-feather';

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

export function StoresBulkActions({
  visibleCount, totalCount, viewMode, onViewModeChange, itemsPerPage, onItemsPerPageChange,
  search, onSearchChange, onCopyLinks, onExportCsv, copying, exporting, canExport,
}) {
  return (
    <div className="stores-glass stores-bulk-bar">
      <p className="text-sm text-blaster-muted">
        Showing <strong className="text-blaster-fg font-semibold">{visibleCount}</strong> of{' '}
        <strong className="text-blaster-fg font-semibold">{totalCount}</strong> stores
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search stores or emails…"
          className="stores-search"
        />
        <label className="flex items-center gap-2 text-sm text-blaster-muted">
          Show
          <select value={itemsPerPage} onChange={(e) => onItemsPerPageChange(Number(e.target.value))} className="stores-select">
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
        <div className="stores-view-toggle">
          <button type="button" className={`stores-view-btn ${viewMode === 'grid' ? 'is-active' : ''}`} onClick={() => onViewModeChange('grid')} aria-pressed={viewMode === 'grid'}>
            <Grid className="w-4 h-4" strokeWidth={1.75} />
          </button>
          <button type="button" className={`stores-view-btn ${viewMode === 'list' ? 'is-active' : ''}`} onClick={() => onViewModeChange('list')} aria-pressed={viewMode === 'list'}>
            <List className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
        <button type="button" className="stores-action-btn" onClick={onCopyLinks} disabled={copying || visibleCount === 0}>
          <Copy className="w-4 h-4" strokeWidth={1.75} />
          {copying ? 'Copying…' : 'Copy links'}
        </button>
        <button type="button" className="stores-action-btn stores-action-btn-primary" onClick={onExportCsv} disabled={exporting || !canExport}>
          <Download className="w-4 h-4" strokeWidth={1.75} />
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>
    </div>
  );
}
