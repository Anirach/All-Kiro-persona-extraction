/**
 * Confidence Service
 * 
 * High-level service for confidence scoring integration with persona extraction.
 * Provides batch confidence calculation, calibration, and persona-level scoring.
 */

import type { EvidenceUnit, Persona, ClaimField as PrismaClaimField } from '@prisma/client';
import { ConfidenceScorer, ConfidenceBreakdown, ConfidenceConfig } from '../scoring/ConfidenceScorer';
import { ClaimField, EvidenceContext, PersonaExtractionResponse } from '../types/llm';
import { CitationValidator, CitationValidationResult } from '../validation/CitationValidator';

/**
 * Confidence service configuration
 */
export interface ConfidenceServiceConfig {
  /** Confidence scorer configuration */
  scorerConfig: Partial<ConfidenceConfig>;
  /** Enable calibration against human judgments */
  enableCalibration: boolean;
  /** Batch processing size for large persona sets */
  batchSize: number;
  /** Cache confidence calculations */
  enableCaching: boolean;
  /** Minimum confidence threshold for auto-approval */
  autoApprovalThreshold: number;
  /** Confidence threshold for requiring human review */
  humanReviewThreshold: number;
}

/**
 * Persona-level confidence assessment
 */
export interface PersonaConfidenceAssessment {
  /** Persona ID */
  personaId: string;
  /** Overall persona confidence score */
  overallConfidence: number;
  /** Confidence breakdown by claim field */
  claimFieldConfidences: Map<string, ConfidenceBreakdown>;
  /** Weighted average of all claim confidences */
  weightedAverageConfidence: number;
  /** Minimum confidence across all claims */
  minimumConfidence: number;
  /** Maximum confidence across all claims */
  maximumConfidence: number;
  /** Number of high-confidence claims (>0.8) */
  highConfidenceClaims: number;
  /** Number of low-confidence claims (<0.5) */
  lowConfidenceClaims: number;
  /** Recommendation (approve/review/reject) */
  recommendation: 'approve' | 'review' | 'reject';
  /** Confidence intervals for overall score */
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  /** Uncertainty quantification */
  uncertainty: number;
}

/**
 * Batch confidence calculation result
 */
export interface BatchConfidenceResult {
  /** Confidence assessments by persona ID */
  assessments: Map<string, PersonaConfidenceAssessment>;
  /** Processing statistics */
  statistics: {
    totalPersonas: number;
    totalClaims: number;
    averageConfidence: number;
    processingTimeMs: number;
    approvedCount: number;
    reviewCount: number;
    rejectedCount: number;
  };
  /** Any errors encountered during processing */
  errors: Array<{
    personaId: string;
    error: string;
    field?: string;
  }>;
}

/**
 * Calibration data point for human judgment comparison
 */
export interface CalibrationDataPoint {
  claimText: string;
  predictedConfidence: number;
  humanJudgment: number; // 0.0-1.0 scale
  evidenceCount: number;
  sourceQuality: number;
  timestamp: Date;
}

/**
 * Calibration analysis result
 */
export interface CalibrationAnalysis {
  /** Mean absolute error between predicted and human judgments */
  meanAbsoluteError: number;
  /** Root mean square error */
  rootMeanSquareError: number;
  /** Pearson correlation coefficient */
  correlation: number;
  /** Calibration curve data points */
  calibrationCurve: Array<{
    predictedBin: number;
    actualMean: number;
    count: number;
  }>;
  /** Reliability metric (how well calibrated) */
  reliability: number;
  /** Resolution metric (ability to distinguish) */
  resolution: number;
}

/**
 * Default service configuration
 */
const DEFAULT_SERVICE_CONFIG: ConfidenceServiceConfig = {
  scorerConfig: {},
  enableCalibration: false,
  batchSize: 100,
  enableCaching: true,
  autoApprovalThreshold: 0.85,
  humanReviewThreshold: 0.6
};

/**
 * Confidence Service
 */
export class ConfidenceService {
  private config: ConfidenceServiceConfig;
  private scorer: ConfidenceScorer;
  private citationValidator: CitationValidator;
  private confidenceCache: Map<string, ConfidenceBreakdown>;
  private calibrationData: CalibrationDataPoint[];

  constructor(config?: Partial<ConfidenceServiceConfig>) {
    this.config = { ...DEFAULT_SERVICE_CONFIG, ...config };
    this.scorer = new ConfidenceScorer(this.config.scorerConfig);
    this.citationValidator = new CitationValidator();
    this.confidenceCache = new Map();
    this.calibrationData = [];
  }

  /**
   * Calculate confidence for a single claim field
   */
  async calculateClaimConfidence(
    claimField: ClaimField,
    evidenceContext: EvidenceContext[]
  ): Promise<ConfidenceBreakdown> {
    const cacheKey = this.generateCacheKey(claimField, evidenceContext);
    
    if (this.config.enableCaching && this.confidenceCache.has(cacheKey)) {
      return this.confidenceCache.get(cacheKey)!;
    }

    const confidence = await this.scorer.calculateConfidence(claimField, evidenceContext);
    
    if (this.config.enableCaching) {
      this.confidenceCache.set(cacheKey, confidence);
    }

    return confidence;
  }

  /**
   * Calculate confidence for an entire persona
   */
  async calculatePersonaConfidence(
    claims: ClaimField[],
    evidenceContext: EvidenceContext[],
    personaId?: string
  ): Promise<PersonaConfidenceAssessment> {
    const claimFieldConfidences = new Map<string, ConfidenceBreakdown>();
    const confidenceScores: number[] = [];
    const weights: number[] = [];

    // Calculate confidence for each claim field
    for (const claimField of claims) {
      try {
        const confidence = await this.calculateClaimConfidence(claimField, evidenceContext);
        claimFieldConfidences.set(claimField.fieldName, confidence);
        confidenceScores.push(confidence.overallScore);
        weights.push(this.calculateClaimWeight(claimField, confidence));
      } catch (error) {
        console.warn(`Failed to calculate confidence for claim ${claimField.fieldName}:`, error);
        // Use minimum confidence for failed calculations
        confidenceScores.push(0.0);
        weights.push(1.0);
      }
    }

    // Calculate aggregate statistics
    const weightedAverageConfidence = this.calculateWeightedAverage(confidenceScores, weights);
    const minimumConfidence = Math.min(...confidenceScores);
    const maximumConfidence = Math.max(...confidenceScores);
    
    const highConfidenceClaims = confidenceScores.filter(score => score > 0.8).length;
    const lowConfidenceClaims = confidenceScores.filter(score => score < 0.5).length;

    // Calculate overall persona confidence
    const overallConfidence = this.calculateOverallPersonaConfidence(
      weightedAverageConfidence,
      minimumConfidence,
      highConfidenceClaims,
      lowConfidenceClaims,
      claims.length
    );

    // Calculate uncertainty and confidence intervals
    const uncertainty = this.calculatePersonaUncertainty(claimFieldConfidences);
    const confidenceInterval = this.calculatePersonaConfidenceInterval(overallConfidence, uncertainty);

    // Generate recommendation
    const recommendation = this.generateRecommendation(overallConfidence, minimumConfidence);

    return {
      personaId: personaId || 'unknown',
      overallConfidence,
      claimFieldConfidences,
      weightedAverageConfidence,
      minimumConfidence,
      maximumConfidence,
      highConfidenceClaims,
      lowConfidenceClaims,
      recommendation,
      confidenceInterval,
      uncertainty
    };
  }

  /**
   * Process multiple personas in batches
   */
  async processBatch(
    personas: Array<{
      id: string;
      claims: ClaimField[];
      evidenceContext: EvidenceContext[];
    }>
  ): Promise<BatchConfidenceResult> {
    const startTime = Date.now();
    const assessments = new Map<string, PersonaConfidenceAssessment>();
    const errors: Array<{ personaId: string; error: string; field?: string }> = [];
    
    let totalClaims = 0;
    let approvedCount = 0;
    let reviewCount = 0;
    let rejectedCount = 0;

    // Process in batches
    for (let i = 0; i < personas.length; i += this.config.batchSize) {
      const batch = personas.slice(i, i + this.config.batchSize);
      
      await Promise.all(batch.map(async (persona) => {
        try {
          const assessment = await this.calculatePersonaConfidence(
            persona.claims,
            persona.evidenceContext,
            persona.id
          );
          
          assessments.set(persona.id, assessment);
          totalClaims += persona.claims.length;
          
          // Count recommendations
          switch (assessment.recommendation) {
            case 'approve':
              approvedCount++;
              break;
            case 'review':
              reviewCount++;
              break;
            case 'reject':
              rejectedCount++;
              break;
          }
        } catch (error) {
          errors.push({
            personaId: persona.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }));
    }

    const processingTimeMs = Date.now() - startTime;
    const averageConfidence = assessments.size > 0
      ? Array.from(assessments.values()).reduce((sum, a) => sum + a.overallConfidence, 0) / assessments.size
      : 0;

    return {
      assessments,
      statistics: {
        totalPersonas: personas.length,
        totalClaims,
        averageConfidence,
        processingTimeMs,
        approvedCount,
        reviewCount,
        rejectedCount
      },
      errors
    };
  }

  /**
   * Add calibration data point
   */
  addCalibrationDataPoint(
    claimText: string,
    predictedConfidence: number,
    humanJudgment: number,
    evidenceCount: number,
    sourceQuality: number
  ): void {
    this.calibrationData.push({
      claimText,
      predictedConfidence,
      humanJudgment,
      evidenceCount,
      sourceQuality,
      timestamp: new Date()
    });
  }

  /**
   * Analyze calibration performance
   */
  analyzeCalibration(): CalibrationAnalysis {
    if (this.calibrationData.length === 0) {
      throw new Error('No calibration data available');
    }

    const predictions = this.calibrationData.map(d => d.predictedConfidence);
    const actuals = this.calibrationData.map(d => d.humanJudgment);

    // Calculate error metrics
    const meanAbsoluteError = this.calculateMeanAbsoluteError(predictions, actuals);
    const rootMeanSquareError = this.calculateRootMeanSquareError(predictions, actuals);
    const correlation = this.calculateCorrelation(predictions, actuals);

    // Generate calibration curve
    const calibrationCurve = this.generateCalibrationCurve(predictions, actuals);

    // Calculate reliability and resolution
    const reliability = this.calculateReliability(calibrationCurve);
    const resolution = this.calculateResolution(actuals);

    return {
      meanAbsoluteError,
      rootMeanSquareError,
      correlation,
      calibrationCurve,
      reliability,
      resolution
    };
  }

  /**
   * Update service configuration
   */
  updateConfig(newConfig: Partial<ConfidenceServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.scorerConfig) {
      this.scorer.updateConfig(newConfig.scorerConfig);
    }

    // Clear cache if caching was disabled
    if (newConfig.enableCaching === false) {
      this.confidenceCache.clear();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ConfidenceServiceConfig {
    return { ...this.config };
  }

  /**
   * Clear confidence cache
   */
  clearCache(): void {
    this.confidenceCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStatistics(): { size: number; hitRate: number } {
    // Simple implementation - in production, you'd track hit/miss rates
    return {
      size: this.confidenceCache.size,
      hitRate: 0 // Would need to track this
    };
  }

  // Private helper methods

  private generateCacheKey(claimField: ClaimField, evidenceContext: EvidenceContext[]): string {
    const evidenceIds = evidenceContext.map(e => e.evidenceUnit.id).sort().join(',');
    const citationIds = claimField.citations.flatMap(c => c.evidenceUnitIds).sort().join(',');
    return `${claimField.fieldName}:${claimField.text.length}:${evidenceIds}:${citationIds}`;
  }

  private calculateClaimWeight(claimField: ClaimField, confidence: ConfidenceBreakdown): number {
    // Weight based on evidence count and confidence
    const evidenceWeight = Math.min(1, confidence.supportingEvidenceCount / 3);
    const confidenceWeight = confidence.overallScore;
    return (evidenceWeight + confidenceWeight) / 2;
  }

  private calculateWeightedAverage(scores: number[], weights: number[]): number {
    if (scores.length !== weights.length || scores.length === 0) return 0;
    
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (totalWeight === 0) return 0;

    const weightedSum = scores.reduce((sum, score, i) => sum + score * (weights[i] || 0), 0);
    return weightedSum / totalWeight;
  }

  private calculateOverallPersonaConfidence(
    weightedAverage: number,
    minimumConfidence: number,
    highConfidenceClaims: number,
    lowConfidenceClaims: number,
    totalClaims: number
  ): number {
    // Penalty for low-confidence claims
    const lowConfidencePenalty = lowConfidenceClaims > 0 
      ? 0.1 * (lowConfidenceClaims / totalClaims)
      : 0;

    // Bonus for high-confidence claims
    const highConfidenceBonus = highConfidenceClaims > 0
      ? 0.05 * (highConfidenceClaims / totalClaims)
      : 0;

    // Minimum confidence threshold (weakest link)
    const minimumThreshold = Math.max(0.3, minimumConfidence);

    return Math.max(0, Math.min(1, 
      weightedAverage * minimumThreshold + highConfidenceBonus - lowConfidencePenalty
    ));
  }

  private calculatePersonaUncertainty(claimConfidences: Map<string, ConfidenceBreakdown>): number {
    const uncertainties = Array.from(claimConfidences.values()).map(c => c.uncertainty);
    return uncertainties.length > 0 
      ? uncertainties.reduce((sum, u) => sum + u, 0) / uncertainties.length
      : 0.5;
  }

  private calculatePersonaConfidenceInterval(
    overallConfidence: number,
    uncertainty: number
  ): { lower: number; upper: number } {
    const margin = 1.96 * uncertainty;
    return {
      lower: Math.max(0, overallConfidence - margin),
      upper: Math.min(1, overallConfidence + margin)
    };
  }

  private generateRecommendation(
    overallConfidence: number,
    minimumConfidence: number
  ): 'approve' | 'review' | 'reject' {
    if (overallConfidence >= this.config.autoApprovalThreshold && minimumConfidence >= 0.6) {
      return 'approve';
    } else if (overallConfidence >= this.config.humanReviewThreshold) {
      return 'review';
    } else {
      return 'reject';
    }
  }

  private calculateMeanAbsoluteError(predictions: number[], actuals: number[]): number {
    const errors = predictions.map((pred, i) => Math.abs(pred - (actuals[i] || 0)));
    return errors.reduce((sum, error) => sum + error, 0) / errors.length;
  }

  private calculateRootMeanSquareError(predictions: number[], actuals: number[]): number {
    const squaredErrors = predictions.map((pred, i) => Math.pow(pred - (actuals[i] || 0), 2));
    const meanSquaredError = squaredErrors.reduce((sum, error) => sum + error, 0) / squaredErrors.length;
    return Math.sqrt(meanSquaredError);
  }

  private calculateCorrelation(predictions: number[], actuals: number[]): number {
    const n = predictions.length;
    const predMean = predictions.reduce((sum, val) => sum + val, 0) / n;
    const actualMean = actuals.reduce((sum, val) => sum + val, 0) / n;

    const numerator = predictions.reduce((sum, pred, i) => 
      sum + (pred - predMean) * ((actuals[i] || 0) - actualMean), 0
    );

    const predVariance = predictions.reduce((sum, pred) => 
      sum + Math.pow(pred - predMean, 2), 0
    );

    const actualVariance = actuals.reduce((sum, actual) => 
      sum + Math.pow(actual - actualMean, 2), 0
    );

    const denominator = Math.sqrt(predVariance * actualVariance);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private generateCalibrationCurve(
    predictions: number[],
    actuals: number[]
  ): Array<{ predictedBin: number; actualMean: number; count: number }> {
    const bins = 10;
    const curve: Array<{ predictedBin: number; actualMean: number; count: number }> = [];

    for (let i = 0; i < bins; i++) {
      const binStart = i / bins;
      const binEnd = (i + 1) / bins;
      const binCenter = (binStart + binEnd) / 2;

      const binIndices = predictions
        .map((pred, idx) => ({ pred, idx }))
        .filter(({ pred }) => pred >= binStart && pred < binEnd)
        .map(({ idx }) => idx);

      if (binIndices.length > 0) {
        const binActuals = binIndices.map(idx => actuals[idx] || 0);
        const actualMean = binActuals.reduce((sum, val) => sum + val, 0) / binActuals.length;

        curve.push({
          predictedBin: binCenter,
          actualMean,
          count: binIndices.length
        });
      }
    }

    return curve;
  }

  private calculateReliability(calibrationCurve: Array<{ predictedBin: number; actualMean: number; count: number }>): number {
    const totalCount = calibrationCurve.reduce((sum, point) => sum + point.count, 0);
    
    if (totalCount === 0) return 0;

    const reliability = calibrationCurve.reduce((sum, point) => {
      const weight = point.count / totalCount;
      const deviation = Math.pow(point.predictedBin - point.actualMean, 2);
      return sum + weight * deviation;
    }, 0);

    return 1 - reliability; // Higher is better
  }

  private calculateResolution(actuals: number[]): number {
    const actualMean = actuals.reduce((sum, val) => sum + val, 0) / actuals.length;
    const variance = actuals.reduce((sum, val) => sum + Math.pow(val - actualMean, 2), 0) / actuals.length;
    return variance; // Variance represents resolution
  }
}