import { Router } from 'express';
import { z } from 'zod';
import { PersonaRepository } from '../repositories/PersonaRepository.js';
import { validateRequest } from '../middleware/validation.js';
import { schemas } from '../validation/schemas.js';
import { handleAsync, sendSuccess, sendError, sendPaginatedResponse } from '../utils/asyncHandler.js';

const router = Router();
const personaRepo = new PersonaRepository();

// GET /api/personas - List personas with filtering
router.get('/',
  validateRequest({ query: schemas.persona.query }),
  handleAsync(async (req, res) => {
    const { page, limit, projectId, status } = req.query as any;
    
    const result = await personaRepo.findMany({
      page,
      limit,
      projectId,
      status
    });

    return sendPaginatedResponse(
      res,
      result.data,
      page,
      limit,
      result.pagination.total,
      'Personas retrieved successfully'
    );
  })
);

// GET /api/personas/:id - Get persona by ID with full details
router.get('/:id',
  validateRequest({ params: schemas.common.cuidParam }),
  handleAsync(async (req, res) => {
    const { id } = req.params as { id: string };
    
    const persona = await personaRepo.findById(id, {
      claims: true,
      fullRelations: true
    });
    
    if (!persona) {
      return sendError(res, 'Persona not found', 404);
    }

    return sendSuccess(res, persona, 'Persona retrieved successfully');
  })
);

// POST /api/personas - Create new persona (manual)
router.post('/',
  validateRequest({ body: schemas.persona.create }),
  handleAsync(async (req, res) => {
    const personaData = req.body;
    
    const createData = {
      ...personaData,
      project: {
        connect: { id: personaData.projectId }
      }
    };
    
    delete (createData as any).projectId;
    
    const persona = await personaRepo.create(createData);
    
    return sendSuccess(res, persona, 'Persona created successfully', 201);
  })
);

// POST /api/personas/generate - Generate persona from evidence units
router.post('/generate',
  validateRequest({ body: schemas.persona.generate }),
  handleAsync(async (req, res) => {
    const {
      projectId,
      evidenceUnitIds,
      extractionType,
      specificFields,
      conflictHandling,
      requireCitations
    } = req.body;
    
    // This would integrate with the LLM service for persona generation
    // For now, create a placeholder persona structure
    
    const personaData = {
      status: 'DRAFT' as const,
      project: {
        connect: { id: projectId }
      }
    };
    
    const persona = await personaRepo.create(personaData);
    
    // TODO: Integrate with LLM service to generate claims and fields
    // For now, return the created persona structure
    
    return sendSuccess(res, {
      ...persona,
      generationNote: 'Persona created. LLM-based claim generation will be implemented in a future update.',
      generationConfig: {
        evidenceUnitIds,
        extractionType,
        specificFields,
        conflictHandling,
        requireCitations
      }
    }, 'Persona generation initiated successfully', 201);
  })
);

// PUT /api/personas/:id - Update persona
router.put('/:id',
  validateRequest({
    params: schemas.common.cuidParam,
    body: schemas.persona.update
  }),
  handleAsync(async (req, res) => {
    const { id } = req.params as { id: string };
    const updateData = req.body;
    
    // Check if persona exists
    const existingPersona = await personaRepo.findById(id);
    if (!existingPersona) {
      return sendError(res, 'Persona not found', 404);
    }
    
    const persona = await personaRepo.update(id, updateData);
    
    return sendSuccess(res, persona, 'Persona updated successfully');
  })
);

// PUT /api/personas/:id/approve - Approve or reject persona
router.put('/:id/approve',
  validateRequest({
    params: schemas.common.cuidParam,
    body: schemas.persona.approve
  }),
  handleAsync(async (req, res) => {
    const { id } = req.params as { id: string };
    const { status } = req.body;
    
    // Check if persona exists
    const existingPersona = await personaRepo.findById(id);
    if (!existingPersona) {
      return sendError(res, 'Persona not found', 404);
    }
    
    // Use the updateStatus method which should be available
    const persona = await personaRepo.updateStatus(id, status);
    
    return sendSuccess(res, persona, `Persona ${status.toLowerCase()} successfully`);
  })
);

// DELETE /api/personas/:id - Delete persona
router.delete('/:id',
  validateRequest({ params: schemas.common.cuidParam }),
  handleAsync(async (req, res) => {
    const { id } = req.params as { id: string };
    
    // Check if persona exists
    const existingPersona = await personaRepo.findById(id);
    if (!existingPersona) {
      return sendError(res, 'Persona not found', 404);
    }
    
    await personaRepo.delete(id);
    
    return sendSuccess(res, null, 'Persona deleted successfully');
  })
);

// GET /api/personas/:id/claims - Get claims for a persona
router.get('/:id/claims',
  validateRequest({ params: schemas.common.cuidParam }),
  handleAsync(async (req, res) => {
    const { id } = req.params as { id: string };
    
    // Check if persona exists and get it with claims
    const persona = await personaRepo.findById(id, {
      claims: true
    });
    
    if (!persona) {
      return sendError(res, 'Persona not found', 404);
    }
    
    return sendSuccess(res, (persona as any).claims || [], 'Persona claims retrieved successfully');
  })
);

// GET /api/personas/:id/export - Export persona in structured format
router.get('/:id/export',
  validateRequest({
    params: schemas.common.cuidParam,
    query: z.object({
      format: z.enum(['json', 'markdown']).default('json'),
      includeEvidence: z.coerce.boolean().default(true),
      includeCitations: z.coerce.boolean().default(true)
    })
  }),
  handleAsync(async (req, res) => {
    const { id } = req.params as { id: string };
    const { format, includeEvidence, includeCitations } = req.query as any;
    
    const persona = await personaRepo.findById(id, {
      claims: true,
      fullRelations: true
    });
    
    if (!persona) {
      return sendError(res, 'Persona not found', 404);
    }
    
    // Set appropriate content type based on format
    if (format === 'markdown') {
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="persona-${id}.md"`);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="persona-${id}.json"`);
    }
    
    return sendSuccess(res, {
      persona,
      exportFormat: format,
      exportedAt: new Date().toISOString(),
      options: {
        includeEvidence,
        includeCitations
      }
    }, 'Persona exported successfully');
  })
);

export default router;