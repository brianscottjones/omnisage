/**
 * Approval Workflow Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ApprovalWorkflow,
  ApprovalStore,
  type ApprovalWorkflowConfig,
  type ApprovalRequest,
} from './approval-workflow.js';

describe('ApprovalWorkflow', () => {
  let store: ApprovalStore;

  beforeEach(() => {
    store = new ApprovalStore();
  });

  describe('create', () => {
    it('should create a new approval request', () => {
      const config: ApprovalWorkflowConfig = {
        type: 'single',
        approvers: ['user1', 'user2'],
        expirationMinutes: 60,
      };

      const request = ApprovalWorkflow.create(
        'requester1',
        'org1',
        'integration',
        'read',
        'ws1',
        config,
        'ws1'
      );

      expect(request.userId).toBe('requester1');
      expect(request.resource).toBe('integration');
      expect(request.state).toBe('pending');
      expect(request.approvers).toEqual(['user1', 'user2']);
      expect(request.approvals).toHaveLength(0);
    });
  });

  describe('processAction - single approver', () => {
    it('should approve on first approval', () => {
      const config: ApprovalWorkflowConfig = {
        type: 'single',
        approvers: ['user1', 'user2'],
        expirationMinutes: 60,
      };

      let request = ApprovalWorkflow.create(
        'requester1',
        'org1',
        'integration',
        'read',
        'ws1',
        config
      );

      request = ApprovalWorkflow.processAction(
        request,
        'user1',
        'approve',
        'Looks good'
      );

      expect(request.state).toBe('approved');
      expect(request.approvals).toHaveLength(1);
      expect(request.approvals[0].approverId).toBe('user1');
    });

    it('should deny on first denial', () => {
      const config: ApprovalWorkflowConfig = {
        type: 'single',
        approvers: ['user1', 'user2'],
        expirationMinutes: 60,
      };

      let request = ApprovalWorkflow.create(
        'requester1',
        'org1',
        'integration',
        'read',
        'ws1',
        config
      );

      request = ApprovalWorkflow.processAction(
        request,
        'user1',
        'deny',
        'Not authorized'
      );

      expect(request.state).toBe('denied');
    });

    it('should reject unauthorized approver', () => {
      const config: ApprovalWorkflowConfig = {
        type: 'single',
        approvers: ['user1', 'user2'],
        expirationMinutes: 60,
      };

      const request = ApprovalWorkflow.create(
        'requester1',
        'org1',
        'integration',
        'read',
        'ws1',
        config
      );

      expect(() => {
        ApprovalWorkflow.processAction(request, 'user3', 'approve');
      }).toThrow('not authorized');
    });

    it('should reject duplicate approval', () => {
      const config: ApprovalWorkflowConfig = {
        type: 'majority',
        approvers: ['user1', 'user2', 'user3'],
        expirationMinutes: 60,
        requiredApprovals: 2,
      };

      let request = ApprovalWorkflow.create(
        'requester1',
        'org1',
        'integration',
        'read',
        'ws1',
        config
      );

      request = ApprovalWorkflow.processAction(request, 'user1', 'approve');

      expect(() => {
        ApprovalWorkflow.processAction(request, 'user1', 'approve');
      }).toThrow('already acted');
    });
  });

  describe('processAction - majority', () => {
    it('should approve when majority reached', () => {
      const config: ApprovalWorkflowConfig = {
        type: 'majority',
        approvers: ['user1', 'user2', 'user3'],
        expirationMinutes: 60,
        requiredApprovals: 2,
      };

      let request = ApprovalWorkflow.create(
        'requester1',
        'org1',
        'integration',
        'read',
        'ws1',
        config
      );

      request = ApprovalWorkflow.processAction(request, 'user1', 'approve');
      expect(request.state).toBe('pending');

      request = ApprovalWorkflow.processAction(request, 'user2', 'approve');
      expect(request.state).toBe('approved');
    });

    it('should deny when majority cannot be reached', () => {
      const config: ApprovalWorkflowConfig = {
        type: 'majority',
        approvers: ['user1', 'user2', 'user3'],
        expirationMinutes: 60,
        requiredApprovals: 2,
      };

      let request = ApprovalWorkflow.create(
        'requester1',
        'org1',
        'integration',
        'read',
        'ws1',
        config
      );

      request = ApprovalWorkflow.processAction(request, 'user1', 'deny');
      expect(request.state).toBe('pending');

      request = ApprovalWorkflow.processAction(request, 'user2', 'deny');
      expect(request.state).toBe('denied');
    });
  });

  describe('processAction - unanimous', () => {
    it('should require all approvers', () => {
      const config: ApprovalWorkflowConfig = {
        type: 'unanimous',
        approvers: ['user1', 'user2', 'user3'],
        expirationMinutes: 60,
      };

      let request = ApprovalWorkflow.create(
        'requester1',
        'org1',
        'integration',
        'read',
        'ws1',
        config
      );

      request = ApprovalWorkflow.processAction(request, 'user1', 'approve');
      expect(request.state).toBe('pending');

      request = ApprovalWorkflow.processAction(request, 'user2', 'approve');
      expect(request.state).toBe('pending');

      request = ApprovalWorkflow.processAction(request, 'user3', 'approve');
      expect(request.state).toBe('approved');
    });

    it('should deny on any denial', () => {
      const config: ApprovalWorkflowConfig = {
        type: 'unanimous',
        approvers: ['user1', 'user2', 'user3'],
        expirationMinutes: 60,
      };

      let request = ApprovalWorkflow.create(
        'requester1',
        'org1',
        'integration',
        'read',
        'ws1',
        config
      );

      request = ApprovalWorkflow.processAction(request, 'user1', 'approve');
      expect(request.state).toBe('pending');

      request = ApprovalWorkflow.processAction(request, 'user2', 'deny');
      expect(request.state).toBe('denied');
    });
  });

  describe('processAction - sequential', () => {
    it('should require approvals in order', () => {
      const config: ApprovalWorkflowConfig = {
        type: 'sequential',
        approvers: ['user1', 'user2', 'user3'],
        expirationMinutes: 60,
      };

      let request = ApprovalWorkflow.create(
        'requester1',
        'org1',
        'integration',
        'read',
        'ws1',
        config
      );

      request = ApprovalWorkflow.processAction(request, 'user1', 'approve');
      expect(request.state).toBe('pending');

      request = ApprovalWorkflow.processAction(request, 'user2', 'approve');
      expect(request.state).toBe('pending');

      request = ApprovalWorkflow.processAction(request, 'user3', 'approve');
      expect(request.state).toBe('approved');
    });

    it('should deny on any denial', () => {
      const config: ApprovalWorkflowConfig = {
        type: 'sequential',
        approvers: ['user1', 'user2', 'user3'],
        expirationMinutes: 60,
      };

      let request = ApprovalWorkflow.create(
        'requester1',
        'org1',
        'integration',
        'read',
        'ws1',
        config
      );

      request = ApprovalWorkflow.processAction(request, 'user1', 'approve');
      request = ApprovalWorkflow.processAction(request, 'user2', 'deny');

      expect(request.state).toBe('denied');
    });
  });

  describe('cancel', () => {
    it('should cancel a pending request', () => {
      const config: ApprovalWorkflowConfig = {
        type: 'single',
        approvers: ['user1'],
        expirationMinutes: 60,
      };

      let request = ApprovalWorkflow.create(
        'requester1',
        'org1',
        'integration',
        'read',
        'ws1',
        config
      );

      request = ApprovalWorkflow.cancel(request);
      expect(request.state).toBe('cancelled');
    });

    it('should not cancel completed request', () => {
      const config: ApprovalWorkflowConfig = {
        type: 'single',
        approvers: ['user1'],
        expirationMinutes: 60,
      };

      let request = ApprovalWorkflow.create(
        'requester1',
        'org1',
        'integration',
        'read',
        'ws1',
        config
      );

      request = ApprovalWorkflow.processAction(request, 'user1', 'approve');

      expect(() => {
        ApprovalWorkflow.cancel(request);
      }).toThrow('Cannot cancel');
    });
  });

  describe('checkExpiration', () => {
    it('should mark expired requests', () => {
      const config: ApprovalWorkflowConfig = {
        type: 'single',
        approvers: ['user1'],
        expirationMinutes: -1, // Already expired
      };

      let request = ApprovalWorkflow.create(
        'requester1',
        'org1',
        'integration',
        'read',
        'ws1',
        config
      );

      request = ApprovalWorkflow.checkExpiration(request);
      expect(request.state).toBe('expired');
    });
  });

  describe('getNextApprover', () => {
    it('should return next approver in sequential workflow', () => {
      const config: ApprovalWorkflowConfig = {
        type: 'sequential',
        approvers: ['user1', 'user2', 'user3'],
        expirationMinutes: 60,
      };

      let request = ApprovalWorkflow.create(
        'requester1',
        'org1',
        'integration',
        'read',
        'ws1',
        config
      );

      expect(ApprovalWorkflow.getNextApprover(request)).toBe('user1');

      request = ApprovalWorkflow.processAction(request, 'user1', 'approve');
      expect(ApprovalWorkflow.getNextApprover(request)).toBe('user2');
    });

    it('should return null for non-sequential workflows', () => {
      const config: ApprovalWorkflowConfig = {
        type: 'single',
        approvers: ['user1', 'user2'],
        expirationMinutes: 60,
      };

      const request = ApprovalWorkflow.create(
        'requester1',
        'org1',
        'integration',
        'read',
        'ws1',
        config
      );

      expect(ApprovalWorkflow.getNextApprover(request)).toBe(null);
    });
  });

  describe('getPendingApprovers', () => {
    it('should return all pending approvers for non-sequential', () => {
      const config: ApprovalWorkflowConfig = {
        type: 'majority',
        approvers: ['user1', 'user2', 'user3'],
        expirationMinutes: 60,
        requiredApprovals: 2,
      };

      let request = ApprovalWorkflow.create(
        'requester1',
        'org1',
        'integration',
        'read',
        'ws1',
        config
      );

      let pending = ApprovalWorkflow.getPendingApprovers(request);
      expect(pending).toEqual(['user1', 'user2', 'user3']);

      request = ApprovalWorkflow.processAction(request, 'user1', 'approve');
      pending = ApprovalWorkflow.getPendingApprovers(request);
      expect(pending).toEqual(['user2', 'user3']);
    });

    it('should return only next approver for sequential', () => {
      const config: ApprovalWorkflowConfig = {
        type: 'sequential',
        approvers: ['user1', 'user2', 'user3'],
        expirationMinutes: 60,
      };

      const request = ApprovalWorkflow.create(
        'requester1',
        'org1',
        'integration',
        'read',
        'ws1',
        config
      );

      const pending = ApprovalWorkflow.getPendingApprovers(request);
      expect(pending).toEqual(['user1']);
    });
  });

  describe('ApprovalStore', () => {
    it('should save and retrieve requests', () => {
      const config: ApprovalWorkflowConfig = {
        type: 'single',
        approvers: ['user1'],
        expirationMinutes: 60,
      };

      const request = ApprovalWorkflow.create(
        'requester1',
        'org1',
        'integration',
        'read',
        'ws1',
        config
      );

      store.save(request);
      const retrieved = store.get(request.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(request.id);
    });

    it('should find requests by user', () => {
      const config: ApprovalWorkflowConfig = {
        type: 'single',
        approvers: ['user1'],
        expirationMinutes: 60,
      };

      const request1 = ApprovalWorkflow.create(
        'requester1',
        'org1',
        'integration',
        'read',
        'ws1',
        config
      );

      const request2 = ApprovalWorkflow.create(
        'requester2',
        'org1',
        'tool',
        'execute',
        'ws1',
        config
      );

      store.save(request1);
      store.save(request2);

      const found = store.findByUser('requester1');
      expect(found).toHaveLength(1);
      expect(found[0].id).toBe(request1.id);
    });

    it('should find pending requests for approver', () => {
      const config: ApprovalWorkflowConfig = {
        type: 'single',
        approvers: ['user1', 'user2'],
        expirationMinutes: 60,
      };

      const request = ApprovalWorkflow.create(
        'requester1',
        'org1',
        'integration',
        'read',
        'ws1',
        config
      );

      store.save(request);

      const pending = store.findPendingForApprover('user1');
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe(request.id);
    });
  });
});
