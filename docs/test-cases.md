# TradeGuard Test Cases

## Purpose

This document defines the MVP test cases for the current product focus:

- buyer credit lookup
- evidence upload
- notarization result
- certificate retrieval

## Test Environment

- Backend base URL: `https://wehom.net/v1`
- Database: Supabase production project
- Workflow engine: n8n

## A. Credit Lookup

### TC-CREDIT-001 Known Public Company Lookup

- Priority: Critical
- Input:
  - `company_name = Apple Inc.`
  - `website = https://www.apple.com`
- Expected:
  - response status is `200`
  - response includes company name, grade, risk score, and source
  - response includes non-empty `match_confidence`

### TC-CREDIT-002 Unknown Company Lookup

- Priority: Critical
- Input:
  - fake or nonexistent company name
- Expected:
  - clean `404` style error response
  - no server crash

### TC-CREDIT-003 Unsupported Private State

- Priority: Critical
- Input:
  - `company_name = Example LLC`
  - `company_state = NY`
- Expected:
  - clear unsupported-state response

### TC-CREDIT-004 Invalid Website Format

- Priority: Important
- Input:
  - malformed website URL
- Expected:
  - validation response returned

### TC-CREDIT-005 Logging Verification

- Priority: Important
- Input:
  - successful known-company lookup
- Expected:
  - lookup entry written to `company_lookups`

## B. Evidence Upload

### TC-EVIDENCE-001 Valid Upload

- Priority: Critical
- Input:
  - valid file payload
- Expected:
  - response returns `evidence_id`
  - `workflow_triggered` is returned
  - evidence metadata written to `evidence_records`

### TC-EVIDENCE-002 Empty File

- Priority: Critical
- Input:
  - zero-byte file content
- Expected:
  - request rejected
  - no evidence record created

### TC-EVIDENCE-003 Invalid Base64

- Priority: Critical
- Input:
  - malformed base64 string
- Expected:
  - request rejected with validation error

### TC-EVIDENCE-004 Optional Deal Reference

- Priority: Important
- Input:
  - valid upload with `deal_reference`
- Expected:
  - reference stored in `evidence_records`

## C. Notarization Workflow

### TC-NOTARY-001 Workflow Trigger

- Priority: Critical
- Input:
  - successful evidence upload
- Expected:
  - n8n workflow receives payload
  - workflow log row written

### TC-NOTARY-002 Callback Success

- Priority: Critical
- Input:
  - `POST /evidence/:evidenceId/notarization-result`
- Expected:
  - certificate record written or updated
  - evidence status becomes `COMPLETED`

### TC-NOTARY-003 Callback Missing Evidence

- Priority: Important
- Input:
  - callback for nonexistent evidence id
- Expected:
  - clean not-found response

### TC-NOTARY-004 Provider Failure Path

- Priority: Important
- Input:
  - provider failure or timeout in workflow
- Expected:
  - workflow log records failure path
  - evidence record does not silently remain in false-complete state

## D. Certificate Retrieval

### TC-CERT-001 Certificate Status Query

- Priority: Critical
- Input:
  - completed evidence id
- Expected:
  - response contains certificate id, URL, and completed status

### TC-CERT-002 Certificate Download

- Priority: Critical
- Input:
  - completed evidence id with reachable provider certificate URL
- Expected:
  - download response returns attachment headers
  - file content is returned

### TC-CERT-003 Certificate Download Missing File

- Priority: Important
- Input:
  - completed evidence id with broken provider certificate URL
- Expected:
  - clean error response
  - no server crash

## E. Regression Cases

### TC-REG-001 Anchor After Certificate

- Priority: Important
- Expected:
  - anchor creation still works after certificate flow changes

### TC-REG-002 Legal Trigger After Certificate

- Priority: Important
- Expected:
  - legal trigger creation still works after certificate flow changes

## Exit Criteria

- all `Critical` test cases pass
- no blocking server crash remains
- certificate retrieval and download are verified on the live server
- known open gaps are documented before external demo
