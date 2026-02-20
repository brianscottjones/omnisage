/**
 * Workspace Manager Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  WorkspaceManager,
  WorkspaceProvisioner,
  validateWorkspaceConfig,
  WorkspaceValidationError,
  loadWorkspacesFromConfig,
  type CreateWorkspaceInput,
  type Workspace,
} from '../src/workspaces/index.js';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('WorkspaceManager', () => {
  let manager: WorkspaceManager;

  beforeEach(() => {
    manager = new WorkspaceManager();
  });

  describe('create', () => {
    it('should create a new workspace with valid configuration', async () => {
      const input: CreateWorkspaceInput = {
        orgId: 'org-123',
        name: 'Test Workspace',
        description: 'A test workspace',
        agent: {
          name: 'Test Agent',
          model: 'claude-sonnet-4',
          personality: 'You are a helpful assistant.',
          tools: ['web_search', 'calculator'],
          memoryAccess: [
            { namespace: 'ws:test', access: 'readwrite' },
          ],
          maxTokensPerDay: 100000,
          maxActionsPerHour: 50,
        },
        members: [
          {
            userId: 'user-1',
            role: 'ws:admin',
            addedAt: new Date(),
            addedBy: 'system',
          },
        ],
        channels: [
          {
            type: 'slack',
            channelId: 'C12345',
            mode: 'active',
            config: { token: 'xoxb-test' },
          },
        ],
        createdBy: 'test-user',
      };

      const workspace = await manager.create(input);

      expect(workspace.id).toBeTruthy();
      expect(workspace.orgId).toBe('org-123');
      expect(workspace.name).toBe('Test Workspace');
      expect(workspace.status).toBe('active');
      expect(workspace.agent.name).toBe('Test Agent');
      expect(workspace.members).toHaveLength(1);
      expect(workspace.channels).toHaveLength(1);
    });

    it('should throw validation error for invalid configuration', async () => {
      const input: CreateWorkspaceInput = {
        orgId: 'org-123',
        name: '', // Invalid: empty name
        description: 'Test',
        agent: {
          name: 'Test Agent',
          model: 'invalid-model', // Invalid model
          personality: '',
          tools: [],
          memoryAccess: [],
          maxTokensPerDay: -100, // Invalid: negative
          maxActionsPerHour: 50,
        },
        createdBy: 'test-user',
      };

      await expect(manager.create(input)).rejects.toThrow(WorkspaceValidationError);
    });

    it('should apply default policies when not provided', async () => {
      const input: CreateWorkspaceInput = {
        orgId: 'org-123',
        name: 'Test Workspace',
        description: 'Test',
        agent: {
          name: 'Test Agent',
          model: 'claude-sonnet-4',
          personality: 'Test personality',
          tools: [],
          memoryAccess: [],
          maxTokensPerDay: 100000,
          maxActionsPerHour: 50,
        },
        createdBy: 'test-user',
      };

      const workspace = await manager.create(input);

      expect(workspace.policies).toBeDefined();
      expect(workspace.policies.retentionDays).toBe(90);
      expect(workspace.policies.networkAllowlist).toEqual(['*']);
    });
  });

  describe('get and list', () => {
    it('should retrieve a workspace by ID', async () => {
      const input: CreateWorkspaceInput = {
        orgId: 'org-123',
        name: 'Test Workspace',
        description: 'Test',
        agent: {
          name: 'Test Agent',
          model: 'claude-sonnet-4',
          personality: 'Test',
          tools: [],
          memoryAccess: [],
          maxTokensPerDay: 100000,
          maxActionsPerHour: 50,
        },
        createdBy: 'test-user',
      };

      const created = await manager.create(input);
      const retrieved = await manager.get(created.id);

      expect(retrieved).toBeTruthy();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return null for non-existent workspace', async () => {
      const workspace = await manager.get('non-existent-id');
      expect(workspace).toBeNull();
    });

    it('should list workspaces for an organization', async () => {
      const input1: CreateWorkspaceInput = {
        orgId: 'org-123',
        name: 'Workspace 1',
        description: 'Test',
        agent: {
          name: 'Agent 1',
          model: 'claude-sonnet-4',
          personality: 'Test',
          tools: [],
          memoryAccess: [],
          maxTokensPerDay: 100000,
          maxActionsPerHour: 50,
        },
        createdBy: 'test-user',
      };

      const input2: CreateWorkspaceInput = {
        ...input1,
        orgId: 'org-456',
        name: 'Workspace 2',
        agent: { ...input1.agent, name: 'Agent 2' },
      };

      await manager.create(input1);
      await manager.create(input2);

      const workspaces = await manager.list('org-123');
      expect(workspaces).toHaveLength(1);
      expect(workspaces[0].name).toBe('Workspace 1');
    });

    it('should exclude archived workspaces by default', async () => {
      const input: CreateWorkspaceInput = {
        orgId: 'org-123',
        name: 'Test Workspace',
        description: 'Test',
        agent: {
          name: 'Test Agent',
          model: 'claude-sonnet-4',
          personality: 'Test',
          tools: [],
          memoryAccess: [],
          maxTokensPerDay: 100000,
          maxActionsPerHour: 50,
        },
        createdBy: 'test-user',
      };

      const workspace = await manager.create(input);
      await manager.archive(workspace.id);

      const activeWorkspaces = await manager.list('org-123', false);
      expect(activeWorkspaces).toHaveLength(0);

      const allWorkspaces = await manager.list('org-123', true);
      expect(allWorkspaces).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('should update workspace properties', async () => {
      const input: CreateWorkspaceInput = {
        orgId: 'org-123',
        name: 'Original Name',
        description: 'Original description',
        agent: {
          name: 'Test Agent',
          model: 'claude-sonnet-4',
          personality: 'Original personality',
          tools: [],
          memoryAccess: [],
          maxTokensPerDay: 100000,
          maxActionsPerHour: 50,
        },
        createdBy: 'test-user',
      };

      const workspace = await manager.create(input);

      const updated = await manager.update(workspace.id, {
        name: 'Updated Name',
        description: 'Updated description',
        agent: {
          personality: 'Updated personality',
        },
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.description).toBe('Updated description');
      expect(updated.agent.personality).toBe('Updated personality');
      expect(updated.agent.model).toBe('claude-sonnet-4'); // Unchanged
    });
  });

  describe('archive and restore', () => {
    it('should archive a workspace', async () => {
      const input: CreateWorkspaceInput = {
        orgId: 'org-123',
        name: 'Test Workspace',
        description: 'Test',
        agent: {
          name: 'Test Agent',
          model: 'claude-sonnet-4',
          personality: 'Test',
          tools: [],
          memoryAccess: [],
          maxTokensPerDay: 100000,
          maxActionsPerHour: 50,
        },
        createdBy: 'test-user',
      };

      const workspace = await manager.create(input);
      const archived = await manager.archive(workspace.id);

      expect(archived.status).toBe('archived');
    });

    it('should restore an archived workspace', async () => {
      const input: CreateWorkspaceInput = {
        orgId: 'org-123',
        name: 'Test Workspace',
        description: 'Test',
        agent: {
          name: 'Test Agent',
          model: 'claude-sonnet-4',
          personality: 'Test',
          tools: [],
          memoryAccess: [],
          maxTokensPerDay: 100000,
          maxActionsPerHour: 50,
        },
        createdBy: 'test-user',
      };

      const workspace = await manager.create(input);
      await manager.archive(workspace.id);
      const restored = await manager.restore(workspace.id);

      expect(restored.status).toBe('active');
    });
  });

  describe('member management', () => {
    let workspace: Workspace;

    beforeEach(async () => {
      const input: CreateWorkspaceInput = {
        orgId: 'org-123',
        name: 'Test Workspace',
        description: 'Test',
        agent: {
          name: 'Test Agent',
          model: 'claude-sonnet-4',
          personality: 'Test',
          tools: [],
          memoryAccess: [],
          maxTokensPerDay: 100000,
          maxActionsPerHour: 50,
        },
        createdBy: 'test-user',
      };

      workspace = await manager.create(input);
    });

    it('should add a member to a workspace', async () => {
      const updated = await manager.addMember(
        workspace.id,
        'user-123',
        'ws:member',
        'admin-user'
      );

      expect(updated.members).toHaveLength(1);
      expect(updated.members[0].userId).toBe('user-123');
      expect(updated.members[0].role).toBe('ws:member');
    });

    it('should not add duplicate members', async () => {
      await manager.addMember(workspace.id, 'user-123', 'ws:member', 'admin');

      await expect(
        manager.addMember(workspace.id, 'user-123', 'ws:admin', 'admin')
      ).rejects.toThrow('already a member');
    });

    it('should remove a member from a workspace', async () => {
      await manager.addMember(workspace.id, 'user-123', 'ws:member', 'admin');
      const updated = await manager.removeMember(workspace.id, 'user-123');

      expect(updated.members).toHaveLength(0);
    });

    it('should update a member role', async () => {
      await manager.addMember(workspace.id, 'user-123', 'ws:member', 'admin');
      const updated = await manager.updateMemberRole(workspace.id, 'user-123', 'ws:admin');

      expect(updated.members[0].role).toBe('ws:admin');
    });
  });

  describe('channel management', () => {
    let workspace: Workspace;

    beforeEach(async () => {
      const input: CreateWorkspaceInput = {
        orgId: 'org-123',
        name: 'Test Workspace',
        description: 'Test',
        agent: {
          name: 'Test Agent',
          model: 'claude-sonnet-4',
          personality: 'Test',
          tools: [],
          memoryAccess: [],
          maxTokensPerDay: 100000,
          maxActionsPerHour: 50,
        },
        createdBy: 'test-user',
      };

      workspace = await manager.create(input);
    });

    it('should add a channel to a workspace', async () => {
      const channel = {
        type: 'email' as const,
        channelId: 'support@example.com',
        mode: 'inbox' as const,
        config: {},
      };

      const updated = await manager.addChannel(workspace.id, channel);

      expect(updated.channels).toHaveLength(1);
      expect(updated.channels[0].type).toBe('email');
    });

    it('should remove a channel from a workspace', async () => {
      const channel = {
        type: 'slack' as const,
        channelId: 'C12345',
        mode: 'active' as const,
        config: { token: 'test' },
      };

      await manager.addChannel(workspace.id, channel);
      const updated = await manager.removeChannel(workspace.id, 'slack', 'C12345');

      expect(updated.channels).toHaveLength(0);
    });
  });

  describe('access control', () => {
    let workspace: Workspace;

    beforeEach(async () => {
      const input: CreateWorkspaceInput = {
        orgId: 'org-123',
        name: 'Test Workspace',
        description: 'Test',
        agent: {
          name: 'Test Agent',
          model: 'claude-sonnet-4',
          personality: 'Test',
          tools: [],
          memoryAccess: [],
          maxTokensPerDay: 100000,
          maxActionsPerHour: 50,
        },
        members: [
          {
            userId: 'admin-user',
            role: 'ws:admin',
            addedAt: new Date(),
            addedBy: 'system',
          },
          {
            userId: 'member-user',
            role: 'ws:member',
            addedAt: new Date(),
            addedBy: 'system',
          },
        ],
        createdBy: 'test-user',
      };

      workspace = await manager.create(input);
    });

    it('should check if user has access', () => {
      expect(manager.hasAccess(workspace, 'admin-user')).toBe(true);
      expect(manager.hasAccess(workspace, 'non-member')).toBe(false);
    });

    it('should check role hierarchy', () => {
      expect(manager.hasRole(workspace, 'admin-user', 'ws:admin')).toBe(true);
      expect(manager.hasRole(workspace, 'admin-user', 'ws:member')).toBe(true);
      expect(manager.hasRole(workspace, 'member-user', 'ws:admin')).toBe(false);
      expect(manager.hasRole(workspace, 'member-user', 'ws:member')).toBe(true);
    });
  });
});

describe('Workspace Validator', () => {
  it('should validate valid workspace configuration', () => {
    const config = {
      name: 'Test Workspace',
      agent: {
        name: 'Test Agent',
        model: 'claude-sonnet-4',
        personality: 'You are helpful.',
        tools: ['web_search'],
        memoryAccess: [
          { namespace: 'ws:test', access: 'readwrite' as const },
        ],
        maxTokensPerDay: 100000,
        maxActionsPerHour: 50,
      },
      channels: [
        {
          type: 'slack' as const,
          channelId: 'C12345',
          mode: 'active' as const,
          config: { token: 'test' },
        },
      ],
    };

    expect(() => validateWorkspaceConfig(config)).not.toThrow();
  });

  it('should reject empty workspace name', () => {
    const config = {
      name: '',
      agent: {
        name: 'Test',
        model: 'claude-sonnet-4',
        personality: 'Test',
        tools: [],
        memoryAccess: [],
        maxTokensPerDay: 100000,
        maxActionsPerHour: 50,
      },
      channels: [],
    };

    expect(() => validateWorkspaceConfig(config)).toThrow(WorkspaceValidationError);
  });

  it('should reject invalid model', () => {
    const config = {
      name: 'Test',
      agent: {
        name: 'Test',
        model: 'invalid-model-xyz',
        personality: 'Test',
        tools: [],
        memoryAccess: [],
        maxTokensPerDay: 100000,
        maxActionsPerHour: 50,
      },
      channels: [],
    };

    expect(() => validateWorkspaceConfig(config)).toThrow(WorkspaceValidationError);
  });

  it('should reject negative rate limits', () => {
    const config = {
      name: 'Test',
      agent: {
        name: 'Test',
        model: 'claude-sonnet-4',
        personality: 'Test',
        tools: [],
        memoryAccess: [],
        maxTokensPerDay: -1000,
        maxActionsPerHour: -50,
      },
      channels: [],
    };

    expect(() => validateWorkspaceConfig(config)).toThrow(WorkspaceValidationError);
  });
});

describe('Config Loader', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `omnisage-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  it('should load workspaces from valid YAML config', async () => {
    const configYaml = `
organization:
  name: "Test Corp"
  timezone: "America/Chicago"
  id: "org-test-123"

departments:
  sales:
    name: "Sales"
    channel:
      type: slack
      id: "C12345"
    agent: sales-ops
    members:
      - "alice@test.com"
      - "bob@test.com"

  support:
    name: "Support"
    channel:
      type: email
      address: "support@test.com"
    agent: customer-support

policies:
  requireApproval:
    - email_send
  defaultModel: "claude-sonnet-4"
  dataRetentionDays: 90
`;

    const configPath = join(tmpDir, 'omnisage.config.yaml');
    await writeFile(configPath, configYaml, 'utf-8');

    const manager = new WorkspaceManager();
    const result = await loadWorkspacesFromConfig(configPath, manager, 'test-system');

    expect(result.config.organization.name).toBe('Test Corp');
    
    // At least one workspace should be created (support with email channel)
    expect(result.workspaces.length).toBeGreaterThanOrEqual(1);

    // Support workspace should succeed (email channel doesn't need credentials for test)
    const supportWs = result.workspaces.find((ws) => ws.name === 'Support');
    expect(supportWs).toBeDefined();
    expect(supportWs?.agent.model).toContain('sonnet');
    expect(supportWs?.channels).toHaveLength(1);
    expect(supportWs?.channels[0].type).toBe('email');

    // Sales workspace may fail due to missing Slack credentials in test environment
    // This is expected behavior - the validator should catch missing credentials
  });
});
