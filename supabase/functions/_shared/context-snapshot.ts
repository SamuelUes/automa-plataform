export const CONTEXT_SNAPSHOT_VERSION = 1;
export const MAX_CONTEXT_REFS = 100;
export const MAX_CONTEXT_STRING_LENGTH = 500;
export const MAX_CONTEXT_LOG_ITEMS = 100;

export type ContextRef = {
  type: string;
  id: string;
  source?: string;
};

type SnapshotRecord = Record<string, unknown>;

type PreviousSnapshot = {
  version?: number | null;
  content_json?: unknown;
} | null | undefined;

const bodyKeys = new Set([
  "body",
  "content",
  "html",
  "message",
  "raw",
  "response",
  "text",
]);

function isRecord(value: unknown): value is SnapshotRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function boundedString(value: string): string {
  return value.length > MAX_CONTEXT_STRING_LENGTH
    ? `${value.slice(0, MAX_CONTEXT_STRING_LENGTH)}…`
    : value;
}

/** Keep references stable and bounded so every callback cannot grow the snapshot forever. */
export function normalizeContextRefs(value: unknown): ContextRef[] {
  if (!Array.isArray(value)) return [];

  const refs: ContextRef[] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    if (!isRecord(candidate) || typeof candidate.type !== "string" || typeof candidate.id !== "string") continue;
    const ref: ContextRef = {
      type: boundedString(candidate.type),
      id: boundedString(candidate.id),
    };
    if (typeof candidate.source === "string") ref.source = boundedString(candidate.source);
    const key = `${ref.type}:${ref.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push(ref);
    if (refs.length >= MAX_CONTEXT_REFS) break;
  }
  return refs;
}

/** Remove message/email bodies and cap nested metadata used in snapshots and event records. */
export function boundContextValue(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return boundedString(value);
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= 3) return undefined;
  if (Array.isArray(value)) {
    return value.slice(0, MAX_CONTEXT_LOG_ITEMS)
      .map((item) => boundContextValue(item, depth + 1))
      .filter((item) => item !== undefined);
  }
  if (!isRecord(value)) return undefined;

  const bounded: SnapshotRecord = {};
  for (const [key, item] of Object.entries(value).slice(0, MAX_CONTEXT_LOG_ITEMS)) {
    if (bodyKeys.has(key.toLowerCase())) continue;
    const next = boundContextValue(item, depth + 1);
    if (next !== undefined) bounded[key] = next;
  }
  return bounded;
}

export function mergeContextSnapshot(
  previous: PreviousSnapshot,
  next: SnapshotRecord,
): { version: number; content_json: SnapshotRecord } {
  const previousContent = isRecord(previous?.content_json) ? previous.content_json : {};
  const previousRefs = normalizeContextRefs(previousContent.source_refs);
  const nextRefs = normalizeContextRefs(next.source_refs);
  const refs = normalizeContextRefs([...previousRefs, ...nextRefs]);
  const boundedNext = boundContextValue({ ...next, source_refs: undefined });
  const content = isRecord(boundedNext) ? boundedNext : {};

  return {
    version: Math.max(Number(previous?.version) || 0, 0) + 1,
    content_json: {
      ...content,
      snapshot_version: CONTEXT_SNAPSHOT_VERSION,
      source_refs: refs,
    },
  };
}

export function summarizeCallbackOutput(output: SnapshotRecord): SnapshotRecord {
  const bounded = boundContextValue(output);
  return isRecord(bounded) ? bounded : {};
}
