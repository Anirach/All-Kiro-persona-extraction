import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from '../docs/openapi';

const router = Router();

/**
 * Swagger UI Configuration
 */
const swaggerOptions: swaggerUi.SwaggerUiOptions = {
  explorer: true,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    tryItOutEnabled: true,
    requestInterceptor: (request: any) => {
      // Add any default headers or modify requests here
      request.headers['X-API-Version'] = '1.0.0';
      return request;
    },
    responseInterceptor: (response: any) => {
      // Log responses or modify them here if needed
      console.log('API Response:', {
        url: response.url,
        status: response.status,
        headers: response.headers
      });
      return response;
    }
  },
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info .title { color: #3b82f6; }
    .swagger-ui .info .description p { font-size: 14px; line-height: 1.6; }
    .swagger-ui .scheme-container { background: #f8fafc; padding: 10px; border-radius: 4px; }
    .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #10b981; }
    .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #3b82f6; }
    .swagger-ui .opblock.opblock-put .opblock-summary-method { background: #f59e0b; }
    .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #ef4444; }
  `,
  customSiteTitle: 'Evidence-Based Persona Extraction API Documentation',
  customfavIcon: '/favicon.ico'
};

/**
 * Documentation Routes
 */

// Serve OpenAPI JSON specification
router.get('/openapi.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(openApiSpec);
});

// Serve Swagger UI
router.use('/docs', swaggerUi.serve);
router.get('/docs', swaggerUi.setup(openApiSpec, swaggerOptions));

// Alternative documentation formats
router.get('/docs/redoc', (req, res) => {
  const redocHtml = `
<!DOCTYPE html>
<html>
  <head>
    <title>Evidence-Based Persona Extraction API</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <style>
      body { margin: 0; padding: 0; }
    </style>
  </head>
  <body>
    <redoc spec-url="/api-docs/openapi.json" theme="professional"></redoc>
    <script src="https://cdn.jsdelivr.net/npm/redoc@latest/bundles/redoc.standalone.js"></script>
  </body>
</html>
  `;
  res.send(redocHtml);
});

// Documentation landing page
router.get('/', (req, res) => {
  const landingPage = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Evidence-Based Persona Extraction API</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f8fafc;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 30px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #1f2937;
            margin-bottom: 10px;
            font-size: 2.5em;
        }
        .header p {
            color: #6b7280;
            font-size: 1.2em;
        }
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .feature {
            padding: 20px;
            background: #f9fafb;
            border-radius: 6px;
            border-left: 4px solid #3b82f6;
        }
        .feature h3 {
            margin-top: 0;
            color: #1f2937;
        }
        .links {
            display: flex;
            gap: 15px;
            justify-content: center;
            margin-top: 40px;
        }
        .btn {
            display: inline-block;
            padding: 12px 24px;
            background: #3b82f6;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            transition: background 0.2s;
        }
        .btn:hover {
            background: #2563eb;
        }
        .btn.secondary {
            background: #6b7280;
        }
        .btn.secondary:hover {
            background: #4b5563;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin: 30px 0;
            text-align: center;
        }
        .stat {
            padding: 15px;
            background: #eff6ff;
            border-radius: 6px;
        }
        .stat-number {
            font-size: 2em;
            font-weight: bold;
            color: #2563eb;
        }
        .stat-label {
            color: #6b7280;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Evidence-Based Persona Extraction API</h1>
            <p>Traceable, evidence-bound persona extraction using Large Language Models</p>
        </div>

        <div class="stats">
            <div class="stat">
                <div class="stat-number">40+</div>
                <div class="stat-label">API Endpoints</div>
            </div>
            <div class="stat">
                <div class="stat-number">5</div>
                <div class="stat-label">Resource Types</div>
            </div>
            <div class="stat">
                <div class="stat-number">100%</div>
                <div class="stat-label">Evidence Backed</div>
            </div>
        </div>

        <div class="features">
            <div class="feature">
                <h3>🔍 Evidence-First</h3>
                <p>Every claim must be backed by explicit evidence with citations. No hallucinations allowed.</p>
            </div>
            <div class="feature">
                <h3>📋 Full Traceability</h3>
                <p>Complete audit trail from original sources to final persona claims with confidence scoring.</p>
            </div>
            <div class="feature">
                <h3>⚡ Quality Scoring</h3>
                <p>Multi-factor quality assessment for evidence units and automatic confidence calculations.</p>
            </div>
            <div class="feature">
                <h3>🔗 Citation Validation</h3>
                <p>Automated validation of claim-evidence alignment with detailed citation tracking.</p>
            </div>
        </div>

        <div class="links">
            <a href="/api-docs/docs" class="btn">🚀 Interactive API Docs</a>
            <a href="/api-docs/docs/redoc" class="btn secondary">📖 ReDoc Documentation</a>
            <a href="/api-docs/openapi.json" class="btn secondary">📄 OpenAPI Spec</a>
        </div>

        <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 0.9em;">
            <p><strong>Quick Start:</strong> Visit the interactive docs to explore all endpoints and try them out!</p>
            <p>All endpoints return consistent JSON responses with proper error handling and validation.</p>
        </div>
    </div>
</body>
</html>
  `;
  res.send(landingPage);
});

export default router;