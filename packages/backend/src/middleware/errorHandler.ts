import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { config } from '../config/env.js';

/**
 * Standard error codes for the application
 */
export enum ErrorCode {
  // Validation errors (4000-4099)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // Authentication/Authorization errors (4100-4199)
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // Resource errors (4200-4299)
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  
  // Business logic errors (4300-4399)
  INSUFFICIENT_EVIDENCE = 'INSUFFICIENT_EVIDENCE',
  INVALID_OPERATION = 'INVALID_OPERATION',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  PROCESSING_FAILED = 'PROCESSING_FAILED',
  
  // File handling errors (4400-4499)
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  FILE_UPLOAD_FAILED = 'FILE_UPLOAD_FAILED',
  FILE_PROCESSING_FAILED = 'FILE_PROCESSING_FAILED',
  
  // External service errors (4500-4599)
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  LLM_SERVICE_ERROR = 'LLM_SERVICE_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Server errors (5000-5099)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE'
}

/**
 * Custom application error class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: ErrorCode;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    errorCode: ErrorCode,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    this.context = context;

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error response format
 */
interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: any;
    context?: Record<string, any>;
    requestId?: string;
  };
  timestamp: string;
  path: string;
  method: string;
}

/**
 * Create standardized error response
 */
function createErrorResponse(
  req: Request,
  error: AppError | Error,
  statusCode: number,
  errorCode: ErrorCode,
  details?: any
): ErrorResponse {
  const requestId = req.headers['x-request-id'] as string || generateRequestId();
  
  const response: ErrorResponse = {
    success: false,
    error: {
      code: errorCode,
      message: error.message,
      requestId
    },
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  };

  if (details) {
    response.error.details = details;
  }

  if (error instanceof AppError && error.context) {
    response.error.context = error.context;
  }

  // Include stack trace in development
  if (config.NODE_ENV === 'development') {
    response.error.details = {
      ...response.error.details,
      stack: error.stack
    };
  }

  return response;
}

/**
 * Handle Zod validation errors
 */
function handleZodError(error: ZodError): { statusCode: number; errorCode: ErrorCode; details: any } {
  const details = error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
    received: 'received' in err ? err.received : undefined
  }));

  return {
    statusCode: 400,
    errorCode: ErrorCode.VALIDATION_ERROR,
    details: {
      validationErrors: details
    }
  };
}

/**
 * Handle Prisma errors
 */
function handlePrismaError(error: Prisma.PrismaClientKnownRequestError): { statusCode: number; errorCode: ErrorCode; details?: any } {
  switch (error.code) {
    case 'P2002':
      return {
        statusCode: 409,
        errorCode: ErrorCode.RESOURCE_CONFLICT,
        details: {
          constraint: error.meta?.target,
          prismaCode: error.code
        }
      };
    case 'P2025':
      return {
        statusCode: 404,
        errorCode: ErrorCode.RESOURCE_NOT_FOUND,
        details: {
          prismaCode: error.code
        }
      };
    case 'P2003':
      return {
        statusCode: 400,
        errorCode: ErrorCode.INVALID_INPUT,
        details: {
          constraint: 'Foreign key constraint failed',
          field: error.meta?.field_name,
          prismaCode: error.code
        }
      };
    case 'P2011':
      return {
        statusCode: 400,
        errorCode: ErrorCode.MISSING_REQUIRED_FIELD,
        details: {
          constraint: error.meta?.constraint,
          prismaCode: error.code
        }
      };
    default:
      return {
        statusCode: 500,
        errorCode: ErrorCode.DATABASE_ERROR,
        details: {
          prismaCode: error.code
        }
      };
  }
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2)}`;
}

/**
 * Log error with appropriate level
 */
function logError(error: Error | AppError, req: Request, statusCode: number) {
  const logData = {
    message: error.message,
    statusCode,
    method: req.method,
    path: req.path,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    requestId: req.headers['x-request-id'],
    timestamp: new Date().toISOString()
  };

  if (statusCode >= 500) {
    console.error('Server Error:', logData, error.stack);
  } else if (statusCode >= 400) {
    console.warn('Client Error:', logData);
  } else {
    console.info('Request Error:', logData);
  }
}

/**
 * Main error handling middleware
 */
export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let errorCode = ErrorCode.INTERNAL_SERVER_ERROR;
  let details: any = undefined;

  // Handle different error types
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    errorCode = error.errorCode;
  } else if (error instanceof ZodError) {
    const handled = handleZodError(error);
    statusCode = handled.statusCode;
    errorCode = handled.errorCode;
    details = handled.details;
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const handled = handlePrismaError(error);
    statusCode = handled.statusCode;
    errorCode = handled.errorCode;
    details = handled.details;
  } else if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    statusCode = 500;
    errorCode = ErrorCode.DATABASE_ERROR;
    details = { message: 'Unknown database error' };
  } else if (error instanceof Prisma.PrismaClientRustPanicError) {
    statusCode = 500;
    errorCode = ErrorCode.DATABASE_ERROR;
    details = { message: 'Database engine panic' };
  } else if (error instanceof Prisma.PrismaClientInitializationError) {
    statusCode = 503;
    errorCode = ErrorCode.SERVICE_UNAVAILABLE;
    details = { message: 'Database connection failed' };
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    errorCode = ErrorCode.VALIDATION_ERROR;
    details = { message: 'Database query validation failed' };
  } else if (error.name === 'MulterError') {
    // Handle file upload errors
    statusCode = 400;
    if (error.message.includes('File too large')) {
      errorCode = ErrorCode.FILE_TOO_LARGE;
    } else if (error.message.includes('Unexpected field')) {
      errorCode = ErrorCode.INVALID_INPUT;
    } else {
      errorCode = ErrorCode.FILE_UPLOAD_FAILED;
    }
  }

  // Log the error
  logError(error, req, statusCode);

  // Create and send error response
  const errorResponse = createErrorResponse(req, error, statusCode, errorCode, details);
  res.status(statusCode).json(errorResponse);
};

/**
 * Handle unhandled promise rejections
 */
export const handleUnhandledRejection = (reason: any, promise: Promise<any>) => {
  console.error('Unhandled Promise Rejection:', reason);
  // In production, you might want to gracefully shut down the server
  if (config.NODE_ENV === 'production') {
    console.error('Shutting down due to unhandled promise rejection');
    process.exit(1);
  }
};

/**
 * Handle uncaught exceptions
 */
export const handleUncaughtException = (error: Error) => {
  console.error('Uncaught Exception:', error);
  // Always exit on uncaught exceptions
  console.error('Shutting down due to uncaught exception');
  process.exit(1);
};

/**
 * Async error wrapper for route handlers
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Create a new application error
 */
export const createError = (
  message: string,
  errorCode: ErrorCode,
  statusCode: number,
  context?: Record<string, any>
): AppError => {
  return new AppError(message, errorCode, statusCode, true, context);
};

/**
 * HTTP status code mapping for common error codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;