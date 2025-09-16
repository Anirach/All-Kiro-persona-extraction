import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env.js';

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5
}

/**
 * Log entry interface
 */
interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  service: string;
  version: string;
  environment: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  duration?: number;
  statusCode?: number;
  method?: string;
  path?: string;
  ip?: string;
  userAgent?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  performance?: {
    memoryUsage?: NodeJS.MemoryUsage;
    cpuUsage?: NodeJS.CpuUsage;
    uptime?: number;
  };
  metadata?: Record<string, any>;
}

/**
 * PII patterns for redaction in logs
 */
const PII_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
  phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,
  creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
  ipAddress: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
  jwt: /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g,
  apiKey: /[Aa][Pp][Ii]_?[Kk][Ee][Yy]\s*[:=]\s*[A-Za-z0-9-_]{20,}/g
};

/**
 * Sensitive fields that should never be logged
 */
const SENSITIVE_FIELDS = new Set([
  'password', 'token', 'secret', 'key', 'apiKey', 'accessToken',
  'refreshToken', 'sessionToken', 'privateKey', 'certificate',
  'authorization', 'cookie', 'x-api-key'
]);

/**
 * Redact PII from text and objects
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
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_FIELDS.has(lowerKey) || lowerKey.includes('password') || lowerKey.includes('secret')) {
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
 * Performance metrics collector
 */
class PerformanceCollector {
  private requestStartTimes = new Map<string, [number, number]>();
  private cpuUsageStart: NodeJS.CpuUsage | null = null;

  startRequest(requestId: string): void {
    this.requestStartTimes.set(requestId, process.hrtime());
    this.cpuUsageStart = process.cpuUsage();
  }

  endRequest(requestId: string): {
    duration: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage?: NodeJS.CpuUsage;
    uptime: number;
  } {
    const startTime = this.requestStartTimes.get(requestId);
    const duration = startTime ? this.getElapsedTime(startTime) : 0;
    
    this.requestStartTimes.delete(requestId);

    const memoryUsage = process.memoryUsage();
    const cpuUsage = this.cpuUsageStart ? process.cpuUsage(this.cpuUsageStart) : undefined;
    const uptime = process.uptime();

    return {
      duration,
      memoryUsage,
      cpuUsage,
      uptime
    };
  }

  private getElapsedTime(startTime: [number, number]): number {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    return seconds * 1000 + nanoseconds / 1000000; // Convert to milliseconds
  }
}

/**
 * Logger class
 */
export class Logger {
  private static instance: Logger;
  private performanceCollector = new PerformanceCollector();
  private minLogLevel: LogLevel;
  private serviceName: string;
  private version: string;
  private environment: string;

  private constructor() {
    this.minLogLevel = this.getLogLevelFromEnv();
    this.serviceName = 'persona-extraction-api';
    this.version = process.env.npm_package_version || '1.0.0';
    this.environment = config.NODE_ENV;
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private getLogLevelFromEnv(): LogLevel {
    const level = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    return LogLevel[level as keyof typeof LogLevel] ?? LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLogLevel;
  }

  private createBaseEntry(level: LogLevel, message: string): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message: redactPII(message),
      service: this.serviceName,
      version: this.version,
      environment: this.environment
    };
  }

  private formatEntry(entry: LogEntry): string {
    if (config.NODE_ENV === 'development') {
      // Human-readable format for development
      const time = new Date(entry.timestamp).toLocaleTimeString();
      const level = entry.level.padEnd(5);
      const request = entry.requestId ? ` [${entry.requestId}]` : '';
      const duration = entry.duration ? ` (${entry.duration.toFixed(2)}ms)` : '';
      return `${time} ${level}${request} ${entry.message}${duration}`;
    } else {
      // JSON format for production
      return JSON.stringify(entry);
    }
  }

  private writeLog(entry: LogEntry): void {
    const formatted = this.formatEntry(entry);
    
    if (entry.level === 'ERROR' || entry.level === 'FATAL') {
      console.error(formatted);
    } else if (entry.level === 'WARN') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  // Core logging methods
  trace(message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.TRACE)) return;
    const entry = this.createBaseEntry(LogLevel.TRACE, message);
    if (metadata) entry.metadata = redactPII(metadata);
    this.writeLog(entry);
  }

  debug(message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    const entry = this.createBaseEntry(LogLevel.DEBUG, message);
    if (metadata) entry.metadata = redactPII(metadata);
    this.writeLog(entry);
  }

  info(message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    const entry = this.createBaseEntry(LogLevel.INFO, message);
    if (metadata) entry.metadata = redactPII(metadata);
    this.writeLog(entry);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    const entry = this.createBaseEntry(LogLevel.WARN, message);
    if (metadata) entry.metadata = redactPII(metadata);
    this.writeLog(entry);
  }

  error(message: string, error?: Error | any, metadata?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    const entry = this.createBaseEntry(LogLevel.ERROR, message);
    
    if (error) {
      if (error instanceof Error) {
        entry.error = {
          name: error.name,
          message: redactPII(error.message),
          stack: config.NODE_ENV === 'development' ? error.stack : undefined,
          code: (error as any).code
        };
      } else {
        entry.error = {
          name: 'UnknownError',
          message: redactPII(String(error))
        };
      }
    }
    
    if (metadata) entry.metadata = redactPII(metadata);
    this.writeLog(entry);
  }

  fatal(message: string, error?: Error | any, metadata?: Record<string, any>): void {
    const entry = this.createBaseEntry(LogLevel.FATAL, message);
    
    if (error) {
      if (error instanceof Error) {
        entry.error = {
          name: error.name,
          message: redactPII(error.message),
          stack: error.stack,
          code: (error as any).code
        };
      } else {
        entry.error = {
          name: 'UnknownError',
          message: redactPII(String(error))
        };
      }
    }
    
    if (metadata) entry.metadata = redactPII(metadata);
    this.writeLog(entry);
  }

  // HTTP request logging
  logRequest(req: Request, context?: Record<string, any>): void {
    const requestId = this.getRequestId(req);
    this.performanceCollector.startRequest(requestId);

    const entry = this.createBaseEntry(LogLevel.INFO, 'HTTP Request');
    entry.requestId = requestId;
    entry.method = req.method;
    entry.path = req.path;
    entry.ip = req.ip;
    entry.userAgent = req.get('User-Agent');
    entry.userId = (req as any).user?.id;
    entry.sessionId = (req as any).session?.id || req.headers['x-session-id'] as string;
    
    if (context) entry.metadata = redactPII(context);
    
    this.writeLog(entry);
  }

  logResponse(req: Request, res: Response, context?: Record<string, any>): void {
    const requestId = this.getRequestId(req);
    const performance = this.performanceCollector.endRequest(requestId);

    const entry = this.createBaseEntry(LogLevel.INFO, 'HTTP Response');
    entry.requestId = requestId;
    entry.method = req.method;
    entry.path = req.path;
    entry.statusCode = res.statusCode;
    entry.duration = performance.duration;
    entry.performance = performance;
    
    if (context) entry.metadata = redactPII(context);
    
    this.writeLog(entry);
  }

  // Performance logging
  logPerformance(operation: string, duration: number, metadata?: Record<string, any>): void {
    const entry = this.createBaseEntry(LogLevel.INFO, `Performance: ${operation}`);
    entry.duration = duration;
    entry.performance = {
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
    
    if (metadata) entry.metadata = redactPII(metadata);
    this.writeLog(entry);
  }

  // Business event logging
  logBusinessEvent(event: string, metadata?: Record<string, any>): void {
    const entry = this.createBaseEntry(LogLevel.INFO, `Business Event: ${event}`);
    if (metadata) entry.metadata = redactPII(metadata);
    this.writeLog(entry);
  }

  // Security event logging
  logSecurityEvent(event: string, req?: Request, metadata?: Record<string, any>): void {
    const entry = this.createBaseEntry(LogLevel.WARN, `Security Event: ${event}`);
    
    if (req) {
      entry.requestId = this.getRequestId(req);
      entry.method = req.method;
      entry.path = req.path;
      entry.ip = req.ip;
      entry.userAgent = req.get('User-Agent');
    }
    
    if (metadata) entry.metadata = redactPII(metadata);
    this.writeLog(entry);
  }

  private getRequestId(req: Request): string {
    return req.headers['x-request-id'] as string || 
           (req as any).requestId || 
           `req_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

/**
 * Express middleware for request logging
 */
export const requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Generate request ID if not present
  if (!req.headers['x-request-id']) {
    req.headers['x-request-id'] = `req_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  // Log incoming request
  logger.logRequest(req);

  // Capture response finish event
  const originalSend = res.send;
  res.send = function(data?: any) {
    logger.logResponse(req, res);
    return originalSend.call(this, data);
  };

  const originalJson = res.json;
  res.json = function(data?: any) {
    logger.logResponse(req, res);
    return originalJson.call(this, data);
  };

  next();
};

/**
 * Performance timing decorator
 */
export function timed(operation: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = process.hrtime();
      
      try {
        const result = await method.apply(this, args);
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const duration = seconds * 1000 + nanoseconds / 1000000;
        
        logger.logPerformance(`${operation}.${propertyName}`, duration, {
          success: true,
          arguments: args.length
        });
        
        return result;
      } catch (error) {
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const duration = seconds * 1000 + nanoseconds / 1000000;
        
        logger.logPerformance(`${operation}.${propertyName}`, duration, {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          arguments: args.length
        });
        
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Log configuration on startup
 */
export function logStartup(): void {
  logger.info('Application starting', {
    service: 'persona-extraction-api',
    version: process.env.npm_package_version || '1.0.0',
    environment: config.NODE_ENV,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
}