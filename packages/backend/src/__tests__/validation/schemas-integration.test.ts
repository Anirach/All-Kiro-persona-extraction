import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';
import { schemas } from '../../validation/schemas.js';

describe('Validation Schemas Integration Tests', () => {
  describe('Project Validation', () => {
    it('should validate correct project data', () => {
      const validProject = {
        name: 'Test Project',
        description: 'A valid test project',
        metadata: { type: 'test' }
      };

      const result = schemas.project.create.parse(validProject);
      expect(result.name).toBe('Test Project');
      expect(result.description).toBe('A valid test project');
      expect(result.metadata).toEqual({ type: 'test' });
    });

    it('should reject project with empty name', () => {
      const invalidProject = {
        name: '',
        description: 'Project with empty name'
      };

      expect(() => schemas.project.create.parse(invalidProject)).toThrow();
    });

    it('should reject project with invalid name characters', () => {
      const invalidProject = {
        name: 'Test<script>alert("xss")</script>',
        description: 'Project with XSS attempt'
      };

      expect(() => schemas.project.create.parse(invalidProject)).toThrow();
    });

    it('should validate project query parameters', () => {
      const validQuery = {
        page: '1',
        limit: '10',
        includeStats: 'true'
      };

      const result = schemas.project.query.parse(validQuery);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.includeStats).toBe(true);
    });
  });

  describe('Source Validation', () => {
    it('should validate correct source data', () => {
      const validSource = {
        projectId: 'clrxyz123456789012345678',
        name: 'Test Source',
        tier: 'REPUTABLE' as const,
        url: 'https://example.com/source',
        author: 'Test Author',
        content: 'This is test content for the source',
        metadata: { category: 'research' }
      };

      const result = schemas.source.create.parse(validSource);
      expect(result.projectId).toBe('clrxyz123456789012345678');
      expect(result.tier).toBe('REPUTABLE');
      expect(result.url).toBe('https://example.com/source');
    });

    it('should reject source with invalid tier', () => {
      const invalidSource = {
        projectId: 'clrxyz123456789012345678',
        name: 'Test Source',
        tier: 'INVALID_TIER',
        content: 'Test content'
      };

      expect(() => schemas.source.create.parse(invalidSource)).toThrow();
    });

    it('should reject source with invalid URL', () => {
      const invalidSource = {
        projectId: 'clrxyz123456789012345678',
        name: 'Test Source',
        tier: 'REPUTABLE' as const,
        url: 'not-a-valid-url',
        content: 'Test content'
      };

      expect(() => schemas.source.create.parse(invalidSource)).toThrow();
    });

    it('should validate source upload data', () => {
      const validUpload = {
        projectId: 'clrxyz123456789012345678',
        name: 'Uploaded Document',
        tier: 'COMMUNITY' as const,
        processEvidence: true,
        metadata: {}
      };

      const result = schemas.source.upload.parse(validUpload);
      expect(result.processEvidence).toBe(true);
      expect(result.tier).toBe('COMMUNITY');
    });
  });

  describe('Evidence Validation', () => {
    it('should validate evidence query parameters', () => {
      const validQuery = {
        page: '2',
        limit: '25',
        sourceId: 'clrxyz123456789012345678',
        projectId: 'clrabc123456789012345678',
        minQualityScore: '0.7',
        topics: 'technology,science,research'
      };

      const result = schemas.evidence.query.parse(validQuery);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(25);
      expect(result.minQualityScore).toBe(0.7);
      expect(result.topics).toEqual(['technology', 'science', 'research']);
    });

    it('should validate evidence update data', () => {
      const validUpdate = {
        qualityScore: 0.85,
        confidence: 0.92,
        topics: ['machine-learning', 'artificial-intelligence'],
        metadata: { source: 'peer-reviewed' }
      };

      const result = schemas.evidence.update.parse(validUpdate);
      expect(result.qualityScore).toBe(0.85);
      expect(result.confidence).toBe(0.92);
      expect(result.topics).toEqual(['machine-learning', 'artificial-intelligence']);
    });

    it('should reject evidence with invalid quality score', () => {
      const invalidUpdate = {
        qualityScore: 1.5, // Invalid: > 1
        confidence: 0.8
      };

      expect(() => schemas.evidence.update.parse(invalidUpdate)).toThrow();
    });

    it('should reject evidence with too many topics', () => {
      const invalidUpdate = {
        topics: Array(15).fill('topic') // Invalid: > 10 topics
      };

      expect(() => schemas.evidence.update.parse(invalidUpdate)).toThrow();
    });
  });

  describe('Persona Validation', () => {
    it('should validate persona creation', () => {
      const validPersona = {
        projectId: 'clrxyz123456789012345678',
        status: 'DRAFT' as const
      };

      const result = schemas.persona.create.parse(validPersona);
      expect(result.projectId).toBe('clrxyz123456789012345678');
      expect(result.status).toBe('DRAFT');
    });

    it('should validate persona generation request', () => {
      const validGeneration = {
        projectId: 'clrxyz123456789012345678',
        evidenceUnitIds: [
          'clrabc123456789012345678',
          'clrdef123456789012345678',
          'clrghi123456789012345678'
        ],
        extractionType: 'full' as const,
        conflictHandling: 'flag' as const,
        requireCitations: true,
        maxTokens: 1500
      };

      const result = schemas.persona.generate.parse(validGeneration);
      expect(result.evidenceUnitIds).toHaveLength(3);
      expect(result.extractionType).toBe('full');
      expect(result.maxTokens).toBe(1500);
    });

    it('should reject persona generation with no evidence units', () => {
      const invalidGeneration = {
        projectId: 'clrxyz123456789012345678',
        evidenceUnitIds: [], // Invalid: empty array
        extractionType: 'full' as const
      };

      expect(() => schemas.persona.generate.parse(invalidGeneration)).toThrow();
    });

    it('should reject persona generation with too many evidence units', () => {
      const invalidGeneration = {
        projectId: 'clrxyz123456789012345678',
        evidenceUnitIds: Array(150).fill('clrxyz123456789012345678'), // Invalid: > 100
        extractionType: 'full' as const
      };

      expect(() => schemas.persona.generate.parse(invalidGeneration)).toThrow();
    });
  });

  describe('Claim Validation', () => {
    it('should validate claim creation', () => {
      const validClaim = {
        personaId: 'clrxyz123456789012345678',
        type: 'personal-information'
      };

      const result = schemas.claim.create.parse(validClaim);
      expect(result.personaId).toBe('clrxyz123456789012345678');
      expect(result.type).toBe('personal-information');
    });

    it('should validate claim field creation', () => {
      const validField = {
        claimId: 'clrxyz123456789012345678',
        text: 'John is a software engineer at Google based on his LinkedIn profile.',
        confidence: 0.95
      };

      const result = schemas.claim.createField.parse(validField);
      expect(result.text).toBe('John is a software engineer at Google based on his LinkedIn profile.');
      expect(result.confidence).toBe(0.95);
    });

    it('should validate citation creation', () => {
      const validCitation = {
        claimFieldId: 'clrxyz123456789012345678',
        sentenceIndex: 0,
        evidenceIds: [
          'clrabc123456789012345678',
          'clrdef123456789012345678'
        ]
      };

      const result = schemas.claim.createCitation.parse(validCitation);
      expect(result.sentenceIndex).toBe(0);
      expect(result.evidenceIds).toHaveLength(2);
    });

    it('should reject citation with too many evidence units', () => {
      const invalidCitation = {
        claimFieldId: 'clrxyz123456789012345678',
        sentenceIndex: 0,
        evidenceIds: Array(25).fill('clrxyz123456789012345678') // Invalid: > 20
      };

      expect(() => schemas.claim.createCitation.parse(invalidCitation)).toThrow();
    });

    it('should reject claim type with invalid characters', () => {
      const invalidClaim = {
        personaId: 'clrxyz123456789012345678',
        type: 'personal<script>alert("xss")</script>' // Invalid: contains script
      };

      expect(() => schemas.claim.create.parse(invalidClaim)).toThrow();
    });
  });

  describe('Common Schema Validation', () => {
    it('should validate CUID parameters', () => {
      const validParam = {
        id: 'clrxyz123456789012345678'
      };

      const result = schemas.common.cuidParam.parse(validParam);
      expect(result.id).toBe('clrxyz123456789012345678');
    });

    it('should reject invalid CUID format', () => {
      const invalidParam = {
        id: 'invalid-id-format'
      };

      expect(() => schemas.common.cuidParam.parse(invalidParam)).toThrow();
    });

    it('should validate pagination with defaults', () => {
      const minimalQuery = {};

      const result = schemas.common.paginationQuery.parse(minimalQuery);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.sortOrder).toBe('desc');
    });

    it('should reject pagination with invalid values', () => {
      const invalidQuery = {
        page: '0', // Invalid: < 1
        limit: '150' // Invalid: > 100
      };

      expect(() => schemas.common.paginationQuery.parse(invalidQuery)).toThrow();
    });
  });

  describe('File Upload Validation', () => {
    it('should validate file upload configuration', () => {
      const validConfig = {
        maxSize: 5 * 1024 * 1024, // 5MB
        allowedMimeTypes: ['text/plain', 'application/pdf', 'text/markdown'],
        allowedExtensions: ['.txt', '.pdf', '.md']
      };

      const result = schemas.file.upload.parse(validConfig);
      expect(result.maxSize).toBe(5 * 1024 * 1024);
      expect(result.allowedMimeTypes).toContain('text/plain');
      expect(result.allowedExtensions).toContain('.txt');
    });

    it('should use default values for file upload', () => {
      const minimalConfig = {};

      const result = schemas.file.upload.parse(minimalConfig);
      expect(result.maxSize).toBe(10 * 1024 * 1024); // Default 10MB
      expect(result.allowedMimeTypes).toContain('text/plain');
      expect(result.allowedExtensions).toContain('.txt');
    });
  });

  describe('Authentication Validation', () => {
    it('should validate user registration', () => {
      const validRegistration = {
        email: 'test@example.com',
        password: 'SecurePass123',
        name: 'Test User'
      };

      const result = schemas.auth.register.parse(validRegistration);
      expect(result.email).toBe('test@example.com');
      expect(result.name).toBe('Test User');
    });

    it('should reject weak password', () => {
      const invalidRegistration = {
        email: 'test@example.com',
        password: 'weak', // Invalid: too short and no uppercase/numbers
        name: 'Test User'
      };

      expect(() => schemas.auth.register.parse(invalidRegistration)).toThrow();
    });

    it('should reject invalid email format', () => {
      const invalidRegistration = {
        email: 'not-an-email', // Invalid email format
        password: 'SecurePass123',
        name: 'Test User'
      };

      expect(() => schemas.auth.register.parse(invalidRegistration)).toThrow();
    });
  });
});