import type { MemberRole } from "./collaboration.js";
export interface Workspace { id: string; ownerId: string; kind: "personal" | "shared"; name: string; revision: number; creationKey: string | null; createdAt: Date; updatedAt: Date }
export type WorkspaceSummary = Workspace & { role: MemberRole };
export interface WorkspaceMember { userId: string; name: string; role: MemberRole }
export interface WorkspacePort {
  personalWorkspace(userId: string, name: string): Promise<Workspace>;
  listWorkspaces(userId: string): Promise<WorkspaceSummary[]>;
  createWorkspace(userId: string, name: unknown, key: string | undefined): Promise<Workspace>;
  issueInvite(userId: string, workspaceId: string, role: unknown, version: unknown): Promise<{ code: string; expiresAt: Date; revision: number }>;
  revokeInvites(userId: string, workspaceId: string, version: unknown): Promise<Workspace>;
  joinWorkspace(userId: string, code: unknown): Promise<Workspace>;
  updateMember(userId: string, workspaceId: string, targetId: string, role: unknown, version: unknown): Promise<Workspace>;
}
