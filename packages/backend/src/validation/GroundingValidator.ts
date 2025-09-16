/**
 * Grounding Validator
 * 
 * Validates that LLM outputs are properly grounded in provided evidence.
 * Implements advanced grounding techniques and auto-retry mechanisms.
 */

import type { EvidenceUnit } from '@prisma/client';
import { 
  ClaimField, 
  PersonaExtractionRequest,
  PersonaExtractionResponse,
  EvidenceContext,
  LLMServiceError
} from '../types/llm';
import { CitationValidator, CitationValidationResult } from './CitationValidator';
import { PromptTemplateManager } from '../prompts/templates';

/**
 * Grounding validation configuration
 */
export interface GroundingValidationConfig {
  /** Maximum retry attempts for failed validations */
  maxRetryAttempts: number;
  /** Whether to progressively increase strictness on retries */
  progressiveStrictness: boolean;
  /** Minimum grounding score threshold (0.0-1.0) */
  minGroundingScore: number;
  /** Enable automatic retry with stricter prompts */
  enableAutoRetry: boolean;
  /** Timeout for validation operations (ms) */
  validationTimeoutMs: number;
  /** Whether to validate citation format in text */
  validateCitationFormat: boolean;
  /** Regex pattern for citation format validation */
  citationFormatPattern: string;
}

/**
 * Grounding validation result
 */
export interface GroundingValidationResult {
  isGrounded: boolean;
  groundingScore: number;
  citationValidation: CitationValidationResult;
  formatValidation: FormatValidationResult;
  retryAttempts: number;
  validationTimeMs: number;
  improvements: GroundingImprovement[];
  finalPrompt?: string;
}

/**
 * Format validation result
 */
export interface FormatValidationResult {
  isValid: boolean;
  errors: FormatValidationError[];
  citationsFound: number;
  citationsExpected: number;
  formatCompliance: number; // 0.0-1.0
}

/**
 * Format validation error
 */
export interface FormatValidationError {
  type: 'missing_citation_marker' | 'invalid_citation_format' | 'malformed_evidence_id' | 'duplicate_citation';
  message: string;
  position: number;
  text: string;
  suggestion?: string;
}

/**
 * Grounding improvement suggestion
 */
export interface GroundingImprovement {
  type: 'add_citation' | 'improve_alignment' | 'split_claim' | 'strengthen_evidence';
  description: string;
  impact: 'low' | 'medium' | 'high';
  claimFieldId: string;
  implementation: string;
}

/**
 * Retry strategy for failed validations
 */
export interface RetryStrategy {
  /** Prompt modifications to apply on retry */
  promptModifications: {
    increaseStrictness: boolean;
    addExamplesCitation: boolean;
    emphasizeGrounding: boolean;
    reduceTemperature: boolean;
  };
  /** Validation config changes for retry */
  validationChanges: {
    lowerConfidenceThreshold: boolean;
    increaseCitationDensity: boolean;
    enableSemanticValidation: boolean;
  };
}

/**
 * Default grounding validation configuration
 */
const DEFAULT_GROUNDING_CONFIG: GroundingValidationConfig = {
  maxRetryAttempts: 3,
  progressiveStrictness: true,
  minGroundingScore: 0.8,
  enableAutoRetry: true,
  validationTimeoutMs: 30000,
  validateCitationFormat: true,
  citationFormatPattern: '\\[evidence_[a-zA-Z0-9_-]+\\]'
};

/**
 * Grounding Validator Service
 */
export class GroundingValidator {
  private config: GroundingValidationConfig;
  private citationValidator: CitationValidator;
  private promptManager: PromptTemplateManager;

  constructor(config?: Partial<GroundingValidationConfig>) {
    this.config = { ...DEFAULT_GROUNDING_CONFIG, ...config };
    this.citationValidator = new CitationValidator();
    this.promptManager = new PromptTemplateManager();
  }

  /**
   * Validate grounding of persona extraction response
   */
  async validateGrounding(
    response: PersonaExtractionResponse,
    request: PersonaExtractionRequest,
    evidenceContext: EvidenceContext[]
  ): Promise<GroundingValidationResult> {
    const startTime = Date.now();
    
    try {
      // Perform citation validation
      const citationValidation = await this.citationValidator.validateCitations(
        response.claims,
        evidenceContext
      );

      // Perform format validation
      const formatValidation = this.validateCitationFormat(response.claims);

      // Calculate overall grounding score
      const groundingScore = this.calculateGroundingScore(
        citationValidation,
        formatValidation,
        response
      );

      // Generate improvement suggestions
      const improvements = this.generateImprovements(
        citationValidation,
        formatValidation,
        response.claims
      );

      const validationTimeMs = Date.now() - startTime;

      return {
        isGrounded: groundingScore >= this.config.minGroundingScore,
        groundingScore,
        citationValidation,
        formatValidation,
        retryAttempts: 0,
        validationTimeMs,
        improvements
      };

    } catch (error) {
      throw new LLMServiceError(
        `Grounding validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'validation_error',
        true
      );
    }
  }

  /**
   * Validate grounding with auto-retry mechanism
   */
  async validateWithAutoRetry(
    response: PersonaExtractionResponse,
    request: PersonaExtractionRequest,
    evidenceContext: EvidenceContext[],
    llmService: any // ILLMService interface
  ): Promise<GroundingValidationResult> {
    let currentResponse = response;
    let retryAttempts = 0;
    let lastValidationResult: GroundingValidationResult | null = null;

    while (retryAttempts <= this.config.maxRetryAttempts) {
      // Validate current response
      const validationResult = await this.validateGrounding(
        currentResponse,
        request,
        evidenceContext
      );

      validationResult.retryAttempts = retryAttempts;
      lastValidationResult = validationResult;

      // If validation passes or auto-retry is disabled, return result
      if (validationResult.isGrounded || !this.config.enableAutoRetry) {
        return validationResult;
      }

      // If we've exhausted retry attempts, return the last result
      if (retryAttempts >= this.config.maxRetryAttempts) {
        return validationResult;
      }

      // Prepare retry with modified request
      const retryRequest = this.createRetryRequest(
        request,
        validationResult,
        retryAttempts + 1
      );

      // Attempt retry
      try {
        currentResponse = await llmService.extractPersona(retryRequest);
        retryAttempts++;
      } catch (error) {
        // If retry fails, return last validation result
        console.warn(`Retry attempt ${retryAttempts + 1} failed:`, error);
        return validationResult;
      }
    }

    return lastValidationResult!;
  }

  /**
   * Validate citation format in claim text
   */
  private validateCitationFormat(claims: ClaimField[]): FormatValidationResult {
    const errors: FormatValidationError[] = [];
    let citationsFound = 0;
    let citationsExpected = 0;

    const citationRegex = new RegExp(this.config.citationFormatPattern, 'g');
    const duplicateTracker = new Set<string>();

    for (const claim of claims) {
      citationsExpected += claim.citations.length;

      // Find all citation markers in text
      const matches = Array.from(claim.text.matchAll(citationRegex));
      citationsFound += matches.length;

      // Check for missing citation markers
      if (matches.length < claim.citations.length) {
        errors.push({
          type: 'missing_citation_marker',
          message: `Expected ${claim.citations.length} citation markers, found ${matches.length}`,
          position: 0,
          text: claim.text,
          suggestion: 'Ensure each citation has a corresponding [evidence_id] marker in the text'
        });
      }

      // Validate citation format and check for duplicates
      for (const match of matches) {
        const citationText = match[0];
        const position = match.index || 0;

        // Check for duplicate citations
        if (duplicateTracker.has(citationText)) {
          errors.push({
            type: 'duplicate_citation',
            message: `Duplicate citation marker: ${citationText}`,
            position,
            text: citationText,
            suggestion: 'Remove duplicate citation or use different evidence'
          });
        } else {
          duplicateTracker.add(citationText);
        }

        // Validate evidence ID format
        const evidenceId = citationText.match(/evidence_([a-zA-Z0-9_-]+)/)?.[1];
        if (!evidenceId) {
          errors.push({
            type: 'malformed_evidence_id',
            message: `Malformed evidence ID in citation: ${citationText}`,
            position,
            text: citationText,
            suggestion: 'Use format [evidence_<id>] where <id> is a valid evidence unit ID'
          });
        }
      }
    }

    const formatCompliance = citationsExpected > 0 
      ? Math.min(citationsFound / citationsExpected, 1.0)
      : 1.0;

    return {
      isValid: errors.length === 0 && formatCompliance >= 0.9,
      errors,
      citationsFound,
      citationsExpected,
      formatCompliance
    };
  }

  /**
   * Calculate overall grounding score
   */
  private calculateGroundingScore(
    citationValidation: CitationValidationResult,
    formatValidation: FormatValidationResult,
    response: PersonaExtractionResponse
  ): number {
    const weights = {
      citationQuality: 0.4,
      formatCompliance: 0.2,
      evidenceUtilization: 0.2,
      confidenceAlignment: 0.2
    };

    // Citation quality score (based on validation errors)
    const criticalErrors = citationValidation.errors.filter(e => e.severity === 'critical').length;
    const highErrors = citationValidation.errors.filter(e => e.severity === 'high').length;
    const citationQualityScore = Math.max(0, 1 - (criticalErrors * 0.3 + highErrors * 0.2));

    // Format compliance score
    const formatScore = formatValidation.formatCompliance;

    // Evidence utilization score
    const utilizationScore = Math.min(citationValidation.statistics.evidenceUtilization / 80, 1.0);

    // Confidence alignment score (higher confidence should align with better grounding)
    const avgConfidence = citationValidation.statistics.averageConfidence;
    const confidenceScore = avgConfidence;

    return (
      weights.citationQuality * citationQualityScore +
      weights.formatCompliance * formatScore +
      weights.evidenceUtilization * utilizationScore +
      weights.confidenceAlignment * confidenceScore
    );
  }

  /**
   * Generate improvement suggestions
   */
  private generateImprovements(
    citationValidation: CitationValidationResult,
    formatValidation: FormatValidationResult,
    claims: ClaimField[]
  ): GroundingImprovement[] {
    const improvements: GroundingImprovement[] = [];

    // Analyze citation validation errors
    for (const error of citationValidation.errors) {
      if (error.type === 'insufficient_citations' && error.claimFieldId) {
        improvements.push({
          type: 'add_citation',
          description: `Add more citations to strengthen claim "${error.claimFieldId}"`,
          impact: 'high',
          claimFieldId: error.claimFieldId,
          implementation: 'Include additional evidence references with proper [evidence_id] format'
        });
      }

      if (error.type === 'semantic_mismatch' && error.claimFieldId) {
        improvements.push({
          type: 'improve_alignment',
          description: `Improve semantic alignment between claim and evidence`,
          impact: 'medium',
          claimFieldId: error.claimFieldId,
          implementation: 'Use evidence that more directly supports the specific claim being made'
        });
      }
    }

    // Analyze format validation errors
    for (const error of formatValidation.errors) {
      if (error.type === 'missing_citation_marker') {
        improvements.push({
          type: 'add_citation',
          description: 'Add missing citation markers in claim text',
          impact: 'high',
          claimFieldId: 'format_compliance',
          implementation: 'Ensure every claim sentence includes [evidence_id] citations'
        });
      }
    }

    // Check for claims that could be strengthened
    for (const claim of claims) {
      if (claim.confidence < 0.8 && claim.citations.length < 2) {
        improvements.push({
          type: 'strengthen_evidence',
          description: `Strengthen low-confidence claim "${claim.fieldName}" with additional evidence`,
          impact: 'medium',
          claimFieldId: claim.fieldName,
          implementation: 'Find additional supporting evidence or split into multiple more specific claims'
        });
      }
    }

    return improvements;
  }

  /**
   * Create retry request with modified parameters
   */
  private createRetryRequest(
    originalRequest: PersonaExtractionRequest,
    validationResult: GroundingValidationResult,
    retryAttempt: number
  ): PersonaExtractionRequest {
    const retryRequest: PersonaExtractionRequest = {
      ...originalRequest,
      constraints: {
        ...originalRequest.constraints,
        // Increase citation requirements on retry
        requireCitations: true,
        minConfidenceThreshold: Math.max(
          (originalRequest.constraints.minConfidenceThreshold || 0.7) - 0.1 * retryAttempt,
          0.5
        )
      }
    };

    // Progressive strictness: modify constraints based on retry attempt
    if (this.config.progressiveStrictness) {
      // Increase citation density requirements
      this.citationValidator.updateConfig({
        minCitationsPerSentence: Math.min(retryAttempt + 1, 3),
        semanticAlignmentThreshold: Math.max(0.7 - retryAttempt * 0.05, 0.6)
      });
    }

    return retryRequest;
  }

  /**
   * Generate stricter prompt for retry
   */
  generateStricterPrompt(
    originalRequest: PersonaExtractionRequest,
    validationErrors: string[],
    retryAttempt: number
  ): string {
    const errorSummary = validationErrors.slice(0, 3).join('; ');
    
    const stricterInstructions = `
IMPORTANT: The previous response had validation issues: ${errorSummary}

ENHANCED CITATION REQUIREMENTS FOR THIS RETRY (Attempt ${retryAttempt}):
1. EVERY sentence MUST have at least ${retryAttempt + 1} citations
2. Citation format: [evidence_id] immediately after relevant information
3. Only use information explicitly stated in evidence
4. If evidence is insufficient, state "Insufficient evidence" rather than inferring

EXAMPLE OF PROPER CITATION DENSITY:
"John Smith is a software engineer [evidence_123] working at Google [evidence_124] in Mountain View, California [evidence_125]."

FAILURE TO FOLLOW THESE ENHANCED REQUIREMENTS WILL RESULT IN REJECTION.
`;

    return stricterInstructions;
  }

  /**
   * Update validation configuration
   */
  updateConfig(config: Partial<GroundingValidationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current validation configuration
   */
  getConfig(): GroundingValidationConfig {
    return { ...this.config };
  }
}