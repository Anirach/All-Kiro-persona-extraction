// Core entity types for Evidence-Based Persona Extraction

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Source {
  id: string;
  projectId: string;
  url: string;
  title?: string;
  publishedAt?: Date;
  fetchedAt: Date;
  tier: SourceTier;
  metadata: Record<string, any>;
}

export enum SourceTier {
  CANONICAL = 1,
  REPUTABLE = 2,
  COMMUNITY = 3,
  INFORMAL = 4,
}

export interface EvidenceUnit {
  id: string;
  sourceId: string;
  snippet: string;
  startIndex: number;
  endIndex: number;
  qualityScore?: number;
  topics?: string[];
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface Persona {
  id: string;
  projectId: string;
  status: PersonaStatus;
  createdAt: Date;
  updatedAt: Date;
  claims: Claim[];
}

export enum PersonaStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export interface Claim {
  id: string;
  personaId: string;
  type: ClaimType;
  createdAt: Date;
  updatedAt: Date;
  fields: ClaimField[];
}

export enum ClaimType {
  BASIC_INFO = 'basic_info',
  PROFESSIONAL = 'professional',
  EXPERTISE = 'expertise',
  PERSONALITY = 'personality',
  ACHIEVEMENTS = 'achievements',
}

export interface ClaimField {
  id: string;
  claimId: string;
  text: string;
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
  citations: Citation[];
}

export interface Citation {
  id: string;
  claimFieldId: string;
  sentenceIndex: number;
  evidenceIds: string[]; // References to EvidenceUnit IDs
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  actor: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  details: Record<string, any>;
  createdAt: Date;
}

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  APPROVE = 'approve',
  REJECT = 'reject',
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  timestamp: string;
}

export interface ApiError {
  error: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Quality scoring types
export interface QualityScore {
  overall: number;
  components: {
    authority: number;
    content: number;
    recency: number;
    corroboration: number;
    relevance: number;
  };
}

// LLM integration types
export interface LLMRequest {
  evidenceUnits: EvidenceUnit[];
  extractionType: 'full' | 'specific_field';
  constraints: {
    requireCitations: boolean;
    conflictHandling: 'flag' | 'choose_best' | 'synthesize';
  };
}

export interface LLMResponse {
  claims: Claim[];
  confidence: number;
  processingTime: number;
  model: string;
  tokensUsed: number;
}

// Filter and search types
export interface EvidenceFilter {
  sourceIds?: string[];
  qualityScore?: {
    min?: number;
    max?: number;
  };
  topics?: string[];
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  tier?: SourceTier[];
}

export interface SearchQuery {
  query?: string;
  filters?: EvidenceFilter;
  pagination?: {
    page: number;
    limit: number;
  };
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}
