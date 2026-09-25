"use client";

import React, { useState, useTransition } from "react";
import {
  MyAccountData,
  updateMyAccountProfileAction,
  changeMyAccountPasswordAction,
  sendMyAccountPasswordResetEmailAction,
} from "@/lib/portal/account-actions";
import { PASSWORD_RULE_DESCRIPTION } from "@/lib/auth/password";

interface MyAccountViewProps {
  initialData: MyAccountData;
}

export function MyAccountView({ initialData }: MyAccountViewProps) {
  const [data, setData] = useState<MyAccountData>(initialData);
  const [isPending, startTransition] = useTransition();

  // Profile Form States
  const [name, setName] = useState(data.name);
  const [phone, setPhone] = useState(data.phone);
  const [title, setTitle] = useState(data.title);
  const [position, setPosition] = useState(data.position);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password Form States
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Reset Email State
  const [resetEmailMessage, setResetEmailMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);

    if (!name.trim()) {
      setProfileMessage({ type: "error", text: "이름을 입력해 주세요." });
      return;
    }

    startTransition(async () => {
      const res = await updateMyAccountProfileAction({
        name: name.trim(),
        phone: phone.trim(),
        title: title.trim(),
        position: position.trim(),
      });

      if (res.success) {
        setProfileMessage({ type: "success", text: res.message || "프로필이 성공적으로 변경되었습니다." });
        setData((prev) => ({
          ...prev,
          name: name.trim(),
          phone: phone.trim(),
          title: title.trim(),
          position: position.trim(),
        }));
      } else {
        setProfileMessage({ type: "error", text: res.error || "프로필 저장에 실패했습니다." });
      }
    });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (!currentPassword) {
      setPasswordMessage({ type: "error", text: "현재 비밀번호를 입력해 주세요." });
      return;
    }

    if (!newPassword) {
      setPasswordMessage({ type: "error", text: "새 비밀번호를 입력해 주세요." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "새 비밀번호와 확인 비밀번호가 일치하지 않습니다." });
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordMessage({ type: "error", text: "새 비밀번호는 현재 비밀번호와 달라야 합니다." });
      return;
    }

    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPasswordMessage({
        type: "error",
        text: `비밀번호는 ${PASSWORD_RULE_DESCRIPTION}해야 합니다.`,
      });
      return;
    }

    startTransition(async () => {
      const res = await changeMyAccountPasswordAction({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (res.success) {
        setPasswordMessage({ type: "success", text: res.message || "비밀번호가 성공적으로 변경되었습니다." });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPasswordMessage({ type: "error", text: res.error || "비밀번호 변경에 실패했습니다." });
      }
    });
  };

  const handleSendResetEmail = () => {
    setResetEmailMessage(null);
    startTransition(async () => {
      const res = await sendMyAccountPasswordResetEmailAction();
      if (res.success) {
        setResetEmailMessage({
          type: "success",
          text: res.message || "비밀번호 재설정 링크가 이메일로 발송되었습니다.",
        });
      } else {
        setResetEmailMessage({
          type: "error",
          text: res.error || "비밀번호 재설정 이메일 발송에 실패했습니다.",
        });
      }
    });
  };

  const roleText = data.companyRole === "company_admin" ? "관리자(Admin)" : "담당자(Staff)";
  const statusText =
    data.status === "active"
      ? "가입완료 · 정상이용"
      : data.status === "invited"
      ? "초대 대기중"
      : data.status === "suspended"
      ? "이용정지"
      : "제외됨";

  return (
    <div className="space-y-6 w-full max-w-5xl">
      {/* 1. Header Summary Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center text-xl font-extrabold shadow-sm">
              {data.name ? data.name.trim().charAt(0) : data.email.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
                  {data.name || "이름 미등록"}
                </h1>
                {data.isPrimary && (
                  <span className="rounded bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-bold border border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800">
                    대표 담당자
                  </span>
                )}
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-bold border ${
                    data.companyRole === "company_admin"
                      ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800"
                      : "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                  }`}
                >
                  {roleText}
                </span>
                <span className="rounded bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                  {statusText}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                소속 회사: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{data.companyName}</span> · 계정: <span className="font-mono">{data.email}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 2. Section A: Personal Profile */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-xs space-y-5">
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <span>👤</span>
                <span>개인 프로필 (Profile)</span>
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                로그인 계정 본인의 담당자 정보 및 연락처를 수정합니다.
              </p>
            </div>
          </div>

          {profileMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-medium border flex items-center gap-2 ${
                profileMessage.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-300"
                  : "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300"
              }`}
            >
              <span>{profileMessage.type === "success" ? "✅" : "⚠️"}</span>
              <span>{profileMessage.text}</span>
            </div>
          )}

          <form onSubmit={handleProfileSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                이름 (Full Name) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 홍길동"
                required
                className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                로그인 이메일 (Email Address) <span className="text-[10px] text-zinc-400 font-normal">[변경불가]</span>
              </label>
              <input
                type="email"
                value={data.email}
                disabled
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400 cursor-not-allowed font-mono"
              />
              <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                로그인 이메일 변경은 계정 보안을 위해 관리자 또는 Letusto 지원팀에 문의해 주세요.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  직함 (Job Title)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 팀장 / 매니저"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  부서 / 직책 (Department)
                </label>
                <input
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="예: 해외영업팀"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                연락처 (Phone Number)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="예: 010-1234-5678 또는 +82 10-1234-5678"
                className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white font-mono"
              />
            </div>

            {/* Read-Only Organization Context */}
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-950/40 space-y-2 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">소속 회사</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{data.companyName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">부여된 역할</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{roleText}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">계정 상태</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{statusText}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-xl bg-zinc-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 cursor-pointer shadow-xs inline-flex items-center gap-2"
              >
                {isPending && (
                  <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white dark:border-zinc-900/30 dark:border-t-zinc-900 rounded-full animate-spin" />
                )}
                <span>변경사항 저장</span>
              </button>
            </div>
          </form>
        </div>

        {/* 3. Section B: Security & Password Management */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-xs space-y-5">
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <span>🔒</span>
              <span>보안 및 비밀번호 (Security & Password)</span>
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              계정 인증 방식 및 로그인 비밀번호를 안전하게 변경합니다.
            </p>
          </div>

          {passwordMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-medium border flex items-center gap-2 ${
                passwordMessage.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-300"
                  : "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300"
              }`}
            >
              <span>{passwordMessage.type === "success" ? "✅" : "⚠️"}</span>
              <span>{passwordMessage.text}</span>
            </div>
          )}

          {/* Direct Password Change Form */}
          <form onSubmit={handlePasswordSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                현재 비밀번호 (Current Password) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="현재 비밀번호를 입력해 주세요"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs p-1 cursor-pointer"
                  aria-label={showCurrentPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
                >
                  {showCurrentPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                새 비밀번호 (New Password) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="새 비밀번호 (8자 이상, 영문+숫자)"
                  autoComplete="new-password"
                  required
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs p-1 cursor-pointer"
                  aria-label={showNewPassword ? "새 비밀번호 숨기기" : "새 비밀번호 표시"}
                >
                  {showNewPassword ? "🙈" : "👁️"}
                </button>
              </div>
              <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                {PASSWORD_RULE_DESCRIPTION}
              </p>
            </div>

            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                새 비밀번호 확인 (Confirm New Password) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="새 비밀번호를 한 번 더 입력해 주세요"
                  autoComplete="new-password"
                  required
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs p-1 cursor-pointer"
                  aria-label={showConfirmPassword ? "비밀번호 확인 숨기기" : "비밀번호 확인 표시"}
                >
                  {showConfirmPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-xl bg-zinc-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 cursor-pointer shadow-xs inline-flex items-center gap-2"
              >
                {isPending && (
                  <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white dark:border-zinc-900/30 dark:border-t-zinc-900 rounded-full animate-spin" />
                )}
                <span>비밀번호 변경하기</span>
              </button>
            </div>
          </form>

          {/* Alternative: Send Password Reset Email */}
          <div className="pt-5 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
                  비밀번호 재설정 이메일
                </span>
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block mt-0.5">
                  현재 비밀번호가 기억나지 않는 경우 등록된 이메일로 1회용 재설정 링크를 받습니다.
                </span>
              </div>
            </div>

            {resetEmailMessage && (
              <div
                className={`p-2.5 rounded-xl text-xs font-medium border ${
                  resetEmailMessage.type === "success"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-300"
                    : "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300"
                }`}
              >
                {resetEmailMessage.text}
              </div>
            )}

            <button
              type="button"
              onClick={handleSendResetEmail}
              disabled={isPending}
              className="w-full py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
            >
              <span>✉️</span>
              <span>비밀번호 재설정 이메일 발송</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
