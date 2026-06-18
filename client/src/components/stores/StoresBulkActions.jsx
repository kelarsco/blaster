import React from 'react';
import { Copy, Download, Grid, List } from 'react-feather';

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

export function StoresBulkActions({
  viewMode,
  onViewModeChange,
  itemsPerPage,
  onItemsPerPageChange,
  onCopyLinks,
  onExportCsv,
  copying,
  exporting,
  canExport,
  hasStores,
}) {
  return (
    <div className="stores-glass stores-bulk-bar stores-bulk-bar-full">
      <label className="stores-bulk-show flex items-center gap-2 text-sm text-blaster-muted shrink-0">
        Show
        <select
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          className="stores-select"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </label>

      <div className="stores-bulk-bar-end">
        <div className="stores-view-toggle stores-bulk-view-toggle">
          <button
            type="button"
            className={`stores-view-btn ${viewMode === 'grid' ? 'is-active' : ''}`}
            onClick={() => onViewModeChange('grid')}
            aria-pressed={viewMode === 'grid'}
          >
            <Grid className="w-4 h-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={`stores-view-btn ${viewMode === 'list' ? 'is-active' : ''}`}
            onClick={() => onViewModeChange('list')}
            aria-pressed={viewMode === 'list'}
          >
            <List className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="stores-bulk-action-btns">
        <button
          type="button"
          className="stores-action-btn"
          onClick={onCopyLinks}
          disabled={copying || !hasStores}
        >
          <Copy className="w-4 h-4" strokeWidth={1.75} />
          {copying ? 'Copying…' : 'Copy links'}
        </button>
        <button
          type="button"
          className="stores-action-btn stores-action-btn-primary"
          onClick={onExportCsv}
          disabled={exporting || !canExport}
        >
          <Download className="w-4 h-4" strokeWidth={1.75} />
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>
      </div>
    </div>
  );
}
