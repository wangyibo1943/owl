# TradeGuard Work Record

## Purpose

This is the running work record for the repository.
It answers two questions quickly:

- what has already been completed
- what remains unfinished

## Current Status

- Repo name: `owl`
- Product name: `TradeGuard`
- Current focus: buyer credit lookup and evidence notarization
- Current phase: backend MVP mostly connected, frontend and real provider integrations still pending

## Completed Work

### Product and Planning

- PRD created
- Sprint 1 breakdown created
- API contract created
- Context handoff manual created
- Engineering progress manual created
- Litigation trigger product module defined

### Backend Foundation

- NestJS backend scaffold created
- Supabase integration created
- n8n workflow drafts added
- Health endpoint created
- Environment template added

### Credit Lookup

- SEC EDGAR lookup integrated
- California SOS provider route prepared
- Credit lookup persistence added
- Deterministic risk grading added
- `risk_score` output added
- `match_confidence` output added
- Website-aware SEC matching added

### Evidence and Notarization

- Evidence upload endpoint created
- SHA-256 hashing implemented
- Supabase evidence metadata persistence added
- n8n trigger flow added
- Internal notarization callback added
- Certificate status endpoint added
- Certificate download endpoint added

### Chain and Legal Flow

- Blockchain anchor endpoint added
- Legal trigger intake endpoint added
- Demand letter draft endpoint added
- Evidence bundle manifest endpoint added
- Evidence bundle ZIP download added
- Lawyer handoff packet endpoint added

### Deployment and Validation

- GitHub repo initialized and connected
- Backend deployed to server
- n8n deployed to server
- Supabase connected
- Live end-to-end backend chain tested multiple times

## Completed API Results

### Credit

- `POST /v1/credit/lookup`

### Evidence

- `POST /v1/evidence/upload`
- `GET /v1/evidence/:evidenceId/certificate`
- `GET /v1/evidence/:evidenceId/certificate/download`
- `POST /v1/evidence/:evidenceId/notarization-result`
- `POST /v1/evidence/:evidenceId/anchor`
- `GET /v1/evidence/:evidenceId/anchor`

### Legal Package

- `POST /v1/legal/trigger`
- `GET /v1/legal/triggers/:triggerId`
- `POST /v1/legal/triggers/:triggerId/demand-letter`
- `POST /v1/legal/triggers/:triggerId/bundle`
- `GET /v1/legal/triggers/:triggerId/bundle`
- `GET /v1/legal/triggers/:triggerId/bundle/download`
- `POST /v1/legal/triggers/:triggerId/handoff`

## Not Yet Completed

### High Priority

- Real Adobe Acrobat Sign integration
- Real certificate file from production provider
- Production-grade file storage
- Stronger US company credit data depth
- Mobile / frontend production integration

### Medium Priority

- California SOS live credential setup
- Production-grade scoring calibration
- Notification delivery
- Object storage for generated artifacts
- Real PDF or DOCX export for demand letter

### Lower Priority For Current Focus

- Lawyer system delivery integration
- Tariff risk module
- Authentication
- Billing

## Current Priority Decision

The current product priority is:

1. credit lookup quality
2. notarization / certificate delivery

Lawyer delivery is explicitly deprioritized for now.

## Recent Milestones

### 2026-04-01

- Rebuilt the repository as TradeGuard MVP
- Connected SEC EDGAR and California SOS provider routing
- Implemented evidence upload, callback, and certificate flow
- Added blockchain anchor route
- Added legal trigger route
- Added demand letter route
- Added evidence bundle route
- Added lawyer handoff route
- Added real legal bundle ZIP download
- Added certificate download endpoint
- Strengthened credit scoring with risk score and match confidence

## Recommended Next Work

1. Replace test notarization provider with Adobe Acrobat Sign
2. Keep certificate download endpoint, but back it with a real provider file
3. Improve credit lookup precision and scoring confidence
4. Move uploaded and generated files to object storage

