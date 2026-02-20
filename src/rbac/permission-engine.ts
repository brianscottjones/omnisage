/**
 * Permission Evaluation Engine
 *
 * Evaluates whether a user has permission to perform an action on a resource.
 * Integrates with role hierarchy and policy rules.
 */

import type {
  Permission,
  ResourceType,
  ActionType,
  PolicyRule,
  AccessDecision,
} from './index.js';
import type { UserRole, Role } from './role-hierarchy.js';
import { getEffectiveRoles, hasRoleOrHigher } from './role-hierarchy.js';
import { logAccessDecision } from './audit-integration.js';
import { PolicyCache } from './policy-cache.js';

/**
 * Default permissions by role
 */
const DEFAULT_PERMISSIONS: Record<string, Permission[]> = {
  'org:owner': [
    { resource: '*' as ResourceType, action: '*' as ActionType, scope: '*' },
  ],
  'org:admin': [
    { resource: 'workspace', action: 'create', scope: '*' },
    { resource: 'workspace', action: 'read', scope: '*' },
    { resource: 'workspace', action: 'update', scope: '*' },
    { resource: 'user', action: 'create', scope: '*' },
    { resource: 'user', action: 'read', scope: '*' },
    { resource: 'user', action: 'update', scope: '*' },
    { resource: 'audit', action: 'read', scope: '*' },
  ],
  'org:member': [
    { resource: 'workspace', action: 'read', scope: '*' },
  ],
  'ws:admin': [
    { resource: 'agent', action: 'create', scope: 'workspace' },
    { resource: 'agent', action: 'read', scope: 'workspace' },
    { resource: 'agent', action: 'update', scope: 'workspace' },
    { resource: 'agent', action: 'delete', scope: 'workspace' },
    { resource: 'memory', action: 'read', scope: 'workspace' },
    { resource: 'memory', action: 'update', scope: 'workspace' },
    { resource: 'integration', action: 'create', scope: 'workspace' },
    { resource: 'integration', action: 'read', scope: 'workspace' },
    { resource: 'integration', action: 'update', scope: 'workspace' },
    { resource: 'tool', action: 'execute', scope: 'workspace' },
  ],
  'ws:member': [
    { resource: 'agent', action: 'read', scope: 'workspace' },
    { resource: 'agent', action: 'execute', scope: 'workspace' },
    { resource: 'memory', action: 'read', scope: 'workspace' },
    { resource: 'tool', action: 'execute', scope: 'workspace' },
  ],
  'ws:viewer': [
    { resource: 'agent', action: 'read', scope: 'workspace' },
    { resource: 'memory', action: 'read', scope: 'workspace' },
  ],
};

export interface PermissionContext {
  userId: string;
  orgId: string;
  workspaceId?: string;
  userRoles: UserRole[];
  policies?: PolicyRule[];
}

export class PermissionEngine {
  private policyCache: PolicyCache;

  constructor(cacheTtlMs: number = 60000) {
    this.policyCache = new PolicyCache(cacheTtlMs);
  }

  /**
   * Check if a user has permission to perform an action
   */
  async checkPermission(
    context: PermissionContext,
    resource: ResourceType,
    action: ActionType,
    targetScope?: string
  ): Promise<AccessDecision> {
    const scope = targetScope || context.workspaceId || context.orgId;
    const startTime = Date.now();

    // Get effective roles
    const effectiveRoles = getEffectiveRoles(
      context.userRoles,
      context.workspaceId || '',
      context.orgId
    );

    // Check default permissions first
    const hasDefaultPermission = this.checkDefaultPermissions(
      effectiveRoles,
      resource,
      action,
      scope
    );

    if (hasDefaultPermission) {
      const decision: AccessDecision = {
        granted: true,
        approvalRequired: false,
        reason: 'Granted by role permissions',
      };

      await logAccessDecision({
        userId: context.userId,
        orgId: context.orgId,
        workspaceId: context.workspaceId,
        resource,
        action,
        scope,
        decision,
        latencyMs: Date.now() - startTime,
      });

      return decision;
    }

    // Check policy rules
    if (context.policies && context.policies.length > 0) {
      const policyDecision = await this.checkPolicies(
        context.policies,
        effectiveRoles,
        resource,
        action,
        scope
      );

      await logAccessDecision({
        userId: context.userId,
        orgId: context.orgId,
        workspaceId: context.workspaceId,
        resource,
        action,
        scope,
        decision: policyDecision,
        policyId: policyDecision.policyId,
        latencyMs: Date.now() - startTime,
      });

      return policyDecision;
    }

    // Default deny
    const decision: AccessDecision = {
      granted: false,
      approvalRequired: false,
      reason: 'No matching permissions found',
    };

    await logAccessDecision({
      userId: context.userId,
      orgId: context.orgId,
      workspaceId: context.workspaceId,
      resource,
      action,
      scope,
      decision,
      latencyMs: Date.now() - startTime,
    });

    return decision;
  }

  /**
   * Check default role-based permissions
   */
  private checkDefaultPermissions(
    roles: Role[],
    resource: ResourceType,
    action: ActionType,
    scope: string
  ): boolean {
    for (const role of roles) {
      const permissions = DEFAULT_PERMISSIONS[role] || [];
      
      for (const perm of permissions) {
        // Wildcard permissions
        if (perm.resource === '*' && perm.action === '*') {
          return true;
        }
        
        // Resource match
        const resourceMatch = perm.resource === resource || perm.resource === '*';
        const actionMatch = perm.action === action || perm.action === '*';
        const scopeMatch = perm.scope === '*' || perm.scope === scope || perm.scope === 'workspace';
        
        if (resourceMatch && actionMatch && scopeMatch) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Check custom policy rules
   */
  private async checkPolicies(
    policies: PolicyRule[],
    userRoles: Role[],
    resource: ResourceType,
    action: ActionType,
    scope: string
  ): Promise<AccessDecision> {
    // Check cache first
    const cacheKey = `${userRoles.join(',')}-${resource}-${action}-${scope}`;
    const cached = this.policyCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    for (const policy of policies) {
      // Check if any of the user's roles match the policy
      const roleMatches = policy.roles.some(policyRole =>
        userRoles.includes(policyRole as Role)
      );

      if (!roleMatches) continue;

      // Check if the policy grants this permission
      for (const perm of policy.permissions) {
        const resourceMatch = perm.resource === resource || perm.resource === '*';
        const actionMatch = perm.action === action || perm.action === '*';
        const scopeMatch = perm.scope === '*' || perm.scope === scope;

        if (resourceMatch && actionMatch && scopeMatch) {
          const decision: AccessDecision = {
            granted: true,
            approvalRequired: policy.approvalRequired,
            reason: policy.approvalRequired
              ? 'Granted with approval required'
              : `Granted by policy: ${policy.name}`,
            policyId: policy.id,
          };

          this.policyCache.set(cacheKey, decision);
          return decision;
        }
      }
    }

    const decision: AccessDecision = {
      granted: false,
      approvalRequired: false,
      reason: 'No matching policy found',
    };

    this.policyCache.set(cacheKey, decision);
    return decision;
  }

  /**
   * Clear the policy cache
   */
  clearCache(): void {
    this.policyCache.clear();
  }

  /**
   * Batch permission check for multiple resources
   */
  async checkPermissions(
    context: PermissionContext,
    checks: Array<{ resource: ResourceType; action: ActionType; scope?: string }>
  ): Promise<AccessDecision[]> {
    return Promise.all(
      checks.map(check =>
        this.checkPermission(context, check.resource, check.action, check.scope)
      )
    );
  }
}
