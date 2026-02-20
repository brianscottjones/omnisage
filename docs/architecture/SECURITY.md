# Security Architecture

## Threat Model

OmniSage handles sensitive business data and has the ability to take actions on behalf of users. The security model is designed around **zero trust** and **least privilege**.

### Trust Boundaries

```
┌─ UNTRUSTED ──────────────────────────────────────┐
│  External channels (Slack, Email, API clients)    │
│  User input (natural language, potentially        │
│  adversarial prompt injection)                    │
└──────────────┬───────────────────────────────────┘
               │ Auth + Input Sanitization
┌─ AUTHENTICATED ──────────────────────────────────┐
│  Gateway Router                                   │
│  - Session validation                             │
│  - Rate limiting                                  │
│  - Request logging                                │
└──────────────┬───────────────────────────────────┘
               │ RBAC Policy Check
┌─ AUTHORIZED ─────────────────────────────────────┐
│  Agent Orchestrator                               │
│  - Workspace isolation                            │
│  - Tool access enforcement                        │
│  - Memory scope enforcement                       │
└──────────────┬───────────────────────────────────┘
               │ Approval Gates (if required)
┌─ EXECUTED ───────────────────────────────────────┐
│  Tool Execution                                   │
│  - Network allowlists                             │
│  - Credential injection (never in prompts)        │
│  - Output sanitization                            │
└──────────────────────────────────────────────────┘
```

## Authentication

### Supported Providers
- **Local accounts** — bcrypt-hashed passwords, TOTP 2FA
- **OIDC** — Google Workspace, Microsoft Entra, Okta, Auth0
- **SAML 2.0** — Enterprise SSO (Phase 5)
- **API Keys** — For programmatic access, scoped per workspace

### Session Management
- JWT tokens with short expiry (15 min) + refresh tokens (7 days)
- Sessions bound to IP range (configurable)
- Concurrent session limits per user
- Admin can revoke all sessions for a user

## Role-Based Access Control (RBAC)

### Built-in Roles
| Role | Description | Scope |
|------|-------------|-------|
| `org:owner` | Full control of the deployment | Organization |
| `org:admin` | Manage users, workspaces, integrations | Organization |
| `ws:admin` | Manage a specific workspace | Workspace |
| `ws:member` | Use agents in a workspace | Workspace |
| `ws:viewer` | Read-only access to workspace | Workspace |
| `integration:admin` | Manage integration credentials | Organization |

### Permission Model
```typescript
interface Permission {
  resource: 'workspace' | 'agent' | 'memory' | 'integration' | 'audit' | 'user';
  action: 'create' | 'read' | 'update' | 'delete' | 'execute';
  scope: string; // workspace ID, '*' for org-wide
  conditions?: Record<string, any>; // e.g., { approval_required: true }
}
```

### Tool-Level Permissions
Each integration tool has a permission manifest:
```yaml
# integrations/salesforce/permissions.yaml
tools:
  salesforce_read_contact:
    min_role: ws:member
    approval: false
    audit: true
  salesforce_update_opportunity:
    min_role: ws:member
    approval: true  # Requires human approval
    audit: true
  salesforce_delete_record:
    min_role: ws:admin
    approval: true
    audit: true
    alert: org:admin  # Notify org admin
```

## Data Isolation

### Workspace Isolation
- Each workspace has its own:
  - Memory store (separate database schema or file namespace)
  - Agent configuration
  - Tool access list
  - Audit log partition
- Cross-workspace data access requires explicit grants
- Agents cannot reference memory from other workspaces unless configured

### Credential Management
- Integration credentials stored in encrypted vault (AES-256-GCM)
- Credentials never appear in:
  - LLM prompts
  - Agent memory
  - Audit logs (redacted)
  - Error messages
- Credentials injected at the tool execution layer only
- Rotation support with zero-downtime credential swap

## Audit Logging

### What's Logged
Every agent action generates an audit event:
```json
{
  "timestamp": "2026-02-19T21:30:00Z",
  "event_id": "evt_abc123",
  "org_id": "org_xyz",
  "workspace_id": "ws_sales",
  "user_id": "usr_brian",
  "agent_id": "sales_ops",
  "action": "tool_call",
  "tool": "salesforce_update_opportunity",
  "parameters": { "opportunity_id": "006xxx", "stage": "Closed Won" },
  "result": "success",
  "approval": {
    "required": true,
    "approved_by": "usr_brian",
    "approved_at": "2026-02-19T21:29:55Z"
  },
  "metadata": {
    "session_id": "sess_123",
    "model": "claude-sonnet-4",
    "tokens_used": 1250,
    "latency_ms": 890
  }
}
```

### Retention
- Default: 90 days hot, 1 year cold storage
- Configurable per compliance requirement
- Export to SIEM (Splunk, Datadog, ELK)
- Immutable append-only log (tamper-evident)

## Prompt Injection Defenses

### Input Sanitization
- All user input treated as untrusted
- System prompts isolated from user content
- Tool outputs sanitized before re-injection into context
- Canary tokens in system prompts to detect injection

### Output Filtering
- PII detection on agent outputs (SSN, credit card, etc.)
- Configurable redaction rules per workspace
- File/URL scanning before delivery to channels

## Network Security

### Outbound Allowlists
Each workspace defines allowed outbound destinations:
```yaml
# workspaces/sales/network.yaml
allowed_endpoints:
  - "*.salesforce.com"
  - "api.hubspot.com"
  - "hooks.slack.com"
  - "smtp.gmail.com:587"
deny_all_other: true
```

### Internal Network
- Inter-service communication over mTLS
- No direct database access from agent layer
- API gateway mediates all external calls

## Compliance Alignment

### SOC 2 Type II
- Access control documentation
- Change management logging
- Incident response procedures
- Vendor risk assessment templates

### HIPAA (Healthcare)
- PHI detection and handling
- Business Associate Agreement templates
- Minimum necessary access enforcement
- Breach notification workflows

### GDPR
- Data subject request handling
- Right to erasure implementation
- Data processing records
- Cross-border transfer controls
