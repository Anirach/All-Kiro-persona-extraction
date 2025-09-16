/**
 * OpenAI Service Implementation
 * 
 * Implements LLM service with evidence-only constraints, citation enforcement,
 * retry logic, rate limiting, and comprehensive error handling.
 */

import OpenAI from 'openai';
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';
import type { EvidenceUnit } from '@prisma/client';
import {
  type ILLMService,
  type PersonaExtractionRequest,
  type PersonaExtractionResponse,
  type BatchExtractionRequest,
  type BatchExtractionResponse,
  type ClaimField,
  type CitationInfo,
  type LLMConfig,
  type TokenUsage,
  type RateLimitState,
  type ServiceHealth,
  type EvidenceContext,
  type JSONModeConfig,
  type CitationValidationFunction,
  LLMServiceError,
  RateLimitError,
  ValidationError
} from '../types/llm';
import { config as env } from '../config/env';
import { PromptTemplateManager, PromptTemplateFactory } from '../prompts/templates';
import { generateFewShotPrompt } from '../prompts/examples';

/**
 * OpenAI Service with evidence-bound persona extraction
 */
export class OpenAIService implements ILLMService {
  private client: OpenAI;
  private config: LLMConfig;
  private rateLimitState: RateLimitState;
  private usageHistory: TokenUsage[] = [];
  private requestCount = 0;
  private lastResetTime = new Date();
  private promptManager: PromptTemplateManager;

  // Token pricing (as of 2024) - should be configurable
  private readonly TOKEN_PRICING = {
    'gpt-4': { prompt: 0.03, completion: 0.06 },
    'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
    'gpt-3.5-turbo': { prompt: 0.001, completion: 0.002 }
  } as const;

  constructor(config?: Partial<LLMConfig>) {
    if (!env.OPENAI_API_KEY) {
      throw new LLMServiceError(
        'OpenAI API key is required but not provided',
        'invalid_request',
        false
      );
    }

    this.client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      timeout: config?.timeoutMs || env.LLM_TIMEOUT_MS,
    });

    this.config = {
      model: config?.model || env.LLM_MODEL,
      temperature: config?.temperature || env.LLM_TEMPERATURE,
      maxTokens: config?.maxTokens || env.LLM_MAX_TOKENS,
      timeoutMs: config?.timeoutMs || env.LLM_TIMEOUT_MS,
      retryAttempts: config?.retryAttempts || 3,
      retryDelayMs: config?.retryDelayMs || 1000,
      rateLimitRpm: config?.rateLimitRpm || 3000,
      rateLimitTpm: config?.rateLimitTpm || 150000,
    };

    this.rateLimitState = {
      requestsPerMinute: 0,
      tokensPerMinute: 0,
      lastResetTime: new Date(),
      remainingRequests: this.config.rateLimitRpm || 3000,
      remainingTokens: this.config.rateLimitTpm || 150000,
    };

    // Initialize prompt manager based on config or use default
    this.promptManager = config?.model?.includes('gpt-4') 
      ? PromptTemplateFactory.createHighAccuracyTemplate()
      : PromptTemplateFactory.createFastExtractionTemplate();
  }

  /**
   * Extract persona from evidence units with citation enforcement
   */
  async extractPersona(request: PersonaExtractionRequest): Promise<PersonaExtractionResponse> {
    const startTime = Date.now();
    
    try {
      // Validate request
      this.validateExtractionRequest(request);
      
      // Check rate limits
      await this.checkRateLimit(request.evidenceUnits.length);
      
      // Prepare evidence context
      const evidenceContext = this.prepareEvidenceContext(request.evidenceUnits);
      
      // Generate prompt using the prompt manager
      const systemPrompt = this.promptManager.generateSystemPrompt(request.constraints.conflictHandling);
      const userPrompt = this.promptManager.generateUserPrompt(request, evidenceContext);

      // Add few-shot examples for better guidance
      const fewShotExamples = generateFewShotPrompt('basic', true);
      const enhancedUserPrompt = `${fewShotExamples}\n\nNow extract persona information from the following evidence:\n\n${userPrompt}`;

      // Call OpenAI with retry logic
      const response = await this.callOpenAIWithRetry({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: enhancedUserPrompt
          }
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        response_format: { type: 'json_object' },
        functions: request.constraints.requireCitations ? [this.getCitationValidationFunction()] : undefined,
      });

      // Parse and validate response
      const extractedClaims = this.parseExtractionResponse(response);
      
      // Validate citations if required
      if (request.constraints.requireCitations) {
        await this.validateCitations(extractedClaims, request.evidenceUnits);
      }
      
      // Track usage
      const usage = this.trackTokenUsage(response.usage!, this.config.model);
      this.updateRateLimit(1, usage.totalTokens);
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        claims: extractedClaims,
        metadata: {
          tokensUsed: usage.totalTokens,
          processingTimeMs: processingTime,
          evidenceUnitsProcessed: request.evidenceUnits.length,
          overallConfidence: this.calculateOverallConfidence(extractedClaims),
        },
      };
      
    } catch (error) {
      return this.handleExtractionError(error, Date.now() - startTime);
    }
  }

  /**
   * Extract multiple personas in batch with concurrency control
   */
  async extractBatch(request: BatchExtractionRequest): Promise<BatchExtractionResponse> {
    const startTime = Date.now();
    const results: PersonaExtractionResponse[] = [];
    const errors: any[] = [];
    let totalTokens = 0;
    let totalCost = 0;

    const maxConcurrency = request.maxConcurrency || 3;
    const semaphore = new Array(maxConcurrency).fill(null);
    
    try {
      // Process requests with concurrency limit
      const promises = request.requests.map(async (req, index) => {
        // Wait for available slot
        await this.waitForSemaphore(semaphore);
        
        try {
          const result = await this.extractPersona(req);
          results[index] = result;
          
          if (result.success) {
            totalTokens += result.metadata.tokensUsed;
            totalCost += this.calculateCost(result.metadata.tokensUsed, this.config.model);
          }
        } catch (error) {
          errors.push({ index, error });
          results[index] = this.handleExtractionError(error, 0);
        } finally {
          // Release semaphore slot
          this.releaseSemaphore(semaphore);
        }
      });

      await Promise.all(promises);
      
      const successfulRequests = results.filter(r => r.success).length;
      
      return {
        batchId: request.batchId,
        results,
        summary: {
          totalRequests: request.requests.length,
          successfulRequests,
          failedRequests: request.requests.length - successfulRequests,
          totalTokensUsed: totalTokens,
          totalCost,
          processingTimeMs: Date.now() - startTime,
        },
        errors,
      };
      
    } catch (error) {
      throw new LLMServiceError(
        `Batch processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'service_unavailable',
        false
      );
    }
  }

  /**
   * Validate that claims are properly cited with evidence
   */
  async validateCitations(claims: ClaimField[], evidenceUnits: EvidenceUnit[]): Promise<boolean> {
    const evidenceIds = new Set(evidenceUnits.map(eu => eu.id));
    
    for (const claim of claims) {
      // Check that all citations reference valid evidence
      for (const citation of claim.citations) {
        for (const evidenceId of citation.evidenceUnitIds) {
          if (!evidenceIds.has(evidenceId)) {
            throw new ValidationError(
              `Citation references non-existent evidence ID: ${evidenceId}`,
              { claim: claim.fieldName, citation }
            );
          }
        }
      }
      
      // Check citation density (at least one citation per sentence)
      const sentences = claim.text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const citationSentences = new Set(claim.citations.map(c => c.sentenceIndex));
      
      if (citationSentences.size < sentences.length) {
        throw new ValidationError(
          `Insufficient citations for claim: ${claim.fieldName}. Expected ${sentences.length}, got ${citationSentences.size}`,
          { claim: claim.fieldName, expectedCitations: sentences.length, actualCitations: citationSentences.size }
        );
      }
    }
    
    return true;
  }

  /**
   * Get service health status
   */
  async getHealth(): Promise<ServiceHealth> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentUsage = this.usageHistory.filter(u => u.timestamp > oneDayAgo);
    const errorRate = recentUsage.length > 0 
      ? recentUsage.filter(u => u.totalTokens === 0).length / recentUsage.length 
      : 0;
    
    try {
      const testStart = Date.now();
      // Simple health check - try to get model info
      await this.client.models.list();
      const latency = Date.now() - testStart;
      
      return {
        status: errorRate > 0.1 ? 'degraded' : 'healthy',
        latencyMs: latency,
        rateLimitStatus: this.rateLimitState,
        lastSuccessfulRequest: recentUsage.length > 0 ? recentUsage[recentUsage.length - 1]?.timestamp : undefined,
        errorRate24h: errorRate,
        uptime: Date.now() - this.lastResetTime.getTime(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latencyMs: -1,
        rateLimitStatus: this.rateLimitState,
        errorRate24h: errorRate,
        uptime: Date.now() - this.lastResetTime.getTime(),
      };
    }
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(): Promise<TokenUsage[]> {
    return [...this.usageHistory];
  }

  // Private helper methods

  private validateExtractionRequest(request: PersonaExtractionRequest): void {
    if (!request.evidenceUnits || request.evidenceUnits.length === 0) {
      throw new ValidationError('At least one evidence unit is required');
    }
    
    if (request.extractionType === 'specific_field' && !request.fieldName) {
      throw new ValidationError('fieldName is required for specific_field extraction type');
    }
    
    if (request.evidenceUnits.length > 100) {
      throw new ValidationError('Too many evidence units. Maximum 100 per request.');
    }
  }

  private async checkRateLimit(estimatedTokens: number): Promise<void> {
    const now = new Date();
    
    // Reset rate limit counters if a minute has passed
    if (now.getTime() - this.rateLimitState.lastResetTime.getTime() >= 60000) {
      this.rateLimitState.requestsPerMinute = 0;
      this.rateLimitState.tokensPerMinute = 0;
      this.rateLimitState.lastResetTime = now;
      this.rateLimitState.remainingRequests = this.config.rateLimitRpm || 3000;
      this.rateLimitState.remainingTokens = this.config.rateLimitTpm || 150000;
    }
    
    // Check request rate limit
    if (this.rateLimitState.remainingRequests <= 0) {
      const resetIn = 60000 - (now.getTime() - this.rateLimitState.lastResetTime.getTime());
      throw new RateLimitError('Request rate limit exceeded', resetIn);
    }
    
    // Check token rate limit
    if (this.rateLimitState.remainingTokens < estimatedTokens * 2) { // Estimate 2x for completion
      const resetIn = 60000 - (now.getTime() - this.rateLimitState.lastResetTime.getTime());
      throw new RateLimitError('Token rate limit exceeded', resetIn);
    }
  }

  private updateRateLimit(requests: number, tokens: number): void {
    this.rateLimitState.requestsPerMinute += requests;
    this.rateLimitState.tokensPerMinute += tokens;
    this.rateLimitState.remainingRequests -= requests;
    this.rateLimitState.remainingTokens -= tokens;
  }

  private prepareEvidenceContext(evidenceUnits: EvidenceUnit[]): EvidenceContext[] {
    return evidenceUnits.map(unit => ({
      evidenceUnit: unit,
      processingMetadata: {
        qualityScore: unit.qualityScore || 0,
        topics: unit.topics ? JSON.parse(unit.topics) : [],
      },
    }));
  }



  private getCitationValidationFunction(): CitationValidationFunction {
    return {
      name: 'validate_citations',
      description: 'Validate that all claims are properly cited with evidence IDs',
      parameters: {
        type: 'object',
        properties: {
          claims: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                citations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      sentence_index: { type: 'number' },
                      evidence_ids: {
                        type: 'array',
                        items: { type: 'string' },
                      },
                    },
                    required: ['sentence_index', 'evidence_ids'],
                  },
                },
              },
              required: ['text', 'citations'],
            },
          },
        },
        required: ['claims'],
      },
    };
  }

  private async callOpenAIWithRetry(
    params: ChatCompletionCreateParamsNonStreaming
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await this.client.chat.completions.create(params);
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on certain error types
        if (error instanceof OpenAI.APIError) {
          if (error.status === 400 || error.status === 401 || error.status === 403) {
            throw new LLMServiceError(
              `OpenAI API error: ${error.message}`,
              'invalid_request',
              false,
              { status: error.status, code: error.code }
            );
          }
          
          if (error.status === 429) {
            throw new RateLimitError('OpenAI rate limit exceeded', 60000);
          }
        }
        
        // Wait before retry with exponential backoff
        if (attempt < this.config.retryAttempts) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new LLMServiceError(
      `OpenAI request failed after ${this.config.retryAttempts + 1} attempts: ${lastError?.message}`,
      'service_unavailable',
      true
    );
  }

  private parseExtractionResponse(response: OpenAI.Chat.Completions.ChatCompletion): ClaimField[] {
    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      throw new ValidationError('Empty response from OpenAI');
    }
    
    try {
      const parsed = JSON.parse(content);
      
      if (!parsed.claims || !Array.isArray(parsed.claims)) {
        throw new ValidationError('Response does not contain valid claims array');
      }
      
      return parsed.claims.map((claim: any) => ({
        fieldName: claim.fieldName,
        text: claim.text,
        confidence: claim.confidence,
        citations: claim.citations?.map((citation: any) => ({
          sentenceIndex: citation.sentenceIndex,
          evidenceUnitIds: citation.evidenceUnitIds,
          confidence: citation.confidence || 1.0,
          supportType: citation.supportType || 'direct',
        })) || [],
        metadata: claim.metadata,
      }));
    } catch (error) {
      throw new ValidationError(
        `Failed to parse OpenAI response: ${error instanceof Error ? error.message : 'Unknown parsing error'}`,
        { content }
      );
    }
  }

  private trackTokenUsage(usage: OpenAI.Completions.CompletionUsage, model: string): TokenUsage {
    const tokenUsage: TokenUsage = {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      estimatedCost: this.calculateCost(usage.total_tokens, model),
      model,
      timestamp: new Date(),
    };
    
    this.usageHistory.push(tokenUsage);
    
    // Keep only recent usage history (last 1000 entries)
    if (this.usageHistory.length > 1000) {
      this.usageHistory.splice(0, this.usageHistory.length - 1000);
    }
    
    return tokenUsage;
  }

  private calculateCost(tokens: number, model: string): number {
    const pricing = this.TOKEN_PRICING[model as keyof typeof this.TOKEN_PRICING];
    if (!pricing) {
      return 0; // Unknown model
    }
    
    // Simplified cost calculation - in real implementation, would separate prompt/completion tokens
    const avgPrice = (pricing.prompt + pricing.completion) / 2;
    return (tokens * avgPrice) / 1000; // Pricing is per 1K tokens
  }

  private calculateOverallConfidence(claims: ClaimField[]): number {
    if (claims.length === 0) return 0;
    return claims.reduce((sum, claim) => sum + claim.confidence, 0) / claims.length;
  }

  private handleExtractionError(error: unknown, processingTimeMs: number): PersonaExtractionResponse {
    if (error instanceof LLMServiceError) {
      return {
        success: false,
        claims: [],
        metadata: {
          tokensUsed: 0,
          processingTimeMs,
          evidenceUnitsProcessed: 0,
          overallConfidence: 0,
        },
        errors: [{
          type: error.type,
          message: error.message,
          retryable: error.retryable,
          details: error.details,
        }],
      };
    }
    
    return {
      success: false,
      claims: [],
      metadata: {
        tokensUsed: 0,
        processingTimeMs,
        evidenceUnitsProcessed: 0,
        overallConfidence: 0,
      },
      errors: [{
        type: 'service_unavailable',
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: false,
      }],
    };
  }

  // Semaphore helpers for batch processing
  private async waitForSemaphore(semaphore: any[]): Promise<void> {
    return new Promise((resolve) => {
      const checkSlot = () => {
        const index = semaphore.findIndex(slot => slot === null);
        if (index !== -1) {
          semaphore[index] = true;
          resolve();
        } else {
          setTimeout(checkSlot, 10);
        }
      };
      checkSlot();
    });
  }

  private releaseSemaphore(semaphore: any[]): void {
    const index = semaphore.findIndex(slot => slot === true);
    if (index !== -1) {
      semaphore[index] = null;
    }
  }
}