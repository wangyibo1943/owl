# TradeGuard API Contract

## Base Path

`/v1`

## 1. Health

### `GET /health`

Response:

```json
{
  "status": "ok",
  "service": "tradeguard-api"
}
```

## 2. Credit Lookup

### `POST /credit/lookup`

Request:

```json
{
  "company_name": "Apple Inc.",
  "company_state": null,
  "ein": null,
  "website": "https://apple.com"
}
```

Success:

```json
{
  "success": true,
  "data": {
    "company_name": "Apple Inc.",
    "jurisdiction": "US-DE",
    "registration_number": "CIK 0000320193",
    "status": "SEC Reporting Entity",
    "incorporation_date": null,
    "credit_grade": "A",
    "risk_flags": [],
    "summary": "SEC EDGAR data indicates a structurally stable entity. Current grade is A.",
    "source_name": "SEC EDGAR",
    "source_url": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000320193"
  }
}
```

California private-company request example:

```json
{
  "company_name": "Pure Forest LLC",
  "company_state": "CA",
  "ein": null,
  "website": null
}
```

Not Found:

```json
{
  "success": false,
  "error_code": "COMPANY_NOT_FOUND",
  "message": "Company was not found"
}
```

## 3. Evidence Upload

### `POST /evidence/upload`

Current MVP request body:

```json
{
  "company_name": "Apple Inc.",
  "deal_reference": "PO-2026-001",
  "filename": "contract.pdf",
  "mime_type": "application/pdf",
  "file_content_base64": "JVBERi0xLjQK..."
}
```

Note:

- current implementation uses JSON + base64 for speed of integration
- multipart upload can be introduced in the next iteration when object storage is added

Success:

```json
{
  "success": true,
  "data": {
    "evidence_id": "evd_123",
    "filename": "contract.pdf",
    "file_hash": "sha256:abc123",
    "status": "PENDING_NOTARIZATION",
    "workflow_triggered": true
  }
}
```

## 4. Certificate Status

### `GET /evidence/:evidenceId/certificate`

Success:

```json
{
  "success": true,
  "data": {
    "evidence_id": "evd_123",
    "certificate_id": "cert_456",
    "certificate_url": "https://provider.example/cert/456",
    "status": "COMPLETED"
  }
}
```

## 5. Internal Notarization Callback

### `POST /evidence/:evidenceId/notarization-result`

Internal request body for n8n or trusted automation:

```json
{
  "provider_name": "ConfiguredNotarizationProvider",
  "provider_certificate_id": "cert_456",
  "certificate_url": "https://provider.example/cert/456",
  "status": "COMPLETED",
  "provider_payload": {
    "raw_status": "ok"
  }
}
```

Success:

```json
{
  "success": true,
  "data": {
    "evidence_id": "evd_123",
    "status": "COMPLETED",
    "certificate_id": "cert_456",
    "certificate_url": "https://provider.example/cert/456"
  }
}
```

## 6. Blockchain Anchor

### `POST /evidence/:evidenceId/anchor`

Success:

```json
{
  "success": true,
  "data": {
    "evidence_id": "evd_123",
    "anchor_id": "anc_456",
    "chain_name": "Base Sepolia",
    "provider_name": "MockAnchorProvider",
    "transaction_hash": "0xabc123",
    "anchor_status": "ANCHORED",
    "anchor_proof_url": "https://explorer.example/tx/0xabc123",
    "anchored_hash": "sha256:abc123",
    "created_at": "2026-04-01T19:40:00Z"
  }
}
```

Validation Error:

```json
{
  "success": false,
  "error_code": "CERTIFICATE_NOT_READY",
  "message": "Evidence must have a completed notarization certificate before anchoring"
}
```

### `GET /evidence/:evidenceId/anchor`

Success:

```json
{
  "success": true,
  "data": {
    "evidence_id": "evd_123",
    "anchor_id": "anc_456",
    "chain_name": "Base Sepolia",
    "provider_name": "MockAnchorProvider",
    "transaction_hash": "0xabc123",
    "anchor_status": "ANCHORED",
    "anchor_proof_url": "https://explorer.example/tx/0xabc123",
    "anchored_hash": "sha256:abc123",
    "created_at": "2026-04-01T19:40:00Z"
  }
}
```

## 7. Legal Trigger

### `POST /legal/trigger`

Request:

```json
{
  "evidence_id": "evd_123",
  "seller_name": "Shenzhen Acme Trading Co., Ltd.",
  "seller_email": "ops@acme.cn",
  "buyer_name": "Buyer LLC",
  "buyer_email": "ap@buyer.com",
  "amount_in_dispute": 24500,
  "currency": "USD",
  "breach_summary": "Buyer accepted delivery but has not paid the final invoice for 45 days.",
  "lawyer_contact": "intake@usfirm.com"
}
```

Success:

```json
{
  "success": true,
  "data": {
    "legal_trigger_id": "ltr_789",
    "evidence_id": "evd_123",
    "anchor_id": "anc_456",
    "seller_name": "Shenzhen Acme Trading Co., Ltd.",
    "seller_email": "ops@acme.cn",
    "buyer_name": "Buyer LLC",
    "buyer_email": "ap@buyer.com",
    "amount_in_dispute": 24500,
    "currency": "USD",
    "breach_summary": "Buyer accepted delivery but has not paid the final invoice for 45 days.",
    "trigger_status": "INTAKE_COMPLETED",
    "demand_letter_status": "PENDING",
    "bundle_status": "PENDING",
    "handoff_status": "NOT_STARTED",
    "demand_letter_url": null,
    "bundle_url": null,
    "lawyer_contact": "intake@usfirm.com",
    "created_at": "2026-04-01T20:30:00Z"
  }
}
```

Validation Error:

```json
{
  "success": false,
  "error_code": "ANCHOR_NOT_READY",
  "message": "Evidence must be anchored on-chain before legal trigger creation"
}
```

### `GET /legal/triggers/:triggerId`

Success:

```json
{
  "success": true,
  "data": {
    "legal_trigger_id": "ltr_789",
    "evidence_id": "evd_123",
    "anchor_id": "anc_456",
    "seller_name": "Shenzhen Acme Trading Co., Ltd.",
    "seller_email": "ops@acme.cn",
    "buyer_name": "Buyer LLC",
    "buyer_email": "ap@buyer.com",
    "amount_in_dispute": 24500,
    "currency": "USD",
    "breach_summary": "Buyer accepted delivery but has not paid the final invoice for 45 days.",
    "trigger_status": "INTAKE_COMPLETED",
    "demand_letter_status": "PENDING",
    "bundle_status": "PENDING",
    "handoff_status": "NOT_STARTED",
    "demand_letter_url": null,
    "bundle_url": null,
    "lawyer_contact": "intake@usfirm.com",
    "created_at": "2026-04-01T20:30:00Z"
  }
}
```

### `POST /legal/triggers/:triggerId/demand-letter`

Success:

```json
{
  "success": true,
  "data": {
    "legal_trigger_id": "ltr_789",
    "evidence_id": "evd_123",
    "demand_letter_id": "dml_001",
    "demand_letter_status": "GENERATED",
    "review_status": "DRAFT",
    "draft_text": "Subject: Formal Demand for Payment and Preservation of Rights\n\nTo: Buyer LLC\nFrom: Shenzhen Acme Trading Co., Ltd.\n...",
    "export_url": null,
    "created_at": "2026-04-01T20:40:00Z"
  }
}
```

## Error Codes

- `COMPANY_NOT_FOUND`
- `INVALID_FILE`
- `EMPTY_FILE`
- `PROVIDER_TIMEOUT`
- `PROVIDER_ERROR`
- `VALIDATION_ERROR`
- `EVIDENCE_NOT_FOUND`
- `UNSUPPORTED_STATE`
- `CERTIFICATE_NOT_READY`
- `ANCHOR_NOT_FOUND`
- `ANCHOR_PERSIST_FAILED`
- `ANCHOR_NOT_READY`
- `LEGAL_TRIGGER_NOT_FOUND`
- `LEGAL_TRIGGER_CREATE_FAILED`
- `DEMAND_LETTER_CREATE_FAILED`
