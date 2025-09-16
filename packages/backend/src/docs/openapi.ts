import { OpenAPIV3 } from 'openapi-types';

/**
 * OpenAPI specification for the Evidence-Based Persona Extraction API
 */
export const openApiSpec: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'Evidence-Based Persona Extraction API',
    description: `
# Evidence-Based Persona Extraction API

A comprehensive API for creating traceable, evidence-bound persona extractions using Large Language Models (LLMs).

## Key Features

- **Evidence-First Approach**: Every claim must be backed by explicit evidence with citations
- **Traceable Extractions**: Complete audit trail from evidence to final persona
- **Quality Scoring**: Multi-factor quality assessment for evidence units
- **Citation Validation**: Automated validation of claim-evidence alignment
- **Confidence Metrics**: Quantified confidence scores for all extractions

## Architecture

The API follows a hierarchical structure:
1. **Projects** - Top-level containers for persona extraction work
2. **Sources** - External sources of evidence (URLs, documents, etc.)
3. **Evidence Units** - Segmented text chunks with quality scores
4. **Personas** - Generated personas with evidence-backed claims
5. **Claims & Citations** - Individual claim fields with evidence references

## Authentication

Currently, the API operates without authentication. Future versions will include:
- API key authentication
- Role-based access control
- Rate limiting per user/organization

## Rate Limiting

- **Default**: 100 requests per minute per IP
- **File Upload**: 10 uploads per minute per IP
- **LLM Operations**: 5 persona generations per minute per IP

## Error Handling

All errors follow a consistent structure:
\`\`\`json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {},
    "requestId": "req_123456"
  },
  "timestamp": "2025-09-16T10:00:00Z",
  "path": "/api/endpoint",
  "method": "POST"
}
\`\`\`

## Pagination

List endpoints support pagination with consistent parameters:
- \`page\`: Page number (default: 1)
- \`limit\`: Items per page (default: 20, max: 100)
- \`search\`: Optional search query
- \`sortBy\`: Field to sort by
- \`sortOrder\`: 'asc' or 'desc' (default: 'desc')
    `,
    version: '1.0.0',
    contact: {
      name: 'API Support',
      email: 'support@persona-extraction.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: 'http://localhost:3001',
      description: 'Development server'
    },
    {
      url: 'https://api.persona-extraction.com',
      description: 'Production server'
    }
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Basic health check',
        description: 'Returns basic health status of the API',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' },
                    uptime: { type: 'number', example: 12345.67 },
                    version: { type: 'string', example: '1.0.0' },
                    environment: { type: 'string', example: 'development' },
                    responseTime: { type: 'number', example: 2.5 }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/health/detailed': {
      get: {
        tags: ['Health'],
        summary: 'Detailed health check',
        description: 'Returns detailed health status including dependencies',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DetailedHealthResponse' }
              }
            }
          },
          '503': {
            description: 'Service is unhealthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DetailedHealthResponse' }
              }
            }
          }
        }
      }
    },
    '/api/projects': {
      get: {
        tags: ['Projects'],
        summary: 'List projects',
        description: 'Retrieve a paginated list of projects with optional search and filtering',
        parameters: [
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/Limit' },
          { $ref: '#/components/parameters/Search' },
          { $ref: '#/components/parameters/SortBy' },
          { $ref: '#/components/parameters/SortOrder' },
          {
            name: 'includeStats',
            in: 'query',
            description: 'Include source and persona counts',
            schema: { type: 'boolean', default: false }
          }
        ],
        responses: {
          '200': {
            description: 'Projects retrieved successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PaginatedProjectsResponse' }
              }
            }
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '500': { $ref: '#/components/responses/ServerError' }
        }
      },
      post: {
        tags: ['Projects'],
        summary: 'Create project',
        description: 'Create a new project for persona extraction',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateProjectRequest' },
              examples: {
                basic: {
                  summary: 'Basic project creation',
                  value: {
                    name: 'Celebrity Analysis Project',
                    description: 'Extracting persona information from public interviews and articles'
                  }
                },
                withMetadata: {
                  summary: 'Project with custom metadata',
                  value: {
                    name: 'Tech Leader Research',
                    description: 'Analyzing leadership styles of tech executives',
                    metadata: {
                      industry: 'technology',
                      timeframe: '2020-2024',
                      focus: 'leadership_style'
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Project created successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ProjectResponse' }
              }
            }
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '500': { $ref: '#/components/responses/ServerError' }
        }
      }
    },
    '/api/projects/{id}': {
      get: {
        tags: ['Projects'],
        summary: 'Get project by ID',
        description: 'Retrieve a specific project with its details and related counts',
        parameters: [
          { $ref: '#/components/parameters/ProjectId' }
        ],
        responses: {
          '200': {
            description: 'Project retrieved successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ProjectWithStatsResponse' }
              }
            }
          },
          '404': { $ref: '#/components/responses/NotFound' },
          '500': { $ref: '#/components/responses/ServerError' }
        }
      },
      put: {
        tags: ['Projects'],
        summary: 'Update project',
        description: 'Update project details',
        parameters: [
          { $ref: '#/components/parameters/ProjectId' }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateProjectRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Project updated successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ProjectResponse' }
              }
            }
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '404': { $ref: '#/components/responses/NotFound' },
          '500': { $ref: '#/components/responses/ServerError' }
        }
      },
      delete: {
        tags: ['Projects'],
        summary: 'Delete project',
        description: 'Delete a project and all associated data (sources, evidence, personas)',
        parameters: [
          { $ref: '#/components/parameters/ProjectId' }
        ],
        responses: {
          '200': {
            description: 'Project deleted successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' }
              }
            }
          },
          '404': { $ref: '#/components/responses/NotFound' },
          '500': { $ref: '#/components/responses/ServerError' }
        }
      }
    },
    '/api/projects/{id}/activity': {
      get: {
        tags: ['Projects'],
        summary: 'Get project activity',
        description: 'Retrieve recent activity and statistics for a project',
        parameters: [
          { $ref: '#/components/parameters/ProjectId' }
        ],
        responses: {
          '200': {
            description: 'Project activity retrieved successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ProjectActivityResponse' }
              }
            }
          },
          '404': { $ref: '#/components/responses/NotFound' },
          '500': { $ref: '#/components/responses/ServerError' }
        }
      }
    },
    '/api/sources': {
      get: {
        tags: ['Sources'],
        summary: 'List sources',
        description: 'Retrieve a paginated list of evidence sources',
        parameters: [
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/Limit' },
          { $ref: '#/components/parameters/Search' },
          {
            name: 'projectId',
            in: 'query',
            description: 'Filter by project ID',
            schema: { type: 'string', format: 'cuid' }
          },
          {
            name: 'tier',
            in: 'query',
            description: 'Filter by source tier',
            schema: { 
              type: 'string',
              enum: ['CANONICAL', 'REPUTABLE', 'COMMUNITY', 'INFORMAL']
            }
          }
        ],
        responses: {
          '200': {
            description: 'Sources retrieved successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PaginatedSourcesResponse' }
              }
            }
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '500': { $ref: '#/components/responses/ServerError' }
        }
      },
      post: {
        tags: ['Sources'],
        summary: 'Create source',
        description: 'Create a new evidence source from URL or manual entry',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateSourceRequest' },
              examples: {
                url: {
                  summary: 'URL-based source',
                  value: {
                    projectId: 'clnxxxxxxxxxxxxx',
                    url: 'https://example.com/interview',
                    title: 'CEO Interview 2024',
                    tier: 'REPUTABLE',
                    publishedAt: '2024-01-15T10:00:00Z'
                  }
                },
                manual: {
                  summary: 'Manual text entry',
                  value: {
                    projectId: 'clnxxxxxxxxxxxxx',
                    url: 'manual://internal-notes',
                    title: 'Internal Research Notes',
                    tier: 'INFORMAL',
                    metadata: {
                      source_type: 'manual',
                      researcher: 'John Doe'
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Source created successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SourceResponse' }
              }
            }
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '500': { $ref: '#/components/responses/ServerError' }
        }
      }
    },
    '/api/sources/upload': {
      post: {
        tags: ['Sources'],
        summary: 'Upload source file',
        description: 'Upload a file to create a new evidence source',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'File to upload (PDF, TXT, DOCX, etc.)'
                  },
                  projectId: {
                    type: 'string',
                    format: 'cuid',
                    description: 'ID of the project'
                  },
                  title: {
                    type: 'string',
                    description: 'Title for the source (optional, will use filename if not provided)'
                  },
                  tier: {
                    type: 'string',
                    enum: ['CANONICAL', 'REPUTABLE', 'COMMUNITY', 'INFORMAL'],
                    description: 'Source tier/authority level'
                  }
                },
                required: ['file', 'projectId']
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'File uploaded and source created successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SourceResponse' }
              }
            }
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '413': {
            description: 'File too large',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          },
          '500': { $ref: '#/components/responses/ServerError' }
        }
      }
    }
  },
  components: {
    schemas: {
      // Basic response schemas
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operation completed successfully' },
          data: { type: 'object' },
          timestamp: { type: 'string', format: 'date-time' }
        },
        required: ['success', 'message', 'timestamp']
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Invalid input provided' },
              details: { type: 'object' },
              requestId: { type: 'string', example: 'req_123456' }
            },
            required: ['code', 'message']
          },
          timestamp: { type: 'string', format: 'date-time' },
          path: { type: 'string', example: '/api/projects' },
          method: { type: 'string', example: 'POST' }
        },
        required: ['success', 'error', 'timestamp']
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 150 },
          totalPages: { type: 'integer', example: 8 },
          hasNextPage: { type: 'boolean', example: true },
          hasPrevPage: { type: 'boolean', example: false }
        },
        required: ['page', 'limit', 'total', 'totalPages', 'hasNextPage', 'hasPrevPage']
      },

      // Health check schemas
      ServiceCheck: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'database' },
          status: { 
            type: 'string', 
            enum: ['healthy', 'degraded', 'unhealthy'],
            example: 'healthy'
          },
          responseTime: { type: 'number', example: 15.5 },
          lastChecked: { type: 'string', format: 'date-time' },
          error: { type: 'string' },
          metadata: { type: 'object' }
        },
        required: ['name', 'status', 'responseTime', 'lastChecked']
      },
      DetailedHealthResponse: {
        type: 'object',
        properties: {
          status: { 
            type: 'string', 
            enum: ['healthy', 'degraded', 'unhealthy'],
            example: 'healthy'
          },
          timestamp: { type: 'string', format: 'date-time' },
          version: { type: 'string', example: '1.0.0' },
          environment: { type: 'string', example: 'development' },
          uptime: { type: 'number', example: 12345.67 },
          checks: {
            type: 'array',
            items: { $ref: '#/components/schemas/ServiceCheck' }
          },
          system: {
            type: 'object',
            properties: {
              memory: {
                type: 'object',
                properties: {
                  rss: { type: 'number' },
                  heapTotal: { type: 'number' },
                  heapUsed: { type: 'number' },
                  external: { type: 'number' },
                  arrayBuffers: { type: 'number' }
                }
              },
              cpu: {
                type: 'object',
                properties: {
                  user: { type: 'number' },
                  system: { type: 'number' }
                }
              },
              loadAverage: {
                type: 'array',
                items: { type: 'number' }
              }
            }
          }
        },
        required: ['status', 'timestamp', 'version', 'environment', 'uptime', 'checks', 'system']
      },

      // Project schemas
      Project: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'cuid', example: 'clnxxxxxxxxxxxxx' },
          name: { type: 'string', example: 'Celebrity Analysis Project' },
          description: { type: 'string', example: 'Extracting persona information from public interviews' },
          metadata: { type: 'object', example: { industry: 'entertainment' } },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        },
        required: ['id', 'name', 'createdAt', 'updatedAt']
      },
      ProjectWithStats: {
        allOf: [
          { $ref: '#/components/schemas/Project' },
          {
            type: 'object',
            properties: {
              _count: {
                type: 'object',
                properties: {
                  sources: { type: 'integer', example: 15 },
                  personas: { type: 'integer', example: 3 }
                }
              }
            }
          }
        ]
      },
      CreateProjectRequest: {
        type: 'object',
        properties: {
          name: { 
            type: 'string', 
            minLength: 1,
            maxLength: 255,
            pattern: '^[a-zA-Z0-9\\s\\-_\\.]+$',
            example: 'Celebrity Analysis Project'
          },
          description: { 
            type: 'string', 
            maxLength: 2000,
            example: 'Extracting persona information from public interviews and articles'
          },
          metadata: { 
            type: 'object',
            example: { industry: 'entertainment', timeframe: '2024' }
          }
        },
        required: ['name']
      },
      UpdateProjectRequest: {
        type: 'object',
        properties: {
          name: { 
            type: 'string', 
            minLength: 1,
            maxLength: 255,
            pattern: '^[a-zA-Z0-9\\s\\-_\\.]+$'
          },
          description: { 
            type: 'string', 
            maxLength: 2000
          },
          metadata: { type: 'object' }
        }
      },
      ProjectResponse: {
        allOf: [
          { $ref: '#/components/schemas/SuccessResponse' },
          {
            type: 'object',
            properties: {
              data: { $ref: '#/components/schemas/Project' }
            }
          }
        ]
      },
      ProjectWithStatsResponse: {
        allOf: [
          { $ref: '#/components/schemas/SuccessResponse' },
          {
            type: 'object',
            properties: {
              data: { $ref: '#/components/schemas/ProjectWithStats' }
            }
          }
        ]
      },
      PaginatedProjectsResponse: {
        allOf: [
          { $ref: '#/components/schemas/SuccessResponse' },
          {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: { $ref: '#/components/schemas/ProjectWithStats' }
              },
              pagination: { $ref: '#/components/schemas/PaginationMeta' }
            }
          }
        ]
      },
      ProjectActivityResponse: {
        allOf: [
          { $ref: '#/components/schemas/SuccessResponse' },
          {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  recentSources: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Source' }
                  },
                  recentPersonas: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Persona' }
                  },
                  statistics: {
                    type: 'object',
                    properties: {
                      totalSources: { type: 'integer' },
                      totalEvidenceUnits: { type: 'integer' },
                      totalPersonas: { type: 'integer' },
                      averageQualityScore: { type: 'number' }
                    }
                  }
                }
              }
            }
          }
        ]
      },

      // Source schemas
      Source: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'cuid', example: 'clnxxxxxxxxxxxxx' },
          projectId: { type: 'string', format: 'cuid', example: 'clnxxxxxxxxxxxxx' },
          url: { type: 'string', format: 'uri', example: 'https://example.com/interview' },
          title: { type: 'string', example: 'CEO Interview 2024' },
          publishedAt: { type: 'string', format: 'date-time', nullable: true },
          fetchedAt: { type: 'string', format: 'date-time' },
          tier: { 
            type: 'string',
            enum: ['CANONICAL', 'REPUTABLE', 'COMMUNITY', 'INFORMAL'],
            example: 'REPUTABLE'
          },
          metadata: { type: 'object', example: { author: 'John Smith', publication: 'Tech Weekly' } },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        },
        required: ['id', 'projectId', 'url', 'tier', 'fetchedAt', 'createdAt', 'updatedAt']
      },
      CreateSourceRequest: {
        type: 'object',
        properties: {
          projectId: { type: 'string', format: 'cuid' },
          url: { type: 'string', format: 'uri' },
          title: { type: 'string', maxLength: 500 },
          publishedAt: { type: 'string', format: 'date-time' },
          tier: { 
            type: 'string',
            enum: ['CANONICAL', 'REPUTABLE', 'COMMUNITY', 'INFORMAL'],
            default: 'COMMUNITY'
          },
          metadata: { type: 'object' }
        },
        required: ['projectId', 'url']
      },
      SourceResponse: {
        allOf: [
          { $ref: '#/components/schemas/SuccessResponse' },
          {
            type: 'object',
            properties: {
              data: { $ref: '#/components/schemas/Source' }
            }
          }
        ]
      },
      PaginatedSourcesResponse: {
        allOf: [
          { $ref: '#/components/schemas/SuccessResponse' },
          {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: { $ref: '#/components/schemas/Source' }
              },
              pagination: { $ref: '#/components/schemas/PaginationMeta' }
            }
          }
        ]
      },

      // Placeholder schemas for evidence, personas, claims
      EvidenceUnit: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'cuid' },
          sourceId: { type: 'string', format: 'cuid' },
          snippet: { type: 'string' },
          startIndex: { type: 'integer' },
          endIndex: { type: 'integer' },
          qualityScore: { type: 'number', minimum: 0, maximum: 1, nullable: true },
          topics: { type: 'array', items: { type: 'string' } },
          metadata: { type: 'object' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      Persona: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'cuid' },
          projectId: { type: 'string', format: 'cuid' },
          status: { 
            type: 'string',
            enum: ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED']
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      }
    },
    parameters: {
      ProjectId: {
        name: 'id',
        in: 'path',
        required: true,
        description: 'Project ID',
        schema: { type: 'string', format: 'cuid' }
      },
      SourceId: {
        name: 'id',
        in: 'path',
        required: true,
        description: 'Source ID',
        schema: { type: 'string', format: 'cuid' }
      },
      Page: {
        name: 'page',
        in: 'query',
        description: 'Page number for pagination',
        schema: { type: 'integer', minimum: 1, default: 1 }
      },
      Limit: {
        name: 'limit',
        in: 'query',
        description: 'Number of items per page',
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
      },
      Search: {
        name: 'search',
        in: 'query',
        description: 'Search query string',
        schema: { type: 'string' }
      },
      SortBy: {
        name: 'sortBy',
        in: 'query',
        description: 'Field to sort by',
        schema: { type: 'string' }
      },
      SortOrder: {
        name: 'sortOrder',
        in: 'query',
        description: 'Sort order',
        schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
      }
    },
    responses: {
      ValidationError: {
        description: 'Validation error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid input provided',
                details: {
                  validationErrors: [
                    {
                      field: 'name',
                      message: 'Name is required',
                      code: 'invalid_string'
                    }
                  ]
                },
                requestId: 'req_123456'
              },
              timestamp: '2025-09-16T10:00:00Z',
              path: '/api/projects',
              method: 'POST'
            }
          }
        }
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: {
                code: 'RESOURCE_NOT_FOUND',
                message: 'Project not found',
                requestId: 'req_123456'
              },
              timestamp: '2025-09-16T10:00:00Z',
              path: '/api/projects/clnxxxxxxxxxxxxx',
              method: 'GET'
            }
          }
        }
      },
      ServerError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An unexpected error occurred',
                requestId: 'req_123456'
              },
              timestamp: '2025-09-16T10:00:00Z',
              path: '/api/projects',
              method: 'POST'
            }
          }
        }
      }
    },
    securitySchemes: {
      ApiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for authentication (future implementation)'
      },
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token for authentication (future implementation)'
      }
    }
  },
  tags: [
    {
      name: 'Health',
      description: 'System health and monitoring endpoints'
    },
    {
      name: 'Projects',
      description: 'Project management operations'
    },
    {
      name: 'Sources',
      description: 'Evidence source management'
    },
    {
      name: 'Evidence',
      description: 'Evidence unit operations and search'
    },
    {
      name: 'Personas',
      description: 'Persona generation and management'
    },
    {
      name: 'Claims',
      description: 'Claim and citation management'
    }
  ]
};