/**
 * Topic extraction and clustering service
 * Implements TF-IDF-based keyword extraction and k-means clustering for topics
 */

import {
  extractKeywords,
  extractKeywordsSimple,
  calculateCosineSimilarity,
  preprocessText,
  type TfIdfScore,
  type TermFrequency,
  type Document,
  type KeywordConfig,
  DEFAULT_KEYWORD_CONFIG,
} from '../utils/keywords';

/**
 * Configuration for topic extraction
 */
export interface TopicExtractionConfig extends KeywordConfig {
  topicsPerUnit: number;         // Number of topics to extract per evidence unit
  useCorpusTfIdf: boolean;       // Whether to use corpus-based TF-IDF or simple TF
  clusteringEnabled: boolean;    // Whether to perform topic clustering
  clusteringConfig: ClusteringConfig;
}

/**
 * Configuration for topic clustering
 */
export interface ClusteringConfig {
  enabled: boolean;              // Enable clustering
  numClusters: number;           // Number of clusters (0 = auto-determine)
  maxClusters: number;           // Maximum number of clusters
  minClusterSize: number;        // Minimum evidence units per cluster
  similarityThreshold: number;   // Minimum similarity for clustering
  maxIterations: number;         // Maximum k-means iterations
  convergenceThreshold: number;  // Convergence threshold for k-means
}

/**
 * Default topic extraction configuration
 */
export const DEFAULT_TOPIC_CONFIG: TopicExtractionConfig = {
  ...DEFAULT_KEYWORD_CONFIG,
  topicsPerUnit: 4,
  useCorpusTfIdf: true,
  clusteringEnabled: true,
  clusteringConfig: {
    enabled: true,
    numClusters: 0, // Auto-determine
    maxClusters: 10,
    minClusterSize: 2,
    similarityThreshold: 0.3,
    maxIterations: 100,
    convergenceThreshold: 0.001,
  },
};

/**
 * Topic extracted from evidence unit
 */
export interface ExtractedTopic {
  keyword: string;
  score: number;
  frequency: number;
  positions: number[];
  confidence: number;
}

/**
 * Evidence unit for topic extraction
 */
export interface EvidenceUnitForTopics {
  id: string;
  text: string;
  sourceId: string;
  qualityScore?: number;
  metadata?: Record<string, any>;
}

/**
 * Topic cluster containing similar evidence units
 */
export interface TopicCluster {
  id: string;
  label: string;
  keywords: string[];
  evidenceIds: string[];
  centroid: number[];
  coherenceScore: number;
  size: number;
}

/**
 * Topic extraction result
 */
export interface TopicExtractionResult {
  evidenceId: string;
  topics: ExtractedTopic[];
  clusterId?: string;
  processingTimeMs: number;
  confidence: number;
}

/**
 * Topic clustering result
 */
export interface TopicClusteringResult {
  clusters: TopicCluster[];
  unclusteredIds: string[];
  silhouetteScore: number;
  totalUnits: number;
  clusteredUnits: number;
  processingTimeMs: number;
}

/**
 * Topic extraction and clustering service
 */
export class TopicService {
  private config: TopicExtractionConfig;
  private corpus: Document[] = [];
  private vocabularyCache = new Map<string, Set<string>>();

  constructor(config: Partial<TopicExtractionConfig> = {}) {
    this.config = { ...DEFAULT_TOPIC_CONFIG, ...config };
  }

  /**
   * Update service configuration
   */
  updateConfig(config: Partial<TopicExtractionConfig>): void {
    this.config = { ...this.config, ...config };
    this.vocabularyCache.clear(); // Clear cache when config changes
  }

  /**
   * Build corpus from evidence units for TF-IDF calculation
   */
  buildCorpus(evidenceUnits: EvidenceUnitForTopics[]): void {
    this.corpus = evidenceUnits.map(unit => ({
      id: unit.id,
      text: unit.text,
      terms: preprocessText(unit.text, this.config),
    }));
  }

  /**
   * Extract topics from a single evidence unit
   */
  async extractTopics(evidenceUnit: EvidenceUnitForTopics): Promise<TopicExtractionResult> {
    const startTime = Date.now();
    
    try {
      let topics: ExtractedTopic[];
      
      if (this.config.useCorpusTfIdf && this.corpus.length > 0) {
        topics = await this.extractTopicsWithTfIdf(evidenceUnit);
      } else {
        topics = await this.extractTopicsSimple(evidenceUnit);
      }
      
      const processingTime = Date.now() - startTime;
      const confidence = this.calculateTopicConfidence(topics, evidenceUnit.text);
      
      return {
        evidenceId: evidenceUnit.id,
        topics,
        processingTimeMs: processingTime,
        confidence,
      };
    } catch (error) {
      console.error(`Topic extraction failed for unit ${evidenceUnit.id}:`, error);
      
      return {
        evidenceId: evidenceUnit.id,
        topics: [],
        processingTimeMs: Date.now() - startTime,
        confidence: 0,
      };
    }
  }

  /**
   * Extract topics using TF-IDF with corpus
   */
  private async extractTopicsWithTfIdf(evidenceUnit: EvidenceUnitForTopics): Promise<ExtractedTopic[]> {
    const tfidfScores = extractKeywords(
      evidenceUnit.text,
      this.corpus,
      {
        maxKeywords: this.config.topicsPerUnit,
        minWordLength: this.config.minWordLength,
        maxWordLength: this.config.maxWordLength,
        minTermFrequency: this.config.minTermFrequency,
        useStopWordFiltering: this.config.useStopWordFiltering,
        useStemming: this.config.useStemming,
        ngramSize: this.config.ngramSize,
      }
    );
    
    return tfidfScores.map(score => ({
      keyword: score.term,
      score: score.tfidf,
      frequency: score.tf,
      positions: score.positions,
      confidence: this.calculateKeywordConfidence(score, evidenceUnit.text),
    }));
  }

  /**
   * Extract topics using simple term frequency
   */
  private async extractTopicsSimple(evidenceUnit: EvidenceUnitForTopics): Promise<ExtractedTopic[]> {
    const frequencies = extractKeywordsSimple(
      evidenceUnit.text,
      {
        maxKeywords: this.config.topicsPerUnit,
        minWordLength: this.config.minWordLength,
        maxWordLength: this.config.maxWordLength,
        minTermFrequency: this.config.minTermFrequency,
        useStopWordFiltering: this.config.useStopWordFiltering,
        useStemming: this.config.useStemming,
        ngramSize: this.config.ngramSize,
      }
    );
    
    const terms = preprocessText(evidenceUnit.text, this.config);
    
    return frequencies.map(freq => {
      // Find positions of this term
      const positions: number[] = [];
      terms.forEach((term, index) => {
        if (term === freq.term) {
          positions.push(index);
        }
      });
      
      return {
        keyword: freq.term,
        score: freq.normalizedFrequency,
        frequency: freq.frequency,
        positions,
        confidence: this.calculateTermConfidence(freq, evidenceUnit.text),
      };
    });
  }

  /**
   * Calculate confidence for a keyword based on TF-IDF score
   */
  private calculateKeywordConfidence(score: TfIdfScore, text: string): number {
    let confidence = 0.5; // Base confidence
    
    // TF-IDF score influence (40% weight)
    const normalizedTfIdf = Math.min(score.tfidf / 0.5, 1); // Normalize assuming max ~0.5
    confidence += normalizedTfIdf * 0.4;
    
    // Term frequency influence (25% weight)
    const tfWeight = Math.min(score.tf * 10, 1); // Normalize
    confidence += tfWeight * 0.25;
    
    // Position diversity (20% weight) - keywords appearing in multiple places
    const positionDiversity = score.positions.length > 1 ? 0.2 : 0.1;
    confidence += positionDiversity;
    
    // Term length appropriateness (15% weight)
    const termLength = score.term.length;
    if (termLength >= 4 && termLength <= 12) {
      confidence += 0.15;
    } else if (termLength >= 3 && termLength <= 15) {
      confidence += 0.07;
    }
    
    return Math.min(confidence, 1);
  }

  /**
   * Calculate confidence for a term based on frequency
   */
  private calculateTermConfidence(freq: TermFrequency, text: string): number {
    let confidence = 0.4; // Base confidence (lower than TF-IDF)
    
    // Frequency influence (50% weight)
    const freqWeight = Math.min(freq.normalizedFrequency * 20, 1);
    confidence += freqWeight * 0.5;
    
    // Term length appropriateness (30% weight)
    const termLength = freq.term.length;
    if (termLength >= 4 && termLength <= 12) {
      confidence += 0.3;
    } else if (termLength >= 3 && termLength <= 15) {
      confidence += 0.15;
    }
    
    // Raw frequency bonus (20% weight)
    const rawFreqBonus = Math.min(freq.frequency / 3, 1) * 0.2;
    confidence += rawFreqBonus;
    
    return Math.min(confidence, 1);
  }

  /**
   * Calculate overall topic confidence for an evidence unit
   */
  private calculateTopicConfidence(topics: ExtractedTopic[], text: string): number {
    if (topics.length === 0) return 0;
    
    // Average topic confidence (60% weight)
    const avgTopicConfidence = topics.reduce((sum, topic) => sum + topic.confidence, 0) / topics.length;
    
    // Topic count appropriateness (25% weight)
    const topicCountScore = topics.length >= this.config.topicsPerUnit * 0.7 ? 0.25 : 0.1;
    
    // Text length appropriateness (15% weight)
    const textLength = text.length;
    const lengthScore = textLength >= 100 && textLength <= 500 ? 0.15 : 0.07;
    
    return Math.min(avgTopicConfidence * 0.6 + topicCountScore + lengthScore, 1);
  }

  /**
   * Cluster evidence units by topic similarity
   */
  async clusterByTopics(
    evidenceUnits: EvidenceUnitForTopics[],
    topicResults: TopicExtractionResult[]
  ): Promise<TopicClusteringResult> {
    const startTime = Date.now();
    const clusterConfig = this.config.clusteringConfig;
    
    if (!clusterConfig.enabled || evidenceUnits.length < clusterConfig.minClusterSize * 2) {
      return {
        clusters: [],
        unclusteredIds: evidenceUnits.map(u => u.id),
        silhouetteScore: 0,
        totalUnits: evidenceUnits.length,
        clusteredUnits: 0,
        processingTimeMs: Date.now() - startTime,
      };
    }
    
    // Create feature vectors from topics
    const featureVectors = this.createFeatureVectors(topicResults);
    
    // Determine optimal number of clusters
    const numClusters = clusterConfig.numClusters > 0
      ? clusterConfig.numClusters
      : this.determineOptimalClusters(featureVectors, clusterConfig);
    
    if (numClusters < 2) {
      return {
        clusters: [],
        unclusteredIds: evidenceUnits.map(u => u.id),
        silhouetteScore: 0,
        totalUnits: evidenceUnits.length,
        clusteredUnits: 0,
        processingTimeMs: Date.now() - startTime,
      };
    }
    
    // Perform k-means clustering
    const clusterAssignments = this.performKMeansClustering(
      featureVectors,
      numClusters,
      clusterConfig
    );
    
    // Create cluster objects
    const clusters = this.createClusters(
      clusterAssignments,
      evidenceUnits,
      topicResults,
      featureVectors
    );
    
    // Filter out small clusters
    const validClusters = clusters.filter(c => c.size >= clusterConfig.minClusterSize);
    const clusteredIds = new Set(validClusters.flatMap(c => c.evidenceIds));
    const unclusteredIds = evidenceUnits
      .map(u => u.id)
      .filter(id => !clusteredIds.has(id));
    
    // Calculate silhouette score
    const silhouetteScore = this.calculateSilhouetteScore(featureVectors, clusterAssignments);
    
    return {
      clusters: validClusters,
      unclusteredIds,
      silhouetteScore,
      totalUnits: evidenceUnits.length,
      clusteredUnits: clusteredIds.size,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Create feature vectors from topic extraction results
   */
  private createFeatureVectors(topicResults: TopicExtractionResult[]): Map<string, number[]> {
    // Collect all unique keywords
    const allKeywords = new Set<string>();
    topicResults.forEach(result => {
      result.topics.forEach(topic => allKeywords.add(topic.keyword));
    });
    
    const keywordList = Array.from(allKeywords);
    const vectors = new Map<string, number[]>();
    
    // Create feature vector for each evidence unit
    topicResults.forEach(result => {
      const vector = new Array(keywordList.length).fill(0);
      
      result.topics.forEach(topic => {
        const index = keywordList.indexOf(topic.keyword);
        if (index !== -1) {
          vector[index] = topic.score;
        }
      });
      
      vectors.set(result.evidenceId, vector);
    });
    
    return vectors;
  }

  /**
   * Determine optimal number of clusters using elbow method
   */
  private determineOptimalClusters(
    featureVectors: Map<string, number[]>,
    config: ClusteringConfig
  ): number {
    const vectors = Array.from(featureVectors.values());
    const maxK = Math.min(config.maxClusters, Math.floor(vectors.length / config.minClusterSize));
    
    if (maxK < 2) return 0;
    
    const wcssValues: number[] = [];
    
    // Calculate WCSS for k = 1 to maxK
    for (let k = 1; k <= maxK; k++) {
      const assignments = this.performKMeansClustering(featureVectors, k, config);
      const wcss = this.calculateWCSS(vectors, assignments);
      wcssValues.push(wcss);
    }
    
    // Find elbow point
    let bestK = 2;
    let maxImprovement = 0;
    
    for (let k = 2; k < wcssValues.length; k++) {
      const prevValue = wcssValues[k - 1];
      const currValue = wcssValues[k];
      if (prevValue !== undefined && currValue !== undefined) {
        const improvement = prevValue - currValue;
        if (improvement > maxImprovement) {
          maxImprovement = improvement;
          bestK = k;
        }
      }
    }
    
    return bestK;
  }

  /**
   * Perform k-means clustering
   */
  private performKMeansClustering(
    featureVectors: Map<string, number[]>,
    numClusters: number,
    config: ClusteringConfig
  ): Map<string, number> {
    const vectors = Array.from(featureVectors.values());
    const ids = Array.from(featureVectors.keys());
    const dimensions = vectors[0]?.length || 0;
    
    if (vectors.length === 0 || dimensions === 0) {
      return new Map();
    }
    
    // Initialize centroids randomly
    let centroids = this.initializeCentroids(vectors, numClusters, dimensions);
    let assignments = new Map<string, number>();
    let previousAssignments = new Map<string, number>();
    
    for (let iteration = 0; iteration < config.maxIterations; iteration++) {
      // Assign points to nearest centroid
      previousAssignments = new Map(assignments);
      assignments.clear();
      
      vectors.forEach((vector, index) => {
        const id = ids[index];
        if (!id) return;
        
        let minDistance = Infinity;
        let closestCluster = 0;
        
        centroids.forEach((centroid, clusterIndex) => {
          const distance = this.calculateEuclideanDistance(vector, centroid);
          if (distance < minDistance) {
            minDistance = distance;
            closestCluster = clusterIndex;
          }
        });
        
        assignments.set(id, closestCluster);
      });
      
      // Update centroids
      const newCentroids = this.updateCentroids(vectors, ids, assignments, numClusters, dimensions);
      
      // Check for convergence
      const centroidShift = this.calculateCentroidShift(centroids, newCentroids);
      centroids = newCentroids;
      
      if (centroidShift < config.convergenceThreshold) {
        break;
      }
    }
    
    return assignments;
  }

  /**
   * Initialize centroids using k-means++ method
   */
  private initializeCentroids(vectors: number[][], numClusters: number, dimensions: number): number[][] {
    const centroids: number[][] = [];
    
    if (vectors.length === 0) {
      return Array(numClusters).fill(null).map(() => Array(dimensions).fill(0));
    }
    
    // Choose first centroid randomly
    const firstIndex = Math.floor(Math.random() * vectors.length);
    const firstVector = vectors[firstIndex];
    if (firstVector) {
      centroids.push([...firstVector]);
    }
    
    // Choose remaining centroids with k-means++
    for (let i = 1; i < numClusters && centroids.length < numClusters; i++) {
      const distances = vectors.map(vector => {
        const minDistance = Math.min(...centroids.map(centroid =>
          this.calculateEuclideanDistance(vector, centroid)
        ));
        return minDistance * minDistance;
      });
      
      const totalDistance = distances.reduce((sum, d) => sum + d, 0);
      if (totalDistance === 0) break;
      
      const threshold = Math.random() * totalDistance;
      
      let cumulative = 0;
      let selectedIndex = 0;
      
      for (let j = 0; j < distances.length; j++) {
        const distance = distances[j];
        if (distance !== undefined) {
          cumulative += distance;
          if (cumulative >= threshold) {
            selectedIndex = j;
            break;
          }
        }
      }
      
      const selectedVector = vectors[selectedIndex];
      if (selectedVector) {
        centroids.push([...selectedVector]);
      }
    }
    
    return centroids;
  }

  /**
   * Update centroids based on current assignments
   */
  private updateCentroids(
    vectors: number[][],
    ids: string[],
    assignments: Map<string, number>,
    numClusters: number,
    dimensions: number
  ): number[][] {
    const centroids: number[][] = Array(numClusters).fill(null).map(() => Array(dimensions).fill(0));
    const clusterCounts = Array(numClusters).fill(0);
    
    // Sum vectors for each cluster
    vectors.forEach((vector, index) => {
      const cluster = assignments.get(ids[index]) || 0;
      clusterCounts[cluster]++;
      
      vector.forEach((value, dim) => {
        centroids[cluster][dim] += value;
      });
    });
    
    // Calculate averages
    centroids.forEach((centroid, cluster) => {
      const count = clusterCounts[cluster];
      if (count > 0) {
        centroid.forEach((_, dim) => {
          centroid[dim] /= count;
        });
      }
    });
    
    return centroids;
  }

  /**
   * Calculate Euclidean distance between two vectors
   */
  private calculateEuclideanDistance(vector1: number[], vector2: number[]): number {
    let sum = 0;
    for (let i = 0; i < vector1.length; i++) {
      const diff = vector1[i] - vector2[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Calculate centroid shift between iterations
   */
  private calculateCentroidShift(oldCentroids: number[][], newCentroids: number[][]): number {
    let totalShift = 0;
    
    oldCentroids.forEach((oldCentroid, index) => {
      const newCentroid = newCentroids[index];
      const shift = this.calculateEuclideanDistance(oldCentroid, newCentroid);
      totalShift += shift;
    });
    
    return totalShift / oldCentroids.length;
  }

  /**
   * Calculate Within-Cluster Sum of Squares (WCSS)
   */
  private calculateWCSS(vectors: number[][], assignments: Map<string, number>): number {
    // This is a simplified version - would need actual centroids for precise calculation
    return 0;
  }

  /**
   * Create cluster objects from assignments
   */
  private createClusters(
    assignments: Map<string, number>,
    evidenceUnits: EvidenceUnitForTopics[],
    topicResults: TopicExtractionResult[],
    featureVectors: Map<string, number[]>
  ): TopicCluster[] {
    const clusterMap = new Map<number, string[]>();
    
    // Group evidence IDs by cluster
    assignments.forEach((cluster, evidenceId) => {
      if (!clusterMap.has(cluster)) {
        clusterMap.set(cluster, []);
      }
      clusterMap.get(cluster)!.push(evidenceId);
    });
    
    const clusters: TopicCluster[] = [];
    
    clusterMap.forEach((evidenceIds, clusterIndex) => {
      // Get all topics for this cluster
      const clusterTopics = evidenceIds.flatMap(id => {
        const result = topicResults.find(r => r.evidenceId === id);
        return result ? result.topics : [];
      });
      
      // Find most common keywords
      const keywordCounts = new Map<string, number>();
      clusterTopics.forEach(topic => {
        keywordCounts.set(topic.keyword, (keywordCounts.get(topic.keyword) || 0) + 1);
      });
      
      const sortedKeywords = Array.from(keywordCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([keyword]) => keyword);
      
      // Calculate centroid
      const vectors = evidenceIds.map(id => featureVectors.get(id)!).filter(Boolean);
      const centroid = this.calculateCentroid(vectors);
      
      // Calculate coherence score
      const coherenceScore = this.calculateClusterCoherence(vectors);
      
      clusters.push({
        id: `cluster_${clusterIndex}`,
        label: sortedKeywords.slice(0, 3).join(', '),
        keywords: sortedKeywords,
        evidenceIds,
        centroid,
        coherenceScore,
        size: evidenceIds.length,
      });
    });
    
    return clusters;
  }

  /**
   * Calculate centroid of a set of vectors
   */
  private calculateCentroid(vectors: number[][]): number[] {
    if (vectors.length === 0) return [];
    
    const dimensions = vectors[0].length;
    const centroid = Array(dimensions).fill(0);
    
    vectors.forEach(vector => {
      vector.forEach((value, dim) => {
        centroid[dim] += value;
      });
    });
    
    centroid.forEach((_, dim) => {
      centroid[dim] /= vectors.length;
    });
    
    return centroid;
  }

  /**
   * Calculate cluster coherence score
   */
  private calculateClusterCoherence(vectors: number[][]): number {
    if (vectors.length < 2) return 1;
    
    let totalSimilarity = 0;
    let pairCount = 0;
    
    for (let i = 0; i < vectors.length; i++) {
      for (let j = i + 1; j < vectors.length; j++) {
        // Convert to term arrays for cosine similarity
        const terms1 = vectors[i].map((_, index) => index.toString()).filter((_, index) => vectors[i][index] > 0);
        const terms2 = vectors[j].map((_, index) => index.toString()).filter((_, index) => vectors[j][index] > 0);
        
        const similarity = calculateCosineSimilarity(terms1, terms2);
        totalSimilarity += similarity;
        pairCount++;
      }
    }
    
    return pairCount > 0 ? totalSimilarity / pairCount : 0;
  }

  /**
   * Calculate silhouette score for clustering quality
   */
  private calculateSilhouetteScore(
    featureVectors: Map<string, number[]>,
    assignments: Map<string, number>
  ): number {
    const vectors = Array.from(featureVectors.values());
    const ids = Array.from(featureVectors.keys());
    
    if (vectors.length < 2) return 0;
    
    let totalSilhouette = 0;
    
    vectors.forEach((vector, index) => {
      const id = ids[index];
      const cluster = assignments.get(id);
      
      if (cluster === undefined) return;
      
      // Calculate intra-cluster distance (a)
      const sameClusterVectors = vectors.filter((_, i) => 
        assignments.get(ids[i]) === cluster && i !== index
      );
      
      const intraDistance = sameClusterVectors.length > 0
        ? sameClusterVectors.reduce((sum, otherVector) => 
            sum + this.calculateEuclideanDistance(vector, otherVector), 0
          ) / sameClusterVectors.length
        : 0;
      
      // Calculate inter-cluster distance (b)
      const otherClusters = new Set(Array.from(assignments.values()).filter(c => c !== cluster));
      
      let minInterDistance = Infinity;
      otherClusters.forEach(otherCluster => {
        const otherClusterVectors = vectors.filter((_, i) => 
          assignments.get(ids[i]) === otherCluster
        );
        
        if (otherClusterVectors.length > 0) {
          const avgDistance = otherClusterVectors.reduce((sum, otherVector) => 
            sum + this.calculateEuclideanDistance(vector, otherVector), 0
          ) / otherClusterVectors.length;
          
          minInterDistance = Math.min(minInterDistance, avgDistance);
        }
      });
      
      // Calculate silhouette coefficient
      const silhouette = minInterDistance === Infinity 
        ? 0 
        : (minInterDistance - intraDistance) / Math.max(intraDistance, minInterDistance);
      
      totalSilhouette += silhouette;
    });
    
    return totalSilhouette / vectors.length;
  }

  /**
   * Extract topics from multiple evidence units with optional clustering
   */
  async extractTopicsFromUnits(evidenceUnits: EvidenceUnitForTopics[]): Promise<{
    topicResults: TopicExtractionResult[];
    clusteringResult?: TopicClusteringResult;
    processingTimeMs: number;
  }> {
    const startTime = Date.now();
    
    // Build corpus if using TF-IDF
    if (this.config.useCorpusTfIdf) {
      this.buildCorpus(evidenceUnits);
    }
    
    // Extract topics for each unit
    const topicResults: TopicExtractionResult[] = [];
    
    for (const unit of evidenceUnits) {
      const result = await this.extractTopics(unit);
      topicResults.push(result);
    }
    
    // Perform clustering if enabled
    let clusteringResult: TopicClusteringResult | undefined;
    if (this.config.clusteringEnabled && evidenceUnits.length > 1) {
      clusteringResult = await this.clusterByTopics(evidenceUnits, topicResults);
      
      // Update topic results with cluster IDs
      topicResults.forEach(result => {
        const cluster = clusteringResult!.clusters.find(c => 
          c.evidenceIds.includes(result.evidenceId)
        );
        if (cluster) {
          result.clusterId = cluster.id;
        }
      });
    }
    
    return {
      topicResults,
      clusteringResult,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Get vocabulary for a specific domain (cached)
   */
  getVocabulary(domain: string): Set<string> {
    if (!this.vocabularyCache.has(domain)) {
      // This could be extended to load domain-specific vocabularies
      this.vocabularyCache.set(domain, new Set());
    }
    return this.vocabularyCache.get(domain)!;
  }

  /**
   * Clear internal caches
   */
  clearCache(): void {
    this.vocabularyCache.clear();
    this.corpus = [];
  }
}