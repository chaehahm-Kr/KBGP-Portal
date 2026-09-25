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
import {
  updateTeamMemberRoleAction,
  updateTeamMemberStoreAccessAction,
  setTeamMemberStatusAction,
} from "@/lib/retailer/organization-actions";

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
  const [isPending, startTransition] = useTransition();

  // 1. Invite Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
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

  // 2. Edit Role Modal State
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<RetailerTeamMember | null>(null);
  const [editRole, setEditRole] = useState<RetailerRole>("employee");
  const [editRoleAllStores, setEditRoleAllStores] = useState(true);
  const [editRoleStoreIds, setEditRoleStoreIds] = useState<string[]>([]);
  const [roleError, setRoleError] = useState("");

  // 3. Edit Store Access Modal State
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [accessMember, setAccessMember] = useState<RetailerTeamMember | null>(null);
  const [accessHasAllStores, setAccessHasAllStores] = useState(true);
  const [accessStoreIds, setAccessStoreIds] = useState<string[]>([]);
  const [accessError, setAccessError] = useState("");

  const isOwner = currentUserRole.toLowerCase() === "owner";
  const canManageTeam = ["owner", "buyer"].includes(currentUserRole.toLowerCase());

  // Invite Store selection toggle
  const handleStoreToggle = (storeId: string) => {
    setFormSelectedStoreIds((prev) =>
      prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId]
    );
  };

  const handleOpenInviteModal = () => {
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
          window.location.reload();
        }, 1200);
      } else {
        setStatusMessage({
          type: "error",
          text: res.error || "Failed to send invitation.",
        });
      }
    });
  };

  // Resend / Revoke
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

  // Edit Role Handlers
  const handleOpenRoleModal = (member: RetailerTeamMember) => {
    setSelectedMember(member);
    setEditRole(member.role);
    setEditRoleAllStores(member.hasAllStoresAccess ?? (member.role === "owner"));
    setEditRoleStoreIds(member.assignedStores.map((s) => s.id));
    setRoleError("");
    setIsRoleModalOpen(true);
  };

  const handleSaveRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    setRoleError("");

    startTransition(async () => {
      const res = await updateTeamMemberRoleAction({
        targetUserId: selectedMember.id,
        newRole: editRole,
        hasAllStoresAccess: editRoleAllStores,
        storeIds: editRoleAllStores ? [] : editRoleStoreIds,
      });

      if (res.success) {
        setIsRoleModalOpen(false);
        window.location.reload();
      } else {
        setRoleError(res.error || "Failed to update member role.");
      }
    });
  };

  // Edit Store Access Handlers
  const handleOpenAccessModal = (member: RetailerTeamMember) => {
    setAccessMember(member);
    setAccessHasAllStores(member.hasAllStoresAccess ?? (member.role === "owner"));
    setAccessStoreIds(member.assignedStores.map((s) => s.id));
    setAccessError("");
    setIsAccessModalOpen(true);
  };

  const handleAccessStoreToggle = (storeId: string) => {
    setAccessStoreIds((prev) =>
      prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId]
    );
  };

  const handleSaveAccess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessMember) return;
    setAccessError("");

    if (!accessHasAllStores && accessStoreIds.length === 0) {
      setAccessError("Please select at least one assigned store.");
      return;
    }

    startTransition(async () => {
      const res = await updateTeamMemberStoreAccessAction({
        targetUserId: accessMember.id,
        hasAllStoresAccess: accessHasAllStores,
        storeIds: accessHasAllStores ? [] : accessStoreIds,
      });

      if (res.success) {
        setIsAccessModalOpen(false);
        window.location.reload();
      } else {
        setAccessError(res.error || "Failed to update store access.");
      }
    });
  };

  // Toggle User Status (Active / Disabled)
  const handleToggleMemberStatus = (member: RetailerTeamMember) => {
    const isCurrentlyActive = (member.status || "active").toLowerCase() === "active";
    const nextStatus = isCurrentlyActive ? "suspended" : "active";

    const promptText = isCurrentlyActive
      ? `Disable account for ${member.name || member.email}?\n\nThey will no longer be able to sign in to Retailer Portal. Historical records, orders, and weekly checks submitted by this user will remain preserved.`
      : `Reactivate account for ${member.name || member.email}?`;

    if (!confirm(promptText)) return;

    startTransition(async () => {
      const res = await setTeamMemberStatusAction({
        targetUserId: member.id,
        status: nextStatus,
      });

      if (res.success) {
        window.location.reload();
      } else {
        alert(res.error || "Failed to update member status.");
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">
            Team & Staff Access Control
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Invite employees, assign operational roles, and configure store permissions for{" "}
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{companyName}</span>.
          </p>
        </div>

        {canManageTeam && (
          <button
            type="button"
            onClick={handleOpenInviteModal}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shadow-2xs shrink-0 cursor-pointer"
          >
            <span>+</span>
            <span>Invite Team Member</span>
          </button>
        )}
      </div>

      {/* Active Team Members Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <span>Team Members</span>
            <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
              {members.length}
            </span>
          </h3>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Store Access</th>
                  <th className="py-3 px-4">Status</th>
                  {isOwner && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={isOwner ? 5 : 4} className="py-8 text-center text-zinc-400 text-xs">
                      No team members found.
                    </td>
                  </tr>
                ) : (
                  members.map((member) => {
                    const roleConfig = ROLE_LABELS[member.role] || ROLE_LABELS.employee;
                    const isActive = (member.status || "active").toLowerCase() === "active";

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

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              isActive
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                                : "bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-zinc-400"}`} />
                            {isActive ? "Active" : "Disabled"}
                          </span>
                        </td>

                        {isOwner && (
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenRoleModal(member)}
                                className="px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                              >
                                Role
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenAccessModal(member)}
                                className="px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                              >
                                Stores
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleMemberStatus(member)}
                                className={`px-2 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                                  isActive
                                    ? "border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900/60 dark:text-amber-400"
                                    : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/60 dark:text-emerald-400"
                                }`}
                              >
                                {isActive ? "Disable" : "Enable"}
                              </button>
                            </div>
                          </td>
                        )}
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
            <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              {invitations.length}
            </span>
          </h3>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
          {invitations.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-400">
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
                          type="button"
                          onClick={() => handleResendInvite(inv.id, inv.email)}
                          disabled={isPending}
                          className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Resend
                        </button>
                        <button
                          type="button"
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

      {/* MODAL 1: Invite Team Member Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Invite Team Member
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Send a secure single-use email invitation link.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-3.5 pt-3 text-xs">
              {statusMessage && (
                <div
                  className={`p-2.5 rounded-lg text-xs font-semibold ${
                    statusMessage.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300"
                      : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300"
                  }`}
                >
                  {statusMessage.text}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="employee@retailer.com"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Full Name <span className="font-normal text-zinc-400">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Operational Role <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(Object.keys(ROLE_LABELS) as RetailerRole[]).map((r) => {
                    const config = ROLE_LABELS[r];
                    const isSelected = formRole === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setFormRole(r);
                          if (r === "owner") setFormHasAllStores(true);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900 shadow-2xs"
                            : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                        }`}
                      >
                        <p className="font-bold text-[11px]">{config.label}</p>
                        <p className="text-[10px] opacity-80 mt-0.5 line-clamp-2">{config.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Store Location Scope */}
              {formRole !== "owner" && (
                <div className="space-y-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                    Store Location Scope
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormHasAllStores(true)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                        formHasAllStores
                          ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white"
                          : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      All Stores ({stores.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormHasAllStores(false)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                        !formHasAllStores
                          ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white"
                          : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      Specific Stores
                    </button>
                  </div>

                  {!formHasAllStores && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 max-h-32 overflow-y-auto">
                      {stores.map((st) => (
                        <label
                          key={st.id}
                          className="flex items-center gap-2 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formSelectedStoreIds.includes(st.id)}
                            onChange={() => handleStoreToggle(st.id)}
                            className="rounded text-zinc-900"
                          />
                          <span className="text-xs text-zinc-800 dark:text-zinc-200 truncate">
                            {st.name} {st.city ? `(${st.city})` : ""}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !formEmail.trim()}
                  className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 cursor-pointer shadow-xs"
                >
                  {isPending ? "Sending..." : "Send Invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Change Role Modal */}
      {isRoleModalOpen && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Change Role
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Update role for {selectedMember.name || selectedMember.email}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRoleModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="space-y-3 pt-3 text-xs">
              {roleError && (
                <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/15 dark:text-red-400">
                  {roleError}
                </div>
              )}

              <div className="space-y-2">
                {(Object.keys(ROLE_LABELS) as RetailerRole[]).map((r) => {
                  const config = ROLE_LABELS[r];
                  const isSelected = editRole === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        setEditRole(r);
                        if (r === "owner") setEditRoleAllStores(true);
                      }}
                      className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900 shadow-2xs"
                          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                      }`}
                    >
                      <div>
                        <p className="font-bold text-xs">{config.label}</p>
                        <p className="text-[10px] opacity-75 mt-0.5">{config.desc}</p>
                      </div>
                      {isSelected && <span>✓</span>}
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 cursor-pointer shadow-xs"
                >
                  {isPending ? "Saving..." : "Update Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Edit Store Access Modal */}
      {isAccessModalOpen && accessMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Assign Store Locations
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Select allowed stores for {accessMember.name || accessMember.email}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAccessModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAccess} className="space-y-3 pt-3 text-xs">
              {accessError && (
                <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/15 dark:text-red-400">
                  {accessError}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAccessHasAllStores(true)}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                    accessHasAllStores
                      ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white"
                      : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  All Stores ({stores.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAccessHasAllStores(false)}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                    !accessHasAllStores
                      ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white"
                      : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  Specific Stores
                </button>
              </div>

              {!accessHasAllStores && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pt-1">
                  {stores.map((st) => (
                    <label
                      key={st.id}
                      className="flex items-center gap-2 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={accessStoreIds.includes(st.id)}
                        onChange={() => handleAccessStoreToggle(st.id)}
                        className="rounded text-zinc-900"
                      />
                      <span className="text-xs text-zinc-800 dark:text-zinc-200 truncate">
                        🏪 {st.name} {st.city ? `(${st.city})` : ""}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAccessModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 cursor-pointer shadow-xs"
                >
                  {isPending ? "Saving..." : "Save Store Access"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
