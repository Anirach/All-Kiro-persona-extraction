# ADR-002: LLM Provider Strategy and Fallback Options

**Status:** Accepted  
**Date:** 2025-09-15  
**Deciders:** Development Team  
**Technical Story:** TASK-013 OpenAI Service Implementation  

## Context and Problem Statement

We need to select a Large Language Model (LLM) provider strategy for evidence-based persona extraction that ensures reliable citation grounding, cost-effectiveness, and flexibility to adapt to rapidly evolving LLM capabilities. The system must prevent hallucination while extracting structured persona data from evidence units.

## Decision Drivers

* **Citation Accuracy:** Ability to follow strict evidence-only constraints
* **Structured Output:** Reliable JSON mode or function calling capabilities
* **Cost Management:** Predictable costs for text processing workloads
* **Reliability:** High availability and consistent response quality
* **Performance:** Low latency for interactive persona review workflows
* **Flexibility:** Ability to switch providers or models based on capabilities
* **Compliance:** Data privacy and processing location requirements
* **Grounding:** Strong performance on citation and attribution tasks

## Considered Options

* **OpenAI GPT-4** - Primary provider with function calling
* **Anthropic Claude** - Alternative provider with constitutional AI
* **Local LLM** - Self-hosted models (Llama 2, Mistral)
* **Multi-provider approach** - Abstract interface with multiple backends

## Decision Outcome

Chosen option: "Multi-provider approach with OpenAI GPT-4 as primary", because it provides the best balance of reliability, citation accuracy, and flexibility to adapt to changing LLM landscape.

### Positive Consequences

* **Provider Independence:** Not locked into single vendor
* **Quality Optimization:** Can choose best model for specific tasks
* **Cost Optimization:** Switch to cheaper alternatives when appropriate
* **Risk Mitigation:** Fallback options if primary provider has issues
* **Future-Proofing:** Easy to integrate new models as they become available
* **A/B Testing:** Compare model performance on same evidence sets

### Negative Consequences

* **Implementation Complexity:** More code to maintain multiple providers
* **Testing Overhead:** Need to test across multiple LLM providers
* **Configuration Management:** Complex environment variable setup
* **Consistency Challenges:** Different models may produce varying outputs

## Pros and Cons of the Options

### OpenAI GPT-4 (Primary)

* Good, because excellent function calling for structured JSON outputs
* Good, because strong performance on citation and grounding tasks
* Good, because reliable API with good uptime and support
* Good, because extensive documentation and community examples
* Good, because JSON mode ensures valid structured responses
* Bad, because higher cost per token compared to alternatives
* Bad, because data sent to external service (privacy considerations)
* Bad, because potential vendor lock-in if not abstracted properly

### Anthropic Claude (Secondary)

* Good, because constitutional AI training for better instruction following
* Good, because strong performance on complex reasoning tasks
* Good, because good citation and attribution capabilities
* Good, because competitive pricing with OpenAI
* Bad, because less mature API compared to OpenAI
* Bad, because fewer examples for structured output patterns
* Bad, because function calling capabilities less developed

### Local LLM (Tertiary)

* Good, because complete data privacy and control
* Good, because no per-token costs after setup
* Good, because customizable for specific evidence extraction tasks
* Good, because no dependency on external services
* Bad, because requires significant infrastructure and maintenance
* Bad, because generally lower quality than frontier models
* Bad, because limited structured output capabilities
* Bad, because need expertise for model fine-tuning and deployment

### Multi-provider Approach

* Good, because maximum flexibility and risk mitigation
* Good, because can optimize for cost vs quality trade-offs
* Good, because enables comparative evaluation of models
* Good, because future-proof against provider changes
* Bad, because increased implementation and testing complexity
* Bad, because need to handle different API patterns and rate limits
* Bad, because configuration management complexity

## Links

* [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)
* [Anthropic Claude API](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)
* [LLaMA Model Documentation](https://llama.meta.com/)

## Implementation Notes

### Provider Abstraction Interface

```typescript
interface LLMProvider {
  name: string;
  generatePersona(request: PersonaExtractionRequest): Promise<PersonaResponse>;
  validateCitations(response: PersonaResponse): Promise<ValidationResult>;
  estimateCost(request: PersonaExtractionRequest): Promise<CostEstimate>;
}

class OpenAIProvider implements LLMProvider { ... }
class AnthropicProvider implements LLMProvider { ... }
class LocalLLMProvider implements LLMProvider { ... }
```

### Configuration Strategy

```typescript
// Environment-based provider selection
LLM_PROVIDER=openai              // Primary: OpenAI GPT-4
LLM_FALLBACK_PROVIDER=anthropic  // Secondary: Claude
LLM_LOCAL_ENABLED=false          // Tertiary: Local models

// Provider-specific configuration
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4-1106-preview
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-3-opus
```

### Cost Management Strategy

**Usage Tracking:**
```typescript
interface UsageMetrics {
  provider: string;
  model: string;
  tokensUsed: number;
  cost: number;
  timestamp: Date;
  evidenceUnitsProcessed: number;
}
```

**Cost Optimization Rules:**
- Use GPT-4 for complex persona extraction
- Use GPT-3.5-turbo for citation validation
- Switch to Anthropic if OpenAI quota exceeded
- Local fallback for development and testing

### Quality Assurance Framework

**Citation Validation Pipeline:**
1. Primary LLM generates persona with citations
2. Secondary validation checks citation accuracy
3. Grounding evaluator scores attribution quality
4. Human review for low-confidence extractions

**Model Performance Monitoring:**
```typescript
interface ModelPerformance {
  citationAccuracy: number;      // % of citations that reference correct evidence
  groundingScore: number;        // AIS (Attributable to Identified Sources)
  responseTime: number;          // Average API response time
  costPerExtraction: number;     // Cost per persona extraction
}
```

### Fallback Strategy

**Tier 1:** OpenAI GPT-4
- Primary for all persona extractions
- JSON mode for structured outputs
- Function calling for citation validation

**Tier 2:** Anthropic Claude
- Fallback if OpenAI unavailable or quota exceeded
- Alternative prompting strategy for structured output
- Manual citation extraction if needed

**Tier 3:** Local LLM
- Development and testing environment
- Offline capability for sensitive data
- Fallback for cost-constrained scenarios

## Monitoring and Review

**Success Metrics:**
- Citation accuracy rate (target: >95%)
- Grounding evaluation scores (AIS >0.85)
- Cost per persona extraction
- API reliability and response times
- User satisfaction with persona quality

**Review Triggers:**
- New frontier models released (GPT-5, Claude-4, etc.)
- Significant cost changes from providers
- Citation accuracy drops below threshold
- API reliability issues from primary provider

**Review Schedule:**
- Monthly cost and performance analysis
- Quarterly model comparison evaluation
- Annual strategy review for new providers/models
- Ad-hoc reviews when new capabilities emerge

**Migration Considerations:**
- New models with better citation capabilities
- Local hosting becomes cost-effective
- Regulatory requirements change data processing rules
- Open-source models reach frontier performance levels
