import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import multer from 'multer';
import { sendError } from '../utils/asyncHandler.js';
import { schemas, validationUtils } from '../validation/schemas.js';

// Re-export common schemas for backward compatibility
export { commonSchemas } from '../validation/schemas.js';

/**
 * Extended request interface for file uploads
 */
export interface MulterRequest extends Request {
  file?: Express.Multer.File;
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
}

/**
 * Validation middleware factory for request validation using Zod schemas
 */
export const validateRequest = (schema: {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
  headers?: z.ZodSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Sanitize request body strings to prevent XSS
      if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
      }

      // Validate request body
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }

      // Validate query parameters
      if (schema.query) {
        req.query = schema.query.parse(req.query);
      }

      // Validate URL parameters
      if (schema.params) {
        req.params = schema.params.parse(req.params);
      }

      // Validate headers
      if (schema.headers) {
        req.headers = schema.headers.parse(req.headers);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
          value: (err as any).received // Some ZodIssue types have received property
        }));

        sendError(res, 'Validation failed', 400, {
          validationErrors,
          timestamp: new Date().toISOString()
        });
        return;
      }

      sendError(res, 'Invalid request format', 400);
    }
  };
};

/**
 * File upload validation middleware
 */
export const validateFileUpload = (options: {
  maxSize?: number;
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
  required?: boolean;
} = {}) => {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedMimeTypes = [
      'text/plain',
      'text/html',
      'text/markdown',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/json',
      'text/csv'
    ],
    allowedExtensions = [
      '.txt', '.html', '.htm', '.md', '.pdf', '.doc', '.docx', '.json', '.csv'
    ],
    required = true
  } = options;

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxSize,
      files: 1
    },
    fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
      // Validate MIME type
      if (!validationUtils.validateMimeType(file.mimetype, allowedMimeTypes)) {
        const error = new Error(`Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`);
        (error as any).code = 'INVALID_FILE_TYPE';
        return cb(error);
      }

      // Validate file extension
      if (!validationUtils.validateFileExtension(file.originalname, allowedExtensions)) {
        const error = new Error(`Invalid file extension. Allowed extensions: ${allowedExtensions.join(', ')}`);
        (error as any).code = 'INVALID_FILE_EXTENSION';
        return cb(error);
      }

      // Additional security checks
      if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
        const error = new Error('Invalid filename. Path traversal detected.');
        (error as any).code = 'INVALID_FILENAME';
        return cb(error);
      }

      cb(null, true);
    }
  });

  return (req: Request, res: Response, next: NextFunction): void => {
    upload.single('file')(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        switch (err.code) {
          case 'LIMIT_FILE_SIZE':
            sendError(res, `File too large. Maximum size: ${Math.round(maxSize / 1024 / 1024)}MB`, 400);
            return;
          case 'LIMIT_FILE_COUNT':
            sendError(res, 'Too many files uploaded', 400);
            return;
          case 'LIMIT_UNEXPECTED_FILE':
            sendError(res, 'Unexpected file field', 400);
            return;
          default:
            sendError(res, `File upload error: ${err.message}`, 400);
            return;
        }
      }

      if (err) {
        sendError(res, err.message, 400, { code: err.code });
        return;
      }

      const multerReq = req as MulterRequest;

      // Check if file is required
      if (required && !multerReq.file) {
        return sendError(res, 'File is required', 400);
      }

      // Additional file content validation
      if (multerReq.file) {
        // Check for suspicious content patterns
        const buffer = multerReq.file.buffer;
        const content = buffer.toString('utf8', 0, Math.min(1024, buffer.length)); // Check first 1KB

        // Basic malware patterns (this is a simple check - use proper antivirus in production)
        const suspiciousPatterns = [
          /<script/i,
          /javascript:/i,
          /vbscript:/i,
          /onload=/i,
          /onerror=/i,
          /eval\(/i,
          /function\s*\(/i
        ];

        for (const pattern of suspiciousPatterns) {
          if (pattern.test(content)) {
            return sendError(res, 'File contains potentially malicious content', 400, {
              code: 'SUSPICIOUS_CONTENT'
            });
          }
        }

        // Validate file size matches declared size
        if (multerReq.file.size !== buffer.length) {
          return sendError(res, 'File size mismatch detected', 400, {
            code: 'SIZE_MISMATCH'
          });
        }
      }

      next();
    });
  };
};

/**
 * Request sanitization middleware to prevent XSS
 */
export const sanitizeRequest = () => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }

    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params);
    }

    next();
  };
};

/**
 * Content-Type validation middleware
 */
export const validateContentType = (allowedTypes: string[] = ['application/json']) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      const contentType = req.get('Content-Type');
      
      if (!contentType) {
        sendError(res, 'Content-Type header is required', 400);
        return;
      }

      const isAllowed = allowedTypes.some(type => contentType.includes(type));
      
      if (!isAllowed) {
        sendError(res, `Invalid Content-Type. Allowed types: ${allowedTypes.join(', ')}`, 400);
        return;
      }
    }

    next();
  };
};

/**
 * Request size validation middleware
 */
export const validateRequestSize = (maxSizeBytes: number = 1024 * 1024) => { // 1MB default
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.get('Content-Length');
    
    if (contentLength && parseInt(contentLength) > maxSizeBytes) {
      sendError(res, `Request too large. Maximum size: ${Math.round(maxSizeBytes / 1024 / 1024)}MB`, 413);
      return;
    }

    next();
  };
};

/**
 * Rate limiting validation (basic implementation)
 */
export const validateRateLimit = (options: {
  windowMs?: number;
  max?: number;
  skipSuccessfulRequests?: boolean;
} = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100,
    skipSuccessfulRequests = false
  } = options;

  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const resetTime = now + windowMs;

    let clientData = requests.get(clientId);

    if (!clientData || now > clientData.resetTime) {
      clientData = { count: 0, resetTime };
      requests.set(clientId, clientData);
    }

    clientData.count++;

    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': max.toString(),
      'X-RateLimit-Remaining': Math.max(0, max - clientData.count).toString(),
      'X-RateLimit-Reset': new Date(clientData.resetTime).toISOString()
    });

    if (clientData.count > max) {
      sendError(res, 'Too many requests', 429, {
        retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
      });
      return;
    }

    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance
      for (const [key, data] of requests.entries()) {
        if (now > data.resetTime) {
          requests.delete(key);
        }
      }
    }

    next();
  };
};

/**
 * API key validation middleware
 */
export const validateApiKey = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.get('X-API-Key') || req.get('Authorization')?.replace('Bearer ', '');

    if (!apiKey) {
      sendError(res, 'API key is required', 401);
      return;
    }

    // In a real implementation, validate against database
    // For now, just check if it's a valid format
    if (apiKey.length < 32) {
      sendError(res, 'Invalid API key format', 401);
      return;
    }

    // Add API key to request for later use
    (req as any).apiKey = apiKey;

    next();
  };
};

/**
 * Helper function to sanitize an object recursively
 */
function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return validationUtils.sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[validationUtils.sanitizeString(key)] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Validation error handler middleware
 */
export const validationErrorHandler = () => {
  return (err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof ZodError) {
      const validationErrors = err.errors.map(error => ({
        field: error.path.join('.'),
        message: error.message,
        code: error.code,
        value: (error as any).received // Some ZodIssue types have received property
      }));

      sendError(res, 'Validation failed', 400, {
        validationErrors,
        timestamp: new Date().toISOString()
      });
      return;
    }

    next(err);
  };
};