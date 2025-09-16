/**
 * Citation Validator
 * 
 * Validates LLM responses for proper evidence attribution and citation compliance.
 * Ensures all claims are properly grounded in provided evidence units.
 */

import type { EvidenceUnit } from '@prisma/client';
import { 
  ClaimField, 
  CitationInfo, 
  ValidationError,
  EvidenceContext 
} from '../types/llm';

/**
 * Citation validation configuration
 */
export interface CitationValidationConfig {
  /** Minimum citations required per sentence */
  minCitationsPerSentence: number;
  /** Maximum citations allowed per sentence */
  maxCitationsPerSentence: number;
  /** Minimum confidence threshold for citations */
  minCitationConfidence: number;
  /** Whether to require semantic alignment validation */
  requireSemanticAlignment: boolean;
  /** Similarity threshold for semantic alignment (0.0-1.0) */
  semanticAlignmentThreshold: number;
  /** Whether to allow partial citations */
  allowPartialCitations: boolean;
}

/**
 * Citation validation result
 */
export interface CitationValidationResult {
  isValid: boolean;
  errors: CitationValidationError[];
  warnings: CitationValidationWarning[];
  statistics: CitationStatistics;
  suggestions: CitationSuggestion[];
}

/**
 * Citation validation error
 */
export interface CitationValidationError {
  type: 'missing_evidence' | 'insufficient_citations' | 'invalid_format' | 'semantic_mismatch' | 'confidence_too_low';
  message: string;
  claimFieldId?: string;
  sentenceIndex?: number;
  evidenceId?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details?: Record<string, any>;
}

/**
 * Citation validation warning
 */
export interface CitationValidationWarning {
  type: 'redundant_citations' | 'low_confidence' | 'weak_alignment' | 'citation_density';
  message: string;
  claimFieldId?: string;
  sentenceIndex?: number;
  suggestion?: string;
}

/**
 * Citation statistics
 */
export interface CitationStatistics {
  totalClaims: number;
  totalSentences: number;
  totalCitations: number;
  averageCitationsPerSentence: number;
  averageConfidence: number;
  evidenceUtilization: number; // Percentage of evidence units cited
  validCitations: number;
  invalidCitations: number;
}

/**
 * Citation improvement suggestion
 */
export interface CitationSuggestion {
  type: 'add_citation' | 'remove_citation' | 'improve_alignment' | 'split_sentence';
  message: string;
  claimFieldId: string;
  sentenceIndex: number;
  suggestedEvidenceIds?: string[];
  confidence?: number;
}

/**
 * Default citation validation configuration
 */
const DEFAULT_VALIDATION_CONFIG: CitationValidationConfig = {
  minCitationsPerSentence: 1,
  maxCitationsPerSentence: 3,
  minCitationConfidence: 0.7,
  requireSemanticAlignment: true,
  semanticAlignmentThreshold: 0.75,
  allowPartialCitations: false
};

/**
 * Citation Validator Service
 */
export class CitationValidator {
  private config: CitationValidationConfig;

  constructor(config?: Partial<CitationValidationConfig>) {
    this.config = { ...DEFAULT_VALIDATION_CONFIG, ...config };
  }

  /**
   * Validate citations for a set of claim fields
   */
  async validateCitations(
    claims: ClaimField[],
    evidenceContext: EvidenceContext[]
  ): Promise<CitationValidationResult> {
    const errors: CitationValidationError[] = [];
    const warnings: CitationValidationWarning[] = [];
    const suggestions: CitationSuggestion[] = [];

    // Extract evidence units for quick lookup
    const evidenceMap = new Map<string, EvidenceUnit>();
    evidenceContext.forEach(ctx => {
      evidenceMap.set(ctx.evidenceUnit.id, ctx.evidenceUnit);
    });

    let totalSentences = 0;
    let totalCitations = 0;
    let validCitations = 0;
    let invalidCitations = 0;
    let totalConfidence = 0;

    // Validate each claim field
    for (const claim of claims) {
      const claimErrors = await this.validateClaimField(
        claim, 
        evidenceMap, 
        evidenceContext
      );
      
      errors.push(...claimErrors.errors);
      warnings.push(...claimErrors.warnings);
      suggestions.push(...claimErrors.suggestions);

      // Update statistics
      const sentences = this.splitIntoSentences(claim.text);
      totalSentences += sentences.length;
      totalCitations += claim.citations.length;
      
      claim.citations.forEach(citation => {
        if (citation.confidence >= this.config.minCitationConfidence) {
          validCitations++;
        } else {
          invalidCitations++;
        }
        totalConfidence += citation.confidence;
      });
    }

    // Calculate statistics
    const statistics: CitationStatistics = {
      totalClaims: claims.length,
      totalSentences,
      totalCitations,
      averageCitationsPerSentence: totalSentences > 0 ? totalCitations / totalSentences : 0,
      averageConfidence: totalCitations > 0 ? totalConfidence / totalCitations : 0,
      evidenceUtilization: this.calculateEvidenceUtilization(claims, evidenceMap),
      validCitations,
      invalidCitations
    };

    return {
      isValid: errors.filter(e => e.severity === 'critical' || e.severity === 'high').length === 0,
      errors,
      warnings,
      statistics,
      suggestions
    };
  }

  /**
   * Validate a single claim field
   */
  private async validateClaimField(
    claim: ClaimField,
    evidenceMap: Map<string, EvidenceUnit>,
    evidenceContext: EvidenceContext[]
  ): Promise<{
    errors: CitationValidationError[];
    warnings: CitationValidationWarning[];
    suggestions: CitationSuggestion[];
  }> {
    const errors: CitationValidationError[] = [];
    const warnings: CitationValidationWarning[] = [];
    const suggestions: CitationSuggestion[] = [];

    // Split claim text into sentences
    const sentences = this.splitIntoSentences(claim.text);

    // Validate each citation
    for (const citation of claim.citations) {
      // Check if evidence IDs exist
      for (const evidenceId of citation.evidenceUnitIds) {
        if (!evidenceMap.has(evidenceId)) {
          errors.push({
            type: 'missing_evidence',
            message: `Referenced evidence ID '${evidenceId}' not found in provided evidence units`,
            claimFieldId: claim.fieldName,
            sentenceIndex: citation.sentenceIndex,
            evidenceId,
            severity: 'critical'
          });
        }
      }

      // Check sentence index bounds
      if (citation.sentenceIndex >= sentences.length) {
        errors.push({
          type: 'invalid_format',
          message: `Citation sentence index ${citation.sentenceIndex} exceeds claim sentence count ${sentences.length}`,
          claimFieldId: claim.fieldName,
          sentenceIndex: citation.sentenceIndex,
          severity: 'high'
        });
        continue;
      }

      // Check citation confidence
      if (citation.confidence < this.config.minCitationConfidence) {
        errors.push({
          type: 'confidence_too_low',
          message: `Citation confidence ${citation.confidence.toFixed(3)} below minimum threshold ${this.config.minCitationConfidence}`,
          claimFieldId: claim.fieldName,
          sentenceIndex: citation.sentenceIndex,
          severity: 'medium',
          details: { confidence: citation.confidence, threshold: this.config.minCitationConfidence }
        });
      }

      // Validate semantic alignment if required
      if (this.config.requireSemanticAlignment) {
        const sentence = sentences[citation.sentenceIndex];
        if (sentence) {
          const alignmentResult = await this.validateSemanticAlignment(
            sentence,
            citation.evidenceUnitIds,
            evidenceMap
          );

          if (!alignmentResult.isAligned) {
            errors.push({
              type: 'semantic_mismatch',
              message: `Weak semantic alignment between sentence and cited evidence (${alignmentResult.score.toFixed(3)} < ${this.config.semanticAlignmentThreshold})`,
              claimFieldId: claim.fieldName,
              sentenceIndex: citation.sentenceIndex,
              severity: 'medium',
              details: { alignmentScore: alignmentResult.score, threshold: this.config.semanticAlignmentThreshold }
            });
          } else if (alignmentResult.score < this.config.semanticAlignmentThreshold + 0.1) {
            warnings.push({
              type: 'weak_alignment',
              message: `Semantic alignment is acceptable but could be stronger (${alignmentResult.score.toFixed(3)})`,
              claimFieldId: claim.fieldName,
              sentenceIndex: citation.sentenceIndex,
              suggestion: 'Consider using more directly relevant evidence'
            });
          }
        }
      }
    }

    // Check citation density for each sentence
    for (let i = 0; i < sentences.length; i++) {
      const sentenceCitations = claim.citations.filter(c => c.sentenceIndex === i);
      
      if (sentenceCitations.length < this.config.minCitationsPerSentence) {
        errors.push({
          type: 'insufficient_citations',
          message: `Sentence ${i} has ${sentenceCitations.length} citations, minimum required: ${this.config.minCitationsPerSentence}`,
          claimFieldId: claim.fieldName,
          sentenceIndex: i,
          severity: 'high'
        });

        // Suggest potential evidence
        const sentence = sentences[i];
        if (sentence) {
          const potentialEvidence = await this.findPotentialEvidence(
            sentence,
            evidenceContext
          );
          
          if (potentialEvidence.length > 0) {
            suggestions.push({
              type: 'add_citation',
              message: `Consider adding citations to sentence ${i}`,
              claimFieldId: claim.fieldName,
              sentenceIndex: i,
              suggestedEvidenceIds: potentialEvidence.slice(0, 2).map(e => e.evidenceUnit.id),
              confidence: Math.max(...potentialEvidence.slice(0, 2).map(e => e.score))
            });
          }
        }
      } else if (sentenceCitations.length > this.config.maxCitationsPerSentence) {
        warnings.push({
          type: 'redundant_citations',
          message: `Sentence ${i} has ${sentenceCitations.length} citations, which may be excessive`,
          claimFieldId: claim.fieldName,
          sentenceIndex: i,
          suggestion: `Consider reducing to ${this.config.maxCitationsPerSentence} most relevant citations`
        });
      }
    }

    return { errors, warnings, suggestions };
  }

  /**
   * Validate semantic alignment between a sentence and evidence units
   */
  private async validateSemanticAlignment(
    sentence: string,
    evidenceIds: string[],
    evidenceMap: Map<string, EvidenceUnit>
  ): Promise<{ isAligned: boolean; score: number; details: any }> {
    // Get evidence snippets
    const evidenceSnippets = evidenceIds
      .map(id => evidenceMap.get(id)?.snippet)
      .filter(Boolean) as string[];

    if (evidenceSnippets.length === 0) {
      return { isAligned: false, score: 0, details: { reason: 'No valid evidence found' } };
    }

    // Simple semantic similarity using token overlap (can be enhanced with embeddings)
    const sentenceTokens = this.tokenize(sentence.toLowerCase());
    let maxSimilarity = 0;
    let bestMatch = '';

    for (const snippet of evidenceSnippets) {
      const snippetTokens = this.tokenize(snippet.toLowerCase());
      const similarity = this.calculateTokenSimilarity(sentenceTokens, snippetTokens);
      
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        bestMatch = snippet;
      }
    }

    return {
      isAligned: maxSimilarity >= this.config.semanticAlignmentThreshold,
      score: maxSimilarity,
      details: { bestMatch, method: 'token_overlap' }
    };
  }

  /**
   * Find potential evidence for a sentence
   */
  private async findPotentialEvidence(
    sentence: string,
    evidenceContext: EvidenceContext[]
  ): Promise<Array<{ evidenceUnit: EvidenceUnit; score: number }>> {
    const sentenceTokens = this.tokenize(sentence.toLowerCase());
    const candidates: Array<{ evidenceUnit: EvidenceUnit; score: number }> = [];

    for (const context of evidenceContext) {
      const evidenceTokens = this.tokenize(context.evidenceUnit.snippet.toLowerCase());
      const similarity = this.calculateTokenSimilarity(sentenceTokens, evidenceTokens);
      
      if (similarity > 0.3) { // Minimum threshold for potential relevance
        candidates.push({
          evidenceUnit: context.evidenceUnit,
          score: similarity
        });
      }
    }

    return candidates.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate evidence utilization percentage
   */
  private calculateEvidenceUtilization(
    claims: ClaimField[],
    evidenceMap: Map<string, EvidenceUnit>
  ): number {
    const citedEvidenceIds = new Set<string>();
    
    claims.forEach(claim => {
      claim.citations.forEach(citation => {
        citation.evidenceUnitIds.forEach(id => {
          if (evidenceMap.has(id)) {
            citedEvidenceIds.add(id);
          }
        });
      });
    });

    return evidenceMap.size > 0 ? (citedEvidenceIds.size / evidenceMap.size) * 100 : 0;
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitting (can be enhanced with NLP libraries)
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    return text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2); // Filter out short words
  }

  /**
   * Calculate similarity between two token sets
   */
  private calculateTokenSimilarity(tokens1: string[], tokens2: string[]): number {
    if (tokens1.length === 0 || tokens2.length === 0) {
      return 0;
    }

    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size; // Jaccard similarity
  }

  /**
   * Update validation configuration
   */
  updateConfig(config: Partial<CitationValidationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current validation configuration
   */
  getConfig(): CitationValidationConfig {
    return { ...this.config };
  }
}