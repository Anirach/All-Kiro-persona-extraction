import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data (in reverse dependency order)
  await prisma.auditLog.deleteMany();
  await prisma.qualityMetrics.deleteMany();
  await prisma.processingJob.deleteMany();
  await prisma.citation.deleteMany();
  await prisma.claimField.deleteMany();
  await prisma.claim.deleteMany();
  await prisma.persona.deleteMany();
  await prisma.evidenceUnit.deleteMany();
  await prisma.source.deleteMany();
  await prisma.project.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Cleaned existing data');

  // Create sample users
  const user1 = await prisma.user.create({
    data: {
      email: 'alice@example.com',
      name: 'Alice Johnson',
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: 'bob@example.com',
      name: 'Bob Smith',
    },
  });

  console.log('👤 Created sample users');

  // Create sample projects
  const project1 = await prisma.project.create({
    data: {
      name: 'Tech Industry Leaders Analysis',
      description: 'Analyzing persona profiles of major technology industry leaders',
    },
  });

  const project2 = await prisma.project.create({
    data: {
      name: 'Academic Researchers Profile',
      description: 'Building personas for prominent academic researchers in AI/ML',
    },
  });

  console.log('📋 Created sample projects');

  // Create sample sources
  const source1 = await prisma.source.create({
    data: {
      projectId: project1.id,
      url: 'https://example.com/tech-leader-interview',
      title: 'Exclusive Interview with Tech Innovator',
      tier: 'REPUTABLE',
      publishedAt: new Date('2024-01-15'),
      metadata: JSON.stringify({
        author: 'Tech Journal',
        publication: 'TechCrunch',
        wordCount: 2500,
      }),
    },
  });

  const source2 = await prisma.source.create({
    data: {
      projectId: project1.id,
      url: 'https://example.com/company-blog-post',
      title: 'Vision for the Future of Technology',
      tier: 'CANONICAL',
      publishedAt: new Date('2024-02-01'),
      metadata: JSON.stringify({
        author: 'CEO Blog',
        publication: 'Company Website',
        wordCount: 1200,
      }),
    },
  });

  const source3 = await prisma.source.create({
    data: {
      projectId: project2.id,
      url: 'https://example.com/research-paper',
      title: 'Advances in Machine Learning Research',
      tier: 'CANONICAL',
      publishedAt: new Date('2024-01-10'),
      metadata: JSON.stringify({
        authors: ['Dr. Jane Smith', 'Dr. Michael Brown'],
        journal: 'Nature Machine Intelligence',
        doi: '10.1038/example',
      }),
    },
  });

  console.log('📰 Created sample sources');

  // Create sample evidence units
  const evidence1 = await prisma.evidenceUnit.create({
    data: {
      sourceId: source1.id,
      snippet: 'I believe that artificial intelligence will fundamentally transform how we work and live, but we must ensure it benefits everyone.',
      startIndex: 150,
      endIndex: 290,
      qualityScore: 0.92,
      topics: JSON.stringify(['AI', 'transformation', 'social impact']),
      metadata: JSON.stringify({
        extractedAt: new Date().toISOString(),
        confidence: 0.95,
      }),
    },
  });

  const evidence2 = await prisma.evidenceUnit.create({
    data: {
      sourceId: source1.id,
      snippet: 'Our company has grown from 10 employees to over 50,000 in just fifteen years through strategic acquisitions and organic growth.',
      startIndex: 500,
      endIndex: 720,
      qualityScore: 0.88,
      topics: JSON.stringify(['company growth', 'leadership', 'business strategy']),
      metadata: JSON.stringify({
        extractedAt: new Date().toISOString(),
        confidence: 0.93,
      }),
    },
  });

  const evidence3 = await prisma.evidenceUnit.create({
    data: {
      sourceId: source2.id,
      snippet: 'Education has always been my passion. I hold a PhD in Computer Science from Stanford University and have published over 100 research papers.',
      startIndex: 0,
      endIndex: 145,
      qualityScore: 0.95,
      topics: JSON.stringify(['education', 'research', 'credentials']),
      metadata: JSON.stringify({
        extractedAt: new Date().toISOString(),
        confidence: 0.98,
      }),
    },
  });

  const evidence4 = await prisma.evidenceUnit.create({
    data: {
      sourceId: source3.id,
      snippet: 'Dr. Smith specializes in neural network architectures and has led breakthrough research in transformer models at her university lab.',
      startIndex: 300,
      endIndex: 450,
      qualityScore: 0.94,
      topics: JSON.stringify(['neural networks', 'research leadership', 'academia']),
      metadata: JSON.stringify({
        extractedAt: new Date().toISOString(),
        confidence: 0.96,
      }),
    },
  });

  console.log('🔍 Created sample evidence units');

  // Create sample personas
  const persona1 = await prisma.persona.create({
    data: {
      projectId: project1.id,
      status: 'APPROVED',
    },
  });

  const persona2 = await prisma.persona.create({
    data: {
      projectId: project2.id,
      status: 'PENDING_REVIEW',
    },
  });

  console.log('👥 Created sample personas');

  // Create sample claims and claim fields
  const claim1 = await prisma.claim.create({
    data: {
      personaId: persona1.id,
      type: 'PROFESSIONAL',
    },
  });

  const claimField1 = await prisma.claimField.create({
    data: {
      claimId: claim1.id,
      text: 'CEO and founder of a major technology company with over 50,000 employees.',
      confidence: 0.91,
    },
  });

  const citation1 = await prisma.citation.create({
    data: {
      claimFieldId: claimField1.id,
      sentenceIndex: 0,
      evidenceIds: JSON.stringify([evidence2.id]),
    },
  });

  const claim2 = await prisma.claim.create({
    data: {
      personaId: persona1.id,
      type: 'EXPERTISE',
    },
  });

  const claimField2 = await prisma.claimField.create({
    data: {
      claimId: claim2.id,
      text: 'Recognized expert in artificial intelligence with strong views on AI ethics and social impact.',
      confidence: 0.89,
    },
  });

  const citation2 = await prisma.citation.create({
    data: {
      claimFieldId: claimField2.id,
      sentenceIndex: 0,
      evidenceIds: JSON.stringify([evidence1.id]),
    },
  });

  const claim3 = await prisma.claim.create({
    data: {
      personaId: persona2.id,
      type: 'BASIC_INFO',
    },
  });

  const claimField3 = await prisma.claimField.create({
    data: {
      claimId: claim3.id,
      text: 'PhD in Computer Science from Stanford University with extensive research background.',
      confidence: 0.96,
    },
  });

  const citation3 = await prisma.citation.create({
    data: {
      claimFieldId: claimField3.id,
      sentenceIndex: 0,
      evidenceIds: JSON.stringify([evidence3.id]),
    },
  });

  const claim4 = await prisma.claim.create({
    data: {
      personaId: persona2.id,
      type: 'EXPERTISE',
    },
  });

  const claimField4 = await prisma.claimField.create({
    data: {
      claimId: claim4.id,
      text: 'Specializes in neural network architectures and transformer models, leading university research lab.',
      confidence: 0.93,
    },
  });

  const citation4 = await prisma.citation.create({
    data: {
      claimFieldId: claimField4.id,
      sentenceIndex: 0,
      evidenceIds: JSON.stringify([evidence4.id]),
    },
  });

  console.log('📝 Created sample claims, fields, and citations');

  // Create sample quality metrics
  await prisma.qualityMetrics.create({
    data: {
      evidenceUnitId: evidence1.id,
      authorityScore: 0.85,
      contentScore: 0.92,
      recencyScore: 0.88,
      corroborationScore: 0.75,
      relevanceScore: 0.94,
      overallScore: 0.87,
    },
  });

  await prisma.qualityMetrics.create({
    data: {
      personaId: persona1.id,
      overallScore: 0.91,
    },
  });

  console.log('📊 Created sample quality metrics');

  // Create sample audit logs
  await prisma.auditLog.create({
    data: {
      actor: user1.id,
      action: 'CREATE',
      entity: 'persona',
      entityId: persona1.id,
      details: JSON.stringify({
        changes: { status: 'created' },
        timestamp: new Date().toISOString(),
      }),
    },
  });

  await prisma.auditLog.create({
    data: {
      actor: user1.id,
      action: 'APPROVE',
      entity: 'persona',
      entityId: persona1.id,
      details: JSON.stringify({
        changes: { status: { from: 'PENDING_REVIEW', to: 'APPROVED' } },
        timestamp: new Date().toISOString(),
      }),
    },
  });

  await prisma.auditLog.create({
    data: {
      actor: 'system',
      action: 'CREATE',
      entity: 'evidence_unit',
      entityId: evidence1.id,
      details: JSON.stringify({
        changes: { qualityScore: 0.92 },
        timestamp: new Date().toISOString(),
      }),
    },
  });

  console.log('📋 Created sample audit logs');

  // Create sample processing job
  await prisma.processingJob.create({
    data: {
      type: 'evidence_processing',
      status: 'completed',
      input: JSON.stringify({
        sourceId: source1.id,
        processingOptions: { minQuality: 0.8 },
      }),
      output: JSON.stringify({
        evidenceUnitsCreated: 2,
        averageQuality: 0.90,
        processingTimeMs: 1250,
      }),
      startedAt: new Date(Date.now() - 5000),
      completedAt: new Date(),
    },
  });

  console.log('⚙️ Created sample processing job');

  // Print summary
  const stats = {
    users: await prisma.user.count(),
    projects: await prisma.project.count(),
    sources: await prisma.source.count(),
    evidenceUnits: await prisma.evidenceUnit.count(),
    personas: await prisma.persona.count(),
    claims: await prisma.claim.count(),
    claimFields: await prisma.claimField.count(),
    citations: await prisma.citation.count(),
    auditLogs: await prisma.auditLog.count(),
    qualityMetrics: await prisma.qualityMetrics.count(),
    processingJobs: await prisma.processingJob.count(),
  };

  console.log('\n📈 Database seeding completed!');
  console.log('Summary:');
  Object.entries(stats).forEach(([key, count]) => {
    console.log(`  ${key}: ${count}`);
  });
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
