/**
 * Citation Validation Integration Test
 * 
 * Tests the integration of citation validation with the OpenAI service
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import type { EvidenceUnit } from '@prisma/client';
import { CitationValidator } from '../../validation/CitationValidator';
import { GroundingValidator } from '../../validation/GroundingValidator';
import { 
  type ClaimField, 
  type EvidenceContext, 
  type PersonaExtractionRequest, 
  type PersonaExtractionResponse 
} from '../../types/llm';

describe('Citation Validation Integration', () => {
  let citationValidator: CitationValidator;
  let groundingValidator: GroundingValidator;
  let mockEvidenceUnits: EvidenceUnit[];
  let mockEvidenceContext: EvidenceContext[];

  beforeEach(() => {
    citationValidator = new CitationValidator();
    groundingValidator = new GroundingValidator();
    
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
  });

  describe('Full Validation Pipeline', () => {
    it('should validate a complete persona extraction response', async () => {
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
          },
          {
            fieldName: 'education',
            text: 'Graduated from Stanford University [evidence_2]',
            confidence: 0.85,
            citations: [
              {
                sentenceIndex: 0,
                evidenceUnitIds: ['evidence_2'],
                confidence: 0.85,
                supportType: 'direct'
              }
            ]
          }
        ],
        metadata: {
          tokensUsed: 150,
          processingTimeMs: 1200,
          evidenceUnitsProcessed: 2,
          overallConfidence: 0.875
        }
      };

      const request: PersonaExtractionRequest = {
        evidenceUnits: mockEvidenceUnits,
        extractionType: 'full',
        constraints: {
          requireCitations: true,
          conflictHandling: 'flag'
        },
        projectId: 'test-project'
      };

      // Test citation validation
      const citationResult = await citationValidator.validateCitations(
        response.claims,
        mockEvidenceContext
      );

      expect(citationResult.isValid).toBe(true);
      expect(citationResult.statistics.totalClaims).toBe(2);
      expect(citationResult.statistics.evidenceUtilization).toBe(100);

      // Test grounding validation
      const groundingResult = await groundingValidator.validateGrounding(
        response,
        request,
        mockEvidenceContext
      );

      expect(groundingResult.isGrounded).toBe(true);
      expect(groundingResult.citationValidation.isValid).toBe(true);
      expect(groundingResult.formatValidation.isValid).toBe(true);
    });

    it('should detect and report multiple validation issues', async () => {
      const response: PersonaExtractionResponse = {
        success: true,
        claims: [
          {
            fieldName: 'occupation',
            text: 'Software engineer at Microsoft', // No citation marker, wrong company
            confidence: 0.9,
            citations: [
              {
                sentenceIndex: 0,
                evidenceUnitIds: ['evidence_999'], // Non-existent evidence
                confidence: 0.9,
                supportType: 'direct'
              }
            ]
          },
          {
            fieldName: 'education',
            text: 'Graduated from Harvard University. Got PhD in Computer Science.', // Multiple sentences, missing citations
            confidence: 0.85,
            citations: [
              {
                sentenceIndex: 0,
                evidenceUnitIds: ['evidence_2'],
                confidence: 0.85,
                supportType: 'direct'
              }
              // Missing citation for second sentence
            ]
          }
        ],
        metadata: {
          tokensUsed: 150,
          processingTimeMs: 1200,
          evidenceUnitsProcessed: 2,
          overallConfidence: 0.875
        }
      };

      const request: PersonaExtractionRequest = {
        evidenceUnits: mockEvidenceUnits,
        extractionType: 'full',
        constraints: {
          requireCitations: true,
          conflictHandling: 'flag'
        },
        projectId: 'test-project'
      };

      // Test citation validation
      const citationResult = await citationValidator.validateCitations(
        response.claims,
        mockEvidenceContext
      );

      expect(citationResult.isValid).toBe(false);
      expect(citationResult.errors.length).toBeGreaterThan(0);

      // Should detect missing evidence
      const missingEvidenceErrors = citationResult.errors.filter((e: any) => e.type === 'missing_evidence');
      expect(missingEvidenceErrors.length).toBeGreaterThan(0);

      // Should detect insufficient citations
      const insufficientCitationErrors = citationResult.errors.filter((e: any) => e.type === 'insufficient_citations');
      expect(insufficientCitationErrors.length).toBeGreaterThan(0);

      // Test grounding validation
      const groundingResult = await groundingValidator.validateGrounding(
        response,
        request,
        mockEvidenceContext
      );

      expect(groundingResult.isGrounded).toBe(false);
      expect(groundingResult.citationValidation.isValid).toBe(false);
      expect(groundingResult.formatValidation.isValid).toBe(false);
      expect(groundingResult.improvements.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration Integration', () => {
    it('should respect custom validation configurations', async () => {
      // Configure stricter citation requirements
      citationValidator.updateConfig({
        minCitationsPerSentence: 2,
        minCitationConfidence: 0.9,
        semanticAlignmentThreshold: 0.9
      });

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
                confidence: 0.8, // Below new threshold
                supportType: 'direct'
              }
              // Only one citation, below new minimum
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

      const citationResult = await citationValidator.validateCitations(
        response.claims,
        mockEvidenceContext
      );

      expect(citationResult.isValid).toBe(false);
      
      // Should detect insufficient citations
      const insufficientCitationErrors = citationResult.errors.filter((e: any) => e.type === 'insufficient_citations');
      expect(insufficientCitationErrors.length).toBeGreaterThan(0);

      // Should detect low confidence
      const lowConfidenceErrors = citationResult.errors.filter((e: any) => e.type === 'confidence_too_low');
      expect(lowConfidenceErrors.length).toBeGreaterThan(0);
    });

    it('should handle grounding validator configuration changes', async () => {
      groundingValidator.updateConfig({
        minGroundingScore: 0.95, // Very high threshold
        enableAutoRetry: false
      });

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

      const request: PersonaExtractionRequest = {
        evidenceUnits: mockEvidenceUnits,
        extractionType: 'full',
        constraints: {
          requireCitations: true,
          conflictHandling: 'flag'
        },
        projectId: 'test-project'
      };

      const result = await groundingValidator.validateGrounding(
        response,
        request,
        mockEvidenceContext
      );

      // With very high grounding score threshold, this should fail
      expect(result.isGrounded).toBe(false);
      expect(result.groundingScore).toBeLessThan(0.95);
    });
  });

  describe('Performance and Statistics', () => {
    it('should calculate accurate validation statistics', async () => {
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
          },
          {
            fieldName: 'education',
            text: 'Graduated from Stanford [evidence_2]',
            confidence: 0.85,
            citations: [
              {
                sentenceIndex: 0,
                evidenceUnitIds: ['evidence_2'],
                confidence: 0.85,
                supportType: 'direct'
              }
            ]
          }
        ],
        metadata: {
          tokensUsed: 150,
          processingTimeMs: 1200,
          evidenceUnitsProcessed: 2,
          overallConfidence: 0.875
        }
      };

      const citationResult = await citationValidator.validateCitations(
        response.claims,
        mockEvidenceContext
      );

      // Verify statistics
      expect(citationResult.statistics.totalClaims).toBe(2);
      expect(citationResult.statistics.totalSentences).toBe(2);
      expect(citationResult.statistics.totalCitations).toBe(2);
      expect(citationResult.statistics.averageCitationsPerSentence).toBe(1);
      expect(citationResult.statistics.evidenceUtilization).toBe(100); // Both evidence units used
      expect(citationResult.statistics.averageConfidence).toBe(0.875);
    });

    it('should complete validation within reasonable time', async () => {
      const startTime = Date.now();

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

      const request: PersonaExtractionRequest = {
        evidenceUnits: mockEvidenceUnits,
        extractionType: 'full',
        constraints: {
          requireCitations: true,
          conflictHandling: 'flag'
        },
        projectId: 'test-project'
      };

      const result = await groundingValidator.validateGrounding(
        response,
        request,
        mockEvidenceContext
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.validationTimeMs).toBeGreaterThan(0);
      expect(result.validationTimeMs).toBeLessThan(totalTime);
    });
  });
});