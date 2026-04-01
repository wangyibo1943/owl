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
- Current stage: live backend plus validated mobile client

## Current Delivery Status

### Completed

- Product PRD is written
- Sprint 1 ticket breakdown is written
- API contract is written
- Supabase schema draft is written
- n8n workflow drafts are written
- NestJS backend skeleton is created
- Flutter mobile app is created
- Backend dependencies are installed
- Backend build passes locally
- SEC EDGAR, GLEIF, and California SOS credit provider routing is implemented
- Deterministic credit grading has been strengthened with risk score and match confidence output
- Supabase lookup persistence infrastructure is implemented
- Evidence upload persistence and n8n trigger structure are implemented
- Certificate status route can read stored records from Supabase
- Certificate download route can proxy the stored provider certificate URL
- Adobe Sign provider adapter routes are implemented in the backend
- Uploaded evidence files are now written to Supabase Storage object storage
- Internal notarization callback route is implemented for workflow result persistence
- Blockchain anchor API skeleton is implemented
- Legal trigger API skeleton is implemented
- Demand letter draft API skeleton is implemented
- Evidence bundle API skeleton is implemented
- Lawyer handoff API skeleton is implemented
- Evidence bundle ZIP export is implemented
- HTTPS is live for `wehom.net` and `n8n.wehom.net`
- Adobe Sign pending evidence sync is scheduled on the server every 5 minutes
- Flutter analyze, test, iOS simulator build, and Android debug build all pass locally

### Partially Completed

- Credit lookup API route is wired to SEC EDGAR, GLEIF, and California SOS with first-pass grading rules
- Credit lookup now evaluates website-aware SEC matches and emits `risk_score` plus `match_confidence`
- Evidence upload API route persists metadata, stores binaries in Supabase Storage, and triggers n8n when configured
- Certificate query route reads Supabase state, but still depends on external workflow/provider completion
- Certificate download route depends on the provider certificate URL remaining available
- Adobe Sign provider integration is live, but still depends on agreement completion by the signer for final certificate state
- Blockchain anchor route persists a first-pass anchor record, but still uses a mock anchor provider
- Legal trigger route persists first-pass case intake state, but still depends on follow-up generation endpoints for a complete dispute package
- Demand letter route generates a stored draft, but does not yet export PDF or DOCX artifacts
- Evidence bundle route now generates a real ZIP package, but the archive is still stored on the app server
- Lawyer handoff route prepares a structured handoff packet, but does not yet send it to an external law firm system
- Bundle download route now exports a real ZIP artifact, but it is still a local server-side archive rather than object storage delivery
- n8n workflow draft now includes backend callback persistence, but still needs real provider field mapping
- Flutter app is generated, connected to live backend routes, and supports real file picking plus certificate download

### Not Started

- California SOS live credential integration
- Full production-grade risk scoring engine
- Real notification delivery
- Blockchain anchoring implementation
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
- uploaded evidence binaries can write to Supabase Storage and be downloaded through the API
- certificate route can return stored status instead of placeholder data
- certificate download route can return the provider certificate file as an attachment
- pending Adobe agreements can be batch-synced with the backend sync endpoint
- blockchain anchor route can persist and read stored anchor state when schema is present
- legal trigger route can persist and read stored intake state when schema is present
- demand letter route can generate and read stored draft state when schema is present
- evidence bundle route can generate and read stored manifest state when schema is present
- lawyer handoff route can assemble a structured intake packet without new schema changes
- bundle download route can return a real archive file for a generated legal bundle
- backend is deployed on the server and health endpoint responds from `wehom.net`
- anchor route has been exercised against live Supabase with a completed evidence record

### Verified Not Yet Working

- legal trigger workflow steps after intake are not implemented yet
- demand letter export artifacts are not implemented yet
- lawyer handoff is not connected to a real external intake or email delivery system yet
- generated bundle files are stored on the app server and not yet mirrored to object storage

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

Recommended local workflow:

```bash
cd apps/mobile
flutter pub get
flutter analyze
flutter test
flutter build ios --simulator --no-codesign
flutter build apk --debug
```

## Engineering Risks

### Risk 1: Credit Scoring Is Still Lightweight

Impact:

- The product can return useful signals, but it is still not a production-grade US business credit decision engine.

Action:

- Calibrate score rules against real California and SEC samples in [credit.service.ts](/Users/leo/owl/apps/backend/src/modules/credit/credit.service.ts)

### Risk 2: California SOS Still Depends On A Paid Key

Impact:

- Private-company lookup breadth is still limited until California SOS is configured or more compliant sources are added.

Action:

- Add a live California SOS key or approve additional compliant data sources

### Risk 3: Adobe Sign Completion Still Depends On Signer Status

Impact:

- Agreements can now be created and batch-synced automatically, but final certificate completion still depends on the signer actually completing the Adobe flow.

Action:

- Add webhook-based completion or stronger dashboard monitoring on top of the existing sync timer

### Risk 4: Generated Legal Artifacts Still Use Server-Side Storage

Impact:

- ZIP bundles and other generated legal artifacts are still served from the app server instead of durable object storage or CDN delivery.

Action:

- Move generated legal artifacts to object storage and serve them with signed URLs or CDN-backed downloads

## Recommended Next Build Order

1. Verify California SOS key with the new provider router
2. Strengthen deterministic credit grading rules
3. Expand compliant private-company source coverage beyond the current SEC, GLEIF, and optional California mix
4. Add webhook-based Adobe completion on top of the existing sync timer
5. Improve California, SEC, and GLEIF confidence rules
6. Replace placeholder demand letter export with PDF or DOCX
7. Move generated bundle artifacts to object storage
8. Polish mobile UX for production release

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
