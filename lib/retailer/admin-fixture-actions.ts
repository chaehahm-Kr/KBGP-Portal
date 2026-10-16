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

// ============================================================================
// Phase 3 Placements Actions (ADM-STORE-OPS-P3-003)
// ============================================================================

export type PlacementStatus = "planned" | "active" | "clearance" | "removed";

const VALID_PLACEMENT_STATUSES = new Set<string>([
  "planned",
  "active",
  "clearance",
  "removed",
]);

export interface AssignStoreFixturePlacementInput {
  fixtureId: string;
  storeId: string;
  productId: string;
  bayNumber: number;
  shelfLevel: number;
  positionSlot: number;
  facingCount?: number;
  capacityUnits?: number;
  placementStatus?: "planned" | "active" | "clearance";
  notes?: string | null;
}

export interface UpdateStoreFixturePlacementInput {
  placementId: string;
  fixtureId: string;
  storeId: string;
  productId: string;
  bayNumber: number;
  shelfLevel: number;
  positionSlot: number;
  facingCount?: number;
  capacityUnits?: number;
  placementStatus?: "planned" | "active" | "clearance" | "removed";
  notes?: string | null;
}

export interface UnassignStoreFixturePlacementInput {
  placementId: string;
  fixtureId: string;
  storeId: string;
}

export interface PlacementActionResult {
  success: boolean;
  error?: string;
  placementId?: string;
}

/**
 * Helper to verify whether a product is carried in the store's assortment
 */
async function checkProductStoreAssortmentEligibility(
  adminClient: any,
  storeId: string,
  productId: string
): Promise<boolean> {
  // 1. Check retailer_store_products
  const { data: rsp } = await adminClient
    .from("retailer_store_products")
    .select("product_id")
    .eq("store_id", storeId)
    .eq("product_id", productId)
    .eq("is_active", true)
    .maybeSingle();

  if (rsp) return true;

  // 2. Check weekly checks items for this store
  const { data: weeklyCheckItems } = await adminClient
    .from("retailer_weekly_checks")
    .select("id, retailer_weekly_check_items!inner(product_id)")
    .eq("store_id", storeId)
    .eq("retailer_weekly_check_items.product_id", productId)
    .limit(1);

  if (weeklyCheckItems && weeklyCheckItems.length > 0) return true;

  // 3. Check order items for this store
  const { data: orderItems } = await adminClient
    .from("retailer_orders")
    .select("id, retailer_order_items!inner(product_id)")
    .eq("store_id", storeId)
    .eq("retailer_order_items.product_id", productId)
    .limit(1);

  if (orderItems && orderItems.length > 0) return true;

  // 4. Fallback check: If store has ZERO total assortment assigned anywhere, check selling status
  const { count: totalAssortmentCount } = await adminClient
    .from("retailer_store_products")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId);

  if (!totalAssortmentCount || totalAssortmentCount === 0) {
    const { data: sellingProd } = await adminClient
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("status", "selling")
      .maybeSingle();
    return Boolean(sellingProd);
  }

  return false;
}

/**
 * Assign a product to a fixture shelf coordinate (Admin only)
 * ADM-STORE-OPS-P3-003
 */
export async function assignStoreFixturePlacementAction(
  input: AssignStoreFixturePlacementInput
): Promise<PlacementActionResult> {
  try {
    await verifyAdminSession();
    const adminClient = createAdminClient();

    const {
      fixtureId,
      storeId,
      productId,
      bayNumber,
      shelfLevel,
      positionSlot,
      facingCount = 1,
      capacityUnits = 6,
      placementStatus = "active",
      notes,
    } = input;

    if (!fixtureId || !storeId || !productId) {
      return { success: false, error: "Fixture, Store, and Product IDs are required." };
    }

    // 1. Verify Fixture belongs to Store
    const { data: fixture, error: fixErr } = await adminClient
      .from("store_fixtures")
      .select("id, store_id, bay_count, shelf_count, operational_status")
      .eq("id", fixtureId)
      .maybeSingle();

    if (fixErr || !fixture) {
      return { success: false, error: "Fixture not found." };
    }

    if (fixture.store_id !== storeId) {
      return { success: false, error: "Fixture does not belong to the selected store." };
    }

    // 2. Validate Coordinate Boundaries
    const bayNum = Number(bayNumber);
    if (!Number.isInteger(bayNum) || bayNum < 1 || bayNum > fixture.bay_count) {
      return {
        success: false,
        error: `Bay number must be between 1 and ${fixture.bay_count} for this fixture.`,
      };
    }

    const shelfNum = Number(shelfLevel);
    if (!Number.isInteger(shelfNum) || shelfNum < 1 || shelfNum > fixture.shelf_count) {
      return {
        success: false,
        error: `Shelf level must be between 1 and ${fixture.shelf_count} for this fixture.`,
      };
    }

    const posNum = Number(positionSlot);
    if (!Number.isInteger(posNum) || posNum < 1 || posNum > 25) {
      return {
        success: false,
        error: "Position slot must be an integer between 1 and 25.",
      };
    }

    const numFacings = Number(facingCount);
    if (!Number.isInteger(numFacings) || numFacings < 1 || numFacings > 10) {
      return { success: false, error: "Facing count must be an integer between 1 and 10." };
    }

    const numCapacity = Number(capacityUnits);
    if (!Number.isInteger(numCapacity) || numCapacity < 0 || numCapacity > 200) {
      return { success: false, error: "Capacity units must be an integer between 0 and 200." };
    }

    if (!VALID_PLACEMENT_STATUSES.has(placementStatus)) {
      return { success: false, error: `Invalid placement status: "${placementStatus}".` };
    }

    // 3. Verify Product Assortment Eligibility
    const isEligible = await checkProductStoreAssortmentEligibility(
      adminClient,
      storeId,
      productId
    );

    if (!isEligible) {
      return {
        success: false,
        error: "Product is not carried in this store's eligible assortment.",
      };
    }

    // 4. Check for existing slot record
    const { data: existingSlot, error: checkErr } = await adminClient
      .from("store_fixture_placements")
      .select("id, placement_status, product_id")
      .eq("store_fixture_id", fixtureId)
      .eq("bay_number", bayNum)
      .eq("shelf_level", shelfNum)
      .eq("position_slot", posNum)
      .maybeSingle();

    if (checkErr) {
      console.error("[assignStoreFixturePlacementAction] Slot check error:", checkErr);
      return { success: false, error: "Failed to verify slot availability." };
    }

    const cleanNotes = notes?.trim() ? notes.trim().substring(0, 500) : null;

    if (existingSlot) {
      if (existingSlot.placement_status !== "removed") {
        return {
          success: false,
          error: `Slot (Bay ${bayNum}, Shelf ${shelfNum}, Position #${posNum}) is already occupied. Please edit or unassign the current placement first.`,
        };
      }

      // Slot was previously unassigned/removed -> Reactivate and reuse record
      const { error: updateErr } = await adminClient
        .from("store_fixture_placements")
        .update({
          product_id: productId,
          facing_count: numFacings,
          capacity_units: numCapacity,
          placement_status: placementStatus,
          notes: cleanNotes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingSlot.id);

      if (updateErr) {
        console.error("[assignStoreFixturePlacementAction] Reactivate error:", updateErr);
        return { success: false, error: updateErr.message || "Failed to assign placement." };
      }

      revalidatePath("/admin/store-operations");
      return { success: true, placementId: existingSlot.id };
    }

    // No existing record -> Insert new placement
    const { data: inserted, error: insertErr } = await adminClient
      .from("store_fixture_placements")
      .insert({
        store_fixture_id: fixtureId,
        store_id: storeId,
        product_id: productId,
        bay_number: bayNum,
        shelf_level: shelfNum,
        position_slot: posNum,
        facing_count: numFacings,
        capacity_units: numCapacity,
        placement_status: placementStatus,
        notes: cleanNotes,
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      console.error("[assignStoreFixturePlacementAction] Insert error:", insertErr);
      return { success: false, error: insertErr?.message || "Failed to assign placement." };
    }

    revalidatePath("/admin/store-operations");
    return { success: true, placementId: inserted.id };
  } catch (err: any) {
    console.error("[assignStoreFixturePlacementAction] Uncaught error:", err);
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

/**
 * Update an existing placement (Admin only)
 * ADM-STORE-OPS-P3-003
 */
export async function updateStoreFixturePlacementAction(
  input: UpdateStoreFixturePlacementInput
): Promise<PlacementActionResult> {
  try {
    await verifyAdminSession();
    const adminClient = createAdminClient();

    const {
      placementId,
      fixtureId,
      storeId,
      productId,
      bayNumber,
      shelfLevel,
      positionSlot,
      facingCount = 1,
      capacityUnits = 6,
      placementStatus = "active",
      notes,
    } = input;

    if (!placementId || !fixtureId || !storeId || !productId) {
      return { success: false, error: "Placement, Fixture, Store, and Product IDs are required." };
    }

    // 1. Fetch existing placement
    const { data: existingPlacement, error: plcErr } = await adminClient
      .from("store_fixture_placements")
      .select("id, store_fixture_id, store_id, product_id, bay_number, shelf_level, position_slot, placement_status")
      .eq("id", placementId)
      .maybeSingle();

    if (plcErr || !existingPlacement) {
      return { success: false, error: "Placement not found." };
    }

    if (existingPlacement.store_fixture_id !== fixtureId || existingPlacement.store_id !== storeId) {
      return { success: false, error: "Placement does not match the specified fixture or store." };
    }

    // 2. Fetch fixture to validate bounds
    const { data: fixture, error: fixErr } = await adminClient
      .from("store_fixtures")
      .select("id, store_id, bay_count, shelf_count")
      .eq("id", fixtureId)
      .maybeSingle();

    if (fixErr || !fixture) {
      return { success: false, error: "Fixture not found." };
    }

    const bayNum = Number(bayNumber);
    if (!Number.isInteger(bayNum) || bayNum < 1 || bayNum > fixture.bay_count) {
      return {
        success: false,
        error: `Bay number must be between 1 and ${fixture.bay_count} for this fixture.`,
      };
    }

    const shelfNum = Number(shelfLevel);
    if (!Number.isInteger(shelfNum) || shelfNum < 1 || shelfNum > fixture.shelf_count) {
      return {
        success: false,
        error: `Shelf level must be between 1 and ${fixture.shelf_count} for this fixture.`,
      };
    }

    const posNum = Number(positionSlot);
    if (!Number.isInteger(posNum) || posNum < 1 || posNum > 25) {
      return {
        success: false,
        error: "Position slot must be an integer between 1 and 25.",
      };
    }

    const numFacings = Number(facingCount);
    if (!Number.isInteger(numFacings) || numFacings < 1 || numFacings > 10) {
      return { success: false, error: "Facing count must be an integer between 1 and 10." };
    }

    const numCapacity = Number(capacityUnits);
    if (!Number.isInteger(numCapacity) || numCapacity < 0 || numCapacity > 200) {
      return { success: false, error: "Capacity units must be an integer between 0 and 200." };
    }

    if (!VALID_PLACEMENT_STATUSES.has(placementStatus)) {
      return { success: false, error: `Invalid placement status: "${placementStatus}".` };
    }

    // 3. Verify Product Assortment Eligibility
    const isEligible = await checkProductStoreAssortmentEligibility(
      adminClient,
      storeId,
      productId
    );

    if (!isEligible) {
      return {
        success: false,
        error: "Product is not carried in this store's eligible assortment.",
      };
    }

    // 4. Check coordinate changes for collisions
    const coordinatesChanged =
      existingPlacement.bay_number !== bayNum ||
      existingPlacement.shelf_level !== shelfNum ||
      existingPlacement.position_slot !== posNum;

    if (coordinatesChanged) {
      const { data: targetSlot, error: targetErr } = await adminClient
        .from("store_fixture_placements")
        .select("id, placement_status")
        .eq("store_fixture_id", fixtureId)
        .eq("bay_number", bayNum)
        .eq("shelf_level", shelfNum)
        .eq("position_slot", posNum)
        .neq("id", placementId)
        .maybeSingle();

      if (targetErr) {
        return { success: false, error: "Failed to verify target slot availability." };
      }

      if (targetSlot) {
        if (targetSlot.placement_status !== "removed") {
          return {
            success: false,
            error: `Target slot (Bay ${bayNum}, Shelf ${shelfNum}, Position #${posNum}) is already occupied.`,
          };
        }
        // If target slot had a removed placeholder, delete it to prevent unique constraint conflict
        await adminClient
          .from("store_fixture_placements")
          .delete()
          .eq("id", targetSlot.id);
      }
    }

    const cleanNotes = notes?.trim() ? notes.trim().substring(0, 500) : null;

    // 5. Update placement
    const { error: updateErr } = await adminClient
      .from("store_fixture_placements")
      .update({
        product_id: productId,
        bay_number: bayNum,
        shelf_level: shelfNum,
        position_slot: posNum,
        facing_count: numFacings,
        capacity_units: numCapacity,
        placement_status: placementStatus,
        notes: cleanNotes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", placementId);

    if (updateErr) {
      console.error("[updateStoreFixturePlacementAction] Update error:", updateErr);
      return { success: false, error: updateErr.message || "Failed to update placement." };
    }

    revalidatePath("/admin/store-operations");
    return { success: true, placementId };
  } catch (err: any) {
    console.error("[updateStoreFixturePlacementAction] Uncaught error:", err);
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

/**
 * Unassign a placement by setting status to 'removed' (Reversible, Admin only)
 * ADM-STORE-OPS-P3-003
 */
export async function unassignStoreFixturePlacementAction(
  input: UnassignStoreFixturePlacementInput
): Promise<PlacementActionResult> {
  try {
    await verifyAdminSession();
    const adminClient = createAdminClient();

    const { placementId, fixtureId, storeId } = input;

    if (!placementId || !fixtureId || !storeId) {
      return { success: false, error: "Placement, Fixture, and Store IDs are required." };
    }

    // 1. Verify placement exists and belongs to fixture & store
    const { data: existingPlacement, error: plcErr } = await adminClient
      .from("store_fixture_placements")
      .select("id, store_fixture_id, store_id, placement_status")
      .eq("id", placementId)
      .maybeSingle();

    if (plcErr || !existingPlacement) {
      return { success: false, error: "Placement not found." };
    }

    if (existingPlacement.store_fixture_id !== fixtureId || existingPlacement.store_id !== storeId) {
      return { success: false, error: "Placement does not match the specified fixture or store." };
    }

    // 2. Set status to 'removed' (reversible per prompt requirements)
    const { error: updateErr } = await adminClient
      .from("store_fixture_placements")
      .update({
        placement_status: "removed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", placementId);

    if (updateErr) {
      console.error("[unassignStoreFixturePlacementAction] Error:", updateErr);
      return { success: false, error: updateErr.message || "Failed to unassign placement." };
    }

    revalidatePath("/admin/store-operations");
    return { success: true, placementId };
  } catch (err: any) {
    console.error("[unassignStoreFixturePlacementAction] Uncaught error:", err);
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

