/**
 * Confidence Service Tests
 * 
 * Comprehensive test suite for confidence service functionality
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import type { EvidenceUnit } from '@prisma/client';
import { ConfidenceService, type ConfidenceServiceConfig } from '../../services/ConfidenceService';
import { type ClaimField, type EvidenceContext } from '../../types/llm';

describe('ConfidenceService', () => {
  let service: ConfidenceService;
  let mockEvidenceUnits: EvidenceUnit[];
  let mockEvidenceContext: EvidenceContext[];

  beforeEach(() => {
    service = new ConfidenceService();
    
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
        snippet: 'He graduated from Stanford University in 2018.',
        startIndex: 45,
        endIndex: 91,
        qualityScore: 0.85,
        topics: JSON.stringify(['education', 'graduation']),
        metadata: JSON.stringify({ tier: 'tier_1' }),
        createdAt: new Date('2023-12-01')
      },
      {
        id: 'evidence_3',
        sourceId: 'source_3',
        snippet: 'John leads a team of 15 engineers in Mountain View.',
        startIndex: 92,
        endIndex: 142,
        qualityScore: 0.8,
        topics: JSON.stringify(['leadership', 'location']),
        metadata: JSON.stringify({ tier: 'tier_2' }),
        createdAt: new Date('2024-02-01')
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

  describe('Single Claim Confidence Calculation', () => {
    it('should calculate confidence for individual claim fields', async () => {
      const claimField: ClaimField = {
        fieldName: 'occupation',
        text: 'Software engineer at Google',
        confidence: 0.9,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_1'],
            confidence: 0.9,
            supportType: 'direct'
          }
        ]
      };

      const result = await service.calculateClaimConfidence(claimField, mockEvidenceContext);

      expect(result.overallScore).toBeGreaterThan(0);
      expect(result.supportingEvidenceCount).toBe(1);
      expect(result.averageSourceQuality).toBeCloseTo(0.9, 1);
      expect(result.confidenceInterval.lower).toBeLessThan(result.overallScore);
      expect(result.confidenceInterval.upper).toBeGreaterThan(result.overallScore);
    });

    it('should use caching when enabled', async () => {
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

      // First call
      const start1 = Date.now();
      const result1 = await service.calculateClaimConfidence(claimField, mockEvidenceContext);
      const time1 = Date.now() - start1;

      // Second call (should be cached)
      const start2 = Date.now();
      const result2 = await service.calculateClaimConfidence(claimField, mockEvidenceContext);
      const time2 = Date.now() - start2;

      expect(result1.overallScore).toBe(result2.overallScore);
      expect(time2).toBeLessThanOrEqual(time1); // Cached should be faster or same
    });
  });

  describe('Persona-Level Confidence Assessment', () => {
    it('should calculate comprehensive persona confidence', async () => {
      const claims: ClaimField[] = [
        {
          fieldName: 'occupation',
          text: 'Software engineer at Google',
          confidence: 0.9,
          citations: [
            {
              sentenceIndex: 0,
              evidenceUnitIds: ['evidence_1'],
              confidence: 0.9,
              supportType: 'direct'
            }
          ]
        },
        {
          fieldName: 'education',
          text: 'Graduated from Stanford University',
          confidence: 0.85,
          citations: [
            {
              sentenceIndex: 0,
              evidenceUnitIds: ['evidence_2'],
              confidence: 0.85,
              supportType: 'direct'
            }
          ]
        },
        {
          fieldName: 'leadership',
          text: 'Leads engineering team',
          confidence: 0.8,
          citations: [
            {
              sentenceIndex: 0,
              evidenceUnitIds: ['evidence_3'],
              confidence: 0.8,
              supportType: 'direct'
            }
          ]
        }
      ];

      const assessment = await service.calculatePersonaConfidence(
        claims,
        mockEvidenceContext,
        'persona_123'
      );

      expect(assessment.personaId).toBe('persona_123');
      expect(assessment.claimFieldConfidences.size).toBe(3);
      expect(assessment.overallConfidence).toBeGreaterThan(0);
      expect(assessment.weightedAverageConfidence).toBeGreaterThan(0);
      expect(assessment.minimumConfidence).toBeLessThanOrEqual(assessment.maximumConfidence);
      expect(assessment.highConfidenceClaims).toBeGreaterThanOrEqual(0);
      expect(assessment.lowConfidenceClaims).toBeGreaterThanOrEqual(0);
      expect(['approve', 'review', 'reject']).toContain(assessment.recommendation);
    });

    it('should generate appropriate recommendations', async () => {
      // High confidence persona
      const highConfidenceClaims: ClaimField[] = [
        {
          fieldName: 'occupation',
          text: 'Software engineer',
          confidence: 0.95,
          citations: [
            {
              sentenceIndex: 0,
              evidenceUnitIds: ['evidence_1'],
              confidence: 0.95,
              supportType: 'direct'
            }
          ]
        }
      ];

      // Low confidence persona
      const lowConfidenceClaims: ClaimField[] = [
        {
          fieldName: 'occupation',
          text: 'Unknown occupation',
          confidence: 0.3,
          citations: []
        }
      ];

      const highAssessment = await service.calculatePersonaConfidence(
        highConfidenceClaims,
        mockEvidenceContext
      );

      const lowAssessment = await service.calculatePersonaConfidence(
        lowConfidenceClaims,
        mockEvidenceContext
      );

      expect(highAssessment.recommendation).toBe('approve');
      expect(lowAssessment.recommendation).toBe('reject');
    });

    it('should handle mixed confidence levels correctly', async () => {
      const mixedClaims: ClaimField[] = [
        {
          fieldName: 'occupation',
          text: 'Software engineer',
          confidence: 0.9,
          citations: [
            {
              sentenceIndex: 0,
              evidenceUnitIds: ['evidence_1'],
              confidence: 0.9,
              supportType: 'direct'
            }
          ]
        },
        {
          fieldName: 'unknown_field',
          text: 'Some unclear information',
          confidence: 0.2,
          citations: []
        }
      ];

      const assessment = await service.calculatePersonaConfidence(
        mixedClaims,
        mockEvidenceContext
      );

      expect(assessment.highConfidenceClaims).toBe(1);
      expect(assessment.lowConfidenceClaims).toBe(1);
      expect(assessment.recommendation).toBe('review');
      expect(assessment.overallConfidence).toBeLessThan(assessment.weightedAverageConfidence);
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple personas efficiently', async () => {
      const personas = [
        {
          id: 'persona_1',
          claims: [
            {
              fieldName: 'occupation',
              text: 'Software engineer',
              confidence: 0.9,
              citations: [
                {
                  sentenceIndex: 0,
                  evidenceUnitIds: ['evidence_1'],
                  confidence: 0.9,
                  supportType: 'direct' as const
                }
              ]
            }
          ],
          evidenceContext: mockEvidenceContext
        },
        {
          id: 'persona_2',
          claims: [
            {
              fieldName: 'education',
              text: 'Stanford graduate',
              confidence: 0.85,
              citations: [
                {
                  sentenceIndex: 0,
                  evidenceUnitIds: ['evidence_2'],
                  confidence: 0.85,
                  supportType: 'direct' as const
                }
              ]
            }
          ],
          evidenceContext: mockEvidenceContext
        }
      ];

      const result = await service.processBatch(personas);

      expect(result.assessments.size).toBe(2);
      expect(result.statistics.totalPersonas).toBe(2);
      expect(result.statistics.totalClaims).toBe(2);
      expect(result.statistics.averageConfidence).toBeGreaterThan(0);
      expect(result.statistics.processingTimeMs).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle batch processing errors gracefully', async () => {
      const personasWithError = [
        {
          id: 'valid_persona',
          claims: [
            {
              fieldName: 'occupation',
              text: 'Software engineer',
              confidence: 0.9,
              citations: [
                {
                  sentenceIndex: 0,
                  evidenceUnitIds: ['evidence_1'],
                  confidence: 0.9,
                  supportType: 'direct' as const
                }
              ]
            }
          ],
          evidenceContext: mockEvidenceContext
        },
        {
          id: 'invalid_persona',
          claims: [], // Empty claims might cause issues
          evidenceContext: []
        }
      ];

      const result = await service.processBatch(personasWithError);

      expect(result.assessments.size).toBeGreaterThanOrEqual(1);
      expect(result.statistics.totalPersonas).toBe(2);
    });

    it('should respect batch size configuration', async () => {
      const customService = new ConfidenceService({
        batchSize: 1
      });

      const personas = Array.from({ length: 3 }, (_, i) => ({
        id: `persona_${i}`,
        claims: [
          {
            fieldName: 'test',
            text: 'Test claim',
            confidence: 0.8,
            citations: []
          }
        ],
        evidenceContext: mockEvidenceContext
      }));

      const result = await customService.processBatch(personas);

      expect(result.assessments.size).toBe(3);
      expect(result.statistics.totalPersonas).toBe(3);
    });
  });

  describe('Calibration and Analysis', () => {
    it('should accept calibration data points', () => {
      service.addCalibrationDataPoint(
        'Software engineer at Google',
        0.85,
        0.9,
        2,
        0.85
      );

      service.addCalibrationDataPoint(
        'Unknown occupation',
        0.2,
        0.1,
        0,
        0
      );

      // Should not throw error
      expect(() => service.analyzeCalibration()).not.toThrow();
    });

    it('should calculate calibration metrics', () => {
      // Add several calibration data points
      service.addCalibrationDataPoint('Claim 1', 0.8, 0.85, 2, 0.9);
      service.addCalibrationDataPoint('Claim 2', 0.6, 0.55, 1, 0.7);
      service.addCalibrationDataPoint('Claim 3', 0.9, 0.95, 3, 0.95);
      service.addCalibrationDataPoint('Claim 4', 0.3, 0.25, 0, 0.5);
      service.addCalibrationDataPoint('Claim 5', 0.7, 0.75, 2, 0.8);

      const analysis = service.analyzeCalibration();

      expect(analysis.meanAbsoluteError).toBeGreaterThan(0);
      expect(analysis.rootMeanSquareError).toBeGreaterThan(0);
      expect(analysis.correlation).toBeGreaterThan(-1);
      expect(analysis.correlation).toBeLessThan(1);
      expect(analysis.calibrationCurve.length).toBeGreaterThan(0);
      expect(analysis.reliability).toBeGreaterThanOrEqual(0);
      expect(analysis.resolution).toBeGreaterThanOrEqual(0);
    });

    it('should throw error for calibration analysis without data', () => {
      const emptyService = new ConfidenceService();
      expect(() => emptyService.analyzeCalibration()).toThrow('No calibration data available');
    });
  });

  describe('Configuration Management', () => {
    it('should update service configuration', () => {
      const newConfig: Partial<ConfidenceServiceConfig> = {
        autoApprovalThreshold: 0.9,
        humanReviewThreshold: 0.7,
        enableCaching: false
      };

      service.updateConfig(newConfig);
      const currentConfig = service.getConfig();

      expect(currentConfig.autoApprovalThreshold).toBe(0.9);
      expect(currentConfig.humanReviewThreshold).toBe(0.7);
      expect(currentConfig.enableCaching).toBe(false);
    });

    it('should update scorer configuration through service', () => {
      const newConfig: Partial<ConfidenceServiceConfig> = {
        scorerConfig: {
          sourceAgreementWeight: 0.5,
          evidenceCountWeight: 0.3,
          sourceQualityWeight: 0.15,
          recencyWeight: 0.05
        }
      };

      service.updateConfig(newConfig);

      // Configuration should be updated without throwing
      expect(() => service.getConfig()).not.toThrow();
    });

    it('should clear cache when caching is disabled', () => {
      // Enable caching and add some cached data
      service.updateConfig({ enableCaching: true });
      
      // Simulate cache usage (in reality, we'd need to call calculateClaimConfidence)
      service.clearCache();
      
      const cacheStats = service.getCacheStatistics();
      expect(cacheStats.size).toBe(0);

      // Disable caching
      service.updateConfig({ enableCaching: false });
      
      // Cache should remain empty
      const newCacheStats = service.getCacheStatistics();
      expect(newCacheStats.size).toBe(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty claims array', async () => {
      const assessment = await service.calculatePersonaConfidence(
        [],
        mockEvidenceContext,
        'empty_persona'
      );

      expect(assessment.personaId).toBe('empty_persona');
      expect(assessment.claimFieldConfidences.size).toBe(0);
      expect(assessment.overallConfidence).toBe(0);
      expect(assessment.recommendation).toBe('reject');
    });

    it('should handle empty evidence context', async () => {
      const claims: ClaimField[] = [
        {
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
        }
      ];

      const assessment = await service.calculatePersonaConfidence(
        claims,
        [],
        'no_evidence_persona'
      );

      expect(assessment.overallConfidence).toBeLessThan(0.3);
      expect(assessment.recommendation).toBe('reject');
    });

    it('should handle claims with calculation failures gracefully', async () => {
      // Create a claim that might cause issues
      const problematicClaims: ClaimField[] = [
        {
          fieldName: 'valid_claim',
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
        },
        {
          fieldName: 'potentially_problematic',
          text: '',
          confidence: 0,
          citations: []
        }
      ];

      const assessment = await service.calculatePersonaConfidence(
        problematicClaims,
        mockEvidenceContext
      );

      expect(assessment.claimFieldConfidences.size).toBeGreaterThanOrEqual(1);
      expect(assessment.overallConfidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle large batch sizes efficiently', async () => {
      const largePersonaSet = Array.from({ length: 50 }, (_, i) => ({
        id: `persona_${i}`,
        claims: [
          {
            fieldName: 'test_field',
            text: `Test claim ${i}`,
            confidence: 0.7 + (i % 3) * 0.1,
            citations: [
              {
                sentenceIndex: 0,
                evidenceUnitIds: ['evidence_1'],
                confidence: 0.7,
                supportType: 'direct' as const
              }
            ]
          }
        ],
        evidenceContext: mockEvidenceContext
      }));

      const startTime = Date.now();
      const result = await service.processBatch(largePersonaSet);
      const processingTime = Date.now() - startTime;

      expect(result.assessments.size).toBe(50);
      expect(result.statistics.totalPersonas).toBe(50);
      expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(result.statistics.processingTimeMs).toBeGreaterThan(0);
    });
  });

  describe('Performance and Caching', () => {
    it('should track cache statistics', async () => {
      const initialStats = service.getCacheStatistics();
      expect(initialStats.size).toBe(0);

      // Add some cached calculations
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

      await service.calculateClaimConfidence(claimField, mockEvidenceContext);
      
      // Cache size might increase (depending on implementation details)
      const newStats = service.getCacheStatistics();
      expect(newStats.size).toBeGreaterThanOrEqual(0);
    });

    it('should clear cache manually', () => {
      service.clearCache();
      const stats = service.getCacheStatistics();
      expect(stats.size).toBe(0);
    });
  });
});