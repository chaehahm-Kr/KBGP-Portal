"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";

export interface CalendarDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  minDate?: string; // YYYY-MM-DD
  maxDate?: string; // YYYY-MM-DD
  disabled?: boolean;
  className?: string;
  id?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const SHORT_MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// Helper: Parse YYYY-MM-DD into pure year/month/day components
function parseDateParts(dateStr?: string | null): { year: number; month: number; day: number } | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, d] = dateStr.split("-").map((num) => parseInt(num, 10));
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return { year: y, month: m - 1, day: d };
}

// Helper: Format year, month (0-indexed), day into YYYY-MM-DD
function formatDateParts(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, "0");
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Helper: Format YYYY-MM-DD into readable string "Oct 13, 2026"
function formatReadableDate(dateStr: string): string {
  const parts = parseDateParts(dateStr);
  if (!parts) return dateStr;
  return `${SHORT_MONTH_NAMES[parts.month]} ${parts.day}, ${parts.year}`;
}

export function CalendarDatePicker({
  value,
  onChange,
  placeholder = "Select date",
  label,
  minDate,
  maxDate,
  disabled = false,
  className = "",
  id,
}: CalendarDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine viewing month and year
  const initialView = useMemo(() => {
    const parsed = parseDateParts(value);
    if (parsed) return { year: parsed.year, month: parsed.month };
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  }, [value]);

  const [viewYear, setViewYear] = useState(initialView.year);
  const [viewMonth, setViewMonth] = useState(initialView.month);

  // Sync viewing month when value changes
  useEffect(() => {
    const parsed = parseDateParts(value);
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
  }, [value]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Navigate months
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Build calendar matrix
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  // Days from previous month to fill the first row
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  const handleSelectDay = (day: number) => {
    const formatted = formatDateParts(viewYear, viewMonth, day);
    onChange(formatted);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setIsOpen(false);
  };

  const handleToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const today = new Date();
    const formatted = formatDateParts(today.getFullYear(), today.getMonth(), today.getDate());
    if (minDate && formatted < minDate) return;
    if (maxDate && formatted > maxDate) return;
    onChange(formatted);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setIsOpen(false);
  };

  const parsedToday = useMemo(() => {
    const t = new Date();
    return { year: t.getFullYear(), month: t.getMonth(), day: t.getDate() };
  }, []);

  const parsedSelected = useMemo(() => parseDateParts(value), [value]);

  return (
    <div ref={containerRef} className={`relative inline-block w-full ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1"
        >
          {label}
        </label>
      )}

      {/* Input Trigger Button */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between px-3 py-1.5 text-xs rounded-xl border text-left transition-all ${
          isOpen
            ? "border-zinc-900 dark:border-white ring-2 ring-zinc-900 dark:ring-white bg-white dark:bg-zinc-900"
            : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-700"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span
          className={`truncate font-medium ${
            value ? "text-zinc-900 dark:text-white" : "text-zinc-400 dark:text-zinc-500"
          }`}
        >
          {value ? formatReadableDate(value) : placeholder}
        </span>
        <span className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 ml-2 shrink-0">
          📅
        </span>
      </button>

      {/* Calendar Dropdown Popover */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Date Picker"
          className="absolute z-50 mt-1.5 w-72 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 shadow-xl animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Calendar Header */}
          <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Previous month"
              className="p-1 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
            >
              ◀
            </button>

            <span className="text-xs font-bold text-zinc-900 dark:text-white">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Next month"
              className="p-1 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
            >
              ▶
            </button>
          </div>

          {/* Weekday Names Header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {DAY_NAMES.map((d) => (
              <span
                key={d}
                className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 py-1"
              >
                {d}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Previous Month Days (Grayed out) */}
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => {
              const dayNum = prevMonthDays - firstDayOfWeek + idx + 1;
              return (
                <span
                  key={`prev-${idx}`}
                  className="py-1.5 text-xs text-zinc-300 dark:text-zinc-700 select-none"
                >
                  {dayNum}
                </span>
              );
            })}

            {/* Current Month Days */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateStr = formatDateParts(viewYear, viewMonth, dayNum);

              const isSelected =
                parsedSelected &&
                parsedSelected.year === viewYear &&
                parsedSelected.month === viewMonth &&
                parsedSelected.day === dayNum;

              const isToday =
                parsedToday.year === viewYear &&
                parsedToday.month === viewMonth &&
                parsedToday.day === dayNum;

              const isDisabled =
                Boolean(minDate && dateStr < minDate) ||
                Boolean(maxDate && dateStr > maxDate);

              return (
                <button
                  key={`day-${dayNum}`}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleSelectDay(dayNum)}
                  className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isDisabled
                      ? "text-zinc-300 dark:text-zinc-700 cursor-not-allowed line-through"
                      : isSelected
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold shadow-xs cursor-pointer"
                      : isToday
                      ? "text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/40 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                  }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          {/* Quick Footer Controls */}
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-zinc-100 dark:border-zinc-800 text-[11px]">
            <button
              type="button"
              onClick={handleToday}
              className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-semibold cursor-pointer transition-colors"
            >
              Today
            </button>
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="text-rose-600 dark:text-rose-400 hover:underline font-semibold cursor-pointer transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
