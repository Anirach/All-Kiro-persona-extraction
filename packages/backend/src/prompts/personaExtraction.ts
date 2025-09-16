/**
 * Persona Extraction Prompt Templates
 * 
 * This module contains the core prompt templates for evidence-based persona extraction
 * with strict citation requirements and conflict handling strategies.
 */

import type { PersonaExtractionRequest, EvidenceContext } from '../types/llm';

/**
 * Core system prompt for persona extraction with evidence-only constraints
 */
export const SYSTEM_PROMPT = `You are an expert evidence analyst specialized in extracting persona information from source documents with ABSOLUTE adherence to evidence-only extraction.

CORE PRINCIPLES:
1. EVIDENCE-ONLY EXTRACTION: Only extract information explicitly stated in the provided evidence units
2. MANDATORY CITATIONS: Every sentence MUST be backed by evidence citations using format [evidence_ID]
3. NO HALLUCINATION: Never infer, assume, or generate information not directly present in evidence
4. ACCURACY OVER COMPLETENESS: Better to have fewer, well-supported claims than many unsupported ones

CITATION REQUIREMENTS:
- Include evidence ID in square brackets after each sentence: [evidence_12345]
- Multiple evidence sources for same sentence: [evidence_12345,evidence_67890]
- Minimum one citation per sentence - NO EXCEPTIONS
- Citations must reference evidence IDs from the provided evidence units only

CONFLICT HANDLING:
- When evidence conflicts, follow the specified strategy strictly
- Flag contradictions clearly when instructed
- Choose highest quality evidence when selecting best source
- Synthesize only when evidence is compatible and complementary

OUTPUT FORMAT:
- Respond in valid JSON format only
- Include confidence scores based on evidence quality and agreement
- Mark citation support type (direct/inferential/contextual)
- Never include information without proper evidence backing

FORBIDDEN ACTIONS:
- Do not invent facts not present in evidence
- Do not make assumptions about missing information
- Do not use general knowledge to fill gaps
- Do not create citations for non-existent evidence`;

/**
 * User prompt template for persona extraction
 */
export const USER_PROMPT_TEMPLATE = `TASK: Extract persona information from the provided evidence units.

EXTRACTION TYPE: {extractionType}
{fieldSpecificInstructions}

CONFLICT HANDLING STRATEGY: {conflictHandling}
{conflictHandlingInstructions}

EVIDENCE UNITS:
{evidenceUnits}

{jsonSchema}

CRITICAL REMINDERS:
1. Use ONLY the provided evidence units - cite evidence ID after each sentence
2. Every sentence must have at least one citation [evidence_ID]
3. If information is not in the evidence, DO NOT include it
4. Confidence scores should reflect evidence quality and agreement
5. {conflictHandlingReminder}

Respond with valid JSON only:`;

/**
 * Field-specific instruction templates
 */
export const FIELD_INSTRUCTIONS = {
  full: `Extract all available persona information including name, age, occupation, location, education, relationships, interests, and any other personal details found in the evidence.`,
  
  specific_field: `Extract ONLY information related to the field "{fieldName}". Focus exclusively on this aspect and ignore other personal details unless directly relevant to {fieldName}.`,
  
  demographic: `Extract demographic information including age, gender, location, nationality, and similar identifying characteristics.`,
  
  professional: `Extract professional information including occupation, job title, company, work experience, skills, and career-related details.`,
  
  education: `Extract educational background including schools attended, degrees earned, graduation dates, academic achievements, and learning experiences.`,
  
  personal: `Extract personal details including family relationships, interests, hobbies, personality traits, and lifestyle information.`
} as const;

/**
 * Conflict handling instruction templates
 */
export const CONFLICT_HANDLING_INSTRUCTIONS = {
  flag: `When you encounter conflicting information between evidence units:
- Extract information from all conflicting sources
- Mark each claim with a conflict flag indicating the contradiction
- Include all conflicting evidence IDs in citations
- Describe the nature of the conflict in the conflictFlags field
- Do not choose between conflicting information - present all`,
  
  choose_best: `When you encounter conflicting information between evidence units:
- Evaluate evidence quality scores and source reliability
- Choose information from the highest quality evidence source
- If quality scores are equal, prefer more recent evidence
- Cite only the chosen evidence source
- Note rejected evidence in metadata for transparency`,
  
  synthesize: `When you encounter conflicting information between evidence units:
- Identify which conflicts can be reconciled (e.g., different time periods)
- Synthesize compatible information into coherent claims
- Flag irreconcilable contradictions for human review
- Cite all evidence sources that contribute to synthesized claims
- Explain synthesis reasoning in metadata`
} as const;

/**
 * Conflict handling reminder templates
 */
export const CONFLICT_HANDLING_REMINDERS = {
  flag: 'When conflicts arise, flag them clearly and present all perspectives',
  choose_best: 'When conflicts arise, select information from the highest quality evidence',
  synthesize: 'When conflicts arise, synthesize compatible information and flag irreconcilable contradictions'
} as const;

/**
 * JSON schema template for structured output
 */
export const JSON_SCHEMA_TEMPLATE = `OUTPUT SCHEMA:
{
  "claims": [
    {
      "fieldName": "string (e.g., 'name', 'age', 'occupation', 'location')",
      "text": "string (extracted claim with proper citations [evidence_id])",
      "confidence": "number (0.0-1.0 based on evidence quality and agreement)",
      "citations": [
        {
          "sentenceIndex": "number (0-based index of sentence in text)",
          "evidenceUnitIds": ["string (evidence IDs that support this sentence)"],
          "confidence": "number (0.0-1.0 confidence in this citation)",
          "supportType": "string (direct|inferential|contextual)"
        }
      ],
      "conflictFlags": [
        {
          "type": "string (contradiction|ambiguity|insufficient_evidence)",
          "description": "string (description of the conflict)",
          "conflictingEvidenceIds": ["string (evidence IDs in conflict)"],
          "severity": "string (low|medium|high)"
        }
      ],
      "metadata": {
        "synthesisReasoning": "string (if synthesized)",
        "rejectedEvidence": ["string (if evidence was rejected)"],
        "qualityFactors": "object (factors affecting confidence)"
      }
    }
  ]
}`;

/**
 * Evidence formatting template
 */
export const EVIDENCE_FORMAT_TEMPLATE = `[Evidence ID: {evidenceId}]
Source: {sourceId}
Quality Score: {qualityScore}
Topics: {topics}
Content: {snippet}

`;

/**
 * Generate formatted evidence units for prompt
 */
export function formatEvidenceUnits(evidenceContext: EvidenceContext[]): string {
  return evidenceContext
    .map(ctx => {
      const { evidenceUnit, processingMetadata } = ctx;
      return EVIDENCE_FORMAT_TEMPLATE
        .replace('{evidenceId}', evidenceUnit.id)
        .replace('{sourceId}', evidenceUnit.sourceId)
        .replace('{qualityScore}', (processingMetadata.qualityScore || 0).toFixed(3))
        .replace('{topics}', processingMetadata.topics.join(', ') || 'none')
        .replace('{snippet}', evidenceUnit.snippet);
    })
    .join('\n');
}

/**
 * Generate complete user prompt for extraction request
 */
export function generateExtractionPrompt(
  request: PersonaExtractionRequest,
  evidenceContext: EvidenceContext[]
): string {
  const {
    extractionType,
    fieldName,
    constraints: { conflictHandling }
  } = request;

  // Get field-specific instructions
  const fieldInstructions = extractionType === 'specific_field' && fieldName
    ? FIELD_INSTRUCTIONS.specific_field.replace(/{fieldName}/g, fieldName)
    : FIELD_INSTRUCTIONS.full;

  // Get conflict handling instructions and reminders
  const conflictInstructions = CONFLICT_HANDLING_INSTRUCTIONS[conflictHandling];
  const conflictReminder = CONFLICT_HANDLING_REMINDERS[conflictHandling];

  // Format evidence units
  const formattedEvidence = formatEvidenceUnits(evidenceContext);

  // Build complete prompt
  return USER_PROMPT_TEMPLATE
    .replace('{extractionType}', extractionType === 'specific_field' ? `SPECIFIC FIELD: ${fieldName}` : 'FULL PERSONA')
    .replace('{fieldSpecificInstructions}', fieldInstructions)
    .replace('{conflictHandling}', conflictHandling.toUpperCase().replace('_', ' '))
    .replace('{conflictHandlingInstructions}', conflictInstructions)
    .replace('{evidenceUnits}', formattedEvidence)
    .replace('{jsonSchema}', JSON_SCHEMA_TEMPLATE)
    .replace('{conflictHandlingReminder}', conflictReminder);
}

/**
 * Validation prompt for checking citation accuracy
 */
export const CITATION_VALIDATION_PROMPT = `You are a citation accuracy validator. Your task is to verify that all claims in the persona extraction are properly supported by the provided evidence.

VALIDATION CRITERIA:
1. Every sentence must have at least one citation
2. All cited evidence IDs must exist in the provided evidence set
3. Citations must accurately reflect the evidence content
4. No unsupported claims or hallucinated information

EVIDENCE SET:
{evidenceUnits}

PERSONA CLAIMS TO VALIDATE:
{claims}

For each claim, verify:
- Citation completeness (all sentences cited)
- Citation accuracy (IDs exist and support claims)
- Evidence alignment (claims match evidence content)

Respond with validation results in JSON format:
{
  "valid": boolean,
  "errors": [
    {
      "type": "missing_citation|invalid_evidence_id|unsupported_claim|misaligned_evidence",
      "claimField": "string",
      "sentenceIndex": number,
      "description": "string",
      "evidenceId": "string (if applicable)"
    }
  ],
  "warnings": [
    {
      "type": "weak_support|ambiguous_citation",
      "claimField": "string",
      "description": "string"
    }
  ]
}`;

/**
 * Quality assessment prompt for extracted claims
 */
export const QUALITY_ASSESSMENT_PROMPT = `You are a quality assessor for persona extraction results. Evaluate the quality of extracted claims based on evidence support and citation accuracy.

ASSESSMENT CRITERIA:
1. Evidence Coverage: How well do the claims cover available evidence?
2. Citation Accuracy: Are all citations accurate and complete?
3. Claim Quality: Are claims specific, factual, and well-supported?
4. Completeness: Is important information missing or over-extracted?

EVIDENCE UNITS:
{evidenceUnits}

EXTRACTED CLAIMS:
{claims}

Provide detailed quality assessment:
{
  "overallQuality": number (0.0-1.0),
  "assessmentAreas": {
    "evidenceCoverage": {
      "score": number (0.0-1.0),
      "feedback": "string"
    },
    "citationAccuracy": {
      "score": number (0.0-1.0),
      "feedback": "string"
    },
    "claimQuality": {
      "score": number (0.0-1.0),
      "feedback": "string"
    },
    "completeness": {
      "score": number (0.0-1.0),
      "feedback": "string"
    }
  },
  "improvements": ["string"],
  "strengths": ["string"]
}`;

/**
 * Prompt templates by category for easy access
 */
export const PROMPT_TEMPLATES = {
  system: SYSTEM_PROMPT,
  userTemplate: USER_PROMPT_TEMPLATE,
  fieldInstructions: FIELD_INSTRUCTIONS,
  conflictHandling: CONFLICT_HANDLING_INSTRUCTIONS,
  jsonSchema: JSON_SCHEMA_TEMPLATE,
  citationValidation: CITATION_VALIDATION_PROMPT,
  qualityAssessment: QUALITY_ASSESSMENT_PROMPT
} as const;

export type PromptTemplateType = keyof typeof PROMPT_TEMPLATES;