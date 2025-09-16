import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorCode, AppError, errorHandler, createError } from '../../middleware/errorHandler.js';
import { auditService, AuditAction, AuditResource } from '../../services/AuditService.js';
import { logger, LogLevel } from '../../utils/logger.js';
import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

// Mock Express request/response objects
const mockRequest = (overrides = {}) => ({
  headers: { 'x-request-id': 'test-req-123' },
  method: 'GET',
  path: '/test',
  ip: '127.0.0.1',
  get: (header: string) => header === 'User-Agent' ? 'test-agent' : undefined,
  ...overrides
}) as unknown as Request;

const mockResponse = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    locals: {}
  } as unknown as Response;
  return res;
};

const mockNext = vi.fn();

describe('Error Handling & Logging System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AppError Class', () => {
    it('should create error with correct properties', () => {
      const error = new AppError(
        'Test error message',
        ErrorCode.VALIDATION_ERROR,
        400,
        true,
        { field: 'email' }
      );

      expect(error.message).toBe('Test error message');
      expect(error.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
      expect(error.context).toEqual({ field: 'email' });
      expect(error.name).toBe('AppError');
    });
  });

  describe('Error Handler Middleware', () => {
    it('should handle AppError correctly', () => {
      const req = mockRequest();
      const res = mockResponse();
      const error = createError('Custom error', ErrorCode.RESOURCE_NOT_FOUND, 404);

      errorHandler(error, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.RESOURCE_NOT_FOUND,
            message: 'Custom error'
          }),
          timestamp: expect.any(String),
          path: '/test',
          method: 'GET'
        })
      );
    });

    it('should handle ZodError correctly', () => {
      const req = mockRequest();
      const res = mockResponse();
      
      // Create a mock ZodError
      const zodError = {
        name: 'ZodError',
        errors: [
          {
            path: ['email'],
            message: 'Invalid email format',
            code: 'invalid_string',
            received: 'not-an-email'
          }
        ]
      } as unknown as ZodError;

      errorHandler(zodError, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.VALIDATION_ERROR,
            details: expect.objectContaining({
              validationErrors: expect.arrayContaining([
                expect.objectContaining({
                  field: 'email',
                  message: 'Invalid email format'
                })
              ])
            })
          })
        })
      );
    });

    it('should handle Prisma errors correctly', () => {
      const req = mockRequest();
      const res = mockResponse();
      
      // Mock Prisma constraint error
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '5.0.0', meta: { target: ['email'] } }
      );

      errorHandler(prismaError, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.RESOURCE_CONFLICT
          })
        })
      );
    });

    it('should handle generic errors', () => {
      const req = mockRequest();
      const res = mockResponse();
      const genericError = new Error('Something went wrong');

      errorHandler(genericError, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.INTERNAL_SERVER_ERROR,
            message: 'Something went wrong'
          })
        })
      );
    });
  });

  describe('Audit Service', () => {
    const mockReq = mockRequest({
      user: { id: 'user-123' },
      session: { id: 'session-456' }
    });

    it('should log successful operations', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await auditService.logSuccess(
        mockReq,
        AuditAction.CREATE,
        AuditResource.PROJECT,
        'project-123',
        { name: 'Test Project' }
      );

      // Should not throw or log errors
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log failed operations', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Operation failed');

      await auditService.logFailure(
        mockReq,
        AuditAction.UPDATE,
        AuditResource.PROJECT,
        'project-123',
        error,
        { attemptedChanges: { name: 'New Name' } }
      );

      // Should not throw or log errors
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should redact PII from audit logs', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await auditService.logCreate(
        mockReq,
        AuditResource.PROJECT,
        'project-123',
        {
          name: 'Test Project',
          email: 'user@example.com',
          phone: '555-123-4567',
          apiKey: 'sk-1234567890abcdef'
        }
      );

      // Should not throw errors
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Logger Service', () => {
    let consoleSpy: any;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log at different levels', () => {
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message', new Error('Test error'));

      expect(consoleSpy).toHaveBeenCalledTimes(3);
    });

    it('should redact PII from logs', () => {
      logger.info('User logged in', {
        email: 'user@example.com',
        phone: '555-123-4567',
        creditCard: '4111-1111-1111-1111'
      });

      expect(consoleSpy).toHaveBeenCalled();
      const loggedData = consoleSpy.mock.calls[0][0];
      expect(loggedData).not.toContain('user@example.com');
      expect(loggedData).not.toContain('555-123-4567');
      expect(loggedData).not.toContain('4111-1111-1111-1111');
    });

    it('should redact sensitive fields', () => {
      logger.info('Processing request', {
        password: 'secret123',
        apiKey: 'sk-1234567890',
        token: 'jwt.token.here'
      });

      expect(consoleSpy).toHaveBeenCalled();
      const loggedData = consoleSpy.mock.calls[0][0];
      expect(loggedData).toContain('[REDACTED_SENSITIVE]');
      expect(loggedData).not.toContain('secret123');
    });

    it('should handle request/response logging', () => {
      const req = mockRequest();
      const res = mockResponse();

      logger.logRequest(req);
      logger.logResponse(req, res as Response);

      expect(consoleSpy).toHaveBeenCalledTimes(2);
    });

    it('should log performance metrics', () => {
      logger.logPerformance('database_query', 150.5, {
        query: 'SELECT * FROM projects',
        resultCount: 10
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Performance: database_query')
      );
    });

    it('should log business events', () => {
      logger.logBusinessEvent('project_created', {
        projectId: 'project-123',
        userId: 'user-456'
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Business Event: project_created')
      );
    });

    it('should log security events', () => {
      const req = mockRequest();
      
      logger.logSecurityEvent('failed_login_attempt', req, {
        attemptedEmail: 'test@example.com',
        reason: 'invalid_credentials'
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Security Event: failed_login_attempt')
      );
    });
  });

  describe('Error Code Categories', () => {
    it('should have correct validation error codes', () => {
      expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ErrorCode.INVALID_INPUT).toBe('INVALID_INPUT');
      expect(ErrorCode.MISSING_REQUIRED_FIELD).toBe('MISSING_REQUIRED_FIELD');
    });

    it('should have correct resource error codes', () => {
      expect(ErrorCode.RESOURCE_NOT_FOUND).toBe('RESOURCE_NOT_FOUND');
      expect(ErrorCode.RESOURCE_ALREADY_EXISTS).toBe('RESOURCE_ALREADY_EXISTS');
      expect(ErrorCode.RESOURCE_CONFLICT).toBe('RESOURCE_CONFLICT');
    });

    it('should have correct business logic error codes', () => {
      expect(ErrorCode.INSUFFICIENT_EVIDENCE).toBe('INSUFFICIENT_EVIDENCE');
      expect(ErrorCode.INVALID_OPERATION).toBe('INVALID_OPERATION');
      expect(ErrorCode.QUOTA_EXCEEDED).toBe('QUOTA_EXCEEDED');
    });

    it('should have correct server error codes', () => {
      expect(ErrorCode.INTERNAL_SERVER_ERROR).toBe('INTERNAL_SERVER_ERROR');
      expect(ErrorCode.DATABASE_ERROR).toBe('DATABASE_ERROR');
      expect(ErrorCode.SERVICE_UNAVAILABLE).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete error flow with audit logging', async () => {
      const req = mockRequest();
      const res = mockResponse();
      const error = createError(
        'Failed to create project',
        ErrorCode.VALIDATION_ERROR,
        400,
        { field: 'name', reason: 'too_short' }
      );

      // Log the failure attempt
      await auditService.logFailure(
        req,
        AuditAction.CREATE,
        AuditResource.PROJECT,
        'project-new',
        error,
        { attemptedName: 'A' }
      );

      // Handle the error
      errorHandler(error, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Failed to create project'
          })
        })
      );
    });
  });
});