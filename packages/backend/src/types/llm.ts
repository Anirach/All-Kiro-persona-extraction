/**
 * LLM Service Types and Interfaces
 * 
 * This module defines TypeScript interfaces for LLM integration,
 * specifically for evidence-based persona extraction with citation requirements.
 */

import type { EvidenceUnit } from '@prisma/client';

/**
 * Configuration for LLM service operations
 */
export interface LLMConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
  rateLimitRpm?: number;
  rateLimitTpm?: number;
}

/**
 * Request for persona extraction from evidence units
 */
export interface PersonaExtractionRequest {
  evidenceUnits: EvidenceUnit[];
  extractionType: 'full' | 'specific_field';
  fieldName?: string; // Required if extractionType is 'specific_field'
  constraints: {
    requireCitations: boolean;
    conflictHandling: 'flag' | 'choose_best' | 'synthesize';
    maxClaimLength?: number;
    minConfidenceThreshold?: number;
  };
  personaId?: string; // Optional persona ID for context
  projectId: string;
}

/**
 * Individual claim field extracted from evidence
 */
export interface ClaimField {
  fieldName: string;
  text: string;
  confidence: number;
  citations: CitationInfo[];
  conflictFlags?: ConflictFlag[];
  metadata?: Record<string, any>;
}

/**
 * Citation information linking claims to evidence
 */
export interface CitationInfo {
  sentenceIndex: number;
  evidenceUnitIds: string[];
  confidence: number;
  supportType: 'direct' | 'inferential' | 'contextual';
}

/**
 * Conflict detection information
 */
export interface ConflictFlag {
  type: 'contradiction' | 'ambiguity' | 'insufficient_evidence';
  description: string;
  conflictingEvidenceIds: string[];
  severity: 'low' | 'medium' | 'high';
}

/**
 * Complete response from persona extraction
 */
export interface PersonaExtractionResponse {
  success: boolean;
  claims: ClaimField[];
  metadata: {
    tokensUsed: number;
    processingTimeMs: number;
    evidenceUnitsProcessed: number;
    citationAccuracy?: number;
    overallConfidence: number;
  };
  errors?: LLMError[];
  warnings?: string[];
}

/**
 * Function calling schema for citation validation
 */
export interface CitationValidationFunction {
  name: 'validate_citations';
  description: 'Validate that all claims are properly cited with evidence IDs';
  parameters: {
    type: 'object';
    properties: {
      claims: {
        type: 'array';
        items: {
          type: 'object';
          properties: {
            text: { type: 'string' };
            citations: {
              type: 'array';
              items: {
                type: 'object';
                properties: {
                  sentence_index: { type: 'number' };
                  evidence_ids: {
                    type: 'array';
                    items: { type: 'string' };
                  };
                };
                required: ['sentence_index', 'evidence_ids'];
              };
            };
          };
          required: ['text', 'citations'];
        };
      };
    };
    required: ['claims'];
  };
}

/**
 * LLM service error types
 */
export interface LLMError {
  type: 'rate_limit' | 'timeout' | 'invalid_request' | 'service_unavailable' | 'validation_error';
  message: string;
  retryable: boolean;
  details?: Record<string, any>;
}

/**
 * Token usage and cost tracking
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number; // in USD
  model: string;
  timestamp: Date;
}

/**
 * Rate limiting state
 */
export interface RateLimitState {
  requestsPerMinute: number;
  tokensPerMinute: number;
  lastResetTime: Date;
  remainingRequests: number;
  remainingTokens: number;
}

/**
 * Prompt template configuration
 */
export interface PromptTemplate {
  systemPrompt: string;
  userPromptTemplate: string;
  exampleExtractions?: Array<{
    evidence: string;
    expectedOutput: ClaimField[];
  }>;
  constraints: string[];
  outputFormat: 'json' | 'structured_text';
}

/**
 * Evidence context for LLM processing
 */
export interface EvidenceContext {
  evidenceUnit: EvidenceUnit;
  sourceMetadata?: {
    title?: string;
    author?: string;
    publishedDate?: Date;
    sourceType?: string;
    reliability?: number;
  };
  processingMetadata: {
    qualityScore: number;
    topics: string[];
    relevanceScore?: number;
  };
}

/**
 * Batch processing request
 */
export interface BatchExtractionRequest {
  requests: PersonaExtractionRequest[];
  batchId: string;
  priority: 'high' | 'medium' | 'low';
  maxConcurrency?: number;
}

/**
 * Batch processing response
 */
export interface BatchExtractionResponse {
  batchId: string;
  results: PersonaExtractionResponse[];
  summary: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalTokensUsed: number;
    totalCost: number;
    processingTimeMs: number;
  };
  errors: LLMError[];
}

/**
 * Service health check response
 */
export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs: number;
  rateLimitStatus: RateLimitState;
  lastSuccessfulRequest?: Date;
  errorRate24h: number;
  uptime: number;
}

/**
 * Configuration for JSON mode responses
 */
export interface JSONModeConfig {
  enforceSchema: boolean;
  schema?: Record<string, any>;
  validateResponse: boolean;
  maxRetries: number;
}

/**
 * LLM service interface
 */
export interface ILLMService {
  extractPersona(request: PersonaExtractionRequest): Promise<PersonaExtractionResponse>;
  extractBatch(request: BatchExtractionRequest): Promise<BatchExtractionResponse>;
  validateCitations(claims: ClaimField[], evidenceUnits: EvidenceUnit[]): Promise<boolean>;
  getHealth(): Promise<ServiceHealth>;
  getUsageStats(): Promise<TokenUsage[]>;
}

/**
 * Custom error classes for LLM operations
 */
export class LLMServiceError extends Error {
  constructor(
    message: string,
    public readonly type: LLMError['type'],
    public readonly retryable: boolean = false,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'LLMServiceError';
  }
}

export class RateLimitError extends LLMServiceError {
  constructor(message: string, public readonly retryAfterMs: number) {
    super(message, 'rate_limit', true, { retryAfterMs });
    this.name = 'RateLimitError';
  }
}

export class ValidationError extends LLMServiceError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'validation_error', false, details);
    this.name = 'ValidationError';
  }
}