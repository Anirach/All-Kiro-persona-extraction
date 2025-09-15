import { Project, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { safeDbOperation, withTransaction, paginate, PaginatedResult, PaginationOptions } from '../lib/database';

/**
 * Repository for Project entity operations
 * Provides CRUD operations and project-specific business logic
 */
export class ProjectRepository {
  /**
   * Create a new project
   */
  async create(data: Prisma.ProjectCreateInput): Promise<Project> {
    return safeDbOperation(
      async () => {
        return await prisma.project.create({
          data,
          include: {
            sources: {
              select: { id: true, title: true, tier: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
              take: 5, // Include up to 5 recent sources
            },
            personas: {
              select: { id: true, status: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
              take: 5, // Include up to 5 recent personas
            },
          },
        });
      },
      'ProjectRepository.create'
    );
  }

  /**
   * Find project by ID with optional relations
   */
  async findById(
    id: string,
    include?: {
      sources?: boolean;
      personas?: boolean;
      fullRelations?: boolean;
    }
  ): Promise<Project | null> {
    return safeDbOperation(
      async () => {
        const includeOptions: Prisma.ProjectInclude = {};

        if (include?.sources || include?.fullRelations) {
          includeOptions.sources = {
            include: {
              evidenceUnits: {
                select: { id: true, qualityScore: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          };
        }

        if (include?.personas || include?.fullRelations) {
          includeOptions.personas = {
            include: {
              claims: {
                include: {
                  fields: {
                    select: { id: true, confidence: true },
                  },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          };
        }

        return await prisma.project.findUnique({
          where: { id },
          include: Object.keys(includeOptions).length > 0 ? includeOptions : undefined,
        });
      },
      'ProjectRepository.findById'
    );
  }

  /**
   * Find all projects with pagination and search
   */
  async findMany(
    options: PaginationOptions & {
      search?: string;
      includeStats?: boolean;
    } = {}
  ): Promise<PaginatedResult<Project & { _count?: { sources: number; personas: number } }>> {
    const { search, includeStats, ...paginationOptions } = options;

    return safeDbOperation(
      async () => {
        // Build where clause for search
        const where: Prisma.ProjectWhereInput = search
          ? {
              OR: [
                { name: { contains: search } },
                { description: { contains: search } },
              ],
            }
          : {};

        // Build include clause for stats
        const include: Prisma.ProjectInclude = includeStats
          ? {
              _count: {
                select: {
                  sources: true,
                  personas: true,
                },
              },
            }
          : {};

        return await paginate(
          prisma.project,
          paginationOptions,
          where,
          Object.keys(include).length > 0 ? include : undefined
        );
      },
      'ProjectRepository.findMany'
    );
  }

  /**
   * Update project by ID
   */
  async update(id: string, data: Prisma.ProjectUpdateInput): Promise<Project> {
    return safeDbOperation(
      async () => {
        return await prisma.project.update({
          where: { id },
          data,
          include: {
            _count: {
              select: {
                sources: true,
                personas: true,
              },
            },
          },
        });
      },
      'ProjectRepository.update'
    );
  }

  /**
   * Delete project by ID (cascades to sources and personas)
   */
  async delete(id: string): Promise<void> {
    return safeDbOperation(
      async () => {
        await prisma.project.delete({
          where: { id },
        });
      },
      'ProjectRepository.delete'
    );
  }

  /**
   * Get project statistics
   */
  async getStats(id: string): Promise<{
    sourceCount: number;
    evidenceUnitCount: number;
    personaCount: number;
    approvedPersonaCount: number;
    sourceTiers: Record<string, number>;
  }> {
    return safeDbOperation(
      async () => {
        const [project, evidenceUnitCount, approvedPersonaCount, sourceTiers] = await Promise.all([
          // Get basic counts
          prisma.project.findUnique({
            where: { id },
            include: {
              _count: {
                select: {
                  sources: true,
                  personas: true,
                },
              },
            },
          }),

          // Count evidence units across all sources
          prisma.evidenceUnit.count({
            where: {
              source: {
                projectId: id,
              },
            },
          }),

          // Count approved personas
          prisma.persona.count({
            where: {
              projectId: id,
              status: 'APPROVED',
            },
          }),

          // Group sources by tier
          prisma.source.groupBy({
            by: ['tier'],
            where: { projectId: id },
            _count: true,
          }),
        ]);

        if (!project) {
          throw new Error('Project not found');
        }

        // Convert tier grouping to record
        const tierRecord: Record<string, number> = {};
        sourceTiers.forEach((tier) => {
          tierRecord[tier.tier] = tier._count;
        });

        return {
          sourceCount: project._count.sources,
          evidenceUnitCount,
          personaCount: project._count.personas,
          approvedPersonaCount,
          sourceTiers: tierRecord,
        };
      },
      'ProjectRepository.getStats'
    );
  }

  /**
   * Check if project exists
   */
  async exists(id: string): Promise<boolean> {
    return safeDbOperation(
      async () => {
        const count = await prisma.project.count({
          where: { id },
        });
        return count > 0;
      },
      'ProjectRepository.exists'
    );
  }

  /**
   * Bulk delete projects with proper cleanup
   */
  async bulkDelete(ids: string[]): Promise<{ deleted: number }> {
    return withTransaction(async (tx) => {
      const result = await tx.project.deleteMany({
        where: {
          id: {
            in: ids,
          },
        },
      });

      return { deleted: result.count };
    });
  }

  /**
   * Get recent activity for a project
   */
  async getRecentActivity(
    id: string,
    limit = 10
  ): Promise<{
    recentSources: Array<{ id: string; title: string | null; createdAt: Date }>;
    recentPersonas: Array<{ id: string; status: string; createdAt: Date }>;
  }> {
    return safeDbOperation(
      async () => {
        const [recentSources, recentPersonas] = await Promise.all([
          prisma.source.findMany({
            where: { projectId: id },
            select: { id: true, title: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: limit,
          }),
          prisma.persona.findMany({
            where: { projectId: id },
            select: { id: true, status: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: limit,
          }),
        ]);

        return { recentSources, recentPersonas };
      },
      'ProjectRepository.getRecentActivity'
    );
  }
}

// Export singleton instance
export const projectRepository = new ProjectRepository();