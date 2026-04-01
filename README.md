# TradeGuard

TradeGuard is a B2B risk, evidence, and dispute activation tool for cross-border sellers.

Phase 1 MVP focuses on one end-to-end flow:

1. Search a buyer company
2. Return a credit grade and risk flags
3. Upload a contract or chat transcript
4. Generate evidence hash and notarization record
5. Prepare a legal trigger package

## Product Scope

- Credit lookup
- Evidence notarization
- Blockchain anchor and legal trigger design
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
- credit lookup service is wired for SEC EDGAR and California SOS provider routing

## Recommended Sprint 1 Build Order

1. Credit lookup API
2. Evidence upload and notarization workflow
3. Mobile credit result flow
4. Notification workflow

## Environments

Create environment files from:

- [apps/backend/.env.example](/Users/leo/owl/apps/backend/.env.example)
- [apps/mobile/.env.example](/Users/leo/owl/apps/mobile/.env.example)

## Backend Status

- `GET /v1/health` is implemented
- `POST /v1/credit/lookup` now supports free SEC EDGAR lookups and optional California SOS lookups
- credit lookup now returns `risk_score`, `match_confidence`, and website-aware SEC matching
- `POST /v1/evidence/upload` now persists evidence metadata and triggers n8n when configured
- `GET /v1/evidence/:evidenceId/certificate` now returns stored certificate state when available
- `GET /v1/evidence/:evidenceId/certificate/download` now downloads the stored notarization certificate as an attachment
- `POST /v1/evidence/:evidenceId/anchor` now creates a first-pass blockchain anchor record after certificate completion
- `GET /v1/evidence/:evidenceId/anchor` now returns stored anchor state when available
- `POST /v1/legal/trigger` now creates a first-pass legal intake record after evidence notarization and anchoring
- `GET /v1/legal/triggers/:triggerId` now returns stored legal trigger state when available
- `POST /v1/legal/triggers/:triggerId/demand-letter` now generates and stores a first-pass demand letter draft
- `POST /v1/legal/triggers/:triggerId/bundle` now generates and stores a first-pass evidence bundle manifest
- `GET /v1/legal/triggers/:triggerId/bundle/download` now downloads a real ZIP archive for the legal bundle
- `POST /v1/legal/triggers/:triggerId/handoff` now prepares a first-pass lawyer handoff packet

## Key Docs

- [PRD](/Users/leo/owl/docs/tradeguard-prd.md)
- [Sprint 1](/Users/leo/owl/docs/tradeguard-sprint-1.md)
- [API Contract](/Users/leo/owl/docs/tradeguard-api-contract.md)
- [Engineering Progress Manual](/Users/leo/owl/docs/engineering-progress-manual.md)
- [Context Handoff Manual](/Users/leo/owl/docs/context-handoff-manual.md)
- [Litigation Trigger Module](/Users/leo/owl/docs/litigation-trigger-module.md)
- [Acceptance Checklist](/Users/leo/owl/docs/acceptance-checklist.md)
- [Document Delivery Audit](/Users/leo/owl/docs/document-delivery-audit.md)
- [Work Record](/Users/leo/owl/docs/work-record.md)
