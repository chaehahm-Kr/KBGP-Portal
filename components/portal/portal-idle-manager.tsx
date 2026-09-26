"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { logoutPortal } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/client";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_THRESHOLD_MS = 25 * 60 * 1000; // 25 minutes
const STORAGE_ACTIVITY_KEY = "portal_last_activity_at";
const STORAGE_LOGOUT_KEY = "portal_logout_event";
const CHANNEL_NAME = "portal_session_channel";

export function PortalIdleManager() {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(300);
  const lastActivityRef = useRef<number>(Date.now());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const isLoggingOutRef = useRef<boolean>(false);

  // Perform clean auto logout
  const handleAutoLogout = useCallback(async (isExplicit = false) => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    try {
      // Notify other tabs and purge activity timestamp
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem(STORAGE_ACTIVITY_KEY);
          localStorage.setItem(STORAGE_LOGOUT_KEY, String(Date.now()));
          if (channelRef.current) {
            channelRef.current.postMessage({ type: "LOGOUT" });
          }
        } catch {}
      }

      const supabase = createClient();
      await supabase.auth.signOut();
      await logoutPortal();
    } catch {
      // Fallback redirect
      window.location.href = isExplicit ? "/portal/login" : "/portal/login?reason=idle";
    }
  }, []);

  // Update activity timestamp
  const recordUserActivity = useCallback(() => {
    if (isLoggingOutRef.current) return;
    const now = Date.now();
    lastActivityRef.current = now;
    setShowWarning(false);

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_ACTIVITY_KEY, String(now));
        if (channelRef.current) {
          channelRef.current.postMessage({ type: "ACTIVITY", timestamp: now });
        }
      } catch {}
    }
  }, []);

  // Extend session (from modal button)
  const handleExtendSession = () => {
    recordUserActivity();
    setShowWarning(false);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Initialize last activity safely: if missing, future, or already expired, initialize to now
    const now = Date.now();
    const stored = localStorage.getItem(STORAGE_ACTIVITY_KEY);
    const num = stored ? Number(stored) : NaN;
    const isFresh = !isNaN(num) && num > 0 && num <= now && now - num < IDLE_TIMEOUT_MS;
    const initialTime = isFresh ? num : now;
    lastActivityRef.current = initialTime;
    
    try {
      localStorage.setItem(STORAGE_ACTIVITY_KEY, String(initialTime));
      localStorage.removeItem(STORAGE_LOGOUT_KEY);
    } catch {}

    // Setup BroadcastChannel for modern multi-tab sync
    if (typeof BroadcastChannel !== "undefined") {
      try {
        const channel = new BroadcastChannel(CHANNEL_NAME);
        channelRef.current = channel;
        channel.onmessage = (event) => {
          if (event.data?.type === "ACTIVITY" && event.data.timestamp) {
            lastActivityRef.current = Math.max(lastActivityRef.current, event.data.timestamp);
            setShowWarning(false);
          } else if (event.data?.type === "LOGOUT") {
            if (!isLoggingOutRef.current) {
              isLoggingOutRef.current = true;
              window.location.href = "/portal/login";
            }
          }
        };
      } catch {}
    }

    // Cross-tab storage event listener
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_ACTIVITY_KEY && e.newValue) {
        const remoteTime = Number(e.newValue);
        if (!isNaN(remoteTime) && remoteTime > lastActivityRef.current && remoteTime <= Date.now()) {
          lastActivityRef.current = remoteTime;
          setShowWarning(false);
        }
      } else if (e.key === STORAGE_LOGOUT_KEY) {
        if (!isLoggingOutRef.current) {
          isLoggingOutRef.current = true;
          window.location.href = "/portal/login";
        }
      }
    };
    window.addEventListener("storage", handleStorage);

    // Throttle helper for frequent events (mousemove, scroll)
    let lastThrottledTime = 0;
    const handleThrottledActivity = () => {
      const now = Date.now();
      if (now - lastThrottledTime > 10000) { // Throttle to once every 10s
        lastThrottledTime = now;
        recordUserActivity();
      }
    };

    // User activity event listeners (real human actions only)
    const handleImmediateActivity = () => {
      recordUserActivity();
    };

    window.addEventListener("mousedown", handleImmediateActivity);
    window.addEventListener("keydown", handleImmediateActivity);
    window.addEventListener("touchstart", handleImmediateActivity);
    window.addEventListener("pointerdown", handleImmediateActivity);
    window.addEventListener("mousemove", handleThrottledActivity);
    window.addEventListener("scroll", handleThrottledActivity, { passive: true });

    // Idle evaluation timer running every 1 second
    const interval = setInterval(() => {
      if (isLoggingOutRef.current) return;

      const currentNow = Date.now();
      // Check storage for latest activity across tabs
      const currentStored = localStorage.getItem(STORAGE_ACTIVITY_KEY);
      if (currentStored) {
        const val = Number(currentStored);
        if (!isNaN(val) && val > 0 && val <= currentNow && val > lastActivityRef.current) {
          lastActivityRef.current = val;
        }
      }

      const elapsed = currentNow - lastActivityRef.current;

      if (elapsed >= IDLE_TIMEOUT_MS) {
        handleAutoLogout(false);
      } else if (elapsed >= WARNING_THRESHOLD_MS) {
        setShowWarning(true);
        const remainingMs = IDLE_TIMEOUT_MS - elapsed;
        setRemainingSeconds(Math.max(0, Math.ceil(remainingMs / 1000)));
      } else {
        setShowWarning((prev) => (prev ? false : prev));
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("mousedown", handleImmediateActivity);
      window.removeEventListener("keydown", handleImmediateActivity);
      window.removeEventListener("touchstart", handleImmediateActivity);
      window.removeEventListener("pointerdown", handleImmediateActivity);
      window.removeEventListener("mousemove", handleThrottledActivity);
      window.removeEventListener("scroll", handleThrottledActivity);
      if (channelRef.current) {
        channelRef.current.close();
      }
    };
  }, [handleAutoLogout, recordUserActivity]);

  if (!showWarning) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl text-white space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-white">자동 로그아웃 안내</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              장시간 활동이 없어 안전을 위해 잠시 후 로그아웃됩니다.
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-zinc-950 p-4 border border-zinc-800 text-center space-y-1">
          <span className="text-xs text-zinc-400">자동 로그아웃까지 남은 시간</span>
          <p className="text-2xl font-mono font-bold text-amber-400">{formattedTime}</p>
          <p className="text-[11px] text-zinc-500 mt-1">
            계속 사용하시려면 [계속 사용] 버튼을 클릭해 주세요.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleExtendSession}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition-colors cursor-pointer shadow-sm"
          >
            계속 사용
          </button>
          <button
            type="button"
            onClick={() => handleAutoLogout(true)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-750 hover:text-white transition-colors cursor-pointer"
          >
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}
