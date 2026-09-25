"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  updateRetailerTermsAction,
  createRetailerStoreAction,
  adminInviteRetailerUserAction,
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
import { RetailerRole } from "@/lib/retailer/onboarding-types";

interface RetailerDetailViewProps {
  data: {
    company: {
      id: string;
      name: string;
      businessRegistrationNumber?: string;
      country: string;
      createdAt: string;
    };
    profile: {
      status: string;
      payment_terms: string;
      payment_terms_custom?: string;
      credit_limit: number;
      payment_method_card_enabled?: boolean;
      payment_method_ach_enabled?: boolean;
      terms_enabled?: boolean;
      approved_terms?: string;
      terms_status?: string;
      resale_certificate_number?: string;
      internal_note?: string;
    };
    stores: Array<{
      id: string;
      name: string;
      city?: string;
      state?: string;
      address?: string;
      phone?: string;
      status: string;
    }>;
    members: Array<{
      userId: string;
      email: string;
      displayName: string;
      role: RetailerRole;
      hasAllStoresAccess: boolean;
      assignedStores: Array<{ id: string; name: string }>;
      joinedAt: string;
    }>;
    invitations: Array<{
      id: string;
      email: string;
      invited_name?: string;
      role: RetailerRole;
      has_all_stores_access: boolean;
      store_ids?: string[];
      status: string;
      expires_at: string;
      created_at: string;
    }>;
    agreements: Array<{
      id: string;
      agreement_type: string;
      agreement_version: string;
      accepted_name: string;
      accepted_ip?: string;
      accepted_at: string;
    }>;
    orders?: Array<{
      id: string;
      orderNumber: string;
      storeId: string;
      storeName: string;
      orderStatus: string;
      paymentStatus: string;
      paymentMethod: string;
      paymentTerms: string;
      subtotalAmount: number;
      shippingAmount: number;
      taxAmount: number;
      totalAmount: number;
      totalSkusCount: number;
      totalItemsCount: number;
      notes?: string;
      isTest: boolean;
      createdAt: string;
      items: Array<{
        id: string;
        productId: string;
        productName: string;
        productNameEn?: string | null;
        brandName: string;
        sku: string;
        quantity: number;
        unitWholesalePrice: number;
        lineTotal: number;
        quantityShipped: number;
        quantityDelivered: number;
      }>;
      fulfillments: Array<{
        id: string;
        fulfillmentNumber: string;
        orderId: string;
        status: string;
        carrier?: string;
        trackingNumber?: string;
        trackingUrl?: string;
        shippedAt?: string;
        deliveredAt?: string;
        notes?: string;
        createdAt: string;
        items: Array<{
          id: string;
          orderItemId: string;
          productId: string;
          sku: string;
          productName: string;
          quantityShipped: number;
          quantityDelivered: number;
        }>;
      }>;
    }>;
  };
}

export function RetailerDetailView({ data }: RetailerDetailViewProps) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"overview" | "orders">("overview");

  // Commercial Terms State
  const [status, setStatus] = useState(data.profile?.status || "active");
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
    data.profile?.approved_terms || "prepaid"
  );
  const [termsStatus, setTermsStatus] = useState(
    data.profile?.terms_status || "pending"
  );
  const [creditLimit, setCreditLimit] = useState(data.profile?.credit_limit || 0);
  const [resaleCert, setResaleCert] = useState(
    data.profile?.resale_certificate_number || ""
  );
  const [internalNote, setInternalNote] = useState(
    data.profile?.internal_note || ""
  );
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Add Store Modal
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreCity, setNewStoreCity] = useState("");
  const [newStoreState, setNewStoreState] = useState("");
  const [newStoreAddress, setNewStoreAddress] = useState("");
  const [newStorePhone, setNewStorePhone] = useState("");

  // Invite Staff Modal
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<RetailerRole>("store_manager");
  const [inviteAllStores, setInviteAllStores] = useState(true);
  const [inviteStoreIds, setInviteStoreIds] = useState<string[]>(
    data.stores.map((s) => s.id)
  );

  // Fulfillment Modals State
  const [selectedOrderForShipment, setSelectedOrderForShipment] = useState<any | null>(null);
  const [shipmentCarrier, setShipmentCarrier] = useState("UPS Ground");
  const [shipmentTracking, setShipmentTracking] = useState("");
  const [shipmentTrackingUrl, setShipmentTrackingUrl] = useState("");
  const [shipmentNotes, setShipmentNotes] = useState("");
  const [markImmediatelyShipped, setMarkImmediatelyShipped] = useState(true);
  const [shipmentItemQtys, setShipmentItemQtys] = useState<Record<string, number>>({});

  // Confirm Delivery Modal State
  const [selectedFulfillmentForDelivery, setSelectedFulfillmentForDelivery] = useState<any | null>(null);
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [deliveryItemQtys, setDeliveryItemQtys] = useState<Record<string, number>>({});

  const handleSaveTerms = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);

    startTransition(async () => {
      const res = await updateRetailerTermsAction(data.company.id, {
        status,
        paymentMethodCardEnabled: cardEnabled,
        paymentMethodAchEnabled: achEnabled,
        termsEnabled,
        approvedTerms,
        termsStatus,
        creditLimit: Number(creditLimit) || 0,
        resaleCertificateNumber: resaleCert.trim() || undefined,
        internalNote: internalNote.trim() || undefined,
      });

      if (res.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert(res.error || "Failed to save terms");
      }
    });
  };

  const handleCreateStore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim()) return;

    startTransition(async () => {
      const res = await createRetailerStoreAction(data.company.id, {
        name: newStoreName.trim(),
        city: newStoreCity.trim() || undefined,
        state: newStoreState.trim() || undefined,
        address: newStoreAddress.trim() || undefined,
        phone: newStorePhone.trim() || undefined,
      });

      if (res.success) {
        setIsStoreModalOpen(false);
        setNewStoreName("");
        setNewStoreCity("");
        setNewStoreState("");
        setNewStoreAddress("");
        setNewStorePhone("");
      } else {
        alert(res.error || "Failed to create store");
      }
    });
  };

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    startTransition(async () => {
      const res = await adminInviteRetailerUserAction({
        companyId: data.company.id,
        email: inviteEmail.trim(),
        name: inviteName.trim() || undefined,
        role: inviteRole,
        hasAllStoresAccess: inviteAllStores,
        storeIds: inviteAllStores ? [] : inviteStoreIds,
      });

      if (res.success) {
        setIsInviteModalOpen(false);
        setInviteEmail("");
        setInviteName("");
        alert(`Invitation sent to ${inviteEmail}`);
      } else {
        alert(res.error || "Failed to send invitation");
      }
    });
  };

  const handleResend = (invId: string) => {
    startTransition(async () => {
      const res = await resendTeamInvitationAction(invId);
      if (res.success) {
        alert("Invitation resent successfully.");
      } else {
        alert(res.error || "Failed to resend");
      }
    });
  };

  const handleRevoke = (invId: string) => {
    if (!confirm("Revoke this invitation?")) return;
    startTransition(async () => {
      const res = await revokeTeamInvitationAction(invId);
      if (res.success) {
        alert("Invitation revoked.");
      } else {
        alert(res.error || "Failed to revoke");
      }
    });
  };

  const openCreateShipmentModal = (order: any) => {
    setSelectedOrderForShipment(order);
    setShipmentCarrier("UPS Ground");
    setShipmentTracking("");
    setShipmentTrackingUrl("");
    setShipmentNotes("");
    setMarkImmediatelyShipped(true);

    const initialQtys: Record<string, number> = {};
    (order.items || []).forEach((it: any) => {
      const remaining = Math.max(0, it.quantity - (it.quantityShipped || 0));
      initialQtys[it.id] = remaining;
    });
    setShipmentItemQtys(initialQtys);
  };

  const handleCreateShipmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForShipment) return;

    const itemsPayload = (selectedOrderForShipment.items || [])
      .map((it: any) => ({
        orderItemId: it.id,
        productId: it.productId,
        quantityShipped: shipmentItemQtys[it.id] || 0,
      }))
      .filter((it: any) => it.quantityShipped > 0);

    if (itemsPayload.length === 0) {
      alert("Please specify at least 1 unit to ship.");
      return;
    }

    startTransition(async () => {
      const res = await adminCreateOrderFulfillmentAction({
        orderId: selectedOrderForShipment.id,
        carrier: shipmentCarrier,
        trackingNumber: shipmentTracking,
        trackingUrl: shipmentTrackingUrl,
        notes: shipmentNotes,
        markAsShipped: markImmediatelyShipped,
        items: itemsPayload,
      });

      if (res.success) {
        setSelectedOrderForShipment(null);
        alert("Shipment created successfully!");
      } else {
        alert(res.error || "Failed to create shipment.");
      }
    });
  };

  const openConfirmDeliveryModal = (fulfillment: any) => {
    setSelectedFulfillmentForDelivery(fulfillment);
    setDeliveryDate(new Date().toISOString().split("T")[0]);
    setDeliveryNotes("");

    const initialQtys: Record<string, number> = {};
    (fulfillment.items || []).forEach((fit: any) => {
      initialQtys[fit.id] = fit.quantityShipped;
    });
    setDeliveryItemQtys(initialQtys);
  };

  const handleConfirmDeliverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFulfillmentForDelivery) return;

    const deliveredQtys = (selectedFulfillmentForDelivery.items || []).map((fit: any) => ({
      fulfillmentItemId: fit.id,
      quantityDelivered: deliveryItemQtys[fit.id] !== undefined ? deliveryItemQtys[fit.id] : fit.quantityShipped,
    }));

    startTransition(async () => {
      const res = await adminConfirmFulfillmentDeliveryAction({
        fulfillmentId: selectedFulfillmentForDelivery.id,
        deliveredAt: new Date(deliveryDate).toISOString(),
        deliveredQuantities: deliveredQtys,
        notes: deliveryNotes,
      });

      if (res.success) {
        setSelectedFulfillmentForDelivery(null);
        alert("Delivery confirmed! Products are now verified as received.");
      } else {
        alert(res.error || "Failed to confirm delivery.");
      }
    });
  };

  const orders = data.orders || [];

  return (
    <div className="space-y-8">
      {/* Top Header Card */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
              {data.company.name}
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              Retailer Organization
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Country: {data.company.country} • Tax ID:{" "}
            {data.company.businessRegistrationNumber || "Not registered"} • Created:{" "}
            {new Date(data.company.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/retailers"
            className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            ← Back to List
          </Link>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "overview"
              ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xs"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
          }`}
        >
          🏢 Retailer Overview & Team
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("orders")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "orders"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
          }`}
        >
          <span>📦 Orders & Fulfillment</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
            {orders.length}
          </span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & TEAM */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Commercial Terms & Payment Methods Editor */}
          <div className="lg:col-span-1 space-y-6">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>💳</span>
                  <span>Commercial Setup</span>
                </h2>
                {saveSuccess && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    Saved!
                  </span>
                )}
              </div>

              <form onSubmit={handleSaveTerms} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Account Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none"
                  >
                    <option value="active">Active (Operational)</option>
                    <option value="pending_approval">Pending Approval</option>
                    <option value="suspended">Suspended (Blocked)</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                {/* Payment Methods Checkboxes */}
                <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <span className="font-bold text-zinc-900 dark:text-white block mb-1">
                    Allowed Payment Methods
                  </span>
                  <label className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cardEnabled}
                      onChange={(e) => setCardEnabled(e.target.checked)}
                      className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Credit / Debit Card (Prepaid)</span>
                  </label>
                  <label className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={achEnabled}
                      onChange={(e) => setAchEnabled(e.target.checked)}
                      className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>ACH Direct Bank Transfer (Prepaid)</span>
                  </label>
                  <label className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={termsEnabled}
                      onChange={(e) => setTermsEnabled(e.target.checked)}
                      className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-semibold text-purple-700 dark:text-purple-300">
                      Net Terms (B2B Credit Line)
                    </span>
                  </label>
                </div>

                {/* Net Terms Approval Controls */}
                {termsEnabled && (
                  <div className="p-3.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 space-y-3">
                    <div>
                      <label className="block font-semibold text-purple-900 dark:text-purple-200 mb-1">
                        Approved Terms
                      </label>
                      <select
                        value={approvedTerms}
                        onChange={(e) => setApprovedTerms(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none"
                      >
                        <option value="net15">Net 15 Days</option>
                        <option value="net30">Net 30 Days</option>
                        <option value="net45">Net 45 Days</option>
                        <option value="net60">Net 60 Days</option>
                        <option value="prepaid">Prepaid Only</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-purple-900 dark:text-purple-200 mb-1">
                        Terms Review Status
                      </label>
                      <select
                        value={termsStatus}
                        onChange={(e) => setTermsStatus(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none"
                      >
                        <option value="approved">Approved (Active)</option>
                        <option value="pending">Pending Review</option>
                        <option value="suspended">Suspended</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Credit Limit ($ USD)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Resale Tax Exemption #
                  </label>
                  <input
                    type="text"
                    value={resaleCert}
                    onChange={(e) => setResaleCert(e.target.value)}
                    placeholder="e.g. CA-RES-109283"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Admin Internal Note
                  </label>
                  <textarea
                    rows={3}
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-2 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? "Saving..." : "Update Commercial Terms"}
                </button>
              </form>
            </div>

            {/* Legal / Agreement Audit Box */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <span>📜</span>
                <span>Agreement Acceptance Audit</span>
              </h3>
              {data.agreements.length === 0 ? (
                <p className="text-[11px] text-zinc-400">
                  No legal agreements accepted yet. Required at owner onboarding.
                </p>
              ) : (
                <div className="space-y-2">
                  {data.agreements.map((ag) => (
                    <div
                      key={ag.id}
                      className="p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 text-[11px] space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-800 dark:text-emerald-300 capitalize">
                          {ag.agreement_type.replace(/_/g, " ")} ({ag.agreement_version})
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {new Date(ag.accepted_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-zinc-600 dark:text-zinc-400">
                        Signer: <span className="font-semibold text-zinc-900 dark:text-white">{ag.accepted_name}</span>
                      </p>
                      {ag.accepted_ip && (
                        <p className="text-zinc-400 font-mono text-[10px]">IP: {ag.accepted_ip}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Stores, Users & Invitations */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stores List */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>📍</span>
                  <span>Store Locations ({data.stores.length})</span>
                </h2>
                <button
                  onClick={() => setIsStoreModalOpen(true)}
                  className="px-3 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold cursor-pointer"
                >
                  + Add Store
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.stores.map((st) => (
                  <div
                    key={st.id}
                    className="p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/50 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-zinc-900 dark:text-white">{st.name}</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                        {st.status}
                      </span>
                    </div>
                    {(st.city || st.state) && (
                      <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                        {[st.city, st.state].filter(Boolean).join(", ")}
                      </p>
                    )}
                    {st.address && (
                      <p className="text-zinc-400 text-[10px] truncate">{st.address}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Active Users */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>👥</span>
                  <span>Active Retailer Team Members ({data.members.length})</span>
                </h2>
                <button
                  onClick={() => setIsInviteModalOpen(true)}
                  className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                >
                  + Invite User
                </button>
              </div>

              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.members.length === 0 ? (
                  <div className="py-6 text-center text-xs text-zinc-400">
                    No active users yet. Owner or staff must accept invitation.
                  </div>
                ) : (
                  data.members.map((mem) => (
                    <div key={mem.userId} className="py-3 flex items-center justify-between gap-4 text-xs">
                      <div>
                        <p className="font-bold text-zinc-900 dark:text-white">
                          {mem.displayName || mem.email}
                        </p>
                        <p className="text-[11px] text-zinc-400 font-mono">{mem.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 capitalize">
                          {mem.role.replace(/_/g, " ")}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {mem.hasAllStoresAccess ? "All Stores" : `${mem.assignedStores.length} stores`}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Pending Invitations */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-3 flex items-center gap-2">
                <span>✉️</span>
                <span>Pending Invitations ({data.invitations.length})</span>
              </h2>

              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.invitations.length === 0 ? (
                  <div className="py-4 text-center text-xs text-zinc-400">
                    No pending invitations.
                  </div>
                ) : (
                  data.invitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="py-3 flex items-center justify-between gap-4 text-xs"
                    >
                      <div>
                        <p className="font-bold text-zinc-900 dark:text-white">
                          {inv.invited_name || inv.email}
                        </p>
                        <p className="text-[11px] text-zinc-400 font-mono">{inv.email}</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">
                          Role: {inv.role} • Expires: {new Date(inv.expires_at).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleResend(inv.id)}
                          disabled={isPending}
                          className="px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
                        >
                          Resend
                        </button>
                        <button
                          onClick={() => handleRevoke(inv.id)}
                          disabled={isPending}
                          className="px-2.5 py-1 rounded border border-rose-200 dark:border-rose-900 text-[10px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer disabled:opacity-50"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ORDERS & FULFILLMENT */}
      {activeTab === "orders" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>📦</span>
                  <span>Retailer Purchase Orders & Shipments</span>
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Track orders, fulfill shipments with tracking numbers, and record confirmed delivered units.
                </p>
              </div>
            </div>

            {orders.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-400 space-y-2">
                <span className="text-2xl block">🛒</span>
                <p>No orders placed by this retailer yet.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {orders.map((ord) => (
                  <div
                    key={ord.id}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30 overflow-hidden"
                  >
                    {/* Order Top Bar */}
                    <div className="p-4 sm:p-5 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-zinc-900 dark:text-white">
                            Order #{ord.orderNumber}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              ord.orderStatus === "delivered"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                                : ord.orderStatus === "shipped"
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400"
                                : ord.orderStatus === "processing"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                            }`}
                          >
                            {ord.orderStatus}
                          </span>
                          {ord.isTest && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                              TEST
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Store: <strong className="text-zinc-800 dark:text-zinc-200">{ord.storeName}</strong> • Placed:{" "}
                          {new Date(ord.createdAt).toLocaleDateString()} • {ord.totalSkusCount} SKUs ({ord.totalItemsCount} units)
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-sm font-bold text-zinc-900 dark:text-white">
                            ${ord.totalAmount.toFixed(2)}
                          </div>
                          <span className="text-[10px] font-semibold text-zinc-500 uppercase">
                            {ord.paymentStatus} ({ord.paymentMethod})
                          </span>
                        </div>

                        {ord.orderStatus !== "delivered" && ord.orderStatus !== "cancelled" && (
                          <button
                            type="button"
                            onClick={() => openCreateShipmentModal(ord)}
                            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                          >
                            + Create Shipment
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Order Items & Fulfillments Detail */}
                    <div className="p-4 sm:p-5 space-y-4">
                      {/* Products Summary Table */}
                      <div className="rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
                        <div className="px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-200/80 dark:border-zinc-800 text-[11px] font-bold text-zinc-600 dark:text-zinc-300">
                          Ordered Products & Line Fulfillment
                        </div>
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                          {ord.items.map((it) => (
                            <div key={it.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <span className="font-bold text-zinc-900 dark:text-white">{it.productName}</span>
                                <span className="text-zinc-400 font-mono text-[11px] ml-2">({it.sku})</span>
                                <div className="text-[11px] text-zinc-400">{it.brandName}</div>
                              </div>
                              <div className="flex items-center gap-4 text-xs">
                                <div>
                                  Ordered: <strong>{it.quantity}</strong>
                                </div>
                                <div className={it.quantityShipped > 0 ? "text-purple-600 dark:text-purple-400 font-semibold" : "text-zinc-400"}>
                                  Shipped: <strong>{it.quantityShipped}</strong>
                                </div>
                                <div className={it.quantityDelivered > 0 ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-zinc-400"}>
                                  Delivered: <strong>{it.quantityDelivered}</strong>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Fulfillments (Shipments) List */}
                      {ord.fulfillments && ord.fulfillments.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                            Fulfillment Packages ({ord.fulfillments.length}):
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {ord.fulfillments.map((ful) => (
                              <div
                                key={ful.id}
                                className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2 text-xs"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-zinc-900 dark:text-white">
                                    {ful.fulfillmentNumber}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                      ful.status === "delivered"
                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                                        : ful.status === "shipped"
                                        ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400"
                                        : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                                    }`}
                                  >
                                    {ful.status}
                                  </span>
                                </div>

                                <div className="text-[11px] text-zinc-500 space-y-0.5">
                                  <div>
                                    Carrier: <strong className="text-zinc-800 dark:text-zinc-200">{ful.carrier || "Standard"}</strong>
                                    {ful.trackingNumber && (
                                      <span className="ml-1 font-mono text-indigo-600 dark:text-indigo-400">
                                        ({ful.trackingNumber})
                                      </span>
                                    )}
                                  </div>
                                  {ful.shippedAt && (
                                    <div>Shipped: {new Date(ful.shippedAt).toLocaleDateString()}</div>
                                  )}
                                  {ful.deliveredAt && (
                                    <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                      Delivered: {new Date(ful.deliveredAt).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>

                                {/* Items in this shipment */}
                                <div className="pt-1 border-t border-zinc-100 dark:border-zinc-800 text-[11px] space-y-1">
                                  {ful.items.map((fit) => (
                                    <div key={fit.id} className="flex justify-between text-zinc-600 dark:text-zinc-400">
                                      <span className="truncate max-w-[180px]">{fit.productName}</span>
                                      <span>
                                        {fit.quantityShipped} shp
                                        {ful.status === "delivered" && (
                                          <strong className="text-emerald-600 dark:text-emerald-400 ml-1">
                                            / {fit.quantityDelivered} dlv
                                          </strong>
                                        )}
                                      </span>
                                    </div>
                                  ))}
                                </div>

                                {/* Actions on this fulfillment */}
                                {ful.status !== "delivered" && (
                                  <div className="pt-2 flex justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800">
                                    <button
                                      type="button"
                                      onClick={() => openConfirmDeliveryModal(ful)}
                                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                                    >
                                      ✓ Confirm Delivery
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE SHIPMENT / FULFILL ORDER */}
      {selectedOrderForShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="max-w-lg w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xl space-y-4 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Create Shipment Fulfillment
                </h3>
                <p className="text-[11px] text-zinc-400">
                  Order #{selectedOrderForShipment.orderNumber} • Destination: {selectedOrderForShipment.storeName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderForShipment(null)}
                className="text-zinc-400 hover:text-zinc-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateShipmentSubmit} className="space-y-4">
              {/* Items to ship */}
              <div className="space-y-2">
                <label className="block font-bold text-zinc-900 dark:text-white">
                  Products to Ship in this Fulfillment:
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {(selectedOrderForShipment.items || []).map((it: any) => {
                    const remainingMax = Math.max(0, it.quantity - (it.quantityShipped || 0));
                    return (
                      <div
                        key={it.id}
                        className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-zinc-900 dark:text-white truncate">{it.productName}</p>
                          <p className="text-[10px] text-zinc-400 font-mono">
                            SKU: {it.sku} • Total Ordered: {it.quantity} (Prev Shipped: {it.quantityShipped || 0})
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <label className="text-[11px] text-zinc-500">Qty:</label>
                          <input
                            type="number"
                            min="0"
                            max={remainingMax}
                            value={shipmentItemQtys[it.id] ?? remainingMax}
                            onChange={(e) =>
                              setShipmentItemQtys((prev) => ({
                                ...prev,
                                [it.id]: Math.min(remainingMax, Math.max(0, parseInt(e.target.value, 10) || 0)),
                              }))
                            }
                            className="w-16 px-2 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-center font-bold text-zinc-900 dark:text-white"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Carrier & Tracking */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Carrier</label>
                  <select
                    value={shipmentCarrier}
                    onChange={(e) => setShipmentCarrier(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none"
                  >
                    <option value="UPS Ground">UPS Ground</option>
                    <option value="UPS Express">UPS Express</option>
                    <option value="FedEx Ground">FedEx Ground</option>
                    <option value="FedEx Express">FedEx Express</option>
                    <option value="USPS Priority">USPS Priority</option>
                    <option value="DHL Express">DHL Express</option>
                    <option value="LTL Freight">LTL Freight</option>
                    <option value="Direct Courier">Direct Courier</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Tracking Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 1Z9999999999999999"
                    value={shipmentTracking}
                    onChange={(e) => setShipmentTracking(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Tracking URL (Optional)</label>
                <input
                  type="url"
                  placeholder="https://www.ups.com/track?tracknum=..."
                  value={shipmentTrackingUrl}
                  onChange={(e) => setShipmentTrackingUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Shipment Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Box 1 of 2, Pallet A"
                  value={shipmentNotes}
                  onChange={(e) => setShipmentNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950"
                />
              </div>

              <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40">
                <label className="flex items-center gap-2 text-purple-900 dark:text-purple-300 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={markImmediatelyShipped}
                    onChange={(e) => setMarkImmediatelyShipped(e.target.checked)}
                    className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span>Mark as Shipped immediately upon creation</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setSelectedOrderForShipment(null)}
                  className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold disabled:opacity-50"
                >
                  {isPending ? "Creating..." : "Confirm & Create Shipment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRM DELIVERY */}
      {selectedFulfillmentForDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="max-w-lg w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xl space-y-4 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Confirm Delivery: {selectedFulfillmentForDelivery.fulfillmentNumber}
                </h3>
                <p className="text-[11px] text-zinc-400">
                  Carrier: {selectedFulfillmentForDelivery.carrier || "Standard"} • Tracking: {selectedFulfillmentForDelivery.trackingNumber || "N/A"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFulfillmentForDelivery(null)}
                className="text-zinc-400 hover:text-zinc-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmDeliverySubmit} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300">
                <strong>Business Invariant:</strong> Recording confirmed delivery establishes the official received inventory for Weekly Product Checks and Protection Sell-Through tracking.
              </div>

              {/* Delivery Date */}
              <div>
                <label className="block font-semibold mb-1">Delivered Date *</label>
                <input
                  type="date"
                  required
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950"
                />
              </div>

              {/* Item quantities delivered */}
              <div className="space-y-2">
                <label className="block font-bold text-zinc-900 dark:text-white">
                  Confirmed Received Quantities per Product:
                </label>
                <div className="space-y-2">
                  {(selectedFulfillmentForDelivery.items || []).map((fit: any) => (
                    <div
                      key={fit.id}
                      className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-zinc-900 dark:text-white truncate">{fit.productName}</p>
                        <p className="text-[10px] text-zinc-400 font-mono">
                          SKU: {fit.sku} • Shipped: {fit.quantityShipped} units
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <label className="text-[11px] text-zinc-500">Delivered:</label>
                        <input
                          type="number"
                          min="0"
                          max={fit.quantityShipped}
                          value={deliveryItemQtys[fit.id] ?? fit.quantityShipped}
                          onChange={(e) =>
                            setDeliveryItemQtys((prev) => ({
                              ...prev,
                              [fit.id]: Math.min(fit.quantityShipped, Math.max(0, parseInt(e.target.value, 10) || 0)),
                            }))
                          }
                          className="w-16 px-2 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-center font-bold text-zinc-900 dark:text-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Delivery Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Left at front desk, signed by manager"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setSelectedFulfillmentForDelivery(null)}
                  className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50"
                >
                  {isPending ? "Confirming..." : "Confirm Delivery ✓"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Store Modal */}
      {isStoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="max-w-md w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xl space-y-4 text-xs">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2">
              Add Store Location
            </h3>
            <form onSubmit={handleCreateStore} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Store Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Branch Store #2"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">City</label>
                  <input
                    type="text"
                    value={newStoreCity}
                    onChange={(e) => setNewStoreCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">State</label>
                  <input
                    type="text"
                    value={newStoreState}
                    onChange={(e) => setNewStoreState(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Street Address</label>
                <input
                  type="text"
                  value={newStoreAddress}
                  onChange={(e) => setNewStoreAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsStoreModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold"
                >
                  Add Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Staff Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="max-w-md w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xl space-y-4 text-xs">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2">
              Invite Retailer Staff Member
            </h3>
            <form onSubmit={handleSendInvite} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as RetailerRole)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950"
                >
                  <option value="store_manager">Store Manager</option>
                  <option value="employee">Store Staff</option>
                  <option value="buyer">Buyer</option>
                  <option value="accounting">Accounting</option>
                  <option value="owner">Owner</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-bold"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
