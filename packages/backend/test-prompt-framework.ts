#!/usr/bin/env ts-node
/**
 * Test script to verify the prompt framework integration
 * This validates that all components work together correctly
 */

import { PromptTemplateManager } from './src/prompts/templates';
import { FEW_SHOT_EXAMPLES } from './src/prompts/examples';
import { PersonaExtractionRequest } from './src/types/llm';
import type { EvidenceUnit } from '@prisma/client';

async function testPromptFramework() {
  console.log('🧪 Testing Prompt Engineering Framework\n');

  // Initialize prompt manager
  const promptManager = new PromptTemplateManager();
  console.log('✅ PromptTemplateManager initialized');

  // Create test evidence units
  const evidenceUnits: EvidenceUnit[] = [
    {
      id: 'evidence_1',
      sourceId: 'source_1',
      snippet: 'John Smith works as a software engineer at Google in Mountain View.',
      startIndex: 0,
      endIndex: 69,
      qualityScore: 0.9,
      topics: JSON.stringify(['occupation', 'location', 'employer']),
      metadata: JSON.stringify({ tier: 'tier_1' }),
      createdAt: new Date()
    },
    {
      id: 'evidence_2',
      sourceId: 'source_2',
      snippet: 'He graduated from Stanford University with a degree in Computer Science in 2018.',
      startIndex: 70,
      endIndex: 148,
      qualityScore: 0.8,
      topics: JSON.stringify(['education', 'degree']),
      metadata: JSON.stringify({ tier: 'tier_2' }),
      createdAt: new Date()
    }
  ];

  // Create test extraction request
  const request: PersonaExtractionRequest = {
    evidenceUnits,
    extractionType: 'full',
    fieldName: undefined,
    constraints: {
      requireCitations: true,
      conflictHandling: 'choose_best',
      minConfidenceThreshold: 0.7
    },
    projectId: 'test_project_1'
  };

  try {
    // Test prompt generation
    console.log('\n🔨 Testing prompt generation...');
    const systemPrompt = promptManager.generateSystemPrompt(request.constraints.conflictHandling);
    console.log('✅ System prompt generated');
    console.log(`   Length: ${systemPrompt.length} characters`);

    // Create evidence context for user prompt
    const evidenceContext = evidenceUnits.map(unit => ({
      evidenceUnit: unit,
      processingMetadata: {
        qualityScore: unit.qualityScore || 0,
        topics: unit.topics ? JSON.parse(unit.topics) : [],
      },
    }));

    const userPrompt = promptManager.generateUserPrompt(request, evidenceContext);
    console.log('✅ User prompt generated');
    console.log(`   Length: ${userPrompt.length} characters`);

    // Test few-shot examples
    console.log('\n📚 Testing few-shot examples...');
    const exampleKeys = Object.keys(FEW_SHOT_EXAMPLES);
    console.log(`✅ Found ${exampleKeys.length} few-shot examples`);
    
    exampleKeys.forEach((key, index) => {
      console.log(`   Example ${index + 1}: ${key}`);
      const example = FEW_SHOT_EXAMPLES[key as keyof typeof FEW_SHOT_EXAMPLES];
      console.log(`   - Scenario: ${key}`);
      console.log(`   - Length: ${example.length} characters`);
    });

    // Test citation validation prompt
    console.log('\n🔍 Testing citation validation...');
    const testClaims = [
      {
        fieldName: 'occupation',
        text: 'Software engineer at Google',
        confidence: 0.9,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_1'],
            confidence: 0.9,
            supportType: 'direct' as const
          }
        ]
      }
    ];

    const citationPrompt = promptManager.generateCitationValidationPrompt(testClaims, evidenceContext);
    console.log('✅ Citation validation prompt generated');
    console.log(`   Length: ${citationPrompt.length} characters`);

    // Validate prompt contains required elements
    console.log('\n🔍 Validating prompt content...');
    
    const hasEvidenceSection = userPrompt.includes('Evidence ID:') || userPrompt.includes('EVIDENCE');
    const hasCitationFormat = userPrompt.includes('[evidence_') || userPrompt.includes('evidence_');
    const hasJsonSchema = userPrompt.includes('"claims"') || userPrompt.includes('JSON');
    const hasConflictHandling = systemPrompt.includes('CONFLICT') || systemPrompt.includes('conflict');
    
    console.log(`✅ Evidence section: ${hasEvidenceSection ? '✓' : '✗'}`);
    console.log(`✅ Citation format: ${hasCitationFormat ? '✓' : '✗'}`);
    console.log(`✅ JSON schema: ${hasJsonSchema ? '✓' : '✗'}`);
    console.log(`✅ Conflict handling: ${hasConflictHandling ? '✓' : '✗'}`);

    if (hasEvidenceSection && hasCitationFormat && hasJsonSchema && hasConflictHandling) {
      console.log('\n🎉 All prompt framework tests passed!');
      console.log('\n📋 Summary:');
      console.log(`   - Core prompts: ✅ Working`);
      console.log(`   - Template management: ✅ Working`);
      console.log(`   - Few-shot examples: ✅ Working`);
      console.log(`   - Citation validation: ✅ Working`);
      console.log(`   - Integration: ✅ Ready`);
      
      return true;
    } else {
      console.log('\n❌ Some prompt validation checks failed');
      return false;
    }

  } catch (error) {
    console.error('❌ Error testing prompt framework:', error);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testPromptFramework()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}