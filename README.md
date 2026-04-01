# TradeGuard

TradeGuard is a B2B risk and compliance tool for cross-border sellers.

Phase 1 MVP focuses on one end-to-end flow:

1. Search a buyer company
2. Return a credit grade and risk flags
3. Upload a contract or chat transcript
4. Generate evidence hash and notarization record

## Product Scope

- Credit lookup
- Evidence notarization
- Notification workflow

Tariff risk is documented for Phase 2 and not included in the first engineering sprint.

## Repo Structure

```text
.
├── apps
│   ├── backend
│   └── mobile
├── docs
├── postman
├── supabase
└── workflows
```

## Current State

- PRD, API contract, Sprint 1 tickets, and acceptance criteria are included
- NestJS backend skeleton is included
- Flutter mobile skeleton is included
- n8n workflow JSON drafts are included
- Supabase schema draft is included

## Recommended Sprint 1 Build Order

1. Credit lookup API
2. Evidence upload and notarization workflow
3. Mobile credit result flow
4. Notification workflow

## Environments

Create environment files from:

- [apps/backend/.env.example](/Users/leo/owl/apps/backend/.env.example)
- [apps/mobile/.env.example](/Users/leo/owl/apps/mobile/.env.example)

## Key Docs

- [PRD](/Users/leo/owl/docs/tradeguard-prd.md)
- [Sprint 1](/Users/leo/owl/docs/tradeguard-sprint-1.md)
- [API Contract](/Users/leo/owl/docs/tradeguard-api-contract.md)

