import { PrismaClient } from '@prisma/client';
import { config } from '../config/env';

declare global {
  // Prevent multiple instances during hot reload in development
  var __prisma: PrismaClient | undefined;
}

/**
 * Prisma Client singleton with proper configuration
 * Includes connection pooling, logging, and error handling
 */
export const prisma = globalThis.__prisma || new PrismaClient({
  log: config.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
  
  datasources: {
    db: {
      url: config.DATABASE_URL,
    },
  },
  
  // Error formatting for better debugging
  errorFormat: config.NODE_ENV === 'development' ? 'pretty' : 'minimal',
});

// Store in global for development hot reload
if (config.NODE_ENV === 'development') {
  globalThis.__prisma = prisma;
}

/**
 * Connect to database with retry logic
 */
export async function connectDatabase(): Promise<void> {
  const maxRetries = 3;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      await prisma.$connect();
      console.log('✅ Database connected successfully');
      return;
    } catch (error) {
      retries++;
      console.error(`❌ Database connection attempt ${retries} failed:`, error);
      
      if (retries >= maxRetries) {
        throw new Error(`Failed to connect to database after ${maxRetries} attempts`);
      }
      
      // Exponential backoff
      const delay = Math.pow(2, retries) * 1000;
      console.log(`⏱️ Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Gracefully disconnect from database
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    console.log('✅ Database disconnected successfully');
  } catch (error) {
    console.error('❌ Error disconnecting from database:', error);
  }
}

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(): Promise<{ status: 'healthy' | 'unhealthy'; latency?: number }> {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;
    
    return { status: 'healthy', latency };
  } catch (error) {
    console.error('Database health check failed:', error);
    return { status: 'unhealthy' };
  }
}

/**
 * Get database statistics for monitoring
 */
export async function getDatabaseStats() {
  try {
    const [
      projectCount,
      sourceCount,
      evidenceUnitCount,
      personaCount,
      claimCount,
    ] = await Promise.all([
      prisma.project.count(),
      prisma.source.count(),
      prisma.evidenceUnit.count(),
      prisma.persona.count(),
      prisma.claim.count(),
    ]);

    return {
      projects: projectCount,
      sources: sourceCount,
      evidenceUnits: evidenceUnitCount,
      personas: personaCount,
      claims: claimCount,
    };
  } catch (error) {
    console.error('Failed to get database stats:', error);
    return null;
  }
}

// Graceful shutdown handling
process.on('beforeExit', () => {
  disconnectDatabase();
});

process.on('SIGINT', () => {
  disconnectDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  disconnectDatabase();
  process.exit(0);
});
