# Task Completion Report: PORT-PROD-NEW-002

## Task
- Task ID: PORT-PROD-NEW-002
- Task Name: Add Volume Unit Selector & Default Lead Time to Days
- Platform: Brand Portal (`/portal/products/[id]` & New Registration) & Admin Product Management (`/admin/products/[id]`)
- Repository: `chaehahm-Kr/KBGP-Portal`

## Summary of Changes
1. **Authoritative Volume Unit Selector**:
   - Added `VOLUME_UNITS` domain definition supporting `ml`, `L`, `g`, `kg`, `mg`, `oz`, `fl oz`, `ea / pcs`, and `Other` (기타 / 직접 입력) in `lib/product/types.ts`.
   - Built authoritative parser `parseVolume(volumeStr)` and formatter `formatVolume(value, unit)` in `lib/product/types.ts`.
   - Integrated unit selector UI next to numeric/value input (`flex gap-2`, 2/3 value input + 1/3 unit dropdown) matching the Lead Time pattern.
   - Updated Brand Portal (`components/product/product-detail-tabs.tsx`) and Admin (`components/admin/product-override-tabs.tsx`) to adhere to Rule 25 (Single Authoritative Product Domain Model).
   - Ensured 100% backward compatibility: legacy multi-spec strings (e.g. `60 pads / 150ml (5.07 fl.oz)`) parse safely into `{ value, unit: "Other" }` without data loss or truncation.

2. **Lead Time Default to `일 (Days)`**:
   - Updated `parseLeadTime` in `lib/product/types.ts` to default empty / newly registered product lead time units to `일 (Days)` instead of `주 (Weeks)`.
   - Existing products with saved units (`주 (Weeks)`, `개월 (Months)`, `일 (Days)`) preserve their stored unit.
   - Users can seamlessly switch between `일 (Days)`, `주 (Weeks)`, and `개월 (Months)` as needed.

## Verification & QA
- **TypeScript**: `npm.cmd exec tsc -- --noEmit` -> PASS (0 errors).
- **Production Build**: `npm run build` -> PASS (Turbopack production build succeeded).
- **Unit Logic Verification**: Tested all volume units, empty values, legacy multi-part strings, and lead time parsing variations.
- **Form Persistence**: Volume value and unit persist properly on Draft Save, Final Submit, and Admin Override save.
- **Backward Compatibility**: Fully backward compatible with existing DB `volume` and `lead_time` records without requiring destructive schema migrations.
