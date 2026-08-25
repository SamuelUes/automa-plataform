export type Workflow = { id: string; code: string; name: string; description: string; status: "success" | "failed" | "running" | "waiting"; lastRun: string; executions: string; errors: number; avgDuration: string };
export type WorkflowExecution = { id: string; code: string; trigger: string; caseNumber: string; status: "success" | "failed" | "running"; duration: string; started: string; finished: string };

export const demoWorkflowDefinitions: Workflow[] = [
  ["PE01", "Outlook Intake", "success", "hace 2 min", "1,284", 0, "1.2s"], ["PE02", "Evaluate", "success", "hace 2 min", "1,281", 1, "1.8s"], ["PE03", "Reply Orchestrator", "success", "hace 4 min", "987", 0, "2.1s"], ["PE04", "Approval Router", "success", "hace 8 min", "412", 0, "0.8s"], ["PE05", "Case Classifier", "success", "hace 9 min", "1,274", 2, "1.4s"], ["PE06", "Customer Context", "success", "hace 12 min", "849", 0, "2.4s"], ["PE07", "Follow-up Scheduler", "success", "hace 15 min", "290", 0, "0.6s"], ["PE08", "Delegation Manager", "success", "hace 18 min", "156", 0, "0.9s"], ["PE09", "Audit Logger", "success", "hace 20 min", "2,840", 0, "0.3s"], ["PE10", "Delivery Retry", "failed", "hace 23 min", "92", 3, "3.2s"], ["PE11", "Escalation", "success", "hace 31 min", "64", 0, "0.7s"], ["PE12", "Daily Digest", "success", "ayer", "28", 0, "4.1s"],
].map(([code, name, status, lastRun, executions, errors, avgDuration]) => ({ code: String(code), name: String(name), status: status as Workflow["status"], lastRun: String(lastRun), executions: String(executions), errors: Number(errors), avgDuration: String(avgDuration), id: `demo-${code}`, description: `Workflow operativo para ${String(name).toLowerCase()}.` }));

export const demoExecutions: WorkflowExecution[] = [
  { id: "exec-9421", code: "PE02", trigger: "case.created", caseNumber: "#184", status: "success", duration: "1.8s", started: "Hoy · 09:43:02", finished: "Hoy · 09:43:04" },
  { id: "exec-9420", code: "PE02", trigger: "email.received", caseNumber: "#183", status: "success", duration: "1.6s", started: "Hoy · 09:31:18", finished: "Hoy · 09:31:20" },
  { id: "exec-9419", code: "PE02", trigger: "case.created", caseNumber: "#182", status: "success", duration: "2.1s", started: "Hoy · 09:12:44", finished: "Hoy · 09:12:46" },
  { id: "exec-9418", code: "PE02", trigger: "email.received", caseNumber: "#181", status: "failed", duration: "—", started: "Hoy · 08:56:09", finished: "Hoy · 08:56:12" },
  { id: "exec-9417", code: "PE02", trigger: "case.created", caseNumber: "#180", status: "success", duration: "1.7s", started: "Hoy · 08:42:27", finished: "Hoy · 08:42:29" },
];
