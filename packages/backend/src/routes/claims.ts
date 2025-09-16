import { Router } from 'express';
import { z } from 'zod';
import { PersonaRepository } from '../repositories/PersonaRepository.js';
import { validateRequest } from '../middleware/validation.js';
import { schemas } from '../validation/schemas.js';
import { handleAsync, sendSuccess, sendError } from '../utils/asyncHandler.js';

const router = Router();
const personaRepo = new PersonaRepository();

// ============================================================================
// CLAIMS ENDPOINTS
// ============================================================================

// POST /api/claims - Create new claim for a persona
router.post('/',
  validateRequest({ body: schemas.claim.create }),
  handleAsync(async (req, res) => {
    const { personaId, type } = req.body;
    
    const claim = await personaRepo.createClaim(personaId, {
      type
    });
    
    return sendSuccess(res, claim, 'Claim created successfully', 201);
  })
);

// GET /api/claims/:id/fields - Get fields for a claim
router.get('/:id/fields',
  validateRequest({ params: schemas.common.cuidParam }),
  handleAsync(async (req, res) => {
    const { id } = req.params as { id: string };
    
    const fields = await personaRepo.getClaimFields(id);
    
    return sendSuccess(res, fields, 'Claim fields retrieved successfully');
  })
);

// ============================================================================
// CLAIM FIELDS ENDPOINTS
// ============================================================================

// POST /api/claims/fields - Create new claim field
router.post('/fields',
  validateRequest({ body: schemas.claim.createField }),
  handleAsync(async (req, res) => {
    const { claimId, text, confidence } = req.body;
    
    const field = await personaRepo.createClaimField(claimId, {
      text,
      confidence
    });
    
    return sendSuccess(res, field, 'Claim field created successfully', 201);
  })
);

// PUT /api/claims/fields/:id - Update claim field
router.put('/fields/:id',
  validateRequest({
    params: schemas.common.cuidParam,
    body: schemas.claim.updateField
  }),
  handleAsync(async (req, res) => {
    const { id } = req.params as { id: string };
    const updateData = req.body;
    
    const field = await personaRepo.updateClaimField(id, updateData);
    
    return sendSuccess(res, field, 'Claim field updated successfully');
  })
);

// DELETE /api/claims/fields/:id - Delete claim field
router.delete('/fields/:id',
  validateRequest({ params: schemas.common.cuidParam }),
  handleAsync(async (req, res) => {
    const { id } = req.params as { id: string };
    
    await personaRepo.deleteClaimField(id);
    
    return sendSuccess(res, null, 'Claim field deleted successfully');
  })
);

// ============================================================================
// CITATIONS ENDPOINTS
// ============================================================================

// POST /api/claims/citations - Create new citation
router.post('/citations',
  validateRequest({ body: schemas.claim.createCitation }),
  handleAsync(async (req, res) => {
    const { claimFieldId, sentenceIndex, evidenceIds } = req.body;
    
    const citation = await personaRepo.createCitation(claimFieldId, {
      sentenceIndex,
      evidenceIds: JSON.stringify(evidenceIds)
    });
    
    return sendSuccess(res, citation, 'Citation created successfully', 201);
  })
);

// PUT /api/claims/citations/:id - Update citation
router.put('/citations/:id',
  validateRequest({
    params: schemas.common.cuidParam,
    body: schemas.claim.updateCitation
  }),
  handleAsync(async (req, res) => {
    const { id } = req.params as { id: string };
    const updateData = req.body;
    
    // Transform evidenceIds to JSON string if provided
    const updateWithJsonIds = {
      ...updateData,
      ...(updateData.evidenceIds && { 
        evidenceIds: JSON.stringify(updateData.evidenceIds) 
      })
    };
    
    const citation = await personaRepo.updateCitation(id, updateWithJsonIds);
    
    return sendSuccess(res, citation, 'Citation updated successfully');
  })
);

// DELETE /api/claims/citations/:id - Delete citation
router.delete('/citations/:id',
  validateRequest({ params: schemas.common.cuidParam }),
  handleAsync(async (req, res) => {
    const { id } = req.params as { id: string };
    
    await personaRepo.deleteCitation(id);
    
    return sendSuccess(res, null, 'Citation deleted successfully');
  })
);

// ============================================================================
// BULK OPERATIONS
// ============================================================================

// POST /api/claims/bulk-create-fields - Bulk create claim fields with citations
router.post('/bulk-create-fields',
  validateRequest({
    body: z.object({
      claimId: z.string().cuid('Invalid claim ID'),
      fields: z.array(z.object({
        text: z.string().min(1),
        confidence: z.number().min(0).max(1).default(0.8),
        citations: z.array(z.object({
          sentenceIndex: z.number().int().min(0),
          evidenceIds: z.array(z.string().cuid()).min(1)
        })).optional()
      })).min(1, 'At least one field is required')
    })
  }),
  handleAsync(async (req, res) => {
    const { claimId, fields } = req.body;
    
    const createdFields = [];
    
    for (const fieldData of fields) {
      // Create the claim field
      const field = await personaRepo.createClaimField(claimId, {
        text: fieldData.text,
        confidence: fieldData.confidence
      });
      
      // Create citations if provided
      if (fieldData.citations) {
        for (const citationData of fieldData.citations) {
          await personaRepo.createCitation(field.id, {
            sentenceIndex: citationData.sentenceIndex,
            evidenceIds: JSON.stringify(citationData.evidenceIds)
          });
        }
      }
      
      createdFields.push(field);
    }
    
    return sendSuccess(res, {
      fieldsCreated: createdFields.length,
      fields: createdFields
    }, 'Claim fields created successfully', 201);
  })
);

export default router;