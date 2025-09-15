#!/usr/bin/env tsx

import { prisma, connectDatabase, checkDatabaseHealth, getDatabaseStats } from './src/lib/prisma';

async function verifyPrismaSetup() {
  console.log('🔍 Verifying Prisma Client Setup for TASK-007...\n');

  try {
    // Test 1: Database Connection
    console.log('1. Testing database connection...');
    await connectDatabase();
    console.log('   ✅ Connection successful\n');

    // Test 2: Health Check
    console.log('2. Running health check...');
    const healthResult = await checkDatabaseHealth();
    console.log(`   ✅ Database status: ${healthResult.status}`);
    if (healthResult.latency) {
      console.log(`   ⚡ Connection latency: ${healthResult.latency}ms\n`);
    }

    // Test 3: Database Stats
    console.log('3. Fetching database statistics...');
    const stats = await getDatabaseStats();
    if (stats) {
      console.log('   ✅ Database statistics:');
      console.log(`      - Projects: ${stats.projects}`);
      console.log(`      - Sources: ${stats.sources}`);
      console.log(`      - Evidence Units: ${stats.evidenceUnits}`);
      console.log(`      - Personas: ${stats.personas}`);
      console.log(`      - Claims: ${stats.claims}\n`);
    }

    // Test 4: Simple Query
    console.log('4. Testing simple query...');
    const projectCount = await prisma.project.count();
    console.log(`   ✅ Found ${projectCount} projects in database\n`);

    // Test 5: Transaction Support
    console.log('5. Testing transaction support...');
    const { withTransaction } = await import('./src/lib/database');
    await withTransaction(async (tx) => {
      const count = await tx.project.count();
      console.log(`   ✅ Transaction successful - counted ${count} projects\n`);
    });

    console.log('🎉 All Prisma Client setup tests passed!');
    console.log('\n✅ TASK-007: Prisma Client Setup - COMPLETED');
    
    return true;
  } catch (error) {
    console.error('❌ Prisma setup verification failed:', error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Run verification
verifyPrismaSetup()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Verification script failed:', error);
    process.exit(1);
  });
