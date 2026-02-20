# Workspace Architecture

## Overview

A **workspace** is the fundamental unit of isolation in OmniSage. Each workspace represents a team, department, or function within the organization.

## Workspace Structure

```
Organization
├── Workspace: Sales
│   ├── Agent: Sales Ops
│   ├── Memory: Pipeline notes, call summaries
│   ├── Tools: Salesforce, HubSpot, Gmail
│   ├── Channels: #sales (Slack), sales@company.com
│   └── Members: Alice (admin), Bob, Carol
├── Workspace: Support
│   ├── Agent: Support Bot
│   ├── Memory: Ticket patterns, KB articles
│   ├── Tools: Zendesk, Jira, Slack
│   ├── Channels: #support (Slack), support@company.com
│   └── Members: Dave (admin), Eve, Frank
├── Workspace: Finance
│   ├── Agent: Finance Ops
│   ├── Memory: Budget notes, vendor info
│   ├── Tools: QuickBooks, Stripe, Gmail (approval-gated)
│   ├── Channels: #finance (Slack)
│   └── Members: Grace (admin), Hank
└── Workspace: Executive
    ├── Agent: Exec Brief
    ├── Memory: Strategy notes, board prep
    ├── Tools: Read-only access to all workspace summaries
    ├── Channels: #leadership (Slack)
    └── Members: Alice (CEO), Grace (CFO)
```

## Configuration

```yaml
# workspaces/sales.yaml
workspace:
  id: ws_sales
  name: "Sales Operations"
  description: "Pipeline management, lead scoring, and deal support"

  agent:
    name: "SageBot — Sales"
    model: "claude-sonnet-4"
    personality: |
      You are the Sales Ops agent for {{org_name}}.
      You help the sales team manage their pipeline, score leads,
      prepare for calls, and track follow-ups.
      Be concise and action-oriented. Use data to back up suggestions.
    tools:
      - salesforce_read
      - salesforce_write  # approval_required: true
      - hubspot_read
      - gmail_read
      - gmail_send        # approval_required: true
      - calendar_read
      - slack_send
    memory_access:
      - ws_sales           # Full read/write
      - org_shared         # Read-only (company policies, product info)

  members:
    - user: alice@company.com
      role: ws:admin
    - user: bob@company.com
      role: ws:member
    - user: carol@company.com
      role: ws:member

  channels:
    - type: slack
      channel_id: C01SALES
      mode: active  # Agent participates in conversations
    - type: email
      address: sales-ai@company.com
      mode: inbox   # Agent processes incoming, drafts responses

  schedules:
    - name: "Morning Pipeline Brief"
      cron: "0 8 * * 1-5"
      action: |
        Generate a pipeline summary for the sales team.
        Include: new leads (24h), deals closing this week,
        follow-ups overdue, and any at-risk opportunities.
      deliver_to: slack:C01SALES

    - name: "Weekly Forecast"
      cron: "0 9 * * 1"
      action: |
        Generate the weekly sales forecast.
        Pull data from Salesforce, compare to targets,
        highlight risks and opportunities.
      deliver_to: email:alice@company.com

  policies:
    max_tokens_per_day: 500000
    max_actions_per_hour: 100
    require_approval:
      - gmail_send
      - salesforce_update_opportunity
      - salesforce_delete_*
    data_classification:
      - pii: redact_in_logs
      - financial: flag_for_review
```

## Memory Architecture

### Layers

```
┌────────────────────────────────────┐
│        Session Memory              │  ← Ephemeral, per-conversation
│  (conversation context, temp vars) │
├────────────────────────────────────┤
│        Workspace Memory            │  ← Persistent, per-team
│  (deal notes, customer context,    │
│   meeting summaries, team prefs)   │
├────────────────────────────────────┤
│      Organization Memory           │  ← Shared, company-wide
│  (product catalog, company policy, │
│   org chart, brand guidelines)     │
└────────────────────────────────────┘
```

### Memory Operations

```typescript
// Agent can only access memory within its scope
interface MemoryAccess {
  read(scope: 'session' | 'workspace' | 'org', query: string): SearchResult[];
  write(scope: 'session' | 'workspace', key: string, value: any): void;
  // Org memory is read-only for workspace agents
  // Only org:admin can write to org memory
}
```

### Vector Store
- Each workspace gets its own vector namespace
- Embeddings stored in PostgreSQL (pgvector) or Qdrant
- Automatic chunking and indexing of workspace documents
- Semantic search across workspace + org memory

## Lifecycle

### Create Workspace
1. Org admin creates workspace with config
2. System provisions:
   - Memory namespace
   - Audit log partition
   - Default agent configuration
3. Admin adds members and configures integrations
4. Agent activates on connected channels

### Archive Workspace
1. Agent stops responding to messages
2. Memory preserved but read-only
3. Audit logs retained per policy
4. Can be reactivated by org admin

### Delete Workspace
1. Requires org:owner approval
2. 30-day soft delete (recoverable)
3. Memory and audit logs exported
4. Permanent deletion after retention period
