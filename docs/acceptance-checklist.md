# TradeGuard Acceptance Checklist

## Purpose

This checklist is the standalone acceptance reference for MVP review.
It is intended for founder review, QA review, and engineering sign-off.

## Release Scope

This checklist covers the current MVP focus only:

- buyer credit lookup
- evidence upload and notarization
- certificate retrieval and download

Legal package features may exist in the backend, but they are not part of the current core acceptance gate.

## Acceptance Rules

- Every `Critical` item must pass before MVP sign-off.
- `Important` items should pass before external demo.
- `Optional` items may be scheduled into the next iteration.

## A. Credit Lookup

### Critical

- [ ] `POST /v1/credit/lookup` returns a valid company result for a known company such as `Apple Inc.`
- [ ] response includes `company_name`, `jurisdiction`, `registration_number`, `credit_grade`, `risk_score`, `risk_flags`, and `source_name`
- [ ] nonexistent company returns a clean error response instead of server crash
- [ ] unsupported private-company state returns a clear `UNSUPPORTED_STATE` style error
- [ ] invalid request payload returns validation feedback instead of silent failure

### Important

- [ ] known company lookup average response time is within product target
- [ ] result includes meaningful `match_confidence`
- [ ] result summary matches returned risk flags and grade
- [ ] company lookups are persisted to Supabase when database credentials are configured

### Optional

- [ ] California SOS live credential path is verified with a real California private company
- [ ] scoring rules are calibrated against a broader real-world sample set

## B. Evidence Upload

### Critical

- [ ] `POST /v1/evidence/upload` accepts a valid file payload and returns `evidence_id`
- [ ] uploaded file generates a SHA-256 hash
- [ ] zero-byte file is rejected
- [ ] invalid base64 file payload is rejected
- [ ] evidence metadata is written to Supabase

### Important

- [ ] upload request returns stable pending status when notarization is still processing
- [ ] upload failure path records a useful workflow status
- [ ] storage path is generated consistently for each file

### Optional

- [ ] multipart upload replaces base64 upload in a later iteration
- [ ] raw file storage is moved to production object storage

## C. Notarization Workflow

### Critical

- [ ] n8n workflow is triggered successfully after evidence upload
- [ ] callback `POST /v1/evidence/:evidenceId/notarization-result` persists certificate result
- [ ] completed notarization updates `evidence_records.status`
- [ ] certificate result is written to `notarization_certificates`
- [ ] workflow log entry is written for notarization completion

### Important

- [ ] provider timeout or provider error is captured in workflow logs
- [ ] repeated callback updates do not corrupt certificate state
- [ ] average notarization completion behavior is acceptable for demo use

### Optional

- [ ] real provider webhook security verification is enabled
- [ ] provider retry policy is production-grade

## D. Certificate Retrieval

### Critical

- [ ] `GET /v1/evidence/:evidenceId/certificate` returns current certificate status
- [ ] completed certificate returns `certificate_id` and `certificate_url`
- [ ] missing evidence returns a clean `EVIDENCE_NOT_FOUND` style error
- [ ] `GET /v1/evidence/:evidenceId/certificate/download` returns downloadable attachment when provider file exists

### Important

- [ ] certificate download returns a sensible filename
- [ ] certificate download returns a valid content type
- [ ] provider download failure returns a clean error response

### Optional

- [ ] certificate file is cached or mirrored to owned storage instead of always proxying provider URL

## E. Non-Functional Acceptance

### Critical

- [ ] backend health endpoint returns `ok`
- [ ] no crash occurs during normal lookup and upload flows
- [ ] server remains reachable after deployment restart

### Important

- [ ] credit lookup response is within expected MVP performance target
- [ ] upload plus callback path is stable across repeated tests
- [ ] logs are sufficient for debugging provider failures

### Optional

- [ ] mobile app is compiled and verified against the live backend
- [ ] notification delivery is verified end-to-end

## F. Founder Sign-Off Questions

- [ ] Can a founder search a known company and understand the result?
- [ ] Can a founder upload a file and later retrieve a certificate?
- [ ] Can the current output be demonstrated without manual database edits?
- [ ] Are the known gaps clearly documented before any external demo?

## Current Known Gaps

- Real Adobe Acrobat Sign integration is not yet connected
- Current notarization provider is still a test flow
- File storage is not yet production-grade object storage
- Mobile / frontend production integration is not yet complete

## Sign-Off Record

- Reviewer:
- Date:
- Environment:
- Result:
- Notes:

