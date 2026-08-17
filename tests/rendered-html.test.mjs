import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL(`../dist/server/index.js?test=${process.pid}-${Date.now()}`, import.meta.url);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server renders the Lunch Roulette application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /Lunch Roulette AI/);
  assert.match(html, /今天中午吃什么/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/);
});
