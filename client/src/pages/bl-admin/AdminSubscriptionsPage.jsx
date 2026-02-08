import React, { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '../../context/AdminContext';
import { formatUTCDateOnly } from '../../utils/dateUtils';

function formatDateOnly(isoOrDate) {
  const s = formatUTCDateOnly(isoOrDate);
  return s ?? '—';
}

const applyPresetRange = (preset) => {
  const today = new Date();
  let start = '';
  let end = '';
  if (preset === 'last_7_days') {
    const startDate = new Date();
    startDate.setDate(today.getDate() - 6);
    start = startDate.toISOString().slice(0, 10);
    end = today.toISOString().slice(0, 10);
  } else if (preset === 'last_30_days') {
    const startDate = new Date();
    startDate.setDate(today.getDate() - 29);
    start = startDate.toISOString().slice(0, 10);
    end = today.toISOString().slice(0, 10);
  } else if (preset === 'this_year') {
    start = new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10);
    end = today.toISOString().slice(0, 10);
  }
  return { start, end };
};

export function AdminSubscriptionsPage() {
  const { adminFetch } = useAdmin();
  const [subscriptions, setSubscriptions] = useState([]);
  const [totalRevenueCents, setTotalRevenueCents] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rangePreset, setRangePreset] = useState('this_year');
  const [dateRange, setDateRange] = useState(() => applyPresetRange('this_year'));
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [pendingRange, setPendingRange] = useState({ start: '', end: '' });
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [planFilter, setPlanFilter] = useState('');
  const [plans, setPlans] = useState([]);

  const startDate = pendingRange.start ? new Date(pendingRange.start) : null;
  const endDate = pendingRange.end ? new Date(pendingRange.end) : null;
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const toLocalDateString = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getCalendarDays = () => {
    const start = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const firstWeekday = (start.getDay() + 6) % 7;
    const daysInCurrent = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstWeekday; i += 1) {
      const d = new Date(start);
      d.setDate(d.getDate() - (firstWeekday - i));
      days.push({ date: d, inCurrentMonth: false });
    }
    for (let i = 1; i <= daysInCurrent; i += 1) {
      const d = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), i);
      days.push({ date: d, inCurrentMonth: true });
    }
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i += 1) {
      const d = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, i);
      days.push({ date: d, inCurrentMonth: false });
    }
    return days;
  };
  const calendarDays = getCalendarDays();

  const handleDayClick = (day) => {
    const iso = toLocalDateString(day);
    if (!startDate || (startDate && endDate)) {
      setPendingRange({ start: iso, end: '' });
      return;
    }
    const clicked = day.getTime();
    const startTime = startDate.getTime();
    if (clicked < startTime) {
      setPendingRange({ start: iso, end: pendingRange.start });
    } else if (clicked === startTime) {
      setPendingRange({ start: iso, end: '' });
    } else {
      setPendingRange({ start: pendingRange.start, end: iso });
    }
  };

  const changeMonth = (offset) => {
    setCalendarMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() + offset);
      return new Date(next.getFullYear(), next.getMonth(), 1);
    });
  };

  const calendarTitle = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(calendarMonth);

  const formatRangeLabel = () => {
    if (rangePreset === 'custom' && dateRange.start && dateRange.end) {
      const opts = { year: 'numeric', month: 'short', day: 'numeric' };
      return `${new Date(dateRange.start).toLocaleDateString(undefined, opts)} – ${new Date(dateRange.end).toLocaleDateString(undefined, opts)}`;
    }
    switch (rangePreset) {
      case 'last_7_days': return 'Last 7 days';
      case 'last_30_days': return 'Last 30 days';
      case 'this_year': return 'This year';
      case 'all_time': return 'All time';
      default: return 'Custom range';
    }
  };

  const getEffectiveRange = useCallback(() => {
    if (rangePreset === 'all_time') return { start: '', end: '' };
    if (rangePreset === 'custom' && dateRange.start && dateRange.end) return dateRange;
    return applyPresetRange(rangePreset);
  }, [rangePreset, dateRange.start, dateRange.end]);

  const effectiveRange = getEffectiveRange();
  const usdToNgn = Number(typeof import.meta !== 'undefined' && import.meta.env?.VITE_USD_TO_NGN) || 1500;
  const revenueNgn = Math.round((totalRevenueCents / 100) * usdToNgn);

  const fetchPlans = useCallback(() => {
    adminFetch('/plans')
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => setPlans(d.plans || []))
      .catch(() => setPlans([]));
  }, [adminFetch]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const fetchSubscriptions = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (effectiveRange.start) params.set('start', effectiveRange.start);
    if (effectiveRange.end) params.set('end', effectiveRange.end);
    if (planFilter) params.set('plan', planFilter);
    const qs = params.toString();
    adminFetch(`/subscriptions${qs ? '?' + qs : ''}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => {
        setSubscriptions(d.subscriptions || []);
        setTotalRevenueCents(d.totalRevenueCents ?? 0);
        setTotalCount(d.totalCount ?? 0);
      })
      .catch(() => setSubscriptions([]))
      .finally(() => setLoading(false));
  }, [adminFetch, effectiveRange.start, effectiveRange.end, planFilter]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  useEffect(() => {
    if (rangePreset !== 'custom') setDateRange(applyPresetRange(rangePreset));
  }, [rangePreset]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-blaster-fg mb-6">Subscriptions</h1>

      <div className="flex flex-wrap items-center gap-4 mb-6">
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-blaster-border bg-blaster-input-bg text-blaster-fg text-sm"
        >
          <option value="">All plans</option>
          {(plans || []).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <div className="flex items-center gap-2 text-sm text-blaster-muted">
          <span className="font-medium text-blaster-fg">Show:</span>
          <select
            value={rangePreset}
            onChange={(e) => {
              const preset = e.target.value;
              setRangePreset(preset);
              setDateRange(applyPresetRange(preset));
            }}
            className="bg-blaster-bg border border-blaster-border rounded-xl pl-3 pr-8 py-2 text-sm text-blaster-fg shadow-sm hover:bg-blaster-bg-app transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-blaster-accent/30"
          >
            <option value="last_7_days">Last 7 days</option>
            <option value="last_30_days">Last 30 days</option>
            <option value="this_year">This year</option>
            <option value="all_time">All time</option>
            <option value="custom">Custom range</option>
          </select>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              const base = dateRange.start ? new Date(dateRange.start) : new Date();
              setCalendarMonth(new Date(base.getFullYear(), base.getMonth(), 1));
              setPendingRange(dateRange);
              setIsDatePickerOpen((open) => !open);
            }}
            className="inline-flex items-center justify-between gap-2 rounded-xl border border-blaster-border bg-blaster-bg px-3 py-2 text-sm text-blaster-fg shadow-sm hover:bg-blaster-bg-app transition"
          >
            <span className="text-blaster-muted">Custom range</span>
            <span className="font-medium">{formatRangeLabel()}</span>
          </button>

          {isDatePickerOpen && (
            <div className="absolute left-0 mt-2 z-40">
              <div className="bg-gradient-to-b from-white via-blaster-bg-app to-blaster-bg rounded-3xl border border-blaster-border shadow-glass p-4 sm:p-5 w-80 sm:w-96">
                <div className="flex items-center justify-between mb-3 text-sm text-blaster-fg">
                  <button
                    type="button"
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-blaster-bg-app text-blaster-muted"
                    onClick={() => changeMonth(-1)}
                  >
                    ‹
                  </button>
                  <p className="font-semibold">{calendarTitle}</p>
                  <button
                    type="button"
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-blaster-bg-app text-blaster-muted"
                    onClick={() => changeMonth(1)}
                  >
                    ›
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1.5 mb-2 text-xs text-blaster-muted">
                  {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
                    <div key={d} className="flex items-center justify-center h-6">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5 text-sm">
                  {calendarDays.map(({ date, inCurrentMonth }) => {
                    const isStart = startDate && sameDay(date, startDate);
                    const isEnd = endDate && sameDay(date, endDate);
                    const inRange = startDate && endDate && date >= startDate && date <= endDate;
                    const isSelected = isStart || isEnd;
                    let cellClasses =
                      'w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl cursor-pointer transition text-xs sm:text-sm ';
                    if (!inCurrentMonth) cellClasses += 'text-blaster-muted/40 ';
                    else cellClasses += 'text-blaster-fg ';
                    if (inRange && !isSelected) cellClasses += 'bg-blaster-accent/10 ';
                    if (isSelected) cellClasses += 'bg-[#1a1a21] text-white shadow-sm ';
                    else cellClasses += 'hover:bg-blaster-bg-app ';
                    return (
                      <button
                        key={date.toISOString()}
                        type="button"
                        onClick={() => handleDayClick(date)}
                        className={cellClasses}
                      >
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex items-center justify-end gap-3 text-sm">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-xl text-blaster-muted hover:bg-blaster-bg transition"
                    onClick={() => setIsDatePickerOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-blaster-accent text-sm"
                    onClick={() => {
                      if (pendingRange.start && pendingRange.end) {
                        setDateRange(pendingRange);
                        setRangePreset('custom');
                      }
                      setIsDatePickerOpen(false);
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-blaster-border bg-blaster-bg-card p-7 min-h-[7.7rem]">
          <p className="text-sm text-blaster-muted">Total revenue (filtered)</p>
          <p className="text-3xl font-bold text-blaster-fg mt-1">${(totalRevenueCents / 100).toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-blaster-border bg-blaster-bg-card p-7 min-h-[7.7rem]">
          <p className="text-sm text-blaster-muted">Total revenue (NGN)</p>
          <p className="text-3xl font-bold text-blaster-fg mt-1">₦{revenueNgn.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-blaster-border bg-blaster-bg-card p-7 min-h-[7.7rem]">
          <p className="text-sm text-blaster-muted">Subscribers count</p>
          <p className="text-3xl font-bold text-blaster-fg mt-1">{totalCount}</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-blaster-border/40 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-blaster-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-blaster-bg-app border-b border-blaster-border">
              <tr>
                <th className="text-left p-3 font-medium text-blaster-fg">User</th>
                <th className="text-left p-3 font-medium text-blaster-fg">Plan</th>
                <th className="text-left p-3 font-medium text-blaster-fg">Amount</th>
                <th className="text-left p-3 font-medium text-blaster-fg">Status</th>
                <th className="text-left p-3 font-medium text-blaster-fg">Next billing date</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-blaster-muted">No subscribers match the filter</td></tr>
              ) : (
                subscriptions.map((s) => {
                  const statusLabel =
                    s.status === 'cancelled'
                      ? (s.cancelAtPeriodEnd ? 'Cancels at period end' : 'Cancelled')
                      : s.status === 'trialing'
                        ? 'Trialing'
                        : s.status === 'past_due'
                          ? 'Past due'
                          : 'Active';
                  const statusClass =
                    s.status === 'cancelled' ? 'text-amber-600 dark:text-amber-400' : s.status === 'past_due' ? 'text-red-600 dark:text-red-400' : 'text-blaster-fg';
                  const nextBilling =
                    s.status === 'active' || s.status === 'trialing' || (s.status === 'cancelled' && s.cancelAtPeriodEnd && s.currentPeriodEnd)
                      ? (s.currentPeriodEnd ? formatDateOnly(s.currentPeriodEnd) : '—')
                      : '—';
                  return (
                    <tr key={s.id} className="border-b border-blaster-border last:border-0">
                      <td className="p-3 text-blaster-fg">{s.userName || s.userEmail}</td>
                      <td className="p-3 text-blaster-fg">{s.planName}</td>
                      <td className="p-3 text-blaster-fg">${(s.amount / 100).toFixed(2)}/{s.interval}</td>
                      <td className={`p-3 font-medium ${statusClass}`}>{statusLabel}</td>
                      <td className="p-3 text-blaster-muted">{nextBilling}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
