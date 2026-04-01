# TradeGuard Sprint 1

## Sprint Objective

Ship a usable MVP that supports:

1. Buyer credit lookup
2. Evidence upload
3. Notarization result

## Tickets

### TG-001 Backend Service Bootstrap

- Create NestJS API skeleton
- Add health route
- Add environment config
- Add module boundaries for credit, evidence, and notifications

Acceptance:

- app starts locally
- `/health` returns `ok`

### TG-002 Credit Lookup API

- Create `POST /v1/credit/lookup`
- Integrate OpenCorporates adapter
- Map company data to standard DTO
- Compute grade and risk flags with rule-based scoring

Acceptance:

- known company returns grade and profile
- unknown company returns `404`

### TG-003 Evidence Upload API

- Create `POST /v1/evidence/upload`
- Validate file size and file type
- Generate SHA-256 hash
- Store metadata in database
- Trigger n8n workflow

Acceptance:

- upload returns evidence record and pending status
- empty file is rejected

### TG-004 Notarization Workflow

- Build n8n workflow for notarization
- Call provider API
- Persist certificate result
- Emit completion event

Acceptance:

- workflow returns certificate url
- failure path records provider error

### TG-005 Notification Workflow

- Build n8n email workflow
- Send email on notarization success

Acceptance:

- success email fires once per completed record

### TG-006 Mobile App Skeleton

- Create Flutter app structure
- Add Home, Credit Result, Upload, and Certificate screens
- Add API client interfaces and mock mode

Acceptance:

- screens navigate in mock mode
- credit lookup demo works with mock response

### TG-007 Supabase Schema

- Create tables for company lookups, evidence, certificates, and workflow logs

Acceptance:

- schema applies successfully

## Test Cases

### Happy Path

- search known company -> credit result
- upload valid file -> certificate result

### Error Path

- nonexistent company -> clean not found message
- provider timeout -> retryable error state

### Edge Cases

- invalid website -> validation message
- invalid file type -> upload blocked
- zero-byte file -> upload blocked

