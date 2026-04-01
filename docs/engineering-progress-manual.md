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
- Current stage: partial live integration

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
- SEC EDGAR and California SOS credit provider routing is implemented
- Supabase lookup persistence infrastructure is implemented
- Evidence upload persistence and n8n trigger structure are implemented
- Certificate status route can read stored records from Supabase
- Internal notarization callback route is implemented for workflow result persistence
- Blockchain anchor API skeleton is implemented
- Legal trigger API skeleton is implemented
- Demand letter draft API skeleton is implemented
- Evidence bundle API skeleton is implemented
- Lawyer handoff API skeleton is implemented
- Evidence bundle ZIP export is implemented

### Partially Completed

- Credit lookup API route is wired to SEC EDGAR and California SOS with first-pass grading rules
- Evidence upload API route persists metadata and triggers n8n, but does not yet store binary files in object storage
- Certificate query route reads Supabase state, but still depends on external workflow/provider completion
- Blockchain anchor route persists a first-pass anchor record, but still uses a mock anchor provider
- Legal trigger route persists first-pass case intake state, but does not yet generate demand letters or evidence bundles
- Demand letter route generates a stored draft, but does not yet export PDF or DOCX artifacts
- Evidence bundle route generates a stored manifest, but does not yet export a real ZIP package
- Lawyer handoff route prepares a structured handoff packet, but does not yet send it to an external law firm system
- Bundle download route now exports a real ZIP artifact, but it is still a local server-side archive rather than object storage delivery
- n8n workflow draft now includes backend callback persistence, but still needs real provider field mapping
- Flutter app screens exist as a manual skeleton, not a generated Flutter project

### Not Started

- California SOS live credential integration
- Full production-grade risk scoring engine
- Real file upload storage
- Real notarization provider integration
- Real notification delivery
- Blockchain anchoring implementation
- Evidence bundle generation
- Lawyer handoff connector
- Authentication
- Payment logic

## Repository Map

### Product Docs

- [PRD](/Users/leo/owl/docs/tradeguard-prd.md)
- [Sprint 1](/Users/leo/owl/docs/tradeguard-sprint-1.md)
- [API Contract](/Users/leo/owl/docs/tradeguard-api-contract.md)
- [Litigation Trigger Module](/Users/leo/owl/docs/litigation-trigger-module.md)

### Backend

- [package.json](/Users/leo/owl/apps/backend/package.json)
- [main.ts](/Users/leo/owl/apps/backend/src/main.ts)
- [app.module.ts](/Users/leo/owl/apps/backend/src/app.module.ts)
- [credit.controller.ts](/Users/leo/owl/apps/backend/src/modules/credit/credit.controller.ts)
- [credit.service.ts](/Users/leo/owl/apps/backend/src/modules/credit/credit.service.ts)
- [evidence.controller.ts](/Users/leo/owl/apps/backend/src/modules/evidence/evidence.controller.ts)
- [evidence.service.ts](/Users/leo/owl/apps/backend/src/modules/evidence/evidence.service.ts)
- [supabase.service.ts](/Users/leo/owl/apps/backend/src/modules/database/supabase.service.ts)

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
- credit lookup provider router is implemented
- company lookup logging can write to Supabase when credentials are present
- evidence metadata can write to Supabase and trigger n8n webhook when configured
- certificate route can return stored status instead of placeholder data
- blockchain anchor route can persist and read stored anchor state when schema is present
- legal trigger route can persist and read stored intake state when schema is present
- demand letter route can generate and read stored draft state when schema is present
- evidence bundle route can generate and read stored manifest state when schema is present
- lawyer handoff route can assemble a structured intake packet without new schema changes
- bundle download route can return a real archive file for a generated legal bundle
- backend is deployed on the server and health endpoint responds from `wehom.net`
- anchor route has been exercised against live Supabase with a completed evidence record

### Verified Not Yet Working

- Flutter CLI is not installed on this machine
- mobile app has not been compiled
- backend requires real external credentials before full runtime use
- workflows are drafts and have not been imported into n8n
- workflow callback contract exists, but has not been exercised against a live n8n instance
- legal trigger workflow steps after intake are not implemented yet
- demand letter export artifacts are not implemented yet
- evidence bundle ZIP export is not implemented yet
- lawyer handoff is not connected to a real external intake or email delivery system yet
- generated bundle files are stored on the app server and not yet mirrored to object storage
- live Supabase still needs the latest `legal_triggers` table migration before `/v1/legal/trigger` can persist records

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

- A first-pass real integration exists, but the score model is still lightweight and should not be treated as a production-grade decision engine.

Action:

- Calibrate score rules against real California and SEC samples in [credit.service.ts](/Users/leo/owl/apps/backend/src/modules/credit/credit.service.ts)

### Risk 3: Evidence Upload Is Metadata-Backed, Not File-Storage-Backed

Impact:

- Metadata persists, but raw files are not yet stored in object storage.

Action:

- Add object storage before production notarization traffic

### Risk 4: n8n Workflows Are Drafts, Not Production-Ready

Impact:

- They define shape and orchestration direction, but not real credentials or provider-specific error handling.

Action:

- Import into n8n and replace placeholders with real endpoints and credentials
- Verify provider response mapping into the callback payload

## Recommended Next Build Order

1. Verify California SOS key with the new provider router
2. Strengthen deterministic credit grading rules
3. Add file storage path for evidence binaries
4. Connect n8n workflow to real provider and verify certificate callback persistence
5. Add certificate result polling or webhook callback completion
6. Add blockchain anchor after notarization
7. Add legal trigger intake and state transitions
8. Add lawyer handoff connector
9. Replace placeholder demand letter export with PDF or DOCX
10. Move generated bundle artifacts to object storage
11. Generate and wire full Flutter project

## Definition of “Ready for Demo”

The repo can be considered demo-ready when all of the following are true:

- `POST /v1/credit/lookup` returns real company data
- `POST /v1/evidence/upload` stores metadata and triggers n8n
- certificate result returns a provider response
- mobile app runs on a device or simulator
- founder can complete one end-to-end flow without manual DB edits

## Ownership Suggestion

### Backend Engineer

- SEC EDGAR adapter
- California SOS adapter
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
- credit lookup connected to SEC EDGAR and California SOS request flow
- lookup logging infrastructure added for Supabase
- evidence upload connected to Supabase metadata persistence and n8n trigger path
- notarization result callback route added for certificate persistence
- litigation trigger module documented for the next product phase
- blockchain anchor API skeleton added
- legal trigger intake API skeleton added
- demand letter draft API skeleton added
- evidence bundle API skeleton added
- lawyer handoff API skeleton added
- live server deployment updated with anchor and legal trigger routes
