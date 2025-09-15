/**
 * Environment configuration with validation
 */

// Validate required environment variables
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

function optionalNumberEnv(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a valid number`);
  }
  return parsed;
}

function optionalFloatEnv(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a valid number`);
  }
  return parsed;
}

export const config = {
  // Application
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  port: optionalNumberEnv('PORT', 3000),
  
  // Database
  database: {
    url: requireEnv('DATABASE_URL'),
  },

  // OpenAI Configuration
  openai: {
    apiKey: requireEnv('OPENAI_API_KEY'),
    model: optionalEnv('OPENAI_MODEL', 'gpt-4'),
    maxTokens: optionalNumberEnv('OPENAI_MAX_TOKENS', 2000),
    temperature: optionalFloatEnv('OPENAI_TEMPERATURE', 0.1),
    rateLimitRpm: optionalNumberEnv('OPENAI_RATE_LIMIT_RPM', 60),
  },

  // Search Provider Configuration
  search: {
    provider: optionalEnv('SEARCH_PROVIDER', 'google') as 'google' | 'bing' | 'duckduckgo',
    google: {
      apiKey: process.env.GOOGLE_SEARCH_API_KEY,
      engineId: process.env.GOOGLE_SEARCH_ENGINE_ID,
    },
    rateLimitQpm: optionalNumberEnv('SEARCH_RATE_LIMIT_QPM', 100),
  },

  // Security
  auth: {
    jwtSecret: requireEnv('JWT_SECRET'),
    jwtExpiresIn: optionalEnv('JWT_EXPIRES_IN', '24h'),
  },

  // Feature Flags
  features: {
    vectorSearch: optionalEnv('ENABLE_VECTOR_SEARCH', 'false') === 'true',
    auditLogging: optionalEnv('ENABLE_AUDIT_LOGGING', 'true') === 'true',
  },

  // File Storage
  storage: {
    uploadsDir: optionalEnv('UPLOADS_DIR', './uploads'),
    exportsDir: optionalEnv('EXPORTS_DIR', './exports'),
    maxFileSize: optionalNumberEnv('MAX_FILE_SIZE_MB', 10) * 1024 * 1024, // Convert to bytes
  },
} as const;

// Validate configuration on startup
export function validateConfig(): void {
  // Validate search provider configuration
  if (config.search.provider === 'google') {
    if (!config.search.google.apiKey || !config.search.google.engineId) {
      throw new Error('Google Search requires GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID');
    }
  }

  // Validate OpenAI model
  const validModels = ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4o'];
  if (!validModels.includes(config.openai.model)) {
    console.warn(`Warning: OpenAI model "${config.openai.model}" may not be supported`);
  }

  // Validate temperature range
  if (config.openai.temperature < 0 || config.openai.temperature > 2) {
    throw new Error('OPENAI_TEMPERATURE must be between 0 and 2');
  }

  // Validate token limits
  if (config.openai.maxTokens < 100 || config.openai.maxTokens > 4096) {
    throw new Error('OPENAI_MAX_TOKENS must be between 100 and 4096');
  }

  console.log('✅ Configuration validated successfully');
}

// Development helpers
export const isDevelopment = config.nodeEnv === 'development';
export const isProduction = config.nodeEnv === 'production';
export const isTest = config.nodeEnv === 'test';

// Export types for type safety
export type Config = typeof config;
export type SearchProvider = typeof config.search.provider;
