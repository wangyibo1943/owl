# TradeGuard PRD

## Document Info

- Product: TradeGuard
- Stage: Phase 1 MVP
- Sprint: Sprint 1
- Duration: 2 weeks
- Audience: Founder, Product, Backend, Mobile, Automation Engineer

## Product Positioning

TradeGuard helps cross-border B2B sellers identify buyer risk and preserve transaction evidence before disputes happen.

## Target Users

- China-based sellers trading with US buyers
- Export companies
- Small and medium B2B trade operators

## MVP Goal

Validate that users will complete a pre-trade risk flow:

1. Search buyer company
2. Review credit result
3. Upload contract or chat evidence
4. Receive notarization certificate

## In Scope

- Buyer credit lookup
- Company basic profile display
- Risk grade and risk flags
- Contract or chat file upload
- Evidence hash generation
- Notarization API workflow
- Certificate result page
- Email notification after completion

## Out of Scope

- Tariff engine execution in Phase 1
- Paid checkout
- Full CRM or deal management
- Team collaboration
- OCR-heavy document parsing
- Legal opinion generation

## User Stories

### US-001 Credit Lookup

As a cross-border seller, I want to enter a company name, EIN, or website and quickly see a simple credit signal before I decide whether to continue the deal.

### US-002 Evidence Preservation

As a seller, I want to upload contracts or chat history and receive a notarization certificate so I have proof in future disputes.

### US-003 Completion Notification

As a seller, I want to receive notification after notarization finishes so I know when the certificate is ready.

## Core Workflow

1. User opens home page
2. User enters company name
3. System calls credit workflow
4. User sees grade, risk flags, and company basics
5. User uploads a contract or chat file
6. System hashes the file and triggers notarization workflow
7. System stores certificate record
8. User sees certificate result and receives email

## Feature Requirements

### Feature A: Buyer Credit Lookup

Input:

- company_name
- optional company_state
- optional ein
- optional website

Output:

- credit_grade: `A | B | C | D`
- risk_flags
- company profile
- source references

Primary data source:

- SEC EDGAR for US public companies
- California SOS API for California private companies

Future source:

- Delaware and other state registries
- Experian or other commercial credit provider

### Feature B: Evidence Notarization

User uploads:

- contract PDF
- invoice
- screenshot archive
- chat transcript

System actions:

- store file metadata
- compute SHA-256 hash
- call notarization provider
- persist certificate response

Output:

- certificate_id
- certificate_url
- file_hash
- created_at

### Feature C: Notification

Trigger:

- notarization succeeds

Action:

- send email to user with certificate link

## UX Screens

### Screen 1: Home

- company search input
- primary CTA

### Screen 2: Credit Result

- company name
- grade badge
- risk flags
- business profile

### Screen 3: Evidence Upload

- file picker
- upload CTA
- upload constraints

### Screen 4: Certificate Result

- certificate status
- hash value
- certificate link

## Non-Functional Requirements

- credit lookup response <= 5 seconds average
- upload + notarization success rate >= 95 percent
- app startup <= 2 seconds on test device
- no crash in normal flow

## Definition of Done

- company lookup returns a valid credit result
- nonexistent company returns a clean error state
- empty file upload is blocked
- notarization workflow returns a certificate record
- email notification triggers after successful notarization
- all API requests are logged

## Phase 2

- tariff risk engine
- HS code risk hints
- DDP risk recommendations
- pricing and subscriptions
