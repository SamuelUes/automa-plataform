export type AssistantMessage = { id: string; role: "user" | "assistant"; content: string; createdAt: string; action?: { intent: string; label: string; requiresConfirmation: boolean; caseId?: string } };

export const initialAssistantMessages: AssistantMessage[] = [
  { id: "msg-1", role: "assistant", content: "Buenos días. Soy tu Command Center. Puedo ayudarte a revisar casos, encontrar correos y preparar acciones sobre tu operación.", createdAt: "09:41" },
  { id: "msg-2", role: "user", content: "¿Qué tengo pendiente?", createdAt: "09:42" },
  { id: "msg-3", role: "assistant", content: "Tienes 4 asuntos que requieren atención: una aprobación urgente del caso #184, un caso sin decisión en Operaciones, un seguimiento vencido y una respuesta pendiente de verificación.", createdAt: "09:42" },
];
