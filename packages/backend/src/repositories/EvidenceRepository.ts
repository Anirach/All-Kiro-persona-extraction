import { EvidenceUnit, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { safeDbOperation, withTransaction, paginate, PaginatedResult, PaginationOptions, buildSearchWhere } from '../lib/database';

/**
 * Repository for EvidenceUnit entity operations
 * Provides CRUD operations and evidence-specific business logic
 */
export class EvidenceRepository {
  /**
   * Create a new evidence unit
   */
  async create(data: Prisma.EvidenceUnitCreateInput): Promise<EvidenceUnit> {
    return safeDbOperation(
      async () => {
        return await prisma.evidenceUnit.create({
          data,
          include: {
            source: {
              select: { id: true, title: true, tier: true, projectId: true },
            },
          },
        });
      },
      'EvidenceRepository.create'
    );
  }

  /**
   * Create multiple evidence units in a batch
   */
  async createMany(data: Prisma.EvidenceUnitCreateManyInput[]): Promise<{ count: number }> {
    return withTransaction(async (tx) => {
      const result = await tx.evidenceUnit.createMany({
        data,
      });

      return { count: result.count };
    });
  }

  /**
   * Find evidence unit by ID with optional relations
   */
  async findById(
    id: string,
    include?: {
      source?: boolean;
      fullRelations?: boolean;
    }
  ): Promise<EvidenceUnit | null> {
    return safeDbOperation(
      async () => {
        const includeOptions: Prisma.EvidenceUnitInclude = {};

        if (include?.source || include?.fullRelations) {
          includeOptions.source = {
            include: {
              project: {
                select: { id: true, name: true },
              },
            },
          };
        }

        return await prisma.evidenceUnit.findUnique({
          where: { id },
          include: Object.keys(includeOptions).length > 0 ? includeOptions : undefined,
        });
      },
      'EvidenceRepository.findById'
    );
  }

  /**
   * Find evidence units by source ID with pagination and filtering
   */
  async findBySourceId(
    sourceId: string,
    options: PaginationOptions & {
      search?: string;
      minQualityScore?: number;
      topics?: string[];
    } = {}
  ): Promise<PaginatedResult<EvidenceUnit>> {
    const { search, minQualityScore, topics, ...paginationOptions } = options;

    return safeDbOperation(
      async () => {
        // Build where clause
        const where: Prisma.EvidenceUnitWhereInput = {
          sourceId,
          ...(minQualityScore && {
            qualityScore: { gte: minQualityScore },
          }),
          ...(search && buildSearchWhere(search, ['snippet'])),
          ...(topics && topics.length > 0 && {
            // Search for any of the topics in the JSON array
            OR: topics.map(topic => ({
              topics: { contains: topic },
            })),
          }),
        };

        return await paginate(
          prisma.evidenceUnit,
          { ...paginationOptions, orderBy: paginationOptions.orderBy || 'qualityScore', orderDirection: paginationOptions.orderDirection || 'desc' },
          where,
          {
            source: {
              select: { id: true, title: true, tier: true },
            },
          }
        );
      },
      'EvidenceRepository.findBySourceId'
    );
  }

  /**
   * Find evidence units by project ID (across all sources)
   */
  async findByProjectId(
    projectId: string,
    options: PaginationOptions & {
      search?: string;
      minQualityScore?: number;
      sourceTier?: string;
      topics?: string[];
    } = {}
  ): Promise<PaginatedResult<EvidenceUnit>> {
    const { search, minQualityScore, sourceTier, topics, ...paginationOptions } = options;

    return safeDbOperation(
      async () => {
        // Build where clause
        const where: Prisma.EvidenceUnitWhereInput = {
          source: {
            projectId,
            ...(sourceTier && { tier: sourceTier }),
          },
          ...(minQualityScore && {
            qualityScore: { gte: minQualityScore },
          }),
          ...(search && buildSearchWhere(search, ['snippet'])),
          ...(topics && topics.length > 0 && {
            OR: topics.map(topic => ({
              topics: { contains: topic },
            })),
          }),
        };

        return await paginate(
          prisma.evidenceUnit,
          { ...paginationOptions, orderBy: paginationOptions.orderBy || 'qualityScore', orderDirection: paginationOptions.orderDirection || 'desc' },
          where,
          {
            source: {
              select: { id: true, title: true, tier: true, url: true },
            },
          }
        );
      },
      'EvidenceRepository.findByProjectId'
    );
  }

  /**
   * Find all evidence units with pagination and search
   */
  async findMany(
    options: PaginationOptions & {
      search?: string;
      minQualityScore?: number;
      sourceId?: string;
      projectId?: string;
      topics?: string[];
    } = {}
  ): Promise<PaginatedResult<EvidenceUnit>> {
    const { search, minQualityScore, sourceId, projectId, topics, ...paginationOptions } = options;

    return safeDbOperation(
      async () => {
        // Build where clause
        const where: Prisma.EvidenceUnitWhereInput = {
          ...(sourceId && { sourceId }),
          ...(projectId && {
            source: { projectId },
          }),
          ...(minQualityScore && {
            qualityScore: { gte: minQualityScore },
          }),
          ...(search && buildSearchWhere(search, ['snippet'])),
          ...(topics && topics.length > 0 && {
            OR: topics.map(topic => ({
              topics: { contains: topic },
            })),
          }),
        };

        return await paginate(
          prisma.evidenceUnit,
          { ...paginationOptions, orderBy: paginationOptions.orderBy || 'qualityScore', orderDirection: paginationOptions.orderDirection || 'desc' },
          where,
          {
            source: {
              select: { id: true, title: true, tier: true, url: true },
            },
          }
        );
      },
      'EvidenceRepository.findMany'
    );
  }

  /**
   * Update evidence unit by ID
   */
  async update(id: string, data: Prisma.EvidenceUnitUpdateInput): Promise<EvidenceUnit> {
    return safeDbOperation(
      async () => {
        return await prisma.evidenceUnit.update({
          where: { id },
          data,
          include: {
            source: {
              select: { id: true, title: true, tier: true },
            },
          },
        });
      },
      'EvidenceRepository.update'
    );
  }

  /**
   * Update quality score for an evidence unit
   */
  async updateQualityScore(id: string, qualityScore: number): Promise<EvidenceUnit> {
    return safeDbOperation(
      async () => {
        return await prisma.evidenceUnit.update({
          where: { id },
          data: { qualityScore },
        });
      },
      'EvidenceRepository.updateQualityScore'
    );
  }

  /**
   * Update topics for an evidence unit
   */
  async updateTopics(id: string, topics: string[]): Promise<EvidenceUnit> {
    return safeDbOperation(
      async () => {
        return await prisma.evidenceUnit.update({
          where: { id },
          data: { 
            topics: JSON.stringify(topics),
          },
        });
      },
      'EvidenceRepository.updateTopics'
    );
  }

  /**
   * Delete evidence unit by ID
   */
  async delete(id: string): Promise<void> {
    return safeDbOperation(
      async () => {
        await prisma.evidenceUnit.delete({
          where: { id },
        });
      },
      'EvidenceRepository.delete'
    );
  }

  /**
   * Bulk delete evidence units
   */
  async bulkDelete(ids: string[]): Promise<{ deleted: number }> {
    return withTransaction(async (tx) => {
      const result = await tx.evidenceUnit.deleteMany({
        where: {
          id: { in: ids },
        },
      });

      return { deleted: result.count };
    });
  }

  /**
   * Get evidence statistics for a source
   */
  async getSourceStats(sourceId: string): Promise<{
    totalCount: number;
    averageQualityScore: number | null;
    qualityDistribution: {
      high: number; // >= 0.8
      medium: number; // 0.4 - 0.8
      low: number; // < 0.4
      unscored: number; // null
    };
    topicDistribution: Record<string, number>;
  }> {
    return safeDbOperation(
      async () => {
        const [evidenceUnits, aggregateStats] = await Promise.all([
          prisma.evidenceUnit.findMany({
            where: { sourceId },
            select: { qualityScore: true, topics: true },
          }),
          prisma.evidenceUnit.aggregate({
            where: { sourceId },
            _avg: { qualityScore: true },
            _count: true,
          }),
        ]);

        // Calculate quality distribution
        const qualityDistribution = {
          high: 0,
          medium: 0,
          low: 0,
          unscored: 0,
        };

        const topicDistribution: Record<string, number> = {};

        evidenceUnits.forEach((unit) => {
          // Quality distribution
          if (unit.qualityScore === null) {
            qualityDistribution.unscored++;
          } else if (unit.qualityScore >= 0.8) {
            qualityDistribution.high++;
          } else if (unit.qualityScore >= 0.4) {
            qualityDistribution.medium++;
          } else {
            qualityDistribution.low++;
          }

          // Topic distribution
          try {
            const topics = JSON.parse(unit.topics) as string[];
            topics.forEach((topic) => {
              topicDistribution[topic] = (topicDistribution[topic] || 0) + 1;
            });
          } catch {
            // Skip invalid JSON
          }
        });

        return {
          totalCount: aggregateStats._count,
          averageQualityScore: aggregateStats._avg.qualityScore,
          qualityDistribution,
          topicDistribution,
        };
      },
      'EvidenceRepository.getSourceStats'
    );
  }

  /**
   * Find similar evidence units based on snippet content
   */
  async findSimilar(
    snippet: string,
    sourceId?: string,
    limit = 5,
    excludeId?: string
  ): Promise<EvidenceUnit[]> {
    return safeDbOperation(
      async () => {
        // Simple similarity search using substring matching
        // In a production system, you might want to use vector embeddings
        const words = snippet.toLowerCase().split(/\s+/).filter(word => word.length > 3);
        
        if (words.length === 0) return [];

        const where: Prisma.EvidenceUnitWhereInput = {
          ...(sourceId && { sourceId }),
          ...(excludeId && { id: { not: excludeId } }),
          OR: words.map(word => ({
            snippet: { contains: word },
          })),
        };

        return await prisma.evidenceUnit.findMany({
          where,
          take: limit,
          orderBy: { qualityScore: 'desc' },
          include: {
            source: {
              select: { id: true, title: true, tier: true },
            },
          },
        });
      },
      'EvidenceRepository.findSimilar'
    );
  }

  /**
   * Check if evidence unit exists
   */
  async exists(id: string): Promise<boolean> {
    return safeDbOperation(
      async () => {
        const count = await prisma.evidenceUnit.count({
          where: { id },
        });
        return count > 0;
      },
      'EvidenceRepository.exists'
    );
  }

  /**
   * Get all topics across evidence units for a project
   */
  async getProjectTopics(projectId: string): Promise<string[]> {
    return safeDbOperation(
      async () => {
        const evidenceUnits = await prisma.evidenceUnit.findMany({
          where: {
            source: { projectId },
          },
          select: { topics: true },
        });

        const topicSet = new Set<string>();
        evidenceUnits.forEach((unit) => {
          try {
            const topics = JSON.parse(unit.topics) as string[];
            topics.forEach(topic => topicSet.add(topic));
          } catch {
            // Skip invalid JSON
          }
        });

        return Array.from(topicSet).sort();
      },
      'EvidenceRepository.getProjectTopics'
    );
  }

  /**
   * Get evidence units by IDs (useful for citations)
   */
  async findByIds(ids: string[]): Promise<EvidenceUnit[]> {
    return safeDbOperation(
      async () => {
        return await prisma.evidenceUnit.findMany({
          where: {
            id: { in: ids },
          },
          include: {
            source: {
              select: { id: true, title: true, tier: true, url: true },
            },
          },
          orderBy: { qualityScore: 'desc' },
        });
      },
      'EvidenceRepository.findByIds'
    );
  }

  /**
   * Bulk update quality scores
   */
  async bulkUpdateQualityScores(updates: Array<{ id: string; qualityScore: number }>): Promise<{ updated: number }> {
    return withTransaction(async (tx) => {
      let updated = 0;
      
      for (const update of updates) {
        await tx.evidenceUnit.update({
          where: { id: update.id },
          data: { qualityScore: update.qualityScore },
        });
        updated++;
      }

      return { updated };
    });
  }
}

// Export singleton instance
export const evidenceRepository = new EvidenceRepository();