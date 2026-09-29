"use server";

import {
  startImpersonationActionInternal,
  stopImpersonationActionInternal,
  getSupportSessionLogsAction,
  hasImpersonationPermission,
  type StartImpersonationInput,
  type SupportSessionLogFilter,
} from "@/lib/auth/impersonation";

export async function startImpersonationAction(input: StartImpersonationInput) {
  return startImpersonationActionInternal(input);
}

export async function stopImpersonationAction() {
  return stopImpersonationActionInternal();
}

export async function getImpersonationAuditLogsAction(filters?: SupportSessionLogFilter) {
  return getSupportSessionLogsAction(filters);
}

export {
  getSupportSessionLogsAction,
  hasImpersonationPermission,
  type StartImpersonationInput,
  type SupportSessionLogFilter,
};
