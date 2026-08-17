"use client";

import React, { useState, useEffect } from "react";
import { TOP_COUNTRIES, OTHER_COUNTRIES, CountryCallingCode } from "@/lib/constants/countries";
import { parsePhoneNumber, formatPhoneNumber } from "@/lib/utils/phone";

interface InternationalPhoneInputProps {
  value?: string;
  onChange?: (formattedValue: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
}

export function InternationalPhoneInput({
  value = "",
  onChange,
  disabled = false,
  required = false,
  className = "",
  placeholder = "856 555 1234, 10 1234 5678",
}: InternationalPhoneInputProps) {
  const parsed = parsePhoneNumber(value);
  const [selectedCallingCode, setSelectedCallingCode] = useState<string>(parsed.callingCode || "+1");
  const [localNumber, setLocalNumber] = useState<string>(parsed.localNumber || "");

  // Sync internal state when external value changes
  useEffect(() => {
    const p = parsePhoneNumber(value);
    setSelectedCallingCode(p.callingCode || "+1");
    setLocalNumber(p.localNumber || "");
  }, [value]);

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCallingCode = e.target.value;
    setSelectedCallingCode(newCallingCode);
    const formatted = formatPhoneNumber(newCallingCode, localNumber);
    if (onChange) onChange(formatted);
  };

  const handleLocalNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawInput = e.target.value;
    // Allow digits, spaces, and hyphens for typing comfort
    const cleaned = rawInput.replace(/[^\d\s-]/g, "");
    setLocalNumber(cleaned);
    const formatted = formatPhoneNumber(selectedCallingCode, cleaned);
    if (onChange) onChange(formatted);
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      {/* Country Calling Code Dropdown */}
      <select
        value={selectedCallingCode}
        onChange={handleCountryChange}
        disabled={disabled}
        className="w-48 shrink-0 rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white font-medium cursor-pointer disabled:opacity-50"
      >
        <optgroup label="Primary Countries">
          {TOP_COUNTRIES.map((c) => (
            <option key={`top-${c.code}`} value={c.callingCode}>
              {c.name} ({c.callingCode})
            </option>
          ))}
        </optgroup>
        <option disabled value="">
          ──────────
        </option>
        <optgroup label="Other Countries (A–Z)">
          {OTHER_COUNTRIES.map((c) => (
            <option key={`other-${c.code}`} value={c.callingCode}>
              {c.name} ({c.callingCode})
            </option>
          ))}
        </optgroup>
      </select>

      {/* Local Phone Number Input */}
      <input
        type="tel"
        value={localNumber}
        onChange={handleLocalNumberChange}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        className="w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white font-mono placeholder:font-sans disabled:opacity-50"
      />
    </div>
  );
}
