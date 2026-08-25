import { Badge } from "@/components/ui/badge";
import type { CaseStatus, PriorityLevel } from "@/types/database";

const statusLabels: Record<CaseStatus, string> = { 
  new: "Nuevo", 
  evaluating: "Evaluando", 
  waiting_human: "Atención humana", 
  waiting_approval: "Esperando aprobación", 
  approved: "Aprobado", 
  rejected: "Rechazado", 
  delegated: "Delegado", 
  in_progress: "En progreso", 
  waiting_customer: "Esperando cliente", 
  follow_up: "Seguimiento", 
  resolved: "Resuelto", 
  waiting_verification: "Verificación", 
  closed: "Cerrado", 
  cancelled: "Cancelado" 
};
const priorityLabels: Record<PriorityLevel, string> = { 
  low: "Baja", 
  normal: "Normal", 
  high: "Alta", 
  urgent: "Urgente", 
  critical: "Crítica" 
};

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const variant = status === "waiting_approval" || status === "waiting_human" 
  || status === "waiting_verification" ? "warning" 
  : status === "resolved" || status === "closed" || status === "approved" ? "success" 
  : status === "rejected" || status === "cancelled" ? "danger" 
  : status === "in_progress" ? "info" : "secondary";
  return <Badge variant={variant}>{statusLabels[status]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: PriorityLevel }) {
  const variant = priority === "critical" || priority === "urgent" ? "danger" : priority === "high" ? "warning" : priority === "normal" ? "secondary" : "outline";
  return <Badge variant={variant}>
    <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
    {priorityLabels[priority]}
  </Badge>;
}
export { statusLabels, priorityLabels };
