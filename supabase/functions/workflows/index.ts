declare const Deno: { serve(handler: (request: Request) => Response | Promise<Response>): void };

import { cors } from "../_shared/cors.ts";
import { getAuthedClient } from "../_shared/auth.ts";
import { adminClient, createExecution } from "../_shared/integration.ts";
import { getWorkflowExecution, listWorkflows, triggerWorkflow } from "../_shared/n8n/client.ts";

type RuntimeStatusRow = {
  workflow_id: string;
  status: "active" | "inactive" | "unavailable" | "unknown";
  last_changed_at: string | null;
};

async function syncRuntimeStatus(organizationId: string, definitions: Array<Record<string, unknown>>) {
  const runtime = await listWorkflows();
  const n8nWorkflows = runtime.data || [];
  const n8nById = new Map(n8nWorkflows.map((workflow) => [String(workflow.id), workflow]));
  const n8nByCode = new Map(
    n8nWorkflows
      .map((workflow) => {
        const code = typeof workflow.name === "string" ? workflow.name.match(/^(PE\d+)/)?.[1] : undefined;
        return code ? [code, workflow] as const : null;
      })
      .filter((entry): entry is readonly [string, (typeof n8nWorkflows)[number]] => Boolean(entry)),
  );
  const rows = definitions.map((definition) => {
    const code = String(definition.code);
    const n8nWorkflow = definition.n8n_workflow_id
      ? n8nById.get(String(definition.n8n_workflow_id))
      : n8nByCode.get(code);
    const active = n8nWorkflow?.active === true;
    return {
      workflow_id: definition.id,
      organization_id: organizationId,
      workflow_code: definition.code,
      status: n8nWorkflow ? (active ? "active" : "inactive") : "unavailable",
      available: Boolean(n8nWorkflow && active),
      last_synced_at: new Date().toISOString(),
    };
  });
  if (!rows.length) return;
  const admin = adminClient();
  const { data: previous } = await admin
    .from("workflow_runtime_status")
    .select("workflow_id,status,last_changed_at")
    .eq("organization_id", organizationId);
  const previousRows = (previous || []) as RuntimeStatusRow[];
  const previousById = new Map(previousRows.map((row: RuntimeStatusRow) => [row.workflow_id, row]));
  const changedAt = rows.map((row) => {
    const workflowId = String(row.workflow_id);
    const lastSyncedAt = String(row.last_synced_at);
    const previousRow = previousById.get(workflowId);
    return {
      ...row,
      last_changed_at: previousRow?.status === row.status
        ? previousRow.last_changed_at || lastSyncedAt
        : lastSyncedAt,
    };
  });
  const { error } = await admin.from("workflow_runtime_status").upsert(changedAt, { onConflict: "workflow_id" });
  if (error) throw error;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  try {
    const { client, user } = await getAuthedClient(req);
    const body = await req.json().catch(() => ({}));
    const profile = await client.from("users").select("organization_id,role").eq("id", user.id).single();
   
    if (!profile.data) return Response.json({ error: "Usuario sin organización" }, { status: 403, headers: cors(req) });
   
    if (body.operation === "sync_status") {
      const { data: definitions, error } = await client
        .from("workflow_definitions")
        .select("id,code,n8n_workflow_id")
        .order("code");
      if (error) throw error;
      await syncRuntimeStatus(profile.data.organization_id, (definitions || []) as Array<Record<string, unknown>>);
      return Response.json({ data: { synced: definitions?.length || 0 } }, { headers: cors(req) });
    }

    if (req.method === "GET" || body.operation === "list") {
      const { data, error } = await client
        .from("workflow_definitions")
        .select("id,code,name,description,n8n_workflow_id,version,is_active,configuration,created_at,updated_at")
        .order("code");
      if (error) throw error;
      const definitions = (data || []) as Array<Record<string, unknown>>;
      await syncRuntimeStatus(profile.data.organization_id, definitions);
      const { data: runtime, error: runtimeError } = await client
        .from("workflow_runtime_status")
        .select("workflow_id,status,available,last_synced_at,last_changed_at")
        .eq("organization_id", profile.data.organization_id);
      if (runtimeError) throw runtimeError;
      const { data: stats, error: statsError } = await client.rpc("get_workflow_dashboard_stats", {
        p_organization_id: profile.data.organization_id,
        p_days: 30,
      });
      if (statsError) throw statsError;
      const runtimeRows = (runtime || []) as RuntimeStatusRow[];
      const runtimeByWorkflow = new Map(runtimeRows.map((item: RuntimeStatusRow) => [item.workflow_id, item]));
      const statsByWorkflow = new Map((stats || []).map((item: Record<string, unknown>) => [String(item.workflow_id), item]));
      return Response.json({
        data: definitions.map((definition) => ({
          ...definition,
          runtime_status: runtimeByWorkflow.get(String(definition.id)) || {
            status: "unknown",
            available: false,
            last_synced_at: null,
            last_changed_at: null,
          },
          stats: statsByWorkflow.get(String(definition.id)) || {
            executions: 0,
            errors: 0,
            avg_duration_ms: null,
            last_run: null,
            last_status: null,
            events: 0,
          },
        })),
      }, { headers: cors(req) });
    }
    if (body.execution_id) return Response.json({ data: await getWorkflowExecution(body.execution_id) }, { headers: cors(req) });
    if (!body.workflow_code && !body.action_id) return Response.json({ error: "workflow_code o action_id requerido" }, 
      { status: 422, headers: cors(req) });
    
    const payload = { action_id: body.action_id, organization_id: profile.data.organization_id,
      case_id: body.case_id || null, action_type: body.action_type || "execute_workflow", workflow_code: body.workflow_code, input_data: body.input_data || {} };

    if (["PE09", "PE11"].includes(body.workflow_code)) {
      const admin = adminClient();
      const requestId = body.request_id || crypto.randomUUID();
      const idempotencyKey = body.idempotency_key || `${body.workflow_code}:${requestId}`;
      const executionId = await createExecution(admin, {
        event_type: body.workflow_code === "PE09" ? "case_correlation" : "coverage_observed",
        workflow_code: body.workflow_code,
        request_id: requestId,
        correlation_id: body.correlation_id || body.case_id || requestId,
        idempotency_key: idempotencyKey,
        organization_id: profile.data.organization_id,
        case_id: body.case_id || null,
        input_data: body.input_data || {},
      });
      const eventData = body.workflow_code === "PE09"
        ? { item_ref: body.input_data?.itemRef || null, case_ref: body.input_data?.caseRef || body.case_id || null, conversation_refs: body.input_data?.conversationRefs || [] }
        : { coverage_status: body.input_data?.coverage_status || "UNKNOWN", required_source_refs: body.input_data?.requiredSourceRefs || [] };
      const { error } = await admin.from("workflow_events").insert({
        organization_id: profile.data.organization_id,
        workflow_execution_id: executionId,
        case_id: body.case_id || null,
        event_type: body.workflow_code === "PE09" ? "function.pe09.case_correlation" : "function.pe11.coverage_recorded",
        event_data: eventData,
        idempotency_key: idempotencyKey,
      });
      if (error) throw error;
      await admin.from("workflow_executions").update({ status: "success", output_data: eventData, finished_at: new Date().toISOString() }).eq("id", executionId);
      return Response.json({ data: { success: true, 
        workflow_execution_id: executionId, 
        output_data: eventData } }, 
        { status: 202, headers: cors(req) });
    }

    const result = await triggerWorkflow(payload);
    
    if (body.action_id) {
      await client.from("actions").update({ status: "queued", n8n_execution_id: result.execution_id || null }).eq("id", body.action_id);
    }
    
    return Response.json({ data: result }, { status: 202, headers: cors(req) });
  } 
  catch (error) { 
    const message = error instanceof Error && error.message === "UNAUTHORIZED" ? "No autorizado" : error instanceof Error && error.message.includes("N8N") ? 
    "La integración con n8n no está disponible" : "No se pudo procesar el workflow"; 
    return Response.json({ error: message }, 
      { status: message === "No autorizado" ? 401 : 500, headers: cors(req) }); }
});
