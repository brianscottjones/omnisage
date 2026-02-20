/**
 * OmniSage Config Loader
 * 
 * Loads omnisage.config.yaml and transforms it into internal workspace configs.
 */

import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import type { OmniSageConfig, DepartmentConfig } from './types.js';
import type { ChannelConfig } from '../../channels/abstractions/types.js';

/**
 * Load and parse omnisage.config.yaml
 */
export async function loadOmniSageConfig(configPath: string): Promise<OmniSageConfig> {
  const content = await readFile(configPath, 'utf-8');
  const config = parseYaml(content) as OmniSageConfig;
  
  // Basic validation
  validateOmniSageConfig(config);
  
  return config;
}

/**
 * Validate the loaded config structure.
 */
function validateOmniSageConfig(config: OmniSageConfig): void {
  if (!config.organization) {
    throw new Error('Missing required field: organization');
  }
  
  if (!config.organization.name) {
    throw new Error('Missing required field: organization.name');
  }
  
  if (!config.organization.timezone) {
    throw new Error('Missing required field: organization.timezone');
  }
  
  if (!config.departments || Object.keys(config.departments).length === 0) {
    throw new Error('At least one department must be configured');
  }
  
  // Validate each department
  for (const [deptKey, dept] of Object.entries(config.departments)) {
    if (!dept.name) {
      throw new Error(`Department ${deptKey}: missing name`);
    }
    
    if (!dept.channel) {
      throw new Error(`Department ${deptKey}: missing channel configuration`);
    }
    
    if (!dept.agent) {
      throw new Error(`Department ${deptKey}: missing agent template reference`);
    }
    
    validateChannelConfig(dept.channel, deptKey);
  }
}

/**
 * Validate simplified channel config.
 */
function validateChannelConfig(channel: any, deptKey: string): void {
  if (!channel.type) {
    throw new Error(`Department ${deptKey}: channel.type is required`);
  }
  
  const validTypes = ['slack', 'teams', 'discord', 'email', 'telegram', 'webhook'];
  if (!validTypes.includes(channel.type)) {
    throw new Error(`Department ${deptKey}: invalid channel.type "${channel.type}"`);
  }
  
  // Type-specific validation
  switch (channel.type) {
    case 'slack':
    case 'teams':
    case 'discord':
      if (!channel.id) {
        throw new Error(`Department ${deptKey}: channel.id required for ${channel.type}`);
      }
      break;
    
    case 'email':
      if (!channel.address) {
        throw new Error(`Department ${deptKey}: channel.address required for email`);
      }
      break;
    
    case 'webhook':
      if (!channel.url) {
        throw new Error(`Department ${deptKey}: channel.url required for webhook`);
      }
      break;
    
    case 'telegram':
      // Telegram can work with just a token (listens to all chats)
      // or with a specific chatId
      break;
  }
}

/**
 * Convert simplified channel config to full ChannelConfig.
 * Resolves credentials from environment variables.
 */
export function expandChannelConfig(
  simpleConfig: any,
  deptKey: string,
  env: Record<string, string | undefined> = process.env
): ChannelConfig {
  const type = simpleConfig.type;
  const credentialRef = simpleConfig.credentialRef || `OMNISAGE_${deptKey.toUpperCase()}_${type.toUpperCase()}`;
  
  // Build type-specific config
  let config: any;
  
  switch (type) {
    case 'slack':
      config = {
        type: 'slack',
        token: env[`${credentialRef}_TOKEN`] || env.SLACK_BOT_TOKEN || '',
        channelId: simpleConfig.id,
        signingSecret: env[`${credentialRef}_SIGNING_SECRET`],
      };
      break;
    
    case 'teams':
      config = {
        type: 'teams',
        appId: env[`${credentialRef}_APP_ID`] || env.TEAMS_APP_ID || '',
        appPassword: env[`${credentialRef}_APP_PASSWORD`] || env.TEAMS_APP_PASSWORD || '',
        channelId: simpleConfig.id,
        serviceUrl: env[`${credentialRef}_SERVICE_URL`],
      };
      break;
    
    case 'discord':
      config = {
        type: 'discord',
        token: env[`${credentialRef}_TOKEN`] || env.DISCORD_BOT_TOKEN || '',
        channelId: simpleConfig.id,
        guildId: simpleConfig.guildId,
      };
      break;
    
    case 'email':
      config = {
        type: 'email',
        address: simpleConfig.address,
        imap: {
          host: env[`${credentialRef}_IMAP_HOST`] || env.EMAIL_IMAP_HOST || '',
          port: parseInt(env[`${credentialRef}_IMAP_PORT`] || env.EMAIL_IMAP_PORT || '993'),
          user: env[`${credentialRef}_IMAP_USER`] || env.EMAIL_IMAP_USER || simpleConfig.address,
          password: env[`${credentialRef}_IMAP_PASSWORD`] || env.EMAIL_IMAP_PASSWORD || '',
          tls: (env[`${credentialRef}_IMAP_TLS`] || env.EMAIL_IMAP_TLS || 'true') === 'true',
        },
        smtp: {
          host: env[`${credentialRef}_SMTP_HOST`] || env.EMAIL_SMTP_HOST || '',
          port: parseInt(env[`${credentialRef}_SMTP_PORT`] || env.EMAIL_SMTP_PORT || '587'),
          user: env[`${credentialRef}_SMTP_USER`] || env.EMAIL_SMTP_USER || simpleConfig.address,
          password: env[`${credentialRef}_SMTP_PASSWORD`] || env.EMAIL_SMTP_PASSWORD || '',
          tls: (env[`${credentialRef}_SMTP_TLS`] || env.EMAIL_SMTP_TLS || 'true') === 'true',
        },
      };
      break;
    
    case 'telegram':
      config = {
        type: 'telegram',
        token: env[`${credentialRef}_TOKEN`] || env.TELEGRAM_BOT_TOKEN || '',
        chatId: simpleConfig.id,
      };
      break;
    
    case 'webhook':
      config = {
        type: 'webhook',
        url: simpleConfig.url,
        headers: simpleConfig.headers,
        listenPath: simpleConfig.listenPath,
        secret: env[`${credentialRef}_SECRET`] || env.WEBHOOK_SECRET,
      };
      break;
    
    default:
      throw new Error(`Unsupported channel type: ${type}`);
  }
  
  return {
    type,
    config,
    name: simpleConfig.name,
  };
}

/**
 * Generate internal workspace configuration from department config.
 */
export function departmentToWorkspaceConfig(
  deptKey: string,
  dept: DepartmentConfig,
  orgConfig: OmniSageConfig['organization']
): any {
  // TODO: Full workspace config generation
  // This would create the internal OpenClaw workspace structure
  
  return {
    id: `ws-${deptKey}`,
    name: dept.name,
    agentTemplate: dept.agent,
    channel: expandChannelConfig(dept.channel, deptKey),
    members: dept.members,
    organization: {
      name: orgConfig.name,
      timezone: orgConfig.timezone,
    },
    // Additional workspace settings...
  };
}
