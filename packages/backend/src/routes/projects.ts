import { Router } from 'express';
import { z } from 'zod';
import { ProjectRepository } from '../repositories/ProjectRepository.js';
import { validateRequest } from '../middleware/validation.js';
import { schemas } from '../validation/schemas.js';
import { handleAsync, sendSuccess, sendError, sendPaginatedResponse } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import { auditService, AuditAction, AuditResource } from '../services/AuditService.js';
import { createError, ErrorCode, asyncHandler } from '../middleware/errorHandler.js';

const router = Router();
const projectRepo = new ProjectRepository();

// GET /api/projects - List projects with pagination and search
router.get('/', 
  validateRequest({ query: schemas.project.query }),
  asyncHandler(async (req, res) => {
    const { page, limit, search, includeStats } = req.query as any;
    
    logger.debug('Fetching projects list', { 
      page, 
      limit, 
      search, 
      includeStats,
      requestId: req.headers['x-request-id'] 
    });
    
    const result = await projectRepo.findMany({
      page,
      limit,
      search,
      includeStats
    });

    // Log audit trail for view operation
    await auditService.logView(req, AuditResource.PROJECT, 'list', {
      resultCount: result.data.length,
      totalCount: result.pagination.total,
      search,
      includeStats
    });

    return sendPaginatedResponse(
      res,
      result.data,
      page,
      limit,
      result.pagination.total,
      'Projects retrieved successfully'
    );
  })
);

// GET /api/projects/:id - Get project by ID with counts
router.get('/:id',
  validateRequest({ params: schemas.common.cuidParam }),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    
    logger.debug('Fetching project by ID', { 
      projectId: id,
      requestId: req.headers['x-request-id'] 
    });
    
    const project = await projectRepo.findById(id, { 
      sources: true, 
      personas: true 
    });
    
    if (!project) {
      logger.warn('Project not found', { projectId: id });
      throw createError('Project not found', ErrorCode.RESOURCE_NOT_FOUND, 404, { projectId: id });
    }

    // Log audit trail for view operation
    await auditService.logView(req, AuditResource.PROJECT, id, {
      includedRelations: ['sources', 'personas']
    });

    // Get recent activity
    const recentActivity = await projectRepo.getRecentActivity(id, 5);
    
    return sendSuccess(res, {
      ...project,
      recentActivity
    }, 'Project retrieved successfully');
  })
);

// POST /api/projects - Create new project
router.post('/',
  validateRequest({ body: schemas.project.create }),
  handleAsync(async (req, res) => {
    const projectData = req.body;
    
    const project = await projectRepo.create(projectData);
    
    return sendSuccess(res, project, 'Project created successfully', 201);
  })
);

// PUT /api/projects/:id - Update project
router.put('/:id',
  validateRequest({ 
    params: schemas.common.cuidParam,
    body: schemas.project.update 
  }),
  handleAsync(async (req, res) => {
    const { id } = req.params as { id: string };
    const updateData = req.body;
    
    // Check if project exists
    const existingProject = await projectRepo.findById(id);
    if (!existingProject) {
      return sendError(res, 'Project not found', 404);
    }
    
    const project = await projectRepo.update(id, updateData);
    
    return sendSuccess(res, project, 'Project updated successfully');
  })
);

// DELETE /api/projects/:id - Delete project
router.delete('/:id',
  validateRequest({ params: schemas.common.cuidParam }),
  handleAsync(async (req, res) => {
    const { id } = req.params as { id: string };
    
    // Check if project exists
    const existingProject = await projectRepo.findById(id);
    if (!existingProject) {
      return sendError(res, 'Project not found', 404);
    }
    
    await projectRepo.delete(id);
    
    return sendSuccess(res, null, 'Project deleted successfully');
  })
);

// GET /api/projects/:id/activity - Get recent project activity
router.get('/:id/activity',
  validateRequest({ params: schemas.common.cuidParam }),
  handleAsync(async (req, res) => {
    const { id } = req.params as { id: string };
    
    // Check if project exists
    const existingProject = await projectRepo.findById(id);
    if (!existingProject) {
      return sendError(res, 'Project not found', 404);
    }
    
    const activity = await projectRepo.getRecentActivity(id, 20);
    
    return sendSuccess(res, activity, 'Project activity retrieved successfully');
  })
);

export default router;