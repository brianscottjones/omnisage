# OmniSage Setup Guide

Get your business AI agents running in **under 30 minutes**.

---

## Prerequisites

- **Infrastructure:** Docker + Docker Compose (or Podman)
- **LLM API Key:** Anthropic (Claude), OpenAI (GPT), or compatible endpoint
- **Channel Access:** Credentials for your chat platform (Slack, Teams, Discord, etc.)

---

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/brianscottjones/omnisage.git
cd omnisage

# Install dependencies
pnpm install
```

### 2. Configure Your Organization

Copy the example config and customize it for your business:

```bash
cp omnisage.config.yaml omnisage.config.yaml
```

Edit `omnisage.config.yaml`:

```yaml
organization:
  name: "Your Company Name"
  timezone: "America/New_York"  # Your timezone
  adminEmail: "admin@yourcompany.com"

departments:
  sales:
    name: "Sales"
    channel:
      type: slack               # or: teams, discord, email, telegram
      id: "#sales"              # Your Slack channel
    agent: sales-ops            # Pre-built template
    members:
      - "alice@yourcompany.com"
      - "bob@yourcompany.com"
  
  # Add more departments as needed...
```

**That's it.** This single file configures your entire deployment.

### 3. Set Up Credentials

Copy the environment template:

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```bash
# LLM Provider (required)
ANTHROPIC_API_KEY=sk-ant-...           # For Claude models
# or
OPENAI_API_KEY=sk-...                  # For GPT models

# Channel Credentials (based on your omnisage.config.yaml)
# 
# For Slack:
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...

# For Microsoft Teams:
TEAMS_APP_ID=...
TEAMS_APP_PASSWORD=...

# For Discord:
DISCORD_BOT_TOKEN=...

# For Email:
EMAIL_IMAP_HOST=imap.gmail.com
EMAIL_IMAP_PORT=993
EMAIL_IMAP_USER=support@yourcompany.com
EMAIL_IMAP_PASSWORD=...
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=support@yourcompany.com
EMAIL_SMTP_PASSWORD=...

# For Telegram:
TELEGRAM_BOT_TOKEN=...

# Integration Credentials (optional, based on your config)
SALESFORCE_API_KEY=...
QUICKBOOKS_API_KEY=...
ZENDESK_API_TOKEN=...
# etc.
```

### 4. Start OmniSage

Using Docker Compose (recommended):

```bash
docker compose up -d
```

Or, if you prefer running locally:

```bash
pnpm build
pnpm start:gateway
```

### 5. Connect Your Channels

Depending on your channel type:

#### Slack
1. Create a Slack app at https://api.slack.com/apps
2. Enable **Bot Token Scopes**: `chat:write`, `channels:history`, `channels:read`
3. Install the app to your workspace
4. Copy the **Bot User OAuth Token** → `.env` as `SLACK_BOT_TOKEN`
5. Invite the bot to your channel: `/invite @YourBotName`

#### Microsoft Teams
1. Register a bot in Azure Bot Service
2. Copy **App ID** and **App Password** → `.env`
3. Add the bot to your Teams channel

#### Discord
1. Create a bot at https://discord.com/developers/applications
2. Enable **Message Content Intent**
3. Copy the **Bot Token** → `.env`
4. Invite the bot to your server with appropriate permissions

#### Email
- Use an existing email account (Gmail, Outlook, etc.)
- Enable IMAP/SMTP access (may require app-specific password)
- Add credentials to `.env`

#### Telegram
1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Copy the **Bot Token** → `.env`
3. Add the bot to your Telegram group

### 6. Verify It's Working

Check the logs:

```bash
docker compose logs -f
```

You should see:
```
✓ Loaded OmniSage config: 5 departments
✓ Connected to Slack: #sales
✓ Connected to Teams: Finance General
✓ Agent 'SageBot — Sales' ready
✓ Agent 'SageBot — Finance' ready
```

Send a test message in one of your channels:

```
@SageBot hello
```

Your agent should respond!

---

## Department Templates

OmniSage includes pre-built agent templates for common business functions:

| Template | Use Case | Integrations |
|----------|----------|--------------|
| **sales-ops** | Pipeline management, lead scoring, deal tracking | CRM, Email, Calendar |
| **customer-support** | Ticket triage, KB search, SLA tracking | Ticketing, Email, CRM |
| **finance-ops** | Expense tracking, budget monitoring, reporting | QuickBooks/Xero, Email |
| **it-ops** | System monitoring, incident response, asset mgmt | Monitoring, Ticketing |
| **hr-people** | Recruiting, onboarding, PTO tracking | HRIS, ATS, Email |
| **executive-brief** | Cross-system dashboards, anomaly detection | All integrations |

Templates are located in `src/agents/templates/*.yaml` and are fully customizable.

---

## Customization

### Adding a New Department

Just add a block to `omnisage.config.yaml`:

```yaml
departments:
  marketing:
    name: "Marketing"
    channel:
      type: slack
      id: "#marketing"
    agent: custom-marketing      # You can create your own template
    members:
      - "marketing@yourcompany.com"
```

Then restart:

```bash
docker compose restart
```

### Creating a Custom Agent Template

1. Copy an existing template:
   ```bash
   cp src/agents/templates/sales-ops.yaml src/agents/templates/my-custom-agent.yaml
   ```

2. Edit the personality, tools, and schedules to fit your needs.

3. Reference it in `omnisage.config.yaml`:
   ```yaml
   agent: my-custom-agent
   ```

### Per-Department Overrides

Override agent settings in your config:

```yaml
departments:
  executive:
    agent: executive-brief
    agentConfig:
      model: "claude-opus-4"          # Use Opus for complex thinking
      personalityOverride: |
        You are the Executive Assistant for the CEO.
        Be extremely concise — time is scarce.
      tools:
        allow:
          - all_reads                  # Read-only access everywhere
        deny:
          - email_send                 # Executive sends their own emails
```

---

## Integrations

### Supported Integrations

- **CRM:** Salesforce, HubSpot, Pipedrive
- **Finance:** QuickBooks, Xero, Stripe
- **Ticketing:** Zendesk, Freshdesk, Linear
- **Email:** Gmail, Outlook, SMTP/IMAP
- **Calendar:** Google Calendar, Microsoft 365, CalDAV
- **Knowledge Base:** Notion, Confluence, GitBook
- **Project Management:** Asana, Monday, Jira
- **HRIS:** BambooHR, Workday, Gusto
- **ATS:** Lever, Greenhouse

### Adding Integration Credentials

All integration credentials go in `.env`:

```bash
# Example: Salesforce
SALESFORCE_API_KEY=your_key_here
SALESFORCE_INSTANCE_URL=https://yourcompany.salesforce.com
```

Then reference in `omnisage.config.yaml`:

```yaml
integrations:
  crm:
    provider: salesforce
    credentialRef: SALESFORCE_API_KEY
```

The system automatically maps `credentialRef` to environment variables.

---

## Architecture

```
┌─────────────────────────────────────┐
│    omnisage.config.yaml             │  ← Single source of truth
│    (Your business configuration)    │
└─────────────┬───────────────────────┘
              │
              ↓
┌─────────────────────────────────────┐
│    OmniSage Config Loader           │  ← Parses YAML
│    (src/config/omnisage/)           │
└─────────────┬───────────────────────┘
              │
              ↓
┌─────────────────────────────────────┐
│    Channel Abstraction Layer        │  ← Unified API for all channels
│    (src/channels/abstractions/)     │
└─────────────┬───────────────────────┘
              │
         ┌────┴────┐
         ↓         ↓
    [Slack]   [Teams]  [Discord]  [Email]  [Telegram]
      ↓         ↓         ↓          ↓          ↓
    Department Agents (Workspaces)
    - sales-ops
    - customer-support
    - finance-ops
    - it-ops
    - hr-people
```

**Key Principles:**

1. **Config-driven:** Your business logic lives in YAML, not code.
2. **Channel-agnostic:** Switch from Slack to Teams with one config line.
3. **Department-isolated:** Each team has their own agent and memory space.
4. **Approval-gated:** Sensitive actions require human review.
5. **Audit-logged:** Every action is tracked for compliance.

---

## Troubleshooting

### "No adapter registered for channel type"

**Cause:** Invalid `channel.type` in `omnisage.config.yaml`.

**Fix:** Ensure `type` is one of: `slack`, `teams`, `discord`, `email`, `telegram`, `webhook`.

---

### "Invalid configuration for channel type: slack"

**Cause:** Missing or invalid Slack credentials in `.env`.

**Fix:** Verify `SLACK_BOT_TOKEN` is set and starts with `xoxb-`.

---

### Agent not responding in channel

**Cause:** Bot not invited to channel, or credentials incorrect.

**Fix:**
1. Check logs: `docker compose logs -f`
2. Verify bot is in the channel (Slack: `/invite @bot`, Discord: bot has channel permissions)
3. Test credentials manually via API

---

### "Missing required field: organization.name"

**Cause:** Syntax error or missing field in `omnisage.config.yaml`.

**Fix:** Validate your YAML syntax. Use a YAML validator or `yamllint`.

---

## Security

### Credential Management

- **Never commit `.env`** — it's in `.gitignore` by default.
- Use a secrets manager (AWS Secrets Manager, HashiCorp Vault) for production.
- Rotate API keys regularly.

### Access Control

- **Role-based access:** Configure `members` per department.
- **Approval gates:** Require human approval for sensitive actions (see `policies.requireApproval`).
- **Audit logging:** All agent actions are logged to `data/audit/`.

### Network Security

- Deploy behind a firewall or VPN.
- Use HTTPS for webhooks.
- Validate webhook signatures (see `channel.secret` for webhooks).

---

## Next Steps

- **Customize agent templates** to match your team's workflows
- **Add more departments** as your team grows
- **Connect integrations** to unlock cross-system intelligence
- **Set up approval workflows** for compliance
- **Deploy to production** with Docker or your preferred orchestrator

**Questions?** Open an issue at https://github.com/brianscottjones/omnisage/issues

**Need help?** Email support@omnisage.dev (or your admin email from config)
