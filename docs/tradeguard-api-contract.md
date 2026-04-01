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
    "jurisdiction": "us_ca",
    "registration_number": "C0806592",
    "status": "Active",
    "incorporation_date": "1977-01-03",
    "credit_grade": "A",
    "risk_flags": [],
    "summary": "Entity is active with long operating history and no basic structural red flags.",
    "source_name": "OpenCorporates",
    "source_url": "https://opencorporates.com/..."
  }
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

Multipart fields:

- `file`
- `company_name`
- `deal_reference`

Success:

```json
{
  "success": true,
  "data": {
    "evidence_id": "evd_123",
    "filename": "contract.pdf",
    "file_hash": "sha256:abc123",
    "status": "PENDING_NOTARIZATION"
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

## Error Codes

- `COMPANY_NOT_FOUND`
- `INVALID_FILE`
- `EMPTY_FILE`
- `PROVIDER_TIMEOUT`
- `PROVIDER_ERROR`
- `VALIDATION_ERROR`

