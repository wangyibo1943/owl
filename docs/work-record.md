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
- Current phase: live backend and validated mobile client with remaining production hardening

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
- GLEIF fallback integrated
- California SOS provider route prepared
- Credit lookup persistence added
- Deterministic risk grading added
- `risk_score` output added
- `match_confidence` output added
- Website-aware SEC matching added
- Issuer metadata fields added to responses

### Evidence and Notarization

- Evidence upload endpoint created
- SHA-256 hashing implemented
- Supabase evidence metadata persistence added
- Supabase Storage object storage added for evidence files
- n8n trigger flow added
- Internal notarization callback added
- Certificate status endpoint added
- Certificate download endpoint added
- Adobe Sign pending sync endpoint added

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
- HTTPS enabled for `wehom.net` and `n8n.wehom.net`
- Adobe Sign auto-sync timer added on the server
- Flutter analyze, test, iOS simulator build, and Android debug build all passed locally
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

- Stronger US company credit data depth
- Mobile / frontend product polish

### Medium Priority

- California SOS live credential setup
- Production-grade scoring calibration
- Notification delivery
- Object storage for generated legal artifacts
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
- Connected SEC EDGAR, GLEIF, and California SOS provider routing
- Implemented evidence upload, callback, and certificate flow
- Added blockchain anchor route
- Added legal trigger route
- Added demand letter route
- Added evidence bundle route
- Added lawyer handoff route
- Added real legal bundle ZIP download
- Added certificate download endpoint
- Strengthened credit scoring with risk score and match confidence
- Switched uploaded evidence files to Supabase Storage object storage
- Enabled HTTPS for production endpoints
- Added Adobe Sign periodic sync automation on the server
- Validated Flutter analyze, test, iOS, and Android builds locally

## Recommended Next Work

1. Improve credit lookup precision and scoring confidence
2. Add California SOS live credential or another compliant private-company source
3. Move generated legal artifacts to object storage
4. Add stronger Adobe completion monitoring or webhook handling
