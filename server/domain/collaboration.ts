import { AppError } from "./contracts.js";
export type MemberRole = "owner" | "member" | "viewer";
export type InviteRole = Exclude<MemberRole, "owner">;
export const canStartRun = (role: MemberRole) => role === "owner" || role === "member";
export const canControlRun = (role: MemberRole, requestedBy: string, userId: string) => role === "owner" || (role === "member" && requestedBy === userId);
export function workspaceName(value: unknown): string {
  if (typeof value !== "string" || value.trim().length < 2 || value.trim().length > 40) throw new AppError(400, "공간 이름은 2~40자로 입력해 주세요.");
  return value.trim();
}
export function inviteRole(value: unknown): InviteRole {
  if (value !== "member" && value !== "viewer") throw new AppError(400, "참여 권한을 확인해 주세요.");
  return value;
}
export function workspaceVersion(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw new AppError(400, "공간 버전을 확인해 주세요.");
  return Number(value);
}
