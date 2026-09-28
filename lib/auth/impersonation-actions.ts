"use server";

import {
  startImpersonationActionInternal,
  stopImpersonationActionInternal,
  getImpersonationAuditLogsActionInternal,
  type StartImpersonationInput,
} from "@/lib/auth/impersonation";

export async function startImpersonationAction(input: StartImpersonationInput) {
  return startImpersonationActionInternal(input);
}

export async function stopImpersonationAction() {
  return stopImpersonationActionInternal();
}

export async function getImpersonationAuditLogsAction() {
  return getImpersonationAuditLogsActionInternal();
}
