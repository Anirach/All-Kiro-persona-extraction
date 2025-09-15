#!/usr/bin/env tsx

console.log('🚀 Quick Prisma Test Starting...');

import { PrismaClient } from '@prisma/client';

async function quickTest() {
  const prisma = new PrismaClient({
    log: ['error'],
  });

  try {
    console.log('⏱️  Testing connection with 3-second timeout...');
    
    // Create a promise that times out after 3 seconds
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Test timeout - likely connection issue')), 3000);
    });

    // Simple count query
    const countPromise = prisma.project.count();

    // Race the query against the timeout
    const count = await Promise.race([countPromise, timeoutPromise]) as number;
    
    console.log(`✅ SUCCESS: Found ${count} projects`);
    console.log('✅ Prisma Client is working correctly!');
    
    return true;
  } catch (error) {
    console.error('❌ FAILED:', error);
    return false;
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Disconnected');
  }
}

quickTest()
  .then(success => {
    console.log(success ? '🎉 Test completed successfully!' : '💥 Test failed!');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
