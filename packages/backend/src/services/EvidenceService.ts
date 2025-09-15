/**
 * Evidence processing service
 * Handles text unitization, evidence unit creation, and processing pipeline
 */

import { EvidenceRepository } from '../repositories/EvidenceRepository';
import { SourceRepository } from '../repositories/SourceRepository';
import { unitizeText, validateUnitization, type TextUnit, type UnitizationConfig } from '../utils/textUtils';
import { DeduplicationService, type DeduplicationConfig, type DeduplicationResult } from './DeduplicationService';
import type { EvidenceUnit, Source } from '@prisma/client';

/**
 * Evidence processing configuration
 */
export interface EvidenceProcessingConfig extends UnitizationConfig {
  confidenceThreshold: number;    // Minimum confidence score (0-1)
  qualityThreshold: number;       // Minimum quality score (0-1)
  maxUnitsPerSource: number;      // Maximum units to extract per source
  deduplicationEnabled: boolean;  // Enable content deduplication
  metadataExtraction: boolean;    // Extract metadata from units
  deduplicationConfig: Partial<DeduplicationConfig>; // Deduplication settings
}

export const DEFAULT_PROCESSING_CONFIG: EvidenceProcessingConfig = {
  // Text unitization config
  minUnitSize: 200,
  maxUnitSize: 400,
  overlapSize: 50,
  preferredSize: 300,
  
  // Processing config
  confidenceThreshold: 0.3,
  qualityThreshold: 0.4,
  maxUnitsPerSource: 100,
  deduplicationEnabled: true,
  metadataExtraction: true,
  deduplicationConfig: {
    cosineSimilarityThreshold: 0.85,
    strategy: 'keep_highest_quality',
    useFastPrefiltering: true,
  },
};

/**
 * Evidence unit with processing metadata
 */
export interface ProcessedEvidenceUnit {
  sourceId: string;
  snippet: string;
  startIndex: number;
  endIndex: number;
  wordCount: number;
  sentenceCount: number;
  confidenceScore: number;
  qualityScore: number;
  hasCompleteStart: boolean;
  hasCompleteEnd: boolean;
  topicCandidates: string[];
  metadata: Record<string, any>;
}

/**
 * Evidence processing results
 */
export interface ProcessingResult {
  sourceId: string;
  units: ProcessedEvidenceUnit[];
  totalUnits: number;
  processedUnits: number;
  rejectedUnits: number;
  deduplicatedUnits: number;
  deduplicationResult?: DeduplicationResult;
  processingTimeMs: number;
  validationResult: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
  stats: {
    avgConfidence: number;
    avgQuality: number;
    avgUnitSize: number;
    totalCoverage: number;
  };
}

/**
 * Evidence processing service
 */
export class EvidenceService {
  private deduplicationService: DeduplicationService;

  constructor(
    private evidenceRepository: EvidenceRepository,
    private sourceRepository: SourceRepository
  ) {
    this.deduplicationService = new DeduplicationService();
  }

  /**
   * Process source text into evidence units
   */
  async processSourceText(
    sourceId: string,
    text: string,
    config: Partial<EvidenceProcessingConfig> = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const fullConfig = { ...DEFAULT_PROCESSING_CONFIG, ...config };
    
    // Update deduplication service configuration
    if (fullConfig.deduplicationConfig) {
      this.deduplicationService.updateConfig(fullConfig.deduplicationConfig);
    }
    
    // Validate source exists
    const source = await this.sourceRepository.findById(sourceId);
    if (!source) {
      throw new Error(`Source not found: ${sourceId}`);
    }

    // Unitize text
    const textUnits = unitizeText(text, fullConfig);
    const validation = validateUnitization(textUnits, text, fullConfig);
    
    if (!validation.isValid) {
      throw new Error(`Text unitization failed: ${validation.errors.join(', ')}`);
    }

    // Process each unit
    const candidateUnits: ProcessedEvidenceUnit[] = [];
    const rejectedUnits: TextUnit[] = [];

    for (const unit of textUnits) {
      try {
        const processed = await this.processTextUnit(unit, sourceId, text, fullConfig);
        
        // Apply quality and confidence filters
        if (processed.confidenceScore >= fullConfig.confidenceThreshold &&
            processed.qualityScore >= fullConfig.qualityThreshold) {
          candidateUnits.push(processed);
        } else {
          rejectedUnits.push(unit);
        }
      } catch (error) {
        console.warn(`Failed to process unit: ${error}`);
        rejectedUnits.push(unit);
      }
    }

    // Deduplicate if enabled
    let finalUnits = candidateUnits;
    let deduplicationResult: DeduplicationResult | undefined;
    
    if (fullConfig.deduplicationEnabled && candidateUnits.length > 1) {
      // Convert to deduplication format
      const evidenceUnits = candidateUnits.map(unit => ({
        id: `temp_${Math.random().toString(36).substring(7)}`,
        sourceId: unit.sourceId,
        snippet: unit.snippet,
        startIndex: unit.startIndex,
        endIndex: unit.endIndex,
        qualityScore: unit.qualityScore,
        confidence: unit.confidenceScore,
        topics: unit.topicCandidates,
        metadata: unit.metadata,
      }));

      deduplicationResult = await this.deduplicationService.deduplicate(evidenceUnits);
      
      // Convert back to ProcessedEvidenceUnit format
      finalUnits = deduplicationResult.deduplicated.map(unit => {
        const originalUnit = candidateUnits.find(cu => cu.snippet === unit.snippet);
        return originalUnit!;
      });
    }

    // Apply max units limit
    if (finalUnits.length > fullConfig.maxUnitsPerSource) {
      finalUnits = finalUnits.slice(0, fullConfig.maxUnitsPerSource);
    }

    const processingTimeMs = Date.now() - startTime;

    // Calculate statistics using finalUnits
    const avgConfidence = finalUnits.length > 0 
      ? finalUnits.reduce((sum: number, unit: ProcessedEvidenceUnit) => sum + unit.confidenceScore, 0) / finalUnits.length
      : 0;
    
    const avgQuality = finalUnits.length > 0
      ? finalUnits.reduce((sum: number, unit: ProcessedEvidenceUnit) => sum + unit.qualityScore, 0) / finalUnits.length
      : 0;
    
    const avgUnitSize = finalUnits.length > 0
      ? finalUnits.reduce((sum: number, unit: ProcessedEvidenceUnit) => sum + unit.snippet.length, 0) / finalUnits.length
      : 0;

    const deduplicatedCount = deduplicationResult 
      ? deduplicationResult.statistics.duplicatesRemoved 
      : 0;

    return {
      sourceId,
      units: finalUnits,
      totalUnits: textUnits.length,
      processedUnits: finalUnits.length,
      rejectedUnits: rejectedUnits.length,
      deduplicatedUnits: deduplicatedCount,
      deduplicationResult,
      processingTimeMs,
      validationResult: {
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings,
      },
      stats: {
        avgConfidence,
        avgQuality,
        avgUnitSize,
        totalCoverage: validation.stats.totalCoverage,
      },
    };
  }

  /**
   * Process a single text unit into a processed evidence unit
   */
  private async processTextUnit(
    unit: TextUnit,
    sourceId: string,
    fullText: string,
    config: EvidenceProcessingConfig
  ): Promise<ProcessedEvidenceUnit> {
    // Calculate confidence score based on text properties
    const confidenceScore = this.calculateConfidenceScore(unit, fullText);
    
    // Calculate quality score based on content analysis
    const qualityScore = this.calculateQualityScore(unit);
    
    // Extract topic candidates
    const topicCandidates = this.extractTopicCandidates(unit);
    
    // Extract metadata if enabled
    const metadata = config.metadataExtraction 
      ? this.extractMetadata(unit, fullText)
      : {};

    return {
      sourceId,
      snippet: unit.text,
      startIndex: unit.startIndex,
      endIndex: unit.endIndex,
      wordCount: unit.wordCount,
      sentenceCount: unit.sentenceCount,
      confidenceScore,
      qualityScore,
      hasCompleteStart: unit.hasCompleteStart,
      hasCompleteEnd: unit.hasCompleteEnd,
      topicCandidates,
      metadata,
    };
  }

  /**
   * Calculate confidence score for a text unit
   * Based on completeness, boundaries, and context
   */
  private calculateConfidenceScore(unit: TextUnit, fullText: string): number {
    let score = 0.5; // Base score
    
    // Boundary completeness (30% weight)
    if (unit.hasCompleteStart && unit.hasCompleteEnd) {
      score += 0.3;
    } else if (unit.hasCompleteStart || unit.hasCompleteEnd) {
      score += 0.15;
    }
    
    // Size appropriateness (20% weight)
    const sizeRatio = unit.text.length / DEFAULT_PROCESSING_CONFIG.preferredSize;
    if (sizeRatio >= 0.8 && sizeRatio <= 1.2) {
      score += 0.2;
    } else if (sizeRatio >= 0.6 && sizeRatio <= 1.5) {
      score += 0.1;
    }
    
    // Sentence completeness (25% weight)
    const sentenceCompleteness = unit.sentenceCount >= 1 ? 0.25 : 0.1;
    score += sentenceCompleteness;
    
    // Word density (15% weight)
    const wordDensity = unit.wordCount / unit.text.length;
    if (wordDensity >= 0.12 && wordDensity <= 0.18) { // Normal range
      score += 0.15;
    } else if (wordDensity >= 0.08 && wordDensity <= 0.22) {
      score += 0.07;
    }
    
    // Context position (10% weight)
    const positionRatio = unit.startIndex / fullText.length;
    if (positionRatio > 0.1 && positionRatio < 0.9) { // Not at very beginning or end
      score += 0.1;
    } else {
      score += 0.05;
    }
    
    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Calculate quality score for a text unit
   * Based on content characteristics and readability
   */
  private calculateQualityScore(unit: TextUnit): number {
    let score = 0.4; // Base score
    
    // Check for meaningful content patterns
    const text = unit.text.toLowerCase();
    
    // Has actual sentences (25% weight)
    if (unit.sentenceCount >= 1 && /[.!?]/.test(unit.text)) {
      score += 0.25;
    }
    
    // Reasonable word count (20% weight)
    if (unit.wordCount >= 15 && unit.wordCount <= 80) {
      score += 0.2;
    } else if (unit.wordCount >= 10 && unit.wordCount <= 100) {
      score += 0.1;
    }
    
    // Contains substantive words (20% weight)
    const substantiveWords = /\b(the|and|or|but|however|therefore|because|since|when|where|what|who|which|that|this|these|those|could|would|should|might|may|can|will|shall)\b/gi;
    const substantiveCount = (unit.text.match(substantiveWords) || []).length;
    if (substantiveCount >= 3) {
      score += 0.2;
    } else if (substantiveCount >= 1) {
      score += 0.1;
    }
    
    // Avoid repetitive content (15% weight)
    const words = text.split(/\s+/);
    const uniqueWords = new Set(words);
    const uniquenessRatio = uniqueWords.size / words.length;
    if (uniquenessRatio >= 0.7) {
      score += 0.15;
    } else if (uniquenessRatio >= 0.5) {
      score += 0.07;
    }
    
    // Penalize problematic patterns (10% weight)
    let penalties = 0;
    
    // Too much punctuation
    const punctuationRatio = (text.match(/[^\w\s]/g) || []).length / text.length;
    if (punctuationRatio > 0.2) penalties += 0.05;
    
    // Too many numbers
    const numberRatio = (text.match(/\d/g) || []).length / text.length;
    if (numberRatio > 0.3) penalties += 0.05;
    
    // All caps content
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (capsRatio > 0.5) penalties += 0.05;
    
    score = Math.max(0.1, score - penalties);
    
    // Boost for good structure (10% weight)
    if (unit.hasCompleteStart && unit.hasCompleteEnd && unit.sentenceCount >= 2) {
      score += 0.1;
    }
    
    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Extract potential topic candidates from text unit
   */
  private extractTopicCandidates(unit: TextUnit): string[] {
    const text = unit.text.toLowerCase();
    const candidates: string[] = [];
    
    // Extract noun phrases (simplified approach)
    const nounPhrases = text.match(/\b[a-z]+(?:\s+[a-z]+){0,2}\b/g) || [];
    
    // Filter and score candidates
    const validCandidates = nounPhrases
      .filter(phrase => {
        const words = phrase.split(/\s+/);
        return words.length >= 1 && 
               words.length <= 3 && 
               words.every(word => word.length >= 3) &&
               !/^(the|and|or|but|for|with|by|to|of|in|on|at|as|is|are|was|were|be|been|have|has|had|do|does|did|will|would|could|should|may|might|can|shall)$/.test(phrase);
      })
      .slice(0, 5); // Limit to top 5 candidates
    
    return validCandidates;
  }

  /**
   * Extract metadata from text unit
   */
  private extractMetadata(unit: TextUnit, fullText: string): Record<string, any> {
    const metadata: Record<string, any> = {
      position: {
        start: unit.startIndex,
        end: unit.endIndex,
        ratio: unit.startIndex / fullText.length,
      },
      structure: {
        wordCount: unit.wordCount,
        sentenceCount: unit.sentenceCount,
        avgWordsPerSentence: unit.sentenceCount > 0 ? unit.wordCount / unit.sentenceCount : 0,
      },
      boundaries: {
        hasCompleteStart: unit.hasCompleteStart,
        hasCompleteEnd: unit.hasCompleteEnd,
      },
    };
    
    // Extract patterns
    const text = unit.text;
    
    // URLs
    const urls = text.match(/https?:\/\/[^\s]+/gi) || [];
    if (urls.length > 0) {
      metadata.urls = urls;
    }
    
    // Email addresses
    const emails = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi) || [];
    if (emails.length > 0) {
      metadata.emails = emails;
    }
    
    // Dates (simplified)
    const dates = text.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b|\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/g) || [];
    if (dates.length > 0) {
      metadata.dates = dates;
    }
    
    // Numbers
    const numbers = text.match(/\b\d+(?:,\d{3})*(?:\.\d+)?\b/g) || [];
    if (numbers.length > 0) {
      metadata.numbers = numbers.slice(0, 10); // Limit to prevent overflow
    }
    
    return metadata;
  }

  /**
   * Save processed evidence units to database
   */
  async saveEvidenceUnits(
    result: ProcessingResult,
    projectId: string
  ): Promise<EvidenceUnit[]> {
    const evidenceRecords: EvidenceUnit[] = [];
    
    for (const unit of result.units) {
      try {
        const evidence = await this.evidenceRepository.create({
          source: {
            connect: { id: unit.sourceId }
          },
          snippet: unit.snippet,
          startIndex: unit.startIndex,
          endIndex: unit.endIndex,
          qualityScore: unit.qualityScore,
          topics: JSON.stringify(unit.topicCandidates),
          metadata: JSON.stringify({
            ...unit.metadata,
            confidenceScore: unit.confidenceScore,
            wordCount: unit.wordCount,
            sentenceCount: unit.sentenceCount,
            hasCompleteStart: unit.hasCompleteStart,
            hasCompleteEnd: unit.hasCompleteEnd,
          }),
        });
        
        evidenceRecords.push(evidence);
      } catch (error) {
        console.error(`Failed to save evidence unit: ${error}`);
        // Continue with other units
      }
    }
    
    return evidenceRecords;
  }

  /**
   * Get processing statistics for a source
   */
  async getProcessingStats(sourceId: string): Promise<{
    totalUnits: number;
    avgConfidence: number;
    avgQuality: number;
    avgUnitSize: number;
    qualityDistribution: Record<string, number>;
  }> {
    // Get all units for this source (we need all for accurate stats)
    const paginatedResult = await this.evidenceRepository.findBySourceId(sourceId, { 
      limit: 1000, // Large limit to get all units
      page: 1 
    });
    
    const units = paginatedResult.data;
    
    if (units.length === 0) {
      return {
        totalUnits: 0,
        avgConfidence: 0,
        avgQuality: 0,
        avgUnitSize: 0,
        qualityDistribution: {},
      };
    }
    
    // Extract confidence scores from metadata and calculate averages
    let totalConfidence = 0;
    let confidenceCount = 0;
    
    const avgQuality = units.reduce((sum: number, unit: any) => sum + (unit.qualityScore || 0), 0) / units.length;
    const avgUnitSize = units.reduce((sum: number, unit: any) => sum + unit.snippet.length, 0) / units.length;
    
    // Extract confidence from metadata and calculate average
    units.forEach((unit: any) => {
      try {
        const metadata = JSON.parse(unit.metadata || '{}');
        if (metadata.confidenceScore !== undefined) {
          totalConfidence += metadata.confidenceScore;
          confidenceCount++;
        }
      } catch {
        // Skip invalid metadata
      }
    });
    
    const avgConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;
    
    // Quality distribution
    const qualityDistribution = {
      high: units.filter((u: any) => (u.qualityScore || 0) >= 0.7).length,
      medium: units.filter((u: any) => (u.qualityScore || 0) >= 0.4 && (u.qualityScore || 0) < 0.7).length,
      low: units.filter((u: any) => (u.qualityScore || 0) < 0.4).length,
    };
    
    return {
      totalUnits: units.length,
      avgConfidence,
      avgQuality,
      avgUnitSize,
      qualityDistribution,
    };
  }
}