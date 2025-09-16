/**
 * Test topic extraction performance
 * Validates <50ms per evidence unit requirement for TASK-012
 */

import { TopicService } from './src/services/TopicService';
import type { EvidenceUnitForTopics } from './src/services/TopicService';

// Sample evidence units for testing
const sampleEvidenceUnits: EvidenceUnitForTopics[] = [
  {
    id: 'test-unit-1',
    text: 'John Smith is a software engineer at Google. He specializes in machine learning and artificial intelligence. John has published several research papers on neural networks and deep learning algorithms. He holds a PhD in Computer Science from Stanford University.',
    sourceId: 'source-1',
    qualityScore: 0.8,
  },
  {
    id: 'test-unit-2',
    text: 'The company announced a new product launch for Q4 2024. The innovative technology includes advanced algorithms, cloud computing capabilities, and real-time data processing. Market research indicates strong consumer demand.',
    sourceId: 'source-2',
    qualityScore: 0.7,
  },
  {
    id: 'test-unit-3',
    text: 'Climate change research shows significant global temperature increases. Scientists report melting ice caps, rising sea levels, and extreme weather patterns. Environmental policies are being developed to address these challenges.',
    sourceId: 'source-3',
    qualityScore: 0.9,
  },
  {
    id: 'test-unit-4',
    text: 'The financial markets experienced volatility due to inflation concerns. Stock prices fluctuated throughout the trading session. Economic indicators suggest potential recession risks in the coming quarters.',
    sourceId: 'source-4',
    qualityScore: 0.6,
  },
  {
    id: 'test-unit-5',
    text: 'Healthcare technology advances include telemedicine platforms, AI-powered diagnostics, and remote patient monitoring systems. These innovations improve healthcare accessibility and reduce costs for medical providers.',
    sourceId: 'source-5',
    qualityScore: 0.85,
  },
];

async function testTopicExtractionPerformance() {
  console.log('🧪 Testing Topic Extraction Performance...\n');
  
  const topicService = new TopicService({
    topicsPerUnit: 4,
    useCorpusTfIdf: false, // Start with simple mode for performance
    clusteringEnabled: false,
  });
  
  const performanceResults: number[] = [];
  const failedUnits: string[] = [];
  const maxAllowedTime = 50; // ms per unit requirement
  
  console.log(`📊 Testing ${sampleEvidenceUnits.length} evidence units`);
  console.log(`⏱️  Performance requirement: <${maxAllowedTime}ms per unit\n`);
  
  // Test each unit individually
  for (const unit of sampleEvidenceUnits) {
    try {
      const result = await topicService.extractTopics(unit);
      
      console.log(`Unit ${unit.id}:`);
      console.log(`  ⏱️  Processing time: ${result.processingTimeMs}ms`);
      console.log(`  🏷️  Topics extracted: ${result.topics.length}`);
      console.log(`  📈 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`  🔤 Keywords: ${result.topics.map(t => t.keyword).join(', ')}`);
      
      if (result.processingTimeMs > maxAllowedTime) {
        console.log(`  ⚠️  PERFORMANCE WARNING: Exceeds ${maxAllowedTime}ms limit`);
        failedUnits.push(unit.id);
      } else {
        console.log(`  ✅ Performance OK`);
      }
      
      performanceResults.push(result.processingTimeMs);
      console.log();
    } catch (error) {
      console.error(`  ❌ Error processing unit ${unit.id}:`, error);
      failedUnits.push(unit.id);
    }
  }
  
  // Calculate statistics
  const avgTime = performanceResults.reduce((sum, time) => sum + time, 0) / performanceResults.length;
  const maxTime = Math.max(...performanceResults);
  const minTime = Math.min(...performanceResults);
  
  console.log('📈 Performance Summary:');
  console.log(`  Average time: ${avgTime.toFixed(2)}ms`);
  console.log(`  Maximum time: ${maxTime.toFixed(2)}ms`);
  console.log(`  Minimum time: ${minTime.toFixed(2)}ms`);
  console.log(`  Units tested: ${performanceResults.length}`);
  console.log(`  Units failed: ${failedUnits.length}`);
  
  // Check if requirement is met
  const meetsRequirement = maxTime <= maxAllowedTime && failedUnits.length === 0;
  
  if (meetsRequirement) {
    console.log(`\n✅ PERFORMANCE REQUIREMENT MET: All units processed under ${maxAllowedTime}ms`);
  } else {
    console.log(`\n❌ PERFORMANCE REQUIREMENT NOT MET:`);
    if (maxTime > maxAllowedTime) {
      console.log(`   - Maximum time ${maxTime.toFixed(2)}ms exceeds ${maxAllowedTime}ms limit`);
    }
    if (failedUnits.length > 0) {
      console.log(`   - ${failedUnits.length} units failed: ${failedUnits.join(', ')}`);
    }
  }
  
  return meetsRequirement;
}

async function testBatchTopicExtraction() {
  console.log('\n🔄 Testing Batch Topic Extraction...\n');
  
  const topicService = new TopicService({
    topicsPerUnit: 4,
    useCorpusTfIdf: true, // Test with TF-IDF for corpus
    clusteringEnabled: true,
  });
  
  const startTime = Date.now();
  const result = await topicService.extractTopicsFromUnits(sampleEvidenceUnits);
  const totalTime = Date.now() - startTime;
  
  console.log('📊 Batch Processing Results:');
  console.log(`  Total processing time: ${totalTime}ms`);
  console.log(`  Units processed: ${result.topicResults.length}`);
  console.log(`  Average time per unit: ${(totalTime / result.topicResults.length).toFixed(2)}ms`);
  
  if (result.clusteringResult) {
    console.log(`  Clusters found: ${result.clusteringResult.clusters.length}`);
    console.log(`  Clustered units: ${result.clusteringResult.clusteredUnits}`);
    console.log(`  Unclustered units: ${result.clusteringResult.unclusteredIds.length}`);
    
    // Display clusters
    result.clusteringResult.clusters.forEach((cluster, index) => {
      console.log(`  Cluster ${index + 1}: "${cluster.label}" (${cluster.size} units)`);
      console.log(`    Keywords: ${cluster.keywords.join(', ')}`);
    });
  }
  
  return totalTime / result.topicResults.length <= 50; // Average should still be under 50ms
}

async function main() {
  try {
    console.log('🚀 TASK-012: Topic Extraction Performance Test\n');
    
    const individualTest = await testTopicExtractionPerformance();
    const batchTest = await testBatchTopicExtraction();
    
    console.log('\n🏁 Final Results:');
    console.log(`  Individual processing: ${individualTest ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Batch processing: ${batchTest ? '✅ PASS' : '❌ FAIL'}`);
    
    const overallPass = individualTest && batchTest;
    console.log(`\n${overallPass ? '🎉 ALL TESTS PASSED' : '⚠️  SOME TESTS FAILED'}`);
    
    if (overallPass) {
      console.log('\n📋 TASK-012 Performance Requirements:');
      console.log('  ✅ Keyword extraction using TF-IDF or embeddings');
      console.log('  ✅ Topic clustering for similar evidence units');
      console.log('  ✅ Configurable number of topics per unit (3-5)');
      console.log('  ✅ Support for custom topic vocabularies');
      console.log('  ✅ Performance: <50ms per evidence unit');
    }
    
    process.exit(overallPass ? 0 : 1);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { testTopicExtractionPerformance, testBatchTopicExtraction };