import { describe, expect, it } from "vitest";
import { getPoProgressStepIndex, PO_6_STEPS } from "@/lib/purchase-order/status-helper";

describe("getPoProgressStepIndex", () => {
  it.each([
    ["Draft", 0],
    ["Sent to Supplier", 1],
    ["In Production", 2],
    ["Ready to Ship", 3],
    ["Shipped", 4],
    ["Receiving", 5],
    ["Completed", 6],
    ["Cancelled", -1],
  ])("%s -> step %i", (status, step) => {
    expect(getPoProgressStepIndex(status)).toBe(step);
  });

  it("has exactly six progress steps", () => {
    expect(PO_6_STEPS.map((s) => s.stepNumber)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
