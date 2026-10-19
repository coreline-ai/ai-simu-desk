import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { openDatabase } from "../db/database.js";
import { createAuth } from "../adapters/auth.js";
import { createHttp } from "../http.js";
import { account, session } from "../db/schema.js";
import type { Config } from "../config.js";

export const testConfig = (): Config => ({ origin: "http://127.0.0.1:4180", port: 4180, secret: randomBytes(48).toString("base64url"), dataDir: "", fakeDelayMs: 0 });
test("real auth: signup, password hash, invalid login, session, origin, expiry, logout and no secret response", async () => {
  const database = await openDatabase();
  try {
    const config = testConfig(), auth = createAuth(database, config), app = createHttp(auth, config);
    const call = (path: string, body?: object, cookie?: string, origin = config.origin) => app.request(`${config.origin}${path}`, { method: body ? "POST" : "GET", headers: { ...(body ? { "content-type": "application/json", origin } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    assert.equal((await call("/api/me")).status, 401);
    assert.equal((await call("/api/auth/sign-up/email", { name: "QA", email: "auth-test@example.test", password: "Local-test-password-4891" }, undefined, "http://evil.test")).status, 403);
    const signup = await call("/api/auth/sign-up/email", { name: "QA", email: "auth-test@example.test", password: "Local-test-password-4891" });
    assert.equal(signup.status, 200, await signup.clone().text());
    const cookieHeader = signup.headers.get("set-cookie") ?? "";
    assert.match(cookieHeader, /HttpOnly/i); assert.match(cookieHeader, /SameSite=Lax/i);
    const cookie = cookieHeader.split(";")[0];
    const response = await call("/api/me", undefined, cookie);
    assert.equal(response.status, 200); assert.equal((await response.json()).user.name, "QA");
    assert.doesNotMatch(await (await call("/api/me", undefined, cookie)).text(), /session_token|password|secret|token/);
    const [stored] = await database.db.select().from(account);
    assert.ok(stored.password && stored.password !== "Local-test-password-4891");
    assert.equal((await call("/api/auth/sign-in/email", { email: "auth-test@example.test", password: "incorrect-password-123" })).status, 401);
    assert.equal((await call("/api/auth/sign-in/email", { email: "auth-test@example.test", password: "Local-test-password-4891" })).status, 200);
    const logout = await call("/api/auth/sign-out", {}, cookie); assert.equal(logout.status, 200);
    assert.equal((await call("/api/me", undefined, cookie)).status, 401);
    const login = await call("/api/auth/sign-in/email", { email: "auth-test@example.test", password: "Local-test-password-4891" });
    const active = (login.headers.get("set-cookie") ?? "").split(";")[0];
    await database.db.update(session).set({ expiresAt: new Date(0) });
    assert.equal((await call("/api/me", undefined, active)).status, 401);
    assert.equal((await call("/api/me", undefined, "better-auth.session_token=forged")).status, 401);
  } finally { await database.close(); }
});
