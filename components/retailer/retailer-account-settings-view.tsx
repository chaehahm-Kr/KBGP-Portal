"use client";

import React, { useState, useTransition } from "react";
import { logoutRetailer } from "@/lib/auth/actions";
import { updatePersonalProfileAction } from "@/lib/retailer/organization-actions";
import { changeRetailerPasswordAction } from "@/lib/auth/password-actions";
import { PwaInstallAffordance } from "@/components/retailer/pwa-install-manager";
import { useTranslation } from "@/lib/i18n";
import { LanguageToggle } from "@/components/retailer/language-toggle";
import { ThemeToggle } from "@/components/retailer/theme-toggle";

export interface PersonalProfileItem {
  id: string;
  displayName: string;
  email: string;
  phone?: string | null;
  role: string;
}

interface RetailerAccountSettingsViewProps {
  profile: PersonalProfileItem;
}

export function RetailerAccountSettingsView({
  profile,
}: RetailerAccountSettingsViewProps) {
  const [isPending, startTransition] = useTransition();
  const { t, locale } = useTranslation();

  // 1. Personal Profile Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileDisplayName, setProfileDisplayName] = useState(profile.displayName);
  const [profilePhone, setProfilePhone] = useState(profile.phone || "");
  const [profileError, setProfileError] = useState("");

  // 2. Change Password Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const isOwner = profile.role.toLowerCase() === "owner";
  const isBuyer = profile.role.toLowerCase() === "buyer";

  const handleClosePasswordModal = () => {
    setIsPasswordModalOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setPasswordError("");
    setPasswordSuccess("");
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword) {
      setPasswordError(locale === "ko" ? "현재 비밀번호를 입력해주세요." : "Please enter your current password.");
      return;
    }

    if (!newPassword) {
      setPasswordError(locale === "ko" ? "새 비밀번호를 입력해주세요." : "Please enter a new password.");
      return;
    }

    if (!confirmPassword) {
      setPasswordError(locale === "ko" ? "새 비밀번호 확인을 입력해주세요." : "Please confirm your new password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(locale === "ko" ? "새 비밀번호가 일치하지 않습니다." : "New password and confirmation password do not match.");
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordError(locale === "ko" ? "새 비밀번호는 이전 비밀번호와 달라야 합니다." : "New password must be different from your current password.");
      return;
    }

    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPasswordError(
        locale === "ko"
          ? "비밀번호는 8자 이상이며 영문자와 숫자를 모두 포함해야 합니다."
          : "Password must be at least 8 characters long and contain both letters and numbers."
      );
      return;
    }

    startTransition(async () => {
      const res = await changeRetailerPasswordAction({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (!res.success) {
        setPasswordError(res.error || (locale === "ko" ? "비밀번호 변경에 실패했습니다." : "Failed to update password."));
      } else {
        setPasswordSuccess(res.message || (locale === "ko" ? "비밀번호가 성공적으로 변경되었습니다." : "Your password has been updated successfully."));
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => {
          handleClosePasswordModal();
        }, 1800);
      }
    });
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");

    if (!profileDisplayName.trim()) {
      setProfileError(locale === "ko" ? "이름을 입력해주세요." : "Display name cannot be empty.");
      return;
    }

    startTransition(async () => {
      const res = await updatePersonalProfileAction({
        displayName: profileDisplayName.trim(),
        phone: profilePhone.trim() || undefined,
      });

      if (res.success) {
        setIsProfileModalOpen(false);
        window.location.reload();
      } else {
        setProfileError(res.error || (locale === "ko" ? "프로필 수정에 실패했습니다." : "Failed to update personal profile."));
      }
    });
  };

  const roleTitle = profile.role.charAt(0).toUpperCase() + profile.role.slice(1).replace(/_/g, " ");

  const authorityDescription = isOwner
    ? t.account.ownerAuthorityDesc
    : isBuyer
    ? t.account.buyerAuthorityDesc
    : t.account.staffAuthorityDesc;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
            {t.account.accountSettingsTitle}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {t.account.accountSettingsSubtitle}
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Personal Profile Card */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-xs space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-700 dark:text-zinc-300">
                    {profile.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                      {t.account.tabPersonal}
                    </h2>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {locale === "ko" ? "인증된 사용자 계정 정보" : "Authenticated user identity"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setProfileDisplayName(profile.displayName);
                    setProfilePhone(profile.phone || "");
                    setProfileError("");
                    setIsProfileModalOpen(true);
                  }}
                  className="px-3 py-1 text-xs font-bold rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                >
                  {t.account.editProfile}
                </button>
              </div>

              <div className="space-y-3 text-xs pt-3">
                <div>
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block">{t.account.displayName}</span>
                  <span className="font-semibold text-zinc-900 dark:text-white">{profile.displayName}</span>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block">{t.account.email}</span>
                  <span className="font-mono text-zinc-900 dark:text-white">{profile.email}</span>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block">{t.account.phone}</span>
                  <span className="text-zinc-900 dark:text-white font-mono">{profile.phone || (locale === "ko" ? "미등록" : "Not recorded")}</span>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block">{t.account.role}</span>
                  <div className="inline-flex items-center gap-1.5 mt-0.5 px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 capitalize">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    {roleTitle}
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-zinc-400 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              {locale === "ko"
                ? "이름과 전화번호는 직접 변경 가능합니다. 권한 변경은 조직 최고 관리자(Owner)에게 요청하세요."
                : "Display name and phone are self-service. Role changes require Company Owner authorization."}
            </p>
          </div>

          {/* Login & Security Card */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-xs space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-lg">
                    🔒
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                      {t.account.loginSecurity}
                    </h2>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {locale === "ko" ? "인증 및 활성 로그인 세션" : "Authentication & active session"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-xs pt-3">
                <div>
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block">{t.account.authMethod}</span>
                  <span className="font-semibold text-zinc-900 dark:text-white">
                    {locale === "ko" ? "이메일 및 보안 비밀번호" : "Email & Secure Password"}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block">{t.account.activeLoginEmail}</span>
                  <span className="font-mono text-zinc-900 dark:text-white">{profile.email}</span>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block">{t.account.sessionStatus}</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{t.account.activeVerified}</span>
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block">{t.account.permissionAuthority}</span>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-300 mt-0.5">
                    {authorityDescription}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
              <button
                type="button"
                onClick={() => {
                  handleClosePasswordModal();
                  setIsPasswordModalOpen(true);
                }}
                className="w-full py-2 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                <span>🔑</span>
                <span>{t.account.changePassword}</span>
              </button>

              <form action={logoutRetailer}>
                <button
                  type="submit"
                  className="w-full py-2 px-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>🚪</span>
                  <span>{t.header.signOut}</span>
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Language Preference Card */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-lg">
                🌐
              </div>
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                  {t.account.languagePreference}
                </h2>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {t.account.languageSubtitle}
                </p>
              </div>
            </div>

            <div className="shrink-0">
              <LanguageToggle variant="buttons" />
            </div>
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>
              {locale === "ko"
                ? "선택한 언어는 브라우저 쿠키 및 계정 프로필에 안전하게 동기화되어 저장됩니다."
                : "Your selected language is automatically saved to your browser and account profile."}
            </span>
          </div>
        </div>

        {/* Appearance & Theme Card */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center text-lg">
                🎨
              </div>
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                  {t.account.appearanceTitle}
                </h2>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {t.account.appearanceSubtitle}
                </p>
              </div>
            </div>

            <div className="shrink-0">
              <ThemeToggle variant="buttons" />
            </div>
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>
              {locale === "ko"
                ? "라이트 모드, 다크 모드 또는 시스템 기본 설정을 즉시 적용할 수 있습니다."
                : "Switch seamlessly between Light, Dark, or System default appearance."}
            </span>
          </div>
        </div>

        {/* PWA Mobile & Pilot Store App Readiness Card */}
        <PwaInstallAffordance variant="account" />
      </div>

      {/* MODAL 1: Personal Profile Edit Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                {t.account.editProfile}
              </h3>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3.5 pt-4 text-xs">
              {profileError && (
                <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/15 dark:text-red-400">
                  {profileError}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t.account.displayName} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={profileDisplayName}
                  onChange={(e) => setProfileDisplayName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  placeholder={locale === "ko" ? "예: 홍길동" : "e.g. John Doe"}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t.account.phone} <span className="text-zinc-400 font-normal">({locale === "ko" ? "선택" : "Optional"})</span>
                </label>
                <input
                  type="text"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white font-mono"
                  placeholder={locale === "ko" ? "예: +1 (555) 123-4567" : "e.g. +1 (555) 123-4567"}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 cursor-pointer shadow-xs"
                >
                  {isPending ? t.account.saving : t.account.saveChanges}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Change Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  {t.account.changePassword}
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {locale === "ko" ? "새로운 보안 비밀번호를 설정하세요" : "Set a new secure password for your account"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClosePasswordModal}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-3.5 pt-4 text-xs">
              {passwordError && (
                <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/15 dark:text-red-400">
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/15 dark:text-emerald-400">
                  {passwordSuccess}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {locale === "ko" ? "현재 비밀번호" : "Current Password"} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 pr-9 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm"
                  >
                    {showCurrentPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {locale === "ko" ? "새 비밀번호" : "New Password"} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 pr-9 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm"
                  >
                    {showNewPassword ? "🙈" : "👁️"}
                  </button>
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                  {locale === "ko"
                    ? "8자 이상, 영문자와 숫자를 각각 1개 이상 포함해야 합니다."
                    : "At least 8 characters with at least one letter and one number."}
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {locale === "ko" ? "새 비밀번호 확인" : "Confirm New Password"} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 pr-9 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm"
                  >
                    {showConfirmPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={handleClosePasswordModal}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 cursor-pointer shadow-xs"
                >
                  {isPending ? t.account.saving : (locale === "ko" ? "비밀번호 업데이트" : "Update Password")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
