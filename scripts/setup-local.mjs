import { access, writeFile, mkdir, chmod } from "node:fs/promises";
import { randomBytes } from "node:crypto";
await mkdir(".data", { recursive: true, mode: 0o700 });
try { await access(".env.local"); console.log("Existing .env.local preserved."); }
catch { await writeFile(".env.local", `APP_ORIGIN=http://127.0.0.1:4180\nPORT=4180\nBETTER_AUTH_SECRET=${randomBytes(48).toString("base64url")}\nSTUDIO_DATA_DIR=.data/studio\nAI_PROVIDER=fake\nFAKE_AI_DELAY_MS=65\n`, { mode: 0o600, flag: "wx" }); console.log("Server-only .env.local created; secret not printed."); }
await chmod(".data", 0o700);
