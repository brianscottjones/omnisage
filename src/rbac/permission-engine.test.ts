/**
 * Permission Engine Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PermissionEngine, type PermissionContext } from './permission-engine.js';
import type { UserRole } from './role-hierarchy.js';
import type { PolicyRule } from './index.js';
import { clearAuditBuffer } from './audit-integration.js';

describe('PermissionEngine', () => {
  let engine: PermissionEngine;

  beforeEach(() => {
    engine = new PermissionEngine();
    clearAuditBuffer();
  });

  afterEach(() => {
    engine.clearCache();
  });

  describe('checkPermission - default permissions', () => {
    it('should grant org:owner full access', async () => {
      const context: PermissionContext = {
        userId: 'user1',
        orgId: 'org1',
        workspaceId: 'ws1',
        userRoles: [
          {
            userId: 'user1',
            role: 'org:owner',
            scope: 'org1',
            grantedAt: new Date(),
            grantedBy: 'system',
          },
        ],
      };

      const decision = await engine.checkPermission(
        context,
        'workspace',
        'delete',
        'org1'
      );

      expect(decision.granted).toBe(true);
      expect(decision.approvalRequired).toBe(false);
    });

    it('should grant org:admin workspace management', async () => {
      const context: PermissionContext = {
        userId: 'user1',
        orgId: 'org1',
        userRoles: [
          {
            userId: 'user1',
            role: 'org:admin',
            scope: 'org1',
            grantedAt: new Date(),
            grantedBy: 'owner',
          },
        ],
      };

      const decision = await engine.checkPermission(
        context,
        'workspace',
        'create',
        'org1'
      );

      expect(decision.granted).toBe(true);
    });

    it('should deny org:member workspace creation', async () => {
      const context: PermissionContext = {
        userId: 'user1',
        orgId: 'org1',
        userRoles: [
          {
            userId: 'user1',
            role: 'org:member',
            scope: 'org1',
            grantedAt: new Date(),
            grantedBy: 'admin',
          },
        ],
      };

      const decision = await engine.checkPermission(
        context,
        'workspace',
        'create'
      );

      expect(decision.granted).toBe(false);
    });

    it('should grant ws:admin tool execution', async () => {
      const context: PermissionContext = {
        userId: 'user1',
        orgId: 'org1',
        workspaceId: 'ws1',
        userRoles: [
          {
            userId: 'user1',
            role: 'ws:admin',
            scope: 'ws1',
            grantedAt: new Date(),
            grantedBy: 'owner',
          },
        ],
      };

      const decision = await engine.checkPermission(
        context,
        'tool',
        'execute',
        'ws1'
      );

      expect(decision.granted).toBe(true);
    });

    it('should allow ws:member to execute tools', async () => {
      const context: PermissionContext = {
        userId: 'user1',
        orgId: 'org1',
        workspaceId: 'ws1',
        userRoles: [
          {
            userId: 'user1',
            role: 'ws:member',
            scope: 'ws1',
            grantedAt: new Date(),
            grantedBy: 'admin',
          },
        ],
      };

      const decision = await engine.checkPermission(
        context,
        'tool',
        'execute',
        'ws1'
      );

      expect(decision.granted).toBe(true);
    });

    it('should deny ws:viewer tool execution', async () => {
      const context: PermissionContext = {
        userId: 'user1',
        orgId: 'org1',
        workspaceId: 'ws1',
        userRoles: [
          {
            userId: 'user1',
            role: 'ws:viewer',
            scope: 'ws1',
            grantedAt: new Date(),
            grantedBy: 'admin',
          },
        ],
      };

      const decision = await engine.checkPermission(
        context,
        'tool',
        'execute',
        'ws1'
      );

      expect(decision.granted).toBe(false);
    });
  });

  describe('checkPermission - custom policies', () => {
    it('should grant access based on custom policy', async () => {
      const policies: PolicyRule[] = [
        {
          id: 'policy1',
          name: 'Allow viewers to execute safe tools',
          description: 'Grant tool execution to viewers',
          roles: ['ws:viewer'],
          permissions: [
            {
              resource: 'tool',
              action: 'execute',
              scope: 'ws1',
            },
          ],
          approvalRequired: false,
        },
      ];

      const context: PermissionContext = {
        userId: 'user1',
        orgId: 'org1',
        workspaceId: 'ws1',
        userRoles: [
          {
            userId: 'user1',
            role: 'ws:viewer',
            scope: 'ws1',
            grantedAt: new Date(),
            grantedBy: 'admin',
          },
        ],
        policies,
      };

      const decision = await engine.checkPermission(
        context,
        'tool',
        'execute',
        'ws1'
      );

      expect(decision.granted).toBe(true);
      expect(decision.policyId).toBe('policy1');
    });

    it('should require approval when policy specifies', async () => {
      const policies: PolicyRule[] = [
        {
          id: 'policy2',
          name: 'Integration access requires approval',
          description: 'Members can access integrations with approval',
          roles: ['ws:member'],
          permissions: [
            {
              resource: 'integration',
              action: 'read',
              scope: 'ws1',
            },
          ],
          approvalRequired: true,
        },
      ];

      const context: PermissionContext = {
        userId: 'user1',
        orgId: 'org1',
        workspaceId: 'ws1',
        userRoles: [
          {
            userId: 'user1',
            role: 'ws:member',
            scope: 'ws1',
            grantedAt: new Date(),
            grantedBy: 'admin',
          },
        ],
        policies,
      };

      const decision = await engine.checkPermission(
        context,
        'integration',
        'read',
        'ws1'
      );

      expect(decision.granted).toBe(true);
      expect(decision.approvalRequired).toBe(true);
    });
  });

  describe('checkPermissions - batch', () => {
    it('should check multiple permissions at once', async () => {
      const context: PermissionContext = {
        userId: 'user1',
        orgId: 'org1',
        workspaceId: 'ws1',
        userRoles: [
          {
            userId: 'user1',
            role: 'ws:admin',
            scope: 'ws1',
            grantedAt: new Date(),
            grantedBy: 'owner',
          },
        ],
      };

      const decisions = await engine.checkPermissions(context, [
        { resource: 'agent', action: 'create', scope: 'ws1' },
        { resource: 'agent', action: 'read', scope: 'ws1' },
        { resource: 'memory', action: 'update', scope: 'ws1' },
      ]);

      expect(decisions).toHaveLength(3);
      expect(decisions.every(d => d.granted)).toBe(true);
    });
  });

  describe('caching', () => {
    it('should cache permission decisions', async () => {
      const context: PermissionContext = {
        userId: 'user1',
        orgId: 'org1',
        workspaceId: 'ws1',
        userRoles: [
          {
            userId: 'user1',
            role: 'ws:admin',
            scope: 'ws1',
            grantedAt: new Date(),
            grantedBy: 'owner',
          },
        ],
      };

      // First call - cache miss
      const decision1 = await engine.checkPermission(
        context,
        'agent',
        'create',
        'ws1'
      );

      // Second call - should hit cache
      const decision2 = await engine.checkPermission(
        context,
        'agent',
        'create',
        'ws1'
      );

      expect(decision1.granted).toBe(decision2.granted);
    });

    it('should clear cache', async () => {
      const context: PermissionContext = {
        userId: 'user1',
        orgId: 'org1',
        workspaceId: 'ws1',
        userRoles: [
          {
            userId: 'user1',
            role: 'ws:admin',
            scope: 'ws1',
            grantedAt: new Date(),
            grantedBy: 'owner',
          },
        ],
      };

      await engine.checkPermission(context, 'agent', 'create', 'ws1');
      engine.clearCache();
      
      // After clear, should work normally
      const decision = await engine.checkPermission(
        context,
        'agent',
        'create',
        'ws1'
      );
      
      expect(decision.granted).toBe(true);
    });
  });
});
