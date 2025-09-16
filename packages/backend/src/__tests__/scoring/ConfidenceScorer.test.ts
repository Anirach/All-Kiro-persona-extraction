/**
 * Confidence Scorer Tests
 * 
 * Comprehensive test suite for confidence scoring functionality
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import type { EvidenceUnit } from '@prisma/client';
import { ConfidenceScorer, type ConfidenceConfig } from '../../scoring/ConfidenceScorer';
import { type ClaimField, type EvidenceContext } from '../../types/llm';

describe('ConfidenceScorer', () => {
  let scorer: ConfidenceScorer;
  let mockEvidenceUnits: EvidenceUnit[];
  let mockEvidenceContext: EvidenceContext[];

  beforeEach(() => {
    scorer = new ConfidenceScorer();
    
    mockEvidenceUnits = [
      {
        id: 'evidence_1',
        sourceId: 'source_1',
        snippet: 'John Smith is a software engineer at Google.',
        startIndex: 0,
        endIndex: 44,
        qualityScore: 0.9,
        topics: JSON.stringify(['occupation', 'employer']),
        metadata: JSON.stringify({ tier: 'tier_1' }),
        createdAt: new Date('2024-01-01')
      },
      {
        id: 'evidence_2',
        sourceId: 'source_2', 
        snippet: 'He works as a software developer at Google Inc.',
        startIndex: 45,
        endIndex: 92,
        qualityScore: 0.85,
        topics: JSON.stringify(['occupation', 'employer']),
        metadata: JSON.stringify({ tier: 'tier_1' }),
        createdAt: new Date('2024-02-01')
      },
      {
        id: 'evidence_3',
        sourceId: 'source_3',
        snippet: 'John graduated from Stanford University in 2018.',
        startIndex: 93,
        endIndex: 141,
        qualityScore: 0.8,
        topics: JSON.stringify(['education', 'graduation']),
        metadata: JSON.stringify({ tier: 'tier_2' }),
        createdAt: new Date('2023-06-01')
      },
      {
        id: 'evidence_4',
        sourceId: 'source_4',
        snippet: 'Smith is not a software engineer but a product manager.',
        startIndex: 142,
        endIndex: 197,
        qualityScore: 0.75,
        topics: JSON.stringify(['occupation']),
        metadata: JSON.stringify({ tier: 'tier_2' }),
        createdAt: new Date('2024-03-01')
      }
    ];

    mockEvidenceContext = mockEvidenceUnits.map(unit => ({
      evidenceUnit: unit,
      processingMetadata: {
        qualityScore: unit.qualityScore || 0,
        topics: unit.topics ? JSON.parse(unit.topics) : []
      }
    }));
  });

  describe('Basic Confidence Calculation', () => {
    it('should calculate high confidence for well-supported claims', async () => {
      const claimField: ClaimField = {
        fieldName: 'occupation',
        text: 'Software engineer at Google',
        confidence: 0.9,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_1', 'evidence_2'],
            confidence: 0.9,
            supportType: 'direct'
          }
        ]
      };

      const result = await scorer.calculateConfidence(claimField, mockEvidenceContext);

      expect(result.overallScore).toBeGreaterThan(0.7);
      expect(result.supportingEvidenceCount).toBe(2);
      expect(result.conflictingEvidenceCount).toBe(1); // evidence_4 conflicts
      expect(result.sourceAgreement).toBeGreaterThan(0.5);
      expect(result.evidenceCount).toBeGreaterThan(0);
      expect(result.sourceQuality).toBeGreaterThan(0);
      expect(result.recency).toBeGreaterThan(0);
    });

    it('should calculate low confidence for unsupported claims', async () => {
      const claimField: ClaimField = {
        fieldName: 'occupation',
        text: 'Professional chef at restaurant',
        confidence: 0.3,
        citations: []
      };

      const result = await scorer.calculateConfidence(claimField, mockEvidenceContext);

      expect(result.overallScore).toBeLessThan(0.3);
      expect(result.supportingEvidenceCount).toBe(0);
      expect(result.sourceAgreement).toBe(0);
      expect(result.evidenceCount).toBe(0);
    });

    it('should detect conflicting evidence and reduce confidence', async () => {
      const claimField: ClaimField = {
        fieldName: 'occupation',
        text: 'Software engineer at Google',
        confidence: 0.8,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_1'],
            confidence: 0.8,
            supportType: 'direct'
          }
        ]
      };

      const result = await scorer.calculateConfidence(claimField, mockEvidenceContext);

      expect(result.conflictingEvidenceCount).toBeGreaterThan(0);
      expect(result.sourceAgreement).toBeLessThan(1.0); // Should be reduced due to conflict
    });
  });

  describe('Component Score Calculations', () => {
    it('should calculate source agreement correctly', async () => {
      const supportingClaim: ClaimField = {
        fieldName: 'occupation',
        text: 'Software engineer at Google',
        confidence: 0.9,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_1', 'evidence_2'],
            confidence: 0.9,
            supportType: 'direct'
          }
        ]
      };

      const conflictingClaim: ClaimField = {
        fieldName: 'occupation',
        text: 'Product manager',
        confidence: 0.7,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_4'],
            confidence: 0.7,
            supportType: 'direct'
          }
        ]
      };

      const supportingResult = await scorer.calculateConfidence(supportingClaim, mockEvidenceContext);
      const conflictingResult = await scorer.calculateConfidence(conflictingClaim, mockEvidenceContext);

      expect(supportingResult.sourceAgreement).toBeGreaterThan(conflictingResult.sourceAgreement);
    });

    it('should calculate evidence count score with diminishing returns', async () => {
      const singleEvidenceClaim: ClaimField = {
        fieldName: 'occupation',
        text: 'Software engineer',
        confidence: 0.8,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_1'],
            confidence: 0.8,
            supportType: 'direct'
          }
        ]
      };

      const multipleEvidenceClaim: ClaimField = {
        fieldName: 'occupation',
        text: 'Software engineer',
        confidence: 0.9,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_1', 'evidence_2'],
            confidence: 0.9,
            supportType: 'direct'
          }
        ]
      };

      const singleResult = await scorer.calculateConfidence(singleEvidenceClaim, mockEvidenceContext);
      const multipleResult = await scorer.calculateConfidence(multipleEvidenceClaim, mockEvidenceContext);

      expect(multipleResult.evidenceCount).toBeGreaterThan(singleResult.evidenceCount);
    });

    it('should weight source quality appropriately', async () => {
      const highQualityClaim: ClaimField = {
        fieldName: 'occupation',
        text: 'Software engineer',
        confidence: 0.9,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_1'], // High quality (0.9)
            confidence: 0.9,
            supportType: 'direct'
          }
        ]
      };

      const lowerQualityClaim: ClaimField = {
        fieldName: 'education',
        text: 'Stanford graduate',
        confidence: 0.8,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_3'], // Lower quality (0.8)
            confidence: 0.8,
            supportType: 'direct'
          }
        ]
      };

      const highQualityResult = await scorer.calculateConfidence(highQualityClaim, mockEvidenceContext);
      const lowerQualityResult = await scorer.calculateConfidence(lowerQualityClaim, mockEvidenceContext);

      expect(highQualityResult.sourceQuality).toBeGreaterThan(lowerQualityResult.sourceQuality);
      expect(highQualityResult.averageSourceQuality).toBeGreaterThan(lowerQualityResult.averageSourceQuality);
    });

    it('should calculate recency scores with time decay', async () => {
      const recentClaim: ClaimField = {
        fieldName: 'occupation',
        text: 'Software engineer',
        confidence: 0.9,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_2'], // More recent (2024-02-01)
            confidence: 0.9,
            supportType: 'direct'
          }
        ]
      };

      const olderClaim: ClaimField = {
        fieldName: 'education',
        text: 'Stanford graduate',
        confidence: 0.8,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_3'], // Older (2023-06-01)
            confidence: 0.8,
            supportType: 'direct'
          }
        ]
      };

      const recentResult = await scorer.calculateConfidence(recentClaim, mockEvidenceContext);
      const olderResult = await scorer.calculateConfidence(olderClaim, mockEvidenceContext);

      expect(recentResult.recency).toBeGreaterThan(olderResult.recency);
    });
  });

  describe('Confidence Intervals and Uncertainty', () => {
    it('should calculate confidence intervals', async () => {
      const claimField: ClaimField = {
        fieldName: 'occupation',
        text: 'Software engineer',
        confidence: 0.8,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_1'],
            confidence: 0.8,
            supportType: 'direct'
          }
        ]
      };

      const result = await scorer.calculateConfidence(claimField, mockEvidenceContext);

      expect(result.confidenceInterval.lower).toBeLessThan(result.overallScore);
      expect(result.confidenceInterval.upper).toBeGreaterThan(result.overallScore);
      expect(result.confidenceInterval.lower).toBeGreaterThanOrEqual(0);
      expect(result.confidenceInterval.upper).toBeLessThanOrEqual(1);
      expect(result.uncertainty).toBeGreaterThan(0);
      expect(result.uncertainty).toBeLessThanOrEqual(0.5);
    });

    it('should have higher uncertainty with conflicting evidence', async () => {
      const conflictedClaim: ClaimField = {
        fieldName: 'occupation',
        text: 'Software engineer',
        confidence: 0.7,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_1'],
            confidence: 0.7,
            supportType: 'direct'
          }
        ]
      };

      const unconflictedClaim: ClaimField = {
        fieldName: 'education',
        text: 'Stanford graduate',
        confidence: 0.8,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_3'],
            confidence: 0.8,
            supportType: 'direct'
          }
        ]
      };

      const conflictedResult = await scorer.calculateConfidence(conflictedClaim, mockEvidenceContext);
      const unconflictedResult = await scorer.calculateConfidence(unconflictedClaim, mockEvidenceContext);

      expect(conflictedResult.uncertainty).toBeGreaterThan(unconflictedResult.uncertainty);
    });
  });

  describe('Configuration Management', () => {
    it('should respect custom configuration weights', async () => {
      const customConfig: Partial<ConfidenceConfig> = {
        sourceAgreementWeight: 0.6,
        evidenceCountWeight: 0.2,
        sourceQualityWeight: 0.1,
        recencyWeight: 0.1
      };

      const customScorer = new ConfidenceScorer(customConfig);

      const claimField: ClaimField = {
        fieldName: 'occupation',
        text: 'Software engineer',
        confidence: 0.8,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_1', 'evidence_2'],
            confidence: 0.8,
            supportType: 'direct'
          }
        ]
      };

      const defaultResult = await scorer.calculateConfidence(claimField, mockEvidenceContext);
      const customResult = await customScorer.calculateConfidence(claimField, mockEvidenceContext);

      // Results should be different due to different weights
      expect(Math.abs(defaultResult.overallScore - customResult.overallScore)).toBeGreaterThan(0.01);
    });

    it('should validate configuration weights sum to 1.0', () => {
      expect(() => {
        new ConfidenceScorer({
          sourceAgreementWeight: 0.5,
          evidenceCountWeight: 0.3,
          sourceQualityWeight: 0.1,
          recencyWeight: 0.05 // Total = 0.95, should fail
        });
      }).toThrow('Confidence weights must sum to 1.0');
    });

    it('should validate minimum evidence count', () => {
      expect(() => {
        new ConfidenceScorer({
          minEvidenceCount: 0
        });
      }).toThrow('Minimum evidence count must be at least 1');
    });

    it('should update configuration correctly', () => {
      const newConfig: Partial<ConfidenceConfig> = {
        minEvidenceCount: 3,
        maxEvidenceCount: 15
      };

      scorer.updateConfig(newConfig);
      const currentConfig = scorer.getConfig();

      expect(currentConfig.minEvidenceCount).toBe(3);
      expect(currentConfig.maxEvidenceCount).toBe(15);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty evidence context', async () => {
      const claimField: ClaimField = {
        fieldName: 'occupation',
        text: 'Software engineer',
        confidence: 0.8,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_1'],
            confidence: 0.8,
            supportType: 'direct'
          }
        ]
      };

      const result = await scorer.calculateConfidence(claimField, []);

      expect(result.overallScore).toBe(0);
      expect(result.supportingEvidenceCount).toBe(0);
      expect(result.sourceAgreement).toBe(0);
    });

    it('should handle claims with no citations', async () => {
      const claimField: ClaimField = {
        fieldName: 'occupation',
        text: 'Software engineer',
        confidence: 0.5,
        citations: []
      };

      const result = await scorer.calculateConfidence(claimField, mockEvidenceContext);

      expect(result.overallScore).toBeLessThan(0.3);
      expect(result.supportingEvidenceCount).toBe(0);
    });

    it('should handle evidence units with missing quality scores', async () => {
      const evidenceWithoutQuality = {
        ...mockEvidenceUnits[0],
        qualityScore: null
      };

      const contextWithoutQuality = [{
        evidenceUnit: evidenceWithoutQuality,
        processingMetadata: {
          qualityScore: 0,
          topics: ['occupation']
        }
      }];

      const claimField: ClaimField = {
        fieldName: 'occupation',
        text: 'Software engineer',
        confidence: 0.8,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: [evidenceWithoutQuality.id],
            confidence: 0.8,
            supportType: 'direct'
          }
        ]
      };

      const result = await scorer.calculateConfidence(claimField, contextWithoutQuality);

      expect(result).toBeDefined();
      expect(result.averageSourceQuality).toBe(0);
    });

    it('should handle very old evidence dates', async () => {
      const veryOldEvidence = {
        ...mockEvidenceUnits[0],
        createdAt: new Date('1990-01-01')
      };

      const oldEvidenceContext = [{
        evidenceUnit: veryOldEvidence,
        processingMetadata: {
          qualityScore: 0.9,
          topics: ['occupation']
        }
      }];

      const claimField: ClaimField = {
        fieldName: 'occupation',
        text: 'Software engineer',
        confidence: 0.8,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: [veryOldEvidence.id],
            confidence: 0.8,
            supportType: 'direct'
          }
        ]
      };

      const result = await scorer.calculateConfidence(claimField, oldEvidenceContext);

      expect(result.recency).toBeLessThan(0.1); // Should be very low for old evidence
    });

    it('should handle identical evidence dates', async () => {
      const sameDate = new Date('2024-01-01');
      const identicalDateEvidence = mockEvidenceUnits.map(unit => ({
        ...unit,
        createdAt: sameDate
      }));

      const identicalDateContext = identicalDateEvidence.map(unit => ({
        evidenceUnit: unit,
        processingMetadata: {
          qualityScore: unit.qualityScore || 0,
          topics: ['occupation']
        }
      }));

      const claimField: ClaimField = {
        fieldName: 'occupation',
        text: 'Software engineer',
        confidence: 0.8,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_1', 'evidence_2'],
            confidence: 0.8,
            supportType: 'direct'
          }
        ]
      };

      const result = await scorer.calculateConfidence(claimField, identicalDateContext);

      expect(result.mostRecentDate).toEqual(sameDate);
      expect(result.recency).toBeGreaterThan(0);
    });
  });

  describe('Semantic Similarity and Contradiction Detection', () => {
    it('should detect high semantic similarity for related claims', async () => {
      const claimField: ClaimField = {
        fieldName: 'occupation',
        text: 'Software developer at Google',
        confidence: 0.8,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_1'], // 'software engineer at Google'
            confidence: 0.8,
            supportType: 'direct'
          }
        ]
      };

      const result = await scorer.calculateConfidence(claimField, mockEvidenceContext);

      expect(result.supportingEvidenceCount).toBeGreaterThan(0);
      expect(result.sourceAgreement).toBeGreaterThan(0.5);
    });

    it('should detect contradictions with negated statements', async () => {
      const claimField: ClaimField = {
        fieldName: 'occupation',
        text: 'Software engineer', // Should conflict with evidence_4 which says "not a software engineer"
        confidence: 0.7,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_1'],
            confidence: 0.7,
            supportType: 'direct'
          }
        ]
      };

      const result = await scorer.calculateConfidence(claimField, mockEvidenceContext);

      expect(result.conflictingEvidenceCount).toBeGreaterThan(0);
    });
  });
});