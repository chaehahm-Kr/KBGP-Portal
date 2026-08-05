"use client";

import React, { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { passwordSchema, PASSWORD_RULE_DESCRIPTION } from "@/lib/auth/password";

type SetupProfileFormProps = {
  email: string;
  completeAction: (prevState: any, formData: FormData) => Promise<any>;
};

export function SetupProfileForm({ email, completeAction }: SetupProfileFormProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [pwError, setPwError] = useState("");
  const [isUpdatingPw, setIsUpdatingPw] = useState(false);

  // Profile Form States
  const [name, setName] = useState("");
  const [englishName, setEnglishName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("Seoul");
  const [timezone, setTimezone] = useState("Asia/Seoul");
  const [language, setLanguage] = useState("ko");
  const [birthday, setBirthday] = useState("");
  const [agreePolicy, setAgreePolicy] = useState(false);

  const [isSubmittingProfile, startSubmitProfile] = useTransition();
  const [profileError, setProfileError] = useState("");

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");

    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setPwError(parsed.error.issues[0]?.message ?? "비밀번호 조건을 확인해주세요.");
      return;
    }

    if (password !== confirmPassword) {
      setPwError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setIsUpdatingPw(true);
    const supabase = createClient();
    
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setPwError("비밀번호 변경 실패: " + error.message);
      } else {
        setPasswordSuccess(true);
        // Advance to step 2 after a brief delay
        setTimeout(() => {
          setStep(2);
        }, 800);
      }
    } catch (err) {
      setPwError("오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setIsUpdatingPw(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");

    if (!name.trim()) return setProfileError("이름을 입력해주세요.");
    if (!englishName.trim()) return setProfileError("영문 이름을 입력해주세요.");
    if (!nickname.trim()) return setProfileError("닉네임을 입력해주세요.");
    if (!phone.trim()) return setProfileError("연락처를 입력해주세요.");
    if (!birthday) return setProfileError("생년월일을 입력해주세요.");
    if (!agreePolicy) return setProfileError("이용 및 보안 정책에 동의해 주세요.");

    startSubmitProfile(async () => {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("englishName", englishName);
      fd.append("nickname", nickname);
      fd.append("phone", phone);
      fd.append("region", region);
      fd.append("timezone", timezone);
      fd.append("language", language);
      fd.append("birthday", birthday);

      const res = await completeAction(null, fd);
      if (res && res.error) {
        setProfileError(res.error);
      } else {
        // Redirect to admin main page
        window.location.href = "/admin";
      }
    });
  };

  if (step === 1) {
    return (
      <form onSubmit={handlePasswordSubmit} className="space-y-4">
        {pwError && (
          <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-lg text-red-400 font-semibold leading-normal">
            {pwError}
          </div>
        )}
        {passwordSuccess && (
          <div className="p-3 bg-emerald-950/20 border border-emerald-900/50 rounded-lg text-emerald-400 font-semibold leading-normal">
            ✓ 비밀번호가 안전하게 변경되었습니다. 프로필 단계로 이동합니다...
          </div>
        )}

        <div className="space-y-0.5">
          <label className="block text-zinc-400 font-bold">접속 이메일</label>
          <input
            type="text"
            disabled
            value={email}
            className="w-full bg-zinc-800/40 border border-zinc-800 text-zinc-500 rounded-lg px-3 py-2 outline-none cursor-not-allowed font-medium"
          />
        </div>

        <div className="space-y-0.5">
          <label className="block text-zinc-300 font-bold">새 비밀번호</label>
          <input
            type="password"
            required
            placeholder="새로운 비밀번호 입력"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isUpdatingPw || passwordSuccess}
            className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-lg px-3 py-2 outline-none focus:border-zinc-700 transition-colors"
          />
          <p className="text-[9px] text-zinc-500 mt-1 leading-normal">
            {PASSWORD_RULE_DESCRIPTION}
          </p>
        </div>

        <div className="space-y-0.5">
          <label className="block text-zinc-300 font-bold">비밀번호 확인</label>
          <input
            type="password"
            required
            placeholder="비밀번호 다시 입력"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isUpdatingPw || passwordSuccess}
            className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-lg px-3 py-2 outline-none focus:border-zinc-700 transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={isUpdatingPw || passwordSuccess}
          className="w-full bg-white hover:bg-zinc-100 text-zinc-950 font-bold py-2.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 text-xs"
        >
          {isUpdatingPw ? "비밀번호 업데이트 중..." : "새 비밀번호 설정 및 다음 단계"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleProfileSubmit} className="space-y-4">
      {profileError && (
        <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-lg text-red-400 font-semibold leading-normal">
          {profileError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-0.5">
          <label className="block text-zinc-300 font-bold">이름 (한글)</label>
          <input
            type="text"
            required
            placeholder="홍길동"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-lg px-3 py-2 outline-none focus:border-zinc-700 transition-colors"
          />
        </div>

        <div className="space-y-0.5">
          <label className="block text-zinc-300 font-bold">영문 이름</label>
          <input
            type="text"
            required
            placeholder="Gildong Hong"
            value={englishName}
            onChange={(e) => setEnglishName(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-lg px-3 py-2 outline-none focus:border-zinc-700 transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-0.5">
          <label className="block text-zinc-300 font-bold">닉네임</label>
          <input
            type="text"
            required
            placeholder="길동매니저"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-lg px-3 py-2 outline-none focus:border-zinc-700 transition-colors"
          />
        </div>

        <div className="space-y-0.5">
          <label className="block text-zinc-300 font-bold">연락처 (휴대폰)</label>
          <input
            type="text"
            required
            placeholder="010-1234-5678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-lg px-3 py-2 outline-none focus:border-zinc-700 transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-0.5">
          <label className="block text-zinc-300 font-bold">근무 도시</label>
          <input
            type="text"
            required
            placeholder="Seoul"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-lg px-3 py-2 outline-none focus:border-zinc-700 transition-colors"
          />
        </div>

        <div className="space-y-0.5">
          <label className="block text-zinc-300 font-bold">생년월일</label>
          <input
            type="date"
            required
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-lg px-3 py-2 outline-none focus:border-zinc-700 transition-colors cursor-pointer"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-0.5">
          <label className="block text-zinc-300 font-bold">시간대 (Timezone)</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-lg px-3 py-2 outline-none focus:border-zinc-700 transition-colors cursor-pointer"
          >
            <option value="Asia/Seoul">Seoul (GMT+9)</option>
            <option value="America/New_York">New York (EST/EDT)</option>
            <option value="America/Los_Angeles">Los Angeles (PST/PDT)</option>
            <option value="UTC">Coordinated Universal Time (UTC)</option>
          </select>
        </div>

        <div className="space-y-0.5">
          <label className="block text-zinc-300 font-bold">선호 언어</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-lg px-3 py-2 outline-none focus:border-zinc-700 transition-colors cursor-pointer"
          >
            <option value="ko">한국어 (Korean)</option>
            <option value="en">English (영어)</option>
          </select>
        </div>
      </div>

      <div className="pt-2">
        <label className="flex items-start gap-2 text-zinc-400 font-medium cursor-pointer select-none leading-relaxed">
          <input
            type="checkbox"
            checked={agreePolicy}
            onChange={(e) => setAgreePolicy(e.target.checked)}
            className="mt-0.5 cursor-pointer accent-white"
          />
          <span>
            사내 내부 정보 보안 정책을 준수하며, 시스템 보안 가이드 및 이용약관에 의거해 성실히 업무를 수행함에 동의합니다. (필수)
          </span>
        </label>
      </div>

      <button
        type="submit"
        disabled={isSubmittingProfile}
        className="w-full bg-white hover:bg-zinc-100 text-zinc-950 font-bold py-2.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 text-xs"
      >
        {isSubmittingProfile ? "프로필 등록 및 승인 중..." : "✓ 계정 설정 완료 및 콘솔 입장"}
      </button>
    </form>
  );
}
