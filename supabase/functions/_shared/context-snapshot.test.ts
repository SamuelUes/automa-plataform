import { mergeContextSnapshot, normalizeContextRefs, summarizeCallbackOutput } from "./context-snapshot.ts";

const caseId = "00000000-0000-4000-8000-000000000001";
const conversationId = "00000000-0000-4000-8000-000000000002";
const emailId = "00000000-0000-4000-8000-000000000003";

Deno.test("mergeContextSnapshot increments the version and preserves source refs", () => {
  const previous = { version: 2, content_json: { source_refs: [{ type: "case", id: caseId }] } };
  const next = mergeContextSnapshot(previous, {
    conversation: { id: conversationId },
    source_refs: [{ type: "email", id: emailId }],
  });

  if (next.version !== 3) throw new Error("version was not incremented");
  if (next.content_json.source_refs.length !== 2) throw new Error("refs were not merged");
  if (next.content_json.snapshot_version !== 1) throw new Error("snapshot contract version missing");
});

Deno.test("context snapshots omit unbounded message and email bodies", () => {
  const next = mergeContextSnapshot(null, {
    source_refs: [{ type: "email", id: emailId }],
    latest_exchange: { content: "a".repeat(10_000), response: "b".repeat(10_000) },
  });

  if ("content" in (next.content_json.latest_exchange as Record<string, unknown>)) {
    throw new Error("message body was stored in the snapshot");
  }
  if ("response" in (next.content_json.latest_exchange as Record<string, unknown>)) {
    throw new Error("assistant body was stored in the snapshot");
  }
});

Deno.test("context refs are deduplicated and bounded", () => {
  const refs = normalizeContextRefs([
    { type: "email", id: emailId },
    { type: "email", id: emailId },
    { type: "case", id: caseId },
  ]);
  if (refs.length !== 2) throw new Error("duplicate refs were not removed");

  const summary = summarizeCallbackOutput({ response: "x".repeat(10_000), coverage: { status: "COMPLETE" } });
  if ("response" in summary) throw new Error("callback log summary retained a response body");
});
