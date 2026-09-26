# Task Completion Report: PORT-PROD-UI-001-R1

## Task Metadata
- **Task ID:** `PORT-PROD-UI-001-R1`
- **Task Name:** Fix Product Detail Navigation Lock, Unsaved-Changes Guard & Media Upload Server Error
- **Project:** KSelectNetwork (Brand Portal & Admin)
- **Production Route:** `/portal/products/be0e6cc0-f346-4c98-b60d-c235167751d9`
- **Status:** `COMPLETE`

---

## 1. Exact Root Cause Analysis

### Issue A: Product Detail Navigation Lock
- **Root Cause:**
  When `isDirty` became `true`, the previous `popstate` hook in `useUnsavedChangesGuard` called `window.history.pushState({ unsavedChangesGuard: true }, "", window.location.href)`.
  In Next.js App Router, `window.history.state` holds the router's internal state tree (`__NA`, `tree`, etc.). Overwriting `window.history.state` with a plain object corrupted Next.js's router state. Consequently, subsequent Next.js `<Link>` and `router.push()` navigations were silently rejected by the router engine, freezing sidebar links, header links, and modal discard navigation (`저장하지 않고 나가기`). Only the browser Back button functioned because popping the dummy state restored the previous valid Next.js history state.
- **Fix:**
  1. Preserved Next.js history state by cloning existing `window.history.state` (`{ ...window.history.state, __unsavedGuard: true }`) instead of overwriting it with a plain object.
  2. Implemented clean capture-phase click interception (`handleClickCapture`) that checks `isDirtyRef.current` and intercepts internal navigation anchors, opening the custom modal with `계속 수정`, `저장하지 않고 나가기`, and `저장 후 나가기`.
  3. Ensured `executeNavigation` sets `bypassGuardRef.current = true`, closes the modal, and cleanly executes `router.push(targetUrl)` / `window.history.go(-2)`.

### Issue B: Media Upload "An unexpected response was received from the server."
- **Root Cause:**
  1. Adding 3 high-resolution/mobile photos in a single FormData payload exceeded the previous 10MB `bodySizeLimit` in `next.config.ts`, causing Next.js/Vercel to respond with HTTP 413 (Payload Too Large), which triggered the generic Next.js Server Action client error.
  2. In `addProductImages`, individual file validation and Supabase storage upload failures were swallowed silently without informative error reporting or throw statements.
- **Fix:**
  1. Increased `experimental.serverActions.bodySizeLimit` to `50mb` in `next.config.ts`.
  2. Enhanced `addProductImages` in `lib/product/actions.ts` with explicit file validation, per-file error handling, storage upload error reporting, and database insert confirmation.

---

## 2. Modified Files
- `hooks/use-unsaved-changes-guard.tsx`: Robust click capture guard, preserved history state tree, seamless discard/save navigation.
- `lib/product/actions.ts`: Enhanced `addProductImages` error reporting, validation, storage and DB insert checks.
- `next.config.ts`: Increased Server Action `bodySizeLimit` to `50mb`.
- `reports/PORT-PROD-UI-001-R1.md`: Task report.

---

## 3. QA Results
- **TypeScript QA (`tsc --noEmit`):** PASS (0 errors)
- **Production Build QA (`npm run build`):** PASS (22/22 static pages generated successfully)
- **Scenario A (Clean Navigation):** PASS
- **Scenario B (Unsaved Edit + Discard):** PASS
- **Scenario C (Unsaved Edit + Save):** PASS
- **Scenario D (Media Upload):** PASS
- **Scenario E (Navigation After Upload):** PASS
- **Scenario F (5-Cycle Enter/Exit):** PASS
