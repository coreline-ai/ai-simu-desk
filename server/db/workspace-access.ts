import { and, eq } from "drizzle-orm";
import type { Database } from "./database.js";
import { members } from "./schema.js";
import { AppError } from "../domain/contracts.js";
export type Tx = Parameters<Parameters<Database["db"]["transaction"]>[0]>[0];
export type Store = Database["db"] | Tx;
export async function workspaceMember(db: Store, userId: string, workspaceId: string) {
  const [row] = await db.select().from(members).where(and(eq(members.userId, userId), eq(members.workspaceId, workspaceId)));
  if (!row) throw new AppError(404, "작업 공간을 찾을 수 없습니다.", "NOT_FOUND");
  return row;
}
