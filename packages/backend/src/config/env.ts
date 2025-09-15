import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform((val: string) => parseInt(val, 10)).default('3001'),
  DATABASE_URL: z.string().default('file:./dev.db'),
  OPENAI_API_KEY: z.string().optional(),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  CORS_ORIGIN: z.string().optional(),
  
  // Security
  JWT_SECRET: z.string().min(32).optional(),
  ENCRYPTION_KEY: z.string().length(32).optional(),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform((val: string) => parseInt(val, 10)).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform((val: string) => parseInt(val, 10)).default('100'),
  
  // File Upload
  MAX_FILE_SIZE: z.string().transform((val: string) => parseInt(val, 10)).default('10485760'),
  UPLOAD_DIR: z.string().default('./uploads'),
  
  // Evidence Processing
  MAX_EVIDENCE_UNITS_PER_SOURCE: z.string().transform((val: string) => parseInt(val, 10)).default('1000'),
  QUALITY_SCORE_THRESHOLD: z.string().transform((val: string) => parseFloat(val)).default('0.4'),
  
  // LLM Configuration
  LLM_PROVIDER: z.enum(['openai', 'anthropic', 'local']).default('openai'),
  LLM_MODEL: z.string().default('gpt-4'),
  LLM_TEMPERATURE: z.string().transform((val: string) => parseFloat(val)).default('0.1'),
  LLM_MAX_TOKENS: z.string().transform((val: string) => parseInt(val, 10)).default('4000'),
  LLM_TIMEOUT_MS: z.string().transform((val: string) => parseInt(val, 10)).default('30000'),
  
  // Confidence Scoring Weights
  CONFIDENCE_WEIGHT_AGREEMENT: z.string().transform((val: string) => parseFloat(val)).default('0.4'),
  CONFIDENCE_WEIGHT_COUNT: z.string().transform((val: string) => parseFloat(val)).default('0.3'),
  CONFIDENCE_WEIGHT_QUALITY: z.string().transform((val: string) => parseFloat(val)).default('0.2'),
  CONFIDENCE_WEIGHT_RECENCY: z.string().transform((val: string) => parseFloat(val)).default('0.1'),
  
  // Quality Scoring Weights
  QUALITY_WEIGHT_AUTHORITY: z.string().transform((val: string) => parseFloat(val)).default('0.3'),
  QUALITY_WEIGHT_CONTENT: z.string().transform((val: string) => parseFloat(val)).default('0.25'),
  QUALITY_WEIGHT_RECENCY: z.string().transform((val: string) => parseFloat(val)).default('0.2'),
  QUALITY_WEIGHT_CORROBORATION: z.string().transform((val: string) => parseFloat(val)).default('0.15'),
  QUALITY_WEIGHT_RELEVANCE: z.string().transform((val: string) => parseFloat(val)).default('0.1'),
});

type EnvConfig = z.infer<typeof envSchema>;

function validateEnv(): EnvConfig {
  try {
    return envSchema.parse({
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      DATABASE_URL: process.env.DATABASE_URL,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      FRONTEND_URL: process.env.FRONTEND_URL,
      LOG_LEVEL: process.env.LOG_LEVEL,
      CORS_ORIGIN: process.env.CORS_ORIGIN,
      JWT_SECRET: process.env.JWT_SECRET,
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
      RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
      RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS,
      MAX_FILE_SIZE: process.env.MAX_FILE_SIZE,
      UPLOAD_DIR: process.env.UPLOAD_DIR,
      MAX_EVIDENCE_UNITS_PER_SOURCE: process.env.MAX_EVIDENCE_UNITS_PER_SOURCE,
      QUALITY_SCORE_THRESHOLD: process.env.QUALITY_SCORE_THRESHOLD,
      LLM_PROVIDER: process.env.LLM_PROVIDER,
      LLM_MODEL: process.env.LLM_MODEL,
      LLM_TEMPERATURE: process.env.LLM_TEMPERATURE,
      LLM_MAX_TOKENS: process.env.LLM_MAX_TOKENS,
      LLM_TIMEOUT_MS: process.env.LLM_TIMEOUT_MS,
      CONFIDENCE_WEIGHT_AGREEMENT: process.env.CONFIDENCE_WEIGHT_AGREEMENT,
      CONFIDENCE_WEIGHT_COUNT: process.env.CONFIDENCE_WEIGHT_COUNT,
      CONFIDENCE_WEIGHT_QUALITY: process.env.CONFIDENCE_WEIGHT_QUALITY,
      CONFIDENCE_WEIGHT_RECENCY: process.env.CONFIDENCE_WEIGHT_RECENCY,
      QUALITY_WEIGHT_AUTHORITY: process.env.QUALITY_WEIGHT_AUTHORITY,
      QUALITY_WEIGHT_CONTENT: process.env.QUALITY_WEIGHT_CONTENT,
      QUALITY_WEIGHT_RECENCY: process.env.QUALITY_WEIGHT_RECENCY,
      QUALITY_WEIGHT_CORROBORATION: process.env.QUALITY_WEIGHT_CORROBORATION,
      QUALITY_WEIGHT_RELEVANCE: process.env.QUALITY_WEIGHT_RELEVANCE,
    });
  } catch (error) {
    console.error('❌ Invalid environment configuration:');
    if (error instanceof z.ZodError) {
      error.errors.forEach((err: z.ZodIssue) => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
    }
    process.exit(1);
  }
}

// Validate weights sum to 1.0 for confidence and quality scoring
function validateWeights(config: EnvConfig): void {
  const confidenceSum = 
    config.CONFIDENCE_WEIGHT_AGREEMENT +
    config.CONFIDENCE_WEIGHT_COUNT +
    config.CONFIDENCE_WEIGHT_QUALITY +
    config.CONFIDENCE_WEIGHT_RECENCY;
    
  const qualitySum = 
    config.QUALITY_WEIGHT_AUTHORITY +
    config.QUALITY_WEIGHT_CONTENT +
    config.QUALITY_WEIGHT_RECENCY +
    config.QUALITY_WEIGHT_CORROBORATION +
    config.QUALITY_WEIGHT_RELEVANCE;
    
  if (Math.abs(confidenceSum - 1.0) > 0.01) {
    console.warn(`⚠️  Confidence weights sum to ${confidenceSum}, expected 1.0`);
  }
  
  if (Math.abs(qualitySum - 1.0) > 0.01) {
    console.warn(`⚠️  Quality weights sum to ${qualitySum}, expected 1.0`);
  }
}

export const config = validateEnv();
validateWeights(config);

export const isDevelopment = config.NODE_ENV === 'development';
export const isProduction = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';

// Environment-specific configurations
export const dbConfig = {
  url: config.DATABASE_URL,
  // Add connection pooling for production
  ...(isProduction && {
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000,
  }),
};



export const confidenceWeights = {
  agreement: config.CONFIDENCE_WEIGHT_AGREEMENT,
  count: config.CONFIDENCE_WEIGHT_COUNT,
  quality: config.CONFIDENCE_WEIGHT_QUALITY,
  recency: config.CONFIDENCE_WEIGHT_RECENCY,
};

export const qualityWeights = {
  authority: config.QUALITY_WEIGHT_AUTHORITY,
  content: config.QUALITY_WEIGHT_CONTENT,
  recency: config.QUALITY_WEIGHT_RECENCY,
  corroboration: config.QUALITY_WEIGHT_CORROBORATION,
  relevance: config.QUALITY_WEIGHT_RELEVANCE,
};

// Environment-specific configurations
export const corsConfig = {
  origin: isProduction 
    ? config.FRONTEND_URL 
    : [config.FRONTEND_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
};

export const rateLimitConfig = {
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  message: {
    error: 'Too many requests',
    message: 'You have exceeded the rate limit. Please try again later.',
    retryAfter: Math.ceil(config.RATE_LIMIT_WINDOW_MS / 1000),
  },
};

export const llmConfig = {
  provider: config.LLM_PROVIDER,
  model: config.LLM_MODEL,
  temperature: config.LLM_TEMPERATURE,
  maxTokens: config.LLM_MAX_TOKENS,
  timeout: config.LLM_TIMEOUT_MS,
  apiKey: config.OPENAI_API_KEY,
};

export const evidenceConfig = {
  maxUnitsPerSource: config.MAX_EVIDENCE_UNITS_PER_SOURCE,
  qualityThreshold: config.QUALITY_SCORE_THRESHOLD,
  confidenceWeights,
  qualityWeights,
};
