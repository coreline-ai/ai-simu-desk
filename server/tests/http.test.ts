import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { openDatabase } from "../db/database.js";
import { createAuth } from "../adapters/auth.js";
import { createHttp } from "../http.js";
import { createStudio } from "../db/studio-store.js";

test("authenticated HTTP workspace boundaries, revocation, origin, body and event validation", async () => {
  const d = await openDatabase();
  try {
    const config = { origin: "http://127.0.0.1:4180", secret: randomBytes(48).toString("base64url"), port: 4180, dataDir: "", fakeDelayMs: 0 };
    const app = createHttp(createAuth(d, config), config, createStudio(d));
    const call = (path: string, cookie?: string, body?: object, key?: string) => app.request(config.origin + path, { method: body ? "POST" : "GET", headers: { ...(cookie ? { cookie } : {}), ...(body ? { origin: config.origin, "content-type": "application/json" } : {}), ...(key ? { "idempotency-key": key } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const register = async (name: string) => {
      const response = await call("/api/auth/sign-up/email", undefined, { name, email: `${name}@example.test`, password: "Synthetic-test-pass-5820" });
      assert.equal(response.status, 200); return (response.headers.get("set-cookie") ?? "").split(";")[0];
    };
    const aCookie = await register("alice"), bCookie = await register("bob");
    const a = await (await call("/api/me", aCookie)).json(), b = await (await call("/api/me", bCookie)).json();
    assert.notEqual(a.workspace.id, b.workspace.id);
    assert.equal((await call(`/api/workspaces/${a.workspace.id}/snapshot`)).status, 401);
    assert.equal((await call(`/api/workspaces/${a.workspace.id}/snapshot`, bCookie)).status, 404);
    assert.equal((await call(`/api/workspaces/${a.workspace.id}/events?after=0`, bCookie)).status, 404);
    const body = { prompt: "권한 검증 업무", agentId: "nara", approvalRequired: true, scenario: "normal" };
    assert.equal((await call(`/api/workspaces/${a.workspace.id}/runs`, bCookie, body, "request-foreign")).status, 404);
    const created = await call(`/api/workspaces/${a.workspace.id}/runs`, aCookie, body, "request-authorized"); assert.equal(created.status, 201);
    const run = await created.json();
    for (const malformed of [null, "approve", { version: run.version, approved: "yes" }]) {
      const response = await app.request(config.origin + `/api/runs/${run.id}/approval`, { method: "POST", headers: { cookie: aCookie, origin: config.origin, "content-type": "application/json" }, body: JSON.stringify(malformed) });
      assert.equal(response.status, 400);
    }
    assert.equal((await call(`/api/runs/${run.id}/approval`, bCookie, { version: run.version, approved: true })).status, 404);
    assert.equal((await call(`/api/runs/${run.id}/cancel`, bCookie, {})).status, 404);
    assert.equal((await call(`/api/workspaces/${a.workspace.id}/events?after=bad`, aCookie)).status, 400);
    const tooLarge = await app.request(config.origin + `/api/workspaces/${a.workspace.id}/runs`, { method: "POST", headers: { cookie: aCookie, origin: config.origin, "content-type": "application/json" }, body: JSON.stringify({ prompt: "x".repeat(17000) }) }); assert.equal(tooLarge.status, 413);
    await call("/api/auth/sign-out", aCookie, {});
    assert.equal((await call(`/api/workspaces/${a.workspace.id}/snapshot`, aCookie)).status, 401);
    assert.equal((await call(`/api/workspaces/${b.workspace.id}/snapshot`, bCookie)).status, 200);
  } finally { await d.close(); }
});
