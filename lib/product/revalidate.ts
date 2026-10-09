import { revalidatePath } from "next/cache";

export function revalidateAllProductPaths(productId?: string) {
  try {
    revalidatePath("/admin/products");
    revalidatePath("/admin/products/trading");
    revalidatePath("/portal/products");
    revalidatePath("/products");
    revalidatePath("/retailer/products");

    if (productId) {
      revalidatePath(`/admin/products/${productId}`);
      revalidatePath(`/admin/products/trading/${productId}`);
      revalidatePath(`/portal/products/${productId}`);
      revalidatePath(`/products/${productId}`);
      revalidatePath(`/retailer/products/${productId}`);
    }
  } catch {
    // ignore errors in dev/test environments without cache context
  }
}
