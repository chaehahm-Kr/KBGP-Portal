"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  RetailerShippingAddress,
  CreateShippingAddressInput,
  UpdateShippingAddressInput,
  StoreShippingOption,
  ResolvedDefaultShippingDestination,
} from "@/lib/retailer/shipping-address-types";
import {
  createRetailerShippingAddressAction,
  updateRetailerShippingAddressAction,
  deleteRetailerShippingAddressAction,
  setDefaultRetailerShippingAddressAction,
  unsetDefaultRetailerShippingAddressAction,
  setDefaultStoreShippingAction,
  unsetDefaultStoreShippingAction,
} from "@/lib/retailer/shipping-address-actions";

interface ShippingSettingsViewProps {
  initialAddresses: RetailerShippingAddress[];
  stores?: StoreShippingOption[];
  initialDefaultDestination?: ResolvedDefaultShippingDestination | null;
  companyName: string;
}

export function RetailerShippingSettingsView({
  initialAddresses,
  stores = [],
  initialDefaultDestination = null,
  companyName,
}: ShippingSettingsViewProps) {
  const [addresses, setAddresses] = useState<RetailerShippingAddress[]>(initialAddresses);
  const [storesList, setStoresList] = useState<StoreShippingOption[]>(stores);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<RetailerShippingAddress | null>(null);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [label, setLabel] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [attentionName, setAttentionName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [phone, setPhone] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const openCreateModal = () => {
    setEditingAddress(null);
    setLabel("");
    setRecipientName("");
    setAttentionName("");
    setAddressLine1("");
    setAddressLine2("");
    setCity("");
    setState("");
    setZip("");
    setPhone("");
    setDeliveryNotes("");
    setIsDefault(addresses.length === 0);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const openEditModal = (addr: RetailerShippingAddress) => {
    setEditingAddress(addr);
    setLabel(addr.label);
    setRecipientName(addr.recipientName);
    setAttentionName(addr.attentionName || "");
    setAddressLine1(addr.addressLine1);
    setAddressLine2(addr.addressLine2 || "");
    setCity(addr.city);
    setState(addr.state);
    setZip(addr.zip);
    setPhone(addr.phone || "");
    setDeliveryNotes(addr.deliveryNotes || "");
    setIsDefault(addr.isDefault);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!label.trim() || !recipientName.trim() || !addressLine1.trim() || !city.trim() || !state.trim() || !zip.trim()) {
      setErrorMsg("Please fill in all required fields (Label, Recipient, Address, City, State, ZIP).");
      return;
    }

    startTransition(async () => {
      if (editingAddress) {
        const updatePayload: UpdateShippingAddressInput = {
          label: label.trim(),
          recipientName: recipientName.trim(),
          attentionName: attentionName.trim() || undefined,
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim() || undefined,
          city: city.trim(),
          state: state.trim().toUpperCase(),
          zip: zip.trim(),
          phone: phone.trim() || undefined,
          deliveryNotes: deliveryNotes.trim() || undefined,
          isDefault,
        };

        const res = await updateRetailerShippingAddressAction(editingAddress.id, updatePayload);
        if (res.success && res.data) {
          setAddresses((prev) =>
            prev.map((a) => {
              if (a.id === editingAddress.id) return res.data!;
              if (isDefault) return { ...a, isDefault: false };
              return a;
            })
          );
          if (isDefault) {
            setStoresList((prev) => prev.map((s) => ({ ...s, isExplicitDefault: false })));
          }
          setSuccessMsg("Shipping address updated successfully.");
          setIsModalOpen(false);
          setTimeout(() => setSuccessMsg(null), 3000);
        } else {
          setErrorMsg(res.error || "Failed to update address.");
        }
      } else {
        const createPayload: CreateShippingAddressInput = {
          label: label.trim(),
          recipientName: recipientName.trim(),
          attentionName: attentionName.trim() || undefined,
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim() || undefined,
          city: city.trim(),
          state: state.trim().toUpperCase(),
          zip: zip.trim(),
          phone: phone.trim() || undefined,
          deliveryNotes: deliveryNotes.trim() || undefined,
          isDefault,
        };

        const res = await createRetailerShippingAddressAction(createPayload);
        if (res.success && res.data) {
          setAddresses((prev) => {
            const nextList = isDefault ? prev.map((a) => ({ ...a, isDefault: false })) : [...prev];
            return [res.data!, ...nextList];
          });
          if (isDefault) {
            setStoresList((prev) => prev.map((s) => ({ ...s, isExplicitDefault: false })));
          }
          setSuccessMsg("Shipping address added successfully.");
          setIsModalOpen(false);
          setTimeout(() => setSuccessMsg(null), 3000);
        } else {
          setErrorMsg(res.error || "Failed to create address.");
        }
      }
    });
  };

  const handleSetDefault = (id: string) => {
    startTransition(async () => {
      const res = await setDefaultRetailerShippingAddressAction(id);
      if (res.success) {
        setAddresses((prev) =>
          prev.map((a) => ({
            ...a,
            isDefault: a.id === id,
          }))
        );
        setStoresList((prev) =>
          prev.map((s) => ({
            ...s,
            isExplicitDefault: false,
          }))
        );
        setSuccessMsg("Default shipping address updated.");
        setTimeout(() => setSuccessMsg(null), 2500);
      } else {
        setErrorMsg(res.error || "Failed to update default address.");
        setTimeout(() => setErrorMsg(null), 3000);
      }
    });
  };

  const handleUnsetDefault = (id: string) => {
    startTransition(async () => {
      const res = await unsetDefaultRetailerShippingAddressAction(id);
      if (res.success) {
        setAddresses((prev) =>
          prev.map((a) => ({
            ...a,
            isDefault: a.id === id ? false : a.isDefault,
          }))
        );
        setSuccessMsg("Default address unset. Store address will now serve as default shipping destination.");
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg(res.error || "Failed to unset default address.");
        setTimeout(() => setErrorMsg(null), 3000);
      }
    });
  };

  const handleSetStoreDefault = (storeId: string) => {
    startTransition(async () => {
      const res = await setDefaultStoreShippingAction(storeId);
      if (res.success) {
        setStoresList((prev) =>
          prev.map((s) => ({
            ...s,
            isExplicitDefault: s.id === storeId,
          }))
        );
        setAddresses((prev) =>
          prev.map((a) => ({
            ...a,
            isDefault: false,
          }))
        );
        setSuccessMsg("Store set as default shipping destination.");
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg(res.error || "Failed to set store as default destination.");
        setTimeout(() => setErrorMsg(null), 4000);
      }
    });
  };

  const handleUnsetStoreDefault = () => {
    startTransition(async () => {
      const res = await unsetDefaultStoreShippingAction();
      if (res.success) {
        setStoresList((prev) =>
          prev.map((s) => ({
            ...s,
            isExplicitDefault: false,
          }))
        );
        setSuccessMsg("Default store unset. Deterministic store fallback will apply.");
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg(res.error || "Failed to unset default store.");
        setTimeout(() => setErrorMsg(null), 4000);
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to remove this shipping address?")) return;
    startTransition(async () => {
      const res = await deleteRetailerShippingAddressAction(id);
      if (res.success) {
        setAddresses((prev) => prev.filter((a) => a.id !== id));
        setSuccessMsg("Address removed.");
        setTimeout(() => setSuccessMsg(null), 2500);
      }
    });
  };

  // Authoritative default destination resolution in client view:
  // Rule 1A: Explicit store default
  // Rule 1B: Explicit saved address default
  // Rule 2: Deterministic store fallback
  // Rule 3: Initial default destination
  const explicitStoreDefault = storesList.find((s) => s.isExplicitDefault && s.isEligible);
  const activeSavedDefault = addresses.find((a) => a.isDefault && a.isActive !== false);
  const firstEligibleStore = storesList.find((s) => s.isEligible);

  const activeDefault: ResolvedDefaultShippingDestination | null = React.useMemo(() => {
    if (explicitStoreDefault) {
      return {
        type: "store",
        id: explicitStoreDefault.id,
        name: explicitStoreDefault.name,
        recipientName: explicitStoreDefault.managerName || explicitStoreDefault.name,
        attentionName: null,
        addressLine1: explicitStoreDefault.address!,
        addressLine2: null,
        city: explicitStoreDefault.city!,
        state: explicitStoreDefault.state!,
        zip: explicitStoreDefault.zip!,
        country: "US",
        phone: explicitStoreDefault.phone,
        deliveryNotes: null,
        isExplicitDefault: true,
        isStoreFallback: false,
      };
    }
    if (activeSavedDefault) {
      return {
        type: "saved_address",
        id: activeSavedDefault.id,
        name: activeSavedDefault.label,
        recipientName: activeSavedDefault.recipientName,
        attentionName: activeSavedDefault.attentionName,
        addressLine1: activeSavedDefault.addressLine1,
        addressLine2: activeSavedDefault.addressLine2,
        city: activeSavedDefault.city,
        state: activeSavedDefault.state,
        zip: activeSavedDefault.zip,
        country: activeSavedDefault.country || "US",
        phone: activeSavedDefault.phone,
        deliveryNotes: activeSavedDefault.deliveryNotes,
        isExplicitDefault: true,
        isStoreFallback: false,
      };
    }
    if (firstEligibleStore) {
      return {
        type: "store",
        id: firstEligibleStore.id,
        name: firstEligibleStore.name,
        recipientName: firstEligibleStore.managerName || firstEligibleStore.name,
        attentionName: null,
        addressLine1: firstEligibleStore.address!,
        addressLine2: null,
        city: firstEligibleStore.city!,
        state: firstEligibleStore.state!,
        zip: firstEligibleStore.zip!,
        country: "US",
        phone: firstEligibleStore.phone,
        deliveryNotes: null,
        isExplicitDefault: false,
        isStoreFallback: true,
      };
    }
    return initialDefaultDestination;
  }, [explicitStoreDefault, activeSavedDefault, firstEligibleStore, initialDefaultDestination]);

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
            <Link href="/account" className="hover:underline">Settings</Link>
            <span>/</span>
            <span className="text-zinc-800 dark:text-zinc-200">Shipping Addresses</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
            Shipping Addresses & Destinations
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Manage reusable warehouse, distribution center, or store shipping destinations for wholesale order dispatch.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 dark:hover:text-zinc-950 text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
        >
          <span>+ Add Shipping Address</span>
        </button>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-2">
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <span>✓</span>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Active Default Shipping Destination Callout Banner */}
      <div className="rounded-2xl border border-indigo-100 dark:border-indigo-950/80 bg-gradient-to-r from-indigo-50/70 via-white to-zinc-50 dark:from-indigo-950/30 dark:via-zinc-900 dark:to-zinc-900/60 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-base">📍</span>
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
              Active Default Shipping Destination
            </h2>
          </div>
          {activeDefault && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800">
              {activeDefault.isExplicitDefault
                ? activeDefault.type === "store"
                  ? "🏬 Configured Default (Store Location)"
                  : "🏢 Configured Default (Saved Address)"
                : "🏬 Registered Store Fallback"}
            </span>
          )}
        </div>

        {activeDefault ? (
          <div className="text-xs space-y-1.5 text-zinc-700 dark:text-zinc-300">
            <div className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
              <span>{activeDefault.type === "store" ? "🏬" : "🏢"}</span>
              <span>{activeDefault.name}</span>
              {activeDefault.recipientName && (
                <span className="text-xs text-zinc-500 font-normal">
                  (Recipient: {activeDefault.recipientName})
                </span>
              )}
            </div>
            <p className="text-zinc-600 dark:text-zinc-300">
              {activeDefault.addressLine1}
              {activeDefault.addressLine2 ? `, ${activeDefault.addressLine2}` : ""}
              , {activeDefault.city}, {activeDefault.state} {activeDefault.zip}
            </p>
            {activeDefault.phone && (
              <p className="text-zinc-500 text-[11px]">📞 {activeDefault.phone}</p>
            )}
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
              {activeDefault.isStoreFallback
                ? "No custom default shipping destination is explicitly configured. Wholesale orders will automatically default to this registered store location unless selected otherwise at Checkout."
                : activeDefault.type === "store"
                ? "This registered store location is configured as your company's primary default shipping destination for wholesale purchase orders."
                : "This saved address is configured as your company's primary default shipping destination for wholesale purchase orders."}
            </p>
          </div>
        ) : (
          <div className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
            <p className="font-semibold">⚠️ No Default Shipping Destination Configured</p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Please ensure at least one store has a valid street address on file, or add a custom warehouse address below.
            </p>
          </div>
        )}
      </div>

      {/* SECTION 1: Registered Store Locations */}
      {storesList.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <span>🏬 Registered Store Locations</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold">
                {storesList.length}
              </span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Physical retail locations registered under your account. Any store with a complete street address can be designated as the Default Shipping Address.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {storesList.map((store) => {
              const isExplicitStoreDefault = Boolean(
                activeDefault?.type === "store" &&
                activeDefault.id === store.id &&
                activeDefault.isExplicitDefault
              );
              const isCurrentFallbackDefault = Boolean(
                activeDefault?.type === "store" &&
                activeDefault.id === store.id &&
                activeDefault.isStoreFallback
              );

              return (
                <div
                  key={store.id}
                  className={`p-5 rounded-2xl border transition-all bg-white dark:bg-zinc-900 shadow-xs space-y-3 ${
                    isExplicitStoreDefault
                      ? "border-indigo-600 dark:border-indigo-500 ring-2 ring-indigo-500/20"
                      : isCurrentFallbackDefault
                      ? "border-indigo-600/50 dark:border-indigo-500/50 ring-1 ring-indigo-500/10"
                      : "border-zinc-200 dark:border-zinc-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                        {store.name}
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                        🏬 Store Location
                      </span>
                      {isExplicitStoreDefault && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          Default Shipping Address
                        </span>
                      )}
                      {!isExplicitStoreDefault && isCurrentFallbackDefault && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50/70 text-indigo-700/80 dark:bg-indigo-950/70 dark:text-indigo-300/80 border border-indigo-200/60 dark:border-indigo-800/60">
                          Default Shipping Address (Fallback)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-zinc-600 dark:text-zinc-300 space-y-1">
                    {store.address ? (
                      <>
                        <p className="text-zinc-700 dark:text-zinc-300 font-medium">
                          {store.address}
                        </p>
                        <p className="text-zinc-700 dark:text-zinc-300">
                          {[store.city, store.state, store.zip].filter(Boolean).join(", ")}
                        </p>
                      </>
                    ) : (
                      <p className="text-amber-600 dark:text-amber-400 italic font-medium">
                        Street address pending in store master
                      </p>
                    )}
                    {store.phone && (
                      <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                        📞 {store.phone}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                    {isExplicitStoreDefault ? (
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">
                          ✓ Active Default Address
                        </span>
                        <button
                          type="button"
                          onClick={handleUnsetStoreDefault}
                          disabled={isPending}
                          className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer underline"
                          title="Unset explicit default to revert to deterministic fallback"
                        >
                          Unset Default
                        </button>
                      </div>
                    ) : store.isEligible ? (
                      <button
                        type="button"
                        onClick={() => handleSetStoreDefault(store.id)}
                        disabled={isPending}
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        Set as Default
                      </button>
                    ) : (
                      <span className="text-[11px] text-amber-600 dark:text-amber-400 italic">
                        Ineligible (Address incomplete)
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-400 font-mono">Store Master</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: Saved Warehouse & Distribution Addresses */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <span>🏢 Saved Warehouse & Distribution Addresses</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold">
                {addresses.length}
              </span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Custom delivery locations, central warehouses, or third-party logistics points for wholesale order fulfillment.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline self-start sm:self-auto cursor-pointer"
          >
            + Add Warehouse Address
          </button>
        </div>

        {addresses.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center text-lg mx-auto">
              🏢
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                No custom warehouse addresses saved yet
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto">
                Orders currently default to your registered store address ({activeDefault?.name || "Registered Store Location"}). If you receive freight or pallets at a central warehouse, cross-dock, or office, add it here for reusable one-click selection at Checkout.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer shadow-xs inline-flex items-center gap-1.5"
            >
              + Add Warehouse Address
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {addresses.map((addr) => (
              <div
                key={addr.id}
                className={`p-5 rounded-2xl border transition-all bg-white dark:bg-zinc-900 shadow-xs space-y-3 ${
                  addr.isDefault
                    ? "border-indigo-600/50 dark:border-indigo-500/50 ring-2 ring-indigo-500/10"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                      {addr.label}
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                      🏢 Saved Warehouse
                    </span>
                    {addr.isDefault && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        Default Shipping Destination
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {addr.country}
                  </span>
                </div>

                <div className="text-xs text-zinc-600 dark:text-zinc-300 space-y-1">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {addr.recipientName} {addr.attentionName ? `(Attn: ${addr.attentionName})` : ""}
                  </p>
                  <p className="text-zinc-700 dark:text-zinc-300">
                    {addr.addressLine1}
                    {addr.addressLine2 ? `, ${addr.addressLine2}` : ""}
                  </p>
                  <p className="text-zinc-700 dark:text-zinc-300">
                    {addr.city}, {addr.state} {addr.zip}
                  </p>
                  {addr.phone && (
                    <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                      📞 {addr.phone}
                    </p>
                  )}
                  {addr.deliveryNotes && (
                    <p className="text-[11px] text-zinc-400 italic pt-1.5 border-t border-zinc-100 dark:border-zinc-800/80">
                      Note: {addr.deliveryNotes}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                  {!addr.isDefault ? (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(addr.id)}
                      disabled={isPending}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Set as Default
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleUnsetDefault(addr.id)}
                      disabled={isPending}
                      className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer"
                      title="Unset default to use store address fallback"
                    >
                      Unset Default
                    </button>
                  )}

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => openEditModal(addr)}
                      disabled={isPending}
                      className="font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(addr.id)}
                      disabled={isPending}
                      className="font-bold text-red-600 dark:text-red-400 hover:text-red-700 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal for Add / Edit Address */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                {editingAddress ? "Edit Shipping Address" : "Add New Shipping Address"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 font-medium">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300">
                    Address Label *
                  </label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Central Warehouse, HQ Office"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300">
                    Recipient Full Name *
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-zinc-700 dark:text-zinc-300">
                  Attention / Department (Optional)
                </label>
                <input
                  type="text"
                  value={attentionName}
                  onChange={(e) => setAttentionName(e.target.value)}
                  placeholder="e.g. Receiving Dock, Logistics Dept"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-zinc-700 dark:text-zinc-300">
                  Street Address Line 1 *
                </label>
                <input
                  type="text"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="123 Commerce Blvd"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-zinc-700 dark:text-zinc-300">
                  Street Address Line 2 (Optional)
                </label>
                <input
                  type="text"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  placeholder="Suite 400, Bay 3"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1 col-span-1">
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300">
                    City *
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Los Angeles"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                    required
                  />
                </div>

                <div className="space-y-1 col-span-1">
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300">
                    State (2-letters) *
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    value={state}
                    onChange={(e) => setState(e.target.value.toUpperCase())}
                    placeholder="CA"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none uppercase font-mono font-bold"
                    required
                  />
                </div>

                <div className="space-y-1 col-span-1">
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300">
                    ZIP Code *
                  </label>
                  <input
                    type="text"
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    placeholder="90001"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="213-555-0199"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300">
                    Delivery / Gate Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder="Dock #4, call ahead"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none pt-2">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  Set as default shipping destination for wholesale orders
                </span>
              </label>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 dark:hover:text-zinc-950 font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isPending ? "Saving..." : editingAddress ? "Update Address" : "Save Address"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
