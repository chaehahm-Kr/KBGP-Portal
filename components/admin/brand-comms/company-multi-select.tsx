"use client";

import React, { useMemo, useState } from "react";

export interface SelectableCompany {
  id: string;
  name: string;
  status: string;
  country?: string | null;
}

interface CompanyMultiSelectProps {
  companies: SelectableCompany[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export default function CompanyMultiSelect({
  companies,
  selectedIds,
  onChange,
}: CompanyMultiSelectProps) {
  const [query, setQuery] = useState("");

  const activeCompanies = useMemo(
    () => companies.filter((c) => c.status === "active"),
    [companies]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeCompanies;
    return activeCompanies.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
    );
  }, [activeCompanies, query]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggle = (companyId: string) => {
    if (selectedSet.has(companyId)) {
      onChange(selectedIds.filter((id) => id !== companyId));
    } else {
      onChange([...selectedIds, companyId]);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search active brand companies by name..."
          className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {selectedIds.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="shrink-0 text-[11px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white px-2 py-1"
          >
            Clear ({selectedIds.length})
          </button>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((id) => {
            const comp = companies.find((c) => c.id === id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-2.5 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-300"
              >
                <span>{comp ? comp.name : id.slice(0, 8)}</span>
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  className="hover:text-blue-900 dark:hover:text-white ml-0.5"
                  aria-label={`Remove ${comp?.name || id}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="max-h-44 overflow-y-auto divide-y divide-zinc-200/70 dark:divide-zinc-800 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        {filtered.length === 0 ? (
          <div className="p-3 text-center text-xs text-zinc-500">
            No matching active brand companies found.
          </div>
        ) : (
          filtered.map((c) => {
            const checked = selectedSet.has(c.id);
            return (
              <label
                key={c.id}
                className={`flex items-center justify-between gap-3 px-3 py-2 text-xs cursor-pointer transition-colors ${
                  checked
                    ? "bg-blue-50/70 dark:bg-blue-950/30 text-zinc-900 dark:text-white"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(c.id)}
                    className="h-3.5 w-3.5 rounded border-zinc-300 dark:border-zinc-700 accent-blue-600"
                  />
                  <span className="truncate font-medium">{c.name}</span>
                </span>
                <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                  {c.id.slice(0, 8)}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
