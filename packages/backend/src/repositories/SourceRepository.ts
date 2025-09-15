import { Source, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { safeDbOperation, withTransaction, paginate, PaginatedResult, PaginationOptions, buildSearchWhere } from '../lib/database';

/**
 * Repository for Source entity operations
 * Provides CRUD operations and source-specific business logic
 */
export class SourceRepository {
  /**
   * Create a new source
   */
  async create(data: Prisma.SourceCreateInput): Promise<Source> {
    return safeDbOperation(
      async () => {
        return await prisma.source.create({
          data,
          include: {
            project: {
              select: { id: true, name: true },
            },
            evidenceUnits: {
              select: { id: true, qualityScore: true },
              orderBy: { qualityScore: 'desc' },
              take: 5, // Include top 5 evidence units by quality
            },
          },
        });
      },
      'SourceRepository.create'
    );
  }

  /**
   * Find source by ID with optional relations
   */
  async findById(
    id: string,
    include?: {
      project?: boolean;
      evidenceUnits?: boolean;
      fullRelations?: boolean;
    }
  ): Promise<Source | null> {
    return safeDbOperation(
      async () => {
        const includeOptions: Prisma.SourceInclude = {};

        if (include?.project || include?.fullRelations) {
          includeOptions.project = {
            select: { id: true, name: true, description: true },
          };
        }

        if (include?.evidenceUnits || include?.fullRelations) {
          includeOptions.evidenceUnits = {
            orderBy: { qualityScore: 'desc' },
          };
        }

        return await prisma.source.findUnique({
          where: { id },
          include: Object.keys(includeOptions).length > 0 ? includeOptions : undefined,
        });
      },
      'SourceRepository.findById'
    );
  }

  /**
   * Find sources by project ID with pagination and filtering
   */
  async findByProjectId(
    projectId: string,
    options: PaginationOptions & {
      search?: string;
      tier?: string;
      includeEvidenceCount?: boolean;
    } = {}
  ): Promise<PaginatedResult<Source & { _count?: { evidenceUnits: number } }>> {
    const { search, tier, includeEvidenceCount, ...paginationOptions } = options;

    return safeDbOperation(
      async () => {
        // Build where clause
        const where: Prisma.SourceWhereInput = {
          projectId,
          ...(tier && { tier }),
          ...(search && buildSearchWhere(search, ['title', 'url'])),
        };

        // Build include clause
        const include: Prisma.SourceInclude = includeEvidenceCount
          ? {
              _count: {
                select: { evidenceUnits: true },
              },
            }
          : {};

        return await paginate(
          prisma.source,
          paginationOptions,
          where,
          Object.keys(include).length > 0 ? include : undefined
        );
      },
      'SourceRepository.findByProjectId'
    );
  }

  /**
   * Find all sources with pagination and search
   */
  async findMany(
    options: PaginationOptions & {
      search?: string;
      tier?: string;
      projectId?: string;
      includeStats?: boolean;
    } = {}
  ): Promise<PaginatedResult<Source & { _count?: { evidenceUnits: number } }>> {
    const { search, tier, projectId, includeStats, ...paginationOptions } = options;

    return safeDbOperation(
      async () => {
        // Build where clause
        const where: Prisma.SourceWhereInput = {
          ...(projectId && { projectId }),
          ...(tier && { tier }),
          ...(search && buildSearchWhere(search, ['title', 'url'])),
        };

        // Build include clause
        const include: Prisma.SourceInclude = includeStats
          ? {
              _count: {
                select: { evidenceUnits: true },
              },
              project: {
                select: { id: true, name: true },
              },
            }
          : {};

        return await paginate(
          prisma.source,
          paginationOptions,
          where,
          Object.keys(include).length > 0 ? include : undefined
        );
      },
      'SourceRepository.findMany'
    );
  }

  /**
   * Update source by ID
   */
  async update(id: string, data: Prisma.SourceUpdateInput): Promise<Source> {
    return safeDbOperation(
      async () => {
        return await prisma.source.update({
          where: { id },
          data,
          include: {
            _count: {
              select: { evidenceUnits: true },
            },
          },
        });
      },
      'SourceRepository.update'
    );
  }

  /**
   * Delete source by ID (cascades to evidence units)
   */
  async delete(id: string): Promise<void> {
    return safeDbOperation(
      async () => {
        await prisma.source.delete({
          where: { id },
        });
      },
      'SourceRepository.delete'
    );
  }

  /**
   * Get source statistics
   */
  async getStats(id: string): Promise<{
    evidenceUnitCount: number;
    averageQualityScore: number | null;
    topicDistribution: Record<string, number>;
    qualityScoreDistribution: {
      high: number; // >= 0.8
      medium: number; // 0.4 - 0.8
      low: number; // < 0.4
    };
  }> {
    return safeDbOperation(
      async () => {
        const [evidenceUnits, qualityStats] = await Promise.all([
          // Get all evidence units for this source
          prisma.evidenceUnit.findMany({
            where: { sourceId: id },
            select: { qualityScore: true, topics: true },
          }),

          // Get quality score aggregations
          prisma.evidenceUnit.aggregate({
            where: { sourceId: id },
            _avg: { qualityScore: true },
            _count: true,
          }),
        ]);

        // Calculate topic distribution
        const topicDistribution: Record<string, number> = {};
        evidenceUnits.forEach((unit) => {
          try {
            const topics = JSON.parse(unit.topics) as string[];
            topics.forEach((topic) => {
              topicDistribution[topic] = (topicDistribution[topic] || 0) + 1;
            });
          } catch {
            // Skip if topics JSON is invalid
          }
        });

        // Calculate quality score distribution
        const qualityScoreDistribution = {
          high: 0,
          medium: 0,
          low: 0,
        };

        evidenceUnits.forEach((unit) => {
          if (unit.qualityScore === null) return;
          
          if (unit.qualityScore >= 0.8) {
            qualityScoreDistribution.high++;
          } else if (unit.qualityScore >= 0.4) {
            qualityScoreDistribution.medium++;
          } else {
            qualityScoreDistribution.low++;
          }
        });

        return {
          evidenceUnitCount: qualityStats._count,
          averageQualityScore: qualityStats._avg.qualityScore,
          topicDistribution,
          qualityScoreDistribution,
        };
      },
      'SourceRepository.getStats'
    );
  }

  /**
   * Check if source exists
   */
  async exists(id: string): Promise<boolean> {
    return safeDbOperation(
      async () => {
        const count = await prisma.source.count({
          where: { id },
        });
        return count > 0;
      },
      'SourceRepository.exists'
    );
  }

  /**
   * Check if source URL exists for a project (prevent duplicates)
   */
  async existsByUrl(projectId: string, url: string, excludeId?: string): Promise<boolean> {
    return safeDbOperation(
      async () => {
        const where: Prisma.SourceWhereInput = {
          projectId,
          url,
          ...(excludeId && { id: { not: excludeId } }),
        };

        const count = await prisma.source.count({ where });
        return count > 0;
      },
      'SourceRepository.existsByUrl'
    );
  }

  /**
   * Bulk delete sources with proper cleanup
   */
  async bulkDelete(ids: string[]): Promise<{ deleted: number }> {
    return withTransaction(async (tx) => {
      const result = await tx.source.deleteMany({
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
   * Get sources by tier for a project
   */
  async findByTier(
    projectId: string,
    tier: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Source>> {
    return safeDbOperation(
      async () => {
        const where: Prisma.SourceWhereInput = {
          projectId,
          tier,
        };

        return await paginate(
          prisma.source,
          options,
          where,
          {
            _count: {
              select: { evidenceUnits: true },
            },
          }
        );
      },
      'SourceRepository.findByTier'
    );
  }

  /**
   * Update source metadata
   */
  async updateMetadata(id: string, metadata: Record<string, any>): Promise<Source> {
    return safeDbOperation(
      async () => {
        return await prisma.source.update({
          where: { id },
          data: {
            metadata: JSON.stringify(metadata),
            updatedAt: new Date(),
          },
        });
      },
      'SourceRepository.updateMetadata'
    );
  }

  /**
   * Get tier distribution for a project
   */
  async getTierDistribution(projectId: string): Promise<Record<string, number>> {
    return safeDbOperation(
      async () => {
        const tierGroups = await prisma.source.groupBy({
          by: ['tier'],
          where: { projectId },
          _count: true,
        });

        const distribution: Record<string, number> = {};
        tierGroups.forEach((group) => {
          distribution[group.tier] = group._count;
        });

        return distribution;
      },
      'SourceRepository.getTierDistribution'
    );
  }
}

// Export singleton instance
export const sourceRepository = new SourceRepository();