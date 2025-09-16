import { PrismaClient, Prisma } from '@prisma/client';
import { Request } from 'express';
import { prisma } from '../lib/prisma.js';

/**
 * Audit action types
 */
export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  VIEW = 'VIEW',
  EXPORT = 'EXPORT',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  PROCESS = 'PROCESS',
  UPLOAD = 'UPLOAD'
}

/**
 * Resource types that can be audited
 */
export enum AuditResource {
  PROJECT = 'PROJECT',
  SOURCE = 'SOURCE',
  EVIDENCE_UNIT = 'EVIDENCE_UNIT',
  PERSONA = 'PERSONA',
  CLAIM = 'CLAIM',
  CLAIM_FIELD = 'CLAIM_FIELD',
  CITATION = 'CITATION',
  USER = 'USER',
  SYSTEM = 'SYSTEM'
}

/**
 * Audit log entry interface
 */
export interface AuditLogEntry {
  id?: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  changes?: Record<string, any>;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
  requestId?: string;
}

/**
 * PII detection patterns
 */
const PII_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,
  creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
  ipAddress: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g
};

/**
 * Fields that should never be logged (even with redaction)
 */
const SENSITIVE_FIELDS = new Set([
  'password',
  'token',
  'secret',
  'key',
  'apiKey',
  'accessToken',
  'refreshToken',
  'sessionToken',
  'privateKey',
  'certificate'
]);

/**
 * Redact PII from data before logging
 */
function redactPII(data: any): any {
  if (typeof data === 'string') {
    let redacted = data;
    Object.entries(PII_PATTERNS).forEach(([type, pattern]) => {
      redacted = redacted.replace(pattern, `[REDACTED_${type.toUpperCase()}]`);
    });
    return redacted;
  }

  if (Array.isArray(data)) {
    return data.map(item => redactPII(item));
  }

  if (data && typeof data === 'object') {
    const redacted: any = {};
    Object.entries(data).forEach(([key, value]) => {
      if (SENSITIVE_FIELDS.has(key.toLowerCase())) {
        redacted[key] = '[REDACTED_SENSITIVE]';
      } else {
        redacted[key] = redactPII(value);
      }
    });
    return redacted;
  }

  return data;
}

/**
 * Extract user context from request
 */
function extractUserContext(req: Request): {
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
} {
  return {
    userId: (req as any).user?.id || 'anonymous',
    sessionId: (req as any).session?.id || req.headers['x-session-id'] as string,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.get('User-Agent'),
    requestId: req.headers['x-request-id'] as string || `req_${Date.now()}`
  };
}

/**
 * Calculate changes between old and new data
 */
function calculateChanges(oldData: any, newData: any): Record<string, any> {
  const changes: Record<string, any> = {};

  if (!oldData && newData) {
    // Create operation
    return { created: redactPII(newData) };
  }

  if (oldData && !newData) {
    // Delete operation
    return { deleted: redactPII(oldData) };
  }

  if (oldData && newData) {
    // Update operation
    const oldRedacted = redactPII(oldData);
    const newRedacted = redactPII(newData);

    Object.keys(newRedacted).forEach(key => {
      if (JSON.stringify(oldRedacted[key]) !== JSON.stringify(newRedacted[key])) {
        changes[key] = {
          from: oldRedacted[key],
          to: newRedacted[key]
        };
      }
    });
  }

  return changes;
}

/**
 * Audit Service class
 */
export class AuditService {
  private static instance: AuditService;
  private prisma: PrismaClient;

  private constructor() {
    this.prisma = prisma;
  }

  public static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  /**
   * Log an audit event
   */
  async log(entry: Omit<AuditLogEntry, 'timestamp'>): Promise<void> {
    try {
      const auditEntry = {
        ...entry,
        timestamp: new Date(),
        metadata: entry.metadata ? redactPII(entry.metadata) : undefined,
        changes: entry.changes ? redactPII(entry.changes) : undefined
      };

      // Combine all metadata into details JSON
      const details = {
        metadata: auditEntry.metadata,
        changes: auditEntry.changes,
        success: auditEntry.success,
        errorMessage: auditEntry.errorMessage,
        requestId: auditEntry.requestId,
        sessionId: auditEntry.sessionId,
        ipAddress: auditEntry.ipAddress,
        userAgent: auditEntry.userAgent
      };

      await this.prisma.auditLog.create({
        data: {
          actor: auditEntry.userId || 'anonymous',
          action: auditEntry.action,
          entity: auditEntry.resource,
          entityId: auditEntry.resourceId,
          details: JSON.stringify(details),
          createdAt: auditEntry.timestamp
        }
      });
    } catch (error) {
      // Never let audit logging break the main operation
      console.error('Failed to log audit entry:', error);
    }
  }

  /**
   * Log a successful operation
   */
  async logSuccess(
    req: Request,
    action: AuditAction,
    resource: AuditResource,
    resourceId: string,
    metadata?: Record<string, any>,
    oldData?: any,
    newData?: any
  ): Promise<void> {
    const userContext = extractUserContext(req);
    const changes = oldData || newData ? calculateChanges(oldData, newData) : undefined;

    await this.log({
      action,
      resource,
      resourceId,
      ...userContext,
      metadata,
      changes,
      success: true
    });
  }

  /**
   * Log a failed operation
   */
  async logFailure(
    req: Request,
    action: AuditAction,
    resource: AuditResource,
    resourceId: string,
    error: Error,
    metadata?: Record<string, any>
  ): Promise<void> {
    const userContext = extractUserContext(req);

    await this.log({
      action,
      resource,
      resourceId,
      ...userContext,
      metadata,
      success: false,
      errorMessage: error.message
    });
  }

  /**
   * Log data creation
   */
  async logCreate(
    req: Request,
    resource: AuditResource,
    resourceId: string,
    data: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logSuccess(req, AuditAction.CREATE, resource, resourceId, metadata, null, data);
  }

  /**
   * Log data update
   */
  async logUpdate(
    req: Request,
    resource: AuditResource,
    resourceId: string,
    oldData: any,
    newData: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logSuccess(req, AuditAction.UPDATE, resource, resourceId, metadata, oldData, newData);
  }

  /**
   * Log data deletion
   */
  async logDelete(
    req: Request,
    resource: AuditResource,
    resourceId: string,
    deletedData: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logSuccess(req, AuditAction.DELETE, resource, resourceId, metadata, deletedData, null);
  }

  /**
   * Log data access/view
   */
  async logView(
    req: Request,
    resource: AuditResource,
    resourceId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logSuccess(req, AuditAction.VIEW, resource, resourceId, metadata);
  }

  /**
   * Log file upload
   */
  async logUpload(
    req: Request,
    resourceId: string,
    fileName: string,
    fileSize: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    const uploadMetadata = {
      ...metadata,
      fileName: redactPII(fileName),
      fileSize,
      uploadTime: new Date().toISOString()
    };

    await this.logSuccess(req, AuditAction.UPLOAD, AuditResource.SOURCE, resourceId, uploadMetadata);
  }

  /**
   * Log approval/rejection actions
   */
  async logApproval(
    req: Request,
    resource: AuditResource,
    resourceId: string,
    approved: boolean,
    reason?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const action = approved ? AuditAction.APPROVE : AuditAction.REJECT;
    const approvalMetadata = {
      ...metadata,
      reason: reason ? redactPII(reason) : undefined,
      timestamp: new Date().toISOString()
    };

    await this.logSuccess(req, action, resource, resourceId, approvalMetadata);
  }

  /**
   * Log data export
   */
  async logExport(
    req: Request,
    resource: AuditResource,
    resourceIds: string[],
    exportFormat: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const exportMetadata = {
      ...metadata,
      exportFormat,
      resourceCount: resourceIds.length,
      timestamp: new Date().toISOString()
    };

    // Log export for the batch (use first resource ID as representative)
    await this.logSuccess(
      req,
      AuditAction.EXPORT,
      resource,
      resourceIds[0] || 'batch',
      exportMetadata
    );
  }

  /**
   * Get audit trail for a specific resource
   */
  async getResourceAuditTrail(
    resourceType: AuditResource,
    resourceId: string,
    options?: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
      action?: AuditAction;
    }
  ): Promise<any[]> {
    const where: any = {
      entity: resourceType,
      entityId: resourceId
    };

    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    if (options?.action) {
      where.action = options.action;
    }

    return await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 100,
      skip: options?.offset || 0
    });
  }

  /**
   * Get audit statistics
   */
  async getAuditStats(options?: {
    startDate?: Date;
    endDate?: Date;
    resource?: AuditResource;
  }): Promise<{
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    actionBreakdown: Record<string, number>;
    resourceBreakdown: Record<string, number>;
  }> {
    const where: any = {};

    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    if (options?.resource) {
      where.entity = options.resource;
    }

    const [total, successful, actionStats, entityStats] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      // Since success is stored in details, we'll skip this complex query for now
      Promise.resolve(0), 
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: { action: true }
      }),
      this.prisma.auditLog.groupBy({
        by: ['entity'],
        where,
        _count: { entity: true }
      })
    ]);

    return {
      totalEvents: total,
      successfulEvents: successful,
      failedEvents: total - successful,
      actionBreakdown: actionStats.reduce((acc, stat) => {
        acc[stat.action] = stat._count.action || 0;
        return acc;
      }, {} as Record<string, number>),
      resourceBreakdown: entityStats.reduce((acc, stat) => {
        acc[stat.entity] = stat._count.entity || 0;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  /**
   * Clean up old audit logs (for compliance and storage management)
   */
  async cleanupOldLogs(olderThanDays: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    });

    console.log(`Cleaned up ${result.count} audit log entries older than ${olderThanDays} days`);
    return result.count;
  }
}

// Export singleton instance
export const auditService = AuditService.getInstance();