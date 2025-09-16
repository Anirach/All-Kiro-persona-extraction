/**
 * Keyword extraction and TF-IDF utilities
 * Implements Term Frequency-Inverse Document Frequency for topic extraction
 */

/**
 * Configuration for keyword extraction
 */
export interface KeywordConfig {
  maxKeywords: number;           // Maximum keywords to extract per text
  minWordLength: number;         // Minimum word length to consider
  maxWordLength: number;         // Maximum word length to consider
  minTermFrequency: number;      // Minimum term frequency threshold
  useStopWordFiltering: boolean; // Whether to filter common stop words
  useStemming: boolean;          // Whether to apply basic stemming
  ngramSize: number;             // Size of n-grams (1 = unigrams, 2 = bigrams, etc.)
}

export const DEFAULT_KEYWORD_CONFIG: KeywordConfig = {
  maxKeywords: 5,
  minWordLength: 3,
  maxWordLength: 20,
  minTermFrequency: 1,
  useStopWordFiltering: true,
  useStemming: false,
  ngramSize: 1,
};

/**
 * Term frequency data structure
 */
export interface TermFrequency {
  term: string;
  frequency: number;
  normalizedFrequency: number;
}

/**
 * TF-IDF score for a term
 */
export interface TfIdfScore {
  term: string;
  tf: number;           // Term frequency
  idf: number;          // Inverse document frequency
  tfidf: number;        // TF-IDF score
  positions: number[];  // Positions where term appears
}

/**
 * Document for TF-IDF corpus
 */
export interface Document {
  id: string;
  text: string;
  terms: string[];
}

/**
 * Common English stop words
 */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'will', 'with',
  'the', 'this', 'but', 'they', 'have', 'had', 'what', 'said', 'each', 'which',
  'she', 'do', 'how', 'their', 'if', 'up', 'out', 'many', 'then', 'them', 'these',
  'so', 'some', 'her', 'would', 'make', 'like', 'into', 'him', 'time', 'two',
  'more', 'go', 'no', 'way', 'could', 'my', 'than', 'first', 'been', 'call',
  'who', 'oil', 'sit', 'now', 'find', 'down', 'day', 'did', 'get', 'come',
  'made', 'may', 'part', 'over', 'new', 'sound', 'take', 'only', 'little',
  'work', 'know', 'place', 'year', 'live', 'me', 'back', 'give', 'most', 'very',
  'after', 'thing', 'our', 'just', 'name', 'good', 'sentence', 'man', 'think',
  'say', 'great', 'where', 'help', 'through', 'much', 'before', 'line', 'right',
  'too', 'mean', 'old', 'any', 'same', 'tell', 'boy', 'follow', 'came', 'want',
  'show', 'also', 'around', 'form', 'three', 'small', 'set', 'put', 'end', 'why',
  'again', 'turn', 'here', 'off', 'went', 'see', 'need', 'should', 'home',
  'about', 'while', 'sound', 'below', 'saw', 'something', 'thought', 'both',
  'few', 'those', 'always', 'looked', 'show', 'large', 'often', 'together',
  'asked', 'house', 'don', 'world', 'going', 'want', 'school', 'important',
  'until', 'form', 'food', 'keep', 'children', 'feet', 'land', 'side', 'without',
  'boy', 'once', 'animal', 'life', 'enough', 'took', 'sometimes', 'four',
  'head', 'above', 'kind', 'began', 'almost', 'live', 'page', 'got', 'earth',
  'need', 'far', 'hand', 'high', 'year', 'mother', 'light', 'country', 'father',
  'let', 'night', 'picture', 'being', 'study', 'second', 'soon', 'story', 'since',
  'white', 'ever', 'paper', 'hard', 'near', 'sentence', 'better', 'best',
  'across', 'during', 'today', 'however', 'sure', 'knew', 'it\'s', 'try',
  'told', 'young', 'sun', 'thing', 'whole', 'hear', 'example', 'heard',
  'several', 'change', 'answer', 'room', 'sea', 'against', 'top', 'turned',
  'learn', 'point', 'city', 'play', 'toward', 'five', 'himself', 'usually',
  'money', 'seen', 'didn', 'car', 'morning', 'i\'m', 'body', 'upon', 'family',
  'later', 'turn', 'move', 'face', 'door', 'cut', 'done', 'group', 'true',
  'leave', 'another', 'began', 'open', 'seem', 'together', 'next', 'white',
  'children', 'begin', 'got', 'walk', 'example', 'ease', 'paper', 'often',
  'always', 'music', 'those', 'both', 'mark', 'book', 'letter', 'until',
  'mile', 'river', 'car', 'feet', 'care', 'second', 'enough', 'plain',
  'girl', 'usual', 'young', 'ready', 'above', 'ever', 'red', 'list', 'though',
  'feel', 'talk', 'bird', 'soon', 'body', 'dog', 'family', 'direct', 'pose',
  'leave', 'song', 'measure', 'state', 'product', 'black', 'short', 'numeral',
  'class', 'wind', 'question', 'happen', 'complete', 'ship', 'area', 'half',
  'rock', 'order', 'fire', 'south', 'problem', 'piece', 'told', 'knew', 'pass',
  'farm', 'top', 'whole', 'king', 'size', 'heard', 'best', 'hour', 'better',
  'during', 'hundred', 'am', 'remember', 'step', 'early', 'hold', 'west',
  'ground', 'interest', 'reach', 'fast', 'five', 'sing', 'listen', 'six',
  'table', 'travel', 'less', 'morning', 'ten', 'simple', 'several', 'vowel',
  'toward', 'war', 'lay', 'against', 'pattern', 'slow', 'center', 'love',
  'person', 'money', 'serve', 'appear', 'road', 'map', 'science', 'rule',
  'govern', 'pull', 'cold', 'notice', 'voice', 'fall', 'power', 'town', 'fine',
  'certain', 'fly', 'unit', 'lead', 'cry', 'dark', 'machine', 'note', 'wait',
  'plan', 'figure', 'star', 'box', 'noun', 'field', 'rest', 'correct', 'able',
  'pound', 'done', 'beauty', 'drive', 'stood', 'contain', 'front', 'teach',
  'week', 'final', 'gave', 'green', 'oh', 'quick', 'develop', 'sleep', 'warm',
  'free', 'minute', 'strong', 'special', 'mind', 'behind', 'clear', 'tail',
  'produce', 'fact', 'street', 'inch', 'lot', 'nothing', 'course', 'stay',
  'wheel', 'full', 'force', 'blue', 'object', 'decide', 'surface', 'deep',
  'moon', 'island', 'foot', 'yet', 'busy', 'test', 'record', 'boat', 'common',
  'gold', 'possible', 'plane', 'age', 'dry', 'wonder', 'laugh', 'thousands',
  'ago', 'ran', 'check', 'game', 'shape', 'yes', 'hot', 'miss', 'brought',
  'heat', 'snow', 'bed', 'bring', 'sit', 'perhaps', 'fill', 'east', 'weight',
  'language', 'among'
]);

/**
 * Preprocess text for keyword extraction
 */
export function preprocessText(text: string, config: KeywordConfig): string[] {
  // Convert to lowercase and normalize whitespace
  let processed = text.toLowerCase().trim().replace(/\s+/g, ' ');
  
  // Remove punctuation but keep spaces and hyphens in compound words
  processed = processed.replace(/[^\w\s\-]/g, ' ');
  
  // Split into words
  let words = processed.split(/\s+/).filter(word => word.length > 0);
  
  // Filter by length
  words = words.filter(word => 
    word.length >= config.minWordLength && 
    word.length <= config.maxWordLength
  );
  
  // Remove stop words if enabled
  if (config.useStopWordFiltering) {
    words = words.filter(word => !STOP_WORDS.has(word));
  }
  
  // Apply basic stemming if enabled
  if (config.useStemming) {
    words = words.map(stemWord);
  }
  
  // Generate n-grams if size > 1
  if (config.ngramSize > 1) {
    const ngrams: string[] = [];
    for (let i = 0; i <= words.length - config.ngramSize; i++) {
      const ngram = words.slice(i, i + config.ngramSize).join(' ');
      ngrams.push(ngram);
    }
    return ngrams;
  }
  
  return words;
}

/**
 * Simple stemming function
 * Removes common suffixes to get word stems
 */
function stemWord(word: string): string {
  // Simple suffix removal rules
  const suffixes = [
    'ing', 'ed', 'er', 'est', 'ly', 'tion', 'sion', 'ness', 'ment', 'able', 'ible'
  ];
  
  for (const suffix of suffixes) {
    if (word.endsWith(suffix) && word.length > suffix.length + 2) {
      return word.slice(0, -suffix.length);
    }
  }
  
  // Handle plurals
  if (word.endsWith('s') && word.length > 3 && !word.endsWith('ss')) {
    return word.slice(0, -1);
  }
  
  return word;
}

/**
 * Calculate term frequencies for a document
 */
export function calculateTermFrequencies(terms: string[]): TermFrequency[] {
  const termCounts = new Map<string, number>();
  const termPositions = new Map<string, number[]>();
  
  // Count term frequencies and track positions
  terms.forEach((term, index) => {
    termCounts.set(term, (termCounts.get(term) || 0) + 1);
    
    if (!termPositions.has(term)) {
      termPositions.set(term, []);
    }
    termPositions.get(term)!.push(index);
  });
  
  const totalTerms = terms.length;
  const frequencies: TermFrequency[] = [];
  
  for (const [term, count] of termCounts) {
    frequencies.push({
      term,
      frequency: count,
      normalizedFrequency: count / totalTerms,
    });
  }
  
  // Sort by frequency (descending)
  return frequencies.sort((a, b) => b.frequency - a.frequency);
}

/**
 * Calculate TF-IDF scores for terms across a corpus
 */
export function calculateTfIdf(documents: Document[]): Map<string, TfIdfScore[]> {
  const corpusSize = documents.length;
  const documentFrequencies = new Map<string, number>();
  const result = new Map<string, TfIdfScore[]>();
  
  // Calculate document frequencies (how many documents contain each term)
  for (const doc of documents) {
    const uniqueTerms = new Set(doc.terms);
    for (const term of uniqueTerms) {
      documentFrequencies.set(term, (documentFrequencies.get(term) || 0) + 1);
    }
  }
  
  // Calculate TF-IDF for each document
  for (const doc of documents) {
    const termFreqs = calculateTermFrequencies(doc.terms);
    const tfidfScores: TfIdfScore[] = [];
    
    for (const termFreq of termFreqs) {
      const df = documentFrequencies.get(termFreq.term) || 1;
      const idf = Math.log(corpusSize / df);
      const tfidf = termFreq.normalizedFrequency * idf;
      
      // Find positions of this term
      const positions: number[] = [];
      doc.terms.forEach((term, index) => {
        if (term === termFreq.term) {
          positions.push(index);
        }
      });
      
      tfidfScores.push({
        term: termFreq.term,
        tf: termFreq.normalizedFrequency,
        idf,
        tfidf,
        positions,
      });
    }
    
    // Sort by TF-IDF score (descending)
    tfidfScores.sort((a, b) => b.tfidf - a.tfidf);
    result.set(doc.id, tfidfScores);
  }
  
  return result;
}

/**
 * Extract keywords from a single text using TF-IDF against a corpus
 */
export function extractKeywords(
  text: string,
  corpus: Document[],
  config: Partial<KeywordConfig> = {}
): TfIdfScore[] {
  const fullConfig = { ...DEFAULT_KEYWORD_CONFIG, ...config };
  
  // Preprocess the input text
  const terms = preprocessText(text, fullConfig);
  
  // Create a document for the input text
  const inputDoc: Document = {
    id: 'input',
    text,
    terms,
  };
  
  // Add input document to corpus for TF-IDF calculation
  const extendedCorpus = [...corpus, inputDoc];
  
  // Calculate TF-IDF
  const tfidfResults = calculateTfIdf(extendedCorpus);
  const inputTfidf = tfidfResults.get('input') || [];
  
  // Filter by minimum term frequency
  const filteredKeywords = inputTfidf.filter(score => {
    const termCount = terms.filter(term => term === score.term).length;
    return termCount >= fullConfig.minTermFrequency;
  });
  
  // Return top keywords
  return filteredKeywords.slice(0, fullConfig.maxKeywords);
}

/**
 * Extract keywords from a single text without corpus (using simple TF)
 */
export function extractKeywordsSimple(
  text: string,
  config: Partial<KeywordConfig> = {}
): TermFrequency[] {
  const fullConfig = { ...DEFAULT_KEYWORD_CONFIG, ...config };
  
  // Preprocess the text
  const terms = preprocessText(text, fullConfig);
  
  // Calculate term frequencies
  const frequencies = calculateTermFrequencies(terms);
  
  // Filter by minimum term frequency
  const filteredKeywords = frequencies.filter(freq => 
    freq.frequency >= fullConfig.minTermFrequency
  );
  
  // Return top keywords
  return filteredKeywords.slice(0, fullConfig.maxKeywords);
}

/**
 * Calculate cosine similarity between two term frequency vectors
 */
export function calculateCosineSimilarity(terms1: string[], terms2: string[]): number {
  if (terms1.length === 0 || terms2.length === 0) {
    return 0;
  }
  
  // Create term frequency maps
  const freq1 = new Map<string, number>();
  const freq2 = new Map<string, number>();
  
  terms1.forEach(term => freq1.set(term, (freq1.get(term) || 0) + 1));
  terms2.forEach(term => freq2.set(term, (freq2.get(term) || 0) + 1));
  
  // Get all unique terms
  const allTerms = new Set([...freq1.keys(), ...freq2.keys()]);
  
  // Calculate dot product and magnitudes
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  for (const term of allTerms) {
    const f1 = freq1.get(term) || 0;
    const f2 = freq2.get(term) || 0;
    
    dotProduct += f1 * f2;
    magnitude1 += f1 * f1;
    magnitude2 += f2 * f2;
  }
  
  const magnitude = Math.sqrt(magnitude1) * Math.sqrt(magnitude2);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}