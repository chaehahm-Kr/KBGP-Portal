// lib/orders/order-invoice-utils.ts
// Pure utility for Authoritative Order Invoice & Payment Status Resolution

export type AuthoritativeInvoiceStatus =
  | "paid"
  | "unpaid"
  | "partially_paid"
  | "not_issued"
  | "void";

export interface OrderInvoiceSummary {
  status: AuthoritativeInvoiceStatus;
  displayStatus: "Paid" | "Unpaid" | "Partially Paid" | "Not Issued" | "Void";
  totalInvoicesCount: number;
  activeInvoicesCount: number;
  totalInvoicedAmount: number;
  totalBalanceDue: number;
  latestDueDate: string | null;
  earliestDueDate: string | null;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    invoiceStatus: string;
    paymentStatus: string;
    totalAmount: number;
    amountPaid: number;
    balanceDue: number;
    dueDate: string | null;
  }>;
}

export function computeOrderInvoiceSummary(
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    invoiceStatus: string;
    paymentStatus: string;
    totalAmount?: number;
    amountPaid?: number;
    balanceDue: number;
    dueDate?: string | null;
  }>
): OrderInvoiceSummary {
  if (!invoices || invoices.length === 0) {
    return {
      status: "not_issued",
      displayStatus: "Not Issued",
      totalInvoicesCount: 0,
      activeInvoicesCount: 0,
      totalInvoicedAmount: 0,
      totalBalanceDue: 0,
      latestDueDate: null,
      earliestDueDate: null,
      invoices: [],
    };
  }

  const mappedInvoices = invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    invoiceStatus: inv.invoiceStatus,
    paymentStatus: inv.paymentStatus,
    totalAmount: Number(inv.totalAmount || 0),
    amountPaid: Number(inv.amountPaid || 0),
    balanceDue: Number(inv.balanceDue || 0),
    dueDate: inv.dueDate || null,
  }));

  const activeInvoices = mappedInvoices.filter(
    (inv) => !["void", "cancelled"].includes((inv.invoiceStatus || "").toLowerCase())
  );

  if (activeInvoices.length === 0) {
    return {
      status: "void",
      displayStatus: "Void",
      totalInvoicesCount: invoices.length,
      activeInvoicesCount: 0,
      totalInvoicedAmount: 0,
      totalBalanceDue: 0,
      latestDueDate: null,
      earliestDueDate: null,
      invoices: mappedInvoices,
    };
  }

  const totalInvoicedAmount = activeInvoices.reduce((acc, i) => acc + i.totalAmount, 0);
  const totalBalanceDue = activeInvoices.reduce((acc, i) => acc + i.balanceDue, 0);

  const dueDates = activeInvoices
    .map((i) => i.dueDate)
    .filter((d): d is string => Boolean(d))
    .sort();
  const earliestDueDate = dueDates[0] || null;
  const latestDueDate = dueDates[dueDates.length - 1] || null;

  const allPaid = activeInvoices.every(
    (i) =>
      i.balanceDue <= 0 ||
      (i.invoiceStatus || "").toLowerCase() === "paid" ||
      (i.paymentStatus || "").toLowerCase() === "paid"
  );

  const allUnpaid = activeInvoices.every(
    (i) =>
      i.amountPaid <= 0 &&
      i.balanceDue > 0 &&
      (i.invoiceStatus || "").toLowerCase() !== "paid" &&
      (i.paymentStatus || "").toLowerCase() !== "paid"
  );

  let status: AuthoritativeInvoiceStatus;
  let displayStatus: "Paid" | "Unpaid" | "Partially Paid" | "Not Issued" | "Void";

  if (allPaid) {
    status = "paid";
    displayStatus = "Paid";
  } else if (allUnpaid) {
    status = "unpaid";
    displayStatus = "Unpaid";
  } else {
    status = "partially_paid";
    displayStatus = "Partially Paid";
  }

  return {
    status,
    displayStatus,
    totalInvoicesCount: invoices.length,
    activeInvoicesCount: activeInvoices.length,
    totalInvoicedAmount,
    totalBalanceDue,
    latestDueDate,
    earliestDueDate,
    invoices: mappedInvoices,
  };
}

export function resolveAuthoritativeOrderPaymentStatus(
  order: {
    payment_method?: string | null;
    payment_status?: string | null;
    total_amount?: number;
    paid_at?: string | null;
  },
  payments: Array<{
    status?: string | null;
    amount?: number | null;
  }>,
  invoiceSummary?: OrderInvoiceSummary | null
): string {
  const method = (order.payment_method || "").toLowerCase();
  const orderTotal = Number(order.total_amount || 0);

  if (method === "terms" || method === "net_terms" || method === "net30" || method === "net60") {
    if (invoiceSummary && invoiceSummary.activeInvoicesCount > 0) {
      if (invoiceSummary.status === "paid") return "paid";
      if (invoiceSummary.status === "partially_paid") return "partially_paid";
      return "unpaid";
    }
    if (order.paid_at || (order.payment_status || "").toLowerCase() === "paid") {
      return "paid";
    }
    return "unpaid";
  }

  const settledPayments = (payments || []).filter(
    (p) =>
      ["succeeded", "settled", "completed", "paid"].includes((p.status || "").toLowerCase())
  );
  const settledSum = settledPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);

  if (settledSum >= orderTotal && orderTotal > 0) {
    return "paid";
  }
  if (order.paid_at || (order.payment_status || "").toLowerCase() === "paid") {
    return "paid";
  }
  if (settledSum > 0) {
    return "partially_paid";
  }
  if ((order.payment_status || "").toLowerCase() === "pending") {
    return "pending";
  }
  return "unpaid";
}
