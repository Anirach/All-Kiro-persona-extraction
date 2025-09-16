import { Router, Request } from 'express';
import { z } from 'zod';
import { SourceRepository } from '../repositories/SourceRepository.js';
import { EvidenceRepository } from '../repositories/EvidenceRepository.js';
import { EvidenceService } from '../services/EvidenceService.js';
import { validateRequest, validateFileUpload, MulterRequest } from '../middleware/validation.js';
import { schemas } from '../validation/schemas.js';
import { handleAsync, sendSuccess, sendError, sendPaginatedResponse } from '../utils/asyncHandler.js';

const router = Router();
const sourceRepo = new SourceRepository();
const evidenceRepo = new EvidenceRepository();
const evidenceService = new EvidenceService(evidenceRepo, sourceRepo);
  projectId: z.string().cuid('Invalid project ID'),
// GET /api/sources - List sources with filtering
router.get('/',
  validateRequest({ query: schemas.source.query }),
  handleAsync(async (req, res) => {
    const { page, limit, search, projectId, tier } = req.query as any;
    
    const result = await sourceRepo.findMany({
      page,
      limit,
      search,
      projectId,
      tier
    });

    return sendPaginatedResponse(
      res,
      result.data,
      page,
      limit,
      result.pagination.total,
      'Sources retrieved successfully'
    );
  })
);

// GET /api/sources/:id - Get source by ID
router.get('/:id',
  validateRequest({ params: schemas.common.cuidParam }),
  handleAsync(async (req, res) => {
    const { id } = req.params as { id: string };
    
    const source = await sourceRepo.findById(id, {
      evidenceUnits: true
    });
    
    if (!source) {
      return sendError(res, 'Source not found', 404);
    }

    return sendSuccess(res, source, 'Source retrieved successfully');
  })
);

// POST /api/sources - Create new source
router.post('/',
  validateRequest({ body: schemas.source.create }),
  handleAsync(async (req, res) => {
    const sourceData = req.body;
    
    // Transform metadata to JSON string as required by schema
    const createData = {
      ...sourceData,
      metadata: JSON.stringify(sourceData.metadata),
      project: {
        connect: { id: sourceData.projectId }
      }
    };
    
    delete (createData as any).projectId;
    
    const source = await sourceRepo.create(createData);
    
    return sendSuccess(res, source, 'Source created successfully', 201);
  })
);

// POST /api/sources/upload - Upload and create source from file
router.post('/upload',
  validateFileUpload(),
  validateRequest({ body: schemas.source.upload }),
  handleAsync(async (req: MulterRequest, res) => {
    const { projectId, name, tier, url, author, publishedAt, processEvidence, metadata } = req.body;
    const file = req.file;
    
    if (!file) {
      return sendError(res, 'No file uploaded', 400);
    }

    // Extract text content from file
    let content: string;
    try {
      content = file.buffer.toString('utf-8');
    } catch (error) {
      return sendError(res, 'Unable to read file content', 400);
    }

    const sourceMetadata = {
      ...metadata,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      uploadedContent: true
    };

    const createData = {
      name: name || file.originalname,
      url: url || `file://${file.originalname}`, // Create a file URL for uploaded files
      tier,
      author,
      publishedAt: publishedAt ? new Date(publishedAt) : undefined,
      content,
      metadata: sourceMetadata,
      project: {
        connect: { id: projectId }
      }
    };

    const source = await sourceRepo.create(createData);
    
    // If content is provided and processing is requested, process it immediately
    if (processEvidence && content.trim().length > 0) {
      try {
        await evidenceService.processSourceText(
          content,
          source.id,
          {
            qualityThreshold: 0.3,
            confidenceThreshold: 0.5,
            deduplicationEnabled: true
          }
        );
      } catch (error) {
        console.error('Error processing uploaded content:', error);
        // Don't fail the upload if processing fails
      }
    }
    
    return sendSuccess(res, source, 'Source uploaded and processed successfully', 201);
  })
);

// PUT /api/sources/:id - Update source
router.put('/:id',
  validateRequest({
    params: schemas.common.cuidParam,
    body: schemas.source.update
  }),
  handleAsync(async (req, res) => {
    const { id } = req.params as { id: string };
    const updateData = req.body;
    
    // Check if source exists
    const existingSource = await sourceRepo.findById(id);
    if (!existingSource) {
      return sendError(res, 'Source not found', 404);
    }
    
    const source = await sourceRepo.update(id, updateData);
    
    return sendSuccess(res, source, 'Source updated successfully');
  })
);

// POST /api/sources/:id/process - Process source content to generate evidence units
router.post('/:id/process',
  validateRequest({
    params: schemas.common.cuidParam,
    body: schemas.source.process
  }),
  handleAsync(async (req, res) => {
    const { id } = req.params as { id: string };
    const { content, generateEvidenceUnits, deduplicationThreshold, unitizationOptions } = req.body;
    
    // Check if source exists
    const source = await sourceRepo.findById(id);
    if (!source) {
      return sendError(res, 'Source not found', 404);
    }
    
    if (!generateEvidenceUnits) {
      return sendSuccess(res, { processed: false }, 'Source processing skipped');
    }

    // Process source content to generate evidence units
    const result = await evidenceService.processSourceText(
      content,
      id,
      {
        qualityThreshold: 0.3,
        confidenceThreshold: 0.5,
        deduplicationEnabled: true,
        deduplicationConfig: {
          threshold: deduplicationThreshold
        },
        ...unitizationOptions
      }
    );
    
    return sendSuccess(res, {
      processed: true,
      evidenceUnitsCreated: result.processedUnits,
      duplicatesRemoved: result.deduplicatedUnits,
      totalUnits: result.totalUnits,
      rejectedUnits: result.rejectedUnits,
      processingStats: result.stats
    }, 'Source processed successfully');
  })
);

// DELETE /api/sources/:id - Delete source
router.delete('/:id',
  validateRequest({ params: schemas.common.cuidParam }),
  handleAsync(async (req, res) => {
    const { id } = req.params as { id: string };
    
    // Check if source exists
    const existingSource = await sourceRepo.findById(id);
    if (!existingSource) {
      return sendError(res, 'Source not found', 404);
    }
    
    await sourceRepo.delete(id);
    
    return sendSuccess(res, null, 'Source deleted successfully');
  })
);

// GET /api/sources/:id/evidence-units - Get evidence units for a source
router.get('/:id/evidence-units',
  validateRequest({
    params: schemas.common.cuidParam,
    query: schemas.common.paginationQuery.extend({
      qualityThreshold: z.coerce.number().min(0).max(1).optional(),
      topics: z.string().optional().transform(val => val ? val.split(',') : undefined)
    })
  }),
  handleAsync(async (req, res) => {
    const { id } = req.params as { id: string };
    const { page, limit, qualityThreshold, topics } = req.query as any;
    
    // Check if source exists
    const source = await sourceRepo.findById(id);
    if (!source) {
      return sendError(res, 'Source not found', 404);
    }
    
    // Use evidence repository to get units by source
    const result = await evidenceRepo.findMany({
      page,
      limit,
      sourceId: id,
      minQualityScore: qualityThreshold,
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

export default router;