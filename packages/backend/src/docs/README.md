# API Documentation

This directory contains the OpenAPI specification and documentation setup for the Evidence-Based Persona Extraction API.

## Files

- **`openapi.ts`** - Complete OpenAPI 3.0.3 specification with all endpoints, schemas, and examples
- **`examples.ts`** - Example request/response data for testing and documentation
- **`../routes/docs.ts`** - Express router serving Swagger UI and documentation endpoints

## Available Documentation Formats

### 1. Interactive Swagger UI
- **URL**: `/api-docs/docs`
- **Features**: 
  - Interactive API testing
  - Try-it-out functionality
  - Request/response examples
  - Schema validation
  - Authentication testing (when implemented)

### 2. ReDoc Documentation
- **URL**: `/api-docs/docs/redoc`
- **Features**:
  - Clean, professional layout
  - Better for reading and reference
  - Comprehensive schema documentation
  - Code examples in multiple languages

### 3. OpenAPI JSON Specification
- **URL**: `/api-docs/openapi.json`
- **Features**:
  - Raw OpenAPI 3.0.3 specification
  - Can be imported into Postman, Insomnia, etc.
  - Used for code generation
  - API contract validation

### 4. Documentation Landing Page
- **URL**: `/api-docs`
- **Features**:
  - Overview of the API
  - Quick stats and features
  - Links to all documentation formats
  - Getting started guide

## API Overview

The Evidence-Based Persona Extraction API provides 40+ endpoints across 5 main resource types:

### 1. Projects (`/api/projects`)
- Manage persona extraction projects
- CRUD operations
- Activity tracking and statistics

### 2. Sources (`/api/sources`) 
- Manage evidence sources (URLs, files, manual entries)
- File upload support
- Source quality tiers
- Processing status tracking

### 3. Evidence (`/api/evidence`)
- Evidence unit management
- Text processing and segmentation
- Quality scoring
- Topic extraction
- Search and filtering

### 4. Personas (`/api/personas`)
- Persona generation using LLMs
- Evidence-based claim creation
- Review and approval workflows
- Confidence scoring

### 5. Claims (`/api/claims`)
- Individual claim management
- Citation tracking
- Evidence validation
- Confidence calculations

## Key Features

### Evidence-First Approach
Every claim must be backed by explicit evidence with citations. The API prevents hallucination by requiring evidence IDs for all persona information.

### Complete Traceability
Full audit trail from original sources through evidence processing to final persona claims with confidence scoring.

### Quality Assessment
Multi-factor quality scoring for evidence units including:
- Source authority (CANONICAL, REPUTABLE, COMMUNITY, INFORMAL)
- Content relevance and clarity
- Corroboration across multiple sources
- Recency and temporal relevance

### Citation Validation
Automated validation of claim-evidence alignment with detailed citation tracking and conflict detection.

## Authentication & Security

### Current State
- No authentication required (development phase)
- Rate limiting per IP address
- Input validation and sanitization
- CORS protection

### Future Implementation
- API key authentication
- JWT token support
- Role-based access control
- Organization-level permissions

## Rate Limiting

- **Default**: 100 requests per minute per IP
- **File Upload**: 10 uploads per minute per IP  
- **LLM Operations**: 5 persona generations per minute per IP

## Error Handling

All errors follow a consistent structure:

```json
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
```

### Common Error Codes
- `VALIDATION_ERROR` - Invalid input data
- `RESOURCE_NOT_FOUND` - Requested resource doesn't exist
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_SERVER_ERROR` - Unexpected server error
- `INSUFFICIENT_EVIDENCE` - Not enough evidence for operation
- `CITATION_VALIDATION_FAILED` - Claim doesn't match evidence

## Pagination

List endpoints support consistent pagination:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

Parameters:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `search` - Search query
- `sortBy` - Field to sort by
- `sortOrder` - 'asc' or 'desc' (default: 'desc')

## Getting Started

1. **Start the API server**:
   ```bash
   cd packages/backend
   npm run dev
   ```

2. **Access documentation**:
   - Open http://localhost:3001/api-docs
   - Try the interactive Swagger UI at http://localhost:3001/api-docs/docs

3. **Create your first project**:
   ```bash
   curl -X POST http://localhost:3001/api/projects \
     -H "Content-Type: application/json" \
     -d '{
       "name": "My First Project",
       "description": "Testing the persona extraction API"
     }'
   ```

4. **Add a source**:
   ```bash
   curl -X POST http://localhost:3001/api/sources \
     -H "Content-Type: application/json" \
     -d '{
       "projectId": "PROJECT_ID_FROM_STEP_3",
       "url": "https://example.com/article",
       "title": "Sample Article",
       "tier": "REPUTABLE"
     }'
   ```

5. **Process evidence and generate personas** using the interactive documentation!

## Testing with Postman/Insomnia

Import the OpenAPI specification from `/api-docs/openapi.json` into your API testing tool:

1. **Postman**: Import → Link → `http://localhost:3001/api-docs/openapi.json`
2. **Insomnia**: Design Document → Import → From URL → `http://localhost:3001/api-docs/openapi.json`

## Development

### Adding New Endpoints

1. **Update OpenAPI specification** in `openapi.ts`
2. **Add request/response examples** in `examples.ts`
3. **Test the documentation** by visiting the Swagger UI
4. **Validate the specification** using online OpenAPI validators

### Documentation Best Practices

- Include comprehensive examples for all endpoints
- Document all error scenarios
- Keep descriptions clear and concise
- Include authentication details when implemented
- Update version numbers when making breaking changes

## Support

For API questions or issues:
- Check the interactive documentation first
- Review the examples in this directory
- File issues in the project repository
- Contact the development team

---

**Version**: 1.0.0  
**Last Updated**: September 16, 2024