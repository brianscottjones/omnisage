/**
 * Approval Workflow State Machine
 *
 * Manages approval requests for permission-gated actions.
 * Supports single-approver and multi-approver workflows.
 */

import type { ResourceType, ActionType } from './index.js';

export type ApprovalState =
  | 'pending'
  | 'approved'
  | 'denied'
  | 'expired'
  | 'cancelled';

export type ApprovalType =
  | 'single' // Any one approver can approve
  | 'majority' // Majority of approvers must approve
  | 'unanimous' // All approvers must approve
  | 'sequential'; // Approvers must approve in order

export interface ApprovalRequest {
  id: string;
  userId: string; // User requesting permission
  orgId: string;
  workspaceId?: string;
  
  // What permission is being requested
  resource: ResourceType;
  action: ActionType;
  scope: string;
  context?: Record<string, unknown>; // Additional context for approvers
  
  // Workflow configuration
  type: ApprovalType;
  approvers: string[]; // User IDs who can approve
  requiredApprovals: number; // For majority type
  
  // State
  state: ApprovalState;
  createdAt: Date;
  expiresAt: Date;
  
  // Approval chain
  approvals: ApprovalAction[];
  
  // Metadata
  reason?: string;
  alertSent?: boolean;
  completedAt?: Date;
}

export interface ApprovalAction {
  approverId: string;
  action: 'approve' | 'deny';
  timestamp: Date;
  comment?: string;
}

export interface ApprovalWorkflowConfig {
  type: ApprovalType;
  approvers: string[];
  expirationMinutes: number;
  requiredApprovals?: number; // For majority type
  alertRecipients?: string[]; // Additional people to notify
}

/**
 * State machine for approval workflows
 */
export class ApprovalWorkflow {
  /**
   * Create a new approval request
   */
  static create(
    userId: string,
    orgId: string,
    resource: ResourceType,
    action: ActionType,
    scope: string,
    config: ApprovalWorkflowConfig,
    workspaceId?: string,
    context?: Record<string, unknown>
  ): ApprovalRequest {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.expirationMinutes * 60 * 1000);

    return {
      id: this.generateId(),
      userId,
      orgId,
      workspaceId,
      resource,
      action,
      scope,
      context,
      type: config.type,
      approvers: config.approvers,
      requiredApprovals: config.requiredApprovals || 1,
      state: 'pending',
      createdAt: now,
      expiresAt,
      approvals: [],
    };
  }

  /**
   * Process an approval or denial
   */
  static processAction(
    request: ApprovalRequest,
    approverId: string,
    action: 'approve' | 'deny',
    comment?: string
  ): ApprovalRequest {
    // Check if already completed
    if (request.state !== 'pending') {
      throw new Error(`Approval request is ${request.state}, cannot process action`);
    }

    // Check if expired
    if (new Date() > request.expiresAt) {
      return { ...request, state: 'expired' };
    }

    // Check if approver is authorized
    if (!request.approvers.includes(approverId)) {
      throw new Error('User is not authorized to approve this request');
    }

    // Check if already acted
    if (request.approvals.some(a => a.approverId === approverId)) {
      throw new Error('User has already acted on this request');
    }

    // Add the action
    const newApprovals = [
      ...request.approvals,
      {
        approverId,
        action,
        timestamp: new Date(),
        comment,
      },
    ];

    const updated = { ...request, approvals: newApprovals };

    // Update state based on workflow type
    return this.updateState(updated);
  }

  /**
   * Update approval state based on current approvals
   */
  private static updateState(request: ApprovalRequest): ApprovalRequest {
    const approvals = request.approvals.filter(a => a.action === 'approve');
    const denials = request.approvals.filter(a => a.action === 'deny');

    switch (request.type) {
      case 'single':
        if (approvals.length >= 1) {
          return { ...request, state: 'approved', completedAt: new Date() };
        }
        if (denials.length >= 1) {
          return { ...request, state: 'denied', completedAt: new Date() };
        }
        break;

      case 'majority':
        const required = request.requiredApprovals;
        if (approvals.length >= required) {
          return { ...request, state: 'approved', completedAt: new Date() };
        }
        const remaining = request.approvers.length - request.approvals.length;
        if (approvals.length + remaining < required) {
          return { ...request, state: 'denied', completedAt: new Date() };
        }
        break;

      case 'unanimous':
        if (denials.length >= 1) {
          return { ...request, state: 'denied', completedAt: new Date() };
        }
        if (approvals.length === request.approvers.length) {
          return { ...request, state: 'approved', completedAt: new Date() };
        }
        break;

      case 'sequential':
        if (denials.length >= 1) {
          return { ...request, state: 'denied', completedAt: new Date() };
        }
        // Check if approvals are in correct order
        for (let i = 0; i < approvals.length; i++) {
          if (approvals[i].approverId !== request.approvers[i]) {
            return { ...request, state: 'denied', completedAt: new Date() };
          }
        }
        if (approvals.length === request.approvers.length) {
          return { ...request, state: 'approved', completedAt: new Date() };
        }
        break;
    }

    return request;
  }

  /**
   * Cancel an approval request
   */
  static cancel(request: ApprovalRequest): ApprovalRequest {
    if (request.state !== 'pending') {
      throw new Error(`Cannot cancel request in state: ${request.state}`);
    }
    return { ...request, state: 'cancelled', completedAt: new Date() };
  }

  /**
   * Check if a request has expired
   */
  static checkExpiration(request: ApprovalRequest): ApprovalRequest {
    if (request.state === 'pending' && new Date() > request.expiresAt) {
      return { ...request, state: 'expired', completedAt: new Date() };
    }
    return request;
  }

  /**
   * Get the next approver in a sequential workflow
   */
  static getNextApprover(request: ApprovalRequest): string | null {
    if (request.type !== 'sequential') {
      return null;
    }
    const approvals = request.approvals.filter(a => a.action === 'approve');
    if (approvals.length >= request.approvers.length) {
      return null;
    }
    return request.approvers[approvals.length];
  }

  /**
   * Get pending approvers
   */
  static getPendingApprovers(request: ApprovalRequest): string[] {
    const actedUserIds = new Set(request.approvals.map(a => a.approverId));
    
    if (request.type === 'sequential') {
      const next = this.getNextApprover(request);
      return next ? [next] : [];
    }
    
    return request.approvers.filter(id => !actedUserIds.has(id));
  }

  private static generateId(): string {
    return `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * In-memory approval request store (TODO: Replace with persistent storage)
 */
export class ApprovalStore {
  private requests: Map<string, ApprovalRequest> = new Map();

  save(request: ApprovalRequest): void {
    this.requests.set(request.id, request);
  }

  get(id: string): ApprovalRequest | undefined {
    const request = this.requests.get(id);
    if (!request) return undefined;
    return ApprovalWorkflow.checkExpiration(request);
  }

  findByUser(userId: string, state?: ApprovalState): ApprovalRequest[] {
    return Array.from(this.requests.values())
      .filter(r => r.userId === userId && (!state || r.state === state))
      .map(r => ApprovalWorkflow.checkExpiration(r));
  }

  findPendingForApprover(approverId: string): ApprovalRequest[] {
    return Array.from(this.requests.values())
      .filter(r => r.state === 'pending' && r.approvers.includes(approverId))
      .map(r => ApprovalWorkflow.checkExpiration(r));
  }

  delete(id: string): void {
    this.requests.delete(id);
  }

  clear(): void {
    this.requests.clear();
  }
}
