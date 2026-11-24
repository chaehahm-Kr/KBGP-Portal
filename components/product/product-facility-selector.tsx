"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  type CompanyLocationRecord,
  type ManufacturingFacilityComplianceRecord,
  isManufacturingCapableLocation,
} from "@/lib/compliance/v1-types";
import { getCompanyLocationsWithCompliance } from "@/lib/compliance/v1-facility-actions";
import { getCountryDisplayLabel } from "@/lib/constants/countries";

export interface ProductFacilitySelectorProps {
  productId?: string;
  companyId: string;
  primaryFacilityId: string | null;
  additionalFacilityIds?: string[];
  onChange?: (selection: { primaryFacilityId: string | null; additionalFacilityIds: string[] }) => void;
  readOnly?: boolean;
  isGrandfathered?: boolean;
  validationError?: string | null;
  manageOriginsUrl?: string;
}

type EnrichedLocation = CompanyLocationRecord & {
  compliance: ManufacturingFacilityComplianceRecord | null;
};

export function ProductFacilitySelector({
  companyId,
  primaryFacilityId,
  additionalFacilityIds = [],
  onChange,
  readOnly = false,
  isGrandfathered = false,
  validationError,
  manageOriginsUrl,
}: ProductFacilitySelectorProps) {
  const [facilities, setFacilities] = useState<EnrichedLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isChangingPrimary, setIsChangingPrimary] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    let isMounted = true;
    setLoading(true);
    setLoadError("");

    getCompanyLocationsWithCompliance(companyId, { capability: "MANUFACTURING" })
      .then((res) => {
        if (!isMounted) return;
        if (res.ok) {
          setFacilities(res.locations);
        } else {
          setLoadError(res.error || "제조시설 목록을 불러오지 못했습니다.");
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoadError(err.message || "제조시설 목록 조회 실패");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [companyId]);

  const defaultFacility = facilities.find((f) => f.is_default_manufacturing);
  const primaryFacility = facilities.find((f) => f.id === primaryFacilityId);
  const additionalFacilities = facilities.filter((f) => additionalFacilityIds.includes(f.id));

  // Available facilities to add (excluding current primary and additional)
  const availableForPrimary = facilities;
  const availableForAdditional = facilities.filter(
    (f) => f.id !== primaryFacilityId && !additionalFacilityIds.includes(f.id)
  );

  const handleSelectPrimary = (facilityId: string | null) => {
    if (!onChange || readOnly) return;
    setIsChangingPrimary(false);
    // If the newly chosen primary was in additional, remove it from additional
    const cleanAdditional = additionalFacilityIds.filter((id) => id !== facilityId);
    onChange({
      primaryFacilityId: facilityId,
      additionalFacilityIds: cleanAdditional,
    });
  };

  const handleAddAdditional = (facilityId: string) => {
    if (!onChange || readOnly || !facilityId) return;
    if (facilityId === primaryFacilityId || additionalFacilityIds.includes(facilityId)) return;
    onChange({
      primaryFacilityId,
      additionalFacilityIds: [...additionalFacilityIds, facilityId],
    });
  };

  const handleRemoveAdditional = (facilityId: string) => {
    if (!onChange || readOnly) return;
    onChange({
      primaryFacilityId,
      additionalFacilityIds: additionalFacilityIds.filter((id) => id !== facilityId),
    });
  };

  const handlePromoteToPrimary = (facilityId: string) => {
    if (!onChange || readOnly) return;
    // Swap or promote
    const nextAdditional = additionalFacilityIds.filter((id) => id !== facilityId);
    if (primaryFacilityId) {
      nextAdditional.push(primaryFacilityId);
    }
    onChange({
      primaryFacilityId: facilityId,
      additionalFacilityIds: nextAdditional,
    });
  };

  const renderFacilityCard = (
    facility: EnrichedLocation,
    isPrimary: boolean,
    onRemove?: () => void,
    onPromote?: () => void
  ) => {
    const comp = facility.compliance;
    return (
      <div
        key={facility.id}
        className={`rounded-lg border p-3 text-xs transition-all ${
          isPrimary
            ? "border-emerald-300 bg-emerald-50/20 dark:border-emerald-900 dark:bg-emerald-950/10 ring-1 ring-emerald-400/30"
            : "border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {isPrimary ? (
                <span className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  ★ 주 제조시설 (Primary)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                  추가 시설
                </span>
              )}

              {facility.facility_code && (
                <span className="inline-flex items-center rounded bg-indigo-100 dark:bg-indigo-950/60 px-1.5 py-0.5 text-[10px] font-bold font-mono text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {facility.facility_code}
                </span>
              )}

              <span className="font-bold text-xs text-zinc-950 dark:text-white">
                {facility.name}
              </span>

              {facility.is_default_manufacturing && (
                <span className="text-[9px] text-purple-700 dark:text-purple-400 font-semibold">
                  (기본 공장)
                </span>
              )}
            </div>

            {/* Legal Manufacturer Name EN & KO */}
            <div className="text-[11px] text-zinc-700 dark:text-zinc-300">
              <span className="font-semibold text-zinc-900 dark:text-white">
                {facility.manufacturer_legal_name_en || "법인명 미등록"}
              </span>
              {facility.manufacturer_name_ko && (
                <span className="text-zinc-500 text-[10px] ml-1.5">
                  ({facility.manufacturer_name_ko})
                </span>
              )}
            </div>

            {/* Address */}
            <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
              📍 {facility.address_line1}
              {facility.address_line2 ? ` ${facility.address_line2}` : ""}, {facility.city},{" "}
              {facility.postal_code} ({getCountryDisplayLabel(facility.country, "ko")})
            </div>

            {/* Regulatory Badges */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="inline-flex items-center rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[9px] font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                FEI: {comp?.fei_status === "ISSUED" ? comp.fei_number || "등록" : comp?.fei_status || "미등록"}
              </span>
              <span className="inline-flex items-center rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[9px] font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                MoCRA: {comp?.mocra_facility_status || "미등록"}
              </span>
              <span className="inline-flex items-center rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[9px] font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                OTC: {comp?.otc_facility_status || "비해당"}
              </span>
              {comp && (
                <span
                  className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold border ${
                    comp.verification_status === "VERIFIED"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                      : comp.verification_status === "UNDER_REVIEW"
                      ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                      : comp.verification_status === "RE_REVIEW_REQUIRED"
                      ? "bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800"
                      : comp.verification_status === "REJECTED"
                      ? "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800"
                      : comp.verification_status === "NEEDS_INFO"
                      ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
                      : "bg-zinc-50 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                  }`}
                >
                  KSELECT: {comp.verification_status}
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          {!readOnly && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isPrimary ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsChangingPrimary(true)}
                    className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer"
                  >
                    변경
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPrimary(null)}
                    className="rounded border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/40 px-2 py-1 text-[10px] font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 cursor-pointer"
                  >
                    해제
                  </button>
                </>
              ) : (
                <>
                  {onPromote && (
                    <button
                      type="button"
                      onClick={onPromote}
                      className="rounded border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer"
                    >
                      주 시설로 승격
                    </button>
                  )}
                  {onRemove && (
                    <button
                      type="button"
                      onClick={onRemove}
                      className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 cursor-pointer"
                    >
                      제거
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-zinc-150 dark:border-zinc-850">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
              <span>🏭</span>
              <span>제조사 및 제조시설 정보 (Manufacturing Facilities)</span>
            </h4>
            <span className="text-[10px] rounded-full bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              MoCRA / FDA 준수
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            미국 수출 및 MoCRA 시설 등록 준수를 위해 해당 제품을 생산하는 주 제조시설(Primary)과 추가 시설을 지정합니다.
          </p>
        </div>

        {manageOriginsUrl && (
          <Link
            href={manageOriginsUrl}
            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors flex items-center gap-1 self-start sm:self-auto"
          >
            <span>시설 관리 바로가기</span>
            <span>→</span>
          </Link>
        )}
      </div>

      {/* Grandfathered Non-Blocking Reminder Banner */}
      {isGrandfathered && !primaryFacilityId && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <span className="text-sm">ℹ️</span>
          <div className="space-y-0.5">
            <p className="font-bold text-[11px]">기존 등록 상품 안내 (Grandfathered Product)</p>
            <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
              제조시설 정보가 아직 등록되지 않았습니다. 기존 등록 완료된 상품은 등록 차단 없이 보호되나,
              향후 미국 통관 및 MoCRA 규제 심사를 위해 주 제조시설 등록을 권장합니다.
            </p>
          </div>
        </div>
      )}

      {/* Validation Error Banner */}
      {validationError && (
        <div className="rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <span>⚠️</span>
          <span>{validationError}</span>
        </div>
      )}

      {loading ? (
        <div className="p-4 text-center text-xs text-zinc-500">
          제조시설 목록 조회 중...
        </div>
      ) : loadError ? (
        <div className="p-3 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-900">
          ⚠️ {loadError}
        </div>
      ) : facilities.length === 0 ? (
        /* Empty State: Company has no registered manufacturing facilities */
        <div className="rounded-lg border border-dashed border-zinc-250 dark:border-zinc-800 p-6 text-center bg-zinc-50/50 dark:bg-zinc-900/30 space-y-2">
          <div className="mx-auto w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
            🏭
          </div>
          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
            등록된 제조시설이 없습니다.
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
            해당 회사의 '출고지 및 제조시설' 설정에서 제품을 생산하는 제조공장(영문 법인명, 주소, MoCRA/FEI 정보)을 먼저 등록해 주세요.
          </p>
          {manageOriginsUrl && (
            <Link
              href={manageOriginsUrl}
              className="inline-flex items-center gap-1 mt-1 rounded bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 transition-colors"
            >
              + 신규 제조시설 등록하러 가기
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* 1. Primary Facility Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
                <span>주 제조시설 (Primary Facility)</span>
                <span className="text-rose-500">*</span>
              </label>
              {!primaryFacilityId && defaultFacility && !readOnly && (
                <button
                  type="button"
                  onClick={() => handleSelectPrimary(defaultFacility.id)}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 cursor-pointer"
                >
                  기본 공장({defaultFacility.name}) 선택
                </button>
              )}
            </div>

            {primaryFacility && !isChangingPrimary ? (
              renderFacilityCard(primaryFacility, true)
            ) : (
              <div className="space-y-2">
                <select
                  value={primaryFacilityId || ""}
                  onChange={(e) => handleSelectPrimary(e.target.value || null)}
                  disabled={readOnly}
                  className="w-full rounded-md border border-zinc-250 bg-white p-2.5 text-xs outline-none focus:border-zinc-950 dark:border-zinc-750 dark:bg-zinc-950 dark:text-white cursor-pointer"
                >
                  <option value="">-- 주 제조시설을 선택하세요 --</option>
                  {availableForPrimary.map((fac) => (
                    <option key={fac.id} value={fac.id}>
                      {fac.facility_code ? `[${fac.facility_code}] ` : ""}
                      {fac.name} - {fac.manufacturer_legal_name_en} ({fac.city},{" "}
                      {getCountryDisplayLabel(fac.country, "ko")})
                      {fac.is_default_manufacturing ? " (★ 기본 공장)" : ""}
                    </option>
                  ))}
                </select>
                {isChangingPrimary && primaryFacility && (
                  <button
                    type="button"
                    onClick={() => setIsChangingPrimary(false)}
                    className="text-[10px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 font-semibold cursor-pointer"
                  >
                    취소 (기존 주 시설 유지)
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 2. Additional Facilities Section */}
          <div className="space-y-2 pt-2 border-t border-zinc-150 dark:border-zinc-850">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200">
                  추가 제조시설 (Additional Facilities - 선택)
                </label>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  동일 제품을 2개 이상의 공장에서 병행 생산하는 경우 추가 등록합니다.
                </p>
              </div>
              <span className="text-[10px] font-bold text-zinc-400 font-mono">
                {additionalFacilities.length}개 추가됨
              </span>
            </div>

            {/* Render Additional Facility Cards */}
            {additionalFacilities.length > 0 && (
              <div className="space-y-2">
                {additionalFacilities.map((fac) =>
                  renderFacilityCard(
                    fac,
                    false,
                    () => handleRemoveAdditional(fac.id),
                    () => handlePromoteToPrimary(fac.id)
                  )
                )}
              </div>
            )}

            {/* Add Selector for Additional Facilities */}
            {!readOnly && availableForAdditional.length > 0 && (
              <div className="pt-1">
                <select
                  value=""
                  onChange={(e) => handleAddAdditional(e.target.value)}
                  className="w-full rounded-md border border-dashed border-zinc-300 bg-zinc-50/50 p-2 text-xs text-zinc-600 outline-none hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-400 cursor-pointer"
                >
                  <option value="">+ 추가 제조시설 선택하여 추가하기...</option>
                  {availableForAdditional.map((fac) => (
                    <option key={fac.id} value={fac.id}>
                      {fac.facility_code ? `[${fac.facility_code}] ` : ""}
                      {fac.name} - {fac.manufacturer_legal_name_en} ({fac.city},{" "}
                      {getCountryDisplayLabel(fac.country, "ko")})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
