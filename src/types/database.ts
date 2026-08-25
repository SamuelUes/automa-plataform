export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          settings: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          settings?: Json;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          slug?: string;
          settings?: Json;
          is_active?: boolean;
        };
      };
      users: {
        Row: {
          id: string;
          organization_id: string;
          full_name: string | null;
          email: string | null;
          avatar_url: string | null;
          role: UserRole;
          settings: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          organization_id: string;
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          settings?: Json;
          is_active?: boolean;
        };
        Update: {
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          settings?: Json;
          is_active?: boolean;
        };
      };
      departments: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          description: string | null;
          metadata: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          description?: string | null;
          metadata?: Json;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          description?: string | null;
          metadata?: Json;
          is_active?: boolean;
        };
      };
      contacts: {
        Row: {
          id: string;
          organization_id: string;
          name: string | null;
          email: string | null;
          phone: string | null;
          company: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name?: string | null;
          email?: string | null;
          phone?: string | null;
          company?: string | null;
          metadata?: Json;
        };
        Update: {
          name?: string | null;
          email?: string | null;
          phone?: string | null;
          company?: string | null;
          metadata?: Json;
        };
      };
      cases: {
        Row: {
          id: string;
          organization_id: string;
          case_number: number;
          title: string;
          description: string | null;
          status: CaseStatus;
          priority: PriorityLevel;
          contact_id: string | null;
          department_id: string | null;
          assigned_to: string | null;
          source: string | null;
          source_id: string | null;
          requires_human: boolean;
          requires_approval: boolean;
          current_action_id: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
          resolved_at: string | null;
          closed_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          title: string;
          description?: string | null;
          status?: CaseStatus;
          priority?: PriorityLevel;
          contact_id?: string | null;
          department_id?: string | null;
          assigned_to?: string | null;
          source?: string | null;
          source_id?: string | null;
          requires_human?: boolean;
          requires_approval?: boolean;
          current_action_id?: string | null;
          metadata?: Json;
        };
        Update: {
          title?: string;
          description?: string | null;
          status?: CaseStatus;
          priority?: PriorityLevel;
          contact_id?: string | null;
          department_id?: string | null;
          assigned_to?: string | null;
          source?: string | null;
          source_id?: string | null;
          requires_human?: boolean;
          requires_approval?: boolean;
          current_action_id?: string | null;
          metadata?: Json;
          resolved_at?: string | null;
          closed_at?: string | null;
        };
      };
      email_threads: {
        Row: {
          id: string;
          organization_id: string;
          case_id: string | null;
          external_thread_id: string | null;
          subject: string | null;
          participants: Json;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          case_id?: string | null;
          external_thread_id?: string | null;
          subject?: string | null;
          participants?: Json;
          metadata?: Json;
        };
        Update: {
          case_id?: string | null;
          subject?: string | null;
          participants?: Json;
          metadata?: Json;
        };
      };
      emails: {
        Row: {
          id: string;
          organization_id: string;
          thread_id: string | null;
          case_id: string | null;
          external_message_id: string | null;
          direction: EmailDirection;
          sender: Json;
          recipients: Json;
          cc: Json;
          bcc: Json;
          subject: string | null;
          body_text: string | null;
          body_html: string | null;
          headers: Json;
          metadata: Json;
          received_at: string | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          thread_id?: string | null;
          case_id?: string | null;
          external_message_id?: string | null;
          direction: EmailDirection;
          sender?: Json;
          recipients?: Json;
          cc?: Json;
          bcc?: Json;
          subject?: string | null;
          body_text?: string | null;
          body_html?: string | null;
          headers?: Json;
          metadata?: Json;
          received_at?: string | null;
          sent_at?: string | null;
        };
        Update: {
          case_id?: string | null;
          subject?: string | null;
          body_text?: string | null;
          body_html?: string | null;
          metadata?: Json;
        };
      };
      evaluations: {
        Row: {
          id: string;
          organization_id: string;
          case_id: string;
          email_id: string | null;
          model: string | null;
          evaluation_type: string;
          decision: string | null;
          confidence: number | null;
          priority: PriorityLevel | null;
          requires_human: boolean | null;
          requires_approval: boolean | null;
          reasoning: string | null;
          input_data: Json;
          output_data: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          case_id: string;
          email_id?: string | null;
          model?: string | null;
          evaluation_type: string;
          decision?: string | null;
          confidence?: number | null;
          priority?: PriorityLevel | null;
          requires_human?: boolean | null;
          requires_approval?: boolean | null;
          reasoning?: string | null;
          input_data?: Json;
          output_data?: Json;
        };
        Update: {
          decision?: string | null;
          confidence?: number | null;
          priority?: PriorityLevel | null;
          reasoning?: string | null;
        };
      };
      ai_runs: {
        Row: {
          id: string;
          organization_id: string;
          case_id: string | null;
          provider: string | null;
          model: string | null;
          prompt: string | null;
          response: string | null;
          input_tokens: number | null;
          output_tokens: number | null;
          latency_ms: number | null;
          status: WorkflowStatus;
          metadata: Json;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          case_id?: string | null;
          provider?: string | null;
          model?: string | null;
          prompt?: string | null;
          response?: string | null;
          input_tokens?: number | null;
          output_tokens?: number | null;
          latency_ms?: number | null;
          status?: WorkflowStatus;
          metadata?: Json;
        };
        Update: {
          response?: string | null;
          status?: WorkflowStatus;
        };
      };
      conversations: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string | null;
          case_id: string | null;
          title: string | null;
          conversation_type: string;
          status: ConversationStatus;
          context: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id?: string | null;
          case_id?: string | null;
          title?: string | null;
          conversation_type?: string;
          status?: ConversationStatus;
          context?: Json;
        };
        Update: {
          title?: string | null;
          status?: ConversationStatus;
          context?: Json;
        };
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          user_id: string | null;
          sender_type: SenderType;
          role: MessageRole;
          content: string | null;
          content_json: Json;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          user_id?: string | null;
          sender_type: SenderType;
          role: MessageRole;
          content?: string | null;
          content_json?: Json;
          metadata?: Json;
        };
        Update: {
          content?: string | null;
          content_json?: Json;
        };
      };
      actions: {
        Row: {
          id: string;
          organization_id: string;
          case_id: string | null;
          conversation_id: string | null;
          message_id: string | null;
          action_type: string;
          status: ActionStatus;
          requested_by: string | null;
          approved_by: string | null;
          workflow_name: string | null;
          n8n_execution_id: string | null;
          input_data: Json;
          output_data: Json;
          error_data: Json;
          idempotency_key: string | null;
          created_at: string;
          started_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          case_id?: string | null;
          conversation_id?: string | null;
          message_id?: string | null;
          action_type: string;
          status?: ActionStatus;
          requested_by?: string | null;
          approved_by?: string | null;
          workflow_name?: string | null;
          input_data?: Json;
          output_data?: Json;
          error_data?: Json;
          idempotency_key?: string | null;
        };
        Update: {
          status?: ActionStatus;
          n8n_execution_id?: string | null;
          output_data?: Json;
          error_data?: Json;
          started_at?: string | null;
          completed_at?: string | null;
        };
      };
      approvals: {
        Row: {
          id: string;
          organization_id: string;
          case_id: string;
          action_id: string | null;
          requested_from: string | null;
          status: ApprovalStatus;
          decision: string | null;
          comment: string | null;
          requested_at: string;
          responded_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          case_id: string;
          action_id?: string | null;
          requested_from?: string | null;
          status?: ApprovalStatus;
          decision?: string | null;
          comment?: string | null;
        };
        Update: {
          status?: ApprovalStatus;
          decision?: string | null;
          comment?: string | null;
          responded_at?: string | null;
        };
      };
      delegations: {
        Row: {
          id: string;
          organization_id: string;
          case_id: string;
          assigned_to: string;
          assigned_by: string | null;
          department_id: string | null;
          reason: string | null;
          status: string;
          metadata: Json;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          case_id: string;
          assigned_to: string;
          assigned_by?: string | null;
          department_id?: string | null;
          reason?: string | null;
          status?: string;
          metadata?: Json;
        };
        Update: {
          assigned_to?: string;
          department_id?: string | null;
          reason?: string | null;
          status?: string;
          completed_at?: string | null;
        };
      };
      follow_ups: {
        Row: {
          id: string;
          organization_id: string;
          case_id: string;
          scheduled_for: string;
          reason: string | null;
          status: string;
          attempt_count: number;
          last_attempt_at: string | null;
          completed_at: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          case_id: string;
          scheduled_for: string;
          reason?: string | null;
          status?: string;
          attempt_count?: number;
          metadata?: Json;
        };
        Update: {
          scheduled_for?: string;
          reason?: string | null;
          status?: string;
          attempt_count?: number;
          last_attempt_at?: string | null;
          completed_at?: string | null;
        };
      };
      workflow_definitions: {
        Row: {
          id: string;
          organization_id: string | null;
          code: string;
          name: string;
          description: string | null;
          n8n_workflow_id: string | null;
          version: number;
          is_active: boolean;
          configuration: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          code: string;
          name: string;
          description?: string | null;
          n8n_workflow_id?: string | null;
          version?: number;
          is_active?: boolean;
          configuration?: Json;
        };
        Update: {
          name?: string;
          description?: string | null;
          is_active?: boolean;
          configuration?: Json;
        };
      };
      workflow_executions: {
        Row: {
          id: string;
          workflow_id: string | null;
          case_id: string | null;
          action_id: string | null;
          n8n_execution_id: string | null;
          status: WorkflowStatus;
          trigger_type: string | null;
          input_data: Json;
          output_data: Json;
          error_data: Json;
          started_at: string;
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          workflow_id?: string | null;
          case_id?: string | null;
          action_id?: string | null;
          n8n_execution_id?: string | null;
          status?: WorkflowStatus;
          trigger_type?: string | null;
          input_data?: Json;
          output_data?: Json;
          error_data?: Json;
        };
        Update: {
          status?: WorkflowStatus;
          n8n_execution_id?: string | null;
          output_data?: Json;
          error_data?: Json;
          finished_at?: string | null;
        };
      };
      workflow_events: {
        Row: {
          id: string;
          organization_id: string;
          workflow_execution_id: string | null;
          case_id: string | null;
          event_type: string;
          event_data: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          workflow_execution_id?: string | null;
          case_id?: string | null;
          event_type: string;
          event_data?: Json;
        };
        Update: {
          event_type?: string;
          event_data?: Json;
        };
      };
      delivery_attempts: {
        Row: {
          id: string;
          organization_id: string;
          action_id: string | null;
          channel: string;
          destination: string | null;
          idempotency_key: string;
          attempt_number: number;
          status: string;
          external_id: string | null;
          error_message: string | null;
          response_data: Json;
          attempted_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          action_id?: string | null;
          channel: string;
          destination?: string | null;
          idempotency_key: string;
          attempt_number: number;
          status: string;
          external_id?: string | null;
          error_message?: string | null;
          response_data?: Json;
        };
        Update: {
          status?: string;
          error_message?: string | null;
        };
      };
      external_references: {
        Row: {
          id: string;
          organization_id: string;
          entity_type: string;
          entity_id: string;
          provider: string;
          external_id: string;
          external_url: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          entity_type: string;
          entity_id: string;
          provider: string;
          external_id: string;
          external_url?: string | null;
          metadata?: Json;
        };
        Update: {
          external_url?: string | null;
          metadata?: Json;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          organization_id: string | null;
          user_id: string | null;
          case_id: string | null;
          action_id: string | null;
          event_type: string;
          entity_type: string | null;
          entity_id: string | null;
          previous_data: Json;
          new_data: Json;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          user_id?: string | null;
          case_id?: string | null;
          action_id?: string | null;
          event_type: string;
          entity_type?: string | null;
          entity_id?: string | null;
          previous_data?: Json;
          new_data?: Json;
          metadata?: Json;
        };
        Update: {};
      };
    };
    Views: { [key: string]: never };
    Functions: {
      current_user_organization_id: { Args: Record<string, never>; Returns: string };
      current_user_role: { Args: Record<string, never>; Returns: UserRole };
      is_org_admin: { Args: Record<string, never>; Returns: boolean };
      get_pending_cases: { Args: { p_limit?: number }; Returns: Database["public"]["Tables"]["cases"]["Row"][] };
      get_pending_approvals: { Args: { p_limit?: number }; Returns: Database["public"]["Tables"]["approvals"]["Row"][] };
      create_audit_log: {
        Args: {
          p_organization_id: string;
          p_event_type: string;
          p_entity_type?: string | null;
          p_entity_id?: string | null;
          p_case_id?: string | null;
          p_action_id?: string | null;
          p_previous_data?: Json;
          p_new_data?: Json;
          p_metadata?: Json;
        };
        Returns: string;
      };
    };
    Enums: {
      case_status: CaseStatus;
      priority_level: PriorityLevel;
      user_role: UserRole;
      email_direction: EmailDirection;
      action_status: ActionStatus;
      approval_status: ApprovalStatus;
      workflow_status: WorkflowStatus;
      conversation_status: ConversationStatus;
      message_role: MessageRole;
      sender_type: SenderType;
    };
  };
};

export type CaseStatus =
  | "new" | "evaluating" | "waiting_human" | "waiting_approval"
  | "approved" | "rejected" | "delegated" | "in_progress"
  | "waiting_customer" | "follow_up" | "resolved"
  | "waiting_verification" | "closed" | "cancelled";

export type PriorityLevel = "low" | "normal" | "high" | "urgent" | "critical";

export type UserRole = "owner" | "admin" | "manager" | "agent" | "viewer";

export type EmailDirection = "inbound" | "outbound";

export type ActionStatus = "pending" | "queued" | "running" | "completed" | "failed" | "cancelled" | "expired";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired" | "cancelled";

export type WorkflowStatus = "running" | "success" | "failed" | "cancelled" | "waiting";

export type ConversationStatus = "active" | "archived" | "closed";

export type MessageRole = "user" | "assistant" | "system" | "tool";

export type SenderType = "human" | "ai" | "system" | "workflow";
