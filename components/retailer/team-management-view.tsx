"use client";

import React, { useState, useTransition } from "react";
import {
  RetailerRole,
  RetailerTeamMember,
  RetailerInvitationItem,
} from "@/lib/retailer/onboarding-types";
import {
  inviteTeamMemberAction,
  resendTeamInvitationAction,
  revokeTeamInvitationAction,
} from "@/app/retailer/account/team-actions";

interface TeamManagementViewProps {
  currentUserRole: string;
  companyId: string;
  companyName: string;
  stores: Array<{ id: string; name: string; city?: string }>;
  initialMembers: RetailerTeamMember[];
  initialInvitations: RetailerInvitationItem[];
}

const ROLE_LABELS: Record<RetailerRole, { label: string; desc: string; badgeClass: string }> = {
  owner: {
    label: "Owner",
    desc: "Full organization access, commercial terms, team management, and all stores.",
    badgeClass: "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  },
  buyer: {
    label: "Buyer / Purchasing",
    desc: "Can place purchase orders, view sales & analytics, and access reorder tools.",
    badgeClass: "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  },
  store_manager: {
    label: "Store Manager",
    desc: "Manages store inventory, weekly physical counts, and price tag printing.",
    badgeClass: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  },
  employee: {
    label: "Store Staff",
    desc: "Conducts weekly store physical counts, QR scans, and staff product training.",
    badgeClass: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700",
  },
  accounting: {
    label: "Accounting",
    desc: "View invoices, settlement reports, and financial transactions.",
    badgeClass: "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  },
};

export function TeamManagementView({
  currentUserRole,
  companyId,
  companyName,
  stores,
  initialMembers,
  initialInvitations,
}: TeamManagementViewProps) {
  const [members, setMembers] = useState<RetailerTeamMember[]>(initialMembers);
  const [invitations, setInvitations] = useState<RetailerInvitationItem[]>(initialInvitations);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Invite Form State
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState<RetailerRole>("employee");
  const [formHasAllStores, setFormHasAllStores] = useState(true);
  const [formSelectedStoreIds, setFormSelectedStoreIds] = useState<string[]>(
    stores.map((s) => s.id)
  );
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const canManageTeam = ["owner", "buyer"].includes(currentUserRole.toLowerCase());

  // Store selection toggle
  const handleStoreToggle = (storeId: string) => {
    setFormSelectedStoreIds((prev) =>
      prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId]
    );
  };

  const handleOpenModal = () => {
    setStatusMessage(null);
    setFormEmail("");
    setFormName("");
    setFormRole("employee");
    setFormHasAllStores(true);
    setFormSelectedStoreIds(stores.map((s) => s.id));
    setIsInviteModalOpen(true);
  };

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmail.trim()) {
      setStatusMessage({ type: "error", text: "Email address is required." });
      return;
    }

    if (!formHasAllStores && formSelectedStoreIds.length === 0) {
      setStatusMessage({
        type: "error",
        text: "Please select at least one assigned store location.",
      });
      return;
    }

    startTransition(async () => {
      const res = await inviteTeamMemberAction({
        companyId,
        email: formEmail.trim(),
        role: formRole,
        hasAllStoresAccess: formHasAllStores,
        storeIds: formHasAllStores ? [] : formSelectedStoreIds,
      });

      if (res.success) {
        setStatusMessage({
          type: "success",
          text: `Invitation successfully sent to ${formEmail}.`,
        });
        setTimeout(() => {
          setIsInviteModalOpen(false);
        }, 1200);
      } else {
        setStatusMessage({
          type: "error",
          text: res.error || "Failed to send invitation.",
        });
      }
    });
  };

  const handleResendInvite = (invitationId: string, email: string) => {
    startTransition(async () => {
      const res = await resendTeamInvitationAction(invitationId);
      if (res.success) {
        alert(`Invitation resent to ${email}`);
      } else {
        alert(res.error || "Failed to resend invitation.");
      }
    });
  };

  const handleRevokeInvite = (invitationId: string) => {
    if (!confirm("Are you sure you want to revoke this invitation? The link will become invalid.")) {
      return;
    }

    startTransition(async () => {
      const res = await revokeTeamInvitationAction(invitationId);
      if (res.success) {
        setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
      } else {
        alert(res.error || "Failed to revoke invitation.");
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">
            Team & Staff Access Control
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Invite employees, assign operational roles, and specify store location permissions for{" "}
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{companyName}</span>.
          </p>
        </div>

        {canManageTeam && (
          <button
            onClick={handleOpenModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer"
          >
            <span>➕</span>
            <span>Invite Team Member</span>
          </button>
        )}
      </div>

      {/* Active Team Members Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <span>Active Team Members</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
              {members.length}
            </span>
          </h3>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Store Access</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-zinc-500 text-xs">
                      No active team members found.
                    </td>
                  </tr>
                ) : (
                  members.map((member) => {
                    const roleConfig = ROLE_LABELS[member.role] || ROLE_LABELS.employee;
                    return (
                      <tr key={member.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs flex items-center justify-center shrink-0">
                              {(member.name || member.email).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-zinc-900 dark:text-white">
                                {member.name || "—"}
                              </p>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                                {member.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold border ${roleConfig.badgeClass}`}
                          >
                            {roleConfig.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {member.hasAllStoresAccess || member.role === "owner" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                              <span>✓</span> All Stores ({stores.length})
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {member.assignedStores.length === 0 ? (
                                <span className="text-[11px] text-zinc-400">No stores assigned</span>
                              ) : (
                                member.assignedStores.map((st) => (
                                  <span
                                    key={st.id}
                                    className="px-2 py-0.5 rounded text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium"
                                  >
                                    📍 {st.name}
                                  </span>
                                ))
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pending Invitations Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <span>Pending Invitations</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              {invitations.length}
            </span>
          </h3>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
          {invitations.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
              No pending invitations. All invited members have completed onboarding.
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {invitations.map((inv) => {
                const roleConfig = ROLE_LABELS[inv.role as RetailerRole] || ROLE_LABELS.employee;
                const isExpired = new Date(inv.expiresAt) < new Date();
                return (
                  <div
                    key={inv.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-zinc-900 dark:text-white">
                          {inv.email}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${roleConfig.badgeClass}`}
                        >
                          {roleConfig.label}
                        </span>
                        {isExpired && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                            Expired
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 font-mono">{inv.email}</p>
                      <p className="text-[10px] text-zinc-400">
                        {inv.hasAllStoresAccess
                          ? "Access: All Stores"
                          : `Access: ${inv.storeIds?.length || 0} designated stores`}{" "}
                        • Sent: {new Date(inv.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    {canManageTeam && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleResendInvite(inv.id, inv.email)}
                          disabled={isPending}
                          className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Resend Email
                        </button>
                        <button
                          onClick={() => handleRevokeInvite(inv.id)}
                          disabled={isPending}
                          className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-[11px] font-semibold text-rose-600 dark:text-rose-400 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Revoke
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="max-w-lg w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Invite New Team Member
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Send an official onboarding invitation to join {companyName}
                </p>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {statusMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-medium border ${
                  statusMessage.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                    : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                }`}
              >
                {statusMessage.text}
              </div>
            )}

            <form onSubmit={handleSendInvite} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Full Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alex Kim"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@retailer.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Assigned Role *
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as RetailerRole)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="employee">Store Staff (Counts & Training)</option>
                  <option value="store_manager">Store Manager (Store Ops & Counts)</option>
                  <option value="buyer">Buyer / Purchasing (Orders & Catalog)</option>
                  <option value="accounting">Accounting (Invoices & Billing)</option>
                  <option value="owner">Owner (Full Admin Access)</option>
                </select>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                  {ROLE_LABELS[formRole]?.desc}
                </p>
              </div>

              {/* Store Access Options */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300">
                  Store Access Scope
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hasAllStores"
                    checked={formHasAllStores}
                    onChange={(e) => setFormHasAllStores(e.target.checked)}
                    className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="hasAllStores" className="text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    Grant access to all store locations (current & future)
                  </label>
                </div>

                {!formHasAllStores && (
                  <div className="mt-2 space-y-1.5 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 max-h-36 overflow-y-auto">
                    {stores.map((st) => (
                      <label
                        key={st.id}
                        className="flex items-center gap-2 text-[11px] text-zinc-700 dark:text-zinc-300 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formSelectedStoreIds.includes(st.id)}
                          onChange={() => handleStoreToggle(st.id)}
                          className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>{st.name} {st.city ? `(${st.city})` : ""}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isPending ? "Sending..." : "Send Invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
