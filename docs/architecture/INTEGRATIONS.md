# Integration Architecture

## Design Principles

1. **Connectors are plugins** — each integration is a self-contained module
2. **Read-first, write-gated** — read operations are permissive; write operations require approval
3. **Credentials never touch the LLM** — secrets injected at execution time only
4. **Unified interface** — all connectors expose a standard tool interface
5. **Resilient** — retry logic, circuit breakers, graceful degradation

## Connector Interface

Every integration connector implements:

```typescript
interface Connector {
  id: string;                    // e.g., "salesforce"
  name: string;                  // e.g., "Salesforce CRM"
  version: string;
  
  // Setup
  configure(config: ConnectorConfig): Promise<void>;
  healthCheck(): Promise<HealthStatus>;
  
  // Auth
  getAuthFlow(): AuthFlow;       // OAuth2, API key, etc.
  validateCredentials(): Promise<boolean>;
  
  // Tools
  getTools(): ToolDefinition[];  // Tools this connector provides
  execute(tool: string, params: Record<string, any>): Promise<ToolResult>;
  
  // Metadata
  getPermissions(): PermissionManifest;
  getWebhookHandlers?(): WebhookHandler[];
}
```

## Built-in Connectors

### Tier 1 (Phase 2 — MVP)

#### Slack
```yaml
connector: slack
auth: OAuth2 (Bot Token)
tools:
  - slack_send_message(channel, text, thread_ts?)
  - slack_read_channel(channel, limit?)
  - slack_search_messages(query, channel?)
  - slack_list_channels()
  - slack_set_topic(channel, topic)
  - slack_react(channel, timestamp, emoji)
webhooks:
  - message_received
  - reaction_added
  - slash_command
```

#### Email (IMAP/SMTP)
```yaml
connector: email
auth: OAuth2 (Gmail) or IMAP/SMTP credentials
tools:
  - email_read_inbox(folder?, limit?, unread_only?)
  - email_search(query, folder?)
  - email_send(to, subject, body, cc?, bcc?)  # approval_required
  - email_reply(message_id, body)              # approval_required
  - email_draft(to, subject, body)             # no approval needed
  - email_label(message_id, label)
```

#### Salesforce
```yaml
connector: salesforce
auth: OAuth2 (Connected App)
tools:
  - sf_query(soql)                            # Read
  - sf_get_record(sobject, id)                # Read
  - sf_search(sosl)                           # Read
  - sf_create_record(sobject, fields)         # approval_required
  - sf_update_record(sobject, id, fields)     # approval_required
  - sf_get_report(report_id)                  # Read
```

#### Calendar (Google)
```yaml
connector: google_calendar
auth: OAuth2
tools:
  - calendar_list_events(start, end, calendar?)
  - calendar_get_event(event_id)
  - calendar_create_event(title, start, end, attendees?)  # approval_required
  - calendar_find_free_time(attendees, duration, range)
```

### Tier 2 (Phase 3)

#### HubSpot
#### QuickBooks
#### Jira / Linear
#### Google Workspace (Docs, Sheets)

### Tier 3 (Phase 4)

#### Microsoft 365 (Teams, Outlook, SharePoint)
#### Stripe
#### Zendesk
#### Notion

## Custom Integrations

### Webhook Connector
For any tool with a REST API:

```yaml
# integrations/custom/erp-system.yaml
connector: webhook
name: "Internal ERP"
base_url: "https://erp.internal.company.com/api"
auth:
  type: bearer
  token_env: ERP_API_TOKEN

tools:
  - name: erp_get_inventory
    method: GET
    path: /inventory
    params:
      - name: sku
        type: string
        required: true
    response_map:
      quantity: .data.quantity_on_hand
      location: .data.warehouse

  - name: erp_create_po
    method: POST
    path: /purchase-orders
    approval_required: true
    body:
      vendor_id: "{vendor_id}"
      items: "{items}"
      total: "{total}"
```

### MCP (Model Context Protocol)
OmniSage supports MCP servers as integration sources:

```yaml
connector: mcp
name: "Custom MCP Server"
transport: stdio
command: ["node", "/path/to/mcp-server.js"]
# All tools exposed by the MCP server become available
# Subject to workspace permissions
```

## Credential Vault

### Storage
```
┌──────────────────────────────────┐
│         Credential Vault          │
│                                   │
│  AES-256-GCM encrypted at rest   │
│  Master key from env or KMS      │
│                                   │
│  ┌───────────────────────────┐   │
│  │ salesforce_prod            │   │
│  │  client_id: ****           │   │
│  │  client_secret: ****       │   │
│  │  refresh_token: ****       │   │
│  │  scopes: [api, refresh]    │   │
│  │  workspaces: [ws_sales]    │   │
│  │  rotated_at: 2026-01-15    │   │
│  └───────────────────────────┘   │
│  ┌───────────────────────────┐   │
│  │ slack_bot                  │   │
│  │  bot_token: xoxb-****      │   │
│  │  workspaces: [*]           │   │
│  │  rotated_at: 2026-02-01    │   │
│  └───────────────────────────┘   │
└──────────────────────────────────┘
```

### Access Control
- Credentials scoped to specific workspaces
- Only the tool execution layer can decrypt
- Rotation without downtime (dual-read during swap)
- Automatic token refresh for OAuth2 integrations

## Rate Limiting & Circuit Breaking

```typescript
interface RateLimitConfig {
  connector: string;
  limits: {
    requests_per_minute: number;
    requests_per_hour: number;
    concurrent: number;
  };
  circuit_breaker: {
    failure_threshold: number;  // consecutive failures before opening
    reset_timeout_ms: number;   // time before half-open retry
    half_open_max: number;      // max requests in half-open state
  };
}
```

## Webhook Ingress

External systems can push events into OmniSage:

```
POST /api/v1/webhooks/{connector_id}/{workspace_id}
Authorization: Bearer {webhook_secret}
Content-Type: application/json

{
  "event": "ticket.created",
  "data": { ... }
}
```

Events are:
1. Validated (signature, schema)
2. Routed to the appropriate workspace agent
3. Processed according to workspace rules
4. Logged in audit trail
