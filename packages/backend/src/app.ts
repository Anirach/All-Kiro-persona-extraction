import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { config, corsConfig, isDevelopment } from './config/env';

// Import logging and error handling
import { 
  logger, 
  requestLoggingMiddleware, 
  logStartup 
} from './utils/logger.js';
import { 
  errorHandler, 
  handleUnhandledRejection, 
  handleUncaughtException 
} from './middleware/errorHandler.js';

// Import route handlers
import projectsRouter from './routes/projects.js';
import sourcesRouter from './routes/sources.js';
import evidenceRouter from './routes/evidence.js';
import personasRouter from './routes/personas.js';
import claimsRouter from './routes/claims.js';
import docsRouter from './routes/docs.js';

// Import health check handlers
import { 
  basicHealthCheck, 
  detailedHealthCheck, 
  readinessCheck, 
  livenessCheck 
} from './routes/health.js';

// Set up process-level error handlers
process.on('unhandledRejection', handleUnhandledRejection);
process.on('uncaughtException', handleUncaughtException);

const app = express();

// Log application startup
logStartup();

// Request ID middleware (before any logging)
app.use((req, res, next) => {
  if (!req.headers['x-request-id']) {
    req.headers['x-request-id'] = `req_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }
  next();
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
app.use(cors(corsConfig));

// General middleware
app.use(compression());

// Use custom request logging instead of morgan in production
if (isDevelopment) {
  app.use(morgan('dev'));
} else {
  app.use(requestLoggingMiddleware);
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoints (no auth required)
app.get('/health', basicHealthCheck);
app.get('/health/detailed', detailedHealthCheck);
app.get('/health/ready', readinessCheck);
app.get('/health/live', livenessCheck);

// API routes placeholder
app.get('/api', (req, res) => {
  logger.info('API root accessed', { 
    path: req.path, 
    method: req.method,
    userAgent: req.get('User-Agent')
  });
  
  res.json({
    message: 'Evidence-Based Persona Extraction API',
    version: process.env.npm_package_version || '1.0.0',
    documentation: '/api-docs',
    health: '/health',
    endpoints: {
      projects: '/api/projects',
      sources: '/api/sources', 
      evidence: '/api/evidence',
      personas: '/api/personas',
      claims: '/api/claims'
    }
  });
});

// API route handlers
app.use('/api/projects', projectsRouter);
app.use('/api/sources', sourcesRouter);
app.use('/api/evidence', evidenceRouter);
app.use('/api/personas', personasRouter);
app.use('/api/claims', claimsRouter);

// API documentation routes
app.use('/api-docs', docsRouter);

// 404 handler
app.use('*', (req, res) => {
  logger.warn('Route not found', { 
    path: req.originalUrl, 
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.originalUrl} not found`,
      path: req.originalUrl,
      method: req.method
    },
    timestamp: new Date().toISOString()
  });
});

// Use new structured error handler
app.use(errorHandler);

const PORT = config.PORT;

const server = app.listen(PORT, () => {
  logger.info('Server started successfully', {
    port: PORT,
    environment: config.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    pid: process.pid
  });
  
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📚 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Environment: ${config.NODE_ENV}`);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default app;
