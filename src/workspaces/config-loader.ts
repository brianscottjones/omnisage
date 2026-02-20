/**
 * Workspace Config Loader
 *
 * Loads omnisage.config.yaml and generates workspace instances.
 * Bridges the business-friendly YAML format to internal workspace structures.
 */

import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import type { OmniSageConfig, DepartmentConfig } from '../config/omnisage/types.js';
import { expandChannelConfig } from '../config/omnisage/loader.js';
import type { Workspace, WorkspaceAgent, WorkspaceChannel, MemoryScope } from './index.js';
import { WorkspaceManager, type CreateWorkspaceInput } from './manager.js';
import { randomUUID } from 'node:crypto';

export interface LoadedWorkspaces {
  workspaces: Workspace[];
  config: OmniSageConfig;
  errors: string[];
}

/**
 * Load omnisage.config.yaml and create workspace instances.
 */
export async function loadWorkspacesFromConfig(
  configPath: string,
  manager: WorkspaceManager,
  createdBy: string = 'system'
): Promise<LoadedWorkspaces> {
  const errors: string[] = [];
  const workspaces: Workspace[] = [];

  try {
    // Load and parse YAML
    const content = await readFile(configPath, 'utf-8');
    const config = parseYaml(content) as OmniSageConfig;

    // Validate basic structure
    if (!config.organization) {
      throw new Error('Missing organization configuration');
    }

    if (!config.departments || Object.keys(config.departments).length === 0) {
      throw new Error('No departments configured');
    }

    // Generate organization ID if not provided
    const orgId = config.organization.id || randomUUID();

    // Create a workspace for each department
    for (const [deptKey, dept] of Object.entries(config.departments)) {
      try {
        const workspace = await createWorkspaceFromDepartment(
          deptKey,
          dept,
          orgId,
          config,
          manager,
          createdBy
        );
        workspaces.push(workspace);
      } catch (error) {
        errors.push(`Failed to create workspace for department ${deptKey}: ${error}`);
      }
    }

    return {
      workspaces,
      config,
      errors,
    };
  } catch (error) {
    throw new Error(`Failed to load workspaces from config: ${error}`);
  }
}

/**
 * Create a workspace from a department configuration.
 */
async function createWorkspaceFromDepartment(
  deptKey: string,
  dept: DepartmentConfig,
  orgId: string,
  globalConfig: OmniSageConfig,
  manager: WorkspaceManager,
  createdBy: string
): Promise<Workspace> {
  // Build agent configuration
  const agent = await buildAgentConfig(deptKey, dept, globalConfig);

  // Build channel configuration
  const channels = [buildChannelConfig(deptKey, dept)];

  // Build workspace input
  const input: CreateWorkspaceInput = {
    orgId,
    name: dept.name,
    description: `${dept.name} department workspace`,
    agent,
    channels,
    policies: {
      requireApproval: buildApprovalRules(dept, globalConfig),
      dataClassification: {},
      networkAllowlist: ['*'], // TODO: configure based on integrations
      retentionDays: globalConfig.policies?.dataRetentionDays || 90,
    },
    createdBy,
  };

  // Create workspace through manager
  return await manager.create(input);
}

/**
 * Build agent configuration from department config.
 */
async function buildAgentConfig(
  deptKey: string,
  dept: DepartmentConfig,
  globalConfig: OmniSageConfig
): Promise<WorkspaceAgent> {
  // Load agent template
  const agentTemplate = await loadAgentTemplate(dept.agent);

  // Apply department-specific overrides
  const model =
    dept.agentConfig?.model ||
    agentTemplate.model ||
    globalConfig.policies?.defaultModel ||
    'claude-sonnet-4';

  const personality =
    dept.agentConfig?.personalityOverride ||
    agentTemplate.personality ||
    `You are an AI assistant for the ${dept.name} department.`;

  // Build tool list
  const tools = buildToolList(dept, agentTemplate, globalConfig);

  // Build memory access scopes
  const memoryAccess: MemoryScope[] = [
    {
      namespace: `ws:${deptKey}`, // Own workspace memory
      access: 'readwrite',
    },
  ];

  // Add shared org memory if cross-department context is enabled
  if (globalConfig.policies?.crossDepartmentContext) {
    memoryAccess.push({
      namespace: `org:${globalConfig.organization.id || 'default'}`,
      access: 'read',
    });
  }

  return {
    name: dept.name,
    model,
    personality,
    tools,
    memoryAccess,
    maxTokensPerDay: agentTemplate.maxTokensPerDay || 1000000,
    maxActionsPerHour: agentTemplate.maxActionsPerHour || 100,
  };
}

/**
 * Load agent template from file.
 * In a real implementation, this would load from src/agents/templates/*.yaml
 */
async function loadAgentTemplate(templateName: string): Promise<any> {
  // Mock implementation - would load actual template file
  const templates: Record<string, any> = {
    'sales-ops': {
      model: 'claude-sonnet-4',
      personality: 'You are a sales operations assistant. Help manage CRM, track deals, and support the sales team.',
      tools: ['crm', 'email', 'calendar', 'slack'],
      maxTokensPerDay: 500000,
      maxActionsPerHour: 50,
    },
    'customer-support': {
      model: 'claude-sonnet-4',
      personality: 'You are a customer support assistant. Help resolve customer issues quickly and professionally.',
      tools: ['ticketing', 'email', 'knowledgeBase'],
      maxTokensPerDay: 750000,
      maxActionsPerHour: 100,
    },
    'finance-ops': {
      model: 'claude-opus-4',
      personality: 'You are a finance operations assistant. Handle financial data with precision and attention to compliance.',
      tools: ['finance', 'email', 'calendar'],
      maxTokensPerDay: 300000,
      maxActionsPerHour: 30,
    },
    'it-ops': {
      model: 'claude-sonnet-4',
      personality: 'You are an IT operations assistant. Help monitor systems, manage incidents, and support the DevOps team.',
      tools: ['monitoring', 'slack', 'ticketing'],
      maxTokensPerDay: 400000,
      maxActionsPerHour: 75,
    },
    'hr-people': {
      model: 'claude-sonnet-4',
      personality: 'You are an HR assistant. Help with employee onboarding, benefits, and people operations.',
      tools: ['email', 'calendar', 'knowledgeBase'],
      maxTokensPerDay: 250000,
      maxActionsPerHour: 40,
    },
  };

  return templates[templateName] || {
    model: 'claude-sonnet-4',
    personality: 'You are a helpful AI assistant.',
    tools: [],
    maxTokensPerDay: 500000,
    maxActionsPerHour: 50,
  };
}

/**
 * Build tool list from department config and template.
 */
function buildToolList(
  dept: DepartmentConfig,
  template: any,
  globalConfig: OmniSageConfig
): string[] {
  let tools = [...(template.tools || [])];

  // Add department-specific integrations
  if (dept.integrations) {
    tools.push(...dept.integrations);
  }

  // Apply allow/deny rules from agentConfig
  if (dept.agentConfig?.tools?.allow) {
    tools = dept.agentConfig.tools.allow;
  } else if (dept.agentConfig?.tools?.deny) {
    tools = tools.filter((tool) => !dept.agentConfig.tools!.deny!.includes(tool));
  }

  // Add base tools (always available)
  const baseTools = ['web_search', 'file_read', 'calculator'];
  tools.push(...baseTools.filter((tool) => !tools.includes(tool)));

  return [...new Set(tools)]; // Remove duplicates
}

/**
 * Build channel configuration from department config.
 */
function buildChannelConfig(deptKey: string, dept: DepartmentConfig): WorkspaceChannel {
  const expandedChannel = expandChannelConfig(dept.channel, deptKey);

  return {
    type: dept.channel.type,
    channelId: dept.channel.id || dept.channel.address || dept.channel.url || deptKey,
    mode: 'active',
    config: expandedChannel.config,
  };
}

/**
 * Build approval rules from department and global policies.
 */
function buildApprovalRules(
  dept: DepartmentConfig,
  globalConfig: OmniSageConfig
): string[] {
  const rules: string[] = [];

  // Add global approval requirements
  if (globalConfig.policies?.requireApproval) {
    for (const rule of globalConfig.policies.requireApproval) {
      switch (rule) {
        case 'email_send':
          rules.push('email:send');
          break;
        case 'crm_update':
          rules.push('crm:*:write');
          break;
        case 'payment':
          rules.push('finance:payment:*');
          break;
        case 'file_delete':
          rules.push('file:delete');
          break;
        case 'all_writes':
          rules.push('*:write');
          break;
      }
    }
  }

  return rules;
}

/**
 * Reload workspaces from config (for hot-reloading).
 */
export async function reloadWorkspaces(
  configPath: string,
  manager: WorkspaceManager,
  createdBy: string = 'system'
): Promise<LoadedWorkspaces> {
  // Load new configuration
  const result = await loadWorkspacesFromConfig(configPath, manager, createdBy);

  // TODO: Reconcile with existing workspaces
  // - Update existing workspaces
  // - Create new ones
  // - Archive removed ones

  return result;
}
