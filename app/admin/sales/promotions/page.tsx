import React from "react";
import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import {
  getAdminPromotionsAction,
  getAdminPromotionFormOptionsAction,
} from "@/lib/retailer/promotion-actions";
import { AdminPromotionsManager } from "@/components/admin/promotions-manager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Promotions & Coupons | K SELECT Network Admin",
  description: "Manage promotional discount rules, coupon codes, and usage limits.",
};

export default async function AdminPromotionsPage() {
  await verifyAdminSession();

  const [promosRes, optionsRes] = await Promise.all([
    getAdminPromotionsAction({ status: "all" }),
    getAdminPromotionFormOptionsAction(),
  ]);

  const promotions = promosRes.success && promosRes.promotions ? promosRes.promotions : [];
  const options = optionsRes.success
    ? {
        products: optionsRes.products,
        brands: optionsRes.brands,
        categories: optionsRes.categories,
        retailers: optionsRes.retailers,
      }
    : {
        products: [],
        brands: [],
        categories: [],
        retailers: [],
      };

  return (
    <div className="w-full space-y-6">
      <AdminPromotionsManager initialPromotions={promotions} options={options} />
    </div>
  );
}
