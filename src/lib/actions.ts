import { createClient } from "@/lib/supabase/client";

export type ActionType =
  | "approve_email"
  | "reject_approval"
  | "delegate_case"
  | "send_email"
  | "schedule_follow_up"
  | "resolve_case"
  | "verify_case"
  | "close_case"
  | "execute_workflow";

export async function createAction(
  actionType: ActionType,
  payload: Record<string, unknown>
) {
  const inputData = payload.input_data && typeof payload.input_data === "object"
    ? payload.input_data as Record<string, unknown>
    : {};
  const target = payload.approval_id || payload.case_id || payload.follow_up_id || payload.delegation_id
    || inputData.approval_id || inputData.follow_up_id || inputData.delegation_id;
  const idempotencyKey = typeof payload.idempotency_key === "string"
    ? payload.idempotency_key
    : `${actionType}:${target || "workspace"}`;
  const { data, error } = await createClient().functions.invoke("actions", {
    body: {
      action_type: actionType,
      idempotency_key: idempotencyKey,
      ...payload,
    },
  });
  if (error) throw error;
  return data;
}

export function getOperationError(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "No se pudo completar la operación.";
}
