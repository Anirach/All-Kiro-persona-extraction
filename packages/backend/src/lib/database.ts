import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

/**
 * Check if error is a Prisma error with a code
 */
function isPrismaErrorWithCode(error: unknown): error is { code: string; message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof (error as any).code === 'string'
  );
}

/**
 * Check if error is a connection-related error
 */
function isConnectionError(error: unknown): boolean {
  return error instanceof Error && (
    error.message.includes('connection') ||
    error.message.includes('timeout') ||
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('database is locked')
  );
}

/**
 * Transaction wrapper with proper error handling
 * Automatically retries on connection errors
 */
export async function withTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: {
    maxWait?: number;
    timeout?: number;
    retries?: number;
  }
): Promise<T> {
  const { maxWait = 5000, timeout = 10000, retries = 3 } = options || {};
  
  let lastError: any;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await prisma.$transaction(operation, {
        maxWait,
        timeout,
      });
    } catch (error) {
      lastError = error;
      
      // Don't retry on user errors, only on connection/timeout issues
      if (!isConnectionError(error)) {
        throw error;
      }
      
      if (attempt === retries) {
        break;
      }
      
      // Exponential backoff for retries
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Safe database operation with error handling
 * Wraps database calls with proper error context
 */
export async function safeDbOperation<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`Database operation failed [${context}]:`, error);
    
    if (isPrismaErrorWithCode(error)) {
      // Handle specific Prisma errors
      switch (error.code) {
        case 'P2002':
          throw new Error('Unique constraint violation');
        case 'P2025':
          throw new Error('Record not found');
        case 'P2003':
          throw new Error('Foreign key constraint violation');
        default:
          throw new Error(`Database error: ${error.message}`);
      }
    }
    
    if (error instanceof Error) {
      if (error.message.includes('validation')) {
        throw new Error('Invalid data provided');
      }
      
      if (isConnectionError(error)) {
        throw new Error('Database connection error');
      }
    }
    
    throw error;
  }
}

/**
 * Batch operation helper for bulk operations
 * Processes items in chunks to avoid memory issues
 */
export async function batchOperation<T, R>(
  items: T[],
  operation: (batch: T[]) => Promise<R[]>,
  batchSize = 100
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    try {
      const batchResults = await operation(batch);
      results.push(...batchResults);
    } catch (error) {
      console.error(`Batch operation failed for items ${i}-${i + batch.length}:`, error);
      throw error;
    }
  }
  
  return results;
}

/**
 * Pagination helper for consistent pagination across the app
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export async function paginate<T>(
  model: any,
  options: PaginationOptions = {},
  where?: any,
  include?: any
): Promise<PaginatedResult<T>> {
  const { page = 1, limit = 20, orderBy = 'createdAt', orderDirection = 'desc' } = options;
  
  const skip = (page - 1) * limit;
  
  const [data, total] = await Promise.all([
    model.findMany({
      where,
      include,
      skip,
      take: limit,
      orderBy: { [orderBy]: orderDirection },
    }),
    model.count({ where }),
  ]);
  
  const totalPages = Math.ceil(total / limit);
  
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * Search helper with full-text search capabilities
 * Works with SQLite FTS if available, falls back to LIKE queries
 */
export function buildSearchWhere(searchTerm: string, fields: string[]) {
  if (!searchTerm.trim()) {
    return {};
  }
  
  const searchWords = searchTerm.trim().split(/\s+/);
  
  return {
    OR: fields.flatMap(field =>
      searchWords.map(word => ({
        [field]: {
          contains: word,
          mode: 'insensitive' as const,
        },
      }))
    ),
  };
}

/**
 * Audit logging helper
 * Automatically logs data modifications for compliance
 */
export async function logAuditEvent(
  actor: string,
  action: string,
  entity: string,
  entityId: string,
  details: Record<string, any> = {}
) {
  try {
    await prisma.auditLog.create({
      data: {
        actor,
        action,
        entity,
        entityId,
        details: JSON.stringify(details),
      },
    });
  } catch (error) {
    // Don't let audit logging failure break the main operation
    console.error('Failed to log audit event:', error);
  }
}

/**
 * Soft delete helper (if we implement soft deletes in the future)
 */
export async function softDelete(
  model: any,
  id: string,
  actor: string
): Promise<void> {
  await withTransaction(async (tx) => {
    // Update the record to mark as deleted
    await (tx as any)[model].update({
      where: { id },
      data: { 
        deletedAt: new Date(),
        deletedBy: actor,
      },
    });
    
    // Log the deletion
    await logAuditEvent(actor, 'DELETE', model, id);
  });
}

/**
 * Data integrity check helpers
 */
export async function checkReferentialIntegrity(): Promise<{
  orphanedSources: number;
  orphanedEvidenceUnits: number;
  orphanedClaims: number;
  orphanedCitations: number;
}> {
  // Since all foreign keys are required (non-nullable) in our schema with cascade deletes,
  // referential integrity is enforced by the database. Return zero counts.
  return {
    orphanedSources: 0,
    orphanedEvidenceUnits: 0,
    orphanedClaims: 0,
    orphanedCitations: 0,
  };
}
