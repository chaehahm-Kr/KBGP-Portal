"use server";

import { revalidatePath } from "next/cache";
import {
  toggleRetailerTrainingCompletion,
  submitRetailerQuiz,
  QuizSubmissionResponse,
} from "@/lib/retailer/training";

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
    revalidatePath("/admin/retailers");
    revalidatePath("/admin/retailers/[id]");
    revalidatePath("/admin/retailers/[id]/training");
    revalidatePath("/admin/training");
    revalidatePath("/");
  }
  return res;
}

export async function submitRetailerQuizAction(
  productId: string,
  answers: Record<number, number>
): Promise<QuizSubmissionResponse> {
  const res = await submitRetailerQuiz(productId, answers);
  if (res.success && res.passed) {
    revalidatePath("/retailer/training");
    revalidatePath(`/retailer/training/${productId}`);
    revalidatePath("/training");
    revalidatePath(`/training/${productId}`);
    revalidatePath("/retailer");
    revalidatePath("/admin/retailers");
    revalidatePath("/admin/retailers/[id]");
    revalidatePath("/admin/retailers/[id]/training");
    revalidatePath("/admin/training");
    revalidatePath("/");
  }
  return res;
}
