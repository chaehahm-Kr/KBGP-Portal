"use client";

import React, { useState, useTransition, useActionState, startTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminCreateCompany, type AdminCompanyFormState } from "@/lib/company/admin-actions";

const inputClass =
  "mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-all focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-indigo-500";
const labelClass = "block text-sm font-semibold text-zinc-700 dark:text-zinc-300";

const typeOptions = ["Brand Owner", "Distributor", "Manufacturer", "Retailer", "Exporter"];
const statusOptions = [
  { id: "Active", label: "승인 완료 (Active)" },
  { id: "Pending", label: "승인 대기 (Pending)" },
  { id: "Inactive", label: "일시 정지 (Inactive)" },
];

export function AdminCompanyCreateForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<AdminCompanyFormState, FormData>(
    adminCreateCompany,
    undefined
  );

  const [name, setName] = useState("");
  const [businessNumber, setBusinessNumber] = useState("");
  const [country, setCountry] = useState("대한민국");
  const [type, setType] = useState("Brand Owner");
  const [status, setStatus] = useState("Active");

  // Detailed address states
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [zipCode, setZipCode] = useState("");

  const [website, setWebsite] = useState("");
  const [adminMemo, setAdminMemo] = useState("");

  // Representative contact states
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactTitle, setContactTitle] = useState("");
  const [contactPosition, setContactPosition] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!name.trim()) {
      alert("회사명을 입력해 주세요.");
      return;
    }
    if (!businessNumber.trim()) {
      alert("사업자등록번호를 입력해 주세요.");
      return;
    }
    if (!contactName.trim() || !contactEmail.trim() || !contactPhone.trim()) {
      alert("대표 담당자 정보(이름, 이메일, 연락처)는 필수 입력 사항입니다.");
      return;
    }

    const form = e.currentTarget;
    const formData = new FormData(form);
    // Explicitly pass values
    formData.set("state", stateVal); // State is reserved keyword, handle stateVal binding

    startTransition(() => {
      formAction(formData);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* 1. 회사 기본 정보 */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-2 dark:border-zinc-800">
          1. 회사 기본 정보
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className={labelClass}>
              회사명 (법인/개인명) *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="예: 레투스토 테스트"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="businessNumber" className={labelClass}>
              사업자등록번호 *
            </label>
            <input
              id="businessNumber"
              name="businessNumber"
              type="text"
              required
              placeholder="예: 1112233334 (숫자만)"
              value={businessNumber}
              onChange={(e) => setBusinessNumber(e.target.value)}
              className={`${inputClass} font-mono`}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="country" className={labelClass}>
              국가 *
            </label>
            <input
              id="country"
              name="country"
              type="text"
              required
              placeholder="예: 대한민국"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="type" className={labelClass}>
              회사 유형 *
            </label>
            <select
              id="type"
              name="type"
              required
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={inputClass}
            >
              {typeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="status" className={labelClass}>
              파트너 상태 *
            </label>
            <select
              id="status"
              name="status"
              required
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={inputClass}
            >
              {statusOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. 세분화 주소 정보 */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-2 dark:border-zinc-800">
          2. 회사 주소 정보 (세분화)
        </h2>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="address1" className={labelClass}>
              기본 주소 (Address Line 1)
            </label>
            <input
              id="address1"
              name="address1"
              type="text"
              placeholder="도로명 주소 또는 기본 주소 입력"
              value={address1}
              onChange={(e) => setAddress1(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="address2" className={labelClass}>
              상세 주소 (Address Line 2)
            </label>
            <input
              id="address2"
              name="address2"
              type="text"
              placeholder="동/호수, 건물명 등 상세 주소 입력"
              value={address2}
              onChange={(e) => setAddress2(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="city" className={labelClass}>
              도시 (City)
            </label>
            <input
              id="city"
              name="city"
              type="text"
              placeholder="예: 서울시, 대전시"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="state" className={labelClass}>
              주 / 도 (State / Province)
            </label>
            <input
              id="state"
              name="stateVal"
              type="text"
              placeholder="예: 경기도, 충청남도"
              value={stateVal}
              onChange={(e) => setStateVal(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="zipCode" className={labelClass}>
              우편번호 (Zip / Postal Code)
            </label>
            <input
              id="zipCode"
              name="zipCode"
              type="text"
              placeholder="예: 34112"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              className={`${inputClass} font-mono`}
            />
          </div>
        </div>
      </div>

      {/* 3. 추가 정보 및 관리자 메모 */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-2 dark:border-zinc-800">
          3. 추가 정보
        </h2>
        <div>
          <label htmlFor="website" className={labelClass}>
            웹사이트 URL
          </label>
          <input
            id="website"
            name="website"
            type="url"
            placeholder="https://example.com"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="adminMemo" className={labelClass}>
            관리자 메모 (내부용)
          </label>
          <textarea
            id="adminMemo"
            name="adminMemo"
            placeholder="관리자 내부 전용 참고사항을 입력해 주세요."
            rows={3}
            value={adminMemo}
            onChange={(e) => setAdminMemo(e.target.value)}
            className={`${inputClass} resize-y`}
          />
        </div>
      </div>

      {/* 4. 대표 담당자 정보 */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-2 dark:border-zinc-800">
          4. 대표 담당자 정보 (최초 관리 권한)
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="contactName" className={labelClass}>
              담당자 이름 *
            </label>
            <input
              id="contactName"
              name="contactName"
              type="text"
              required
              placeholder="예: 홍길동"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="contactEmail" className={labelClass}>
              담당자 이메일 *
            </label>
            <input
              id="contactEmail"
              name="contactEmail"
              type="email"
              required
              placeholder="예: name@example.com"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="contactPhone" className={labelClass}>
              연락처 *
            </label>
            <input
              id="contactPhone"
              name="contactPhone"
              type="text"
              required
              placeholder="예: 01012345678"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="contactTitle" className={labelClass}>
              직함
            </label>
            <input
              id="contactTitle"
              name="contactTitle"
              type="text"
              placeholder="예: 과장, 팀장"
              value={contactTitle}
              onChange={(e) => setContactTitle(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="contactPosition" className={labelClass}>
              부서 / 포지션
            </label>
            <input
              id="contactPosition"
              name="contactPosition"
              type="text"
              placeholder="예: 해외영업부"
              value={contactPosition}
              onChange={(e) => setContactPosition(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {state?.error && (
        <p className="text-xs font-semibold text-rose-600 dark:text-rose-455" role="alert">
          {state.error}
        </p>
      )}

      {/* Form Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-zinc-900 hover:bg-zinc-850 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 px-5 py-2.5 text-xs font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
        >
          {pending ? "등록 중..." : "회사 등록"}
        </button>

        <Link
          href="/admin/companies"
          className="rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-xs font-bold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 cursor-pointer"
        >
          취소
        </Link>
      </div>
    </form>
  );
}
