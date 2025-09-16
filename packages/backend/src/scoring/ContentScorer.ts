/**
 * Content quality scoring for evidence units
 * Evaluates text content based on specificity, completeness, readability, and information density
 */

export interface ContentConfig {
  weights: {
    specificity: number;      // How specific and detailed the content is
    completeness: number;     // How complete sentences and thoughts are
    readability: number;      // How readable and well-structured the text is
    informationDensity: number; // How much meaningful information per unit
    coherence: number;        // How coherent and logical the content flows
  };
  thresholds: {
    minWordCount: number;     // Minimum words for quality content
    maxWordCount: number;     // Maximum words before penalty
    minSentenceCount: number; // Minimum complete sentences
    maxPunctuationRatio: number; // Maximum ratio of punctuation to text
    minUniqueWordRatio: number; // Minimum ratio of unique to total words
  };
  patterns: {
    specificityIndicators: RegExp[];  // Patterns indicating specific information
    vagueIndicators: RegExp[];        // Patterns indicating vague content
    structuralIndicators: RegExp[];   // Patterns indicating good structure
    formalityIndicators: RegExp[];    // Patterns indicating formal writing
  };
}

export const DEFAULT_CONTENT_CONFIG: ContentConfig = {
  weights: {
    specificity: 0.3,         // 30% - Most important for evidence quality
    completeness: 0.25,       // 25% - Complete thoughts are crucial
    readability: 0.2,         // 20% - Readability affects comprehension
    informationDensity: 0.15, // 15% - Information density matters
    coherence: 0.1,           // 10% - Flow and logic
  },
  thresholds: {
    minWordCount: 15,         // At least 15 words for meaningful content
    maxWordCount: 100,        // Penalty above 100 words (too verbose)
    minSentenceCount: 1,      // At least 1 complete sentence
    maxPunctuationRatio: 0.25, // Max 25% punctuation
    minUniqueWordRatio: 0.6,  // At least 60% unique words
  },
  patterns: {
    specificityIndicators: [
      /\b(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})\b/,  // Dates
      /\b\d+(\.\d+)?(%|percent|dollars?|years?|months?|days?|hours?|minutes?)\b/i, // Numbers with units
      /\b(according to|cited by|reported by|published in|stated that)\b/i, // Attribution
      /\b(specifically|particularly|precisely|exactly|approximately)\b/i, // Precision indicators
      /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/, // Proper names (Person names)
      /\b[A-Z][a-z]+(?: [A-Z][a-z]+)* (University|Institute|Corporation|Company|Inc|Ltd)\b/, // Organizations
    ],
    vagueIndicators: [
      /\b(some|many|several|various|numerous|often|sometimes|usually|generally|typically)\b/i,
      /\b(thing|stuff|something|anything|everything|nothing|someone|anyone|everyone)\b/i,
      /\b(probably|maybe|perhaps|possibly|might|could|would|should)\b/i,
      /\b(seems?|appears?|looks? like|sounds? like)\b/i,
    ],
    structuralIndicators: [
      /\b(first|second|third|finally|in conclusion|furthermore|moreover|however|therefore)\b/i,
      /\b(for example|such as|including|namely|specifically)\b/i,
      /[.!?]\s+[A-Z]/, // Sentence transitions
      /:\s*[A-Z]/, // Colon transitions
    ],
    formalityIndicators: [
      /\b(research|study|analysis|data|evidence|methodology|findings|results)\b/i,
      /\b(demonstrated|established|indicated|revealed|confirmed|suggested)\b/i,
      /\b(significant|substantial|considerable|notable|important|crucial)\b/i,
    ],
  },
};

/**
 * Content quality analysis result
 */
export interface ContentScore {
  score: number;              // Final content quality score (0.0-1.0)
  components: {
    specificity: number;      // Specificity score (0.0-1.0)
    completeness: number;     // Completeness score (0.0-1.0)
    readability: number;      // Readability score (0.0-1.0)
    informationDensity: number; // Information density score (0.0-1.0)
    coherence: number;        // Coherence score (0.0-1.0)
  };
  metrics: {
    wordCount: number;
    sentenceCount: number;
    uniqueWordRatio: number;
    punctuationRatio: number;
    avgWordsPerSentence: number;
    specificityCount: number;
    vaguenessCount: number;
  };
  reasoning: string[];        // Human-readable explanation
}

/**
 * Evidence unit content for scoring
 */
export interface EvidenceContent {
  text: string;
  wordCount: number;
  sentenceCount: number;
  hasCompleteStart: boolean;
  hasCompleteEnd: boolean;
  metadata?: Record<string, any>;
}

/**
 * Content quality scorer implementation
 */
export class ContentScorer {
  private config: ContentConfig;

  constructor(config: Partial<ContentConfig> = {}) {
    this.config = this.mergeConfig(DEFAULT_CONTENT_CONFIG, config);
  }

  /**
   * Calculate content quality score for evidence text
   */
  scoreContent(content: EvidenceContent): ContentScore {
    const reasoning: string[] = [];
    const text = content.text;
    
    // Calculate base metrics
    const metrics = this.calculateMetrics(content);
    
    // Calculate component scores
    const specificity = this.scoreSpecificity(text, metrics, reasoning);
    const completeness = this.scoreCompleteness(content, metrics, reasoning);
    const readability = this.scoreReadability(text, metrics, reasoning);
    const informationDensity = this.scoreInformationDensity(text, metrics, reasoning);
    const coherence = this.scoreCoherence(text, metrics, reasoning);
    
    // Calculate weighted final score
    const components = { specificity, completeness, readability, informationDensity, coherence };
    const finalScore = this.calculateWeightedScore(components, reasoning);
    
    return {
      score: finalScore,
      components,
      metrics,
      reasoning,
    };
  }

  /**
   * Calculate basic text metrics
   */
  private calculateMetrics(content: EvidenceContent): ContentScore['metrics'] {
    const text = content.text;
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    const punctuation = text.match(/[^\w\s]/g) || [];
    
    return {
      wordCount: content.wordCount,
      sentenceCount: content.sentenceCount,
      uniqueWordRatio: words.length > 0 ? uniqueWords.size / words.length : 0,
      punctuationRatio: text.length > 0 ? punctuation.length / text.length : 0,
      avgWordsPerSentence: content.sentenceCount > 0 ? content.wordCount / content.sentenceCount : 0,
      specificityCount: this.countPatternMatches(text, this.config.patterns.specificityIndicators),
      vaguenessCount: this.countPatternMatches(text, this.config.patterns.vagueIndicators),
    };
  }

  /**
   * Score content specificity - how specific and detailed the information is
   */
  private scoreSpecificity(text: string, metrics: ContentScore['metrics'], reasoning: string[]): number {
    let score = 0.5; // Base score
    
    // Specific information indicators
    if (metrics.specificityCount > 0) {
      const boost = Math.min(0.4, metrics.specificityCount * 0.1);
      score += boost;
      reasoning.push(`Specificity indicators (+${(boost * 100).toFixed(1)}%): Found ${metrics.specificityCount} specific details`);
    }
    
    // Penalty for vague language
    if (metrics.vaguenessCount > 0) {
      const penalty = Math.min(0.3, metrics.vaguenessCount * 0.05);
      score -= penalty;
      reasoning.push(`Vague language penalty (-${(penalty * 100).toFixed(1)}%): Found ${metrics.vaguenessCount} vague terms`);
    }
    
    // Bonus for formal/academic language
    const formalityCount = this.countPatternMatches(text, this.config.patterns.formalityIndicators);
    if (formalityCount > 0) {
      const boost = Math.min(0.15, formalityCount * 0.05);
      score += boost;
      reasoning.push(`Formal language boost (+${(boost * 100).toFixed(1)}%): Found ${formalityCount} formal terms`);
    }
    
    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Score content completeness - how complete sentences and thoughts are
   */
  private scoreCompleteness(content: EvidenceContent, metrics: ContentScore['metrics'], reasoning: string[]): number {
    let score = 0.5; // Base score
    
    // Complete sentence structure
    if (content.hasCompleteStart && content.hasCompleteEnd) {
      score += 0.2;
      reasoning.push(`Complete boundaries (+20%): Text has complete start and end`);
    } else if (content.hasCompleteStart || content.hasCompleteEnd) {
      score += 0.1;
      reasoning.push(`Partial boundaries (+10%): Text has partial complete boundaries`);
    }
    
    // Sentence count relative to word count
    if (metrics.avgWordsPerSentence >= 8 && metrics.avgWordsPerSentence <= 25) {
      score += 0.15;
      reasoning.push(`Good sentence length (+15%): Average ${metrics.avgWordsPerSentence.toFixed(1)} words per sentence`);
    } else if (metrics.avgWordsPerSentence < 5) {
      score -= 0.1;
      reasoning.push(`Too short sentences (-10%): Average ${metrics.avgWordsPerSentence.toFixed(1)} words per sentence`);
    } else if (metrics.avgWordsPerSentence > 30) {
      score -= 0.1;
      reasoning.push(`Too long sentences (-10%): Average ${metrics.avgWordsPerSentence.toFixed(1)} words per sentence`);
    }
    
    // Proper punctuation usage
    if (metrics.punctuationRatio >= 0.05 && metrics.punctuationRatio <= this.config.thresholds.maxPunctuationRatio) {
      score += 0.1;
      reasoning.push(`Good punctuation (+10%): ${(metrics.punctuationRatio * 100).toFixed(1)}% punctuation ratio`);
    } else if (metrics.punctuationRatio > this.config.thresholds.maxPunctuationRatio) {
      score -= 0.15;
      reasoning.push(`Excessive punctuation (-15%): ${(metrics.punctuationRatio * 100).toFixed(1)}% punctuation ratio`);
    }
    
    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Score readability - how readable and well-structured the text is
   */
  private scoreReadability(text: string, metrics: ContentScore['metrics'], reasoning: string[]): number {
    let score = 0.5; // Base score
    
    // Word count in optimal range
    const { minWordCount, maxWordCount } = this.config.thresholds;
    if (metrics.wordCount >= minWordCount && metrics.wordCount <= maxWordCount) {
      score += 0.2;
      reasoning.push(`Optimal length (+20%): ${metrics.wordCount} words within ideal range`);
    } else if (metrics.wordCount < minWordCount) {
      const penalty = Math.min(0.3, (minWordCount - metrics.wordCount) * 0.02);
      score -= penalty;
      reasoning.push(`Too short (-${(penalty * 100).toFixed(1)}%): ${metrics.wordCount} words below minimum`);
    } else {
      const penalty = Math.min(0.2, (metrics.wordCount - maxWordCount) * 0.01);
      score -= penalty;
      reasoning.push(`Too long (-${(penalty * 100).toFixed(1)}%): ${metrics.wordCount} words above maximum`);
    }
    
    // Structural indicators
    const structuralCount = this.countPatternMatches(text, this.config.patterns.structuralIndicators);
    if (structuralCount > 0) {
      const boost = Math.min(0.15, structuralCount * 0.05);
      score += boost;
      reasoning.push(`Structural indicators (+${(boost * 100).toFixed(1)}%): Found ${structuralCount} structural elements`);
    }
    
    // Variety in vocabulary
    if (metrics.uniqueWordRatio >= this.config.thresholds.minUniqueWordRatio) {
      score += 0.15;
      reasoning.push(`Good vocabulary variety (+15%): ${(metrics.uniqueWordRatio * 100).toFixed(1)}% unique words`);
    } else {
      const penalty = (this.config.thresholds.minUniqueWordRatio - metrics.uniqueWordRatio) * 0.3;
      score -= penalty;
      reasoning.push(`Repetitive vocabulary (-${(penalty * 100).toFixed(1)}%): ${(metrics.uniqueWordRatio * 100).toFixed(1)}% unique words`);
    }
    
    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Score information density - how much meaningful information per unit
   */
  private scoreInformationDensity(text: string, metrics: ContentScore['metrics'], reasoning: string[]): number {
    let score = 0.5; // Base score
    
    // Information vs filler ratio
    const informationScore = metrics.specificityCount / Math.max(1, metrics.wordCount / 10);
    if (informationScore >= 0.5) {
      score += 0.3;
      reasoning.push(`High information density (+30%): ${informationScore.toFixed(2)} information ratio`);
    } else if (informationScore >= 0.2) {
      score += 0.15;
      reasoning.push(`Moderate information density (+15%): ${informationScore.toFixed(2)} information ratio`);
    }
    
    // Penalty for excessive filler words
    const fillerWords = /\b(just|really|very|quite|rather|somewhat|kind of|sort of|like|you know|I mean)\b/gi;
    const fillerCount = (text.match(fillerWords) || []).length;
    if (fillerCount > metrics.wordCount * 0.1) {
      const penalty = Math.min(0.2, fillerCount * 0.02);
      score -= penalty;
      reasoning.push(`Excessive filler words (-${(penalty * 100).toFixed(1)}%): ${fillerCount} filler words found`);
    }
    
    // Bonus for fact-dense content
    const factPatterns = /\b(\d+(\.\d+)?|[A-Z][a-z]+ \d{1,2}, \d{4}|Q\d \d{4}|\d{4}-\d{2}-\d{2})\b/g;
    const factCount = (text.match(factPatterns) || []).length;
    if (factCount > 0) {
      const boost = Math.min(0.2, factCount * 0.05);
      score += boost;
      reasoning.push(`Fact-dense content (+${(boost * 100).toFixed(1)}%): ${factCount} factual elements`);
    }
    
    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Score coherence - how coherent and logical the content flows
   */
  private scoreCoherence(text: string, metrics: ContentScore['metrics'], reasoning: string[]): number {
    let score = 0.5; // Base score
    
    // Logical flow indicators
    const transitionWords = /\b(however|therefore|furthermore|moreover|consequently|nevertheless|meanwhile|finally|in addition|for example|in contrast|similarly)\b/gi;
    const transitionCount = (text.match(transitionWords) || []).length;
    if (transitionCount > 0) {
      const boost = Math.min(0.2, transitionCount * 0.1);
      score += boost;
      reasoning.push(`Logical transitions (+${(boost * 100).toFixed(1)}%): ${transitionCount} transition words`);
    }
    
    // Consistent tense and voice
    const pastTense = (text.match(/\b\w+ed\b/g) || []).length;
    const presentTense = (text.match(/\b(is|are|has|have|does|do)\b/gi) || []).length;
    const totalVerbs = pastTense + presentTense;
    if (totalVerbs > 0) {
      const consistency = Math.max(pastTense, presentTense) / totalVerbs;
      if (consistency >= 0.7) {
        score += 0.15;
        reasoning.push(`Consistent tense (+15%): ${(consistency * 100).toFixed(1)}% consistency`);
      }
    }
    
    // Avoid contradictory statements
    const contradictionWords = /\b(but|however|although|despite|nevertheless|nonetheless|on the other hand)\b/gi;
    const contradictionCount = (text.match(contradictionWords) || []).length;
    if (contradictionCount > metrics.sentenceCount * 0.5) {
      score -= 0.1;
      reasoning.push(`Excessive contradictions (-10%): ${contradictionCount} contradiction indicators`);
    }
    
    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Calculate weighted final score
   */
  private calculateWeightedScore(components: ContentScore['components'], reasoning: string[]): number {
    const { weights } = this.config;
    const finalScore = 
      components.specificity * weights.specificity +
      components.completeness * weights.completeness +
      components.readability * weights.readability +
      components.informationDensity * weights.informationDensity +
      components.coherence * weights.coherence;
    
    reasoning.push(`Final weighted score: ${(finalScore * 100).toFixed(1)}%`);
    return Math.min(1.0, Math.max(0.0, finalScore));
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
  private mergeConfig(base: ContentConfig, override: Partial<ContentConfig>): ContentConfig {
    return {
      weights: { ...base.weights, ...override.weights },
      thresholds: { ...base.thresholds, ...override.thresholds },
      patterns: {
        specificityIndicators: override.patterns?.specificityIndicators || base.patterns.specificityIndicators,
        vagueIndicators: override.patterns?.vagueIndicators || base.patterns.vagueIndicators,
        structuralIndicators: override.patterns?.structuralIndicators || base.patterns.structuralIndicators,
        formalityIndicators: override.patterns?.formalityIndicators || base.patterns.formalityIndicators,
      },
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ContentConfig>): void {
    this.config = this.mergeConfig(this.config, config);
  }

  /**
   * Get current configuration
   */
  getConfig(): ContentConfig {
    return JSON.parse(JSON.stringify(this.config));
  }
}