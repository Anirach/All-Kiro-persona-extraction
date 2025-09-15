/**
 * Repository layer for the Evidence-Bound Persona Extraction platform
 * 
 * This module provides a repository pattern implementation for all core entities,
 * offering CRUD operations with proper error handling, validation, and business logic.
 */

export { ProjectRepository, projectRepository } from './ProjectRepository';
export { SourceRepository, sourceRepository } from './SourceRepository';
export { EvidenceRepository, evidenceRepository } from './EvidenceRepository';
export { PersonaRepository, personaRepository } from './PersonaRepository';

// Re-export common types from database lib
export type { PaginatedResult, PaginationOptions } from '../lib/database';