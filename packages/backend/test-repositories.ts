#!/usr/bin/env tsx

console.log('🧪 Testing Repository Implementations...');

import { 
  projectRepository, 
  sourceRepository, 
  evidenceRepository, 
  personaRepository 
} from './src/repositories';
import { prisma } from './src/lib/prisma';

async function testRepositories() {
  try {
    console.log('⏱️  Testing ProjectRepository...');
    
    // Test ProjectRepository
    const testProject = await projectRepository.create({
      name: 'Test Project for Repositories',
      description: 'A test project to verify repository functionality',
    });
    console.log(`✅ Created project: ${testProject.name} (${testProject.id})`);

    const foundProject = await projectRepository.findById(testProject.id);
    console.log(`✅ Found project by ID: ${foundProject?.name}`);

    const projectStats = await projectRepository.getStats(testProject.id);
    console.log(`✅ Project stats: ${projectStats.sourceCount} sources, ${projectStats.personaCount} personas`);

    console.log('⏱️  Testing SourceRepository...');
    
    // Test SourceRepository
    const testSource = await sourceRepository.create({
      url: 'https://example.com/test-source',
      title: 'Test Source Document',
      tier: 'CANONICAL',
      project: { connect: { id: testProject.id } },
    });
    console.log(`✅ Created source: ${testSource.title} (${testSource.id})`);

    const foundSource = await sourceRepository.findById(testSource.id, { project: true });
    console.log(`✅ Found source by ID: ${foundSource?.title}`);

    const sourcesByProject = await sourceRepository.findByProjectId(testProject.id);
    console.log(`✅ Found ${sourcesByProject.data.length} sources for project`);

    console.log('⏱️  Testing EvidenceRepository...');
    
    // Test EvidenceRepository
    const testEvidence = await evidenceRepository.create({
      snippet: 'This is a test evidence snippet that contains important information about the subject.',
      startIndex: 0,
      endIndex: 82,
      qualityScore: 0.85,
      topics: JSON.stringify(['test', 'evidence', 'repository']),
      source: { connect: { id: testSource.id } },
    });
    console.log(`✅ Created evidence unit: ${testEvidence.snippet.substring(0, 50)}... (${testEvidence.id})`);

    const foundEvidence = await evidenceRepository.findById(testEvidence.id, { source: true });
    console.log(`✅ Found evidence by ID: quality score ${foundEvidence?.qualityScore}`);

    const evidenceBySource = await evidenceRepository.findBySourceId(testSource.id);
    console.log(`✅ Found ${evidenceBySource.data.length} evidence units for source`);

    const sourceStats = await evidenceRepository.getSourceStats(testSource.id);
    console.log(`✅ Source stats: ${sourceStats.totalCount} units, avg quality ${sourceStats.averageQualityScore}`);

    console.log('⏱️  Testing PersonaRepository...');
    
    // Test PersonaRepository
    const testPersona = await personaRepository.create({
      status: 'DRAFT',
      project: { connect: { id: testProject.id } },
    });
    console.log(`✅ Created persona: ${testPersona.status} (${testPersona.id})`);

    const testClaim = await personaRepository.createClaim(testPersona.id, {
      type: 'BASIC_INFO',
    });
    console.log(`✅ Created claim: ${testClaim.type} (${testClaim.id})`);

    const testClaimField = await personaRepository.createClaimField(
      testClaim.id,
      {
        text: 'The subject is a software engineer based on the evidence.',
        confidence: 0.85,
      },
      [
        {
          sentenceIndex: 0,
          evidenceIds: JSON.stringify([testEvidence.id]),
        },
      ]
    );
    console.log(`✅ Created claim field with citation: ${testClaimField.text.substring(0, 30)}...`);

    const personaStats = await personaRepository.getStats(testPersona.id);
    console.log(`✅ Persona stats: ${personaStats.claimCount} claims, ${personaStats.citationCount} citations`);

    const referencedEvidence = await personaRepository.getReferencedEvidence(testPersona.id);
    console.log(`✅ Referenced evidence: ${referencedEvidence.length} evidence units`);

    console.log('⏱️  Testing complex queries...');
    
    // Test complex queries
    const projectsWithStats = await projectRepository.findMany({ includeStats: true });
    console.log(`✅ Found ${projectsWithStats.data.length} projects with statistics`);

    const evidenceByProject = await evidenceRepository.findByProjectId(testProject.id, {
      minQualityScore: 0.5,
    });
    console.log(`✅ Found ${evidenceByProject.data.length} high-quality evidence units for project`);

    const personasByProject = await personaRepository.findByProjectId(testProject.id);
    console.log(`✅ Found ${personasByProject.data.length} personas for project`);

    console.log('⏱️  Testing updates...');
    
    // Test updates
    await projectRepository.update(testProject.id, {
      description: 'Updated description for test project',
    });
    console.log('✅ Updated project description');

    await sourceRepository.update(testSource.id, {
      title: 'Updated Test Source Document',
    });
    console.log('✅ Updated source title');

    await evidenceRepository.updateQualityScore(testEvidence.id, 0.92);
    console.log('✅ Updated evidence quality score');

    await personaRepository.updateStatus(testPersona.id, 'PENDING_REVIEW');
    console.log('✅ Updated persona status');

    console.log('⏱️  Cleaning up test data...');
    
    // Clean up test data
    await personaRepository.delete(testPersona.id);
    console.log('✅ Deleted test persona');

    await evidenceRepository.delete(testEvidence.id);
    console.log('✅ Deleted test evidence');

    await sourceRepository.delete(testSource.id);
    console.log('✅ Deleted test source');

    await projectRepository.delete(testProject.id);
    console.log('✅ Deleted test project');

    console.log('✅ All repository tests completed successfully!');
    
    return true;
  } catch (error) {
    console.error('❌ Repository test failed:', error);
    return false;
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Disconnected from database');
  }
}

testRepositories()
  .then(success => {
    console.log(success ? '🎉 Repository tests completed successfully!' : '💥 Repository tests failed!');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });