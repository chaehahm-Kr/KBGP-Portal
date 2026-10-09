"use client";

import React from "react";
import {
  TOP_COUNTRIES,
  OTHER_COUNTRIES,
  formatCanonicalCountryName,
  getCountryDisplayLabel,
} from "@/lib/constants/countries";

export interface CountrySelectProps {
  value?: string | null;
  onChange: (value: string) => void;
  lang?: "ko" | "en";
  className?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  id?: string;
  name?: string;
  showAllOption?: boolean;
  allOptionLabel?: string;
}

export function CountrySelect({
  value,
  onChange,
  lang = "ko",
  className = "",
  disabled = false,
  required = false,
  placeholder,
  id,
  name,
  showAllOption = false,
  allOptionLabel,
}: CountrySelectProps) {
  const selectedCanonicalValue = formatCanonicalCountryName(value);

  const defaultPlaceholder =
    lang === "ko" ? "국가 선택 (Select Country)" : "Select Country";
  const defaultAllLabel =
    lang === "ko" ? "전체 국가 (All Countries)" : "All Countries";

  return (
    <select
      id={id}
      name={name}
      value={selectedCanonicalValue}
      onChange={(e) => {
        const canonical = formatCanonicalCountryName(e.target.value);
        onChange(canonical);
      }}
      disabled={disabled}
      required={required}
      className={
        className ||
        "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 outline-none transition-colors cursor-pointer dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
      }
    >
      {showAllOption && (
        <option value="">{allOptionLabel || defaultAllLabel}</option>
      )}

      {!showAllOption && (
        <option value="">{placeholder || defaultPlaceholder}</option>
      )}

      {/* Top Priority Countries */}
      <optgroup label={lang === "ko" ? "주요 국가 (Top Countries)" : "Top Countries"}>
        {TOP_COUNTRIES.map((country) => (
          <option key={country.code} value={country.name}>
            {getCountryDisplayLabel(country.name, lang)}
          </option>
        ))}
      </optgroup>

      {/* Other Countries A-Z */}
      <optgroup label={lang === "ko" ? "전체 국가 (All Countries)" : "All Countries"}>
        {OTHER_COUNTRIES.map((country) => (
          <option key={country.code} value={country.name}>
            {getCountryDisplayLabel(country.name, lang)}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
