// lib/retailer/bill-types.ts
// Plain English, Authoritative Types for Retailer Bills & Payments

import { ARStatus, RetailerARStatus } from "@/lib/finance/invoice-types";
import { EffectivePaymentPolicy, ProcessingFeeCalculationResult } from "./payment-policy";

export interface RetailerBillSummary {
  id: string;
  invoice_number: string;
  order_id: string;
  order_number: string;
  retailer_company_id: string;
  invoice_date: string;
  due_date: string;
  terms_days: number;
  terms_name: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  invoice_status: string;
  payment_status: string;
  ar_status: ARStatus;
  issued_at: string;
}

export interface RetailerBillLineItem {
  id: string;
  product_name: string;
  sku: string;
  variant_name?: string | null;
  image_url?: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface RetailerBillPaymentRecord {
  id: string;
  created_at: string;
  payment_method: string;
  amount: number;
  fee_amount: number;
  fee_rate: number;
  total_charged: number;
  status: string;
  notes?: string | null;
}

export interface RetailerBillDetail extends RetailerBillSummary {
  subtotal: number;
  discount_total: number;
  processing_fee: number;
  shipping: number;
  tax: number;
  notes?: string | null;
  billing_address?: {
    company_name: string;
    contact_name?: string;
    phone?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    state?: string;
    zip_code?: string;
  };
  line_items: RetailerBillLineItem[];
  payment_history: RetailerBillPaymentRecord[];
}

export interface RetailerBillsFeed {
  summary: RetailerARStatus;
  invoices: RetailerBillSummary[];
}
