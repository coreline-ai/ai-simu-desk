import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import type { Database } from "../db/database.js";
import type { Config } from "../config.js";
import { user, session, account, verification } from "../db/schema.js";

export function createAuth(database: Database, config: Config) {
  return betterAuth({
    appName: "AI Simu Desk Local", baseURL: config.origin, secret: config.secret,
    trustedOrigins: [config.origin],
    database: drizzleAdapter(database.db, { provider: "pg", schema: { user, session, account, verification }, transaction: true }),
    emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128, requireEmailVerification: false },
    session: { expiresIn: 7 * 24 * 3600, updateAge: 24 * 3600, cookieCache: { enabled: false } },
    advanced: { useSecureCookies: false, defaultCookieAttributes: { httpOnly: true, sameSite: "lax" } },
    rateLimit: { enabled: true, window: 60, max: 60, customRules: { "/sign-in/email": { window: 60, max: 10 } } },
    logger: { disabled: true },
    telemetry: { enabled: false },
  });
}
export type Auth = ReturnType<typeof createAuth>;
