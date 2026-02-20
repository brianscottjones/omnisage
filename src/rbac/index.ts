/**
 * OmniSage Role-Based Access Control (RBAC)
 *
 * Enforces permissions at every layer:
 * - Workspace access
 * - Tool execution
 * - Memory read/write
 * - Integration credentials
 * - Audit log access
 */

export interface Permission {
  resource: ResourceType;
  action: ActionType;
  scope: string; // workspace ID or '*' for org-wide
  conditions?: Record<string, unknown>;
}

export type ResourceType =
  | 'workspace'
  | 'agent'
  | 'memory'
  | 'integration'
  | 'audit'
  | 'user'
  | 'tool';

export type ActionType = 'create' | 'read' | 'update' | 'delete' | 'execute';

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  roles: string[]; // roles this rule applies to
  permissions: Permission[];
  approvalRequired: boolean;
  alertRecipients?: string[]; // user IDs to notify
}

/**
 * Check if a user has permission to perform an action.
 *
 * @param userId - The user requesting access
 * @param resource - The resource type being accessed
 * @param action - The action being performed
 * @param scope - The workspace ID (or '*' for org-level)
 * @returns Whether access is granted, and if approval is needed
 */
export interface AccessDecision {
  granted: boolean;
  approvalRequired: boolean;
  reason: string;
  policyId?: string;
}

// Export core modules
export * from './role-hierarchy.js';
export * from './permission-engine.js';
export * from './approval-workflow.js';
export * from './policy-cache.js';
export * from './audit-integration.js';
