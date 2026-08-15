"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createLandedCostCase } from "@/lib/landed-cost/actions";

interface EligibleShipment {
  id: string;
  shipment_number: string;
  status: string;
  po_number: string;
  supplier_name: string;
}

interface CaseFormProps {
  eligibleShipments: EligibleShipment[];
}

export function CaseForm({ eligibleShipments }: CaseFormProps) {
  const router = useRouter();

  const [selectedShipmentIds, setSelectedShipmentIds] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleToggleShipment = (id: string) => {
    setSelectedShipmentIds(prev =>
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedShipmentIds.length === 0) {
      alert("정산에 묶을 선적(Shipment)을 하나 이상 선택해주세요.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const created = await createLandedCostCase({
        shipment_ids: selectedShipmentIds,
        description: description || undefined,
        internal_note: internalNote || undefined
      });
      router.push(`/admin/finance/landed-cost/${created.id}`);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "정산 케이스 생성에 실패했습니다.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl text-xs space-y-6">
      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-250 text-rose-600 font-bold dark:bg-rose-955/10 dark:border-rose-900/50 dark:text-rose-450">
          ⚠️ {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-5">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-3 dark:border-zinc-800">
          Landed Cost 정산 케이스 생성
        </h2>

        {/* Shipment Selection Checklist */}
        <div>
          <label className="block text-[10px] font-bold text-zinc-400 mb-2">정산 대상 선적 선택 (Shipment Consolidation List) *</label>
          {eligibleShipments.length === 0 ? (
            <div className="p-8 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-center text-zinc-400 italic">
              정산 가능한 (창고 도착 및 입고 완료되었으나 아직 Landed Cost 케이스에 할당되지 않은) 선적 건이 없습니다.
            </div>
          ) : (
            <div className="border border-zinc-250 dark:border-zinc-800 rounded-xl max-h-56 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
              {eligibleShipments.map((s) => {
                const isSelected = selectedShipmentIds.includes(s.id);
                return (
                  <div
                    key={s.id}
                    onClick={() => handleToggleShipment(s.id)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-850/50 transition-colors ${
                      isSelected ? "bg-indigo-50/20 dark:bg-indigo-950/5" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="rounded border-zinc-300 text-indigo-650 focus:ring-indigo-650"
                    />
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <span className="font-mono font-bold text-zinc-900 dark:text-white">{s.shipment_number}</span>
                        <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[8px] font-bold text-zinc-500">
                          {s.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">
                        PO: {s.po_number} | 공급업체: {s.supplier_name}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Case description */}
        <div>
          <label className="block text-[10px] font-bold text-zinc-400 mb-1">케이스 한 줄 설명 *</label>
          <input
            type="text"
            placeholder="예: LETUSTO 8월 화물 및 통관비 정산건"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full h-9 border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white px-3 outline-none rounded-xl font-medium"
            required
          />
        </div>

        {/* Internal note */}
        <div>
          <label className="block text-[10px] font-bold text-zinc-400 mb-1">정산 비고 및 내부 메모 (Note)</label>
          <textarea
            placeholder="화물 대금 청구서 매치 특이사항 등을 기입하세요..."
            value={internalNote}
            onChange={(e) => setInternalNote(e.target.value)}
            className="w-full border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 outline-none bg-zinc-50 dark:bg-zinc-950 dark:text-white min-h-[80px]"
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <Link
            href="/admin/finance/landed-cost"
            className="px-4 py-2 border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-350 font-bold rounded-xl cursor-pointer transition-colors"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || eligibleShipments.length === 0}
            className="px-4 py-2 bg-zinc-950 hover:bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 font-bold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "생성 중..." : "정산 케이스 생성 (Create)"}
          </button>
        </div>
      </form>
    </div>
  );
}
