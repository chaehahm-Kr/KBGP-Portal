"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { logoutRetailer } from "@/lib/auth/actions";
import {
  updatePersonalProfileAction,
  updateRetailerCompanyInfoAction,
  addRetailerStoreByOwnerAction,
  updateRetailerStoreByOwnerAction,
  setRetailerStoreStatusByOwnerAction,
} from "@/lib/retailer/organization-actions";
import { TeamManagementView } from "@/components/retailer/team-management-view";
import { RetailerTeamMember, RetailerInvitationItem } from "@/lib/retailer/onboarding-types";
import { RetailerAgreementViewItem, RetailerDocumentRecord } from "@/lib/retailer/agreement-actions";

export interface StoreLocationItem {
  id: string;
  name: string;
  storeCode?: string | null;
  status: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  phone?: string | null;
  email?: string | null;
  managerName?: string | null;
  managerPhone?: string | null;
  assignedUsersCount?: number;
}

export interface CompanyInfoItem {
  id: string;
  name: string;
  businessRegistrationNumber?: string | null;
  country: string;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  status: string;
  // Commercial terms (read-only for retailer)
  paymentTerms?: string | null;
  creditLimit?: number | null;
  termsEnabled?: boolean | null;
  approvedTerms?: string | null;
  resaleCertificateNumber?: string | null;
}

export interface PersonalProfileItem {
  id: string;
  displayName: string;
  email: string;
  phone?: string | null;
  role: string;
}

interface AccountOrganizationViewProps {
  currentTab: "account" | "organization" | "team" | "documents";
  profile: PersonalProfileItem;
  company: CompanyInfoItem;
  stores: StoreLocationItem[];
  teamMembers: RetailerTeamMember[];
  pendingInvitations: RetailerInvitationItem[];
  agreements?: RetailerAgreementViewItem[];
  documents?: RetailerDocumentRecord[];
}

export function AccountOrganizationView({
  currentTab,
  profile,
  company,
  stores,
  teamMembers,
  pendingInvitations,
  agreements = [],
  documents = [],
}: AccountOrganizationViewProps) {
  const [isPending, startTransition] = useTransition();

  // 1. Personal Profile Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileDisplayName, setProfileDisplayName] = useState(profile.displayName);
  const [profilePhone, setProfilePhone] = useState(profile.phone || "");
  const [profileError, setProfileError] = useState("");

  // 2. Company Info Modal State
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [compName, setCompName] = useState(company.name);
  const [compRegNo, setCompRegNo] = useState(company.businessRegistrationNumber || "");
  const [compCountry, setCompCountry] = useState(company.country || "US");
  const [compContactName, setCompContactName] = useState(company.contactName || "");
  const [compContactPhone, setCompContactPhone] = useState(company.contactPhone || "");
  const [compContactEmail, setCompContactEmail] = useState(company.contactEmail || "");
  const [compAddress, setCompAddress] = useState(company.address || "");
  const [compCity, setCompCity] = useState(company.city || "");
  const [compState, setCompState] = useState(company.state || "");
  const [compZip, setCompZip] = useState(company.zip || "");
  const [companyError, setCompanyError] = useState("");

  // 3. Store Add/Edit Modal State
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreLocationItem | null>(null);
  const [storeName, setStoreName] = useState("");
  const [storeCode, setStoreCode] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storeCity, setStoreCity] = useState("");
  const [storeState, setStoreState] = useState("");
  const [storeZip, setStoreZip] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeEmail, setStoreEmail] = useState("");
  const [storeManagerName, setStoreManagerName] = useState("");
  const [storeManagerPhone, setStoreManagerPhone] = useState("");
  const [sameAsCompany, setSameAsCompany] = useState(false);
  const [storeError, setStoreError] = useState("");

  const isOwner = profile.role === "owner";
  const isOwnerOrBuyer = ["owner", "buyer"].includes(profile.role);

  // Profile Handlers
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");

    if (!profileDisplayName.trim()) {
      setProfileError("Display name cannot be empty.");
      return;
    }

    startTransition(async () => {
      const res = await updatePersonalProfileAction({
        displayName: profileDisplayName.trim(),
        phone: profilePhone.trim() || undefined,
      });

      if (res.success) {
        setIsProfileModalOpen(false);
        window.location.reload();
      } else {
        setProfileError(res.error || "Failed to update personal profile.");
      }
    });
  };

  // Company Handlers
  const handleOpenCompanyModal = () => {
    setCompName(company.name);
    setCompRegNo(company.businessRegistrationNumber || "");
    setCompCountry(company.country || "US");
    setCompContactName(company.contactName || "");
    setCompContactPhone(company.contactPhone || "");
    setCompContactEmail(company.contactEmail || "");
    setCompAddress(company.address || "");
    setCompCity(company.city || "");
    setCompState(company.state || "");
    setCompZip(company.zip || "");
    setCompanyError("");
    setIsCompanyModalOpen(true);
  };

  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    setCompanyError("");

    if (!compName.trim()) {
      setCompanyError("Company name is required.");
      return;
    }

    startTransition(async () => {
      const res = await updateRetailerCompanyInfoAction({
        companyId: company.id,
        name: compName.trim(),
        businessRegistrationNumber: compRegNo.trim() || undefined,
        contactName: compContactName.trim() || undefined,
        contactPhone: compContactPhone.trim() || undefined,
        contactEmail: compContactEmail.trim() || undefined,
        address: compAddress.trim() || undefined,
        city: compCity.trim() || undefined,
        state: compState.trim() || undefined,
        zip: compZip.trim() || undefined,
      });

      if (res.success) {
        setIsCompanyModalOpen(false);
        window.location.reload();
      } else {
        setCompanyError(res.error || "Failed to update company info.");
      }
    });
  };

  // Store Handlers
  const handleOpenAddStoreModal = () => {
    setEditingStore(null);
    setStoreName("");
    setStoreCode("");
    setStoreAddress("");
    setStoreCity("");
    setStoreState("");
    setStoreZip("");
    setStorePhone("");
    setStoreEmail("");
    setStoreManagerName("");
    setStoreManagerPhone("");
    setSameAsCompany(false);
    setStoreError("");
    setIsStoreModalOpen(true);
  };

  const handleOpenEditStoreModal = (st: StoreLocationItem) => {
    setEditingStore(st);
    setStoreName(st.name);
    setStoreCode(st.storeCode || "");
    setStoreAddress(st.address || "");
    setStoreCity(st.city || "");
    setStoreState(st.state || "");
    setStoreZip(st.zip || "");
    setStorePhone(st.phone || "");
    setStoreEmail(st.email || "");
    setStoreManagerName(st.managerName || "");
    setStoreManagerPhone(st.managerPhone || "");
    setSameAsCompany(false);
    setStoreError("");
    setIsStoreModalOpen(true);
  };

  const handleToggleSameAsCompany = (checked: boolean) => {
    setSameAsCompany(checked);
    if (checked) {
      setStoreAddress(company.address || "");
      setStoreCity(company.city || "");
      setStoreState(company.state || "");
      setStoreZip(company.zip || "");
      if (company.contactPhone) setStorePhone(company.contactPhone);
    }
  };

  const handleSaveStore = (e: React.FormEvent) => {
    e.preventDefault();
    setStoreError("");

    if (!storeName.trim()) {
      setStoreError("Store name is required.");
      return;
    }

    startTransition(async () => {
      if (editingStore) {
        const res = await updateRetailerStoreByOwnerAction({
          storeId: editingStore.id,
          name: storeName.trim(),
          storeCode: storeCode.trim() || undefined,
          address: storeAddress.trim() || undefined,
          city: storeCity.trim() || undefined,
          state: storeState.trim() || undefined,
          zip: storeZip.trim() || undefined,
          phone: storePhone.trim() || undefined,
          email: storeEmail.trim() || undefined,
          managerName: storeManagerName.trim() || undefined,
          managerPhone: storeManagerPhone.trim() || undefined,
        });

        if (res.success) {
          setIsStoreModalOpen(false);
          window.location.reload();
        } else {
          setStoreError(res.error || "Failed to update store.");
        }
      } else {
        const res = await addRetailerStoreByOwnerAction({
          companyId: company.id,
          name: storeName.trim(),
          storeCode: storeCode.trim() || undefined,
          address: storeAddress.trim() || undefined,
          city: storeCity.trim() || undefined,
          state: storeState.trim() || undefined,
          zip: storeZip.trim() || undefined,
          phone: storePhone.trim() || undefined,
          email: storeEmail.trim() || undefined,
          managerName: storeManagerName.trim() || undefined,
          managerPhone: storeManagerPhone.trim() || undefined,
        });

        if (res.success) {
          setIsStoreModalOpen(false);
          window.location.reload();
        } else {
          setStoreError(res.error || "Failed to add store.");
        }
      }
    });
  };

  const handleToggleStoreStatus = (st: StoreLocationItem) => {
    const isCurrentlyActive = st.status === "active";
    const nextStatus = isCurrentlyActive ? "inactive" : "active";

    const promptText = isCurrentlyActive
      ? `Are you sure you want to deactivate "${st.name}"?\n\nHistorical transactions, orders, and weekly count records for this store will remain preserved, but the store will no longer be available for new orders or inventory counts.`
      : `Reactivate "${st.name}" for active store operations?`;

    if (!confirm(promptText)) return;

    startTransition(async () => {
      const res = await setRetailerStoreStatusByOwnerAction({
        storeId: st.id,
        status: nextStatus,
      });

      if (res.success) {
        window.location.reload();
      } else {
        alert(res.error || "Failed to update store status.");
      }
    });
  };

  const roleTitle = profile.role.charAt(0).toUpperCase() + profile.role.slice(1);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
            Account & Organization Settings
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Manage your personal credentials, retail organization information, store locations, and team staff access.
          </p>
        </div>
      </div>

      {/* Tabs Switcher (4 Clean Responsive Tabs) */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto pb-px">
        <nav className="flex space-x-1 sm:space-x-2 min-w-max">
          {/* Tab 1: Account Information */}
          <Link
            href="/account?tab=account"
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors border-b-2 -mb-px flex items-center gap-2 ${
              currentTab === "account"
                ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white bg-zinc-100/60 dark:bg-zinc-900/60"
                : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            <span>👤</span>
            <span>Account Information</span>
          </Link>

          {/* Tab 2: Company & Store Locations */}
          <Link
            href="/account?tab=organization"
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors border-b-2 -mb-px flex items-center gap-2 ${
              currentTab === "organization"
                ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white bg-zinc-100/60 dark:bg-zinc-900/60"
                : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            <span>🏢</span>
            <span>Company & Store Locations</span>
            <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              {stores.length}
            </span>
          </Link>

          {/* Tab 3: Team & Staff Access */}
          {isOwnerOrBuyer ? (
            <Link
              href="/account?tab=team"
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors border-b-2 -mb-px flex items-center gap-2 ${
                currentTab === "team"
                  ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white bg-zinc-100/60 dark:bg-zinc-900/60"
                  : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <span>👥</span>
              <span>Team & Staff Access</span>
              {pendingInvitations.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-500 text-white">
                  {pendingInvitations.length}
                </span>
              )}
            </Link>
          ) : null}

          {/* Tab 4: Agreements & Documents */}
          <Link
            href="/account?tab=documents"
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors border-b-2 -mb-px flex items-center gap-2 ${
              currentTab === "documents"
                ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white bg-zinc-100/60 dark:bg-zinc-900/60"
                : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            <span>📄</span>
            <span>Agreements & Documents</span>
            {agreements.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                {agreements.length}
              </span>
            )}
          </Link>
        </nav>
      </div>

      {/* TAB 1 CONTENT: ACCOUNT INFORMATION */}
      {currentTab === "account" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal Profile Card */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-700 dark:text-zinc-300">
                      {profile.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                        Personal Profile
                      </h2>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Authenticated user identity</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileDisplayName(profile.displayName);
                      setProfilePhone(profile.phone || "");
                      setProfileError("");
                      setIsProfileModalOpen(true);
                    }}
                    className="px-3 py-1 text-xs font-bold rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                  >
                    Edit Profile
                  </button>
                </div>

                <div className="space-y-3 text-xs pt-3">
                  <div>
                    <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block">Display Name</span>
                    <span className="font-semibold text-zinc-900 dark:text-white">{profile.displayName}</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block">Login / Email Address</span>
                    <span className="font-mono text-zinc-900 dark:text-white">{profile.email}</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block">Contact Phone</span>
                    <span className="text-zinc-900 dark:text-white font-mono">{profile.phone || "Not recorded"}</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block">Assigned Retailer Role</span>
                    <div className="inline-flex items-center gap-1.5 mt-0.5 px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 capitalize">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      {roleTitle}
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-zinc-400 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                Display name and phone are self-service. Role changes require Company Owner authorization.
              </p>
            </div>

            {/* Login & Security Card */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-lg">
                      🔒
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                        Login & Security
                      </h2>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Authentication & active session</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 text-xs pt-3">
                  <div>
                    <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block">Authentication Method</span>
                    <span className="font-semibold text-zinc-900 dark:text-white">Email & Secure Password</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block">Active Login Email</span>
                    <span className="font-mono text-zinc-900 dark:text-white">{profile.email}</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block">Session Status</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">Active & Verified</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block">Permission Authority</span>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-300 mt-0.5">
                      {isOwner
                        ? "Full Owner authority: Can manage company profile, add/edit store locations, invite staff, and execute agreements."
                        : "Staff member: Authorized for assigned store inventory counts, orders, and training modules."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <form action={logoutRetailer}>
                  <button
                    type="submit"
                    className="w-full py-2 px-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>🚪</span>
                    <span>Sign Out of Retailer Portal</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2 CONTENT: COMPANY & STORE LOCATIONS */}
      {currentTab === "organization" && (
        <div className="space-y-6">
          {/* Section A: Company Information */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-lg">
                  🏢
                </div>
                <div>
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <span>Company Information</span>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      Legal Entity
                    </span>
                  </h2>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Corporate legal entity, registration details, headquarters address, and commercial terms.
                  </p>
                </div>
              </div>

              {isOwner && (
                <button
                  type="button"
                  onClick={handleOpenCompanyModal}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer shrink-0"
                >
                  Edit Company Information
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs pt-1">
              <div>
                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 block">Legal Company Name</span>
                <span className="font-bold text-zinc-900 dark:text-white text-sm block mt-0.5">{company.name}</span>
              </div>
              <div>
                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 block">Registration / Tax ID</span>
                <span className="font-mono font-semibold text-zinc-900 dark:text-white block mt-0.5">
                  {company.businessRegistrationNumber || "Not recorded"}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 block">Country</span>
                <span className="font-semibold text-zinc-900 dark:text-white block mt-0.5">🇺🇸 {company.country}</span>
              </div>

              <div>
                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 block">Primary Contact Name</span>
                <span className="text-zinc-900 dark:text-white font-medium block mt-0.5">{company.contactName || "—"}</span>
              </div>
              <div>
                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 block">Company Phone</span>
                <span className="text-zinc-800 dark:text-zinc-200 font-mono block mt-0.5">{company.contactPhone || "—"}</span>
              </div>
              <div>
                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 block">Company Email</span>
                <span className="text-zinc-800 dark:text-zinc-200 font-mono block mt-0.5">{company.contactEmail || "—"}</span>
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 block">Headquarters / Billing Address</span>
                <span className="text-zinc-800 dark:text-zinc-200 block mt-0.5">
                  {company.address
                    ? `${company.address}${company.city ? `, ${company.city}` : ""}${company.state ? ` ${company.state}` : ""}${company.zip ? ` ${company.zip}` : ""}`
                    : "No corporate address recorded"}
                </span>
              </div>
            </div>

            {/* Commercial Terms Summary (Read-Only) */}
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-2">
              <div>
                <span className="text-zinc-400 block text-[10px] font-medium">Payment & Commercial Terms</span>
                <span className="font-bold text-zinc-900 dark:text-white">
                  {company.approvedTerms || company.paymentTerms || "Prepaid Card"}
                  {company.creditLimit ? ` · Credit Limit: $${company.creditLimit.toLocaleString()}` : ""}
                </span>
              </div>
              <span className="px-2.5 py-1 rounded text-[10px] font-semibold bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 shrink-0">
                Admin Underwritten
              </span>
            </div>
          </div>

          {/* Section B: Store Locations */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg">
                  📍
                </div>
                <div>
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <span>Physical Store Locations</span>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                      {stores.length}
                    </span>
                  </h2>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Physical storefront retail operating locations. Each store maintains separate weekly inventory counts, assortment, and price tags.
                  </p>
                </div>
              </div>

              {isOwnerOrBuyer && (
                <button
                  type="button"
                  onClick={handleOpenAddStoreModal}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shadow-2xs cursor-pointer shrink-0"
                >
                  <span>+</span>
                  <span>Add Store</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {stores.length === 0 ? (
                <div className="col-span-full py-12 text-center text-xs text-zinc-400 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-2xl mx-auto">
                    🏪
                  </div>
                  <div>
                    <p className="font-bold text-zinc-800 dark:text-zinc-200">No store locations have been added yet.</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      A Company operates through its physical Store locations. Add your first store location to enable ordering and weekly inventory counts.
                    </p>
                  </div>
                  {isOwnerOrBuyer && (
                    <button
                      type="button"
                      onClick={handleOpenAddStoreModal}
                      className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold hover:bg-zinc-800 cursor-pointer"
                    >
                      + Add First Store Location
                    </button>
                  )}
                </div>
              ) : (
                stores.map((st) => {
                  const isActive = st.status === "active";
                  return (
                    <div
                      key={st.id}
                      className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                        isActive
                          ? "border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900"
                          : "border-zinc-200/60 dark:border-zinc-800/50 bg-zinc-100/40 dark:bg-zinc-950/40 opacity-75"
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-zinc-900 dark:text-white">
                                🏪 {st.name}
                              </span>
                              {st.storeCode && (
                                <span className="text-[10px] font-mono text-zinc-400">
                                  ({st.storeCode})
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                              {st.address ? `${st.address}, ` : ""}{st.city ? `${st.city}, ${st.state || ""}` : "Address pending"}
                            </p>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
                              isActive
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                                : "bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                            }`}
                          >
                            {isActive ? "Active" : "Inactive"}
                          </span>
                        </div>

                        {(st.phone || st.managerName || st.email) && (
                          <div className="pt-2 text-[10px] text-zinc-500 border-t border-zinc-100 dark:border-zinc-800/80 space-y-0.5 font-mono">
                            {st.phone && <div>📞 {st.phone}</div>}
                            {st.email && <div>✉️ {st.email}</div>}
                            {st.managerName && <div>👤 Manager: {st.managerName}</div>}
                          </div>
                        )}
                      </div>

                      {isOwnerOrBuyer && (
                        <div className="pt-3 mt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => handleOpenEditStoreModal(st)}
                            className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStoreStatus(st)}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                              isActive
                                ? "border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-400"
                                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-400"
                            }`}
                          >
                            {isActive ? "Deactivate" : "Reactivate"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3 CONTENT: TEAM & STAFF ACCESS */}
      {currentTab === "team" && (
        isOwnerOrBuyer ? (
          <TeamManagementView
            currentUserRole={profile.role}
            companyId={company.id}
            companyName={company.name}
            stores={stores.map((s) => ({ id: s.id, name: s.name, city: s.city || undefined }))}
            initialMembers={teamMembers}
            initialInvitations={pendingInvitations}
          />
        ) : (
          <div className="p-8 text-center text-xs text-zinc-500 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            Team management is restricted to Company Owners and Buyers.
          </div>
        )
      )}

      {/* TAB 4 CONTENT: AGREEMENTS & DOCUMENTS */}
      {currentTab === "documents" && (
        <div className="space-y-6">
          {/* Section 1: Retailer Operating Agreements */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-lg">
                  📑
                </div>
                <div>
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <span>Retailer Operating Agreements</span>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      Authoritative
                    </span>
                  </h2>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Official executed operating terms, weekly inventory counting obligations, and 90-day trial risk protection.
                  </p>
                </div>
              </div>
            </div>

            {agreements.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-400">
                No agreement acceptance records found for your organization.
              </div>
            ) : (
              <div className="space-y-3">
                {agreements.map((acc) => {
                  const execDate = new Date(acc.acceptedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={acc.id}
                      className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-zinc-900 dark:text-white">
                            K SELECT Retailer Operating Agreement (v{acc.agreementVersion})
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Active Standard
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                          <div>
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">Executed by: </span>
                            <span>{acc.acceptedName} ({acc.signerTitle || "Representative"})</span>
                          </div>
                          <div>
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">Signatory Email: </span>
                            <span className="font-mono">{acc.signerEmail || profile.email}</span>
                          </div>
                          <div>
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">Timestamp: </span>
                            <span>{execDate}</span>
                          </div>
                          <div>
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">PDF Archival: </span>
                            <span className={acc.pdfStatus === "generated" ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-amber-600 dark:text-amber-400"}>
                              {acc.pdfStatus === "generated" ? "Archived & Verified" : acc.pdfStatus === "pending" ? "Processing..." : "Issue rendering PDF"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
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
                              download={acc.pdfFilename || `kselect_retailer_agreement_v${acc.agreementVersion}.pdf`}
                              className="px-3.5 py-1.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                            >
                              <span>⬇️</span>
                              <span>Download PDF</span>
                            </a>
                          </>
                        ) : (
                          <span className="text-[11px] text-zinc-400 italic">
                            PDF generating in background...
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: General Organization Documents Archive */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center text-lg">
                📁
              </div>
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Document Archive
                </h2>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  All official company certificates, invoices, and signed files associated with your retail account.
                </p>
              </div>
            </div>

            {documents.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-400">
                No additional archived files for your organization at this time.
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {documents.map((doc) => (
                  <div key={doc.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-zinc-900 dark:text-white">{doc.title}</p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{doc.description || doc.filename}</p>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {new Date(doc.createdAt).toLocaleDateString("en-US")} {doc.fileSizeBytes ? `• ${(doc.fileSizeBytes / 1024).toFixed(1)} KB` : ""}
                      </span>
                    </div>

                    {doc.signedUrl && (
                      <a
                        href={doc.signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 text-xs font-bold rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors inline-flex items-center gap-1 shrink-0"
                      >
                        <span>⬇️ Download</span>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: Personal Profile Edit Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                Edit Personal Profile
              </h3>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3.5 pt-4 text-xs">
              {profileError && (
                <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/15 dark:text-red-400">
                  {profileError}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Display Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={profileDisplayName}
                  onChange={(e) => setProfileDisplayName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  placeholder="e.g. John Doe"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Contact Phone <span className="text-zinc-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white font-mono"
                  placeholder="e.g. +1 (555) 123-4567"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 cursor-pointer shadow-xs"
                >
                  {isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Company Information Edit Modal (Owner Only) */}
      {isCompanyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Edit Company Information
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Update your business legal name, registration ID, and contact details.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCompanyModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCompany} className="space-y-3 pt-3 text-xs">
              {companyError && (
                <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/15 dark:text-red-400">
                  {companyError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Company Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={compName}
                    onChange={(e) => setCompName(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Registration / Tax ID
                  </label>
                  <input
                    type="text"
                    value={compRegNo}
                    onChange={(e) => setCompRegNo(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Primary Contact Name
                  </label>
                  <input
                    type="text"
                    value={compContactName}
                    onChange={(e) => setCompContactName(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    value={compContactPhone}
                    onChange={(e) => setCompContactPhone(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={compContactEmail}
                    onChange={(e) => setCompContactEmail(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Headquarters / Billing Address
                </label>
                <input
                  type="text"
                  value={compAddress}
                  onChange={(e) => setCompAddress(e.target.value)}
                  placeholder="Street address, Suite / Unit #"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={compCity}
                    onChange={(e) => setCompCity(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={compState}
                    onChange={(e) => setCompState(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    value={compZip}
                    onChange={(e) => setCompZip(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCompanyModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 cursor-pointer shadow-xs"
                >
                  {isPending ? "Saving..." : "Save Company"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Add / Edit Store Location Modal */}
      {isStoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  {editingStore ? "Edit Store Location" : "Add Store Location"}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Specify physical storefront name, address, and manager contact details.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsStoreModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStore} className="space-y-3 pt-3 text-xs">
              {storeError && (
                <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/15 dark:text-red-400">
                  {storeError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Store Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="e.g. Beauty World - Downtown"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Store Code <span className="text-zinc-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={storeCode}
                    onChange={(e) => setStoreCode(e.target.value)}
                    placeholder="e.g. ST-001"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              {/* Convenience Prefill Checkbox when adding a store */}
              {!editingStore && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800">
                  <input
                    type="checkbox"
                    id="sameAsCompany"
                    checked={sameAsCompany}
                    onChange={(e) => handleToggleSameAsCompany(e.target.checked)}
                    className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                  />
                  <label htmlFor="sameAsCompany" className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
                    Same as Company Address (Pre-fill from Corporate Headquarters)
                  </label>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Physical Store Address
                </label>
                <input
                  type="text"
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  placeholder="Street address, unit/suite #"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={storeCity}
                    onChange={(e) => setStoreCity(e.target.value)}
                    placeholder="e.g. Los Angeles"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={storeState}
                    onChange={(e) => setStoreState(e.target.value)}
                    placeholder="e.g. CA"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    value={storeZip}
                    onChange={(e) => setStoreZip(e.target.value)}
                    placeholder="e.g. 90001"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Store Phone
                  </label>
                  <input
                    type="text"
                    value={storePhone}
                    onChange={(e) => setStorePhone(e.target.value)}
                    placeholder="e.g. +1 (555) 000-1111"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Store Email
                  </label>
                  <input
                    type="email"
                    value={storeEmail}
                    onChange={(e) => setStoreEmail(e.target.value)}
                    placeholder="e.g. store1@retailer.com"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Manager Contact Name
                  </label>
                  <input
                    type="text"
                    value={storeManagerName}
                    onChange={(e) => setStoreManagerName(e.target.value)}
                    placeholder="e.g. Jane Smith"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Manager Phone
                  </label>
                  <input
                    type="text"
                    value={storeManagerPhone}
                    onChange={(e) => setStoreManagerPhone(e.target.value)}
                    placeholder="e.g. +1 (555) 000-2222"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsStoreModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 cursor-pointer shadow-xs"
                >
                  {isPending ? "Saving..." : editingStore ? "Update Store" : "Create Store"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
