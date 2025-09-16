/**
 * Confidence Scorer
 * 
 * Calculates confidence scores for extracted claims using multiple factors:
 * - Source Agreement: How much sources agree on the claim
 * - Evidence Count: Number of supporting evidence units
 * - Source Quality: Average quality of supporting sources
 * - Recency: How recent the supporting evidence is
 */

import type { EvidenceUnit } from '@prisma/client';
import { ClaimField, EvidenceContext } from '../types/llm';

/**
 * Configuration for confidence scoring
 */
export interface ConfidenceConfig {
  /** Weight for source agreement factor (0.0-1.0) */
  sourceAgreementWeight: number;
  /** Weight for evidence count factor (0.0-1.0) */
  evidenceCountWeight: number;
  /** Weight for source quality factor (0.0-1.0) */
  sourceQualityWeight: number;
  /** Weight for recency factor (0.0-1.0) */
  recencyWeight: number;
  /** Minimum evidence count for full confidence */
  minEvidenceCount: number;
  /** Maximum evidence count threshold (diminishing returns) */
  maxEvidenceCount: number;
  /** Time decay factor for recency (days) */
  recencyDecayDays: number;
  /** Minimum source quality threshold */
  minSourceQuality: number;
  /** Disagreement penalty factor */
  disagreementPenalty: number;
}

/**
 * Detailed confidence breakdown
 */
export interface ConfidenceBreakdown {
  /** Overall confidence score (0.0-1.0) */
  overallScore: number;
  /** Source agreement component score */
  sourceAgreement: number;
  /** Evidence count component score */
  evidenceCount: number;
  /** Source quality component score */
  sourceQuality: number;
  /** Recency component score */
  recency: number;
  /** Number of supporting evidence units */
  supportingEvidenceCount: number;
  /** Number of conflicting evidence units */
  conflictingEvidenceCount: number;
  /** Average quality of supporting sources */
  averageSourceQuality: number;
  /** Most recent evidence date */
  mostRecentDate?: Date;
  /** Confidence intervals */
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  /** Uncertainty quantification */
  uncertainty: number;
}

/**
 * Evidence assessment for confidence calculation
 */
export interface EvidenceAssessment {
  evidenceUnit: EvidenceUnit;
  supports: boolean;
  conflicts: boolean;
  quality: number;
  recencyScore: number;
  semanticSimilarity: number;
}

/**
 * Default confidence configuration
 */
const DEFAULT_CONFIDENCE_CONFIG: ConfidenceConfig = {
  sourceAgreementWeight: 0.4,
  evidenceCountWeight: 0.3,
  sourceQualityWeight: 0.2,
  recencyWeight: 0.1,
  minEvidenceCount: 2,
  maxEvidenceCount: 10,
  recencyDecayDays: 365,
  minSourceQuality: 0.5,
  disagreementPenalty: 0.3
};

/**
 * Confidence Scorer Service
 */
export class ConfidenceScorer {
  private config: ConfidenceConfig;

  constructor(config?: Partial<ConfidenceConfig>) {
    this.config = { ...DEFAULT_CONFIDENCE_CONFIG, ...config };
    this.validateConfig();
  }

  /**
   * Calculate confidence score for a claim field
   */
  async calculateConfidence(
    claimField: ClaimField,
    evidenceContext: EvidenceContext[]
  ): Promise<ConfidenceBreakdown> {
    // Get evidence units referenced in citations
    const referencedEvidenceIds = new Set(
      claimField.citations.flatMap(citation => citation.evidenceUnitIds)
    );

    // Assess each evidence unit for support/conflict
    const assessments = await this.assessEvidence(
      claimField,
      evidenceContext,
      referencedEvidenceIds
    );

    // Calculate component scores
    const sourceAgreement = this.calculateSourceAgreement(assessments);
    const evidenceCount = this.calculateEvidenceCountScore(assessments);
    const sourceQuality = this.calculateSourceQualityScore(assessments);
    const recency = this.calculateRecencyScore(assessments);

    // Calculate overall confidence
    const overallScore = (
      sourceAgreement * this.config.sourceAgreementWeight +
      evidenceCount * this.config.evidenceCountWeight +
      sourceQuality * this.config.sourceQualityWeight +
      recency * this.config.recencyWeight
    );

    // Calculate uncertainty and confidence intervals
    const uncertainty = this.calculateUncertainty(assessments, overallScore);
    const confidenceInterval = this.calculateConfidenceInterval(overallScore, uncertainty);

    // Get statistics
    const supportingEvidence = assessments.filter(a => a.supports);
    const conflictingEvidence = assessments.filter(a => a.conflicts);
    const averageQuality = supportingEvidence.length > 0 
      ? supportingEvidence.reduce((sum, a) => sum + a.quality, 0) / supportingEvidence.length
      : 0;

    const mostRecentDate = assessments.length > 0
      ? new Date(Math.max(...assessments.map(a => a.evidenceUnit.createdAt.getTime())))
      : undefined;

    return {
      overallScore: Math.max(0, Math.min(1, overallScore)),
      sourceAgreement,
      evidenceCount,
      sourceQuality,
      recency,
      supportingEvidenceCount: supportingEvidence.length,
      conflictingEvidenceCount: conflictingEvidence.length,
      averageSourceQuality: averageQuality,
      mostRecentDate,
      confidenceInterval,
      uncertainty
    };
  }

  /**
   * Assess evidence units for support/conflict with claim
   */
  private async assessEvidence(
    claimField: ClaimField,
    evidenceContext: EvidenceContext[],
    referencedEvidenceIds: Set<string>
  ): Promise<EvidenceAssessment[]> {
    const assessments: EvidenceAssessment[] = [];

    for (const context of evidenceContext) {
      const evidenceUnit = context.evidenceUnit;
      const isReferenced = referencedEvidenceIds.has(evidenceUnit.id);

      // Calculate semantic similarity between claim and evidence
      const semanticSimilarity = await this.calculateSemanticSimilarity(
        claimField.text,
        evidenceUnit.snippet
      );

      // Determine support/conflict based on citation and semantic similarity
      const supports = isReferenced && semanticSimilarity > 0.7;
      const conflicts = !isReferenced && semanticSimilarity > 0.8 && this.detectContradiction(
        claimField.text,
        evidenceUnit.snippet
      );

      // Calculate recency score
      const recencyScore = this.calculateEvidenceRecency(evidenceUnit.createdAt);

      assessments.push({
        evidenceUnit,
        supports,
        conflicts,
        quality: evidenceUnit.qualityScore || 0,
        recencyScore,
        semanticSimilarity
      });
    }

    return assessments;
  }

  /**
   * Calculate source agreement score
   */
  private calculateSourceAgreement(assessments: EvidenceAssessment[]): number {
    const supportingCount = assessments.filter(a => a.supports).length;
    const conflictingCount = assessments.filter(a => a.conflicts).length;
    const totalRelevant = supportingCount + conflictingCount;

    if (totalRelevant === 0) return 0;

    // Base agreement ratio
    const agreementRatio = supportingCount / totalRelevant;

    // Apply disagreement penalty
    const disagreementPenalty = conflictingCount > 0 
      ? this.config.disagreementPenalty * (conflictingCount / totalRelevant)
      : 0;

    return Math.max(0, agreementRatio - disagreementPenalty);
  }

  /**
   * Calculate evidence count score
   */
  private calculateEvidenceCountScore(assessments: EvidenceAssessment[]): number {
    const supportingCount = assessments.filter(a => a.supports).length;

    if (supportingCount === 0) return 0;
    if (supportingCount >= this.config.maxEvidenceCount) return 1;

    // Sigmoid-like curve for evidence count
    const ratio = supportingCount / this.config.minEvidenceCount;
    return Math.min(1, ratio);
  }

  /**
   * Calculate source quality score
   */
  private calculateSourceQualityScore(assessments: EvidenceAssessment[]): number {
    const supportingEvidence = assessments.filter(a => a.supports);

    if (supportingEvidence.length === 0) return 0;

    // Weighted average quality based on semantic similarity
    const totalWeight = supportingEvidence.reduce((sum, a) => sum + a.semanticSimilarity, 0);
    if (totalWeight === 0) return 0;

    const weightedQuality = supportingEvidence.reduce(
      (sum, a) => sum + (a.quality * a.semanticSimilarity), 
      0
    ) / totalWeight;

    // Normalize against minimum quality threshold
    return Math.max(0, (weightedQuality - this.config.minSourceQuality) / (1 - this.config.minSourceQuality));
  }

  /**
   * Calculate recency score
   */
  private calculateRecencyScore(assessments: EvidenceAssessment[]): number {
    const supportingEvidence = assessments.filter(a => a.supports);

    if (supportingEvidence.length === 0) return 0;

    // Average recency score weighted by quality
    const totalWeight = supportingEvidence.reduce((sum, a) => sum + a.quality, 0);
    if (totalWeight === 0) return 0;

    return supportingEvidence.reduce(
      (sum, a) => sum + (a.recencyScore * a.quality), 
      0
    ) / totalWeight;
  }

  /**
   * Calculate recency score for individual evidence
   */
  private calculateEvidenceRecency(evidenceDate: Date): number {
    const now = new Date();
    const daysDiff = (now.getTime() - evidenceDate.getTime()) / (1000 * 60 * 60 * 24);

    // Exponential decay
    return Math.exp(-daysDiff / this.config.recencyDecayDays);
  }

  /**
   * Calculate semantic similarity between claim and evidence
   */
  private async calculateSemanticSimilarity(claimText: string, evidenceText: string): Promise<number> {
    // Simple word overlap similarity (can be enhanced with embeddings)
    const claimWords = new Set(
      claimText.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 2)
    );

    const evidenceWords = new Set(
      evidenceText.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 2)
    );

    const intersection = new Set([...claimWords].filter(word => evidenceWords.has(word)));
    const union = new Set([...claimWords, ...evidenceWords]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Detect contradiction between claim and evidence
   */
  private detectContradiction(claimText: string, evidenceText: string): boolean {
    // Simple negation detection (can be enhanced with NLP)
    const contradictionPatterns = [
      /\bnot\s+/i,
      /\bnever\s+/i,
      /\bno\s+/i,
      /\bisn't\s+/i,
      /\bwasn't\s+/i,
      /\bdidn't\s+/i,
      /\bwon't\s+/i,
      /\bcan't\s+/i,
      /\bdoesn't\s+/i
    ];

    const claimNegated = contradictionPatterns.some(pattern => pattern.test(claimText));
    const evidenceNegated = contradictionPatterns.some(pattern => pattern.test(evidenceText));

    // Simple contradiction: one is negated, the other isn't
    return claimNegated !== evidenceNegated;
  }

  /**
   * Calculate uncertainty quantification
   */
  private calculateUncertainty(assessments: EvidenceAssessment[], overallScore: number): number {
    const supportingCount = assessments.filter(a => a.supports).length;
    const conflictingCount = assessments.filter(a => a.conflicts).length;
    const totalRelevant = supportingCount + conflictingCount;

    if (totalRelevant === 0) return 0.5; // Maximum uncertainty with no evidence

    // Uncertainty based on evidence variability and conflicts
    const evidenceVariability = totalRelevant < this.config.minEvidenceCount 
      ? 0.3 * (1 - totalRelevant / this.config.minEvidenceCount)
      : 0;

    const conflictUncertainty = conflictingCount > 0 
      ? 0.2 * (conflictingCount / totalRelevant)
      : 0;

    // Score-based uncertainty (higher uncertainty near 0.5)
    const scoreUncertainty = 0.1 * (1 - Math.abs(overallScore - 0.5) * 2);

    return Math.min(0.5, evidenceVariability + conflictUncertainty + scoreUncertainty);
  }

  /**
   * Calculate confidence intervals
   */
  private calculateConfidenceInterval(score: number, uncertainty: number): { lower: number; upper: number } {
    // 95% confidence interval based on uncertainty
    const margin = 1.96 * uncertainty;
    
    return {
      lower: Math.max(0, score - margin),
      upper: Math.min(1, score + margin)
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ConfidenceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.validateConfig();
  }

  /**
   * Get current configuration
   */
  getConfig(): ConfidenceConfig {
    return { ...this.config };
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    const weights = [
      this.config.sourceAgreementWeight,
      this.config.evidenceCountWeight,
      this.config.sourceQualityWeight,
      this.config.recencyWeight
    ];

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      throw new Error(`Confidence weights must sum to 1.0, got ${totalWeight}`);
    }

    if (this.config.minEvidenceCount < 1) {
      throw new Error('Minimum evidence count must be at least 1');
    }

    if (this.config.maxEvidenceCount < this.config.minEvidenceCount) {
      throw new Error('Maximum evidence count must be >= minimum evidence count');
    }
  }
}