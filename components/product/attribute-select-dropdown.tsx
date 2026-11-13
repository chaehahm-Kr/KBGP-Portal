"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { AttributeMasterItem, AttributeOptionItem } from "@/lib/product/attribute-actions";

/**
 * Formats authoritative bilingual labels as `Korean (English)` when both exist
 * and differ; otherwise preserves whichever language exists without inventing translations.
 */
export function formatBilingualOptionLabel(
  ko: string | null | undefined,
  en: string | null | undefined,
  fallbackCode?: string
): string {
  const cleanKo = (ko ?? "").trim();
  const cleanEn = (en ?? "").trim();
  if (cleanKo && cleanEn) {
    if (cleanKo.toLowerCase() === cleanEn.toLowerCase()) {
      return cleanKo;
    }
    if (cleanKo.includes(`(${cleanEn})`)) {
      return cleanKo;
    }
    return `${cleanKo} (${cleanEn})`;
  }
  return cleanKo || cleanEn || fallbackCode || "";
}

export interface AttributeSelectDropdownProps {
  attr: AttributeMasterItem;
  value: any;
  textValue: string;
  disabled?: boolean;
  isAdmin?: boolean;
  onChangeValue: (nextVal: any) => void;
  onChangeTextValue: (nextText: string) => void;
}

interface NormalizedOption {
  optionCode: string;
  label: string;
  searchText: string;
  isOther: boolean;
  isNa: boolean;
  isAdminRestricted: boolean;
}

function isNaCode(code: string): boolean {
  return code === "NA" || code === "NOT_APPLICABLE";
}

export function AttributeSelectDropdown({
  attr,
  value,
  textValue,
  disabled = false,
  isAdmin = false,
  onChangeValue,
  onChangeTextValue,
}: AttributeSelectDropdownProps) {
  const isMulti = attr.inputType === "MULTI_SELECT";
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Build deduplicated authoritative options list
  const { regularOptions, naOption } = useMemo(() => {
    const rawOpts: AttributeOptionItem[] = Array.isArray(attr.options) ? attr.options : [];
    const seen = new Set<string>();
    const regulars: NormalizedOption[] = [];
    let resolvedNa: NormalizedOption | null = null;

    for (const opt of rawOpts) {
      if (!opt.optionCode || seen.has(opt.optionCode)) continue;
      seen.add(opt.optionCode);

      const label = formatBilingualOptionLabel(opt.optionKo, opt.optionEn, opt.optionCode);
      const item: NormalizedOption = {
        optionCode: opt.optionCode,
        label,
        searchText: `${opt.optionKo || ""} ${opt.optionEn || ""} ${opt.optionCode}`.toLowerCase(),
        isOther: opt.optionCode === "OTHER",
        isNa: isNaCode(opt.optionCode),
        isAdminRestricted: !isAdmin && opt.optionCode === "ADMIN_VERIFIED",
      };

      if (item.isNa) {
        if (!resolvedNa) {
          resolvedNa = item;
        }
      } else {
        regulars.push(item);
      }
    }

    // Ensure N/A option exists when attr.allowNa is enabled in metadata
    if (!resolvedNa && attr.allowNa) {
      resolvedNa = {
        optionCode: "NA",
        label: "해당 없음 (Not Applicable)",
        searchText: "해당 없음 해당없음 not applicable n/a na",
        isOther: false,
        isNa: true,
        isAdminRestricted: false,
      };
    }

    // Ensure OTHER option exists once when attr.allowOther is enabled in metadata
    if (attr.allowOther && !seen.has("OTHER")) {
      regulars.push({
        optionCode: "OTHER",
        label: "기타 (Other)",
        searchText: "기타 직접입력 other custom",
        isOther: true,
        isNa: false,
        isAdminRestricted: false,
      });
    }

    return { regularOptions: regulars, naOption: resolvedNa };
  }, [attr.options, attr.allowNa, attr.allowOther, isAdmin]);

  const optionByCode = useMemo(() => {
    const map = new Map<string, NormalizedOption>();
    if (naOption) {
      map.set(naOption.optionCode, naOption);
      // Support both "NA" and "NOT_APPLICABLE" lookup aliases
      if (!map.has("NA")) map.set("NA", naOption);
      if (!map.has("NOT_APPLICABLE")) map.set("NOT_APPLICABLE", naOption);
    }
    for (const opt of regularOptions) {
      map.set(opt.optionCode, opt);
    }
    return map;
  }, [regularOptions, naOption]);

  // Close popover on outside click or Escape
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearchQuery("");
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Focus search input when opening
  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => {
        searchInputRef.current?.focus();
      }, 15);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  // Filtered options for search
  const filteredRegularOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return regularOptions;
    return regularOptions.filter((o) => o.searchText.includes(q));
  }, [regularOptions, searchQuery]);

  const naMatchesSearch = useMemo(() => {
    if (!naOption) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return naOption.searchText.includes(q);
  }, [naOption, searchQuery]);

  // Normalized selection state
  const multiSelectedCodes: string[] = useMemo(() => {
    if (!isMulti) return [];
    if (value === "NA") return ["NA"];
    if (Array.isArray(value)) {
      return value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
    }
    if (typeof value === "string" && value.trim() !== "") {
      return [value.trim()];
    }
    return [];
  }, [isMulti, value]);

  const isMultiNaActive = useMemo(() => {
    if (!isMulti) return false;
    return value === "NA" || multiSelectedCodes.some((c) => isNaCode(c));
  }, [isMulti, value, multiSelectedCodes]);

  const activeRegularMultiCodes = useMemo(() => {
    if (!isMulti || isMultiNaActive) return [];
    return multiSelectedCodes.filter((c) => !isNaCode(c));
  }, [isMulti, isMultiNaActive, multiSelectedCodes]);

  const singleSelectedCode: string = useMemo(() => {
    if (isMulti) return "";
    if (typeof value === "string") return value.trim();
    if (Array.isArray(value) && value.length === 1 && typeof value[0] === "string") {
      return value[0].trim();
    }
    return "";
  }, [isMulti, value]);

  const isOtherSelected = useMemo(() => {
    if (!attr.allowOther) return false;
    if (isMulti) {
      if (isMultiNaActive) return false;
      return activeRegularMultiCodes.includes("OTHER") || Boolean(textValue.trim());
    }
    return singleSelectedCode === "OTHER";
  }, [attr.allowOther, isMulti, isMultiNaActive, activeRegularMultiCodes, singleSelectedCode, textValue]);

  const getLabelForCode = (code: string): string => {
    const found = optionByCode.get(code);
    if (found) return found.label;
    if (isNaCode(code)) return "해당 없음 (Not Applicable)";
    if (code === "OTHER") return "기타 (Other)";
    return code;
  };

  // Handlers for SINGLE_SELECT
  const handleSingleSelect = (code: string) => {
    onChangeValue(code);
    if (code !== "OTHER" && textValue) {
      onChangeTextValue("");
    }
    setOpen(false);
    setSearchQuery("");
  };

  // Handlers for MULTI_SELECT
  const handleToggleMultiNa = () => {
    if (!naOption) return;
    if (isMultiNaActive) {
      onChangeValue([]);
    } else {
      // Preserve canonical storage convention: if NOT_APPLICABLE exists in attribute_options, store ["NOT_APPLICABLE"], else "NA"
      const nextVal = naOption.optionCode === "NOT_APPLICABLE" ? ["NOT_APPLICABLE"] : "NA";
      onChangeValue(nextVal);
      if (textValue) {
        onChangeTextValue("");
      }
    }
  };

  const handleToggleMultiOption = (code: string) => {
    const base = activeRegularMultiCodes;
    if (base.includes(code)) {
      const next = base.filter((c) => c !== code);
      onChangeValue(next);
      if (code === "OTHER" && textValue) {
        onChangeTextValue("");
      }
    } else {
      const next = [...base, code];
      onChangeValue(next);
    }
  };

  const handleRemoveMultiTag = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    if (disabled) return;
    if (isNaCode(code)) {
      onChangeValue([]);
      return;
    }
    const next = activeRegularMultiCodes.filter((c) => c !== code);
    onChangeValue(next);
    if (code === "OTHER" && textValue) {
      onChangeTextValue("");
    }
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onChangeValue(isMulti ? [] : "");
    if (textValue) {
      onChangeTextValue("");
    }
  };

  const handleCustomTextChange = (nextText: string) => {
    onChangeTextValue(nextText);
    if (isMulti && nextText.trim() !== "" && !activeRegularMultiCodes.includes("OTHER")) {
      onChangeValue([...activeRegularMultiCodes, "OTHER"]);
    }
  };

  const MAX_VISIBLE_TAGS = 2;
  const visibleMultiCodes = activeRegularMultiCodes.slice(0, MAX_VISIBLE_TAGS);
  const overflowCount = Math.max(0, activeRegularMultiCodes.length - MAX_VISIBLE_TAGS);
  const hasAnySelection = isMulti
    ? isMultiNaActive || activeRegularMultiCodes.length > 0
    : singleSelectedCode !== "";

  return (
    <div ref={containerRef} className="relative flex flex-col gap-2">
      {/* Compact Trigger Control (Fixed / Bounded Height — Never Expands Form Grid) */}
      <div
        id={`attr-input-${attr.code}`}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`min-h-[42px] w-full rounded-xl border px-3.5 py-2 text-xs flex items-center justify-between gap-2 transition-colors select-none ${
          disabled
            ? "bg-zinc-100/70 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-400 cursor-not-allowed opacity-65"
            : open
            ? "bg-white dark:bg-zinc-950 border-zinc-900 dark:border-zinc-100 ring-1 ring-zinc-900 dark:ring-zinc-100 cursor-pointer"
            : "bg-zinc-50 hover:bg-zinc-100/70 dark:bg-zinc-950 dark:hover:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 cursor-pointer"
        }`}
      >
        <div className="flex-1 min-w-0 flex items-center flex-wrap gap-1.5">
          {!isMulti ? (
            singleSelectedCode ? (
              <span
                className={`truncate text-xs font-medium ${
                  isNaCode(singleSelectedCode)
                    ? "text-zinc-500 dark:text-zinc-400 italic"
                    : "text-zinc-900 dark:text-zinc-100"
                }`}
                title={
                  singleSelectedCode === "OTHER" && textValue.trim()
                    ? `${getLabelForCode("OTHER")}: ${textValue.trim()}`
                    : getLabelForCode(singleSelectedCode)
                }
              >
                {singleSelectedCode === "OTHER" && textValue.trim()
                  ? `${getLabelForCode("OTHER")}: ${textValue.trim()}`
                  : getLabelForCode(singleSelectedCode)}
              </span>
            ) : (
              <span className="text-zinc-400 dark:text-zinc-500 text-xs">
                선택 안함 (Select...)
              </span>
            )
          ) : isMultiNaActive ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-zinc-200/80 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
              <span>{naOption ? naOption.label : "해당 없음 (Not Applicable)"}</span>
              {!disabled && (
                <button
                  type="button"
                  aria-label="해당 없음 해제"
                  onClick={(e) => handleRemoveMultiTag(e, "NA")}
                  className="ml-0.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                >
                  ×
                </button>
              )}
            </span>
          ) : activeRegularMultiCodes.length > 0 ? (
            <>
              {visibleMultiCodes.map((code) => {
                const rawLabel = getLabelForCode(code);
                const tagText =
                  code === "OTHER" && textValue.trim()
                    ? `${rawLabel}: ${textValue.trim()}`
                    : rawLabel;
                return (
                  <span
                    key={code}
                    title={tagText}
                    className="inline-flex items-center gap-1 max-w-[210px] rounded-md bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/70 px-2 py-0.5 text-[11px] font-semibold text-indigo-800 dark:text-indigo-300"
                  >
                    <span className="truncate">{tagText}</span>
                    {!disabled && (
                      <button
                        type="button"
                        aria-label={`${rawLabel} 선택 해제`}
                        onClick={(e) => handleRemoveMultiTag(e, code)}
                        className="shrink-0 text-indigo-500 hover:text-indigo-900 dark:hover:text-white font-bold cursor-pointer"
                      >
                        ×
                      </button>
                    )}
                  </span>
                );
              })}
              {overflowCount > 0 && (
                <span
                  title={activeRegularMultiCodes
                    .slice(MAX_VISIBLE_TAGS)
                    .map((c) => getLabelForCode(c))
                    .join(", ")}
                  className="inline-flex items-center rounded-md bg-zinc-900 text-white dark:bg-zinc-200 dark:text-zinc-900 px-2 py-0.5 text-[11px] font-bold shrink-0"
                >
                  +{overflowCount}
                </span>
              )}
            </>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-500 text-xs">
              복수 선택 가능 (클릭하여 옵션 선택...)
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {hasAnySelection && !disabled && (
            <button
              type="button"
              title={isMulti ? "전체 선택 해제" : "선택 해제"}
              aria-label={isMulti ? "전체 선택 해제" : "선택 해제"}
              onClick={handleClearAll}
              className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors cursor-pointer"
            >
              해제
            </button>
          )}
          <svg
            className={`w-4 h-4 text-zinc-400 transition-transform duration-150 ${
              open ? "rotate-180 text-zinc-800 dark:text-zinc-200" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Floating Overlay Popover — Absolute Positioned so Underlying Form Never Expands Vertically */}
      {open && !disabled && (
        <div
          role="listbox"
          aria-multiselectable={isMulti}
          className="absolute left-0 right-0 top-[46px] z-40 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden animate-in fade-in duration-100"
        >
          {/* Search & Quick Action Header */}
          <div className="p-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/60 space-y-1.5">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="국문 또는 영문 옵션 검색..."
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-200"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1.5 text-[11px] font-bold text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                >
                  ×
                </button>
              )}
            </div>

            {isMulti && (
              <div className="flex items-center justify-between px-1 text-[11px]">
                <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                  선택됨:{" "}
                  <strong className="text-indigo-600 dark:text-indigo-400">
                    {isMultiNaActive ? "해당 없음" : `${activeRegularMultiCodes.length}개`}
                  </strong>
                </span>
                <div className="flex items-center gap-2">
                  {hasAnySelection && (
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="text-rose-600 dark:text-rose-400 hover:underline font-semibold cursor-pointer"
                    >
                      전체 해제
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setSearchQuery("");
                    }}
                    className="text-zinc-700 dark:text-zinc-300 hover:underline font-bold cursor-pointer"
                  >
                    닫기
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Scrollable Option List */}
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
            {!isMulti && !searchQuery.trim() && (
              <button
                type="button"
                onClick={() => handleSingleSelect("")}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                  singleSelectedCode === ""
                    ? "bg-zinc-100 dark:bg-zinc-800 font-bold text-zinc-900 dark:text-white"
                    : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                }`}
              >
                <span>선택 안함 (None)</span>
                {singleSelectedCode === "" && <span>✓</span>}
              </button>
            )}

            {/* N/A Option */}
            {naOption && naMatchesSearch && (
              isMulti ? (
                <label
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors border-b border-zinc-100 dark:border-zinc-800 mb-1 ${
                    isMultiNaActive
                      ? "bg-zinc-100 dark:bg-zinc-800 font-bold text-zinc-900 dark:text-white"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-zinc-600 dark:text-zinc-300"
                  }`}
                >
                  <input
                    id={`attr-checkbox-na-${attr.code}`}
                    type="checkbox"
                    checked={isMultiNaActive}
                    onChange={handleToggleMultiNa}
                    className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-zinc-900"
                  />
                  <span>{naOption.label}</span>
                </label>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSingleSelect(naOption.optionCode)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer border-b border-zinc-100 dark:border-zinc-800 mb-1 ${
                    isNaCode(singleSelectedCode)
                      ? "bg-zinc-100 dark:bg-zinc-800 font-bold text-zinc-900 dark:text-white"
                      : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                  }`}
                >
                  <span>{naOption.label}</span>
                  {isNaCode(singleSelectedCode) && <span>✓</span>}
                </button>
              )
            )}

            {/* Regular Options */}
            {filteredRegularOptions.map((opt) => {
              if (!isMulti) {
                const selected = singleSelectedCode === opt.optionCode;
                return (
                  <button
                    key={opt.optionCode}
                    type="button"
                    disabled={opt.isAdminRestricted}
                    onClick={() => {
                      if (!opt.isAdminRestricted) {
                        handleSingleSelect(opt.optionCode);
                      }
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between gap-2 ${
                      opt.isAdminRestricted
                        ? "opacity-50 cursor-not-allowed text-zinc-400"
                        : selected
                        ? "bg-indigo-50 dark:bg-indigo-950/50 font-bold text-indigo-800 dark:text-indigo-300 cursor-pointer"
                        : "text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer"
                    }`}
                  >
                    <span className="truncate">
                      {opt.label}
                      {opt.isAdminRestricted && " (어드민 전용)"}
                    </span>
                    {selected && <span className="shrink-0 font-bold">✓</span>}
                  </button>
                );
              }

              const checked = activeRegularMultiCodes.includes(opt.optionCode);
              const itemDisabled = isMultiNaActive || opt.isAdminRestricted;

              return (
                <label
                  key={opt.optionCode}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${
                    itemDisabled
                      ? "opacity-50 cursor-not-allowed text-zinc-400"
                      : checked
                      ? "bg-indigo-50 dark:bg-indigo-950/40 font-semibold text-indigo-800 dark:text-indigo-300 cursor-pointer"
                      : "text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer"
                  }`}
                >
                  <input
                    id={`attr-checkbox-${attr.code}-${opt.optionCode}`}
                    type="checkbox"
                    checked={checked}
                    disabled={itemDisabled}
                    onChange={() => {
                      if (!itemDisabled) {
                        handleToggleMultiOption(opt.optionCode);
                      }
                    }}
                    className="rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="truncate">{opt.label}</span>
                </label>
              );
            })}

            {filteredRegularOptions.length === 0 && !naMatchesSearch && (
              <div className="px-3 py-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
                검색어와 일치하는 옵션이 없습니다.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inline Custom Text Input when Other (기타) is Supported and Selected */}
      {isOtherSelected && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 shrink-0">
            기타 상세 (Other):
          </span>
          <input
            id={isMulti ? `attr-text-input-multi-${attr.code}` : `attr-text-input-${attr.code}`}
            type="text"
            placeholder="기타 상세 내용을 직접 입력해 주세요 (예: Cool)..."
            value={textValue}
            disabled={disabled}
            onChange={(e) => handleCustomTextChange(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:bg-white dark:focus:bg-zinc-950 focus:border-zinc-900 dark:focus:border-zinc-100 disabled:opacity-60"
          />
        </div>
      )}
    </div>
  );
}
