"use client";

import React, { useState, useMemo, useEffect } from "react";
import { MarketingTemplatePackage, TemplateType } from "@/lib/brand-marketing/campaign-types";

interface TemplatePickerTableProps {
  templates: MarketingTemplatePackage[];
  selectedTemplateId: string;
  onSelectTemplate: (templateId: string) => void;
  onPreviewTemplate: (template: MarketingTemplatePackage) => void;
  onDuplicateTemplate: (template: MarketingTemplatePackage) => void;
  onDeleteTemplate: (template: MarketingTemplatePackage) => void;
  onBulkDeleteTemplates?: (templateIds: string[]) => Promise<{
    success: boolean;
    deletedCount: number;
    blockedCount: number;
    blockedDetails?: Array<{ id: string; error: string }>;
  }>;
  onOpenUploadModal: () => void;
  onOpenGuideModal: () => void;
}

export function TemplatePickerTable({
  templates,
  selectedTemplateId,
  onSelectTemplate,
  onPreviewTemplate,
  onDuplicateTemplate,
  onDeleteTemplate,
  onBulkDeleteTemplates,
  onOpenUploadModal,
  onOpenGuideModal,
}: TemplatePickerTableProps) {
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | TemplateType>("ALL");
  const [langFilter, setLangFilter] = useState<"ALL" | "ko" | "en">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "ARCHIVED">("ALL");

  // Sorting
  const [sortField, setSortField] = useState<"createdAt" | "updatedAt" | "name">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Bulk Selection (Set of template IDs)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk Delete Modal State
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [bulkDeleteResult, setBulkDeleteResult] = useState<{
    deletedCount: number;
    blockedCount: number;
    blockedDetails?: Array<{ id: string; error: string }>;
  } | null>(null);

  // Filtered and Sorted list
  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = tpl.name?.toLowerCase().includes(q);
        const matchesSubject = tpl.subject?.toLowerCase().includes(q);
        const matchesVersion = tpl.version?.toLowerCase().includes(q);
        if (!matchesName && !matchesSubject && !matchesVersion) {
          return false;
        }
      }

      // Type
      if (typeFilter !== "ALL" && tpl.templateType !== typeFilter) {
        return false;
      }

      // Language
      if (langFilter !== "ALL" && tpl.language !== langFilter) {
        return false;
      }

      // Status
      if (statusFilter !== "ALL") {
        const isArchived = tpl.status === "ARCHIVED";
        if (statusFilter === "ACTIVE" && isArchived) return false;
        if (statusFilter === "ARCHIVED" && !isArchived) return false;
      }

      return true;
    });
  }, [templates, searchQuery, typeFilter, langFilter, statusFilter]);

  const sortedTemplates = useMemo(() => {
    const list = [...filteredTemplates];
    list.sort((a, b) => {
      let comparison = 0;
      if (sortField === "name") {
        comparison = (a.name || "").localeCompare(b.name || "");
      } else if (sortField === "createdAt") {
        const aDate = new Date(a.createdAt || 0).getTime();
        const bDate = new Date(b.createdAt || 0).getTime();
        comparison = aDate - bDate;
      } else if (sortField === "updatedAt") {
        const aDate = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bDate = new Date(b.updatedAt || b.createdAt || 0).getTime();
        comparison = aDate - bDate;
      }
      return sortDir === "asc" ? comparison : -comparison;
    });
    return list;
  }, [filteredTemplates, sortField, sortDir]);

  // Total pages
  const totalPages = Math.max(1, Math.ceil(sortedTemplates.length / pageSize));

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter, langFilter, statusFilter, pageSize]);

  // Current page items
  const paginatedTemplates = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedTemplates.slice(start, start + pageSize);
  }, [sortedTemplates, currentPage, pageSize]);

  // Bulk Selection Handlers
  const currentPageIds = useMemo(() => paginatedTemplates.map((t) => t.id), [paginatedTemplates]);
  const isAllCurrentPageSelected =
    currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.has(id));
  const isSomeCurrentPageSelected =
    currentPageIds.some((id) => selectedIds.has(id)) && !isAllCurrentPageSelected;

  const handleToggleSelectAllCurrentPage = () => {
    const next = new Set(selectedIds);
    if (isAllCurrentPageSelected) {
      currentPageIds.forEach((id) => next.delete(id));
    } else {
      currentPageIds.forEach((id) => next.add(id));
    }
    setSelectedIds(next);
  };

  const handleToggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleSortToggle = (field: "createdAt" | "updatedAt" | "name") => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  // Bulk Delete Execution
  const handleExecuteBulkDelete = async () => {
    if (!onBulkDeleteTemplates || selectedIds.size === 0) return;
    setIsDeletingBulk(true);
    setBulkDeleteResult(null);

    try {
      const result = await onBulkDeleteTemplates(Array.from(selectedIds));
      setBulkDeleteResult(result);
      if (result.deletedCount > 0) {
        // Remove successfully deleted from selection
        const next = new Set(selectedIds);
        templates
          .filter((t) => selectedIds.has(t.id))
          .forEach((t) => {
            const isBlocked = result.blockedDetails?.some((b) => b.id === t.id);
            if (!isBlocked) next.delete(t.id);
          });
        setSelectedIds(next);
      }
    } catch (err: any) {
      setBulkDeleteResult({
        deletedCount: 0,
        blockedCount: selectedIds.size,
        blockedDetails: [{ id: "all", error: err.message || "Bulk delete failed" }],
      });
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return "-";
    try {
      const d = new Date(isoStr);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
      {/* 1. Header Toolbar */}
      <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              2. Select Template Package
            </h3>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
              {filteredTemplates.length} / {templates.length} templates
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            캠페인에 사용할 이메일 템플릿 패키지를 선택하거나 신규 업로드합니다.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onOpenGuideModal}
            className="px-3 py-1.5 rounded text-xs font-semibold border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
          >
            📖 Designer Guide
          </button>
          <button
            type="button"
            onClick={onOpenUploadModal}
            className="px-3.5 py-1.5 rounded text-xs font-bold bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white/90 cursor-pointer shadow-xs transition-colors"
          >
            + Upload Package (HTML / ZIP)
          </button>
        </div>
      </div>

      {/* 2. Filter & Search Controls Bar */}
      <div className="px-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Search */}
          <div className="lg:col-span-2 relative">
            <input
              type="text"
              placeholder="Search by template name, subject, version..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs px-3 py-2 pl-8 border border-zinc-200 dark:border-zinc-700 rounded-md bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
            <span className="absolute left-2.5 top-2.5 text-xs text-zinc-400">🔍</span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2 text-xs text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="w-full text-xs px-2.5 py-2 border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 cursor-pointer"
            >
              <option value="ALL">All Types (전체)</option>
              <option value="HTML">📄 HTML Template</option>
              <option value="IMAGE">🖼️ Image Template</option>
            </select>
          </div>

          {/* Language Filter */}
          <div>
            <select
              value={langFilter}
              onChange={(e) => setLangFilter(e.target.value as any)}
              className="w-full text-xs px-2.5 py-2 border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 cursor-pointer"
            >
              <option value="ALL">All Languages (언어)</option>
              <option value="ko">KO (한국어)</option>
              <option value="en">EN (English)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full text-xs px-2.5 py-2 border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 cursor-pointer"
            >
              <option value="ALL">All Status (상태)</option>
              <option value="ACTIVE">Active (활성)</option>
              <option value="ARCHIVED">Archived (보관됨)</option>
            </select>
          </div>
        </div>

        {/* 3. Bulk Action Bar (Visible when rows are selected) */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-md text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-900 dark:text-amber-200">
                {selectedIds.size} template(s) selected
              </span>
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-[11px] text-amber-700 dark:text-amber-400 underline hover:text-amber-900 cursor-pointer ml-1"
              >
                Clear selection
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(true)}
                className="px-3 py-1 rounded text-xs font-bold bg-red-600 text-white hover:bg-red-700 cursor-pointer shadow-xs transition-colors"
              >
                🗑️ Bulk Delete ({selectedIds.size})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Compact Data Table */}
      <div className="overflow-x-auto border-t border-zinc-100 dark:border-zinc-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-50 dark:bg-zinc-950/60 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 select-none">
            <tr>
              {/* Checkbox column */}
              <th className="py-2.5 px-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={isAllCurrentPageSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = isSomeCurrentPageSelected;
                  }}
                  onChange={handleToggleSelectAllCurrentPage}
                  className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-0 cursor-pointer"
                  title="Select / Deselect all on current page"
                />
              </th>

              {/* Active Selection Radio Column */}
              <th className="py-2.5 px-3 w-14 text-center">Active</th>

              {/* Template Name & Subject */}
              <th
                onClick={() => handleSortToggle("name")}
                className="py-2.5 px-3 font-semibold text-zinc-900 dark:text-zinc-200 cursor-pointer hover:text-zinc-600"
              >
                Template Name &amp; Subject{" "}
                {sortField === "name" && (sortDir === "asc" ? "▲" : "▼")}
              </th>

              {/* Type */}
              <th className="py-2.5 px-3 w-28 font-semibold text-zinc-900 dark:text-zinc-200">
                Type
              </th>

              {/* Language */}
              <th className="py-2.5 px-3 w-16 font-semibold text-zinc-900 dark:text-zinc-200">
                Lang
              </th>

              {/* Status */}
              <th className="py-2.5 px-3 w-20 font-semibold text-zinc-900 dark:text-zinc-200">
                Status
              </th>

              {/* Created At */}
              <th
                onClick={() => handleSortToggle("createdAt")}
                className="py-2.5 px-3 w-24 font-semibold text-zinc-900 dark:text-zinc-200 cursor-pointer hover:text-zinc-600"
              >
                Created {sortField === "createdAt" && (sortDir === "asc" ? "▲" : "▼")}
              </th>

              {/* Updated At */}
              <th
                onClick={() => handleSortToggle("updatedAt")}
                className="py-2.5 px-3 w-24 font-semibold text-zinc-900 dark:text-zinc-200 cursor-pointer hover:text-zinc-600"
              >
                Updated {sortField === "updatedAt" && (sortDir === "asc" ? "▲" : "▼")}
              </th>

              {/* Actions */}
              <th className="py-2.5 px-3 w-32 text-right font-semibold text-zinc-900 dark:text-zinc-200">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {paginatedTemplates.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-zinc-400">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">검색 조건에 일치하는 템플릿이 없습니다.</p>
                    <p className="text-xs text-zinc-400">
                      검색어를 지우거나 필터를 초기화해 보세요.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedTemplates.map((tpl) => {
                const isSelected = tpl.id === selectedTemplateId;
                const isChecked = selectedIds.has(tpl.id);
                const isImage = tpl.templateType === "IMAGE";
                const isArchived = tpl.status === "ARCHIVED";

                return (
                  <tr
                    key={tpl.id}
                    onClick={() => onSelectTemplate(tpl.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-zinc-100/90 dark:bg-zinc-800/70 font-medium"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                    } ${isArchived ? "opacity-60" : ""}`}
                  >
                    {/* Checkbox */}
                    <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => handleToggleSelectRow(tpl.id, e as any)}
                        className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-0 cursor-pointer"
                      />
                    </td>

                    {/* Active Radio Badge */}
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-5 h-5 rounded-full border text-[11px] ${
                          isSelected
                            ? "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 border-zinc-950 dark:border-white font-bold"
                            : "border-zinc-300 dark:border-zinc-700 text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                    </td>

                    {/* Template Name & Subject */}
                    <td className="py-3 px-3 max-w-[280px]">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                            {tpl.name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-mono">
                            v{tpl.version}
                          </span>
                          {tpl.isDefault && (
                            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.2 rounded">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                          {tpl.subject}
                        </p>
                      </div>
                    </td>

                    {/* Type Badge */}
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded ${
                          isImage
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        }`}
                      >
                        {isImage ? "🖼️ Image" : "📄 HTML"}
                      </span>
                    </td>

                    {/* Language */}
                    <td className="py-3 px-3">
                      <span className="text-[11px] font-mono font-bold text-zinc-600 dark:text-zinc-400">
                        {tpl.language.toUpperCase()}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                          isArchived
                            ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                        }`}
                      >
                        {isArchived ? "Archived" : "Active"}
                      </span>
                    </td>

                    {/* Created Date */}
                    <td className="py-3 px-3 text-[11px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                      {formatDate(tpl.createdAt)}
                    </td>

                    {/* Updated Date */}
                    <td className="py-3 px-3 text-[11px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                      {formatDate(tpl.updatedAt || tpl.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5 text-xs">
                        <button
                          type="button"
                          onClick={() => onPreviewTemplate(tpl)}
                          className="px-2 py-1 rounded text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer font-medium"
                          title="Preview full email"
                        >
                          👁️ View
                        </button>
                        <button
                          type="button"
                          onClick={() => onDuplicateTemplate(tpl)}
                          className="px-2 py-1 rounded text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer font-medium"
                          title="Duplicate template"
                        >
                          복제
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTemplate(tpl)}
                          className="px-2 py-1 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer font-medium"
                          title="Delete or Archive template"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 5. Pagination Footer */}
      <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400">
          <span>
            Showing{" "}
            <strong className="text-zinc-900 dark:text-zinc-100">
              {sortedTemplates.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
            </strong>{" "}
            to{" "}
            <strong className="text-zinc-900 dark:text-zinc-100">
              {Math.min(currentPage * pageSize, sortedTemplates.length)}
            </strong>{" "}
            of <strong className="text-zinc-900 dark:text-zinc-100">{sortedTemplates.length}</strong>
          </span>

          <div className="flex items-center gap-1">
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2 py-1 border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-xs"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="px-2.5 py-1 border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 cursor-pointer"
          >
            ← Prev
          </button>

          <span className="px-2 text-zinc-600 dark:text-zinc-400">
            Page {currentPage} of {totalPages}
          </span>

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="px-2.5 py-1 border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 cursor-pointer"
          >
            Next →
          </button>
        </div>
      </div>

      {/* 6. Bulk Delete Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 max-w-md w-full p-5 space-y-4 shadow-xl">
            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>⚠️</span> Confirm Bulk Delete
            </h4>

            <p className="text-xs text-zinc-600 dark:text-zinc-300">
              선택한 <strong className="text-zinc-900 dark:text-zinc-100">{selectedIds.size}개</strong>의
              템플릿을 삭제하시겠습니까?
            </p>

            <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 space-y-1">
              <p className="font-semibold text-zinc-700 dark:text-zinc-300">안전 검증 규칙:</p>
              <p>• 기존 캠페인(임시저장 및 발송완료)에서 참조 중인 템플릿은 데이터 보호를 위해 삭제가 자동 차단됩니다.</p>
              <p>• 참조되지 않은 템플릿만 영구 삭제됩니다.</p>
            </div>

            {bulkDeleteResult && (
              <div
                className={`p-3 rounded text-xs space-y-1 ${
                  bulkDeleteResult.blockedCount > 0
                    ? "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200"
                    : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border border-emerald-200"
                }`}
              >
                <p className="font-bold">
                  결과: {bulkDeleteResult.deletedCount}개 삭제 완료
                  {bulkDeleteResult.blockedCount > 0 && `, ${bulkDeleteResult.blockedCount}개 차단됨`}
                </p>
                {bulkDeleteResult.blockedDetails && bulkDeleteResult.blockedDetails.length > 0 && (
                  <ul className="list-disc pl-4 text-[11px] space-y-0.5">
                    {bulkDeleteResult.blockedDetails.slice(0, 3).map((b, i) => (
                      <li key={i}>{b.error}</li>
                    ))}
                    {bulkDeleteResult.blockedDetails.length > 3 && (
                      <li>... 외 {bulkDeleteResult.blockedDetails.length - 3}건 차단</li>
                    )}
                  </ul>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setShowBulkDeleteModal(false);
                  setBulkDeleteResult(null);
                }}
                disabled={isDeletingBulk}
                className="px-3 py-1.5 text-xs font-semibold rounded border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 cursor-pointer"
              >
                {bulkDeleteResult ? "닫기" : "취소"}
              </button>

              {!bulkDeleteResult && (
                <button
                  type="button"
                  onClick={handleExecuteBulkDelete}
                  disabled={isDeletingBulk}
                  className="px-3.5 py-1.5 text-xs font-bold rounded bg-red-600 text-white hover:bg-red-700 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isDeletingBulk ? "삭제 중..." : "확인 및 삭제 실행"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
