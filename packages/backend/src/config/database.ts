import { PrismaClient } from '@prisma/client';
import { config, isDevelopment, isTest } from './env';

// Database configuration based on environment
const databaseConfig = {
  datasources: {
    db: {
      url: config.DATABASE_URL,
    },
  },
  log: isDevelopment ? ['query', 'info', 'warn', 'error'] : ['error'],
  errorFormat: isDevelopment ? 'pretty' : 'minimal',
} as const;

// Global prisma instance for development hot reloading
declare global {
  var __prisma: PrismaClient | undefined;
}

let prisma: PrismaClient;

if (isTest) {
  // Use a separate test database for testing
  prisma = new PrismaClient({
    ...databaseConfig,
    datasources: {
      db: {
        url: config.DATABASE_URL.replace('.db', '_test.db'),
      },
    },
  });
} else if (isDevelopment) {
  // In development, use global to avoid multiple instances during hot reload
  if (!global.__prisma) {
    global.__prisma = new PrismaClient(databaseConfig);
  }
  prisma = global.__prisma;
} else {
  // Production instance
  prisma = new PrismaClient(databaseConfig);
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export { prisma };

// Database connection helper with retry logic
export async function connectDatabase(retries = 3): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await prisma.$connect();
      console.log('✅ Database connected successfully');
      return;
    } catch (error) {
      console.error(`❌ Database connection attempt ${i + 1} failed:`, error);
      
      if (i === retries - 1) {
        console.error('❌ All database connection attempts failed');
        process.exit(1);
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}

// Database health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Transaction helper with retry logic
export async function withTransaction<T>(
  fn: (prisma: PrismaClient) => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await prisma.$transaction(fn);
    } catch (error: any) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Check if it's a retryable error (deadlock, timeout, etc.)
      if (error.code === 'P2034' || error.code === 'P2028') {
        console.warn(`Transaction attempt ${attempt} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        continue;
      }
      
      throw error;
    }
  }
  
  throw new Error('Transaction failed after all retries');
}
