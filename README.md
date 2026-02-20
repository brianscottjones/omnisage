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

```bash
# Clone the repo
git clone https://github.com/brianscottjones/omnisage.git
cd omnisage

# Copy and configure environment
cp .env.example .env
# Edit .env with your LLM API keys and settings

# Start with Docker Compose
docker compose up -d

# Open the admin dashboard
open http://localhost:3000
```

## Architecture Overview

```
Users (Slack, Email, Web UI, API)
         │
    ┌────┴────┐
    │ Gateway  │ ← Auth + Rate Limiting + Audit
    │ Router   │
    └────┬────┘
         │
    ┌────┴────────────────┐
    │  Agent Orchestrator  │ ← Routes to department agents
    ├─────────────────────┤
    │ Sales │ Ops │ Finance│ ← Role-scoped agents
    │ HR    │ IT  │ Exec   │
    └────┬────────────────┘
         │
    ┌────┴────────────────┐
    │   Shared Services    │
    ├─────────────────────┤
    │ Memory │ Secrets     │
    │ Audit  │ Integrations│
    └─────────────────────┘
```

## Key Concepts

### Workspaces
An OmniSage deployment serves one **organization**. Within that org, you create **workspaces** per team/department. Each workspace has its own agent, memory, tools, and access policies.

### Agents
Each workspace runs one or more **agents** — AI personas configured with specific tools, memory access, and behavioral guidelines. A Sales agent can access the CRM but not payroll. An HR agent can access PTO records but not financial accounts.

### Memory Layers
- **Organization Memory** — company-wide knowledge (policies, product info, org chart)
- **Workspace Memory** — team-specific context (deals pipeline, support tickets, sprint goals)
- **Session Memory** — conversation-level context (ephemeral)

### Approval Gates
Sensitive actions (sending emails, updating CRM records, processing payments) require human approval. Configure per-action, per-workspace, or per-agent.

### Audit Trail
Every agent action — tool calls, memory reads/writes, external API calls — is logged with:
- Timestamp
- User who triggered (or cron/automation)
- Agent that executed
- Action taken + parameters
- Result
- Approval chain (if applicable)

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
