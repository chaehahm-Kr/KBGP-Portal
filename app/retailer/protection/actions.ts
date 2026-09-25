"use server";

import { revalidatePath } from "next/cache";
import { requestRetailerProtectionReview } from "@/lib/retailer/protection";

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
  }
  return res;
}
