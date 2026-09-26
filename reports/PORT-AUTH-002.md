# Task Completion Report: PORT-AUTH-002

## Task
- Task ID: PORT-AUTH-002
- Task Name: Fix Repeated Login Required After 30-Minute Auto Logout

## Platform
- Platform: Brand Portal (`https://portal.kselectnetwork.com`)
- Target Areas:
  - `components/portal/portal-idle-manager.tsx`
  - `components/auth/login-form.tsx`

---

## 1. Exact Root Cause Analysis
- When the 30-minute inactivity auto-logout triggered in `PortalIdleManager`, it redirected the user to `/portal/login?reason=idle` but left the stale timestamp (`Date.now() - 30+ minutes`) saved in `localStorage["portal_last_activity_at"]`.
- When the user subsequently submitted their credentials on `/portal/login`, the server action (`loginPortal`) successfully authenticated them and redirected to `/portal`.
- Upon entering `/portal`, `PortalLayout` mounted `PortalIdleManager`.
- In `PortalIdleManager` initialization:
  ```tsx
  const stored = localStorage.getItem(STORAGE_ACTIVITY_KEY);
  const num = stored ? Number(stored) : NaN;
  const initialTime = !isNaN(num) && num > 0 ? num : Date.now();
  lastActivityRef.current = initialTime;
  ```
  Since `num` existed and was a valid number, `lastActivityRef.current` was initialized to the 30-minute-old timestamp.
- On the very first 1-second interval tick (`setInterval`), `now - lastActivityRef.current` evaluated to `>= 30 minutes` immediately (`elapsed >= IDLE_TIMEOUT_MS`).
- `PortalIdleManager` immediately invoked `handleAutoLogout(false)`, terminating the newly created session and booting the user right back to `/portal/login?reason=idle` within 1 second of logging in.
- The user had to attempt logging in multiple times (2–3 times) until local user interactions happened to overwrite the stale timestamp in `localStorage` before the 1-second tick executed.

---

## 2. Solution & Architectural Fix
1. **Activity Timestamp Reset on Mount (`components/portal/portal-idle-manager.tsx`)**:
   - Added validation during initialization: If `stored` timestamp is expired (`now - num >= IDLE_TIMEOUT_MS`), from the future (`num > now`), or invalid, it is treated as a fresh session and initialized to `Date.now()`.
   - Updated `localStorage[STORAGE_ACTIVITY_KEY]` with the fresh timestamp on mount.
   - Cleared `portal_logout_event` on mount.
2. **Auto Logout Cleanup**:
   - In `handleAutoLogout`, explicitly remove `STORAGE_ACTIVITY_KEY` and purge `STORAGE_LOGOUT_KEY` before redirecting.
3. **Monotonic Interval Timestamp Update**:
   - Only update `lastActivityRef.current` from `localStorage` in the 1-second timer if the remote stored value is strictly greater than `lastActivityRef.current` and not in the future.
4. **Login Form Cleanup (`components/auth/login-form.tsx`)**:
   - Clears stale `portal_last_activity_at` and `portal_logout_event` keys upon login form mount.
   - Sets fresh `portal_last_activity_at = Date.now()` on form submission.

---

## 3. QA Results
- TypeScript: `npm.cmd exec tsc -- --noEmit` -> 0 errors (PASS)
- Production Build: `npm run build` -> Exit code 0 (PASS)
- Normal Login: 1 attempt successfully loads Portal Dashboard.
- Auto Logout Re-login: After auto-logout, logging in with valid credentials successfully enters the Portal on the first attempt without getting bounced back to the login screen.
- Session Persistence: Hard refresh (Ctrl+F5) preserves session cleanly.
- Isolation: Retailer Portal and Admin auth sessions remain completely isolated and unaffected.
