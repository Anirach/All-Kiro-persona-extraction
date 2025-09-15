/**
 * Similarity calculation utilities for evidence deduplication
 * Implements cosine similarity, MinHash, and SimHash algorithms
 */

import { createHash } from 'crypto';

/**
 * Configuration for similarity calculations
 */
export interface SimilarityConfig {
  /** Cosine similarity threshold for duplicate detection (0.0-1.0) */
  cosineSimilarityThreshold: number;
  /** MinHash signature length for approximate similarity */
  minHashSignatureLength: number;
  /** Number of hash functions for SimHash */
  simHashDimensions: number;
  /** Shingle size for n-gram generation */
  shingleSize: number;
}

/**
 * Default similarity configuration
 */
export const DEFAULT_SIMILARITY_CONFIG: SimilarityConfig = {
  cosineSimilarityThreshold: 0.85,
  minHashSignatureLength: 128,
  simHashDimensions: 64,
  shingleSize: 3,
};

/**
 * Text preprocessing for similarity calculations
 */
export function preprocessText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate n-grams (shingles) from text
 */
export function generateShingles(text: string, shingleSize: number = 3): Set<string> {
  const processed = preprocessText(text);
  const words = processed.split(' ');
  const shingles = new Set<string>();
  
  if (words.length < shingleSize) {
    shingles.add(words.join(' '));
    return shingles;
  }
  
  for (let i = 0; i <= words.length - shingleSize; i++) {
    const shingle = words.slice(i, i + shingleSize).join(' ');
    shingles.add(shingle);
  }
  
  return shingles;
}

/**
 * Calculate Jaccard similarity between two sets
 */
export function jaccardSimilarity<T>(set1: Set<T>, set2: Set<T>): number {
  if (set1.size === 0 && set2.size === 0) return 1.0;
  
  const set1Array = Array.from(set1);
  const set2Array = Array.from(set2);
  const intersection = new Set(set1Array.filter(x => set2.has(x)));
  const union = new Set(set1Array.concat(set2Array));
  
  return intersection.size / union.size;
}

/**
 * Calculate cosine similarity between two texts using TF-IDF vectors
 */
export function cosineSimilarity(text1: string, text2: string): number {
  const shingles1 = generateShingles(text1);
  const shingles2 = generateShingles(text2);
  
  // Use all unique shingles as vocabulary
  const shingles1Array = Array.from(shingles1);
  const shingles2Array = Array.from(shingles2);
  const vocabulary = new Set(shingles1Array.concat(shingles2Array));
  
  if (vocabulary.size === 0) return 1.0;
  
  // Create frequency vectors
  const vector1: number[] = [];
  const vector2: number[] = [];
  
  const vocabularyArray = Array.from(vocabulary);
  for (const shingle of vocabularyArray) {
    vector1.push(shingles1.has(shingle) ? 1 : 0);
    vector2.push(shingles2.has(shingle) ? 1 : 0);
  }
  
  // Calculate dot product
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  for (let i = 0; i < vector1.length; i++) {
    const v1 = vector1[i] || 0;
    const v2 = vector2[i] || 0;
    dotProduct += v1 * v2;
    magnitude1 += v1 * v1;
    magnitude2 += v2 * v2;
  }
  
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  
  if (magnitude1 === 0 || magnitude2 === 0) return 0;
  
  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Hash function for MinHash
 */
function hashFunction(input: string, seed: number): number {
  const hash = createHash('sha256');
  hash.update(input + seed.toString());
  const hashHex = hash.digest('hex');
  return parseInt(hashHex.substring(0, 8), 16);
}

/**
 * Generate MinHash signature for a set of shingles
 */
export function generateMinHashSignature(
  shingles: Set<string>, 
  signatureLength: number = DEFAULT_SIMILARITY_CONFIG.minHashSignatureLength
): number[] {
  const signature: number[] = new Array(signatureLength).fill(Number.MAX_SAFE_INTEGER);
  const shinglesArray = Array.from(shingles);
  
  for (const shingle of shinglesArray) {
    for (let i = 0; i < signatureLength; i++) {
      const hash = hashFunction(shingle, i);
      const currentValue = signature[i];
      if (currentValue !== undefined && hash < currentValue) {
        signature[i] = hash;
      }
    }
  }
  
  return signature;
}

/**
 * Calculate MinHash similarity between two signatures
 */
export function minHashSimilarity(signature1: number[], signature2: number[]): number {
  if (signature1.length !== signature2.length) {
    throw new Error('MinHash signatures must have the same length');
  }
  
  let matches = 0;
  for (let i = 0; i < signature1.length; i++) {
    if (signature1[i] === signature2[i]) {
      matches++;
    }
  }
  
  return matches / signature1.length;
}

/**
 * Generate SimHash fingerprint for text
 */
export function generateSimHash(
  text: string, 
  dimensions: number = DEFAULT_SIMILARITY_CONFIG.simHashDimensions
): string {
  const shingles = generateShingles(text);
  const shinglesArray = Array.from(shingles);
  const weightedVector: number[] = new Array(dimensions).fill(0);
  
  for (const shingle of shinglesArray) {
    const hash = createHash('sha256');
    hash.update(shingle);
    const hashHex = hash.digest('hex');
    
    // Convert hash to binary and update weighted vector
    for (let i = 0; i < dimensions && i < hashHex.length * 4; i++) {
      const hexChar = hashHex[Math.floor(i / 4)];
      if (hexChar) {
        const hexDigit = parseInt(hexChar, 16);
        const bit = (hexDigit >> (3 - (i % 4))) & 1;
        const currentValue = weightedVector[i];
        if (currentValue !== undefined) {
          weightedVector[i] = currentValue + (bit ? 1 : -1);
        }
      }
    }
  }
  
  // Generate final fingerprint
  let fingerprint = '';
  for (let i = 0; i < dimensions; i++) {
    const value = weightedVector[i];
    fingerprint += (value !== undefined && value >= 0) ? '1' : '0';
  }
  
  return fingerprint;
}

/**
 * Calculate Hamming distance between two SimHash fingerprints
 */
export function hammingDistance(fingerprint1: string, fingerprint2: string): number {
  if (fingerprint1.length !== fingerprint2.length) {
    throw new Error('SimHash fingerprints must have the same length');
  }
  
  let distance = 0;
  for (let i = 0; i < fingerprint1.length; i++) {
    if (fingerprint1[i] !== fingerprint2[i]) {
      distance++;
    }
  }
  
  return distance;
}

/**
 * Calculate SimHash similarity (1 - normalized Hamming distance)
 */
export function simHashSimilarity(fingerprint1: string, fingerprint2: string): number {
  const distance = hammingDistance(fingerprint1, fingerprint2);
  return 1 - (distance / fingerprint1.length);
}

/**
 * Fast similarity check using SimHash
 * Returns true if texts are likely similar (above threshold)
 */
export function fastSimilarityCheck(
  text1: string, 
  text2: string, 
  threshold: number = 0.85,
  dimensions: number = DEFAULT_SIMILARITY_CONFIG.simHashDimensions
): boolean {
  const fingerprint1 = generateSimHash(text1, dimensions);
  const fingerprint2 = generateSimHash(text2, dimensions);
  const similarity = simHashSimilarity(fingerprint1, fingerprint2);
  
  return similarity >= threshold;
}

/**
 * Comprehensive similarity calculation using multiple methods
 */
export interface SimilarityResult {
  cosineSimilarity: number;
  jaccardSimilarity: number;
  minHashSimilarity: number;
  simHashSimilarity: number;
  overallSimilarity: number;
  isDuplicate: boolean;
}

/**
 * Calculate comprehensive similarity between two texts
 */
export function calculateSimilarity(
  text1: string, 
  text2: string, 
  config: SimilarityConfig = DEFAULT_SIMILARITY_CONFIG
): SimilarityResult {
  // Generate shingles and signatures
  const shingles1 = generateShingles(text1, config.shingleSize);
  const shingles2 = generateShingles(text2, config.shingleSize);
  
  const minHashSig1 = generateMinHashSignature(shingles1, config.minHashSignatureLength);
  const minHashSig2 = generateMinHashSignature(shingles2, config.minHashSignatureLength);
  
  const simHashFp1 = generateSimHash(text1, config.simHashDimensions);
  const simHashFp2 = generateSimHash(text2, config.simHashDimensions);
  
  // Calculate similarities
  const cosine = cosineSimilarity(text1, text2);
  const jaccard = jaccardSimilarity(shingles1, shingles2);
  const minHash = minHashSimilarity(minHashSig1, minHashSig2);
  const simHash = simHashSimilarity(simHashFp1, simHashFp2);
  
  // Weighted overall similarity (cosine has highest weight)
  const overall = (cosine * 0.4) + (jaccard * 0.25) + (minHash * 0.2) + (simHash * 0.15);
  
  return {
    cosineSimilarity: cosine,
    jaccardSimilarity: jaccard,
    minHashSimilarity: minHash,
    simHashSimilarity: simHash,
    overallSimilarity: overall,
    isDuplicate: overall >= config.cosineSimilarityThreshold,
  };
}

/**
 * Batch similarity calculation for efficient deduplication
 * Returns similarity matrix for all pairs
 */
export function calculateSimilarityMatrix(
  texts: string[], 
  config: SimilarityConfig = DEFAULT_SIMILARITY_CONFIG
): number[][] {
  const n = texts.length;
  const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
  
  if (n === 0) return matrix;
  
  // Precompute signatures for efficiency
  const signatures: Array<{
    shingles: Set<string>;
    minHash: number[];
    simHash: string;
  }> = texts.map(text => ({
    shingles: generateShingles(text, config.shingleSize),
    minHash: generateMinHashSignature(
      generateShingles(text, config.shingleSize), 
      config.minHashSignatureLength
    ),
    simHash: generateSimHash(text, config.simHashDimensions),
  }));
  
  // Calculate similarities
  for (let i = 0; i < n; i++) {
    const matrixRow = matrix[i];
    if (matrixRow) {
      matrixRow[i] = 1.0; // Self-similarity
    }
    
    for (let j = i + 1; j < n; j++) {
      const text1 = texts[i];
      const text2 = texts[j];
      const sig1 = signatures[i];
      const sig2 = signatures[j];
      
      if (text1 && text2 && sig1 && sig2) {
        const cosine = cosineSimilarity(text1, text2);
        const jaccard = jaccardSimilarity(sig1.shingles, sig2.shingles);
        const minHash = minHashSimilarity(sig1.minHash, sig2.minHash);
        const simHash = simHashSimilarity(sig1.simHash, sig2.simHash);
        
        const overall = (cosine * 0.4) + (jaccard * 0.25) + (minHash * 0.2) + (simHash * 0.15);
        
        const matrixRowI = matrix[i];
        const matrixRowJ = matrix[j];
        if (matrixRowI && matrixRowJ) {
          matrixRowI[j] = overall;
          matrixRowJ[i] = overall; // Symmetric
        }
      }
    }
  }
  
  return matrix;
}