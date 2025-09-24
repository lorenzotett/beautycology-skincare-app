# Skin Care AI Chat Assistant

## Overview
This is a full-stack web application providing AI-powered skin care consultation via a chat interface. The application features an AI assistant named "Bonnie" that analyzes skin conditions and offers personalized recommendations based on dermatological knowledge. It aims to streamline skin care consultations, offering a business vision focused on personalized beauty solutions and market potential in AI-driven health and beauty.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **UI Library**: Radix UI components with custom shadcn/ui styling
- **Styling**: Tailwind CSS with custom design tokens
- **State Management**: React Query (TanStack Query) for server state management
- **Routing**: Wouter for client-side routing
- **Build Tool**: Vite

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful API endpoints
- **Session Management**: In-memory storage with planned database integration
- **AI Integration**: Google Gemini AI for natural language processing

### Development Environment
- **Hot Reload**: Vite development server with HMR
- **Type Safety**: Full TypeScript coverage
- **Code Quality**: ESLint and Prettier
- **Path Aliases**: Configured for clean imports (@/, @shared/)

### Key Components
- **Chat System**: Interactive UI with message bubbles, session management, choice-based responses, typing indicators, and message history.
- **AI Integration**: Specialized Gemini AI service for skin care, structured prompts, knowledge base for ingredient mapping, and conversation flow management.
- **Data Models**: Users, Chat Sessions, Chat Messages, and extensible Metadata.

### Data Flow
1. **Session Initialization**: User provides name → Server creates session → AI generates welcome message.
2. **Message Exchange**: User input → Server processes → AI generates response → Client displays.
3. **Choice Selection**: User selects from AI-provided options → Continues conversation flow.
4. **Session Persistence**: All messages stored with timestamps and metadata.

### Deployment Strategy
- **Build Process**: Vite for frontend, esbuild for backend, Drizzle for database migration.
- **Production Configuration**: Express.js serving API and static files, PostgreSQL database, Google Gemini API, flexible port binding.
- **Environment Requirements**: Node.js (ES modules), PostgreSQL, Google Gemini API Keys.

### Beautycology AI Architecture
- **Independent Platform**: Beautycology AI operates as a standalone beauty consultant platform
- **Security**: Robust brand identity protection with comprehensive data security
- **Dedicated Admin Dashboard**: Centralized administration with brand-specific theming (/admin)
- **AI Service Integration**: Specialized Gemini AI service optimized for beauty and skincare consultation
- **Complete Integration**: Unified API routes, caching, statistics, and session management

### UI/UX Decisions
- **Color Scheme**: Consistent with a beauty/skincare theme.
- **Layout**: Responsive design adapting to mobile (compact) and desktop (full-width) views.
- **Branding**: Minimalist header with Bonnie logo.
- **Accessibility**: Radix UI components ensure accessibility.

### Technical Implementations
- **Error Handling**: Robust server-side error management with retry logic, explicit timeouts, image validation, detailed logging, and specific error messages.
- **Performance Optimization**: Removed slow polling, optimized caching, intelligent invalidation for dashboard, and server-side pagination for API responses.
- **Image Handling**: Prioritizes Base64 images, automatic placeholder generation, and HEIC support.
- **Data Extraction**: AI-powered (Gemini 2.5 Pro) for precise structured data extraction (age, gender, skin type, problems, lifestyle, recommended ingredients) into Google Sheets and Klaviyo.
- **Tracking System**: Comprehensive tracking with `firstViewedAt`, `chatStartedAt`, and `finalButtonClickedAt` fields, powering dashboard analytics (View Chat, Start Chat, Conversion Rate).
- **Platform Evolution**: Beautycology AI platform designed for seamless deployment and scalability.
- **Scoring System**: Unified logic for skin scoring, ensuring consistency (low scores = good, high scores = problematic) with robust validation.
- **Real-time Sync**: Email-triggered AI extraction and Google Sheets/Klaviyo sync, supplemented by a 5-minute backup sync.
- **Session Recovery**: Automatic Gemini service recreation when sessions are removed from memory, ensuring chat continuity after email submission and preventing "Chat service not found" errors (July 2025).
- **Automatic Image Import System**: Complete automation for converting Base64 images to public URLs and generating Google Sheets IMAGE formulas. Processes 205+ conversations with user-uploaded photos, providing direct image display in spreadsheet cells without manual intervention (August 2025).
- **Beautycology AI Platform**: Independent beauty consultant platform with comprehensive skincare analysis, personalized recommendations, and integrated admin dashboard for complete beauty consultation management (September 2025).
- **Routine Kit Recommendation System**: Automated system that maps skin types and concerns to specific Beautycology routine kits with direct links. Implemented centralized resolver that prioritizes specific skin issues (acne, macchie, rughe, rosacea, sensibile) over base skin types, ensuring users receive targeted complete skincare solutions. Integrated in both primary AI recommendations and fallback scenarios with consistent formatting (September 2025).

## User Feedback and Issues Tracking

### Reported Product Recommendation Issues (September 2025)
**Problem**: AI is recommending generic or non-existent products instead of real products from the Beautycology catalog.

**Specific Issues Identified**:
- "beautycology detergente" - generic reference instead of specific products like "Cleaning Me Softly" (€25,00), "Multitasking Oil – Detergente oleoso" (€12,00), or "Mousse Away – Detergente viso" (€8,00)
- "beautycology swr" - product does not exist in catalog
- "beautycology crema defense" - product does not exist in catalog  
- "beautycology protezione solare" - generic reference instead of "Invisible Shield – Crema viso SPF 30" (€15,00)

**Required Solution**:
- AI must only recommend products that actually exist in the knowledge base
- Every product recommendation must include the exact product name and valid link
- No generic or invented product names allowed

## External Dependencies
- **@google/genai**: Google Gemini AI integration.
- **@neondatabase/serverless**: PostgreSQL database driver.
- **drizzle-orm**: Type-safe database ORM.
- **@tanstack/react-query**: Data fetching and caching.
- **@radix-ui/***: Accessible UI components.
- **tailwindcss**: Utility-first CSS framework.
- **Google Sheets API**: For cream production and data logging.
- **Klaviyo API**: For lead automation and email marketing.
- **Google Tag Manager**: For centralized tag management.
- **Google Analytics 4 (GA4)**: For website analytics.
- **Meta Pixel**: For tracking conversions and remarketing.