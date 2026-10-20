import { Hono } from "hono";
import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";
import type { Auth } from "./adapters/auth.js";
import { isGuestId } from "./adapters/guest-auth.js";
import type { Config } from "./config.js";
import type {Run} from "./domain/studio-port.js";
import type { StudioPort as Studio } from "./domain/studio-port.js";
import { createPresence } from "./application/presence.js";
import type { PresencePort as Presence } from "./domain/presence.js";
import { AppError } from "./domain/contracts.js";

const publicRun=(run:Run)=>{const {generatedAnswer,...safe}=run as Run&{generatedAnswer?:unknown};return safe;};

export function createHttp(auth: Auth, config: Config, studio?: Studio, onCancel: (id: string) => void = () => {}, presence: Presence | undefined = studio ? createPresence(studio.presenceMembers) : undefined) {
  const app = new Hono();
  app.use("*", secureHeaders({ contentSecurityPolicy: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"], imgSrc: ["'self'", "data:", "blob:"], connectSrc: ["'self'"], objectSrc: ["'none'"], baseUri: ["'none'"], frameAncestors: ["'none'"] } }));
  app.use("/api/*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    if(config.deployment==="vercel" && new URL(c.req.url).host!==new URL(config.origin).host) return c.json({error:"허용되지 않은 호스트입니다."},403);
    if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method) && c.req.header("origin") !== config.origin) return c.json({ error: "허용되지 않은 요청 출처입니다.", code: "ORIGIN_REJECTED" }, 403);
    await next();
  });
  app.use("/api/*", bodyLimit({ maxSize: 16 * 1024, onError: c => c.json({ error: "요청이 너무 큽니다." }, 413) }));
  app.all("/api/auth/*", async c => {
    const leaving = c.req.path === "/api/auth/sign-out" && c.req.method === "POST" ? await auth.api.getSession({headers:c.req.raw.headers}) : null;
    const response=await auth.handler(c.req.raw);
    if(leaving && response.ok) await presence?.leaveSession(leaving.session.id);
    return response;
  });
  app.get("/api/health", c => c.json({ status: "ok", edition: config.deployment??"local", database: config.databaseUrl?"postgresql":"pglite", aiProvider: "fake" }));
  app.get("/api/me", async c => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ error: "로그인이 필요합니다." }, 401);
    const workspace = studio ? await studio.personalWorkspace(session.user.id, session.user.name) : undefined;
    return c.json({ user: { id: session.user.id, name: session.user.name, email: session.user.email, isGuest: isGuestId(session.user.id) }, workspace, client: {sync:true,pollMs:2500,hiddenPollMs:30000}, provider: { id: "fake", label: config.deployment==="vercel"?"Fake AI":"로컬 Fake AI", externalRequests: false } });
  });
  if (studio) {
    const who = async (c: Context) => {
      const identity = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!identity) throw new AppError(401, "로그인이 필요합니다.", "UNAUTHORIZED");
      return identity.user.id;
    };
    const json = async (c: Context) => { try { const value = await c.req.json(); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); return value; } catch { throw new AppError(400, "JSON 요청을 확인해 주세요."); } };
    if(presence) for(const action of ["touch","leave"] as const) app.post(`/api/workspaces/:workspaceId/presence${action==="leave" ? "/leave" : ""}`,async c=>{
      const session=await auth.api.getSession({headers:c.req.raw.headers});
      if(!session) throw new AppError(401,"로그인이 필요합니다.","UNAUTHORIZED");
      const body=await json(c);
      return c.json(await presence[action]({userId:session.user.id,sessionId:session.session.id,expiresAt:session.session.expiresAt},c.req.param("workspaceId"),body.clientId));
    });
    app.post("/api/workspaces/:workspaceId/sync",async c=>{
      const identity=await auth.api.getSession({headers:c.req.raw.headers});
      if(!identity)throw new AppError(401,"로그인이 필요합니다.","UNAUTHORIZED");
      const body=await json(c),id=c.req.param("workspaceId");
      const page=await studio.events(identity.user.id,id,body.after);
      const online=body.clientId!==undefined&&presence?await presence.touch({userId:identity.user.id,sessionId:identity.session.id,expiresAt:identity.session.expiresAt},id,body.clientId):null;
      if(body.selectedRunId!==undefined&&(typeof body.selectedRunId!=="string"||body.selectedRunId.length>100))throw new AppError(400,"선택한 업무를 확인해 주세요.");
      return c.json({page,presence:online,snapshot:page.events.length?await studio.snapshot(identity.user.id,id):null,inbox:await studio.inbox(identity.user.id,id),comments:body.selectedRunId?await studio.comments(identity.user.id,id,body.selectedRunId):null});
    });
    app.get("/api/workspaces", async c => c.json({ workspaces: await studio.listWorkspaces(await who(c)) }));
    app.get("/api/workspaces/:workspaceId/project",async c=>c.json(await studio.project(await who(c),c.req.param("workspaceId"))));
    app.post("/api/workspaces/:workspaceId/project",async c=>c.json(await studio.saveProject(await who(c),c.req.param("workspaceId"),await json(c))));
    app.get("/api/workspaces/:workspaceId/runs",async c=>c.json(await studio.findRuns(await who(c),c.req.param("workspaceId"),c.req.query())));
    app.get("/api/workspaces/:workspaceId/runs/:id",async c=>c.json(await studio.readRun(await who(c),c.req.param("workspaceId"),c.req.param("id"))));
    app.get("/api/workspaces/:workspaceId/runs/:id/compare",async c=>c.json(await studio.compareRun(await who(c),c.req.param("workspaceId"),c.req.param("id"))));
    app.get("/api/workspaces/:workspaceId/runs/:id/comments",async c=>c.json(await studio.comments(await who(c),c.req.param("workspaceId"),c.req.param("id"),c.req.query("before"))));
    app.post("/api/workspaces/:workspaceId/runs/:id/comments",async c=>c.json(await studio.addComment(await who(c),c.req.param("workspaceId"),c.req.param("id"),await json(c),c.req.header("idempotency-key")),201));
    app.get("/api/workspaces/:workspaceId/inbox",async c=>c.json(await studio.inbox(await who(c),c.req.param("workspaceId"))));
    app.post("/api/workspaces/:workspaceId/inbox/read",async c=>c.json(await studio.readNotifications(await who(c),c.req.param("workspaceId"))));
    app.post("/api/workspaces", async c => c.json(await studio.createWorkspace(await who(c),(await json(c)).name,c.req.header("idempotency-key")),201));
    app.post("/api/workspaces/join", async c => c.json(await studio.joinWorkspace(await who(c),(await json(c)).code)));
    app.post("/api/workspaces/:workspaceId/invites", async c => {
      const userId = await who(c), body = await json(c);
      return c.json(await studio.issueInvite(userId,c.req.param("workspaceId"),body.role ?? "viewer",body.version),201);
    });
    app.post("/api/workspaces/:workspaceId/invites/revoke", async c => {
      const userId = await who(c), body = await json(c);
      return c.json(await studio.revokeInvites(userId,c.req.param("workspaceId"),body.version));
    });
    app.post("/api/workspaces/:workspaceId/members/:userId", async c => {
      const userId = await who(c), body = await json(c);
      return c.json(await studio.updateMember(userId,c.req.param("workspaceId"),c.req.param("userId"),body.role,body.version));
    });
    app.get("/api/workspaces/:workspaceId/snapshot", async c => c.json(await studio.snapshot(await who(c), c.req.param("workspaceId"))));
    app.get("/api/workspaces/:workspaceId/events", async c => c.json(await studio.events(await who(c), c.req.param("workspaceId"), Number(c.req.query("after") ?? 0))));
    app.post("/api/workspaces/:workspaceId/runs", async c => c.json(publicRun(await studio.startRun(await who(c), c.req.param("workspaceId"), await json(c), c.req.header("idempotency-key"))), 201));
    app.post("/api/runs/:id/approval", async c => {
      const userId = await who(c), body = await json(c);
      if (!body || typeof body !== "object" || !Number.isSafeInteger(body.version) || typeof body.approved !== "boolean") throw new AppError(400, "승인 요청을 확인해 주세요.");
      return c.json(publicRun(await studio.approve(userId, c.req.param("id"), body.version, body.approved)));
    });
    app.post("/api/runs/:id/cancel", async c => {
      const run = await studio.cancel(await who(c), c.req.param("id"));
      if (run.status === "cancel_requested") onCancel(run.id);
      return c.json(publicRun(run));
    });
    app.post("/api/runs/:id/retry", async c => c.json(publicRun(await studio.retry(await who(c), c.req.param("id"), c.req.header("idempotency-key"))), 201));
  }
  app.onError((error, c) => error instanceof AppError ? c.json({ error: error.message, code: error.code }, error.status) : c.json({ error: "요청을 처리하지 못했습니다.", code: "INTERNAL_ERROR" }, 500));
  return app;
}
