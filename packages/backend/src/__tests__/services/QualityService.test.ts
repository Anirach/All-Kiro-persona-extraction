/**
 * Test suite for Quality Service and scoring components
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QualityService, type EvidenceForQuality } from '../../services/QualityService';
import { AuthorityScorer } from '../../scoring/AuthorityScorer';
import { ContentScorer } from '../../scoring/ContentScorer';
import { RecencyScorer } from '../../scoring/RecencyScorer';
import { CorroborationScorer } from '../../scoring/CorroborationScorer';
import { RelevanceScorer } from '../../scoring/RelevanceScorer';

describe('QualityService', () => {
  let qualityService: QualityService;
  let mockEvidence: EvidenceForQuality;

  beforeEach(() => {
    qualityService = new QualityService();
    
    mockEvidence = {
      id: 'test-evidence-1',
      text: 'John Smith is a software engineer at Google with 5 years of experience in machine learning. He graduated from Stanford University with a PhD in Computer Science.',
      sourceId: 'test-source-1',
      startIndex: 0,
      endIndex: 150,
      wordCount: 25,
      sentenceCount: 2,
      hasCompleteStart: true,
      hasCompleteEnd: true,
      metadata: {
        topics: ['career', 'education'],
        keywords: ['software engineer', 'Google', 'machine learning', 'Stanford', 'PhD'],
      },
      source: {
        id: 'test-source-1',
        url: 'https://linkedin.com/in/johnsmith',
        title: 'John Smith - Software Engineer at Google',
        publishedAt: new Date('2024-01-15'),
        fetchedAt: new Date('2024-09-15'),
        tier: 'REPUTABLE',
        domain: 'linkedin.com',
        author: 'John Smith',
        metadata: {
          publication: 'LinkedIn',
          verified: true,
        },
      },
      relevanceTarget: {
        topics: ['career', 'education'],
        personaFields: ['name', 'jobTitle', 'company', 'education'],
        keywords: ['software engineer', 'Google'],
        context: 'Professional background and education of software engineers',
      },
      relatedEvidence: [
        {
          id: 'related-1',
          text: 'John Smith works as a senior software engineer at Google, specializing in AI and machine learning systems.',
          sourceId: 'related-source-1',
          sourceDomain: 'techcrunch.com',
          sourceTier: 'REPUTABLE',
          sourceTitle: 'Google AI Team Spotlight',
          publishedAt: new Date('2024-02-01'),
          metadata: {},
        },
        {
          id: 'related-2',
          text: 'Stanford alumnus John Smith has been recognized for his contributions to machine learning research.',
          sourceId: 'related-source-2',
          sourceDomain: 'stanford.edu',
          sourceTier: 'CANONICAL',
          publishedAt: new Date('2024-01-20'),
          metadata: {},
        },
      ],
    };
  });

  describe('Quality Assessment', () => {
    it('should assess quality with all components enabled', async () => {
      const assessment = await qualityService.assessQuality(mockEvidence);
      
      expect(assessment.score).toBeGreaterThan(0);
      expect(assessment.score).toBeLessThanOrEqual(1);
      expect(assessment.components.authority).toBeDefined();
      expect(assessment.components.content).toBeDefined();
      expect(assessment.components.recency).toBeDefined();
      expect(assessment.components.corroboration).toBeDefined();
      expect(assessment.components.relevance).toBeDefined();
      expect(assessment.confidence).toBeGreaterThan(0);
      expect(assessment.processingTimeMs).toBeGreaterThan(0);
      expect(assessment.reasoning.length).toBeGreaterThan(5); // Components + final score + processing time
    });

    it('should handle evidence without optional components', async () => {
      const evidenceWithoutOptionals: EvidenceForQuality = {
        ...mockEvidence,
        relevanceTarget: undefined,
        relatedEvidence: undefined,
      };

      const assessment = await qualityService.assessQuality(evidenceWithoutOptionals);
      
      expect(assessment.score).toBeGreaterThan(0);
      expect(assessment.components.authority).toBeDefined();
      expect(assessment.components.content).toBeDefined();
      expect(assessment.components.recency).toBeDefined();
      expect(assessment.components.corroboration).toBeUndefined();
      expect(assessment.components.relevance).toBeUndefined();
    });

    it('should respect component weights in final score calculation', async () => {
      const customConfig = {
        weights: {
          authority: 0.5,
          content: 0.3,
          recency: 0.1,
          corroboration: 0.1,
          relevance: 0.0,
        },
      };

      const customService = new QualityService(customConfig);
      const assessment = await customService.assessQuality(mockEvidence);
      
      // With 50% weight on authority, it should significantly influence the final score
      expect(assessment.score).toBeGreaterThan(0);
      expect(assessment.breakdown.authority).toBeGreaterThan(0);
    });

    it('should handle fast performance mode', async () => {
      const fastService = new QualityService({
        performanceMode: 'fast',
      });

      const assessment = await fastService.assessQuality(mockEvidence);
      
      // Fast mode disables corroboration and relevance
      expect(assessment.components.corroboration).toBeUndefined();
      expect(assessment.components.relevance).toBeUndefined();
      expect(assessment.components.authority).toBeDefined();
      expect(assessment.components.content).toBeDefined();
      expect(assessment.components.recency).toBeDefined();
    });
  });

  describe('Caching', () => {
    it('should cache assessment results', async () => {
      const assessment1 = await qualityService.assessQuality(mockEvidence);
      const assessment2 = await qualityService.assessQuality(mockEvidence);
      
      expect(assessment1.cacheHit).toBe(false);
      expect(assessment2.cacheHit).toBe(true);
      expect(assessment1.score).toBe(assessment2.score);
    });

    it('should clear cache when requested', async () => {
      await qualityService.assessQuality(mockEvidence);
      qualityService.clearCache();
      
      const stats = qualityService.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple evidence units', async () => {
      const evidenceList = [
        mockEvidence,
        {
          ...mockEvidence,
          id: 'test-evidence-2',
          text: 'Jane Doe is a product manager at Microsoft.',
        },
      ];

      const assessments = await qualityService.assessQualityBatch(evidenceList);
      
      expect(assessments).toHaveLength(2);
      expect(assessments[0].score).toBeGreaterThan(0);
      expect(assessments[1].score).toBeGreaterThan(0);
    });
  });
});

describe('AuthorityScorer', () => {
  let scorer: AuthorityScorer;

  beforeEach(() => {
    scorer = new AuthorityScorer();
  });

  it('should score academic sources highly', () => {
    const academicSource = {
      tier: 'CANONICAL',
      url: 'https://arxiv.org/abs/2024.01234',
      domain: 'arxiv.org',
      title: 'Research Paper on Machine Learning',
      metadata: {
        author: 'Dr. John Smith, PhD',
        publication: 'Nature',
        peerReviewed: true,
      },
    };

    const score = scorer.scoreAuthority(academicSource);
    
    expect(score.score).toBeGreaterThan(0.8);
    expect(score.tier).toBe('CANONICAL');
    expect(score.reasoning.some(r => r.includes('Academic'))).toBe(true);
  });

  it('should penalize social media sources', () => {
    const socialSource = {
      tier: 'INFORMAL',
      url: 'https://twitter.com/user/status/123',
      domain: 'twitter.com',
      metadata: {},
    };

    const score = scorer.scoreAuthority(socialSource);
    
    expect(score.score).toBeLessThan(0.5);
    expect(score.reasoning.some(r => r.includes('Social media'))).toBe(true);
  });

  it('should handle unknown domains gracefully', () => {
    const unknownSource = {
      tier: 'COMMUNITY',
      url: 'malformed-url',
      domain: 'unknown',
      metadata: {},
    };

    const score = scorer.scoreAuthority(unknownSource);
    
    expect(score.score).toBeGreaterThan(0);
    expect(score.domain).toBe('unknown');
  });
});

describe('ContentScorer', () => {
  let scorer: ContentScorer;

  beforeEach(() => {
    scorer = new ContentScorer();
  });

  it('should score high-quality content highly', () => {
    const highQualityContent = {
      text: 'According to the research published in Nature on January 15, 2024, machine learning algorithms demonstrated a 95% accuracy improvement when applied to medical diagnosis. The study, conducted by Dr. Smith et al. at Stanford University, analyzed 10,000 patient records over a two-year period.',
      wordCount: 41,
      sentenceCount: 2,
      hasCompleteStart: true,
      hasCompleteEnd: true,
    };

    const score = scorer.scoreContent(highQualityContent);
    
    expect(score.score).toBeGreaterThan(0.7);
    expect(score.metrics.specificityCount).toBeGreaterThan(0);
    expect(score.components.specificity).toBeGreaterThan(0.5);
  });

  it('should penalize vague or low-quality content', () => {
    const lowQualityContent = {
      text: 'Someone said something. Maybe. I think. Could be interesting. Possibly. Might be true.',
      wordCount: 14,
      sentenceCount: 6,
      hasCompleteStart: true,
      hasCompleteEnd: true,
    };

    const score = scorer.scoreContent(lowQualityContent);
    
    expect(score.score).toBeLessThan(0.6);
    expect(score.metrics.vaguenessCount).toBeGreaterThan(0);
  });

  it('should handle edge cases like empty text', () => {
    const emptyContent = {
      text: '',
      wordCount: 0,
      sentenceCount: 0,
      hasCompleteStart: false,
      hasCompleteEnd: false,
    };

    const score = scorer.scoreContent(emptyContent);
    
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(1);
  });
});

describe('RecencyScorer', () => {
  let scorer: RecencyScorer;

  beforeEach(() => {
    scorer = new RecencyScorer();
  });

  it('should score recent news content highly', () => {
    const recentNews = {
      publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      fetchedAt: new Date(),
      url: 'https://bbc.com/news/breaking-story',
      title: 'Breaking: Major Tech Announcement',
      content: 'Breaking news: technology company announced major breakthrough today.',
      metadata: {},
    };

    const score = scorer.scoreRecency(recentNews);
    
    expect(score.score).toBeGreaterThan(0.8);
    expect(score.contentType).toBe('news');
    expect(score.ageInDays).toBe(1);
  });

  it('should handle old academic content appropriately', () => {
    const oldAcademic = {
      publishedAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
      fetchedAt: new Date(),
      url: 'https://arxiv.org/paper/123',
      title: 'Research on Fundamental Algorithms',
      content: 'This research paper presents findings on fundamental computer science algorithms.',
      metadata: {},
    };

    const score = scorer.scoreRecency(oldAcademic);
    
    expect(score.contentType).toBe('academic');
    expect(score.ageInDays).toBe(365);
    // Academic content should age more gracefully than news
    expect(score.score).toBeGreaterThan(0.3);
  });

  it('should identify timeless content', () => {
    const timelessContent = {
      publishedAt: new Date(Date.now() - 1000 * 24 * 60 * 60 * 1000), // Old content
      fetchedAt: new Date(),
      url: 'https://example.com/math-principles',
      content: 'Mathematics and fundamental algorithms are universal principles that remain constant.',
      metadata: {},
    };

    const score = scorer.scoreRecency(timelessContent);
    
    expect(score.isTimeless).toBe(true);
    expect(score.components.timelessBoost).toBeGreaterThan(0);
  });
});

describe('CorroborationScorer', () => {
  let scorer: CorroborationScorer;

  beforeEach(() => {
    scorer = new CorroborationScorer();
  });

  it('should score well-corroborated evidence highly', () => {
    const targetEvidence = {
      id: 'target',
      text: 'John Smith works as a software engineer at Google.',
      sourceId: 'source1',
      sourceDomain: 'linkedin.com',
      sourceTier: 'REPUTABLE',
      metadata: {},
    };

    const relatedEvidence = [
      {
        id: 'related1',
        text: 'John Smith works as a software engineer at Google Corporation.',
        sourceId: 'source2',
        sourceDomain: 'techcrunch.com',
        sourceTier: 'REPUTABLE',
        metadata: {},
      },
      {
        id: 'related2',
        text: 'Software engineer John Smith works at Google company.',
        sourceId: 'source3',
        sourceDomain: 'ieee.org',
        sourceTier: 'CANONICAL',
        metadata: {},
      },
    ];

    const score = scorer.scoreCorroboration(targetEvidence, relatedEvidence);
    
    expect(score.score).toBeGreaterThan(0.3);
    expect(score.sourceAnalysis.uniqueDomains).toBeGreaterThanOrEqual(1); // Should find at least one unique domain
  });

  it('should handle evidence with no corroboration', () => {
    const targetEvidence = {
      id: 'target',
      text: 'Unique claim with no supporting evidence.',
      sourceId: 'source1',
      sourceDomain: 'example.com',
      sourceTier: 'COMMUNITY',
      metadata: {},
    };

    const score = scorer.scoreCorroboration(targetEvidence, []);
    
    expect(score.score).toBe(0);
    expect(score.corroboratingEvidence).toHaveLength(0);
  });
});

describe('RelevanceScorer', () => {
  let scorer: RelevanceScorer;

  beforeEach(() => {
    scorer = new RelevanceScorer();
  });

  it('should score relevant content highly', () => {
    const evidence = {
      text: 'John Smith is a software engineer at Google with expertise in machine learning.',
      metadata: {
        topics: ['career'],
        extractedKeywords: ['software engineer', 'Google', 'machine learning'],
      },
    };

    const target = {
      topics: ['career'],
      personaFields: ['jobTitle', 'company'],
      keywords: ['software engineer', 'Google'],
      context: 'Professional background of software engineers in technology companies',
    };

    const score = scorer.scoreRelevance(evidence, target);
    
    expect(score.score).toBeGreaterThan(0.2);
    expect(score.matchedTopics).toContain('career');
    expect(score.matchedFields).toContain('jobTitle');
    expect(score.matchedKeywords).toContain('software engineer');
  });

  it('should score irrelevant content lowly', () => {
    const evidence = {
      text: 'The weather today is sunny with a chance of rain.',
      metadata: {},
    };

    const target = {
      topics: ['career'],
      personaFields: ['jobTitle'],
      keywords: ['software engineer'],
    };

    const score = scorer.scoreRelevance(evidence, target);
    
    expect(score.score).toBeLessThan(0.3);
    expect(score.matchedTopics).toHaveLength(0);
    expect(score.matchedFields).toHaveLength(0);
  });
});

describe('Performance Tests', () => {
  let qualityService: QualityService;

  beforeEach(() => {
    qualityService = new QualityService();
  });

  it('should process evidence within performance threshold', async () => {
    const evidence: EvidenceForQuality = {
      id: 'perf-test',
      text: 'Sample evidence text for performance testing.',
      sourceId: 'perf-source',
      startIndex: 0,
      endIndex: 45,
      wordCount: 8,
      sentenceCount: 1,
      hasCompleteStart: true,
      hasCompleteEnd: true,
      metadata: {},
      source: {
        id: 'perf-source',
        url: 'https://example.com',
        fetchedAt: new Date(),
        tier: 'COMMUNITY',
        domain: 'example.com',
        metadata: {},
      },
    };

    const startTime = Date.now();
    const assessment = await qualityService.assessQuality(evidence);
    const endTime = Date.now();
    
    const processingTime = endTime - startTime;
    
    // Should complete within 50ms as per TASK-011 requirements
    expect(processingTime).toBeLessThan(50);
    expect(assessment.processingTimeMs).toBeLessThan(50);
    expect(assessment.score).toBeGreaterThanOrEqual(0);
    expect(assessment.score).toBeLessThanOrEqual(1);
  });

  it('should handle batch processing efficiently', async () => {
    const evidenceList: EvidenceForQuality[] = Array.from({ length: 10 }, (_, i) => ({
      id: `batch-${i}`,
      text: `Sample evidence text ${i} for batch performance testing.`,
      sourceId: `batch-source-${i}`,
      startIndex: 0,
      endIndex: 50,
      wordCount: 9,
      sentenceCount: 1,
      hasCompleteStart: true,
      hasCompleteEnd: true,
      metadata: {},
      source: {
        id: `batch-source-${i}`,
        url: `https://example${i}.com`,
        fetchedAt: new Date(),
        tier: 'COMMUNITY',
        domain: `example${i}.com`,
        metadata: {},
      },
    }));

    const startTime = Date.now();
    const assessments = await qualityService.assessQualityBatch(evidenceList);
    const endTime = Date.now();
    
    const totalTime = endTime - startTime;
    const avgTimePerItem = totalTime / evidenceList.length;
    
    expect(assessments).toHaveLength(10);
    expect(avgTimePerItem).toBeLessThan(50); // Average should be under 50ms per item
    
    // All assessments should be valid
    assessments.forEach(assessment => {
      expect(assessment.score).toBeGreaterThanOrEqual(0);
      expect(assessment.score).toBeLessThanOrEqual(1);
    });
  });
});