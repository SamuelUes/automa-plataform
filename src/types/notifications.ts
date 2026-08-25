export type NotificationType =
  | "approval_required"
  | "urgent_case"
  | "workflow_failed"
  | "follow_up_due"
  | "delegation_received"
  | "customer_replied"
  | "system_error";

export type Notification = {
  id: string;
  organization_id: string;
  user_id: string | null;
  notification_type: NotificationType;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};
