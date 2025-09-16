import { z } from 'zod';

/**
 * Common validation schemas used across multiple endpoints
 */
export const commonSchemas = {
  // CUID parameter validation
  cuidParam: z.object({
    id: z.string().cuid('Invalid ID format')
  }),

  // Pagination query validation
  paginationQuery: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    search: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
  }),

  // Date range query validation
  dateRangeQuery: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional()
  }),

  // Metadata validation (JSON object)
  metadata: z.record(z.any()).optional().default({})
};

/**
 * Project-related validation schemas
 */
export const projectSchemas = {
  create: z.object({
    name: z.string()
      .min(1, 'Name is required')
      .max(255, 'Name must be less than 255 characters')
      .regex(/^[a-zA-Z0-9\s\-_\.]+$/, 'Name contains invalid characters'),
    description: z.string()
      .max(2000, 'Description must be less than 2000 characters')
      .optional(),
    metadata: commonSchemas.metadata
  }),

  update: z.object({
    name: z.string()
      .min(1)
      .max(255)
      .regex(/^[a-zA-Z0-9\s\-_\.]+$/, 'Name contains invalid characters')
      .optional(),
    description: z.string()
      .max(2000, 'Description must be less than 2000 characters')
      .optional(),
    metadata: commonSchemas.metadata
  }),

  query: commonSchemas.paginationQuery.extend({
    includeStats: z.coerce.boolean().default(true)
  })
};

/**
 * Source-related validation schemas
 */
export const sourceSchemas = {
  create: z.object({
    projectId: z.string().cuid('Invalid project ID'),
    name: z.string()
      .min(1, 'Name is required')
      .max(255, 'Name must be less than 255 characters'),
    tier: z.enum(['CANONICAL', 'REPUTABLE', 'COMMUNITY', 'INFORMAL'], {
      errorMap: () => ({ message: 'Invalid source tier' })
    }),
    url: z.string()
      .url('Invalid URL format')
      .max(1000, 'URL must be less than 1000 characters')
      .optional(),
    author: z.string()
      .max(255, 'Author must be less than 255 characters')
      .optional(),
    publishedAt: z.string().datetime().optional(),
    accessedAt: z.string().datetime().optional(),
    content: z.string().min(1, 'Content is required'),
    metadata: commonSchemas.metadata
  }),

  update: z.object({
    name: z.string()
      .min(1)
      .max(255)
      .optional(),
    tier: z.enum(['CANONICAL', 'REPUTABLE', 'COMMUNITY', 'INFORMAL']).optional(),
    url: z.string()
      .url('Invalid URL format')
      .max(1000, 'URL must be less than 1000 characters')
      .optional(),
    author: z.string()
      .max(255, 'Author must be less than 255 characters')
      .optional(),
    publishedAt: z.string().datetime().optional(),
    accessedAt: z.string().datetime().optional(),
    content: z.string().min(1).optional(),
    metadata: commonSchemas.metadata
  }),

  query: commonSchemas.paginationQuery.extend({
    projectId: z.string().cuid().optional(),
    tier: z.enum(['CANONICAL', 'REPUTABLE', 'COMMUNITY', 'INFORMAL']).optional(),
    hasEvidence: z.coerce.boolean().optional()
  }),

  upload: z.object({
    projectId: z.string().cuid('Invalid project ID'),
    name: z.string()
      .min(1, 'Name is required')
      .max(255, 'Name must be less than 255 characters'),
    tier: z.enum(['CANONICAL', 'REPUTABLE', 'COMMUNITY', 'INFORMAL'], {
      errorMap: () => ({ message: 'Invalid source tier' })
    }),
    url: z.string()
      .url('Invalid URL format')
      .max(1000, 'URL must be less than 1000 characters')
      .optional(),
    author: z.string()
      .max(255, 'Author must be less than 255 characters')
      .optional(),
    publishedAt: z.string().datetime().optional(),
    processEvidence: z.coerce.boolean().default(true),
    metadata: commonSchemas.metadata
  }),

  process: z.object({
    processEvidence: z.boolean().default(true),
    unitSize: z.number().min(100).max(1000).default(300),
    overlapSize: z.number().min(0).max(200).default(50),
    deduplicationThreshold: z.number().min(0).max(1).default(0.85)
  })
};

/**
 * Evidence-related validation schemas
 */
export const evidenceSchemas = {
  query: commonSchemas.paginationQuery.extend({
    sourceId: z.string().cuid().optional(),
    projectId: z.string().cuid().optional(),
    minQualityScore: z.coerce.number().min(0).max(1).optional(),
    topics: z.string().optional().transform(val => val ? val.split(',').map(t => t.trim()) : undefined)
  }),

  update: z.object({
    qualityScore: z.number().min(0).max(1).optional(),
    confidence: z.number().min(0).max(1).optional(),
    topics: z.array(z.string().min(1).max(100)).max(10).optional(),
    metadata: commonSchemas.metadata
  }),

  search: z.object({
    query: z.string().min(1, 'Search query is required').max(500),
    projectId: z.string().cuid().optional(),
    sourceIds: z.array(z.string().cuid()).optional(),
    minQualityScore: z.number().min(0).max(1).optional(),
    limit: z.number().min(1).max(100).default(20)
  })
};

/**
 * Persona-related validation schemas
 */
export const personaSchemas = {
  create: z.object({
    projectId: z.string().cuid('Invalid project ID'),
    status: z.enum(['DRAFT', 'REVIEW', 'APPROVED', 'REJECTED']).default('DRAFT')
  }),

  update: z.object({
    status: z.enum(['DRAFT', 'REVIEW', 'APPROVED', 'REJECTED']).optional()
  }),

  query: commonSchemas.paginationQuery.extend({
    projectId: z.string().cuid().optional(),
    status: z.enum(['DRAFT', 'REVIEW', 'APPROVED', 'REJECTED']).optional()
  }),

  generate: z.object({
    projectId: z.string().cuid('Invalid project ID'),
    evidenceUnitIds: z.array(z.string().cuid())
      .min(1, 'At least one evidence unit is required')
      .max(100, 'Maximum 100 evidence units allowed'),
    extractionType: z.enum(['full', 'specific_field']).default('full'),
    specificFields: z.array(z.string().min(1).max(100)).optional(),
    conflictHandling: z.enum(['flag', 'choose_best', 'synthesize']).default('flag'),
    requireCitations: z.boolean().default(true),
    maxTokens: z.number().min(100).max(4000).default(2000)
  }),

  approve: z.object({
    status: z.enum(['APPROVED', 'REJECTED']),
    reviewNotes: z.string().max(2000).optional()
  })
};

/**
 * Claim-related validation schemas
 */
export const claimSchemas = {
  create: z.object({
    personaId: z.string().cuid('Invalid persona ID'),
    type: z.string()
      .min(1, 'Type is required')
      .max(100, 'Type must be less than 100 characters')
      .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Type contains invalid characters')
  }),

  createField: z.object({
    claimId: z.string().cuid('Invalid claim ID'),
    text: z.string()
      .min(1, 'Text is required')
      .max(5000, 'Text must be less than 5000 characters'),
    confidence: z.number().min(0).max(1).default(0.8)
  }),

  updateField: z.object({
    text: z.string()
      .min(1)
      .max(5000, 'Text must be less than 5000 characters')
      .optional(),
    confidence: z.number().min(0).max(1).optional()
  }),

  createCitation: z.object({
    claimFieldId: z.string().cuid('Invalid claim field ID'),
    sentenceIndex: z.number().int().min(0).max(1000),
    evidenceIds: z.array(z.string().cuid())
      .min(1, 'At least one evidence unit ID is required')
      .max(20, 'Maximum 20 evidence units per citation')
  }),

  updateCitation: z.object({
    sentenceIndex: z.number().int().min(0).max(1000).optional(),
    evidenceIds: z.array(z.string().cuid())
      .min(1, 'At least one evidence unit ID is required')
      .max(20, 'Maximum 20 evidence units per citation')
      .optional()
  })
};

/**
 * File upload validation schemas
 */
export const fileSchemas = {
  upload: z.object({
    maxSize: z.number().default(10 * 1024 * 1024), // 10MB
    allowedMimeTypes: z.array(z.string()).default([
      'text/plain',
      'text/html',
      'text/markdown',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/json',
      'text/csv'
    ]),
    allowedExtensions: z.array(z.string()).default([
      '.txt', '.html', '.htm', '.md', '.pdf', '.doc', '.docx', '.json', '.csv'
    ])
  })
};

/**
 * Authentication and authorization schemas
 */
export const authSchemas = {
  login: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters')
  }),

  register: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    name: z.string()
      .min(1, 'Name is required')
      .max(255, 'Name must be less than 255 characters')
  }),

  changePassword: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number')
  })
};

/**
 * API key and rate limiting schemas
 */
export const apiSchemas = {
  rateLimit: z.object({
    windowMs: z.number().default(15 * 60 * 1000), // 15 minutes
    max: z.number().default(100), // limit each IP to 100 requests per windowMs
    skipSuccessfulRequests: z.boolean().default(false)
  }),

  apiKey: z.object({
    key: z.string().min(32, 'API key must be at least 32 characters'),
    permissions: z.array(z.string()).default(['read']),
    expiresAt: z.string().datetime().optional()
  })
};

/**
 * Utility functions for schema validation
 */
export const validationUtils = {
  /**
   * Sanitize string input to prevent XSS
   */
  sanitizeString: (str: string): string => {
    return str
      .replace(/[<>]/g, '') // Remove < and > characters
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  },

  /**
   * Validate and sanitize HTML content
   */
  sanitizeHtml: z.string().transform((str) => {
    // Basic HTML sanitization - in production, use a library like DOMPurify
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '');
  }),

  /**
   * Validate file extension
   */
  validateFileExtension: (filename: string, allowedExtensions: string[]): boolean => {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return allowedExtensions.includes(ext);
  },

  /**
   * Validate MIME type
   */
  validateMimeType: (mimetype: string, allowedTypes: string[]): boolean => {
    return allowedTypes.includes(mimetype.toLowerCase());
  }
};

/**
 * Export all schemas for easy importing
 */
export const schemas = {
  common: commonSchemas,
  project: projectSchemas,
  source: sourceSchemas,
  evidence: evidenceSchemas,
  persona: personaSchemas,
  claim: claimSchemas,
  file: fileSchemas,
  auth: authSchemas,
  api: apiSchemas
};

export default schemas;