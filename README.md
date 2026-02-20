# 🧙 OmniSage

**Secure, self-hosted AI operations platform for small-to-medium businesses.**

OmniSage transforms how SMBs operate by providing AI-powered agents that connect your business tools, automate workflows, and surface operational intelligence — all running on infrastructure you own and control.

> *Fork of [OpenClaw](https://github.com/openclaw/openclaw) — evolved for business operations.*

---

## Why OmniSage?

Your business runs on 10-20 different tools. Your team spends hours copying data between them, chasing follow-ups, and building reports manually. Enterprise AI solutions cost $50K+/year and still need your data in their cloud.

**OmniSage gives you:**

- 🏢 **Multi-user workspaces** with role-based access per department
- 🔒 **Self-hosted security** — your data never leaves your infrastructure
- 🤖 **Pre-built business agents** — Sales, Support, Finance, HR, IT, Executive
- 🔌 **Native integrations** — CRM, Slack, email, finance tools, project management
- 📊 **Operational intelligence** — cross-system dashboards and anomaly detection
- 📋 **Audit everything** — full compliance trail for every agent action
- 💰 **SMB-priced** — $20-300/mo infrastructure, bring your own LLM keys

## Quick Start

**Get running in 3 steps:**

### 1. Clone and Configure

```bash
git clone https://github.com/brianscottjones/omnisage.git
cd omnisage

# Edit the single config file — that's it!
cp omnisage.config.yaml.example omnisage.config.yaml
```

Edit `omnisage.config.yaml` with your business details:

```yaml
organization:
  name: "Your Company"
  timezone: "America/Chicago"

departments:
  sales:
    name: "Sales"
    channel: { type: slack, id: "#sales" }
    agent: sales-ops
    members: ["alice@company.com", "bob@company.com"]
  
  support:
    channel: { type: email, address: "support@company.com" }
    agent: customer-support
  
  # Add more departments as needed...
```

### 2. Add Credentials

```bash
cp .env.example .env
# Add your LLM API key and channel credentials
```

### 3. Start

```bash
docker compose up -d
# Or: pnpm install && pnpm build && pnpm start
```

**That's it.** Your agents are live.

➡️ **Full setup guide:** [docs/SETUP.md](./docs/SETUP.md)

## Architecture Overview

**One config file. Multiple channels. Department-specific agents.**

```
┌─────────────────────────────────────┐
│    omnisage.config.yaml             │  ← Single source of truth
│    (Simple business configuration)  │
└─────────────┬───────────────────────┘
              │
         ┌────┴────┐
         ↓         ↓
    [Slack]   [Teams]  [Discord]  [Email]  [Telegram]
      ↓         ↓         ↓          ↓          ↓
    Department Agents (isolated workspaces)
      ↓         ↓         ↓          ↓          ↓
    Sales    Support  Finance      IT         HR
```

**Key Principles:**

- **Config-driven, not code-driven** — Business admins can set this up
- **Channel choice is just a config line** — Switch platforms with one edit
- **Department isolation** — Each team has their own agent and data
- **Approval gates** — Sensitive actions require human review

## Key Concepts

### Departments = Workspaces
Each department in your config gets its own isolated workspace with:
- **Dedicated agent** using a pre-built template (Sales, Support, Finance, IT, HR)
- **Private memory** — other departments can't see their data
- **Channel integration** — Slack, Teams, Discord, Email, or Telegram
- **Role-specific tools** — Sales accesses CRM, Finance accesses QuickBooks

### Pre-Built Agent Templates
OmniSage includes battle-tested templates:
- **sales-ops** — Pipeline management, lead scoring, deal tracking
- **customer-support** — Ticket triage, KB search, SLA monitoring
- **finance-ops** — Expense tracking, budget alerts, reporting
- **it-ops** — System monitoring, incident response, asset management
- **hr-people** — Recruiting, onboarding, PTO tracking

Customize templates by editing YAML files in `src/agents/templates/`.

### Channel Abstraction
Switch communication platforms with one config line:
```yaml
channel: { type: slack, id: "#sales" }      # Slack
channel: { type: teams, id: "finance-gen" }  # Microsoft Teams
channel: { type: email, address: "support@company.com" }  # Email
```
The agent behavior stays the same. Only the delivery changes.

### Approval Gates
Configure which actions require human approval:
```yaml
policies:
  requireApproval:
    - email_send      # Agents draft, humans send
    - crm_update      # No automated CRM changes
    - payment         # All payments require confirmation
```

### Audit Trail
Every agent action is logged for compliance:
- What happened, when, by whom
- Action parameters and result
- Approval chain (if required)
- Full context for incident review

## Integrations

| Category | Supported | Planned |
|----------|-----------|---------|
| **Chat** | Slack, Telegram, Discord | Teams, WhatsApp Business |
| **Email** | IMAP/SMTP, Gmail API | Outlook/Exchange |
| **CRM** | Salesforce, HubSpot | Pipedrive, Zoho |
| **Finance** | QuickBooks, Stripe | Xero, Square |
| **Projects** | Jira, Linear, Vikunja | Asana, Monday |
| **Docs** | Google Workspace | Microsoft 365, Notion |
| **Calendar** | Google Calendar | Outlook Calendar |
| **Custom** | Webhooks, REST API | GraphQL |

## Deployment

### Single Server (5-20 employees)
```yaml
# docker-compose.yml — everything on one box
services:
  omnisage:
    image: omnisage/omnisage:latest
    volumes:
      - ./data:/data
    env_file: .env
    ports:
      - "3000:3000"
```

### Team Edition (20-100 employees)
PostgreSQL + Redis backend, SSO integration, horizontal scaling ready.

### Enterprise (100+)
Kubernetes Helm chart with multi-region, SAML SSO, and dedicated compliance modules.

## Security

- **Self-hosted only** — no cloud dependency, no data exfiltration
- **Encryption at rest** — all credentials and sensitive data encrypted
- **Network isolation** — agents can only reach explicitly allowed endpoints
- **Secret rotation** — built-in credential rotation and vault management
- **Compliance tooling** — SOC 2 and HIPAA alignment out of the box

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
```

## Roadmap

See [VISION.md](./VISION.md) for the full product vision and development roadmap.

**Current Phase:** Foundation — Multi-user auth, RBAC, workspace isolation, audit logging.

## Contributing

OmniSage is open source under AGPL-3.0. Contributions welcome.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

- **OmniSage business layer:** AGPL-3.0
- **OpenClaw foundation:** MIT (upstream)

## Credits

Built on [OpenClaw](https://github.com/openclaw/openclaw) by the OpenClaw community.

---

*OmniSage: Your business, your data, your AI.*
