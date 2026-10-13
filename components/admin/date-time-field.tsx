"use client";

import React, { useMemo } from "react";

interface DateTimeFieldProps {
  label: string;
  value: string; // "YYYY-MM-DDTHH:mm" or ISO string or ""
  onChange: (val: string) => void;
  disabled?: boolean;
  required?: boolean;
}

export function DateTimeField({
  label,
  value,
  onChange,
  disabled = false,
  required = false,
}: DateTimeFieldProps) {
  // Parse incoming value into date (YYYY-MM-DD), hour12 (1-12), minute (00-59), ampm ("AM" | "PM")
  const parsed = useMemo(() => {
    if (!value) {
      return {
        date: "",
        hour12: "09",
        minute: "00",
        ampm: "AM" as const,
      };
    }

    try {
      // Handles "YYYY-MM-DDTHH:mm" or full ISO string
      const datePart = value.includes("T") ? value.split("T")[0] : value.split(" ")[0] || "";
      const timePart = value.includes("T") ? value.split("T")[1]?.slice(0, 5) : value.split(" ")[1]?.slice(0, 5) || "";

      let hour24 = 9;
      let minuteStr = "00";

      if (timePart && timePart.includes(":")) {
        const parts = timePart.split(":");
        hour24 = parseInt(parts[0], 10) || 0;
        minuteStr = (parseInt(parts[1], 10) || 0).toString().padStart(2, "0");
      }

      const ampm: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM";
      let hour12Num = hour24 % 12;
      if (hour12Num === 0) hour12Num = 12;
      const hour12 = hour12Num.toString().padStart(2, "0");

      return {
        date: datePart,
        hour12,
        minute: minuteStr,
        ampm,
      };
    } catch {
      return {
        date: "",
        hour12: "09",
        minute: "00",
        ampm: "AM" as const,
      };
    }
  }, [value]);

  const updateCombined = (newDate: string, newHour12: string, newMinute: string, newAmpm: "AM" | "PM") => {
    if (!newDate) {
      onChange("");
      return;
    }

    let h24 = parseInt(newHour12, 10) || 12;
    if (newAmpm === "PM" && h24 < 12) h24 += 12;
    if (newAmpm === "AM" && h24 === 12) h24 = 0;

    const formattedH24 = h24.toString().padStart(2, "0");
    const formattedMin = (parseInt(newMinute, 10) || 0).toString().padStart(2, "0");

    onChange(`${newDate}T${formattedH24}:${formattedMin}`);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateCombined(e.target.value, parsed.hour12, parsed.minute, parsed.ampm);
  };

  const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateCombined(parsed.date || new Date().toISOString().split("T")[0], e.target.value, parsed.minute, parsed.ampm);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateCombined(parsed.date || new Date().toISOString().split("T")[0], parsed.hour12, e.target.value, parsed.ampm);
  };

  const handleAmpmChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateCombined(parsed.date || new Date().toISOString().split("T")[0], parsed.hour12, parsed.minute, e.target.value as "AM" | "PM");
  };

  const minuteOptions = [
    "00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55",
  ];

  return (
    <div className="space-y-1">
      <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>

      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
        {/* Date picker */}
        <div className="flex-1 min-w-[130px]">
          <input
            type="date"
            value={parsed.date}
            onChange={handleDateChange}
            disabled={disabled}
            required={required}
            className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-hidden focus:border-indigo-500 disabled:opacity-50"
          />
        </div>

        {/* Time group: Hour : Minute AM/PM */}
        <div className="inline-flex items-center gap-1 shrink-0 bg-zinc-50 dark:bg-zinc-800/80 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
          {/* Hour Select */}
          <select
            value={parsed.hour12}
            onChange={handleHourChange}
            disabled={disabled}
            aria-label="Hour"
            className="px-2 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border-0 shadow-2xs focus:ring-1 focus:ring-indigo-500 cursor-pointer disabled:opacity-50"
          >
            {Array.from({ length: 12 }, (_, i) => {
              const h = (i + 1).toString().padStart(2, "0");
              return (
                <option key={h} value={h}>
                  {h}
                </option>
              );
            })}
          </select>

          <span className="text-xs font-bold text-zinc-400 select-none">:</span>

          {/* Minute Select */}
          <select
            value={parsed.minute}
            onChange={handleMinuteChange}
            disabled={disabled}
            aria-label="Minute"
            className="px-2 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border-0 shadow-2xs focus:ring-1 focus:ring-indigo-500 cursor-pointer disabled:opacity-50"
          >
            {/* If minute is not a multiple of 5, keep it in the list */}
            {!minuteOptions.includes(parsed.minute) && (
              <option value={parsed.minute}>{parsed.minute}</option>
            )}
            {minuteOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          {/* AM/PM Select */}
          <select
            value={parsed.ampm}
            onChange={handleAmpmChange}
            disabled={disabled}
            aria-label="AM/PM"
            className="px-2 py-1 text-xs font-bold rounded-lg bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 border-0 shadow-2xs focus:ring-1 focus:ring-indigo-500 cursor-pointer disabled:opacity-50"
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>
      </div>
    </div>
  );
}
