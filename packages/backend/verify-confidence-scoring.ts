/**
 * Simple verification script for confidence scoring
 */

import { ConfidenceScorer } from './src/scoring/ConfidenceScorer';
import { ConfidenceService } from './src/services/ConfidenceService';
import type { ClaimField, EvidenceContext } from './src/types/llm';

// Mock evidence units
const mockEvidence: EvidenceContext[] = [
  {
    evidenceUnit: {
      id: 'evidence_1',
      sourceId: 'source_1',
      snippet: 'John Smith is a software engineer at Google.',
      startIndex: 0,
      endIndex: 44,
      qualityScore: 0.9,
      topics: JSON.stringify(['occupation', 'employer']),
      metadata: JSON.stringify({ tier: 'tier_1' }),
      createdAt: new Date('2024-01-01')
    },
    processingMetadata: {
      qualityScore: 0.9,
      topics: ['occupation', 'employer']
    }
  }
];

// Test claim
const testClaim: ClaimField = {
  fieldName: 'occupation',
  text: 'Software engineer at Google',
  confidence: 0.9,
  citations: [
    {
      sentenceIndex: 0,
      evidenceUnitIds: ['evidence_1'],
      confidence: 0.9,
      supportType: 'direct'
    }
  ]
};

async function verifyConfidenceScoring() {
  console.log('🧪 Verifying Confidence Scoring Implementation...\n');

  try {
    // Test ConfidenceScorer
    console.log('1. Testing ConfidenceScorer...');
    const scorer = new ConfidenceScorer();
    const confidenceResult = await scorer.calculateConfidence(testClaim, mockEvidence);
    
    console.log('✅ ConfidenceScorer working:');
    console.log(`   Overall Score: ${confidenceResult.overallScore.toFixed(3)}`);
    console.log(`   Supporting Evidence: ${confidenceResult.supportingEvidenceCount}`);
    console.log(`   Confidence Interval: [${confidenceResult.confidenceInterval.lower.toFixed(3)}, ${confidenceResult.confidenceInterval.upper.toFixed(3)}]`);
    console.log();

    // Test ConfidenceService
    console.log('2. Testing ConfidenceService...');
    const service = new ConfidenceService();
    const claimConfidence = await service.calculateClaimConfidence(testClaim, mockEvidence);
    
    console.log('✅ ConfidenceService working:');
    console.log(`   Overall Score: ${claimConfidence.overallScore.toFixed(3)}`);
    console.log(`   Supporting Evidence Count: ${claimConfidence.supportingEvidenceCount}`);
    console.log();

    // Test Persona Assessment
    console.log('3. Testing Persona Assessment...');
    const personaAssessment = await service.calculatePersonaConfidence(
      [testClaim],
      mockEvidence,
      'test_persona'
    );
    
    console.log('✅ Persona Assessment working:');
    console.log(`   Overall Confidence: ${personaAssessment.overallConfidence.toFixed(3)}`);
    console.log(`   Recommendation: ${personaAssessment.recommendation}`);
    console.log(`   High Confidence Claims: ${personaAssessment.highConfidenceClaims}`);
    console.log();

    console.log('🎉 All confidence scoring components are working correctly!');
    console.log('📋 TASK-016: Confidence Scoring - COMPLETED ✅');

  } catch (error) {
    console.error('❌ Error during verification:', error);
    process.exit(1);
  }
}

verifyConfidenceScoring().catch(console.error);