export type Delegation = { id: string; caseId?: string; caseNumber: number; title: string; assignee: string; department: string; delegatedBy: string; createdAt: string; reason: string; status: "active" | "completed" };
export type FollowUp = { id: string; caseId?: string; caseNumber: number; title: string; company: string; reason: string; scheduledFor: string; owner: string; status: "overdue" | "today" | "upcoming" | "completed" };
export type Activity = { id: string; event: string; actor: string; detail: string; time: string; tone: "success" | "info" | "warning" | "danger"; createdAt?: string };

export const demoDelegations: Delegation[] = [
  { id: "delegation-1", caseNumber: 183, title: "Incidencia en entrega internacional", assignee: "Carlos Méndez", department: "Operaciones", delegatedBy: "Daniela García", createdAt: new Date(Date.now() - 45 * 60000).toISOString(), reason: "Requiere coordinación con el equipo de despacho y documentación aduanal.", status: "active" },
  { id: "delegation-2", caseNumber: 181, title: "Revisión de contrato marco", assignee: "Laura Sánchez", department: "Legal", delegatedBy: "Daniela García", createdAt: new Date(Date.now() - 26 * 3600000).toISOString(), reason: "La revisión final debe ser validada por el departamento Legal.", status: "active" },
  { id: "delegation-3", caseNumber: 179, title: "Ajuste de condiciones de facturación", assignee: "Roberto Díaz", department: "Finanzas", delegatedBy: "Daniela García", createdAt: new Date(Date.now() - 3 * 86400000).toISOString(), reason: "Validación de condiciones especiales solicitadas por el cliente.", status: "completed" },
];

export const demoFollowUps: FollowUp[] = [
  { id: "follow-1", caseNumber: 182, title: "Confirmar calendario de implementación", company: "Grupo Delta", reason: "El cliente espera confirmación del calendario.", scheduledFor: new Date(Date.now() - 2 * 3600000).toISOString(), owner: "Daniela García", status: "overdue" },
  { id: "follow-2", caseNumber: 184, title: "Validar respuesta con cliente", company: "ABC Corporation", reason: "Confirmar recepción después de enviar la propuesta.", scheduledFor: new Date(Date.now() + 2 * 3600000).toISOString(), owner: "Daniela García", status: "today" },
  { id: "follow-3", caseNumber: 181, title: "Solicitar firma de contrato", company: "Vértice SA", reason: "Dar seguimiento a la firma del contrato marco.", scheduledFor: new Date(Date.now() + 2 * 86400000).toISOString(), owner: "Laura Sánchez", status: "upcoming" },
  { id: "follow-4", caseNumber: 178, title: "Confirmar recepción de documentos", company: "Nexo Industrial", reason: "Documentos fiscales recibidos correctamente.", scheduledFor: new Date(Date.now() - 4 * 86400000).toISOString(), owner: "Daniela García", status: "completed" },
];

export const demoActivity: Activity[] = [
  { id: "activity-1", event: "Aprobación solicitada", actor: "AI Agent", detail: "Caso #184 · Respuesta a propuesta comercial", time: "09:45", tone: "warning" },
  { id: "activity-2", event: "Caso delegado a Operaciones", actor: "Daniela García", detail: "Caso #183 · Incidencia en entrega internacional", time: "09:31", tone: "info" },
  { id: "activity-3", event: "Follow-up creado", actor: "Daniela García", detail: "Caso #184 · Validar respuesta con cliente", time: "09:20", tone: "info" },
  { id: "activity-4", event: "PE03 envió email", actor: "Reply Orchestrator", detail: "Caso #177 · Confirmación de servicio", time: "08:54", tone: "success" },
  { id: "activity-5", event: "Cliente respondió", actor: "Mariana López", detail: "Caso #180 · Actualización de datos fiscales", time: "Ayer · 17:42", tone: "success" },
  { id: "activity-6", event: "Workflow fallido", actor: "PE10 · Delivery Retry", detail: "Ejecución exec-9418 requiere revisión", time: "Ayer · 16:08", tone: "danger" },
];
