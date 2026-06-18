import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'react-feather';
import { DATE_PRESETS } from '../../utils/storeLeadFilters.js';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isSameDay(a, b) {
  return a && b && toDateStr(a) === toDateStr(b);
}

function isInRange(day, from, to) {
  if (!from || !to) return false;
  const d = startOfDay(day);
  return d >= startOfDay(from) && d <= startOfDay(to);
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function DateRangePicker({ datePreset, dateFrom, dateTo, onChange }) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(() => {
    const base = dateFrom ? parseDate(dateFrom) : today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [pickStart, setPickStart] = useState(null);

  const monthLabel = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const calendarDays = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startPad = (first.getDay() + 6) % 7;
    const days = [];

    for (let i = 0; i < startPad; i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  }, [viewMonth]);

  const rangeFrom = dateFrom ? parseDate(dateFrom) : null;
  const rangeTo = dateTo ? parseDate(dateTo) : rangeFrom;

  const prevMonth = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  const nextMonth = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));

  const applyPreset = (id) => {
    setPickStart(null);
    onChange({ datePreset: id, dateFrom: '', dateTo: '' });
  };

  const handleDayClick = (day) => {
    if (!pickStart) {
      setPickStart(day);
      onChange({
        datePreset: 'custom',
        dateFrom: toDateStr(day),
        dateTo: toDateStr(day),
      });
    } else {
      const a = startOfDay(pickStart);
      const b = startOfDay(day);
      const from = a <= b ? pickStart : day;
      const to = a <= b ? day : pickStart;
      setPickStart(null);
      onChange({
        datePreset: 'custom',
        dateFrom: toDateStr(from),
        dateTo: toDateStr(to),
      });
    }
  };

  const isToday = (day) => isSameDay(day, today);

  return (
    <div className="stores-date-picker">
      <div className="stores-date-picker-calendar">
        <div className="stores-date-picker-header">
          <div className="stores-date-picker-nav-group">
            <button type="button" className="stores-date-nav-btn" onClick={prevMonth} aria-label="Previous month">
              <ChevronLeft className="w-4 h-4" strokeWidth={2} />
            </button>
            <span className="stores-date-picker-month">{monthLabel}</span>
            <button type="button" className="stores-date-nav-btn" onClick={nextMonth} aria-label="Next month">
              <ChevronRight className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
          <button type="button" className="stores-date-nav-btn stores-date-history-btn" aria-label="Date history">
            <Clock className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
        <div className="stores-date-weekdays">
          {WEEKDAYS.map((w) => (
            <span key={w} className="stores-date-weekday">{w}</span>
          ))}
        </div>
        <div className="stores-date-grid">
          {calendarDays.map((day, i) => {
            if (!day) return <span key={`empty-${i}`} className="stores-date-day stores-date-day-empty" />;
            const selected =
              isSameDay(day, rangeFrom) ||
              isSameDay(day, rangeTo) ||
              isInRange(day, rangeFrom, rangeTo);
            const isStart = isSameDay(day, rangeFrom);
            const isEnd = isSameDay(day, rangeTo);
            return (
              <button
                key={toDateStr(day)}
                type="button"
                className={`stores-date-day ${selected ? 'is-selected' : ''} ${isToday(day) ? 'is-today' : ''} ${isStart ? 'is-start' : ''} ${isEnd ? 'is-end' : ''}`}
                onClick={() => handleDayClick(day)}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </div>
      <div className="stores-date-picker-presets">
        {DATE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`stores-date-preset ${datePreset === p.id ? 'is-active' : ''}`}
            onClick={() => applyPreset(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
