# ADR-000: Framework Choices for Evidence-Bound Persona Extraction Platform

**Status:** Accepted  
**Date:** 2025-09-15  
**Deciders:** Development Team  
**Technical Story:** TASK-001 Project Scaffolding  

## Context and Problem Statement

We need to select appropriate frameworks for building a web application platform for traceable, evidence-bound persona extraction. The system requires a robust backend for LLM integration, evidence processing, and data management, as well as a modern frontend for user interaction and evidence review workflows.

## Decision Drivers

* **Type Safety:** Strong typing to prevent bugs in complex data relationships
* **Developer Experience:** Good tooling, documentation, and community support
* **Performance:** Efficient handling of large text processing and LLM operations
* **Scalability:** Ability to handle growing data volumes and user base
* **Security:** Built-in security features for handling sensitive persona data
* **Ecosystem:** Rich ecosystem for integrations (databases, LLMs, testing)
* **Team Familiarity:** Existing team knowledge and hiring considerations

## Considered Options

### Backend Framework Options
* **Express.js** - Minimal, flexible Node.js framework
* **Fastify** - High-performance Node.js framework
* **NestJS** - Enterprise-grade Node.js framework with decorators
* **Next.js API Routes** - Full-stack React framework

### Frontend Framework Options
* **Next.js 14+ with App Router** - React-based full-stack framework
* **Vite + React** - Fast build tool with React
* **SvelteKit** - Modern framework with excellent performance
* **Vue.js + Nuxt** - Progressive framework with SSR capabilities

## Decision Outcome

**Backend:** Chosen option: "Express.js", because it provides the right balance of simplicity, flexibility, and ecosystem maturity for our evidence processing and LLM integration needs.

**Frontend:** Chosen option: "Next.js 14+ with App Router", because it offers excellent developer experience, built-in optimization, and seamless full-stack development capabilities.

### Positive Consequences

* **Express.js:**
  - Lightweight and fast for text processing workloads
  - Extensive middleware ecosystem for authentication, validation, etc.
  - Direct control over response handling for streaming LLM responses
  - Easy integration with Prisma ORM and database connections
  - Simple testing with Supertest and Jest

* **Next.js 14+ App Router:**
  - Server-side rendering for better SEO and initial load performance
  - Built-in optimization for images, fonts, and code splitting
  - TypeScript support out of the box
  - Excellent developer experience with hot reloading
  - Strong ecosystem for UI components (Tailwind, Radix)

### Negative Consequences

* **Express.js:**
  - Requires more manual configuration compared to opinionated frameworks
  - Need to make more architectural decisions (error handling, validation, etc.)
  - Less built-in structure compared to NestJS

* **Next.js:**
  - Larger bundle size compared to lighter alternatives
  - App Router is relatively new with evolving best practices
  - Vendor lock-in to Vercel ecosystem (though not required)

## Pros and Cons of the Options

### Express.js

* Good, because it's lightweight and doesn't impose architectural constraints
* Good, because it has mature ecosystem for LLM integrations (OpenAI SDK, etc.)
* Good, because it provides direct control over streaming responses
* Good, because team has extensive experience with Express
* Bad, because it requires more boilerplate for enterprise features
* Bad, because less opinionated structure can lead to inconsistencies

### Fastify

* Good, because it offers superior performance (2x faster than Express)
* Good, because it has built-in schema validation and TypeScript support
* Good, because it provides better error handling out of the box
* Bad, because smaller ecosystem compared to Express
* Bad, because team has less experience with Fastify
* Bad, because fewer examples for LLM integration patterns

### Next.js 14+ App Router

* Good, because it provides full-stack capabilities with API routes
* Good, because it offers excellent performance with RSC and streaming
* Good, because it has built-in TypeScript support and optimization
* Good, because it provides great developer experience with hot reloading
* Bad, because App Router is relatively new with evolving patterns
* Bad, because it can be overkill for simple API-only backends

### Vite + React

* Good, because it offers faster build times and development server
* Good, because it provides more flexibility in tooling choices
* Good, because smaller bundle sizes for client-side apps
* Bad, because requires more configuration for SSR and optimization
* Bad, because less integrated experience compared to Next.js
* Bad, because need separate backend framework

## Links

* [Express.js Documentation](https://expressjs.com/)
* [Next.js 14 Documentation](https://nextjs.org/docs)
* [Fastify Documentation](https://www.fastify.io/)

## Implementation Notes

### Project Structure
```
packages/
├── backend/           # Express.js API server
├── frontend/          # Next.js application
└── shared/            # Shared TypeScript types
```

### Key Dependencies
- **Backend:** Express, TypeScript, Prisma, Zod, OpenAI SDK
- **Frontend:** Next.js 14, TypeScript, Tailwind CSS, React Query
- **Shared:** Zod schemas, TypeScript types

### Development Workflow
- Monorepo with npm workspaces for package management
- Concurrently for running backend and frontend in development
- Shared TypeScript configuration and ESLint rules

## Monitoring and Review

**Success Metrics:**
- Development velocity and team satisfaction
- Application performance (response times, bundle sizes)
- Ease of adding new features and integrations

**Review Schedule:**
- Review after Phase 1 completion (foundation tasks)
- Consider framework alternatives if performance issues arise
- Evaluate migration to Fastify if Express becomes a bottleneck
