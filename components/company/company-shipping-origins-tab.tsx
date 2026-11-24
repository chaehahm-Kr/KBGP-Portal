"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  type CompanyShippingOrigin,
  type ShippingOriginInput,
  adminCreateShippingOrigin,
  adminUpdateShippingOrigin,
  adminDeleteShippingOrigin,
  adminSetDefaultShippingOrigin,
  adminSetDefaultManufacturingFacility,
  portalCreateShippingOrigin,
  portalUpdateShippingOrigin,
  portalDeleteShippingOrigin,
  portalSetDefaultShippingOrigin,
  portalSetDefaultManufacturingFacility,
} from "@/lib/company/shipping-origin-actions";
import { createWarehouse, type WarehousePayload } from "@/lib/warehouse/actions";
import { CountrySelect } from "@/components/shared/country-select";
import { getCountryDisplayLabel } from "@/lib/constants/countries";
import { InternationalPhoneInput } from "@/components/shared/international-phone-input";
import {
  isManufacturingCapableLocation,
  isShippingCapableLocation,
  type LocationType,
  type FeiIssuanceStatus,
  type MocraFacilityStatus,
  type OtcFacilityStatus,
  type ComplianceVerificationStatus,
  type ImportReadinessStatus,
  type ComplianceDocumentCategory,
  COMPLIANCE_DOCUMENT_CATEGORIES,
} from "@/lib/compliance/v1-types";
import {
  saveFacilityComplianceDeclarationAction,
  adminVerifyFacilityComplianceAction,
  getFacilityLinkedProductsAction,
} from "@/lib/compliance/v1-facility-actions";
import { isComplianceV1Enabled } from "@/lib/compliance/v1-feature-gate";

interface CompanyShippingOriginsTabProps {
  companyId: string;
  companyName?: string;
  initialOrigins: CompanyShippingOrigin[];
  mode: "admin" | "portal";
  canEdit?: boolean;
}

interface EvidenceDocumentItem {
  id: string;
  document_category: ComplianceDocumentCategory;
  file_name: string;
  mime_type: string;
  file_size: number;
  sha256?: string;
  download_url?: string | null;
  created_at: string;
}

export function CompanyShippingOriginsTab({
  companyId,
  initialOrigins = [],
  mode,
  canEdit = true,
}: CompanyShippingOriginsTabProps) {
  const [origins, setOrigins] = useState<CompanyShippingOrigin[]>(initialOrigins);
  const [isPending, startTransition] = useTransition();

  // Tab filter: ALL | SHIPPING | MANUFACTURING
  const [activeFilter, setActiveFilter] = useState<"ALL" | "SHIPPING" | "MANUFACTURING">("ALL");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrigin, setEditingOrigin] = useState<CompanyShippingOrigin | null>(null);

  // Form: Basic Location fields
  const [formLocationType, setFormLocationType] = useState<LocationType>("SHIPPING_ORIGIN");
  const [formName, setFormName] = useState("");
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formIsDefaultMfg, setFormIsDefaultMfg] = useState(false);
  const [formStatus, setFormStatus] = useState<"active" | "inactive">("active");
  const [formCountry, setFormCountry] = useState("South Korea");
  const [formAddress1, setFormAddress1] = useState("");
  const [formAddress2, setFormAddress2] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formState, setFormState] = useState("");
  const [formPostalCode, setFormPostalCode] = useState("");
  const [formContactName, setFormContactName] = useState("");
  const [formContactNameEn, setFormContactNameEn] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Form: Manufacturing specific fields
  const [formManufacturerLegalNameEn, setFormManufacturerLegalNameEn] = useState("");
  const [formManufacturerNameKo, setFormManufacturerNameKo] = useState("");

  // Form: Compliance Regulatory fields
  const [formFeiStatus, setFormFeiStatus] = useState<FeiIssuanceStatus>("NOT_ISSUED");
  const [formFeiNumber, setFormFeiNumber] = useState("");
  const [formMocraStatus, setFormMocraStatus] = useState<MocraFacilityStatus>("NOT_APPLICABLE");
  const [formMocraExemptionReason, setFormMocraExemptionReason] = useState("");
  const [formMocraRegDate, setFormMocraRegDate] = useState("");
  const [formMocraExpiryDate, setFormMocraExpiryDate] = useState("");
  const [formOtcStatus, setFormOtcStatus] = useState<OtcFacilityStatus>("NOT_APPLICABLE");
  const [formOtcNaReason, setFormOtcNaReason] = useState("");
  const [formOtcRegDate, setFormOtcRegDate] = useState("");
  const [formOtcExpiryDate, setFormOtcExpiryDate] = useState("");

  // Form: Admin Verification fields (Admin Mode only)
  const [formVerificationStatus, setFormVerificationStatus] = useState<ComplianceVerificationStatus>("UNREVIEWED");
  const [formImportReadinessStatus, setFormImportReadinessStatus] = useState<ImportReadinessStatus>("NOT_EVALUATED");
  const [formVerificationMethod, setFormVerificationMethod] = useState("");
  const [formVerificationBasis, setFormVerificationBasis] = useState("");
  const [formPublicReviewComment, setFormPublicReviewComment] = useState("");
  const [formPrivateAdminNote, setFormPrivateAdminNote] = useState("");

  // Evidence Documents in Modal
  const [evidenceDocs, setEvidenceDocs] = useState<EvidenceDocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<ComplianceDocumentCategory>("FEI_CONFIRMATION");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docUploadMsg, setDocUploadMsg] = useState("");

  const [formError, setFormError] = useState("");

  // Delete modal state
  const [deletingOrigin, setDeletingOrigin] = useState<CompanyShippingOrigin | null>(null);
  const [checkingLinkedProducts, setCheckingLinkedProducts] = useState(false);
  const [linkedProducts, setLinkedProducts] = useState<Array<{ id: string; sku: string; name_ko: string | null; name_en: string; is_primary: boolean }>>([]);

  // Warehouse registration modal state (Admin only)
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [targetOriginForWarehouse, setTargetOriginForWarehouse] = useState<CompanyShippingOrigin | null>(null);
  const [whFormCode, setWhFormCode] = useState("");
  const [whFormName, setWhFormName] = useState("");
  const [whFormType, setWhFormType] = useState<"partner" | "3pl" | "own" | "other">("partner");
  const [whFormIsDefaultReceiving, setWhFormIsDefaultReceiving] = useState(false);
  const [whFormAddress1, setWhFormAddress1] = useState("");
  const [whFormAddress2, setWhFormAddress2] = useState("");
  const [whFormCity, setWhFormCity] = useState("");
  const [whFormState, setWhFormState] = useState("");
  const [whFormZipCode, setWhFormZipCode] = useState("");
  const [whFormCountry, setWhFormCountry] = useState("South Korea");
  const [whFormInternalNote, setWhFormInternalNote] = useState("");
  const [whFormError, setWhFormError] = useState("");
  const [whFormSuccess, setWhFormSuccess] = useState("");

  // Sync state if initialOrigins changes
  useEffect(() => {
    setOrigins(initialOrigins);
  }, [initialOrigins]);

  // Load evidence documents when editing origin changes
  const loadDocuments = async (facilityId: string) => {
    setLoadingDocs(true);
    try {
      const res = await fetch(`/api/compliance/documents?target_type=FACILITY&target_id=${encodeURIComponent(facilityId)}`);
      const data = await res.json();
      if (res.ok && data.documents) {
        setEvidenceDocs(data.documents);
      } else {
        setEvidenceDocs([]);
      }
    } catch {
      setEvidenceDocs([]);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleUploadDocument = async () => {
    if (!uploadFile || !editingOrigin) return;
    setIsUploadingDoc(true);
    setDocUploadMsg("");
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("target_type", "FACILITY");
      fd.append("target_id", editingOrigin.id);
      fd.append("document_category", uploadCategory);

      const res = await fetch("/api/compliance/documents", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setDocUploadMsg(`업로드 실패: ${data.error || "알 수 없는 오류"}`);
      } else {
        setDocUploadMsg("✓ 증빙 서류가 성공적으로 업로드되었습니다.");
        setUploadFile(null);
        await loadDocuments(editingOrigin.id);
      }
    } catch (err: any) {
      setDocUploadMsg(`업로드 중 오류: ${err.message || "네트워크 오류"}`);
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const openAddModal = () => {
    setEditingOrigin(null);
    const defaultType: LocationType =
      activeFilter === "MANUFACTURING"
        ? "MANUFACTURING_FACILITY"
        : activeFilter === "SHIPPING"
        ? "SHIPPING_ORIGIN"
        : "SHIPPING_ORIGIN";
    setFormLocationType(defaultType);
    setFormName("");
    setFormIsDefault(origins.filter((o) => isShippingCapableLocation(o.location_type)).length === 0);
    setFormIsDefaultMfg(origins.filter((o) => isManufacturingCapableLocation(o.location_type)).length === 0);
    setFormStatus("active");
    setFormCountry("South Korea");
    setFormAddress1("");
    setFormAddress2("");
    setFormCity("");
    setFormState("");
    setFormPostalCode("");
    setFormContactName("");
    setFormContactNameEn("");
    setFormPhone("");
    setFormEmail("");
    setFormNotes("");
    setFormManufacturerLegalNameEn("");
    setFormManufacturerNameKo("");

    // Reset compliance fields
    setFormFeiStatus("NOT_ISSUED");
    setFormFeiNumber("");
    setFormMocraStatus("NOT_APPLICABLE");
    setFormMocraExemptionReason("");
    setFormMocraRegDate("");
    setFormMocraExpiryDate("");
    setFormOtcStatus("NOT_APPLICABLE");
    setFormOtcNaReason("");
    setFormOtcRegDate("");
    setFormOtcExpiryDate("");

    // Reset admin verification
    setFormVerificationStatus("UNREVIEWED");
    setFormImportReadinessStatus("NOT_EVALUATED");
    setFormVerificationMethod("");
    setFormVerificationBasis("");
    setFormPublicReviewComment("");
    setFormPrivateAdminNote("");

    setEvidenceDocs([]);
    setUploadFile(null);
    setDocUploadMsg("");
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (origin: CompanyShippingOrigin) => {
    setEditingOrigin(origin);
    setFormLocationType(origin.location_type || "SHIPPING_ORIGIN");
    setFormName(origin.name);
    setFormIsDefault(Boolean(origin.is_default));
    setFormIsDefaultMfg(Boolean(origin.is_default_manufacturing));
    setFormStatus(origin.status || "active");
    setFormCountry(origin.country || "South Korea");
    setFormAddress1(origin.address_line1 || "");
    setFormAddress2(origin.address_line2 || "");
    setFormCity(origin.city || "");
    setFormState(origin.state_province || "");
    setFormPostalCode(origin.postal_code || "");
    setFormContactName(origin.contact_name || "");
    setFormContactNameEn(origin.contact_name_en || "");
    setFormPhone(origin.phone || "");
    setFormEmail(origin.email || "");
    setFormNotes(origin.notes || "");
    setFormManufacturerLegalNameEn(origin.manufacturer_legal_name_en || "");
    setFormManufacturerNameKo(origin.manufacturer_name_ko || "");

    const comp = origin.compliance;
    setFormFeiStatus(comp?.fei_status || "NOT_ISSUED");
    setFormFeiNumber(comp?.fei_number || "");
    setFormMocraStatus(comp?.mocra_facility_status || "NOT_APPLICABLE");
    setFormMocraExemptionReason(comp?.mocra_exemption_reason || "");
    setFormMocraRegDate(comp?.mocra_registered_at ? comp.mocra_registered_at.slice(0, 10) : "");
    setFormMocraExpiryDate(comp?.mocra_next_renewal_date ? comp.mocra_next_renewal_date.slice(0, 10) : "");
    setFormOtcStatus(comp?.otc_facility_status || "NOT_APPLICABLE");
    setFormOtcNaReason(comp?.otc_na_reason || "");
    setFormOtcRegDate(comp?.otc_registered_at ? comp.otc_registered_at.slice(0, 10) : "");
    setFormOtcExpiryDate(comp?.otc_next_renewal_date ? comp.otc_next_renewal_date.slice(0, 10) : "");

    setFormVerificationStatus(comp?.verification_status || "UNREVIEWED");
    setFormImportReadinessStatus(comp?.import_readiness_status || "NOT_EVALUATED");
    setFormVerificationMethod(comp?.verification_method || "");
    setFormVerificationBasis(comp?.verification_basis || "");
    setFormPublicReviewComment(comp?.public_review_comment || "");
    setFormPrivateAdminNote("");

    setUploadFile(null);
    setDocUploadMsg("");
    setFormError("");
    setIsModalOpen(true);

    if (isManufacturingCapableLocation(origin.location_type)) {
      loadDocuments(origin.id);
    } else {
      setEvidenceDocs([]);
    }
  };

  const handleOpenDeleteModal = async (origin: CompanyShippingOrigin) => {
    setDeletingOrigin(origin);
    setLinkedProducts([]);
    if (isManufacturingCapableLocation(origin.location_type)) {
      setCheckingLinkedProducts(true);
      try {
        const res = await getFacilityLinkedProductsAction(origin.id);
        if (res.ok) {
          setLinkedProducts(res.products);
        }
      } catch {
        setLinkedProducts([]);
      } finally {
        setCheckingLinkedProducts(false);
      }
    }
  };

  const openWarehouseModal = (origin: CompanyShippingOrigin) => {
    setTargetOriginForWarehouse(origin);
    setWhFormCode("");
    setWhFormName(origin.name);
    setWhFormType("partner");
    setWhFormIsDefaultReceiving(false);
    setWhFormAddress1(origin.address_line1 || "");
    setWhFormAddress2(origin.address_line2 || "");
    setWhFormCity(origin.city || "");
    setWhFormState(origin.state_province || "");
    setWhFormZipCode(origin.postal_code || "");
    setWhFormCountry(origin.country || "South Korea");
    setWhFormInternalNote(`[출고지 연동] ${origin.name}`);
    setWhFormError("");
    setWhFormSuccess("");
    setIsWarehouseModalOpen(true);
  };

  const handleRegisterWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetOriginForWarehouse) return;
    setWhFormError("");
    setWhFormSuccess("");

    if (!whFormCode.trim()) {
      setWhFormError("물류창고 코드를 입력해주세요. (2~10자리 영대문자/숫자)");
      return;
    }
    if (!whFormName.trim()) {
      setWhFormError("물류창고 이름을 입력해주세요.");
      return;
    }
    if (!whFormAddress1.trim()) {
      setWhFormError("주소 1을 입력해주세요.");
      return;
    }
    if (!whFormCity.trim()) {
      setWhFormError("도시(City)를 입력해주세요.");
      return;
    }
    if (!whFormZipCode.trim()) {
      setWhFormError("우편번호(ZIP / Postal Code)를 입력해주세요.");
      return;
    }

    const payload: WarehousePayload = {
      name: whFormName.trim(),
      code: whFormCode.trim().toUpperCase(),
      company_id: whFormType === "own" ? null : companyId,
      type: whFormType,
      status: "active",
      is_default_receiving: whFormIsDefaultReceiving,
      address1: whFormAddress1.trim(),
      address2: whFormAddress2.trim() || undefined,
      city: whFormCity.trim(),
      state: whFormState.trim() || "N/A",
      zip_code: whFormZipCode.trim(),
      country: whFormCountry.trim(),
      internal_note: whFormInternalNote.trim() || undefined,
      shipping_origin_id: targetOriginForWarehouse.id,
    };

    startTransition(async () => {
      try {
        const res = await createWarehouse(payload);
        if (res.success && res.data) {
          setWhFormSuccess("물류창고가 성공적으로 등록 및 연동되었습니다.");
          setOrigins((prev) =>
            prev.map((o) => {
              if (o.id === targetOriginForWarehouse.id) {
                return {
                  ...o,
                  warehouse_id: res.data?.id,
                  warehouse_code: res.data?.code,
                  warehouse_name: res.data?.name,
                  warehouse_type: res.data?.type,
                };
              }
              return o;
            })
          );
          setTimeout(() => {
            setIsWarehouseModalOpen(false);
          }, 800);
        } else {
          setWhFormError(res.error || "물류창고 등록에 실패했습니다.");
        }
      } catch (err: any) {
        setWhFormError(err.message || "물류창고 등록 중 오류가 발생했습니다.");
      }
    });
  };

  const handleSaveOrigin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const isMfg = isManufacturingCapableLocation(formLocationType);
    const isShip = isShippingCapableLocation(formLocationType);

    if (!formName.trim()) {
      setFormError("명칭(장소 또는 공장명)을 입력해주세요.");
      return;
    }
    if (!formCountry.trim()) {
      setFormError("국가를 선택해주세요.");
      return;
    }
    if (!formAddress1.trim()) {
      setFormError("기본 주소(Address Line 1)를 입력해주세요.");
      return;
    }
    if (!formCity.trim()) {
      setFormError("도시(City)를 입력해주세요.");
      return;
    }
    if (!formPostalCode.trim()) {
      setFormError("우편번호(Postal / ZIP Code)를 입력해주세요.");
      return;
    }

    if (isMfg) {
      if (!formManufacturerLegalNameEn.trim()) {
        setFormError("제조시설 등록 시 제조사 정식 영문 법인명(Legal Manufacturer Name in EN)은 필수입니다.");
        return;
      }
      if (!formContactNameEn.trim() && !formContactName.trim()) {
        setFormError("제조시설 담당자명(영문)은 필수입니다.");
        return;
      }
      if (!formPhone.trim()) {
        setFormError("제조시설 연락처 전화번호는 필수입니다.");
        return;
      }
      if (!formEmail.trim()) {
        setFormError("제조시설 담당자 이메일은 필수입니다.");
        return;
      }
      if (formFeiStatus === "ISSUED" && !formFeiNumber.trim()) {
        setFormError("FEI 등록(ISSUED) 상태인 경우 FEI 번호(7~10자리) 입력이 필수입니다.");
        return;
      }
      if (formMocraStatus === "EXEMPT_SMALL_BUSINESS" && !formMocraExemptionReason.trim()) {
        setFormError("MoCRA 면제(EXEMPT_SMALL_BUSINESS) 상태인 경우 면제 사유 입력이 필수입니다.");
        return;
      }
      if (formOtcStatus === "NOT_APPLICABLE" && !formOtcNaReason.trim()) {
        setFormError("OTC 비해당(NOT_APPLICABLE) 상태인 경우 비해당 사유 입력이 필수입니다.");
        return;
      }
    }

    const payload: ShippingOriginInput = {
      name: formName.trim(),
      is_default: isShip ? formIsDefault : false,
      is_default_manufacturing: isMfg ? formIsDefaultMfg : false,
      location_type: formLocationType,
      status: formStatus,
      country: formCountry.trim(),
      address_line1: formAddress1.trim(),
      address_line2: formAddress2.trim() || undefined,
      city: formCity.trim(),
      state_province: formState.trim() || undefined,
      postal_code: formPostalCode.trim(),
      contact_name: (formContactName.trim() || formContactNameEn.trim()) || undefined,
      contact_name_en: formContactNameEn.trim() || undefined,
      phone: formPhone.trim() || undefined,
      email: formEmail.trim() || undefined,
      notes: formNotes.trim() || undefined,
      manufacturer_legal_name_en: formManufacturerLegalNameEn.trim() || null,
      manufacturer_name_ko: formManufacturerNameKo.trim() || null,
    };

    startTransition(async () => {
      try {
        let savedOrigin: CompanyShippingOrigin | null = null;
        if (editingOrigin) {
          // Update
          const res =
            mode === "admin"
              ? await adminUpdateShippingOrigin(editingOrigin.id, companyId, payload)
              : await portalUpdateShippingOrigin(editingOrigin.id, payload);

          if (!res.success || !res.data) {
            setFormError("출고지 및 제조시설 저장에 실패했습니다.");
            return;
          }
          savedOrigin = res.data;
        } else {
          // Create
          const res =
            mode === "admin"
              ? await adminCreateShippingOrigin(companyId, payload)
              : await portalCreateShippingOrigin(payload);

          if (!res.success || !res.data) {
            setFormError("출고지 및 제조시설 등록에 실패했습니다.");
            return;
          }
          savedOrigin = res.data;
        }

        // If manufacturing capable, save regulatory compliance declaration
        if (isMfg && savedOrigin) {
          const compRes = await saveFacilityComplianceDeclarationAction(savedOrigin.id, {
            fei_status: formFeiStatus,
            fei_number: formFeiStatus === "ISSUED" ? formFeiNumber.trim() : null,
            mocra_facility_status: formMocraStatus,
            mocra_exemption_reason: formMocraStatus === "EXEMPT_SMALL_BUSINESS" ? formMocraExemptionReason.trim() : null,
            mocra_registered_at: formMocraRegDate || null,
            mocra_next_renewal_date: formMocraExpiryDate || null,
            otc_facility_status: formOtcStatus,
            otc_na_reason: formOtcStatus === "NOT_APPLICABLE" ? formOtcNaReason.trim() : null,
            otc_registered_at: formOtcRegDate || null,
            otc_next_renewal_date: formOtcExpiryDate || null,
          });

          if (compRes.ok) {
            savedOrigin.compliance = compRes.compliance;
          }

          // If ADMIN mode, also update verification status if changed
          if (mode === "admin") {
            const verRes = await adminVerifyFacilityComplianceAction(savedOrigin.id, {
              verification_status: formVerificationStatus,
              import_readiness_status: formImportReadinessStatus,
              verification_method: formVerificationMethod.trim() || null,
              verification_basis: formVerificationBasis.trim() || null,
              public_review_comment: formPublicReviewComment.trim() || null,
              private_admin_note: formPrivateAdminNote.trim() || null,
            });
            if (verRes.ok) {
              savedOrigin.compliance = verRes.compliance;
            }
          }
        }

        // Update local origins state
        setOrigins((prev) => {
          let updated = editingOrigin
            ? prev.map((o) => (o.id === editingOrigin.id ? (savedOrigin as CompanyShippingOrigin) : o))
            : [...prev, savedOrigin as CompanyShippingOrigin];

          if (payload.is_default) {
            updated = updated.map((o) =>
              o.id === savedOrigin?.id ? o : { ...o, is_default: false }
            );
          }
          if (payload.is_default_manufacturing) {
            updated = updated.map((o) =>
              o.id === savedOrigin?.id ? o : { ...o, is_default_manufacturing: false }
            );
          }
          return updated.sort((a, b) => {
            if (b.is_default !== a.is_default) return b.is_default ? 1 : -1;
            if (b.is_default_manufacturing !== a.is_default_manufacturing)
              return b.is_default_manufacturing ? 1 : -1;
            return a.name.localeCompare(b.name);
          });
        });

        setIsModalOpen(false);
      } catch (err: any) {
        setFormError(err.message || "저장 중 예상치 못한 오류가 발생했습니다.");
      }
    });
  };

  const handleSetDefaultShipping = async (origin: CompanyShippingOrigin) => {
    if (origin.is_default) return;
    startTransition(async () => {
      try {
        if (mode === "admin") {
          await adminSetDefaultShippingOrigin(origin.id, companyId);
        } else {
          await portalSetDefaultShippingOrigin(origin.id);
        }
        setOrigins((prev) =>
          prev.map((o) => ({
            ...o,
            is_default: o.id === origin.id,
          }))
        );
      } catch (err: any) {
        alert(err.message || "기본 출고지 설정 실패");
      }
    });
  };

  const handleSetDefaultManufacturing = async (origin: CompanyShippingOrigin) => {
    if (origin.is_default_manufacturing) return;
    startTransition(async () => {
      try {
        if (mode === "admin") {
          await adminSetDefaultManufacturingFacility(origin.id, companyId);
        } else {
          await portalSetDefaultManufacturingFacility(origin.id);
        }
        setOrigins((prev) =>
          prev.map((o) => ({
            ...o,
            is_default_manufacturing: o.id === origin.id,
          }))
        );
      } catch (err: any) {
        alert(err.message || "기본 제조시설 설정 실패");
      }
    });
  };

  const handleDeactivateInstead = async () => {
    if (!deletingOrigin) return;
    startTransition(async () => {
      try {
        const payload: ShippingOriginInput = {
          name: deletingOrigin.name,
          country: deletingOrigin.country,
          address_line1: deletingOrigin.address_line1,
          address_line2: deletingOrigin.address_line2,
          city: deletingOrigin.city,
          state_province: deletingOrigin.state_province,
          postal_code: deletingOrigin.postal_code,
          location_type: deletingOrigin.location_type,
          status: "inactive",
          is_default: false,
          is_default_manufacturing: false,
          manufacturer_legal_name_en: deletingOrigin.manufacturer_legal_name_en,
          manufacturer_name_ko: deletingOrigin.manufacturer_name_ko,
          contact_name: deletingOrigin.contact_name,
          contact_name_en: deletingOrigin.contact_name_en,
          phone: deletingOrigin.phone,
          email: deletingOrigin.email,
        };
        const res =
          mode === "admin"
            ? await adminUpdateShippingOrigin(deletingOrigin.id, companyId, payload)
            : await portalUpdateShippingOrigin(deletingOrigin.id, payload);

        if (res.success && res.data) {
          setOrigins((prev) => prev.map((o) => (o.id === deletingOrigin.id ? res.data! : o)));
          setDeletingOrigin(null);
        } else {
          alert("상태 변경 실패");
        }
      } catch (err: any) {
        alert(err.message || "오류가 발생했습니다.");
      }
    });
  };

  const handleDelete = async () => {
    if (!deletingOrigin) return;
    startTransition(async () => {
      try {
        const res =
          mode === "admin"
            ? await adminDeleteShippingOrigin(deletingOrigin.id, companyId)
            : await portalDeleteShippingOrigin(deletingOrigin.id);

        if (res.success) {
          setOrigins((prev) => prev.filter((o) => o.id !== deletingOrigin.id));
          setDeletingOrigin(null);
        } else {
          alert("삭제에 실패했습니다.");
        }
      } catch (err: any) {
        alert(err.message || "삭제 실패");
      }
    });
  };

  // Filtered list
  const filteredOrigins = origins.filter((o) => {
    if (activeFilter === "SHIPPING") return isShippingCapableLocation(o.location_type);
    if (activeFilter === "MANUFACTURING") return isManufacturingCapableLocation(o.location_type);
    return true;
  });

  const shippingCount = origins.filter((o) => isShippingCapableLocation(o.location_type)).length;
  const mfgCount = origins.filter((o) => isManufacturingCapableLocation(o.location_type)).length;

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
              출고지 및 제조시설 (Shipping Origins & Manufacturing Facilities)
            </h3>
            <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-bold text-zinc-600 dark:text-zinc-300">
              {origins.length}개
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            공급사/브랜드사의 실제 제품 출고지(Ship From) 및 제조공장(Manufacturing Facility) 정보와 규제 준수(FEI, MoCRA, OTC) 현황을 관리합니다.
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 shadow-sm transition-colors cursor-pointer self-start sm:self-auto"
          >
            <span>+</span>
            <span>{isComplianceV1Enabled() ? "출고지 / 제조시설 추가" : "출고지 추가"}</span>
          </button>
        )}
      </div>

      {/* Filter Tabs (Enabled in Compliance V1) */}
      {isComplianceV1Enabled() && (
        <div className="flex items-center gap-2 border-b border-zinc-150 dark:border-zinc-850 pb-2">
          <button
            type="button"
            onClick={() => setActiveFilter("ALL")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeFilter === "ALL"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            전체 ({origins.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("SHIPPING")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeFilter === "SHIPPING"
                ? "bg-blue-600 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            출고지 ({shippingCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("MANUFACTURING")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeFilter === "MANUFACTURING"
                ? "bg-indigo-600 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            제조시설 ({mfgCount})
          </button>
        </div>
      )}

      {/* List of Locations */}
      {filteredOrigins.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-250 dark:border-zinc-800 p-8 text-center bg-zinc-50/50 dark:bg-zinc-900/30">
          <div className="mx-auto w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 mb-2">
            📍
          </div>
          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            {activeFilter === "MANUFACTURING"
              ? "등록된 제조시설이 없습니다."
              : activeFilter === "SHIPPING"
              ? "등록된 출고지가 없습니다."
              : "등록된 출고지 및 제조시설이 없습니다."}
          </p>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
            새로운 출고지 또는 제조시설을 추가하여 위치 주소와 MoCRA/FDA 규제 준수 정보를 등록하세요.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={openAddModal}
              className="mt-3 inline-flex items-center gap-1 rounded bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 cursor-pointer"
            >
              + 신규 등록하기
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredOrigins.map((origin) => {
            const isMfg = isManufacturingCapableLocation(origin.location_type);
            const isShip = isShippingCapableLocation(origin.location_type);
            const comp = origin.compliance;

            return (
              <div
                key={origin.id}
                className={`rounded-lg border p-4 shadow-sm transition-all flex flex-col justify-between ${
                  origin.is_default || origin.is_default_manufacturing
                    ? "border-emerald-300 bg-emerald-50/20 dark:border-emerald-900 dark:bg-emerald-950/10 ring-1 ring-emerald-400/30"
                    : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                }`}
              >
                <div className="space-y-3">
                  {/* Card Top Title & Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs font-bold text-zinc-950 dark:text-white">
                          {origin.name}
                        </h4>

                        {/* Location Type Badge */}
                        {origin.location_type === "SHIPPING_AND_MANUFACTURING" ? (
                          <span className="inline-flex items-center gap-1 rounded bg-teal-100 dark:bg-teal-950/60 px-2 py-0.5 text-[10px] font-bold text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                            출고지 + 제조시설 {origin.facility_code ? `[${origin.facility_code}]` : ""}
                          </span>
                        ) : isMfg ? (
                          <span className="inline-flex items-center gap-1 rounded bg-indigo-100 dark:bg-indigo-950/60 px-2 py-0.5 text-[10px] font-bold text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            🏭 제조시설 {origin.facility_code ? `[${origin.facility_code}]` : ""}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-blue-100 dark:bg-blue-950/60 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            📦 출고지
                          </span>
                        )}

                        {/* Default Badges */}
                        {origin.is_default && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            ✓ 기본 출고지
                          </span>
                        )}
                        {origin.is_default_manufacturing && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-purple-100 dark:bg-purple-900/60 px-1.5 py-0.5 text-[9px] font-bold text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            ★ 기본 제조시설
                          </span>
                        )}

                        {/* Status Badge */}
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold border ${
                            origin.status === "active"
                              ? "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                              : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900"
                          }`}
                        >
                          {origin.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </div>

                      {/* Manufacturer Legal Name (if mfg capable) */}
                      {isMfg && (origin.manufacturer_legal_name_en || origin.manufacturer_name_ko) && (
                        <div className="text-[11px] text-zinc-700 dark:text-zinc-300">
                          <span className="font-semibold text-zinc-900 dark:text-white">
                            {origin.manufacturer_legal_name_en}
                          </span>
                          {origin.manufacturer_name_ko && (
                            <span className="text-zinc-500 text-[10px] ml-1.5">
                              ({origin.manufacturer_name_ko})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Address Information */}
                  <div className="rounded-md bg-zinc-50 dark:bg-zinc-950/40 p-2.5 border border-zinc-150 dark:border-zinc-850 text-xs space-y-1">
                    <div className="text-[11px] text-zinc-850 dark:text-zinc-200 font-medium">
                      {origin.address_line1}
                      {origin.address_line2 ? ` ${origin.address_line2}` : ""}
                    </div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 flex-wrap font-mono">
                      <span>{origin.city}</span>
                      {origin.state_province && <span>, {origin.state_province}</span>}
                      <span className="font-bold">({origin.postal_code})</span>
                      <span className="text-zinc-300 dark:text-zinc-700">|</span>
                      <span className="font-sans font-semibold text-zinc-700 dark:text-zinc-300">
                        {getCountryDisplayLabel(origin.country, "ko")}
                      </span>
                    </div>
                  </div>

                  {/* Contact Information */}
                  {(origin.contact_name || origin.contact_name_en || origin.phone || origin.email) && (
                    <div className="text-[11px] space-y-0.5 text-zinc-600 dark:text-zinc-400 pt-0.5">
                      {(origin.contact_name || origin.contact_name_en) && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 w-16">
                            담당자
                          </span>
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {origin.contact_name_en || origin.contact_name}
                            {origin.contact_name_en && origin.contact_name && origin.contact_name_en !== origin.contact_name && (
                              <span className="text-zinc-400 ml-1 font-normal">({origin.contact_name})</span>
                            )}
                          </span>
                        </div>
                      )}
                      {origin.phone && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 w-16">
                            전화번호
                          </span>
                          <span className="font-mono text-zinc-800 dark:text-zinc-200">
                            {origin.phone}
                          </span>
                        </div>
                      )}
                      {origin.email && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 w-16">
                            이메일
                          </span>
                          <span className="font-mono text-zinc-800 dark:text-zinc-200">
                            {origin.email}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Manufacturing Compliance Regulatory Summary */}
                  {isMfg && (
                    <div className="rounded-md border border-indigo-150 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 p-2.5 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1">
                          <span>🛡️</span> 규제 준수 현황
                        </span>
                        {/* KSELECT Verification Status Badge */}
                        {comp && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                              comp.verification_status === "VERIFIED"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                                : comp.verification_status === "UNDER_REVIEW"
                                ? "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                                : comp.verification_status === "RE_REVIEW_REQUIRED"
                                ? "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800"
                                : comp.verification_status === "REJECTED"
                                ? "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800"
                                : comp.verification_status === "NEEDS_INFO"
                                ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
                                : "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                            }`}
                          >
                            KSELECT: {comp.verification_status}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-1 text-[10px]">
                        <div className="bg-white/80 dark:bg-zinc-900/80 p-1 rounded border border-indigo-100 dark:border-indigo-900">
                          <span className="block text-zinc-400 font-medium">FEI</span>
                          <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                            {comp?.fei_status === "ISSUED" ? comp.fei_number || "등록됨" : comp?.fei_status || "미등록"}
                          </span>
                        </div>
                        <div className="bg-white/80 dark:bg-zinc-900/80 p-1 rounded border border-indigo-100 dark:border-indigo-900">
                          <span className="block text-zinc-400 font-medium">MoCRA</span>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                            {comp?.mocra_facility_status || "미등록"}
                          </span>
                        </div>
                        <div className="bg-white/80 dark:bg-zinc-900/80 p-1 rounded border border-indigo-100 dark:border-indigo-900">
                          <span className="block text-zinc-400 font-medium">OTC</span>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                            {comp?.otc_facility_status || "비해당"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {origin.notes && (
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 bg-amber-50/50 dark:bg-amber-950/20 p-2 rounded border border-amber-200/60 dark:border-amber-900/40 whitespace-pre-wrap">
                      <span className="font-bold text-amber-800 dark:text-amber-400 block mb-0.5">
                        메모:
                      </span>
                      {origin.notes}
                    </div>
                  )}

                  {/* Warehouse Integration (Only for Shipping Capable) */}
                  {isShip && (
                    <div className="rounded-md border border-zinc-150 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/30 p-2 text-xs">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                            물류창고 연동:
                          </span>
                          {origin.warehouse_id ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              <span>✓</span> {origin.warehouse_code} · {origin.warehouse_name}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                              <span>●</span> Warehouse 미연결
                            </span>
                          )}
                        </div>

                        {mode === "admin" && (
                          <div>
                            {origin.warehouse_id ? (
                              <Link
                                href="/admin/settings/warehouses"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                              >
                                <span>창고 보기</span>
                                <span>→</span>
                              </Link>
                            ) : (
                              canEdit && (
                                <button
                                  type="button"
                                  onClick={() => openWarehouseModal(origin)}
                                  disabled={isPending}
                                  className="inline-flex items-center gap-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 text-[10px] font-bold transition-colors cursor-pointer"
                                >
                                  <span>🏢</span>
                                  <span>창고 등록</span>
                                </button>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Action Footer */}
                {canEdit && (
                  <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-3">
                      {/* Set Default Shipping button */}
                      {isShip && !origin.is_default && (
                        <button
                          type="button"
                          onClick={() => handleSetDefaultShipping(origin)}
                          disabled={isPending}
                          className="text-[10px] font-bold text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          기본 출고지로 설정
                        </button>
                      )}
                      {/* Set Default Manufacturing button */}
                      {isMfg && !origin.is_default_manufacturing && (
                        <button
                          type="button"
                          onClick={() => handleSetDefaultManufacturing(origin)}
                          disabled={isPending}
                          className="text-[10px] font-bold text-zinc-600 hover:text-purple-600 dark:text-zinc-400 dark:hover:text-purple-400 cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          기본 제조시설로 설정
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditModal(origin)}
                        disabled={isPending}
                        className="rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenDeleteModal(origin)}
                        disabled={isPending}
                        className="rounded border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/30 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors cursor-pointer"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                  {editingOrigin ? "출고지 및 제조시설 정보 수정" : "신규 출고지 / 제조시설 등록"}
                </h3>
                {editingOrigin?.facility_code && (
                  <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                    제조시설 고유 코드: <span className="font-bold text-zinc-800 dark:text-zinc-200">{editingOrigin.facility_code}</span> (불변)
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-md bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveOrigin} className="space-y-4 text-xs">
              {/* Location Type Selection (Compliance V1 feature-gated) */}
              {isComplianceV1Enabled() && (
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    장소 유형 (Location Type) <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label
                      className={`flex flex-col p-2.5 rounded-lg border cursor-pointer transition-all ${
                        formLocationType === "SHIPPING_ORIGIN"
                          ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-500"
                          : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="location_type"
                        value="SHIPPING_ORIGIN"
                        checked={formLocationType === "SHIPPING_ORIGIN"}
                        onChange={() => setFormLocationType("SHIPPING_ORIGIN")}
                        className="sr-only"
                      />
                      <span className="font-bold text-xs text-zinc-900 dark:text-white">출고지 (Shipping)</span>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">제품 보관 및 출고 전용</span>
                    </label>

                    <label
                      className={`flex flex-col p-2.5 rounded-lg border cursor-pointer transition-all ${
                        formLocationType === "MANUFACTURING_FACILITY"
                          ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-500"
                          : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="location_type"
                        value="MANUFACTURING_FACILITY"
                        checked={formLocationType === "MANUFACTURING_FACILITY"}
                        onChange={() => setFormLocationType("MANUFACTURING_FACILITY")}
                        className="sr-only"
                      />
                      <span className="font-bold text-xs text-zinc-900 dark:text-white">제조시설 (Manufacturing)</span>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">제품 생산 전용 (MoCRA/FDA)</span>
                    </label>

                    <label
                      className={`flex flex-col p-2.5 rounded-lg border cursor-pointer transition-all ${
                        formLocationType === "SHIPPING_AND_MANUFACTURING"
                          ? "border-teal-500 bg-teal-50/50 dark:bg-teal-950/30 ring-1 ring-teal-500"
                          : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="location_type"
                        value="SHIPPING_AND_MANUFACTURING"
                        checked={formLocationType === "SHIPPING_AND_MANUFACTURING"}
                        onChange={() => setFormLocationType("SHIPPING_AND_MANUFACTURING")}
                        className="sr-only"
                      />
                      <span className="font-bold text-xs text-zinc-900 dark:text-white">출고지 겸 제조시설 (Both)</span>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">생산 후 직접 출고하는 시설</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Manufacturing Legal Name Section (Only when manufacturing capable) */}
              {isComplianceV1Enabled() && isManufacturingCapableLocation(formLocationType) && (
                <div className="p-3 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-lg border border-indigo-150 dark:border-indigo-900/60 space-y-3">
                  <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-300 block">
                    제조사 법인명 (MoCRA / FDA 등록 일치 정보)
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        정식 영문 법인 제조사명 <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formManufacturerLegalNameEn}
                        onChange={(e) => setFormManufacturerLegalNameEn(e.target.value)}
                        placeholder="예: Cosmax Inc., Kolmar Korea Co., Ltd."
                        required
                        className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white font-mono"
                      />
                      <span className="text-[9px] text-zinc-400 mt-0.5 block">MoCRA / FDA 서류와 완전히 동일한 영문명</span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        국문 제조사명 (선택)
                      </label>
                      <input
                        type="text"
                        value={formManufacturerNameKo}
                        onChange={(e) => setFormManufacturerNameKo(e.target.value)}
                        placeholder="예: 코스맥스(주), 한국콜마(주)"
                        className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Basic Fields: Name, Country, Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    명칭(장소 또는 공장명) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="예: 평택 제1공장, 오산 물류센터"
                    required
                    className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    국가 <span className="text-rose-500">*</span>
                  </label>
                  <CountrySelect
                    value={formCountry}
                    onChange={(val) => setFormCountry(val)}
                    placeholder="국가 선택"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    상태
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white cursor-pointer"
                  >
                    <option value="active">Active (사용중)</option>
                    <option value="inactive">Inactive (미사용)</option>
                  </select>
                </div>
              </div>

              {/* Default Settings Checkboxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {isShippingCapableLocation(formLocationType) && (
                  <div className="p-2.5 bg-zinc-50 dark:bg-zinc-950/40 rounded-lg border border-zinc-150 dark:border-zinc-850">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsDefault}
                        onChange={(e) => setFormIsDefault(e.target.checked)}
                        className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                      />
                      <div>
                        <span className="text-xs font-bold text-zinc-900 dark:text-white">기본 출고지로 지정</span>
                        <p className="text-[10px] text-zinc-400">발주/배송 시 기본 선택됩니다.</p>
                      </div>
                    </label>
                  </div>
                )}

                {isManufacturingCapableLocation(formLocationType) && (
                  <div className="p-2.5 bg-indigo-50/30 dark:bg-indigo-950/30 rounded-lg border border-indigo-150 dark:border-indigo-900/60">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsDefaultMfg}
                        onChange={(e) => setFormIsDefaultMfg(e.target.checked)}
                        className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <div>
                        <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200">기본 제조시설로 지정</span>
                        <p className="text-[10px] text-indigo-500 dark:text-indigo-400">신규 상품 등록 시 우선 추천됩니다.</p>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              {/* Address Fields */}
              <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                  시설 주소 (Address)
                </span>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    기본 주소 (Address Line 1) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formAddress1}
                    onChange={(e) => setFormAddress1(e.target.value)}
                    placeholder="도로명 주소 또는 공장 기본 주소"
                    required
                    className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    상세 주소 (Address Line 2, 선택)
                  </label>
                  <input
                    type="text"
                    value={formAddress2}
                    onChange={(e) => setFormAddress2(e.target.value)}
                    placeholder="동/호수, 층수, 공장동 등 상세 주소"
                    className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      도시 (City) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formCity}
                      onChange={(e) => setFormCity(e.target.value)}
                      placeholder="예: 평택시, 서울특별시"
                      required
                      className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      주 / 도 (State / Prov)
                    </label>
                    <input
                      type="text"
                      value={formState}
                      onChange={(e) => setFormState(e.target.value)}
                      placeholder="예: 경기도, CA"
                      className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      우편번호 (ZIP Code) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formPostalCode}
                      onChange={(e) => setFormPostalCode(e.target.value)}
                      placeholder="우편번호"
                      required
                      className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Fields */}
              <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                  담당자 및 연락처 (Contact Information)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {isManufacturingCapableLocation(formLocationType) && (
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        영문 담당자명 (Contact Name EN) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formContactNameEn}
                        onChange={(e) => setFormContactNameEn(e.target.value)}
                        placeholder="예: Gildong Hong, John Doe"
                        required={isManufacturingCapableLocation(formLocationType)}
                        className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white font-mono"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      국문 담당자명 (선택)
                    </label>
                    <input
                      type="text"
                      value={formContactName}
                      onChange={(e) => setFormContactName(e.target.value)}
                      placeholder="예: 홍길동"
                      className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      이메일 {isManufacturingCapableLocation(formLocationType) && <span className="text-rose-500">*</span>}
                    </label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="compliance@factory.com"
                      required={isManufacturingCapableLocation(formLocationType)}
                      className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      전화번호 {isManufacturingCapableLocation(formLocationType) && <span className="text-rose-500">*</span>}
                    </label>
                    <InternationalPhoneInput
                      value={formPhone}
                      onChange={(val) => setFormPhone(val)}
                      placeholder="전화번호 입력"
                    />
                  </div>
                </div>
              </div>

              {/* Manufacturing Compliance Regulatory Details Section (Compliance V1 feature-gated) */}
              {isComplianceV1Enabled() && isManufacturingCapableLocation(formLocationType) && (
                <div className="space-y-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider block">
                      🛡️ 제조시설 규제 정보 (FDA / MoCRA / OTC)
                    </span>
                    <span className="text-[10px] text-zinc-400">브랜드 선언 정보</span>
                  </div>

                  {/* FEI Section */}
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-950/40 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                          FEI (FDA Establishment Identifier) 상태
                        </label>
                        <select
                          value={formFeiStatus}
                          onChange={(e) => setFormFeiStatus(e.target.value as any)}
                          className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white cursor-pointer"
                        >
                          <option value="NOT_ISSUED">NOT_ISSUED (미발급)</option>
                          <option value="IN_PROGRESS">IN_PROGRESS (발급 신청/대기)</option>
                          <option value="ISSUED">ISSUED (발급 완료)</option>
                          <option value="UNKNOWN">UNKNOWN (확인 필요)</option>
                        </select>
                      </div>

                      {formFeiStatus === "ISSUED" && (
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                            FEI 번호 (7~10자리 숫자) <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formFeiNumber}
                            onChange={(e) => setFormFeiNumber(e.target.value)}
                            placeholder="예: 3001234567"
                            required
                            className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white font-mono"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* MoCRA Section */}
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-950/40 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                          MoCRA 제조시설 등록 상태
                        </label>
                        <select
                          value={formMocraStatus}
                          onChange={(e) => setFormMocraStatus(e.target.value as any)}
                          className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white cursor-pointer"
                        >
                          <option value="NOT_APPLICABLE">NOT_APPLICABLE (비해당)</option>
                          <option value="EXEMPT_SMALL_BUSINESS">EXEMPT_SMALL_BUSINESS (소기업 면제)</option>
                          <option value="NOT_STARTED">NOT_STARTED (미착수)</option>
                          <option value="IN_PROGRESS">IN_PROGRESS (접수 대기)</option>
                          <option value="REGISTERED">REGISTERED (등록 완료)</option>
                          <option value="UNKNOWN">UNKNOWN (확인 필요)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                          등록일 (선택)
                        </label>
                        <input
                          type="date"
                          value={formMocraRegDate}
                          onChange={(e) => setFormMocraRegDate(e.target.value)}
                          className="w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                          갱신 만료일 (선택)
                        </label>
                        <input
                          type="date"
                          value={formMocraExpiryDate}
                          onChange={(e) => setFormMocraExpiryDate(e.target.value)}
                          className="w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                        />
                      </div>
                    </div>

                    {formMocraStatus === "EXEMPT_SMALL_BUSINESS" && (
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                          MoCRA 면제 사유 <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formMocraExemptionReason}
                          onChange={(e) => setFormMocraExemptionReason(e.target.value)}
                          placeholder="예: Small business exemption under MoCRA sec. 607"
                          required
                          className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                        />
                      </div>
                    )}
                  </div>

                  {/* OTC Section */}
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-950/40 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                          OTC 시설 등록 상태
                        </label>
                        <select
                          value={formOtcStatus}
                          onChange={(e) => setFormOtcStatus(e.target.value as any)}
                          className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white cursor-pointer"
                        >
                          <option value="NOT_APPLICABLE">NOT_APPLICABLE (비해당 화장품)</option>
                          <option value="NOT_STARTED">NOT_STARTED (미착수)</option>
                          <option value="IN_PROGRESS">IN_PROGRESS (신청 대기)</option>
                          <option value="REGISTERED">REGISTERED (등록 완료)</option>
                          <option value="UNKNOWN">UNKNOWN (확인 필요)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                          등록일 (선택)
                        </label>
                        <input
                          type="date"
                          value={formOtcRegDate}
                          onChange={(e) => setFormOtcRegDate(e.target.value)}
                          className="w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                          만료일 (선택)
                        </label>
                        <input
                          type="date"
                          value={formOtcExpiryDate}
                          onChange={(e) => setFormOtcExpiryDate(e.target.value)}
                          className="w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                        />
                      </div>
                    </div>

                    {formOtcStatus === "NOT_APPLICABLE" && (
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                          OTC 비해당 사유 <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formOtcNaReason}
                          onChange={(e) => setFormOtcNaReason(e.target.value)}
                          placeholder="예: 일반 화장품 제조시설로 OTC 의약외품 비생산"
                          required
                          className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                        />
                      </div>
                    )}
                  </div>

                  {/* Evidence Documents Section (Only when editing existing facility) */}
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-950/40 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-2">
                    <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 block">
                      📁 인허가 및 등록 증빙 서류 (Evidence Documents)
                    </span>

                    {editingOrigin ? (
                      <div className="space-y-2">
                        {loadingDocs ? (
                          <p className="text-[10px] text-zinc-400">서류 목록 조회 중...</p>
                        ) : evidenceDocs.length === 0 ? (
                          <p className="text-[10px] text-zinc-500">등록된 증빙 서류가 없습니다.</p>
                        ) : (
                          <div className="space-y-1">
                            {evidenceDocs.map((doc) => (
                              <div
                                key={doc.id}
                                className="flex items-center justify-between p-2 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs"
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                      {doc.file_name}
                                    </span>
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300">
                                      {doc.document_category}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-zinc-400">
                                    {(doc.file_size / 1024).toFixed(1)} KB · {doc.created_at?.slice(0, 10)}
                                  </span>
                                </div>
                                {doc.download_url && (
                                  <a
                                    href={doc.download_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2 py-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 text-[10px] font-bold transition-colors"
                                  >
                                    다운로드 / 보기
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* File Upload Box */}
                        <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                          <div>
                            <label className="block text-[9px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                              서류 분류
                            </label>
                            <select
                              value={uploadCategory}
                              onChange={(e) => setUploadCategory(e.target.value as any)}
                              className="w-full rounded border border-zinc-200 p-1.5 text-[11px] outline-none bg-white dark:border-zinc-800 dark:bg-zinc-950 cursor-pointer"
                            >
                              {COMPLIANCE_DOCUMENT_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                              파일 선택 (PDF, JPG, PNG)
                            </label>
                            <input
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.docx"
                              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                              className="w-full text-[10px] file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 cursor-pointer"
                            />
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={handleUploadDocument}
                              disabled={!uploadFile || isUploadingDoc}
                              className="w-full rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 text-xs disabled:opacity-50 transition-colors cursor-pointer"
                            >
                              {isUploadingDoc ? "업로드 중..." : "서류 업로드"}
                            </button>
                          </div>
                        </div>
                        {docUploadMsg && (
                          <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1">
                            {docUploadMsg}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] text-zinc-500">
                        시설 정보 등록을 먼저 완료한 후, 수정 화면에서 인허가 증빙 서류를 업로드할 수 있습니다.
                      </p>
                    )}
                  </div>

                  {/* KSELECT Admin Verification Section (Mode === 'admin' vs 'portal') */}
                  {mode === "admin" ? (
                    <div className="p-3 bg-amber-50/40 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-amber-900 dark:text-amber-300 block">
                          🔒 KSELECT 어드민 전용 검증 (Admin Verification)
                        </span>
                        <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400">관리자 전용</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                            검증 상태 (Verification Status)
                          </label>
                          <select
                            value={formVerificationStatus}
                            onChange={(e) => setFormVerificationStatus(e.target.value as any)}
                            className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white cursor-pointer"
                          >
                            <option value="UNREVIEWED">UNREVIEWED (미검토)</option>
                            <option value="UNDER_REVIEW">UNDER_REVIEW (검토 중)</option>
                            <option value="VERIFIED">VERIFIED (검증 완료)</option>
                            <option value="NEEDS_INFO">NEEDS_INFO (정보 요청)</option>
                            <option value="RE_REVIEW_REQUIRED">RE_REVIEW_REQUIRED (재검토 필요)</option>
                            <option value="VALIDITY_REVIEW_REQUIRED">VALIDITY_REVIEW_REQUIRED (유효성 검토 필요)</option>
                            <option value="REJECTED">REJECTED (반려)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                            수입 준비 상태 (Import Readiness)
                          </label>
                          <select
                            value={formImportReadinessStatus}
                            onChange={(e) => setFormImportReadinessStatus(e.target.value as any)}
                            className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white cursor-pointer"
                          >
                            <option value="NOT_EVALUATED">NOT_EVALUATED (미평가)</option>
                            <option value="READY">READY (수입 가능)</option>
                            <option value="CONDITIONAL">CONDITIONAL (조건부 수입 가능)</option>
                            <option value="BLOCKED">BLOCKED (수입 차단)</option>
                            <option value="EXEMPT">EXEMPT (면제)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                            검증 방법 (Verification Method)
                          </label>
                          <input
                            type="text"
                            value={formVerificationMethod}
                            onChange={(e) => setFormVerificationMethod(e.target.value)}
                            placeholder="예: FDA FEI Portal 조회, MoCRA 등록증 사본 대조"
                            className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                            검증 근거 (Verification Basis)
                          </label>
                          <input
                            type="text"
                            value={formVerificationBasis}
                            onChange={(e) => setFormVerificationBasis(e.target.value)}
                            placeholder="예: FDA FEI Database 2026-11-20 일치 확인"
                            className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                            브랜드 공개 피드백 (Public Review Comment)
                          </label>
                          <input
                            type="text"
                            value={formPublicReviewComment}
                            onChange={(e) => setFormPublicReviewComment(e.target.value)}
                            placeholder="브랜드 포털에 노출되는 검증 의견 / 보완 요청 안내"
                            className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                            어드민 내부 메모 (Private Note - 브랜드 비공개)
                          </label>
                          <textarea
                            value={formPrivateAdminNote}
                            onChange={(e) => setFormPrivateAdminNote(e.target.value)}
                            placeholder="어드민 내부 검토 기록 및 심사자 메모"
                            rows={2}
                            className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-950/40 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-1">
                      <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 block">
                        🛡️ KSELECT 검증 상태
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          {editingOrigin?.compliance?.verification_status || "UNREVIEWED"}
                        </span>
                        {editingOrigin?.compliance?.public_review_comment && (
                          <span className="text-[11px] text-zinc-500">
                            - {editingOrigin.compliance.public_review_comment}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-400">
                        KSELECT 규제 검증팀에서 제출된 인허가 서류를 대조 검토 후 검증 상태를 업데이트합니다.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  메모 / 비고 (선택)
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="출입 유의사항 또는 시설 관련 자유 메모"
                  rows={2}
                  className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white resize-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isPending}
                  className="rounded px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded bg-zinc-900 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? "저장 중..." : editingOrigin ? "수정 완료" : "등록 완료"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal with Linked Product & Warehouse Guard */}
      {deletingOrigin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <h4 className="text-sm font-bold text-zinc-950 dark:text-white mb-2">
              출고지 / 제조시설 삭제 확인
            </h4>

            {checkingLinkedProducts ? (
              <div className="p-4 text-center text-xs text-zinc-500">
                연결된 상품 및 물류창고 관계 확인 중...
              </div>
            ) : linkedProducts.length > 0 ? (
              <div className="space-y-3">
                <div className="rounded-md bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                  ⚠️ 이 제조시설은 현재 {linkedProducts.length}개 상품의 제조시설로 등록되어 있어 삭제할 수 없습니다.
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1 rounded border border-zinc-200 dark:border-zinc-800 p-2 text-xs">
                  <p className="text-[10px] font-bold text-zinc-400">연결된 상품 목록:</p>
                  {linkedProducts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-0.5">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        {p.name_ko || p.name_en}
                      </span>
                      <span className="font-mono text-[10px] text-zinc-400">
                        {p.sku} {p.is_primary ? "(기본)" : ""}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  삭제 대신 시설의 상태를 <span className="font-bold text-zinc-900 dark:text-white">'Inactive (미사용)'</span>으로 전환하면 기존 상품의 이력과 규제 데이터가 보존됩니다.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeletingOrigin(null)}
                    className="rounded px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleDeactivateInstead}
                    disabled={isPending}
                    className="rounded bg-amber-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
                  >
                    {isPending ? "처리 중..." : "Inactive로 전환"}
                  </button>
                </div>
              </div>
            ) : deletingOrigin.warehouse_id ? (
              <div className="space-y-3">
                <div className="rounded-md bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                  ⚠️ 해당 출고지는 물류창고(
                  <span className="font-bold font-mono">
                    {deletingOrigin.warehouse_code || "연동됨"}
                  </span>
                  {deletingOrigin.warehouse_name ? ` · ${deletingOrigin.warehouse_name}` : ""}
                  )와 연동되어 있어 삭제할 수 없습니다.
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  물류창고 설정에서 연동된 물류창고를 먼저 삭제하거나 연동을 해제한 후 출고지를 삭제해주세요.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeletingOrigin(null)}
                    className="rounded bg-zinc-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 cursor-pointer"
                  >
                    확인
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                  <span className="font-bold text-zinc-900 dark:text-white">
                    "{deletingOrigin.name}"
                  </span>{" "}
                  {isManufacturingCapableLocation(deletingOrigin.location_type) ? "제조시설을" : "출고지를"} 정말 삭제하시겠습니까?
                  {(deletingOrigin.is_default || deletingOrigin.is_default_manufacturing) && (
                    <span className="block mt-1 text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                      ⚠️ 이 장소는 현재 기본 출고지 또는 기본 제조시설로 지정되어 있습니다.
                    </span>
                  )}
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDeletingOrigin(null)}
                    disabled={isPending}
                    className="rounded px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isPending}
                    className="rounded bg-rose-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                  >
                    {isPending ? "삭제 중..." : "삭제"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Warehouse Registration Modal (Admin Only) */}
      {isWarehouseModalOpen && targetOriginForWarehouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
                  <span>🏢</span>
                  <span>출고지 기반 물류창고 등록</span>
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  선택한 출고지 정보가 자동으로 입력되며, 관리자 Warehouse Master에 새 물류창고로 연동 등록됩니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsWarehouseModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            {whFormError && (
              <div className="mb-4 rounded-md bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                ⚠️ {whFormError}
              </div>
            )}
            {whFormSuccess && (
              <div className="mb-4 rounded-md bg-emerald-50 p-3 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                ✓ {whFormSuccess}
              </div>
            )}

            <form onSubmit={handleRegisterWarehouse} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    창고 코드 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={whFormCode}
                    onChange={(e) => setWhFormCode(e.target.value.toUpperCase())}
                    placeholder="예: WHS-KR1"
                    required
                    disabled={isPending}
                    className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white font-mono uppercase focus:border-zinc-900 dark:focus:border-white"
                  />
                  <span className="text-[10px] text-zinc-400 mt-0.5 block">2~10자리 영대문자/숫자 고유값</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    창고 유형 <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={whFormType}
                    onChange={(e) => setWhFormType(e.target.value as any)}
                    disabled={isPending}
                    className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white cursor-pointer"
                  >
                    <option value="partner">파트너 창고 (Partner)</option>
                    <option value="3pl">3PL 물류 창고 (3PL)</option>
                    <option value="own">자사 창고 (Own)</option>
                    <option value="other">기타 (Other)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  창고명 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={whFormName}
                  onChange={(e) => setWhFormName(e.target.value)}
                  placeholder="물류창고 이름"
                  required
                  disabled={isPending}
                  className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-900 dark:focus:border-white"
                />
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-950/40 rounded-lg border border-zinc-150 dark:border-zinc-850">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={whFormIsDefaultReceiving}
                    onChange={(e) => setWhFormIsDefaultReceiving(e.target.checked)}
                    disabled={isPending}
                    className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-zinc-900 dark:text-white">
                      기본 입고 창고로 지정
                    </span>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      회사 또는 자사별로 하나의 기본 입고지만 지정할 수 있습니다.
                    </p>
                  </div>
                </label>
              </div>

              <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                  창고 위치 주소 (Address)
                </span>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    기본 주소 (Street Address 1) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={whFormAddress1}
                    onChange={(e) => setWhFormAddress1(e.target.value)}
                    required
                    disabled={isPending}
                    className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    상세 주소 (Street Address 2 - 선택)
                  </label>
                  <input
                    type="text"
                    value={whFormAddress2}
                    onChange={(e) => setWhFormAddress2(e.target.value)}
                    disabled={isPending}
                    className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      도시 (City) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={whFormCity}
                      onChange={(e) => setWhFormCity(e.target.value)}
                      required
                      disabled={isPending}
                      className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      주 / 도 (State)
                    </label>
                    <input
                      type="text"
                      value={whFormState}
                      onChange={(e) => setWhFormState(e.target.value)}
                      disabled={isPending}
                      className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      우편번호 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={whFormZipCode}
                      onChange={(e) => setWhFormZipCode(e.target.value)}
                      required
                      disabled={isPending}
                      className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    국가 (Country) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={whFormCountry}
                    onChange={(e) => setWhFormCountry(e.target.value)}
                    required
                    disabled={isPending}
                    className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  내부 메모 (Internal Note)
                </label>
                <textarea
                  value={whFormInternalNote}
                  onChange={(e) => setWhFormInternalNote(e.target.value)}
                  rows={2}
                  disabled={isPending}
                  className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white resize-none"
                />
              </div>

              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsWarehouseModalOpen(false)}
                  disabled={isPending}
                  className="rounded px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? "등록 중..." : "물류창고 등록 완료"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
