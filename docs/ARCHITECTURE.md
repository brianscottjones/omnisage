# OmniSage Architecture

## Overview

OmniSage simplifies business AI deployment through a **config-driven, channel-agnostic architecture**. Business admins configure departments in one YAML file, and the system handles all the complexity.

---

## Configuration Flow

```
┌──────────────────────────────────────────┐
│   omnisage.config.yaml                   │
│   (Business admin edits this file)       │
│                                           │
│   organization:                           │
│     name: "Acme Corp"                     │
│   departments:                            │
│     sales:                                │
│       channel: {type: slack, id: "#sales"}│
│       agent: sales-ops                    │
└───────────────┬──────────────────────────┘
                │
                ↓
┌──────────────────────────────────────────┐
│   Config Loader                           │
│   (src/config/omnisage/loader.ts)        │
│                                           │
│   1. Parse YAML                           │
│   2. Validate structure                   │
│   3. Expand channel configs               │
│   4. Resolve credentials from .env        │
│   5. Generate workspace configs           │
└───────────────┬──────────────────────────┘
                │
                ↓
┌──────────────────────────────────────────┐
│   Channel Abstraction Layer               │
│   (src/channels/abstractions/)           │
│                                           │
│   channelAdapterFactory.createChannel()  │
│                                           │
│   Unified Channel interface:             │
│   - send(message)                        │
│   - onMessage(handler)                   │
│   - disconnect()                         │
└───────────────┬──────────────────────────┘
                │
        ┌───────┴───────┐
        │               │
        ↓               ↓
   [Platform      [Platform
    Adapters]      Adapters]
    
    Slack         Teams
    Discord       Email
    Telegram      Webhook
        │               │
        └───────┬───────┘
                ↓
┌──────────────────────────────────────────┐
│   Department Workspaces                  │
│   (One per department in config)         │
│                                           │
│   Sales Workspace                        │
│   ├─ Agent: sales-ops template          │
│   ├─ Memory: private to sales           │
│   ├─ Tools: CRM, email, calendar        │
│   └─ Channel: Slack #sales              │
│                                           │
│   Support Workspace                      │
│   ├─ Agent: customer-support template   │
│   ├─ Memory: private to support         │
│   ├─ Tools: ticketing, KB, email        │
│   └─ Channel: Email support@company.com │
└──────────────────────────────────────────┘
```

---

## Channel Abstraction Layer

### Design Goals

1. **Unified Interface**: All channels implement the same `Channel` interface
2. **Platform Isolation**: Agent code never touches platform-specific APIs
3. **Config-Driven**: Channel choice is a config line, not code
4. **Extensible**: New channels added without changing agent code

### Interface

```typescript
interface Channel {
  readonly identifier: ChannelIdentifier;
  send(message: Message): Promise<void>;
  onMessage(handler: MessageHandler): void;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

interface Message {
  text: string;
  attachments?: MessageAttachment[];
  replyTo?: string;
  metadata?: Record<string, unknown>;
}
```

### Adapters

Each adapter implements:
- **Config Validation**: Check credentials before connecting
- **Connection Logic**: Platform-specific auth and setup
- **Message Translation**: Platform format ↔ unified Message
- **Event Handling**: Platform events → onMessage() callbacks

```typescript
class SlackAdapter extends BaseChannelAdapter {
  readonly type = 'slack';
  
  async connect(config: ChannelConfig): Promise<Channel> {
    // Slack-specific connection logic
  }
  
  async validateConfig(config: ChannelConfig): Promise<boolean> {
    // Check token, channel ID, etc.
  }
}
```

### Factory Pattern

```typescript
channelAdapterFactory.register(new SlackAdapter());
channelAdapterFactory.register(new TeamsAdapter());
// ... etc.

// Usage:
const channel = await channelAdapterFactory.createChannel({
  type: 'slack',
  config: { token: '...', channelId: '#sales' }
});
```

---

## Config Structure

### Simple, Nested, Human-Readable

```yaml
organization:
  name: "Acme Corp"
  timezone: "America/Chicago"
  adminEmail: "admin@acme.com"

departments:
  
  # Each department = isolated workspace
  sales:
    name: "Sales"
    
    # Channel config (inline)
    channel:
      type: slack
      id: "#sales"
      name: "Sales Team Channel"
    
    # Agent template reference
    agent: sales-ops
    
    # Members (email list)
    members:
      - "alice@acme.com"
      - "bob@acme.com"
    
    # Integrations (optional)
    integrations:
      - crm
      - email
      - calendar
    
    # Agent overrides (optional)
    agentConfig:
      model: "claude-opus-4"
      personalityOverride: "Custom personality..."

# Shared integrations
integrations:
  crm:
    provider: salesforce
    credentialRef: SALESFORCE_API_KEY

# Global policies
policies:
  requireApproval:
    - email_send
    - crm_update
  defaultModel: "claude-sonnet-4"
  auditEnabled: true
```

### Credential Resolution

Credentials are **never** in the config file. They're resolved from environment variables:

```bash
# .env
SLACK_BOT_TOKEN=xoxb-...
SALESFORCE_API_KEY=...
```

Config references credentials by name:
```yaml
integrations:
  crm:
    credentialRef: SALESFORCE_API_KEY
```

Loader resolves `SALESFORCE_API_KEY` from `process.env` at runtime.

---

## Agent Templates

### Template Structure

```yaml
name: "Sales Operations"
description: "Pipeline management and lead scoring"
icon: "📈"

agent:
  name: "SageBot — Sales"
  model: "claude-sonnet-4"
  personality: |
    You are the Sales Operations agent.
    Your role: ...
    Your style: ...

required_integrations:
  - crm
  - email

tools:
  read:
    - crm_query
    - email_read_inbox
  write_with_approval:
    - crm_update_record
    - email_send
  never:
    - crm_delete_record

schedules:
  - name: "Morning Pipeline Brief"
    cron: "0 8 * * 1-5"
    action: "Generate today's pipeline brief..."
    deliver_to: "{{primary_channel}}"

memory_seeds:
  - key: "sales_process"
    value: "Stages: Prospecting → Qualification → ..."
```

### Template Variables

Templates support variables that get replaced from config:

- `{{org_name}}`: Organization name
- `{{org_timezone}}`: Organization timezone
- `{{primary_channel}}`: Department's channel
- `{{admin_email}}`: Organization admin email

Example:
```yaml
personality: |
  You are the Sales agent for {{org_name}}.
```

Becomes:
```yaml
personality: |
  You are the Sales agent for Acme Corp.
```

### Tool Access Policies

Three levels:
1. **read**: Always allowed (read-only operations)
2. **write_with_approval**: Requires human approval before execution
3. **never**: Blocked entirely (requires workspace admin override)

Enforced at the workspace level — agents can't bypass.

---

## Department Isolation

### Private Memory

Each department workspace has isolated memory:
- **Workspace Memory**: Department-specific context (e.g., sales pipeline, support tickets)
- **Session Memory**: Conversation-level (ephemeral)

Cross-department sharing disabled by default. Enable with:
```yaml
policies:
  crossDepartmentContext: true
```

### Tool Access

Agents only get tools relevant to their department:
- Sales → CRM, email, calendar
- Finance → QuickBooks, expense tracking
- IT → Monitoring, ticketing, asset management

Tool access defined in agent templates and enforced at runtime.

### Channel Scoping

Each department has exactly one primary channel:
```yaml
sales:
  channel: { type: slack, id: "#sales" }
```

Messages from that channel → routed to that department's agent.

---

## Approval Workflows

### Approval Gates

Configured globally or per-department:
```yaml
policies:
  requireApproval:
    - email_send
    - crm_update
    - payment
```

When an agent attempts a gated action:
1. Action is **drafted** (not executed)
2. Human is **notified** in channel
3. Human **reviews** draft
4. Human **approves** or **rejects**
5. If approved, action **executes**

### Audit Trail

Every action logged:
```json
{
  "timestamp": "2026-02-19T22:15:00Z",
  "department": "sales",
  "agent": "sales-ops",
  "user": "alice@acme.com",
  "action": "crm_update_record",
  "params": { "record_id": "123", "field": "status", "value": "closed" },
  "result": "success",
  "approver": "bob@acme.com",
  "approval_chain": ["bob@acme.com"]
}
```

Stored in `data/audit/` for compliance.

---

## Security Model

### Credential Security

- ✅ Credentials in `.env` or secrets manager (encrypted)
- ✅ Never in config files
- ✅ Never in logs
- ✅ Automatically redacted in error messages

### Network Isolation

- Agents can only reach **explicitly allowed** endpoints
- Defined per integration in `integrations` section
- No arbitrary outbound connections

### Role-Based Access

- **Members**: Listed in `department.members`
- **Workspace Admin**: Can override tool policies
- **Organization Admin**: Can access all workspaces

### Audit Logging

- **Always on** (can't be disabled)
- Logs: tool calls, memory reads/writes, API calls
- Retention: 90 days default (configurable)
- Format: JSON Lines for easy parsing

---

## Deployment Patterns

### Single-Server (5-20 employees)

```yaml
# docker-compose.yml
services:
  omnisage:
    image: omnisage/omnisage:latest
    volumes:
      - ./omnisage.config.yaml:/app/omnisage.config.yaml
      - ./data:/data
    env_file: .env
```

One config file, one container. Done.

### Multi-Server (20-100 employees)

- PostgreSQL for shared state
- Redis for session cache
- Load balancer for multiple instances
- Still one `omnisage.config.yaml`

### Enterprise (100+ employees)

- Kubernetes Helm chart
- Multi-region deployment
- SAML SSO integration
- Advanced RBAC with custom roles

Config stays simple — deployment gets sophisticated.

---

## Extension Points

### Custom Channel Adapters

Implement `ChannelAdapter` interface:
```typescript
export class CustomAdapter extends BaseChannelAdapter {
  readonly type = 'custom';
  
  async connect(config: ChannelConfig): Promise<Channel> {
    // Your implementation
  }
}

channelAdapterFactory.register(new CustomAdapter());
```

### Custom Agent Templates

Copy existing template, customize:
```bash
cp src/agents/templates/sales-ops.yaml \
   src/agents/templates/my-custom-agent.yaml
```

Reference in config:
```yaml
departments:
  custom:
    agent: my-custom-agent
```

### Custom Integrations

Add to `integrations` section:
```yaml
integrations:
  myCustomTool:
    provider: custom
    credentialRef: MY_CUSTOM_API_KEY
```

Implement tool functions in agent code.

---

## Comparison: Before vs After

### Before (Complex Setup)

1. Create workspace directory: `workspaces/sales/`
2. Edit `workspaces/sales/config.json`
3. Edit `workspaces/sales/agent.yaml`
4. Configure channel in `channels/slack.json`
5. Wire routing in `router.json`
6. Set permissions in `rbac.yaml`
7. Configure integrations in multiple files
8. Restart services

**Total files edited:** 7+

### After (Simplified)

Edit `omnisage.config.yaml`:
```yaml
departments:
  sales:
    channel: { type: slack, id: "#sales" }
    agent: sales-ops
```

**Total files edited:** 1

---

## Summary

**OmniSage Architecture = Simple + Powerful**

- ✅ **One config file** controls everything
- ✅ **Channel abstraction** makes platforms interchangeable
- ✅ **Department isolation** keeps data secure
- ✅ **Pre-built templates** for common business functions
- ✅ **Approval workflows** for compliance
- ✅ **Audit logging** for accountability

**Result:** Business admins can deploy and manage AI agents without writing code.
