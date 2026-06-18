import React, { useState, useEffect } from 'react';
import { ChevronDown, Check, X } from 'react-feather';
import {
  PLATFORMS,
  STORE_TAGS,
  PRODUCT_COUNT_RANGES,
  COUNTRY_OPTIONS,
  CURRENCY_OPTIONS,
  buildFilterTags,
  removeFilterTag,
  emptyFilters,
} from '../../utils/storeLeadFilters.js';
import { DateRangePicker } from './DateRangePicker.jsx';

function FilterOption({ selected, children, onClick }) {
  return (
    <button type="button" className="stores-filter-option" onClick={onClick}>
      <span className="stores-filter-option-body">{children}</span>
      {selected && <Check className="stores-filter-check" strokeWidth={2.5} />}
    </button>
  );
}

function FilterDropdown({ label, open, onToggle, children, menuClassName = '' }) {
  return (
    <div className="stores-filter-field">
      <button type="button" className="stores-filter-trigger" onClick={onToggle} aria-expanded={open}>
        <span className="stores-filter-trigger-label">{label}</span>
        <ChevronDown className={`stores-filter-chevron ${open ? 'is-open' : ''}`} strokeWidth={2} />
      </button>
      {open && <div className={`stores-filter-menu ${menuClassName}`}>{children}</div>}
    </div>
  );
}

export function StoresFilterPanel({
  filters,
  onChange,
  onApply,
  onClear,
  hasPendingFilters = false,
  resultCount = 0,
  totalCount = 0,
  disabled = false,
}) {
  const [openKey, setOpenKey] = useState(null);
  const [countryQuery, setCountryQuery] = useState('');
  const [currencyQuery, setCurrencyQuery] = useState('');

  useEffect(() => {
    if (!openKey) return;
    const onDoc = (e) => {
      if (e.target.closest('.stores-filter-field')) return;
      setOpenKey(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [openKey]);

  const tags = buildFilterTags(filters);

  const toggleInList = (key, value) => {
    const set = new Set(filters[key]);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    onChange({ ...filters, [key]: [...set] });
  };

  const filteredCountries = COUNTRY_OPTIONS.filter(
    (c) =>
      c.name.toLowerCase().includes(countryQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(countryQuery.toLowerCase())
  );

  const filteredCurrencies = CURRENCY_OPTIONS.filter(
    (c) =>
      c.name.toLowerCase().includes(currencyQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(currencyQuery.toLowerCase())
  );

  const toggleOpen = (key) => setOpenKey(openKey === key ? null : key);

  const handleDateChange = (dateFields) => {
    onChange({ ...filters, ...dateFields });
  };

  return (
    <div className={`stores-filter-panel stores-glass${disabled ? ' stores-filter-panel--disabled' : ''}`}>
      <div className="stores-filter-header">
        <div>
          <h2 className="stores-filter-title">Store Leads</h2>
          <p className="stores-filter-subtitle">Filter verified ecommerce stores</p>
        </div>
      </div>

      <div className="stores-filter-grid">
        <FilterDropdown
          label="Platform"
          open={openKey === 'platform'}
          onToggle={() => toggleOpen('platform')}
        >
          {PLATFORMS.map((p) => (
            <FilterOption
              key={p}
              selected={filters.platforms.includes(p)}
              onClick={() => toggleInList('platforms', p)}
            >
              {p}
            </FilterOption>
          ))}
        </FilterDropdown>

        <FilterDropdown
          label="Country"
          open={openKey === 'country'}
          onToggle={() => toggleOpen('country')}
          menuClassName="stores-filter-menu-wide"
        >
          <input
            type="search"
            value={countryQuery}
            onChange={(e) => setCountryQuery(e.target.value)}
            placeholder="Search countries…"
            className="stores-filter-search-input"
          />
          <div className="stores-filter-menu-scroll stores-filter-menu-scroll-tall">
            {filteredCountries.map((c) => (
              <FilterOption
                key={c.code}
                selected={filters.countries.includes(c.code)}
                onClick={() => toggleInList('countries', c.code)}
              >
                <span>{c.name}</span>
                <span className="stores-filter-code">{c.code}</span>
              </FilterOption>
            ))}
          </div>
        </FilterDropdown>

        <FilterDropdown
          label="Store created"
          open={openKey === 'date'}
          onToggle={() => toggleOpen('date')}
          menuClassName="stores-filter-menu-date"
        >
          <DateRangePicker
            datePreset={filters.datePreset}
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
            onChange={handleDateChange}
          />
        </FilterDropdown>

        <FilterDropdown
          label="Tags"
          open={openKey === 'tags'}
          onToggle={() => toggleOpen('tags')}
        >
          {STORE_TAGS.map((t) => (
            <FilterOption
              key={t.id}
              selected={filters.storeTags.includes(t.id)}
              onClick={() => toggleInList('storeTags', t.id)}
            >
              {t.label}
            </FilterOption>
          ))}
        </FilterDropdown>

        <FilterDropdown
          label="Product count"
          open={openKey === 'products'}
          onToggle={() => toggleOpen('products')}
        >
          <div className="stores-filter-menu-scroll">
            {PRODUCT_COUNT_RANGES.map((r) => (
              <FilterOption
                key={r.id}
                selected={filters.productRanges.includes(r.id)}
                onClick={() => toggleInList('productRanges', r.id)}
              >
                {r.label}
              </FilterOption>
            ))}
          </div>
        </FilterDropdown>

        <FilterDropdown
          label="Currency"
          open={openKey === 'currency'}
          onToggle={() => toggleOpen('currency')}
          menuClassName="stores-filter-menu-wide"
        >
          <input
            type="search"
            value={currencyQuery}
            onChange={(e) => setCurrencyQuery(e.target.value)}
            placeholder="Search currencies…"
            className="stores-filter-search-input"
          />
          <div className="stores-filter-menu-scroll stores-filter-menu-scroll-tall">
            {filteredCurrencies.map((c) => (
              <FilterOption
                key={c.code}
                selected={filters.currencies.includes(c.code)}
                onClick={() => toggleInList('currencies', c.code)}
              >
                <span>{c.name}</span>
                <span className="stores-filter-code">{c.code}</span>
              </FilterOption>
            ))}
          </div>
        </FilterDropdown>
      </div>

      {tags.length > 0 && (
        <div className="stores-filter-tags">
          {tags.map((tag) => (
            <span key={tag.key} className="stores-filter-tag">
              <span className="stores-filter-tag-text">{tag.label}</span>
              <button
                type="button"
                className="stores-filter-tag-remove"
                onClick={() => onChange(removeFilterTag(filters, tag))}
                aria-label={`Remove ${tag.label}`}
              >
                <X className="w-3 h-3" strokeWidth={2.5} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="stores-filter-result-count">
        <span>
          Found {resultCount.toLocaleString()} Stores
          {hasPendingFilters && totalCount > 0 && (
            <span className="stores-filter-pending-hint"> · click Apply to update results</span>
          )}
        </span>
        {(tags.length > 0 || hasPendingFilters) && (
          <div className="stores-filter-result-actions">
            <button
              type="button"
              className="stores-filter-apply"
              onClick={onApply}
              disabled={!hasPendingFilters}
            >
              Apply filter
            </button>
            {tags.length > 0 && (
              <button type="button" className="stores-filter-clear" onClick={onClear}>
                <X className="w-3 h-3" strokeWidth={2.5} />
                Clear
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
