/**
 * Corroboration scoring for evidence units
 * Evaluates how well claims are supported by multiple independent sources
 */

import { cosineSimilarity } from '../utils/similarity';

export interface CorroborationConfig {
  similarityThreshold: number;    // Minimum similarity to consider sources corroborating
  maxSourcesConsidered: number;  // Maximum number of sources to analyze for performance
  weights: {
    sourceCount: number;         // Weight for number of supporting sources
    sourceDiversity: number;     // Weight for diversity of source types/domains
    consistencyScore: number;    // Weight for consistency across sources
    independenceScore: number;   // Weight for source independence
  };
  diversityFactors: {
    domainWeight: number;        // Weight for different domains
    tierWeight: number;          // Weight for different tier levels
    authorWeight: number;        // Weight for different authors
    timeWeight: number;          // Weight for different time periods
  };
  independencePatterns: {
    sameAuthor: RegExp[];        // Patterns to detect same author
    relatedDomains: string[][];  // Groups of related domains
    syndication: RegExp[];       // Patterns indicating syndicated content
  };
}

export const DEFAULT_CORROBORATION_CONFIG: CorroborationConfig = {
  similarityThreshold: 0.7,      // 70% similarity to consider corroborating
  maxSourcesConsidered: 50,      // Analyze up to 50 sources for performance
  weights: {
    sourceCount: 0.4,            // 40% weight for number of sources
    sourceDiversity: 0.25,       // 25% weight for source diversity
    consistencyScore: 0.2,       // 20% weight for consistency
    independenceScore: 0.15,     // 15% weight for independence
  },
  diversityFactors: {
    domainWeight: 0.4,           // 40% weight for domain diversity
    tierWeight: 0.25,            // 25% weight for tier diversity
    authorWeight: 0.2,           // 20% weight for author diversity
    timeWeight: 0.15,            // 15% weight for time diversity
  },
  independencePatterns: {
    sameAuthor: [
      /by\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i,     // "by John Smith"
      /author[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/i, // "author: John Smith"
      /@([a-zA-Z0-9_]+)/,                       // "@username"
    ],
    relatedDomains: [
      ['cnn.com', 'edition.cnn.com'],
      ['bbc.com', 'bbc.co.uk'],
      ['reuters.com', 'reuters.org'],
      ['nytimes.com', 'nyti.ms'],
      ['washingtonpost.com', 'wapo.st'],
      ['theguardian.com', 'guardian.co.uk'],
    ],
    syndication: [
      /\b(AP|Reuters|Bloomberg|Associated Press)\b/i,
      /\b(syndicated|wire service|news service)\b/i,
      /\b(originally published|first published|republished)\b/i,
    ],
  },
};

/**
 * Evidence unit information for corroboration analysis
 */
export interface EvidenceForCorroboration {
  id: string;
  text: string;
  sourceId: string;
  sourceDomain: string;
  sourceTier: string;
  sourceTitle?: string;
  publishedAt?: Date;
  author?: string;
  metadata: Record<string, any>;
}

/**
 * Corroboration analysis result
 */
export interface CorroborationScore {
  score: number;                // Final corroboration score (0.0-1.0)
  components: {
    sourceCount: number;        // Score based on number of supporting sources
    sourceDiversity: number;    // Score based on diversity of sources
    consistencyScore: number;   // Score based on consistency across sources
    independenceScore: number;  // Score based on source independence
  };
  corroboratingEvidence: {
    evidenceId: string;
    sourceId: string;
    similarity: number;
    isIndependent: boolean;
  }[];
  sourceAnalysis: {
    totalSources: number;
    uniqueDomains: number;
    uniqueTiers: number;
    uniqueAuthors: number;
    timeSpread: number;         // Days between earliest and latest
    independentSources: number;
  };
  reasoning: string[];          // Human-readable explanation
}

/**
 * Corroboration scorer implementation
 */
export class CorroborationScorer {
  private config: CorroborationConfig;

  constructor(config: Partial<CorroborationConfig> = {}) {
    this.config = this.mergeConfig(DEFAULT_CORROBORATION_CONFIG, config);
  }

  /**
   * Calculate corroboration score for evidence against a set of related evidence
   */
  scoreCorroboration(
    targetEvidence: EvidenceForCorroboration,
    allEvidence: EvidenceForCorroboration[]
  ): CorroborationScore {
    const reasoning: string[] = [];
    
    // Filter out the target evidence and limit for performance
    const otherEvidence = allEvidence
      .filter(e => e.id !== targetEvidence.id)
      .slice(0, this.config.maxSourcesConsidered);
    
    // Find corroborating evidence based on similarity
    const corroborating = this.findCorroboratingEvidence(targetEvidence, otherEvidence, reasoning);
    
    // Analyze source characteristics
    const sourceAnalysis = this.analyzeSourceCharacteristics(corroborating, reasoning);
    
    // Calculate component scores
    const sourceCount = this.scoreSourceCount(corroborating.length, reasoning);
    const sourceDiversity = this.scoreSourceDiversity(sourceAnalysis, reasoning);
    const consistencyScore = this.scoreConsistency(targetEvidence, corroborating, reasoning);
    const independenceScore = this.scoreIndependence(corroborating, reasoning);
    
    // Calculate weighted final score
    const components = { sourceCount, sourceDiversity, consistencyScore, independenceScore };
    const finalScore = this.calculateWeightedScore(components, reasoning);
    
    return {
      score: finalScore,
      components,
      corroboratingEvidence: corroborating.map(c => ({
        evidenceId: c.evidence.id,
        sourceId: c.evidence.sourceId,
        similarity: c.similarity,
        isIndependent: c.isIndependent,
      })),
      sourceAnalysis,
      reasoning,
    };
  }

  /**
   * Find evidence that corroborates the target evidence
   */
  private findCorroboratingEvidence(
    target: EvidenceForCorroboration,
    candidates: EvidenceForCorroboration[],
    reasoning: string[]
  ): Array<{ evidence: EvidenceForCorroboration; similarity: number; isIndependent: boolean }> {
    const corroborating: Array<{ 
      evidence: EvidenceForCorroboration; 
      similarity: number; 
      isIndependent: boolean;
    }> = [];
    
    // Prepare target text for comparison
    const targetText = this.preprocessText(target.text);
    
    for (const candidate of candidates) {
      // Skip if from same source
      if (candidate.sourceId === target.sourceId) continue;
      
      // Calculate semantic similarity
      const candidateText = this.preprocessText(candidate.text);
      const similarity = cosineSimilarity(targetText, candidateText);
      
      // Check if similarity threshold is met
      if (similarity >= this.config.similarityThreshold) {
        const isIndependent = this.assessIndependence(target, candidate);
        corroborating.push({ evidence: candidate, similarity, isIndependent });
      }
    }
    
    // Sort by similarity (highest first)
    corroborating.sort((a, b) => b.similarity - a.similarity);
    
    reasoning.push(`Found ${corroborating.length} corroborating sources with similarity ≥ ${this.config.similarityThreshold}`);
    
    return corroborating;
  }

  /**
   * Analyze characteristics of corroborating sources
   */
  private analyzeSourceCharacteristics(
    corroborating: Array<{ evidence: EvidenceForCorroboration; similarity: number; isIndependent: boolean }>,
    reasoning: string[]
  ): CorroborationScore['sourceAnalysis'] {
    const sources = corroborating.map(c => c.evidence);
    
    const uniqueDomains = new Set(sources.map(s => s.sourceDomain)).size;
    const uniqueTiers = new Set(sources.map(s => s.sourceTier)).size;
    const uniqueAuthors = new Set(sources.map(s => s.author).filter(Boolean)).size;
    
    // Calculate time spread
    const dates = sources
      .map(s => s.publishedAt)
      .filter(Boolean) as Date[];
    
    let timeSpread = 0;
    if (dates.length > 1) {
      const sortedDates = dates.sort((a, b) => a.getTime() - b.getTime());
      const earliest = sortedDates[0];
      const latest = sortedDates[sortedDates.length - 1];
      if (earliest && latest) {
        timeSpread = Math.floor((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24));
      }
    }
    
    const independentSources = corroborating.filter(c => c.isIndependent).length;
    
    const analysis = {
      totalSources: sources.length,
      uniqueDomains,
      uniqueTiers,
      uniqueAuthors,
      timeSpread,
      independentSources,
    };
    
    reasoning.push(`Source diversity: ${uniqueDomains} domains, ${uniqueTiers} tiers, ${uniqueAuthors} authors, ${timeSpread} days spread`);
    
    return analysis;
  }

  /**
   * Score based on number of corroborating sources
   */
  private scoreSourceCount(count: number, reasoning: string[]): number {
    let score = 0;
    
    if (count === 0) {
      score = 0;
      reasoning.push(`No corroborating sources (0%)`);
    } else if (count === 1) {
      score = 0.3;
      reasoning.push(`Single corroborating source (30%)`);
    } else if (count === 2) {
      score = 0.6;
      reasoning.push(`Two corroborating sources (60%)`);
    } else if (count >= 3 && count <= 5) {
      score = 0.8 + (count - 3) * 0.05; // 80% to 90%
      reasoning.push(`Multiple corroborating sources (${(score * 100).toFixed(1)}%): ${count} sources`);
    } else {
      score = 1.0;
      reasoning.push(`Many corroborating sources (100%): ${count} sources`);
    }
    
    return Math.min(1.0, score);
  }

  /**
   * Score based on diversity of corroborating sources
   */
  private scoreSourceDiversity(analysis: CorroborationScore['sourceAnalysis'], reasoning: string[]): number {
    if (analysis.totalSources === 0) {
      return 0;
    }
    
    const { diversityFactors } = this.config;
    
    // Domain diversity score
    const domainScore = Math.min(1.0, analysis.uniqueDomains / Math.max(1, analysis.totalSources));
    
    // Tier diversity score
    const tierScore = Math.min(1.0, analysis.uniqueTiers / Math.min(4, analysis.totalSources)); // Max 4 tiers
    
    // Author diversity score
    const authorScore = analysis.uniqueAuthors > 0 ? 
      Math.min(1.0, analysis.uniqueAuthors / Math.max(1, analysis.totalSources)) : 0.5;
    
    // Time diversity score (higher spread is better, up to 30 days)
    const timeScore = Math.min(1.0, analysis.timeSpread / 30);
    
    const diversityScore = 
      domainScore * diversityFactors.domainWeight +
      tierScore * diversityFactors.tierWeight +
      authorScore * diversityFactors.authorWeight +
      timeScore * diversityFactors.timeWeight;
    
    reasoning.push(`Source diversity score: ${(diversityScore * 100).toFixed(1)}% (domains: ${(domainScore * 100).toFixed(1)}%, tiers: ${(tierScore * 100).toFixed(1)}%, authors: ${(authorScore * 100).toFixed(1)}%, time: ${(timeScore * 100).toFixed(1)}%)`);
    
    return diversityScore;
  }

  /**
   * Score based on consistency across corroborating sources
   */
  private scoreConsistency(
    target: EvidenceForCorroboration,
    corroborating: Array<{ evidence: EvidenceForCorroboration; similarity: number; isIndependent: boolean }>,
    reasoning: string[]
  ): number {
    if (corroborating.length === 0) {
      return 0;
    }
    
    // Average similarity score
    const avgSimilarity = corroborating.reduce((sum, c) => sum + c.similarity, 0) / corroborating.length;
    
    // Consistency based on similarity variance
    const similarities = corroborating.map(c => c.similarity);
    const variance = this.calculateVariance(similarities);
    const consistencyScore = Math.max(0, 1 - variance * 2); // Lower variance = higher consistency
    
    // Bonus for high average similarity
    const similarityBonus = Math.max(0, (avgSimilarity - this.config.similarityThreshold) * 2);
    
    const finalScore = Math.min(1.0, consistencyScore + similarityBonus);
    
    reasoning.push(`Consistency score: ${(finalScore * 100).toFixed(1)}% (avg similarity: ${(avgSimilarity * 100).toFixed(1)}%, variance: ${variance.toFixed(3)})`);
    
    return finalScore;
  }

  /**
   * Score based on independence of corroborating sources
   */
  private scoreIndependence(
    corroborating: Array<{ evidence: EvidenceForCorroboration; similarity: number; isIndependent: boolean }>,
    reasoning: string[]
  ): number {
    if (corroborating.length === 0) {
      return 0;
    }
    
    const independentCount = corroborating.filter(c => c.isIndependent).length;
    const independenceRatio = independentCount / corroborating.length;
    
    // Score based on ratio of independent sources
    let score = independenceRatio;
    
    // Bonus for having at least some independent sources
    if (independentCount > 0) {
      score = Math.min(1.0, score + 0.2);
    }
    
    reasoning.push(`Independence score: ${(score * 100).toFixed(1)}% (${independentCount}/${corroborating.length} independent sources)`);
    
    return score;
  }

  /**
   * Assess independence between two sources
   */
  private assessIndependence(
    source1: EvidenceForCorroboration,
    source2: EvidenceForCorroboration
  ): boolean {
    // Check for same domain or related domains
    if (this.areRelatedDomains(source1.sourceDomain, source2.sourceDomain)) {
      return false;
    }
    
    // Check for same author
    if (source1.author && source2.author && 
        this.isSameAuthor(source1.author, source2.author)) {
      return false;
    }
    
    // Check for syndicated content
    const text1 = `${source1.sourceTitle || ''} ${source1.text}`;
    const text2 = `${source2.sourceTitle || ''} ${source2.text}`;
    
    if (this.isSyndicatedContent(text1) || this.isSyndicatedContent(text2)) {
      return false;
    }
    
    // Check for very high similarity (potential copying)
    const similarity = cosineSimilarity(
      this.preprocessText(source1.text),
      this.preprocessText(source2.text)
    );
    
    if (similarity > 0.95) {
      return false;
    }
    
    return true;
  }

  /**
   * Check if two domains are related
   */
  private areRelatedDomains(domain1: string, domain2: string): boolean {
    if (domain1 === domain2) return true;
    
    return this.config.independencePatterns.relatedDomains.some(group =>
      group.includes(domain1) && group.includes(domain2)
    );
  }

  /**
   * Check if two author names likely refer to the same person
   */
  private isSameAuthor(author1: string, author2: string): boolean {
    const name1 = author1.toLowerCase().trim();
    const name2 = author2.toLowerCase().trim();
    
    // Exact match
    if (name1 === name2) return true;
    
    // Extract name parts
    const parts1 = name1.split(/\s+/);
    const parts2 = name2.split(/\s+/);
    
    // Check for same last name and first initial
    if (parts1.length >= 2 && parts2.length >= 2) {
      const lastName1 = parts1[parts1.length - 1];
      const lastName2 = parts2[parts2.length - 1];
      const firstName1 = parts1[0];
      const firstName2 = parts2[0];
      
      if (firstName1 && firstName2 && lastName1 === lastName2 && 
          firstName1[0] === firstName2[0]) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if content appears to be syndicated
   */
  private isSyndicatedContent(text: string): boolean {
    return this.config.independencePatterns.syndication.some(pattern =>
      pattern.test(text)
    );
  }

  /**
   * Preprocess text for similarity calculation
   */
  private preprocessText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')  // Remove punctuation
      .replace(/\s+/g, ' ')      // Normalize whitespace
      .trim();
  }

  /**
   * Calculate variance of an array of numbers
   */
  private calculateVariance(numbers: number[]): number {
    if (numbers.length <= 1) return 0;
    
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
    return squaredDiffs.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  /**
   * Calculate weighted final score
   */
  private calculateWeightedScore(components: CorroborationScore['components'], reasoning: string[]): number {
    const { weights } = this.config;
    
    const finalScore = 
      components.sourceCount * weights.sourceCount +
      components.sourceDiversity * weights.sourceDiversity +
      components.consistencyScore * weights.consistencyScore +
      components.independenceScore * weights.independenceScore;
    
    reasoning.push(`Final weighted corroboration score: ${(finalScore * 100).toFixed(1)}%`);
    
    return Math.min(1.0, Math.max(0.0, finalScore));
  }

  /**
   * Deep merge configuration objects
   */
  private mergeConfig(base: CorroborationConfig, override: Partial<CorroborationConfig>): CorroborationConfig {
    return {
      similarityThreshold: override.similarityThreshold ?? base.similarityThreshold,
      maxSourcesConsidered: override.maxSourcesConsidered ?? base.maxSourcesConsidered,
      weights: { ...base.weights, ...override.weights },
      diversityFactors: { ...base.diversityFactors, ...override.diversityFactors },
      independencePatterns: {
        sameAuthor: override.independencePatterns?.sameAuthor || base.independencePatterns.sameAuthor,
        relatedDomains: override.independencePatterns?.relatedDomains || base.independencePatterns.relatedDomains,
        syndication: override.independencePatterns?.syndication || base.independencePatterns.syndication,
      },
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CorroborationConfig>): void {
    this.config = this.mergeConfig(this.config, config);
  }

  /**
   * Get current configuration
   */
  getConfig(): CorroborationConfig {
    return JSON.parse(JSON.stringify(this.config));
  }
}