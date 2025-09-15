/**
 * Test suite for DeduplicationService
 * Tests threshold-based deduplication, quality preservation, and performance
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { DeduplicationService, type EvidenceUnit, type DeduplicationConfig } from '../../services/DeduplicationService';

describe('DeduplicationService', () => {
  let deduplicationService: DeduplicationService;

  beforeEach(() => {
    deduplicationService = new DeduplicationService();
  });

  describe('Basic Deduplication', () => {
    test('should identify and remove duplicate units', async () => {
      const units: EvidenceUnit[] = [
        {
          id: '1',
          sourceId: 'source1',
          snippet: 'The quick brown fox jumps over the lazy dog.',
          startIndex: 0,
          endIndex: 44,
          qualityScore: 0.8,
          metadata: {},
        },
        {
          id: '2',
          sourceId: 'source1',
          snippet: 'The quick brown fox jumps over the lazy dog.',
          startIndex: 50,
          endIndex: 94,
          qualityScore: 0.9,
          metadata: {},
        },
        {
          id: '3',
          sourceId: 'source1',
          snippet: 'Completely different text about something else.',
          startIndex: 100,
          endIndex: 147,
          qualityScore: 0.7,
          metadata: {},
        },
      ];

      const result = await deduplicationService.deduplicate(units);

      expect(result.deduplicated).toHaveLength(2);
      expect(result.duplicateClusters).toHaveLength(1);
      expect(result.statistics.originalCount).toBe(3);
      expect(result.statistics.deduplicatedCount).toBe(2);
      expect(result.statistics.duplicatesRemoved).toBe(1);
    });

    test('should preserve highest quality unit among duplicates', async () => {
      const units: EvidenceUnit[] = [
        {
          id: '1',
          sourceId: 'source1',
          snippet: 'The quick brown fox jumps over the lazy dog.',
          startIndex: 0,
          endIndex: 44,
          qualityScore: 0.6,
          metadata: {},
        },
        {
          id: '2',
          sourceId: 'source1',
          snippet: 'The quick brown fox jumps over the lazy dog.',
          startIndex: 50,
          endIndex: 94,
          qualityScore: 0.9,
          metadata: {},
        },
      ];

      const result = await deduplicationService.deduplicate(units);

      expect(result.deduplicated).toHaveLength(1);
      expect(result.deduplicated[0].id).toBe('2'); // Higher quality
      expect(result.deduplicated[0].qualityScore).toBe(0.9);
    });

    test('should handle similar but not identical texts', async () => {
      const units: EvidenceUnit[] = [
        {
          id: '1',
          sourceId: 'source1',
          snippet: 'The quick brown fox jumps over the lazy dog.',
          startIndex: 0,
          endIndex: 44,
          qualityScore: 0.8,
          metadata: {},
        },
        {
          id: '2',
          sourceId: 'source1',
          snippet: 'The quick brown fox runs over the lazy dog.',
          startIndex: 50,
          endIndex: 93,
          qualityScore: 0.8,
          metadata: {},
        },
      ];

      const result = await deduplicationService.deduplicate(units);

      // With default threshold 0.85, these should be considered different
      expect(result.deduplicated).toHaveLength(2);
      expect(result.duplicateClusters).toHaveLength(0);
    });
  });

  describe('Configuration Options', () => {
    test('should respect custom similarity threshold', async () => {
      const lowThresholdService = new DeduplicationService({
        cosineSimilarityThreshold: 0.7,
      });

      const units: EvidenceUnit[] = [
        {
          id: '1',
          sourceId: 'source1',
          snippet: 'The quick brown fox jumps over the lazy dog.',
          startIndex: 0,
          endIndex: 44,
          qualityScore: 0.8,
          metadata: {},
        },
        {
          id: '2',
          sourceId: 'source1',
          snippet: 'The quick brown fox runs over the lazy dog.',
          startIndex: 50,
          endIndex: 93,
          qualityScore: 0.8,
          metadata: {},
        },
      ];

      const result = await lowThresholdService.deduplicate(units);

      // With lower threshold 0.7, these should be considered duplicates
      expect(result.deduplicated).toHaveLength(1);
      expect(result.duplicateClusters).toHaveLength(1);
    });

    test('should use different strategies for representative selection', async () => {
      const longestService = new DeduplicationService({
        strategy: 'keep_longest',
      });

      const units: EvidenceUnit[] = [
        {
          id: '1',
          sourceId: 'source1',
          snippet: 'Short text.',
          startIndex: 0,
          endIndex: 11,
          qualityScore: 0.9,
          metadata: {},
        },
        {
          id: '2',
          sourceId: 'source1',
          snippet: 'This is a much longer text with more content.',
          startIndex: 20,
          endIndex: 65,
          qualityScore: 0.6,
          metadata: {},
        },
      ];

      const result = await longestService.deduplicate(units);

      expect(result.deduplicated).toHaveLength(1);
      expect(result.deduplicated[0].id).toBe('2'); // Longer text
    });

    test('should handle merge strategy', async () => {
      const mergeService = new DeduplicationService({
        strategy: 'merge',
        cosineSimilarityThreshold: 0.5, // Low threshold to trigger merge
      });

      const units: EvidenceUnit[] = [
        {
          id: '1',
          sourceId: 'source1',
          snippet: 'The quick brown fox',
          startIndex: 0,
          endIndex: 19,
          qualityScore: 0.8,
          topics: ['animals'],
          metadata: {},
        },
        {
          id: '2',
          sourceId: 'source1',
          snippet: 'The quick brown fox jumps',
          startIndex: 20,
          endIndex: 45,
          qualityScore: 0.6,
          topics: ['motion'],
          metadata: {},
        },
      ];

      const result = await mergeService.deduplicate(units);

      expect(result.deduplicated).toHaveLength(1);
      const merged = result.deduplicated[0];
      expect(merged.snippet).toBe('The quick brown fox jumps'); // Longest
      expect(merged.topics).toEqual(['animals', 'motion']); // Combined
      expect(merged.metadata.mergedFrom).toEqual(['1', '2']);
    });
  });

  describe('Performance Tests', () => {
    test('should handle large numbers of units efficiently', async () => {
      const units: EvidenceUnit[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `unit_${i}`,
        sourceId: 'source1',
        snippet: `This is test unit number ${i} with unique content ${i * 2}.`,
        startIndex: i * 100,
        endIndex: (i * 100) + 50,
        qualityScore: Math.random(),
        metadata: {},
      }));

      const startTime = Date.now();
      const result = await deduplicationService.deduplicate(units);
      const endTime = Date.now();

      const processingTime = endTime - startTime;
      
      // Should complete in reasonable time (under 10 seconds for 1000 units)
      expect(processingTime).toBeLessThan(10000);
      
      // All units should be unique with different content
      expect(result.deduplicated).toHaveLength(1000);
      expect(result.duplicateClusters).toHaveLength(0);
    });

    test('should handle O(n log n) performance for duplicates', async () => {
      // Create many similar units to test clustering performance
      const baseText = 'The quick brown fox jumps over the lazy dog';
      const units: EvidenceUnit[] = Array.from({ length: 500 }, (_, i) => ({
        id: `unit_${i}`,
        sourceId: 'source1',
        snippet: i < 250 ? baseText : baseText + ` variant ${i}`,
        startIndex: i * 100,
        endIndex: (i * 100) + baseText.length,
        qualityScore: Math.random(),
        metadata: {},
      }));

      const startTime = Date.now();
      const result = await deduplicationService.deduplicate(units);
      const endTime = Date.now();

      const processingTime = endTime - startTime;
      
      // Should complete efficiently even with many duplicates
      expect(processingTime).toBeLessThan(15000);
      
      // Should identify the duplicates
      expect(result.deduplicated.length).toBeLessThan(units.length);
      expect(result.duplicateClusters.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty input', async () => {
      const result = await deduplicationService.deduplicate([]);

      expect(result.deduplicated).toHaveLength(0);
      expect(result.duplicateClusters).toHaveLength(0);
      expect(result.statistics.originalCount).toBe(0);
    });

    test('should handle single unit', async () => {
      const units: EvidenceUnit[] = [
        {
          id: '1',
          sourceId: 'source1',
          snippet: 'Single unit',
          startIndex: 0,
          endIndex: 11,
          qualityScore: 0.8,
          metadata: {},
        },
      ];

      const result = await deduplicationService.deduplicate(units);

      expect(result.deduplicated).toHaveLength(1);
      expect(result.duplicateClusters).toHaveLength(0);
      expect(result.deduplicated[0]).toEqual(units[0]);
    });

    test('should handle units with missing quality scores', async () => {
      const units: EvidenceUnit[] = [
        {
          id: '1',
          sourceId: 'source1',
          snippet: 'Text without quality score',
          startIndex: 0,
          endIndex: 26,
          metadata: {},
        },
        {
          id: '2',
          sourceId: 'source1',
          snippet: 'Text without quality score',
          startIndex: 30,
          endIndex: 56,
          qualityScore: 0.8,
          metadata: {},
        },
      ];

      const result = await deduplicationService.deduplicate(units);

      expect(result.deduplicated).toHaveLength(1);
      expect(result.duplicateClusters).toHaveLength(1);
      expect(result.deduplicated[0].id).toBe('2'); // Has quality score
    });

    test('should handle very short texts', async () => {
      const units: EvidenceUnit[] = [
        {
          id: '1',
          sourceId: 'source1',
          snippet: 'A',
          startIndex: 0,
          endIndex: 1,
          qualityScore: 0.8,
          metadata: {},
        },
        {
          id: '2',
          sourceId: 'source1',
          snippet: 'B',
          startIndex: 2,
          endIndex: 3,
          qualityScore: 0.8,
          metadata: {},
        },
      ];

      const result = await deduplicationService.deduplicate(units);

      // Very short texts should be considered different
      expect(result.deduplicated).toHaveLength(2);
      expect(result.duplicateClusters).toHaveLength(0);
    });

    test('should handle very long texts', async () => {
      const longText1 = 'The quick brown fox jumps over the lazy dog. '.repeat(100);
      const longText2 = 'The quick brown fox jumps over the lazy dog. '.repeat(100);

      const units: EvidenceUnit[] = [
        {
          id: '1',
          sourceId: 'source1',
          snippet: longText1,
          startIndex: 0,
          endIndex: longText1.length,
          qualityScore: 0.8,
          metadata: {},
        },
        {
          id: '2',
          sourceId: 'source1',
          snippet: longText2,
          startIndex: 5000,
          endIndex: 5000 + longText2.length,
          qualityScore: 0.9,
          metadata: {},
        },
      ];

      const result = await deduplicationService.deduplicate(units);

      expect(result.deduplicated).toHaveLength(1);
      expect(result.duplicateClusters).toHaveLength(1);
      expect(result.deduplicated[0].id).toBe('2'); // Higher quality
    });
  });

  describe('Exact Duplicates', () => {
    test('should find exact text duplicates', async () => {
      const units: EvidenceUnit[] = [
        {
          id: '1',
          sourceId: 'source1',
          snippet: 'Exact same text',
          startIndex: 0,
          endIndex: 15,
          qualityScore: 0.8,
          metadata: {},
        },
        {
          id: '2',
          sourceId: 'source2',
          snippet: 'Exact same text',
          startIndex: 20,
          endIndex: 35,
          qualityScore: 0.9,
          metadata: {},
        },
        {
          id: '3',
          sourceId: 'source1',
          snippet: 'Different text',
          startIndex: 40,
          endIndex: 54,
          qualityScore: 0.7,
          metadata: {},
        },
      ];

      const exactDuplicates = deduplicationService.findExactDuplicates(units);

      expect(exactDuplicates).toHaveLength(1);
      expect(exactDuplicates[0].units).toHaveLength(2);
      expect(exactDuplicates[0].averageSimilarity).toBe(1.0);
      expect(exactDuplicates[0].reason).toBe('Exact text match');
    });
  });

  describe('Similarity Reports', () => {
    test('should generate detailed similarity reports', async () => {
      const unit1: EvidenceUnit = {
        id: '1',
        sourceId: 'source1',
        snippet: 'The quick brown fox jumps over the lazy dog',
        startIndex: 0,
        endIndex: 43,
        qualityScore: 0.8,
        metadata: {},
      };

      const unit2: EvidenceUnit = {
        id: '2',
        sourceId: 'source1',
        snippet: 'The quick brown fox runs over the lazy dog',
        startIndex: 50,
        endIndex: 92,
        qualityScore: 0.8,
        metadata: {},
      };

      const report = await deduplicationService.getSimilarityReport(unit1, unit2);

      expect(report).toHaveProperty('cosineSimilarity');
      expect(report).toHaveProperty('jaccardSimilarity');
      expect(report).toHaveProperty('minHashSimilarity');
      expect(report).toHaveProperty('simHashSimilarity');
      expect(report).toHaveProperty('overallSimilarity');
      expect(report).toHaveProperty('isDuplicate');

      expect(report.cosineSimilarity).toBeGreaterThan(0.8);
      expect(report.overallSimilarity).toBeGreaterThan(0.8);
    });
  });

  describe('Configuration Updates', () => {
    test('should allow runtime configuration updates', async () => {
      const units: EvidenceUnit[] = [
        {
          id: '1',
          sourceId: 'source1',
          snippet: 'The quick brown fox jumps',
          startIndex: 0,
          endIndex: 25,
          qualityScore: 0.8,
          metadata: {},
        },
        {
          id: '2',
          sourceId: 'source1',
          snippet: 'The quick brown fox runs',
          startIndex: 30,
          endIndex: 54,
          qualityScore: 0.8,
          metadata: {},
        },
      ];

      // First with default threshold
      let result = await deduplicationService.deduplicate(units);
      expect(result.deduplicated).toHaveLength(2); // Not considered duplicates

      // Update to lower threshold
      deduplicationService.updateConfig({ cosineSimilarityThreshold: 0.7 });
      result = await deduplicationService.deduplicate(units);
      expect(result.deduplicated).toHaveLength(1); // Now considered duplicates
    });
  });
});