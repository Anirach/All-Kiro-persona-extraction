/**
 * Recency scoring for evidence sources
 * Evaluates how recent the information is with configurable time decay functions
 */

export interface RecencyConfig {
  decayFunctions: {
    news: {
      halfLife: number;        // Half-life in days for news content
      maxAge: number;          // Maximum age in days before score approaches 0
      baseScore: number;       // Base score for current content
    };
    academic: {
      halfLife: number;        // Half-life in days for academic content
      maxAge: number;          // Maximum age in days
      baseScore: number;       // Base score for current content
    };
    reference: {
      halfLife: number;        // Half-life in days for reference material
      maxAge: number;          // Maximum age in days
      baseScore: number;       // Base score for current content
    };
    historical: {
      halfLife: number;        // Half-life in days for historical content
      maxAge: number;          // Maximum age in days
      baseScore: number;       // Base score for current content
    };
  };
  contentTypePatterns: {
    news: RegExp[];            // Patterns to identify news content
    academic: RegExp[];        // Patterns to identify academic content
    reference: RegExp[];       // Patterns to identify reference material
    historical: RegExp[];      // Patterns to identify historical content
  };
  timelessTopics: RegExp[];    // Topics that are less affected by time
  factualIndicators: RegExp[]; // Indicators of factual vs opinion content
}

export const DEFAULT_RECENCY_CONFIG: RecencyConfig = {
  decayFunctions: {
    news: {
      halfLife: 30,           // News becomes half as relevant every 30 days
      maxAge: 365,            // 1 year maximum relevance
      baseScore: 1.0,         // Perfect score for current news
    },
    academic: {
      halfLife: 365,          // Academic content half-life of 1 year
      maxAge: 3650,           // 10 years maximum relevance
      baseScore: 0.95,        // Near-perfect score for current academic
    },
    reference: {
      halfLife: 730,          // Reference material half-life of 2 years
      maxAge: 7300,           // 20 years maximum relevance
      baseScore: 0.9,         // High score for current reference material
    },
    historical: {
      halfLife: 1825,         // Historical content half-life of 5 years
      maxAge: 36500,          // 100 years maximum relevance
      baseScore: 0.8,         // Good score for historical content
    },
  },
  contentTypePatterns: {
    news: [
      /\b(breaking|news|report|announced|today|yesterday|this week|this month)\b/i,
      /\b(reuters|ap|bbc|cnn|fox|nbc|abc|cbs|guardian|times|post)\b/i,
      /\b(press release|statement|announcement|update)\b/i,
    ],
    academic: [
      /\b(study|research|journal|paper|peer[\s-]?review|methodology|findings|analysis)\b/i,
      /\b(university|institute|professor|dr\.|phd|published|citation)\b/i,
      /\b(hypothesis|experiment|data|statistical|correlation|significant)\b/i,
    ],
    reference: [
      /\b(wikipedia|encyclopedia|manual|guide|documentation|specification)\b/i,
      /\b(definition|reference|handbook|textbook|standard)\b/i,
      /\b(overview|introduction|summary|background)\b/i,
    ],
    historical: [
      /\b(historical|archive|retrospective|timeline|chronology|legacy)\b/i,
      /\b(founded|established|originally|traditionally|historically)\b/i,
      /\b(decades? ago|years? ago|century|ancient|vintage|classic)\b/i,
    ],
  },
  timelessTopics: [
    /\b(mathematics?|physics?|chemistry|biology|philosophy|logic|ethics)\b/i,
    /\b(algorithm|theory|principle|law|theorem|definition|concept)\b/i,
    /\b(fundamental|basic|core|essential|universal|eternal)\b/i,
  ],
  factualIndicators: [
    /\b(fact|data|statistics?|evidence|proof|documentation|record)\b/i,
    /\b(according to|based on|cited|referenced|documented|verified)\b/i,
    /\b(\d+%|\d+\.\d+|approximately|exactly|precisely)\b/i,
  ],
};

/**
 * Content type classification
 */
export type ContentType = 'news' | 'academic' | 'reference' | 'historical';

/**
 * Recency analysis result
 */
export interface RecencyScore {
  score: number;              // Final recency score (0.0-1.0)
  contentType: ContentType;   // Detected content type
  ageInDays: number;         // Age of content in days
  components: {
    baseScore: number;        // Base score for content type
    decayScore: number;       // Time decay applied score
    timelessBoost: number;    // Boost for timeless topics
    factualBoost: number;     // Boost for factual content
  };
  reasoning: string[];        // Human-readable explanation
  isTimeless: boolean;        // Whether content is about timeless topics
  isFreshness: boolean;       // Whether freshness is critical for this content
}

/**
 * Source information for recency scoring
 */
export interface SourceRecency {
  publishedAt?: Date;         // Publication date
  fetchedAt: Date;           // When source was fetched
  url: string;               // Source URL
  title?: string;            // Source title
  content: string;           // Content text for type detection
  metadata: Record<string, any>; // Additional metadata
}

/**
 * Recency scorer implementation
 */
export class RecencyScorer {
  private config: RecencyConfig;

  constructor(config: Partial<RecencyConfig> = {}) {
    this.config = this.mergeConfig(DEFAULT_RECENCY_CONFIG, config);
  }

  /**
   * Calculate recency score for a source
   */
  scoreRecency(source: SourceRecency): RecencyScore {
    const reasoning: string[] = [];
    
    // Determine content type
    const contentType = this.detectContentType(source, reasoning);
    
    // Calculate age in days
    const referenceDate = source.publishedAt || source.fetchedAt;
    const ageInDays = this.calculateAgeInDays(referenceDate);
    reasoning.push(`Content age: ${ageInDays} days (published: ${referenceDate.toDateString()})`);
    
    // Check for timeless content
    const isTimeless = this.isTimelessContent(source.content, reasoning);
    
    // Check for freshness-critical content
    const isFreshness = this.isFreshnessCritical(source.content, reasoning);
    
    // Get base configuration for content type
    const typeConfig = this.config.decayFunctions[contentType];
    
    // Calculate base score
    const baseScore = typeConfig.baseScore;
    
    // Apply time decay
    let decayScore = this.calculateTimeDecay(ageInDays, typeConfig, reasoning);
    
    // Apply timeless topic boost
    let timelessBoost = 0;
    if (isTimeless) {
      timelessBoost = Math.min(0.3, 0.3 * (1 - decayScore)); // Up to 30% boost for timeless topics
      reasoning.push(`Timeless topic boost: +${(timelessBoost * 100).toFixed(1)}%`);
    }
    
    // Apply factual content boost
    let factualBoost = 0;
    if (this.isFactualContent(source.content)) {
      factualBoost = Math.min(0.15, 0.15 * (1 - decayScore)); // Up to 15% boost for factual content
      reasoning.push(`Factual content boost: +${(factualBoost * 100).toFixed(1)}%`);
    }
    
    // Penalty for freshness-critical content that's old
    if (isFreshness && ageInDays > 7) {
      const freshnessPenalty = Math.min(0.4, (ageInDays - 7) * 0.02);
      decayScore = Math.max(0, decayScore - freshnessPenalty);
      reasoning.push(`Freshness penalty: -${(freshnessPenalty * 100).toFixed(1)}% (critical content is ${ageInDays} days old)`);
    }
    
    // Calculate final score
    const finalScore = Math.min(1.0, Math.max(0.0, decayScore + timelessBoost + factualBoost));
    reasoning.push(`Final recency score: ${(finalScore * 100).toFixed(1)}%`);
    
    return {
      score: finalScore,
      contentType,
      ageInDays,
      components: {
        baseScore,
        decayScore,
        timelessBoost,
        factualBoost,
      },
      reasoning,
      isTimeless,
      isFreshness,
    };
  }

  /**
   * Detect content type from source information
   */
  private detectContentType(source: SourceRecency, reasoning: string[]): ContentType {
    const text = `${source.title || ''} ${source.content} ${source.url}`;
    const patterns = this.config.contentTypePatterns;
    
    // Check patterns in order of specificity
    const scores = {
      news: this.countPatternMatches(text, patterns.news),
      academic: this.countPatternMatches(text, patterns.academic),
      reference: this.countPatternMatches(text, patterns.reference),
      historical: this.countPatternMatches(text, patterns.historical),
    };
    
    // Find the type with the highest score
    const detectedType = Object.entries(scores).reduce((max, [type, score]) => 
      score > max.score ? { type: type as ContentType, score } : max,
      { type: 'reference' as ContentType, score: 0 }
    ).type;
    
    reasoning.push(`Detected content type: ${detectedType} (score: ${scores[detectedType]})`);
    return detectedType;
  }

  /**
   * Calculate age in days from reference date
   */
  private calculateAgeInDays(referenceDate: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - referenceDate.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  /**
   * Calculate time decay score using exponential decay
   */
  private calculateTimeDecay(ageInDays: number, typeConfig: RecencyConfig['decayFunctions']['news'], reasoning: string[]): number {
    if (ageInDays >= typeConfig.maxAge) {
      reasoning.push(`Content too old: ${ageInDays} days exceeds max age of ${typeConfig.maxAge} days`);
      return 0;
    }
    
    // Exponential decay: score = baseScore * (0.5)^(age/halfLife)
    const decayFactor = Math.pow(0.5, ageInDays / typeConfig.halfLife);
    const decayScore = typeConfig.baseScore * decayFactor;
    
    reasoning.push(`Time decay: ${(decayScore * 100).toFixed(1)}% (half-life: ${typeConfig.halfLife} days)`);
    return decayScore;
  }

  /**
   * Check if content is about timeless topics
   */
  private isTimelessContent(content: string, reasoning: string[]): boolean {
    const matches = this.countPatternMatches(content, this.config.timelessTopics);
    const isTimeless = matches > 0;
    
    if (isTimeless) {
      reasoning.push(`Timeless topic detected: ${matches} indicators found`);
    }
    
    return isTimeless;
  }

  /**
   * Check if content is freshness-critical (news, events, etc.)
   */
  private isFreshnessCritical(content: string, reasoning: string[]): boolean {
    const freshnessCriticalPatterns = [
      /\b(breaking|urgent|latest|current|now|today|yesterday|this week)\b/i,
      /\b(update|announcement|alert|development|happening)\b/i,
      /\b(stock|price|market|trading|earnings|financial)\b/i,
      /\b(weather|forecast|emergency|crisis|outbreak)\b/i,
    ];
    
    const matches = this.countPatternMatches(content, freshnessCriticalPatterns);
    const isFreshness = matches > 0;
    
    if (isFreshness) {
      reasoning.push(`Freshness-critical content: ${matches} indicators found`);
    }
    
    return isFreshness;
  }

  /**
   * Check if content is primarily factual vs opinion
   */
  private isFactualContent(content: string): boolean {
    const factualMatches = this.countPatternMatches(content, this.config.factualIndicators);
    const opinionPatterns = [
      /\b(i think|in my opinion|i believe|personally|i feel|arguably|supposedly)\b/i,
      /\b(should|ought|must|need to|have to|subjective|bias)\b/i,
    ];
    const opinionMatches = this.countPatternMatches(content, opinionPatterns);
    
    return factualMatches > opinionMatches;
  }

  /**
   * Count pattern matches in text
   */
  private countPatternMatches(text: string, patterns: RegExp[]): number {
    return patterns.reduce((count, pattern) => {
      const matches = text.match(pattern);
      return count + (matches ? matches.length : 0);
    }, 0);
  }

  /**
   * Deep merge configuration objects
   */
  private mergeConfig(base: RecencyConfig, override: Partial<RecencyConfig>): RecencyConfig {
    return {
      decayFunctions: {
        news: { ...base.decayFunctions.news, ...override.decayFunctions?.news },
        academic: { ...base.decayFunctions.academic, ...override.decayFunctions?.academic },
        reference: { ...base.decayFunctions.reference, ...override.decayFunctions?.reference },
        historical: { ...base.decayFunctions.historical, ...override.decayFunctions?.historical },
      },
      contentTypePatterns: {
        news: override.contentTypePatterns?.news || base.contentTypePatterns.news,
        academic: override.contentTypePatterns?.academic || base.contentTypePatterns.academic,
        reference: override.contentTypePatterns?.reference || base.contentTypePatterns.reference,
        historical: override.contentTypePatterns?.historical || base.contentTypePatterns.historical,
      },
      timelessTopics: override.timelessTopics || base.timelessTopics,
      factualIndicators: override.factualIndicators || base.factualIndicators,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RecencyConfig>): void {
    this.config = this.mergeConfig(this.config, config);
  }

  /**
   * Get current configuration
   */
  getConfig(): RecencyConfig {
    return JSON.parse(JSON.stringify(this.config));
  }
}