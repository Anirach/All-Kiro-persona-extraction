import OpenAI from 'openai';
import { config } from '../config/env';

/**
 * OpenAI service for persona extraction with evidence-based constraints
 */
export class OpenAIService {
  private client: OpenAI;

  constructor() {
    if (!config.openai.apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  /**
   * Extract persona fields from evidence units with strict citation requirements
   */
  async extractPersona(params: {
    subjectName: string;
    subjectType: 'real' | 'fictional';
    evidenceUnits: EvidenceUnit[];
    language?: string;
  }): Promise<PersonaExtractionResult> {
    const { subjectName, subjectType, evidenceUnits, language = 'English' } = params;

    // Build evidence context
    const evidenceContext = evidenceUnits
      .map((unit, index) => `[${unit.id}] ${unit.snippet}`)
      .join('\n\n');

    const prompt = this.buildPersonaExtractionPrompt({
      subjectName,
      subjectType,
      evidenceContext,
      language,
    });

    try {
      const response = await this.client.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: 'You are a careful, fact-based biographer who only uses provided evidence.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: config.openai.maxTokens,
        temperature: config.openai.temperature,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content received from OpenAI');
      }

      const parsed = JSON.parse(content) as PersonaExtractionResponse;
      return this.validateAndProcessResponse(parsed, evidenceUnits);
    } catch (error) {
      console.error('OpenAI extraction failed:', error);
      throw new Error(`Persona extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build the persona extraction prompt with evidence-only constraints
   */
  private buildPersonaExtractionPrompt(params: {
    subjectName: string;
    subjectType: 'real' | 'fictional';
    evidenceContext: string;
    language: string;
  }): string {
    const { subjectName, subjectType, evidenceContext, language } = params;

    return `
TASK: Extract persona information for "${subjectName}" (${subjectType} person) using ONLY the provided evidence.

EVIDENCE UNITS:
${evidenceContext}

STRICT REQUIREMENTS:
1. Use ONLY information present in the evidence units above
2. Cite evidence unit ID [evidence_id] after each sentence
3. If insufficient evidence exists for a field, write "Insufficient evidence"
4. Do not invent, assume, or extrapolate beyond what's explicitly stated
5. For conflicting evidence, note the conflict with source IDs

OUTPUT FORMAT (JSON):
{
  "name": {
    "text": "Full name with [evidence_id] citations",
    "confidence": 0.0-1.0,
    "evidenceIds": ["id1", "id2"],
    "rationale": "Brief explanation of evidence basis"
  },
  "role": {
    "text": "Primary role/position with [evidence_id] citations",
    "confidence": 0.0-1.0,
    "evidenceIds": ["id1", "id2"],
    "rationale": "Brief explanation of evidence basis"
  },
  "expertise": {
    "text": "Areas of expertise (comma-separated) with [evidence_id] citations",
    "confidence": 0.0-1.0,
    "evidenceIds": ["id1", "id2"],
    "rationale": "Brief explanation of evidence basis"
  },
  "mindset": {
    "text": "Decision-making style and principles with [evidence_id] citations",
    "confidence": 0.0-1.0,
    "evidenceIds": ["id1", "id2"],
    "rationale": "Brief explanation of evidence basis"
  },
  "personality": {
    "text": "Character traits (semicolon-separated) with [evidence_id] citations",
    "confidence": 0.0-1.0,
    "evidenceIds": ["id1", "id2"],
    "rationale": "Brief explanation of evidence basis"
  },
  "description": {
    "text": "Summary description with [evidence_id] citations",
    "confidence": 0.0-1.0,
    "evidenceIds": ["id1", "id2"],
    "rationale": "Brief explanation of evidence basis"
  },
  "conflicts": [
    {
      "field": "field_name",
      "description": "Description of conflicting evidence",
      "conflictingIds": ["id1", "id2"]
    }
  ]
}

LANGUAGE: ${language}
SUBJECT TYPE: ${subjectType === 'real' ? 'Real person - be conservative with claims' : 'Fictional character - use canonical sources'}

Remember: Every sentence must have an evidence citation. No evidence = no claim.
`.trim();
  }

  /**
   * Validate and process the LLM response
   */
  private validateAndProcessResponse(
    response: PersonaExtractionResponse,
    evidenceUnits: EvidenceUnit[]
  ): PersonaExtractionResult {
    const evidenceIdMap = new Map(evidenceUnits.map(unit => [unit.id, unit]));

    // Validate all cited evidence IDs exist
    const allCitedIds = new Set<string>();
    Object.values(response).forEach(field => {
      if (typeof field === 'object' && field.evidenceIds) {
        field.evidenceIds.forEach(id => allCitedIds.add(id));
      }
    });

    const invalidIds = Array.from(allCitedIds).filter(id => !evidenceIdMap.has(id));
    if (invalidIds.length > 0) {
      throw new Error(`Invalid evidence IDs cited: ${invalidIds.join(', ')}`);
    }

    // Process and validate each field
    const processedFields = Object.entries(response)
      .filter(([key]) => key !== 'conflicts')
      .map(([fieldName, field]) => ({
        name: fieldName,
        text: field.text,
        confidence: Math.max(0, Math.min(1, field.confidence)), // Clamp to 0-1
        evidenceIds: field.evidenceIds,
        rationale: field.rationale,
        citations: this.extractCitations(field.text, field.evidenceIds),
      }));

    return {
      fields: processedFields,
      conflicts: response.conflicts || [],
      processingMeta: {
        totalEvidenceUnits: evidenceUnits.length,
        citedEvidenceUnits: allCitedIds.size,
        averageConfidence: processedFields.reduce((sum, f) => sum + f.confidence, 0) / processedFields.length,
        extractedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Extract citation information from text
   */
  private extractCitations(text: string, evidenceIds: string[]): Citation[] {
    const citationRegex = /\[([^\]]+)\]/g;
    const citations: Citation[] = [];
    let match;
    let sentenceIndex = 0;

    // Split text into sentences and find citations
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());
    
    sentences.forEach((sentence, index) => {
      const sentenceCitations: string[] = [];
      while ((match = citationRegex.exec(sentence)) !== null) {
        const citedId = match[1];
        if (evidenceIds.includes(citedId)) {
          sentenceCitations.push(citedId);
        }
      }

      if (sentenceCitations.length > 0) {
        citations.push({
          sentenceIndex: index,
          evidenceUnitIds: sentenceCitations,
          text: sentence.trim(),
        });
      }
    });

    return citations;
  }

  /**
   * Test connection to OpenAI API
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5,
      });
      return !!response.choices[0]?.message?.content;
    } catch (error) {
      console.error('OpenAI connection test failed:', error);
      return false;
    }
  }
}

// Types
interface EvidenceUnit {
  id: string;
  sourceId: string;
  snippet: string;
  topicCandidates: string[];
  qualityScore: number;
}

interface PersonaField {
  text: string;
  confidence: number;
  evidenceIds: string[];
  rationale: string;
}

interface PersonaExtractionResponse {
  name: PersonaField;
  role: PersonaField;
  expertise: PersonaField;
  mindset: PersonaField;
  personality: PersonaField;
  description: PersonaField;
  conflicts?: Array<{
    field: string;
    description: string;
    conflictingIds: string[];
  }>;
}

interface Citation {
  sentenceIndex: number;
  evidenceUnitIds: string[];
  text: string;
}

interface PersonaExtractionResult {
  fields: Array<{
    name: string;
    text: string;
    confidence: number;
    evidenceIds: string[];
    rationale: string;
    citations: Citation[];
  }>;
  conflicts: Array<{
    field: string;
    description: string;
    conflictingIds: string[];
  }>;
  processingMeta: {
    totalEvidenceUnits: number;
    citedEvidenceUnits: number;
    averageConfidence: number;
    extractedAt: string;
  };
}

export default OpenAIService;
