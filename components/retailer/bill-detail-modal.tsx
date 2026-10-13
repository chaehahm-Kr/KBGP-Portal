"use client";

import React, { useEffect, useState, useTransition } from "react";
import { RetailerBillDetail } from "@/lib/retailer/bill-types";
import { getRetailerBillDetailAction } from "@/lib/retailer/bill-actions";

interface BillDetailModalProps {
  invoiceId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onPayBill: (bill: RetailerBillDetail) => void;
}

export function BillDetailModal({
  invoiceId,
  isOpen,
  onClose,
  onPayBill,
}: BillDetailModalProps) {
  const [bill, setBill] = useState<RetailerBillDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!isOpen || !invoiceId) {
      setBill(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    startTransition(async () => {
      const res = await getRetailerBillDetailAction(invoiceId);
      if (res.success && res.bill) {
        setBill(res.bill);
      } else {
        setError(res.error || "Failed to load bill details.");
      }
      setLoading(false);
    });
  }, [invoiceId, isOpen]);

  if (!isOpen) return null;

  const getStatusBadge = (arStatus: string) => {
    switch (arStatus) {
      case "PAST_DUE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            Past Due
          </span>
        );
      case "DUE_SOON":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Due Soon
          </span>
        );
      case "PAID":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Paid
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Open
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 sm:p-7 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                {bill ? bill.invoice_number : "Loading Bill..."}
              </h2>
              {bill && getStatusBadge(bill.ar_status)}
            </div>
            {bill && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Order #{bill.order_number} · Issued on {new Date(bill.invoice_date).toLocaleDateString()}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-zinc-400 text-sm">
            Loading bill details...
          </div>
        ) : error || !bill ? (
          <div className="py-12 text-center text-rose-600 dark:text-rose-400 text-sm">
            {error || "Could not load bill details."}
          </div>
        ) : (
          <div className="space-y-6 text-xs">
            {/* Top Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <span className="text-[10px] uppercase font-bold text-zinc-400">Due Date</span>
                <p className="text-sm font-bold text-zinc-900 dark:text-white mt-0.5">
                  {new Date(bill.due_date).toLocaleDateString()}
                </p>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <span className="text-[10px] uppercase font-bold text-zinc-400">Terms</span>
                <p className="text-sm font-bold text-zinc-900 dark:text-white mt-0.5">
                  {bill.terms_name}
                </p>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <span className="text-[10px] uppercase font-bold text-zinc-400">Total Billed</span>
                <p className="text-sm font-bold text-zinc-900 dark:text-white mt-0.5">
                  ${bill.total_amount.toFixed(2)}
                </p>
              </div>

              <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900">
                <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">
                  Balance Due
                </span>
                <p className="text-base font-extrabold text-blue-700 dark:text-blue-300 mt-0.5">
                  ${bill.balance_due.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Billing Information */}
            {bill.billing_address && (
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-1">
                <p className="font-bold text-zinc-900 dark:text-zinc-200">Billing Address</p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  {bill.billing_address.company_name}
                  {bill.billing_address.contact_name ? ` · Attn: ${bill.billing_address.contact_name}` : ""}
                </p>
                <p className="text-zinc-500 dark:text-zinc-400">
                  {[
                    bill.billing_address.address_1,
                    bill.billing_address.address_2,
                    bill.billing_address.city,
                    bill.billing_address.state,
                    bill.billing_address.zip_code,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
            )}

            {/* Line Items Table */}
            <div className="space-y-2">
              <h3 className="font-bold text-zinc-900 dark:text-white">Order Line Items</h3>
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-500">
                    <tr>
                      <th className="py-2.5 px-3">Item / SKU</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {bill.line_items.map((item) => (
                      <tr key={item.id} className="text-zinc-700 dark:text-zinc-300">
                        <td className="py-2.5 px-3">
                          <p className="font-medium text-zinc-900 dark:text-white">{item.product_name}</p>
                          <p className="text-[10px] text-zinc-400">SKU: {item.sku}</p>
                        </td>
                        <td className="py-2.5 px-3 text-center font-medium">{item.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-medium">${item.unit_price.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-zinc-900 dark:text-white">
                          ${item.total_price.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {bill.line_items.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-zinc-400">
                          No line items found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 space-y-2 max-w-sm ml-auto">
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Subtotal</span>
                <span>${bill.subtotal.toFixed(2)}</span>
              </div>
              {bill.discount_total > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Discounts</span>
                  <span>-${bill.discount_total.toFixed(2)}</span>
                </div>
              )}
              {bill.processing_fee > 0 && (
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>Processing Fee</span>
                  <span>+${bill.processing_fee.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Shipping</span>
                <span>${bill.shipping.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Tax</span>
                <span>${bill.tax.toFixed(2)}</span>
              </div>
              <div className="h-px bg-zinc-200 dark:bg-zinc-800" />
              <div className="flex justify-between font-bold text-zinc-900 dark:text-white">
                <span>Invoice Total</span>
                <span>${bill.total_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                <span>Amount Paid</span>
                <span>-${bill.amount_paid.toFixed(2)}</span>
              </div>
              {(bill.invoice_status === "void" || bill.invoice_status === "cancelled") ? (
                <div className="flex justify-between text-sm font-bold text-zinc-500 pt-1">
                  <span>Balance Due</span>
                  <div className="text-right">
                    <span className="line-through text-xs text-zinc-400 mr-1.5 font-normal">
                      Orig. ${bill.balance_due.toFixed(2)}
                    </span>
                    <span className="font-extrabold text-zinc-700 dark:text-zinc-300">$0.00</span>
                    <span className="block text-[10px] text-zinc-400 font-normal">Voided obligation</span>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between text-sm font-extrabold text-blue-600 dark:text-blue-400 pt-1">
                  <span>Balance Due</span>
                  <span>${bill.balance_due.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Payment History (Rule 17) */}
            <div className="space-y-2">
              <h3 className="font-bold text-zinc-900 dark:text-white">Payment History</h3>
              {bill.payment_history.length > 0 ? (
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-500">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Method</th>
                        <th className="py-2.5 px-3 text-right">Principal</th>
                        <th className="py-2.5 px-3 text-right">Fee</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {bill.payment_history.map((pay) => (
                        <tr key={pay.id} className="text-zinc-700 dark:text-zinc-300">
                          <td className="py-2.5 px-3">{new Date(pay.created_at).toLocaleDateString()}</td>
                          <td className="py-2.5 px-3 uppercase text-[11px] font-bold">{pay.payment_method}</td>
                          <td className="py-2.5 px-3 text-right">${pay.amount.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right">${pay.fee_amount.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right font-bold">${pay.total_charged.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              {pay.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-center text-zinc-400">
                  No payments recorded yet.
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Close
              </button>
              {bill.balance_due > 0 && bill.invoice_status !== "void" && bill.invoice_status !== "cancelled" && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onPayBill(bill);
                  }}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90 shadow-xs transition-opacity"
                >
                  Pay Bill (${bill.balance_due.toFixed(2)})
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
