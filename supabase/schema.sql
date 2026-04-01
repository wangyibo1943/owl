create extension if not exists pgcrypto;

create table if not exists public.company_lookups (
    id uuid primary key default gen_random_uuid(),
    company_name_input text not null,
    company_name_matched text,
    ein text,
    website text,
    credit_grade text,
    risk_flags jsonb not null default '[]'::jsonb,
    source_name text,
    source_url text,
    raw_payload jsonb,
    created_at timestamptz not null default now()
);

create table if not exists public.evidence_records (
    id uuid primary key default gen_random_uuid(),
    company_name text not null,
    deal_reference text,
    filename text not null,
    mime_type text,
    file_size_bytes bigint not null,
    file_hash text not null,
    storage_path text,
    status text not null default 'PENDING_NOTARIZATION',
    created_at timestamptz not null default now()
);

create table if not exists public.notarization_certificates (
    id uuid primary key default gen_random_uuid(),
    evidence_id uuid not null references public.evidence_records(id) on delete cascade,
    provider_name text not null,
    provider_certificate_id text,
    certificate_url text,
    provider_payload jsonb,
    status text not null,
    created_at timestamptz not null default now()
);

create table if not exists public.workflow_logs (
    id uuid primary key default gen_random_uuid(),
    workflow_name text not null,
    reference_id text,
    status text not null,
    payload jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_company_lookups_created_at
    on public.company_lookups(created_at desc);

create index if not exists idx_evidence_records_status
    on public.evidence_records(status);

create index if not exists idx_notarization_certificates_evidence_id
    on public.notarization_certificates(evidence_id);

