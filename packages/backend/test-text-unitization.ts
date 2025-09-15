/**
 * Performance and edge case tests for text unitization
 * Tests the <100ms requirement for 10KB text and various edge cases
 */

import { unitizeText, validateUnitization, normalizeText, findSentenceBoundaries, findParagraphBoundaries } from './src/utils/textUtils';

// Test data generators
function generateText(size: number): string {
  const sentences = [
    "This is a sample sentence for testing purposes.",
    "Text unitization should handle various types of content effectively.",
    "The algorithm needs to maintain proper boundaries and overlap.",
    "Performance is crucial for processing large documents.",
    "Quality scores help filter out low-value content.",
    "Evidence-based persona extraction requires careful text processing.",
    "Natural language processing involves many complex challenges.",
    "Machine learning models can assist with content analysis.",
    "Data quality is essential for reliable results.",
    "User experience depends on fast and accurate processing."
  ];
  
  let text = "";
  let currentSize = 0;
  
  while (currentSize < size) {
    const sentence = sentences[Math.floor(Math.random() * sentences.length)];
    text += sentence + " ";
    currentSize = text.length;
  }
  
  return text.substring(0, size);
}

function generateParagraphText(paragraphs: number, sentencesPerParagraph: number = 3): string {
  const sentences = [
    "This is the beginning of a new paragraph.",
    "Each paragraph should contain multiple sentences.",
    "Proper paragraph boundaries are essential for good unitization.",
    "The algorithm must detect paragraph breaks correctly.",
    "Content quality varies significantly across different sources.",
    "Evidence extraction requires careful handling of text structure.",
    "Natural boundaries improve the readability of extracted units.",
    "Context preservation helps maintain meaning across units."
  ];
  
  const paragraphTexts = [];
  
  for (let p = 0; p < paragraphs; p++) {
    const paragraphSentences = [];
    for (let s = 0; s < sentencesPerParagraph; s++) {
      paragraphSentences.push(sentences[Math.floor(Math.random() * sentences.length)]);
    }
    paragraphTexts.push(paragraphSentences.join(" "));
  }
  
  return paragraphTexts.join("\n\n");
}

// Performance test
async function testPerformance() {
  console.log("=== Performance Tests ===");
  
  // Test 1: 10KB text processing time
  const text10KB = generateText(10 * 1024);
  console.log(`Generated 10KB text: ${text10KB.length} characters`);
  
  const startTime = performance.now();
  const units = unitizeText(text10KB);
  const endTime = performance.now();
  
  const processingTime = endTime - startTime;
  console.log(`Processing time: ${processingTime.toFixed(2)}ms`);
  console.log(`Generated ${units.length} units`);
  console.log(`Performance requirement (<100ms): ${processingTime < 100 ? 'PASSED' : 'FAILED'}`);
  
  // Test 2: Different text sizes
  const sizes = [1024, 5120, 20480]; // 1KB, 5KB, 20KB
  
  for (const size of sizes) {
    const text = generateText(size);
    const start = performance.now();
    const result = unitizeText(text);
    const time = performance.now() - start;
    
    console.log(`${size} bytes: ${time.toFixed(2)}ms, ${result.length} units`);
  }
}

// Edge cases test
async function testEdgeCases() {
  console.log("\n=== Edge Case Tests ===");
  
  // Test 1: Empty text
  console.log("1. Empty text:");
  const emptyResult = unitizeText("");
  console.log(`   Result: ${emptyResult.length} units`);
  
  // Test 2: Very short text
  console.log("2. Very short text:");
  const shortText = "Short text.";
  const shortResult = unitizeText(shortText);
  console.log(`   Input: "${shortText}" (${shortText.length} chars)`);
  console.log(`   Result: ${shortResult.length} units`);
  console.log(`   Unit text: "${shortResult[0]?.text}"`);
  
  // Test 3: Text with no sentence boundaries
  console.log("3. Text with no sentence boundaries:");
  const noBoundaries = "a".repeat(500);
  const noBoundariesResult = unitizeText(noBoundaries);
  console.log(`   Input: ${noBoundaries.length} chars of 'a'`);
  console.log(`   Result: ${noBoundariesResult.length} units`);
  console.log(`   First unit length: ${noBoundariesResult[0]?.text.length}`);
  
  // Test 4: Text with excessive punctuation
  console.log("4. Text with excessive punctuation:");
  const punctuation = "This... is a... test!!! With lots??? of punctuation!!!";
  const punctuationResult = unitizeText(punctuation);
  console.log(`   Input: "${punctuation}"`);
  console.log(`   Result: ${punctuationResult.length} units`);
  
  // Test 5: Mixed language content (Unicode)
  console.log("5. Unicode/mixed language content:");
  const unicode = "Hello world! 你好世界！ Bonjour le monde! Здравствуй мир! This text contains multiple languages and scripts.";
  const unicodeResult = unitizeText(unicode);
  console.log(`   Input length: ${unicode.length} chars`);
  console.log(`   Result: ${unicodeResult.length} units`);
  console.log(`   Contains Unicode: ${/[^\x00-\x7F]/.test(unicode)}`);
  
  // Test 6: Very long single sentence
  console.log("6. Very long single sentence:");
  const longSentence = "This is a very long sentence that goes on and on and on without any proper breaks or punctuation except at the very end which makes it difficult to unitize properly but the algorithm should still handle it gracefully by finding appropriate word boundaries where it can split the content into reasonable chunks.";
  const longSentenceResult = unitizeText(longSentence);
  console.log(`   Input length: ${longSentence.length} chars`);
  console.log(`   Result: ${longSentenceResult.length} units`);
  
  // Test 7: Multiple paragraphs
  console.log("7. Multiple paragraphs:");
  const paragraphs = generateParagraphText(5, 4);
  const paragraphResult = unitizeText(paragraphs);
  console.log(`   Input: 5 paragraphs, ${paragraphs.length} chars`);
  console.log(`   Result: ${paragraphResult.length} units`);
  console.log(`   Average unit size: ${paragraphResult.reduce((sum: number, unit: any) => sum + unit.text.length, 0) / paragraphResult.length | 0} chars`);
}

// Boundary detection tests
async function testBoundaryDetection() {
  console.log("\n=== Boundary Detection Tests ===");
  
  // Test sentence boundaries
  const testText = "First sentence. Second sentence! Third sentence? Fourth sentence... Fifth sentence.";
  const sentences = findSentenceBoundaries(testText);
  console.log("1. Sentence boundaries:");
  console.log(`   Input: "${testText}"`);
  console.log(`   Boundaries at: [${sentences.join(', ')}]`);
  
  // Test paragraph boundaries
  const paragraphText = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.";
  const paragraphs = findParagraphBoundaries(paragraphText);
  console.log("2. Paragraph boundaries:");
  console.log(`   Input: "${paragraphText.replace(/\n/g, '\\n')}"`);
  console.log(`   Boundaries at: [${paragraphs.join(', ')}]`);
}

// Validation tests
async function testValidation() {
  console.log("\n=== Validation Tests ===");
  
  // Test normal text
  const normalText = generateParagraphText(3, 5);
  const normalUnits = unitizeText(normalText);
  const normalValidation = validateUnitization(normalUnits, normalText);
  
  console.log("1. Normal text validation:");
  console.log(`   Valid: ${normalValidation.isValid}`);
  console.log(`   Errors: ${normalValidation.errors.length}`);
  console.log(`   Warnings: ${normalValidation.warnings.length}`);
  console.log(`   Stats: ${JSON.stringify(normalValidation.stats, null, 2)}`);
  
  // Test edge case text
  const edgeText = "a".repeat(1000);
  const edgeUnits = unitizeText(edgeText);
  const edgeValidation = validateUnitization(edgeUnits, edgeText);
  
  console.log("2. Edge case validation (repetitive text):");
  console.log(`   Valid: ${edgeValidation.isValid}`);
  console.log(`   Errors: ${edgeValidation.errors.length}`);
  console.log(`   Warnings: ${edgeValidation.warnings.length}`);
  if (edgeValidation.errors.length > 0) {
    console.log(`   First error: ${edgeValidation.errors[0]}`);
  }
}

// Text normalization tests
async function testNormalization() {
  console.log("\n=== Text Normalization Tests ===");
  
  const testCases = [
    "Normal   text   with   extra   spaces.",
    "Text\twith\ttabs\tand\nnewlines.",
    '"Curly quotes" and \'apostrophes\'.',
    "Multiple....periods...and!!!exclamations???",
    "  Leading and trailing spaces  ",
    "Mixed\n\n\nparagraph\n\nbreaks."
  ];
  
  testCases.forEach((text, index) => {
    const normalized = normalizeText(text);
    console.log(`${index + 1}. "${text}" → "${normalized}"`);
  });
}

// Quality assessment test
async function testQualityMetrics() {
  console.log("\n=== Quality Metrics Tests ===");
  
  const testTexts = [
    "This is a well-formed sentence with good structure.",
    "this has no caps and poor structure",
    "This... has... too... much... punctuation!!!",
    "EVERYTHING IS IN ALL CAPS WHICH IS BAD",
    "123 456 789 101112 131415 161718",
    "a b c d e f g h i j k l m n o p q",
    "The quick brown fox jumps over the lazy dog.",
  ];
  
  for (let i = 0; i < testTexts.length; i++) {
    const text = testTexts[i];
    const units = unitizeText(text);
    
    if (units.length > 0) {
      const unit = units[0];
      console.log(`${i + 1}. "${text}"`);
      console.log(`   Word count: ${unit.wordCount}`);
      console.log(`   Sentence count: ${unit.sentenceCount}`);
      console.log(`   Complete boundaries: start=${unit.hasCompleteStart}, end=${unit.hasCompleteEnd}`);
    }
  }
}

// Main test runner
async function runAllTests() {
  console.log("Text Unitization Test Suite");
  console.log("===========================");
  
  try {
    await testPerformance();
    await testEdgeCases();
    await testBoundaryDetection();
    await testValidation();
    await testNormalization();
    await testQualityMetrics();
    
    console.log("\n=== Test Suite Complete ===");
    console.log("All tests completed successfully!");
  } catch (error) {
    console.error("Test suite failed:", error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

export {
  runAllTests,
  testPerformance,
  testEdgeCases,
  testBoundaryDetection,
  testValidation,
  testNormalization,
  testQualityMetrics
};