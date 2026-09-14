// @ts-expect-error Deno resolves URL imports at Edge Function runtime.
import { z } from "https://esm.sh/zod@3.25.76";

export { z };

export const actionInputSchema = z.object({
  action_type: z.enum([
    "approve_email",
    "reject_approval",
    "delegate_case",
    "send_email",
    "create_email_draft",
    "discard_email_draft",
    "schedule_follow_up",
    "resolve_case",
    "verify_case",
    "close_case",
    "execute_workflow",
  ]),
  idempotency_key: z.string().min(8).max(200),
  case_id: z.string().uuid().optional().nullable(),
  approval_id: z.string().uuid().optional().nullable(),
  conversation_id: z.string().uuid().optional().nullable(),
  message_id: z.string().uuid().optional().nullable(),
  workflow_name: z.string().max(200).optional().nullable(),
  input_data: z.record(z.unknown()).optional(),
}).passthrough();

export const assistantInputSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  conversation_id: z.string().uuid().optional().nullable(),
  case_id: z.string().uuid().optional().nullable(),
});
