import { Router } from 'express';
import { z } from 'zod';
import { EvidenceRepository } from '../repositories/EvidenceRepository.js';
import { validateRequest } from '../middleware/validation.js';
import { schemas } from '../validation/schemas.js';
import { handleAsync, sendSuccess, sendError, sendPaginatedResponse } from '../utils/asyncHandler.js';

const router = Router();
const evidenceRepo = new EvidenceRepository();

// GET /api/evidence - List evidence units with filtering
router.get('/',
  validateRequest({ query: schemas.evidence.query }),
  handleAsync(async (req, res) => {
    const { page, limit, search, sourceId, projectId, minQualityScore, topics } = req.query as any;
    
    const result = await evidenceRepo.findMany({
      page,
      limit,
      search,
      sourceId,
      projectId,
      minQualityScore,
      topics
    });

    return sendPaginatedResponse(
      res,
      result.data,
      page,
      limit,
      result.pagination.total,
      'Evidence units retrieved successfully'
    );
  })
);

// GET /api/evidence/:id - Get evidence unit by ID
router.get('/:id',
  validateRequest({ params: schemas.common.cuidParam }),
  handleAsync(async (req, res) => {
    const { id } = req.params as { id: string };
    
    const evidenceUnit = await evidenceRepo.findById(id);
    
    if (!evidenceUnit) {
      return sendError(res, 'Evidence unit not found', 404);
    }

    return sendSuccess(res, evidenceUnit, 'Evidence unit retrieved successfully');
  })
);

// PUT /api/evidence/:id - Update evidence unit
router.put('/:id',
  validateRequest({
    params: schemas.common.cuidParam,
    body: schemas.evidence.update
  }),
  handleAsync(async (req, res) => {
    const { id } = req.params as { id: string };
    const updateData = req.body;
    
    // Check if evidence unit exists
    const existingUnit = await evidenceRepo.findById(id);
    if (!existingUnit) {
      return sendError(res, 'Evidence unit not found', 404);
    }
    
    // Transform metadata to JSON string if provided
    const updateWithStringMetadata = {
      ...updateData,
      ...(updateData.metadata && { metadata: JSON.stringify(updateData.metadata) })
    };
    
    const evidenceUnit = await evidenceRepo.update(id, updateWithStringMetadata);
    
    return sendSuccess(res, evidenceUnit, 'Evidence unit updated successfully');
  })
);

// PUT /api/evidence/bulk-update - Bulk update evidence unit quality scores
router.put('/bulk-update',
  validateRequest({
    body: z.object({
      evidenceUnitIds: z.array(z.string().cuid()).min(1, 'At least one evidence unit ID is required'),
      qualityScore: z.number().min(0).max(1).optional(),
      topics: z.array(z.string()).optional()
    })
  }),
  handleAsync(async (req, res) => {
    const { evidenceUnitIds, qualityScore, topics } = req.body;
    
    let updatedCount = 0;
    
    // Update quality scores if provided
    if (qualityScore !== undefined) {
      for (const id of evidenceUnitIds) {
        try {
          await evidenceRepo.updateQualityScore(id, qualityScore);
          updatedCount++;
        } catch (error) {
          // Skip failed updates but continue
          console.warn(`Failed to update quality score for evidence unit ${id}:`, error);
        }
      }
    }
    
    // Update topics if provided
    if (topics) {
      for (const id of evidenceUnitIds) {
        try {
          await evidenceRepo.updateTopics(id, topics);
          if (qualityScore === undefined) updatedCount++; // Only count if not already counted
        } catch (error) {
          // Skip failed updates but continue
          console.warn(`Failed to update topics for evidence unit ${id}:`, error);
        }
      }
    }
    
    return sendSuccess(res, {
      updatedCount
    }, 'Evidence units updated successfully');
  })
);

// DELETE /api/evidence/:id - Delete evidence unit
router.delete('/:id',
  validateRequest({ params: schemas.common.cuidParam }),
  handleAsync(async (req, res) => {
    const { id } = req.params as { id: string };
    
    // Check if evidence unit exists
    const existingUnit = await evidenceRepo.findById(id);
    if (!existingUnit) {
      return sendError(res, 'Evidence unit not found', 404);
    }
    
    await evidenceRepo.delete(id);
    
    return sendSuccess(res, null, 'Evidence unit deleted successfully');
  })
);

// DELETE /api/evidence/bulk-delete - Bulk delete evidence units
router.delete('/bulk-delete',
  validateRequest({
    body: z.object({
      evidenceUnitIds: z.array(z.string().cuid()).min(1, 'At least one evidence unit ID is required')
    })
  }),
  handleAsync(async (req, res) => {
    const { evidenceUnitIds } = req.body;
    
    const result = await evidenceRepo.bulkDelete(evidenceUnitIds);
    
    return sendSuccess(res, {
      deletedCount: result.deleted
    }, 'Evidence units deleted successfully');
  })
);

// GET /api/evidence/search - Search evidence units by content (using existing findMany)
router.get('/search',
  validateRequest({
    query: z.object({
      q: z.string().min(1, 'Search query is required'),
      projectId: z.string().cuid().optional(),
      sourceId: z.string().cuid().optional(),
      minQualityScore: z.coerce.number().min(0).max(1).optional(),
      topics: z.string().optional().transform(val => val ? val.split(',') : undefined),
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(20)
    })
  }),
  handleAsync(async (req, res) => {
    const { q, projectId, sourceId, minQualityScore, topics, page, limit } = req.query as any;
    
    // Use the existing findMany method with search parameter
    const result = await evidenceRepo.findMany({
      page,
      limit,
      search: q,
      projectId,
      sourceId,
      minQualityScore,
      topics
    });
    
    return sendPaginatedResponse(
      res,
      result.data,
      page,
      limit,
      result.pagination.total,
      'Evidence units found'
    );
  })
);

// GET /api/evidence/stats/:sourceId - Get statistics for evidence units by source
router.get('/stats/:sourceId',
  validateRequest({ params: schemas.common.cuidParam }),
  handleAsync(async (req, res) => {
    const { sourceId } = req.params as { sourceId: string };
    
    const stats = await evidenceRepo.getSourceStats(sourceId);
    
    return sendSuccess(res, stats, 'Evidence statistics retrieved successfully');
  })
);

export default router;