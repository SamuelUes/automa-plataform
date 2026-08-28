declare const Deno: { env: { get(name: string): string | undefined } };

export type N8nWorkflowPayload = {
  action_id?: string;
  approval_id?: string;
  requested_by?: string;
  organization_id: string;
  case_id?: string | null;
  conversation_id?: string | null;
  source_message_id?: string | null;
  decision_id?: string | null;
  command_id?: string | null;
  action_type?: string;
  workflow_code?: string;
  workflow_execution_id?: string | null;
  input_data?: Record<string, unknown>;
};

export type N8nResponse = { success: boolean; execution_id?: string; result?: unknown; error?: string };

function getN8nUrl() {
  const url = Deno.env.get("N8N_WEBHOOK_URL");
  if (!url) throw new Error("N8N_NOT_CONFIGURED");
  return url.replace(/\/$/, "");
}

export async function triggerWorkflow(payload: N8nWorkflowPayload): Promise<N8nResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const apiKey = Deno.env.get("N8N_API_KEY");
  const ingressSecret = Deno.env.get("N8N_INGRESS_SECRET");
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (ingressSecret) headers["x-prologistica-secret"] = ingressSecret;
  const workflowPath = payload.workflow_code ? `/webhook/prologistica-${payload.workflow_code.toLowerCase()}` : "/webhook/prologistica";
  const response = await fetch(`${getN8nUrl()}${workflowPath}`, { 
    method: "POST", 
    headers, 
    body: JSON.stringify(payload) 
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`N8N_HTTP_${response.status}`);
  return data as N8nResponse;
}

export async function getWorkflowStatus(executionId: string) {
  const apiUrl = Deno.env.get("N8N_API_URL");
  if (!apiUrl) throw new Error("N8N_API_NOT_CONFIGURED");
  const apiKey = Deno.env.get("N8N_API_KEY");
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/executions/${encodeURIComponent(executionId)}`, 
  { 
    headers: { 
      Accept: "application/json", 
      ...(apiKey ? { "X-N8N-API-KEY": apiKey } : {}) 
    } 
  });
  if (!response.ok) throw new Error(`N8N_HTTP_${response.status}`);
  return response.json();
}

export const getWorkflowExecution = getWorkflowStatus;
