"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { CartItem, computeCartSummary } from "@/lib/retailer/cart";

interface CartContextType {
  items: CartItem[];
  subtotal: number;
  totalUnits: number;
  totalSkus: number;
  isLoading: boolean;
  lastAddedItem: CartItem | null;
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
    },
    quantity?: number
  ) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  dismissToast: () => void;
}

const CartContext = createContext<CartContextType | null>(null);

const STORAGE_KEY = "kselect_retailer_cart_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastAddedItem, setLastAddedItem] = useState<CartItem | null>(null);

  // Load cart from localStorage on client mount
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
    } catch (err) {
      console.error("Failed to load cart from storage:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
    const qtyToAdd = requestedQty && requestedQty >= pack ? requestedQty : pack;

    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.productId === product.id);
      let nextItems: CartItem[];

      if (existingIndex > -1) {
        const current = prev[existingIndex];
        const newQty = current.quantity + qtyToAdd;
        const lineTotal = Number((newQty * current.wholesalePrice).toFixed(2));
        nextItems = [...prev];
        nextItems[existingIndex] = {
          ...current,
          quantity: newQty,
          lineTotal,
        };
        setLastAddedItem(nextItems[existingIndex]);
      } else {
        const lineTotal = Number((qtyToAdd * product.wholesalePrice).toFixed(2));
        const newItem: CartItem = {
          productId: product.id,
          productName: product.name,
          productNameEn: product.nameEn || null,
          brandName: product.brandName,
          sku: product.sku,
          thumbnailUrl: product.thumbnailUrl || null,
          wholesalePrice: product.wholesalePrice,
          msrp: product.msrp,
          marginPercent: product.marginPercent ?? 50,
          quantity: qtyToAdd,
          casePackQty: pack,
          lineTotal,
        };
        nextItems = [newItem, ...prev];
        setLastAddedItem(newItem);
      }

      return computeCartSummary(nextItems).items;
    });
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
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const dismissToast = () => {
    setLastAddedItem(null);
  };

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
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        dismissToast,
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
