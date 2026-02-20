/**
 * OmniSage Simplified Configuration Types
 * 
 * Business-friendly configuration format.
 * Loaded from omnisage.config.yaml at startup.
 */

import type { ChannelType } from '../../channels/abstractions/types.js';

/**
 * Top-level OmniSage configuration.
 */
export interface OmniSageConfig {
  /** Organization-level settings */
  organization: OrganizationConfig;
  
  /** Department configurations */
  departments: Record<string, DepartmentConfig>;
  
  /** Optional: shared integrations available to all departments */
  integrations?: IntegrationsConfig;
  
  /** Optional: global policies and settings */
  policies?: PoliciesConfig;
}

export interface OrganizationConfig {
  /** Organization name */
  name: string;
  
  /** Primary timezone (e.g., "America/Chicago") */
  timezone: string;
  
  /** Optional: organization ID for multi-tenant deployments */
  id?: string;
  
  /** Optional: admin contact email */
  adminEmail?: string;
}

export interface DepartmentConfig {
  /** Department display name */
  name: string;
  
  /** Channel configuration - simple inline format */
  channel: ChannelConfigSimple;
  
  /** Agent template to use (references src/agents/templates/*.yaml) */
  agent: string;
  
  /** Department members (emails) */
  members?: string[];
  
  /** Optional: department-specific integrations */
  integrations?: string[];
  
  /** Optional: custom agent settings (overrides template) */
  agentConfig?: {
    model?: string;
    personalityOverride?: string;
    tools?: {
      allow?: string[];
      deny?: string[];
    };
  };
}

/**
 * Simplified channel config for YAML readability.
 * Gets expanded to full ChannelConfig internally.
 */
export interface ChannelConfigSimple {
  /** Channel type */
  type: ChannelType;
  
  /** Platform-specific identifier */
  id?: string;
  
  /** For email channels */
  address?: string;
  
  /** For webhook channels */
  url?: string;
  
  /** Display name */
  name?: string;
  
  /** Reference to credential in .env or secrets manager */
  credentialRef?: string;
}

export interface IntegrationsConfig {
  /** CRM configuration */
  crm?: {
    provider: 'salesforce' | 'hubspot' | 'pipedrive';
    credentialRef: string;
  };
  
  /** Email service */
  email?: {
    provider: 'gmail' | 'outlook' | 'smtp';
    credentialRef: string;
  };
  
  /** Calendar service */
  calendar?: {
    provider: 'google' | 'microsoft' | 'caldav';
    credentialRef: string;
  };
  
  /** Ticketing system */
  ticketing?: {
    provider: 'zendesk' | 'freshdesk' | 'linear';
    credentialRef: string;
  };
  
  /** Finance/accounting */
  finance?: {
    provider: 'quickbooks' | 'xero' | 'stripe';
    credentialRef: string;
  };
  
  /** Knowledge base */
  knowledgeBase?: {
    provider: 'notion' | 'confluence' | 'gitbook';
    credentialRef: string;
  };
  
  /** Project management */
  projectManagement?: {
    provider: 'asana' | 'monday' | 'jira';
    credentialRef: string;
  };
}

export interface PoliciesConfig {
  /** Require approval for these action categories */
  requireApproval?: Array<'email_send' | 'crm_update' | 'payment' | 'file_delete' | 'all_writes'>;
  
  /** Default model for agents (can be overridden per department) */
  defaultModel?: string;
  
  /** Enable audit logging */
  auditEnabled?: boolean;
  
  /** Data retention period in days */
  dataRetentionDays?: number;
  
  /** Allow agents to share context across departments */
  crossDepartmentContext?: boolean;
}
