/**
 * Audit Integration
 *
 * Logs all RBAC access decisions to the audit system.
 * Provides visibility into who accessed what and why.
 */

import type { ResourceType, ActionType, AccessDecision } from './index.js';
import type { AuditEvent, AuditAction } from '../audit/index.js';

interface AccessLogEntry {
  userId: string;
  orgId: string;
  workspaceId?: string;
  resource: ResourceType;
  action: ActionType;
  scope: string;
  decision: AccessDecision;
  policyId?: string;
  latencyMs: number;
}

/**
 * Audit event store (in-memory buffer, TODO: Replace with persistent storage)
 */
class AuditEventBuffer {
  private events: AuditEvent[] = [];
  private maxSize: number = 10000;

  add(event: AuditEvent): void {
    this.events.push(event);
    
    // Trim if exceeds max size
    if (this.events.length > this.maxSize) {
      this.events = this.events.slice(-this.maxSize);
    }
  }

  getRecent(limit: number = 100): AuditEvent[] {
    return this.events.slice(-limit);
  }

  query(filter: {
    userId?: string;
    resource?: ResourceType;
    granted?: boolean;
    startTime?: Date;
  }): AuditEvent[] {
    return this.events.filter(event => {
      if (filter.userId && event.userId !== filter.userId) return false;
      if (filter.resource && event.metadata.resource !== filter.resource) return false;
      if (filter.granted !== undefined) {
        const granted = event.result === 'success';
        if (granted !== filter.granted) return false;
      }
      if (filter.startTime && event.timestamp < filter.startTime) return false;
      return true;
    });
  }

  clear(): void {
    this.events = [];
  }
}

const auditBuffer = new AuditEventBuffer();

/**
 * Log an access decision to the audit system
 */
export async function logAccessDecision(entry: AccessLogEntry): Promise<void> {
  const event: AuditEvent = {
    id: generateEventId(),
    timestamp: new Date(),
    orgId: entry.orgId,
    workspaceId: entry.workspaceId || '',
    userId: entry.userId,
    agentId: 'rbac-engine',
    sessionId: 'rbac',
    action: mapToAuditAction(entry.action),
    parameters: {
      resource: entry.resource,
      action: entry.action,
      scope: entry.scope,
      policyId: entry.policyId,
    },
    result: entry.decision.granted ? 'success' : 'denied',
    errorMessage: entry.decision.granted ? undefined : entry.decision.reason,
    approval: entry.decision.approvalRequired
      ? { required: true }
      : undefined,
    metadata: {
      latencyMs: entry.latencyMs,
      resource: entry.resource,
      accessReason: entry.decision.reason,
    },
  };

  auditBuffer.add(event);

  // TODO: Persist to database or external audit service
  // For now, just console log in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[RBAC Audit]', {
      user: entry.userId,
      resource: entry.resource,
      action: entry.action,
      granted: entry.decision.granted,
      reason: entry.decision.reason,
    });
  }
}

/**
 * Log an approval action
 */
export async function logApprovalAction(
  userId: string,
  orgId: string,
  workspaceId: string | undefined,
  approvalId: string,
  action: 'approve' | 'deny',
  reason?: string
): Promise<void> {
  const event: AuditEvent = {
    id: generateEventId(),
    timestamp: new Date(),
    orgId,
    workspaceId: workspaceId || '',
    userId,
    agentId: 'rbac-engine',
    sessionId: 'rbac',
    action: action === 'approve' ? 'approval_granted' : 'approval_denied',
    parameters: {
      approvalId,
      reason,
    },
    result: 'success',
    metadata: {},
  };

  auditBuffer.add(event);
}

/**
 * Query audit events
 */
export function queryAccessAudit(filter: {
  userId?: string;
  resource?: ResourceType;
  granted?: boolean;
  startTime?: Date;
  limit?: number;
}): AuditEvent[] {
  const results = auditBuffer.query(filter);
  const limit = filter.limit || 100;
  return results.slice(-limit);
}

/**
 * Get recent access denials for security monitoring
 */
export function getRecentDenials(limit: number = 50): AuditEvent[] {
  return auditBuffer.query({ granted: false }).slice(-limit);
}

/**
 * Clear audit buffer (for testing)
 */
export function clearAuditBuffer(): void {
  auditBuffer.clear();
}

/**
 * Map RBAC action to audit action type
 */
function mapToAuditAction(action: ActionType): AuditAction {
  switch (action) {
    case 'create':
    case 'update':
    case 'delete':
      return 'config_changed';
    case 'read':
      return 'memory_read';
    case 'execute':
      return 'tool_call';
    default:
      return 'tool_call';
  }
}

/**
 * Generate a unique event ID
 */
function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
