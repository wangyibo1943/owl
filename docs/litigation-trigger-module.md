# Litigation Trigger Module

## Purpose

This module upgrades TradeGuard from a preservation tool into a US-focused dispute activation tool.

The intended outcome is:

1. preserve evidence
2. notarize evidence
3. anchor the digest on-chain
4. generate a legal action package
5. hand the package to US legal counsel

## Product Role

TradeGuard should not stop at certificate generation.

The product role is:

- buyer risk check before transaction
- evidence preservation before dispute
- legal trigger when dispute escalates

## Core Promise

After evidence is fixed, the user should be able to press one action and move into a US legal workflow.

That workflow means:

- generate demand letter
- assemble evidence bundle
- attach certificate and blockchain proof
- prepare lawyer handoff

## Module Scope

### In Scope

- blockchain anchor after notarization
- demand letter draft generation
- evidence bundle generation
- lawyer handoff package generation
- legal trigger status tracking

### Out of Scope

- direct court filing
- legal advice
- automated litigation strategy
- law firm billing or case management

## User Story

As a China-based seller dealing with a US buyer, after I preserve evidence, I want one click that prepares a US legal package so I can move quickly into collection, demand, or litigation.

## End-to-End Flow

1. User uploads contract, invoices, chat history, screenshots, or logistics records
2. Backend stores metadata and computes SHA-256 hash
3. Notarization workflow returns preservation certificate
4. System anchors the evidence digest on-chain
5. User taps `Start US Legal Process`
6. System generates demand letter draft
7. System builds evidence bundle
8. System outputs lawyer handoff package

## Feature Breakdown

### Feature A: Blockchain Anchor

Goal:

- create an immutable external anchor for preserved evidence

Input:

- evidence_id
- file_hash
- certificate_id
- certificate_url

Output:

- anchor_status
- chain_name
- transaction_hash
- anchor_timestamp
- anchor_proof_url

Rule:

- only anchor after notarization succeeds
- store digest only, never the raw document

### Feature B: Demand Letter

Goal:

- generate a first-pass US demand letter draft

Input:

- seller identity
- buyer identity
- amount in dispute
- breach summary
- evidence references

Output:

- letter_id
- draft text
- exportable PDF or DOCX
- review disclaimer

### Feature C: Evidence Bundle

Goal:

- produce a lawyer-ready bundle

Bundle contents:

- dispute summary
- event timeline
- contract files
- invoices
- chat records
- logistics proof
- notarization certificate
- blockchain anchor proof

Output:

- bundle_id
- zip file
- manifest JSON
- evidence index

### Feature D: Counsel Handoff

Goal:

- package the case for US lawyer intake

Output:

- case summary
- demand letter draft
- evidence bundle
- contact sheet
- handoff status

## Suggested Data Additions

### `blockchain_anchors`

- `id`
- `evidence_id`
- `chain_name`
- `transaction_hash`
- `anchor_status`
- `anchor_proof_url`
- `anchored_hash`
- `created_at`

### `legal_triggers`

- `id`
- `evidence_id`
- `trigger_status`
- `demand_letter_url`
- `bundle_url`
- `handoff_status`
- `lawyer_contact`
- `created_at`

### `demand_letters`

- `id`
- `legal_trigger_id`
- `draft_text`
- `export_url`
- `review_status`
- `created_at`

## API Direction

Recommended additions:

- `POST /v1/evidence/:evidenceId/anchor`
- `GET /v1/evidence/:evidenceId/anchor`
- `POST /v1/legal/trigger`
- `GET /v1/legal/triggers/:triggerId`
- `POST /v1/legal/triggers/:triggerId/demand-letter`
- `POST /v1/legal/triggers/:triggerId/bundle`

## Workflow Direction

### Workflow 1: Evidence Anchor

- input: notarization completed
- action: write digest to blockchain anchor service
- output: anchor metadata persisted

### Workflow 2: Demand Letter Draft

- input: legal trigger request
- action: structure dispute facts and generate letter draft
- output: draft document

### Workflow 3: Counsel Handoff

- input: demand letter ready and bundle ready
- action: package case summary and evidence manifest
- output: handoff packet

## UX Direction

Add a new post-certificate screen:

- title: `Start US Legal Process`
- sections:
  - demand letter
  - evidence bundle
  - blockchain proof
  - lawyer handoff

Primary CTA:

- `Generate Legal Package`

## Acceptance Criteria

- completed evidence can be anchored on-chain
- anchor metadata can be queried by evidence id
- demand letter draft can be generated after evidence preservation
- evidence bundle includes certificate and anchor proof
- lawyer handoff package can be exported without manual DB edits

## Implementation Order

1. blockchain anchor record
2. legal trigger data model
3. demand letter draft endpoint
4. evidence bundle generator
5. lawyer handoff connector
