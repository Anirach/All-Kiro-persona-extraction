/**
 * Quality Service - Main orchestrator for evidence quality assessment
 * Combines authority, content, recency, corroboration, and relevance scoring
 */

import { AuthorityScorer, type SourceAuthority, type AuthorityScore } from '../scoring/AuthorityScorer';
import { ContentScorer, type EvidenceContent, type ContentScore } from '../scoring/ContentScorer';
import { RecencyScorer, type SourceRecency, type RecencyScore } from '../scoring/RecencyScorer';
import { CorroborationScorer, type EvidenceForCorroboration, type CorroborationScore } from '../scoring/CorroborationScorer';
import { RelevanceScorer, type EvidenceForRelevance, type RelevanceTarget, type RelevanceScore } from '../scoring/RelevanceScorer';

/**
 * Quality service configuration
 */
export interface QualityConfig {
  weights: {
    authority: number;         // Weight for source authority (0.3 recommended)
    content: number;          // Weight for content quality (0.25 recommended)
    recency: number;          // Weight for recency (0.2 recommended)
    corroboration: number;    // Weight for corroboration (0.15 recommended)
    relevance: number;        // Weight for relevance (0.1 recommended)
  };
  enabledComponents: {
    authority: boolean;
    content: boolean;
    recency: boolean;
    corroboration: boolean;
    relevance: boolean;
  };
  performanceMode: 'fast' | 'balanced' | 'thorough'; // Performance vs accuracy tradeoff
  caching: {
    enabled: boolean;
    ttlMs: number;           // Cache TTL in milliseconds
    maxSize: number;         // Maximum cache size
  };
}

export const DEFAULT_QUALITY_CONFIG: QualityConfig = {
  weights: {
    authority: 0.3,           // 30% - Source credibility is crucial
    content: 0.25,            // 25% - Content quality matters
    recency: 0.2,             // 20% - Freshness is important
    corroboration: 0.15,      // 15% - Multi-source support
    relevance: 0.1,           // 10% - Relevance to target
  },
  enabledComponents: {
    authority: true,
    content: true,
    recency: true,
    corroboration: true,
    relevance: true,
  },
  performanceMode: 'balanced',
  caching: {
    enabled: true,
    ttlMs: 300000,           // 5 minutes
    maxSize: 1000,           // 1000 cached results
  },
};

/**
 * Comprehensive evidence information for quality assessment
 */
export interface EvidenceForQuality {
  // Core evidence data
  id: string;
  text: string;
  sourceId: string;
  startIndex: number;
  endIndex: number;
  wordCount: number;
  sentenceCount: number;
  hasCompleteStart: boolean;
  hasCompleteEnd: boolean;
  metadata: Record<string, any>;
  
  // Source information
  source: {
    id: string;
    url: string;
    title?: string;
    publishedAt?: Date;
    fetchedAt: Date;
    tier: string;
    domain: string;
    author?: string;
    metadata: Record<string, any>;
  };
  
  // Optional context for relevance scoring
  relevanceTarget?: RelevanceTarget;
  
  // Related evidence for corroboration
  relatedEvidence?: EvidenceForCorroboration[];
}

/**
 * Comprehensive quality assessment result
 */
export interface QualityAssessment {
  score: number;              // Final quality score (0.0-1.0)
  components: {
    authority?: AuthorityScore;
    content?: ContentScore;
    recency?: RecencyScore;
    corroboration?: CorroborationScore;
    relevance?: RelevanceScore;
  };
  breakdown: {
    authority: number;        // Individual component scores
    content: number;
    recency: number;
    corroboration: number;
    relevance: number;
  };
  confidence: number;         // Confidence in the assessment (0.0-1.0)
  processingTimeMs: number;   // Time taken for assessment
  reasoning: string[];        // Human-readable explanation
  cacheHit: boolean;         // Whether result was cached
}

/**
 * Cache entry for quality assessments
 */
interface CacheEntry {
  assessment: QualityAssessment;
  timestamp: number;
  hash: string;
}

/**
 * Quality service implementation
 */
export class QualityService {
  private config: QualityConfig;
  private authorityScorer: AuthorityScorer;
  private contentScorer: ContentScorer;
  private recencyScorer: RecencyScorer;
  private corroborationScorer: CorroborationScorer;
  private relevanceScorer: RelevanceScorer;
  private cache: Map<string, CacheEntry> = new Map();

  constructor(config: Partial<QualityConfig> = {}) {
    this.config = { ...DEFAULT_QUALITY_CONFIG, ...config };
    
    // Initialize component scorers
    this.authorityScorer = new AuthorityScorer();
    this.contentScorer = new ContentScorer();
    this.recencyScorer = new RecencyScorer();
    this.corroborationScorer = new CorroborationScorer();
    this.relevanceScorer = new RelevanceScorer();
    
    // Adjust performance settings
    this.adjustPerformanceSettings();
  }

  /**
   * Assess quality of evidence unit
   */
  async assessQuality(evidence: EvidenceForQuality): Promise<QualityAssessment> {
    const startTime = Date.now();
    const reasoning: string[] = [];
    
    // Check cache first
    const cacheKey = this.generateCacheKey(evidence);
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      return { ...cached, cacheHit: true, processingTimeMs: Date.now() - startTime };
    }
    
    reasoning.push(`Starting quality assessment for evidence ${evidence.id}`);
    
    // Initialize component results
    const components: QualityAssessment['components'] = {};
    const breakdown: QualityAssessment['breakdown'] = {
      authority: 0,
      content: 0,
      recency: 0,
      corroboration: 0,
      relevance: 0,
    };
    
    // Score authority
    if (this.config.enabledComponents.authority) {
      const authorityInput: SourceAuthority = {
        tier: evidence.source.tier,
        url: evidence.source.url,
        domain: evidence.source.domain,
        title: evidence.source.title,
        publishedAt: evidence.source.publishedAt,
        metadata: evidence.source.metadata,
      };
      
      components.authority = this.authorityScorer.scoreAuthority(authorityInput);
      breakdown.authority = components.authority.score;
      reasoning.push(`Authority: ${(breakdown.authority * 100).toFixed(1)}%`);
    }
    
    // Score content quality
    if (this.config.enabledComponents.content) {
      const contentInput: EvidenceContent = {
        text: evidence.text,
        wordCount: evidence.wordCount,
        sentenceCount: evidence.sentenceCount,
        hasCompleteStart: evidence.hasCompleteStart,
        hasCompleteEnd: evidence.hasCompleteEnd,
        metadata: evidence.metadata,
      };
      
      components.content = this.contentScorer.scoreContent(contentInput);
      breakdown.content = components.content.score;
      reasoning.push(`Content: ${(breakdown.content * 100).toFixed(1)}%`);
    }
    
    // Score recency
    if (this.config.enabledComponents.recency) {
      const recencyInput: SourceRecency = {
        publishedAt: evidence.source.publishedAt,
        fetchedAt: evidence.source.fetchedAt,
        url: evidence.source.url,
        title: evidence.source.title,
        content: evidence.text,
        metadata: evidence.source.metadata,
      };
      
      components.recency = this.recencyScorer.scoreRecency(recencyInput);
      breakdown.recency = components.recency.score;
      reasoning.push(`Recency: ${(breakdown.recency * 100).toFixed(1)}%`);
    }
    
    // Score corroboration
    if (this.config.enabledComponents.corroboration && evidence.relatedEvidence) {
      const corroborationInput: EvidenceForCorroboration = {
        id: evidence.id,
        text: evidence.text,
        sourceId: evidence.sourceId,
        sourceDomain: evidence.source.domain,
        sourceTier: evidence.source.tier,
        sourceTitle: evidence.source.title,
        publishedAt: evidence.source.publishedAt,
        author: evidence.source.author,
        metadata: evidence.metadata,
      };
      
      components.corroboration = this.corroborationScorer.scoreCorroboration(
        corroborationInput, 
        evidence.relatedEvidence
      );
      breakdown.corroboration = components.corroboration.score;
      reasoning.push(`Corroboration: ${(breakdown.corroboration * 100).toFixed(1)}%`);
    }
    
    // Score relevance
    if (this.config.enabledComponents.relevance && evidence.relevanceTarget) {
      const relevanceInput: EvidenceForRelevance = {
        text: evidence.text,
        metadata: {
          topics: evidence.metadata.topics,
          extractedKeywords: evidence.metadata.keywords,
          context: evidence.metadata.context,
        },
      };
      
      components.relevance = this.relevanceScorer.scoreRelevance(
        relevanceInput, 
        evidence.relevanceTarget
      );
      breakdown.relevance = components.relevance.score;
      reasoning.push(`Relevance: ${(breakdown.relevance * 100).toFixed(1)}%`);
    }
    
    // Calculate weighted final score
    const finalScore = this.calculateWeightedScore(breakdown, reasoning);
    
    // Calculate confidence based on available components
    const confidence = this.calculateConfidence(breakdown, components);
    
    const processingTime = Date.now() - startTime;
    reasoning.push(`Assessment completed in ${processingTime}ms`);
    
    const assessment: QualityAssessment = {
      score: finalScore,
      components,
      breakdown,
      confidence,
      processingTimeMs: processingTime,
      reasoning,
      cacheHit: false,
    };
    
    // Cache the result
    if (this.config.caching.enabled) {
      this.cacheResult(cacheKey, assessment);
    }
    
    return assessment;
  }

  /**
   * Batch assess quality for multiple evidence units
   */
  async assessQualityBatch(evidenceList: EvidenceForQuality[]): Promise<QualityAssessment[]> {
    const results: QualityAssessment[] = [];
    
    // Process in parallel with concurrency limit based on performance mode
    const concurrency = this.getConcurrencyLimit();
    
    for (let i = 0; i < evidenceList.length; i += concurrency) {
      const batch = evidenceList.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(evidence => this.assessQuality(evidence))
      );
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Calculate weighted final score
   */
  private calculateWeightedScore(breakdown: QualityAssessment['breakdown'], reasoning: string[]): number {
    const { weights } = this.config;
    
    const finalScore = 
      breakdown.authority * weights.authority +
      breakdown.content * weights.content +
      breakdown.recency * weights.recency +
      breakdown.corroboration * weights.corroboration +
      breakdown.relevance * weights.relevance;
    
    reasoning.push(`Final weighted quality score: ${(finalScore * 100).toFixed(1)}%`);
    
    return Math.min(1.0, Math.max(0.0, finalScore));
  }

  /**
   * Calculate confidence in the assessment
   */
  private calculateConfidence(
    breakdown: QualityAssessment['breakdown'], 
    components: QualityAssessment['components']
  ): number {
    let confidence = 0;
    let componentCount = 0;
    
    // Base confidence on how many components were evaluated
    Object.entries(this.config.enabledComponents).forEach(([component, enabled]) => {
      if (enabled) {
        componentCount++;
        if (breakdown[component as keyof typeof breakdown] > 0) {
          confidence += 0.2; // Each component adds 20% confidence
        }
      }
    });
    
    // Bonus confidence for high-quality sources
    if (components.authority && components.authority.score > 0.8) {
      confidence += 0.1;
    }
    
    // Bonus confidence for corroborated evidence
    if (components.corroboration && components.corroboration.score > 0.6) {
      confidence += 0.1;
    }
    
    return Math.min(1.0, confidence);
  }

  /**
   * Adjust performance settings based on mode
   */
  private adjustPerformanceSettings(): void {
    const mode = this.config.performanceMode;
    
    switch (mode) {
      case 'fast':
        // Disable expensive components
        this.config.enabledComponents.corroboration = false;
        this.config.enabledComponents.relevance = false;
        break;
      
      case 'balanced':
        // Keep all components but optimize settings
        this.corroborationScorer.updateConfig({ maxSourcesConsidered: 20 });
        break;
      
      case 'thorough':
        // Maximum accuracy settings
        this.corroborationScorer.updateConfig({ maxSourcesConsidered: 100 });
        break;
    }
  }

  /**
   * Get concurrency limit based on performance mode
   */
  private getConcurrencyLimit(): number {
    switch (this.config.performanceMode) {
      case 'fast': return 10;
      case 'balanced': return 5;
      case 'thorough': return 2;
      default: return 5;
    }
  }

  /**
   * Generate cache key for evidence
   */
  private generateCacheKey(evidence: EvidenceForQuality): string {
    const keyData = {
      id: evidence.id,
      text: evidence.text.slice(0, 100), // First 100 chars for uniqueness
      sourceId: evidence.sourceId,
      tier: evidence.source.tier,
      url: evidence.source.url,
      publishedAt: evidence.source.publishedAt?.getTime(),
    };
    
    return JSON.stringify(keyData);
  }

  /**
   * Get cached result if valid
   */
  private getCachedResult(key: string): QualityAssessment | null {
    if (!this.config.caching.enabled) return null;
    
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check if cache entry is still valid
    const now = Date.now();
    if (now - entry.timestamp > this.config.caching.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.assessment;
  }

  /**
   * Cache assessment result
   */
  private cacheResult(key: string, assessment: QualityAssessment): void {
    if (!this.config.caching.enabled) return;
    
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.config.caching.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(key, {
      assessment: { ...assessment, cacheHit: false }, // Reset cache hit flag
      timestamp: Date.now(),
      hash: key,
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.cache.size,
      maxSize: this.config.caching.maxSize,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<QualityConfig>): void {
    this.config = { ...this.config, ...config };
    this.adjustPerformanceSettings();
  }

  /**
   * Get current configuration
   */
  getConfig(): QualityConfig {
    return { ...this.config };
  }

  /**
   * Update individual scorer configurations
   */
  updateScorerConfigs(configs: {
    authority?: Parameters<AuthorityScorer['updateConfig']>[0];
    content?: Parameters<ContentScorer['updateConfig']>[0];
    recency?: Parameters<RecencyScorer['updateConfig']>[0];
    corroboration?: Parameters<CorroborationScorer['updateConfig']>[0];
    relevance?: Parameters<RelevanceScorer['updateConfig']>[0];
  }): void {
    if (configs.authority) this.authorityScorer.updateConfig(configs.authority);
    if (configs.content) this.contentScorer.updateConfig(configs.content);
    if (configs.recency) this.recencyScorer.updateConfig(configs.recency);
    if (configs.corroboration) this.corroborationScorer.updateConfig(configs.corroboration);
    if (configs.relevance) this.relevanceScorer.updateConfig(configs.relevance);
  }
}