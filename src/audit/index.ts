/**
 * OmniSage Audit Logging
 *
 * Immutable, append-only audit trail for all agent actions.
 * Every tool call, memory access, and integration request is logged.
 *
 * Supports export to:
 * - Local file (JSONL)
 * - PostgreSQL
 * - SIEM (Splunk, Datadog, ELK) via webhook
 */

export interface AuditEvent {
  id: string;
  timestamp: Date;
  orgId: string;
  workspaceId: string;
  userId: string | null; // null for cron/automated
  agentId: string;
  sessionId: string;

  // What happened
  action: AuditAction;
  tool?: string;
  parameters?: Record<string, unknown>; // sanitized — no secrets
  result: 'success' | 'failure' | 'pending_approval' | 'denied';
  errorMessage?: string;

  // Approval chain
  approval?: {
    required: boolean;
    approvedBy?: string;
    approvedAt?: Date;
    denied?: boolean;
    deniedBy?: string;
    deniedAt?: Date;
  };

  // Metadata
  metadata: {
    model?: string;
    tokensUsed?: number;
    latencyMs?: number;
    ipAddress?: string;
    userAgent?: string;
  };

  // Data classification
  dataClassification?: DataClassification[];
}

export type AuditAction =
  | 'tool_call'
  | 'memory_read'
  | 'memory_write'
  | 'credential_access'
  | 'message_sent'
  | 'message_received'
  | 'approval_requested'
  | 'approval_granted'
  | 'approval_denied'
  | 'session_created'
  | 'session_ended'
  | 'config_changed'
  | 'user_created'
  | 'user_updated'
  | 'workspace_created'
  | 'workspace_updated';

export type DataClassification = 'pii' | 'financial' | 'health' | 'confidential' | 'public';

export interface AuditQuery {
  orgId: string;
  workspaceId?: string;
  userId?: string;
  agentId?: string;
  action?: AuditAction;
  startTime?: Date;
  endTime?: Date;
  result?: string;
  limit?: number;
  offset?: number;
}

// TODO: Phase 1 implementation
// - JSONL file-based audit log (append-only)
// - In-memory buffer with periodic flush
// - Query interface for admin dashboard
// - PII redaction in logged parameters
// - Retention policy enforcement
// - SIEM export webhook (Phase 4)
