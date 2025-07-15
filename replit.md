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
- July 05, 2025. Added RAG (Retrieval-Augmented Generation) system:
  - Simple in-memory vector search with text similarity
  - Support for PDF, DOCX, and TXT documents
  - Backend-only document management via scripts
  - Integration with Gemini AI for enhanced responses
  - Documents stored in knowledge-base/ directory
  - Load via: tsx scripts/load-rag.ts
- July 06, 2025. Critical debugging and fixes:
  - Fixed unterminated template literal syntax error in message-bubble.tsx
  - Resolved TypeScript compilation errors in Gemini service
  - Temporarily disabled problematic RAG service components to restore functionality
  - Application fully operational with working chat and skin analysis features
- July 06, 2025. Application validated and stable:
  - Confirmed successful skin image analysis with detailed metrics
  - Chat sessions working properly with personalized AI responses
  - Image upload and processing fully functional
  - All core features tested and operational
- July 06, 2025. Conversation flow optimization:
  - Fixed AI repetitive question issue in routine generation phase
  - Enhanced system instructions for better user response handling
  - Improved routine structure with detailed morning/evening/weekly steps
  - Clarified affirmative response detection ("sì", "yes", etc.)
  - Added user concern inquiry for excellent skin analysis results
  - Enhanced Phase 3 logic to ask about user-specific concerns when no issues detected
  - Moved user concern question to immediately follow skin analysis presentation
  - Improved conversation flow for comprehensive consultation even with healthy skin
  - Implemented comprehensive 19-question mandatory questionnaire system
  - Added intelligent question filtering to avoid asking about known information
  - Enhanced data collection for personalized routine generation
  - Integrated lifestyle factors (sleep, stress, diet, smoking) into consultation
  - Added allergy tracking and ingredient exclusion functionality
  - Fixed questionnaire bypass issue with mandatory phase transitions
  - Implemented strict enforcement to prevent skipping to summary without complete data collection
  - Added explicit checklist validation before final consultation phase
  - Implemented multiple bypass prevention mechanisms with detailed verification lists
  - Enhanced automatic questionnaire triggering after user concern collection
  - Added core behavioral rule prohibiting summary without complete data collection
  - Enhanced photo analysis intelligence to reduce redundant questioning
  - Implemented smart question filtering based on AI-detected skin parameters
  - Optimized questionnaire efficiency while maintaining comprehensive data collection
- July 07, 2025. Critical debugging session completed:
  - Resolved persistent JSX structure errors in chat-interface.tsx component
  - Fixed adjacent JSX elements requiring proper wrapping and nesting
  - Corrected TypeScript compilation issues throughout the application
  - Systematically addressed tag alignment and indentation problems
  - Eliminated syntax errors from leftover template strings and malformed JSX
  - Application fully stabilized and operational on port 5000
  - All core features (chat interface, image upload, AI analysis) working correctly
  - User requested checkpoint creation after successful debugging completion
- July 07, 2025. UI/UX improvements and HEIC support:
  - Reorganized header layout: logo B left, AI-DermaSense title right
  - Removed separator line between header and chat area
  - Changed font from Playfair Display Black to Bold (700 weight)
  - Fixed title font size to 14px (removed conflicting inline styles)
  - Enhanced HEIC file support with proper error handling and SVG placeholder
  - Improved file upload feedback for iPhone HEIC images
- July 07, 2025. Chat interface responsiveness improvements:
  - Chat interface now appears immediately when user enters name
  - User messages display instantly in chat before AI response
  - Fixed typing indicator to show "AI-DermaSense sta scrivendo" consistently
  - User's name appears as first message in chat conversation
  - Removed filename text display below image preview
  - Working on HEIC image preview display in message bubbles
- July 07, 2025. Enhanced consultation output structure:
  - Implemented mandatory problematic skin analysis section in final consultation
  - Added structured format for identifying skin problems with corresponding ingredients
  - Enhanced final message organization with clear sections and bold formatting
  - Updated system to require specific problem-ingredient mapping with detailed explanations
  - Improved consultation completeness with comprehensive skincare routine structure
- July 07, 2025. Restructured consultation flow for clarity:
  - Modified first summary message to include: riepilogo + problematiche principali + domanda routine
  - Simplified second message to contain only: routine personalizzata + pulsante link
  - Enhanced user experience with consolidated information display
  - Clarified two-message consultation structure as requested by user
- July 07, 2025. Improved general score calculation and display:
  - Updated backend to calculate general score as rounded integer (no decimals)
  - Added explicit instructions for Gemini to round scores (26.45 → 27, 26.3 → 26)
  - Fixed frontend parsing to handle integer-only general scores
  - Enhanced scoring accuracy and display consistency
- July 07, 2025. Simplified consultation message structure:
  - Removed "Ecco un riepilogo dettagliato" section from consultation message
  - Removed "📊 ANALISI COMPLETA DELLA PELLE" section with detailed scores
  - Removed "📝 LE TUE RISPOSTE E ABITUDINI" section with user responses
  - Kept only "🔎 LE TUE PRINCIPALI NECESSITÀ E CONSIGLI SPECIFICI" section
  - Fixed email validation bug that prevented message sending after valid email input
- July 07, 2025. Critical bug fixes and language improvements:
  - Fixed message truncation issue where content after skin analysis table wasn't displaying
  - Corrected regex patterns to handle whitespace in multiple choice detection (A) B) C) D)
  - Fixed "Cannot read properties of null" error in choice detection system
  - Improved question language to distinguish AI-detected vs user-reported skin issues
  - Updated prompt to use "L'analisi ha rilevato dei rossori" instead of "I rossori che hai segnalato"
  - Resolved API quota limits with new Gemini API key configuration
- July 09, 2025. Enhanced skin analysis accuracy and reliability:
  - Upgraded image analysis from Gemini 2.5 Flash to Gemini 2.5 Pro for improved accuracy
  - Implemented advanced prompt engineering for better pigmentation detection
  - Added detailed instructions for analyzing discromies, melasma, and skin discoloration
  - Enhanced analysis for different skin types and complexions
  - Improved zone-specific analysis (T-zone, eye area, cheeks, mouth area)
  - Added specific guidance for various lighting conditions and image quality
- July 10, 2025. Responsive design overhaul:
  - Mobile: Interfaccia compatta con max-width limitata
  - Desktop: Interfaccia full-width che occupa tutto il viewport
  - Eliminato scroll interno nell'iframe con position fixed
  - Configurato overflow hidden per comportamento blocco unico
  - Breakpoint responsive md: (768px) per passaggio mobile→desktop
- July 10, 2025. Complete CSV export system restructuring:
  - Transformed CSV from message-based to session-based format (one row per conversation)
  - Added 40+ dedicated columns for structured data extraction
  - Implemented automatic question-answer parsing with pattern recognition
  - Added comprehensive skin analysis metrics in separate columns
  - Enhanced CSV with conversation metadata (duration, message count, image uploads)
  - Improved data analysis capabilities with proper column organization
  - Added welcome message formatting with bold text emphasis for key terms
- July 10, 2025. Fixed CSV extraction for both conversation types:
  - Calibrated extraction for photo-based conversations (like Gabriele)
  - Fixed text-based conversation extraction (like Sara)
  - Corrected data mapping - fragranza now shows "Sì" instead of "No" for Sara
  - Resolved column shifting issues where data appeared in wrong columns
  - Added logic to skip initial skin description from answer sequence
  - All user responses now correctly mapped to appropriate CSV columns
- July 11, 2025. Enhanced admin dashboard with analytics and management features:
  - Added final button click tracking for cream access analytics
  - Implemented individual chat session deletion with confirmation
  - Updated database schema with finalButtonClicked and finalButtonClickedAt columns
  - Added new statistics card showing cream access count
  - Enhanced chat list with "Cream Access" badges for tracked sessions
  - Improved image handling with fallback placeholders for missing files
  - Restored /admin-dashboard endpoint accessibility for external access
  - Fixed React Query import issues and optimized dashboard performance
- July 14, 2025. Resolved cross-platform image display issues for Shopify embedded app:
  - Fixed message-bubble component to prioritize imageBase64 over image URL paths
  - Implemented automatic placeholder generation for missing/deleted images
  - Enhanced image upload system to always save both file and base64 versions for redundancy
  - Solved visibility issues where images uploaded through embedded iframe were not appearing in admin dashboard
  - Created SVG placeholder system for permanent image persistence despite Replit file system limitations
  - All new images automatically converted to base64 during upload to prevent future loss
- July 15, 2025. Implemented hybrid iframe-to-popup solution for Shopify integration:
  - Created minimal iframe landing page (/iframe) for collecting user name in Shopify
  - Added automatic popup window launch with full app functionality and image upload
  - Implemented session parameter passing between iframe and main window
  - Enhanced chat interface to auto-start sessions from iframe parameters
  - Added visual indicator for sessions originating from Shopify iframe
  - Solved image persistence issues by moving image uploads to unrestricted popup window
  - System now supports both direct access and Shopify iframe integration seamlessly
- July 15, 2025. Modified homepage behavior for new tab opening:
  - Changed user name input flow to open chat in new tab instead of same window
  - Maintained identical UI/UX - only modified the submission behavior
  - Added fallback for popup-blocked browsers to redirect current window
  - Works consistently for both direct homepage access and iframe embedding
- July 15, 2025. Implemented pagination system and 24/7 dashboard access:
  - Added pagination to admin dashboard (25 conversations per page) to improve performance
  - Implemented smart pagination controls with "Previous/Next" and page numbers
  - Added "Select Page" vs "Select All" functionality for better UX
  - Created direct dashboard access URLs for 24/7 availability once deployed:
    - /dashboard (main URL with professional loading page)
    - /admin-direct (minimal loading page)
    - /?admin=true (direct parameter access)
  - Fixed slow dashboard loading by limiting conversations per page
  - Enhanced selection system to work with pagination
  - **SOLUZIONE FINALE**: URL diretto funzionante 24/7: https://bonnie-beauty.replit.app/?admin=true
  - Creati 3 file HTML statici di backup per accesso alternativo alla dashboard
- July 15, 2025. Critical performance optimization and bug fixes:
  - Fixed final button click tracking: added automatic tracking when users click "Accedi alla tua crema personalizzata"
  - Optimized admin dashboard API for massive performance improvement:
    - /api/admin/sessions response time: 204142ms → 454ms (99.7% faster)
    - Added server-side pagination and search to handle 577+ conversations efficiently
    - Implemented smart data loading to prevent memory issues
  - Fixed admin dashboard loading issues with proper pagination controls
  - Enhanced "Cream Access" counter to accurately track final button clicks
  - All dashboard functionality now works smoothly with instant loading
- July 15, 2025. Implemented ultra-precise cream access tracking validation:
  - Added robust validation: only chats with 5+ messages and final "crema personalizzata" link count as cream access
  - Eliminated false positives: incomplete chats (1-3 messages) are correctly rejected with 400 error
  - System tested and verified: tracks all legitimate final button clicks, including verification tests
  - Enhanced logging: detailed decision tracking for troubleshooting and accuracy verification
  - Production-ready: precision tracking ensures accurate conversion analytics
- July 15, 2025. Implemented advanced CSV export system with intelligent data extraction:
  - Created comprehensive export with 40+ columns for detailed analysis
  - Intelligent pattern recognition extracts all questions and answers from conversations
  - Automatic extraction of skin analysis values in dedicated columns
  - Deduced data capture: AI-inferred information marked as "(dedotto)"
  - Multi-pattern extraction for user responses across various question formats
  - Full conversation transcript included for reference
  - UTF-8 BOM encoding for Excel compatibility
  - Bypassed Vite middleware interference by placing endpoint before middleware setup
  - Export accessible via admin dashboard's "Seleziona Chat" → "Scarica CSV" workflow

## User Preferences

Preferred communication style: Simple, everyday language.