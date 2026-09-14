import type { PriorityLevel } from "@/types/database";

export type EmailDraftSummary = {
  id: string;
  subject: string | null;
  body: string;
  status: string;
  createdAt: string;
};

export type DemoEmail = { 
  id: string; 
  caseId?: string; 
  sender: string; 
  email: string; 
  subject: string; 
  preview: string; 
  receivedAt: string; 
  priority: PriorityLevel; 
  caseNumber: number; 
  company: string; 
  direction: "inbound" | "outbound"; 
  requiresApproval: boolean; 
  body: string; 
  bodyHtml?: string;
  draft?: EmailDraftSummary;
};

export const demoEmails: DemoEmail[] = [
  { id: "email-184", 
    sender: "Mariana López", 
    email: "mariana@abc-corp.com", 
    subject: "Autorización de propuesta comercial", 
    preview: "Hola, necesitamos confirmar la autorización...", 
    receivedAt: new Date(Date.now() - 8 * 60000).toISOString(), 
    priority: "urgent", 
    caseNumber: 184, 
    company: "ABC Corporation", 
    direction: "inbound", 
    requiresApproval: true, 
    body: "Hola,\n\nNecesitamos confirmar la autorización de la propuesta comercial antes del miércoles. El monto total es de $12,500 y nuestro equipo necesita una respuesta antes de 48 horas.\n\n¿Podrías ayudarnos a validar las condiciones?\n\nGracias,\nMariana" 
  },
  { id: "email-183", 
    sender: "Carlos Méndez", 
    email: "carlos@norte-logistics.com", 
    subject: "Documentación pendiente para despacho", 
    preview: "Nos falta la confirmación del documento de origen...", 
    receivedAt: new Date(Date.now() - 42 * 60000).toISOString(), 
    priority: "high", 
    caseNumber: 183, 
    company: "Norte Logistics", 
    direction: "inbound", 
    requiresApproval: false, 
    body: "Hola,\n\nNos falta la confirmación del documento de origen para poder continuar con el despacho internacional.\n\nQuedo atento.\nCarlos" 
  },
  { id: "email-182", 
    sender: "Sofía Ramírez", 
    email: "sofia@grupo-delta.com", 
    subject: "Re: Condiciones de servicio 2026", 
    preview: "Gracias por la actualización. Solo nos queda confirmar...", 
    receivedAt: new Date(Date.now() - 3 * 3600000).toISOString(), 
    priority: "normal", 
    caseNumber: 182, 
    company: "Grupo Delta", 
    direction: "inbound", 
    requiresApproval: false, 
    body: "Gracias por la actualización. Solo nos queda confirmar el calendario de implementación para el siguiente trimestre." 
  },
  { id: "email-181", 
    sender: "Andrés Torres", 
    email: "andres@vertice.com", 
    subject: "Contrato marco — última revisión", 
    preview: "Adjunto la versión revisada por nuestro equipo legal...", 
    receivedAt: new Date(Date.now() - 5 * 3600000).toISOString(), 
    priority: "high", 
    caseNumber: 181, 
    company: "Vértice SA", 
    direction: "inbound", 
    requiresApproval: false, 
    body: "Adjunto la versión revisada por nuestro equipo legal. Hemos incorporado los últimos comentarios." 
  },
  { id: "email-180", 
    sender: "Lucía Herrera", 
    email: "lucia@atlas-trading.com", 
    subject: "Actualización de datos fiscales", 
    preview: "Compartimos los documentos solicitados para actualizar...", 
    receivedAt: new Date(Date.now() - 24 * 3600000).toISOString(), 
    priority: "normal", 
    caseNumber: 180, 
    company: "Atlas Trading", 
    direction: "inbound", 
    requiresApproval: false, 
    body: "Compartimos los documentos solicitados para actualizar nuestros datos fiscales." 
  },
];
