import { resolve } from "node:path";

export interface Config {
  origin: string; port: number; secret: string; dataDir: string; fakeDelayMs: number;
}
export function getConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = Number(env.PORT ?? 4180);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("PORT must be 1024..65535");
  const origin = new URL(env.APP_ORIGIN ?? `http://127.0.0.1:${port}`);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname) || origin.protocol !== 'http:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error("This local edition requires a loopback HTTP origin");
  const secret = env.BETTER_AUTH_SECRET ?? "";
  if (secret.length < 32 || secret.startsWith("replace-with")) throw new Error("Run npm run setup:local to create the server-only auth secret");
  if (env.AI_PROVIDER && env.AI_PROVIDER !== "fake") throw new Error("This edition supports the explicitly selected Fake AI only");
  const delay = Number(env.FAKE_AI_DELAY_MS ?? 65);
  if (!Number.isFinite(delay) || delay < 0 || delay > 1000) throw new Error("Invalid Fake AI delay");
  return { origin: origin.origin, port, secret, dataDir: resolve(env.STUDIO_DATA_DIR ?? ".data/studio"), fakeDelayMs: delay };
}
