# Skin Care AI Chat Assistant

## Overview

This is a full-stack web application that provides AI-powered skin care consultation through a chat interface. The application features an AI assistant named "Bonnie" that analyzes skin conditions and provides personalized recommendations based on dermatological knowledge. It's built using React with TypeScript for the frontend, Express.js for the backend, and integrates with Google's Gemini AI for intelligent responses.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **UI Library**: Radix UI components with custom shadcn/ui styling
- **Styling**: Tailwind CSS with custom design tokens
- **State Management**: React Query (TanStack Query) for server state management
- **Routing**: Wouter for client-side routing
- **Build Tool**: Vite for fast development and optimized builds

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful API endpoints
- **Session Management**: In-memory storage with planned database integration
- **AI Integration**: Google Gemini AI for natural language processing

### Development Environment
- **Hot Reload**: Vite development server with HMR
- **Type Safety**: Full TypeScript coverage across frontend and backend
- **Code Quality**: ESLint and Prettier integration
- **Path Aliases**: Configured for clean imports (@/, @shared/)

## Key Components

### Chat System
- **Real-time Interface**: Interactive chat UI with message bubbles
- **Session Management**: Unique session IDs for conversation continuity
- **Choice-based Responses**: AI can provide multiple-choice options
- **Typing Indicators**: Visual feedback during AI processing
- **Message History**: Persistent conversation tracking

### AI Integration
- **Gemini AI Service**: Specialized service for skin care consultations
- **Structured Prompts**: Complex system instructions for dermatological advice
- **Knowledge Base**: Ingredient mapping and recommendation logic
- **Conversation Flow**: Structured dialogue management

### Data Models
- **Users**: Basic user information and authentication
- **Chat Sessions**: Conversation tracking and metadata
- **Chat Messages**: Individual message storage with role-based classification
- **Metadata Support**: Extensible JSON fields for additional data

## Data Flow

1. **Session Initialization**: User provides name → Server creates session → AI generates welcome message
2. **Message Exchange**: User input → Server processes → AI generates response → Client displays
3. **Choice Selection**: User selects from AI-provided options → Continues conversation flow
4. **Session Persistence**: All messages stored with timestamps and metadata

## External Dependencies

### Core Libraries
- **@google/genai**: Google Gemini AI integration
- **@neondatabase/serverless**: PostgreSQL database driver
- **drizzle-orm**: Type-safe database ORM
- **@tanstack/react-query**: Data fetching and caching
- **@radix-ui/***: Accessible UI components
- **tailwindcss**: Utility-first CSS framework

### Development Tools
- **tsx**: TypeScript execution for development
- **esbuild**: Fast bundler for production builds
- **drizzle-kit**: Database schema management
- **@replit/vite-plugin-***: Replit-specific development tools

## Deployment Strategy

### Build Process
1. **Frontend Build**: Vite compiles React app to static assets
2. **Backend Build**: esbuild bundles Node.js application
3. **Database Migration**: Drizzle handles schema updates
4. **Environment Variables**: Gemini API key and database URL required

### Production Configuration
- **Server**: Express.js serves both API and static files
- **Database**: PostgreSQL with connection pooling
- **AI Service**: Google Gemini API integration
- **Session Storage**: Database-backed session management

### Environment Requirements
- **Node.js**: ES modules support required
- **Database**: PostgreSQL with proper connection string
- **API Keys**: Google Gemini AI API access
- **Port Configuration**: Flexible port binding for deployment

## Changelog

Changelog:
- July 05, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.