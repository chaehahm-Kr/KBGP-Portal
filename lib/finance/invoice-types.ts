// lib/finance/invoice-types.ts
// Authoritative Types & AR Status Computations for Retailer Invoices & Accounts Receivable

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'failed' | 'refunded';
export type ARStatus = 'OPEN' | 'DUE_SOON' | 'PAST_DUE' | 'PAID' | 'VOID';

export interface RetailerInvoice {
  id: string;
  invoice_number: string;
  order_id: string;
  retailer_company_id: string;
  invoice_date: string;
  due_date: string;
  terms_days: number;
  terms_name: string;
  subtotal: number;
  discount_total: number;
  processing_fee: number;
  shipping: number;
  tax: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  invoice_status: InvoiceStatus;
  payment_status: PaymentStatus;
  issued_at: string;
  paid_at: string | null;
  voided_at: string | null;
  notes: string | null;
  terms_snapshot?: any;
  billing_snapshot?: any;
  created_at: string;
  updated_at: string;
  retailer?: {
    id: string;
    name: string;
    company_code?: string;
  };
  order?: {
    id: string;
    order_number: string;
    order_status: string;
    total_amount: number;
  };
  fulfillment_id?: string | null;
  fulfillment_number?: string | null;
  prepayment_allocated_amount?: number;
  prepayment_allocation_status?: string;
  dispatch_notes?: string | null;
  items?: any[];
  allocations?: any[];
  ar_status?: ARStatus;
}

export interface RetailerARStatus {
  companyId: string;
  openAR: number;
  pastDueAmount: number;
  dueSoonAmount: number;
  openInvoiceCount: number;
  pastDueInvoiceCount: number;
  hasPastDue: boolean;
  creditLimit: number;
  availableCredit: number;
  unbilledReservation?: number;
  totalExposure?: number;
  overLimitAmount?: number;
  reservedOrdersCount?: number;
}

export interface GlobalARSummary {
  totalOpenAR: number;
  totalPastDueAmount: number;
  totalDueSoonAmount: number;
  openInvoiceCount: number;
  pastDueInvoiceCount: number;
  paidInvoiceCount: number;
}

/**
 * Computes the live Accounts Receivable (AR) status based on invoice balances and due date.
 * - OPEN: balance_due > 0 and due_date > today + 7 days
 * - DUE_SOON: balance_due > 0 and today <= due_date <= today + 7 days
 * - PAST_DUE: balance_due > 0 and due_date < today
 * - PAID: balance_due <= 0 or invoice_status === 'paid'
 * - VOID: invoice_status is 'void' or 'cancelled'
 */
export function computeARStatus(inv: {
  balance_due: number;
  due_date: string;
  invoice_status: string;
}): ARStatus {
  if (inv.invoice_status === 'void' || inv.invoice_status === 'cancelled') {
    return 'VOID';
  }
  if (inv.balance_due <= 0 || inv.invoice_status === 'paid') {
    return 'PAID';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(inv.due_date);
  dueDate.setHours(0, 0, 0, 0);

  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return 'PAST_DUE';
  }
  if (diffDays <= 7) {
    return 'DUE_SOON';
  }
  return 'OPEN';
}

/**
 * Resolves human-readable terms name and days count.
 * e.g. "net30" -> { days: 30, name: "Net 30" }
 */
export function parseTermsDays(terms: string | null | undefined): { days: number; name: string } {
  if (!terms) return { days: 30, name: 'Net 30' };
  const lower = terms.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (lower.includes('net15') || lower === '15') return { days: 15, name: 'Net 15' };
  if (lower.includes('net30') || lower === '30') return { days: 30, name: 'Net 30' };
  if (lower.includes('net45') || lower === '45') return { days: 45, name: 'Net 45' };
  if (lower.includes('net60') || lower === '60') return { days: 60, name: 'Net 60' };
  if (lower.includes('net90') || lower === '90') return { days: 90, name: 'Net 90' };
  return { days: 30, name: terms };
}
