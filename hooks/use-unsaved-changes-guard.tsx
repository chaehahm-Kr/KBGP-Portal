"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

export interface UseUnsavedChangesGuardOptions {
  isDirty: boolean;
  onSave?: () => Promise<{ success: boolean; error?: string }>;
}

type PendingNavigation =
  | { type: "url"; url: string }
  | { type: "back" }
  | { type: "custom"; action: () => void };

export function useUnsavedChangesGuard({ isDirty, onSave }: UseUnsavedChangesGuardOptions) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSavingAndLeaving, setIsSavingAndLeaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingNav, setPendingNav] = useState<PendingNavigation | null>(null);

  const bypassGuardRef = useRef(false);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // 1. Native beforeunload protection (Page refresh / Tab close / Window close)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !bypassGuardRef.current) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  // 2. Browser Back / Forward button (popstate)
  useEffect(() => {
    if (!isDirty) return;

    // Push a dummy entry so we can catch popstate when user presses Back
    window.history.pushState({ unsavedChangesGuard: true }, "", window.location.href);

    const handlePopState = (e: PopStateEvent) => {
      if (bypassGuardRef.current) return;

      if (isDirty) {
        // Re-push state so user doesn't immediately leave
        window.history.pushState({ unsavedChangesGuard: true }, "", window.location.href);
        setPendingNav({ type: "back" });
        setIsModalOpen(true);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isDirty]);



  // Reset bypass guard flag when isDirty is false
  useEffect(() => {
    if (!isDirty) {
      bypassGuardRef.current = false;
    }
  }, [isDirty]);

  // Execute pending navigation
  const executeNavigation = useCallback((nav: PendingNavigation) => {
    bypassGuardRef.current = true;
    setIsModalOpen(false);

    if (nav.type === "back") {
      // Go back twice because we pushed 1 dummy state
      window.history.go(-2);
    } else if (nav.type === "url") {
      try {
        const targetUrl = new URL(nav.url, window.location.href);
        if (targetUrl.origin === window.location.origin) {
          router.push(targetUrl.pathname + targetUrl.search + targetUrl.hash);
        } else {
          window.location.href = nav.url;
        }
      } catch {
        router.push(nav.url);
      }
    } else if (nav.type === "custom") {
      nav.action();
    }
  }, [router]);

  // Modal Action 1: 계속 수정
  const handleContinueEditing = useCallback(() => {
    setIsModalOpen(false);
    setPendingNav(null);
    setSaveError(null);
  }, []);

  // Modal Action 2: 저장하지 않고 나가기
  const handleDiscardAndLeave = useCallback(() => {
    if (!pendingNav) {
      setIsModalOpen(false);
      return;
    }
    executeNavigation(pendingNav);
  }, [pendingNav, executeNavigation]);

  // Modal Action 3: 저장 후 나가기
  const handleSaveAndLeave = useCallback(async () => {
    if (!onSaveRef.current) {
      if (pendingNav) executeNavigation(pendingNav);
      return;
    }

    setIsSavingAndLeaving(true);
    setSaveError(null);

    try {
      const result = await onSaveRef.current();
      setIsSavingAndLeaving(false);

      if (result.success) {
        if (pendingNav) {
          executeNavigation(pendingNav);
        } else {
          setIsModalOpen(false);
        }
      } else {
        // Save failed: abort navigation and show error
        setSaveError(result.error || "저장할 수 없는 항목이 있습니다. 입력 내용을 확인해주세요.");
      }
    } catch (err: any) {
      setIsSavingAndLeaving(false);
      setSaveError(err.message || "저장 중 오류가 발생했습니다.");
    }
  }, [pendingNav, executeNavigation]);

  // Manual navigation helper (e.g., custom buttons that navigate via router.push)
  const confirmNavigation = useCallback(
    (target: string | (() => void)) => {
      if (!isDirty) {
        if (typeof target === "string") {
          try {
            const targetUrl = new URL(target, window.location.href);
            if (targetUrl.origin === window.location.origin) {
              router.push(targetUrl.pathname + targetUrl.search + targetUrl.hash);
            } else {
              window.location.href = target;
            }
          } catch {
            router.push(target);
          }
        } else {
          target();
        }
        return;
      }

      if (typeof target === "string") {
        setPendingNav({ type: "url", url: target });
      } else {
        setPendingNav({ type: "custom", action: target });
      }
      setSaveError(null);
      setIsModalOpen(true);
    },
    [isDirty, router]
  );

  const bypassGuardAndNavigate = useCallback(
    (url: string) => {
      bypassGuardRef.current = true;
      try {
        const targetUrl = new URL(url, window.location.href);
        if (targetUrl.origin === window.location.origin) {
          router.push(targetUrl.pathname + targetUrl.search + targetUrl.hash);
        } else {
          window.location.href = url;
        }
      } catch {
        router.push(url);
      }
    },
    [router]
  );

  // Render modal component
  const guardModalNode = isModalOpen ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 space-y-5">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 text-lg font-bold">
            ⚠️
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              저장하지 않은 변경사항이 있습니다.
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              현재 제품에 저장하지 않은 변경사항이 있습니다. 이 페이지를 떠나기 전에 저장하시겠습니까?
            </p>
          </div>
        </div>

        {saveError && (
          <div className="rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60">
            ⚠️ {saveError}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-zinc-150 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleContinueEditing}
            disabled={isSavingAndLeaving}
            className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            계속 수정
          </button>
          <button
            type="button"
            onClick={handleDiscardAndLeave}
            disabled={isSavingAndLeaving}
            className="rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 px-3.5 py-2.5 text-xs font-bold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/60 transition-colors cursor-pointer disabled:opacity-50"
          >
            저장하지 않고 나가기
          </button>
          <button
            type="button"
            onClick={handleSaveAndLeave}
            disabled={isSavingAndLeaving}
            className="rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
          >
            {isSavingAndLeaving ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white dark:text-zinc-950" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>저장 중...</span>
              </>
            ) : (
              "저장 후 나가기"
            )}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return {
    isGuardModalOpen: isModalOpen,
    isSavingAndLeaving,
    guardModalNode,
    confirmNavigation,
    bypassGuardAndNavigate,
  };
}
