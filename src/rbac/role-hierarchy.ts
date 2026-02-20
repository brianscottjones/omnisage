/**
 * Role Hierarchy Resolution
 *
 * Defines the hierarchy of roles within organizations and workspaces.
 * Higher roles inherit permissions from lower roles.
 */

export type OrgRole = 'org:owner' | 'org:admin' | 'org:member';
export type WorkspaceRole = 'ws:admin' | 'ws:member' | 'ws:viewer';
export type Role = OrgRole | WorkspaceRole;

export interface UserRole {
  userId: string;
  role: Role;
  scope: string; // orgId or workspaceId
  grantedAt: Date;
  grantedBy: string;
}

/**
 * Org hierarchy: org:owner > org:admin > org:member
 */
const ORG_HIERARCHY: Record<OrgRole, number> = {
  'org:owner': 3,
  'org:admin': 2,
  'org:member': 1,
};

/**
 * Workspace hierarchy: ws:admin > ws:member > ws:viewer
 */
const WS_HIERARCHY: Record<WorkspaceRole, number> = {
  'ws:admin': 3,
  'ws:member': 2,
  'ws:viewer': 1,
};

/**
 * Get the numeric level of a role (higher = more privilege)
 */
export function getRoleLevel(role: Role): number {
  if (role.startsWith('org:')) {
    return ORG_HIERARCHY[role as OrgRole] || 0;
  }
  if (role.startsWith('ws:')) {
    return WS_HIERARCHY[role as WorkspaceRole] || 0;
  }
  return 0;
}

/**
 * Check if role A has at least as much privilege as role B
 */
export function roleIncludes(roleA: Role, roleB: Role): boolean {
  // Different scopes (org vs workspace) can't be compared directly
  if (roleA.startsWith('org:') !== roleB.startsWith('org:')) {
    return false;
  }
  return getRoleLevel(roleA) >= getRoleLevel(roleB);
}

/**
 * Get all roles implied by the given role (including itself)
 * Example: org:owner implies [org:owner, org:admin, org:member]
 */
export function getImpliedRoles(role: Role): Role[] {
  const level = getRoleLevel(role);
  
  if (role.startsWith('org:')) {
    const orgRoles: OrgRole[] = ['org:owner', 'org:admin', 'org:member'];
    return orgRoles.filter(r => ORG_HIERARCHY[r] <= level);
  }
  
  if (role.startsWith('ws:')) {
    const wsRoles: WorkspaceRole[] = ['ws:admin', 'ws:member', 'ws:viewer'];
    return wsRoles.filter(r => WS_HIERARCHY[r] <= level);
  }
  
  return [role];
}

/**
 * Find the highest role a user has in a given scope
 */
export function getHighestRole(roles: UserRole[], scope: string): Role | null {
  const applicableRoles = roles.filter(r => r.scope === scope || r.scope === '*');
  
  if (applicableRoles.length === 0) {
    return null;
  }
  
  return applicableRoles.reduce((highest, current) => {
    if (!highest) return current.role;
    return getRoleLevel(current.role) > getRoleLevel(highest) ? current.role : highest;
  }, null as Role | null);
}

/**
 * Check if a user has a specific role (or higher) in a scope
 */
export function hasRoleOrHigher(
  userRoles: UserRole[],
  requiredRole: Role,
  scope: string
): boolean {
  const highestRole = getHighestRole(userRoles, scope);
  if (!highestRole) return false;
  return roleIncludes(highestRole, requiredRole);
}

/**
 * Get all effective roles for a user (including org-level roles that grant workspace access)
 */
export function getEffectiveRoles(
  userRoles: UserRole[],
  workspaceId: string,
  orgId: string
): Role[] {
  const roles = new Set<Role>();
  
  // Add org-level roles and their implications
  const orgRole = getHighestRole(userRoles, orgId);
  if (orgRole) {
    getImpliedRoles(orgRole).forEach(implied => roles.add(implied));
    
    // Org owners and admins have implicit workspace admin access
    if (orgRole === 'org:owner' || orgRole === 'org:admin') {
      roles.add('ws:admin');
      roles.add('ws:member');
      roles.add('ws:viewer');
    }
  }
  
  // Add workspace-specific roles
  userRoles
    .filter(r => r.scope === workspaceId)
    .forEach(r => {
      getImpliedRoles(r.role).forEach(implied => roles.add(implied));
    });
  
  return Array.from(roles);
}
