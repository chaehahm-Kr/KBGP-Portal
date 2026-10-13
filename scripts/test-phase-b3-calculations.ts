// scripts/test-phase-b3-calculations.ts
// Unit & Invariant Tests for Phase B3 Dispatch Invoicing and Prepayment Allocation

import { calculateDispatchInvoiceAmounts } from "../lib/finance/dispatch-invoicing";

function runTests() {
  console.log("=== RUNNING PHASE B3 UNIT & INVARIANT TESTS ===\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`, details || "");
      failed++;
    }
  }

  // TEST 1: Full Single Dispatch with Shipping and Tax
  {
    const calc = calculateDispatchInvoiceAmounts({
      fulfillmentItems: [
        { order_item_id: "item-1", product_id: "prod-1", quantity_shipped: 10 },
        { order_item_id: "item-2", product_id: "prod-2", quantity_shipped: 5 },
      ],
      orderItems: [
        { id: "item-1", product_id: "prod-1", sku: "SKU-1", product_name: "Prod 1", quantity: 10, unit_wholesale_price: 20 },
        { id: "item-2", product_id: "prod-2", sku: "SKU-2", product_name: "Prod 2", quantity: 5, unit_wholesale_price: 10 },
      ],
      order: {
        id: "order-1",
        subtotal_amount: 250,
        discount_amount: 0,
        shipping_amount: 25,
        tax_amount: 15,
        processing_fee: 7.5,
        payment_method: "card",
      },
      hasPriorActiveInvoiceWithShipping: false,
      hasPriorActiveInvoiceWithFee: false,
      unallocatedPrepayment: 297.5, // fully prepaid
    });

    assert(calc.subtotal === 250, "Full dispatch: subtotal is $250", calc.subtotal);
    assert(calc.shipping === 25, "Full dispatch: shipping included", calc.shipping);
    assert(calc.tax === 15, "Full dispatch: tax included", calc.tax);
    assert(calc.processingFee === 7.5, "Full dispatch: fee included", calc.processingFee);
    assert(calc.totalAmount === 297.5, "Full dispatch: total is $297.50", calc.totalAmount);
    assert(calc.allocatedPrepayment === 297.5, "Full dispatch: prepayment fully allocated", calc.allocatedPrepayment);
    assert(calc.balanceDue === 0, "Full dispatch: balance due is 0", calc.balanceDue);
    assert(calc.invoiceStatus === "paid", "Full dispatch: invoice status is paid", calc.invoiceStatus);
    assert(calc.paymentStatus === "paid", "Full dispatch: payment status is paid", calc.paymentStatus);
    assert(calc.prepaymentAllocationStatus === "fully_allocated", "Full dispatch: allocation status fully_allocated");
  }

  // TEST 2: Partial Dispatch (60% then 40%) - Financial Invariants
  {
    // Dispatch 1: 60% of item 1 (6 out of 10)
    const calc1 = calculateDispatchInvoiceAmounts({
      fulfillmentItems: [
        { order_item_id: "item-1", product_id: "prod-1", quantity_shipped: 6 },
      ],
      orderItems: [
        { id: "item-1", product_id: "prod-1", sku: "SKU-1", product_name: "Prod 1", quantity: 10, unit_wholesale_price: 100 },
      ],
      order: {
        id: "order-2",
        subtotal_amount: 1000,
        discount_amount: 100, // 10% discount
        shipping_amount: 50,
        tax_amount: 72,
        processing_fee: 30,
        payment_method: "card",
      },
      hasPriorActiveInvoiceWithShipping: false,
      hasPriorActiveInvoiceWithFee: false,
      unallocatedPrepayment: 1052, // fully prepaid order
    });

    assert(calc1.subtotal === 600, "Partial 1: subtotal $600 (6 * 100)", calc1.subtotal);
    assert(calc1.discountTotal === 60, "Partial 1: proportional discount $60 (10%)", calc1.discountTotal);
    assert(calc1.shipping === 50, "Partial 1: freight charged on first dispatch", calc1.shipping);
    assert(calc1.processingFee === 30, "Partial 1: processing fee charged on first dispatch", calc1.processingFee);
    // Net merchandise = 540. Order net merchandise = 900. Tax ratio = 540 / 900 = 60%. Tax = 60% of 72 = 43.20
    assert(calc1.tax === 43.2, "Partial 1: proportional tax $43.20", calc1.tax);
    // Total = 540 + 50 + 43.2 + 30 = 663.20
    assert(calc1.totalAmount === 663.2, "Partial 1: total $663.20", calc1.totalAmount);
    assert(calc1.allocatedPrepayment === 663.2, "Partial 1: allocated prepayment $663.20", calc1.allocatedPrepayment);
    assert(calc1.balanceDue === 0, "Partial 1: balance due 0", calc1.balanceDue);

    // Remaining unallocated prepayment for dispatch 2: 1052 - 663.20 = 388.80
    const remainingPrepayment = 1052 - calc1.allocatedPrepayment;

    // Dispatch 2: remaining 40% of item 1 (4 out of 10)
    const calc2 = calculateDispatchInvoiceAmounts({
      fulfillmentItems: [
        { order_item_id: "item-1", product_id: "prod-1", quantity_shipped: 4 },
      ],
      orderItems: [
        { id: "item-1", product_id: "prod-1", sku: "SKU-1", product_name: "Prod 1", quantity: 10, unit_wholesale_price: 100 },
      ],
      order: {
        id: "order-2",
        subtotal_amount: 1000,
        discount_amount: 100,
        shipping_amount: 50,
        tax_amount: 72,
        processing_fee: 30,
        payment_method: "card",
      },
      hasPriorActiveInvoiceWithShipping: true, // already charged on dispatch 1!
      hasPriorActiveInvoiceWithFee: true, // already charged on dispatch 1!
      unallocatedPrepayment: remainingPrepayment,
    });

    assert(calc2.subtotal === 400, "Partial 2: subtotal $400 (4 * 100)", calc2.subtotal);
    assert(calc2.discountTotal === 40, "Partial 2: proportional discount $40", calc2.discountTotal);
    assert(calc2.shipping === 0, "Partial 2: NO duplicated shipping ($0)", calc2.shipping);
    assert(calc2.processingFee === 0, "Partial 2: NO duplicated fee ($0)", calc2.processingFee);
    // Net merchandise = 360. Tax ratio = 360 / 900 = 40%. Tax = 40% of 72 = 28.80
    assert(calc2.tax === 28.8, "Partial 2: proportional tax $28.80", calc2.tax);
    // Total = 360 + 0 + 28.80 + 0 = 388.80
    assert(calc2.totalAmount === 388.8, "Partial 2: total $388.80", calc2.totalAmount);
    assert(calc2.allocatedPrepayment === 388.8, "Partial 2: allocated remaining prepayment $388.80", calc2.allocatedPrepayment);
    assert(calc2.balanceDue === 0, "Partial 2: balance due 0", calc2.balanceDue);
    assert(calc1.totalAmount + calc2.totalAmount === 1052, "Combined dispatch invoices exactly equal order total ($1052.00)");
  }

  // TEST 3: Net Terms Order (Zero Processing Fee, Due Date Deferred)
  {
    const calcTerms = calculateDispatchInvoiceAmounts({
      fulfillmentItems: [
        { order_item_id: "item-terms", product_id: "prod-terms", quantity_shipped: 10 },
      ],
      orderItems: [
        { id: "item-terms", product_id: "prod-terms", sku: "SKU-T", product_name: "Terms Item", quantity: 10, unit_wholesale_price: 50 },
      ],
      order: {
        id: "order-terms",
        subtotal_amount: 500,
        discount_amount: 0,
        shipping_amount: 30,
        tax_amount: 0,
        processing_fee: 15, // order record may have snapshot fee, but terms rule forces 0 fee
        payment_method: "terms",
      },
      hasPriorActiveInvoiceWithShipping: false,
      hasPriorActiveInvoiceWithFee: false,
      unallocatedPrepayment: 0, // Net terms has 0 prepayment
    });

    assert(calcTerms.processingFee === 0, "Net terms: processing fee is strictly $0", calcTerms.processingFee);
    assert(calcTerms.shipping === 30, "Net terms: shipping included", calcTerms.shipping);
    assert(calcTerms.totalAmount === 530, "Net terms: total $530", calcTerms.totalAmount);
    assert(calcTerms.allocatedPrepayment === 0, "Net terms: prepayment allocated is $0", calcTerms.allocatedPrepayment);
    assert(calcTerms.balanceDue === 530, "Net terms: balance due is $530", calcTerms.balanceDue);
    assert(calcTerms.invoiceStatus === "open", "Net terms: invoice status is open", calcTerms.invoiceStatus);
    assert(calcTerms.paymentStatus === "unpaid", "Net terms: payment status is unpaid", calcTerms.paymentStatus);
    assert(calcTerms.prepaymentAllocationStatus === "none", "Net terms: allocation status is none");
  }

  // TEST 4: Partial Prepayment
  {
    const calcPartialPrepay = calculateDispatchInvoiceAmounts({
      fulfillmentItems: [
        { order_item_id: "item-p", product_id: "prod-p", quantity_shipped: 5 },
      ],
      orderItems: [
        { id: "item-p", product_id: "prod-p", sku: "SKU-P", product_name: "Partial Prepay Item", quantity: 5, unit_wholesale_price: 40 },
      ],
      order: {
        id: "order-partial",
        subtotal_amount: 200,
        discount_amount: 0,
        shipping_amount: 0,
        tax_amount: 0,
        processing_fee: 0,
        payment_method: "card",
      },
      hasPriorActiveInvoiceWithShipping: true,
      hasPriorActiveInvoiceWithFee: true,
      unallocatedPrepayment: 75, // only $75 unallocated prepayment available
    });

    assert(calcPartialPrepay.totalAmount === 200, "Partial prepay: total $200", calcPartialPrepay.totalAmount);
    assert(calcPartialPrepay.allocatedPrepayment === 75, "Partial prepay: allocated $75", calcPartialPrepay.allocatedPrepayment);
    assert(calcPartialPrepay.balanceDue === 125, "Partial prepay: balance due $125", calcPartialPrepay.balanceDue);
    assert(calcPartialPrepay.invoiceStatus === "open", "Partial prepay: invoice status is open", calcPartialPrepay.invoiceStatus);
    assert(calcPartialPrepay.paymentStatus === "partial", "Partial prepay: payment status is partial", calcPartialPrepay.paymentStatus);
    assert(calcPartialPrepay.prepaymentAllocationStatus === "partial", "Partial prepay: allocation status is partial");
  }

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
