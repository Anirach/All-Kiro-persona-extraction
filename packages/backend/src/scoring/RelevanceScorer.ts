/**
 * Relevance scoring for evidence units
 * Evaluates how relevant evidence is to target persona fields or topics using semantic similarity
 */

import { cosineSimilarity } from '../utils/similarity';

export interface RelevanceConfig {
  similarityThreshold: number;   // Minimum similarity to consider relevant
  weights: {
    directMatch: number;         // Weight for direct topic/keyword matches
    semanticSimilarity: number;  // Weight for semantic similarity
    contextualRelevance: number; // Weight for contextual relevance
    domainSpecificity: number;   // Weight for domain-specific relevance
  };
  topicCategories: {
    [category: string]: {
      keywords: string[];        // Keywords for this category
      patterns: RegExp[];        // Regex patterns for this category
      weight: number;            // Importance weight for this category
    };
  };
  personaFields: {
    [field: string]: {
      keywords: string[];        // Keywords relevant to this persona field
      patterns: RegExp[];        // Patterns relevant to this field
      weight: number;            // Importance weight for this field
    };
  };
  contextPatterns: {
    professional: RegExp[];      // Professional context indicators
    personal: RegExp[];          // Personal context indicators
    educational: RegExp[];       // Educational context indicators
    social: RegExp[];            // Social context indicators
  };
}

export const DEFAULT_RELEVANCE_CONFIG: RelevanceConfig = {
  similarityThreshold: 0.3,      // 30% similarity minimum for relevance
  weights: {
    directMatch: 0.4,            // 40% weight for direct matches
    semanticSimilarity: 0.3,     // 30% weight for semantic similarity
    contextualRelevance: 0.2,    // 20% weight for contextual relevance
    domainSpecificity: 0.1,      // 10% weight for domain specificity
  },
  topicCategories: {
    career: {
      keywords: ['job', 'work', 'career', 'profession', 'employment', 'company', 'position', 'role', 'title', 'experience'],
      patterns: [
        /\b(worked at|employed by|position at|role as|experience in)\b/i,
        /\b(software engineer|developer|manager|director|ceo|cto|analyst)\b/i,
        /\b(years? of experience|background in|specialized in)\b/i,
      ],
      weight: 1.0,
    },
    education: {
      keywords: ['education', 'school', 'university', 'college', 'degree', 'graduate', 'study', 'major', 'phd', 'master'],
      patterns: [
        /\b(graduated from|degree in|studied at|phd in|master of)\b/i,
        /\b(university|college|institute|school)\b/i,
        /\b(bachelor|master|doctorate|phd|mba)\b/i,
      ],
      weight: 0.9,
    },
    skills: {
      keywords: ['skill', 'ability', 'expertise', 'proficient', 'experienced', 'knowledge', 'competent', 'capable'],
      patterns: [
        /\b(skilled in|expertise in|proficient at|experienced with)\b/i,
        /\b(programming|coding|development|design|analysis|management)\b/i,
        /\b(python|javascript|react|aws|machine learning|data science)\b/i,
      ],
      weight: 0.8,
    },
    personal: {
      keywords: ['interests', 'hobbies', 'passion', 'enjoys', 'likes', 'loves', 'personal', 'family', 'married'],
      patterns: [
        /\b(interested in|passionate about|enjoys|hobby|personal interest)\b/i,
        /\b(married to|spouse|partner|children|family)\b/i,
        /\b(travels|sports|music|reading|cooking|photography)\b/i,
      ],
      weight: 0.6,
    },
    achievements: {
      keywords: ['award', 'recognition', 'achievement', 'accomplishment', 'success', 'winner', 'published', 'patent'],
      patterns: [
        /\b(won|awarded|recognized|achieved|accomplished)\b/i,
        /\b(published|authored|patent|invention|breakthrough)\b/i,
        /\b(first place|winner|champion|excellence)\b/i,
      ],
      weight: 0.7,
    },
  },
  personaFields: {
    name: {
      keywords: ['name', 'called', 'known as', 'mr', 'ms', 'dr'],
      patterns: [
        /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/,  // Full names
        /\b(known as|called|name is|named)\b/i,
      ],
      weight: 1.0,
    },
    jobTitle: {
      keywords: ['title', 'position', 'role', 'job', 'works as', 'employed as'],
      patterns: [
        /\b(software engineer|developer|manager|director|analyst|consultant)\b/i,
        /\b(works as|employed as|position of|title of|role as)\b/i,
      ],
      weight: 0.9,
    },
    company: {
      keywords: ['company', 'organization', 'firm', 'corporation', 'startup', 'works at'],
      patterns: [
        /\b(works at|employed by|company|corporation|inc|ltd|llc)\b/i,
        /\b(Google|Microsoft|Amazon|Apple|Facebook|Meta|Netflix|Tesla)\b/i,
      ],
      weight: 0.9,
    },
    education: {
      keywords: ['education', 'degree', 'university', 'college', 'graduated', 'studied'],
      patterns: [
        /\b(graduated from|degree in|studied at|university|college)\b/i,
        /\b(bachelor|master|phd|mba|bs|ms|ba|ma)\b/i,
      ],
      weight: 0.8,
    },
    location: {
      keywords: ['location', 'lives', 'based', 'from', 'city', 'state', 'country'],
      patterns: [
        /\b(lives in|based in|from|located in|resides in)\b/i,
        /\b([A-Z][a-z]+, [A-Z][A-Z]|[A-Z][a-z]+, [A-Z][a-z]+)\b/, // City, State or City, Country
      ],
      weight: 0.7,
    },
  },
  contextPatterns: {
    professional: [
      /\b(work|job|career|professional|business|corporate|company|office)\b/i,
      /\b(meeting|project|team|client|deadline|presentation|budget)\b/i,
      /\b(strategy|leadership|management|development|innovation)\b/i,
    ],
    personal: [
      /\b(personal|family|home|private|individual|self|own)\b/i,
      /\b(hobby|interest|passion|enjoy|like|love|prefer)\b/i,
      /\b(weekend|vacation|travel|leisure|entertainment)\b/i,
    ],
    educational: [
      /\b(education|academic|school|university|college|study|research)\b/i,
      /\b(learn|knowledge|understanding|analysis|theory|practice)\b/i,
      /\b(course|curriculum|degree|certification|training)\b/i,
    ],
    social: [
      /\b(social|community|friends|network|relationship|group)\b/i,
      /\b(volunteer|charity|cause|organization|society|club)\b/i,
      /\b(event|gathering|conference|meetup|party|celebration)\b/i,
    ],
  },
};

/**
 * Relevance target for scoring
 */
export interface RelevanceTarget {
  topics?: string[];           // Target topics
  personaFields?: string[];    // Target persona fields
  keywords?: string[];         // Target keywords
  context?: string;            // Additional context
}

/**
 * Evidence content for relevance scoring
 */
export interface EvidenceForRelevance {
  text: string;
  metadata?: {
    topics?: string[];
    extractedKeywords?: string[];
    context?: string;
  };
}

/**
 * Relevance analysis result
 */
export interface RelevanceScore {
  score: number;               // Final relevance score (0.0-1.0)
  components: {
    directMatch: number;       // Direct match score
    semanticSimilarity: number; // Semantic similarity score
    contextualRelevance: number; // Contextual relevance score
    domainSpecificity: number; // Domain specificity score
  };
  matchedTopics: string[];     // Topics that matched
  matchedFields: string[];     // Persona fields that matched
  matchedKeywords: string[];   // Keywords that matched
  detectedContext: string[];   // Detected context types
  reasoning: string[];         // Human-readable explanation
}

/**
 * Relevance scorer implementation
 */
export class RelevanceScorer {
  private config: RelevanceConfig;

  constructor(config: Partial<RelevanceConfig> = {}) {
    this.config = this.mergeConfig(DEFAULT_RELEVANCE_CONFIG, config);
  }

  /**
   * Calculate relevance score for evidence against a target
   */
  scoreRelevance(evidence: EvidenceForRelevance, target: RelevanceTarget): RelevanceScore {
    const reasoning: string[] = [];
    
    // Calculate component scores
    const directMatch = this.scoreDirectMatch(evidence, target, reasoning);
    const semanticSimilarity = this.scoreSemanticSimilarity(evidence, target, reasoning);
    const contextualRelevance = this.scoreContextualRelevance(evidence, target, reasoning);
    const domainSpecificity = this.scoreDomainSpecificity(evidence, target, reasoning);
    
    // Collect matched elements
    const matchedTopics = this.findMatchedTopics(evidence, target);
    const matchedFields = this.findMatchedFields(evidence, target);
    const matchedKeywords = this.findMatchedKeywords(evidence, target);
    const detectedContext = this.detectContext(evidence.text);
    
    // Calculate weighted final score
    const components = { directMatch, semanticSimilarity, contextualRelevance, domainSpecificity };
    const finalScore = this.calculateWeightedScore(components, reasoning);
    
    return {
      score: finalScore,
      components,
      matchedTopics,
      matchedFields,
      matchedKeywords,
      detectedContext,
      reasoning,
    };
  }

  /**
   * Score direct matches between evidence and target
   */
  private scoreDirectMatch(evidence: EvidenceForRelevance, target: RelevanceTarget, reasoning: string[]): number {
    let score = 0;
    const text = evidence.text.toLowerCase();
    let matchCount = 0;
    
    // Check topic matches
    if (target.topics) {
      for (const topic of target.topics) {
        const topicConfig = this.config.topicCategories[topic];
        if (topicConfig) {
          // Check keywords
          const keywordMatches = topicConfig.keywords.filter(keyword => 
            text.includes(keyword.toLowerCase())
          ).length;
          
          // Check patterns
          const patternMatches = topicConfig.patterns.filter(pattern => 
            pattern.test(text)
          ).length;
          
          if (keywordMatches > 0 || patternMatches > 0) {
            const topicScore = topicConfig.weight * (keywordMatches + patternMatches) * 0.1;
            score += topicScore;
            matchCount += keywordMatches + patternMatches;
            reasoning.push(`Topic "${topic}" match: +${(topicScore * 100).toFixed(1)}% (${keywordMatches} keywords, ${patternMatches} patterns)`);
          }
        }
      }
    }
    
    // Check persona field matches
    if (target.personaFields) {
      for (const field of target.personaFields) {
        const fieldConfig = this.config.personaFields[field];
        if (fieldConfig) {
          const keywordMatches = fieldConfig.keywords.filter(keyword => 
            text.includes(keyword.toLowerCase())
          ).length;
          
          const patternMatches = fieldConfig.patterns.filter(pattern => 
            pattern.test(text)
          ).length;
          
          if (keywordMatches > 0 || patternMatches > 0) {
            const fieldScore = fieldConfig.weight * (keywordMatches + patternMatches) * 0.15;
            score += fieldScore;
            matchCount += keywordMatches + patternMatches;
            reasoning.push(`Field "${field}" match: +${(fieldScore * 100).toFixed(1)}% (${keywordMatches} keywords, ${patternMatches} patterns)`);
          }
        }
      }
    }
    
    // Check direct keyword matches
    if (target.keywords) {
      const keywordMatches = target.keywords.filter(keyword => 
        text.includes(keyword.toLowerCase())
      ).length;
      
      if (keywordMatches > 0) {
        const keywordScore = keywordMatches * 0.1;
        score += keywordScore;
        matchCount += keywordMatches;
        reasoning.push(`Direct keyword matches: +${(keywordScore * 100).toFixed(1)}% (${keywordMatches} matches)`);
      }
    }
    
    // Normalize score
    const normalizedScore = Math.min(1.0, score);
    reasoning.push(`Direct match score: ${(normalizedScore * 100).toFixed(1)}% (${matchCount} total matches)`);
    
    return normalizedScore;
  }

  /**
   * Score semantic similarity between evidence and target context
   */
  private scoreSemanticSimilarity(evidence: EvidenceForRelevance, target: RelevanceTarget, reasoning: string[]): number {
    if (!target.context) {
      reasoning.push(`Semantic similarity: 50% (no target context provided)`);
      return 0.5;
    }
    
    // Prepare texts for comparison
    const evidenceText = this.preprocessText(evidence.text);
    const targetText = this.preprocessText(target.context);
    
    // Calculate cosine similarity
    const similarity = cosineSimilarity(evidenceText, targetText);
    
    // Apply threshold
    const score = similarity >= this.config.similarityThreshold ? similarity : 0;
    
    reasoning.push(`Semantic similarity: ${(score * 100).toFixed(1)}% (cosine similarity: ${(similarity * 100).toFixed(1)}%)`);
    
    return score;
  }

  /**
   * Score contextual relevance based on detected context types
   */
  private scoreContextualRelevance(evidence: EvidenceForRelevance, target: RelevanceTarget, reasoning: string[]): number {
    const detectedContexts = this.detectContext(evidence.text);
    
    if (detectedContexts.length === 0) {
      reasoning.push(`Contextual relevance: 30% (no specific context detected)`);
      return 0.3;
    }
    
    // Score based on context alignment with target
    let score = 0;
    const contextScores: Record<string, number> = {
      professional: 0.9,  // High relevance for professional context
      educational: 0.8,   // High relevance for educational context
      personal: 0.6,      // Medium relevance for personal context
      social: 0.5,        // Medium relevance for social context
    };
    
    for (const context of detectedContexts) {
      const contextScore = contextScores[context] || 0.4;
      score = Math.max(score, contextScore);
    }
    
    reasoning.push(`Contextual relevance: ${(score * 100).toFixed(1)}% (contexts: ${detectedContexts.join(', ')})`);
    
    return score;
  }

  /**
   * Score domain specificity - how specific the evidence is to the target domain
   */
  private scoreDomainSpecificity(evidence: EvidenceForRelevance, target: RelevanceTarget, reasoning: string[]): number {
    const text = evidence.text.toLowerCase();
    
    // Look for specific technical terms, proper nouns, domain-specific language
    const specificityIndicators = [
      /\b[A-Z]{2,}\b/g,                    // Acronyms
      /\b\d+(\.\d+)?[a-zA-Z]+\b/g,        // Numbers with units
      /\b[a-z]+\.[a-z]+\.[a-z]+\b/g,      // Technical notation (e.g., package.module.function)
      /\b[A-Z][a-z]+[A-Z][a-z]+\b/g,      // CamelCase terms
      /\b\w+@\w+\.\w+\b/g,                // Email addresses
      /\bhttps?:\/\/\S+\b/g,              // URLs
    ];
    
    let specificityCount = 0;
    for (const pattern of specificityIndicators) {
      const matches = evidence.text.match(pattern);
      specificityCount += matches ? matches.length : 0;
    }
    
    // Score based on specificity density
    const wordCount = evidence.text.split(/\s+/).length;
    const specificityRatio = wordCount > 0 ? specificityCount / wordCount : 0;
    
    let score = 0;
    if (specificityRatio > 0.1) {
      score = 0.9;  // Very specific
    } else if (specificityRatio > 0.05) {
      score = 0.7;  // Moderately specific
    } else if (specificityRatio > 0.02) {
      score = 0.5;  // Somewhat specific
    } else {
      score = 0.3;  // General content
    }
    
    reasoning.push(`Domain specificity: ${(score * 100).toFixed(1)}% (${specificityCount} indicators, ratio: ${(specificityRatio * 100).toFixed(2)}%)`);
    
    return score;
  }

  /**
   * Find matched topics in evidence
   */
  private findMatchedTopics(evidence: EvidenceForRelevance, target: RelevanceTarget): string[] {
    if (!target.topics) return [];
    
    const text = evidence.text.toLowerCase();
    const matched: string[] = [];
    
    for (const topic of target.topics) {
      const topicConfig = this.config.topicCategories[topic];
      if (topicConfig) {
        const hasKeyword = topicConfig.keywords.some(keyword => 
          text.includes(keyword.toLowerCase())
        );
        const hasPattern = topicConfig.patterns.some(pattern => 
          pattern.test(evidence.text)
        );
        
        if (hasKeyword || hasPattern) {
          matched.push(topic);
        }
      }
    }
    
    return matched;
  }

  /**
   * Find matched persona fields in evidence
   */
  private findMatchedFields(evidence: EvidenceForRelevance, target: RelevanceTarget): string[] {
    if (!target.personaFields) return [];
    
    const text = evidence.text.toLowerCase();
    const matched: string[] = [];
    
    for (const field of target.personaFields) {
      const fieldConfig = this.config.personaFields[field];
      if (fieldConfig) {
        const hasKeyword = fieldConfig.keywords.some(keyword => 
          text.includes(keyword.toLowerCase())
        );
        const hasPattern = fieldConfig.patterns.some(pattern => 
          pattern.test(evidence.text)
        );
        
        if (hasKeyword || hasPattern) {
          matched.push(field);
        }
      }
    }
    
    return matched;
  }

  /**
   * Find matched keywords in evidence
   */
  private findMatchedKeywords(evidence: EvidenceForRelevance, target: RelevanceTarget): string[] {
    if (!target.keywords) return [];
    
    const text = evidence.text.toLowerCase();
    return target.keywords.filter(keyword => 
      text.includes(keyword.toLowerCase())
    );
  }

  /**
   * Detect context types in evidence text
   */
  private detectContext(text: string): string[] {
    const contexts: string[] = [];
    
    for (const [contextType, patterns] of Object.entries(this.config.contextPatterns)) {
      if (patterns.some(pattern => pattern.test(text))) {
        contexts.push(contextType);
      }
    }
    
    return contexts;
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
   * Calculate weighted final score
   */
  private calculateWeightedScore(components: RelevanceScore['components'], reasoning: string[]): number {
    const { weights } = this.config;
    
    const finalScore = 
      components.directMatch * weights.directMatch +
      components.semanticSimilarity * weights.semanticSimilarity +
      components.contextualRelevance * weights.contextualRelevance +
      components.domainSpecificity * weights.domainSpecificity;
    
    reasoning.push(`Final weighted relevance score: ${(finalScore * 100).toFixed(1)}%`);
    
    return Math.min(1.0, Math.max(0.0, finalScore));
  }

  /**
   * Deep merge configuration objects
   */
  private mergeConfig(base: RelevanceConfig, override: Partial<RelevanceConfig>): RelevanceConfig {
    return {
      similarityThreshold: override.similarityThreshold ?? base.similarityThreshold,
      weights: { ...base.weights, ...override.weights },
      topicCategories: { ...base.topicCategories, ...override.topicCategories },
      personaFields: { ...base.personaFields, ...override.personaFields },
      contextPatterns: { ...base.contextPatterns, ...override.contextPatterns },
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RelevanceConfig>): void {
    this.config = this.mergeConfig(this.config, config);
  }

  /**
   * Get current configuration
   */
  getConfig(): RelevanceConfig {
    return JSON.parse(JSON.stringify(this.config));
  }
}