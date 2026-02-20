/**
 * Role Hierarchy Tests
 */

import { describe, it, expect } from 'vitest';
import {
  getRoleLevel,
  roleIncludes,
  getImpliedRoles,
  getHighestRole,
  hasRoleOrHigher,
  getEffectiveRoles,
  type UserRole,
} from './role-hierarchy.js';

describe('Role Hierarchy', () => {
  describe('getRoleLevel', () => {
    it('should return correct levels for org roles', () => {
      expect(getRoleLevel('org:owner')).toBe(3);
      expect(getRoleLevel('org:admin')).toBe(2);
      expect(getRoleLevel('org:member')).toBe(1);
    });

    it('should return correct levels for workspace roles', () => {
      expect(getRoleLevel('ws:admin')).toBe(3);
      expect(getRoleLevel('ws:member')).toBe(2);
      expect(getRoleLevel('ws:viewer')).toBe(1);
    });
  });

  describe('roleIncludes', () => {
    it('should return true when role A includes role B', () => {
      expect(roleIncludes('org:owner', 'org:admin')).toBe(true);
      expect(roleIncludes('org:owner', 'org:member')).toBe(true);
      expect(roleIncludes('org:admin', 'org:member')).toBe(true);
    });

    it('should return false when role A does not include role B', () => {
      expect(roleIncludes('org:member', 'org:admin')).toBe(false);
      expect(roleIncludes('org:admin', 'org:owner')).toBe(false);
    });

    it('should return false for cross-scope comparisons', () => {
      expect(roleIncludes('org:owner', 'ws:admin')).toBe(false);
      expect(roleIncludes('ws:admin', 'org:member')).toBe(false);
    });

    it('should return true when comparing same role', () => {
      expect(roleIncludes('org:admin', 'org:admin')).toBe(true);
      expect(roleIncludes('ws:member', 'ws:member')).toBe(true);
    });
  });

  describe('getImpliedRoles', () => {
    it('should return all implied org roles', () => {
      expect(getImpliedRoles('org:owner')).toEqual([
        'org:owner',
        'org:admin',
        'org:member',
      ]);
      expect(getImpliedRoles('org:admin')).toEqual(['org:admin', 'org:member']);
      expect(getImpliedRoles('org:member')).toEqual(['org:member']);
    });

    it('should return all implied workspace roles', () => {
      expect(getImpliedRoles('ws:admin')).toEqual([
        'ws:admin',
        'ws:member',
        'ws:viewer',
      ]);
      expect(getImpliedRoles('ws:member')).toEqual(['ws:member', 'ws:viewer']);
      expect(getImpliedRoles('ws:viewer')).toEqual(['ws:viewer']);
    });
  });

  describe('getHighestRole', () => {
    it('should return the highest role in scope', () => {
      const roles: UserRole[] = [
        {
          userId: 'user1',
          role: 'org:member',
          scope: 'org1',
          grantedAt: new Date(),
          grantedBy: 'admin',
        },
        {
          userId: 'user1',
          role: 'org:admin',
          scope: 'org1',
          grantedAt: new Date(),
          grantedBy: 'admin',
        },
      ];

      expect(getHighestRole(roles, 'org1')).toBe('org:admin');
    });

    it('should return null if no roles in scope', () => {
      const roles: UserRole[] = [
        {
          userId: 'user1',
          role: 'org:member',
          scope: 'org1',
          grantedAt: new Date(),
          grantedBy: 'admin',
        },
      ];

      expect(getHighestRole(roles, 'org2')).toBe(null);
    });

    it('should consider wildcard scope', () => {
      const roles: UserRole[] = [
        {
          userId: 'user1',
          role: 'org:owner',
          scope: '*',
          grantedAt: new Date(),
          grantedBy: 'system',
        },
      ];

      expect(getHighestRole(roles, 'org1')).toBe('org:owner');
    });
  });

  describe('hasRoleOrHigher', () => {
    it('should return true when user has exact role', () => {
      const roles: UserRole[] = [
        {
          userId: 'user1',
          role: 'org:admin',
          scope: 'org1',
          grantedAt: new Date(),
          grantedBy: 'admin',
        },
      ];

      expect(hasRoleOrHigher(roles, 'org:admin', 'org1')).toBe(true);
    });

    it('should return true when user has higher role', () => {
      const roles: UserRole[] = [
        {
          userId: 'user1',
          role: 'org:owner',
          scope: 'org1',
          grantedAt: new Date(),
          grantedBy: 'admin',
        },
      ];

      expect(hasRoleOrHigher(roles, 'org:admin', 'org1')).toBe(true);
      expect(hasRoleOrHigher(roles, 'org:member', 'org1')).toBe(true);
    });

    it('should return false when user has lower role', () => {
      const roles: UserRole[] = [
        {
          userId: 'user1',
          role: 'org:member',
          scope: 'org1',
          grantedAt: new Date(),
          grantedBy: 'admin',
        },
      ];

      expect(hasRoleOrHigher(roles, 'org:admin', 'org1')).toBe(false);
    });
  });

  describe('getEffectiveRoles', () => {
    it('should include workspace-specific roles', () => {
      const roles: UserRole[] = [
        {
          userId: 'user1',
          role: 'ws:member',
          scope: 'ws1',
          grantedAt: new Date(),
          grantedBy: 'admin',
        },
      ];

      const effective = getEffectiveRoles(roles, 'ws1', 'org1');
      expect(effective).toContain('ws:member');
      expect(effective).toContain('ws:viewer');
    });

    it('should grant workspace admin to org owners', () => {
      const roles: UserRole[] = [
        {
          userId: 'user1',
          role: 'org:owner',
          scope: 'org1',
          grantedAt: new Date(),
          grantedBy: 'system',
        },
      ];

      const effective = getEffectiveRoles(roles, 'ws1', 'org1');
      expect(effective).toContain('ws:admin');
      expect(effective).toContain('ws:member');
      expect(effective).toContain('ws:viewer');
    });

    it('should grant workspace admin to org admins', () => {
      const roles: UserRole[] = [
        {
          userId: 'user1',
          role: 'org:admin',
          scope: 'org1',
          grantedAt: new Date(),
          grantedBy: 'owner',
        },
      ];

      const effective = getEffectiveRoles(roles, 'ws1', 'org1');
      expect(effective).toContain('ws:admin');
    });

    it('should not grant workspace access to org members', () => {
      const roles: UserRole[] = [
        {
          userId: 'user1',
          role: 'org:member',
          scope: 'org1',
          grantedAt: new Date(),
          grantedBy: 'admin',
        },
      ];

      const effective = getEffectiveRoles(roles, 'ws1', 'org1');
      expect(effective).not.toContain('ws:admin');
      expect(effective).not.toContain('ws:member');
    });
  });
});
