"use server";

import { revalidatePath } from "next/cache";
import {
  requestRetailerProtectionReview,
  respondToRetailerProtectionInfoRequest,
} from "@/lib/retailer/protection";

export async function requestProtectionReviewAction(
  protectionId: string,
  notes?: string
) {
  const res = await requestRetailerProtectionReview(protectionId, notes);
  if (res.success) {
    revalidatePath("/retailer/protection");
    revalidatePath(`/retailer/protection/${protectionId}`);
    revalidatePath("/protection");
    revalidatePath(`/protection/${protectionId}`);
    revalidatePath("/retailer");
    revalidatePath("/sales");
    revalidatePath("/admin/protection-reviews");
    revalidatePath(`/admin/protection-reviews/${protectionId}`);
  }
  return res;
}

export async function respondToProtectionInfoAction(
  protectionId: string,
  notes: string
) {
  const res = await respondToRetailerProtectionInfoRequest(protectionId, notes);
  if (res.success) {
    revalidatePath("/retailer/protection");
    revalidatePath(`/retailer/protection/${protectionId}`);
    revalidatePath("/protection");
    revalidatePath(`/protection/${protectionId}`);
    revalidatePath("/retailer");
    revalidatePath("/sales");
    revalidatePath("/admin/protection-reviews");
    revalidatePath(`/admin/protection-reviews/${protectionId}`);
  }
  return res;
}
