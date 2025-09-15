#!/usr/bin/env tsx

console.log('🧪 Testing Database Helper Functions...');

import { withTransaction, safeDbOperation, batchOperation } from './src/lib/database';
import { prisma } from './src/lib/prisma';

async function testHelpers() {
  try {
    console.log('⏱️  Testing transaction helper...');
    
    // Test transaction helper
    const result = await withTransaction(async (tx) => {
      // Simple read operation within transaction
      const count = await tx.project.count();
      return count;
    });
    
    console.log(`✅ Transaction test: Found ${result} projects`);

    console.log('⏱️  Testing safe database operation...');
    
    // Test safe database operation
    const safeResult = await safeDbOperation(
      async () => await prisma.project.count(),
      'project count test'
    );
    
    console.log(`✅ Safe operation test: Found ${safeResult} projects`);

    console.log('⏱️  Testing batch operation...');
    
    // Test batch operation with a simple array
    const testItems = [1, 2, 3, 4, 5];
    const batchResult = await batchOperation(
      testItems,
      async (batch) => {
        // Simulate processing each item
        return batch.map(item => item * 2);
      },
      2 // Small batch size for testing
    );
    
    console.log(`✅ Batch operation test: Processed ${batchResult.length} items`);
    console.log('✅ All database helpers working correctly!');
    
    return true;
  } catch (error) {
    console.error('❌ Helper test failed:', error);
    return false;
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Disconnected');
  }
}

testHelpers()
  .then(success => {
    console.log(success ? '🎉 Helper tests completed successfully!' : '💥 Helper tests failed!');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });