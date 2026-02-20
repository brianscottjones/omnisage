# OmniSage Vision

## What Is OmniSage?

OmniSage is a secure, self-hosted AI operations platform for small-to-medium businesses (SMBs). Built on the foundation of [OpenClaw](https://github.com/openclaw/openclaw), OmniSage transforms personal AI assistant technology into a multi-user, role-aware business operations layer.

**Think of it as:** An AI-powered operations team member that knows your business, connects your tools, automates your workflows, and never sleeps — all running on infrastructure you own and control.

## The Problem

SMBs are drowning in SaaS tools, manual processes, and operational overhead:

- **Fragmented communication** — Slack, email, SMS, WhatsApp, all disconnected
- **Manual task management** — copying data between systems, chasing follow-ups
- **No operational intelligence** — decisions made without real-time business context
- **Security concerns** — sensitive business data scattered across third-party services
- **AI adoption barriers** — enterprise AI is expensive; consumer AI lacks business context

## The Solution

OmniSage provides:

### 🏢 Multi-Tenant Workspace
- **Per-team/department agents** with role-based access (Sales, Ops, Finance, Support)
- **Shared organizational memory** — company knowledge base that all agents can reference
- **Private team contexts** — each department has its own memory, tools, and workflows
- **User authentication** — SSO, OIDC, or local auth with granular permissions

### 🔒 Security-First Architecture
- **Self-hosted** — your data never leaves your infrastructure
- **Audit logging** — every agent action is logged, reviewable, and exportable
- **Data classification** — PII detection and handling policies per workspace
- **Approval workflows** — sensitive actions require human approval before execution
- **Secret management** — centralized credential vault with least-privilege access
- **SOC 2 / HIPAA alignment** — designed for compliance-sensitive industries

### 🔌 Business Integration Hub
- **CRM** — Salesforce, HubSpot, Pipedrive (read/write with approval gates)
- **Communication** — Slack, Teams, Email, SMS, WhatsApp (unified inbox)
- **Finance** — QuickBooks, Xero, Stripe (read-only by default, write with approval)
- **Project Management** — Jira, Asana, Linear, Monday, Vikunja
- **Documents** — Google Workspace, Microsoft 365, Notion, Confluence
- **Custom APIs** — webhook-based integration builder for internal tools

### 🤖 Operational Agents
Pre-built agent templates for common SMB roles:

- **Sales Ops Agent** — lead scoring, pipeline updates, follow-up scheduling, competitive intel
- **Customer Support Agent** — ticket triage, knowledge base search, escalation routing
- **Finance Agent** — invoice processing, expense categorization, cash flow alerts
- **HR/People Agent** — onboarding checklists, PTO tracking, policy Q&A
- **IT/Ops Agent** — infrastructure monitoring, alert triage, runbook execution
- **Executive Brief Agent** — daily/weekly business summaries across all departments

### 📊 Business Intelligence Layer
- **Cross-system dashboards** — unified metrics from all connected tools
- **Anomaly detection** — flag unusual patterns (spending spikes, churn signals, etc.)
- **Scheduled reports** — automated daily/weekly/monthly business reports
- **Natural language queries** — "What were our top 5 deals last quarter?"

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  OmniSage Core                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  Gateway  │  │  Auth &  │  │  Audit Log   │  │
│  │  Router   │  │  RBAC    │  │  & Compliance│  │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       │              │               │           │
│  ┌────┴──────────────┴───────────────┴────────┐ │
│  │           Agent Orchestration Layer          │ │
│  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐  │ │
│  │  │Sales│ │ Ops │ │ Fin │ │ HR  │ │ IT  │  │ │
│  │  │Agent│ │Agent│ │Agent│ │Agent│ │Agent│  │ │
│  │  └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘  │ │
│  └─────┼───────┼───────┼───────┼───────┼──────┘ │
│        │       │       │       │       │         │
│  ┌─────┴───────┴───────┴───────┴───────┴──────┐ │
│  │         Shared Memory & Knowledge Base       │ │
│  │  ┌─────────┐ ┌──────────┐ ┌─────────────┐  │ │
│  │  │  Org    │ │  Team    │ │  Integration │  │ │
│  │  │ Memory  │ │ Contexts │ │  Credentials │  │ │
│  │  └─────────┘ └──────────┘ └─────────────┘  │ │
│  └──────────────────────────────────────────────┘ │
│                                                   │
│  ┌──────────────────────────────────────────────┐ │
│  │           Integration Connectors              │ │
│  │  Salesforce │ Slack │ QuickBooks │ Jira │ ... │ │
│  └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## Deployment Models

### 1. Single-Server (5-20 employees)
- Docker Compose on a VPS or office server
- SQLite + file-based storage
- Single admin, shared agent pool
- **Cost:** $20-50/mo infrastructure + LLM API costs

### 2. Team Edition (20-100 employees)
- Docker Compose or Kubernetes
- PostgreSQL + Redis
- Multi-department with RBAC
- SSO integration
- **Cost:** $100-300/mo infrastructure + LLM API costs

### 3. Enterprise (100+ employees)
- Kubernetes with horizontal scaling
- Multi-region support
- Custom compliance modules
- Dedicated support
- **Cost:** Custom

## Differentiation from OpenClaw

| Feature | OpenClaw | OmniSage |
|---------|----------|----------|
| Users | Single user | Multi-user with RBAC |
| Memory | Personal | Org + Team + Personal |
| Auth | Token-based | SSO/OIDC + API keys |
| Audit | Minimal | Full audit trail |
| Integrations | Personal tools | Business SaaS stack |
| Agents | Single personality | Role-based agent pool |
| Data handling | Trust-based | Policy-enforced |
| Deployment | Personal device | Server/cloud |
| Compliance | N/A | SOC 2 / HIPAA aligned |

## Development Roadmap

### Phase 1: Foundation (Months 1-2)
- [ ] Multi-user auth system (local + OIDC)
- [ ] Role-based access control (RBAC)
- [ ] Workspace/team isolation
- [ ] Audit logging framework
- [ ] Org-level shared memory
- [ ] Admin dashboard (web UI)

### Phase 2: Business Integrations (Months 2-4)
- [ ] Slack connector (full bi-directional)
- [ ] Email connector (IMAP/SMTP + OAuth)
- [ ] CRM connector (Salesforce, HubSpot)
- [ ] Calendar connector (Google, Microsoft)
- [ ] Webhook builder for custom integrations

### Phase 3: Operational Agents (Months 3-5)
- [ ] Agent template system
- [ ] Sales Ops agent template
- [ ] Customer Support agent template
- [ ] Executive Brief agent template
- [ ] Approval workflow engine

### Phase 4: Intelligence & Reporting (Months 4-6)
- [ ] Cross-system dashboard builder
- [ ] Scheduled report generation
- [ ] Anomaly detection engine
- [ ] Natural language business queries

### Phase 5: Compliance & Scale (Months 5-8)
- [ ] SOC 2 compliance toolkit
- [ ] HIPAA data handling module
- [ ] Kubernetes deployment configs
- [ ] Multi-region support
- [ ] Enterprise SSO (SAML)

## Naming

**OmniSage** — *Omni* (all-encompassing) + *Sage* (wise advisor). An AI that sees across your entire business and provides wise counsel.

## License

AGPL-3.0 (keeps it open while requiring derivative works to share improvements).
Fork of OpenClaw (MIT) — we adopt AGPL for the business layer additions.

---

*Built by humans who got tired of being the glue between 15 different SaaS tools.*
