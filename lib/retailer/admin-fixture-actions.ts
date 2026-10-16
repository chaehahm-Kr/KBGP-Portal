"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";

export type FixtureType =
  | "wall_4ft"
  | "wall_8ft"
  | "wall_12ft"
  | "endcap_3ft"
  | "countertop"
  | "custom";

export type FixtureInstallationStatus =
  | "planned"
  | "shipped"
  | "delivered"
  | "installed"
  | "inspected"
  | "retired";

export type FixtureOperationalStatus =
  | "active"
  | "needs_maintenance"
  | "damaged"
  | "retired";

const VALID_FIXTURE_TYPES = new Set<string>([
  "wall_4ft",
  "wall_8ft",
  "wall_12ft",
  "endcap_3ft",
  "countertop",
  "custom",
]);

const VALID_INSTALLATION_STATUSES = new Set<string>([
  "planned",
  "shipped",
  "delivered",
  "installed",
  "inspected",
  "retired",
]);

const VALID_OPERATIONAL_STATUSES = new Set<string>([
  "active",
  "needs_maintenance",
  "damaged",
  "retired",
]);

export interface RegisterStoreFixtureInput {
  storeId: string;
  fixtureCode: string;
  fixtureName: string;
  fixtureType: FixtureType;
  bayCount: number;
  shelfCount: number;
  hasHeaderSignage?: boolean;
  inStoreLocation?: string | null;
  installationStatus?: FixtureInstallationStatus;
  operationalStatus?: FixtureOperationalStatus;
  installationDate?: string | null;
  installedBy?: string | null;
  primaryPhotoUrl?: string | null;
  notes?: string | null;
}

export interface UpdateStoreFixtureInput {
  fixtureId: string;
  fixtureCode: string;
  fixtureName: string;
  fixtureType: FixtureType;
  bayCount: number;
  shelfCount: number;
  hasHeaderSignage?: boolean;
  inStoreLocation?: string | null;
  installationStatus?: FixtureInstallationStatus;
  operationalStatus?: FixtureOperationalStatus;
  installationDate?: string | null;
  installedBy?: string | null;
  primaryPhotoUrl?: string | null;
  notes?: string | null;
}

export interface FixtureActionResult {
  success: boolean;
  error?: string;
  fixtureId?: string;
}

/**
 * Register a new fixture for an authorized store (Admin only)
 * ADM-STORE-OPS-P3-002
 */
export async function registerStoreFixtureAction(
  input: RegisterStoreFixtureInput
): Promise<FixtureActionResult> {
  try {
    await verifyAdminSession();
    const adminClient = createAdminClient();

    const {
      storeId,
      fixtureCode,
      fixtureName,
      fixtureType,
      bayCount,
      shelfCount,
      hasHeaderSignage = true,
      inStoreLocation,
      installationStatus = "planned",
      operationalStatus = "active",
      installationDate,
      installedBy,
      primaryPhotoUrl,
      notes,
    } = input;

    // 1. Validate Store ID and authoritatively resolve company_id
    if (!storeId || typeof storeId !== "string") {
      return { success: false, error: "Valid Store ID is required." };
    }

    const { data: store, error: storeErr } = await adminClient
      .from("stores")
      .select("id, company_id")
      .eq("id", storeId)
      .maybeSingle();

    if (storeErr || !store) {
      return { success: false, error: "Owning store not found or unauthorized." };
    }

    // 2. Validate Code & Name
    const cleanCode = (fixtureCode || "").trim();
    if (!cleanCode) {
      return { success: false, error: "Fixture Code is required." };
    }
    if (cleanCode.length > 50) {
      return { success: false, error: "Fixture Code must be 50 characters or less." };
    }

    const cleanName = (fixtureName || "").trim();
    if (!cleanName) {
      return { success: false, error: "Fixture Name is required." };
    }
    if (cleanName.length > 100) {
      return { success: false, error: "Fixture Name must be 100 characters or less." };
    }

    // 3. Check Fixture Code uniqueness within this store
    const { data: existingCode } = await adminClient
      .from("store_fixtures")
      .select("id")
      .eq("store_id", store.id)
      .ilike("fixture_code", cleanCode)
      .maybeSingle();

    if (existingCode) {
      return {
        success: false,
        error: `A fixture with code "${cleanCode}" already exists for this store.`,
      };
    }

    // 4. Validate Type, Bay, and Shelf limits
    if (!VALID_FIXTURE_TYPES.has(fixtureType)) {
      return { success: false, error: `Invalid fixture type: "${fixtureType}".` };
    }

    const numBays = Number(bayCount);
    if (!Number.isInteger(numBays) || numBays < 1 || numBays > 6) {
      return { success: false, error: "Bay count must be an integer between 1 and 6." };
    }

    const numShelves = Number(shelfCount);
    if (!Number.isInteger(numShelves) || numShelves < 1 || numShelves > 15) {
      return { success: false, error: "Shelf count must be an integer between 1 and 15." };
    }

    // 5. Validate Status values
    if (!VALID_INSTALLATION_STATUSES.has(installationStatus)) {
      return { success: false, error: `Invalid installation status: "${installationStatus}".` };
    }

    if (!VALID_OPERATIONAL_STATUSES.has(operationalStatus)) {
      return { success: false, error: `Invalid operational status: "${operationalStatus}".` };
    }

    // 6. Clean optional fields
    const cleanLocation = inStoreLocation?.trim() ? inStoreLocation.trim().substring(0, 120) : null;
    const cleanInstalledBy = installedBy?.trim() ? installedBy.trim().substring(0, 100) : null;
    const cleanPhotoUrl = primaryPhotoUrl?.trim() || null;
    const cleanNotes = notes?.trim() || null;

    let cleanInstallDate: string | null = null;
    if (installationDate && installationDate.trim()) {
      const dStr = installationDate.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
        cleanInstallDate = dStr;
      }
    }

    // 7. Insert new Fixture row (Anti-destructive delete protected by schema)
    const { data: newFixture, error: insertErr } = await adminClient
      .from("store_fixtures")
      .insert({
        store_id: store.id,
        company_id: store.company_id,
        fixture_code: cleanCode,
        fixture_name: cleanName,
        fixture_type: fixtureType,
        bay_count: numBays,
        shelf_count: numShelves,
        has_header_signage: Boolean(hasHeaderSignage),
        in_store_location: cleanLocation,
        installation_status: installationStatus,
        operational_status: operationalStatus,
        installation_date: cleanInstallDate,
        installed_by: cleanInstalledBy,
        primary_photo_url: cleanPhotoUrl,
        notes: cleanNotes,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("[registerStoreFixtureAction] Insert error:", insertErr);
      return { success: false, error: insertErr.message || "Failed to register fixture." };
    }

    revalidatePath("/admin/store-operations");
    return { success: true, fixtureId: newFixture.id };
  } catch (err: any) {
    console.error("[registerStoreFixtureAction] Uncaught error:", err);
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

/**
 * Update an existing fixture (Admin only)
 * Preserves owning store/company and existing placements.
 * ADM-STORE-OPS-P3-002
 */
export async function updateStoreFixtureAction(
  input: UpdateStoreFixtureInput
): Promise<FixtureActionResult> {
  try {
    await verifyAdminSession();
    const adminClient = createAdminClient();

    const {
      fixtureId,
      fixtureCode,
      fixtureName,
      fixtureType,
      bayCount,
      shelfCount,
      hasHeaderSignage = true,
      inStoreLocation,
      installationStatus = "planned",
      operationalStatus = "active",
      installationDate,
      installedBy,
      primaryPhotoUrl,
      notes,
    } = input;

    if (!fixtureId || typeof fixtureId !== "string") {
      return { success: false, error: "Valid Fixture ID is required." };
    }

    // 1. Verify existing fixture exists
    const { data: existing, error: findErr } = await adminClient
      .from("store_fixtures")
      .select("id, store_id, company_id, fixture_code")
      .eq("id", fixtureId)
      .maybeSingle();

    if (findErr || !existing) {
      return { success: false, error: "Fixture not found." };
    }

    // 2. Validate Code & Name
    const cleanCode = (fixtureCode || "").trim();
    if (!cleanCode) {
      return { success: false, error: "Fixture Code is required." };
    }
    if (cleanCode.length > 50) {
      return { success: false, error: "Fixture Code must be 50 characters or less." };
    }

    const cleanName = (fixtureName || "").trim();
    if (!cleanName) {
      return { success: false, error: "Fixture Name is required." };
    }
    if (cleanName.length > 100) {
      return { success: false, error: "Fixture Name must be 100 characters or less." };
    }

    // 3. If Code changed, check uniqueness within this store
    if (cleanCode.toLowerCase() !== existing.fixture_code.toLowerCase()) {
      const { data: conflict } = await adminClient
        .from("store_fixtures")
        .select("id")
        .eq("store_id", existing.store_id)
        .neq("id", existing.id)
        .ilike("fixture_code", cleanCode)
        .maybeSingle();

      if (conflict) {
        return {
          success: false,
          error: `A fixture with code "${cleanCode}" already exists for this store.`,
        };
      }
    }

    // 4. Validate Type, Bay, and Shelf limits
    if (!VALID_FIXTURE_TYPES.has(fixtureType)) {
      return { success: false, error: `Invalid fixture type: "${fixtureType}".` };
    }

    const numBays = Number(bayCount);
    if (!Number.isInteger(numBays) || numBays < 1 || numBays > 6) {
      return { success: false, error: "Bay count must be an integer between 1 and 6." };
    }

    const numShelves = Number(shelfCount);
    if (!Number.isInteger(numShelves) || numShelves < 1 || numShelves > 15) {
      return { success: false, error: "Shelf count must be an integer between 1 and 15." };
    }

    // 5. Validate Status values
    if (!VALID_INSTALLATION_STATUSES.has(installationStatus)) {
      return { success: false, error: `Invalid installation status: "${installationStatus}".` };
    }

    if (!VALID_OPERATIONAL_STATUSES.has(operationalStatus)) {
      return { success: false, error: `Invalid operational status: "${operationalStatus}".` };
    }

    // 6. Clean optional fields
    const cleanLocation = inStoreLocation?.trim() ? inStoreLocation.trim().substring(0, 120) : null;
    const cleanInstalledBy = installedBy?.trim() ? installedBy.trim().substring(0, 100) : null;
    const cleanPhotoUrl = primaryPhotoUrl?.trim() || null;
    const cleanNotes = notes?.trim() || null;

    let cleanInstallDate: string | null = null;
    if (installationDate && installationDate.trim()) {
      const dStr = installationDate.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
        cleanInstallDate = dStr;
      }
    }

    // 7. Update fixture row
    const { error: updateErr } = await adminClient
      .from("store_fixtures")
      .update({
        fixture_code: cleanCode,
        fixture_name: cleanName,
        fixture_type: fixtureType,
        bay_count: numBays,
        shelf_count: numShelves,
        has_header_signage: Boolean(hasHeaderSignage),
        in_store_location: cleanLocation,
        installation_status: installationStatus,
        operational_status: operationalStatus,
        installation_date: cleanInstallDate,
        installed_by: cleanInstalledBy,
        primary_photo_url: cleanPhotoUrl,
        notes: cleanNotes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", fixtureId);

    if (updateErr) {
      console.error("[updateStoreFixtureAction] Update error:", updateErr);
      return { success: false, error: updateErr.message || "Failed to update fixture." };
    }

    revalidatePath("/admin/store-operations");
    return { success: true, fixtureId };
  } catch (err: any) {
    console.error("[updateStoreFixtureAction] Uncaught error:", err);
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}
