/**
 * Workspace Manager - CRUD Operations
 *
 * Handles creation, reading, updating, archiving, and deletion of workspaces.
 */

import { randomUUID } from 'node:crypto';
import type {
  Workspace,
  WorkspaceAgent,
  WorkspaceMember,
  WorkspaceChannel,
  WorkspacePolicies,
} from './index.js';
import { WorkspaceProvisioner } from './provisioner.js';
import { validateWorkspaceConfig } from './validator.js';

export interface CreateWorkspaceInput {
  orgId: string;
  name: string;
  description: string;
  agent: WorkspaceAgent;
  members?: WorkspaceMember[];
  channels?: WorkspaceChannel[];
  policies?: Partial<WorkspacePolicies>;
  createdBy: string;
}

export interface UpdateWorkspaceInput {
  name?: string;
  description?: string;
  agent?: Partial<WorkspaceAgent>;
  policies?: Partial<WorkspacePolicies>;
}

export class WorkspaceManager {
  private workspaces: Map<string, Workspace> = new Map();
  private provisioner: WorkspaceProvisioner;

  constructor(provisioner?: WorkspaceProvisioner) {
    this.provisioner = provisioner || new WorkspaceProvisioner();
  }

  /**
   * Create a new workspace.
   * Validates configuration and provisions infrastructure.
   */
  async create(input: CreateWorkspaceInput): Promise<Workspace> {
    // Validate configuration
    validateWorkspaceConfig({
      name: input.name,
      agent: input.agent,
      channels: input.channels || [],
      policies: input.policies,
    });

    // Generate workspace ID
    const id = randomUUID();

    // Create default policies if not provided
    const policies: WorkspacePolicies = {
      requireApproval: input.policies?.requireApproval || [],
      dataClassification: input.policies?.dataClassification || {},
      networkAllowlist: input.policies?.networkAllowlist || ['*'],
      retentionDays: input.policies?.retentionDays || 90,
    };

    // Create workspace object
    const workspace: Workspace = {
      id,
      orgId: input.orgId,
      name: input.name,
      description: input.description,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: input.createdBy,
      agent: input.agent,
      members: input.members || [],
      channels: input.channels || [],
      schedules: [],
      policies,
    };

    // Provision infrastructure (memory namespace, audit partition, channels)
    await this.provisioner.provision(workspace);

    // Store workspace
    this.workspaces.set(id, workspace);

    return workspace;
  }

  /**
   * Get a workspace by ID.
   */
  async get(id: string): Promise<Workspace | null> {
    return this.workspaces.get(id) || null;
  }

  /**
   * Get a workspace by ID (throws if not found).
   */
  async getOrThrow(id: string): Promise<Workspace> {
    const workspace = await this.get(id);
    if (!workspace) {
      throw new Error(`Workspace not found: ${id}`);
    }
    return workspace;
  }

  /**
   * List all workspaces for an organization.
   */
  async list(orgId: string, includeArchived = false): Promise<Workspace[]> {
    const workspaces = Array.from(this.workspaces.values()).filter(
      (ws) => ws.orgId === orgId
    );

    if (!includeArchived) {
      return workspaces.filter((ws) => ws.status === 'active');
    }

    return workspaces;
  }

  /**
   * Update a workspace.
   */
  async update(id: string, input: UpdateWorkspaceInput): Promise<Workspace> {
    const workspace = await this.getOrThrow(id);

    // Update fields
    if (input.name !== undefined) {
      workspace.name = input.name;
    }

    if (input.description !== undefined) {
      workspace.description = input.description;
    }

    if (input.agent) {
      workspace.agent = {
        ...workspace.agent,
        ...input.agent,
      };
    }

    if (input.policies) {
      workspace.policies = {
        ...workspace.policies,
        ...input.policies,
      };
    }

    // Validate updated configuration
    validateWorkspaceConfig({
      name: workspace.name,
      agent: workspace.agent,
      channels: workspace.channels,
      policies: workspace.policies,
    });

    workspace.updatedAt = new Date();

    // Update provisioned resources if agent config changed
    if (input.agent) {
      await this.provisioner.updateAgent(workspace);
    }

    return workspace;
  }

  /**
   * Archive a workspace (soft delete).
   */
  async archive(id: string): Promise<Workspace> {
    const workspace = await this.getOrThrow(id);

    workspace.status = 'archived';
    workspace.updatedAt = new Date();

    // Deactivate channels but preserve data
    await this.provisioner.deactivate(workspace);

    return workspace;
  }

  /**
   * Permanently delete a workspace.
   * Warning: This is irreversible!
   */
  async delete(id: string): Promise<void> {
    const workspace = await this.getOrThrow(id);

    // Deprovision all resources
    await this.provisioner.deprovision(workspace);

    // Remove from storage
    this.workspaces.delete(id);
  }

  /**
   * Restore an archived workspace.
   */
  async restore(id: string): Promise<Workspace> {
    const workspace = await this.getOrThrow(id);

    if (workspace.status !== 'archived') {
      throw new Error(`Workspace ${id} is not archived`);
    }

    workspace.status = 'active';
    workspace.updatedAt = new Date();

    // Reactivate channels
    await this.provisioner.activate(workspace);

    return workspace;
  }

  /**
   * Add a member to a workspace.
   */
  async addMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceMember['role'],
    addedBy: string
  ): Promise<Workspace> {
    const workspace = await this.getOrThrow(workspaceId);

    // Check if already a member
    const existingMember = workspace.members.find((m) => m.userId === userId);
    if (existingMember) {
      throw new Error(`User ${userId} is already a member of workspace ${workspaceId}`);
    }

    // Add member
    workspace.members.push({
      userId,
      role,
      addedAt: new Date(),
      addedBy,
    });

    workspace.updatedAt = new Date();

    return workspace;
  }

  /**
   * Remove a member from a workspace.
   */
  async removeMember(workspaceId: string, userId: string): Promise<Workspace> {
    const workspace = await this.getOrThrow(workspaceId);

    const index = workspace.members.findIndex((m) => m.userId === userId);
    if (index === -1) {
      throw new Error(`User ${userId} is not a member of workspace ${workspaceId}`);
    }

    workspace.members.splice(index, 1);
    workspace.updatedAt = new Date();

    return workspace;
  }

  /**
   * Update a member's role.
   */
  async updateMemberRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceMember['role']
  ): Promise<Workspace> {
    const workspace = await this.getOrThrow(workspaceId);

    const member = workspace.members.find((m) => m.userId === userId);
    if (!member) {
      throw new Error(`User ${userId} is not a member of workspace ${workspaceId}`);
    }

    member.role = role;
    workspace.updatedAt = new Date();

    return workspace;
  }

  /**
   * Add a channel to a workspace.
   */
  async addChannel(workspaceId: string, channel: WorkspaceChannel): Promise<Workspace> {
    const workspace = await this.getOrThrow(workspaceId);

    // Validate channel configuration
    validateWorkspaceConfig({
      name: workspace.name,
      agent: workspace.agent,
      channels: [...workspace.channels, channel],
    });

    // Provision channel
    await this.provisioner.provisionChannel(workspace, channel);

    workspace.channels.push(channel);
    workspace.updatedAt = new Date();

    return workspace;
  }

  /**
   * Remove a channel from a workspace.
   */
  async removeChannel(
    workspaceId: string,
    channelType: string,
    channelId: string
  ): Promise<Workspace> {
    const workspace = await this.getOrThrow(workspaceId);

    const index = workspace.channels.findIndex(
      (c) => c.type === channelType && c.channelId === channelId
    );

    if (index === -1) {
      throw new Error(
        `Channel ${channelType}:${channelId} not found in workspace ${workspaceId}`
      );
    }

    const channel = workspace.channels[index];

    // Deprovision channel
    await this.provisioner.deprovisionChannel(workspace, channel);

    workspace.channels.splice(index, 1);
    workspace.updatedAt = new Date();

    return workspace;
  }

  /**
   * Check if a user has access to a workspace.
   */
  hasAccess(workspace: Workspace, userId: string): boolean {
    return workspace.members.some((m) => m.userId === userId);
  }

  /**
   * Check if a user has a specific role or higher.
   */
  hasRole(
    workspace: Workspace,
    userId: string,
    requiredRole: WorkspaceMember['role']
  ): boolean {
    const member = workspace.members.find((m) => m.userId === userId);
    if (!member) {
      return false;
    }

    const roleHierarchy: Record<WorkspaceMember['role'], number> = {
      'ws:admin': 3,
      'ws:member': 2,
      'ws:viewer': 1,
    };

    return roleHierarchy[member.role] >= roleHierarchy[requiredRole];
  }
}
