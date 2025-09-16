/**
 * Few-Shot Examples for Persona Extraction
 * 
 * This module contains carefully crafted examples demonstrating proper
 * evidence-based persona extraction with correct citation patterns.
 */

import type { ClaimField, EvidenceContext } from '../types/llm';

/**
 * Example evidence contexts for demonstrations
 */
export const EXAMPLE_EVIDENCE_CONTEXTS = {
  /**
   * Professional persona example
   */
  professional: [
    {
      evidenceUnit: {
        id: 'evidence_001',
        sourceId: 'linkedin_profile',
        snippet: 'Sarah Chen is a Senior Software Engineer at Google, where she has been working on machine learning infrastructure for the past 3 years.',
        startIndex: 0,
        endIndex: 131,
        qualityScore: 0.9,
        topics: '["profession", "company", "experience"]',
        metadata: '{"source_type": "professional_profile"}',
        createdAt: new Date('2024-01-15')
      },
      processingMetadata: {
        qualityScore: 0.9,
        topics: ['profession', 'company', 'experience'],
        relevanceScore: 0.95
      }
    },
    {
      evidenceUnit: {
        id: 'evidence_002',
        sourceId: 'company_directory',
        snippet: 'Chen, Sarah - ML Infrastructure Team Lead. Contact: s.chen@google.com. Office: Building 40, Floor 3.',
        startIndex: 0,
        endIndex: 98,
        qualityScore: 0.85,
        topics: '["contact", "location", "role"]',
        metadata: '{"source_type": "internal_directory"}',
        createdAt: new Date('2024-01-10')
      },
      processingMetadata: {
        qualityScore: 0.85,
        topics: ['contact', 'location', 'role'],
        relevanceScore: 0.88
      }
    },
    {
      evidenceUnit: {
        id: 'evidence_003',
        sourceId: 'conference_bio',
        snippet: 'Sarah Chen graduated from Stanford University with a Masters in Computer Science in 2019.',
        startIndex: 0,
        endIndex: 92,
        qualityScore: 0.8,
        topics: '["education", "graduation"]',
        metadata: '{"source_type": "conference_speaker_bio"}',
        createdAt: new Date('2024-02-01')
      },
      processingMetadata: {
        qualityScore: 0.8,
        topics: ['education', 'graduation'],
        relevanceScore: 0.82
      }
    }
  ] as EvidenceContext[],

  /**
   * Personal persona example with conflicts
   */
  personalWithConflicts: [
    {
      evidenceUnit: {
        id: 'evidence_101',
        sourceId: 'social_media_a',
        snippet: 'Just turned 28 today! Celebrating with friends in San Francisco.',
        startIndex: 0,
        endIndex: 62,
        qualityScore: 0.6,
        topics: '["age", "location", "social"]',
        metadata: '{"source_type": "social_media", "platform": "twitter"}',
        createdAt: new Date('2024-03-15')
      },
      processingMetadata: {
        qualityScore: 0.6,
        topics: ['age', 'location', 'social'],
        relevanceScore: 0.75
      }
    },
    {
      evidenceUnit: {
        id: 'evidence_102',
        sourceId: 'professional_profile',
        snippet: 'Dr. Maria Rodriguez, 32, is a research scientist based in Seattle, Washington.',
        startIndex: 0,
        endIndex: 78,
        qualityScore: 0.9,
        topics: '["name", "age", "profession", "location"]',
        metadata: '{"source_type": "professional_profile"}',
        createdAt: new Date('2024-02-20')
      },
      processingMetadata: {
        qualityScore: 0.9,
        topics: ['name', 'age', 'profession', 'location'],
        relevanceScore: 0.92
      }
    },
    {
      evidenceUnit: {
        id: 'evidence_103',
        sourceId: 'news_article',
        snippet: 'Maria Rodriguez, a scientist from the University of Washington, published groundbreaking research on climate modeling.',
        startIndex: 0,
        endIndex: 118,
        qualityScore: 0.85,
        topics: '["name", "profession", "affiliation", "research"]',
        metadata: '{"source_type": "news_article"}',
        createdAt: new Date('2024-01-30')
      },
      processingMetadata: {
        qualityScore: 0.85,
        topics: ['name', 'profession', 'affiliation', 'research'],
        relevanceScore: 0.88
      }
    }
  ] as EvidenceContext[]
};

/**
 * Expected output examples demonstrating correct citation patterns
 */
export const EXPECTED_OUTPUTS = {
  /**
   * Professional persona extraction example
   */
  professional: {
    claims: [
      {
        fieldName: 'name',
        text: 'Sarah Chen [evidence_001,evidence_002]',
        confidence: 0.92,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_001', 'evidence_002'],
            confidence: 0.92,
            supportType: 'direct'
          }
        ],
        conflictFlags: [],
        metadata: {
          qualityFactors: {
            sourceAgreement: 1.0,
            evidenceCount: 2,
            averageQuality: 0.875
          }
        }
      },
      {
        fieldName: 'profession',
        text: 'Senior Software Engineer [evidence_001]. Team Lead for ML Infrastructure [evidence_002]',
        confidence: 0.88,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_001'],
            confidence: 0.9,
            supportType: 'direct'
          },
          {
            sentenceIndex: 1,
            evidenceUnitIds: ['evidence_002'],
            confidence: 0.85,
            supportType: 'direct'
          }
        ],
        conflictFlags: [],
        metadata: {
          qualityFactors: {
            sourceAgreement: 1.0,
            evidenceCount: 2,
            averageQuality: 0.875
          }
        }
      },
      {
        fieldName: 'company',
        text: 'Google [evidence_001,evidence_002]',
        confidence: 0.92,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_001', 'evidence_002'],
            confidence: 0.92,
            supportType: 'direct'
          }
        ],
        conflictFlags: [],
        metadata: {
          qualityFactors: {
            sourceAgreement: 1.0,
            evidenceCount: 2,
            averageQuality: 0.875
          }
        }
      },
      {
        fieldName: 'education',
        text: 'Masters in Computer Science from Stanford University, graduated in 2019 [evidence_003]',
        confidence: 0.8,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_003'],
            confidence: 0.8,
            supportType: 'direct'
          }
        ],
        conflictFlags: [],
        metadata: {
          qualityFactors: {
            sourceAgreement: 1.0,
            evidenceCount: 1,
            averageQuality: 0.8
          }
        }
      },
      {
        fieldName: 'experience',
        text: 'Has been working on machine learning infrastructure for the past 3 years [evidence_001]',
        confidence: 0.9,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_001'],
            confidence: 0.9,
            supportType: 'direct'
          }
        ],
        conflictFlags: [],
        metadata: {
          qualityFactors: {
            sourceAgreement: 1.0,
            evidenceCount: 1,
            averageQuality: 0.9
          }
        }
      }
    ]
  } as { claims: ClaimField[] },

  /**
   * Conflict handling example (flag strategy)
   */
  conflictFlag: {
    claims: [
      {
        fieldName: 'name',
        text: 'Maria Rodriguez [evidence_102,evidence_103]',
        confidence: 0.88,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_102', 'evidence_103'],
            confidence: 0.88,
            supportType: 'direct'
          }
        ],
        conflictFlags: [],
        metadata: {
          qualityFactors: {
            sourceAgreement: 1.0,
            evidenceCount: 2,
            averageQuality: 0.875
          }
        }
      },
      {
        fieldName: 'age',
        text: 'Age information shows conflict: 28 years old [evidence_101] vs 32 years old [evidence_102]',
        confidence: 0.45,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_101', 'evidence_102'],
            confidence: 0.45,
            supportType: 'direct'
          }
        ],
        conflictFlags: [
          {
            type: 'contradiction',
            description: 'Age conflict between social media post (28) and professional profile (32)',
            conflictingEvidenceIds: ['evidence_101', 'evidence_102'],
            severity: 'medium'
          }
        ],
        metadata: {
          qualityFactors: {
            sourceAgreement: 0.0,
            evidenceCount: 2,
            averageQuality: 0.75
          }
        }
      },
      {
        fieldName: 'location',
        text: 'Location shows conflict: San Francisco [evidence_101] vs Seattle, Washington [evidence_102]',
        confidence: 0.42,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_101', 'evidence_102'],
            confidence: 0.42,
            supportType: 'direct'
          }
        ],
        conflictFlags: [
          {
            type: 'contradiction',
            description: 'Location conflict between San Francisco and Seattle',
            conflictingEvidenceIds: ['evidence_101', 'evidence_102'],
            severity: 'medium'
          }
        ],
        metadata: {
          qualityFactors: {
            sourceAgreement: 0.0,
            evidenceCount: 2,
            averageQuality: 0.75
          }
        }
      },
      {
        fieldName: 'profession',
        text: 'Research scientist [evidence_102,evidence_103]',
        confidence: 0.88,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_102', 'evidence_103'],
            confidence: 0.88,
            supportType: 'direct'
          }
        ],
        conflictFlags: [],
        metadata: {
          qualityFactors: {
            sourceAgreement: 1.0,
            evidenceCount: 2,
            averageQuality: 0.875
          }
        }
      }
    ]
  } as { claims: ClaimField[] },

  /**
   * Conflict handling example (choose_best strategy)
   */
  conflictChooseBest: {
    claims: [
      {
        fieldName: 'age',
        text: '32 years old [evidence_102]',
        confidence: 0.9,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_102'],
            confidence: 0.9,
            supportType: 'direct'
          }
        ],
        conflictFlags: [],
        metadata: {
          qualityFactors: {
            sourceAgreement: 1.0,
            evidenceCount: 1,
            averageQuality: 0.9
          },
          rejectedEvidence: ['evidence_101'],
          synthesisReasoning: 'Chose professional profile (quality: 0.9) over social media (quality: 0.6) due to higher reliability'
        }
      },
      {
        fieldName: 'location',
        text: 'Seattle, Washington [evidence_102]',
        confidence: 0.9,
        citations: [
          {
            sentenceIndex: 0,
            evidenceUnitIds: ['evidence_102'],
            confidence: 0.9,
            supportType: 'direct'
          }
        ],
        conflictFlags: [],
        metadata: {
          qualityFactors: {
            sourceAgreement: 1.0,
            evidenceCount: 1,
            averageQuality: 0.9
          },
          rejectedEvidence: ['evidence_101'],
          synthesisReasoning: 'Selected professional profile location over social media location due to higher source reliability'
        }
      }
    ]
  } as { claims: ClaimField[] }
};

/**
 * Few-shot prompt examples
 */
export const FEW_SHOT_EXAMPLES = {
  /**
   * Basic extraction example
   */
  basic: `EXAMPLE 1: Professional Persona Extraction

EVIDENCE UNITS:
[Evidence ID: evidence_001]
Source: linkedin_profile
Quality Score: 0.900
Topics: profession, company, experience
Content: Sarah Chen is a Senior Software Engineer at Google, where she has been working on machine learning infrastructure for the past 3 years.

[Evidence ID: evidence_002]
Source: company_directory  
Quality Score: 0.850
Topics: contact, location, role
Content: Chen, Sarah - ML Infrastructure Team Lead. Contact: s.chen@google.com. Office: Building 40, Floor 3.

CORRECT OUTPUT:
{
  "claims": [
    {
      "fieldName": "name",
      "text": "Sarah Chen [evidence_001,evidence_002]",
      "confidence": 0.92,
      "citations": [
        {
          "sentenceIndex": 0,
          "evidenceUnitIds": ["evidence_001", "evidence_002"],
          "confidence": 0.92,
          "supportType": "direct"
        }
      ],
      "conflictFlags": [],
      "metadata": {
        "qualityFactors": {
          "sourceAgreement": 1.0,
          "evidenceCount": 2,
          "averageQuality": 0.875
        }
      }
    },
    {
      "fieldName": "profession",
      "text": "Senior Software Engineer [evidence_001]. Team Lead for ML Infrastructure [evidence_002]",
      "confidence": 0.88,
      "citations": [
        {
          "sentenceIndex": 0,
          "evidenceUnitIds": ["evidence_001"],
          "confidence": 0.9,
          "supportType": "direct"
        },
        {
          "sentenceIndex": 1,
          "evidenceUnitIds": ["evidence_002"],
          "confidence": 0.85,
          "supportType": "direct"
        }
      ],
      "conflictFlags": [],
      "metadata": {
        "qualityFactors": {
          "sourceAgreement": 1.0,
          "evidenceCount": 2,
          "averageQuality": 0.875
        }
      }
    }
  ]
}`,

  /**
   * Conflict handling example
   */
  conflict: `EXAMPLE 2: Conflict Handling (FLAG Strategy)

EVIDENCE UNITS:
[Evidence ID: evidence_101]
Source: social_media_a
Quality Score: 0.600
Topics: age, location, social
Content: Just turned 28 today! Celebrating with friends in San Francisco.

[Evidence ID: evidence_102]
Source: professional_profile
Quality Score: 0.900
Topics: name, age, profession, location
Content: Dr. Maria Rodriguez, 32, is a research scientist based in Seattle, Washington.

CORRECT OUTPUT (FLAG Strategy):
{
  "claims": [
    {
      "fieldName": "age",
      "text": "Age information shows conflict: 28 years old [evidence_101] vs 32 years old [evidence_102]",
      "confidence": 0.45,
      "citations": [
        {
          "sentenceIndex": 0,
          "evidenceUnitIds": ["evidence_101", "evidence_102"],
          "confidence": 0.45,
          "supportType": "direct"
        }
      ],
      "conflictFlags": [
        {
          "type": "contradiction",
          "description": "Age conflict between social media post (28) and professional profile (32)",
          "conflictingEvidenceIds": ["evidence_101", "evidence_102"],
          "severity": "medium"
        }
      ],
      "metadata": {
        "qualityFactors": {
          "sourceAgreement": 0.0,
          "evidenceCount": 2,
          "averageQuality": 0.75
        }
      }
    }
  ]
}`,

  /**
   * Insufficient evidence example
   */
  insufficient: `EXAMPLE 3: Handling Insufficient Evidence

EVIDENCE UNITS:
[Evidence ID: evidence_201]
Source: brief_mention
Quality Score: 0.300
Topics: name
Content: John mentioned in passing.

CORRECT OUTPUT:
{
  "claims": [
    {
      "fieldName": "name",
      "text": "John [evidence_201]",
      "confidence": 0.30,
      "citations": [
        {
          "sentenceIndex": 0,
          "evidenceUnitIds": ["evidence_201"],
          "confidence": 0.30,
          "supportType": "direct"
        }
      ],
      "conflictFlags": [
        {
          "type": "insufficient_evidence",
          "description": "Only brief mention available, no additional context or verification",
          "conflictingEvidenceIds": ["evidence_201"],
          "severity": "high"
        }
      ],
      "metadata": {
        "qualityFactors": {
          "sourceAgreement": 1.0,
          "evidenceCount": 1,
          "averageQuality": 0.3
        }
      }
    }
  ]
}`,

  /**
   * High confidence example
   */
  highConfidence: `EXAMPLE 4: High Confidence Extraction

EVIDENCE UNITS:
[Evidence ID: evidence_301]
Source: official_biography
Quality Score: 0.950
Topics: name, profession, achievements
Content: Dr. Elizabeth Thompson, Nobel Prize winner in Chemistry (2020), is Professor Emeritus at Harvard University.

[Evidence ID: evidence_302]
Source: university_directory
Quality Score: 0.920
Topics: name, title, affiliation
Content: Thompson, Elizabeth - Professor Emeritus, Department of Chemistry, Harvard University. Nobel Laureate 2020.

[Evidence ID: evidence_303]
Source: nobel_committee
Quality Score: 0.980
Topics: name, award, year
Content: The 2020 Nobel Prize in Chemistry was awarded to Dr. Elizabeth Thompson for her groundbreaking work in organic synthesis.

CORRECT OUTPUT:
{
  "claims": [
    {
      "fieldName": "name",
      "text": "Dr. Elizabeth Thompson [evidence_301,evidence_302,evidence_303]",
      "confidence": 0.95,
      "citations": [
        {
          "sentenceIndex": 0,
          "evidenceUnitIds": ["evidence_301", "evidence_302", "evidence_303"],
          "confidence": 0.95,
          "supportType": "direct"
        }
      ],
      "conflictFlags": [],
      "metadata": {
        "qualityFactors": {
          "sourceAgreement": 1.0,
          "evidenceCount": 3,
          "averageQuality": 0.95
        }
      }
    },
    {
      "fieldName": "achievements",
      "text": "Nobel Prize winner in Chemistry (2020) [evidence_301,evidence_302,evidence_303]",
      "confidence": 0.97,
      "citations": [
        {
          "sentenceIndex": 0,
          "evidenceUnitIds": ["evidence_301", "evidence_302", "evidence_303"],
          "confidence": 0.97,
          "supportType": "direct"
        }
      ],
      "conflictFlags": [],
      "metadata": {
        "qualityFactors": {
          "sourceAgreement": 1.0,
          "evidenceCount": 3,
          "averageQuality": 0.95
        }
      }
    }
  ]
}`
};

/**
 * Common extraction patterns and best practices
 */
export const EXTRACTION_PATTERNS = {
  /**
   * Citation best practices
   */
  citationPatterns: [
    'Always include evidence ID after factual statements: [evidence_123]',
    'Use multiple evidence IDs for corroborated facts: [evidence_123,evidence_456]',
    'Every sentence must have at least one citation',
    'Citation confidence should reflect evidence quality and directness'
  ],

  /**
   * Confidence scoring guidelines
   */
  confidenceGuidelines: [
    'High confidence (0.8-1.0): Multiple high-quality sources agree',
    'Medium confidence (0.5-0.79): Single reliable source or multiple lower-quality sources',
    'Low confidence (0.3-0.49): Weak evidence or conflicting information',
    'Very low confidence (0.0-0.29): Insufficient or unreliable evidence'
  ],

  /**
   * Common mistakes to avoid
   */
  commonMistakes: [
    'Including information not present in evidence units',
    'Missing citations for any sentence',
    'Using non-existent evidence IDs in citations',
    'Overstating confidence when evidence is weak',
    'Ignoring conflicts between evidence sources',
    'Making assumptions about implied information'
  ],

  /**
   * Quality indicators
   */
  qualityIndicators: [
    'Source type: official documents > professional profiles > social media',
    'Specificity: detailed information > vague mentions',
    'Recency: newer information typically more reliable',
    'Corroboration: multiple sources increase confidence',
    'Directness: explicit statements > inferred information'
  ]
};

/**
 * Generate few-shot prompt with examples
 */
export function generateFewShotPrompt(
  extractionType: 'basic' | 'conflict' | 'insufficient' | 'highConfidence' = 'basic',
  includePatterns: boolean = true
): string {
  let prompt = 'Here are examples of correct persona extraction:\n\n';
  
  // Add selected examples
  switch (extractionType) {
    case 'basic':
      prompt += FEW_SHOT_EXAMPLES.basic;
      break;
    case 'conflict':
      prompt += FEW_SHOT_EXAMPLES.conflict;
      break;
    case 'insufficient':
      prompt += FEW_SHOT_EXAMPLES.insufficient;
      break;
    case 'highConfidence':
      prompt += FEW_SHOT_EXAMPLES.highConfidence;
      break;
  }

  // Add patterns and guidelines if requested
  if (includePatterns) {
    prompt += '\n\nKEY PATTERNS TO FOLLOW:\n';
    prompt += EXTRACTION_PATTERNS.citationPatterns.map(pattern => `- ${pattern}`).join('\n');
    prompt += '\n\nCONFIDENCE SCORING:\n';
    prompt += EXTRACTION_PATTERNS.confidenceGuidelines.map(guideline => `- ${guideline}`).join('\n');
    prompt += '\n\nAVOID THESE MISTAKES:\n';
    prompt += EXTRACTION_PATTERNS.commonMistakes.map(mistake => `- ${mistake}`).join('\n');
  }

  return prompt;
}

/**
 * Validate example output format
 */
export function validateExampleOutput(output: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!output.claims || !Array.isArray(output.claims)) {
    errors.push('Output must contain claims array');
    return { valid: false, errors };
  }

  for (const [index, claim] of output.claims.entries()) {
    if (!claim.fieldName) errors.push(`Claim ${index}: missing fieldName`);
    if (!claim.text) errors.push(`Claim ${index}: missing text`);
    if (typeof claim.confidence !== 'number') errors.push(`Claim ${index}: confidence must be number`);
    if (!claim.citations || !Array.isArray(claim.citations)) errors.push(`Claim ${index}: missing citations array`);
    
    // Validate citations
    for (const [citIndex, citation] of (claim.citations || []).entries()) {
      if (typeof citation.sentenceIndex !== 'number') {
        errors.push(`Claim ${index}, Citation ${citIndex}: missing sentenceIndex`);
      }
      if (!citation.evidenceUnitIds || !Array.isArray(citation.evidenceUnitIds)) {
        errors.push(`Claim ${index}, Citation ${citIndex}: missing evidenceUnitIds array`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export default {
  EXAMPLE_EVIDENCE_CONTEXTS,
  EXPECTED_OUTPUTS,
  FEW_SHOT_EXAMPLES,
  EXTRACTION_PATTERNS,
  generateFewShotPrompt,
  validateExampleOutput
};