# TradeGuard Engineering Progress Manual

## Purpose

This document tracks the real engineering status of the repository.
It is intended for founders, engineers, and future collaborators who need a fast answer to:

- what is already done
- what is only scaffolded
- what is blocked
- what should be built next

## Project Snapshot

- Product name: TradeGuard
- Repo folder: `owl`
- Current repo role: MVP engineering bootstrap
- Current stage: pre-integration skeleton

## Current Delivery Status

### Completed

- Product PRD is written
- Sprint 1 ticket breakdown is written
- API contract is written
- Supabase schema draft is written
- n8n workflow drafts are written
- NestJS backend skeleton is created
- Flutter mobile skeleton is created
- Backend dependencies are installed
- Backend build passes locally

### Partially Completed

- Credit lookup API route exists, but still returns placeholder data
- Evidence upload API route exists, but is not connected to storage or n8n
- Certificate query route exists, but returns placeholder data
- Flutter app screens exist as a manual skeleton, not a generated Flutter project

### Not Started

- Real OpenCorporates integration
- Real risk scoring engine
- Real file upload storage
- Real notarization provider integration
- Real notification delivery
- Supabase database integration in backend
- Authentication
- Payment logic

## Repository Map

### Product Docs

- [PRD](/Users/leo/owl/docs/tradeguard-prd.md)
- [Sprint 1](/Users/leo/owl/docs/tradeguard-sprint-1.md)
- [API Contract](/Users/leo/owl/docs/tradeguard-api-contract.md)

### Backend

- [package.json](/Users/leo/owl/apps/backend/package.json)
- [main.ts](/Users/leo/owl/apps/backend/src/main.ts)
- [app.module.ts](/Users/leo/owl/apps/backend/src/app.module.ts)
- [credit.controller.ts](/Users/leo/owl/apps/backend/src/modules/credit/credit.controller.ts)
- [credit.service.ts](/Users/leo/owl/apps/backend/src/modules/credit/credit.service.ts)
- [evidence.controller.ts](/Users/leo/owl/apps/backend/src/modules/evidence/evidence.controller.ts)
- [evidence.service.ts](/Users/leo/owl/apps/backend/src/modules/evidence/evidence.service.ts)

### Mobile

- [main.dart](/Users/leo/owl/apps/mobile/lib/main.dart)
- [pubspec.yaml](/Users/leo/owl/apps/mobile/pubspec.yaml)
- [apps/mobile/README.md](/Users/leo/owl/apps/mobile/README.md)

### Data and Automation

- [schema.sql](/Users/leo/owl/supabase/schema.sql)
- [credit_lookup.workflow.json](/Users/leo/owl/workflows/credit_lookup.workflow.json)
- [evidence_notarization.workflow.json](/Users/leo/owl/workflows/evidence_notarization.workflow.json)
- [notarization_notification.workflow.json](/Users/leo/owl/workflows/notarization_notification.workflow.json)

## Verified Local Status

### Verified Working

- `apps/backend` dependency install completed
- `apps/backend` Nest build completed
- repo structure is consistent

### Verified Not Yet Working

- Flutter CLI is not installed on this machine
- mobile app has not been compiled
- backend is not connected to real external services
- workflows are drafts and have not been imported into n8n

## Build and Run Notes

### Backend

Working directory:

- [apps/backend](/Users/leo/owl/apps/backend)

Commands:

```bash
npm install
npm run build
npm run start:dev
```

Expected local API base:

- `http://localhost:3000/v1`

### Mobile

Working directory:

- [apps/mobile](/Users/leo/owl/apps/mobile)

Important note:

- This machine does not currently have `flutter` installed.
- The mobile folder is a hand-created skeleton, not a full generated Flutter workspace.

Recommended next step on a Flutter-enabled machine:

```bash
cd apps/mobile
flutter create .
flutter pub get
```

Then preserve and merge the current `lib/main.dart` and config files.

## Engineering Risks

### Risk 1: Flutter Skeleton Is Not Yet a Fully Generated App

Impact:

- A mobile engineer cannot just open and run it without first generating missing Flutter platform files.

Action:

- Run `flutter create .` inside [apps/mobile](/Users/leo/owl/apps/mobile)

### Risk 2: Credit Scoring Is Still Placeholder Logic

Impact:

- Demo flow exists, but business output is not trustworthy yet.

Action:

- Replace mock scoring in [credit.service.ts](/Users/leo/owl/apps/backend/src/modules/credit/credit.service.ts)

### Risk 3: Evidence Upload Is API-Only, Not Storage-Backed

Impact:

- No real persistence or upload lifecycle yet.

Action:

- Add object storage and metadata persistence before provider integration

### Risk 4: n8n Workflows Are Drafts, Not Production-Ready

Impact:

- They define shape and orchestration direction, but not real credentials or provider-specific error handling.

Action:

- Import into n8n and replace placeholders with real endpoints and credentials

## Recommended Next Build Order

1. Connect backend credit lookup to OpenCorporates
2. Implement deterministic credit grading rules
3. Add Supabase integration for lookup logs and evidence records
4. Add file upload storage and hash persistence
5. Connect n8n notarization workflow
6. Connect certificate result polling
7. Generate and wire full Flutter project

## Definition of “Ready for Demo”

The repo can be considered demo-ready when all of the following are true:

- `POST /v1/credit/lookup` returns real company data
- `POST /v1/evidence/upload` stores metadata and triggers n8n
- certificate result returns a provider response
- mobile app runs on a device or simulator
- founder can complete one end-to-end flow without manual DB edits

## Ownership Suggestion

### Backend Engineer

- OpenCorporates adapter
- scoring engine
- Supabase integration
- evidence upload pipeline

### Automation Engineer

- n8n import and provider wiring
- email notification workflow
- provider retry and error handling

### Mobile Engineer

- generate Flutter project
- screen state management
- API integration
- upload UX and result UX

## Change Log

### 2026-04-01

- Repository rebuilt as TradeGuard MVP
- docs, backend skeleton, mobile skeleton, Supabase schema, and n8n drafts added

