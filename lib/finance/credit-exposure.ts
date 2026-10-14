import { computeARStatus, type ARStatus } from "./invoice-types";

export interface ReservedOrderBreakdown {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  paymentTerms: string;
  totalAmount: number;
  invoicedAmount: number;
  cancelledAmount: number;
  unbilledReservation: number;
}

export interface RetailerCreditExposure {
  companyId: string;
  creditLimit: number;
  openAR: number;
  unbilledReservation: number;
  totalExposure: number;
  availableCredit: number;
  overLimitAmount: number;
  openInvoiceCount: number;
  pastDueInvoiceCount: number;
  pastDueAmount: number;
  dueSoonAmount: number;
  hasPastDue: boolean;
  reservedOrdersCount: number;
  reservedOrders?: ReservedOrderBreakdown[];
}

/**
 * Pure, deterministic credit exposure calculator.
 * Strictly adheres to Phase B4 authoritative financial model:
 *
 * Total Credit Exposure = Open AR + Unbilled Order Reservation
 * Available Credit = max(0, Credit Limit - Total Credit Exposure)
 * Over-Limit Amount = max(0, Total Credit Exposure - Credit Limit)
 *
 * Rules:
 * 1. Open AR: Sum of unpaid balances (balance_due) on active invoices (invoice_status NOT IN ('void', 'cancelled')).
 * 2. Unbilled Reservation: Remaining un-invoiced, un-cancelled liability on submitted Net Terms orders.
 * 3. Card/ACH prepaid orders never reserve Net Terms credit.
 * 4. Partially dispatched/invoiced orders transfer exposure from reservation to Open AR without double-counting.
 * 5. Fully dispatched/delivered or cancelled orders have $0 unbilled reservation.
 */
export function calculateCreditExposure(params: {
  creditLimit: number;
  invoices: Array<{
    id?: string;
    order_id?: string | null;
    balance_due: number;
    total_amount?: number;
    due_date?: string;
    invoice_status: string;
  }>;
  orders: Array<{
    id: string;
    order_number: string;
    order_status: string;
    payment_method?: string | null;
    payment_terms?: string | null;
    total_amount: number;
    total_ordered_units?: number;
    total_cancelled_units?: number;
    subtotal_amount?: number;
    retailer_order_items?: Array<{
      quantity: number;
      quantity_cancelled?: number;
      line_total?: number;
      unit_wholesale_price?: number;
    }>;
  }>;
  companyId?: string;
}): RetailerCreditExposure {
  const creditLimit = Math.max(0, Number(params.creditLimit || 0));

  // 1. Calculate Open AR from active invoices
  let openAR = 0;
  let pastDueAmount = 0;
  let dueSoonAmount = 0;
  let openInvoiceCount = 0;
  let pastDueInvoiceCount = 0;

  // Track active invoiced total per order to compute unbilled order reservations
  const invoicedTotalByOrder = new Map<string, number>();

  for (const inv of params.invoices || []) {
    const status = inv.invoice_status || "open";
    if (status === "void" || status === "cancelled") {
      continue; // Strictly excluded
    }

    const bal = Math.max(0, Number(inv.balance_due || 0));
    if (bal > 0) {
      openAR += bal;
      openInvoiceCount += 1;

      if (inv.due_date) {
        const arStatus = computeARStatus({
          balance_due: bal,
          due_date: inv.due_date,
          invoice_status: status,
        });

        if (arStatus === "PAST_DUE") {
          pastDueAmount += bal;
          pastDueInvoiceCount += 1;
        } else if (arStatus === "DUE_SOON") {
          dueSoonAmount += bal;
        }
      }
    }

    // Accumulate total invoiced amount for this order
    if (inv.order_id) {
      const invTotal = Math.max(0, Number(inv.total_amount || 0));
      invoicedTotalByOrder.set(
        inv.order_id,
        (invoicedTotalByOrder.get(inv.order_id) || 0) + invTotal
      );
    }
  }

  // 2. Calculate Unbilled Reservation across active Net Terms orders
  let unbilledReservation = 0;
  let reservedOrdersCount = 0;
  const reservedOrders: ReservedOrderBreakdown[] = [];

  for (const order of params.orders || []) {
    // 2.1 Verify Net Terms eligibility (Card and ACH are PREPAID and must NOT reserve credit)
    const isNetTerms =
      order.payment_method === "terms" ||
      (order.payment_terms &&
        !["PREPAID", "PREPAID_CARD", "PREPAID_ACH", "CARD", "ACH"].includes(
          order.payment_terms.toUpperCase()
        ));

    if (!isNetTerms) {
      continue;
    }

    // 2.2 Verify active fulfillment lifecycle
    // Cancelled orders have $0 reservation.
    // Shipped or delivered orders have $0 reservation (all dispatches completed; liability is in Open AR).
    const st = (order.order_status || "submitted").toLowerCase();
    if (["cancelled", "shipped", "delivered"].includes(st)) {
      continue;
    }

    // Active pending fulfillment statuses: 'submitted', 'processing', 'partially_shipped', 'partially_cancelled', 'confirmed'
    const orderTotal = Math.max(0, Number(order.total_amount || 0));
    const invoicedAmt = invoicedTotalByOrder.get(order.id) || 0;

    // 2.3 Calculate cancelled amount
    let cancelledAmt = 0;
    if (order.retailer_order_items && order.retailer_order_items.length > 0) {
      const grossCancelled = order.retailer_order_items.reduce((sum, item) => {
        const qTot = Number(item.quantity || 0);
        const qCanc = Number(item.quantity_cancelled || 0);
        if (qTot > 0 && qCanc > 0) {
          const lTot = Number(item.line_total || (qTot * Number(item.unit_wholesale_price || 0)));
          return sum + (qCanc / qTot) * lTot;
        }
        return sum;
      }, 0);

      const subtotal = Number(order.subtotal_amount || 0);
      const ratio = subtotal > 0 ? Math.min(1, orderTotal / subtotal) : 1;
      cancelledAmt = grossCancelled * ratio;
    } else if (
      Number(order.total_ordered_units || 0) > 0 &&
      Number(order.total_cancelled_units || 0) > 0
    ) {
      const cancelRatio =
        Number(order.total_cancelled_units) / Number(order.total_ordered_units);
      cancelledAmt = orderTotal * cancelRatio;
    }

    const unbilledForOrder = Math.max(
      0,
      Math.round((orderTotal - invoicedAmt - cancelledAmt) * 100) / 100
    );

    if (unbilledForOrder > 0) {
      unbilledReservation += unbilledForOrder;
      reservedOrdersCount += 1;
      reservedOrders.push({
        orderId: order.id,
        orderNumber: order.order_number,
        orderStatus: order.order_status,
        paymentTerms: order.payment_terms || "terms",
        totalAmount: orderTotal,
        invoicedAmount: invoicedAmt,
        cancelledAmount: Math.round(cancelledAmt * 100) / 100,
        unbilledReservation: unbilledForOrder,
      });
    }
  }

  // Round all totals to 2 decimal places
  openAR = Math.round(openAR * 100) / 100;
  unbilledReservation = Math.round(unbilledReservation * 100) / 100;
  pastDueAmount = Math.round(pastDueAmount * 100) / 100;
  dueSoonAmount = Math.round(dueSoonAmount * 100) / 100;

  const totalExposure = Math.round((openAR + unbilledReservation) * 100) / 100;
  const availableCredit = Math.max(0, Math.round((creditLimit - totalExposure) * 100) / 100);
  const overLimitAmount = Math.max(0, Math.round((totalExposure - creditLimit) * 100) / 100);

  return {
    companyId: params.companyId || "",
    creditLimit,
    openAR,
    unbilledReservation,
    totalExposure,
    availableCredit,
    overLimitAmount,
    openInvoiceCount,
    pastDueInvoiceCount,
    pastDueAmount,
    dueSoonAmount,
    hasPastDue: pastDueInvoiceCount > 0,
    reservedOrdersCount,
    reservedOrders,
  };
}

/**
 * Shared Authoritative Resolver: Computes live Credit Exposure & Available Credit for a Retailer.
 * Queries persisted retailer profile, active invoices, and open Net Terms orders.
 */
export async function getRetailerCreditExposure(
  companyId: string,
  client?: any
): Promise<RetailerCreditExposure> {
  let adminClient = client;
  if (!adminClient) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    adminClient = createAdminClient();
  }

  // 1. Fetch retailer credit limit from retailer_profiles
  const { data: profile } = await adminClient
    .from("retailer_profiles")
    .select("credit_limit, approved_terms")
    .eq("company_id", companyId)
    .maybeSingle();

  const creditLimit = Number(profile?.credit_limit || 0);

  // 2. Fetch active invoices for this retailer
  const { data: invoices, error: invErr } = await adminClient
    .from("retailer_invoices")
    .select("id, order_id, total_amount, balance_due, due_date, invoice_status")
    .eq("retailer_company_id", companyId)
    .not("invoice_status", "in", '("void","cancelled")');

  if (invErr) {
    console.error("Error fetching invoices for credit exposure:", invErr);
  }

  // 3. Fetch active Net Terms orders for this retailer
  const { data: orders, error: ordErr } = await adminClient
    .from("retailer_orders")
    .select(`
      id,
      order_number,
      order_status,
      payment_method,
      payment_terms,
      total_amount,
      subtotal_amount,
      total_ordered_units,
      total_cancelled_units,
      retailer_order_items (
        id,
        quantity,
        quantity_cancelled,
        line_total,
        unit_wholesale_price
      )
    `)
    .eq("company_id", companyId)
    .not("order_status", "in", '("cancelled","shipped","delivered")');

  if (ordErr) {
    console.error("Error fetching orders for credit exposure:", ordErr);
  }

  return calculateCreditExposure({
    creditLimit,
    invoices: invoices || [],
    orders: (orders as any) || [],
    companyId,
  });
}
