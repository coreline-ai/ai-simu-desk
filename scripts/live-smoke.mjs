import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
const origin = "http://127.0.0.1:4180";
await mkdir(".data", { recursive: true, mode: 0o700 }); await mkdir("product/evidence", { recursive: true });
let credentials;
try { credentials = JSON.parse(await readFile(".data/qa-credentials.json", "utf8")); }
catch {
  const suffix = randomBytes(5).toString("hex");
  credentials = { primary: { name: "QA 동료", email: `qa-primary-${suffix}@example.test`, password: randomBytes(24).toString("base64url") }, secondary: { name: "QA 분리", email: `qa-secondary-${suffix}@example.test`, password: randomBytes(24).toString("base64url") } };
  await writeFile(".data/qa-credentials.json", JSON.stringify(credentials), { mode: 0o600, flag: "wx" });
  for (const person of Object.values(credentials)) { const r = await fetch(`${origin}/api/auth/sign-up/email`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(person) }); assert.equal(r.status, 200, "Synthetic local QA signup"); }
}
const report = { anonymousStatus: (await fetch(`${origin}/api/me`)).status, health: await (await fetch(`${origin}/api/health`)).json(), staticIsolation: [] };
assert.equal(report.anonymousStatus, 401);
for (const port of [4173, 4180]) for (const path of ["/.env.local", "/.data/studio", "/server/db/schema.ts", "/assets/%2e%2e%2f%2e%2e%2f.env.local"]) {
  const status = (await fetch(`http://127.0.0.1:${port}${path}`, { method: "HEAD", redirect: "manual" })).status;
  assert.equal(status, 404, `Private path blocked on ${port}`); report.staticIsolation.push({ port, path, status });
}
const bundle = await readFile("product/dist/assets/app.js", "utf8"), env = await readFile(".env.local", "utf8");
const secret = env.match(/^BETTER_AUTH_SECRET=(.*)$/m)?.[1]; assert.ok(secret); assert.ok(!bundle.includes(secret));
report.noAuthSecretInClient = true;
await writeFile("product/evidence/live-smoke.json", JSON.stringify(report, null, 2) + "\n");
console.log("Local QA accounts provisioned privately; anonymous, private-path and client-secret checks passed.");
