export enum UserRole {
  admin = 'admin',
  member = 'member',
  viewer = 'viewer',
}

export enum PolicyType {
  contentFilter = 'content_filter',
  toolRestriction = 'tool_restriction',
  approvalRequired = 'approval_required',
}

export enum ApprovalState {
  pending = 'pending',
  approved = 'approved',
  rejected = 'rejected',
  expired = 'expired',
}

export enum ActorType {
  user = 'user',
  agent = 'agent',
}

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  authProvider: string;
  createdAt: Date;
  updatedAt: Date;
};

export type Agent = {
  id: string;
  name: string;
  systemPrompt: string;
  model: string;
  channels: string[];
  toolPermissions: Record<string, unknown>;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type Policy = {
  id: string;
  type: PolicyType;
  rulesJson: Record<string, unknown>;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AuditEntry = {
  id: string;
  actorId: string;
  actorType: ActorType;
  action: string;
  detail: string;
  costTokens: number;
  createdAt: Date;
};

export type ApprovalRequest = {
  id: string;
  agentId: string;
  actionType: string;
  params: Record<string, unknown>;
  state: ApprovalState;
  requestedAt: Date;
  decidedBy: string | null;
};

export type Document = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  storagePath: string;
  createdAt: Date;
};

export * from './policy.js';
