import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdminSession } from "@/lib/auth/dal";

export interface AdminStoreOperationItem {
  id: string;
  name: string;
  storeCode: string | null;
  type: string;
  status: "active" | "inactive" | "closed" | string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  email: string | null;
  managerName: string | null;
  managerPhone: string | null;
  companyId: string;
  companyName: string;
  companyCode: string | null;
  createdAt: string;
  updatedAt: string;
  // Associated Operational Counts
  ordersCount: number;
  assignedUsersCount: number;
  weeklyChecksCount: number;
  latestWeeklyCheckDate: string | null;
  latestWeeklyCheckStatus: string | null;
}

export interface AdminStoreOperationsData {
  stores: AdminStoreOperationItem[];
  retailers: Array<{
    id: string;
    name: string;
    companyCode: string | null;
  }>;
  totalStoresCount: number;
  activeStoresCount: number;
  totalRetailersCount: number;
}

export async function getAdminStoreOperationsData(): Promise<AdminStoreOperationsData> {
  await verifyAdminSession();
  const adminClient = createAdminClient();

  // 1. Fetch all store records with parent retailer company
  // Note: explicit constraint 'companies!stores_company_id_fkey' is required because companies
  // also has 'default_shipping_store_id' FK pointing to stores(id).
  const { data: rawStores, error: storesErr } = await adminClient
    .from("stores")
    .select(`
      id,
      name,
      store_code,
      type,
      status,
      address,
      city,
      state,
      zip,
      phone,
      email,
      manager_name,
      manager_phone,
      company_id,
      created_at,
      updated_at,
      companies:companies!stores_company_id_fkey (
        id,
        name,
        company_code
      )
    `)
    .order("created_at", { ascending: true });

  if (storesErr) {
    console.error("[getAdminStoreOperationsData] Error fetching stores:", storesErr);
    throw new Error(storesErr.message || "Failed to load store operations data.");
  }

  const stores = rawStores || [];
  const storeIds = stores.map((s) => s.id);

  // 2. Fetch associated counts in batch if stores exist
  let ordersCountByStore: Record<string, number> = {};
  let usersCountByStore: Record<string, number> = {};
  let checksCountByStore: Record<string, number> = {};
  let latestCheckByStore: Record<string, { date: string | null; status: string | null }> = {};

  if (storeIds.length > 0) {
    // 2.1 Orders per store
    try {
      const { data: orderRows } = await adminClient
        .from("retailer_orders")
        .select("store_id")
        .in("store_id", storeIds);

      (orderRows || []).forEach((r) => {
        if (r.store_id) {
          ordersCountByStore[r.store_id] = (ordersCountByStore[r.store_id] || 0) + 1;
        }
      });
    } catch (e) {
      console.warn("[getAdminStoreOperationsData] Warning fetching orders per store:", e);
    }

    // 2.2 Assigned staff per store
    try {
      const { data: userAccessRows } = await adminClient
        .from("retailer_user_store_access")
        .select("store_id")
        .in("store_id", storeIds);

      (userAccessRows || []).forEach((r) => {
        if (r.store_id) {
          usersCountByStore[r.store_id] = (usersCountByStore[r.store_id] || 0) + 1;
        }
      });
    } catch (e) {
      console.warn("[getAdminStoreOperationsData] Warning fetching user store access:", e);
    }

    // 2.3 Weekly inventory checks per store
    try {
      const { data: checkRows } = await adminClient
        .from("retailer_weekly_checks")
        .select("id, store_id, report_date, status, created_at")
        .in("store_id", storeIds)
        .order("report_date", { ascending: false });

      (checkRows || []).forEach((c) => {
        if (c.store_id) {
          checksCountByStore[c.store_id] = (checksCountByStore[c.store_id] || 0) + 1;
          if (!latestCheckByStore[c.store_id]) {
            latestCheckByStore[c.store_id] = {
              date: c.report_date || c.created_at || null,
              status: c.status || null,
            };
          }
        }
      });
    } catch (e) {
      console.warn("[getAdminStoreOperationsData] Warning fetching weekly checks:", e);
    }
  }

  // 3. Format store records
  const formattedStores: AdminStoreOperationItem[] = stores.map((s: any) => {
    const comp = Array.isArray(s.companies) ? s.companies[0] : s.companies;
    const latestCheck = latestCheckByStore[s.id] || { date: null, status: null };

    return {
      id: s.id,
      name: s.name || "Unnamed Store",
      storeCode: s.store_code || null,
      type: s.type || "Independent Beauty Supply",
      status: s.status || "active",
      address: s.address || null,
      city: s.city || null,
      state: s.state || null,
      zip: s.zip || null,
      phone: s.phone || null,
      email: s.email || null,
      managerName: s.manager_name || null,
      managerPhone: s.manager_phone || null,
      companyId: s.company_id,
      companyName: comp?.name || "Retailer Organization",
      companyCode: comp?.company_code || null,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      ordersCount: ordersCountByStore[s.id] || 0,
      assignedUsersCount: usersCountByStore[s.id] || 0,
      weeklyChecksCount: checksCountByStore[s.id] || 0,
      latestWeeklyCheckDate: latestCheck.date,
      latestWeeklyCheckStatus: latestCheck.status,
    };
  });

  // 4. Extract unique retailers for filtering
  const retailerMap = new Map<string, { id: string; name: string; companyCode: string | null }>();
  formattedStores.forEach((st) => {
    if (st.companyId && !retailerMap.has(st.companyId)) {
      retailerMap.set(st.companyId, {
        id: st.companyId,
        name: st.companyName,
        companyCode: st.companyCode,
      });
    }
  });

  return {
    stores: formattedStores,
    retailers: Array.from(retailerMap.values()),
    totalStoresCount: formattedStores.length,
    activeStoresCount: formattedStores.filter((s) => s.status === "active").length,
    totalRetailersCount: retailerMap.size,
  };
}
