/**
 * Example API Usage and Test Data
 * 
 * This file provides examples of API usage for testing the documentation
 * and demonstrating expected request/response patterns.
 */

export const apiExamples = {
  projects: {
    create: {
      basic: {
        name: 'Celebrity Analysis Project',
        description: 'Extracting persona information from public interviews and articles'
      },
      withMetadata: {
        name: 'Tech Leader Research',
        description: 'Analyzing leadership styles of tech executives',
        metadata: {
          industry: 'technology',
          timeframe: '2020-2024',
          focus: 'leadership_style',
          expectedPersonaCount: 5
        }
      }
    },
    response: {
      id: 'clnxxxxxxxxxxxxx',
      name: 'Celebrity Analysis Project',
      description: 'Extracting persona information from public interviews and articles',
      metadata: null,
      createdAt: '2024-09-16T10:00:00Z',
      updatedAt: '2024-09-16T10:00:00Z'
    }
  },

  sources: {
    create: {
      url: {
        projectId: 'clnxxxxxxxxxxxxx',
        url: 'https://example.com/interview/ceo-2024',
        title: 'CEO Interview: Innovation and Leadership',
        tier: 'REPUTABLE',
        publishedAt: '2024-01-15T10:00:00Z',
        metadata: {
          author: 'John Smith',
          publication: 'Tech Weekly',
          wordCount: 2500,
          language: 'en'
        }
      },
      manual: {
        projectId: 'clnxxxxxxxxxxxxx',
        url: 'manual://internal-research-notes',
        title: 'Internal Research Notes - Q1 2024',
        tier: 'INFORMAL',
        metadata: {
          source_type: 'manual',
          researcher: 'Jane Doe',
          department: 'Research Team'
        }
      }
    },
    response: {
      id: 'clnxxxxxxxxxxxxx',
      projectId: 'clnxxxxxxxxxxxxx',
      url: 'https://example.com/interview/ceo-2024',
      title: 'CEO Interview: Innovation and Leadership',
      publishedAt: '2024-01-15T10:00:00Z',
      fetchedAt: '2024-09-16T10:00:00Z',
      tier: 'REPUTABLE',
      metadata: {
        author: 'John Smith',
        publication: 'Tech Weekly',
        wordCount: 2500,
        language: 'en'
      },
      createdAt: '2024-09-16T10:00:00Z',
      updatedAt: '2024-09-16T10:00:00Z'
    }
  },

  evidence: {
    create: {
      sourceId: 'clnxxxxxxxxxxxxx',
      snippet: 'The CEO emphasized the importance of innovative thinking and collaborative leadership in driving organizational success.',
      startIndex: 1250,
      endIndex: 1380,
      topics: ['leadership', 'innovation', 'collaboration'],
      metadata: {
        speaker: 'CEO',
        context: 'interview_response',
        question_topic: 'leadership_philosophy'
      }
    },
    response: {
      id: 'clnxxxxxxxxxxxxx',
      sourceId: 'clnxxxxxxxxxxxxx',
      snippet: 'The CEO emphasized the importance of innovative thinking and collaborative leadership in driving organizational success.',
      startIndex: 1250,
      endIndex: 1380,
      qualityScore: 0.85,
      topics: ['leadership', 'innovation', 'collaboration'],
      metadata: {
        speaker: 'CEO',
        context: 'interview_response',
        question_topic: 'leadership_philosophy'
      },
      createdAt: '2024-09-16T10:00:00Z'
    }
  },

  personas: {
    create: {
      projectId: 'clnxxxxxxxxxxxxx',
      evidenceUnitIds: [
        'clnyyy1111111111',
        'clnyyy2222222222',
        'clnyyy3333333333'
      ],
      generationParams: {
        model: 'gpt-4',
        temperature: 0.2,
        maxTokens: 2000,
        focusAreas: ['leadership_style', 'communication', 'decision_making']
      }
    },
    response: {
      id: 'clnxxxxxxxxxxxxx',
      projectId: 'clnxxxxxxxxxxxxx',
      status: 'DRAFT',
      createdAt: '2024-09-16T10:00:00Z',
      updatedAt: '2024-09-16T10:00:00Z'
    }
  },

  claims: {
    create: {
      personaId: 'clnxxxxxxxxxxxxx',
      fieldName: 'leadership_style',
      text: 'Demonstrates collaborative leadership with emphasis on innovation and team empowerment.',
      confidence: 0.87,
      evidenceUnitIds: ['clnyyy1111111111', 'clnyyy2222222222']
    },
    response: {
      id: 'clnxxxxxxxxxxxxx',
      personaId: 'clnxxxxxxxxxxxxx',
      fieldName: 'leadership_style',
      text: 'Demonstrates collaborative leadership with emphasis on innovation and team empowerment.',
      confidence: 0.87,
      evidenceUnitIds: ['clnyyy1111111111', 'clnyyy2222222222'],
      citations: [
        {
          id: 'clnzzz1111111111',
          sentenceIndex: 0,
          evidenceUnitIds: ['clnyyy1111111111'],
          snippet: 'emphasized the importance of innovative thinking and collaborative leadership'
        }
      ],
      createdAt: '2024-09-16T10:00:00Z',
      updatedAt: '2024-09-16T10:00:00Z'
    }
  }
};

export const errorExamples = {
  validation: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid input provided',
    details: {
      validationErrors: [
        {
          field: 'name',
          message: 'Name is required',
          code: 'invalid_string'
        },
        {
          field: 'projectId',
          message: 'Invalid CUID format',
          code: 'invalid_string'
        }
      ]
    },
    requestId: 'req_123456'
  },
  notFound: {
    code: 'RESOURCE_NOT_FOUND',
    message: 'Project not found',
    requestId: 'req_123456'
  },
  serverError: {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    requestId: 'req_123456'
  },
  rateLimited: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests. Please try again later.',
    retryAfter: 60,
    requestId: 'req_123456'
  }
};

export const paginationExamples = {
  request: {
    page: 1,
    limit: 20,
    search: 'leadership',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  },
  response: {
    page: 1,
    limit: 20,
    total: 150,
    totalPages: 8,
    hasNextPage: true,
    hasPrevPage: false
  }
};

export const healthCheckExamples = {
  basic: {
    status: 'ok',
    timestamp: '2024-09-16T10:00:00Z',
    uptime: 12345.67,
    version: '1.0.0',
    environment: 'development',
    responseTime: 2.5
  },
  detailed: {
    status: 'healthy',
    timestamp: '2024-09-16T10:00:00Z',
    version: '1.0.0',
    environment: 'development',
    uptime: 12345.67,
    checks: [
      {
        name: 'database',
        status: 'healthy',
        responseTime: 15.5,
        lastChecked: '2024-09-16T10:00:00Z',
        metadata: {
          connectionCount: 5,
          queriesPerSecond: 125
        }
      },
      {
        name: 'openai',
        status: 'healthy',
        responseTime: 234.2,
        lastChecked: '2024-09-16T10:00:00Z',
        metadata: {
          model: 'gpt-4',
          tokensUsed: 1250,
          rateLimitRemaining: 9875
        }
      }
    ],
    system: {
      memory: {
        rss: 125829120,
        heapTotal: 89653248,
        heapUsed: 65892352,
        external: 2134016,
        arrayBuffers: 1048576
      },
      cpu: {
        user: 245680,
        system: 67530
      },
      loadAverage: [0.85, 0.92, 1.05]
    }
  }
};