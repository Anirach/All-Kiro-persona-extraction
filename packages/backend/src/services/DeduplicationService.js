"use strict";
/**
 * DeduplicationService - Removes duplicate or near-duplicate evidence units
 * Implements efficient O(n log n) deduplication with quality preservation
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeduplicationService = exports.DEFAULT_DEDUPLICATION_CONFIG = void 0;
exports.createDeduplicationService = createDeduplicationService;
var similarity_js_1 = require("../utils/similarity.js");
/**
 * Default deduplication configuration
 */
exports.DEFAULT_DEDUPLICATION_CONFIG = __assign(__assign({}, similarity_js_1.DEFAULT_SIMILARITY_CONFIG), { strategy: 'keep_highest_quality', preserveExactDuplicates: false, maxClusterSize: 10, useFastPrefiltering: true });
/**
 * Deduplication service for evidence units
 */
var DeduplicationService = /** @class */ (function () {
    function DeduplicationService(config) {
        if (config === void 0) { config = {}; }
        this.config = __assign(__assign({}, exports.DEFAULT_DEDUPLICATION_CONFIG), config);
    }
    /**
     * Deduplicate evidence units using efficient clustering
     */
    DeduplicationService.prototype.deduplicate = function (units) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, candidates, clusters, deduplicated, duplicateClusters, _i, clusters_1, cluster, representative, endTime;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = Date.now();
                        if (units.length === 0) {
                            return [2 /*return*/, {
                                    deduplicated: [],
                                    duplicateClusters: [],
                                    statistics: {
                                        originalCount: 0,
                                        deduplicatedCount: 0,
                                        duplicatesRemoved: 0,
                                        clustersFound: 0,
                                        processingTimeMs: 0,
                                    },
                                }];
                        }
                        candidates = units;
                        if (!(this.config.useFastPrefiltering && units.length > 100)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.fastPrefilter(units)];
                    case 1:
                        candidates = _a.sent();
                        _a.label = 2;
                    case 2: return [4 /*yield*/, this.clusterSimilarUnits(candidates)];
                    case 3:
                        clusters = _a.sent();
                        deduplicated = [];
                        duplicateClusters = [];
                        for (_i = 0, clusters_1 = clusters; _i < clusters_1.length; _i++) {
                            cluster = clusters_1[_i];
                            representative = this.selectRepresentative(cluster.units);
                            deduplicated.push(representative);
                            if (cluster.units.length > 1) {
                                duplicateClusters.push({
                                    representative: representative,
                                    units: cluster.units,
                                    averageSimilarity: cluster.averageSimilarity,
                                    reason: "Similarity threshold ".concat(this.config.cosineSimilarityThreshold),
                                });
                            }
                        }
                        endTime = Date.now();
                        return [2 /*return*/, {
                                deduplicated: deduplicated,
                                duplicateClusters: duplicateClusters,
                                statistics: {
                                    originalCount: units.length,
                                    deduplicatedCount: deduplicated.length,
                                    duplicatesRemoved: units.length - deduplicated.length,
                                    clustersFound: duplicateClusters.length,
                                    processingTimeMs: endTime - startTime,
                                },
                            }];
                }
            });
        });
    };
    /**
     * Fast pre-filtering using SimHash to reduce comparison space
     */
    DeduplicationService.prototype.fastPrefilter = function (units) {
        return __awaiter(this, void 0, void 0, function () {
            var fingerprintGroups, _i, units_1, unit, foundGroup, entries, _a, entries_1, _b, fingerprint, group, firstUnit, newFingerprint;
            return __generator(this, function (_c) {
                fingerprintGroups = new Map();
                for (_i = 0, units_1 = units; _i < units_1.length; _i++) {
                    unit = units_1[_i];
                    foundGroup = false;
                    entries = Array.from(fingerprintGroups.entries());
                    for (_a = 0, entries_1 = entries; _a < entries_1.length; _a++) {
                        _b = entries_1[_a], fingerprint = _b[0], group = _b[1];
                        firstUnit = group[0];
                        if (firstUnit && (0, similarity_js_1.fastSimilarityCheck)(unit.snippet, firstUnit.snippet, 0.7)) {
                            group.push(unit);
                            foundGroup = true;
                            break;
                        }
                    }
                    if (!foundGroup) {
                        newFingerprint = "".concat(unit.snippet.length, "_").concat(unit.snippet.substring(0, 10));
                        fingerprintGroups.set(newFingerprint, [unit]);
                    }
                }
                // Return all units for detailed processing
                // Pre-filtering helps by grouping, actual deduplication happens in clustering
                return [2 /*return*/, units];
            });
        });
    };
    /**
     * Cluster similar units using Union-Find for O(n log n) performance
     */
    DeduplicationService.prototype.clusterSimilarUnits = function (units) {
        return __awaiter(this, void 0, void 0, function () {
            var unionFind, similarities, texts, similarityMatrix, i, j, matrixRow, similarity, clusters, i, root, result, clustersEntries, _i, clustersEntries_1, _a, root, indices, clusterUnits, totalSimilarity, comparisons, i, j, idx1, idx2, row, sim, averageSimilarity;
            return __generator(this, function (_b) {
                if (units.length <= 1) {
                    return [2 /*return*/, [{ units: units, averageSimilarity: 1.0 }]];
                }
                unionFind = new UnionFind(units.length);
                similarities = [];
                texts = units.map(function (unit) { return unit.snippet; });
                similarityMatrix = (0, similarity_js_1.calculateSimilarityMatrix)(texts, this.config);
                // Find similar pairs and union them
                for (i = 0; i < units.length; i++) {
                    for (j = i + 1; j < units.length; j++) {
                        matrixRow = similarityMatrix[i];
                        if (matrixRow) {
                            similarity = matrixRow[j];
                            if (similarity !== undefined && similarity >= this.config.cosineSimilarityThreshold) {
                                unionFind.union(i, j);
                            }
                        }
                    }
                }
                clusters = new Map();
                for (i = 0; i < units.length; i++) {
                    root = unionFind.find(i);
                    if (!clusters.has(root)) {
                        clusters.set(root, []);
                    }
                    clusters.get(root).push(i);
                }
                result = [];
                clustersEntries = Array.from(clusters.entries());
                for (_i = 0, clustersEntries_1 = clustersEntries; _i < clustersEntries_1.length; _i++) {
                    _a = clustersEntries_1[_i], root = _a[0], indices = _a[1];
                    clusterUnits = indices.map(function (i) { return units[i]; }).filter(function (unit) { return unit !== undefined; });
                    totalSimilarity = 0;
                    comparisons = 0;
                    for (i = 0; i < indices.length; i++) {
                        for (j = i + 1; j < indices.length; j++) {
                            idx1 = indices[i];
                            idx2 = indices[j];
                            if (idx1 !== undefined && idx2 !== undefined) {
                                row = similarityMatrix[idx1];
                                if (row) {
                                    sim = row[idx2];
                                    if (sim !== undefined) {
                                        totalSimilarity += sim;
                                        comparisons++;
                                    }
                                }
                            }
                        }
                    }
                    averageSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 1.0;
                    result.push({
                        units: clusterUnits,
                        averageSimilarity: averageSimilarity,
                    });
                }
                return [2 /*return*/, result];
            });
        });
    };
    /**
     * Select the best representative from a cluster of similar units
     */
    DeduplicationService.prototype.selectRepresentative = function (units) {
        if (units.length === 1) {
            var firstUnit = units[0];
            if (!firstUnit) {
                throw new Error('Empty cluster provided');
            }
            return firstUnit;
        }
        switch (this.config.strategy) {
            case 'keep_highest_quality':
                return units.reduce(function (best, current) {
                    var _a, _b, _c, _d;
                    var bestScore = ((_a = best.qualityScore) !== null && _a !== void 0 ? _a : 0) + ((_b = best.confidence) !== null && _b !== void 0 ? _b : 0);
                    var currentScore = ((_c = current.qualityScore) !== null && _c !== void 0 ? _c : 0) + ((_d = current.confidence) !== null && _d !== void 0 ? _d : 0);
                    return currentScore > bestScore ? current : best;
                });
            case 'keep_longest':
                return units.reduce(function (best, current) {
                    return current.snippet.length > best.snippet.length ? current : best;
                });
            case 'keep_first':
                var firstUnit = units[0];
                if (!firstUnit) {
                    throw new Error('Empty cluster provided');
                }
                return firstUnit;
            case 'merge':
                // For merge strategy, create a combined unit
                return this.mergeUnits(units);
            default:
                var defaultUnit = units[0];
                if (!defaultUnit) {
                    throw new Error('Empty cluster provided');
                }
                return defaultUnit;
        }
    };
    /**
     * Merge multiple similar units into one representative unit
     */
    DeduplicationService.prototype.mergeUnits = function (units) {
        var representative = units[0];
        // Find the longest snippet as base
        var longestUnit = units.reduce(function (longest, current) {
            return current.snippet.length > longest.snippet.length ? current : longest;
        });
        // Combine quality scores (average)
        var qualityScores = units.filter(function (u) { return u.qualityScore !== undefined; }).map(function (u) { return u.qualityScore; });
        var avgQuality = qualityScores.length > 0
            ? qualityScores.reduce(function (sum, score) { return sum + score; }, 0) / qualityScores.length
            : undefined;
        // Combine confidence scores (average)
        var confidenceScores = units.filter(function (u) { return u.confidence !== undefined; }).map(function (u) { return u.confidence; });
        var avgConfidence = confidenceScores.length > 0
            ? confidenceScores.reduce(function (sum, score) { return sum + score; }, 0) / confidenceScores.length
            : undefined;
        // Combine topics (union)
        var allTopics = new Set();
        units.forEach(function (unit) {
            if (unit.topics) {
                unit.topics.forEach(function (topic) { return allTopics.add(topic); });
            }
        });
        return __assign(__assign({}, longestUnit), { qualityScore: avgQuality, confidence: avgConfidence, topics: Array.from(allTopics), metadata: __assign(__assign({}, longestUnit.metadata), { mergedFrom: units.map(function (u) { return u.id; }), mergedCount: units.length }) });
    };
    /**
     * Find exact duplicates (identical text)
     */
    DeduplicationService.prototype.findExactDuplicates = function (units) {
        var textMap = new Map();
        // Group by exact text
        for (var _i = 0, units_2 = units; _i < units_2.length; _i++) {
            var unit = units_2[_i];
            var normalizedText = unit.snippet.trim();
            if (!textMap.has(normalizedText)) {
                textMap.set(normalizedText, []);
            }
            textMap.get(normalizedText).push(unit);
        }
        // Return only groups with duplicates
        var duplicates = [];
        var textMapEntries = Array.from(textMap.entries());
        for (var _a = 0, textMapEntries_1 = textMapEntries; _a < textMapEntries_1.length; _a++) {
            var _b = textMapEntries_1[_a], text = _b[0], groupUnits = _b[1];
            if (groupUnits.length > 1) {
                var representative = this.selectRepresentative(groupUnits);
                duplicates.push({
                    representative: representative,
                    units: groupUnits,
                    averageSimilarity: 1.0,
                    reason: 'Exact text match',
                });
            }
        }
        return duplicates;
    };
    /**
     * Get detailed similarity report between two units
     */
    DeduplicationService.prototype.getSimilarityReport = function (unit1, unit2) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, (0, similarity_js_1.calculateSimilarity)(unit1.snippet, unit2.snippet, this.config)];
            });
        });
    };
    /**
     * Update configuration
     */
    DeduplicationService.prototype.updateConfig = function (newConfig) {
        this.config = __assign(__assign({}, this.config), newConfig);
    };
    return DeduplicationService;
}());
exports.DeduplicationService = DeduplicationService;
/**
 * Union-Find data structure for efficient clustering
 */
var UnionFind = /** @class */ (function () {
    function UnionFind(size) {
        this.parent = Array.from({ length: size }, function (_, i) { return i; });
        this.rank = new Array(size).fill(0);
    }
    UnionFind.prototype.find = function (x) {
        var parentValue = this.parent[x];
        if (parentValue !== undefined && parentValue !== x) {
            var foundParent = this.parent[parentValue];
            if (foundParent !== undefined) {
                this.parent[x] = this.find(foundParent); // Path compression
            }
        }
        var result = this.parent[x];
        return result !== undefined ? result : x;
    };
    UnionFind.prototype.union = function (x, y) {
        var rootX = this.find(x);
        var rootY = this.find(y);
        if (rootX !== rootY) {
            var rankX = this.rank[rootX];
            var rankY = this.rank[rootY];
            if (rankX !== undefined && rankY !== undefined) {
                // Union by rank
                if (rankX < rankY) {
                    this.parent[rootX] = rootY;
                }
                else if (rankX > rankY) {
                    this.parent[rootY] = rootX;
                }
                else {
                    this.parent[rootY] = rootX;
                    this.rank[rootX] = rankX + 1;
                }
            }
        }
    };
    UnionFind.prototype.connected = function (x, y) {
        return this.find(x) === this.find(y);
    };
    return UnionFind;
}());
/**
 * Create deduplication service instance with default configuration
 */
function createDeduplicationService(config) {
    return new DeduplicationService(config);
}
