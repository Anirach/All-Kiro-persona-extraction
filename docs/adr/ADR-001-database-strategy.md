# ADR-001: Database Choice and Migration Strategy

**Status:** Accepted  
**Date:** 2025-09-15  
**Deciders:** Development Team  
**Technical Story:** TASK-005 Prisma Schema Design  

## Context and Problem Statement

We need to select a database system for storing complex evidence-citation relationships, persona data, and audit logs. The system must handle evidence units, claims with citations, quality scores, and provide ACID compliance for data integrity while supporting rapid development and deployment.

## Decision Drivers

* **Development Speed:** Quick setup and iteration for MVP development
* **Data Integrity:** ACID compliance for evidence-citation relationships
* **Performance:** Efficient queries for evidence filtering and persona retrieval
* **Deployment Simplicity:** Easy deployment without infrastructure overhead
* **Type Safety:** Strong integration with TypeScript and Prisma ORM
* **GDPR Compliance:** Support for data deletion and export requirements
* **Cost:** Minimal operational costs for early development phases
* **Migration Path:** Clear upgrade path to production-ready database

## Considered Options

* **SQLite** - File-based SQL database
* **PostgreSQL** - Advanced open-source relational database
* **MySQL** - Popular open-source relational database  
* **MongoDB** - Document-oriented NoSQL database

## Decision Outcome

Chosen option: "SQLite for development/staging with PostgreSQL migration path", because it provides the fastest development experience while maintaining SQL compatibility for future scaling.

### Positive Consequences

* **Fast Development:** Zero-configuration database for local development
* **ACID Compliance:** Full transactional support for data integrity
* **Prisma Integration:** Excellent TypeScript support with type generation
* **Version Control:** Database files can be easily backed up and versioned
* **Testing:** In-memory SQLite for fast test execution
* **Deployment:** Single-file deployment without database server setup
* **Migration Ready:** SQL compatibility enables smooth PostgreSQL migration

### Negative Consequences

* **Concurrency Limitations:** SQLite has limited concurrent write support
* **Production Scaling:** Not suitable for high-traffic production workloads
* **Migration Complexity:** Eventually need to migrate to PostgreSQL for production
* **Feature Limitations:** Missing some advanced SQL features (JSON operators, etc.)

## Pros and Cons of the Options

### SQLite

* Good, because zero-configuration setup for development
* Good, because excellent performance for read-heavy workloads
* Good, because ACID compliance ensures data integrity
* Good, because single-file deployment simplifies hosting
* Good, because perfect for testing with in-memory databases
* Bad, because limited concurrent write performance
* Bad, because not suitable for production scaling
* Bad, because fewer advanced SQL features

### PostgreSQL

* Good, because excellent performance and scalability
* Good, because advanced features (JSON, full-text search, arrays)
* Good, because strong ACID compliance and concurrent access
* Good, because excellent Prisma support and ecosystem
* Good, because industry standard for web applications
* Bad, because requires database server setup and management
* Bad, because more complex development environment setup
* Bad, because operational overhead for deployment and backups

### MySQL

* Good, because mature and widely adopted
* Good, because good performance for web applications
* Good, because extensive hosting and tooling support
* Bad, because less advanced features compared to PostgreSQL
* Bad, because more complex setup than SQLite
* Bad, because fewer JSON and advanced SQL capabilities

### MongoDB

* Good, because flexible schema for varying evidence structures
* Good, because good performance for document-heavy workloads
* Good, because built-in support for complex nested data
* Bad, because less mature Prisma support compared to SQL databases
* Bad, because eventual consistency challenges for audit requirements
* Bad, because team has more SQL experience than MongoDB

## Links

* [SQLite Documentation](https://sqlite.org/docs.html)
* [Prisma SQLite Guide](https://www.prisma.io/docs/concepts/database-connectors/sqlite)
* [PostgreSQL Migration Guide](https://www.prisma.io/docs/guides/database/seed-database)

## Implementation Notes

### Database Configuration Strategy

**Development/Staging:**
```typescript
// packages/backend/src/config/env.ts
DATABASE_URL=file:./dev.db        // Development
DATABASE_URL=file:./test.db       // Testing
DATABASE_URL=file:./staging.db    // Staging
```

**Production Migration Path:**
```typescript
DATABASE_URL=postgresql://user:password@host:5432/database
```

### Schema Design Considerations

**Evidence-Citation Relationships:**
- Use foreign keys to ensure referential integrity
- JSON columns for metadata while maintaining SQL queries
- Proper indexing for evidence search and filtering
- Cascade deletes for GDPR compliance

**Performance Optimization:**
```sql
-- Indexes for common query patterns
CREATE INDEX idx_evidence_source_quality ON evidence_units(source_id, quality_score);
CREATE INDEX idx_citations_claim_field ON citations(claim_field_id);
CREATE INDEX idx_claims_persona_type ON claims(persona_id, type);
```

### Migration Strategy

**Phase 1 (Current):** SQLite for MVP development
- Single-file database for easy deployment
- All Prisma features work identically
- Fast iteration on schema changes

**Phase 2 (Production):** PostgreSQL migration
- Prisma migrate will handle schema transfer
- Data migration scripts for evidence and personas
- Connection pooling and performance optimization

### Backup and Recovery

**SQLite Backup:**
```bash
# Simple file copy for backups
cp dev.db backups/dev-$(date +%Y%m%d).db
```

**GDPR Compliance:**
```typescript
// Data deletion for right to erasure
await prisma.persona.deleteMany({
  where: { project: { userId: deletedUserId } }
});
```

## Monitoring and Review

**Migration Triggers:**
- Concurrent user load exceeds SQLite capabilities
- Database size grows beyond 100MB
- Need for advanced PostgreSQL features (JSON operators, full-text search)
- Production deployment requirements

**Success Metrics:**
- Schema migration complexity when moving to PostgreSQL
- Development velocity with current SQLite setup
- Query performance for evidence filtering operations
- Data integrity maintained through migrations

**Review Schedule:**
- Evaluate PostgreSQL migration at end of Phase 2 (Database & Data Model)
- Monitor query performance as evidence data volume grows
- Review after implementing evidence search and filtering features
