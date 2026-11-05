import { getStoreOwnerPlan } from "@/lib/plans";

export async function getPlanForRecovery(storeId: string) {
  return getStoreOwnerPlan(storeId);
}
