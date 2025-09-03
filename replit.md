# replit.md

## Overview

This is a full-stack calendar event management application built with a modern TypeScript stack. The application allows users to create, manage, and export calendar events with sophisticated date handling capabilities. It supports three types of date specifications: fixed dates, nth occurrence dates (like "2nd Tuesday of March"), and relative dates (like "3 days before another event"). The application features a React frontend with shadcn/ui components and an Express.js backend with PostgreSQL database integration.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for build tooling
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for client-side routing
- **Form Handling**: React Hook Form with Zod validation
- **Icons**: Lucide React icon library

### Backend Architecture
- **Runtime**: Node.js with Express.js REST API
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Validation**: Zod schemas shared between client and server
- **Storage**: Dual storage implementation with in-memory fallback and PostgreSQL support
- **Session Management**: Connect-pg-simple for PostgreSQL session storage

### Database Design
- **Primary Database**: PostgreSQL with Neon serverless connection
- **Schema**: Single events table with flexible date type handling
- **Date Types**: Supports fixed dates, nth occurrence patterns, and relative date relationships
- **Migrations**: Drizzle Kit for schema migrations

### Data Layer Design Patterns
- **Shared Schema**: Single source of truth for data validation between client/server
- **Repository Pattern**: Abstracted storage interface (IStorage) with multiple implementations
- **Type Safety**: End-to-end TypeScript with Drizzle schema inference

### Authentication & Authorization
- **Session-based**: Express sessions with PostgreSQL storage
- **CORS**: Configured for cross-origin requests with credentials

### Development & Build System
- **Build Tool**: Vite for frontend bundling with React plugin
- **Backend Build**: esbuild for server-side bundling
- **Hot Reload**: Vite HMR for frontend, tsx for backend development
- **Type Checking**: Shared TypeScript configuration across client/server/shared code

### API Design
- **REST Pattern**: Standard HTTP methods (GET, POST, PATCH, DELETE)
- **Error Handling**: Centralized error middleware with structured responses
- **Request Logging**: Custom middleware for API request tracking
- **Validation**: Server-side Zod validation with detailed error responses

## External Dependencies

### Database & Infrastructure
- **PostgreSQL**: Primary database via Neon serverless (@neondatabase/serverless)
- **Session Store**: connect-pg-simple for PostgreSQL session management

### Frontend Libraries
- **UI Components**: Comprehensive Radix UI component collection (@radix-ui/*)
- **State Management**: @tanstack/react-query for server state
- **Form Management**: react-hook-form with @hookform/resolvers
- **Styling**: Tailwind CSS with class-variance-authority for component variants
- **Utilities**: date-fns for date manipulation, clsx for conditional classes

### Backend Dependencies
- **ORM**: drizzle-orm with drizzle-zod for schema validation
- **Validation**: zod for runtime type checking
- **Development**: tsx for TypeScript execution, esbuild for bundling

### Development Tools
- **Replit Integration**: @replit/vite-plugin-runtime-error-modal and cartographer for development
- **Build Tools**: Vite, esbuild, TypeScript compiler
- **Code Quality**: PostCSS with Tailwind and Autoprefixer

### Export Functionality
- **Calendar Export**: Custom ICS file generation for Google Calendar integration
- **Date Calculation**: Complex date resolution for nth occurrence and relative dates