# Advisor Cockpit — App Handover

## What This Is

A web application built for investment advisors at a financial services firm. It gives each advisor a personalised daily command centre — surfacing what matters from their book of business so they can spend their time on clients, not data.

The currency is South African Rand (ZAR). The app is built with Next.js, uses PostgreSQL as its data source, and the AI SDK to power briefing generation and intelligent search.

---

## The Problem It Solves

Advisors currently start every day as analysts — manually reviewing spreadsheets, scanning for clients who need attention, trying to remember who has a maturing policy or a risk mismatch. That work is slow, error-prone, and keeps them away from the one thing that actually builds their business: **relationships with clients**.

This app hands that analytical work to the computer, so advisors walk into every client conversation already prepared.

---

## Core Features

**Morning Briefing**
AI-generated daily summary personalised per advisor. Covers market context, today's agenda, performance vs. targets, and recent client activity. Ready at login, no prep required.

**Priority Clients**
Automatically identifies which clients need attention today and explains why — surfaced from live CRM data, not manual curation.

**Today's Actions**
Categorised task list computed from the book of business each day:
- New business opportunities (clients with only one policy)
- Product fit review recommended
- Investment risk mismatches
- Maturing policies (within 3 years of retirement)
- Shared value benefits review

**Client Directory + AI Search**
Full client list with filters by focus area. Includes natural language search (e.g. "aggressive risk clients over R1M AUM").

**KPIs**
Advisor-scoped metrics: AUM, client count, active policies, average 1-year return, monthly revenue, at-risk client count.

**Analytics**
Book-of-business and fund-level charts, including portfolio vintage and product distribution.

---

## The Core Pitch

> The best advisors win because clients trust them — not because they're good at spreadsheets. This tool lets the computer do what computers are good at, so advisors can do what only humans can: show up prepared, be present, and build the relationship.

Three lines for a room:
- *"We're not replacing advisors with AI. We're giving advisors back the time they were spending doing AI's job."*
- *"The computer tells them who to call. The advisor makes the call."*
- *"Clients don't stay because their advisor found a data anomaly. They stay because their advisor called them before they had to ask."*

---

## Business Value

| Pain today | What the app does |
|---|---|
| Advisors scan data manually each morning | AI briefing ready at login |
| Missed upsell and cross-sell signals | Proactive product fit and opportunity flags |
| Risk mismatches caught too late | Flagged daily, per client |
| Maturing policies handled reactively | Surfaced weeks or months ahead |
| Client book knowledge lives in the advisor's head | Structured, searchable, always current |

---

## Audience

- **Primary users:** Individual investment advisors
- **Each advisor** sees their own book of business — clients, AUM, actions, briefing
- **Multi-advisor:** The app supports switching between advisors (branch management / oversight use case)

---

## What Still Needs a Decision

- **Launch headline** — needs to be written. Should capture the human-first angle: advisors focus on relationships, the computer handles everything else. Avoid positioning it as "AI replacing the advisor." The tone should feel empowering, not threatening. See the pitch section above for the emotional core.

---

## App Name

**Advisor Cockpit**
