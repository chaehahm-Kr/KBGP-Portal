"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { CartItem, computeCartSummary } from "@/lib/retailer/cart";

interface CartContextType {
  items: CartItem[];
  subtotal: number;
  totalUnits: number;
  totalSkus: number;
  isLoading: boolean;
  lastAddedItem: CartItem | null;
  couponCode: string | null;
  setCouponCode: (code: string | null) => void;
  addItem: (
    product: {
      id: string;
      name: string;
      nameEn?: string | null;
      brandName: string;
      sku: string;
      thumbnailUrl?: string | null;
      wholesalePrice: number;
      msrp: number;
      marginPercent?: number;
      cartonPackQty?: number;
      availableStock?: number;
      salesPolicy?: import("@/lib/product/retailer-policy").ResolvedRetailerSalesPolicy;
      targetStoreId?: string;
      targetStoreName?: string;
    },
    quantity?: number
  ) => { previousQty: number; newQty: number; addedQty: number };
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  dismissToast: () => void;
  syncItemThumbnails: (thumbnails: Record<string, string | null>) => void;
}

const CartContext = createContext<CartContextType | null>(null);

const STORAGE_KEY = "kselect_retailer_cart_v1";
const COUPON_STORAGE_KEY = "kselect_retailer_coupon_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [couponCode, setCouponCodeState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastAddedItem, setLastAddedItem] = useState<CartItem | null>(null);

  // Load cart and coupon from localStorage on client mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const summary = computeCartSummary(parsed);
          setItems(summary.items);
        }
      }
      const rawCoupon = localStorage.getItem(COUPON_STORAGE_KEY);
      if (rawCoupon) {
        setCouponCodeState(rawCoupon.trim().toUpperCase());
      }
    } catch (err) {
      console.error("Failed to load cart from storage:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setCouponCode = (code: string | null) => {
    const normalized = code ? code.trim().toUpperCase() : null;
    setCouponCodeState(normalized);
    try {
      if (normalized) {
        localStorage.setItem(COUPON_STORAGE_KEY, normalized);
      } else {
        localStorage.removeItem(COUPON_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  };

  // Sync cart back to localStorage whenever items change
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      } catch (err) {
        console.error("Failed to save cart to storage:", err);
      }
    }
  }, [items, isLoading]);

  const addItem: CartContextType["addItem"] = (product, requestedQty) => {
    const pack = Math.max(1, product.cartonPackQty || 1);
    let qtyToAdd = requestedQty && requestedQty >= pack ? requestedQty : pack;
    // Snap to nearest multiple of case pack if needed
    const rem = qtyToAdd % pack;
    if (rem !== 0) {
      qtyToAdd = qtyToAdd + (pack - rem);
    }

    const existingItem = items.find((i) => i.productId === product.id);
    const previousQty = existingItem ? existingItem.quantity : 0;
    const newQty = previousQty + qtyToAdd;

    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.productId === product.id);
      let nextItems: CartItem[];

      if (existingIndex > -1) {
        const current = prev[existingIndex];
        const nextQty = current.quantity + qtyToAdd;
        nextItems = [...prev];
        nextItems[existingIndex] = {
          ...current,
          quantity: nextQty,
          availableStock: product.availableStock !== undefined ? product.availableStock : current.availableStock,
          salesPolicy: product.salesPolicy || current.salesPolicy,
          targetStoreId: product.targetStoreId || current.targetStoreId,
          targetStoreName: product.targetStoreName || current.targetStoreName,
        };
      } else {
        const newItem: CartItem = {
          productId: product.id,
          productName: product.name,
          productNameEn: product.nameEn || null,
          brandName: product.brandName,
          sku: product.sku,
          thumbnailUrl: product.thumbnailUrl || null,
          wholesalePrice: product.wholesalePrice,
          baseWholesalePrice: product.wholesalePrice,
          msrp: product.msrp,
          marginPercent: product.marginPercent ?? 50,
          quantity: qtyToAdd,
          casePackQty: pack,
          lineTotal: 0,
          availableStock: product.availableStock,
          salesPolicy: product.salesPolicy,
          targetStoreId: product.targetStoreId,
          targetStoreName: product.targetStoreName,
        };
        nextItems = [newItem, ...prev];
      }

      const summary = computeCartSummary(nextItems);
      const updatedItem = summary.items.find((i) => i.productId === product.id) || null;
      if (updatedItem) {
        setLastAddedItem(updatedItem);
      }
      return summary.items;
    });

    return { previousQty, newQty, addedQty: qtyToAdd };
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setItems((prev) => {
      const target = prev.find((i) => i.productId === productId);
      if (!target) return prev;

      const pack = Math.max(1, target.casePackQty || 1);
      let validQty = quantity;
      if (validQty < pack) validQty = pack;
      // Snap to nearest multiple
      const remainder = validQty % pack;
      if (remainder !== 0) {
        validQty = validQty + (pack - remainder);
      }

      const next = prev.map((item) =>
        item.productId === productId
          ? {
              ...item,
              quantity: validQty,
              lineTotal: Number((validQty * item.wholesalePrice).toFixed(2)),
            }
          : item
      );
      return computeCartSummary(next).items;
    });
  };

  const removeItem = (productId: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.productId !== productId);
      return computeCartSummary(next).items;
    });
  };

  const clearCart = () => {
    setItems([]);
    setCouponCodeState(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(COUPON_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const dismissToast = () => {
    setLastAddedItem(null);
  };

  const syncItemThumbnails = useCallback((thumbnails: Record<string, string | null>) => {
    if (!thumbnails || Object.keys(thumbnails).length === 0) return;
    setItems((prev) => {
      let changed = false;
      const updated = prev.map((item) => {
        const freshUrl = thumbnails[item.productId];
        if (!freshUrl) return item;
        // Only update if item doesn't have a thumbnail yet or if base path genuinely changed
        const currentBase = item.thumbnailUrl ? item.thumbnailUrl.split("?")[0] : null;
        const freshBase = freshUrl.split("?")[0];
        if (!currentBase || currentBase !== freshBase) {
          changed = true;
          return { ...item, thumbnailUrl: freshUrl };
        }
        return item;
      });
      return changed ? updated : prev;
    });
  }, []);

  const summary = useMemo(() => computeCartSummary(items), [items]);

  return (
    <CartContext.Provider
      value={{
        items: summary.items,
        subtotal: summary.subtotal,
        totalUnits: summary.totalUnits,
        totalSkus: summary.totalSkus,
        isLoading,
        lastAddedItem,
        couponCode,
        setCouponCode,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        dismissToast,
        syncItemThumbnails,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
