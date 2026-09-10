declare const Deno: { env: { get(name: string): string | undefined } };

// @ts-expect-error Deno resolves URL imports at Edge Function runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type Decision = {
  authorized: boolean;
  action: string;
  requires_approval: boolean;
  reason: string;
  rule?: string | null;
  rule_version?: string | null;
  playbook_version?: string | null;
  evidence?: unknown[];
  expected_version?: number | null;
  command?: { type: string; payload: Record<string, unknown> } | null;
};

export const WORKFLOW_COMMAND_CONTRACT = "pulso-workflow-command.v1";
export const WORKFLOW_RESULT_CONTRACT = "pulso-workflow-result.v1";

export type WorkflowOutcome =
  | "SUCCESS"
  | "FAILED_CLOSED"
  | "DUPLICATE_SUPPRESSED"
  | "REQUIRE_APPROVAL"
  | "CANCELLED"
  | "RUNNING";

export type IntegrationEnvelope = {
  contract_version?: string;
  event_type: string;
  workflow_code: string;
  request_id: string;
  correlation_id: string;
  idempotency_key: string;
  organization_id: string;
  user_id?: string | null;
  case_id?: string | null;
  conversation_id?: string | null;
  source_message_id?: string | null;
  action_id?: string | null;
  workflow_execution_id?: string | null;
  decision_id?: string | null;
  command_id?: string | null;
  input_data?: Record<string, unknown>;
};

export function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED");
  return createClient(url, key);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function requireUuid(value: unknown, field: string): string {
  if (!isUuid(value)) throw new Error(`INVALID_${field.toUpperCase()}`);
  return value;
}

export function callbackUrl() {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) throw new Error("SUPABASE_URL_NOT_CONFIGURED");
  return `${url.replace(/\/$/, "")}/functions/v1/webhooks`;
}

export async function createExecution(admin: ReturnType<typeof createClient>, payload: IntegrationEnvelope, workflowId?: string | null) {
  const { data, error } = await admin.from("workflow_executions").insert({
    workflow_id: workflowId || null,
    case_id: payload.case_id || null,
    action_id: payload.action_id || null,
    status: "running",
    trigger_type: payload.event_type,
    request_id: payload.request_id,
    correlation_id: payload.correlation_id,
    idempotency_key: payload.idempotency_key,
    source_message_id: payload.source_message_id || null,
    decision_id: payload.decision_id || null,
    command_id: payload.command_id || null,
    workflow_code: payload.workflow_code,
    input_data: payload,
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function createCommand(
  admin: ReturnType<typeof createClient>,
  params: {
    organization_id: string;
    action_id?: string | null;
    decision_id: string;
    workflow_code: string;
    command_type: string;
    payload?: Record<string, unknown>;
    idempotency_key: string;
  },
) {
  const { data: existing } = await admin
    .from("commands")
    .select("id,status,workflow_code")
    .eq("idempotency_key", params.idempotency_key)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data, error } = await admin.from("commands").insert({
    organization_id: params.organization_id,
    action_id: params.action_id || null,
    decision_id: params.decision_id,
    workflow_code: params.workflow_code,
    command_type: params.command_type,
    payload: params.payload || {},
    status: "created",
    idempotency_key: params.idempotency_key,
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export function workflowOutcome(status: string, outputData: Record<string, unknown> = {}): WorkflowOutcome {
  if (status === "running" || status === "waiting") return "RUNNING";
  if (status === "cancelled") return "CANCELLED";
  if (status !== "success") return "FAILED_CLOSED";
  if (outputData.duplicate === true || outputData.outcome === "DUPLICATE_SUPPRESSED") return "DUPLICATE_SUPPRESSED";
  if (outputData.requires_approval === true || outputData.outcome === "REQUIRE_APPROVAL") return "REQUIRE_APPROVAL";
  return "SUCCESS";
}

export function workflowRetry(status: string, outputData: Record<string, unknown> = {}, errorData: Record<string, unknown> = {}) {
  return {
    attempted: Boolean(outputData.retry_attempt || outputData.retry),
    reason: status === "failed" ? String(errorData.code || errorData.message || "FAILED_CLOSED") : null,
  };
}

export function workflowExternalEffects(workflowCode: string, outputData: Record<string, unknown> = {}) {
  const effects: string[] = [];
  if (["PE01", "PE05", "PE08", "PE13"].includes(workflowCode)) effects.push("supabase_write");
  if (["PE01", "PE05", "PE07", "PE10"].includes(workflowCode)) effects.push("outlook_access");
  if (workflowCode === "PE07") effects.push("delivery_attempt");
  if (["PE02", "PE03", "PE08"].includes(workflowCode)) effects.push("ai_processing");
  if (outputData.external_id || outputData.message_id) effects.push("external_reference");
  return effects;
}

export async function verifyOrganization(admin: ReturnType<typeof createClient>, organizationId: string, caseId?: string | null) {
  if (!isUuid(organizationId)) throw new Error("INVALID_ORGANIZATION_ID");
  if (!caseId) return;
  requireUuid(caseId, "case_id");
  const { data, error } = await admin.from("cases").select("id,organization_id").eq("id", caseId).maybeSingle();
  if (error) throw error;
  if (!data || data.organization_id !== organizationId) throw new Error("CASE_ORGANIZATION_MISMATCH");
}

export async function invokeN8n(payload: IntegrationEnvelope) {
  const url = Deno.env.get("N8N_WEBHOOK_URL");
  const secret = Deno.env.get("N8N_INGRESS_SECRET");
  if (!url || !secret) throw new Error("N8N_NOT_CONFIGURED");
  const response = await fetch(`${url.replace(/\/$/, "")}/webhook/prologistica`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-prologistica-secret": secret },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`N8N_HTTP_${response.status}`);
  return data as Record<string, unknown>;
}
