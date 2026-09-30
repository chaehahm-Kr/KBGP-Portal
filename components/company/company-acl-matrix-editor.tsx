"use client";

import React from "react";
import {
  AclCategory,
  AclLevel,
  ACL_CATEGORIES,
  BRAND_PORTAL_ROLES,
  ROLE_PRESETS,
  BrandPortalRole,
  mapRoleToPreset,
  parseAclLevel,
} from "@/lib/permissions/brand-portal-acl";

interface CompanyAclMatrixEditorProps {
  selectedRole: string; // "company_admin" | "company_staff" | "viewer" | "manager" | "restricted" etc.
  onRoleChange: (role: string) => void;
  permissions: Record<string, any>;
  onPermissionsChange: (updated: Record<string, any>) => void;
  readOnly?: boolean;
}

export function CompanyAclMatrixEditor({
  selectedRole,
  onRoleChange,
  permissions,
  onPermissionsChange,
  readOnly = false,
}: CompanyAclMatrixEditorProps) {
  const currentPresetId = mapRoleToPreset(selectedRole);

  // Apply Role Preset to matrix
  const handleRolePresetSelect = (newRole: BrandPortalRole) => {
    onRoleChange(newRole === "admin" ? "company_admin" : newRole === "staff" ? "company_staff" : newRole);
    
    // Apply preset default matrix
    const presetMatrix = ROLE_PRESETS[newRole];
    onPermissionsChange({
      ...permissions,
      preset: newRole,
      role: newRole,
      ...presetMatrix,
    });
  };

  // Change individual category row level
  const handleCategoryLevelChange = (catId: AclCategory, level: AclLevel) => {
    onPermissionsChange({
      ...permissions,
      [catId]: level,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start w-full">
      {/* 1. Left Column — Role Preset Selection (Vertical Stack) */}
      <div className="lg:col-span-4 space-y-2">
        <label className="block text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
          역할 선택 (Role Preset) <span className="text-rose-500">*</span>
        </label>
        <div className="flex flex-col gap-2">
          {BRAND_PORTAL_ROLES.map((roleObj) => {
            const isSelected = currentPresetId === roleObj.id;
            return (
              <button
                key={roleObj.id}
                type="button"
                disabled={readOnly}
                onClick={() => handleRolePresetSelect(roleObj.id)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? "border-indigo-600 bg-indigo-50/80 text-indigo-950 dark:bg-indigo-950/60 dark:border-indigo-500 dark:text-indigo-100 ring-2 ring-indigo-500/20 font-bold shadow-xs"
                    : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                } ${readOnly ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <div className="text-xs flex items-center justify-between">
                  <span className="font-semibold">{roleObj.labelKo}</span>
                  {isSelected && <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">✓</span>}
                </div>
                <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-sans mt-0.5">
                  {roleObj.labelEn}
                </div>
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2 leading-tight">
                  {roleObj.description}
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 pt-1 leading-relaxed">
          💡 역할을 클릭하면 기본 권한이 오른쪽 매트릭스에 즉시 반영되며, 특정 업무 항목을 개별적으로 자유롭게 변경할 수 있습니다.
        </p>
      </div>

      {/* 2. Right Column — 9-Category ACL Matrix Table */}
      <div className="lg:col-span-8 space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
            메뉴별 상세 권한 설정 (ACL Matrix)
          </label>
        </div>

        <div className="rounded-xl border border-zinc-200 overflow-hidden dark:border-zinc-800 shadow-2xs bg-white dark:bg-zinc-900">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-100/80 text-[11px] font-bold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-300">
                <th className="px-3.5 py-2.5 whitespace-nowrap min-w-[170px]">메뉴 / 업무 영역</th>
                <th className="px-1.5 py-2.5 text-center text-rose-600 dark:text-rose-400 whitespace-nowrap">접근불가</th>
                <th className="px-1.5 py-2.5 text-center text-zinc-700 dark:text-zinc-300 whitespace-nowrap">조회전용</th>
                <th className="px-1.5 py-2.5 text-center text-indigo-600 dark:text-indigo-400 whitespace-nowrap">생성/수정</th>
                <th className="px-1.5 py-2.5 text-center text-emerald-600 dark:text-emerald-400 whitespace-nowrap">생성/수정/삭제</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-xs dark:divide-zinc-800/80">
              {ACL_CATEGORIES.map((cat) => {
                const currentLevel: AclLevel =
                  permissions[cat.id] !== undefined
                    ? parseAclLevel(permissions[cat.id])
                    : ROLE_PRESETS[currentPresetId]?.[cat.id] || "none";

                return (
                  <tr key={cat.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="px-3.5 py-2.5">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex flex-wrap items-baseline gap-x-1.5">
                        <span className="whitespace-nowrap font-bold text-xs">{cat.labelKo}</span>
                        <span className="text-[10px] text-zinc-400 font-normal">({cat.labelEn})</span>
                      </div>
                      <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                        {cat.description}
                      </div>
                    </td>


                    {/* Level 1: none */}
                    <td className="px-1.5 py-2.5 text-center align-middle">
                      <input
                        type="radio"
                        name={`acl-${cat.id}`}
                        disabled={readOnly}
                        checked={currentLevel === "none"}
                        onChange={() => handleCategoryLevelChange(cat.id, "none")}
                        className="h-4 w-4 text-rose-600 focus:ring-rose-500 dark:bg-zinc-950 border-zinc-300 cursor-pointer disabled:cursor-not-allowed"
                        title={`${cat.labelKo}: 접근불가`}
                      />
                    </td>

                    {/* Level 2: read */}
                    <td className="px-1.5 py-2.5 text-center align-middle">
                      <input
                        type="radio"
                        name={`acl-${cat.id}`}
                        disabled={readOnly}
                        checked={currentLevel === "read"}
                        onChange={() => handleCategoryLevelChange(cat.id, "read")}
                        className="h-4 w-4 text-zinc-700 focus:ring-zinc-500 dark:bg-zinc-950 border-zinc-300 cursor-pointer disabled:cursor-not-allowed"
                        title={`${cat.labelKo}: 조회전용`}
                      />
                    </td>

                    {/* Level 3: write */}
                    <td className="px-1.5 py-2.5 text-center align-middle">
                      <input
                        type="radio"
                        name={`acl-${cat.id}`}
                        disabled={readOnly}
                        checked={currentLevel === "write"}
                        onChange={() => handleCategoryLevelChange(cat.id, "write")}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 dark:bg-zinc-950 border-zinc-300 cursor-pointer disabled:cursor-not-allowed"
                        title={`${cat.labelKo}: 생성/수정`}
                      />
                    </td>

                    {/* Level 4: manage */}
                    <td className="px-1.5 py-2.5 text-center align-middle">
                      <input
                        type="radio"
                        name={`acl-${cat.id}`}
                        disabled={readOnly}
                        checked={currentLevel === "manage"}
                        onChange={() => handleCategoryLevelChange(cat.id, "manage")}
                        className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 dark:bg-zinc-950 border-zinc-300 cursor-pointer disabled:cursor-not-allowed"
                        title={`${cat.labelKo}: 생성/수정/삭제`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
