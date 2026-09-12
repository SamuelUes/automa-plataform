declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

// @ts-expect-error Deno resolves URL imports at Edge Function runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  createCommand,
  createExecution,
  WORKFLOW_RESULT_CONTRACT,
  workflowExternalEffects,
  workflowOutcome,
  workflowRetry,
  recordAssistantProgress,
  persistPendingIntent,
} from "../_shared/integration.ts";
import { triggerWorkflow } from "../_shared/n8n/client.ts";

const terminalStatuses = ["success", "failed", "cancelled"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const expectedSecret = Deno.env.get("N8N_WEBHOOK_SECRET");
  if (!expectedSecret || req.headers.get("x-n8n-webhook-secret") !== expectedSecret) {
    return Response.json({ error: "Webhook no autorizado" }, { status: 401, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const status = ["running", "success", "failed", "cancelled", "waiting"].includes(body.status)
      ? body.status
      : "failed";

    if (!body.workflow_execution_id || !body.organization_id || !body.workflow_code) {
      return Response.json(
        { error: "workflow_execution_id, organization_id y workflow_code son obligatorios" },
        { status: 422, headers: corsHeaders },
      );
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!serviceKey || !supabaseUrl) throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED");

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: execution, error: executionError } = await admin
      .from("workflow_executions")
      .select("id,case_id,action_id,decision_id,command_id,workflow_code,input_data,parent_workflow_execution_id,orchestration_id,tool_call_id")
      .eq("id", body.workflow_execution_id)
      .maybeSingle();

    if (executionError) throw executionError;
    const executionOrganizationId = execution?.input_data?.organization_id;
    if (!execution || execution.workflow_code !== body.workflow_code || executionOrganizationId !== body.organization_id) {
      return Response.json({ error: "Ejecución o workflow no encontrado" }, { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    const resultKey = body.idempotency_key || `callback:${execution.id}:${status}:${body.n8n_execution_id || "unknown"}`;
    const { data: existingEvent } = await admin
      .from("workflow_events")
      .select("id")
      .eq("organization_id", body.organization_id)
      .eq("idempotency_key", resultKey)
      .maybeSingle();

    if (existingEvent) return Response.json({ success: true, duplicate: true }, { headers: corsHeaders });

    if (status === "success" && execution.decision_id) {
      const { data: decision } = await admin
        .from("authority_decisions")
        .select("id,authorized,requires_approval")
        .eq("id", execution.decision_id)
        .eq("organization_id", body.organization_id)
        .maybeSingle();
      if (!decision || !decision.authorized || decision.requires_approval) {
        return Response.json({ error: "El resultado no corresponde a un comando autorizado" }, { status: 409, headers: corsHeaders });
      }
    }

    const outputData = body.output_data && typeof body.output_data === "object" ? body.output_data : {};
    const errorData = body.error_data && typeof body.error_data === "object" ? body.error_data : {};
    const contractResult = {
      contract_version: WORKFLOW_RESULT_CONTRACT,
      outcome: workflowOutcome(status, outputData),
      retry: workflowRetry(status, outputData, errorData),
      coverage: outputData.coverage || outputData.coverage_status || null,
      errors: status === "failed" ? [errorData] : [],
      external_effects: workflowExternalEffects(body.workflow_code, outputData),
      network_access: body.workflow_code === "PE00" ? [] : ["n8n_callback"],
    };
    const { error: updateError } = await admin
      .from("workflow_executions")
      .update({
        status,
        output_data: outputData,
        error_data: errorData,
        n8n_execution_id: body.n8n_execution_id || null,
        finished_at: terminalStatuses.includes(status) ? new Date().toISOString() : null,
      })
      .eq("id", execution.id);
    if (updateError) throw updateError;

    if (execution.action_id) {
      const actionStatus = status === "failed"
        ? "failed"
        : status === "cancelled"
          ? "cancelled"
          : body.workflow_code === "PE02" || body.workflow_code === "PE06"
            ? outputData.requires_approval
              ? "pending"
              : outputData.authorized === false
                ? "failed"
                : "queued"
            : status === "success" ? "completed" : "running";
      const { error } = await admin
        .from("actions")
        .update({
          status: actionStatus,
          output_data: outputData,
          error_data: errorData,
          n8n_execution_id: body.n8n_execution_id || null,
          completed_at: ["completed", "failed", "cancelled"].includes(actionStatus) ? new Date().toISOString() : null,
        })
        .eq("id", execution.action_id)
        .eq("organization_id", body.organization_id);
      if (error) throw error;
    }

    const responseContent = typeof outputData.response === "string" ? outputData.response : null;
    const conversationId = execution.input_data?.conversation_id;
    const requestId = execution.input_data?.request_id || null;
    const inputData = execution.input_data?.input_data && typeof execution.input_data.input_data === "object"
      ? execution.input_data.input_data as Record<string, unknown>
      : {};
    const inputContent = typeof inputData.content === "string" ? inputData.content : null;
    const sourceChannel = inputData.source_channel === "whatsapp" || inputData.channel === "whatsapp"
      ? "whatsapp"
      : "dashboard";
    if (body.workflow_code === "PE08" && conversationId) {
      const decision = outputData.decision && typeof outputData.decision === "object"
        ? outputData.decision as Record<string, unknown>
        : null;
      const route = decision?.route;
      await persistPendingIntent(admin, {
        organization_id: body.organization_id,
        conversation_id: conversationId,
        intent: route === "orchestrator" || route === "clarification"
          ? { ...decision, status: route === "clarification" ? "pending" : "ready", request_id: requestId }
          : null,
      });
    }
    if (conversationId && requestId) {
      const progressStatus = typeof outputData.progress_status === "string"
        ? outputData.progress_status
        : status === "failed"
          ? "failed"
          : status === "success"
            ? "completed"
            : "workflow_running";
      await recordAssistantProgress(admin, {
        organization_id: body.organization_id,
        conversation_id: conversationId,
        request_id: requestId,
        workflow_execution_id: execution.id,
        source_channel: sourceChannel,
        status: progressStatus,
        label: typeof outputData.progress_label === "string" ? outputData.progress_label : undefined,
        progress_order: typeof outputData.progress_order === "number" ? outputData.progress_order : 50,
        metadata: { workflow_code: body.workflow_code, output_data: outputData },
      });
    }
    if (["success", "failed"].includes(status) && execution.parent_workflow_execution_id) {
      const resumeKey = `orchestration-resume:${execution.id}`;
      const { data: resumed } = await admin.from("workflow_events")
        .select("id")
        .eq("organization_id", body.organization_id)
        .eq("idempotency_key", resumeKey)
        .maybeSingle();
      if (!resumed) {
        const { data: parent } = await admin.from("workflow_executions")
          .select("id,workflow_code,input_data")
          .eq("id", execution.parent_workflow_execution_id)
          .maybeSingle();
        if (parent?.workflow_code === "PE08") {
          const parentInput = parent.input_data?.input_data && typeof parent.input_data.input_data === "object"
            ? parent.input_data.input_data as Record<string, unknown>
            : {};
          const originalContent = typeof parentInput.content === "string" ? parentInput.content : "";
          await triggerWorkflow({
            organization_id: body.organization_id,
            user_id: parent.input_data?.user_id || null,
            case_id: execution.case_id,
            conversation_id: parent.input_data?.conversation_id || null,
            workflow_code: "PE08",
            request_id: parent.input_data?.request_id || crypto.randomUUID(),
            correlation_id: parent.input_data?.correlation_id || parent.input_data?.conversation_id || parent.id,
            idempotency_key: `${parent.input_data?.idempotency_key || parent.id}:orchestration-result:${execution.id}`,
            workflow_execution_id: parent.id,
            action_type: "orchestration_result",
            input_data: {
              ...parentInput,
              source_channel: sourceChannel,
              content: `${originalContent}\n\nResultado operacional:\n${JSON.stringify(outputData)}`,
              orchestration_result: { success: status === "success", status, ...outputData, error_data: errorData },
              orchestration_workflow_code: body.workflow_code,
            },
          });
          await admin.from("workflow_events").insert({
            organization_id: body.organization_id,
            workflow_execution_id: execution.id,
            case_id: execution.case_id,
            event_type: "orchestration.parent_resumed",
            event_data: { parent_workflow_execution_id: parent.id, workflow_code: body.workflow_code },
            idempotency_key: resumeKey,
          });
        }
      }
    }
    const isConversationResponse = body.workflow_code === "PE08" ||
     body.workflow_code === "PE13" || 
     outputData.final_for_conversation === true;
    if (status === "failed" && isConversationResponse && conversationId && inputContent && requestId) {
      const failureCode = typeof errorData.code === "string" ? errorData.code : "WORKFLOW_FAILED";
      const failureMessage = typeof errorData.message === "string" ? errorData.message : "El flujo no pudo completar la solicitud.";
      const assistantError = `No se pudo completar la solicitud.\n\nFlujo: ${body.workflow_code}\nError: ${failureCode}\nDetalle: ${failureMessage}`;
      const { data: existingFailure } = await admin.from("messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .contains("metadata", { request_id: requestId })
        .limit(1);
      if (!existingFailure?.length) {
        const { error: failureMessageError } = await admin.from("messages").insert([
          {
            conversation_id: conversationId,
            request_id: requestId,
            user_id: execution.input_data?.user_id || null,
            sender_type: "human",
            role: "user",
            channel: sourceChannel,
            content: inputContent,
            content_json: { version: 1, status: "failed", request_id: requestId, content: inputContent },
            metadata: { source: sourceChannel, workflow_code: body.workflow_code, workflow_execution_id: execution.id, request_id: requestId },
          },
          {
            conversation_id: conversationId,
            request_id: requestId,
            sender_type: "ai",
            role: "assistant",
            channel: sourceChannel,
            content: assistantError,
            content_json: { version: 1, status: "failed", request_id: requestId, response: assistantError, error_data: errorData },
            metadata: { source: "n8n", workflow_code: body.workflow_code, workflow_execution_id: execution.id, request_id: requestId, status: "failed" },
          },
        ]);
        if (failureMessageError) throw failureMessageError;
      }
    }
    if (status === "success" && isConversationResponse && conversationId && inputContent && responseContent) {
      const messageMetadata = {
        workflow_code: body.workflow_code,
        workflow_execution_id: execution.id,
        n8n_execution_id: body.n8n_execution_id || null,
        request_id: requestId,
        source_channel: sourceChannel,
        external_message_id: inputData.external_message_id || null,
      };
      const { data: existingMessages, error: existingMessagesError } = await admin
        .from("messages")
        .select("id,sender_type")
        .eq("conversation_id", conversationId)
        .contains("metadata", { request_id: requestId })
        .limit(1);
      if (existingMessagesError) throw existingMessagesError;
      if (!existingMessages?.length) {
        const { error: messageError } = await admin.from("messages").insert([
          {
            conversation_id: conversationId,
            request_id: requestId,
            user_id: execution.input_data?.user_id || null,
            sender_type: "human",
            role: "user",
            channel: sourceChannel,
            content: inputContent,
            content_json: {
              version: 1,
              status: "completed",
              request_id: requestId,
              content: inputContent,
            },
            metadata: { source: sourceChannel, ...messageMetadata },
          },
          {
            conversation_id: conversationId,
            request_id: requestId,
            sender_type: "ai",
            role: "assistant",
            channel: sourceChannel,
            content: responseContent,
            content_json: {
              version: 1,
              status: "completed",
              request_id: requestId,
              response: responseContent,
              ...outputData,
            },
            metadata: { source: "n8n", ...messageMetadata },
          },
        ]);
        if (messageError) throw messageError;
        const { error: conversationStatusError } = await admin
          .from("conversations")
          .update({ status: "active", paused_at: null })
          .eq("id", conversationId)
          .eq("organization_id", body.organization_id)
          .neq("status", "closed");
        if (conversationStatusError) throw conversationStatusError;

        const { data: currentContext, error: currentContextError } = await admin
          .from("context")
          .select("id,version,content_json")
          .eq("conversation_id", conversationId)
          .maybeSingle();
        if (currentContextError) throw currentContextError;

        const contextPayload = {
          conversation_id: conversationId,
          organization_id: body.organization_id,
          case_id: execution.case_id || null,
          context_type: execution.case_id ? "case" : "assistant",
          content_json: {
            conversation_id: conversationId,
            case_id: execution.case_id || null,
            request_id: requestId,
            source_channel: sourceChannel,
            previous: currentContext?.content_json || {},
            latest_exchange: {
              channel: sourceChannel,
              user: { content: inputContent },
              assistant: { content: responseContent, ...outputData },
            },
          },
          version: (currentContext?.version || 0) + 1,
        };
        const { data: savedContext, error: contextError } = await admin
          .from("context")
          .upsert(currentContext?.id ? { id: currentContext.id, ...contextPayload } : contextPayload, { onConflict: "conversation_id" })
          .select("id")
          .single();
        if (contextError) throw contextError;

        const { error: linkError } = await admin
          .from("messages")
          .update({ context_id: savedContext.id })
          .eq("conversation_id", conversationId)
          .eq("request_id", requestId);
        if (linkError) throw linkError;
      }
    }

    let dispatched: { command_id: string; target_workflow_code: string; workflow_execution_id: string } | null = null;
    if (status === "success" && body.workflow_code === "PE02") {
      const decisionInfo = (outputData.decision && typeof outputData.decision === "object" ? outputData.decision : outputData) as Record<string, unknown>;
      const decisionId = typeof decisionInfo.decision_id === "string" ? decisionInfo.decision_id : execution.decision_id;
      const authorized = decisionInfo.authorized === true;
      const requiresApproval = decisionInfo.requires_approval === true;
      const targetWorkflowCode = typeof decisionInfo.target_workflow_code === "string"
        ? decisionInfo.target_workflow_code
        : (execution.input_data?.input_data?.target_workflow_code as string | undefined) || null;
      if (authorized && !requiresApproval && targetWorkflowCode && decisionId) {
        try {
          const commandType = typeof decisionInfo.action === "string" ? decisionInfo.action : body.workflow_code;
          const commandPayload = (decisionInfo.payload && typeof decisionInfo.payload === "object"
            ? decisionInfo.payload
            : execution.input_data?.input_data?.payload || {}) as Record<string, unknown>;
          const commandId = await createCommand(admin, {
            organization_id: body.organization_id,
            action_id: execution.action_id,
            decision_id: decisionId,
            workflow_code: targetWorkflowCode,
            command_type: commandType,
            payload: commandPayload,
            idempotency_key: `${resultKey}:command`,
          });
          const targetExecutionId = await createExecution(admin, {
            event_type: "command_dispatch",
            workflow_code: targetWorkflowCode,
            request_id: crypto.randomUUID(),
            correlation_id: execution.input_data?.correlation_id || execution.id,
            idempotency_key: `${resultKey}:${targetWorkflowCode}`,
            organization_id: body.organization_id,
            case_id: execution.case_id,
            conversation_id: execution.input_data?.conversation_id || null,
            source_message_id: execution.input_data?.source_message_id || null,
            action_id: execution.action_id,
            decision_id: decisionId,
            command_id: commandId,
            input_data: { command_type: commandType, payload: commandPayload },
          });
          await triggerWorkflow({
            organization_id: body.organization_id,
            case_id: execution.case_id,
            action_id: execution.action_id || undefined,
            decision_id: decisionId,
            command_id: commandId,
            action_type: commandType,
            workflow_code: targetWorkflowCode,
            workflow_execution_id: targetExecutionId,
            input_data: { command_type: commandType, payload: commandPayload },
          });
          await admin.from("commands").update({ status: "dispatched" }).eq("id", commandId);
          dispatched = { command_id: commandId, target_workflow_code: targetWorkflowCode, workflow_execution_id: targetExecutionId };
        } catch (dispatchError) {
          await admin.from("workflow_events").insert({
            organization_id: body.organization_id,
            workflow_execution_id: execution.id,
            case_id: execution.case_id,
            event_type: "pe02.command.dispatch_failed",
            event_data: { error: dispatchError instanceof Error ? dispatchError.message : "DISPATCH_FAILED" },
            idempotency_key: `${resultKey}:dispatch_failed`,
          });
        }
      }
    }

    const { error: eventError } = await admin.from("workflow_events").insert({
      organization_id: body.organization_id,
      workflow_execution_id: execution.id,
      case_id: execution.case_id,
      event_type: `n8n.${body.workflow_code}.${status}`,
      event_data: {
        ...contractResult,
        output_data: outputData,
        error_data: errorData,
        n8n_execution_id: body.n8n_execution_id || null,
      },
      idempotency_key: resultKey,
    });
    if (eventError) throw eventError;

    return Response.json({
      success: true,
      workflow_execution_id: execution.id,
      result: contractResult,
      dispatched,
    }, { headers: corsHeaders });
  } catch (error) {
    const errorDetails = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : error;
    const detail = error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(errorDetails);
    console.error("workflow callback failed", errorDetails);
    return Response.json(
      {
        error: "No se pudo procesar el callback de n8n",
        detail: detail || "UNKNOWN_CALLBACK_ERROR",
      },
      { status: 500, headers: corsHeaders },
    );
  }
});
