/**
 * Text processing utilities for evidence unitization
 * Provides functions for text segmentation, boundary detection, and overlap handling
 */

/**
 * Configuration for text unitization
 */
export interface UnitizationConfig {
  minUnitSize: number;     // Minimum character count per unit (default: 200)
  maxUnitSize: number;     // Maximum character count per unit (default: 400)
  overlapSize: number;     // Character overlap between units (default: 50)
  preferredSize: number;   // Target character count per unit (default: 300)
}

export const DEFAULT_UNITIZATION_CONFIG: UnitizationConfig = {
  minUnitSize: 200,
  maxUnitSize: 400,
  overlapSize: 50,
  preferredSize: 300,
};

/**
 * Represents a text unit with position metadata
 */
export interface TextUnit {
  text: string;
  startIndex: number;
  endIndex: number;
  wordCount: number;
  sentenceCount: number;
  hasCompleteStart: boolean;  // Starts at sentence boundary
  hasCompleteEnd: boolean;    // Ends at sentence boundary
}

/**
 * Sentence boundary detection patterns
 */
const SENTENCE_ENDINGS = /[.!?]+[\s\n\r]*$/;
const SENTENCE_BOUNDARIES = /([.!?]+)[\s\n\r]+/g;
const PARAGRAPH_BOUNDARIES = /\n\s*\n/g;
const WORD_BOUNDARIES = /\s+/g;

/**
 * Clean and normalize text for processing
 */
export function normalizeText(text: string): string {
  return text
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove excessive punctuation
    .replace(/[.]{3,}/g, '...')
    // Clean up quotes
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    // Trim
    .trim();
}

/**
 * Find sentence boundaries in text
 */
export function findSentenceBoundaries(text: string): number[] {
  const boundaries: number[] = [0]; // Always start at the beginning
  let match;
  
  // Reset regex state
  SENTENCE_BOUNDARIES.lastIndex = 0;
  
  while ((match = SENTENCE_BOUNDARIES.exec(text)) !== null) {
    if (match.index !== undefined && match[1]) {
      const endOfSentence = match.index + match[1].length;
      const nextSentenceStart = match.index + match[0].length;
      
      // Add the end of current sentence and start of next
      if (endOfSentence < text.length) {
        boundaries.push(nextSentenceStart);
      }
    }
  }
  
  // Always end at the text length
  if (boundaries[boundaries.length - 1] !== text.length) {
    boundaries.push(text.length);
  }
  
  return boundaries.sort((a, b) => a - b);
}

/**
 * Find paragraph boundaries in text
 */
export function findParagraphBoundaries(text: string): number[] {
  const boundaries: number[] = [0];
  let match;
  
  // Reset regex state
  PARAGRAPH_BOUNDARIES.lastIndex = 0;
  
  while ((match = PARAGRAPH_BOUNDARIES.exec(text)) !== null) {
    const paragraphEnd = match.index + match[0].length;
    if (paragraphEnd < text.length) {
      boundaries.push(paragraphEnd);
    }
  }
  
  if (boundaries[boundaries.length - 1] !== text.length) {
    boundaries.push(text.length);
  }
  
  return boundaries.sort((a, b) => a - b);
}

/**
 * Count words in text
 */
export function countWords(text: string): number {
  return text.trim().split(WORD_BOUNDARIES).filter(word => word.length > 0).length;
}

/**
 * Count sentences in text
 */
export function countSentences(text: string): number {
  const sentences = text.split(SENTENCE_BOUNDARIES).filter(s => s.trim().length > 0);
  return Math.max(1, sentences.length);
}

/**
 * Check if text starts at a natural boundary
 */
export function startsAtBoundary(text: string, fullText: string, startIndex: number): boolean {
  if (startIndex === 0) return true;
  
  const prevChar = fullText[startIndex - 1];
  const currChar = fullText[startIndex];
  
  // Check for sentence boundary
  if (prevChar && currChar && /[.!?]/.test(prevChar) && /\s/.test(currChar)) {
    return true;
  }
  
  // Check for paragraph boundary
  if (prevChar === '\n' && currChar && (currChar === '\n' || /\s/.test(currChar))) {
    return true;
  }
  
  return false;
}

/**
 * Check if text ends at a natural boundary
 */
export function endsAtBoundary(text: string, fullText: string, endIndex: number): boolean {
  if (endIndex >= fullText.length) return true;
  
  const lastChar = text[text.length - 1];
  const nextChar = fullText[endIndex];
  
  // Check for sentence boundary
  if (lastChar && nextChar && /[.!?]/.test(lastChar) && /\s/.test(nextChar)) {
    return true;
  }
  
  // Check for paragraph boundary
  if (lastChar === '\n' && nextChar && (nextChar === '\n' || /\s/.test(nextChar))) {
    return true;
  }
  
  return false;
}

/**
 * Find the best boundary near a target position
 */
export function findNearestBoundary(
  text: string, 
  targetPosition: number, 
  boundaries: number[], 
  direction: 'before' | 'after' = 'after'
): number {
  if (boundaries.length === 0) return targetPosition;
  
  // Find boundaries within reasonable distance (±100 chars)
  const maxDistance = 100;
  const candidates = boundaries.filter(boundary => {
    const distance = Math.abs(boundary - targetPosition);
    return distance <= maxDistance;
  });
  
  if (candidates.length === 0) {
    return direction === 'before' 
      ? Math.max(0, targetPosition - maxDistance)
      : Math.min(text.length, targetPosition + maxDistance);
  }
  
  // Find the best candidate based on direction preference
  if (direction === 'before') {
    const beforeCandidates = candidates.filter(b => b <= targetPosition);
    return beforeCandidates.length > 0 
      ? Math.max(...beforeCandidates)
      : Math.min(...candidates);
  } else {
    const afterCandidates = candidates.filter(b => b >= targetPosition);
    return afterCandidates.length > 0 
      ? Math.min(...afterCandidates)
      : Math.max(...candidates);
  }
}

/**
 * Create a text unit with metadata
 */
export function createTextUnit(
  text: string, 
  fullText: string, 
  startIndex: number, 
  endIndex: number
): TextUnit {
  const unitText = text.substring(startIndex, endIndex);
  
  return {
    text: unitText,
    startIndex,
    endIndex,
    wordCount: countWords(unitText),
    sentenceCount: countSentences(unitText),
    hasCompleteStart: startsAtBoundary(unitText, fullText, startIndex),
    hasCompleteEnd: endsAtBoundary(unitText, fullText, endIndex),
  };
}

/**
 * Main text unitization function
 * Segments text into units of 200-400 characters with natural boundaries and overlap
 */
export function unitizeText(
  text: string, 
  config: Partial<UnitizationConfig> = {}
): TextUnit[] {
  const normalizedText = normalizeText(text);
  const fullConfig = { ...DEFAULT_UNITIZATION_CONFIG, ...config };
  
  // Handle edge cases
  if (normalizedText.length === 0) return [];
  if (normalizedText.length <= fullConfig.maxUnitSize) {
    return [createTextUnit(normalizedText, normalizedText, 0, normalizedText.length)];
  }
  
  const units: TextUnit[] = [];
  const sentenceBoundaries = findSentenceBoundaries(normalizedText);
  const paragraphBoundaries = findParagraphBoundaries(normalizedText);
  
  let currentPosition = 0;
  
  while (currentPosition < normalizedText.length) {
    // Calculate target end position
    let targetEnd = currentPosition + fullConfig.preferredSize;
    
    // Don't go beyond text length
    if (targetEnd >= normalizedText.length) {
      targetEnd = normalizedText.length;
    } else {
      // Try to find a good boundary near the target end
      const nearestSentenceBoundary = findNearestBoundary(
        normalizedText, 
        targetEnd, 
        sentenceBoundaries, 
        'after'
      );
      
      const nearestParagraphBoundary = findNearestBoundary(
        normalizedText, 
        targetEnd, 
        paragraphBoundaries, 
        'after'
      );
      
      // Prefer paragraph boundaries, then sentence boundaries
      if (Math.abs(nearestParagraphBoundary - targetEnd) <= Math.abs(nearestSentenceBoundary - targetEnd)) {
        targetEnd = nearestParagraphBoundary;
      } else {
        targetEnd = nearestSentenceBoundary;
      }
      
      // Ensure we don't exceed max unit size
      if (targetEnd - currentPosition > fullConfig.maxUnitSize) {
        targetEnd = findNearestBoundary(
          normalizedText,
          currentPosition + fullConfig.maxUnitSize,
          sentenceBoundaries,
          'before'
        );
      }
      
      // Ensure we meet minimum unit size
      if (targetEnd - currentPosition < fullConfig.minUnitSize && targetEnd < normalizedText.length) {
        targetEnd = findNearestBoundary(
          normalizedText,
          currentPosition + fullConfig.minUnitSize,
          sentenceBoundaries,
          'after'
        );
      }
    }
    
    // Create the unit
    const unit = createTextUnit(normalizedText, normalizedText, currentPosition, targetEnd);
    units.push(unit);
    
    // Calculate next position with overlap
    if (targetEnd < normalizedText.length) {
      const overlapStart = Math.max(
        currentPosition + fullConfig.minUnitSize,
        targetEnd - fullConfig.overlapSize
      );
      
      // Find a good boundary for overlap start
      currentPosition = findNearestBoundary(
        normalizedText,
        overlapStart,
        sentenceBoundaries,
        'after'
      );
      
      // Ensure we're making progress
      if (units.length > 0 && currentPosition <= units[units.length - 1]!.startIndex) {
        currentPosition = targetEnd;
      }
    } else {
      break;
    }
  }
  
  return units;
}

/**
 * Validate that text unitization meets quality requirements
 */
export function validateUnitization(
  units: TextUnit[], 
  originalText: string,
  config: Partial<UnitizationConfig> = {}
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalUnits: number;
    avgUnitSize: number;
    minUnitSize: number;
    maxUnitSize: number;
    totalCoverage: number;
    overlapCoverage: number;
  };
} {
  const fullConfig = { ...DEFAULT_UNITIZATION_CONFIG, ...config };
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check basic requirements
  if (units.length === 0) {
    errors.push('No units generated');
    return {
      isValid: false,
      errors,
      warnings,
      stats: {
        totalUnits: 0,
        avgUnitSize: 0,
        minUnitSize: 0,
        maxUnitSize: 0,
        totalCoverage: 0,
        overlapCoverage: 0,
      },
    };
  }
  
  // Check unit size constraints
  const unitSizes = units.map(u => u.text.length);
  const minSize = Math.min(...unitSizes);
  const maxSize = Math.max(...unitSizes);
  const avgSize = unitSizes.reduce((a, b) => a + b, 0) / unitSizes.length;
  
  if (minSize < fullConfig.minUnitSize) {
    warnings.push(`Some units are smaller than minimum size (${minSize} < ${fullConfig.minUnitSize})`);
  }
  
  if (maxSize > fullConfig.maxUnitSize) {
    errors.push(`Some units exceed maximum size (${maxSize} > ${fullConfig.maxUnitSize})`);
  }
  
  // Check coverage
  const firstUnit = units[0];
  const lastUnit = units[units.length - 1];
  
  if (!firstUnit) {
    errors.push('No first unit found');
  } else if (firstUnit.startIndex !== 0) {
    errors.push('First unit does not start at text beginning');
  }
  
  if (!lastUnit) {
    errors.push('No last unit found');
  } else if (lastUnit.endIndex !== originalText.length) {
    errors.push('Last unit does not end at text end');
  }
  
  // Check for gaps
  for (let i = 1; i < units.length; i++) {
    const prevUnit = units[i - 1];
    const currUnit = units[i];
    
    if (prevUnit && currUnit && currUnit.startIndex >= prevUnit.endIndex) {
      errors.push(`Gap detected between units ${i - 1} and ${i}`);
    }
  }
  
  // Calculate overlap coverage
  let totalOverlap = 0;
  for (let i = 1; i < units.length; i++) {
    const prevUnit = units[i - 1];
    const currUnit = units[i];
    
    if (prevUnit && currUnit) {
      const overlap = Math.max(0, prevUnit.endIndex - currUnit.startIndex);
      totalOverlap += overlap;
    }
  }
  
  const overlapCoverage = totalOverlap / originalText.length;
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalUnits: units.length,
      avgUnitSize: avgSize,
      minUnitSize: minSize,
      maxUnitSize: maxSize,
      totalCoverage: firstUnit && lastUnit ? (lastUnit.endIndex - firstUnit.startIndex) / originalText.length : 0,
      overlapCoverage,
    },
  };
}