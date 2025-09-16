/**
 * Authority scoring for evidence sources
 * Evaluates source credibility based on tier classification and domain characteristics
 */

export interface AuthorityConfig {
  tierWeights: {
    CANONICAL: number;    // Academic papers, official docs, primary sources
    REPUTABLE: number;    // Established news sources, verified orgs
    COMMUNITY: number;    // Wikipedia, well-moderated communities
    INFORMAL: number;     // Social media, blogs, unverified sources
  };
  domainBoosts: {
    academic: number;     // .edu, .ac.*, peer-reviewed journals
    government: number;   // .gov, .mil, official agencies
    nonprofit: number;    // .org, established nonprofits
    commercial: number;   // .com, corporate sites
  };
  urlPatterns: {
    academicPattern: RegExp;
    governmentPattern: RegExp;
    nonprofitPattern: RegExp;
    socialMediaPattern: RegExp;
  };
}

export const DEFAULT_AUTHORITY_CONFIG: AuthorityConfig = {
  tierWeights: {
    CANONICAL: 1.0,      // Highest trust - academic, primary sources
    REPUTABLE: 0.85,     // High trust - established media, verified orgs
    COMMUNITY: 0.65,     // Medium trust - community sources, wikis
    INFORMAL: 0.4,       // Lower trust - social media, blogs
  },
  domainBoosts: {
    academic: 0.15,      // Strong boost for educational institutions
    government: 0.12,    // Good boost for official sources
    nonprofit: 0.08,     // Moderate boost for nonprofits
    commercial: 0.0,     // No boost for commercial sites
  },
  urlPatterns: {
    academicPattern: /\b(\.edu|\.ac\.|arxiv\.org|pubmed|doi\.org|scholar\.google|jstor|ieee|acm\.org)\b/i,
    governmentPattern: /\b(\.gov|\.mil|whitehouse\.gov|congress\.gov|europa\.eu|who\.int)\b/i,
    nonprofitPattern: /\b(\.org|wikipedia\.org|archive\.org|reuters\.org)\b/i,
    socialMediaPattern: /\b(twitter\.com|facebook\.com|instagram\.com|linkedin\.com|tiktok\.com|reddit\.com|medium\.com)\b/i,
  },
};

/**
 * Source authority information
 */
export interface SourceAuthority {
  tier: string;
  url: string;
  domain: string;
  title?: string;
  publishedAt?: Date;
  metadata: Record<string, any>;
}

/**
 * Authority scoring result
 */
export interface AuthorityScore {
  score: number;              // Final authority score (0.0-1.0)
  components: {
    tierScore: number;        // Base score from tier classification
    domainBoost: number;      // Domain-based boost
    titleBoost: number;       // Title-based credibility indicators
    metadataBoost: number;    // Author, publication metadata
  };
  reasoning: string[];        // Human-readable explanation
  tier: string;              // Source tier classification
  domain: string;            // Extracted domain
}

/**
 * Authority scorer implementation
 */
export class AuthorityScorer {
  private config: AuthorityConfig;

  constructor(config: Partial<AuthorityConfig> = {}) {
    this.config = { ...DEFAULT_AUTHORITY_CONFIG, ...config };
  }

  /**
   * Calculate authority score for a source
   */
  scoreAuthority(source: SourceAuthority): AuthorityScore {
    const domain = this.extractDomain(source.url);
    const reasoning: string[] = [];
    
    // Base tier score
    const tierScore = this.config.tierWeights[source.tier as keyof typeof this.config.tierWeights] || 0.4;
    reasoning.push(`Base tier (${source.tier}): ${(tierScore * 100).toFixed(1)}%`);

    // Domain-based boosts
    const domainBoost = this.calculateDomainBoost(source.url, reasoning);
    
    // Title-based credibility indicators
    const titleBoost = this.calculateTitleBoost(source.title, reasoning);
    
    // Metadata-based boosts (author credentials, publication info)
    const metadataBoost = this.calculateMetadataBoost(source.metadata, reasoning);
    
    // Calculate final score
    const baseScore = tierScore;
    const totalBoost = domainBoost + titleBoost + metadataBoost;
    const finalScore = Math.min(1.0, Math.max(0.0, baseScore + totalBoost));
    
    reasoning.push(`Final authority score: ${(finalScore * 100).toFixed(1)}%`);

    return {
      score: finalScore,
      components: {
        tierScore,
        domainBoost,
        titleBoost,
        metadataBoost,
      },
      reasoning,
      tier: source.tier,
      domain,
    };
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.toLowerCase();
    } catch {
      // Fallback for malformed URLs
      const match = url.match(/^https?:\/\/([^\/]+)/i);
      return match?.[1]?.toLowerCase() || 'unknown';
    }
  }

  /**
   * Calculate domain-based authority boost
   */
  private calculateDomainBoost(url: string, reasoning: string[]): number {
    let boost = 0;
    const { urlPatterns, domainBoosts } = this.config;

    if (urlPatterns.academicPattern.test(url)) {
      boost = Math.max(boost, domainBoosts.academic);
      reasoning.push(`Academic domain boost: +${(domainBoosts.academic * 100).toFixed(1)}%`);
    }

    if (urlPatterns.governmentPattern.test(url)) {
      boost = Math.max(boost, domainBoosts.government);
      reasoning.push(`Government domain boost: +${(domainBoosts.government * 100).toFixed(1)}%`);
    }

    if (urlPatterns.nonprofitPattern.test(url)) {
      boost = Math.max(boost, domainBoosts.nonprofit);
      reasoning.push(`Nonprofit domain boost: +${(domainBoosts.nonprofit * 100).toFixed(1)}%`);
    }

    // Social media penalty
    if (urlPatterns.socialMediaPattern.test(url)) {
      boost = -0.1; // Penalty for social media sources
      reasoning.push(`Social media penalty: -10%`);
    }

    return boost;
  }

  /**
   * Calculate title-based credibility boost
   */
  private calculateTitleBoost(title: string | undefined, reasoning: string[]): number {
    if (!title) return 0;

    let boost = 0;
    const titleLower = title.toLowerCase();

    // Academic indicators
    const academicTerms = /\b(study|research|analysis|journal|paper|review|findings|data|evidence|methodology|peer[\s-]?review)\b/i;
    if (academicTerms.test(title)) {
      boost += 0.05;
      reasoning.push(`Academic title indicators: +5%`);
    }

    // Official/authoritative language
    const officialTerms = /\b(official|report|statement|announcement|policy|guidelines|standards|specification)\b/i;
    if (officialTerms.test(title)) {
      boost += 0.03;
      reasoning.push(`Official language indicators: +3%`);
    }

    // Penalties for sensational language
    const sensationalTerms = /\b(shocking|amazing|unbelievable|secret|hidden|exposed|explosive|breaking|urgent|must[\s-]?see)\b/i;
    if (sensationalTerms.test(title)) {
      boost -= 0.05;
      reasoning.push(`Sensational language penalty: -5%`);
    }

    // Penalties for opinion/editorials
    const opinionTerms = /\b(opinion|editorial|op[\s-]?ed|commentary|blog|rant|my[\s-]?take)\b/i;
    if (opinionTerms.test(title)) {
      boost -= 0.02;
      reasoning.push(`Opinion/editorial penalty: -2%`);
    }

    return boost;
  }

  /**
   * Calculate metadata-based authority boost
   */
  private calculateMetadataBoost(metadata: Record<string, any>, reasoning: string[]): number {
    let boost = 0;

    // Author credentials
    const author = metadata.author || metadata.byline;
    if (author && typeof author === 'string') {
      // Check for academic credentials
      if (/\b(phd|ph\.d\.|dr\.|prof\.|professor|md|m\.d\.)\b/i.test(author)) {
        boost += 0.04;
        reasoning.push(`Author credentials: +4%`);
      }
      
      // Check for institutional affiliation
      if (/\b(university|institute|college|lab|laboratory|department)\b/i.test(author)) {
        boost += 0.02;
        reasoning.push(`Institutional affiliation: +2%`);
      }
    }

    // Publication information
    const publication = metadata.publication || metadata.source || metadata.publisher;
    if (publication && typeof publication === 'string') {
      const pubLower = publication.toLowerCase();
      
      // Well-known academic publishers
      if (/\b(nature|science|cell|lancet|nejm|bmj|plos|ieee|acm|springer|elsevier|wiley)\b/.test(pubLower)) {
        boost += 0.06;
        reasoning.push(`Reputable academic publisher: +6%`);
      }
      
      // Established news organizations
      if (/\b(reuters|ap|bbc|npr|pbs|economist|guardian|times|post|journal)\b/.test(pubLower)) {
        boost += 0.03;
        reasoning.push(`Established news organization: +3%`);
      }
    }

    // Peer review indicators
    if (metadata.peerReviewed || metadata.reviewed || 
        (metadata.type && /peer[\s-]?review/i.test(metadata.type))) {
      boost += 0.08;
      reasoning.push(`Peer-reviewed content: +8%`);
    }

    // DOI or ISBN indicates formal publication
    if (metadata.doi || metadata.isbn || metadata.pmid) {
      boost += 0.03;
      reasoning.push(`Formal publication identifier: +3%`);
    }

    return boost;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AuthorityConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): AuthorityConfig {
    return { ...this.config };
  }
}