/**
 * Evidence processing service
 * Handles text unitization, evidence unit creation, and processing pipeline
 */

import { EvidenceRepository } from '../repositories/EvidenceRepository';
import { SourceRepository } from '../repositories/SourceRepository';
import { unitizeText, validateUnitization, type TextUnit, type UnitizationConfig } from '../utils/textUtils';
import { DeduplicationService, type DeduplicationConfig, type DeduplicationResult } from './DeduplicationService';
import { QualityService, type EvidenceForQuality, type QualityConfig } from './QualityService';
import { TopicService, type TopicExtractionConfig, type EvidenceUnitForTopics, type ExtractedTopic } from './TopicService';
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
  topicExtractionEnabled: boolean; // Enable topic extraction
  deduplicationConfig: Partial<DeduplicationConfig>; // Deduplication settings
  qualityConfig: Partial<QualityConfig>; // Quality assessment configuration
  topicConfig: Partial<TopicExtractionConfig>; // Topic extraction configuration
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
  topicExtractionEnabled: true,
  deduplicationConfig: {
    cosineSimilarityThreshold: 0.85,
    strategy: 'keep_highest_quality',
    useFastPrefiltering: true,
  },
  qualityConfig: {
    // Use default quality configuration
    performanceMode: 'balanced',
  },
  topicConfig: {
    topicsPerUnit: 4,
    useCorpusTfIdf: false, // Start with simple mode for performance
    clusteringEnabled: false, // Disable clustering for individual processing
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
  private qualityService: QualityService;
  private topicService: TopicService;

  constructor(
    private evidenceRepository: EvidenceRepository,
    private sourceRepository: SourceRepository,
    qualityConfig?: Partial<QualityConfig>,
    topicConfig?: Partial<TopicExtractionConfig>
  ) {
    this.deduplicationService = new DeduplicationService();
    this.qualityService = new QualityService(qualityConfig);
    this.topicService = new TopicService(topicConfig);
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
    
    // Get source information for quality assessment
    const source = await this.sourceRepository.findById(sourceId);
    if (!source) {
      throw new Error(`Source not found: ${sourceId}`);
    }
    
    // Calculate quality score using comprehensive QualityService
    const qualityScore = await this.calculateQualityScore(unit, source);
    
    // Extract topic candidates using TopicService
    const topicCandidates = config.topicExtractionEnabled 
      ? await this.extractTopicCandidatesAdvanced(unit, sourceId, config)
      : this.extractTopicCandidatesSimple(unit);
    
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
   * Calculate quality score for a text unit using comprehensive QualityService
   */
  private async calculateQualityScore(unit: TextUnit, source: Source): Promise<number> {
    // Parse source metadata
    let sourceMetadata: Record<string, any> = {};
    try {
      sourceMetadata = JSON.parse(source.metadata);
    } catch {
      sourceMetadata = {};
    }

    // Convert TextUnit and Source to EvidenceForQuality format
    const evidenceForQuality: EvidenceForQuality = {
      id: `temp-${Date.now()}`, // Temporary ID for processing
      text: unit.text,
      sourceId: source.id,
      startIndex: unit.startIndex,
      endIndex: unit.endIndex,
      wordCount: unit.wordCount,
      sentenceCount: unit.sentenceCount,
      hasCompleteStart: unit.hasCompleteStart,
      hasCompleteEnd: unit.hasCompleteEnd,
      metadata: {
        topics: this.extractTopicCandidatesSimple(unit),
        keywords: this.extractKeywords(unit.text),
        context: 'evidence_processing',
      },
      source: {
        id: source.id,
        url: source.url,
        domain: this.extractDomainFromUrl(source.url),
        tier: source.tier as any,
        title: source.title || undefined,
        author: sourceMetadata.author || undefined,
        publishedAt: source.publishedAt || undefined,
        fetchedAt: source.fetchedAt,
        metadata: sourceMetadata,
      },
    };

    // Assess quality using comprehensive scoring
    const assessment = await this.qualityService.assessQuality(evidenceForQuality);
    return assessment.score;
  }

  /**
   * Extract keywords from text for quality assessment
   */
  private extractKeywords(text: string): string[] {
    // Simple keyword extraction - could be enhanced with NLP
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && word.length < 15);
    
    // Remove common stop words
    const stopWords = new Set(['this', 'that', 'with', 'have', 'will', 'from', 'they', 'know', 'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when', 'come', 'here', 'just', 'like', 'long', 'make', 'many', 'over', 'such', 'take', 'than', 'them', 'well', 'were']);
    
    return words.filter(word => !stopWords.has(word)).slice(0, 10);
  }

  /**
   * Extract domain from URL
   */
  private extractDomainFromUrl(url: string): string {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      const match = url.match(/^https?:\/\/([^\/]+)/i);
      return match?.[1]?.toLowerCase() || 'unknown';
    }
  }

  /**
   * Extract potential topic candidates using advanced TopicService
   */
  private async extractTopicCandidatesAdvanced(
    unit: TextUnit, 
    sourceId: string, 
    config: EvidenceProcessingConfig
  ): Promise<string[]> {
    try {
      // Update topic service configuration
      if (config.topicConfig) {
        this.topicService.updateConfig(config.topicConfig);
      }
      
      // Create evidence unit for topic extraction
      const evidenceUnit: EvidenceUnitForTopics = {
        id: `temp_${Date.now()}_${Math.random()}`,
        text: unit.text,
        sourceId,
      };
      
      // Extract topics using TopicService
      const result = await this.topicService.extractTopics(evidenceUnit);
      
      // Return top keywords as topic candidates
      return result.topics.map(topic => topic.keyword);
    } catch (error) {
      console.warn('Advanced topic extraction failed, falling back to simple extraction:', error);
      return this.extractTopicCandidatesSimple(unit);
    }
  }

  /**
   * Extract potential topic candidates from text unit (simple approach)
   */
  private extractTopicCandidatesSimple(unit: TextUnit): string[] {
    const text = unit.text.toLowerCase();
    
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