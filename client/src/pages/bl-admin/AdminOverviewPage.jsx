import React, { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '../../context/AdminContext';
import { AdminPageHeader, AdminFilterSelect, AdminStatGrid, AdminStatGridSkeleton, adminHoverBg } from '../../components/admin';

const PERIOD_OPTIONS = [
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'this_year', label: 'This year' },
  { value: 'all_time', label: 'All time' },
  { value: 'custom', label: 'Custom range' },
];

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

export function AdminOverviewPage() {
  const { adminFetch } = useAdmin();
  const [stats, setStats] = useState({ totalUsers: 0, totalSubscribers: 0, totalRevenueCents: 0, activeSubscriptions: 0 });
  const [loading, setLoading] = useState(true);
  const [rangePreset, setRangePreset] = useState('this_year');
  const [dateRange, setDateRange] = useState(() => applyPresetRange('this_year'));
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [pendingRange, setPendingRange] = useState({ start: '', end: '' });
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const startDate = pendingRange.start ? new Date(pendingRange.start) : null;
  const endDate = pendingRange.end ? new Date(pendingRange.end) : null;
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
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

  const fetchOverview = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (effectiveRange.start) params.set('start', effectiveRange.start);
    if (effectiveRange.end) params.set('end', effectiveRange.end);
    const qs = params.toString();
    adminFetch(`/overview${qs ? '?' + qs : ''}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => setStats(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [adminFetch, effectiveRange.start, effectiveRange.end]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    if (rangePreset !== 'custom') setDateRange(applyPresetRange(rangePreset));
  }, [rangePreset]);

  if (loading && stats.totalUsers === 0 && stats.totalSubscribers === 0) {
    return (
      <div>
        <AdminPageHeader title="Overview" />
        <AdminStatGridSkeleton count={4} />
      </div>
    );
  }

  const cards = [
    { label: rangePreset === 'all_time' ? 'Total users' : 'New users (period)', value: stats.totalUsers },
    { label: 'Active subscribers', value: stats.totalSubscribers },
    { label: 'Total revenue (period)', value: `$${(stats.totalRevenueCents / 100).toFixed(2)}` },
    { label: 'Active subscriptions', value: stats.activeSubscriptions },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Overview"
        actions={
          <>
            <AdminFilterSelect
              value={rangePreset}
              onChange={(preset) => {
                setRangePreset(preset);
                setDateRange(applyPresetRange(preset));
              }}
              options={PERIOD_OPTIONS}
              ariaLabel="Select period"
            />
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  const base = dateRange.start ? new Date(dateRange.start) : new Date();
                  setCalendarMonth(new Date(base.getFullYear(), base.getMonth(), 1));
                  setPendingRange(dateRange);
                  setIsDatePickerOpen((open) => !open);
                }}
                className="inline-flex items-center justify-between gap-2 rounded-full border border-blaster-border/80 bg-blaster-bg-card px-3.5 py-2 text-sm text-blaster-fg shadow-sm hover:border-blaster-border hover:shadow transition-all"
              >
                <span className="text-blaster-muted hidden sm:inline">Range</span>
                <span className="font-medium truncate max-w-[140px]">{formatRangeLabel()}</span>
              </button>
            {isDatePickerOpen && (
              <div className="absolute right-0 mt-2 z-40">
                <div className="bg-gradient-to-b from-white via-blaster-bg-app to-blaster-bg rounded-3xl border border-blaster-border shadow-glass p-4 sm:p-5 w-80 sm:w-96">
                  <div className="flex items-center justify-between mb-3 text-sm text-blaster-fg">
                    <button
                      type="button"
                      className={`w-8 h-8 flex items-center justify-center rounded-full ${adminHoverBg} text-blaster-muted`}
                      onClick={() => changeMonth(-1)}
                    >
                      ‹
                    </button>
                    <p className="font-semibold">{calendarTitle}</p>
                    <button
                      type="button"
                      className={`w-8 h-8 flex items-center justify-center rounded-full ${adminHoverBg} text-blaster-muted`}
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
                      else cellClasses += `${adminHoverBg} `;
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
                      className={`px-3 py-1.5 rounded-xl text-blaster-muted ${adminHoverBg} transition`}
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
          </>
        }
      />

      <AdminStatGrid items={cards} className="mb-0" />
    </div>
  );
}
