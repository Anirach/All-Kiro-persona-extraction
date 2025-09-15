"use strict";
/**
 * Similarity calculation utilities for evidence deduplication
 * Implements cosine similarity, MinHash, and SimHash algorithms
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SIMILARITY_CONFIG = void 0;
exports.preprocessText = preprocessText;
exports.generateShingles = generateShingles;
exports.jaccardSimilarity = jaccardSimilarity;
exports.cosineSimilarity = cosineSimilarity;
exports.generateMinHashSignature = generateMinHashSignature;
exports.minHashSimilarity = minHashSimilarity;
exports.generateSimHash = generateSimHash;
exports.hammingDistance = hammingDistance;
exports.simHashSimilarity = simHashSimilarity;
exports.fastSimilarityCheck = fastSimilarityCheck;
exports.calculateSimilarity = calculateSimilarity;
exports.calculateSimilarityMatrix = calculateSimilarityMatrix;
var crypto_1 = require("crypto");
/**
 * Default similarity configuration
 */
exports.DEFAULT_SIMILARITY_CONFIG = {
    cosineSimilarityThreshold: 0.85,
    minHashSignatureLength: 128,
    simHashDimensions: 64,
    shingleSize: 3,
};
/**
 * Text preprocessing for similarity calculations
 */
function preprocessText(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
/**
 * Generate n-grams (shingles) from text
 */
function generateShingles(text, shingleSize) {
    if (shingleSize === void 0) { shingleSize = 3; }
    var processed = preprocessText(text);
    var words = processed.split(' ');
    var shingles = new Set();
    if (words.length < shingleSize) {
        shingles.add(words.join(' '));
        return shingles;
    }
    for (var i = 0; i <= words.length - shingleSize; i++) {
        var shingle = words.slice(i, i + shingleSize).join(' ');
        shingles.add(shingle);
    }
    return shingles;
}
/**
 * Calculate Jaccard similarity between two sets
 */
function jaccardSimilarity(set1, set2) {
    if (set1.size === 0 && set2.size === 0)
        return 1.0;
    var set1Array = Array.from(set1);
    var set2Array = Array.from(set2);
    var intersection = new Set(set1Array.filter(function (x) { return set2.has(x); }));
    var union = new Set(set1Array.concat(set2Array));
    return intersection.size / union.size;
}
/**
 * Calculate cosine similarity between two texts using TF-IDF vectors
 */
function cosineSimilarity(text1, text2) {
    var shingles1 = generateShingles(text1);
    var shingles2 = generateShingles(text2);
    // Use all unique shingles as vocabulary
    var shingles1Array = Array.from(shingles1);
    var shingles2Array = Array.from(shingles2);
    var vocabulary = new Set(shingles1Array.concat(shingles2Array));
    if (vocabulary.size === 0)
        return 1.0;
    // Create frequency vectors
    var vector1 = [];
    var vector2 = [];
    var vocabularyArray = Array.from(vocabulary);
    for (var _i = 0, vocabularyArray_1 = vocabularyArray; _i < vocabularyArray_1.length; _i++) {
        var shingle = vocabularyArray_1[_i];
        vector1.push(shingles1.has(shingle) ? 1 : 0);
        vector2.push(shingles2.has(shingle) ? 1 : 0);
    }
    // Calculate dot product
    var dotProduct = 0;
    var magnitude1 = 0;
    var magnitude2 = 0;
    for (var i = 0; i < vector1.length; i++) {
        var v1 = vector1[i] || 0;
        var v2 = vector2[i] || 0;
        dotProduct += v1 * v2;
        magnitude1 += v1 * v1;
        magnitude2 += v2 * v2;
    }
    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);
    if (magnitude1 === 0 || magnitude2 === 0)
        return 0;
    return dotProduct / (magnitude1 * magnitude2);
}
/**
 * Hash function for MinHash
 */
function hashFunction(input, seed) {
    var hash = (0, crypto_1.createHash)('sha256');
    hash.update(input + seed.toString());
    var hashHex = hash.digest('hex');
    return parseInt(hashHex.substring(0, 8), 16);
}
/**
 * Generate MinHash signature for a set of shingles
 */
function generateMinHashSignature(shingles, signatureLength) {
    if (signatureLength === void 0) { signatureLength = exports.DEFAULT_SIMILARITY_CONFIG.minHashSignatureLength; }
    var signature = new Array(signatureLength).fill(Number.MAX_SAFE_INTEGER);
    var shinglesArray = Array.from(shingles);
    for (var _i = 0, shinglesArray_1 = shinglesArray; _i < shinglesArray_1.length; _i++) {
        var shingle = shinglesArray_1[_i];
        for (var i = 0; i < signatureLength; i++) {
            var hash = hashFunction(shingle, i);
            var currentValue = signature[i];
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
function minHashSimilarity(signature1, signature2) {
    if (signature1.length !== signature2.length) {
        throw new Error('MinHash signatures must have the same length');
    }
    var matches = 0;
    for (var i = 0; i < signature1.length; i++) {
        if (signature1[i] === signature2[i]) {
            matches++;
        }
    }
    return matches / signature1.length;
}
/**
 * Generate SimHash fingerprint for text
 */
function generateSimHash(text, dimensions) {
    if (dimensions === void 0) { dimensions = exports.DEFAULT_SIMILARITY_CONFIG.simHashDimensions; }
    var shingles = generateShingles(text);
    var shinglesArray = Array.from(shingles);
    var weightedVector = new Array(dimensions).fill(0);
    for (var _i = 0, shinglesArray_2 = shinglesArray; _i < shinglesArray_2.length; _i++) {
        var shingle = shinglesArray_2[_i];
        var hash = (0, crypto_1.createHash)('sha256');
        hash.update(shingle);
        var hashHex = hash.digest('hex');
        // Convert hash to binary and update weighted vector
        for (var i = 0; i < dimensions && i < hashHex.length * 4; i++) {
            var hexChar = hashHex[Math.floor(i / 4)];
            if (hexChar) {
                var hexDigit = parseInt(hexChar, 16);
                var bit = (hexDigit >> (3 - (i % 4))) & 1;
                var currentValue = weightedVector[i];
                if (currentValue !== undefined) {
                    weightedVector[i] = currentValue + (bit ? 1 : -1);
                }
            }
        }
    }
    // Generate final fingerprint
    var fingerprint = '';
    for (var i = 0; i < dimensions; i++) {
        var value = weightedVector[i];
        fingerprint += (value !== undefined && value >= 0) ? '1' : '0';
    }
    return fingerprint;
}
/**
 * Calculate Hamming distance between two SimHash fingerprints
 */
function hammingDistance(fingerprint1, fingerprint2) {
    if (fingerprint1.length !== fingerprint2.length) {
        throw new Error('SimHash fingerprints must have the same length');
    }
    var distance = 0;
    for (var i = 0; i < fingerprint1.length; i++) {
        if (fingerprint1[i] !== fingerprint2[i]) {
            distance++;
        }
    }
    return distance;
}
/**
 * Calculate SimHash similarity (1 - normalized Hamming distance)
 */
function simHashSimilarity(fingerprint1, fingerprint2) {
    var distance = hammingDistance(fingerprint1, fingerprint2);
    return 1 - (distance / fingerprint1.length);
}
/**
 * Fast similarity check using SimHash
 * Returns true if texts are likely similar (above threshold)
 */
function fastSimilarityCheck(text1, text2, threshold, dimensions) {
    if (threshold === void 0) { threshold = 0.85; }
    if (dimensions === void 0) { dimensions = exports.DEFAULT_SIMILARITY_CONFIG.simHashDimensions; }
    var fingerprint1 = generateSimHash(text1, dimensions);
    var fingerprint2 = generateSimHash(text2, dimensions);
    var similarity = simHashSimilarity(fingerprint1, fingerprint2);
    return similarity >= threshold;
}
/**
 * Calculate comprehensive similarity between two texts
 */
function calculateSimilarity(text1, text2, config) {
    if (config === void 0) { config = exports.DEFAULT_SIMILARITY_CONFIG; }
    // Generate shingles and signatures
    var shingles1 = generateShingles(text1, config.shingleSize);
    var shingles2 = generateShingles(text2, config.shingleSize);
    var minHashSig1 = generateMinHashSignature(shingles1, config.minHashSignatureLength);
    var minHashSig2 = generateMinHashSignature(shingles2, config.minHashSignatureLength);
    var simHashFp1 = generateSimHash(text1, config.simHashDimensions);
    var simHashFp2 = generateSimHash(text2, config.simHashDimensions);
    // Calculate similarities
    var cosine = cosineSimilarity(text1, text2);
    var jaccard = jaccardSimilarity(shingles1, shingles2);
    var minHash = minHashSimilarity(minHashSig1, minHashSig2);
    var simHash = simHashSimilarity(simHashFp1, simHashFp2);
    // Weighted overall similarity (cosine has highest weight)
    var overall = (cosine * 0.4) + (jaccard * 0.25) + (minHash * 0.2) + (simHash * 0.15);
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
function calculateSimilarityMatrix(texts, config) {
    if (config === void 0) { config = exports.DEFAULT_SIMILARITY_CONFIG; }
    var n = texts.length;
    var matrix = Array(n).fill(null).map(function () { return Array(n).fill(0); });
    if (n === 0)
        return matrix;
    // Precompute signatures for efficiency
    var signatures = texts.map(function (text) { return ({
        shingles: generateShingles(text, config.shingleSize),
        minHash: generateMinHashSignature(generateShingles(text, config.shingleSize), config.minHashSignatureLength),
        simHash: generateSimHash(text, config.simHashDimensions),
    }); });
    // Calculate similarities
    for (var i = 0; i < n; i++) {
        var matrixRow = matrix[i];
        if (matrixRow) {
            matrixRow[i] = 1.0; // Self-similarity
        }
        for (var j = i + 1; j < n; j++) {
            var text1 = texts[i];
            var text2 = texts[j];
            var sig1 = signatures[i];
            var sig2 = signatures[j];
            if (text1 && text2 && sig1 && sig2) {
                var cosine = cosineSimilarity(text1, text2);
                var jaccard = jaccardSimilarity(sig1.shingles, sig2.shingles);
                var minHash = minHashSimilarity(sig1.minHash, sig2.minHash);
                var simHash = simHashSimilarity(sig1.simHash, sig2.simHash);
                var overall = (cosine * 0.4) + (jaccard * 0.25) + (minHash * 0.2) + (simHash * 0.15);
                var matrixRowI = matrix[i];
                var matrixRowJ = matrix[j];
                if (matrixRowI && matrixRowJ) {
                    matrixRowI[j] = overall;
                    matrixRowJ[i] = overall; // Symmetric
                }
            }
        }
    }
    return matrix;
}
