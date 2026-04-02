# TradeGuard PRD

## Document Info

- Product: TradeGuard
- Stage: Phase 1 MVP
- Sprint: Sprint 1
- Duration: 2 weeks
- Audience: Founder, Product, Backend, Mobile, Automation Engineer

## Product Positioning

TradeGuard helps cross-border B2B sellers identify buyer risk, preserve transaction evidence, and prepare a case for US legal escalation.

## Target Users

- China-based sellers trading with US buyers
- Export companies
- Small and medium B2B trade operators

## MVP Goal

Validate that users will complete a pre-trade risk flow:

1. Search buyer company
2. Review buyer risk result
3. Upload contract or chat evidence
4. Receive notarization certificate
5. Start a US legal trigger package

## In Scope

- Buyer risk lookup
- Company basic profile display
- Risk grade and risk flags
- Contract or chat file upload
- Evidence hash generation
- Notarization API workflow
- Blockchain anchor after notarization
- Certificate result page
- Demand letter and legal handoff preparation
- Email notification after completion

## Out of Scope

- Tariff engine execution in Phase 1
- Paid checkout
- Full CRM or deal management
- Team collaboration
- OCR-heavy document parsing
- Legal opinion generation

## User Stories

### US-001 Buyer Risk Lookup

As a cross-border seller, I want to enter a company name, EIN, or website and quickly see a simple buyer risk signal before I decide whether to continue the deal.

### US-002 Evidence Preservation

As a seller, I want to upload contracts or chat history and receive a notarization certificate so I have proof in future disputes.

### US-003 Completion Notification

As a seller, I want to receive notification after notarization finishes so I know when the certificate is ready.

### US-004 Litigation Trigger

As a seller, after evidence is preserved, I want one action that prepares a US legal package so I can move quickly into demand-letter or lawyer handoff workflows.

## Core Workflow

1. User opens home page
2. User enters company name
3. System calls buyer risk workflow
4. User sees grade, risk flags, and company basics
5. User uploads a contract or chat file
6. System hashes the file and triggers notarization workflow
7. System stores certificate record
8. System anchors the evidence digest on-chain
9. User sees certificate result and can start the legal trigger flow
10. User receives email and can export a legal package

## Feature Requirements

### Feature A: Buyer Risk Lookup

Input:

- company_name
- optional company_state
- optional ein
- optional website

Output:

- transaction_risk_grade: `A | B | C | D`
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
- anchor digest on blockchain after certificate success

Output:

- certificate_id
- certificate_url
- file_hash
- created_at

### Feature C: Litigation Trigger

System actions:

- generate demand letter draft
- assemble evidence bundle
- prepare lawyer handoff packet

Output:

- trigger_id
- demand_letter_draft
- evidence_bundle_url
- anchor_proof
- handoff_status

### Feature D: Notification

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

### Screen 5: Legal Trigger

- demand letter draft CTA
- evidence bundle CTA
- blockchain anchor proof
- lawyer handoff CTA

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
- blockchain anchor can be linked to a preserved evidence record
- legal package can be generated after evidence is preserved
- email notification triggers after successful notarization
- all API requests are logged

## Phase 2

- tariff risk engine
- HS code risk hints
- DDP risk recommendations
- pricing and subscriptions
