"use client";

import React from "react";
import { TOP_COUNTRIES, OTHER_COUNTRIES } from "@/lib/constants/countries";

interface CountrySelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  id?: string;
  name?: string;
}

export function CountrySelect({
  value,
  onChange,
  className = "",
  disabled = false,
  required = false,
  placeholder = "설립 국가 선택",
  id,
  name,
}: CountrySelectProps) {
  // Normalize legacy or localized values for clean selection
  const normalizeValue = (val: string) => {
    if (!val) return "";
    const trimmed = val.trim();
    if (trimmed === "대한민국" || trimmed.toLowerCase() === "korea" || trimmed === "KR") return "South Korea";
    if (trimmed === "미국" || trimmed.toLowerCase() === "usa" || trimmed === "US") return "United States";
    return trimmed;
  };

  const selectedValue = normalizeValue(value);

  // Check if selected value is a custom string not in standard list
  const isCustomValue = Boolean(
    selectedValue &&
    !TOP_COUNTRIES.some((c) => c.name === selectedValue) &&
    !OTHER_COUNTRIES.some((c) => c.name === selectedValue)
  );

  return (
    <select
      id={id}
      name={name}
      value={selectedValue}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      required={required}
      className={
        className ||
        "mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white cursor-pointer"
      }
    >
      <option value="">{placeholder}</option>
      
      {/* Priority 1: South Korea */}
      <option value="South Korea">South Korea</option>
      {/* Priority 2: United States */}
      <option value="United States">United States</option>
      
      {/* Separator */}
      <option disabled value="__divider__" className="text-zinc-400">
        ────────────────────────────
      </option>

      {/* Remaining Countries A-Z */}
      {OTHER_COUNTRIES.map((country) => (
        <option key={country.code} value={country.name}>
          {country.name}
        </option>
      ))}

      {/* Fallback for legacy custom country names not in list */}
      {isCustomValue && (
        <option value={selectedValue}>{selectedValue}</option>
      )}
    </select>
  );
}
