declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(
    handler: (request: Request) => Response | Promise<Response>
  ): void;
};

// @ts-expect-error Deno resolves URL imports at Edge Function runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const expectedSecret = Deno.env.get("N8N_WEBHOOK_SECRET");
  const receivedSecret = req.headers.get("x-n8n-webhook-secret");

  if (!expectedSecret || receivedSecret !== expectedSecret) {
    return Response.json(
      { error: "Webhook no autorizado" },
      { status: 401, headers: corsHeaders }
    );
  }

  try {
    const body = await req.json();
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!serviceKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada");
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey
    );

    const status = ["running", "success", "failed", "cancelled", "waiting"].includes(body.status)
      ? body.status
      : "failed";
    const outputData = body.output_data && typeof body.output_data === "object"
      ? body.output_data
      : {};
    const errorData = body.error_data && typeof body.error_data === "object"
      ? body.error_data
      : {};

    if (body.execution_id) {
      const { error } = await admin
        .from("workflow_executions")
        .update({
          status,
          output_data: outputData,
          error_data: errorData,
          n8n_execution_id: body.n8n_execution_id || body.execution_id,
          finished_at: ["success", "failed", "cancelled"].includes(status)
            ? new Date().toISOString()
            : null,
        })
        .eq("id", body.execution_id);

      if (error) throw error;
    }

    if (body.action_id) {
      const actionStatus = status === "success"
        ? "completed"
        : status === "failed"
          ? "failed"
          : status === "cancelled"
            ? "cancelled"
            : "running";

      const { error } = await admin
        .from("actions")
        .update({
          status: actionStatus,
          output_data: outputData,
          error_data: errorData,
          n8n_execution_id: body.n8n_execution_id || null,
          completed_at: ["completed", "failed", "cancelled"].includes(actionStatus)
            ? new Date().toISOString()
            : null,
        })
        .eq("id", body.action_id);

      if (error) throw error;
    }

    if (body.action_type === "approve_email" && body.approval_id) {
      await admin
        .from("approvals")
        .update({
          status: status === "success" ? "approved" : "rejected",
          decision: status === "success" ? "approved" : "rejected",
          responded_at: new Date().toISOString(),
        })
        .eq("id", body.approval_id);
    }

    if (body.action_type === "delegate_case" && body.case_id && status === "success") {
      const assignedTo = body.input_data?.assigned_to || body.assigned_to;
      const departmentId = body.input_data?.department_id || body.department_id;

      if (assignedTo) {
        await admin
          .from("cases")
          .update({
            assigned_to: assignedTo,
            department_id: departmentId || null,
            status: "delegated",
          })
          .eq("id", body.case_id);

        await admin.from("delegations").insert({
          organization_id: body.organization_id,
          case_id: body.case_id,
          assigned_to: assignedTo,
          assigned_by: body.requested_by || null,
          department_id: departmentId || null,
          reason: body.input_data?.reason || null,
        });
      }
    }

    if (body.action_type === "schedule_follow_up" && body.case_id && status === "success") {
      const scheduledFor = body.input_data?.scheduled_for;

      if (typeof scheduledFor === "string") {
        await admin.from("follow_ups").insert({
          organization_id: body.organization_id,
          case_id: body.case_id,
          scheduled_for: scheduledFor,
          reason: body.input_data?.reason || null,
        });
      }
    }

    return Response.json(
      { success: true },
      { headers: corsHeaders }
    );
  } catch {
    return Response.json(
      { error: "No se pudo procesar el callback de n8n" },
      { status: 500, headers: corsHeaders }
    );
  }
});
