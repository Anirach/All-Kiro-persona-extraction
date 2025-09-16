import { describe, it, expect, beforeEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import {
  validateRequest,
  validateFileUpload,
  sanitizeRequest,
  validateContentType,
  validateRequestSize,
  validateRateLimit,
  validateApiKey,
  validationErrorHandler,
  MulterRequest
} from '../../../middleware/validation.js';
import { schemas } from '../../../validation/schemas.js';
import { sendError } from '../../../utils/asyncHandler.js';

// Mock sendError
jest.mock('../../../utils/asyncHandler.js', () => ({
  sendError: jest.fn()
}));

const mockSendError = sendError as jest.MockedFunction<typeof sendError>;

describe('Validation Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      body: {},
      query: {},
      params: {},
      headers: {},
      method: 'GET',
      ip: '127.0.0.1'
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis()
    };
    nextFunction = jest.fn();
    mockSendError.mockClear();
  });

  describe('validateRequest', () => {
    it('should validate request body successfully', () => {
      const middleware = validateRequest({
        body: schemas.project.create
      });

      mockRequest.body = {
        name: 'Test Project',
        description: 'A test project',
        metadata: {}
      };

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockSendError).not.toHaveBeenCalled();
    });

    it('should fail validation with invalid body', () => {
      const middleware = validateRequest({
        body: schemas.project.create
      });

      mockRequest.body = {
        name: '', // Invalid: empty name
        description: 'A test project'
      };

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockSendError).toHaveBeenCalledWith(
        mockResponse,
        'Validation failed',
        400,
        expect.objectContaining({
          validationErrors: expect.arrayContaining([
            expect.objectContaining({
              field: 'name',
              message: expect.stringContaining('Name is required')
            })
          ])
        })
      );
    });

    it('should validate query parameters successfully', () => {
      const middleware = validateRequest({
        query: schemas.common.paginationQuery
      });

      mockRequest.query = {
        page: '1',
        limit: '20',
        search: 'test'
      };

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.query).toEqual({
        page: 1,
        limit: 20,
        search: 'test',
        sortOrder: 'desc'
      });
    });

    it('should validate URL parameters successfully', () => {
      const middleware = validateRequest({
        params: schemas.common.cuidParam
      });

      mockRequest.params = {
        id: 'clrxyz123456789012345678'
      };

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should fail validation with invalid CUID parameter', () => {
      const middleware = validateRequest({
        params: schemas.common.cuidParam
      });

      mockRequest.params = {
        id: 'invalid-id'
      };

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockSendError).toHaveBeenCalledWith(
        mockResponse,
        'Validation failed',
        400,
        expect.objectContaining({
          validationErrors: expect.arrayContaining([
            expect.objectContaining({
              field: 'id',
              message: expect.stringContaining('Invalid ID format')
            })
          ])
        })
      );
    });

    it('should sanitize XSS in request body', () => {
      const middleware = validateRequest({
        body: schemas.project.create
      });

      mockRequest.body = {
        name: 'Test<script>alert("xss")</script>Project',
        description: 'A test project with javascript: protocol',
        metadata: {}
      };

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.body.name).not.toContain('<script>');
      expect(mockRequest.body.name).not.toContain('alert');
    });
  });

  describe('validateContentType', () => {
    it('should pass for valid content type', () => {
      const middleware = validateContentType(['application/json']);

      mockRequest.method = 'POST';
      mockRequest.get = jest.fn().mockReturnValue('application/json');

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockSendError).not.toHaveBeenCalled();
    });

    it('should fail for invalid content type', () => {
      const middleware = validateContentType(['application/json']);

      mockRequest.method = 'POST';
      mockRequest.get = jest.fn().mockReturnValue('text/plain');

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockSendError).toHaveBeenCalledWith(
        mockResponse,
        'Invalid Content-Type. Allowed types: application/json',
        400
      );
    });

    it('should fail for missing content type', () => {
      const middleware = validateContentType(['application/json']);

      mockRequest.method = 'POST';
      mockRequest.get = jest.fn().mockReturnValue(undefined);

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockSendError).toHaveBeenCalledWith(
        mockResponse,
        'Content-Type header is required',
        400
      );
    });

    it('should skip validation for GET requests', () => {
      const middleware = validateContentType(['application/json']);

      mockRequest.method = 'GET';

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockSendError).not.toHaveBeenCalled();
    });
  });

  describe('validateRequestSize', () => {
    it('should pass for valid request size', () => {
      const middleware = validateRequestSize(1024 * 1024); // 1MB

      mockRequest.get = jest.fn().mockReturnValue('1000'); // 1KB

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockSendError).not.toHaveBeenCalled();
    });

    it('should fail for oversized request', () => {
      const middleware = validateRequestSize(1024); // 1KB

      mockRequest.get = jest.fn().mockReturnValue('2048'); // 2KB

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockSendError).toHaveBeenCalledWith(
        mockResponse,
        'Request too large. Maximum size: 0MB',
        413
      );
    });
  });

  describe('validateRateLimit', () => {
    it('should pass for requests within limit', () => {
      const middleware = validateRateLimit({ max: 10, windowMs: 60000 });

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockSendError).not.toHaveBeenCalled();
      expect(mockResponse.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': '9'
        })
      );
    });

    it('should fail for requests exceeding limit', () => {
      const middleware = validateRateLimit({ max: 1, windowMs: 60000 });

      // First request should pass
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalledTimes(1);

      // Second request should fail
      nextFunction.mockClear();
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockSendError).toHaveBeenCalledWith(
        mockResponse,
        'Too many requests',
        429,
        expect.objectContaining({
          retryAfter: expect.any(Number)
        })
      );
    });
  });

  describe('validateApiKey', () => {
    it('should pass for valid API key', () => {
      const middleware = validateApiKey();

      mockRequest.get = jest.fn().mockReturnValue('a'.repeat(32)); // 32 character key

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockSendError).not.toHaveBeenCalled();
      expect((mockRequest as any).apiKey).toBe('a'.repeat(32));
    });

    it('should fail for missing API key', () => {
      const middleware = validateApiKey();

      mockRequest.get = jest.fn().mockReturnValue(undefined);

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockSendError).toHaveBeenCalledWith(
        mockResponse,
        'API key is required',
        401
      );
    });

    it('should fail for invalid API key format', () => {
      const middleware = validateApiKey();

      mockRequest.get = jest.fn().mockReturnValue('short'); // Too short

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockSendError).toHaveBeenCalledWith(
        mockResponse,
        'Invalid API key format',
        401
      );
    });

    it('should extract API key from Authorization header', () => {
      const middleware = validateApiKey();

      mockRequest.get = jest.fn()
        .mockReturnValueOnce(undefined) // X-API-Key header
        .mockReturnValueOnce('Bearer ' + 'a'.repeat(32)); // Authorization header

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect((mockRequest as any).apiKey).toBe('a'.repeat(32));
    });
  });

  describe('sanitizeRequest', () => {
    it('should sanitize XSS in query parameters', () => {
      const middleware = sanitizeRequest();

      mockRequest.query = {
        search: '<script>alert("xss")</script>',
        category: 'javascript:alert("xss")'
      };

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.query.search).not.toContain('<script>');
      expect(mockRequest.query.category).not.toContain('javascript:');
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should sanitize XSS in request body', () => {
      const middleware = sanitizeRequest();

      mockRequest.body = {
        name: '<img src="x" onerror="alert(1)">',
        description: 'onload="malicious()"'
      };

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.body.name).not.toContain('onerror=');
      expect(mockRequest.body.description).not.toContain('onload=');
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should sanitize XSS in URL parameters', () => {
      const middleware = sanitizeRequest();

      mockRequest.params = {
        id: '<script>alert("xss")</script>'
      };

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.params.id).not.toContain('<script>');
      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('validationErrorHandler', () => {
    it('should handle ZodError', () => {
      const middleware = validationErrorHandler();
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['name'],
          message: 'Expected string, received number'
        }
      ]);

      middleware(zodError, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockSendError).toHaveBeenCalledWith(
        mockResponse,
        'Validation failed',
        400,
        expect.objectContaining({
          validationErrors: expect.arrayContaining([
            expect.objectContaining({
              field: 'name',
              message: 'Expected string, received number',
              code: 'invalid_type'
            })
          ])
        })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should pass through non-ZodError', () => {
      const middleware = validationErrorHandler();
      const error = new Error('Generic error');

      middleware(error, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockSendError).not.toHaveBeenCalled();
      expect(nextFunction).toHaveBeenCalledWith(error);
    });
  });
});

describe('Validation Schemas', () => {
  describe('Project Schemas', () => {
    it('should validate project creation', () => {
      const validData = {
        name: 'Test Project',
        description: 'A test project',
        metadata: { key: 'value' }
      };

      const result = schemas.project.create.parse(validData);
      expect(result).toEqual(validData);
    });

    it('should reject invalid project name', () => {
      const invalidData = {
        name: '', // Empty name
        description: 'A test project'
      };

      expect(() => schemas.project.create.parse(invalidData)).toThrow();
    });

    it('should reject project name with invalid characters', () => {
      const invalidData = {
        name: 'Test<script>Project', // Contains script tag
        description: 'A test project'
      };

      expect(() => schemas.project.create.parse(invalidData)).toThrow();
    });
  });

  describe('Source Schemas', () => {
    it('should validate source creation', () => {
      const validData = {
        projectId: 'clrxyz123456789012345678',
        name: 'Test Source',
        tier: 'REPUTABLE' as const,
        url: 'https://example.com',
        author: 'Test Author',
        content: 'Test content',
        metadata: {}
      };

      const result = schemas.source.create.parse(validData);
      expect(result).toEqual(validData);
    });

    it('should reject invalid source tier', () => {
      const invalidData = {
        projectId: 'clrxyz123456789012345678',
        name: 'Test Source',
        tier: 'INVALID_TIER', // Invalid tier
        content: 'Test content'
      };

      expect(() => schemas.source.create.parse(invalidData)).toThrow();
    });

    it('should reject invalid URL format', () => {
      const invalidData = {
        projectId: 'clrxyz123456789012345678',
        name: 'Test Source',
        tier: 'REPUTABLE' as const,
        url: 'not-a-url', // Invalid URL
        content: 'Test content'
      };

      expect(() => schemas.source.create.parse(invalidData)).toThrow();
    });
  });

  describe('Evidence Schemas', () => {
    it('should validate evidence query', () => {
      const validQuery = {
        page: '1',
        limit: '20',
        sourceId: 'clrxyz123456789012345678',
        minQualityScore: '0.5',
        topics: 'tech,science'
      };

      const result = schemas.evidence.query.parse(validQuery);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.minQualityScore).toBe(0.5);
      expect(result.topics).toEqual(['tech', 'science']);
    });

    it('should validate evidence update', () => {
      const validData = {
        qualityScore: 0.8,
        confidence: 0.9,
        topics: ['technology', 'science'],
        metadata: { source: 'test' }
      };

      const result = schemas.evidence.update.parse(validData);
      expect(result).toEqual(validData);
    });
  });

  describe('File Upload Schemas', () => {
    it('should validate file upload configuration', () => {
      const validConfig = {
        maxSize: 5 * 1024 * 1024, // 5MB
        allowedMimeTypes: ['text/plain', 'application/pdf'],
        allowedExtensions: ['.txt', '.pdf']
      };

      const result = schemas.file.upload.parse(validConfig);
      expect(result).toEqual(validConfig);
    });
  });

  describe('Claim Schemas', () => {
    it('should validate claim creation', () => {
      const validData = {
        personaId: 'clrxyz123456789012345678',
        type: 'personal-info'
      };

      const result = schemas.claim.create.parse(validData);
      expect(result).toEqual(validData);
    });

    it('should validate citation creation', () => {
      const validData = {
        claimFieldId: 'clrxyz123456789012345678',
        sentenceIndex: 0,
        evidenceIds: ['clrabc123456789012345678', 'clrdef123456789012345678']
      };

      const result = schemas.claim.createCitation.parse(validData);
      expect(result).toEqual(validData);
    });
  });
});