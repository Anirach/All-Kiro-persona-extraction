/**
 * Unit tests for text unitization utilities
 * Tests for boundary detection, unitization validation, and edge cases
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { 
  unitizeText, 
  validateUnitization, 
  normalizeText, 
  findSentenceBoundaries, 
  findParagraphBoundaries,
  countWords,
  countSentences,
  startsAtBoundary,
  endsAtBoundary,
  createTextUnit,
  DEFAULT_UNITIZATION_CONFIG
} from '../../utils/textUtils';

describe('Text Normalization', () => {
  test('should normalize whitespace', () => {
    const input = "Multiple   spaces   and\ttabs\nand newlines";
    const expected = "Multiple spaces and tabs and newlines";
    expect(normalizeText(input)).toBe(expected);
  });

  test('should clean up punctuation', () => {
    const input = "Too....many....periods...and!!!exclamations???";
    const expected = "Too...many...periods...and!!!exclamations???";
    expect(normalizeText(input)).toBe(expected);
  });

  test('should normalize quotes', () => {
    const input = ""Curly quotes" and 'smart apostrophes'";
    const expected = '"Curly quotes" and \'smart apostrophes\'';
    expect(normalizeText(input)).toBe(expected);
  });

  test('should trim whitespace', () => {
    const input = "  Leading and trailing spaces  ";
    const expected = "Leading and trailing spaces";
    expect(normalizeText(input)).toBe(expected);
  });
});

describe('Boundary Detection', () => {
  test('should find sentence boundaries correctly', () => {
    const text = "First sentence. Second sentence! Third sentence? Fourth.";
    const boundaries = findSentenceBoundaries(text);
    
    expect(boundaries).toContain(0); // Start
    expect(boundaries).toContain(16); // After "First sentence."
    expect(boundaries).toContain(33); // After "Second sentence!"
    expect(boundaries).toContain(50); // After "Third sentence?"
    expect(boundaries).toContain(text.length); // End
  });

  test('should find paragraph boundaries correctly', () => {
    const text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.";
    const boundaries = findParagraphBoundaries(text);
    
    expect(boundaries).toContain(0); // Start
    expect(boundaries).toContain(18); // After first paragraph
    expect(boundaries).toContain(37); // After second paragraph
    expect(boundaries).toContain(text.length); // End
  });

  test('should handle text with no boundaries', () => {
    const text = "NoSentenceBoundariesAtAll";
    const boundaries = findSentenceBoundaries(text);
    
    expect(boundaries).toEqual([0, text.length]);
  });
});

describe('Text Metrics', () => {
  test('should count words correctly', () => {
    expect(countWords("The quick brown fox")).toBe(4);
    expect(countWords("  Multiple   spaces  ")).toBe(2);
    expect(countWords("")).toBe(0);
    expect(countWords("Single")).toBe(1);
  });

  test('should count sentences correctly', () => {
    expect(countSentences("First sentence. Second sentence!")).toBe(2);
    expect(countSentences("No sentence boundaries")).toBe(1);
    expect(countSentences("Multiple! Exclamations! Here!")).toBe(3);
    expect(countSentences("")).toBe(1); // Default minimum
  });
});

describe('Boundary Validation', () => {
  const fullText = "First sentence. Second sentence. Third sentence.";
  
  test('should detect start boundaries correctly', () => {
    expect(startsAtBoundary("First sentence.", fullText, 0)).toBe(true);
    expect(startsAtBoundary("Second sentence.", fullText, 16)).toBe(true);
    expect(startsAtBoundary("ond sentence.", fullText, 18)).toBe(false);
  });

  test('should detect end boundaries correctly', () => {
    expect(endsAtBoundary("First sentence.", fullText, 15)).toBe(true);
    expect(endsAtBoundary("First sen", fullText, 9)).toBe(false);
    expect(endsAtBoundary("Third sentence.", fullText, fullText.length)).toBe(true);
  });
});

describe('Text Unitization', () => {
  test('should handle empty text', () => {
    const result = unitizeText("");
    expect(result).toHaveLength(0);
  });

  test('should handle very short text', () => {
    const text = "Short.";
    const result = unitizeText(text);
    
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe(text);
    expect(result[0].startIndex).toBe(0);
    expect(result[0].endIndex).toBe(text.length);
  });

  test('should handle text within max size', () => {
    const text = "This is a test sentence that is exactly within the maximum size limit.";
    const result = unitizeText(text);
    
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe(text);
  });

  test('should create multiple units for long text', () => {
    const sentences = Array(20).fill("This is a test sentence.").join(" ");
    const result = unitizeText(sentences);
    
    expect(result.length).toBeGreaterThan(1);
    
    // Check that units are within size constraints
    result.forEach(unit => {
      expect(unit.text.length).toBeGreaterThanOrEqual(DEFAULT_UNITIZATION_CONFIG.minUnitSize);
      expect(unit.text.length).toBeLessThanOrEqual(DEFAULT_UNITIZATION_CONFIG.maxUnitSize);
    });
  });

  test('should preserve sentence boundaries when possible', () => {
    const text = "First sentence. Second sentence. Third sentence. Fourth sentence.";
    const result = unitizeText(text, { preferredSize: 30 });
    
    // Should split at sentence boundaries
    expect(result.length).toBeGreaterThan(1);
    
    // Check that some units end with complete sentences
    const completeSentenceUnits = result.filter(unit => unit.hasCompleteEnd);
    expect(completeSentenceUnits.length).toBeGreaterThan(0);
  });

  test('should handle text with no natural boundaries', () => {
    const text = "a".repeat(1000);
    const result = unitizeText(text);
    
    expect(result.length).toBeGreaterThan(1);
    
    // Should still respect size constraints
    result.forEach(unit => {
      expect(unit.text.length).toBeLessThanOrEqual(DEFAULT_UNITIZATION_CONFIG.maxUnitSize);
    });
  });

  test('should provide correct metadata', () => {
    const text = "This is a test sentence. This is another test sentence.";
    const result = unitizeText(text);
    
    result.forEach(unit => {
      expect(unit.startIndex).toBeGreaterThanOrEqual(0);
      expect(unit.endIndex).toBeLessThanOrEqual(text.length);
      expect(unit.endIndex).toBeGreaterThan(unit.startIndex);
      expect(unit.wordCount).toBeGreaterThan(0);
      expect(unit.sentenceCount).toBeGreaterThan(0);
      expect(typeof unit.hasCompleteStart).toBe('boolean');
      expect(typeof unit.hasCompleteEnd).toBe('boolean');
    });
  });

  test('should handle Unicode content', () => {
    const text = "Hello world! 你好世界！ Bonjour le monde! 🌍 Unicode content works.";
    const result = unitizeText(text);
    
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe(text);
    expect(result[0].wordCount).toBeGreaterThan(0);
  });
});

describe('Unitization Validation', () => {
  test('should validate correct unitization', () => {
    const text = "This is a test sentence. This is another test sentence.";
    const units = unitizeText(text);
    const validation = validateUnitization(units, text);
    
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
    expect(validation.stats.totalUnits).toBe(units.length);
    expect(validation.stats.totalCoverage).toBeCloseTo(1.0, 1);
  });

  test('should detect validation issues', () => {
    // Create invalid units manually
    const text = "Test text for validation.";
    const invalidUnits = [
      createTextUnit(text, text, 0, 10), // Too short
      createTextUnit(text, text, 15, text.length), // Gap between units
    ];
    
    const validation = validateUnitization(invalidUnits, text);
    
    expect(validation.isValid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  test('should calculate stats correctly', () => {
    const text = "This is a test sentence. ".repeat(10); // Repeat to create multiple units
    const units = unitizeText(text);
    const validation = validateUnitization(units, text);
    
    expect(validation.stats.totalUnits).toBe(units.length);
    expect(validation.stats.avgUnitSize).toBeGreaterThan(0);
    expect(validation.stats.minUnitSize).toBeGreaterThan(0);
    expect(validation.stats.maxUnitSize).toBeGreaterThan(0);
  });
});

describe('Performance Tests', () => {
  test('should process 10KB text within 100ms', () => {
    // Generate 10KB of text
    const sentence = "This is a sample sentence for performance testing. ";
    const text = sentence.repeat(Math.ceil(10240 / sentence.length));
    
    const startTime = Date.now();
    const result = unitizeText(text);
    const endTime = Date.now();
    
    const processingTime = endTime - startTime;
    
    expect(processingTime).toBeLessThan(100);
    expect(result.length).toBeGreaterThan(0);
  });

  test('should scale reasonably with text size', () => {
    const baseSentence = "Performance test sentence. ";
    const sizes = [1000, 5000, 10000]; // 1KB, 5KB, 10KB
    const times: number[] = [];
    
    sizes.forEach(size => {
      const text = baseSentence.repeat(Math.ceil(size / baseSentence.length));
      
      const startTime = Date.now();
      unitizeText(text);
      const endTime = Date.now();
      
      times.push(endTime - startTime);
    });
    
    // Performance should scale roughly linearly
    // 10KB shouldn't take more than 10x the time of 1KB
    expect(times[2]).toBeLessThan(times[0] * 10);
  });
});

describe('Configuration Options', () => {
  test('should respect custom unitization config', () => {
    const text = "Test sentence. " * 50; // Long text
    const customConfig = {
      minUnitSize: 100,
      maxUnitSize: 200,
      preferredSize: 150,
      overlapSize: 25
    };
    
    const result = unitizeText(text, customConfig);
    
    result.forEach(unit => {
      expect(unit.text.length).toBeGreaterThanOrEqual(customConfig.minUnitSize);
      expect(unit.text.length).toBeLessThanOrEqual(customConfig.maxUnitSize);
    });
  });

  test('should handle extreme configurations gracefully', () => {
    const text = "Test sentence for extreme config.";
    
    // Very large preferred size
    const largeConfig = { preferredSize: 1000 };
    const largeResult = unitizeText(text, largeConfig);
    expect(largeResult).toHaveLength(1);
    
    // Very small preferred size
    const smallConfig = { minUnitSize: 10, maxUnitSize: 50, preferredSize: 30 };
    const smallResult = unitizeText(text, smallConfig);
    expect(smallResult.length).toBeGreaterThan(0);
  });
});