# Copilot Instructions

## Project Context
This is a web platform for traceable, evidence-bound persona extraction using LLMs. Every claim must be backed by explicit evidence with citations.

## General Guidelines
- **Prefer TypeScript** for all new code (frontend and backend)
- **Follow repository rules** defined in `GITHUB_RULES.md`
- **Respect system behavior** and data model outlined in `Spec.md`
- **Use Prisma Client** for all database operations; avoid raw SQL unless absolutely necessary
- **Maintain evidence traceability** - every persona claim must have verifiable sources

## Code Quality Standards
- **Functions should be small and pure** when possible
- **Document inputs and outputs** with JSDoc comments
- **Include basic tests** when adding new logic or features
- **Error handling**: Always handle errors gracefully with meaningful messages
- **No secrets in code**: Never commit API keys, passwords, or sensitive data

## Evidence-Citation Patterns (Critical)
When working with LLM-related code, enforce these patterns per `Spec.md`:

```typescript
// ✅ Good: Every sentence has citations
interface ClaimField {
  text: string;
  citations: Citation[];
  confidence: number;
  evidenceIds: string[];
}

// ✅ Good: Evidence-only prompts
const prompt = `
Use ONLY the provided evidence units. 
Cite evidence ID after each sentence: [evidence_123]
Do not invent facts not present in evidence.
`;

// ❌ Bad: Unsupported claims
const personaText = "John is probably a nice person"; // No evidence cited
```

## Database Patterns
- **Use Prisma schema** defined in `prisma/schema.prisma`
- **Maintain referential integrity** between evidence, claims, and citations
- **SQLite is the target database** for this project
- **Include database migrations** when changing schema

```typescript
// ✅ Good: Proper evidence linking
const claimField = await prisma.claimField.create({
  data: {
    text: "Software engineer at Google",
    citations: {
      create: [{
        sentenceIndex: 0,
        evidenceUnitIds: JSON.stringify(["unit_123", "unit_456"])
      }]
    }
  }
});

// ❌ Bad: Claims without evidence tracking
const claim = "Software engineer"; // Missing citation relationship
```

## API Design Principles
- **RESTful endpoints** with clear resource naming
- **Consistent error responses** with proper HTTP status codes
- **Input validation** on all endpoints
- **Audit logging** for data modifications
- **Pagination** for list endpoints

## Frontend Guidelines
- **Component composition** over large monolithic components
- **Accessibility first** - follow WCAG 2.1 AA guidelines
- **Performance conscious** - lazy loading, code splitting
- **Evidence review UI** should show claim-to-evidence relationships clearly

## Security & Privacy
- **PDPA/GDPR compliance** - minimal data collection, export/delete capabilities
- **No PII in logs** or error messages
- **Secure by default** - validate all inputs, sanitize outputs
- **Rate limiting** for external API calls

## Performance Considerations
- **Database queries**: Use select/include judiciously with Prisma
- **Caching strategies**: Cache evidence processing results when appropriate
- **Batch operations**: Process evidence units in batches, not individually
- **Memory usage**: Be mindful of large text processing operations

## Testing Approach
- **Unit tests** for business logic and evidence processing
- **Integration tests** for API endpoints
- **E2E tests** for critical user flows (persona creation, review)
- **Mock external services** (search providers, LLM APIs)

## Documentation Standards
- **README updates** when adding new features or changing setup
- **API documentation** for new endpoints
- **Architecture Decision Records (ADRs)** for significant technical choices
- **Inline comments** for complex business logic, especially around confidence scoring

## Prompt Engineering Guidelines
For LLM integration code:
- **Evidence-only constraints** - never allow hallucination
- **Citation enforcement** - require evidence ID after every sentence
- **Confidence metadata** - capture reasoning and evidence density
- **Conflict detection** - flag contradictory evidence sources

## Common Pitfalls to Avoid
- ❌ Creating claims without proper evidence linkage
- ❌ Skipping confidence score calculations
- ❌ Missing audit trail for human decisions
- ❌ Exposing personal data in public exports
- ❌ Hardcoding search provider specifics (keep pluggable)
- ❌ Ignoring source quality tiers in evidence processing

## Examples of Good Patterns

### Evidence Processing
```typescript
interface EvidenceUnit {
  id: string;
  sourceId: string;
  snippet: string;
  confidenceScore: number;
  topicCandidates: string[];
}

async function processEvidenceUnits(sourceText: string): Promise<EvidenceUnit[]> {
  // Segment into 200-400 char units
  // Deduplicate similar units
  // Score relevance and quality
  // Return with proper metadata
}
```

### Confidence Scoring
```typescript
function calculateFieldConfidence(field: ClaimField): number {
  const weights = {
    sourceAgreement: 0.4,
    evidenceCount: 0.3,
    sourceQuality: 0.2,
    recency: 0.1
  };
  
  return (
    weights.sourceAgreement * getSourceAgreement(field) +
    weights.evidenceCount * getNormalizedEvidenceCount(field) +
    weights.sourceQuality * getAverageSourceQuality(field) +
    weights.recency * getRecencyScore(field)
  );
}
```

## When in Doubt
1. Check `Spec.md` for system requirements
2. Refer to `GITHUB_RULES.md` for process guidance
3. Prioritize evidence traceability over convenience
4. Ask for clarification rather than assuming requirements