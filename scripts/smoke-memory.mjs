#!/usr/bin/env node
/**
 * Smoke-test for a deployed mem0 server.
 *
 * Usage:
 *   ./scripts/smoke-memory.mjs <serverUrl> <bearerKey>
 *   ./scripts/smoke-memory.mjs https://builderquest-mem0.fly.dev shh
 *
 * Or via env:
 *   MEM0_URL=https://… MEM0_KEY=shh ./scripts/smoke-memory.mjs
 *
 * The test:
 *   1. GET /health
 *   2. POST a goal-shaped memory for `smoketest@gmail.com`
 *   3. List memories for that user — must include the new one
 *   4. Search "RAG" — must return the new memory
 *   5. DELETE the user (clean up)
 *
 * Exits 0 on full pass, non-zero on any failure.
 */
import { argv, env, exit } from "node:process";

const url = (argv[2] ?? env.MEM0_URL ?? "").replace(/\/+$/, "");
const key = argv[3] ?? env.MEM0_KEY ?? "";
const userId = "smoketest@gmail.com";

if (!url) {
  console.error("Usage: smoke-memory.mjs <serverUrl> <bearerKey>");
  exit(2);
}

const c = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

const headers = {
  "content-type": "application/json",
  ...(key ? { authorization: `Bearer ${key}` } : {}),
};

async function step(name, fn) {
  process.stdout.write(`${c.dim}→${c.reset} ${name} ... `);
  try {
    const r = await fn();
    console.log(`${c.green}✓${c.reset}`);
    return r;
  } catch (e) {
    console.log(`${c.red}✗${c.reset}\n  ${e.message}`);
    throw e;
  }
}

async function http(method, path, body, opts = {}) {
  const res = await fetch(`${url}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(opts.timeout ?? 10000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${text.slice(0, 200)}`);
  }
  const ct = res.headers.get("content-type") ?? "";
  return ct.includes("application/json") ? res.json() : null;
}

console.log(`${c.bold}Smoke-test against${c.reset} ${url}`);

let createdId = null;
try {
  await step("Health check", async () => {
    const h = await http("GET", "/health");
    if (h && typeof h === "object" && "status" in h && h.status !== "ok") {
      throw new Error(`Unexpected health: ${JSON.stringify(h)}`);
    }
  });

  await step("Add a memory", async () => {
    const body = {
      messages: [{ role: "user", content: "Goal: ship a tiny RAG demo this week" }],
      user_id: userId,
      metadata: { category: "goal", source: "smoke-test" },
    };
    const r = await http("POST", "/v1/memories/", body);
    const item = Array.isArray(r) ? r[0] : (r && r.results ? r.results[0] : r);
    if (!item || !(item.id || item.memory)) {
      throw new Error(`No memory returned: ${JSON.stringify(r).slice(0, 200)}`);
    }
    createdId = item.id ?? null;
  });

  await step("List memories for user", async () => {
    const r = await http("GET", `/v1/memories/?user_id=${encodeURIComponent(userId)}`);
    const list = Array.isArray(r) ? r : r?.results ?? [];
    if (list.length === 0) throw new Error("List was empty after add.");
    const text = JSON.stringify(list).toLowerCase();
    if (!text.includes("rag")) {
      throw new Error("Newly-added memory not found in list.");
    }
  });

  await step("Search 'RAG'", async () => {
    const r = await http("POST", "/v1/memories/search/", {
      query: "RAG",
      user_id: userId,
      limit: 5,
    });
    const list = Array.isArray(r) ? r : r?.results ?? [];
    if (list.length === 0) {
      throw new Error("Search returned no results — check that mem0's LLM extraction is configured.");
    }
  });

  await step("Wipe smoketest user", async () => {
    await http("DELETE", `/v1/memories/?user_id=${encodeURIComponent(userId)}`);
  });

  console.log(`\n${c.green}${c.bold}All checks passed.${c.reset} mem0 is healthy at ${url}.`);
  exit(0);
} catch {
  console.log(
    `\n${c.red}${c.bold}Smoke-test failed.${c.reset} Check the server's logs and the bearer key.`
  );
  if (createdId) {
    console.log(`  (Leaked memory id: ${createdId} — manually clean up if needed.)`);
  }
  exit(1);
}
