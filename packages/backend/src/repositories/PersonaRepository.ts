import { Persona, Claim, ClaimField, Citation, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { safeDbOperation, withTransaction, paginate, PaginatedResult, PaginationOptions, buildSearchWhere } from '../lib/database';

/**
 * Repository for Persona entity operations
 * Provides CRUD operations and persona-specific business logic
 */
export class PersonaRepository {
  /**
   * Create a new persona
   */
  async create(data: Prisma.PersonaCreateInput): Promise<Persona> {
    return safeDbOperation(
      async () => {
        return await prisma.persona.create({
          data,
          include: {
            project: {
              select: { id: true, name: true },
            },
            claims: {
              include: {
                fields: {
                  include: {
                    citations: true,
                  },
                },
              },
            },
          },
        });
      },
      'PersonaRepository.create'
    );
  }

  /**
   * Find persona by ID with optional relations
   */
  async findById(
    id: string,
    include?: {
      project?: boolean;
      claims?: boolean;
      fullRelations?: boolean;
    }
  ): Promise<Persona | null> {
    return safeDbOperation(
      async () => {
        const includeOptions: Prisma.PersonaInclude = {};

        if (include?.project || include?.fullRelations) {
          includeOptions.project = {
            select: { id: true, name: true, description: true },
          };
        }

        if (include?.claims || include?.fullRelations) {
          includeOptions.claims = {
            include: {
              fields: {
                include: {
                  citations: true,
                },
                orderBy: { createdAt: 'asc' },
              },
            },
            orderBy: { createdAt: 'asc' },
          };
        }

        return await prisma.persona.findUnique({
          where: { id },
          include: Object.keys(includeOptions).length > 0 ? includeOptions : undefined,
        });
      },
      'PersonaRepository.findById'
    );
  }

  /**
   * Find personas by project ID with pagination and filtering
   */
  async findByProjectId(
    projectId: string,
    options: PaginationOptions & {
      status?: string;
      includeClaimCount?: boolean;
    } = {}
  ): Promise<PaginatedResult<Persona & { _count?: { claims: number } }>> {
    const { status, includeClaimCount, ...paginationOptions } = options;

    return safeDbOperation(
      async () => {
        // Build where clause
        const where: Prisma.PersonaWhereInput = {
          projectId,
          ...(status && { status }),
        };

        // Build include clause
        const include: Prisma.PersonaInclude = includeClaimCount
          ? {
              _count: {
                select: { claims: true },
              },
            }
          : {};

        return await paginate(
          prisma.persona,
          paginationOptions,
          where,
          Object.keys(include).length > 0 ? include : undefined
        );
      },
      'PersonaRepository.findByProjectId'
    );
  }

  /**
   * Find all personas with pagination and search
   */
  async findMany(
    options: PaginationOptions & {
      projectId?: string;
      status?: string;
      includeStats?: boolean;
    } = {}
  ): Promise<PaginatedResult<Persona & { _count?: { claims: number } }>> {
    const { projectId, status, includeStats, ...paginationOptions } = options;

    return safeDbOperation(
      async () => {
        // Build where clause
        const where: Prisma.PersonaWhereInput = {
          ...(projectId && { projectId }),
          ...(status && { status }),
        };

        // Build include clause
        const include: Prisma.PersonaInclude = includeStats
          ? {
              _count: {
                select: { claims: true },
              },
              project: {
                select: { id: true, name: true },
              },
            }
          : {};

        return await paginate(
          prisma.persona,
          paginationOptions,
          where,
          Object.keys(include).length > 0 ? include : undefined
        );
      },
      'PersonaRepository.findMany'
    );
  }

  /**
   * Update persona by ID
   */
  async update(id: string, data: Prisma.PersonaUpdateInput): Promise<Persona> {
    return safeDbOperation(
      async () => {
        return await prisma.persona.update({
          where: { id },
          data,
          include: {
            _count: {
              select: { claims: true },
            },
          },
        });
      },
      'PersonaRepository.update'
    );
  }

  /**
   * Update persona status
   */
  async updateStatus(id: string, status: string): Promise<Persona> {
    return safeDbOperation(
      async () => {
        return await prisma.persona.update({
          where: { id },
          data: { 
            status,
            updatedAt: new Date(),
          },
        });
      },
      'PersonaRepository.updateStatus'
    );
  }

  /**
   * Delete persona by ID (cascades to claims and citations)
   */
  async delete(id: string): Promise<void> {
    return safeDbOperation(
      async () => {
        await prisma.persona.delete({
          where: { id },
        });
      },
      'PersonaRepository.delete'
    );
  }

  /**
   * Create a claim for a persona
   */
  async createClaim(personaId: string, data: Omit<Prisma.ClaimCreateInput, 'persona'>): Promise<Claim> {
    return safeDbOperation(
      async () => {
        return await prisma.claim.create({
          data: {
            ...data,
            persona: { connect: { id: personaId } },
          },
          include: {
            fields: {
              include: {
                citations: true,
              },
            },
          },
        });
      },
      'PersonaRepository.createClaim'
    );
  }

  /**
   * Create a claim field for a claim
   */
  async createClaimField(
    claimId: string, 
    data: Omit<Prisma.ClaimFieldCreateInput, 'claim'>,
    citations?: Array<Omit<Prisma.CitationCreateInput, 'claimField'>>
  ): Promise<ClaimField> {
    return withTransaction(async (tx) => {
      // Create the claim field
      const claimField = await tx.claimField.create({
        data: {
          ...data,
          claim: { connect: { id: claimId } },
        },
      });

      // Create citations if provided
      if (citations && citations.length > 0) {
        await tx.citation.createMany({
          data: citations.map(citation => ({
            ...citation,
            claimFieldId: claimField.id,
          })),
        });
      }

      // Return the claim field with citations
      return await tx.claimField.findUnique({
        where: { id: claimField.id },
        include: {
          citations: true,
        },
      }) as ClaimField;
    });
  }

  /**
   * Update a claim field
   */
  async updateClaimField(id: string, data: Prisma.ClaimFieldUpdateInput): Promise<ClaimField> {
    return safeDbOperation(
      async () => {
        return await prisma.claimField.update({
          where: { id },
          data,
          include: {
            citations: true,
          },
        });
      },
      'PersonaRepository.updateClaimField'
    );
  }

  /**
   * Delete a claim field (cascades to citations)
   */
  async deleteClaimField(id: string): Promise<void> {
    return safeDbOperation(
      async () => {
        await prisma.claimField.delete({
          where: { id },
        });
      },
      'PersonaRepository.deleteClaimField'
    );
  }

  /**
   * Create citation for a claim field
   */
  async createCitation(claimFieldId: string, data: Omit<Prisma.CitationCreateInput, 'claimField'>): Promise<Citation> {
    return safeDbOperation(
      async () => {
        return await prisma.citation.create({
          data: {
            ...data,
            claimField: { connect: { id: claimFieldId } },
          },
        });
      },
      'PersonaRepository.createCitation'
    );
  }

  /**
   * Update citation
   */
  async updateCitation(id: string, data: Prisma.CitationUpdateInput): Promise<Citation> {
    return safeDbOperation(
      async () => {
        return await prisma.citation.update({
          where: { id },
          data,
        });
      },
      'PersonaRepository.updateCitation'
    );
  }

  /**
   * Delete citation
   */
  async deleteCitation(id: string): Promise<void> {
    return safeDbOperation(
      async () => {
        await prisma.citation.delete({
          where: { id },
        });
      },
      'PersonaRepository.deleteCitation'
    );
  }

  /**
   * Get persona statistics
   */
  async getStats(id: string): Promise<{
    claimCount: number;
    claimFieldCount: number;
    citationCount: number;
    averageConfidence: number | null;
    confidenceDistribution: {
      high: number; // >= 0.8
      medium: number; // 0.4 - 0.8
      low: number; // < 0.4
    };
    claimTypeDistribution: Record<string, number>;
  }> {
    return safeDbOperation(
      async () => {
        const [persona, claimFields, aggregateStats] = await Promise.all([
          // Get persona with claims
          prisma.persona.findUnique({
            where: { id },
            include: {
              claims: {
                include: {
                  fields: {
                    include: {
                      citations: true,
                    },
                  },
                },
              },
            },
          }),

          // Get all claim fields for confidence calculations
          prisma.claimField.findMany({
            where: {
              claim: {
                personaId: id,
              },
            },
            select: { confidence: true },
          }),

          // Get aggregate statistics
          prisma.claimField.aggregate({
            where: {
              claim: {
                personaId: id,
              },
            },
            _avg: { confidence: true },
          }),
        ]);

        if (!persona) {
          throw new Error('Persona not found');
        }

        // Calculate confidence distribution
        const confidenceDistribution = {
          high: 0,
          medium: 0,
          low: 0,
        };

        claimFields.forEach((field) => {
          if (field.confidence >= 0.8) {
            confidenceDistribution.high++;
          } else if (field.confidence >= 0.4) {
            confidenceDistribution.medium++;
          } else {
            confidenceDistribution.low++;
          }
        });

        // Calculate claim type distribution
        const claimTypeDistribution: Record<string, number> = {};
        persona.claims.forEach((claim) => {
          claimTypeDistribution[claim.type] = (claimTypeDistribution[claim.type] || 0) + 1;
        });

        // Count citations
        const citationCount = persona.claims.reduce((total, claim) => {
          return total + claim.fields.reduce((fieldTotal, field) => {
            return fieldTotal + field.citations.length;
          }, 0);
        }, 0);

        return {
          claimCount: persona.claims.length,
          claimFieldCount: claimFields.length,
          citationCount,
          averageConfidence: aggregateStats._avg.confidence,
          confidenceDistribution,
          claimTypeDistribution,
        };
      },
      'PersonaRepository.getStats'
    );
  }

  /**
   * Check if persona exists
   */
  async exists(id: string): Promise<boolean> {
    return safeDbOperation(
      async () => {
        const count = await prisma.persona.count({
          where: { id },
        });
        return count > 0;
      },
      'PersonaRepository.exists'
    );
  }

  /**
   * Bulk delete personas
   */
  async bulkDelete(ids: string[]): Promise<{ deleted: number }> {
    return withTransaction(async (tx) => {
      const result = await tx.persona.deleteMany({
        where: {
          id: { in: ids },
        },
      });

      return { deleted: result.count };
    });
  }

  /**
   * Get personas by status for a project
   */
  async findByStatus(
    projectId: string,
    status: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Persona>> {
    return safeDbOperation(
      async () => {
        const where: Prisma.PersonaWhereInput = {
          projectId,
          status,
        };

        return await paginate(
          prisma.persona,
          options,
          where,
          {
            _count: {
              select: { claims: true },
            },
          }
        );
      },
      'PersonaRepository.findByStatus'
    );
  }

  /**
   * Get claim fields with their citations by claim ID
   */
  async getClaimFields(claimId: string): Promise<ClaimField[]> {
    return safeDbOperation(
      async () => {
        return await prisma.claimField.findMany({
          where: { claimId },
          include: {
            citations: {
              orderBy: { sentenceIndex: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        });
      },
      'PersonaRepository.getClaimFields'
    );
  }

  /**
   * Get status distribution for a project
   */
  async getStatusDistribution(projectId: string): Promise<Record<string, number>> {
    return safeDbOperation(
      async () => {
        const statusGroups = await prisma.persona.groupBy({
          by: ['status'],
          where: { projectId },
          _count: true,
        });

        const distribution: Record<string, number> = {};
        statusGroups.forEach((group) => {
          distribution[group.status] = group._count;
        });

        return distribution;
      },
      'PersonaRepository.getStatusDistribution'
    );
  }

  /**
   * Find evidence units referenced in persona citations
   */
  async getReferencedEvidence(personaId: string): Promise<string[]> {
    return safeDbOperation(
      async () => {
        const citations = await prisma.citation.findMany({
          where: {
            claimField: {
              claim: {
                personaId,
              },
            },
          },
          select: { evidenceIds: true },
        });

        const evidenceIdSet = new Set<string>();
        citations.forEach((citation) => {
          try {
            const ids = JSON.parse(citation.evidenceIds) as string[];
            ids.forEach(id => evidenceIdSet.add(id));
          } catch {
            // Skip invalid JSON
          }
        });

        return Array.from(evidenceIdSet);
      },
      'PersonaRepository.getReferencedEvidence'
    );
  }
}

// Export singleton instance
export const personaRepository = new PersonaRepository();