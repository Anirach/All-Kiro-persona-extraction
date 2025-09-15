# PRD — Web Application Platform for Traceable, Evidence-Bound Persona Extraction (LLM)

**Version:** 1.0  
**Date:** 2025-09-15 (Asia/Bangkok)  
**Owner:** Product (Persona Intelligence)  
**Reviewers:** Engineering, Research/ML, Legal/Compliance (PDPA/GDPR), UX  
**Target Users:** Researchers, analysts, content strategists, educators, and enterprise teams needing auditable personas built from public web sources

---

## 0) Executive Summary
Build a **web platform** that extracts a person’s persona from public internet sources and outputs a **transparent, traceable profile** with **inline citations**, **confidence scores**, and a **complete evidence ledger**. The platform implements a rigorous pipeline: **scope → search → retrieval → evidence unitization → attribution-bound LLM extraction → conflict resolution → human review → export**, ensuring each claim is **verifiably grounded** in collected sources.

---

## 1) Goals & Non-Goals

### 1.1 Goals
1. **Traceability by Design:** Every persona field (Name, Role, Expertise, Mindset, Personality, Description) is backed by **explicit evidence units** and **per-sentence citations**.  
2. **Reproducibility:** Capture all **search queries**, **time of run**, **sources**, **model parameters**, and **prompts** so results can be re-run and compared.  
3. **Confidence & Conflict Handling:** Compute **field-level confidence** and surface **conflict notes** when sources disagree.  
4. **Human-in-the-Loop:** Provide a **side-by-side “Claim ⇄ Evidence”** review interface with acceptance criteria, edit history, and role-based approvals.  
5. **Policy & Privacy:** Respect PDPA/GDPR and platform ToS; store only necessary data; enable deletion and export.

### 1.2 Non-Goals (v1)
- Real-time continuous monitoring or alerts on persona changes.  
- Automated crawling behind paywalls or authentication.  
- Opinion mining from private/closed communities.  
- Image/video analysis beyond basic metadata (text-only v1).

---

## 2) Users & Roles
- **Researcher/Analyst:** Runs extractions, curates sources, drafts personas.  
- **Reviewer/Editor:** Verifies claims, resolves conflicts, signs off.  
- **Administrator:** Manages users, policies, rate limits, providers, and audit exports.  
- **API Client (Service Account):** Integrates the pipeline headlessly.

**Access Model:** Role-based (RBAC) with SSO/OIDC support.

---

## 3) Core Use Cases (User Stories & Acceptance)

1. **Create Persona Project**  
   *As a Researcher*, I can start a project with a name (e.g., “Homer Simpson”), mark **real vs. fictional**, and set language(s).  
   **Acceptance:** Project created with default schema; provenance tracking initialized.

2. **Configure Search**  
   Provide **seed queries** and optional **trusted domains**.  
   **Acceptance:** System generates diversified queries and records them with timestamps.

3. **Run Retrieval & Evidence Unitization**  
   Fetch top-N pages per query; create **evidence units** (200–400 chars) around relevant spans.  
   **Acceptance:** Each unit has URL, title, snippet, captured time, content hash, and topic candidates.

4. **LLM Persona Draft with Citations**  
   LLM fills each field **only** from supplied evidence units, enforcing **per-sentence citations**.  
   **Acceptance:** Draft contains all six fields, citations, rationale summaries, and **confidence** per field.

5. **Conflict Resolution**  
   System detects contradictions, flags **conflict notes**, proposes resolution (ranking sources by quality).  
   **Acceptance:** Reviewer sees conflicts, can override; **decision log** records rationale.

6. **Review & Approval**  
   *As a Reviewer*, I compare each claim to its evidence highlight, approve or edit, and lock the persona.  
   **Acceptance:** Approved persona has immutable **audit snapshot** (inputs, parameters, outputs).

7. **Export & Share**  
   Export **Persona Card (PDF/Markdown)**, **Persona JSON**, **Evidence Ledger (CSV/JSON)**, **Decision Log (CSV/JSON)**, and **Run Manifest**.  
   **Acceptance:** Files download with checksums; API provides the same artifacts.

---

## 4) Functional Requirements

### 4.1 Project & Schema
- Fixed default schema: **Name, Role, Expertise, Mindset, Personality, Description**.  
- Per-field metadata: **citations[]**, **evidence_ids[]**, **confidence (0–1)**, **rationale**, **conflict_notes**.  
- Mark **fictional vs. real person** (impacts source filters and compliance banners).

### 4.2 Search & Retrieval
- Pluggable **Web Search Provider** (configurable); safe search and rate limits enforced.  
- Diversified query generation (e.g., `"<name>" + role`, biography, traits, interviews, episode pages).  
- **Source tiering:** canonical/official > reputable reference > secondary wiki > forums/blogs.  
- Store **raw HTML/text**, normalized text, **source fingerprint (hash)**, canonical URL, fetch timestamp.

### 4.3 Evidence Unitization
- Automatic **passage segmentation** (200–400 chars) with **topic candidates** per unit.  
- Deduplicate near-identical units (MinHash/SimHash) with thresholds (configurable).  
- Maintain **unit → source mapping** and **highlight offsets** for UI.

### 4.4 Attribution-Bound LLM Extraction
- Prompting policies that forbid unsupported claims; require **citation after every sentence**.  
- Strict **“evidence-only”** mode: LLM cannot invent facts; must reference unit IDs.  
- Output includes **field text**, **sentence-level citations**, **rationale**, and **red-flag list** (low evidence density).

### 4.5 Confidence Scoring
- Default formula (configurable):  
  `confidence = 0.4*source_weighted_agreement + 0.3*normalized_evidence_count + 0.2*avg_source_quality + 0.1*recency_score`  
- Per-field **coverage thresholds** (e.g., Role requires ≥2 independent high-tier sources or flagged).

### 4.6 Conflict Detection & Resolution
- Heuristics for contradiction detection (e.g., role/title mismatch, incompatible dates).  
- Provide **resolution candidates** based on source tiering and evidence density; preserve **conflict_notes** if unresolved.

### 4.7 Human Review Workflow
- **Side-by-side Claim ⇄ Evidence** viewer with sentence highlights.  
- Actions: accept, edit with new citations, request more evidence, downgrade sources, add reviewer note.  
- **Versioning:** Every edit creates a new revision; maintain **immutable audit snapshots** upon approval.

### 4.8 Exports & Interop
- **Persona JSON**: full schema + citations and confidence.  
- **Evidence Ledger**: CSV/JSON listing source URL, title, domain type, unit IDs, timestamps, hashes.  
- **Decision Log**: CSV/JSON capturing decisions, rationale, user, timestamp.  
- **Run Manifest**: search queries, parameters, model IDs, temperature, top-k, time zone.  
- **Persona Card**: Markdown/PDF for presentation.

### 4.9 Administration
- Manage users/roles, API keys, provider credentials, domain allow/deny lists, retention settings, export policies, and legal banners.  
- System health dashboard: queue depth, errors, rate-limit utilization.

---

## 5) Non-Functional Requirements

### 5.1 Security & Compliance
- **PDPA/GDPR** alignment: lawful basis for processing public data; enable **data deletion** and **export** per project; minimal PII storage.  
- Respect robots.txt and site ToS; avoid paywalls/auth-gated content.  
- Encryption at rest and in transit (TLS).  
- **Audit logging**: all user actions, source fetches, model calls, exports (tamper-evident).

### 5.2 Privacy Modes
- **Real person mode:** Conservative defaults, subjectivity warnings, require ≥2 high-tier sources.  
- **Fictional mode:** Allow franchise/community wikis but mark their tier.

### 5.3 Performance & SLAs
- Typical run (50–100 sources, 300–800 evidence units) under **10 minutes** on standard quota; parallelizable.  
- UI latency **<200 ms p95** for browsing evidence and claims.  
- **Retry & backoff** for transient fetch/LLM errors.

### 5.4 Accessibility & Localization
- WCAG 2.1 AA compliance.  
- Internationalization: English/Thai UI; date/time formatting (Asia/Bangkok default).  
- RTL layout support (future).

---

## 6) System Architecture (Conceptual)

**Front-End Web App**
- Persona workspace, evidence viewer, conflict console, review/approval, exports, admin console.

**Back-End Services**
1. **API Gateway** (authN/Z, rate limits)  
2. **Search Orchestrator** (query generation, provider calls)  
3. **Fetcher/Normalizer** (content fetch, parse, sanitize, dedupe, hashing)  
4. **Evidence Service** (unitization, indexing, topic tagging)  
5. **LLM Orchestrator** (attribution-bound prompts, citation enforcement, retries)  
6. **Scoring & Conflict Engine** (confidence, agreement, conflict notes)  
7. **Review & Versioning** (revisions, approvals, immutable snapshots)  
8. **Export Service** (Card/JSON/CSV/PDF with checksums)  
9. **Audit & Telemetry** (logs, metrics, alerts)

**Data Stores**
- **Document Store** (raw pages, normalized text, evidence units)  
- **Relational DB** (projects, claims, citations, runs, decisions, users)  
- **Object Store** (exports, manifests, PDF cards)  
- Optional vector index for semantic retrieval (future)

---

## 7) Data Model (Key Entities)

- **Project**: id, title, subject_type (real/fictional), languages[], created_by, created_at  
- **Run**: id, project_id, started_at, finished_at, params (JSON), search_queries[], provider meta  
- **Source**: id, run_id, url, domain, tier, title, fetch_time, content_hash, text_raw, text_normalized  
- **EvidenceUnit**: id, source_id, char_start, char_end, snippet, topic_candidates[], quality_score  
- **ClaimField**: id, project_id, name (Name/Role/Expertise/Mindset/Personality/Description), text, sentence_spans[]  
- **Citation**: id, claim_field_id, sentence_index, evidence_unit_id[]  
- **Confidence**: claim_field_id, value, components (agreement, evidence_count, source_quality, recency)  
- **ConflictNote**: claim_field_id, type, description, implicated_sources[]  
- **DecisionLog**: id, actor_id, action, target_id, rationale, timestamp  
- **Export**: id, project_id, type, file_uri, checksum, created_at

---

## 8) Workflow (End-to-End)

1. **Initialize Project** → set schema & subject type  
2. **Configure Search** → seed queries and constraints  
3. **Retrieve Sources** → fetch pages, normalize, tier  
4. **Unitize Evidence** → segment passages, tag topics, de-dup  
5. **Draft Persona (LLM)** → produce fields with **sentence-level citations** and rationale  
6. **Score & Detect Conflicts** → compute confidence, surface contradictions  
7. **Review** → side-by-side checks; accept/edit; capture decision log  
8. **Approve & Snapshot** → freeze outputs + all inputs/parameters for reproducibility  
9. **Export** → Card, JSON, Evidence Ledger, Decision Log, Run Manifest  
10. **Archive/Retain** → apply retention policy

---

## 9) Citation & Policy Rules

- **Per-Sentence Citation Required:** Every sentence in a field must reference ≥1 evidence unit.  
- **No Evidence, No Claim:** Missing citation → sentence blocked or red-flagged.  
- **Tier Preference:** When conflicts exist, prefer higher-tier sources unless reviewer overrides and logs rationale.  
- **Subjectivity Labels:** Adjectives must be attributable (e.g., interview quotes) or marked as interpretive with explicit source context.

---

## 10) Prompt & Guardrails (LLM)

**Inputs:** evidence units (text + metadata), field definition, subject type, style constraints  
**Constraints:**  
- Use only the supplied evidence units; **do not invent**.  
- Add **citations after each sentence** using evidence IDs.  
- Summarize **rationale (2–3 lines)** citing evidence IDs.  

**Blocklist:** speculative claims about private life or health; ungrounded opinions  
**Style:** neutral, formal, concise; avoid sensationalism

---

## 11) Quality Gates & KPIs

**Quality Gates (per field):**  
- Minimum **evidence count** (configurable) and at least **2 independent high-tier sources** for Role/Name  
- Confidence ≥ **0.70** for approval (default; reviewer can override with rationale)  
- Zero **uncited sentences**

**KPIs:**  
- % of fields meeting evidence threshold on first draft  
- Average review time per persona  
- # of conflicts per project and resolution rate  
- Inter-annotator agreement on approvals  
- Reproducibility: % of re-runs within ±5% confidence variance

---

## 12) Review & Governance

- **Two-person rule** (optional): draft by Researcher, approval by Reviewer  
- **Immutable Snapshots:** Approved versions cannot change; edits create new versions  
- **Comprehensive Audit Trail:** All actions logged with user, timestamp, and deltas  
- **Retention:** Configurable (e.g., 180 days for raw sources; indefinitely for manifests/exports), respecting deletion requests

---

## 13) Security, Legal, and Ethics

- **Compliance:** PDPA/GDPR-aligned processing of publicly available data; respect data subject rights (export/delete project data)  
- **IP/Fair Use:** Store snippets only (evidence units), never redistribute full copyrighted articles; always link to sources  
- **Risk Controls:** Domain allow/deny lists; profanity/harassment filter; rate limiters for providers  
- **PII Minimization:** Do not extract sensitive attributes unless directly and explicitly sourced from public statements; mark as sensitive and require admin approval

---

## 14) Telemetry & Observability

- **Metrics:** request counts, latency, error rates, provider quota, evidence unit counts  
- **Tracing:** Correlate search → fetch → unitization → LLM → scoring for each run  
- **Alerts:** provider failures, high conflict rates, citation omissions, export failures

---

## 15) Roadmap & Releases

**MVP (V1.0)**  
- Core pipeline (search, fetch, unitize, LLM extraction, citation enforcement)  
- Review UI, conflict notes, confidence scoring, exports (JSON/CSV/Markdown/PDF)  
- RBAC, audit logs, basic admin

**V1.1**  
- Pluggable vector search for semantic evidence retrieval  
- Batch projects; API webhooks; saved query libraries  
- Deeper i18n (Thai/English content hints)

**V2.0**  
- Multi-persona comparison, change-over-time diffs  
- Image/video transcript ingestion  
- Policy packs for regulated industries

---

## 16) Acceptance Criteria (Representative)

1. **Citation Enforcement:** Any sentence without at least one evidence citation is blocked from approval.  
2. **Reproducible Run:** Re-running with the same manifest (within 7 days) yields the same sources (or logged deltas) and field confidences within ±5%.  
3. **Conflict Visibility:** When two high-tier sources disagree, conflict is surfaced; reviewer decision and rationale recorded in the decision log.  
4. **Export Integrity:** Persona JSON, Evidence Ledger, Decision Log, and Run Manifest export with matching checksums and reference IDs.  
5. **Audit Snapshot:** Approved persona has an immutable snapshot bundling inputs, parameters, outputs, and logs.

---

## 17) Risks & Mitigations

- **Provider Changes/Outages:** Abstract search providers; implement fallbacks and cached manifests.  
- **LLM Hallucinations:** Evidence-only prompts, sentence-level citation requirement, and reviewer gate.  
- **Legal Complaints:** Fast project deletion/export; legal hold mode; clear source links and fair-use snippet limits.  
- **Bias & Defamation:** Tiered sourcing; subjectivity flags; require explicit quotes for contentious claims.

---

## 18) Open Questions

1. Minimum evidence thresholds per field for **real vs. fictional** personas?  
2. Should confidence thresholds be uniform or field-specific?  
3. Default retention for raw page text (e.g., 90/180 days)?  
4. Organization-wide domain allowlists/denylists at the admin level?

---

## Appendices

### A. Default Confidence Weights (Editable in Admin)
- Source-weighted agreement: **0.40**  
- Evidence count (normalized): **0.30**  
- Average source quality tier: **0.20**  
- Recency score (lower weight for fictional): **0.10**

### B. Default Source Tiers
1. **Tier 1:** Official/canonical (rights-holders, creator interviews), major encyclopedias  
2. **Tier 2:** Reputable news/industry references  
3. **Tier 3:** Franchise/community wikis with moderation  
4. **Tier 4:** Blogs/forums; used only to enrich, not anchor

### C. Export Formats
- **Persona JSON** (fields, sentence spans, citations, confidence, conflicts)  
- **Evidence Ledger CSV** (source_id, url, title, tier, unit_ids, hashes, timestamps)  
- **Decision Log CSV** (action, target, user, rationale, timestamp)  
- **Run Manifest JSON** (queries, parameters, model metadata, environment info)

---
