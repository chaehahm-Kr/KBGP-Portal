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
  };
}

export function RetailerDetailView({ data }: RetailerDetailViewProps) {
  const [isPending, startTransition] = useTransition();

  // Commercial Terms State
  const [status, setStatus] = useState(data.profile?.status || "active");
  const [paymentTerms, setPaymentTerms] = useState(data.profile?.payment_terms || "PREPAID_CARD");
  const [creditLimit, setCreditLimit] = useState(data.profile?.credit_limit || 0);
  const [resaleCert, setResaleCert] = useState(data.profile?.resale_certificate_number || "");
  const [internalNote, setInternalNote] = useState(data.profile?.internal_note || "");
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
  const [inviteStoreIds, setInviteStoreIds] = useState<string[]>(data.stores.map((s) => s.id));

  const handleSaveTerms = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);

    startTransition(async () => {
      const res = await updateRetailerTermsAction(data.company.id, {
        status,
        paymentTerms,
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Commercial Terms Editor */}
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

            <form onSubmit={handleSaveTerms} className="space-y-3 text-xs">
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

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Payment Terms
                </label>
                <select
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none"
                >
                  <option value="PREPAID_CARD">Prepaid (Credit Card)</option>
                  <option value="PREPAID_ACH">Prepaid (ACH / Bank)</option>
                  <option value="NET_30">Net 30 Days</option>
                  <option value="NET_45">Net 45 Days</option>
                  <option value="NET_60">Net 60 Days</option>
                </select>
              </div>

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
