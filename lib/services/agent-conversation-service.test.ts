import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AgentConversationService } from "./agent-conversation-service";

// agent_conversations has no policy that lets anon write (waas/030 has an
// authenticated SELECT only). The public chat widgets reach it through the
// route's service-role client, so the service must use the client it is given
// rather than building a cookie-bound one.

/** A builder that records the table and answers every query with an empty row. */
function recordingClient() {
  const tables: string[] = [];
  const builder: Record<string, unknown> = {};
  for (const method of [
    "select",
    "eq",
    "order",
    "limit",
    "upsert",
    "insert",
    "update",
  ]) {
    builder[method] = () => builder;
  }
  builder.maybeSingle = async () => ({ data: null, error: null });
  builder.single = async () => ({
    data: { id: "conversation-1", messages: [] },
    error: null,
  });
  const client = {
    from(table: string) {
      tables.push(table);
      return builder;
    },
  } as unknown as SupabaseClient;
  return { client, tables };
}

test("the service reads and writes through the client it is given", async () => {
  const { client, tables } = recordingClient();
  const service = new AgentConversationService(client);
  const conversation = await service.getOrCreateConversation(
    "session-1",
    "hvac",
    "account-1",
  );
  assert.equal(conversation?.id, "conversation-1");
  assert.deepEqual(tables, ["agent_conversations", "agent_conversations"]);
});

test("two services keep separate clients", async () => {
  const first = recordingClient();
  const second = recordingClient();
  await new AgentConversationService(first.client).getOrCreateConversation(
    "session-1",
    "hvac",
  );
  assert.equal(second.tables.length, 0);
  assert.ok(first.tables.length > 0);
});

test("the service builds no cookie-bound client of its own", () => {
  const source = readFileSync(
    new URL("./agent-conversation-service.ts", import.meta.url),
    "utf-8",
  );
  assert.ok(
    !source.includes("@/lib/supabase/server"),
    "agent-conversation-service must not import the cookie-bound client",
  );
  assert.ok(
    !/export const agentConversationService/.test(source),
    "a shared singleton would cache one client across requests",
  );
});

test("the chat route gives the service its admin client", () => {
  const route = readFileSync(
    new URL("../../app/api/agent/chat/route.ts", import.meta.url),
    "utf-8",
  );
  assert.match(
    route,
    /new AgentConversationService\(\s*supabase\s*\)/,
    "route must construct the service with its admin client",
  );
  assert.ok(
    !/import\s*\{\s*agentConversationService\b/.test(route),
    "route must not import the shared singleton",
  );
});
