# Implementation Plan — Evidence-Bound Persona Extraction

Version: 1.0  
Date: 2025-09-15

---

## Goals and Success Criteria

- Build a production-ready, evidence-traceable persona extraction platform.
- Every claim sentence must be attributable to evidence (citations + IDs) with confidence.
- SQLite + Prisma for storage; TypeScript across backend and frontend.
- Secure, privacy-preserving workflows (PDPA/GDPR-aligned) with audit trails.

Success metrics
- Grounding: AIS ≥ 0.85, RAGAS faithfulness ≥ 0.8 on internal eval set
- Citation compliance: ≥ 99% of sentences carry valid evidence IDs
- Confidence calibration: Brier Score ≤ 0.18; well-calibrated reliability plot
- Performance: End-to-end persona creation < 45s p50, < 120s p95 (10 sources)

---

## Deliverables

- Backend (TypeScript, Express or Fastify) with REST APIs and Prisma ORM
- Prisma schema + migrations (SQLite) and seed
- LLM service with evidence-only constraints, structured JSON outputs, citation validation
- Evidence processing pipeline: unitization, deduplication, scoring, topic tagging
- Frontend (Next.js + TypeScript) for evidence review and persona visualization
- CI/CD workflows (lint, typecheck, tests, security scans)
- Tests: unit, integration, e2e, and grounding evaluation harness
- Documentation: Architecture.md, Research.md, API docs, ADRs, Setup

---

## Phases and Milestones (6–8 weeks)

1) Foundation (Week 1)
- Repo hygiene, .github rules, CI + security scans
- Project scaffold: backend (Express/Fastify), frontend (Next.js App Router)
- Env/config system with validation (no secrets in code)
- ADR-000: framework choices; ADR-001: DB choice (SQLite) and migration policy

2) Data Model + Prisma (Week 1–2)
- Schema: Project, Source, EvidenceUnit, Persona, Claim, ClaimField, Citation, AuditLog
- Relations: ClaimField -> Citation (sentenceIndex, evidenceIds)
- Migrations + seed with sample data
- Basic CRUD for core entities

3) Evidence Processing Pipeline (Week 2–3)
- Unitization: 200–400 char segments with natural boundaries and metadata
- Deduplication: MinHash/SimHash or cosine threshold on embeddings
- Quality scoring: authority, content, recency, corroboration, relevance
- Topic extraction/tags; store per EvidenceUnit

4) LLM Integration (Week 3–4)
- OpenAI (or pluggable) service with JSON mode / function calling
- Evidence-only prompts; enforce per-sentence citations [evidence_id]
- Post-response validators: schema, citation IDs, grounding checks
- Confidence computation (agreement, count, quality, recency)

5) API Layer (Week 4)
- REST endpoints with zod validation, Prisma access, audit logging
- Routes: /projects, /sources, /evidence, /personas, /claims, /citations
- Pagination, filtering, and error model

6) Frontend (Week 4–5)
- Evidence Review UI: highlight units, scores, topics, selection
- Persona View: sentence-level citations with hover to preview evidence
- Review workflow: approve/reject claims, edit text, add/remove citations
- Accessibility (WCAG 2.1 AA), responsiveness, and performance basics

7) Testing + Evaluations (Week 5–6)
- Unit: pipeline functions, validators, confidence scorer
- Integration: API + DB with Supertest/Vitest
- E2E: Playwright for persona creation + review
- Grounding eval harness: AIS/RAGAS + citation precision/recall

8) Hardening + Privacy (Week 6+)
- PII redaction in logs/storage; role-based access; audit trails
- Rate limiting, input sanitization, safe prompting policies
- Error budgets, observability (structured logs, minimal metrics)

---

## Architecture at a Glance

- Backend: Node.js (TypeScript) + Express/Fastify, Prisma Client (SQLite)
- Frontend: Next.js + TypeScript, React Query/SWR for data fetching
- LLM: Service wrapper with pluggable providers (OpenAI by default)
- Evidence pipeline: pure functions, batch processing, cached embeddings
- Testing: Vitest/Jest, Supertest, Playwright; evaluation harness for grounding

---

## Data Model (Prisma)

Core entities
- Project(id, name, createdAt)
- Source(id, projectId, url, title, publishedAt, fetchedAt, tier)
- EvidenceUnit(id, sourceId, snippet, start, end, embedding?, qualityScore, topics[], metadata)
- Persona(id, projectId, status, createdAt)
- Claim(id, personaId, type, createdAt)
- ClaimField(id, claimId, text, confidence)
- Citation(id, claimFieldId, sentenceIndex, evidenceIds JSON)
- AuditLog(id, actor, action, entity, entityId, details JSON, createdAt)

Notes
- SQLite primary; keep schema simple; avoid vendor-specific extensions
- Embeddings optional; for scale, abstract vector search behind interface

---

## Backend Work Breakdown

- App scaffolding: Express/Fastify, routing, error middleware, request validation (zod)
- Prisma setup: schema, client, migrations, transactions, referential integrity
- Services
  - EvidenceService: unitize(text), dedupe(units), score(units), topics(units)
  - LLMService: extractPersona(evidenceUnits, promptOptions) -> structured Claim/Field with citations
  - ConfidenceService: calculate(field) -> number
  - CitationValidator: verifyAll(fields, evidenceIndex) -> report
  - AuditService: log(actor, action, entity, entityId, details)
- Controllers/Routes: REST endpoints with pagination, include/select performance tuning
- Security: rate limit, CORS, input sanitization, API key verification (if needed)

---

## LLM and Retrieval Strategy

- Prompting
  - Evidence-only constraints; require [evidence_id] after every sentence
  - Conflict surfacing and explicit non-inference rule
  - JSON Schema outputs for ClaimField, Citation[] with indices
- Validation
  - JSON/schema validation, citation IDs exist, empty/unsupported claims rejected
  - Grounding: AIS/RAGAS thresholds; auto-retry with stricter prompt if needed
- Determinism
  - temperature≈0, few-shot examples, schema exemplars, tool calling for citation checks
- Retrieval (optional v1)
  - Hybrid retrieval: keyword filter + embeddings; rerank top-k (simple cross-encoder or service)
  - Diversity constraints to reduce source selection bias

---

## Frontend Work Breakdown (Next.js)

- Pages/Routes
  - /projects, /projects/:id/evidence, /projects/:id/persona
- Evidence Review UI
  - Evidence cards with snippet, quality score, topics, source meta
  - Selection and linking to claim sentences; quick filters (tier, score, recency)
- Persona View
  - Sentence-level citations; hover to preview evidence; click to open source
  - Confidence badges; conflict flags; edit/approve workflow
- State/Data
  - React Query for caching; optimistic updates for review actions
- Accessibility/Perf
  - Keyboard navigation, ARIA roles; code splitting; list virtualization where needed

---

## API Design (REST)

- GET /projects, POST /projects
- GET /projects/:id/sources, POST /projects/:id/sources
- GET /projects/:id/evidence, POST /projects/:id/evidence:process
- POST /projects/:id/personas: generate (LLM)
- GET /personas/:id, PATCH /personas/:id (approve/reject fields)
- POST /claims/:id/fields, PATCH /claimFields/:id, GET /claimFields/:id/citations
- Common
  - 4xx structured error body with code, message, details
  - Pagination (limit, cursor), consistent sorting

---

## Testing and Evaluation

- Unit (Vitest/Jest): scoring, unitization, validator, confidence
- Integration (Supertest): endpoints with SQLite test DB
- E2E (Playwright): persona creation + review flows
- Grounding/Eval harness: AIS, RAGAS, citation precision/recall; baseline vs. ablations

---

## CI/CD and Tooling

- GitHub Actions: lint, typecheck, test, coverage; CodeQL; dependency review
- Dependabot updates; lockfile maintenance
- Preview deployments (optional) for frontend
- Release versioning and changelog

---

## Security and Privacy

- PII minimization; no PII in logs; redact before storage when possible
- Role-based access control for evidence and human notes
- Safety guardrails: constitutional prompts; output filters; escalation to human
- Rate limiting, input validation, output sanitization
- Audit logging for data modifications; export/delete flows (GDPR)

---

## Risks and Mitigations

- Hallucinations/grounding gaps → strict prompts, validators, AIS/RAGAS gates, re-ask with narrower evidence
- Source quality variance → tiering + quality scores + diversity constraints
- Cost/latency → batch requests, caching, rerank before LLM, streaming UI
- Privacy/regulatory → on-prem/open models option, data retention policies, DPA, region pinning
- SQLite limits → keep scope modest; path to Postgres+pgvector if needed

---

## Timeline (suggested)

- Week 1: Foundation, CI, scaffolds, ADRs
- Week 2: Prisma schema, migrations, CRUD, seed
- Week 3: Evidence pipeline (unitize, dedupe, score)
- Week 4: LLM service, validators, confidence scoring
- Week 5: REST APIs + Frontend evidence review basics
- Week 6: Persona view, review workflow, tests (unit/integration/e2e)
- Week 7–8: Grounding evals, hardening, privacy, docs, polish

---

## Next Steps

1. Confirm framework choices (Express vs. Fastify; Vitest vs. Jest) via ADR.
2. Lock initial Prisma schema and generate first migration.
3. Implement evidence unitization + quality scoring with unit tests.
4. Wire LLM service with JSON outputs and citation validation; ship minimal persona generation.
5. Build evidence review UI and persona view; integrate approval workflow.
6. Add grounding eval harness and set thresholds; iterate until targets met.
