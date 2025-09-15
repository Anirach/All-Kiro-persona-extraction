/**
 * Test suite for similarity utilities
 * Tests cosine similarity, MinHash, SimHash algorithms and edge cases
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import {
  preprocessText,
  generateShingles,
  jaccardSimilarity,
  cosineSimilarity,
  generateMinHashSignature,
  minHashSimilarity,
  generateSimHash,
  hammingDistance,
  simHashSimilarity,
  fastSimilarityCheck,
  calculateSimilarity,
  calculateSimilarityMatrix,
  DEFAULT_SIMILARITY_CONFIG,
} from '../../utils/similarity';

describe('Similarity Utilities', () => {
  describe('preprocessText', () => {
    test('should normalize text correctly', () => {
      const input = '  Hello, World!  How are you?  ';
      const expected = 'hello world how are you';
      expect(preprocessText(input)).toBe(expected);
    });

    test('should handle empty text', () => {
      expect(preprocessText('')).toBe('');
      expect(preprocessText('   ')).toBe('');
    });

    test('should remove punctuation and extra spaces', () => {
      const input = 'Hello... world??? This is a test!!!';
      const expected = 'hello world this is a test';
      expect(preprocessText(input)).toBe(expected);
    });
  });

  describe('generateShingles', () => {
    test('should generate correct 3-shingles', () => {
      const text = 'the quick brown fox';
      const shingles = generateShingles(text, 3);
      
      expect(shingles.has('the quick brown')).toBe(true);
      expect(shingles.has('quick brown fox')).toBe(true);
      expect(shingles.size).toBe(2);
    });

    test('should handle short text', () => {
      const text = 'hello world';
      const shingles = generateShingles(text, 3);
      
      expect(shingles.has('hello world')).toBe(true);
      expect(shingles.size).toBe(1);
    });

    test('should handle empty text', () => {
      const shingles = generateShingles('', 3);
      expect(shingles.size).toBe(0);
    });

    test('should generate different shingle sizes', () => {
      const text = 'the quick brown fox jumps';
      const shingles2 = generateShingles(text, 2);
      const shingles4 = generateShingles(text, 4);
      
      expect(shingles2.size).toBe(4); // 5 words - 2 + 1
      expect(shingles4.size).toBe(2); // 5 words - 4 + 1
    });
  });

  describe('jaccardSimilarity', () => {
    test('should calculate Jaccard similarity correctly', () => {
      const set1 = new Set(['a', 'b', 'c']);
      const set2 = new Set(['b', 'c', 'd']);
      
      const similarity = jaccardSimilarity(set1, set2);
      expect(similarity).toBe(2 / 4); // intersection: 2, union: 4
    });

    test('should handle identical sets', () => {
      const set1 = new Set(['a', 'b', 'c']);
      const set2 = new Set(['a', 'b', 'c']);
      
      expect(jaccardSimilarity(set1, set2)).toBe(1.0);
    });

    test('should handle disjoint sets', () => {
      const set1 = new Set(['a', 'b']);
      const set2 = new Set(['c', 'd']);
      
      expect(jaccardSimilarity(set1, set2)).toBe(0.0);
    });

    test('should handle empty sets', () => {
      const set1 = new Set<string>();
      const set2 = new Set<string>();
      
      expect(jaccardSimilarity(set1, set2)).toBe(1.0);
    });
  });

  describe('cosineSimilarity', () => {
    test('should calculate cosine similarity for identical texts', () => {
      const text = 'the quick brown fox';
      expect(cosineSimilarity(text, text)).toBe(1.0);
    });

    test('should calculate cosine similarity for similar texts', () => {
      const text1 = 'the quick brown fox jumps';
      const text2 = 'the quick brown fox runs';
      
      const similarity = cosineSimilarity(text1, text2);
      expect(similarity).toBeGreaterThan(0.5);
      expect(similarity).toBeLessThan(1.0);
    });

    test('should calculate cosine similarity for different texts', () => {
      const text1 = 'the quick brown fox';
      const text2 = 'completely different sentence';
      
      const similarity = cosineSimilarity(text1, text2);
      expect(similarity).toBeLessThan(0.5);
    });

    test('should handle empty texts', () => {
      expect(cosineSimilarity('', '')).toBe(1.0);
      expect(cosineSimilarity('hello', '')).toBe(0);
      expect(cosineSimilarity('', 'world')).toBe(0);
    });
  });

  describe('MinHash', () => {
    test('should generate MinHash signatures', () => {
      const shingles = new Set(['the quick', 'quick brown', 'brown fox']);
      const signature = generateMinHashSignature(shingles, 10);
      
      expect(signature.length).toBe(10);
      expect(signature.every(val => typeof val === 'number')).toBe(true);
    });

    test('should calculate MinHash similarity', () => {
      const shingles1 = new Set(['a', 'b', 'c']);
      const shingles2 = new Set(['a', 'b', 'd']);
      
      const sig1 = generateMinHashSignature(shingles1, 100);
      const sig2 = generateMinHashSignature(shingles2, 100);
      
      const similarity = minHashSimilarity(sig1, sig2);
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1.0);
    });

    test('should handle identical signatures', () => {
      const signature = [1, 2, 3, 4, 5];
      expect(minHashSimilarity(signature, signature)).toBe(1.0);
    });

    test('should throw error for different length signatures', () => {
      const sig1 = [1, 2, 3];
      const sig2 = [4, 5];
      
      expect(() => minHashSimilarity(sig1, sig2)).toThrow();
    });
  });

  describe('SimHash', () => {
    test('should generate SimHash fingerprints', () => {
      const text = 'the quick brown fox jumps over the lazy dog';
      const fingerprint = generateSimHash(text, 64);
      
      expect(fingerprint.length).toBe(64);
      expect(fingerprint).toMatch(/^[01]+$/);
    });

    test('should calculate Hamming distance', () => {
      const fp1 = '1010101010';
      const fp2 = '1010101011';
      
      expect(hammingDistance(fp1, fp2)).toBe(1);
    });

    test('should calculate SimHash similarity', () => {
      const fp1 = '1010101010';
      const fp2 = '1010101011';
      
      const similarity = simHashSimilarity(fp1, fp2);
      expect(similarity).toBe(0.9); // 9/10 bits match
    });

    test('should throw error for different length fingerprints', () => {
      const fp1 = '101010';
      const fp2 = '1010';
      
      expect(() => hammingDistance(fp1, fp2)).toThrow();
      expect(() => simHashSimilarity(fp1, fp2)).toThrow();
    });
  });

  describe('fastSimilarityCheck', () => {
    test('should detect similar texts', () => {
      const text1 = 'the quick brown fox jumps over the lazy dog';
      const text2 = 'the quick brown fox jumps over a lazy dog';
      
      expect(fastSimilarityCheck(text1, text2, 0.8)).toBe(true);
    });

    test('should detect dissimilar texts', () => {
      const text1 = 'the quick brown fox';
      const text2 = 'completely different sentence';
      
      expect(fastSimilarityCheck(text1, text2, 0.8)).toBe(false);
    });
  });

  describe('calculateSimilarity', () => {
    test('should return comprehensive similarity result', () => {
      const text1 = 'the quick brown fox jumps over the lazy dog';
      const text2 = 'the quick brown fox jumps over a lazy dog';
      
      const result = calculateSimilarity(text1, text2);
      
      expect(result).toHaveProperty('cosineSimilarity');
      expect(result).toHaveProperty('jaccardSimilarity');
      expect(result).toHaveProperty('minHashSimilarity');
      expect(result).toHaveProperty('simHashSimilarity');
      expect(result).toHaveProperty('overallSimilarity');
      expect(result).toHaveProperty('isDuplicate');
      
      expect(result.cosineSimilarity).toBeGreaterThan(0.8);
      expect(result.overallSimilarity).toBeGreaterThan(0.8);
      expect(result.isDuplicate).toBe(true);
    });

    test('should handle identical texts', () => {
      const text = 'the quick brown fox';
      const result = calculateSimilarity(text, text);
      
      expect(result.cosineSimilarity).toBe(1.0);
      expect(result.jaccardSimilarity).toBe(1.0);
      expect(result.overallSimilarity).toBe(1.0);
      expect(result.isDuplicate).toBe(true);
    });

    test('should handle different texts', () => {
      const text1 = 'the quick brown fox';
      const text2 = 'completely different sentence structure';
      
      const result = calculateSimilarity(text1, text2);
      
      expect(result.overallSimilarity).toBeLessThan(0.5);
      expect(result.isDuplicate).toBe(false);
    });
  });

  describe('calculateSimilarityMatrix', () => {
    test('should calculate similarity matrix', () => {
      const texts = [
        'the quick brown fox',
        'the quick brown fox jumps',
        'completely different text',
      ];
      
      const matrix = calculateSimilarityMatrix(texts);
      
      expect(matrix.length).toBe(3);
      expect(matrix[0].length).toBe(3);
      
      // Diagonal should be 1.0
      expect(matrix[0][0]).toBe(1.0);
      expect(matrix[1][1]).toBe(1.0);
      expect(matrix[2][2]).toBe(1.0);
      
      // Matrix should be symmetric
      expect(matrix[0][1]).toBe(matrix[1][0]);
      expect(matrix[0][2]).toBe(matrix[2][0]);
      expect(matrix[1][2]).toBe(matrix[2][1]);
      
      // Similar texts should have high similarity
      expect(matrix[0][1]).toBeGreaterThan(0.7);
      
      // Different texts should have low similarity
      expect(matrix[0][2]).toBeLessThan(0.3);
    });

    test('should handle single text', () => {
      const texts = ['single text'];
      const matrix = calculateSimilarityMatrix(texts);
      
      expect(matrix).toEqual([[1.0]]);
    });

    test('should handle empty array', () => {
      const texts: string[] = [];
      const matrix = calculateSimilarityMatrix(texts);
      
      expect(matrix).toEqual([]);
    });
  });

  describe('Performance Tests', () => {
    test('should process similarity calculations efficiently', () => {
      const texts = Array.from({ length: 100 }, (_, i) => 
        `This is test text number ${i} with some random content about ${i * 2}`
      );
      
      const startTime = Date.now();
      calculateSimilarityMatrix(texts);
      const endTime = Date.now();
      
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    test('should handle large texts efficiently', () => {
      const largeText1 = 'the quick brown fox jumps over the lazy dog '.repeat(100);
      const largeText2 = 'the quick brown fox runs over the lazy dog '.repeat(100);
      
      const startTime = Date.now();
      calculateSimilarity(largeText1, largeText2);
      const endTime = Date.now();
      
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(1000); // Should complete in under 1 second
    });
  });

  describe('Edge Cases', () => {
    test('should handle very short texts', () => {
      const result = calculateSimilarity('a', 'b');
      expect(result.overallSimilarity).toBeGreaterThanOrEqual(0);
      expect(result.overallSimilarity).toBeLessThanOrEqual(1);
    });

    test('should handle texts with special characters', () => {
      const text1 = 'Hello! @#$% World? 123';
      const text2 = 'Hello! @#$% Earth? 456';
      
      const result = calculateSimilarity(text1, text2);
      expect(result.overallSimilarity).toBeGreaterThan(0);
    });

    test('should handle Unicode characters', () => {
      const text1 = 'こんにちは世界';
      const text2 = 'こんにちは地球';
      
      const result = calculateSimilarity(text1, text2);
      expect(result.overallSimilarity).toBeGreaterThan(0);
    });

    test('should handle very long texts', () => {
      const longText1 = 'word '.repeat(10000);
      const longText2 = 'word '.repeat(9999) + 'different';
      
      const result = calculateSimilarity(longText1, longText2);
      expect(result.overallSimilarity).toBeGreaterThan(0.9);
    });
  });
});