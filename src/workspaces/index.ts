/**
 * OmniSage Workspace Manager
 *
 * Workspaces are the fundamental unit of isolation.
 * Each workspace has its own agent, memory, tools, and access policies.
 */

export interface Workspace {
  id: string;
  orgId: string;
  name: string;
  description: string;
  status: 'active' | 'archived' | 'pending_deletion';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;

  // Agent configuration
  agent: WorkspaceAgent;

  // Members and roles
  members: WorkspaceMember[];

  // Connected channels
  channels: WorkspaceChannel[];

  // Scheduled tasks
  schedules: WorkspaceSchedule[];

  // Policies
  policies: WorkspacePolicies;
}

export interface WorkspaceAgent {
  name: string;
  model: string;
  personality: string; // System prompt template
  tools: string[]; // Tool IDs this agent can use
  memoryAccess: MemoryScope[];
  maxTokensPerDay: number;
  maxActionsPerHour: number;
}

export interface MemoryScope {
  namespace: string; // workspace ID or 'org_shared'
  access: 'read' | 'readwrite';
}

export interface WorkspaceMember {
  userId: string;
  role: 'ws:admin' | 'ws:member' | 'ws:viewer';
  addedAt: Date;
  addedBy: string;
}

export interface WorkspaceChannel {
  type: 'slack' | 'email' | 'teams' | 'telegram' | 'api' | 'discord';
  channelId: string;
  mode: 'active' | 'inbox' | 'notify_only';
  config: Record<string, unknown>;
}

export interface WorkspaceSchedule {
  name: string;
  cron: string;
  timezone: string;
  action: string; // Prompt to send to the agent
  deliverTo: string; // Channel or email
  enabled: boolean;
}

export interface WorkspacePolicies {
  requireApproval: string[]; // Tool patterns requiring approval
  dataClassification: Record<string, string>; // classification → action
  networkAllowlist: string[]; // Allowed outbound domains
  retentionDays: number;
}

// Export implementation modules
export { WorkspaceManager, type CreateWorkspaceInput, type UpdateWorkspaceInput } from './manager.js';
export { WorkspaceProvisioner, type ProvisioningResult } from './provisioner.js';
export { validateWorkspaceConfig, WorkspaceValidationError, type ValidationError } from './validator.js';
export { loadWorkspacesFromConfig, reloadWorkspaces, type LoadedWorkspaces } from './config-loader.js';
