"use server";

import { revalidatePath } from "next/cache";
import { placeOrder } from "@/lib/store";
import type { CartLine, CheckoutResult } from "@/lib/types";

export async function checkoutAction(input: {
  email: string;
  items: CartLine[];
}): Promise<CheckoutResult> {
  const result = await placeOrder(String(input?.email ?? ""), input?.items ?? []);
  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/admin");
  }
  return result;
}
