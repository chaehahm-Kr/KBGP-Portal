import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import {
  getActivePolicy,
  getAllPolicies,
  getPolicyAuditLogs,
  getPolicyActorContext,
} from "@/lib/product/performance/policy-service";
import { ProductPerformanceSettingsView } from "@/components/admin/settings/product-performance-settings-view";

export const metadata: Metadata = {
  title: "Product Performance Policy Settings | K SELECT NETWORK Admin",
  description: "Configure product performance grading criteria, dimension weights, and evaluation policies.",
};

export default async function ProductPerformanceSettingsPage() {
  await verifyAdminSession();

  const [activePolicy, { policies, isSchemaReady }, auditLogs, actorContext] =
    await Promise.all([
      getActivePolicy(),
      getAllPolicies(),
      getPolicyAuditLogs(),
      getPolicyActorContext(),
    ]);

  return (
    <ProductPerformanceSettingsView
      initialActivePolicy={activePolicy}
      initialPolicies={policies}
      initialAuditLogs={auditLogs}
      isSchemaReady={isSchemaReady}
      actorContext={actorContext}
    />
  );
}
