/**
 * Citation Validator Tests
 * 
 * Comprehensive test suite for citation validation functionality
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import type { EvidenceUnit } from '@prisma/client';
import { CitationValidator, type CitationValidationConfig } from '../../validation/CitationValidator';
import { type ClaimField, type EvidenceContext } from '../../types/llm';

describe('CitationValidator', () => {
  let validator: CitationValidator;
  let mockEvidenceUnits: EvidenceUnit[];
  let mockEvidenceContext: EvidenceContext[];

  beforeEach(() => {
    validator = new CitationValidator();
    
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

  describe('Basic Citation Validation', () => {
    it('should validate properly cited claims', async () => {
      const claims: ClaimField[] = [
        {
          fieldName: 'occupation',
          text: 'Software engineer at Google.',
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
      ];

      const result = await validator.validateCitations(claims, mockEvidenceContext);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.statistics.totalClaims).toBe(1);
      expect(result.statistics.totalCitations).toBe(1);
    });

    it('should detect missing evidence IDs', async () => {
      const claims: ClaimField[] = [
        {
          fieldName: 'occupation',
          text: 'Software engineer at Google.',
          confidence: 0.9,
          citations: [
            {
              sentenceIndex: 0,
              evidenceUnitIds: ['evidence_999'], // Non-existent evidence
              confidence: 0.9,
              supportType: 'direct'
            }
          ]
        }
      ];

      const result = await validator.validateCitations(claims, mockEvidenceContext);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('missing_evidence');
      expect(result.errors[0].evidenceId).toBe('evidence_999');
    });

    it('should detect insufficient citations', async () => {
      const claims: ClaimField[] = [
        {
          fieldName: 'background',
          text: 'Software engineer at Google. Graduated from Stanford.',
          confidence: 0.9,
          citations: [
            {
              sentenceIndex: 0,
              evidenceUnitIds: ['evidence_1'],
              confidence: 0.9,
              supportType: 'direct'
            }
            // Missing citation for second sentence
          ]
        }
      ];

      const result = await validator.validateCitations(claims, mockEvidenceContext);

      expect(result.isValid).toBe(false);
      const insufficientCitationErrors = result.errors.filter((e: any) => e.type === 'insufficient_citations');
      expect(insufficientCitationErrors).toHaveLength(1);
      expect(insufficientCitationErrors[0].sentenceIndex).toBe(1);
    });

    it('should detect low confidence citations', async () => {
      const claims: ClaimField[] = [
        {
          fieldName: 'occupation',
          text: 'Software engineer at Google.',
          confidence: 0.9,
          citations: [
            {
              sentenceIndex: 0,
              evidenceUnitIds: ['evidence_1'],
              confidence: 0.5, // Below default threshold of 0.7
              supportType: 'direct'
            }
          ]
        }
      ];

      const result = await validator.validateCitations(claims, mockEvidenceContext);

      expect(result.isValid).toBe(false);
      const lowConfidenceErrors = result.errors.filter((e: any) => e.type === 'confidence_too_low');
      expect(lowConfidenceErrors).toHaveLength(1);
      expect(lowConfidenceErrors[0].details?.confidence).toBe(0.5);
    });
  });

  describe('Semantic Alignment Validation', () => {
    it('should detect semantic misalignment', async () => {
      const claims: ClaimField[] = [
        {
          fieldName: 'occupation',
          text: 'Professional chef at restaurant.',
          confidence: 0.9,
          citations: [
            {
              sentenceIndex: 0,
              evidenceUnitIds: ['evidence_1'], // Evidence about software engineering
              confidence: 0.9,
              supportType: 'direct'
            }
          ]
        }
      ];

      const result = await validator.validateCitations(claims, mockEvidenceContext);

      expect(result.isValid).toBe(false);
      const semanticErrors = result.errors.filter((e: any) => e.type === 'semantic_mismatch');
      expect(semanticErrors).toHaveLength(1);
    });

    it('should accept good semantic alignment', async () => {
      const claims: ClaimField[] = [
        {
          fieldName: 'occupation',
          text: 'Software engineer at Google company.',
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
      ];

      const result = await validator.validateCitations(claims, mockEvidenceContext);

      expect(result.isValid).toBe(true);
      const semanticErrors = result.errors.filter((e: any) => e.type === 'semantic_mismatch');
      expect(semanticErrors).toHaveLength(0);
    });
  });

  describe('Citation Density and Quality', () => {
    it('should warn about excessive citations', async () => {
      // Configure validator to allow max 2 citations per sentence
      validator.updateConfig({ maxCitationsPerSentence: 2 });

      const claims: ClaimField[] = [
        {
          fieldName: 'occupation',
          text: 'Software engineer.',
          confidence: 0.9,
          citations: [
            {
              sentenceIndex: 0,
              evidenceUnitIds: ['evidence_1'],
              confidence: 0.9,
              supportType: 'direct'
            },
            {
              sentenceIndex: 0,
              evidenceUnitIds: ['evidence_2'],
              confidence: 0.8,
              supportType: 'contextual'
            },
            {
              sentenceIndex: 0,
              evidenceUnitIds: ['evidence_3'],
              confidence: 0.7,
              supportType: 'inferential'
            }
          ]
        }
      ];

      const result = await validator.validateCitations(claims, mockEvidenceContext);

      const redundantWarnings = result.warnings.filter((w: any) => w.type === 'redundant_citations');
      expect(redundantWarnings).toHaveLength(1);
    });

    it('should calculate evidence utilization correctly', async () => {
      const claims: ClaimField[] = [
        {
          fieldName: 'background',
          text: 'Software engineer at Google. Graduated from Stanford.',
          confidence: 0.9,
          citations: [
            {
              sentenceIndex: 0,
              evidenceUnitIds: ['evidence_1'],
              confidence: 0.9,
              supportType: 'direct'
            },
            {
              sentenceIndex: 1,
              evidenceUnitIds: ['evidence_2'],
              confidence: 0.85,
              supportType: 'direct'
            }
          ]
        }
      ];

      const result = await validator.validateCitations(claims, mockEvidenceContext);

      // Should utilize 2 out of 3 evidence units = 66.67%
      expect(result.statistics.evidenceUtilization).toBeCloseTo(66.67, 1);
    });
  });

  describe('Citation Suggestions', () => {
    it('should suggest evidence for uncited sentences', async () => {
      const claims: ClaimField[] = [
        {
          fieldName: 'background',
          text: 'Software engineer at Google. Graduated from Stanford University.',
          confidence: 0.9,
          citations: [
            {
              sentenceIndex: 0,
              evidenceUnitIds: ['evidence_1'],
              confidence: 0.9,
              supportType: 'direct'
            }
            // Missing citation for second sentence about Stanford
          ]
        }
      ];

      const result = await validator.validateCitations(claims, mockEvidenceContext);

      const addCitationSuggestions = result.suggestions.filter((s: any) => s.type === 'add_citation');
      expect(addCitationSuggestions).toHaveLength(1);
      expect(addCitationSuggestions[0].sentenceIndex).toBe(1);
      expect(addCitationSuggestions[0].suggestedEvidenceIds).toContain('evidence_2');
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration correctly', () => {
      const newConfig: Partial<CitationValidationConfig> = {
        minCitationsPerSentence: 2,
        minCitationConfidence: 0.8
      };

      validator.updateConfig(newConfig);
      const currentConfig = validator.getConfig();

      expect(currentConfig.minCitationsPerSentence).toBe(2);
      expect(currentConfig.minCitationConfidence).toBe(0.8);
    });

    it('should preserve other config values when updating', () => {
      const originalConfig = validator.getConfig();
      const newConfig: Partial<CitationValidationConfig> = {
        minCitationsPerSentence: 2
      };

      validator.updateConfig(newConfig);
      const currentConfig = validator.getConfig();

      expect(currentConfig.minCitationsPerSentence).toBe(2);
      expect(currentConfig.semanticAlignmentThreshold).toBe(originalConfig.semanticAlignmentThreshold);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty claims array', async () => {
      const result = await validator.validateCitations([], mockEvidenceContext);

      expect(result.isValid).toBe(true);
      expect(result.statistics.totalClaims).toBe(0);
      expect(result.statistics.evidenceUtilization).toBe(0);
    });

    it('should handle claims with no citations', async () => {
      const claims: ClaimField[] = [
        {
          fieldName: 'occupation',
          text: 'Software engineer.',
          confidence: 0.9,
          citations: []
        }
      ];

      const result = await validator.validateCitations(claims, mockEvidenceContext);

      expect(result.isValid).toBe(false);
      const insufficientErrors = result.errors.filter((e: any) => e.type === 'insufficient_citations');
      expect(insufficientErrors).toHaveLength(1);
    });

    it('should handle sentence index out of bounds', async () => {
      const claims: ClaimField[] = [
        {
          fieldName: 'occupation',
          text: 'Software engineer.',
          confidence: 0.9,
          citations: [
            {
              sentenceIndex: 5, // Out of bounds for single sentence
              evidenceUnitIds: ['evidence_1'],
              confidence: 0.9,
              supportType: 'direct'
            }
          ]
        }
      ];

      const result = await validator.validateCitations(claims, mockEvidenceContext);

      expect(result.isValid).toBe(false);
      const formatErrors = result.errors.filter((e: any) => e.type === 'invalid_format');
      expect(formatErrors).toHaveLength(1);
    });

    it('should handle empty evidence context', async () => {
      const claims: ClaimField[] = [
        {
          fieldName: 'occupation',
          text: 'Software engineer.',
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
      ];

      const result = await validator.validateCitations(claims, []);

      expect(result.isValid).toBe(false);
      const missingEvidenceErrors = result.errors.filter((e: any) => e.type === 'missing_evidence');
      expect(missingEvidenceErrors).toHaveLength(1);
    });
  });

  describe('Statistics Calculation', () => {
    it('should calculate statistics correctly for complex scenarios', async () => {
      const claims: ClaimField[] = [
        {
          fieldName: 'background',
          text: 'Software engineer at Google. Graduated from Stanford. Leads engineering team.',
          confidence: 0.9,
          citations: [
            {
              sentenceIndex: 0,
              evidenceUnitIds: ['evidence_1'],
              confidence: 0.9,
              supportType: 'direct'
            },
            {
              sentenceIndex: 1,
              evidenceUnitIds: ['evidence_2'],
              confidence: 0.85,
              supportType: 'direct'
            },
            {
              sentenceIndex: 2,
              evidenceUnitIds: ['evidence_3'],
              confidence: 0.8,
              supportType: 'direct'
            }
          ]
        }
      ];

      const result = await validator.validateCitations(claims, mockEvidenceContext);

      expect(result.statistics.totalClaims).toBe(1);
      expect(result.statistics.totalSentences).toBe(3);
      expect(result.statistics.totalCitations).toBe(3);
      expect(result.statistics.averageCitationsPerSentence).toBe(1);
      expect(result.statistics.evidenceUtilization).toBe(100); // All 3 evidence units used
      expect(result.statistics.averageConfidence).toBeCloseTo(0.85, 2);
    });
  });
});