/**
 * Grounding Validator Tests
 * 
 * Basic test suite for grounding validation functionality
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import type { EvidenceUnit } from '@prisma/client';
import { GroundingValidator } from '../../validation/GroundingValidator';
import { 
  type ClaimField, 
  type EvidenceContext, 
  type PersonaExtractionRequest, 
  type PersonaExtractionResponse 
} from '../../types/llm';

describe('GroundingValidator', () => {
  let validator: GroundingValidator;
  let mockEvidenceUnits: EvidenceUnit[];
  let mockEvidenceContext: EvidenceContext[];
  let mockRequest: PersonaExtractionRequest;

  beforeEach(() => {
    validator = new GroundingValidator();
    
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
        createdAt: new Date()
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
        createdAt: new Date()
      }
    ];

    mockEvidenceContext = mockEvidenceUnits.map(unit => ({
      evidenceUnit: unit,
      processingMetadata: {
        qualityScore: unit.qualityScore || 0,
        topics: unit.topics ? JSON.parse(unit.topics) : []
      }
    }));

    mockRequest = {
      evidenceUnits: mockEvidenceUnits,
      extractionType: 'full',
      constraints: {
        requireCitations: true,
        conflictHandling: 'flag'
      },
      projectId: 'test-project'
    };
  });

  describe('Basic Grounding Validation', () => {
    it('should validate well-grounded responses', async () => {
      const response: PersonaExtractionResponse = {
        success: true,
        claims: [
          {
            fieldName: 'occupation',
            text: 'Software engineer at Google [evidence_1]',
            confidence: 0.9,
            citations: [
              {
                sentenceIndex: 0,
                evidenceUnitIds: ['evidence_1'],
                confidence: 0.9,
                supportType: 'direct'
              }
            ]
          }
        ],
        metadata: {
          tokensUsed: 100,
          processingTimeMs: 1000,
          evidenceUnitsProcessed: 1,
          overallConfidence: 0.9
        }
      };

      const result = await validator.validateGrounding(response, mockRequest, mockEvidenceContext);

      expect(result.isGrounded).toBe(true);
      expect(result.citationValidation.isValid).toBe(true);
      expect(result.formatValidation.isValid).toBe(true);
      expect(result.retryAttempts).toBe(0);
    });

    it('should detect format validation issues', async () => {
      const response: PersonaExtractionResponse = {
        success: true,
        claims: [
          {
            fieldName: 'occupation',
            text: 'Software engineer at Google', // Missing citation marker
            confidence: 0.9,
            citations: [
              {
                sentenceIndex: 0,
                evidenceUnitIds: ['evidence_1'],
                confidence: 0.9,
                supportType: 'direct'
              }
            ]
          }
        ],
        metadata: {
          tokensUsed: 100,
          processingTimeMs: 1000,
          evidenceUnitsProcessed: 1,
          overallConfidence: 0.9
        }
      };

      const result = await validator.validateGrounding(response, mockRequest, mockEvidenceContext);

      expect(result.isGrounded).toBe(false);
      expect(result.formatValidation.isValid).toBe(false);
      expect(result.formatValidation.errors.length).toBeGreaterThan(0);
    });

    it('should detect citation validation issues', async () => {
      const response: PersonaExtractionResponse = {
        success: true,
        claims: [
          {
            fieldName: 'occupation',
            text: 'Software engineer at Google [evidence_999]', // Non-existent evidence
            confidence: 0.9,
            citations: [
              {
                sentenceIndex: 0,
                evidenceUnitIds: ['evidence_999'],
                confidence: 0.9,
                supportType: 'direct'
              }
            ]
          }
        ],
        metadata: {
          tokensUsed: 100,
          processingTimeMs: 1000,
          evidenceUnitsProcessed: 1,
          overallConfidence: 0.9
        }
      };

      const result = await validator.validateGrounding(response, mockRequest, mockEvidenceContext);

      expect(result.isGrounded).toBe(false);
      expect(result.citationValidation.isValid).toBe(false);
      expect(result.citationValidation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Format Validation via Main Method', () => {
    it('should detect missing citation markers through main validation', async () => {
      const response: PersonaExtractionResponse = {
        success: true,
        claims: [
          {
            fieldName: 'occupation',
            text: 'Software engineer', // Missing [evidence_1]
            confidence: 0.9,
            citations: [
              {
                sentenceIndex: 0,
                evidenceUnitIds: ['evidence_1'],
                confidence: 0.9,
                supportType: 'direct'
              }
            ]
          }
        ],
        metadata: {
          tokensUsed: 100,
          processingTimeMs: 1000,
          evidenceUnitsProcessed: 1,
          overallConfidence: 0.9
        }
      };

      const result = await validator.validateGrounding(response, mockRequest, mockEvidenceContext);

      expect(result.isGrounded).toBe(false);
      expect(result.formatValidation.isValid).toBe(false);
      expect(result.formatValidation.errors.length).toBeGreaterThan(0);
    });

    it('should detect proper citation format through main validation', async () => {
      const response: PersonaExtractionResponse = {
        success: true,
        claims: [
          {
            fieldName: 'occupation',
            text: 'Software engineer [evidence_1]',
            confidence: 0.9,
            citations: [
              {
                sentenceIndex: 0,
                evidenceUnitIds: ['evidence_1'],
                confidence: 0.9,
                supportType: 'direct'
              }
            ]
          }
        ],
        metadata: {
          tokensUsed: 100,
          processingTimeMs: 1000,
          evidenceUnitsProcessed: 1,
          overallConfidence: 0.9
        }
      };

      const result = await validator.validateGrounding(response, mockRequest, mockEvidenceContext);

      expect(result.formatValidation.isValid).toBe(true);
      expect(result.formatValidation.citationsFound).toBe(1);
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration correctly', () => {
      const newConfig = {
        enableAutoRetry: false,
        maxRetryAttempts: 1
      };

      validator.updateConfig(newConfig);
      const currentConfig = validator.getConfig();

      expect(currentConfig.enableAutoRetry).toBe(false);
      expect(currentConfig.maxRetryAttempts).toBe(1);
    });

    it('should preserve other config values when updating', () => {
      const originalConfig = validator.getConfig();
      const newConfig = {
        maxRetryAttempts: 1
      };

      validator.updateConfig(newConfig);
      const currentConfig = validator.getConfig();

      expect(currentConfig.maxRetryAttempts).toBe(1);
      expect(currentConfig.minGroundingScore).toBe(originalConfig.minGroundingScore);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty claims array', async () => {
      const response: PersonaExtractionResponse = {
        success: true,
        claims: [],
        metadata: {
          tokensUsed: 100,
          processingTimeMs: 1000,
          evidenceUnitsProcessed: 0,
          overallConfidence: 0
        }
      };

      const result = await validator.validateGrounding(response, mockRequest, mockEvidenceContext);

      expect(result.isGrounded).toBe(true);
      expect(result.citationValidation.statistics.totalClaims).toBe(0);
    });

    it('should handle validation timeout gracefully', async () => {
      // Configure very short timeout
      validator.updateConfig({ validationTimeoutMs: 1 });

      const response: PersonaExtractionResponse = {
        success: true,
        claims: [
          {
            fieldName: 'occupation',
            text: 'Software engineer [evidence_1]',
            confidence: 0.9,
            citations: [
              {
                sentenceIndex: 0,
                evidenceUnitIds: ['evidence_1'],
                confidence: 0.9,
                supportType: 'direct'
              }
            ]
          }
        ],
        metadata: {
          tokensUsed: 100,
          processingTimeMs: 1000,
          evidenceUnitsProcessed: 1,
          overallConfidence: 0.9
        }
      };

      // Validation should still complete even with short timeout
      const result = await validator.validateGrounding(response, mockRequest, mockEvidenceContext);
      expect(result).toBeDefined();
      expect(result.validationTimeMs).toBeGreaterThan(0);
    });
  });
});