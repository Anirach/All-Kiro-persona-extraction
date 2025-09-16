import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { auditService } from '../services/AuditService.js';

/**
 * Health check status levels
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy'
}

/**
 * Individual service check result
 */
interface ServiceCheck {
  name: string;
  status: HealthStatus;
  responseTime: number;
  lastChecked: string;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Overall health check response
 */
interface HealthCheckResponse {
  status: HealthStatus;
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  checks: ServiceCheck[];
  system: {
    memory: NodeJS.MemoryUsage;
    cpu: NodeJS.CpuUsage;
    loadAverage: number[];
  };
}

/**
 * Database connectivity check
 */
async function checkDatabase(): Promise<ServiceCheck> {
  const startTime = process.hrtime();
  const name = 'database';
  
  try {
    // Simple query to check connectivity
    await prisma.$queryRaw`SELECT 1 as test`;
    
    // Check if we can perform basic operations
    const projectCount = await prisma.project.count();
    
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const responseTime = seconds * 1000 + nanoseconds / 1000000;
    
    return {
      name,
      status: HealthStatus.HEALTHY,
      responseTime,
      lastChecked: new Date().toISOString(),
      metadata: {
        projectCount,
        databaseUrl: config.DATABASE_URL ? 'configured' : 'missing'
      }
    };
  } catch (error) {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const responseTime = seconds * 1000 + nanoseconds / 1000000;
    
    return {
      name,
      status: HealthStatus.UNHEALTHY,
      responseTime,
      lastChecked: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * OpenAI service connectivity check
 */
async function checkOpenAI(): Promise<ServiceCheck> {
  const startTime = process.hrtime();
  const name = 'openai';
  
  try {
    // Check if OpenAI API key is configured
    if (!config.OPENAI_API_KEY) {
      return {
        name,
        status: HealthStatus.DEGRADED,
        responseTime: 0,
        lastChecked: new Date().toISOString(),
        error: 'OpenAI API key not configured',
        metadata: {
          configured: false
        }
      };
    }

    // Simple check - we can't really ping OpenAI without making a billable request
    // So we just verify the key format and configuration
    const keyValid = config.OPENAI_API_KEY.startsWith('sk-');
    
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const responseTime = seconds * 1000 + nanoseconds / 1000000;
    
    return {
      name,
      status: keyValid ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
      responseTime,
      lastChecked: new Date().toISOString(),
      metadata: {
        configured: true,
        keyFormat: keyValid ? 'valid' : 'invalid'
      }
    };
  } catch (error) {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const responseTime = seconds * 1000 + nanoseconds / 1000000;
    
    return {
      name,
      status: HealthStatus.UNHEALTHY,
      responseTime,
      lastChecked: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * File system check
 */
async function checkFileSystem(): Promise<ServiceCheck> {
  const startTime = process.hrtime();
  const name = 'filesystem';
  
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // Try to create a temporary file
    const tempDir = process.env.TEMP_DIR || '/tmp';
    const testFile = path.join(tempDir, `health-check-${Date.now()}.tmp`);
    
    await fs.writeFile(testFile, 'health check test');
    await fs.readFile(testFile, 'utf8');
    await fs.unlink(testFile);
    
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const responseTime = seconds * 1000 + nanoseconds / 1000000;
    
    return {
      name,
      status: HealthStatus.HEALTHY,
      responseTime,
      lastChecked: new Date().toISOString(),
      metadata: {
        tempDir,
        writable: true
      }
    };
  } catch (error) {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const responseTime = seconds * 1000 + nanoseconds / 1000000;
    
    return {
      name,
      status: HealthStatus.DEGRADED,
      responseTime,
      lastChecked: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Memory usage check
 */
function checkMemoryUsage(): ServiceCheck {
  const startTime = process.hrtime();
  const name = 'memory';
  
  try {
    const usage = process.memoryUsage();
    const totalMemory = usage.heapTotal + usage.external;
    const usedMemory = usage.heapUsed;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;
    
    let status = HealthStatus.HEALTHY;
    if (memoryUsagePercent > 90) {
      status = HealthStatus.UNHEALTHY;
    } else if (memoryUsagePercent > 75) {
      status = HealthStatus.DEGRADED;
    }
    
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const responseTime = seconds * 1000 + nanoseconds / 1000000;
    
    return {
      name,
      status,
      responseTime,
      lastChecked: new Date().toISOString(),
      metadata: {
        usage: usage,
        usagePercent: memoryUsagePercent,
        threshold: status === HealthStatus.UNHEALTHY ? 90 : 75
      }
    };
  } catch (error) {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const responseTime = seconds * 1000 + nanoseconds / 1000000;
    
    return {
      name,
      status: HealthStatus.UNHEALTHY,
      responseTime,
      lastChecked: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Audit service check
 */
async function checkAuditService(): Promise<ServiceCheck> {
  const startTime = process.hrtime();
  const name = 'audit';
  
  try {
    // Try to get audit statistics to verify the service is working
    await auditService.getAuditStats();
    
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const responseTime = seconds * 1000 + nanoseconds / 1000000;
    
    return {
      name,
      status: HealthStatus.HEALTHY,
      responseTime,
      lastChecked: new Date().toISOString(),
      metadata: {
        configured: true
      }
    };
  } catch (error) {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const responseTime = seconds * 1000 + nanoseconds / 1000000;
    
    return {
      name,
      status: HealthStatus.DEGRADED,
      responseTime,
      lastChecked: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Determine overall system health based on individual checks
 */
function calculateOverallHealth(checks: ServiceCheck[]): HealthStatus {
  const healthyCount = checks.filter(check => check.status === HealthStatus.HEALTHY).length;
  const degradedCount = checks.filter(check => check.status === HealthStatus.DEGRADED).length;
  const unhealthyCount = checks.filter(check => check.status === HealthStatus.UNHEALTHY).length;
  
  // If any critical service is unhealthy, system is unhealthy
  const criticalServices = ['database'];
  const criticalUnhealthy = checks.some(check => 
    criticalServices.includes(check.name) && check.status === HealthStatus.UNHEALTHY
  );
  
  if (criticalUnhealthy || unhealthyCount >= checks.length / 2) {
    return HealthStatus.UNHEALTHY;
  }
  
  if (degradedCount > 0 || unhealthyCount > 0) {
    return HealthStatus.DEGRADED;
  }
  
  return HealthStatus.HEALTHY;
}

/**
 * Basic health check endpoint (minimal)
 */
export const basicHealthCheck = (req: Request, res: Response): void => {
  const startTime = Date.now();
  
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: config.NODE_ENV,
    responseTime: Date.now() - startTime
  });
};

/**
 * Detailed health check endpoint
 */
export const detailedHealthCheck = async (req: Request, res: Response): Promise<void> => {
  const startTime = process.hrtime();
  
  try {
    // Run all health checks in parallel
    const checks = await Promise.all([
      checkDatabase(),
      checkOpenAI(),
      checkFileSystem(),
      Promise.resolve(checkMemoryUsage()),
      checkAuditService()
    ]);
    
    const overallStatus = calculateOverallHealth(checks);
    
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const totalResponseTime = seconds * 1000 + nanoseconds / 1000000;
    
    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: config.NODE_ENV,
      uptime: process.uptime(),
      checks,
      system: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        loadAverage: process.platform === 'win32' ? [] : require('os').loadavg()
      }
    };
    
    // Set appropriate HTTP status code
    let statusCode = 200;
    if (overallStatus === HealthStatus.DEGRADED) {
      statusCode = 200; // Still operational
    } else if (overallStatus === HealthStatus.UNHEALTHY) {
      statusCode = 503; // Service Unavailable
    }
    
    // Log health check execution
    logger.info('Health check completed', {
      status: overallStatus,
      responseTime: totalResponseTime,
      checksCount: checks.length,
      failedChecks: checks.filter(c => c.status === HealthStatus.UNHEALTHY).length
    });
    
    res.status(statusCode).json(response);
  } catch (error) {
    logger.error('Health check failed', error);
    
    res.status(500).json({
      status: HealthStatus.UNHEALTHY,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      version: process.env.npm_package_version || '1.0.0',
      environment: config.NODE_ENV
    });
  }
};

/**
 * Readiness probe (for Kubernetes/Docker)
 */
export const readinessCheck = async (req: Request, res: Response): Promise<void> => {
  try {
    // Only check critical services for readiness
    const dbCheck = await checkDatabase();
    
    if (dbCheck.status === HealthStatus.UNHEALTHY) {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        checks: [dbCheck]
      });
      return;
    }
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: [dbCheck]
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Liveness probe (for Kubernetes/Docker)
 */
export const livenessCheck = (req: Request, res: Response): void => {
  // Simple check to verify the process is alive and responsive
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    pid: process.pid
  });
};