import { createClient } from "@/lib/supabase/client";

export type ConversationMessage = {
  id: string;
  conversation_id: string;
  user_id: string | null;
  sender_type: "human" | "ai" | "system" | "workflow";
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  content_json: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function loadConversationMessages(conversationId: string) {
  const { data, error } = await createClient().from("messages").select("id,conversation_id,user_id,sender_type,role,content,content_json,metadata,created_at").eq("conversation_id", conversationId).order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as ConversationMessage[];
}

export async function findCaseConversation(caseId: string): Promise<{ id: string; title: string | null; updated_at: string } | null> {
  const { data, error } = await createClient().from("conversations").select("id,title,updated_at").eq("case_id", caseId).eq("conversation_type", "case").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data as { id: string; title: string | null; updated_at: string } | null;
}
