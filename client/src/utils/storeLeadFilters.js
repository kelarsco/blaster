import { ALL_COUNTRIES } from '../data/countries.js';

export const PLATFORMS = ['Shopify', 'WooCommerce', 'Wix', 'WordPress'];

export const STORE_TAGS = [
  { id: 'dropshipping', label: 'Dropshipping' },
  { id: 'print_on_demand', label: 'Print on Demand' },
  { id: 'shopify_plus', label: 'Shopify Plus' },
  { id: 'has_ads', label: 'Has Ads Running' },
];

export const PRODUCT_COUNT_RANGES = [
  { id: '1-9', label: '1–9', min: 1, max: 9 },
  { id: '10-39', label: '10–39', min: 10, max: 39 },
  { id: '40-99', label: '40–99', min: 40, max: 99 },
  { id: '100-149', label: '100–149', min: 100, max: 149 },
  { id: '150-199', label: '150–199', min: 150, max: 199 },
  { id: '200-249', label: '200–249', min: 200, max: 249 },
  { id: '250-299', label: '250–299', min: 250, max: 299 },
  { id: '300-399', label: '300–399', min: 300, max: 399 },
  { id: '400-499', label: '400–499', min: 400, max: 499 },
  { id: '500-999', label: '500–999', min: 500, max: 999 },
  { id: '1000-1999', label: '1000–1999', min: 1000, max: 1999 },
  { id: '2000-2999', label: '2000–2999', min: 2000, max: 2999 },
];

export const DATE_PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
];

export const COUNTRY_OPTIONS = ALL_COUNTRIES;

export const CURRENCY_OPTIONS = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'HKD', name: 'Hong Kong Dollar' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'SEK', name: 'Swedish Krona' },
  { code: 'KRW', name: 'South Korean Won' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'NOK', name: 'Norwegian Krone' },
  { code: 'MXN', name: 'Mexican Peso' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'RUB', name: 'Russian Ruble' },
  { code: 'ZAR', name: 'South African Rand' },
  { code: 'BRL', name: 'Brazilian Real' },
  { code: 'TRY', name: 'Turkish Lira' },
  { code: 'PLN', name: 'Polish Zloty' },
  { code: 'THB', name: 'Thai Baht' },
  { code: 'IDR', name: 'Indonesian Rupiah' },
  { code: 'HUF', name: 'Hungarian Forint' },
  { code: 'CZK', name: 'Czech Koruna' },
  { code: 'ILS', name: 'Israeli Shekel' },
  { code: 'CLP', name: 'Chilean Peso' },
  { code: 'PHP', name: 'Philippine Peso' },
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'COP', name: 'Colombian Peso' },
  { code: 'SAR', name: 'Saudi Riyal' },
  { code: 'MYR', name: 'Malaysian Ringgit' },
  { code: 'RON', name: 'Romanian Leu' },
  { code: 'DKK', name: 'Danish Krone' },
  { code: 'ARS', name: 'Argentine Peso' },
  { code: 'GTQ', name: 'Guatemalan Quetzal' },
  { code: 'EGP', name: 'Egyptian Pound' },
  { code: 'VND', name: 'Vietnamese Dong' },
  { code: 'PKR', name: 'Pakistani Rupee' },
  { code: 'NGN', name: 'Nigerian Naira' },
  { code: 'UAH', name: 'Ukrainian Hryvnia' },
  { code: 'QAR', name: 'Qatari Riyal' },
  { code: 'KWD', name: 'Kuwaiti Dinar' },
  { code: 'BHD', name: 'Bahraini Dinar' },
  { code: 'OMR', name: 'Omani Rial' },
  { code: 'JOD', name: 'Jordanian Dinar' },
  { code: 'LBP', name: 'Lebanese Pound' },
  { code: 'MAD', name: 'Moroccan Dirham' },
  { code: 'TWD', name: 'New Taiwan Dollar' },
  { code: 'PEN', name: 'Peruvian Sol' },
  { code: 'CRC', name: 'Costa Rican Colón' },
  { code: 'UYU', name: 'Uruguayan Peso' },
  { code: 'BOB', name: 'Bolivian Boliviano' },
  { code: 'DOP', name: 'Dominican Peso' },
  { code: 'JMD', name: 'Jamaican Dollar' },
  { code: 'TTD', name: 'Trinidad Dollar' },
  { code: 'BBD', name: 'Barbadian Dollar' },
  { code: 'BSD', name: 'Bahamian Dollar' },
  { code: 'BZD', name: 'Belize Dollar' },
  { code: 'XCD', name: 'East Caribbean Dollar' },
  { code: 'GYD', name: 'Guyanese Dollar' },
  { code: 'SRD', name: 'Surinamese Dollar' },
  { code: 'HTG', name: 'Haitian Gourde' },
  { code: 'CUP', name: 'Cuban Peso' },
  { code: 'PYG', name: 'Paraguayan Guaraní' },
  { code: 'NIO', name: 'Nicaraguan Córdoba' },
  { code: 'HNL', name: 'Honduran Lempira' },
  { code: 'PAB', name: 'Panamanian Balboa' },
  { code: 'ISK', name: 'Icelandic Króna' },
  { code: 'BGN', name: 'Bulgarian Lev' },
  { code: 'HRK', name: 'Croatian Kuna' },
  { code: 'RSD', name: 'Serbian Dinar' },
  { code: 'ALL', name: 'Albanian Lek' },
  { code: 'MKD', name: 'Macedonian Denar' },
  { code: 'BAM', name: 'Bosnia Mark' },
  { code: 'MDL', name: 'Moldovan Leu' },
  { code: 'GEL', name: 'Georgian Lari' },
  { code: 'AMD', name: 'Armenian Dram' },
  { code: 'AZN', name: 'Azerbaijani Manat' },
  { code: 'KZT', name: 'Kazakhstani Tenge' },
  { code: 'UZS', name: 'Uzbekistani Som' },
  { code: 'KGS', name: 'Kyrgyzstani Som' },
  { code: 'TJS', name: 'Tajikistani Somoni' },
  { code: 'TMT', name: 'Turkmenistani Manat' },
  { code: 'AFN', name: 'Afghan Afghani' },
  { code: 'BDT', name: 'Bangladeshi Taka' },
  { code: 'LKR', name: 'Sri Lankan Rupee' },
  { code: 'NPR', name: 'Nepalese Rupee' },
  { code: 'MMK', name: 'Myanmar Kyat' },
  { code: 'KHR', name: 'Cambodian Riel' },
  { code: 'LAK', name: 'Lao Kip' },
  { code: 'MNT', name: 'Mongolian Tögrög' },
  { code: 'BTN', name: 'Bhutanese Ngultrum' },
  { code: 'MVR', name: 'Maldivian Rufiyaa' },
  { code: 'FJD', name: 'Fijian Dollar' },
  { code: 'WST', name: 'Samoan Tala' },
  { code: 'TOP', name: 'Tongan Paʻanga' },
  { code: 'VUV', name: 'Vanuatu Vatu' },
  { code: 'SBD', name: 'Solomon Islands Dollar' },
  { code: 'PGK', name: 'Papua New Guinean Kina' },
  { code: 'KES', name: 'Kenyan Shilling' },
  { code: 'TZS', name: 'Tanzanian Shilling' },
  { code: 'UGX', name: 'Ugandan Shilling' },
  { code: 'GHS', name: 'Ghanaian Cedi' },
  { code: 'XOF', name: 'West African CFA Franc' },
  { code: 'XAF', name: 'Central African CFA Franc' },
  { code: 'ZMW', name: 'Zambian Kwacha' },
  { code: 'BWP', name: 'Botswana Pula' },
  { code: 'MUR', name: 'Mauritian Rupee' },
  { code: 'SCR', name: 'Seychellois Rupee' },
  { code: 'MZN', name: 'Mozambican Metical' },
  { code: 'AOA', name: 'Angolan Kwanza' },
  { code: 'ETB', name: 'Ethiopian Birr' },
  { code: 'RWF', name: 'Rwandan Franc' },
  { code: 'CDF', name: 'Congolese Franc' },
  { code: 'SDG', name: 'Sudanese Pound' },
  { code: 'LYD', name: 'Libyan Dinar' },
  { code: 'TND', name: 'Tunisian Dinar' },
  { code: 'DZD', name: 'Algerian Dinar' },
  { code: 'MGA', name: 'Malagasy Ariary' },
  { code: 'SLL', name: 'Sierra Leonean Leone' },
  { code: 'GMD', name: 'Gambian Dalasi' },
  { code: 'GNF', name: 'Guinean Franc' },
  { code: 'CVE', name: 'Cape Verdean Escudo' },
  { code: 'STN', name: 'São Tomé Dobra' },
  { code: 'LSL', name: 'Lesotho Loti' },
  { code: 'SZL', name: 'Swazi Lilangeni' },
  { code: 'NAD', name: 'Namibian Dollar' },
  { code: 'MWK', name: 'Malawian Kwacha' },
  { code: 'ZWL', name: 'Zimbabwean Dollar' },
  { code: 'BIF', name: 'Burundian Franc' },
  { code: 'DJF', name: 'Djiboutian Franc' },
  { code: 'ERN', name: 'Eritrean Nakfa' },
  { code: 'SOS', name: 'Somali Shilling' },
  { code: 'KMF', name: 'Comorian Franc' },
  { code: 'MOP', name: 'Macanese Pataca' },
  { code: 'BND', name: 'Brunei Dollar' },
  { code: 'LRD', name: 'Liberian Dollar' },
  { code: 'SYP', name: 'Syrian Pound' },
  { code: 'YER', name: 'Yemeni Rial' },
  { code: 'IQD', name: 'Iraqi Dinar' },
  { code: 'IRR', name: 'Iranian Rial' },
];

export function emptyFilters() {
  return {
    platforms: [],
    countries: [],
    datePreset: null,
    dateFrom: '',
    dateTo: '',
    storeTags: [],
    productRanges: [],
    currencies: [],
  };
}

export function filtersEqual(a, b) {
  if (!a || !b) return false;
  return (
    a.datePreset === b.datePreset &&
    a.dateFrom === b.dateFrom &&
    a.dateTo === b.dateTo &&
    JSON.stringify(a.platforms) === JSON.stringify(b.platforms) &&
    JSON.stringify(a.countries) === JSON.stringify(b.countries) &&
    JSON.stringify(a.storeTags) === JSON.stringify(b.storeTags) &&
    JSON.stringify(a.productRanges) === JSON.stringify(b.productRanges) &&
    JSON.stringify(a.currencies) === JSON.stringify(b.currencies)
  );
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function getDateRangeFromPreset(preset, customFrom, customTo) {
  const now = new Date();
  const end = startOfDay(now);
  if (!preset) return null;

  if (preset === 'custom') {
    if (!customFrom && !customTo) return null;
    const from = customFrom ? startOfDay(customFrom) : null;
    const to = customTo ? endOfDay(customTo) : endOfDay(now);
    return { from, to };
  }

  if (preset === 'today') return { from: end, to: endOfDay(now) };
  if (preset === 'yesterday') {
    const y = new Date(end);
    y.setDate(y.getDate() - 1);
    return { from: startOfDay(y), to: endOfDay(y) };
  }
  if (preset === '7d') {
    const from = new Date(end);
    from.setDate(from.getDate() - 7);
    return { from: startOfDay(from), to: endOfDay(now) };
  }
  if (preset === '30d') {
    const from = new Date(end);
    from.setDate(from.getDate() - 30);
    return { from: startOfDay(from), to: endOfDay(now) };
  }
  if (preset === 'this_month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: startOfDay(from), to: endOfDay(now) };
  }
  if (preset === 'last_month') {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: startOfDay(from), to: endOfDay(to) };
  }

  return null;
}

function storeMatchesProductRanges(count, ranges) {
  if (!ranges.length) return true;
  return ranges.some((id) => {
    const r = PRODUCT_COUNT_RANGES.find((x) => x.id === id);
    if (!r) return false;
    return count >= r.min && count <= r.max;
  });
}

export function filterLeadStores(stores, filters) {
  const range = getDateRangeFromPreset(filters.datePreset, filters.dateFrom, filters.dateTo);
  return stores.filter((store) => {
    if (filters.platforms.length && !filters.platforms.includes(store.platform)) return false;
    if (filters.countries.length) {
      const code = store.countryCode || 'XX';
      if (!filters.countries.includes(code)) return false;
    }
    if (filters.currencies.length && !filters.currencies.includes(store.currency)) return false;
    if (filters.storeTags.length) {
      const tags = store.tags || [];
      if (!filters.storeTags.some((t) => tags.includes(t))) return false;
    }
    if (!storeMatchesProductRanges(store.productCount ?? 0, filters.productRanges)) return false;
    if (range) {
      const created = startOfDay(store.createdAt);
      if (range.from && created < range.from) return false;
      if (range.to && created > range.to) return false;
    }
    return true;
  });
}

export function buildFilterTags(filters) {
  const tags = [];
  filters.platforms.forEach((p) => tags.push({ key: `platform-${p}`, type: 'platform', value: p, label: p }));
  filters.countries.forEach((c) => {
    const name = COUNTRY_OPTIONS.find((o) => o.code === c)?.name || c;
    tags.push({ key: `country-${c}`, type: 'country', value: c, label: name });
  });
  filters.storeTags.forEach((t) => {
    const tag = STORE_TAGS.find((x) => x.id === t);
    tags.push({ key: `tag-${t}`, type: 'storeTag', value: t, label: tag?.label || t });
  });
  filters.productRanges.forEach((r) => {
    const range = PRODUCT_COUNT_RANGES.find((x) => x.id === r);
    tags.push({ key: `products-${r}`, type: 'productRange', value: r, label: range?.label || r });
  });
  filters.currencies.forEach((c) => {
    tags.push({ key: `currency-${c}`, type: 'currency', value: c, label: c });
  });
  if (filters.datePreset) {
    const preset = DATE_PRESETS.find((d) => d.id === filters.datePreset);
    let label = preset?.label || 'Custom range';
    if (filters.datePreset === 'custom' && filters.dateFrom) {
      label = `${filters.dateFrom}${filters.dateTo ? ` – ${filters.dateTo}` : ''}`;
    }
    tags.push({ key: 'date', type: 'date', value: filters.datePreset, label });
  }
  return tags;
}

export function removeFilterTag(filters, tag) {
  const next = { ...filters };
  if (tag.type === 'platform') {
    next.platforms = next.platforms.filter((p) => p !== tag.value);
  } else if (tag.type === 'country') {
    next.countries = next.countries.filter((c) => c !== tag.value);
  } else if (tag.type === 'storeTag') {
    next.storeTags = next.storeTags.filter((t) => t !== tag.value);
  } else if (tag.type === 'productRange') {
    next.productRanges = next.productRanges.filter((r) => r !== tag.value);
  } else if (tag.type === 'currency') {
    next.currencies = next.currencies.filter((c) => c !== tag.value);
  } else if (tag.type === 'date') {
    next.datePreset = null;
    next.dateFrom = '';
    next.dateTo = '';
  }
  return next;
}

export function exportLeadStoresCsv(stores, fields) {
  const fieldDefs = [
    { key: 'storeUrl', header: 'Store URL' },
    { key: 'platform', header: 'Platform' },
    { key: 'countryCode', header: 'Country' },
    { key: 'currency', header: 'Currency' },
    { key: 'productCount', header: 'Products' },
    { key: 'tags', header: 'Tags' },
    { key: 'createdAt', header: 'Created' },
  ];

  const defaultFields = {
    storeUrl: true,
    platform: true,
    countryCode: true,
    currency: true,
    productCount: true,
    tags: true,
    createdAt: true,
  };
  const selected = fields || defaultFields;
  const activeCols = fieldDefs.filter((col) => selected[col.key]);
  const headers = activeCols.map((col) => col.header);

  const getValue = (store, key) => {
    switch (key) {
      case 'storeUrl':
        return store.storeUrl;
      case 'platform':
        return store.platform;
      case 'countryCode':
        return store.countryCode;
      case 'currency':
        return store.currency || '';
      case 'productCount':
        return String(store.productCount ?? '');
      case 'tags':
        return (store.tags || []).join('; ');
      case 'createdAt':
        return store.createdAt ? new Date(store.createdAt).toLocaleDateString() : '';
      default:
        return '';
    }
  };

  const rows = [headers];
  stores.forEach((s) => {
    rows.push(activeCols.map((col) => getValue(s, col.key)));
  });
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = rows.map((row) => row.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `store-leads-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
