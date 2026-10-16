"use client";

import React, { useState, useMemo } from "react";
import type { AdminRmaInspectionModalProps } from "./admin-rma-types";
import type {
  BoxPhysicalCondition,
  InspectionRejectionReason,
  WarehouseInspectionLineInput,
  WarehouseInspectionInput,
} from "@/lib/retailer/rma";

interface LineFormState {
  lineId: string;
  quantityReceived: string;
  quantityAcceptedResaleable: string;
  quantityRejected: string;
  rejectionReason: InspectionRejectionReason | "";
  discrepancyNotes: string;
}

export function AdminRmaInspectionModal({
  isOpen,
  onClose,
  rma,
  existingRecord,
  onSaveDraft,
  onCompleteInspection,
}: AdminRmaInspectionModalProps) {
  const [boxCondition, setBoxCondition] = useState<BoxPhysicalCondition>(
    existingRecord?.boxCondition || "intact"
  );
  const [inspectorName, setInspectorName] = useState(
    existingRecord?.inspectedBy?.name || "Warehouse Lead"
  );
  const [inspectorId, setInspectorId] = useState(
    existingRecord?.inspectedBy?.userId || "wh-inspector-01"
  );
  const [overallNotes, setOverallNotes] = useState(
    existingRecord?.overallNotes || ""
  );

  // Initialize line form states
  const [lineStates, setLineStates] = useState<Record<string, LineFormState>>(() => {
    const map: Record<string, LineFormState> = {};
    for (const line of rma.lines) {
      const existingLine = existingRecord?.lines.find((l) => l.lineId === line.id);
      map[line.id] = {
        lineId: line.id,
        quantityReceived: existingLine ? String(existingLine.quantityReceived) : String(line.quantityAuthorized),
        quantityAcceptedResaleable: existingLine
          ? String(existingLine.quantityAcceptedResaleable)
          : String(line.quantityAuthorized),
        quantityRejected: existingLine ? String(existingLine.quantityRejected) : "0",
        rejectionReason: existingLine?.rejectionReason || "",
        discrepancyNotes: existingLine?.discrepancyNotes || "",
      };
    }
    return map;
  });

  const handleLineChange = (lineId: string, field: keyof LineFormState, value: string) => {
    setLineStates((prev) => ({
      ...prev,
      [lineId]: {
        ...prev[lineId],
        [field]: value,
      },
    }));
  };

  // Real-time Invariant Validations
  const validation = useMemo(() => {
    const errors: string[] = [];
    let totalAuthorized = 0;
    let totalReceived = 0;
    let totalAccepted = 0;
    let totalRejected = 0;
    let totalMissing = 0;
    let estimatedSettlementCents = 0;

    for (const line of rma.lines) {
      totalAuthorized += line.quantityAuthorized;
      const s = lineStates[line.id];
      if (!s) continue;

      const received = Math.max(0, parseInt(s.quantityReceived, 10) || 0);
      const accepted = Math.max(0, parseInt(s.quantityAcceptedResaleable, 10) || 0);
      const rejected = Math.max(0, parseInt(s.quantityRejected, 10) || 0);
      const authorized = line.quantityAuthorized;
      const missing = Math.max(0, authorized - received);

      totalReceived += received;
      totalAccepted += accepted;
      totalRejected += rejected;
      totalMissing += missing;

      // Invariant 1: accepted <= received
      if (accepted > received) {
        errors.push(`${line.productSku}: Accepted units (${accepted}) cannot exceed received units (${received}).`);
      }

      // Invariant 2: accepted <= authorized
      if (accepted > authorized) {
        errors.push(`${line.productSku}: Accepted units (${accepted}) cannot exceed authorized units (${authorized}).`);
      }

      // Invariant 3: received = accepted + rejected
      if (received !== accepted + rejected) {
        errors.push(
          `${line.productSku}: Received units (${received}) must equal accepted (${accepted}) + rejected (${rejected}). (Unaccounted difference: ${
            received - (accepted + rejected)
          })`
        );
      }

      // Invariant 4: rejection reason required if rejected > 0
      if (rejected > 0 && !s.rejectionReason) {
        errors.push(`${line.productSku}: Rejection reason is required for rejected units (${rejected}).`);
      }

      // Live settlement calculation
      estimatedSettlementCents += accepted * line.frozenWholesalePriceCents;
    }

    if (!inspectorName.trim() || !inspectorId.trim()) {
      errors.push("Inspector attribution is required (Name and User ID).");
    }

    const isFullyReconciled = errors.length === 0;

    return {
      isValid: isFullyReconciled,
      errors,
      totalAuthorized,
      totalReceived,
      totalAccepted,
      totalRejected,
      totalMissing,
      estimatedSettlementCents,
      estimatedSettlementDollars: estimatedSettlementCents / 100,
    };
  }, [rma.lines, lineStates, inspectorName, inspectorId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-5 my-8 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🔍</span>
              <h3 className="text-base font-bold text-white">Warehouse Physical Inspection</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                Option B Reconciliation
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              RMA: <span className="font-mono text-cyan-400">{rma.rmaNumber}</span> · Store:{" "}
              <span className="text-zinc-200">{rma.storeId}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-xs px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            ✕ Close
          </button>
        </div>

        {/* Inspector & Box Condition */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 text-xs">
          <div>
            <label className="block text-zinc-400 font-semibold mb-1">Box Physical Condition *</label>
            <select
              value={boxCondition}
              onChange={(e) => setBoxCondition(e.target.value as BoxPhysicalCondition)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="intact">Intact (Good Condition)</option>
              <option value="damaged">Damaged / Crushed</option>
              <option value="crushed">Severely Crushed</option>
              <option value="tampered">Tampered / Resealed</option>
              <option value="water_damaged">Water Damaged</option>
            </select>
          </div>
          <div>
            <label className="block text-zinc-400 font-semibold mb-1">Inspector Name *</label>
            <input
              type="text"
              required
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="block text-zinc-400 font-semibold mb-1">Inspector ID *</label>
            <input
              type="text"
              required
              value={inspectorId}
              onChange={(e) => setInspectorId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Validation Errors Alert */}
        {validation.errors.length > 0 && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-1 shadow-xs">
            <div className="font-bold flex items-center gap-1.5">
              <span>⚠️</span>
              <span>Inspection Invariant Discrepancies ({validation.errors.length}):</span>
            </div>
            <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-rose-300/90">
              {validation.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Multi-SKU Line Items Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              Authorized SKU Reconciliation ({rma.lines.length} lines)
            </h4>
            <span className="text-[11px] text-zinc-400">
              Only accepted resaleable units earn 100% wholesale credit.
            </span>
          </div>

          <div className="overflow-x-auto border border-zinc-800 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/80 text-zinc-400 uppercase text-[10px] tracking-wider font-semibold">
                  <th className="py-2.5 px-3">Product / SKU</th>
                  <th className="py-2.5 px-2 text-center">Auth Qty</th>
                  <th className="py-2.5 px-2 text-center w-20">Received</th>
                  <th className="py-2.5 px-2 text-center w-20">Accepted</th>
                  <th className="py-2.5 px-2 text-center w-20">Rejected</th>
                  <th className="py-2.5 px-2 text-center">Missing</th>
                  <th className="py-2.5 px-3">Rejection Reason</th>
                  <th className="py-2.5 px-3 text-right">Wholesale Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/60">
                {rma.lines.map((line) => {
                  const s = lineStates[line.id] || {
                    lineId: line.id,
                    quantityReceived: "0",
                    quantityAcceptedResaleable: "0",
                    quantityRejected: "0",
                    rejectionReason: "",
                    discrepancyNotes: "",
                  };
                  const received = parseInt(s.quantityReceived, 10) || 0;
                  const accepted = parseInt(s.quantityAcceptedResaleable, 10) || 0;
                  const rejected = parseInt(s.quantityRejected, 10) || 0;
                  const missing = Math.max(0, line.quantityAuthorized - received);

                  return (
                    <tr key={line.id} className="hover:bg-zinc-800/20">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-zinc-200">{line.productName}</div>
                        <div className="font-mono text-[10px] text-cyan-400">{line.productSku}</div>
                      </td>
                      <td className="py-3 px-2 text-center font-bold text-zinc-300">
                        {line.quantityAuthorized}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <input
                          type="number"
                          min="0"
                          value={s.quantityReceived}
                          onChange={(e) => handleLineChange(line.id, "quantityReceived", e.target.value)}
                          className="w-16 px-1.5 py-1 text-center rounded bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-cyan-500 font-mono text-xs"
                        />
                      </td>
                      <td className="py-3 px-2 text-center">
                        <input
                          type="number"
                          min="0"
                          value={s.quantityAcceptedResaleable}
                          onChange={(e) =>
                            handleLineChange(line.id, "quantityAcceptedResaleable", e.target.value)
                          }
                          className="w-16 px-1.5 py-1 text-center rounded bg-zinc-950 border border-emerald-500/40 text-emerald-400 font-bold focus:outline-none focus:border-emerald-500 font-mono text-xs"
                        />
                      </td>
                      <td className="py-3 px-2 text-center">
                        <input
                          type="number"
                          min="0"
                          value={s.quantityRejected}
                          onChange={(e) => handleLineChange(line.id, "quantityRejected", e.target.value)}
                          className="w-16 px-1.5 py-1 text-center rounded bg-zinc-950 border border-rose-500/40 text-rose-400 font-bold focus:outline-none focus:border-rose-500 font-mono text-xs"
                        />
                      </td>
                      <td className="py-3 px-2 text-center font-mono font-semibold text-zinc-400">
                        {missing > 0 ? (
                          <span className="text-amber-400">-{missing}</span>
                        ) : (
                          <span className="text-zinc-600">0</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <select
                          disabled={rejected === 0}
                          value={s.rejectionReason}
                          onChange={(e) =>
                            handleLineChange(line.id, "rejectionReason", e.target.value)
                          }
                          className={`w-full px-2 py-1 rounded text-[11px] bg-zinc-950 border border-zinc-800 focus:outline-none focus:border-cyan-500 ${
                            rejected > 0 && !s.rejectionReason
                              ? "border-rose-500 text-rose-300"
                              : "text-zinc-300"
                          }`}
                        >
                          <option value="">{rejected > 0 ? "-- Select Reason --" : "N/A"}</option>
                          <option value="damaged">Damaged / Leaking</option>
                          <option value="expired">Expired / Past Date</option>
                          <option value="opened_unsealed">Opened / Broken Seal</option>
                          <option value="wrong_sku">Wrong SKU Returned</option>
                          <option value="counterfeit">Suspected Counterfeit</option>
                          <option value="missing_parts">Missing Parts / Incomplete</option>
                          <option value="other">Other Warehouse Reason</option>
                        </select>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-zinc-300">
                        ${line.frozenUnitWholesalePrice.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Settlement & Quantity Summary Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">
          <div>
            <div className="text-[10px] text-zinc-500 uppercase font-semibold">Total Authorized</div>
            <div className="text-base font-bold text-white mt-0.5">{validation.totalAuthorized} units</div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 uppercase font-semibold">Accepted Resaleable</div>
            <div className="text-base font-bold text-emerald-400 mt-0.5">
              {validation.totalAccepted} units
            </div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 uppercase font-semibold">Rejected / Missing</div>
            <div className="text-base font-bold text-rose-400 mt-0.5">
              {validation.totalRejected} / {validation.totalMissing}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 uppercase font-semibold">Eligible Credit Amount</div>
            <div className="text-base font-bold text-cyan-400 mt-0.5">
              ${validation.estimatedSettlementDollars.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Overall Notes */}
        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1">
            Warehouse Overall Inspection Notes
          </label>
          <textarea
            rows={2}
            placeholder="Record general packaging condition, carrier tracking observations, or disposal notes..."
            value={overallNotes}
            onChange={(e) => setOverallNotes(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-zinc-800 text-xs">
          <div className="text-[11px] text-zinc-500">
            Phase 3: Inspection engine validated. Actions operate in safe preview mode until live DB connects.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled
              title="Save draft disabled until Phase 3 backend connects"
              className="px-3.5 py-2 rounded-lg bg-zinc-800 text-zinc-500 font-medium cursor-not-allowed border border-zinc-700/50"
            >
              Save Draft (Preview)
            </button>
            <button
              type="button"
              disabled={!validation.isValid}
              title={
                !validation.isValid
                  ? "Cannot complete: Resolve invariant errors above"
                  : "Database write disabled in Phase 3"
              }
              className={`px-4 py-2 rounded-lg font-semibold text-xs shadow-xs transition-colors ${
                validation.isValid
                  ? "bg-cyan-600/60 text-white/70 cursor-not-allowed"
                  : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
              }`}
            >
              Complete Inspection (Preview)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
