"use client";

import React from "react";
import {
  AclCategory,
  AclLevel,
  ACL_CATEGORIES,
  ACL_LEVEL_LABELS,
  BRAND_PORTAL_ROLES,
  ROLE_PRESETS,
  BrandPortalRole,
  mapRoleToPreset,
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
      ...presetMatrix,
    });
  };

  // Change individual category row
  const handleCategoryLevelChange = (catId: AclCategory, level: AclLevel) => {
    onPermissionsChange({
      ...permissions,
      [catId]: level,
    });
  };

  const isCompanyAdmin = selectedRole === "company_admin" || selectedRole === "admin";

  return (
    <div className="space-y-4">
      {/* 1. Role Preset Selection Header */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
          역할 선택 (Role Preset) <span className="text-rose-500">*</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {BRAND_PORTAL_ROLES.map((roleObj) => {
            const isSelected = currentPresetId === roleObj.id;
            return (
              <button
                key={roleObj.id}
                type="button"
                disabled={readOnly}
                onClick={() => handleRolePresetSelect(roleObj.id)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? "border-indigo-600 bg-indigo-50/80 text-indigo-950 dark:bg-indigo-950/60 dark:border-indigo-500 dark:text-indigo-100 ring-2 ring-indigo-500/20 font-bold"
                    : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                } ${readOnly ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <div className="text-xs flex items-center justify-between">
                  <span>{roleObj.labelKo}</span>
                  {isSelected && <span className="text-[10px]">✓</span>}
                </div>
                <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-sans mt-0.5 truncate">
                  {roleObj.labelEn}
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          역할(Role)을 선택하면 기본 권한 매트릭스가 자동 적용되며, 아래 매트릭스에서 항목별로 권한을 커스텀 설정하실 수 있습니다.
        </p>
      </div>

      {/* 2. ACL Matrix Table */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
            포털 메뉴별 세부 권한 설정 (ACL Matrix)
          </label>
          {isCompanyAdmin && (
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800">
              관리자(Admin)는 항상 전 메뉴 삭제/관리 권한 보유
            </span>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 overflow-hidden dark:border-zinc-800 shadow-2xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-100/80 text-[11px] font-bold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-300">
                <th className="px-3.5 py-2.5 w-2/5">메뉴 / 업무 영역</th>
                <th className="px-2 py-2.5 text-center text-rose-600 dark:text-rose-400">접근불가</th>
                <th className="px-2 py-2.5 text-center text-zinc-700 dark:text-zinc-300">조회전용</th>
                <th className="px-2 py-2.5 text-center text-indigo-600 dark:text-indigo-400">생성/수정</th>
                <th className="px-2 py-2.5 text-center text-emerald-600 dark:text-emerald-400">생성/수정/삭제</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-xs dark:divide-zinc-800/80 bg-white dark:bg-zinc-900">
              {ACL_CATEGORIES.map((cat) => {
                const currentLevel: AclLevel = isCompanyAdmin
                  ? "manage"
                  : (permissions[cat.id] as AclLevel) || ROLE_PRESETS.viewer[cat.id];

                return (
                  <tr key={cat.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="px-3.5 py-2.5">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                        <span>{cat.labelKo}</span>
                        <span className="text-[10px] text-zinc-400 font-normal">({cat.labelEn})</span>
                      </div>
                      <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                        {cat.description}
                      </div>
                    </td>

                    {/* Level 1: none */}
                    <td className="px-2 py-2.5 text-center align-middle">
                      <input
                        type="radio"
                        name={`acl-${cat.id}`}
                        disabled={readOnly || isCompanyAdmin}
                        checked={currentLevel === "none"}
                        onChange={() => handleCategoryLevelChange(cat.id, "none")}
                        className="h-4 w-4 text-rose-600 focus:ring-rose-500 dark:bg-zinc-950 border-zinc-300 cursor-pointer disabled:cursor-not-allowed"
                        title={`${cat.labelKo}: 접근불가`}
                      />
                    </td>

                    {/* Level 2: read */}
                    <td className="px-2 py-2.5 text-center align-middle">
                      <input
                        type="radio"
                        name={`acl-${cat.id}`}
                        disabled={readOnly || isCompanyAdmin}
                        checked={currentLevel === "read"}
                        onChange={() => handleCategoryLevelChange(cat.id, "read")}
                        className="h-4 w-4 text-zinc-700 focus:ring-zinc-500 dark:bg-zinc-950 border-zinc-300 cursor-pointer disabled:cursor-not-allowed"
                        title={`${cat.labelKo}: 조회전용`}
                      />
                    </td>

                    {/* Level 3: write */}
                    <td className="px-2 py-2.5 text-center align-middle">
                      <input
                        type="radio"
                        name={`acl-${cat.id}`}
                        disabled={readOnly || isCompanyAdmin}
                        checked={currentLevel === "write"}
                        onChange={() => handleCategoryLevelChange(cat.id, "write")}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 dark:bg-zinc-950 border-zinc-300 cursor-pointer disabled:cursor-not-allowed"
                        title={`${cat.labelKo}: 생성/수정`}
                      />
                    </td>

                    {/* Level 4: manage */}
                    <td className="px-2 py-2.5 text-center align-middle">
                      <input
                        type="radio"
                        name={`acl-${cat.id}`}
                        disabled={readOnly || isCompanyAdmin}
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
