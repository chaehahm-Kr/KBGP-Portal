"use server";

import { revalidatePath } from "next/cache";
import { toggleRetailerTrainingCompletion } from "@/lib/retailer/training";

export async function toggleProductTrainingAction(
  productId: string,
  completed: boolean
) {
  const res = await toggleRetailerTrainingCompletion(productId, completed);
  if (res.success) {
    revalidatePath("/retailer/training");
    revalidatePath(`/retailer/training/${productId}`);
    revalidatePath("/training");
    revalidatePath(`/training/${productId}`);
    revalidatePath("/retailer");
    revalidatePath("/");
  }
  return res;
}
