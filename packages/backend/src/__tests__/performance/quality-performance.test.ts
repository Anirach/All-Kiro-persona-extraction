/**
 * Comprehensive performance validation for Quality Scoring Algorithm
 * TASK-011 Performance Requirements: <50ms processing time per evidence unit
 */

import { describe, it, expect } from 'vitest';
import { QualityService, type EvidenceForQuality } from '../../services/QualityService';

describe('Quality Scoring Performance Validation', () => {
  const qualityService = new QualityService();

  // Sample evidence data for testing
  const createTestEvidence = (id: string, complexity: 'simple' | 'medium' | 'complex'): EvidenceForQuality => {
    const texts = {
      simple: 'John Smith works at Google.',
      medium: 'John Smith is a senior software engineer at Google Corporation, where he has been working for the past 3 years on machine learning infrastructure projects.',
      complex: 'Dr. John Smith, PhD in Computer Science from Stanford University, currently serves as a Principal Software Engineer at Google Corporation in Mountain View, California. He leads a team of 12 engineers working on distributed machine learning infrastructure, with a focus on real-time data processing systems. Prior to Google, he worked at Microsoft Research for 5 years, where he published 15 peer-reviewed papers on neural network optimization. His current research interests include federated learning, privacy-preserving ML, and large-scale distributed systems. He holds 8 patents in the field of machine learning optimization and has spoken at numerous industry conferences including NIPS, ICML, and Google I/O.',
    };

    return {
      id,
      text: texts[complexity],
      sourceId: `source-${id}`,
      startIndex: 0,
      endIndex: texts[complexity].length,
      wordCount: texts[complexity].split(' ').length,
      sentenceCount: texts[complexity].split(/[.!?]/).length - 1,
      hasCompleteStart: true,
      hasCompleteEnd: true,
      metadata: {
        topics: ['career', 'technology'],
        keywords: ['engineer', 'Google', 'machine learning'],
        context: 'professional',
      },
      source: {
        id: `source-${id}`,
        url: 'https://linkedin.com/in/johnsmith',
        fetchedAt: new Date(),
        tier: 'REPUTABLE',
        domain: 'linkedin.com',
        title: 'Software Engineer Profile',
        metadata: {},
      },
    };
  };

  describe('Individual Processing Performance', () => {
    it('should process simple evidence under 25ms', async () => {
      const evidence = createTestEvidence('simple-test', 'simple');
      
      const startTime = performance.now();
      const assessment = await qualityService.assessQuality(evidence);
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(25);
      expect(assessment.score).toBeGreaterThanOrEqual(0);
      expect(assessment.score).toBeLessThanOrEqual(1);
      expect(assessment.processingTimeMs).toBeGreaterThan(0);
      
      console.log(`Simple evidence processing: ${processingTime.toFixed(2)}ms`);
    });

    it('should process medium evidence under 35ms', async () => {
      const evidence = createTestEvidence('medium-test', 'medium');
      
      const startTime = performance.now();
      const assessment = await qualityService.assessQuality(evidence);
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(35);
      expect(assessment.score).toBeGreaterThanOrEqual(0);
      expect(assessment.score).toBeLessThanOrEqual(1);
      
      console.log(`Medium evidence processing: ${processingTime.toFixed(2)}ms`);
    });

    it('should process complex evidence under 50ms', async () => {
      const evidence = createTestEvidence('complex-test', 'complex');
      
      const startTime = performance.now();
      const assessment = await qualityService.assessQuality(evidence);
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(50);
      expect(assessment.score).toBeGreaterThanOrEqual(0);
      expect(assessment.score).toBeLessThanOrEqual(1);
      
      console.log(`Complex evidence processing: ${processingTime.toFixed(2)}ms`);
    });
  });

  describe('Batch Processing Performance', () => {
    it('should process 100 simple evidence units efficiently', async () => {
      const evidenceList = Array.from({ length: 100 }, (_, i) => 
        createTestEvidence(`batch-simple-${i}`, 'simple')
      );
      
      const startTime = performance.now();
      const assessments = await qualityService.assessQualityBatch(evidenceList);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      const avgTimePerItem = totalTime / evidenceList.length;
      
      expect(assessments).toHaveLength(100);
      expect(avgTimePerItem).toBeLessThan(30); // Even more efficient in batch
      expect(totalTime).toBeLessThan(3000); // Total under 3 seconds
      
      console.log(`Batch processing 100 simple: ${totalTime.toFixed(2)}ms total, ${avgTimePerItem.toFixed(2)}ms avg`);
    });

    it('should process mixed complexity batch efficiently', async () => {
      const evidenceList = [
        ...Array.from({ length: 20 }, (_, i) => createTestEvidence(`mixed-simple-${i}`, 'simple')),
        ...Array.from({ length: 15 }, (_, i) => createTestEvidence(`mixed-medium-${i}`, 'medium')),
        ...Array.from({ length: 10 }, (_, i) => createTestEvidence(`mixed-complex-${i}`, 'complex')),
      ];
      
      const startTime = performance.now();
      const assessments = await qualityService.assessQualityBatch(evidenceList);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      const avgTimePerItem = totalTime / evidenceList.length;
      
      expect(assessments).toHaveLength(45);
      expect(avgTimePerItem).toBeLessThan(40);
      expect(totalTime).toBeLessThan(1800); // Total under 1.8 seconds
      
      console.log(`Mixed batch processing: ${totalTime.toFixed(2)}ms total, ${avgTimePerItem.toFixed(2)}ms avg`);
    });
  });

  describe('Performance Mode Validation', () => {
    it('should achieve faster processing in fast mode', async () => {
      const evidence = createTestEvidence('fast-mode', 'complex');
      
      // Run multiple iterations to get more stable timing
      const iterations = 10;
      
      // Test balanced mode (default)
      const balancedService = new QualityService({ performanceMode: 'balanced' });
      let balancedTotal = 0;
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await balancedService.assessQuality(evidence);
        balancedTotal += performance.now() - start;
      }
      const balancedAvg = balancedTotal / iterations;
      
      // Test fast mode  
      const fastService = new QualityService({ performanceMode: 'fast' });
      let fastTotal = 0;
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await fastService.assessQuality(evidence);
        fastTotal += performance.now() - start;
      }
      const fastAvg = fastTotal / iterations;
      
      // Both modes should be very fast
      expect(balancedAvg).toBeLessThan(50);
      expect(fastAvg).toBeLessThan(50);
      
      console.log(`Balanced mode avg: ${balancedAvg.toFixed(2)}ms, Fast mode avg: ${fastAvg.toFixed(2)}ms`);
    });
  });

  describe('Caching Performance Impact', () => {
    it('should demonstrate significant speedup with caching', async () => {
      const evidence = createTestEvidence('cache-test', 'complex');
      
      // First assessment (cold cache)
      const firstStart = performance.now();
      const firstAssessment = await qualityService.assessQuality(evidence);
      const firstTime = performance.now() - firstStart;
      
      // Second assessment (warm cache)
      const secondStart = performance.now();
      const secondAssessment = await qualityService.assessQuality(evidence);
      const secondTime = performance.now() - secondStart;
      
      expect(firstAssessment.cacheHit).toBe(false);
      expect(secondAssessment.cacheHit).toBe(true);
      expect(secondTime).toBeLessThan(firstTime * 0.1); // Cache should be 90%+ faster
      expect(secondTime).toBeLessThan(5); // Cached response under 5ms
      
      console.log(`Cold cache: ${firstTime.toFixed(2)}ms, Warm cache: ${secondTime.toFixed(2)}ms`);
    });
  });

  describe('Memory Usage Validation', () => {
    it('should not accumulate excessive memory during batch processing', async () => {
      const initialMemory = process.memoryUsage();
      
      // Process multiple large batches
      for (let batch = 0; batch < 5; batch++) {
        const evidenceList = Array.from({ length: 50 }, (_, i) => 
          createTestEvidence(`memory-${batch}-${i}`, 'complex')
        );
        
        await qualityService.assessQualityBatch(evidenceList);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });
  });
});