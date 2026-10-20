import { APIError, createAuthEndpoint, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { StudioDatabase } from "../db/types.js";
import { user } from "../db/schema.js";

export const GUEST_ID = "simu-desk-public-guest";
export const GUEST_EMAIL = "guest@ai-simu-desk.invalid";
const safePaths = new Set(["/sign-in/guest", "/sign-in/email", "/sign-up/email", "/sign-out", "/get-session"]);

// A single public demo identity with normal signed, DB-backed sessions.
// No credential account or reusable password is sent to the client.
export function guestAuth(database: StudioDatabase) {
  return {
    id: "studio-guest",
    endpoints: {
      signInGuest: createAuthEndpoint("/sign-in/guest", { method: "POST" }, async ctx => {
        const current = await getSessionFromCtx(ctx);
        if (current) {
          if (current.user.id !== GUEST_ID) throw new APIError("CONFLICT", { message: "로그아웃한 뒤 게스트로 시작해 주세요.", code: "ALREADY_SIGNED_IN" });
          return ctx.json({ success: true });
        }
        // Unique constraints make first-use provisioning safe across concurrent
        // requests and separate Vercel instances. Never adopt an existing email.
        await database.db.insert(user).values({ id: GUEST_ID, name: "게스트", email: GUEST_EMAIL, emailVerified: false }).onConflictDoNothing();
        const guest = await ctx.context.internalAdapter.findUserById(GUEST_ID);
        if (!guest || guest.email !== GUEST_EMAIL) throw new APIError("INTERNAL_SERVER_ERROR", { message: "게스트 계정을 준비하지 못했습니다." });
        const session = await ctx.context.internalAdapter.createSession(guest.id);
        if (!session) throw new APIError("INTERNAL_SERVER_ERROR", { message: "게스트 로그인에 실패했습니다." });
        await setSessionCookie(ctx, { session, user: guest });
        return ctx.json({ success: true });
      }),
    },
    hooks: {
      before: [{
        matcher: () => true,
        handler: createAuthMiddleware(async ctx => {
          if (ctx.path === "/sign-up/email" && typeof ctx.body?.email === "string" && ctx.body.email.trim().toLowerCase() === GUEST_EMAIL)
            throw new APIError("BAD_REQUEST", { message: "체험 계정 전용 이메일입니다.", code: "RESERVED_GUEST_EMAIL" });
          if (safePaths.has(ctx.path ?? "")) return;
          if ((await getSessionFromCtx(ctx))?.user.id === GUEST_ID)
            throw new APIError("FORBIDDEN", { message: "공용 게스트 계정 정보는 변경할 수 없습니다.", code: "GUEST_ACCOUNT_LOCKED" });
        }),
      }],
    },
  };
}
