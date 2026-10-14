"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  Retailer360Data,
  Retailer360OrderItem,
  Retailer360StoreItem,
} from "@/lib/retailer/admin-retailer-360";
import {
  updateRetailerTermsAction,
  createRetailerStoreAction,
  adminInviteRetailerUserAction,
  adminUpdateRetailerCompanyAction,
  adminUpdateRetailerStoreAction,
  adminSetRetailerStoreStatusAction,
  adminUpdateRetailerUserRoleAction,
  adminUpdateRetailerUserStoreAccessAction,
  adminSetRetailerUserStatusAction,
} from "@/lib/retailer/admin-retailer-actions";
import {
  resendTeamInvitationAction,
  revokeTeamInvitationAction,
} from "@/app/retailer/account/team-actions";
import {
  adminCreateOrderFulfillmentAction,
  adminMarkFulfillmentShippedAction,
  adminConfirmFulfillmentDeliveryAction,
} from "@/lib/retailer/fulfillment-actions";
import { adminRetryAgreementPdfAction } from "@/lib/retailer/agreement-actions";
import { CountrySelect } from "@/components/shared/country-select";
import { formatCanonicalCountryName } from "@/lib/constants/countries";
import { RetailerRole } from "@/lib/retailer/onboarding-types";
import { Retailer360MemberItem } from "@/lib/retailer/admin-retailer-360";
import { StartImpersonationModal } from "@/components/admin/start-impersonation-modal";
import {
  normalizeApprovedTerms,
  formatApprovedTermsDisplay,
  normalizeTermsStatus,
  formatTermsStatusDisplay,
  normalizeRetailerAccountStatus,
  formatRetailerAccountStatusDisplay,
} from "@/lib/retailer/commercial-types";

interface Retailer360ViewProps {
  data: Retailer360Data;
  canImpersonate?: boolean;
}

type TabKey =
  | "overview"
  | "stores"
  | "users"
  | "orders"
  | "payments"
  | "performance"
  | "training"
  | "protection"
  | "cases";

export function Retailer360View({ data, canImpersonate = true }: Retailer360ViewProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [isPending, startTransition] = useTransition();
  const [impersonateMember, setImpersonateMember] = useState<Retailer360MemberItem | null>(null);

  // Commercial Terms Editing State
  const [status, setStatus] = useState(
    normalizeRetailerAccountStatus(data.profile?.status)
  );
  const [cardEnabled, setCardEnabled] = useState(
    data.profile?.payment_method_card_enabled ?? true
  );
  const [achEnabled, setAchEnabled] = useState(
    data.profile?.payment_method_ach_enabled ?? true
  );
  const [termsEnabled, setTermsEnabled] = useState(
    data.profile?.terms_enabled ?? false
  );
  const [approvedTerms, setApprovedTerms] = useState(
    normalizeApprovedTerms(data.profile?.approved_terms || data.profile?.payment_terms)
  );
  const [termsStatus, setTermsStatus] = useState(
    normalizeTermsStatus(data.profile?.terms_status)
  );
  const [creditLimit, setCreditLimit] = useState(
    data.profile?.credit_limit ?? 0
  );
  const [resaleCert, setResaleCert] = useState(
    data.profile?.resale_certificate_number || ""
  );
  const [taxExempt, setTaxExempt] = useState(
    Boolean(data.profile?.tax_exempt_status)
  );
  const [internalNote, setInternalNote] = useState(
    data.profile?.internal_note || ""
  );
  const [cardFeeMode, setCardFeeMode] = useState<"global" | "custom" | "waived">(
    data.profile?.card_fee_waived
      ? "waived"
      : data.profile?.card_fee_override !== null && data.profile?.card_fee_override !== undefined
      ? "custom"
      : "global"
  );
  const [cardFeeCustomRate, setCardFeeCustomRate] = useState<number>(
    data.profile?.card_fee_override ?? 3.5
  );
  const [achFeeMode, setAchFeeMode] = useState<"global" | "custom" | "waived">(
    data.profile?.ach_fee_waived
      ? "waived"
      : data.profile?.ach_fee_override !== null && data.profile?.ach_fee_override !== undefined
      ? "custom"
      : "global"
  );
  const [achFeeCustomAmount, setAchFeeCustomAmount] = useState<number>(
    data.profile?.ach_fee_override ?? 5.0
  );
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Company Edit State (Separating Authoritative Company Core vs Retailer Billing & Commercial)
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [editCompName, setEditCompName] = useState(data.company.name);
  const [editCompRegNo, setEditCompRegNo] = useState(data.company.businessRegistrationNumber || "");
  const [editCompCountry, setEditCompCountry] = useState(data.company.country || "US");
  const [editCompContactName, setEditCompContactName] = useState(data.company.contactName || "");
  const [editCompContactPhone, setEditCompContactPhone] = useState(data.company.contactPhone || "");
  const [editHqAddress1, setEditHqAddress1] = useState(data.company.address1 || "");
  const [editHqAddress2, setEditHqAddress2] = useState(data.company.address2 || "");
  const [editHqCity, setEditHqCity] = useState(data.company.city || "");
  const [editHqState, setEditHqState] = useState(data.company.state || "");
  const [editHqZip, setEditHqZip] = useState(data.company.zipCode || "");
  const [editCompStatus, setEditCompStatus] = useState(data.company.status || "active");

  const [editBillingSameAsHq, setEditBillingSameAsHq] = useState(data.billing?.billingSameAsHq ?? true);
  const [editBillingAddress, setEditBillingAddress] = useState(data.billing?.customBillingAddress || data.profile?.billing_address || "");
  const [editBillingCity, setEditBillingCity] = useState(data.billing?.customBillingCity || data.profile?.billing_city || "");
  const [editBillingState, setEditBillingState] = useState(data.billing?.customBillingState || data.profile?.billing_state || "");
  const [editBillingZip, setEditBillingZip] = useState(data.billing?.customBillingZip || data.profile?.billing_zip || "");

  const [editBillingContactSameAsPrimary, setEditBillingContactSameAsPrimary] = useState(data.billing?.billingContactSameAsPrimary ?? true);
  const [editBillingContactName, setEditBillingContactName] = useState(data.billing?.customBillingContactName || data.profile?.billing_contact_name || "");
  const [editBillingContactPhone, setEditBillingContactPhone] = useState(data.billing?.customBillingContactPhone || data.profile?.billing_contact_phone || "");
  const [editBillingContactEmail, setEditBillingContactEmail] = useState(data.billing?.billingContactEmail || data.profile?.billing_contact_email || "");
  const [editRetailerStatus, setEditRetailerStatus] = useState(data.profile?.status || "active");
  const [compModalError, setCompModalError] = useState("");

  const handleOpenCompanyModal = () => {
    setEditCompName(data.company.name);
    setEditCompRegNo(data.company.businessRegistrationNumber || "");
    setEditCompCountry(data.company.country || "US");
    setEditCompContactName(data.company.contactName || "");
    setEditCompContactPhone(data.company.contactPhone || "");
    setEditHqAddress1(data.company.address1 || "");
    setEditHqAddress2(data.company.address2 || "");
    setEditHqCity(data.company.city || "");
    setEditHqState(data.company.state || "");
    setEditHqZip(data.company.zipCode || "");
    setEditCompStatus(data.company.status || "active");

    setEditBillingSameAsHq(data.billing?.billingSameAsHq ?? true);
    setEditBillingAddress(data.billing?.customBillingAddress || data.profile?.billing_address || "");
    setEditBillingCity(data.billing?.customBillingCity || data.profile?.billing_city || "");
    setEditBillingState(data.billing?.customBillingState || data.profile?.billing_state || "");
    setEditBillingZip(data.billing?.customBillingZip || data.profile?.billing_zip || "");

    setEditBillingContactSameAsPrimary(data.billing?.billingContactSameAsPrimary ?? true);
    setEditBillingContactName(data.billing?.customBillingContactName || data.profile?.billing_contact_name || "");
    setEditBillingContactPhone(data.billing?.customBillingContactPhone || data.profile?.billing_contact_phone || "");
    setEditBillingContactEmail(data.billing?.billingContactEmail || data.profile?.billing_contact_email || "");
    setEditRetailerStatus(data.profile?.status || "active");

    setCompModalError("");
    setShowCompanyModal(true);
  };

  // Store Management State
  const [showAddStoreModal, setShowAddStoreModal] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreCode, setNewStoreCode] = useState("");
  const [newStoreCity, setNewStoreCity] = useState("");
  const [newStoreState, setNewStoreState] = useState("");
  const [newStoreZip, setNewStoreZip] = useState("");
  const [newStoreAddress, setNewStoreAddress] = useState("");
  const [newStorePhone, setNewStorePhone] = useState("");
  const [newStoreEmail, setNewStoreEmail] = useState("");
  const [newStoreManagerName, setNewStoreManagerName] = useState("");
  const [newStoreManagerPhone, setNewStoreManagerPhone] = useState("");
  const [storeError, setStoreError] = useState("");

  // Store Edit State
  const [showEditStoreModal, setShowEditStoreModal] = useState(false);
  const [editingStore, setEditingStore] = useState<Retailer360StoreItem | null>(null);
  const [editStoreName, setEditStoreName] = useState("");
  const [editStoreCode, setEditStoreCode] = useState("");
  const [editStoreAddress, setEditStoreAddress] = useState("");
  const [editStoreCity, setEditStoreCity] = useState("");
  const [editStoreState, setEditStoreState] = useState("");
  const [editStoreZip, setEditStoreZip] = useState("");
  const [editStorePhone, setEditStorePhone] = useState("");
  const [editStoreEmail, setEditStoreEmail] = useState("");
  const [editStoreManagerName, setEditStoreManagerName] = useState("");
  const [editStoreManagerPhone, setEditStoreManagerPhone] = useState("");
  const [editStoreError, setEditStoreError] = useState("");

  // User Invite State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<RetailerRole>("buyer");
  const [inviteAllStores, setInviteAllStores] = useState(true);
  const [inviteStoreIds, setInviteStoreIds] = useState<string[]>([]);
  const [inviteError, setInviteError] = useState("");

  // User Role State
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleMember, setRoleMember] = useState<Retailer360MemberItem | null>(null);
  const [userRole, setUserRole] = useState<RetailerRole>("employee");
  const [userRoleAllStores, setUserRoleAllStores] = useState(true);
  const [userRoleStoreIds, setUserRoleStoreIds] = useState<string[]>([]);
  const [roleModalError, setRoleModalError] = useState("");

  // User Store Access State
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [accessMember, setAccessMember] = useState<Retailer360MemberItem | null>(null);
  const [accessAllStores, setAccessAllStores] = useState(true);
  const [accessStoreIds, setAccessStoreIds] = useState<string[]>([]);
  const [accessModalError, setAccessModalError] = useState("");

  // Order Fulfillment Modal State
  const [fulfillmentModalOrder, setFulfillmentModalOrder] = useState<Retailer360OrderItem | null>(null);
  const [fulfillmentCarrier, setFulfillmentCarrier] = useState("FedEx");
  const [fulfillmentTracking, setFulfillmentTracking] = useState("");
  const [fulfillmentNotes, setFulfillmentNotes] = useState("");
  const [fulfillmentQuantities, setFulfillmentQuantities] = useState<Record<string, number>>({});
  const [fulfillmentError, setFulfillmentError] = useState("");

  // Performance Store Filter
  const [perfStoreFilter, setPerfStoreFilter] = useState<string>("all");

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };

  const formatCurrency = (amount?: number | null) => {
    if (amount === undefined || amount === null) return "$0.00";
    return `$${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Handlers
  const handleSaveTerms = () => {
    setSaveError("");
    setSaveSuccess(false);

    startTransition(async () => {
      const res = await updateRetailerTermsAction(data.company.id, {
        status,
        creditLimit: Math.max(0, Number(creditLimit) || 0),
        paymentMethodCardEnabled: cardEnabled,
        paymentMethodAchEnabled: achEnabled,
        termsEnabled,
        approvedTerms,
        termsStatus,
        resaleCertificateNumber: resaleCert.trim() || undefined,
        taxExemptStatus: taxExempt,
        internalNote: internalNote.trim() || undefined,
        cardFeeOverride: cardFeeMode === "custom" ? Math.max(0, Number(cardFeeCustomRate) || 0) : null,
        cardFeeWaived: cardFeeMode === "waived",
        achFeeOverride: achFeeMode === "custom" ? Math.max(0, Number(achFeeCustomAmount) || 0) : null,
        achFeeWaived: achFeeMode === "waived",
      });

      if (res.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        setSaveError(res.error || "Failed to update commercial terms.");
      }
    });
  };

  const handleSaveCompanySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCompModalError("");

    if (!editCompName.trim()) {
      setCompModalError("Company name is required.");
      return;
    }

    startTransition(async () => {
      const res = await adminUpdateRetailerCompanyAction(data.company.id, {
        name: editCompName.trim(),
        businessRegistrationNumber: editCompRegNo.trim() || undefined,
        country: editCompCountry.trim() || "US",
        contactName: editCompContactName.trim() || undefined,
        contactPhone: editCompContactPhone.trim() || undefined,
        address1: editHqAddress1.trim() || undefined,
        address2: editHqAddress2.trim() || undefined,
        city: editHqCity.trim() || undefined,
        state: editHqState.trim() || undefined,
        zipCode: editHqZip.trim() || undefined,
        companyStatus: editCompStatus,

        billingSameAsHq: editBillingSameAsHq,
        billingAddress: editBillingSameAsHq ? undefined : editBillingAddress.trim() || undefined,
        billingCity: editBillingSameAsHq ? undefined : editBillingCity.trim() || undefined,
        billingState: editBillingSameAsHq ? undefined : editBillingState.trim() || undefined,
        billingZip: editBillingSameAsHq ? undefined : editBillingZip.trim() || undefined,

        billingContactSameAsPrimary: editBillingContactSameAsPrimary,
        billingContactName: editBillingContactSameAsPrimary ? undefined : editBillingContactName.trim() || undefined,
        billingContactPhone: editBillingContactSameAsPrimary ? undefined : editBillingContactPhone.trim() || undefined,
        billingContactEmail: editBillingContactEmail.trim() || undefined,
        retailerStatus: editRetailerStatus,
      });

      if (res.success) {
        setShowCompanyModal(false);
        window.location.reload();
      } else {
        setCompModalError(res.error || "Failed to update organization.");
      }
    });
  };

  const handleOpenEditStoreModal = (st: Retailer360StoreItem) => {
    setEditingStore(st);
    setEditStoreName(st.name);
    setEditStoreCode(st.storeCode || "");
    setEditStoreAddress(st.address || "");
    setEditStoreCity(st.city || "");
    setEditStoreState(st.state || "");
    setEditStoreZip(st.zip || "");
    setEditStorePhone(st.phone || "");
    setEditStoreEmail(st.email || "");
    setEditStoreManagerName(st.managerName || "");
    setEditStoreManagerPhone(st.managerPhone || "");
    setEditStoreError("");
    setShowEditStoreModal(true);
  };

  const handleSaveEditStoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStore) return;
    setEditStoreError("");

    if (!editStoreName.trim()) {
      setEditStoreError("Store name is required.");
      return;
    }

    startTransition(async () => {
      const res = await adminUpdateRetailerStoreAction(data.company.id, editingStore.id, {
        name: editStoreName.trim(),
        storeCode: editStoreCode.trim() || undefined,
        address: editStoreAddress.trim() || undefined,
        city: editStoreCity.trim() || undefined,
        state: editStoreState.trim() || undefined,
        zip: editStoreZip.trim() || undefined,
        phone: editStorePhone.trim() || undefined,
        email: editStoreEmail.trim() || undefined,
        managerName: editStoreManagerName.trim() || undefined,
        managerPhone: editStoreManagerPhone.trim() || undefined,
      });

      if (res.success) {
        setShowEditStoreModal(false);
        window.location.reload();
      } else {
        setEditStoreError(res.error || "Failed to update store.");
      }
    });
  };

  const handleToggleStoreStatus = (st: Retailer360StoreItem) => {
    const isCurrentlyActive = st.status === "active";
    const nextStatus = isCurrentlyActive ? "inactive" : "active";

    const promptText = isCurrentlyActive
      ? `Deactivate store "${st.name}"?\n\nHistorical transactions, orders, and weekly count records will remain preserved.`
      : `Reactivate store "${st.name}"?`;

    if (!confirm(promptText)) return;

    startTransition(async () => {
      const res = await adminSetRetailerStoreStatusAction(data.company.id, st.id, nextStatus);
      if (res.success) {
        window.location.reload();
      } else {
        alert(res.error || "Failed to update store status.");
      }
    });
  };

  const handleOpenRoleModal = (member: Retailer360MemberItem) => {
    setRoleMember(member);
    setUserRole(member.role);
    setUserRoleAllStores(member.hasAllStoresAccess);
    setUserRoleStoreIds(member.assignedStores.map((s) => s.id));
    setRoleModalError("");
    setShowRoleModal(true);
  };

  const handleSaveUserRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleMember) return;
    setRoleModalError("");

    startTransition(async () => {
      const res = await adminUpdateRetailerUserRoleAction(data.company.id, roleMember.userId, {
        role: userRole,
        hasAllStoresAccess: userRoleAllStores,
        storeIds: userRoleAllStores ? undefined : userRoleStoreIds,
      });

      if (res.success) {
        setShowRoleModal(false);
        window.location.reload();
      } else {
        setRoleModalError(res.error || "Failed to update user role.");
      }
    });
  };

  const handleOpenAccessModal = (member: Retailer360MemberItem) => {
    setAccessMember(member);
    setAccessAllStores(member.hasAllStoresAccess);
    setAccessStoreIds(member.assignedStores.map((s) => s.id));
    setAccessModalError("");
    setShowAccessModal(true);
  };

  const handleToggleAccessStore = (storeId: string) => {
    setAccessStoreIds((prev) =>
      prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId]
    );
  };

  const handleSaveUserAccessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessMember) return;
    setAccessModalError("");

    if (!accessAllStores && accessStoreIds.length === 0) {
      setAccessModalError("Please select at least one assigned store.");
      return;
    }

    startTransition(async () => {
      const res = await adminUpdateRetailerUserStoreAccessAction(data.company.id, accessMember.userId, {
        hasAllStoresAccess: accessAllStores,
        storeIds: accessAllStores ? undefined : accessStoreIds,
      });

      if (res.success) {
        setShowAccessModal(false);
        window.location.reload();
      } else {
        setAccessModalError(res.error || "Failed to update store access.");
      }
    });
  };

  const handleToggleUserStatus = (member: Retailer360MemberItem) => {
    const isCurrentlyActive = (member.status || "active").toLowerCase() === "active";
    const nextStatus = isCurrentlyActive ? "suspended" : "active";

    const promptText = isCurrentlyActive
      ? `Disable user account for ${member.displayName || member.email}?\n\nThey will be blocked from logging in. Historical records remain preserved.`
      : `Reactivate user account for ${member.displayName || member.email}?`;

    if (!confirm(promptText)) return;

    startTransition(async () => {
      const res = await adminSetRetailerUserStatusAction(data.company.id, member.userId, nextStatus);
      if (res.success) {
        window.location.reload();
      } else {
        alert(res.error || "Failed to update user status.");
      }
    });
  };

  const handleCreateStore = (e: React.FormEvent) => {
    e.preventDefault();
    setStoreError("");

    if (!newStoreName.trim()) {
      setStoreError("Please enter a store name.");
      return;
    }

    startTransition(async () => {
      const res = await createRetailerStoreAction(data.company.id, {
        name: newStoreName.trim(),
        storeCode: newStoreCode.trim() || undefined,
        address: newStoreAddress.trim() || undefined,
        city: newStoreCity.trim() || undefined,
        state: newStoreState.trim() || undefined,
        zip: newStoreZip.trim() || undefined,
        phone: newStorePhone.trim() || undefined,
        email: newStoreEmail.trim() || undefined,
        managerName: newStoreManagerName.trim() || undefined,
        managerPhone: newStoreManagerPhone.trim() || undefined,
      });

      if (res.success) {
        setShowAddStoreModal(false);
        setNewStoreName("");
        setNewStoreCode("");
        setNewStoreAddress("");
        setNewStoreCity("");
        setNewStoreState("");
        setNewStoreZip("");
        setNewStorePhone("");
        setNewStoreEmail("");
        setNewStoreManagerName("");
        setNewStoreManagerPhone("");
        window.location.reload();
      } else {
        setStoreError(res.error || "Failed to create store.");
      }
    });
  };

  const handleInviteUser = (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError("");

    if (!inviteEmail.trim()) {
      setInviteError("Please enter an email address.");
      return;
    }

    startTransition(async () => {
      const res = await adminInviteRetailerUserAction({
        companyId: data.company.id,
        email: inviteEmail.trim(),
        name: inviteName.trim() || undefined,
        role: inviteRole,
        hasAllStoresAccess: inviteAllStores,
        storeIds: inviteAllStores ? undefined : inviteStoreIds,
      });

      if (res.success) {
        setShowInviteModal(false);
        setInviteEmail("");
        setInviteName("");
        setInviteStoreIds([]);
        window.location.reload();
      } else {
        setInviteError(res.error || "Failed to send invitation.");
      }
    });
  };

  const handleOpenFulfillmentModal = (order: Retailer360OrderItem) => {
    setFulfillmentModalOrder(order);
    setFulfillmentCarrier("FedEx");
    setFulfillmentTracking("");
    setFulfillmentNotes("");
    setFulfillmentError("");

    const initialQtys: Record<string, number> = {};
    order.items.forEach((item) => {
      const remaining = Math.max(0, item.quantity - item.quantityShipped);
      initialQtys[item.id] = remaining;
    });
    setFulfillmentQuantities(initialQtys);
  };

  const handleCreateFulfillmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fulfillmentModalOrder) return;
    setFulfillmentError("");

    const itemsToShip = Object.entries(fulfillmentQuantities)
      .map(([orderItemId, qty]) => {
        const item = fulfillmentModalOrder?.items.find((it) => it.id === orderItemId);
        return {
          orderItemId,
          productId: item?.productId || "",
          quantityShipped: Number(qty) || 0,
        };
      })
      .filter((i) => i.quantityShipped > 0);

    if (itemsToShip.length === 0) {
      setFulfillmentError("Please specify at least 1 unit to ship.");
      return;
    }

    startTransition(async () => {
      const res = await adminCreateOrderFulfillmentAction({
        orderId: fulfillmentModalOrder.id,
        carrier: fulfillmentCarrier,
        trackingNumber: fulfillmentTracking.trim() || undefined,
        notes: fulfillmentNotes.trim() || undefined,
        items: itemsToShip,
      });

      if (res.success) {
        setFulfillmentModalOrder(null);
        window.location.reload();
      } else {
        setFulfillmentError(res.error || "Failed to create shipment.");
      }
    });
  };

  const handleConfirmDispatch = (fulfillmentId: string) => {
    if (!confirm("Confirm dispatch for this shipment package? (Mark as Shipped)")) return;
    startTransition(async () => {
      const res = await adminMarkFulfillmentShippedAction({ fulfillmentId });
      if (res.success) {
        window.location.reload();
      } else {
        alert(res.error || "Failed to dispatch shipment.");
      }
    });
  };

  const handleMarkDelivered = (fulfillmentId: string) => {
    if (!confirm("Confirm delivery for this shipment package?")) return;
    startTransition(async () => {
      await adminConfirmFulfillmentDeliveryAction({ fulfillmentId });
      window.location.reload();
    });
  };

  const [retryingPdfId, setRetryingPdfId] = useState<string | null>(null);

  const handleRetryAgreementPdf = (acceptanceId: string) => {
    setRetryingPdfId(acceptanceId);
    startTransition(async () => {
      const res = await adminRetryAgreementPdfAction(acceptanceId);
      setRetryingPdfId(null);
      if (res.success) {
        window.location.reload();
      } else {
        alert(res.error || "Failed to generate agreement PDF.");
      }
    });
  };

  const primaryOwner = data.members.find((m) => m.role === "owner") || data.members[0];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Link href="/admin/retailers" className="hover:text-zinc-900 dark:hover:text-white transition-colors">
            ← Retailers List
          </Link>
          <span>/</span>
          <span className="font-bold text-zinc-900 dark:text-white truncate max-w-[200px]">
            {data.company.name}
          </span>
          <span className="rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 text-[10px] font-bold">
            Retailer 360°
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenCompanyModal}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 transition-colors shadow-2xs cursor-pointer"
          >
            ✏️ Edit Organization
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("orders");
            }}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 transition-colors shadow-2xs cursor-pointer"
          >
            📦 Orders ({data.orders.length})
          </button>
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="rounded-xl bg-zinc-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-colors shadow-2xs cursor-pointer"
          >
            + Invite Team Member
          </button>
        </div>
      </div>

      {/* 1. Company Identity Header */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">
                {data.company.name}
              </h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                  data.profile.status === "active"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                    : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                }`}
              >
                ● {data.profile.status}
              </span>
              {data.profile.terms_enabled ? (
                <span className="rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800 px-2 py-0.5 text-[10px] font-bold">
                  💳 {data.profile.approved_terms || "Net Terms"} (${data.profile.credit_limit?.toLocaleString()})
                </span>
              ) : (
                <span className="rounded-md bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 px-2 py-0.5 text-[10px] font-semibold">
                  Prepaid Card
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-6 gap-y-1.5 text-xs text-zinc-600 dark:text-zinc-400 pt-1">
              <div>
                <span className="text-zinc-400 block text-[10px]">Company Code</span>
                <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
                  {data.company.companyCode || "Not assigned"}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block text-[10px]">Business Registration / Tax ID</span>
                <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
                  {data.company.businessRegistrationNumber || "Not recorded"}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block text-[10px]">Company HQ Address</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate block" title={data.company.formattedHqAddress || "Not recorded"}>
                  {data.company.formattedHqAddress || "Not recorded"}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block text-[10px]">Primary Contact</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate block">
                  {data.company.contactName
                    ? `${data.company.contactName}${data.company.contactPhone ? ` (${data.company.contactPhone})` : ""}`
                    : primaryOwner
                    ? `${primaryOwner.displayName || "Owner"}`
                    : "Not recorded"}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block text-[10px]">Country & Region</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  🇺🇸 {data.company.country}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 p-3 text-center min-w-[90px]">
              <span className="text-[10px] text-zinc-400 font-semibold block">Stores</span>
              <span className="text-base font-black text-zinc-900 dark:text-white">
                {data.stores.length}
              </span>
            </div>
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 p-3 text-center min-w-[90px]">
              <span className="text-[10px] text-zinc-400 font-semibold block">Team</span>
              <span className="text-base font-black text-zinc-900 dark:text-white">
                {data.members.length}
              </span>
            </div>
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 p-3 text-center min-w-[90px]">
              <span className="text-[10px] text-zinc-400 font-semibold block">Coverage</span>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                {data.metrics.reportingCoveragePercent}%
              </span>
            </div>
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 p-3 text-center min-w-[90px]">
              <span className="text-[10px] text-zinc-400 font-semibold block">Open Cases</span>
              <span className={`text-base font-black ${data.metrics.openSupportCasesCount > 0 ? "text-rose-600" : "text-zinc-700 dark:text-zinc-300"}`}>
                {data.metrics.openSupportCasesCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Needs Attention Action Center (Exceptions Banner) */}
      {data.needsAttention.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5 dark:border-rose-900/50 dark:bg-rose-950/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">🚨</span>
              <h2 className="text-xs font-bold text-rose-900 dark:text-rose-300 uppercase tracking-wider">
                Needs Attention ({data.needsAttention.length} Items)
              </h2>
            </div>
            <span className="text-[10px] font-semibold text-rose-700 dark:text-rose-400">
              Operational exceptions requiring admin review
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.needsAttention.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-rose-200/80 bg-white p-3.5 shadow-2xs dark:border-rose-900/60 dark:bg-zinc-900 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-xs font-bold text-zinc-900 dark:text-white leading-snug">
                      {item.title}
                    </span>
                    <span className="rounded bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 px-1.5 py-0.2 text-[9px] font-bold shrink-0">
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2">
                    {item.description}
                  </p>
                </div>

                <div className="pt-2 mt-2 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                  {item.href.startsWith("#") ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab(item.href.replace("#", "") as TabKey)}
                      className="text-[10px] font-bold text-rose-700 dark:text-rose-400 hover:underline cursor-pointer"
                    >
                      Resolve in 360° →
                    </button>
                  ) : (
                    <Link
                      href={item.href}
                      className="text-[10px] font-bold text-rose-700 dark:text-rose-400 hover:underline"
                    >
                      Open Action Module →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Tab Navigation */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
        <nav className="flex space-x-1 sm:space-x-2">
          {[
            { key: "overview", label: "Overview", icon: "📊", badge: null },
            { key: "stores", label: "Stores", icon: "🏪", badge: data.stores.length },
            { key: "users", label: "Users & Team", icon: "👥", badge: data.members.length },
            { key: "orders", label: "Orders & Fulfillment", icon: "📦", badge: data.orders.length },
            { key: "payments", label: "Payments & Terms", icon: "💳", badge: null },
            { key: "performance", label: "Performance & Check", icon: "📈", badge: `${data.metrics.reportingCoveragePercent}%` },
            { key: "training", label: "Training", icon: "🎓", badge: `${data.training.overallCompletionPercent}%` },
            { key: "protection", label: "90-Day Protection", icon: "🛡️", badge: data.protections.length },
            { key: "cases", label: "Support Cases", icon: "💬", badge: data.cases.length },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as TabKey)}
              className={`flex items-center gap-1.5 py-3 px-3.5 text-xs font-bold whitespace-nowrap border-b-2 transition-all cursor-pointer ${
                activeTab === tab.key
                  ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge !== null && (
                <span
                  className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[9px] font-mono ${
                    activeTab === tab.key
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* 4. Tab Contents */}

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Test Orders Warning if any */}
          {data.metrics.testOrdersCount > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>⚠️</span>
                <span>
                  <strong>{data.metrics.testOrdersCount} Test Order(s) Detected:</strong> Test orders are tracked separately and excluded from aggregate commercial revenue metrics.
                </span>
              </div>
            </div>
          )}

          {/* Real Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Submitted Order Value</span>
              <p className="text-xl font-black text-zinc-900 dark:text-white mt-1 font-mono">
                {formatCurrency(data.metrics.submittedOrderValue)}
              </p>
              <span className="text-[9px] text-zinc-400 mt-0.5 block leading-tight">
                {data.metrics.submittedOrdersCount} orders (Gross, not settled revenue)
              </span>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Est. Unpaid Order Value</span>
              <p className={`text-xl font-black mt-1 font-mono ${data.metrics.estimatedUnpaidOrderValue > 0 ? "text-amber-600" : "text-zinc-900 dark:text-white"}`}>
                {formatCurrency(data.metrics.estimatedUnpaidOrderValue)}
              </p>
              <span className="text-[9px] text-zinc-400 mt-0.5 block leading-tight">
                Pending/unpaid orders (Not an A/R ledger)
              </span>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Delivered Units</span>
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {data.metrics.totalDeliveredUnits.toLocaleString()}
              </p>
              <span className="text-[9px] text-zinc-400 mt-0.5 block leading-tight">
                Confirmed delivered quantity
              </span>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Store Locations</span>
              <p className="text-xl font-black text-zinc-900 dark:text-white mt-1">
                {data.metrics.totalStoresCount}
              </p>
              <span className="text-[9px] text-zinc-400 mt-0.5 block leading-tight">
                Assortment: {data.performance.products.length} SKUs
              </span>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Weekly Coverage</span>
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {data.metrics.reportingCoveragePercent}%
              </p>
              <span className="text-[9px] text-zinc-400 mt-0.5 block leading-tight">
                {data.performance.reportingStores} of {data.performance.totalStores} stores reporting
              </span>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Reorder Signals</span>
              <p className="text-xl font-black text-amber-600 mt-1">
                {data.metrics.productsNeedingReorderCount}
              </p>
              <span className="text-[9px] text-zinc-400 mt-0.5 block leading-tight">
                SKUs with weeks of supply &lt; 2
              </span>
            </div>
          </div>

          {/* Quick Snapshot Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
            {/* Commercial Terms Summary */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                    <span>💳</span> Commercial Terms
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab("payments")}
                    className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    Edit Terms →
                  </button>
                </div>

                <div className="space-y-2 text-xs pt-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Approved Terms:</span>
                    <span className="font-bold text-zinc-900 dark:text-white">
                      {formatApprovedTermsDisplay(data.profile.approved_terms || data.profile.payment_terms)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Terms Status:</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {formatTermsStatusDisplay(data.profile.terms_status)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Approved Credit Limit:</span>
                    <span className="font-mono font-bold text-zinc-900 dark:text-white">
                      {formatCurrency(data.profile.credit_limit)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Terms Capacity:</span>
                    <span className="text-zinc-500 font-medium text-[11px] text-right">
                      Subject to commercial review
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Card / ACH Ready:</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      Card: {data.profile.payment_method_card_enabled ? "Yes" : "No"} · ACH: {data.profile.payment_method_ach_enabled ? "Yes" : "No"}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                Credit terms are policy approvals. Real-time drawdowns are verified per order.
              </p>
            </div>

            {/* Order Payment Breakdown */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                    <span>📑</span> Order Payment Status
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab("orders")}
                    className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    View Orders →
                  </button>
                </div>

                <div className="space-y-2 text-xs pt-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Paid Orders:</span>
                    <span className="font-mono font-bold text-emerald-600">
                      {formatCurrency(data.metrics.paymentBreakdown.paidAmount)} ({data.metrics.paymentBreakdown.paidCount})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Pending / Processing:</span>
                    <span className="font-mono font-medium text-amber-600">
                      {formatCurrency(data.metrics.paymentBreakdown.pendingAmount)} ({data.metrics.paymentBreakdown.pendingCount})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Unpaid (Net Terms):</span>
                    <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
                      {formatCurrency(data.metrics.paymentBreakdown.unpaidAmount)} ({data.metrics.paymentBreakdown.unpaidCount})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Failed / Declined:</span>
                    <span className="font-mono font-medium text-rose-600">
                      {formatCurrency(data.metrics.paymentBreakdown.failedAmount)} ({data.metrics.paymentBreakdown.failedCount})
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                Derived directly from order records. Authoritative bank settlement ledger pending.
              </p>
            </div>

            {/* Performance Quick Summary */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                    <span>📈</span> Sell-Through & Movement
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab("performance")}
                    className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    View Details →
                  </button>
                </div>

                <div className="space-y-2 text-xs pt-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Total Units Movement:</span>
                    <span className="font-bold text-zinc-900 dark:text-white">
                      {data.performance.estimatedMovement.toLocaleString()} units
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Estimated Retail Sales:</span>
                    <span className="font-bold text-emerald-600">
                      {formatCurrency(data.performance.estimatedRetailSales)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Estimated Gross Margin:</span>
                    <span className="font-bold text-zinc-900 dark:text-white">
                      {data.performance.estimatedGrossMargin}%
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                Calculated from store weekly check inventory count reports.
              </p>
            </div>

            {/* 90-Day Protection & Cases Summary */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                    <span>🛡️</span> Protection & Support
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab("protection")}
                    className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    Manage →
                  </button>
                </div>

                <div className="space-y-2 text-xs pt-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Active 90-Day Trials:</span>
                    <span className="font-bold text-zinc-900 dark:text-white">
                      {data.metrics.activeProtectionTrialsCount} products
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Reviews Pending Action:</span>
                    <span className={data.metrics.protectionReviewsActionCount > 0 ? "text-rose-600 font-bold" : "text-zinc-400"}>
                      {data.metrics.protectionReviewsActionCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Support Tickets Open:</span>
                    <span className={data.metrics.openSupportCasesCount > 0 ? "text-amber-600 font-bold" : "text-zinc-400"}>
                      {data.metrics.openSupportCasesCount}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                Guaranteed inventory protection & shared partner case tickets.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STORES */}
      {activeTab === "stores" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              Retailer Store Locations ({data.stores.length})
            </h3>
            <button
              type="button"
              onClick={() => setShowAddStoreModal(true)}
              className="rounded-xl bg-zinc-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:hover:text-zinc-950 transition-colors shadow-2xs cursor-pointer"
            >
              + Add Store Location
            </button>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50/70 text-[10px] font-bold text-zinc-500 uppercase tracking-wider dark:border-zinc-800 dark:bg-zinc-950/40">
                <tr>
                  <th className="py-3 px-4">Store Name</th>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Assigned Staff</th>
                  <th className="py-3 px-4">Weekly Check</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.stores.map((store) => {
                  const isActive = (store.status || "active").toLowerCase() === "active";
                  return (
                    <tr key={store.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20">
                      <td className="py-3 px-4 font-bold text-zinc-900 dark:text-white">
                        🏪 {store.name}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-zinc-500">
                        {store.storeCode || "-"}
                      </td>
                      <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                        {store.address && <div className="font-medium text-zinc-900 dark:text-white">{store.address}</div>}
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {store.city ? `${store.city}, ${store.state || ""}${store.zip ? ` ${store.zip}` : ""}` : (store.address ? "" : "-")}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400 text-[11px]">
                        <div>{store.phone || "-"}</div>
                        {store.managerName && (
                          <div className="text-[10px] text-zinc-400">Mgr: {store.managerName}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300">
                        👥 {store.assignedUsersCount} users
                      </td>
                      <td className="py-3 px-4">
                        {store.latestWeeklyCheckDate ? (
                          <div className="text-[11px]">
                            <span className="text-emerald-600 font-semibold">Submitted</span>
                            <span className="text-zinc-400 ml-1.5 font-mono">({formatDate(store.latestWeeklyCheckDate)})</span>
                          </div>
                        ) : (
                          <span className="text-amber-600 font-medium text-[11px]">No check submitted</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-bold border ${
                            isActive
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {store.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditStoreModal(store)}
                            className="px-2.5 py-1 rounded-lg border border-zinc-200 bg-white text-[10px] font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 cursor-pointer shadow-2xs"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStoreStatus(store)}
                            className={`px-2 py-1 rounded-lg border text-[10px] font-bold cursor-pointer transition-colors shadow-2xs ${
                              isActive
                                ? "border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400"
                                : "border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-400"
                            }`}
                          >
                            {isActive ? "Deactivate" : "Reactivate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Saved Shipping & Fulfillment Destinations */}
          <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>Saved Shipping & Delivery Addresses</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {data.shippingAddresses?.length || 0}
                  </span>
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Reusable non-store delivery destinations (warehouses, cross-docks, customer delivery points) managed by the retailer.
                </p>
              </div>
            </div>

            {(!data.shippingAddresses || data.shippingAddresses.length === 0) ? (
              <div className="p-6 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-400">
                No custom saved shipping addresses registered for this retailer. Orders will default to store addresses.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.shippingAddresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-900 dark:text-white text-sm">
                          {addr.label}
                        </span>
                        {addr.isDefault && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            Default
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {addr.country}
                      </span>
                    </div>

                    <div className="text-zinc-600 dark:text-zinc-300 space-y-0.5">
                      <p className="font-semibold text-zinc-900 dark:text-white">
                        {addr.recipientName} {addr.attentionName ? `(Attn: ${addr.attentionName})` : ""}
                      </p>
                      <p>{addr.addressLine1}</p>
                      {addr.addressLine2 && <p>{addr.addressLine2}</p>}
                      <p>{addr.city}, {addr.state} {addr.zip}</p>
                      {addr.phone && <p className="text-zinc-500">Phone: {addr.phone}</p>}
                      {addr.deliveryNotes && (
                        <p className="text-[11px] text-zinc-400 italic pt-1 border-t border-zinc-100 dark:border-zinc-800">
                          Note: {addr.deliveryNotes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: USERS & TEAM */}
      {activeTab === "users" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              Active Team Members ({data.members.length})
            </h3>
            <button
              type="button"
              onClick={() => setShowInviteModal(true)}
              className="rounded-xl bg-zinc-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:hover:text-zinc-950 transition-colors shadow-2xs cursor-pointer"
            >
              + Invite Team Member
            </button>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50/70 text-[10px] font-bold text-zinc-500 uppercase tracking-wider dark:border-zinc-800 dark:bg-zinc-950/40">
                <tr>
                  <th className="py-3 px-4">Name / Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Store Access</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Joined Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.members.map((member) => {
                  const isUserActive = (member.status || "active").toLowerCase() === "active";
                  return (
                    <tr key={member.userId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20">
                      <td className="py-3 px-4">
                        <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                          <span>{member.displayName || "Retailer User"}</span>
                          {member.isPrimary && (
                            <span className="rounded bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-1.5 py-0.2 text-[9px] font-bold">
                              Primary
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-zinc-400">
                          {member.email}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-700 dark:text-zinc-300">
                          {member.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400 text-[11px]">
                        {member.hasAllStoresAccess ? (
                          <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                            🏪 All Stores ({data.stores.length})
                          </span>
                        ) : (
                          <span>
                            {member.assignedStores.map((s) => s.name).join(", ") || "No store assigned"}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-bold border ${
                            isUserActive
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                          }`}
                        >
                          {member.status || "active"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-500 font-mono text-[11px]">
                        {formatDate(member.joinedAt)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isUserActive && canImpersonate && (
                            <button
                              type="button"
                              onClick={() => setImpersonateMember(member)}
                              className="px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 text-[10px] font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 cursor-pointer shadow-2xs flex items-center gap-1"
                              title="Login as User (Support Session)"
                            >
                              🔑 Login as User
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenRoleModal(member)}
                            className="px-2.5 py-1 rounded-lg border border-zinc-200 bg-white text-[10px] font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 cursor-pointer shadow-2xs"
                          >
                            Role
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenAccessModal(member)}
                            className="px-2.5 py-1 rounded-lg border border-zinc-200 bg-white text-[10px] font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 cursor-pointer shadow-2xs"
                          >
                            Stores
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleUserStatus(member)}
                            className={`px-2 py-1 rounded-lg border text-[10px] font-bold cursor-pointer transition-colors shadow-2xs ${
                              isUserActive
                                ? "border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400"
                                : "border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-400"
                            }`}
                          >
                            {isUserActive ? "Disable" : "Enable"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pending Invitations */}
          {data.invitations.length > 0 && (
            <div className="space-y-3 pt-4">
              <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                Pending Invitations ({data.invitations.filter((i) => i.status === "pending").length})
              </h4>
              <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-xs dark:border-zinc-800 dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.invitations.map((inv) => (
                  <div key={inv.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-900 dark:text-white">{inv.email}</span>
                        <span className="rounded bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 text-[9px] font-bold">
                          {inv.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Role: <strong>{inv.role}</strong> · Invited: {formatDate(inv.created_at)} · Expires: {formatDate(inv.expires_at)}
                      </p>
                    </div>

                    {inv.status === "pending" && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            startTransition(async () => {
                              await resendTeamInvitationAction(inv.id);
                              alert("Invitation link refreshed!");
                            });
                          }}
                          className="px-2.5 py-1 rounded-lg border border-zinc-200 text-[10px] font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 cursor-pointer"
                        >
                          Resend
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!confirm("Revoke this invitation?")) return;
                            startTransition(async () => {
                              await revokeTeamInvitationAction(inv.id);
                              window.location.reload();
                            });
                          }}
                          className="px-2.5 py-1 rounded-lg border border-red-200 text-[10px] font-bold text-red-600 hover:bg-red-50 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/60 dark:hover:text-white cursor-pointer transition-colors"
                        >
                          Revoke
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ORDERS & FULFILLMENT */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              Retailer Orders & Shipment Dispatch ({data.orders.length})
            </h3>
          </div>

          <div className="space-y-4">
            {data.orders.length > 0 ? (
              data.orders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-black text-zinc-900 dark:text-white">
                          #{order.orderNumber}
                        </span>
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                          order.orderStatus === "partially_shipped"
                            ? "bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800"
                            : order.orderStatus === "shipped"
                            ? "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                            : order.orderStatus === "processing"
                            ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                            : order.orderStatus === "cancelled"
                            ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                            : order.orderStatus === "partially_cancelled"
                            ? "bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800"
                            : "bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                        }`}>
                          {order.orderStatus.replace("_", " ")}
                        </span>
                        <span className="rounded bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold">
                          {order.paymentStatus}
                        </span>
                        {order.isTest && (
                          <span className="rounded bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.2 text-[9px] font-bold">
                            TEST
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Store: <strong>🏪 {order.storeName}</strong> · Ordered: {formatDate(order.createdAt)} · Payment: {order.paymentTerms}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] text-zinc-400 block">Total Amount</span>
                        <span className="font-mono text-base font-black text-zinc-900 dark:text-white">
                          {formatCurrency(order.totalAmount)}
                        </span>
                      </div>
                      {(() => {
                        const orderRemainingUnits = (order.items || []).reduce(
                          (sum, it) => sum + Math.max(0, Number(it.quantity || 0) - Number(it.quantityShipped || 0)),
                          0
                        );
                        const isTerminal = ["shipped", "delivered", "cancelled"].includes(
                          order.orderStatus.toLowerCase()
                        );
                        const canCreateShipment = !isTerminal && orderRemainingUnits > 0;

                        return canCreateShipment ? (
                          <button
                            type="button"
                            onClick={() => handleOpenFulfillmentModal(order)}
                            className="rounded-xl bg-zinc-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:hover:text-zinc-950 transition-colors shadow-2xs cursor-pointer"
                          >
                            + Create Shipment
                          </button>
                        ) : (
                          <span className="rounded-xl bg-zinc-100 dark:bg-zinc-800/80 px-3 py-1.5 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-700/60">
                            {order.orderStatus.toLowerCase() === "cancelled"
                              ? "Cancelled"
                              : "Fully Dispatched"}
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Order Items Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-[10px] text-zinc-400 font-bold uppercase border-b border-zinc-100 dark:border-zinc-800">
                        <tr>
                          <th className="py-2">Product / SKU</th>
                          <th className="py-2 text-right">Qty Ordered</th>
                          <th className="py-2 text-right">Shipped</th>
                          <th className="py-2 text-right">Delivered</th>
                          <th className="py-2 text-right">Wholesale Price</th>
                          <th className="py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                        {order.items.map((item) => (
                          <tr key={item.id}>
                            <td className="py-2">
                              <span className="font-semibold text-zinc-800 dark:text-zinc-200 block">
                                {item.productName}
                              </span>
                              <span className="font-mono text-[10px] text-zinc-400">
                                {item.sku}
                              </span>
                            </td>
                            <td className="py-2 text-right font-bold">{item.quantity}</td>
                            <td className="py-2 text-right text-sky-600 font-semibold">{item.quantityShipped}</td>
                            <td className="py-2 text-right text-emerald-600 font-bold">{item.quantityDelivered}</td>
                            <td className="py-2 text-right font-mono text-zinc-500">{formatCurrency(item.unitWholesalePrice)}</td>
                            <td className="py-2 text-right font-mono font-bold text-zinc-900 dark:text-white">{formatCurrency(item.lineTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Shipments List if any */}
                  {order.fulfillments.length > 0 && (
                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                        Fulfillment Packages ({order.fulfillments.length})
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {order.fulfillments.map((ful) => (
                          <div
                            key={ful.id}
                            className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-800/40 flex items-center justify-between"
                          >
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                  #{ful.fulfillmentNumber}
                                </span>
                                <span className="rounded bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.2 text-[9px] font-bold">
                                  {ful.status}
                                </span>
                              </div>
                              <p className="text-[10px] text-zinc-500 mt-0.5">
                                {ful.carrier} · {ful.trackingNumber ? `Tracking: ${ful.trackingNumber}` : "No tracking"}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {ful.status === "processing" && (
                                <button
                                  type="button"
                                  onClick={() => handleConfirmDispatch(ful.id)}
                                  className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-indigo-700 transition-colors shadow-2xs cursor-pointer"
                                >
                                  Confirm Dispatch
                                </button>
                              )}
                              {ful.status === "shipped" && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkDelivered(ful.id)}
                                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 transition-colors shadow-2xs cursor-pointer"
                                >
                                  Confirm Delivery
                                </button>
                              )}
                              {ful.status === "delivered" && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  ✓ Delivered
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-xs text-zinc-400 dark:text-zinc-500 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                No orders placed by this retailer yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: PAYMENTS & TERMS */}
      {activeTab === "payments" && (
        <div className="space-y-6">
          {/* Commercial Billing Profile & Addresses */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>🏢</span> Retailer Billing Profile & Effective Addresses
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Resolution between Authoritative Company Core HQ and Commercial Retailer Billing Profile.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenCompanyModal}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 transition-colors shadow-2xs cursor-pointer self-start sm:self-auto"
              >
                ✏️ Edit Billing & HQ Info
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Company HQ Address</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-zinc-200/60 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    Master Core
                  </span>
                </div>
                <p className="font-medium text-zinc-800 dark:text-zinc-200">
                  {data.company.formattedHqAddress || "No HQ address recorded"}
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Effective Billing Address</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                    data.billing?.billingSameAsHq
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                  }`}>
                    {data.billing?.billingSameAsHq ? "Same as HQ" : "Custom Override"}
                  </span>
                </div>
                <p className="font-medium text-zinc-800 dark:text-zinc-200">
                  {data.billing?.formattedBillingAddress || "No billing address recorded"}
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Billing Contact & Email</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                    data.billing?.billingContactSameAsPrimary
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                  }`}>
                    {data.billing?.billingContactSameAsPrimary ? "Same as Primary" : "Custom Contact"}
                  </span>
                </div>
                <p className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
                  {data.billing?.effectiveBillingContactName || "No contact"}
                  {data.billing?.effectiveBillingContactPhone ? ` (${data.billing.effectiveBillingContactPhone})` : ""}
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono truncate">
                  {data.billing?.billingContactEmail || "No billing email registered"}
                </p>
              </div>
            </div>
          </div>

          {/* COMMERCIAL & COMPLIANCE PROFILE (5 CANONICAL SECTIONS) */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>🏛️</span> Retailer Commercial, Compliance & Credit Profile
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Authoritative retail trading policy, state resale compliance, payment channels, and underwritten credit terms.
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  Account: {formatRetailerAccountStatusDisplay(status)}
                </span>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  {formatApprovedTermsDisplay(approvedTerms)} ({formatTermsStatusDisplay(termsStatus)})
                </span>
              </div>
            </div>

            {saveSuccess && (
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300 flex items-center justify-between">
                <span>✓ Commercial & compliance settings updated successfully!</span>
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">Canonical Source: retailer_profiles</span>
              </div>
            )}

            {saveError && (
              <div className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-xs font-bold text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">
                ✕ {saveError}
              </div>
            )}

            {/* SECTION A — Retailer Account */}
            <div className="p-4 rounded-xl border border-zinc-200/80 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50 space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800 pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 flex items-center justify-center text-[10px] font-black">A</span>
                  Retailer Account Status
                </h4>
                <span className="text-[11px] text-zinc-400">Controls order placement authorization</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Account Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(normalizeRetailerAccountStatus(e.target.value))}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  >
                    <option value="active">Active (Full Purchasing Authorized)</option>
                    <option value="pending_approval">Pending Approval / Trial</option>
                    <option value="suspended">Suspended (Blocked from Ordering)</option>
                    <option value="inactive">Inactive (Terminated / Offboarded)</option>
                  </select>
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center">
                  <p>
                    <strong className="text-zinc-700 dark:text-zinc-300">Operational Note:</strong> This status applies strictly to the Retailer Trading Account. Company legal entity status is managed independently in Company Core.
                  </p>
                </div>
              </div>
            </div>

            {/* SECTION B — Commercial Compliance */}
            <div className="p-4 rounded-xl border border-zinc-200/80 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800 pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 flex items-center justify-center text-[10px] font-black">B</span>
                  Commercial Compliance & State Resale
                </h4>
                <span className="text-[11px] text-zinc-400">Sales tax & state certificate authority</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                {/* Company Tax ID (Read-only reference) */}
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Company Tax ID / EIN</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      Master Core
                    </span>
                  </div>
                  <p className="font-mono font-bold text-zinc-900 dark:text-white text-sm">
                    {data.company.businessRegistrationNumber || "Not Registered"}
                  </p>
                  <p className="text-[10px] text-zinc-400">
                    Corporate entity registration (Read-only master)
                  </p>
                </div>

                {/* Resale Certificate Number (Editable) */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Resale Certificate Number
                  </label>
                  <input
                    type="text"
                    value={resaleCert}
                    onChange={(e) => setResaleCert(e.target.value)}
                    placeholder="e.g. CA-RESALE-998811"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-mono font-bold outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                  <p className="text-[10px] text-zinc-400 mt-1">
                    State resale license for wholesale sales tax exemption
                  </p>
                </div>

                {/* Tax Exempt Status (Admin-controlled) */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Tax Exempt Status (Admin Verified)
                  </label>
                  <select
                    value={taxExempt ? "yes" : "no"}
                    onChange={(e) => setTaxExempt(e.target.value === "yes")}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-bold outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  >
                    <option value="no">Standard Taxable (Sales Tax Applied)</option>
                    <option value="yes">Verified Exempt (Zero Sales Tax)</option>
                  </select>
                  <p className="text-[10px] text-zinc-400 mt-1">
                    Requires manual admin audit of state certificate
                  </p>
                </div>
              </div>

              {/* Agreement & Compliance Evidence Summary */}
              <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                  Operating Agreement & Compliance Status
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  {data.agreements && data.agreements.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        Retailer Agreement Accepted: v{data.agreements[0].agreement_version} ({formatDate(data.agreements[0].accepted_at)})
                      </span>
                      {data.agreements[0].signedPdfUrl && (
                        <a
                          href={data.agreements[0].signedPdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-bold text-indigo-600 hover:underline"
                        >
                          View Signed PDF ↗
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                      <span className="font-medium">No Operating Agreement signed yet</span>
                    </div>
                  )}

                  {data.documents && data.documents.length > 0 && (
                    <span className="text-zinc-400">· {data.documents.length} verified document(s) on file</span>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION C — Allowed Payment Methods */}
            <div className="p-4 rounded-xl border border-zinc-200/80 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50 space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800 pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 flex items-center justify-center text-[10px] font-black">C</span>
                  Allowed Payment Methods (Channels)
                </h4>
                <span className="text-[11px] text-zinc-400">Controls options presented during retailer checkout</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <label className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer select-none transition-colors ${
                  cardEnabled ? "border-emerald-300 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20" : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 opacity-60"
                }`}>
                  <input
                    type="checkbox"
                    checked={cardEnabled}
                    onChange={(e) => setCardEnabled(e.target.checked)}
                    className="mt-0.5 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="font-bold text-zinc-900 dark:text-white block">Credit / Debit Card</span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block mt-0.5">
                      Card gateway payment (prepaid at checkout)
                    </span>
                  </div>
                </label>

                <label className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer select-none transition-colors ${
                  achEnabled ? "border-emerald-300 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20" : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 opacity-60"
                }`}>
                  <input
                    type="checkbox"
                    checked={achEnabled}
                    onChange={(e) => setAchEnabled(e.target.checked)}
                    className="mt-0.5 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="font-bold text-zinc-900 dark:text-white block">ACH Direct Transfer</span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block mt-0.5">
                      Bank direct debit (prepaid settlement)
                    </span>
                  </div>
                </label>

                <label className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer select-none transition-colors ${
                  termsEnabled ? "border-purple-300 bg-purple-50/40 dark:border-purple-900 dark:bg-purple-950/20" : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 opacity-60"
                }`}>
                  <input
                    type="checkbox"
                    checked={termsEnabled}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setTermsEnabled(checked);
                      if (checked && termsStatus !== "approved") {
                        setTermsStatus("approved");
                      } else if (!checked && termsStatus === "approved") {
                        setTermsStatus("suspended");
                      }
                    }}
                    className="mt-0.5 rounded border-zinc-300 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <span className="font-bold text-purple-900 dark:text-purple-300 block">Net Terms / Invoicing</span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block mt-0.5">
                      Post-dispatch trade credit (requires Approved status)
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* SECTION D — Payment Fee Policy & Retailer Overrides */}
            <div className="p-4 rounded-xl border border-zinc-200/80 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800 pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 flex items-center justify-center text-[10px] font-black">D</span>
                  Payment Processing Fee Overrides & Waivers
                </h4>
                <span className="text-[11px] text-zinc-400">Custom retailer surcharge supersedes global defaults</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Card Fee Override */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-900 dark:text-white">Credit / Debit Card Fee</span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      Global: 3.5%
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCardFeeMode("global")}
                      className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer text-center ${
                        cardFeeMode === "global"
                          ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      Use Global
                    </button>
                    <button
                      type="button"
                      onClick={() => setCardFeeMode("custom")}
                      className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer text-center ${
                        cardFeeMode === "custom"
                          ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      Custom %
                    </button>
                    <button
                      type="button"
                      onClick={() => setCardFeeMode("waived")}
                      className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer text-center ${
                        cardFeeMode === "waived"
                          ? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500"
                          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      Waived (0%)
                    </button>
                  </div>

                  {cardFeeMode === "custom" && (
                    <div className="pt-1 space-y-1">
                      <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                        Custom Card Fee Rate (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="10"
                          value={cardFeeCustomRate}
                          onChange={(e) => setCardFeeCustomRate(Math.max(0, Number(e.target.value) || 0))}
                          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 pr-7 text-xs font-mono font-bold outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                        />
                        <span className="absolute right-2.5 top-1.5 text-xs font-bold text-zinc-400 pointer-events-none">
                          %
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 pt-1 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                    <span>Effective Card Surcharge:</span>
                    <strong className="text-zinc-900 dark:text-white font-mono">
                      {cardFeeMode === "waived"
                        ? "0.0% (Waived)"
                        : cardFeeMode === "custom"
                        ? `${cardFeeCustomRate}% (Custom Override)`
                        : "3.5% (Global Default)"}
                    </strong>
                  </div>
                </div>

                {/* ACH Fee Override */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-900 dark:text-white">ACH Direct Transfer Fee</span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      Global: $5.00
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAchFeeMode("global")}
                      className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer text-center ${
                        achFeeMode === "global"
                          ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      Use Global
                    </button>
                    <button
                      type="button"
                      onClick={() => setAchFeeMode("custom")}
                      className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer text-center ${
                        achFeeMode === "custom"
                          ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      Custom $
                    </button>
                    <button
                      type="button"
                      onClick={() => setAchFeeMode("waived")}
                      className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer text-center ${
                        achFeeMode === "waived"
                          ? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500"
                          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      Waived ($0)
                    </button>
                  </div>

                  {achFeeMode === "custom" && (
                    <div className="pt-1 space-y-1">
                      <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                        Custom ACH Fixed Fee ($)
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1.5 text-xs font-bold text-zinc-400 pointer-events-none">
                          $
                        </span>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="25"
                          value={achFeeCustomAmount}
                          onChange={(e) => setAchFeeCustomAmount(Math.max(0, Number(e.target.value) || 0))}
                          className="w-full rounded-xl border border-zinc-200 bg-white pl-6 pr-3 py-1.5 text-xs font-mono font-bold outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                        />
                      </div>
                    </div>
                  )}

                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 pt-1 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                    <span>Effective ACH Fee:</span>
                    <strong className="text-zinc-900 dark:text-white font-mono">
                      {achFeeMode === "waived"
                        ? "$0.00 (Waived)"
                        : achFeeMode === "custom"
                        ? `$${Number(achFeeCustomAmount).toFixed(2)} (Custom Override)`
                        : "$5.00 (Global Default)"}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION E — Terms & Credit */}
            <div className="p-4 rounded-xl border border-zinc-200/80 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800 pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 flex items-center justify-center text-[10px] font-black">E</span>
                  Payment Terms & Underwritten Credit Line
                </h4>
                <span className="text-[11px] text-zinc-400">Wholesale credit limits & maturity terms</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Terms Approval Status
                  </label>
                  <select
                    value={termsStatus}
                    onChange={(e) => {
                      const newStatus = normalizeTermsStatus(e.target.value);
                      setTermsStatus(newStatus);
                      if (newStatus === "approved" && approvedTerms !== "prepaid") {
                        setTermsEnabled(true);
                      } else if (newStatus !== "approved") {
                        setTermsEnabled(false);
                      }
                    }}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-bold outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  >
                    <option value="pending">Pending Review / Underwriting</option>
                    <option value="approved">Approved (Active Credit Terms)</option>
                    <option value="suspended">Suspended (Terms Temporarily Blocked)</option>
                    <option value="rejected">Rejected (Prepaid Only)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Approved Payment Terms
                  </label>
                  <select
                    value={approvedTerms}
                    onChange={(e) => {
                      const newTerms = normalizeApprovedTerms(e.target.value);
                      setApprovedTerms(newTerms);
                      if (newTerms === "prepaid") {
                        setTermsEnabled(false);
                      } else if (termsStatus === "approved") {
                        setTermsEnabled(true);
                      }
                    }}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-bold outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  >
                    <option value="prepaid">Prepaid (Credit Card / ACH)</option>
                    <option value="net15">Net 15 Days</option>
                    <option value="net30">Net 30 Days</option>
                    <option value="net45">Net 45 Days</option>
                    <option value="net60">Net 60 Days</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Approved Credit Limit (USD)
                  </label>
                  <input
                    type="number"
                    value={creditLimit}
                    min={0}
                    step={100}
                    onChange={(e) => setCreditLimit(Math.max(0, Number(e.target.value) || 0))}
                    placeholder="0"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white font-mono font-bold"
                  />
                </div>
              </div>

              {/* Authoritative Live AR Balance & Available Credit (Phase B4 Credit Exposure) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-1">
                {/* 1. Open AR */}
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Open Invoices (AR)</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                      (data.arStatus?.openAR || 0) > 0
                        ? (data.arStatus?.hasPastDue
                            ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800")
                        : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                    }`}>
                      {(data.arStatus?.openAR || 0) > 0
                        ? `${data.arStatus?.openInvoiceCount || 1} Open Invoice(s)`
                        : "No Open AR"}
                    </span>
                  </div>
                  <p className="font-mono font-bold text-zinc-900 dark:text-white text-base">
                    {formatCurrency(data.arStatus?.openAR ?? 0)}
                  </p>
                  <p className="text-[10px] text-zinc-400 truncate">
                    {data.arStatus?.hasPastDue
                      ? `⚠️ ${formatCurrency(data.arStatus.pastDueAmount)} past due`
                      : "Unpaid active issued invoices"}
                  </p>
                </div>

                {/* 2. Unbilled Order Reservation */}
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Unbilled Reservation</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                      (data.arStatus?.unbilledReservation || 0) > 0
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}>
                      {(data.arStatus?.reservedOrdersCount || 0) > 0
                        ? `${data.arStatus?.reservedOrdersCount} Order(s)`
                        : "None"}
                    </span>
                  </div>
                  <p className="font-mono font-bold text-zinc-900 dark:text-white text-base">
                    {formatCurrency(data.arStatus?.unbilledReservation ?? 0)}
                  </p>
                  <p className="text-[10px] text-zinc-400 truncate">
                    Submitted Net Terms orders awaiting dispatch
                  </p>
                </div>

                {/* 3. Total Credit Exposure */}
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Exposure</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                      (data.arStatus?.totalExposure || (data.arStatus?.openAR || 0) + (data.arStatus?.unbilledReservation || 0)) > creditLimit && creditLimit > 0
                        ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800"
                        : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    }`}>
                      {(data.arStatus?.totalExposure || (data.arStatus?.openAR || 0) + (data.arStatus?.unbilledReservation || 0)) > creditLimit && creditLimit > 0
                        ? "Over Limit"
                        : "AR + Reserved"}
                    </span>
                  </div>
                  <p className="font-mono font-bold text-zinc-900 dark:text-white text-base">
                    {formatCurrency(data.arStatus?.totalExposure ?? ((data.arStatus?.openAR || 0) + (data.arStatus?.unbilledReservation || 0)))}
                  </p>
                  <p className="text-[10px] text-zinc-400 truncate">
                    Open AR + Unbilled Orders
                  </p>
                </div>

                {/* 4. Available Credit */}
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Available Credit</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                      (data.arStatus?.overLimitAmount || 0) > 0
                        ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800"
                        : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                    }`}>
                      {(data.arStatus?.overLimitAmount || 0) > 0
                        ? `Over: ${formatCurrency(data.arStatus?.overLimitAmount || 0)}`
                        : "Available"}
                    </span>
                  </div>
                  <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-base">
                    {formatCurrency(data.arStatus?.availableCredit ?? Math.max(0, creditLimit - ((data.arStatus?.totalExposure ?? ((data.arStatus?.openAR || 0) + (data.arStatus?.unbilledReservation || 0))))))}
                  </p>
                  <p className="text-[10px] text-zinc-400 truncate">
                    Credit Limit ({formatCurrency(creditLimit)}) − Total Exposure
                  </p>
                </div>
              </div>
            </div>

            {/* SECTION F — Internal Admin Notes */}
            <div className="p-4 rounded-xl border border-zinc-200/80 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50 space-y-2">
              <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800 pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 flex items-center justify-center text-[10px] font-black">F</span>
                  Internal Admin Operational Notes
                </h4>
                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  Confidential — Never Visible to Retailer
                </span>
              </div>
              <textarea
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                rows={3}
                placeholder="Internal underwriting notes, credit verification history, special commercial arrangements..."
                className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white resize-none"
              />
            </div>

            {/* Save CTA */}
            <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <span className="text-[11px] text-zinc-400">
                Updates are saved to authoritative <code>retailer_profiles</code> record.
              </span>
              <button
                type="button"
                onClick={handleSaveTerms}
                disabled={isPending}
                className="rounded-xl bg-zinc-900 px-6 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:hover:text-zinc-950 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500 transition-colors shadow-2xs cursor-pointer"
              >
                {isPending ? "Saving Settings..." : "Save Commercial & Compliance Settings"}
              </button>
            </div>
          </div>

          {/* Retailer Operating Agreement & Document Evidence Card */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-lg">
                  📑
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <span>Retailer Operating Agreement & Legal Evidence</span>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      Authoritative
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Electronic acceptance records, version authority, and immutable signed archival PDFs.
                  </p>
                </div>
              </div>
            </div>

            {data.agreements.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-400">
                No agreement acceptance records registered for this retailer.
              </div>
            ) : (
              <div className="space-y-3">
                {data.agreements.map((acc) => {
                  const execDate = new Date(acc.accepted_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={acc.id}
                      className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-zinc-900 dark:text-white">
                            Retailer Supply & K SELECT Platform Agreement (v{acc.agreement_version})
                          </span>
                          {acc.agreement_id && (
                            <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400 font-bold">
                              [{acc.agreement_id}]
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            acc.status === "active" || acc.pdf_status === "generated"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                              : "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                          }`}>
                            {acc.status === "active" || acc.pdf_status === "generated" ? "Executed" : "Pending Signature"}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 pt-1">
                          <div>
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">Signatory: </span>
                            <span>{acc.accepted_name} {acc.signer_title ? `(${acc.signer_title})` : ""}</span>
                          </div>
                          <div>
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">Signatory Email: </span>
                            <span className="font-mono">{acc.signer_email || "N/A"}</span>
                          </div>
                          <div>
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">Executed At: </span>
                            <span>{execDate}</span>
                          </div>
                          {acc.effective_date && (
                            <div>
                              <span className="font-medium text-zinc-700 dark:text-zinc-300">Effective Date: </span>
                              <span className="font-mono">{acc.effective_date} (Exp: {acc.expiration_date || "—"})</span>
                            </div>
                          )}
                          <div>
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">PDF Archival: </span>
                            <span className={acc.pdf_status === "generated" ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-amber-600 dark:text-amber-400"}>
                              {acc.pdf_status === "generated" ? "Archived in Supabase Storage" : acc.pdf_status === "pending" ? "Processing..." : "Generation Failed"}
                            </span>
                          </div>
                          {acc.pdf_error && (
                            <div className="col-span-full text-rose-600 text-[10px]">
                              Error: {acc.pdf_error}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Admin Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {acc.signedPdfUrl ? (
                          <>
                            <a
                              href={acc.signedPdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-200 transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                            >
                              <span>👁️</span>
                              <span>View PDF</span>
                            </a>
                            <a
                              href={acc.signedPdfUrl}
                              download={acc.pdf_filename || `retailer_agreement_v${acc.agreement_version}.pdf`}
                              className="px-3 py-1.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                            >
                              <span>⬇️</span>
                              <span>Download</span>
                            </a>
                          </>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => handleRetryAgreementPdf(acc.id)}
                          disabled={isPending || retryingPdfId === acc.id}
                          className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <span>🔄</span>
                          <span>{retryingPdfId === acc.id ? "Rendering..." : "Regenerate PDF"}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: PERFORMANCE & WEEKLY CHECK */}
      {activeTab === "performance" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                Retailer Sell-Through & Weekly Inventory Movement
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Calculated using the exact same reporting formula as the Retailer Portal (/sales).
              </p>
            </div>

            {data.stores.length > 1 && (
              <select
                value={perfStoreFilter}
                onChange={(e) => setPerfStoreFilter(e.target.value)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
              >
                <option value="all">All Stores Aggregate</option>
                {data.stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    🏪 {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Performance Stats Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 shadow-2xs">
              <span className="text-[10px] text-zinc-400 font-bold uppercase">Estimated Movement</span>
              <p className="text-xl font-black text-zinc-900 dark:text-white mt-1">
                {data.performance.estimatedMovement.toLocaleString()} units
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 shadow-2xs">
              <span className="text-[10px] text-zinc-400 font-bold uppercase">Estimated Retail Sales</span>
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {formatCurrency(data.performance.estimatedRetailSales)}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 shadow-2xs">
              <span className="text-[10px] text-zinc-400 font-bold uppercase">Estimated Gross Profit</span>
              <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                {formatCurrency(data.performance.estimatedGrossProfit)}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 shadow-2xs">
              <span className="text-[10px] text-zinc-400 font-bold uppercase">Reporting Coverage</span>
              <p className="text-xl font-black text-zinc-900 dark:text-white mt-1">
                {data.performance.coveragePercent}%
              </p>
            </div>
          </div>

          {/* Products Reorder Recommendation Table */}
          <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-3 p-5">
            <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
              Product Stock & Reorder Signals
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-100 text-[10px] font-bold text-zinc-400 uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Product / SKU</th>
                    <th className="py-2.5 px-3 text-right">Reported Remaining</th>
                    <th className="py-2.5 px-3 text-right">Est. Movement</th>
                    <th className="py-2.5 px-3 text-right">Avg Weekly</th>
                    <th className="py-2.5 px-3 text-right">Weeks of Supply</th>
                    <th className="py-2.5 px-3 text-center">Signal</th>
                    <th className="py-2.5 px-3 text-right">Recommended Reorder</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {data.performance.products.map((prod) => (
                    <tr key={prod.productId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20">
                      <td className="py-2.5 px-3 font-semibold text-zinc-900 dark:text-white">
                        {prod.productName}
                        <span className="font-mono text-[10px] text-zinc-400 block">{prod.sku}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold">{prod.totalReportedRemaining}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-indigo-600">{prod.estimatedMovement}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-zinc-600">{prod.averageWeeklyMovement}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {prod.currentWeeksOfSupply !== null ? `${prod.currentWeeksOfSupply} wks` : "-"}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                            prod.reorderSignal === "reorder_needed"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : prod.reorderSignal === "sufficient_stock"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {prod.reorderSignal.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-900 dark:text-white">
                        {prod.recommendedOrderQtyUnits > 0
                          ? `${prod.recommendedOrderQtyUnits} units (${prod.recommendedOrderCartons} cs)`
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Weekly Check Submissions History */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
            <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
              Weekly Check Submission History ({data.performance.weeklyCheckHistory.length})
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-100 text-[10px] font-bold text-zinc-400 uppercase">
                  <tr>
                    <th className="py-2 px-3">Store</th>
                    <th className="py-2 px-3">Reporting Week</th>
                    <th className="py-2 px-3">Report Date</th>
                    <th className="py-2 px-3 text-right">Items Counted</th>
                    <th className="py-2 px-3 text-right">Calculated Movement</th>
                    <th className="py-2 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {data.performance.weeklyCheckHistory.map((wc) => (
                    <tr key={wc.id}>
                      <td className="py-2 px-3 font-semibold">🏪 {wc.storeName}</td>
                      <td className="py-2 px-3 font-mono">{wc.reportingWeek}</td>
                      <td className="py-2 px-3">{formatDate(wc.reportDate)}</td>
                      <td className="py-2 px-3 text-right">{wc.itemsCount} SKUs</td>
                      <td className="py-2 px-3 text-right font-bold text-indigo-600">{wc.totalMovement} units</td>
                      <td className="py-2 px-3 text-center">
                        <span className="rounded bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 text-[9px] font-bold">
                          {wc.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: TRAINING */}
      {activeTab === "training" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Product Training Completion Progress
                </h3>
                <p className="text-xs text-zinc-500">
                  Staff completion progress for required product knowledge guides.
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-zinc-400 block">Overall Company Completion</span>
                <span className="text-lg font-black text-indigo-600">
                  {data.training.overallCompletionPercent}%
                </span>
              </div>
            </div>

            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 mt-3">
              {data.training.products.map((item) => (
                <div key={item.productId} className="py-3 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <span className="font-bold text-zinc-900 dark:text-white block">
                      {item.productName}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {item.sku} · {item.brandName}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-28 sm:w-40 bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full rounded-full transition-all"
                        style={{ width: `${item.completionPercent}%` }}
                      />
                    </div>
                    <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300 text-[11px] min-w-[45px] text-right">
                      {item.completionPercent}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: PROTECTION */}
      {activeTab === "protection" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                90-Day Initial Trial Protection Records ({data.protections.length})
              </h3>
              <p className="text-xs text-zinc-500">
                Guaranteed trial review status for curated first-order products.
              </p>
            </div>

            <Link
              href="/admin/protection-reviews"
              className="rounded-xl border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 transition-colors shadow-2xs"
            >
              Open Global Reviews Queue →
            </Link>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            {data.protections.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-200 bg-zinc-50/70 text-[10px] font-bold text-zinc-500 uppercase tracking-wider dark:border-zinc-800 dark:bg-zinc-950/40">
                  <tr>
                    <th className="py-3 px-4">Product / SKU</th>
                    <th className="py-3 px-4">Store</th>
                    <th className="py-3 px-4">Trial Period</th>
                    <th className="py-3 px-4 text-right">Protected Qty</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {data.protections.map((prot) => (
                    <tr key={prot.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20">
                      <td className="py-3 px-4">
                        <span className="font-bold text-zinc-900 dark:text-white block">
                          {prot.productName}
                        </span>
                        <span className="font-mono text-[10px] text-zinc-400">
                          {prot.productSku} · {prot.brandName}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                        {prot.storeName ? `🏪 ${prot.storeName}` : "Company General"}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        {formatDate(prot.trialStartDate)} ~ {formatDate(prot.trialEndDate)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold">
                        {prot.protectedQuantity} units
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                            prot.status === "review_requested" || prot.status === "needs_review"
                              ? "bg-rose-100 text-rose-800 border border-rose-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {prot.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/admin/protection-reviews/${prot.id}`}
                          className="text-[10px] font-bold text-indigo-600 hover:underline"
                        >
                          Review →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-10 text-center text-xs text-zinc-400">
                No 90-Day Initial Protection records active for this retailer.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 9: CASES */}
      {activeTab === "cases" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                Retailer Support Cases ({data.cases.length})
              </h3>
              <p className="text-xs text-zinc-500">
                Support inquiries submitted through the Partner Case Management system.
              </p>
            </div>

            <Link
              href="/admin/partner-inquiries"
              className="rounded-xl border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 transition-colors shadow-2xs"
            >
              Open Global Case Queue →
            </Link>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-xs dark:border-zinc-800 dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800">
            {data.cases.length > 0 ? (
              data.cases.map((c) => (
                <div key={c.id} className="p-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono font-bold text-zinc-500">#{c.caseNumber}</span>
                      <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 text-[9px] font-bold text-zinc-700 dark:text-zinc-300">
                        {c.category}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${
                          c.status === "closed"
                            ? "bg-zinc-100 text-zinc-600"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {c.status}
                      </span>
                      {c.isActionRequired && (
                        <span className="rounded bg-rose-100 text-rose-800 px-1.5 py-0.2 text-[9px] font-bold">
                          Action Required
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-zinc-900 dark:text-white">{c.title}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">
                      {c.content}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] text-zinc-400 font-mono">{formatDate(c.createdAt)}</span>
                    <Link
                      href="/admin/partner-inquiries"
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[10px] font-bold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 transition-colors shadow-2xs"
                    >
                      Open Case →
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-10 text-center text-xs text-zinc-400">
                No support tickets submitted by this retailer.
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ADD STORE */}
      {showAddStoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Add Store Location
                </h3>
                <p className="text-xs text-zinc-400">
                  Add physical storefront location, manager contact, or store code
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddStoreModal(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStore} className="space-y-4 pt-4 text-xs">
              {storeError && (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-800 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-300">
                  {storeError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Store Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newStoreName}
                    onChange={(e) => setNewStoreName(e.target.value)}
                    placeholder="e.g. Irvine Spectrum Flagship"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Store Code
                  </label>
                  <input
                    type="text"
                    value={newStoreCode}
                    onChange={(e) => setNewStoreCode(e.target.value)}
                    placeholder="e.g. STR-001"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Store Phone
                  </label>
                  <input
                    type="text"
                    value={newStorePhone}
                    onChange={(e) => setNewStorePhone(e.target.value)}
                    placeholder="(949) 555-0199"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Physical Address
                  </label>
                  <input
                    type="text"
                    value={newStoreAddress}
                    onChange={(e) => setNewStoreAddress(e.target.value)}
                    placeholder="123 Retailer Way"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={newStoreCity}
                    onChange={(e) => setNewStoreCity(e.target.value)}
                    placeholder="Irvine"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={newStoreState}
                    onChange={(e) => setNewStoreState(e.target.value)}
                    placeholder="CA"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Postal / ZIP Code
                  </label>
                  <input
                    type="text"
                    value={newStoreZip}
                    onChange={(e) => setNewStoreZip(e.target.value)}
                    placeholder="92618"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Store Email
                  </label>
                  <input
                    type="email"
                    value={newStoreEmail}
                    onChange={(e) => setNewStoreEmail(e.target.value)}
                    placeholder="store@retailer.com"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Manager Name
                  </label>
                  <input
                    type="text"
                    value={newStoreManagerName}
                    onChange={(e) => setNewStoreManagerName(e.target.value)}
                    placeholder="Store Manager"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Manager Phone
                  </label>
                  <input
                    type="text"
                    value={newStoreManagerPhone}
                    onChange={(e) => setNewStoreManagerPhone(e.target.value)}
                    placeholder="(949) 555-0199"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddStoreModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !newStoreName.trim()}
                  className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40 cursor-pointer shadow-xs dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-colors"
                >
                  {isPending ? "Creating..." : "Add Store"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INVITE USER */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                Invite Retailer Team Member
              </h3>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleInviteUser} className="space-y-4 pt-4 text-xs">
              {inviteError && (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-800 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-300">
                  {inviteError}
                </div>
              )}

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="staff@retailer.com"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Retailer Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as RetailerRole)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                >
                  <option value="owner">Owner (Full Company Control)</option>
                  <option value="buyer">Buyer (Product Catalog & Ordering)</option>
                  <option value="store_manager">Store Manager (Store Inventory & Check)</option>
                  <option value="employee">Employee (Training & Tag Printing)</option>
                  <option value="accounting">Accounting (Invoicing & Terms)</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer select-none font-semibold">
                  <input
                    type="checkbox"
                    checked={inviteAllStores}
                    onChange={(e) => setInviteAllStores(e.target.checked)}
                    className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                  />
                  <span>Grant access to all current and future stores</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !inviteEmail.trim()}
                  className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40 cursor-pointer shadow-xs dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-colors"
                >
                  {isPending ? "Sending..." : "Send Invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE ORDER FULFILLMENT */}
      {fulfillmentModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Create Shipment Fulfillment
                </h3>
                <p className="text-xs text-zinc-400">
                  Order #{fulfillmentModalOrder.orderNumber} · 🏪 {fulfillmentModalOrder.storeName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFulfillmentModalOrder(null)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateFulfillmentSubmit} className="space-y-4 pt-4 text-xs">
              {fulfillmentError && (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-800 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-300">
                  {fulfillmentError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Carrier
                  </label>
                  <select
                    value={fulfillmentCarrier}
                    onChange={(e) => setFulfillmentCarrier(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  >
                    <option value="FedEx">FedEx</option>
                    <option value="UPS">UPS</option>
                    <option value="USPS">USPS</option>
                    <option value="DHL">DHL</option>
                    <option value="Freight">Freight / Pallet</option>
                    <option value="Local Delivery">Local Delivery</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Tracking Number
                  </label>
                  <input
                    type="text"
                    value={fulfillmentTracking}
                    onChange={(e) => setFulfillmentTracking(e.target.value)}
                    placeholder="e.g. 789012345678"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              {/* Items Quantity To Ship */}
              <div className="space-y-2">
                <label className="block font-bold text-zinc-700 dark:text-zinc-300">
                  Items to Include in this Package
                </label>
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
                  {fulfillmentModalOrder.items.map((it) => {
                    const remaining = Math.max(0, it.quantity - it.quantityShipped);
                    return (
                      <div key={it.id} className="p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold text-zinc-900 dark:text-white block truncate">
                            {it.productName}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-mono">
                            {it.sku} · Ordered: {it.quantity} (Pending: {remaining})
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="number"
                            min={0}
                            max={remaining}
                            value={fulfillmentQuantities[it.id] ?? remaining}
                            onChange={(e) => {
                              const val = Math.max(0, Math.min(remaining, Number(e.target.value)));
                              setFulfillmentQuantities((prev) => ({ ...prev, [it.id]: val }));
                            }}
                            className="w-16 text-center rounded-lg border border-zinc-200 p-1 font-bold text-xs outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                          />
                          <span className="text-[10px] text-zinc-400">units</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Packing / Shipment Notes
                </label>
                <input
                  type="text"
                  value={fulfillmentNotes}
                  onChange={(e) => setFulfillmentNotes(e.target.value)}
                  placeholder="e.g. Master Carton #1 of 2"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setFulfillmentModalOrder(null)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40 cursor-pointer shadow-xs dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-colors"
                >
                  {isPending ? "Creating..." : "Confirm & Dispatch Package"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT COMPANY INFO */}
      {showCompanyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Edit Retailer Organization Information
                </h3>
                <p className="text-xs text-zinc-400">
                  Supervisory edit of legal identity, registration, contact & status
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCompanyModal(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCompanySubmit} className="space-y-4 pt-4 text-xs">
              {compModalError && (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-800 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-300">
                  {compModalError}
                </div>
              )}

              <div className="space-y-6">
                {/* SECTION 1: AUTHORITATIVE COMPANY CORE */}
                <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <div className="flex items-center justify-between border-b border-zinc-200/80 pb-2 dark:border-zinc-800">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <span>🏢</span> Section 1: Company Core Information
                    </h4>
                    <span className="text-[10px] font-medium text-zinc-400">
                      Authoritative legal identity (`companies` master)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        Company Legal Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editCompName}
                        onChange={(e) => setEditCompName(e.target.value)}
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        Company Code
                      </label>
                      <input
                        type="text"
                        disabled
                        value={data.company.companyCode || "Auto-assigned"}
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-800 text-zinc-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        Business / Tax ID
                      </label>
                      <input
                        type="text"
                        value={editCompRegNo}
                        onChange={(e) => setEditCompRegNo(e.target.value)}
                        placeholder="XX-XXXXXXX"
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        Country
                      </label>
                      <CountrySelect
                        value={editCompCountry}
                        onChange={(val) => setEditCompCountry(val)}
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        Primary Contact Name
                      </label>
                      <input
                        type="text"
                        value={editCompContactName}
                        onChange={(e) => setEditCompContactName(e.target.value)}
                        placeholder="Owner or primary representative"
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        Primary Contact Phone
                      </label>
                      <input
                        type="text"
                        value={editCompContactPhone}
                        onChange={(e) => setEditCompContactPhone(e.target.value)}
                        placeholder="+1 555-0100"
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        Company HQ Address Line 1
                      </label>
                      <input
                        type="text"
                        value={editHqAddress1}
                        onChange={(e) => setEditHqAddress1(e.target.value)}
                        placeholder="Street address or P.O. Box"
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        Company HQ Address Line 2
                      </label>
                      <input
                        type="text"
                        value={editHqAddress2}
                        onChange={(e) => setEditHqAddress2(e.target.value)}
                        placeholder="Apt, Suite, Unit, Building, Floor"
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        City
                      </label>
                      <input
                        type="text"
                        value={editHqCity}
                        onChange={(e) => setEditHqCity(e.target.value)}
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                          State
                        </label>
                        <input
                          type="text"
                          value={editHqState}
                          onChange={(e) => setEditHqState(e.target.value)}
                          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                          ZIP
                        </label>
                        <input
                          type="text"
                          value={editHqZip}
                          onChange={(e) => setEditHqZip(e.target.value)}
                          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="col-span-2">
                      <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        Company Master Status
                      </label>
                      <select
                        value={editCompStatus}
                        onChange={(e) => setEditCompStatus(e.target.value)}
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                      >
                        <option value="active">Active</option>
                        <option value="pilot">Pilot</option>
                        <option value="suspended">Suspended</option>
                        <option value="inactive">Inactive</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: RETAILER COMMERCIAL & BILLING PROFILE */}
                <div className="space-y-3 rounded-xl border border-indigo-200/80 bg-indigo-50/30 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                  <div className="flex items-center justify-between border-b border-indigo-200/60 pb-2 dark:border-indigo-900/50">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                      <span>💳</span> Section 2: Retailer Commercial & Billing Profile
                    </h4>
                    <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
                      Retailer network specific (`retailer_profiles`)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        Retailer Commercial Status
                      </label>
                      <select
                        value={editRetailerStatus}
                        onChange={(e) => setEditRetailerStatus(e.target.value)}
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                      >
                        <option value="active">Active (Normal Trading)</option>
                        <option value="pilot">Pilot / Trial</option>
                        <option value="suspended">Suspended (Blocked from Ordering)</option>
                      </select>
                    </div>

                    {/* Billing Address Configuration */}
                    <div className="col-span-2 pt-1 border-t border-indigo-100 dark:border-indigo-900/30">
                      <div className="flex items-center justify-between mb-2">
                        <label className="font-bold text-zinc-800 dark:text-zinc-200 text-xs">
                          Retailer Billing Address
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editBillingSameAsHq}
                            onChange={(e) => setEditBillingSameAsHq(e.target.checked)}
                            className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="font-medium text-[11px]">Same as Company HQ Address</span>
                        </label>
                      </div>

                      {editBillingSameAsHq ? (
                        <div className="p-2.5 rounded-lg bg-white/70 dark:bg-zinc-900/70 border border-zinc-200/70 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-400">
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300">Using Company HQ Address:</span>{" "}
                          {[editHqAddress1, editHqCity, editHqState, editHqZip].filter(Boolean).join(", ") || "(HQ address not yet entered)"}
                        </div>
                      ) : (
                        <div className="space-y-2 pt-1">
                          <input
                            type="text"
                            value={editBillingAddress}
                            onChange={(e) => setEditBillingAddress(e.target.value)}
                            placeholder="Separate Billing Street Address"
                            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                          />
                          <div className="grid grid-cols-3 gap-2">
                            <input
                              type="text"
                              value={editBillingCity}
                              onChange={(e) => setEditBillingCity(e.target.value)}
                              placeholder="Billing City"
                              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                            />
                            <input
                              type="text"
                              value={editBillingState}
                              onChange={(e) => setEditBillingState(e.target.value)}
                              placeholder="State"
                              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                            />
                            <input
                              type="text"
                              value={editBillingZip}
                              onChange={(e) => setEditBillingZip(e.target.value)}
                              placeholder="ZIP"
                              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Billing Contact Configuration */}
                    <div className="col-span-2 pt-2 border-t border-indigo-100 dark:border-indigo-900/30">
                      <div className="flex items-center justify-between mb-2">
                        <label className="font-bold text-zinc-800 dark:text-zinc-200 text-xs">
                          Retailer Billing Contact
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editBillingContactSameAsPrimary}
                            onChange={(e) => setEditBillingContactSameAsPrimary(e.target.checked)}
                            className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="font-medium text-[11px]">Same as Primary Contact</span>
                        </label>
                      </div>

                      {editBillingContactSameAsPrimary ? (
                        <div className="p-2.5 rounded-lg bg-white/70 dark:bg-zinc-900/70 border border-zinc-200/70 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-400">
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300">Using Primary Contact:</span>{" "}
                          {editCompContactName ? `${editCompContactName} (${editCompContactPhone || "No phone"})` : "(Primary contact not entered)"}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <input
                            type="text"
                            value={editBillingContactName}
                            onChange={(e) => setEditBillingContactName(e.target.value)}
                            placeholder="Billing Contact Person"
                            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                          />
                          <input
                            type="text"
                            value={editBillingContactPhone}
                            onChange={(e) => setEditBillingContactPhone(e.target.value)}
                            placeholder="Billing Phone"
                            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                          />
                        </div>
                      )}
                    </div>

                    <div className="col-span-2">
                      <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        Billing & Invoicing Email Address
                      </label>
                      <input
                        type="email"
                        value={editBillingContactEmail}
                        onChange={(e) => setEditBillingContactEmail(e.target.value)}
                        placeholder="ap@retailer.com or accounting@store.com"
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                      />
                      <span className="text-[10px] text-zinc-400 mt-1 block">
                        Commercial invoice statements, order receipts, and billing notifications are routed here.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowCompanyModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !editCompName.trim()}
                  className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40 cursor-pointer shadow-xs dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-colors"
                >
                  {isPending ? "Saving..." : "Save Company Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT STORE LOCATION */}
      {showEditStoreModal && editingStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Edit Store Location
                </h3>
                <p className="text-xs text-zinc-400">
                  Update location details, manager contact, or store code
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditStoreModal(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditStoreSubmit} className="space-y-4 pt-4 text-xs">
              {editStoreError && (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-800 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-300">
                  {editStoreError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Store Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editStoreName}
                    onChange={(e) => setEditStoreName(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Store Code
                  </label>
                  <input
                    type="text"
                    value={editStoreCode}
                    onChange={(e) => setEditStoreCode(e.target.value)}
                    placeholder="e.g. STR-001"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Store Phone
                  </label>
                  <input
                    type="text"
                    value={editStorePhone}
                    onChange={(e) => setEditStorePhone(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Physical Address
                  </label>
                  <input
                    type="text"
                    value={editStoreAddress}
                    onChange={(e) => setEditStoreAddress(e.target.value)}
                    placeholder="123 Retailer Way"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={editStoreCity}
                    onChange={(e) => setEditStoreCity(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={editStoreState}
                    onChange={(e) => setEditStoreState(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Postal / ZIP Code
                  </label>
                  <input
                    type="text"
                    value={editStoreZip}
                    onChange={(e) => setEditStoreZip(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Store Email
                  </label>
                  <input
                    type="email"
                    value={editStoreEmail}
                    onChange={(e) => setEditStoreEmail(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Manager Name
                  </label>
                  <input
                    type="text"
                    value={editStoreManagerName}
                    onChange={(e) => setEditStoreManagerName(e.target.value)}
                    placeholder="Store Manager"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Manager Phone
                  </label>
                  <input
                    type="text"
                    value={editStoreManagerPhone}
                    onChange={(e) => setEditStoreManagerPhone(e.target.value)}
                    placeholder="Direct cell"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowEditStoreModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !editStoreName.trim()}
                  className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40 cursor-pointer shadow-xs dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-colors"
                >
                  {isPending ? "Saving..." : "Save Store Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CHANGE USER ROLE */}
      {showRoleModal && roleMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Change Team Member Role
                </h3>
                <p className="text-xs text-zinc-400">
                  {roleMember.displayName || roleMember.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRoleModal(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUserRoleSubmit} className="space-y-4 pt-4 text-xs">
              {roleModalError && (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-800 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-300">
                  {roleModalError}
                </div>
              )}

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Retailer Organization Role
                </label>
                <select
                  value={userRole}
                  onChange={(e) => {
                    const nextRole = e.target.value as RetailerRole;
                    setUserRole(nextRole);
                    if (nextRole === "owner" || nextRole === "accounting") {
                      setUserRoleAllStores(true);
                    }
                  }}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                >
                  <option value="owner">Owner (Full Company Control)</option>
                  <option value="buyer">Buyer (Product Catalog & Ordering)</option>
                  <option value="store_manager">Store Manager (Store Inventory & Check)</option>
                  <option value="employee">Employee (Training & Tag Printing)</option>
                  <option value="accounting">Accounting (Invoicing & Terms)</option>
                </select>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/60 text-[11px] text-zinc-500">
                {userRole === "owner" && "Owner has full supervisory control over all stores, commercial settings, and staff."}
                {userRole === "buyer" && "Buyer can place wholesale orders, review catalog, and manage inventory protection."}
                {userRole === "store_manager" && "Store Manager submits weekly inventory checks and views store analytics."}
                {userRole === "employee" && "Employee accesses training guides and product price tags."}
                {userRole === "accounting" && "Accounting handles net terms, invoices, and bank settlements."}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40 cursor-pointer shadow-xs dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-colors"
                >
                  {isPending ? "Saving..." : "Update Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN STORE ACCESS */}
      {showAccessModal && accessMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Assign Store Locations
                </h3>
                <p className="text-xs text-zinc-400">
                  {accessMember.displayName || accessMember.email} ({accessMember.role})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAccessModal(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUserAccessSubmit} className="space-y-4 pt-4 text-xs">
              {accessModalError && (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-800 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-300">
                  {accessModalError}
                </div>
              )}

              <div>
                <label className="flex items-center gap-2 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 cursor-pointer font-bold">
                  <input
                    type="checkbox"
                    checked={accessAllStores}
                    onChange={(e) => setAccessAllStores(e.target.checked)}
                    className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                  />
                  <span>All Store Locations (Current & Future)</span>
                </label>
              </div>

              {!accessAllStores && (
                <div className="space-y-2">
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300">
                    Select Specific Stores ({accessStoreIds.length} selected)
                  </label>
                  <div className="max-h-60 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
                    {data.stores.map((st) => {
                      const checked = accessStoreIds.includes(st.id);
                      return (
                        <label
                          key={st.id}
                          className="p-3 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleAccessStore(st.id)}
                            className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-zinc-900 dark:text-white block">
                              🏪 {st.name}
                            </span>
                            <span className="text-[10px] text-zinc-400">
                              {st.city ? `${st.city}, ${st.state || ""}` : st.address || "No address"}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAccessModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40 cursor-pointer shadow-xs dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-colors"
                >
                  {isPending ? "Saving..." : "Save Store Access"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <StartImpersonationModal
        isOpen={!!impersonateMember}
        onClose={() => setImpersonateMember(null)}
        targetUser={impersonateMember ? {
          id: impersonateMember.userId,
          name: impersonateMember.displayName || impersonateMember.email,
          email: impersonateMember.email,
          status: impersonateMember.status || "active",
        } : null}
        targetCompany={{
          id: data.company.id,
          name: data.company.name,
          portalType: "RETAILER",
        }}
      />
    </div>
  );
}
