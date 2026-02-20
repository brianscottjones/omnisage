/**
 * Workspace Configuration Validator
 *
 * Validates workspace configurations to ensure:
 * - Required fields are present
 * - Integrations are properly configured
 * - Channel configs are valid
 * - Policies are sensible
 */

import type {
  WorkspaceAgent,
  WorkspaceChannel,
  WorkspacePolicies,
  MemoryScope,
} from './index.js';

export interface ValidationError {
  field: string;
  message: string;
}

export class WorkspaceValidationError extends Error {
  public errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    super(`Workspace validation failed: ${errors.map((e) => e.message).join(', ')}`);
    this.name = 'WorkspaceValidationError';
    this.errors = errors;
  }
}

interface WorkspaceConfigInput {
  name: string;
  agent: WorkspaceAgent;
  channels: WorkspaceChannel[];
  policies?: Partial<WorkspacePolicies>;
}

/**
 * Validate workspace configuration.
 * Throws WorkspaceValidationError if validation fails.
 */
export function validateWorkspaceConfig(config: WorkspaceConfigInput): void {
  const errors: ValidationError[] = [];

  // Validate name
  if (!config.name || config.name.trim().length === 0) {
    errors.push({
      field: 'name',
      message: 'Workspace name is required',
    });
  }

  if (config.name && config.name.length > 100) {
    errors.push({
      field: 'name',
      message: 'Workspace name must be 100 characters or less',
    });
  }

  // Validate agent
  validateAgent(config.agent, errors);

  // Validate channels
  validateChannels(config.channels, errors);

  // Validate policies
  if (config.policies) {
    validatePolicies(config.policies, errors);
  }

  if (errors.length > 0) {
    throw new WorkspaceValidationError(errors);
  }
}

/**
 * Validate agent configuration.
 */
function validateAgent(agent: WorkspaceAgent, errors: ValidationError[]): void {
  if (!agent) {
    errors.push({
      field: 'agent',
      message: 'Agent configuration is required',
    });
    return;
  }

  // Validate name
  if (!agent.name || agent.name.trim().length === 0) {
    errors.push({
      field: 'agent.name',
      message: 'Agent name is required',
    });
  }

  // Validate model
  if (!agent.model || agent.model.trim().length === 0) {
    errors.push({
      field: 'agent.model',
      message: 'Agent model is required',
    });
  }

  const validModels = [
    'claude-opus-4',
    'claude-sonnet-4',
    'claude-haiku-4',
    'gpt-4o',
    'gpt-4o-mini',
    'o1',
    'o1-mini',
    'gemini-2.0-flash-exp',
    'gemini-1.5-pro',
  ];

  if (agent.model && !validModels.some((m) => agent.model.includes(m))) {
    errors.push({
      field: 'agent.model',
      message: `Unsupported model: ${agent.model}. Valid models: ${validModels.join(', ')}`,
    });
  }

  // Validate personality
  if (!agent.personality || agent.personality.trim().length === 0) {
    errors.push({
      field: 'agent.personality',
      message: 'Agent personality/system prompt is required',
    });
  }

  if (agent.personality && agent.personality.length > 10000) {
    errors.push({
      field: 'agent.personality',
      message: 'Agent personality must be 10,000 characters or less',
    });
  }

  // Validate tools
  if (!Array.isArray(agent.tools)) {
    errors.push({
      field: 'agent.tools',
      message: 'Agent tools must be an array',
    });
  }

  // Validate memory access
  if (!Array.isArray(agent.memoryAccess)) {
    errors.push({
      field: 'agent.memoryAccess',
      message: 'Agent memoryAccess must be an array',
    });
  } else {
    agent.memoryAccess.forEach((scope, index) => {
      validateMemoryScope(scope, index, errors);
    });
  }

  // Validate rate limits
  if (agent.maxTokensPerDay !== undefined) {
    if (!Number.isInteger(agent.maxTokensPerDay) || agent.maxTokensPerDay < 0) {
      errors.push({
        field: 'agent.maxTokensPerDay',
        message: 'maxTokensPerDay must be a non-negative integer',
      });
    }

    if (agent.maxTokensPerDay < 10000) {
      errors.push({
        field: 'agent.maxTokensPerDay',
        message: 'maxTokensPerDay should be at least 10,000 for basic functionality',
      });
    }
  }

  if (agent.maxActionsPerHour !== undefined) {
    if (!Number.isInteger(agent.maxActionsPerHour) || agent.maxActionsPerHour < 0) {
      errors.push({
        field: 'agent.maxActionsPerHour',
        message: 'maxActionsPerHour must be a non-negative integer',
      });
    }
  }
}

/**
 * Validate memory scope configuration.
 */
function validateMemoryScope(
  scope: MemoryScope,
  index: number,
  errors: ValidationError[]
): void {
  if (!scope.namespace || scope.namespace.trim().length === 0) {
    errors.push({
      field: `agent.memoryAccess[${index}].namespace`,
      message: 'Memory namespace is required',
    });
  }

  if (!['read', 'readwrite'].includes(scope.access)) {
    errors.push({
      field: `agent.memoryAccess[${index}].access`,
      message: `Invalid access level: ${scope.access}. Must be 'read' or 'readwrite'`,
    });
  }
}

/**
 * Validate channel configurations.
 */
function validateChannels(channels: WorkspaceChannel[], errors: ValidationError[]): void {
  if (!Array.isArray(channels)) {
    errors.push({
      field: 'channels',
      message: 'Channels must be an array',
    });
    return;
  }

  channels.forEach((channel, index) => {
    validateChannel(channel, index, errors);
  });

  // Check for duplicate channels
  const channelKeys = channels.map((c) => `${c.type}:${c.channelId}`);
  const duplicates = channelKeys.filter(
    (key, index) => channelKeys.indexOf(key) !== index
  );

  if (duplicates.length > 0) {
    errors.push({
      field: 'channels',
      message: `Duplicate channels detected: ${duplicates.join(', ')}`,
    });
  }
}

/**
 * Validate a single channel configuration.
 */
function validateChannel(
  channel: WorkspaceChannel,
  index: number,
  errors: ValidationError[]
): void {
  const validTypes = ['slack', 'email', 'teams', 'telegram', 'api', 'discord'];

  if (!channel.type) {
    errors.push({
      field: `channels[${index}].type`,
      message: 'Channel type is required',
    });
  } else if (!validTypes.includes(channel.type)) {
    errors.push({
      field: `channels[${index}].type`,
      message: `Invalid channel type: ${channel.type}. Valid types: ${validTypes.join(', ')}`,
    });
  }

  if (!channel.channelId || channel.channelId.trim().length === 0) {
    errors.push({
      field: `channels[${index}].channelId`,
      message: 'Channel ID is required',
    });
  }

  if (!['active', 'inbox', 'notify_only'].includes(channel.mode)) {
    errors.push({
      field: `channels[${index}].mode`,
      message: `Invalid channel mode: ${channel.mode}. Must be 'active', 'inbox', or 'notify_only'`,
    });
  }

  // Type-specific validation
  switch (channel.type) {
    case 'email':
      validateEmailChannel(channel, index, errors);
      break;
    case 'slack':
      validateSlackChannel(channel, index, errors);
      break;
    case 'teams':
      validateTeamsChannel(channel, index, errors);
      break;
    case 'telegram':
      validateTelegramChannel(channel, index, errors);
      break;
    case 'api':
      validateApiChannel(channel, index, errors);
      break;
  }
}

function validateEmailChannel(
  channel: WorkspaceChannel,
  index: number,
  errors: ValidationError[]
): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (channel.channelId && !emailRegex.test(channel.channelId)) {
    errors.push({
      field: `channels[${index}].channelId`,
      message: 'Email channel ID must be a valid email address',
    });
  }
}

function validateSlackChannel(
  channel: WorkspaceChannel,
  index: number,
  errors: ValidationError[]
): void {
  if (!channel.config?.token) {
    errors.push({
      field: `channels[${index}].config.token`,
      message: 'Slack channel requires a bot token',
    });
  }
}

function validateTeamsChannel(
  channel: WorkspaceChannel,
  index: number,
  errors: ValidationError[]
): void {
  if (!channel.config?.appId) {
    errors.push({
      field: `channels[${index}].config.appId`,
      message: 'Teams channel requires an app ID',
    });
  }

  if (!channel.config?.appPassword) {
    errors.push({
      field: `channels[${index}].config.appPassword`,
      message: 'Teams channel requires an app password',
    });
  }
}

function validateTelegramChannel(
  channel: WorkspaceChannel,
  index: number,
  errors: ValidationError[]
): void {
  if (!channel.config?.token) {
    errors.push({
      field: `channels[${index}].config.token`,
      message: 'Telegram channel requires a bot token',
    });
  }
}

function validateApiChannel(
  channel: WorkspaceChannel,
  index: number,
  errors: ValidationError[]
): void {
  if (!channel.config?.webhookUrl) {
    errors.push({
      field: `channels[${index}].config.webhookUrl`,
      message: 'API channel requires a webhook URL',
    });
  }
}

/**
 * Validate workspace policies.
 */
function validatePolicies(
  policies: Partial<WorkspacePolicies>,
  errors: ValidationError[]
): void {
  if (policies.requireApproval && !Array.isArray(policies.requireApproval)) {
    errors.push({
      field: 'policies.requireApproval',
      message: 'requireApproval must be an array',
    });
  }

  if (policies.networkAllowlist && !Array.isArray(policies.networkAllowlist)) {
    errors.push({
      field: 'policies.networkAllowlist',
      message: 'networkAllowlist must be an array',
    });
  }

  if (policies.retentionDays !== undefined) {
    if (!Number.isInteger(policies.retentionDays) || policies.retentionDays < 1) {
      errors.push({
        field: 'policies.retentionDays',
        message: 'retentionDays must be a positive integer',
      });
    }

    if (policies.retentionDays > 3650) {
      errors.push({
        field: 'policies.retentionDays',
        message: 'retentionDays cannot exceed 10 years (3650 days)',
      });
    }
  }

  if (
    policies.dataClassification &&
    typeof policies.dataClassification !== 'object'
  ) {
    errors.push({
      field: 'policies.dataClassification',
      message: 'dataClassification must be an object',
    });
  }
}
