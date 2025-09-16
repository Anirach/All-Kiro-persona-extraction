/**
 * Prompt Template Management System
 * 
 * This module provides utilities for managing, validating, and customizing
 * prompt templates for different extraction scenarios.
 */

import type { PersonaExtractionRequest, EvidenceContext, ClaimField } from '../types/llm';
import {
  SYSTEM_PROMPT,
  generateExtractionPrompt,
  CITATION_VALIDATION_PROMPT,
  QUALITY_ASSESSMENT_PROMPT,
  formatEvidenceUnits
} from './personaExtraction';

/**
 * Template configuration options
 */
export interface TemplateConfig {
  includeQualityScores: boolean;
  includeTopics: boolean;
  maxEvidenceLength: number;
  citationStyle: 'brackets' | 'numbered' | 'markdown';
  confidenceThreshold: number;
  verbosity: 'minimal' | 'standard' | 'detailed';
}

/**
 * Default template configuration
 */
export const DEFAULT_TEMPLATE_CONFIG: TemplateConfig = {
  includeQualityScores: true,
  includeTopics: true,
  maxEvidenceLength: 500,
  citationStyle: 'brackets',
  confidenceThreshold: 0.1,
  verbosity: 'standard'
};

/**
 * Template customization options
 */
export interface TemplateCustomization {
  systemPromptAdditions?: string[];
  evidenceContextEnhancements?: string[];
  outputFormatModifications?: Record<string, any>;
  validationRules?: string[];
}

/**
 * Prompt template manager
 */
export class PromptTemplateManager {
  private config: TemplateConfig;
  private customizations: TemplateCustomization;

  constructor(config?: Partial<TemplateConfig>, customizations?: TemplateCustomization) {
    this.config = { ...DEFAULT_TEMPLATE_CONFIG, ...config };
    this.customizations = customizations || {};
  }

  /**
   * Generate system prompt with customizations
   */
  generateSystemPrompt(conflictHandling: PersonaExtractionRequest['constraints']['conflictHandling']): string {
    let systemPrompt = SYSTEM_PROMPT;

    // Add conflict handling specific instructions
    const conflictInstructions = this.getConflictHandlingSystemInstructions(conflictHandling);
    systemPrompt += `\n\n${conflictInstructions}`;

    // Add custom additions
    if (this.customizations.systemPromptAdditions) {
      systemPrompt += '\n\nADDITIONAL INSTRUCTIONS:\n';
      systemPrompt += this.customizations.systemPromptAdditions.join('\n');
    }

    // Add verbosity-specific instructions
    if (this.config.verbosity === 'detailed') {
      systemPrompt += '\n\nDETAILED MODE: Provide extensive reasoning for confidence scores and cite multiple evidence sources when available.';
    } else if (this.config.verbosity === 'minimal') {
      systemPrompt += '\n\nMINIMAL MODE: Focus on essential information only, using concise language and single best evidence sources.';
    }

    return systemPrompt;
  }

  /**
   * Generate user prompt for extraction request
   */
  generateUserPrompt(
    request: PersonaExtractionRequest,
    evidenceContext: EvidenceContext[]
  ): string {
    // Filter and format evidence based on config
    const processedEvidence = this.processEvidenceContext(evidenceContext);
    
    // Generate base prompt
    const basePrompt = generateExtractionPrompt(request, processedEvidence);
    
    // Apply template modifications
    return this.applyTemplateModifications(basePrompt, request);
  }

  /**
   * Generate citation validation prompt
   */
  generateCitationValidationPrompt(
    claims: ClaimField[],
    evidenceContext: EvidenceContext[]
  ): string {
    const formattedEvidence = formatEvidenceUnits(evidenceContext);
    const formattedClaims = JSON.stringify(claims, null, 2);

    return CITATION_VALIDATION_PROMPT
      .replace('{evidenceUnits}', formattedEvidence)
      .replace('{claims}', formattedClaims);
  }

  /**
   * Generate quality assessment prompt
   */
  generateQualityAssessmentPrompt(
    claims: ClaimField[],
    evidenceContext: EvidenceContext[]
  ): string {
    const formattedEvidence = formatEvidenceUnits(evidenceContext);
    const formattedClaims = JSON.stringify(claims, null, 2);

    return QUALITY_ASSESSMENT_PROMPT
      .replace('{evidenceUnits}', formattedEvidence)
      .replace('{claims}', formattedClaims);
  }

  /**
   * Process evidence context based on configuration
   */
  private processEvidenceContext(evidenceContext: EvidenceContext[]): EvidenceContext[] {
    return evidenceContext
      .filter(ctx => {
        // Filter by confidence threshold
        return ctx.processingMetadata.qualityScore >= this.config.confidenceThreshold;
      })
      .map(ctx => ({
        ...ctx,
        evidenceUnit: {
          ...ctx.evidenceUnit,
          // Truncate evidence if needed
          snippet: ctx.evidenceUnit.snippet.length > this.config.maxEvidenceLength
            ? ctx.evidenceUnit.snippet.substring(0, this.config.maxEvidenceLength) + '...'
            : ctx.evidenceUnit.snippet
        }
      }));
  }

  /**
   * Get conflict handling system instructions
   */
  private getConflictHandlingSystemInstructions(
    conflictHandling: PersonaExtractionRequest['constraints']['conflictHandling']
  ): string {
    switch (conflictHandling) {
      case 'flag':
        return `CONFLICT HANDLING MODE: FLAG
When encountering conflicting information:
- Present all conflicting perspectives
- Mark conflicts clearly in conflictFlags
- Include all relevant evidence IDs
- Do not make judgments about which source is correct`;

      case 'choose_best':
        return `CONFLICT HANDLING MODE: CHOOSE BEST
When encountering conflicting information:
- Evaluate evidence quality scores and source reliability
- Select information from the most reliable source
- Provide reasoning in metadata
- Cite only the chosen evidence source`;

      case 'synthesize':
        return `CONFLICT HANDLING MODE: SYNTHESIZE
When encountering conflicting information:
- Look for ways to reconcile differences (e.g., temporal changes)
- Combine compatible information thoughtfully
- Flag irreconcilable contradictions
- Explain synthesis reasoning in metadata`;

      default:
        return '';
    }
  }

  /**
   * Apply template modifications
   */
  private applyTemplateModifications(
    prompt: string,
    request: PersonaExtractionRequest
  ): string {
    let modifiedPrompt = prompt;

    // Apply citation style modifications
    if (this.config.citationStyle === 'numbered') {
      modifiedPrompt = modifiedPrompt.replace(/\[evidence_ID\]/g, '(1)');
      modifiedPrompt = modifiedPrompt.replace(/\[evidence_\{evidenceId\}\]/g, '({number})');
    } else if (this.config.citationStyle === 'markdown') {
      modifiedPrompt = modifiedPrompt.replace(/\[evidence_ID\]/g, '[^evidence_id]');
    }

    // Add validation rules if specified
    if (this.customizations.validationRules?.length) {
      modifiedPrompt += '\n\nADDITIONAL VALIDATION RULES:\n';
      modifiedPrompt += this.customizations.validationRules.join('\n');
    }

    return modifiedPrompt;
  }

  /**
   * Validate template configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.config.confidenceThreshold < 0 || this.config.confidenceThreshold > 1) {
      errors.push('Confidence threshold must be between 0 and 1');
    }

    if (this.config.maxEvidenceLength < 50) {
      errors.push('Maximum evidence length must be at least 50 characters');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get template statistics
   */
  getTemplateStats(): {
    systemPromptLength: number;
    supportedConflictHandling: string[];
    citationStyles: string[];
    verbosityLevels: string[];
  } {
    return {
      systemPromptLength: SYSTEM_PROMPT.length,
      supportedConflictHandling: ['flag', 'choose_best', 'synthesize'],
      citationStyles: ['brackets', 'numbered', 'markdown'],
      verbosityLevels: ['minimal', 'standard', 'detailed']
    };
  }
}

/**
 * Prompt template factory for common scenarios
 */
export class PromptTemplateFactory {
  /**
   * Create template manager for high-accuracy extraction
   */
  static createHighAccuracyTemplate(): PromptTemplateManager {
    return new PromptTemplateManager(
      {
        includeQualityScores: true,
        includeTopics: true,
        maxEvidenceLength: 1000,
        citationStyle: 'brackets',
        confidenceThreshold: 0.3,
        verbosity: 'detailed'
      },
      {
        systemPromptAdditions: [
          'Prioritize accuracy over completeness',
          'Use conservative confidence scoring',
          'Require strong evidence support for all claims'
        ],
        validationRules: [
          'All claims must have confidence > 0.5',
          'All citations must be direct support type',
          'No inferential claims without explicit justification'
        ]
      }
    );
  }

  /**
   * Create template manager for fast extraction
   */
  static createFastExtractionTemplate(): PromptTemplateManager {
    return new PromptTemplateManager(
      {
        includeQualityScores: false,
        includeTopics: false,
        maxEvidenceLength: 200,
        citationStyle: 'brackets',
        confidenceThreshold: 0.1,
        verbosity: 'minimal'
      },
      {
        systemPromptAdditions: [
          'Focus on extracting key information quickly',
          'Use single best evidence source per claim'
        ]
      }
    );
  }

  /**
   * Create template manager for comprehensive extraction
   */
  static createComprehensiveTemplate(): PromptTemplateManager {
    return new PromptTemplateManager(
      {
        includeQualityScores: true,
        includeTopics: true,
        maxEvidenceLength: 2000,
        citationStyle: 'brackets',
        confidenceThreshold: 0.05,
        verbosity: 'detailed'
      },
      {
        systemPromptAdditions: [
          'Extract all available information from evidence',
          'Include contextual and inferential claims with proper support',
          'Provide detailed confidence reasoning'
        ],
        validationRules: [
          'Consider all evidence units in extraction',
          'Provide metadata for all decision points',
          'Include alternative interpretations where relevant'
        ]
      }
    );
  }

  /**
   * Create template manager for specific domain
   */
  static createDomainSpecificTemplate(
    domain: 'professional' | 'academic' | 'personal' | 'medical'
  ): PromptTemplateManager {
    const domainPrompts = {
      professional: [
        'Focus on work-related information: job titles, companies, skills, experience',
        'Pay attention to professional relationships and achievements',
        'Consider industry context and career progression'
      ],
      academic: [
        'Prioritize educational information: degrees, institutions, research',
        'Look for academic achievements and publications',
        'Consider academic relationships and collaborations'
      ],
      personal: [
        'Focus on personal characteristics: interests, hobbies, relationships',
        'Include lifestyle and personality information',
        'Consider family and social connections'
      ],
      medical: [
        'Extract health-related information with high accuracy requirements',
        'Require direct evidence for all medical claims',
        'Use conservative confidence scoring for health information'
      ]
    };

    return new PromptTemplateManager(
      {
        includeQualityScores: true,
        includeTopics: true,
        maxEvidenceLength: 800,
        citationStyle: 'brackets',
        confidenceThreshold: domain === 'medical' ? 0.4 : 0.2,
        verbosity: domain === 'medical' ? 'detailed' : 'standard'
      },
      {
        systemPromptAdditions: domainPrompts[domain],
        validationRules: domain === 'medical' ? [
          'All health-related claims must have direct evidence support',
          'Use highest confidence thresholds for medical information',
          'Flag any uncertain health information for review'
        ] : undefined
      }
    );
  }
}

/**
 * Utility functions for prompt management
 */
export const PromptUtils = {
  /**
   * Count tokens in prompt (rough estimation)
   */
  estimateTokenCount(prompt: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(prompt.length / 4);
  },

  /**
   * Validate prompt length for model limits
   */
  validatePromptLength(prompt: string, maxTokens: number = 16000): { valid: boolean; tokenCount: number } {
    const tokenCount = this.estimateTokenCount(prompt);
    return {
      valid: tokenCount <= maxTokens,
      tokenCount
    };
  },

  /**
   * Extract placeholders from template
   */
  extractPlaceholders(template: string): string[] {
    const placeholders = template.match(/\{[^}]+\}/g);
    return placeholders ? placeholders.map(p => p.slice(1, -1)) : [];
  },

  /**
   * Validate template has all required placeholders
   */
  validateTemplate(template: string, requiredPlaceholders: string[]): { valid: boolean; missing: string[] } {
    const found = this.extractPlaceholders(template);
    const missing = requiredPlaceholders.filter(req => !found.includes(req));
    return {
      valid: missing.length === 0,
      missing
    };
  }
};

export default PromptTemplateManager;