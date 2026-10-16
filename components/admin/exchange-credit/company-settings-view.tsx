"use client";

import React, { useState } from "react";
import type { CompanyExchangeEnrollment, EnrollmentAuditLog } from "@/lib/retailer/exchange-credit-types";
import {
  enrollCompanyExchangeProgramAction,
  updateCompanyExchangeEnrollmentAction,
  pauseCompanyExchangeEnrollmentAction,
} from "@/lib/retailer/exchange-credit-actions";

interface CompanySettingsViewProps {
  enrollments: CompanyExchangeEnrollment[];
  auditLogs: EnrollmentAuditLog[];
  isSchemaAvailable: boolean;
}

export function CompanySettingsView({
  enrollments,
  auditLogs,
  isSchemaAvailable,
}: CompanySettingsViewProps) {
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<CompanyExchangeEnrollment | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);

  // Form states for enroll modal
  const [companyIdInput, setCompanyIdInput] = useState("");
  const [optionARateInput, setOptionARateInput] = useState("0.40");
  const [optionBRateInput, setOptionBRateInput] = useState("0.20");
  const [minWeeksInput, setMinWeeksInput] = useState("8");
  const [notesInput, setNotesInput] = useState("");
  const [enrollSubmitting, setEnrollSubmitting] = useState(false);
  const [enrollError, setEnrollError] = useState("");

  // Form states for edit policy modal
  const [editOptionARate, setEditOptionARate] = useState("0.40");
  const [editMinWeeks, setEditMinWeeks] = useState("8");
  const [editReason, setEditReason] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");

  // Form states for pause modal
  const [pauseReasonInput, setPauseReasonInput] = useState("");
  const [pauseSubmitting, setPauseSubmitting] = useState(false);
  const [pauseError, setPauseError] = useState("");

  const handleOpenEnrollModal = () => {
    setCompanyIdInput("");
    setOptionARateInput("0.40");
    setOptionBRateInput("0.20");
    setMinWeeksInput("8");
    setNotesInput("");
    setEnrollError("");
    setShowEnrollModal(true);
  };

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollSubmitting(true);
    setEnrollError("");

    try {
      const res = await enrollCompanyExchangeProgramAction({
        companyId: companyIdInput.trim(),
        optionARate: parseFloat(optionARateInput),
        optionBRate: parseFloat(optionBRateInput),
        minReportingWeeks: parseInt(minWeeksInput, 10),
        notes: notesInput.trim(),
      });

      if (!res.success) {
        setEnrollError(res.error || "Failed to enroll company.");
      } else {
        setShowEnrollModal(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setEnrollError(message || "An unexpected error occurred.");
    } finally {
      setEnrollSubmitting(false);
    }
  };

  const handleOpenEditModal = (enrollment: CompanyExchangeEnrollment) => {
    setSelectedEnrollment(enrollment);
    setEditOptionARate(enrollment.optionACreditRate.toString());
    setEditMinWeeks(enrollment.minInventoryReportingWeeks.toString());
    setEditReason("");
    setEditError("");
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnrollment) return;
    setEditSubmitting(true);
    setEditError("");

    try {
      const res = await updateCompanyExchangeEnrollmentAction({
        enrollmentId: selectedEnrollment.id,
        optionARate: parseFloat(editOptionARate),
        minReportingWeeks: parseInt(editMinWeeks, 10),
        reason: editReason.trim(),
      });

      if (!res.success) {
        setEditError(res.error || "Failed to update enrollment settings.");
      } else {
        setShowEditModal(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setEditError(message || "An unexpected error occurred.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleOpenPauseModal = (enrollment: CompanyExchangeEnrollment) => {
    setSelectedEnrollment(enrollment);
    setPauseReasonInput("");
    setPauseError("");
    setShowPauseModal(true);
  };

  const handlePauseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnrollment) return;
    setPauseSubmitting(true);
    setPauseError("");

    try {
      const res = await pauseCompanyExchangeEnrollmentAction({
        enrollmentId: selectedEnrollment.id,
        pauseReason: pauseReasonInput.trim(),
      });

      if (!res.success) {
        setPauseError(res.error || "Failed to pause enrollment.");
      } else {
        setShowPauseModal(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setPauseError(message || "An unexpected error occurred.");
    } finally {
      setPauseSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white">Company Program Participation & Policy Settings</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Admin-controlled enrollment. Policy changes apply to future cohorts; existing cohorts retain frozen terms.
          </p>
        </div>

        {isSchemaAvailable && (
          <button
            type="button"
            onClick={handleOpenEnrollModal}
            className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors shrink-0"
          >
            <span>+</span>
            <span>Enroll New Retailer</span>
          </button>
        )}
      </div>

      {/* Enrolled Companies List */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 font-semibold uppercase text-[11px] tracking-wider">
                <th className="py-3 px-4">Retailer Company</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Option A Rate</th>
                <th className="py-3 px-4 text-center">Option B Rate</th>
                <th className="py-3 px-4 text-center">Min Weekly Checks</th>
                <th className="py-3 px-4">Effective Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {enrollments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-zinc-500">
                    <p className="text-sm font-semibold text-zinc-400">No enrolled retailer companies</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {isSchemaAvailable
                        ? "Enroll retailers into the 90-Day Exchange Credit program to enable initial protection."
                        : "Schema pending Migration 0175 execution."}
                    </p>
                  </td>
                </tr>
              ) : (
                enrollments.map((enr) => (
                  <tr key={enr.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-zinc-100">{enr.companyName}</div>
                      {enr.companyCode && (
                        <div className="text-[11px] font-mono text-zinc-500">Code: {enr.companyCode}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          enr.status === "active"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : enr.status === "paused"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-zinc-800 text-zinc-400 border-zinc-700"
                        }`}
                      >
                        {enr.status.toUpperCase()}
                      </span>
                      {enr.pauseReason && (
                        <div className="text-[9px] text-amber-400 mt-0.5 max-w-[140px] truncate" title={enr.pauseReason}>
                          {enr.pauseReason}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-emerald-400">
                      {(enr.optionACreditRate * 100).toFixed(0)}%
                    </td>
                    <td className="py-3 px-4 text-center font-medium text-zinc-300">
                      {(enr.optionBCreditRate * 100).toFixed(0)}%
                    </td>
                    <td className="py-3 px-4 text-center text-zinc-200">
                      {enr.minInventoryReportingWeeks} weeks
                    </td>
                    <td className="py-3 px-4 text-zinc-400">{enr.effectiveDate}</td>
                    <td className="py-3 px-4 text-right space-x-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(enr)}
                        className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
                      >
                        Edit Policy
                      </button>
                      {enr.status === "active" && (
                        <button
                          type="button"
                          onClick={() => handleOpenPauseModal(enr)}
                          className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-medium transition-colors"
                        >
                          Pause
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Policy Audit Logs Section */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span>📜</span>
          <span>Enrollment & Policy Change Audit Logs</span>
        </h3>
        <p className="text-xs text-zinc-400">
          Immutable audit record of all enrollment events, rate adjustments, and pause actions.
        </p>

        {auditLogs.length === 0 ? (
          <p className="text-xs text-zinc-500 italic py-4 text-center">No audit logs recorded yet.</p>
        ) : (
          <div className="space-y-2 mt-2 max-h-[300px] overflow-y-auto pr-1">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <span className="font-semibold text-cyan-400 uppercase tracking-wide mr-2">
                    [{log.action}]
                  </span>
                  <span className="text-zinc-200">{log.reason}</span>
                </div>
                <div className="text-[11px] text-zinc-500 shrink-0">
                  {new Date(log.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Enroll Company Modal */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Enroll Retailer in 90-Day Exchange Credit</h3>
            {enrollError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {enrollError}
              </div>
            )}
            <form onSubmit={handleEnrollSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Company UUID *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. dc9249be-a9e0-4975-a4c9-b602bb2baa47"
                  value={companyIdInput}
                  onChange={(e) => setCompanyIdInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Option A Rate (20% - 50%) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.20"
                    max="0.50"
                    required
                    value={optionARateInput}
                    onChange={(e) => setOptionARateInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-[10px] text-zinc-500">Default: 0.40 (40%)</span>
                </div>
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Option B Rate (10% - 35%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.10"
                    max="0.35"
                    required
                    value={optionBRateInput}
                    onChange={(e) => setOptionBRateInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-[10px] text-zinc-500">Default: 0.20 (20%)</span>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Min Weekly Inventory Checks *</label>
                <input
                  type="number"
                  min="4"
                  max="12"
                  required
                  value={minWeeksInput}
                  onChange={(e) => setMinWeeksInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-cyan-500"
                />
                <span className="text-[10px] text-zinc-500">Default: 8 weeks of physical inventory count</span>
              </div>

              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Enrollment Notes</label>
                <textarea
                  rows={2}
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="Terms agreed with retail buyer..."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowEnrollModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={enrollSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-colors disabled:opacity-50"
                >
                  {enrollSubmitting ? "Enrolling..." : "Enroll Company"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Policy Modal */}
      {showEditModal && selectedEnrollment && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Update Enrollment Policy ({selectedEnrollment.companyName})</h3>
            <p className="text-[11px] text-amber-400">
              ⚠️ Policy modifications will only apply to future cohorts. Previously registered protected cohorts will retain their frozen rates.
            </p>
            {editError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {editError}
              </div>
            )}
            <form onSubmit={handleEditSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Option A Rate (20% - 50%) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.20"
                  max="0.50"
                  required
                  value={editOptionARate}
                  onChange={(e) => setEditOptionARate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Min Weekly Inventory Checks *</label>
                <input
                  type="number"
                  min="4"
                  max="12"
                  required
                  value={editMinWeeks}
                  onChange={(e) => setEditMinWeeks(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Reason for Policy Change (Required for Audit) *</label>
                <textarea
                  rows={2}
                  required
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="e.g. Renegotiated annual terms with retailer buyer..."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-colors disabled:opacity-50"
                >
                  {editSubmitting ? "Updating..." : "Save Policy Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {showPauseModal && selectedEnrollment && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Pause Program Participation</h3>
            <p className="text-[11px] text-zinc-400">
              Pausing prevents new protected cohorts from being registered. Existing active cohorts will continue their 90-day protection window uninterrupted.
            </p>
            {pauseError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {pauseError}
              </div>
            )}
            <form onSubmit={handlePauseSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Pause Reason (Required) *</label>
                <textarea
                  rows={3}
                  required
                  value={pauseReasonInput}
                  onChange={(e) => setPauseReasonInput(e.target.value)}
                  placeholder="e.g. Retailer account in review for delayed payments..."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowPauseModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pauseSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold transition-colors disabled:opacity-50"
                >
                  {pauseSubmitting ? "Pausing..." : "Confirm Pause"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
