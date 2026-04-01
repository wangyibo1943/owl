# TradeGuard Acceptance Report

Date: 2026-04-01
Environment: production (`https://wehom.net`)
Reviewer: Codex
Result: Accepted for current MVP scope

## Executive Result

Current MVP passed acceptance for the current scope:

- buyer credit lookup
- evidence upload and notarization
- certificate retrieval and download

## Critical Acceptance Summary

### A. Credit Lookup

- PASS: `POST /v1/credit/lookup` returns a valid result for `Apple Inc.`
- PASS: response includes the required core fields
- PASS: nonexistent company returns a clean not-found error
- PASS: unsupported private-company state returns `UNSUPPORTED_STATE`
- PASS: invalid request payload returns validation feedback

Verified not-found result:

- request: `This Company Does Not Exist 123456`
- actual: `COMPANY_NOT_FOUND`

### B. Evidence Upload

- PASS: valid upload returns `evidence_id`
- PASS: upload generates SHA-256 hash
- PASS: empty payload is rejected
- PASS: invalid base64 is rejected
- PASS: evidence metadata is written to Supabase

Verified upload:

- `evidence_id`: `fd9f59c5-cd2a-4945-9b46-ad89a7766e3d`
- `status`: `IN_PROGRESS`
- `storage_path`: `evidence/fd9f59c5-cd2a-4945-9b46-ad89a7766e3d/acceptance.txt`

### C. Notarization Workflow

- PASS: upload flow triggers notarization workflow
- PASS: certificate result persistence is visible in Supabase
- PASS: completed notarization can update `evidence_records.status`
- PASS: certificate result is written to `notarization_certificates`
- PASS: workflow log entries are written

Verified examples:

- in-progress evidence: `fd9f59c5-cd2a-4945-9b46-ad89a7766e3d`
- completed evidence: `9009b466-7bc0-4a36-86c3-c5447dd6cef2`

### D. Certificate Retrieval

- PASS: certificate status endpoint returns current state
- PASS: completed certificate returns `certificate_id` and `certificate_url`
- PASS: missing evidence returns clean `EVIDENCE_NOT_FOUND`
- PASS: certificate download returns downloadable attachment

Verified completed certificate:

- `evidence_id`: `9009b466-7bc0-4a36-86c3-c5447dd6cef2`
- `certificate_id`: `817ed2f5-0b54-4f77-9281-6491894356d6`

### E. Non-Functional

- PASS: health endpoint returns `ok`
- PASS: no crash observed in normal lookup and upload flows
- PASS: production server is reachable during acceptance run

## Important Acceptance Summary

- PASS: known-company lookup is within target in spot test
- PASS: `match_confidence` is returned
- PASS: company lookups are persisted to Supabase
- PASS: upload returns stable in-progress status
- PASS: storage path generation is consistent
- PASS: certificate download returns a sensible filename
- PASS: certificate download returns a valid content type
- PASS: mobile app had already been built and validated locally

Still not fully verified in this run:

- provider timeout / provider error handling
- repeated callback idempotency
- repeated upload stability across multiple runs
- end-to-end notification delivery

## Acceptance Decision

Current MVP scope can be signed off.

## Remaining Non-Blocking Gaps

- California SOS live key is still pending approval
- notification delivery is still not part of the completed MVP core
- broader production-grade risk scoring still has room to expand
