/**
 * OpenAI Service Unit Tests
 * 
 * Comprehensive test suite covering error scenarios, retry logic, rate limiting,
 * citation validation, and service monitoring.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import OpenAI from 'openai';
import { OpenAIService } from '../../services/OpenAIService';
import type { 
  PersonaExtractionRequest, 
  LLMConfig 
} from '../../types/llm';
import type { EvidenceUnit } from '@prisma/client';
import { LLMServiceError, RateLimitError, ValidationError } from '../../types/llm';

// Mock OpenAI SDK
vi.mock('openai');

// Mock environment config
vi.mock('../../config/env', () => ({
  config: {
    OPENAI_API_KEY: 'test-api-key',
    LLM_MODEL: 'gpt-4',
    LLM_TEMPERATURE: 0.1,
    LLM_MAX_TOKENS: 4000,
    LLM_TIMEOUT_MS: 30000,
  },
}));

const MockedOpenAI = OpenAI as unknown as Mock;

describe('OpenAIService', () => {
  let openAIService: OpenAIService;
  let mockClient: {
    chat: {
      completions: {
        create: Mock;
      };
    };
    models: {
      list: Mock;
    };
  };

  const sampleEvidenceUnits: EvidenceUnit[] = [
    {
      id: 'evidence_1',
      sourceId: 'source_1',
      snippet: 'John Smith is a software engineer at Google.',
      startIndex: 0,
      endIndex: 42,
      qualityScore: 0.9,
      topics: '["profession", "company"]',
      metadata: '{}',
      createdAt: new Date(),
    },
    {
      id: 'evidence_2',
      sourceId: 'source_1',
      snippet: 'He graduated from Stanford University in 2018.',
      startIndex: 43,
      endIndex: 88,
      qualityScore: 0.8,
      topics: '["education", "graduation"]',
      metadata: '{}',
      createdAt: new Date(),
    },
  ];

  const validExtractionRequest: PersonaExtractionRequest = {
    evidenceUnits: sampleEvidenceUnits,
    extractionType: 'full',
    constraints: {
      requireCitations: true,
      conflictHandling: 'flag',
    },
    projectId: 'test-project',
  };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Setup mock OpenAI client
    mockClient = {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
      models: {
        list: vi.fn(),
      },
    };
    
    MockedOpenAI.mockReturnValue(mockClient);
    
    // Create service instance
    openAIService = new OpenAIService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Constructor', () => {
    it('should throw error if OpenAI API key is not provided', () => {
      vi.doMock('../../config/env', () => ({
        config: {
          OPENAI_API_KEY: undefined,
          LLM_MODEL: 'gpt-4',
          LLM_TEMPERATURE: 0.1,
          LLM_MAX_TOKENS: 4000,
          LLM_TIMEOUT_MS: 30000,
        },
      }));

      expect(() => new OpenAIService()).toThrow(LLMServiceError);
    });

    it('should initialize with default config values', () => {
      expect(MockedOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        timeout: 30000,
      });
    });

    it('should accept custom config values', () => {
      const customConfig: Partial<LLMConfig> = {
        model: 'gpt-3.5-turbo',
        temperature: 0.5,
        maxTokens: 2000,
        retryAttempts: 5,
      };
      
      const customService = new OpenAIService(customConfig);
      expect(customService).toBeDefined();
    });
  });

  describe('extractPersona', () => {
    it('should successfully extract persona with valid response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              claims: [
                {
                  fieldName: 'profession',
                  text: 'Software engineer at Google [evidence_1]',
                  confidence: 0.9,
                  citations: [
                    {
                      sentenceIndex: 0,
                      evidenceUnitIds: ['evidence_1'],
                      confidence: 0.9,
                      supportType: 'direct',
                    },
                  ],
                },
              ],
            }),
          },
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      };
      
      mockClient.chat.completions.create.mockResolvedValue(mockResponse);
      
      const result = await openAIService.extractPersona(validExtractionRequest);
      
      expect(result.success).toBe(true);
      expect(result.claims).toHaveLength(1);
      expect(result.claims[0].fieldName).toBe('profession');
      expect(result.metadata.tokensUsed).toBe(150);
      expect(result.metadata.evidenceUnitsProcessed).toBe(2);
    });

    it('should validate request and throw error for empty evidence units', async () => {
      const invalidRequest = {
        ...validExtractionRequest,
        evidenceUnits: [],
      };
      
      const result = await openAIService.extractPersona(invalidRequest);
      
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].type).toBe('validation_error');
    });

    it('should validate request and throw error for specific_field without fieldName', async () => {
      const invalidRequest = {
        ...validExtractionRequest,
        extractionType: 'specific_field' as const,
        fieldName: undefined,
      };
      
      const result = await openAIService.extractPersona(invalidRequest);
      
      expect(result.success).toBe(false);
      expect(result.errors![0].message).toContain('fieldName is required');
    });

    it('should handle OpenAI API errors gracefully', async () => {
      const apiError = new OpenAI.APIError(400, 'Invalid request', 'invalid_request', undefined);
      mockClient.chat.completions.create.mockRejectedValue(apiError);
      
      const result = await openAIService.extractPersona(validExtractionRequest);
      
      expect(result.success).toBe(false);
      expect(result.errors![0].type).toBe('invalid_request');
    });

    it('should handle rate limiting errors', async () => {
      const rateLimitError = new OpenAI.APIError(429, 'Rate limit exceeded', 'rate_limit_exceeded', undefined);
      mockClient.chat.completions.create.mockRejectedValue(rateLimitError);
      
      const result = await openAIService.extractPersona(validExtractionRequest);
      
      expect(result.success).toBe(false);
      expect(result.errors![0].type).toBe('rate_limit');
    });

    it('should retry on service unavailable errors', async () => {
      const serviceError = new OpenAI.APIError(503, 'Service unavailable', 'service_unavailable', undefined);
      
      mockClient.chat.completions.create
        .mockRejectedValueOnce(serviceError)
        .mockRejectedValueOnce(serviceError)
        .mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({ claims: [] }),
            },
          }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        });
      
      const result = await openAIService.extractPersona(validExtractionRequest);
      
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
    });

    it('should handle invalid JSON response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Invalid JSON response',
          },
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };
      
      mockClient.chat.completions.create.mockResolvedValue(mockResponse);
      
      const result = await openAIService.extractPersona(validExtractionRequest);
      
      expect(result.success).toBe(false);
      expect(result.errors![0].type).toBe('validation_error');
      expect(result.errors![0].message).toContain('Failed to parse OpenAI response');
    });
  });

  describe('validateCitations', () => {
    it('should validate correct citations successfully', async () => {
      const claims = [
        {
          fieldName: 'profession',
          text: 'Software engineer [evidence_1]',
          confidence: 0.9,
          citations: [
            {
              sentenceIndex: 0,
              evidenceUnitIds: ['evidence_1'],
              confidence: 0.9,
              supportType: 'direct' as const,
            },
          ],
        },
      ];
      
      const result = await openAIService.validateCitations(claims, sampleEvidenceUnits);
      expect(result).toBe(true);
    });

    it('should reject citations with non-existent evidence IDs', async () => {
      const claims = [
        {
          fieldName: 'profession',
          text: 'Software engineer [evidence_999]',
          confidence: 0.9,
          citations: [
            {
              sentenceIndex: 0,
              evidenceUnitIds: ['evidence_999'],
              confidence: 0.9,
              supportType: 'direct' as const,
            },
          ],
        },
      ];
      
      await expect(
        openAIService.validateCitations(claims, sampleEvidenceUnits)
      ).rejects.toThrow(ValidationError);
    });

    it('should reject insufficient citation density', async () => {
      const claims = [
        {
          fieldName: 'profession',
          text: 'Software engineer. He works at Google.',
          confidence: 0.9,
          citations: [
            {
              sentenceIndex: 0,
              evidenceUnitIds: ['evidence_1'],
              confidence: 0.9,
              supportType: 'direct' as const,
            },
          ], // Missing citation for second sentence
        },
      ];
      
      await expect(
        openAIService.validateCitations(claims, sampleEvidenceUnits)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('extractBatch', () => {
    it('should process batch requests with concurrency control', async () => {
      const batchRequest = {
        batchId: 'batch_1',
        requests: [validExtractionRequest, validExtractionRequest],
        priority: 'medium' as const,
        maxConcurrency: 2,
      };
      
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({ claims: [] }),
          },
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };
      
      mockClient.chat.completions.create.mockResolvedValue(mockResponse);
      
      const result = await openAIService.extractBatch(batchRequest);
      
      expect(result.batchId).toBe('batch_1');
      expect(result.results).toHaveLength(2);
      expect(result.summary.totalRequests).toBe(2);
      expect(result.summary.successfulRequests).toBe(2);
    });
  });

  describe('getHealth', () => {
    it('should return healthy status when service is working', async () => {
      mockClient.models.list.mockResolvedValue({});
      
      const health = await openAIService.getHealth();
      
      expect(health.status).toBe('healthy');
      expect(health.latencyMs).toBeGreaterThan(0);
      expect(health.rateLimitStatus).toBeDefined();
    });

    it('should return unhealthy status when service fails', async () => {
      mockClient.models.list.mockRejectedValue(new Error('Service down'));
      
      const health = await openAIService.getHealth();
      
      expect(health.status).toBe('unhealthy');
      expect(health.latencyMs).toBe(-1);
    });
  });

  describe('Rate Limiting', () => {
    it('should track request count and enforce limits', async () => {
      // Test internal rate limiting
      const service = new OpenAIService({
        rateLimitRpm: 1,
        rateLimitTpm: 100,
      });
      
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({ claims: [] }),
          },
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };
      
      mockClient.chat.completions.create.mockResolvedValue(mockResponse);
      
      // First request should succeed
      const result1 = await service.extractPersona(validExtractionRequest);
      expect(result1.success).toBe(true);
      
      // Second request should fail due to rate limit
      const result2 = await service.extractPersona(validExtractionRequest);
      expect(result2.success).toBe(false);
      expect(result2.errors![0].type).toBe('rate_limit');
    });
  });

  describe('Cost Tracking', () => {
    it('should track token usage and calculate costs', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({ claims: [] }),
          },
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      };
      
      mockClient.chat.completions.create.mockResolvedValue(mockResponse);
      
      await openAIService.extractPersona(validExtractionRequest);
      
      const usageStats = await openAIService.getUsageStats();
      expect(usageStats).toHaveLength(1);
      expect(usageStats[0].totalTokens).toBe(150);
      expect(usageStats[0].estimatedCost).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should create appropriate LLMServiceError for different scenarios', () => {
      const serviceError = new LLMServiceError(
        'Test error',
        'service_unavailable',
        true,
        { detail: 'test' }
      );
      
      expect(serviceError.message).toBe('Test error');
      expect(serviceError.type).toBe('service_unavailable');
      expect(serviceError.retryable).toBe(true);
      expect(serviceError.details).toEqual({ detail: 'test' });
    });

    it('should create RateLimitError with retry information', () => {
      const rateLimitError = new RateLimitError('Rate limit exceeded', 60000);
      
      expect(rateLimitError.type).toBe('rate_limit');
      expect(rateLimitError.retryable).toBe(true);
      expect(rateLimitError.retryAfterMs).toBe(60000);
    });

    it('should create ValidationError for invalid inputs', () => {
      const validationError = new ValidationError(
        'Invalid input',
        { field: 'test' }
      );
      
      expect(validationError.type).toBe('validation_error');
      expect(validationError.retryable).toBe(false);
      expect(validationError.details).toEqual({ field: 'test' });
    });
  });

  describe('Prompt Generation', () => {
    it('should generate appropriate system prompts for different constraints', async () => {
      const requests = [
        {
          ...validExtractionRequest,
          constraints: { requireCitations: true, conflictHandling: 'flag' as const },
        },
        {
          ...validExtractionRequest,
          constraints: { requireCitations: true, conflictHandling: 'choose_best' as const },
        },
        {
          ...validExtractionRequest,
          constraints: { requireCitations: true, conflictHandling: 'synthesize' as const },
        },
      ];
      
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({ claims: [] }),
          },
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };
      
      mockClient.chat.completions.create.mockResolvedValue(mockResponse);
      
      for (const request of requests) {
        await openAIService.extractPersona(request);
      }
      
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(3);
      
      // Verify that different system prompts were generated
      const calls = mockClient.chat.completions.create.mock.calls;
      expect(calls[0][0].messages[0].content).not.toBe(calls[1][0].messages[0].content);
    });
  });
});