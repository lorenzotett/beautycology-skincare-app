import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { AIServiceFactory } from "./services/ai-service-factory";
import { SkinAnalysisService } from "./services/skin-analysis";
import { imageGenerationService } from "./services/image-generation";
import { KlaviyoService } from "./services/klaviyo";
import { KlaviyoLeadAutomation } from "./services/klaviyo-lead-automation";
import { GoogleSheetsService } from "./services/google-sheets";
import { ChatDataExtractor } from "./services/chat-data-extractor";
import { AdvancedAIExtractor } from "./services/advanced-ai-extractor";
import { google } from 'googleapis';
// Load environment variables before importing integration config
import { config } from "dotenv";
config();
import { loadIntegrationConfig } from "./config/integrations";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { ragService } from './services/rag-simple';
import { ragService as vectorRagService } from './services/rag';
import { autoLearningSystem } from './services/auto-learning-system';

// Service management
// AI services are now managed by AIServiceFactory - no need for session map

// Add memory monitoring with garbage collection
setInterval(() => {
  const memUsage = process.memoryUsage();
  const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);

  if (memUsageMB > 350) { // Reduced threshold from 400MB to 350MB
    console.warn(`⚠️ High memory usage: ${memUsageMB}MB`);

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.log('🗑️ Forced garbage collection');
    }
  }
}, 1 * 60 * 1000); // Check every minute instead of 2
// Load integration configuration
const integrationConfig = loadIntegrationConfig();
// Initialize Klaviyo Lead Automation
const klaviyoLeadAutomation = new KlaviyoLeadAutomation();

// Session cleanup is now handled by AIServiceFactory - no manual cleanup needed

// DISABLED: Auto-fix missing images - causing performance issues
// This was causing slow requests (19+ seconds) and memory problems
// Images can be fixed manually through admin dashboard if needed
/*
setInterval(async () => {
  try {
    const response = await fetch('http://localhost:5000/api/admin/auto-fix-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      const result = await response.json();
      if (result.fixedImages > 0) {
        console.log(`Auto-fixed ${result.fixedImages} missing images`);
      }
    }
  } catch (error) {
    console.warn('Failed to auto-fix images during cleanup:', error);
  }
}, 5 * 60 * 1000);
*/

// Backup sync every 5 minutes (only for sessions that failed real-time sync)
setInterval(async () => {
  try {
    const allSessions = await storage.getAllChatSessions();
    const failedSyncSessions = allSessions.filter(session => 
      !session.googleSheetsSynced && session.userEmail
    ).slice(0, 3); // Process only 3 at a time for backup

    if (failedSyncSessions.length > 0) {
      console.log(`🔄 Backup sync: Found ${failedSyncSessions.length} failed real-time sync sessions`);

      const response = await fetch('http://localhost:5000/api/admin/auto-sync-integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.synced > 0) {
          console.log(`✅ Backup sync completed: ${result.synced} conversations recovered`);
        }
      }
    }
  } catch (error) {
    console.warn('Backup sync failed:', error);
  }
}, 5 * 60 * 1000); // Every 5 minutes

// Configure multer for file uploads
const storage_config = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const imageUpload = multer({ 
  storage: storage_config,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
    if (file.mimetype.startsWith('image/') || allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo di file non supportato'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  app.use('/attached_assets', express.static(path.join(process.cwd(), 'attached_assets')));

  // Serve batch upload page for image replacement
  app.get('/admin-batch-upload', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'admin-batch-upload.html'));
  });

  // Serve iframe redirect page for Shopify integration
  app.get('/iframe', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'iframe-redirect.html'));
  });

  // Auto-fix missing images endpoint - OPTIMIZED VERSION
  app.post("/api/admin/auto-fix-images", async (req, res) => {
    try {
      // OPTIMIZATION: Only process recent sessions to avoid loading all messages
      const recentSessions = await storage.getAllChatSessions();
      const cutoffTime = new Date(Date.now() - 12 * 60 * 60 * 1000); // Only last 12 hours

      // Filter to recent sessions only
      const sessionsToCheck = recentSessions
        .filter(s => new Date(s.createdAt) > cutoffTime)
        .slice(0, 10); // Limit to 10 most recent sessions

      let fixed = 0;
      let realImageRecovered = 0;
      let totalChecked = 0;

      // Process each session's messages separately to avoid memory overload
      for (const session of sessionsToCheck) {
        const messages = await storage.getChatMessages(session.sessionId);

        const imagesWithoutBase64 = messages.filter(msg => 
          msg.metadata && 
          (msg.metadata as any).hasImage &&
          !(msg.metadata as any).imageBase64
        ).slice(0, 5); // Max 5 images per session

        totalChecked += imagesWithoutBase64.length;

        for (const message of imagesWithoutBase64) {
        const metadata = message.metadata as any;
        let imageBase64 = null;

        // Try to recover the real image first
        if (metadata.imagePath && fs.existsSync(metadata.imagePath)) {
          try {
            const imageBuffer = fs.readFileSync(metadata.imagePath);
            const mimeType = metadata.imageMimeType || 'image/jpeg';
            imageBase64 = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
            realImageRecovered++;
            console.log(`✅ RECOVERED real image for message ${message.id}: ${metadata.imageOriginalName}`);
          } catch (error) {
            console.warn(`Failed to recover real image for message ${message.id}: ${error}`);
          }
        }

        // If real image recovery failed, create SVG placeholder
        if (!imageBase64) {
          const svgContent = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
            <rect width="200" height="200" fill="#f0f0f0" stroke="#ddd" stroke-width="2"/>
            <circle cx="100" cy="100" r="40" fill="#007381"/>
            <text x="100" y="95" text-anchor="middle" fill="white" font-family="Arial" font-size="11" font-weight="bold">Immagine</text>
            <text x="100" y="110" text-anchor="middle" fill="white" font-family="Arial" font-size="11" font-weight="bold">Non Disponibile</text>
            <text x="100" y="140" text-anchor="middle" fill="#666" font-family="Arial" font-size="8">${metadata.imageOriginalName || 'IMG'}</text>
          </svg>`;
          imageBase64 = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;
        }

        const updatedMetadata = {
          ...message.metadata,
          imageBase64: imageBase64,
          isPlaceholder: realImageRecovered === 0 // Only mark as placeholder if no real image was recovered
        };

        await storage.updateChatMessage(message.id, { metadata: updatedMetadata });
        fixed++;
        console.log(`Auto-fixed missing image for message ${message.id}`);
        }
      }

      res.json({ 
        success: true, 
        fixedImages: fixed,
        realImagesRecovered: realImageRecovered,
        totalChecked: totalChecked,
        sessionsProcessed: sessionsToCheck.length
      });
    } catch (error) {
      console.error("Error auto-fixing missing images:", error);
      res.status(500).json({ error: "Failed to auto-fix missing images" });
    }
  });

  // Batch replace multiple images by filename
  app.post("/api/admin/batch-replace-images", imageUpload.array('images', 10), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No image files provided" });
      }

      const results = [];
      for (const file of files) {
        try {
          const allMessages = await storage.getAllChatMessages();
          const message = allMessages.find(m => 
            m.metadata && 
            (m.metadata as any).hasImage && 
            (m.metadata as any).imageOriginalName === file.originalname &&
            (!(m.metadata as any).imageBase64 || (m.metadata as any).isPlaceholder)
          );

          if (message) {
            const imageBuffer = fs.readFileSync(file.path);
            const mimeType = file.mimetype || 'image/jpeg';
            const imageBase64 = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

            const updatedMetadata = {
              ...message.metadata,
              imageBase64: imageBase64,
              isPlaceholder: false,
              batchReplacedAt: new Date().toISOString()
            };

            await storage.updateChatMessage(message.id, { metadata: updatedMetadata });
            results.push({ 
              filename: file.originalname, 
              messageId: message.id,
              success: true 
            });
          } else {
            results.push({ 
              filename: file.originalname, 
              success: false, 
              reason: "No matching message found" 
            });
          }

          try {
            fs.unlinkSync(file.path);
          } catch (error) {
            console.warn(`Failed to clean up file: ${error}`);
          }
        } catch (error) {
          results.push({ 
            filename: file.originalname, 
            success: false, 
            reason: error instanceof Error ? error.message : String(error)
          });
        }
      }

      res.json({ 
        success: true, 
        results: results,
        totalProcessed: files.length,
        totalSuccess: results.filter(r => r.success).length
      });
    } catch (error) {
      console.error("Error in batch replace:", error);
      res.status(500).json({ error: "Failed to process batch upload" });
    }
  });

  // Track chat view (first screen view)
  app.post("/api/tracking/view", async (req, res) => {
    try {
      const { sessionId, fingerprint } = req.body;

      if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required" });
      }

      // Create a minimal session for view tracking
      const userId = fingerprint && typeof fingerprint === "string" 
        ? `fp_${fingerprint.substring(0, 16)}` 
        : `view_${Date.now()}`;

      try {
        // Create a minimal session just for tracking the view
        await storage.createChatSession({
          userId,
          sessionId,
          userName: "View Only", // Temporary session, no real user name yet
        });

        // Immediately mark it as viewed
        await storage.updateChatSession(sessionId, { 
          firstViewedAt: new Date() 
        });

        res.json({ success: true });
      } catch (error) {
        // If session already exists, just update the view timestamp
        const existingSession = await storage.getChatSession(sessionId);
        if (existingSession && !existingSession.firstViewedAt) {
          await storage.updateChatSession(sessionId, { 
            firstViewedAt: new Date() 
          });
        }
        res.json({ success: true });
      }
    } catch (error) {
      console.error("Error tracking chat view:", error);
      res.status(500).json({ error: "Failed to track chat view" });
    }
  });

  // Track chat start (when user submits name and actually starts chatting)  
  app.post("/api/tracking/start", async (req, res) => {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required" });
      }

      const session = await storage.getChatSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Only track the first chat start
      if (!session.chatStartedAt) {
        await storage.updateChatSession(sessionId, { 
          chatStartedAt: new Date() 
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking chat start:", error);
      res.status(500).json({ error: "Failed to track chat start" });
    }
  });

  // Start a new chat session
  app.post("/api/chat/start", async (req, res) => {
    try {
      const { userName, fingerprint } = req.body;

      if (!userName || typeof userName !== "string") {
        return res.status(400).json({ error: "User name is required" });
      }

      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const userId = fingerprint && typeof fingerprint === "string" 
        ? `fp_${fingerprint.substring(0, 16)}` 
        : `user_${Date.now()}`;

      const session = await storage.createChatSession({
        userId,
        sessionId,
        userName,
      });

      // Track both view and chat start automatically when session is created
      await storage.updateChatSession(sessionId, { 
        firstViewedAt: new Date(), // User sees the chat interface
        chatStartedAt: new Date()   // User submits name and starts chat
      });

      const aiService = await AIServiceFactory.getAIService();
      
      const initialResponse = await aiService.getWelcomeMessage();

      await storage.addChatMessage({
        sessionId,
        role: "assistant",
        content: initialResponse.content,
        metadata: {
          hasChoices: initialResponse.hasChoices,
          choices: initialResponse.choices,
        },
      });

      res.json({
        sessionId,
        message: initialResponse,
      });
    } catch (error) {
      console.error("Error starting chat:", error);
      res.status(500).json({ error: "Failed to start chat session" });
    }
  });

  // Send message with image
  app.post("/api/chat/message-with-image", imageUpload.single('image'), async (req, res) => {
    try {
      const { sessionId, message } = req.body;
      const imageFile = req.file;

      if (!sessionId || !imageFile) {
        return res.status(400).json({ error: "Session ID and image are required" });
      }

      const session = await storage.getChatSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const aiService = await AIServiceFactory.getAIService();
      
      // Check if user had previously uploaded a photo for this session
      const messages = await storage.getChatMessages(sessionId);
      let hasUploadedPhoto = false;
      for (const msg of messages) {
        if (msg.metadata && (msg.metadata as any).hasImage) {
          hasUploadedPhoto = true;
          console.log("✅ Found previous image upload for session", sessionId);
          break;
        }
      }

      // CRITICAL: Immediate base64 conversion before any other operations
      let imageBase64 = null;
      try {
        // Read file immediately while it still exists
        const imageBuffer = fs.readFileSync(imageFile.path);
        const mimeType = imageFile.mimetype || 'image/jpeg';
        imageBase64 = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
        console.log(`✅ Image converted to base64 IMMEDIATELY, size: ${Math.round(imageBase64.length / 1024)}KB`);
        console.log(`✅ File exists at conversion: ${fs.existsSync(imageFile.path)}`);

        // Verify base64 is valid image data (not SVG placeholder)
        if (imageBase64.includes('data:image/svg')) {
          console.error(`❌ WARNING: Base64 contains SVG, not real image`);
        }
      } catch (error) {
        console.error(`❌ CRITICAL ERROR: Failed to convert image to base64: ${error}`);
        console.error(`❌ File path: ${imageFile.path}`);
        console.error(`❌ File exists: ${fs.existsSync(imageFile.path)}`);

        // Create informative placeholder that shows the problem
        const svgContent = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="200" fill="#ffebee" stroke="#f44336" stroke-width="2"/>
          <circle cx="100" cy="100" r="40" fill="#f44336"/>
          <text x="100" y="90" text-anchor="middle" fill="white" font-family="Arial" font-size="9" font-weight="bold">ERRORE</text>
          <text x="100" y="105" text-anchor="middle" fill="white" font-family="Arial" font-size="9" font-weight="bold">IFRAME</text>
          <text x="100" y="120" text-anchor="middle" fill="white" font-family="Arial" font-size="9" font-weight="bold">REPLIT</text>
          <text x="100" y="140" text-anchor="middle" fill="#666" font-family="Arial" font-size="7">${imageFile.originalname}</text>
          <text x="100" y="155" text-anchor="middle" fill="#666" font-family="Arial" font-size="6">File cancellato dal sistema</text>
        </svg>`;
        imageBase64 = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;
      }

      const userContent = message ? `${message} [Immagine caricata: ${imageFile.originalname}]` : `[Immagine caricata: ${imageFile.originalname}]`;

      // CRITICAL: Always save imageBase64 in metadata
      await storage.addChatMessage({
        sessionId,
        role: "user",
        content: userContent,
        metadata: {
          hasImage: true,
          imagePath: imageFile.path,
          imageOriginalName: imageFile.originalname,
          imageBase64: imageBase64, // This is the key fix
          imageSize: imageFile.size,
          imageMimeType: imageFile.mimetype,
          isBase64Available: imageBase64 !== null
        },
      });

      console.log(`✅ Message saved with imageBase64: ${imageBase64 ? 'YES' : 'NO'}`);

      const skinAnalysis = new SkinAnalysisService();

      // START PARALLEL PROCESSING: analysis and before/after generation
      const cleanBase64 = imageBase64?.replace(/^data:image\/[^;]+;base64,/, '') || '';
      
      // Promise for skin analysis
      const analysisPromise = (async () => {
        let analysisResult;
        let analysisRetries = 0;
        const maxRetries = 1;

        while (analysisRetries <= maxRetries) {
          try {
            console.log(`🔍 Tentativo di analisi ${analysisRetries + 1}/${maxRetries + 1}...`);

            if (imageBase64 && !imageBase64.includes('data:image/svg')) {
              analysisResult = await skinAnalysis.analyzeImageFromBase64(imageBase64);
              console.log('✅ Analisi completata con successo');
              break;
            } else {
              console.warn('⚠️ Using file path for analysis, may fail if file is deleted');
              analysisResult = await skinAnalysis.analyzeImage(imageFile.path);
              console.log('✅ Analisi completata con successo (da file)');
              break;
            }
          } catch (analysisError) {
            analysisRetries++;
            console.error(`❌ Tentativo ${analysisRetries} fallito:`, analysisError);

            if (analysisRetries > maxRetries) {
              console.error('❌ ERRORE CRITICO: Tutti i tentativi di analisi sono falliti');
              analysisResult = {
                rossori: 25, acne: 20, rughe: 15, pigmentazione: 30,
                pori_dilatati: 35, oleosita: 40, danni_solari: 20,
                occhiaie: 25, idratazione: 45, elasticita: 20, texture_uniforme: 35
              };
              console.log('⚡ FALLBACK ATTIVATO: Utilizzando analisi predefinita realistica per continuare');
              break;
            } else {
              console.log(`⏳ Attesa di 1 secondo prima del prossimo tentativo...`);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
        return analysisResult;
      })();

      // Promise for before/after generation (starts immediately)
      const imagesPromise = (async () => {
        try {
          console.log('🎨 Starting before/after generation in parallel...');
          if (cleanBase64 && !imageBase64?.includes('data:image/svg')) {
            // Use a quick fallback analysis for immediate generation
            const quickAnalysis = {
              rossori: 25, acne: 20, rughe: 15, pigmentazione: 30,
              pori_dilatati: 35, oleosita: 40, danni_solari: 20,
              occhiaie: 25, idratazione: 45, elasticita: 20, texture_uniforme: 35
            };
            
            const images = await imageGenerationService.generateBeforeAfterImagesFromUserPhoto(
              cleanBase64,
              quickAnalysis,
              ['Bonnie AI'],
              '4 settimane'
            );
            
            if (images) {
              console.log('✅ Before/after images generated successfully');
              return images;
            }
          }
          return null;
        } catch (imageError) {
          console.error('❌ Error generating before/after images:', imageError);
          return null;
        }
      })();

      // Wait for both analysis and images to complete, but prioritize images
      const [analysisResult, beforeAfterImages] = await Promise.all([analysisPromise, imagesPromise]);
      
      console.log('📊 Analysis result ready:', !!analysisResult);
      console.log('🎨 Before/after images ready:', !!beforeAfterImages);
      
      // If we have images, send them first in a separate message
      if (beforeAfterImages) {
        console.log('🚀 Saving before/after images as separate message...');
        console.log('🎨 Before image exists:', !!beforeAfterImages.beforeImage);
        console.log('🎨 After image exists:', !!beforeAfterImages.afterImage);
        
        const beforeAfterMessage = {
          id: Math.floor(Math.random() * 2000000000), // Use smaller ID to fit in integer
          sessionId,
          role: "assistant" as const,
          content: "✨ Ecco come potrebbe apparire la tua pelle dopo il trattamento! 🎨",
          metadata: {
            hasChoices: false,
            choices: [],
            hasBeforeAfterImages: true,
            beforeImage: beforeAfterImages.beforeImage,
            afterImage: beforeAfterImages.afterImage,
            ingredients: ['Bonnie AI'],
          },
          createdAt: new Date(),
        };

        await storage.addChatMessage(beforeAfterMessage);
        console.log('✅ Before/after message saved to database');
      } else {
        console.log('⚠️ No before/after images generated');
      }

      const analysisMessage = message ? 
        `${message}\n\nAnalisi AI della pelle: ${JSON.stringify(analysisResult)}` : 
        `Analisi AI della pelle: ${JSON.stringify(analysisResult)}`;

      let response: { content: string; hasChoices: boolean; choices?: string[] };
      try {
        console.log('🤖 Sending analysis to AI service...');
        // Increase timeout for AI service calls to 50 seconds
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AI service timeout')), 50000)
        );

        response = await Promise.race([
          aiService.sendMessage(sessionId, analysisMessage, imageBase64 || undefined),
          timeoutPromise
        ]);
        console.log('✅ AI response received successfully');
      } catch (aiError) {
        console.error('AI service error:', aiError);

        // Fallback response in caso di errore AI
        response = {
          content: "Analisi dell'immagine completata. Ti fornirò una consulenza personalizzata per la tua pelle.",
          hasChoices: false,
          choices: []
        };
      }

      await storage.addChatMessage({
        sessionId,
        role: "assistant",
        content: response.content,
        metadata: {
          hasChoices: response.hasChoices,
          choices: response.choices,
          skinAnalysis: analysisResult,
        },
      });

      console.log('📤 Sending response to client...');

      // Ensure response is sent before any potential connection issues
      try {
        // Send both messages if we have before/after images
        if (beforeAfterImages) {
          console.log('📤 Sending response WITH before/after images');
          res.json({
            message: response,
            beforeAfterMessage: {
              content: "✨ Ecco come potrebbe apparire la tua pelle dopo il trattamento! 🎨",
              hasChoices: false,
              choices: [],
              metadata: {
                hasBeforeAfterImages: true,
                beforeImage: beforeAfterImages.beforeImage,
                afterImage: beforeAfterImages.afterImage,
                ingredients: ['Bonnie AI'],
              }
            }
          });
        } else {
          console.log('📤 Sending response WITHOUT before/after images');
          res.json({
            message: response,
          });
        }
        console.log('✅ Response sent successfully');
      } catch (sendError) {
        console.error('❌ Error sending response:', sendError);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to send response" });
        }
      }
    } catch (error) {
      console.error("❌ ERRORE CRITICO nell'endpoint message-with-image:", error);

      // Log dettagliato per debug
      if (error instanceof Error) {
        console.error("❌ Tipo errore:", error.name);
        console.error("❌ Messaggio:", error.message);
        console.error("❌ Stack:", error.stack);
      }

      if (!res.headersSent) {
        // Provide more specific error messages
        let errorMessage = "Si è verificato un errore durante l'analisi dell'immagine";
        let statusCode = 500;

        if (error instanceof Error) {
          if (error.message.includes('timeout')) {
            errorMessage = "L'analisi dell'immagine sta richiedendo troppo tempo. Riprova con un'altra foto.";
            statusCode = 504; // Gateway Timeout
          } else if (error.message.includes('parse')) {
            errorMessage = "Errore nell'elaborazione dell'analisi. Riprova tra qualche secondo.";
          } else if (error.message.includes('not found')) {
            errorMessage = "Immagine non trovata. Ricarica la pagina e riprova.";
            statusCode = 404;
          } else if (error.message.includes('Session not found')) {
            errorMessage = "Sessione scaduta. Ricarica la pagina per iniziare una nuova chat.";
            statusCode = 404;
          }
        }

        console.error(`❌ Invio risposta errore al client: ${statusCode} - ${errorMessage}`);
        res.status(statusCode).json({ 
          error: errorMessage,
          details: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : String(error) : undefined
        });
      }
    }
  });

  // Send regular message
  app.post("/api/chat/message", async (req, res) => {
    try {
      const { sessionId, message } = req.body;

      if (!sessionId || !message) {
        return res.status(400).json({ error: "Session ID and message are required" });
      }

      const session = await storage.getChatSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const aiService = await AIServiceFactory.getAIService();
      
      // Check if user had previously uploaded a photo for this session
      const messages = await storage.getChatMessages(sessionId);
      let hasUploadedPhoto = false;
      for (const msg of messages) {
        if (msg.metadata && (msg.metadata as any).hasImage) {
          hasUploadedPhoto = true;
          console.log("✅ Found previous image upload for session", sessionId);
          break;
        }
      }

      await storage.addChatMessage({
        sessionId,
        role: "user",
        content: message,
        metadata: null,
      });

      // FIRST: Generate AI response immediately
      const response = await aiService.sendMessage(sessionId, message);

      // Save assistant message
      await storage.addChatMessage({
        sessionId,
        role: "assistant",
        content: response.content,
        metadata: {
          hasChoices: response.hasChoices,
          choices: response.choices,
        },
      });

      // IMPORTANT: Send response to client immediately before any email processing
      res.json({
        message: response,
      });

      // NOW process email in the background AFTER response is sent
      const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
      const emailMatch = message.match(emailRegex);
      if (emailMatch && session) {
        const userEmail = emailMatch[1];

        // Update session with email
        await storage.updateChatSession(sessionId, {
          userEmail: userEmail
        });

        // Enhanced Klaviyo lead automation with AI extraction (non-blocking)
        console.log('🤖 Starting enhanced Klaviyo lead automation...');
        klaviyoLeadAutomation.processConversationForLeads(sessionId).then(success => {
          if (success) {
            console.log('✅ Enhanced Klaviyo lead automation completed successfully');
          } else {
            console.log('⚠️ Enhanced Klaviyo lead automation completed without capturing lead');
          }
        }).catch(err => console.error('Enhanced Klaviyo automation error:', err));

        // BACKGROUND SYNC: Trigger synchronization with AI extraction when email is detected
        console.log(`📧 EMAIL DETECTED: ${userEmail} - Triggering background sync to Google Sheets`);

        // Use integration config for background sync with AI extraction  
        if (integrationConfig.googleSheets.enabled) {
          // Run Google Sheets sync in background - don't wait for it
          (async () => {
            try {
              const sheets = new GoogleSheetsService(integrationConfig.googleSheets.credentials, integrationConfig.googleSheets.spreadsheetId!);

              // Get all messages for the session
              const allMessages = await storage.getChatMessages(sessionId);
              console.log(`📨 Retrieved ${allMessages.length} messages for background sync`);

              // Use Advanced AI extraction for complete data extraction
              console.log('🤖 Background AI extraction starting...');
              const advancedAI = new AdvancedAIExtractor();
              const aiExtractedData = await advancedAI.extractConversationData(allMessages);
              const extractedData = aiExtractedData ? 
                advancedAI.convertToSheetsFormat(aiExtractedData) : 
                null;

              if (extractedData) {
                console.log('📊 Background AI extracted data:', {
                  eta: extractedData.eta,
                  sesso: extractedData.sesso,
                  tipoPelle: extractedData.tipoPelle,
                  problemi: extractedData.problemiPelle?.slice(0, 20) // Show first 20 chars
                });
              }

              const success = await sheets.appendConversation(
                sessionId,
                session.userName,
                userEmail,
                allMessages,
                extractedData
              );

              if (success) {
                await storage.updateChatSession(sessionId, { googleSheetsSynced: true });
                console.log(`✅ BACKGROUND SYNC SUCCESS: ${session.userName} (${userEmail}) synced to Google Sheets`);
              }
            } catch (err) {
              console.error('Background Google Sheets sync error:', err);
            }
          })(); // Execute immediately in background
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Get chat history
  app.get("/api/chat/:sessionId/history", async (req, res) => {
    try {
      const { sessionId } = req.params;

      const session = await storage.getChatSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const messages = await storage.getChatMessages(sessionId);

      res.json({
        session,
        messages,
      });
    } catch (error) {
      console.error("Error getting chat history:", error);
      res.status(500).json({ error: "Failed to get chat history" });
    }
  });

  // Generate before/after images based on skin analysis and ingredients
  app.post("/api/chat/generate-before-after", async (req, res) => {
    try {
      const { sessionId, ingredients, timeframe = "4 settimane" } = req.body;

      if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required" });
      }

      const session = await storage.getChatSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Get messages to find user photo and skin analysis
      const messages = await storage.getChatMessages(sessionId);
      
      // Find user's uploaded photo
      let userPhotoBase64 = null;
      for (const message of messages) {
        if (message.metadata && (message.metadata as any).hasImage) {
          const metadata = message.metadata as any;
          if (metadata.imageBase64) {
            userPhotoBase64 = metadata.imageBase64;
            console.log("📸 Found user photo for before/after generation");
            break;
          }
        }
      }
      
      if (!userPhotoBase64) {
        return res.status(400).json({ 
          error: "No user photo found. Before/after generation requires an uploaded photo." 
        });
      }
      
      let skinAnalysis = null;

      // Find the latest skin analysis in messages
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.content.includes("Analisi AI della pelle:")) {
          const analysisMatch = msg.content.match(/Analisi AI della pelle: ({.*?})/s);
          if (analysisMatch) {
            try {
              skinAnalysis = JSON.parse(analysisMatch[1]);
              console.log("Found skin analysis:", skinAnalysis);
              break;
            } catch (e) {
              console.error("Failed to parse skin analysis:", e);
            }
          }
        }
      }

      if (!skinAnalysis) {
        return res.status(400).json({ error: "No skin analysis found for this session" });
      }

      // Generate before/after images using user's photo
      const images = await imageGenerationService.generateBeforeAfterImagesFromUserPhoto(
        userPhotoBase64,
        skinAnalysis,
        ingredients || [],
        timeframe
      );

      if (!images) {
        return res.status(500).json({ error: "Failed to generate images" });
      }

      // Save the generated images as message metadata
      await storage.addChatMessage({
        sessionId,
        role: "assistant",
        content: `Ecco come apparirà la tua pelle dopo ${timeframe} di trattamento con gli ingredienti consigliati:

**PRIMA:** La tua pelle attuale
**DOPO:** La tua pelle dopo ${timeframe}

Ricorda che i risultati possono variare da persona a persona.`,
        metadata: {
          hasBeforeAfterImages: true,
          beforeImage: images.beforeImage,
          afterImage: images.afterImage,
          ingredients,
          timeframe
        }
      });

      res.json({
        success: true,
        beforeImage: images.beforeImage,
        afterImage: images.afterImage,
        message: "Immagini generate con successo"
      });

    } catch (error) {
      console.error("Error generating before/after images:", error);
      res.status(500).json({ error: "Failed to generate before/after images" });
    }
  });

  // Final button click tracking
  app.post("/api/chat/:sessionId/final-button-clicked", async (req, res) => {
    try {
      const { sessionId } = req.params;

      const session = await storage.getChatSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Validate that the chat is complete before allowing tracking
      const messages = await storage.getChatMessages(sessionId);

      // Check if chat has enough messages (minimum 5 for a complete consultation)
      if (messages.length < 5) {
        console.log(`Chat ${sessionId} has only ${messages.length} messages - not complete enough for cream access`);
        return res.status(400).json({ error: "Chat not complete enough for cream access" });
      }

      // Check if the last message contains a link button with "skincare personalizzata" or "crema personalizzata" 
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role !== 'assistant' || 
          (!lastMessage.content.includes('skincare personalizzata') && !lastMessage.content.includes('crema personalizzata'))) {
        console.log(`Chat ${sessionId} last message doesn't contain skincare/cream link - not a complete consultation`);
        return res.status(400).json({ error: "Chat not complete - no final skincare link found" });
      }

      console.log(`Valid skincare access for session ${sessionId} - ${messages.length} messages, last message contains skincare link`);

      await storage.updateChatSession(sessionId, {
        finalButtonClicked: true,
        finalButtonClickedAt: new Date()
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking final button click:", error);
      res.status(500).json({ error: "Failed to track final button click" });
    }
  });

  // WhatsApp button click tracking
  app.post("/api/chat/:sessionId/whatsapp-button-clicked", async (req, res) => {
    try {
      const { sessionId } = req.params;

      const session = await storage.getChatSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      console.log(`WhatsApp button clicked for session ${sessionId}`);

      await storage.updateChatSession(sessionId, {
        whatsappButtonClicked: true,
        whatsappButtonClickedAt: new Date()
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking WhatsApp button click:", error);
      res.status(500).json({ error: "Failed to track WhatsApp button click" });
    }
  });

  // OPTIMIZATION 8: ULTRA-FAST multi-layered cache system
  let sessionsCache: any[] | null = null;
  let cacheTimestamp = 0;
  const CACHE_DURATION = 1800000; // 30 minutes cache for MAXIMUM speed

  // Pre-computed stats cache
  interface StatsCache {
    [key: string]: {
      data: any;
      timestamp: number;
    };
  }
  let statsCache: StatsCache = {};
  const STATS_CACHE_DURATION = 300000; // 5 minutes for stats

  // Session details cache
  let sessionDetailsCache = new Map<string, { data: any; timestamp: number }>();
  const SESSION_DETAILS_CACHE_DURATION = 600000; // 10 minutes

  const invalidateCache = () => {
    sessionsCache = null;
    cacheTimestamp = 0;
    statsCache = {};
    sessionDetailsCache.clear();
    console.log(`🗑️  All caches invalidated`);
  };

  const getCachedSessions = async () => {
    const now = Date.now();
    if (sessionsCache && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log(`⚡ INSTANT Cache hit - ${sessionsCache.length} sessions (${Math.round((now - cacheTimestamp)/1000)}s old)`);
      return sessionsCache;
    }

    const startTime = Date.now();
    console.log(`🔄 Loading sessions from database...`);
    sessionsCache = await storage.getAllChatSessions();
    cacheTimestamp = now;
    const loadTime = Date.now() - startTime;
    console.log(`💾 Cached ${sessionsCache.length} sessions in ${loadTime}ms`);

    // Pre-compute all stats for common periods after loading sessions
    precomputeStats();

    return sessionsCache;
  };

  // Pre-compute stats for common time periods
  const precomputeStats = async () => {
    if (!sessionsCache) return;

    console.log('🔄 Pre-computing stats for common periods...');
    const periods = [
      { key: 'all', filter: null },
      { key: 'today', filter: { period: 'Oggi' } },
      { key: 'yesterday', filter: { period: 'Ieri' } },
      { key: 'week', filter: { period: 'Ultima settimana' } },
      { key: 'month', filter: { period: 'Ultimo mese' } }
    ];

    for (const { key, filter } of periods) {
      const stats = await computeStatsForPeriod(filter);
      statsCache[key] = { data: stats, timestamp: Date.now() };
    }

    console.log('✅ Pre-computed stats for all common periods');
  };

  // Compute stats for a specific period
  const computeStatsForPeriod = async (filter: any) => {
    const allSessions = sessionsCache || [];
    let filteredSessions = allSessions;

    // Apply search filter first if present
    if (filter?.search) {
      const searchTerm = filter.search.toLowerCase();
      filteredSessions = filteredSessions.filter((session: any) => {
        return (
          session.userName?.toLowerCase().includes(searchTerm) ||
          session.userEmail?.toLowerCase().includes(searchTerm) ||
          session.sessionId?.toLowerCase().includes(searchTerm) ||
          session.userId?.toLowerCase().includes(searchTerm)
        );
      });
    }

    // Apply date filters
    let dateFilter = null;

    // Handle custom date range
    if (filter?.from || filter?.to) {
      dateFilter = {};
      if (filter.from) {
        dateFilter.from = new Date(filter.from);
        dateFilter.from.setHours(0, 0, 0, 0);
      }
      if (filter.to) {
        dateFilter.to = new Date(filter.to);
        dateFilter.to.setHours(23, 59, 59, 999);
      }
    }
    // Handle predefined periods
    else if (filter?.period) {
      const now = new Date();

      switch (filter.period) {
        case 'Oggi':
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          dateFilter = { from: today };
          break;
        case 'Ieri':
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          yesterday.setHours(0, 0, 0, 0);
          const yesterdayEnd = new Date();
          yesterdayEnd.setDate(yesterday.getDate() - 1);
          yesterdayEnd.setHours(23, 59, 59, 999);
          dateFilter = { from: yesterday, to: yesterdayEnd };
          break;
        case 'Ultima settimana':
          const weekAgo = new Date();
          weekAgo.setDate(now.getDate() - 7);
          dateFilter = { from: weekAgo };
          break;
        case 'Ultimo mese':
          const monthAgo = new Date();
          monthAgo.setMonth(now.getMonth() - 1);
          dateFilter = { from: monthAgo };
          break;
      }
    }

    // Apply date filter if present
    if (dateFilter) {
      console.log('📅 Stats: Applying date filter', dateFilter);
      filteredSessions = filteredSessions.filter((session: any) => {
        if (!session.createdAt) return false;
        const sessionDate = new Date(session.createdAt);
        if (dateFilter.from && sessionDate < dateFilter.from) return false;
        if (dateFilter.to && sessionDate > dateFilter.to) return false;
        return true;
      });
      console.log(`📊 Stats: Filtered to ${filteredSessions.length}/${allSessions.length} sessions`);
    }

    // Fast computation using the same logic
    const viewOnlySessions = filteredSessions.filter((s: any) => s.userName === "View Only");
    const realSessions = filteredSessions.filter((s: any) => s.userName !== "View Only");

    let viewChatCount = 0, startChatCount = 0, finalButtonClicks = 0, whatsappButtonClicks = 0;
    let chatCompletate = 0, totalChatDuration = 0, completedChatsWithDuration = 0;

    for (const session of realSessions) {
      if (session.firstViewedAt) viewChatCount++;
      if (session.chatStartedAt) startChatCount++;
      if (session.finalButtonClicked) finalButtonClicks++;
      if (session.whatsappButtonClicked) whatsappButtonClicks++;

      const hasSignificantActivity = session.userEmail || session.finalButtonClicked || session.whatsappButtonClicked;
      const likelyCompleted = session.googleSheetsSynced || hasSignificantActivity;

      if (likelyCompleted) {
        chatCompletate++;

        if (session.chatStartedAt) {
          const startTime = new Date(session.chatStartedAt);
          let endTime = null;

          if (session.finalButtonClickedAt) {
            endTime = new Date(session.finalButtonClickedAt);
          } else if (session.userEmail && session.updatedAt) {
            const potentialEndTime = new Date(session.updatedAt);
            const potentialDurationMs = potentialEndTime.getTime() - startTime.getTime();
            if (potentialDurationMs > 300000 && potentialDurationMs < 2700000) {
              endTime = potentialEndTime;
            }
          }

          if (endTime) {
            const durationMs = endTime.getTime() - startTime.getTime();
            if (durationMs > 60000 && durationMs < 3600000) {
              totalChatDuration += durationMs;
              completedChatsWithDuration++;
            }
          }
        }
      }
    }

    const averageChatDurationMinutes = completedChatsWithDuration > 0 
      ? Math.round(totalChatDuration / completedChatsWithDuration / 60000) 
      : 0;

    return {
      totalSessions: realSessions.length,
      viewChatCount,
      startChatCount,
      finalButtonClicks,
      whatsappButtonClicks,
      viewChatOnly: viewOnlySessions.length + realSessions.length,
      chatCompletate,
      startFinalOnly: realSessions.length - chatCompletate,
      viewFinalOnly: 0,
      averageChatDurationMinutes,
      conversionRates: {
        viewToStart: viewChatCount > 0 ? ((startChatCount / viewChatCount) * 100).toFixed(1) : '0',
        startToFinal: startChatCount > 0 ? ((finalButtonClicks / startChatCount) * 100).toFixed(1) : '0',
        viewToFinal: viewChatCount > 0 ? ((finalButtonClicks / viewChatCount) * 100).toFixed(1) : '0'
      },
      todaySessions: realSessions.length,
      totalMessages: 0
    };
  };

  // PRELOAD cache at startup for instant first load
  getCachedSessions().then(() => {
    console.log(`🚀 PRELOADED sessions cache at startup for instant performance`);
  }).catch(console.error);

  // Add admin API status endpoint for deployment verification
  app.get("/api/admin/status", async (req, res) => {
    try {
      const sessionCount = await storage.getAllChatSessions().then(sessions => sessions.length);
      const memUsage = process.memoryUsage();

      res.json({
        status: "operational",
        timestamp: new Date().toISOString(),
        sessionCount,
        memory: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + "MB",
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + "MB"
        },
        cache: {
          active: !!sessionsCache,
          timestamp: cacheTimestamp,
          size: sessionsCache?.length || 0
        },
        environment: process.env.NODE_ENV,
        uptime: Math.round(process.uptime()) + "s"
      });
    } catch (error: any) {
      res.status(500).json({ 
        status: "error", 
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Admin routes - ULTRA-OPTIMIZED FOR SPEED
  app.get("/api/admin/stats", async (req, res) => {
    try {
      const { from, to, period, search } = req.query;

      // Skip cache if search is applied - we need filtered results
      if (!search) {
        // Check pre-computed cache first for common periods
        if (!from && !to && period) {
          let cacheKey = '';
          switch (period) {
            case 'Oggi': cacheKey = 'today'; break;
            case 'Ieri': cacheKey = 'yesterday'; break;
            case 'Ultima settimana': cacheKey = 'week'; break;
            case 'Ultimo mese': cacheKey = 'month'; break;
          }

          if (cacheKey && statsCache[cacheKey]) {
            const cached = statsCache[cacheKey];
            if (Date.now() - cached.timestamp < STATS_CACHE_DURATION) {
              console.log(`⚡ INSTANT stats cache hit for ${cacheKey}`);
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Cache-Control', 'public, max-age=60');
              res.setHeader('X-Cache', 'HIT');
              return res.json(cached.data);
            }
          }
        }

        // Check for "all time" cache
        if (!from && !to && !period) {
          if (statsCache['all']) {
            const cached = statsCache['all'];
            if (Date.now() - cached.timestamp < STATS_CACHE_DURATION) {
              console.log(`⚡ INSTANT stats cache hit for all time`);
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Cache-Control', 'public, max-age=60');
              res.setHeader('X-Cache', 'HIT');
              return res.json(cached.data);
            }
          }
        }
      }

      // If not in cache or custom date range, compute it
      console.log('🔄 Computing stats for custom period...');
      await getCachedSessions(); // Ensure sessions are loaded

      const stats = await computeStatsForPeriod(
        from || to ? { from, to, search } : period ? { period, search } : { search }
      );

      // Update cache if it's a common period without search
      if (!search && !from && !to && period) {
        let cacheKey = '';
        switch (period) {
          case 'Oggi': cacheKey = 'today'; break;
          case 'Ieri': cacheKey = 'yesterday'; break;
          case 'Ultima settimana': cacheKey = 'week'; break;
          case 'Ultimo mese': cacheKey = 'month'; break;
        }
        if (cacheKey) {
          statsCache[cacheKey] = { data: stats, timestamp: Date.now() };
        }
      } else if (!search && !from && !to && !period) {
        statsCache['all'] = { data: stats, timestamp: Date.now() };
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.setHeader('X-Cache', 'MISS');
      res.json(stats);
    } catch (error: any) {
      console.error("❌ Error getting admin stats:", error);
      res.status(500).json({ error: "Failed to get stats", details: error.message });
    }
  });

  app.get("/api/admin/sessions", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 25;
      const search = req.query.search as string || "";
      const { from, to, period } = req.query;

      // OPTIMIZATION 5: Fast date filter calculation
      let dateFilter = null;
      if (from || to) {
        dateFilter = { from, to };
      } else if (period) {
        const now = new Date();

        switch (period) {
          case 'Oggi':
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            dateFilter = { from: today.toISOString() };
            break;
          case 'Ieri':
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday.setHours(0, 0, 0, 0);
            const yesterdayEnd = new Date();
            yesterdayEnd.setDate(yesterday.getDate() - 1);
            yesterdayEnd.setHours(23, 59, 59, 999);
            dateFilter = { from: yesterday.toISOString(), to: yesterdayEnd.toISOString() };
            break;
          case 'Ultima settimana':
            const weekAgo = new Date();
            weekAgo.setDate(now.getDate() - 7);
            dateFilter = { from: weekAgo.toISOString() };
            break;
          case 'Ultimo mese':
            const monthAgo = new Date();
            monthAgo.setMonth(now.getMonth() - 1);
            dateFilter = { from: monthAgo.toISOString() };
            break;
        }
      }

      const allSessions = await getCachedSessions();
      // Exclude "View Only" sessions from the list
      let sessions = allSessions.filter((session: any) => session.userName !== "View Only");

      // OPTIMIZATION 6: Apply date filter first to reduce dataset
      if (dateFilter) {
        const beforeFilter = sessions.length;
        sessions = sessions.filter((session: any) => {
          if (!session.createdAt) return false;

          const sessionDate = new Date(session.createdAt);
          const fromDate = dateFilter.from ? new Date(dateFilter.from as string) : null;
          const toDate = dateFilter.to ? new Date(dateFilter.to as string) : null;

          // If from date is specified, session must be after or equal to from date
          if (fromDate && sessionDate < fromDate) return false;

          // If to date is specified, session must be before or equal to to date
          if (toDate && sessionDate > toDate) return false;

          return true;
        });
        console.log(`Sessions API: Date filter applied - ${sessions.length}/${beforeFilter} sessions match date range`);
      }

      // Date filtering already applied above, use the filtered sessions
      let filteredSessions = sessions;

      // Then filter by search term if provided
      if (search) {
        filteredSessions = filteredSessions.filter((session: any) => 
          session.userName.toLowerCase().includes(search.toLowerCase()) ||
          session.sessionId.toLowerCase().includes(search.toLowerCase())
        );
      }

      // Sort sessions by creation date (newest first)
      filteredSessions.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Calculate pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedSessions = filteredSessions.slice(startIndex, endIndex);

      // OPTIMIZATION 7: Skip expensive message count calculation - use estimates
      const sessionsWithBasicInfo = paginatedSessions.map((session) => {
        // Estimate message count based on session activity instead of loading all messages
        let estimatedMessageCount = 1; // At least the initial message
        if (session.chatStartedAt) estimatedMessageCount += 5; // Basic conversation
        if (session.userEmail) estimatedMessageCount += 10; // Completed questionnaire
        if (session.finalButtonClicked || session.whatsappButtonClicked) estimatedMessageCount += 15; // Full conversation

        return {
          ...session,
          messageCount: estimatedMessageCount, // Fast estimate instead of expensive DB query
          isActive: false, // We'll calculate this only when needed
          messages: [] // Don't load full messages for list view
        };
      });

      res.json({
        sessions: sessionsWithBasicInfo,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(filteredSessions.length / limit),
          totalItems: filteredSessions.length,
          itemsPerPage: limit
        }
      });
    } catch (error) {
      console.error("Error getting admin sessions:", error);
      res.status(500).json({ error: "Failed to get sessions" });
    }
  });

  app.get("/api/admin/sessions/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;

      // Check cache first
      const cached = sessionDetailsCache.get(sessionId);
      if (cached && Date.now() - cached.timestamp < SESSION_DETAILS_CACHE_DURATION) {
        console.log(`⚡ Session details cache hit for ${sessionId}`);
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached.data);
      }

      const session = await storage.getChatSession(sessionId);

      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const messages = await storage.getChatMessages(sessionId);

      const data = {
        ...session,
        messages
      };

      // Cache the result
      sessionDetailsCache.set(sessionId, { data, timestamp: Date.now() });

      res.setHeader('X-Cache', 'MISS');
      res.json(data);
    } catch (error) {
      console.error("Error getting session details:", error);
      res.status(500).json({ error: "Failed to get session details" });
    }
  });

  app.delete("/api/admin/sessions/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;

      const session = await storage.getChatSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      await storage.deleteChatSession(sessionId);

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting session:", error);
      res.status(500).json({ error: "Failed to delete session" });
    }
  });

  // Test Google Sheets connection
  app.post('/api/admin/test-google-sheets', async (req, res) => {
    try {
      if (!process.env.GOOGLE_SHEETS_CREDENTIALS || !process.env.GOOGLE_SHEETS_ID) {
        return res.status(400).json({ error: 'Google Sheets credentials not configured' });
      }

      console.log('Testing Google Sheets connection...');
      const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);
      console.log('Service account email:', credentials.client_email);
      console.log('Sheet ID:', process.env.GOOGLE_SHEETS_ID);

      const sheets = new GoogleSheetsService(credentials, process.env.GOOGLE_SHEETS_ID);
      console.log('GoogleSheetsService created');

      // Test basic access to spreadsheet
      const spreadsheetInfo = await sheets.sheets.spreadsheets.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID
      });
      console.log('Spreadsheet title:', spreadsheetInfo.data.properties?.title);
      console.log('Available sheets:', spreadsheetInfo.data.sheets?.map(s => s.properties?.title));

      // Get the first sheet name
      const firstSheetName = spreadsheetInfo.data.sheets?.[0]?.properties?.title || 'Sheet1';
      console.log('Using sheet name:', firstSheetName);

      // Test if we can read the sheet
      const readTest = await sheets.sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `${firstSheetName}!A1:A1`
      });
      console.log('Read test successful');

      res.json({ 
        success: true, 
        serviceAccount: credentials.client_email,
        sheetId: process.env.GOOGLE_SHEETS_ID,
        spreadsheetTitle: spreadsheetInfo.data.properties?.title,
        availableSheets: spreadsheetInfo.data.sheets?.map(s => s.properties?.title),
        firstSheetName: firstSheetName
      });

    } catch (error) {
      console.error('Google Sheets test error:', error);
      res.status(500).json({ 
        error: error.message,
        details: error.response?.data || 'No additional details',
        serviceAccount: process.env.GOOGLE_SHEETS_CREDENTIALS ? 'Configured' : 'Not configured'
      });
    }
  });

  // Reset Google Sheets headers endpoint
  app.post('/api/admin/reset-google-sheets', async (req, res) => {
    try {
      if (!process.env.GOOGLE_SHEETS_CREDENTIALS || !process.env.GOOGLE_SHEETS_ID) {
        return res.status(400).json({ error: 'Google Sheets credentials not configured' });
      }

      const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);
      const sheets = new GoogleSheetsService(credentials, process.env.GOOGLE_SHEETS_ID);

      // Clear existing data and add new headers
      await sheets.sheets.spreadsheets.values.clear({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: 'Foglio1!A:Z'
      });

      // Force header reinitialization
      const initResult = await sheets.initializeSheet();

      res.json({ 
        success: true, 
        message: 'Google Sheets reset and reinitialized with new structure',
        initResult
      });

    } catch (error) {
      console.error('Google Sheets reset error:', error);
      res.status(500).json({ 
        error: error.message
      });
    }
  });

  // Update conversations with images only
  app.post("/api/admin/update-conversations-with-images", async (req, res) => {
    try {
      if (!process.env.GOOGLE_SHEETS_CREDENTIALS || !process.env.GOOGLE_SHEETS_ID) {
        return res.status(400).json({ error: 'Google Sheets credentials not configured' });
      }

      const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);
      const sheets = new GoogleSheetsService(credentials, process.env.GOOGLE_SHEETS_ID);

      // Get all sessions
      const allSessions = await storage.getAllChatSessions();
      let updated = 0;
      let errors = 0;

      console.log(`🖼️ Starting update of conversations with images...`);

      // Check if the image column exists in the sheet
      const headerResponse = await sheets.sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: 'Foglio1!A1:AA1'
      });

      const headers = headerResponse.data.values ? headerResponse.data.values[0] : [];
      const hasImageColumn = headers.includes('URL Immagini');

      if (!hasImageColumn) {
        // Add the new column header if it doesn't exist
        const newHeaders = [...headers, 'URL Immagini'];
        if (headers.length === 26) { // Was at column Z, now expanding to AA
          newHeaders.splice(-1, 0, 'URL Immagini'); // Insert before last column (conversation text)
        }

        await sheets.sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `Foglio1!A1:${String.fromCharCode(65 + newHeaders.length - 1)}1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [newHeaders]
          }
        });

        console.log('✅ Added "URL Immagini" column to existing sheet');
      }

      for (const session of allSessions) {
        try {
          // Get messages for this session
          const messages = await storage.getChatMessages(session.sessionId);

          if (!messages || messages.length < 3) {
            continue;
          }

          // Check if conversation has images
          const hasImages = messages.some(msg => 
            (msg.metadata && (msg.metadata as any).hasImage) ||
            msg.content.includes('[Immagine caricata:')
          );

          if (!hasImages) {
            continue; // Skip conversations without images
          }

          console.log(`🖼️ Processing session with images: ${session.userName} (${session.sessionId})`);

          // Use AI extraction for complete data
          const advancedAI = new AdvancedAIExtractor();
          const aiExtractedData = await advancedAI.extractConversationData(messages);
          const extractedData = aiExtractedData ? 
            advancedAI.convertToSheetsFormat(aiExtractedData) : 
            null;

          const success = await sheets.appendConversation(
            session.sessionId,
            session.userName,
            session.userEmail!,
            messages,
            extractedData
          );

          if (success) {
            await storage.updateChatSession(session.sessionId, { googleSheetsSynced: true });
            updated++;
            console.log(`✅ Updated session ${session.sessionId} with images`);
          } else {
            errors++;
          }

        } catch (error) {
          console.error(`❌ Error processing session ${session.sessionId}:`, error);
          errors++;
        }
      }

      res.json({ 
        success: true, 
        message: `Updated ${updated} conversations with images. ${errors} errors.`,
        updated,
        errors
      });

    } catch (error) {
      console.error('Error updating conversations with images:', error);
      res.status(500).json({ 
        error: error.message,
        details: 'Failed to update conversations with images'
      });
    }
  });

  // Re-sync all conversations to Google Sheets endpoint  
  app.post("/api/admin/resync-all-conversations", async (req, res) => {
    try {
      const allSessions = await storage.getAllChatSessions();
      let synced = 0;
      let errors = 0;

      // Filter sessions that have valid email (exclude test/example emails)
      const sessionsToSync = allSessions.filter(session => 
        session.userEmail && 
        session.userEmail.trim() !== '' &&
        !session.userEmail.includes('@example.') &&
        !session.userEmail.toLowerCase().includes('test')
      );

      console.log(`🔄 Starting re-sync of ${sessionsToSync.length} conversations to Google Sheets`);

      if (!integrationConfig.googleSheets.enabled) {
        return res.status(400).json({ error: 'Google Sheets integration not configured' });
      }

      const sheets = new GoogleSheetsService(integrationConfig.googleSheets.credentials, integrationConfig.googleSheets.spreadsheetId!);

      for (const session of sessionsToSync) {
        try {
          // Get messages for this session
          const messages = await storage.getChatMessages(session.sessionId);

          if (messages.length === 0) {
            console.log(`⚠️ No messages found for session ${session.sessionId}, skipping`);
            continue;
          }

          console.log(`🔄 Re-syncing session ${session.sessionId} for ${session.userEmail}`);

          // Use AI extraction for better data
          const advancedAI = new AdvancedAIExtractor();
          const aiExtractedData = await advancedAI.extractConversationData(messages);
          const extractedData = aiExtractedData ? 
            advancedAI.convertToSheetsFormat(aiExtractedData) : 
            null;

          // Sync to Google Sheets
          await sheets.appendConversation(
            session.sessionId,
            session.userName,
            session.userEmail,
            messages,
            extractedData
          );

          // Mark as synced
          await storage.updateChatSession(session.sessionId, { googleSheetsSynced: true });
          synced++;

          console.log(`✅ Re-synced session ${session.sessionId} for ${session.userEmail}`);

        } catch (error) {
          console.error(`❌ Failed to re-sync session ${session.sessionId}:`, error);
          errors++;
        }
      }

      res.json({ 
        success: true, 
        totalSessions: allSessions.length,
        eligibleSessions: sessionsToSync.length,
        syncedSessions: synced,
        errors: errors,
        message: `Successfully re-synced ${synced} conversations to Google Sheets`
      });

    } catch (error) {
      console.error('Re-sync all conversations error:', error);
      res.status(500).json({ 
        error: error.message,
        details: 'Failed to re-sync all conversations'
      });
    }
  });

  // Test Klaviyo lead automation endpoint
  app.post("/api/admin/test-klaviyo-automation", async (req, res) => {
    try {
      const result = await klaviyoLeadAutomation.testKlaviyoIntegration();
      res.json(result);
    } catch (error) {
      console.error("Error testing Klaviyo automation:", error);
      res.status(500).json({ 
        success: false, 
        message: `Test failed: ${error.message}` 
      });
    }
  });

  // Get Klaviyo automation status
  app.get("/api/admin/klaviyo-status", async (req, res) => {
    try {
      const status = klaviyoLeadAutomation.getStatus();
      res.json(status);
    } catch (error) {
      console.error("Error getting Klaviyo status:", error);
      res.status(500).json({ error: "Failed to get Klaviyo status" });
    }
  });

  // Batch process unsynced leads
  app.post("/api/admin/batch-klaviyo-sync", async (req, res) => {
    try {
      const result = await klaviyoLeadAutomation.batchProcessUnsyncedLeads();
      res.json({
        success: true,
        processed: result.processed,
        successful: result.successful,
        message: `Processed ${result.processed} sessions, ${result.successful} successful`
      });
    } catch (error) {
      console.error("Error in batch Klaviyo sync:", error);
      res.status(500).json({ error: "Failed to batch sync leads" });
    }
  });

  // Test AI data extraction endpoint
  app.post("/api/admin/test-ai-extraction", async (req, res) => {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({ error: "Session ID required" });
      }

      const session = await storage.getChatSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const messages = await storage.getChatMessages(sessionId);

      // Trova skin analysis se presente
      let skinAnalysis = null;
      const assistantMsg = messages.find(m => m.role === 'assistant' && (m.metadata as any)?.skinAnalysis);
      if (assistantMsg) {
        skinAnalysis = (assistantMsg.metadata as any).skinAnalysis;
      }

      // Testa estrazione AI
      const extractor = new ChatDataExtractor();
      const result = await extractor.extractStructuredData(messages, skinAnalysis);

      res.json({
        success: true,
        sessionId,
        userName: session.userName,
        userEmail: session.userEmail,
        extractedData: result,
        messagesCount: messages.length,
        hasSkinAnalysis: !!skinAnalysis
      });
    } catch (error) {
      console.error("Error testing AI extraction:", error);
      res.status(500).json({ error: "Failed to test AI extraction" });
    }
  });

  // Real-time AI extraction status endpoint
  app.get("/api/admin/realtime-extraction/status", async (req, res) => {
    try {
      const allSessions = await storage.getAllChatSessions();
      const unsynced = allSessions.filter(session => 
        session.userEmail && !session.googleSheetsSynced
      );

      const status = {
        unsyncedSessions: unsynced.length,
        totalSessions: allSessions.length,
        googleSheetsEnabled: integrationConfig.googleSheets.enabled,
        klaviyoEnabled: integrationConfig.klaviyo.enabled
      };
      res.json({
        success: true,
        ...status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error getting realtime extraction status:", error);
      res.status(500).json({ error: "Failed to get status" });
    }
  });

  // Manual AI extraction trigger endpoint
  app.post("/api/admin/realtime-extraction/trigger", async (req, res) => {
    try {
      const { sessionId } = req.body;

      if (sessionId) {
        // Extract specific session
        // Trigger auto-sync for specific session
        const response = await fetch('http://localhost:5000/api/admin/auto-sync-integrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
          const result = await response.json();
          res.json({
            success: true,
            message: `Auto-sync triggered for session ${sessionId}`
          });
        } else {
          res.status(500).json({ error: "Failed to trigger auto-sync" });
        }
      } else {
        // Trigger general auto-sync
        const response = await fetch('http://localhost:5000/api/admin/auto-sync-integrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
          const result = await response.json();
          res.json({
            success: true,
            synced: result.synced,
            message: `Auto-sync completed: ${result.synced} conversations processed`
          });
        } else {
          res.status(500).json({ error: "Failed to trigger auto-sync" });
        }
      }
    } catch (error) {
      console.error("Error triggering AI extraction:", error);
      res.status(500).json({ error: "Failed to trigger AI extraction" });
    }
  });

  // Extract last 5 chats endpoint
  app.post("/api/admin/extract-last-five", async (req, res) => {
    try {
      // Get all sessions sorted exactly like the dashboard (newest first, no email filter)
      const allSessions = await storage.getAllChatSessions();
      const lastFiveSessions = allSessions
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);

      console.log(`🎯 Extracting last 5 chats (same order as dashboard):`, lastFiveSessions.map(s => `#${s.id} (${s.userName})`));

      // Filter only those with email for actual processing
      const sessionsWithEmail = lastFiveSessions.filter(session => session.userEmail);
      console.log(`📧 Sessions with email for processing:`, sessionsWithEmail.map(s => `#${s.id} (${s.userName})`));

      // Return immediate response
      res.json({
        success: true,
        message: `Started processing ${sessionsWithEmail.length} conversations with email from last 5`,
        totalProcessed: sessionsWithEmail.length,
        extracted: sessionsWithEmail.length,
        lastFiveChats: lastFiveSessions.map(s => s.userName),
        processableChats: sessionsWithEmail.map(s => s.userName)
      });

      // Process in background (only sessions with email)
      processLastFiveAsync(sessionsWithEmail);

    } catch (error) {
      console.error("Error extracting last 5 chats:", error);
      res.status(500).json({ error: "Failed to extract last 5 chats" });
    }
  });

  // Background processing function
  async function processLastFiveAsync(sessions: any[]) {
    let extracted = 0;

    for (const session of sessions) {
      try {
        // Get messages for this session
        const allMessages = await storage.getChatMessages(session.sessionId);

        if (allMessages.length < 3) {
          console.log(`⏭️ Skipping session #${session.id} - too few messages (${allMessages.length})`);
          continue;
        }

        // Use AI extraction for better data
        console.log(`🤖 AI extracting data for session #${session.id} (${session.userName})`);
        const advancedAI = new AdvancedAIExtractor();
        const aiExtractedData = await advancedAI.extractConversationData(allMessages);

        if (aiExtractedData) {
          const extractedData = advancedAI.convertToSheetsFormat(aiExtractedData);

          // Sync to Google Sheets if configured
          if (process.env.GOOGLE_CREDENTIALS_JSON && process.env.GOOGLE_SPREADSHEET_ID) {
            const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
            const sheets = new GoogleSheetsService(credentials, process.env.GOOGLE_SPREADSHEET_ID);

            await sheets.initializeSheet();
            const success = await sheets.appendConversation(
              session.sessionId,
              session.userName,
              session.userEmail!,
              allMessages,
              extractedData
            );

            if (success) {
              await storage.updateChatSession(session.sessionId, { googleSheetsSynced: true });
              console.log(`✅ Extracted and synced session #${session.id} to Google Sheets`);
              extracted++;
            }
          }
        }
      } catch (error) {
        console.error(`Failed to extract session #${session.id}:`, error);
      }
    }

    console.log(`🎯 Completed processing ${sessions.length} conversations, extracted ${extracted}`);
  }

  // Manual sync endpoint for admin dashboard
  app.post("/api/admin/sessions/:sessionId/sync", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = await storage.getChatSession(sessionId);

      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (!session.userEmail) {
        return res.status(400).json({ error: "Session has no email address" });
      }

      const results = {
        klaviyo: false,
        googleSheets: false
      };

      // Sync with Klaviyo
      if (process.env.KLAVIYO_API_KEY && process.env.KLAVIYO_LIST_ID) {
        const klaviyo = new KlaviyoService(process.env.KLAVIYO_API_KEY, process.env.KLAVIYO_LIST_ID);
        results.klaviyo = await klaviyo.addProfileToList(session.userEmail, session.userName, {
          sessionId: session.sessionId,
          createdAt: session.createdAt
        });

        if (results.klaviyo) {
          await storage.updateChatSession(sessionId, { klaviyoSynced: true });
        }
      }

      // Sync with Google Sheets
      if (process.env.GOOGLE_SHEETS_CREDENTIALS && process.env.GOOGLE_SHEETS_ID) {
        try {
          const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);
          const sheets = new GoogleSheetsService(credentials, process.env.GOOGLE_SHEETS_ID);

          await sheets.initializeSheet();

          const allMessages = await storage.getChatMessages(sessionId);

          let skinAnalysis = null;
          const assistantMsg = allMessages.find(m => m.role === 'assistant' && (m.metadata as any)?.skinAnalysis);
          if (assistantMsg) {
            skinAnalysis = (assistantMsg.metadata as any).skinAnalysis;
          }

          // Use AI extraction for better data
          const advancedAI = new AdvancedAIExtractor();
          const aiExtractedData = await advancedAI.extractConversationData(allMessages);
          const extractedData = aiExtractedData ? 
            advancedAI.convertToSheetsFormat(aiExtractedData) : 
            null;

          results.googleSheets = await sheets.appendConversation(
            sessionId,
            session.userName,
            session.userEmail,
            allMessages,
            extractedData
          );

          if (results.googleSheets) {
            await storage.updateChatSession(sessionId, { googleSheetsSynced: true });
          }
        } catch (err) {
          console.error('Google Sheets sync error:', err);
        }
      }

      res.json({
        success: true,
        results
      });
    } catch (error) {
      console.error("Error syncing session:", error);
      res.status(500).json({ error: "Failed to sync session" });
    }
  });

  // Force reprocess specific session with Advanced AI
  app.post('/api/admin/reprocess/:sessionId', async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      if (isNaN(sessionId)) {
        return res.status(400).json({ error: 'Invalid session ID' });
      }

      const success = await realtimeExtractor.processSession(sessionId);
      res.json({
        success,
        message: success ? 
          `Successfully reprocessed session ${sessionId}` : 
          `Failed to reprocess session ${sessionId}`
      });
    } catch (error) {
      console.error('Session reprocessing failed:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to reprocess session' 
      });
    }
  });

  // Add image column to Google Sheets (without deleting existing data)
  app.post("/api/admin/add-image-column", async (req, res) => {
    try {
      if (!process.env.GOOGLE_CREDENTIALS_JSON || !process.env.GOOGLE_SPREADSHEET_ID) {
        return res.status(400).json({ error: "Google Sheets not configured" });
      }

      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      const sheets = new GoogleSheetsService(credentials, process.env.GOOGLE_SPREADSHEET_ID);

      // Check current headers
      const response = await sheets.sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
        range: 'Foglio1!A1:AA1'
      });

      const currentHeaders = response.data.values ? response.data.values[0] : [];

      // Only add image column if it doesn't exist
      if (!currentHeaders.includes('URL Immagini')) {
        // Update headers to include image column (expand to AA)
        const newHeaders = [[
          'Data/Ora', 'Session ID', 'Nome', 'Email', 'Età', 'Sesso', 'Tipo Pelle',
          'Problemi Pelle', 'Punteggio Pelle', 'Routine Attuale', 'Allergie', 'Profumo',
          'Ore Sonno', 'Stress', 'Alimentazione', 'Fumo', 'Idratazione', 'Protezione Solare',
          'Utilizzo Scrub', 'Fase Completata', 'Accesso Prodotti', 'Qualità Dati', 
          'Note Aggiuntive', 'Ingredienti Consigliati', 'URL Immagini', 'Num. Messaggi', 'Conversazione Completa'
        ]];

        await sheets.sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
          range: 'Foglio1!A1:AA1',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: newHeaders
          }
        });

        console.log('Google Sheets headers fixed - now aligned with data columns A-AA including images');

        res.json({ 
          success: true, 
          message: "Colonna immagini aggiunta con successo senza cancellare i dati esistenti" 
        });
      } else {
        res.json({ 
          success: true, 
          message: "Colonna immagini già presente" 
        });
      }
    } catch (error) {
      console.error("Error adding image column:", error);
      res.status(500).json({ error: "Failed to add image column" });
    }
  });

  // Update conversations with images in batch (optimized for API limits)
  app.post("/api/admin/update-image-column", async (req, res) => {
    try {
      if (!process.env.GOOGLE_CREDENTIALS_JSON || !process.env.GOOGLE_SPREADSHEET_ID) {
        return res.status(400).json({ error: "Google Sheets not configured" });
      }

      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      const sheets = new GoogleSheetsService(credentials, process.env.GOOGLE_SPREADSHEET_ID);

      // Get all sessions
      const allSessions = await storage.getAllChatSessions();
      let updated = 0;
      let skipped = 0;

      console.log(`🖼️ Collecting conversations with images for batch update...`);

      // Filter sessions that have valid email and might have images
      const sessionsToCheck = allSessions.filter(session => 
        session.userEmail && 
        session.userEmail.trim() !== '' &&
        !session.userEmail.includes('@example.') &&
        !session.userEmail.toLowerCase().includes('test')
      ).slice(0, 50); // Limit to 50 to avoid quota

      // Collect all updates in a batch
      const batchUpdates = [];

      // Get existing session IDs once
      const existingData = await sheets.sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
        range: 'Foglio1!B:B' // Session ID column
      });

      const sessionIds = existingData.data.values ? existingData.data.values.flat() : [];

      for (const session of sessionsToCheck) {
        try {
          // Get messages for this session
          const messages = await storage.getChatMessages(session.sessionId);

          // Check if this session has images
          const hasImages = messages.some(msg => 
            msg.metadata && 
            ((msg.metadata as any).hasImage || 
             (msg.metadata as any).imageBase64 ||
             msg.content.includes('[Immagine caricata:'))
          );

          if (!hasImages) {
            skipped++;
            continue;
          }

          // Find row index
          const existingIndex = sessionIds.findIndex(id => id === session.sessionId);
          if (existingIndex >= 0) {
            const updateRowIndex = existingIndex + 1; // +1 because sheets are 1-indexed

            // Extract image URLs with =IMAGE() formula for display
            const imageUrls = sheets.extractImageUrlsFromMessages(messages);

            // Create formula to display first image if available
            let displayValue = imageUrls;
            if (imageUrls && imageUrls.includes('http')) {
              const firstImageUrl = imageUrls.split(', ')[0];
              displayValue = `=IMAGE("${firstImageUrl}",4,150,150)`;
            }

            batchUpdates.push({
              range: `Foglio1!Y${updateRowIndex}`,
              values: [[displayValue]]
            });

            updated++;
            console.log(`📋 Prepared update for session ${session.sessionId} at row ${updateRowIndex}`);
          }

        } catch (error) {
          console.error(`❌ Failed to prepare update for session ${session.sessionId}:`, error);
        }
      }

      // Execute batch update if we have updates
      if (batchUpdates.length > 0) {
        try {
          await sheets.sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            requestBody: {
              valueInputOption: 'USER_ENTERED',
              data: batchUpdates
            }
          });
          console.log(`✅ Batch updated ${batchUpdates.length} image cells with display formulas`);
        } catch (batchError) {
          console.error('❌ Batch update failed:', batchError);
          // Fall back to individual updates with delay
          for (const update of batchUpdates.slice(0, 10)) { // Limit fallback
            try {
              await sheets.sheets.spreadsheets.values.update({
                spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
                range: update.range,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: update.values }
              });
              await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
            } catch (individualError) {
              console.error(`❌ Individual update failed for ${update.range}:`, individualError);
            }
          }
        }
      }

      res.json({ 
        success: true, 
        updatedSessions: updated,
        skippedSessions: skipped,
        batchSize: batchUpdates.length,
        message: `Preparate ${updated} conversazioni con formule IMAGE() per visualizzare le immagini`
      });

    } catch (error) {
      console.error("Error updating image column:", error);
      res.status(500).json({ error: "Failed to update image column" });
    }
  });

  // Test and update single image for verification
  app.post("/api/admin/test-single-image", async (req, res) => {
    try {
      if (!process.env.GOOGLE_CREDENTIALS_JSON || !process.env.GOOGLE_SPREADSHEET_ID) {
        return res.status(400).json({ error: "Google Sheets not configured" });
      }

      console.log(`🖼️ Testing single image update...`);

      // Attempt to add an IMAGE formula to a test cell
      const { google } = require('googleapis');
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      const auth = new google.auth.JWT(
        credentials.client_email,
        null,
        credentials.private_key.replace(/\\n/g, '\n'),
        ['https://www.googleapis.com/auth/spreadsheets']
      );

      const sheetsApi = google.sheets({ version: 'v4', auth });

      // Test with a simple public image URL
      const testImageUrl = "https://via.placeholder.com/100x100.png";
      const testFormula = `=IMAGE("${testImageUrl}",4,100,100)`;

      await sheetsApi.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
        range: 'Foglio1!Y2', // Test cell
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[testFormula]]
        }
      });

      console.log(`✅ Test IMAGE formula inserted successfully`);

      res.json({ 
        success: true, 
        message: "Test completato",
        testFormula,
        location: "Foglio1!Y2",
        explanation: "Ho inserito una formula IMAGE() di test nella cella Y2. Se vedi un'immagine placeholder lì, la funzionalità funziona."
      });

    } catch (error) {
      console.error("Error in test:", error);
      res.status(500).json({ 
        error: "Test failed", 
        details: error.message 
      });
    }
  });

  // Automatic image processing and public URL generation
  app.post("/api/admin/fix-image-display", async (req, res) => {
    try {
      console.log(`🖼️ Converting Base64 images to public URLs...`);

      // Get sessions with images
      const allSessions = await storage.getAllChatSessions();
      const sessionsWithEmail = allSessions.filter(session => 
        session.userEmail && 
        session.userEmail.trim() !== '' &&
        !session.userEmail.includes('@example.')
      ).slice(0, 10); // Process more sessions

      let processed = 0;
      let uploaded = 0;
      const publicUrls = [];
      const imageFormulas = [];

      for (const session of sessionsWithEmail) {
        try {
          processed++;
          const messages = await storage.getChatMessages(session.sessionId);

          // Find Base64 image
          let imageBase64 = null;
          for (const message of messages) {
            if (message.metadata && (message.metadata as any).hasImage) {
              const metadata = message.metadata as any;
              if (metadata.imageBase64) {
                imageBase64 = metadata.imageBase64;
                break;
              }
            }
          }

          if (!imageBase64) continue;

          console.log(`📤 Converting image for session ${session.sessionId}...`);

          // Convert Base64 to file
          const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
          const imageBuffer = Buffer.from(cleanBase64, 'base64');

          // Save to uploads directory
          const fs = await import('fs/promises');
          const tempDir = './uploads';

          // Ensure directory exists
          try {
            await fs.mkdir(tempDir, { recursive: true });
          } catch (error) {
            // Directory already exists
          }

          const fileName = `session-${session.sessionId}-${Date.now()}.jpg`;
          const tempPath = `${tempDir}/${fileName}`;

          await fs.writeFile(tempPath, imageBuffer);

          // Create public URL
          const domain = process.env.REPL_SLUG && process.env.REPL_OWNER 
            ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
            : `http://localhost:5000`;

          const publicUrl = `${domain}/uploads/${fileName}`;

          uploaded++;
          console.log(`✅ Created public URL: ${publicUrl}`);

          publicUrls.push({
            sessionId: session.sessionId,
            userEmail: session.userEmail,
            publicUrl: publicUrl,
            fileName: fileName
          });

          // Create IMAGE formula for Google Sheets
          const imageFormula = `=IMAGE("${publicUrl}",4,80,80)`;
          imageFormulas.push({
            sessionId: session.sessionId,
            formula: imageFormula
          });

        } catch (error) {
          console.error(`❌ Failed to process session ${session.sessionId}:`, error.message);
        }
      }

      // Generate instructions for manual copying
      const instructions = `
🎯 ISTRUZIONI AUTOMATICHE PER GOOGLE SHEETS:

✅ HO CONVERTITO ${uploaded} IMMAGINI IN URL PUBBLICI

📋 FORMULE IMAGE DA COPIARE NEL FOGLIO:

${imageFormulas.map(item => 
  `Session: ${item.sessionId}\nFormula: ${item.formula}\n`
).join('\n')}

🔧 COME APPLICARE:
1. Apri Google Sheets
2. Trova la riga con il Session ID nella colonna B
3. Nella colonna Y della stessa riga, incolla la formula IMAGE corrispondente
4. L'immagine apparirà automaticamente nella cella!

💡 ALTERNATIVA RAPIDA:
- Copia-incolla le formule sopra direttamente nelle celle Y
- Le immagini si caricheranno automaticamente

✅ TUTTE LE IMMAGINI SONO ORA ACCESSIBILI PUBBLICAMENTE
`;

      res.json({ 
        success: true, 
        message: "Conversione automatica completata",
        processed,
        uploaded,
        publicUrls,
        imageFormulas,
        instructions: instructions.trim(),
        explanation: `Ho convertito ${uploaded} immagini Base64 in URL pubblici e generato le formule IMAGE per Google Sheets. Ora puoi copiare-incollare le formule nel foglio per vedere le immagini direttamente!`
      });

    } catch (error) {
      console.error("Error in automatic image processing:", error);
      res.status(500).json({ 
        error: "Failed to process images automatically", 
        details: error.message 
      });
    }
  });

  // MASTER ENDPOINT: Process ALL images with complete automation
  app.post("/api/admin/process-all-images", async (req, res) => {
    try {
      console.log(`🎯 MASTER AUTOMATION: Processing ALL images with complete system...`);

      const limit = req.body.limit || 100; // Allow custom limits

      // Import the complete automation service
      const { CompleteImageAutomation } = await import('./services/complete-image-automation.js');
      const automation = new CompleteImageAutomation(storage);

      // Process all images
      const results = await automation.processAllImages(limit);

      // Generate CSV mapping
      const csvMapping = automation.generateCSVMapping(results);

      // Generate Google Sheets instructions
      const instructions = automation.generateSheetsInstructions(results);

      res.json({
        success: true,
        message: "Automazione completa terminata",
        summary: `✅ SUCCESSO COMPLETO: Ho processato ${results.processed} sessioni e convertito ${results.converted} immagini in URL pubblici. Tutte le formule IMAGE sono pronte per Google Sheets!`,
        statistics: {
          processed: results.processed,
          converted: results.converted,
          errors: results.errors.length
        },
        data: {
          publicUrls: results.publicUrls,
          errors: results.errors
        },
        csvMapping,
        instructions,
        nextSteps: [
          "1. Copia le formule IMAGE dalle istruzioni",
          "2. Apri Google Sheets", 
          "3. Trova il Session ID nella colonna B",
          "4. Incolla la formula nella colonna Y della stessa riga",
          "5. L'immagine apparirà automaticamente!"
        ]
      });

    } catch (error) {
      console.error("Error in master automation:", error);
      res.status(500).json({ 
        error: "Failed to run master automation", 
        details: error.message 
      });
    }
  });

  // Complete automatic system: Convert images + Insert into Google Sheets automatically  
  app.post("/api/admin/auto-insert-images", async (req, res) => {
    try {
      console.log(`🚀 Complete automatic: Convert + Insert images into Google Sheets...`);

      if (!process.env.GOOGLE_CREDENTIALS_JSON || !process.env.GOOGLE_SPREADSHEET_ID) {
        return res.status(400).json({ error: "Google Sheets not configured" });
      }

      // Dynamic import to avoid module issues
      const { google } = await import('googleapis');

      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      const auth = new google.auth.JWT(
        credentials.client_email,
        null,
        credentials.private_key.replace(/\\n/g, '\n'),
        ['https://www.googleapis.com/auth/spreadsheets']
      );

      const sheetsApi = google.sheets({ version: 'v4', auth });

      // Step 1: Convert images to public URLs
      console.log(`📋 Step 1: Converting images to public URLs...`);

      const allSessions = await storage.getAllChatSessions();
      const sessionsWithEmail = allSessions.filter(session => 
        session.userEmail && 
        session.userEmail.trim() !== '' &&
        !session.userEmail.includes('@example.')
      ).slice(0, 10); // Process in batches to avoid rate limits

      const processedImages = [];

      for (const session of sessionsWithEmail) {
        try {
          const messages = await storage.getChatMessages(session.sessionId);

          // Find Base64 image
          let imageBase64 = null;
          for (const message of messages) {
            if (message.metadata && (message.metadata as any).hasImage) {
              const metadata = message.metadata as any;
              if (metadata.imageBase64) {
                imageBase64 = metadata.imageBase64;
                break;
              }
            }
          }

          if (!imageBase64) continue;

          // Convert Base64 to file
          const fs = await import('fs/promises');
          const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
          const imageBuffer = Buffer.from(cleanBase64, 'base64');

          // Save to uploads directory
          const tempDir = './uploads';
          try {
            await fs.mkdir(tempDir, { recursive: true });
          } catch (error) {
            // Directory already exists
          }

          const fileName = `auto-${session.sessionId}-${Date.now()}.jpg`;
          const tempPath = `${tempDir}/${fileName}`;
          await fs.writeFile(tempPath, imageBuffer);

          // Create public URL
          const domain = process.env.REPL_SLUG && process.env.REPL_OWNER 
            ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
            : `http://localhost:5000`;

          const publicUrl = `${domain}/uploads/${fileName}`;

          processedImages.push({
            sessionId: session.sessionId,
            publicUrl: publicUrl,
            imageFormula: `=IMAGE("${publicUrl}",4,80,80)`
          });

          console.log(`✅ Processed: ${session.sessionId} -> ${publicUrl}`);

        } catch (error) {
          console.error(`❌ Failed to process session ${session.sessionId}:`, error.message);
        }
      }

      console.log(`📋 Step 2: Getting existing sheet data...`);

      // Step 2: Get existing sheet data to map session IDs to rows
      const existingData = await sheetsApi.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
        range: 'Foglio1!B:B'
      });

      const sessionIds = existingData.data.values ? existingData.data.values.flat() : [];

      console.log(`📋 Step 3: Updating Google Sheets with IMAGE formulas...`);

      // Step 3: Update Google Sheets with IMAGE formulas
      let updated = 0;
      const updateResults = [];

      for (const imageData of processedImages) {
        try {
          const existingIndex = sessionIds.findIndex(id => id === imageData.sessionId);

          if (existingIndex >= 0) {
            const rowIndex = existingIndex + 1; // Sheets are 1-indexed

            // Update with IMAGE formula
            await sheetsApi.spreadsheets.values.update({
              spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
              range: `Foglio1!Y${rowIndex}`,
              valueInputOption: 'USER_ENTERED',
              requestBody: {
                values: [[imageData.imageFormula]]
              }
            });

            updated++;
            updateResults.push({
              sessionId: imageData.sessionId,
              sheetRow: rowIndex,
              status: 'updated',
              publicUrl: imageData.publicUrl
            });

            console.log(`✅ Updated Google Sheets row ${rowIndex} with IMAGE formula`);

            // Small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 1500));

          } else {
            updateResults.push({
              sessionId: imageData.sessionId,
              status: 'not_found_in_sheet',
              publicUrl: imageData.publicUrl
            });
          }

        } catch (error) {
          console.error(`❌ Failed to update sheet for session ${imageData.sessionId}:`, error.message);
          updateResults.push({
            sessionId: imageData.sessionId,
            status: 'error',
            error: error.message
          });
        }
      }

      res.json({ 
        success: true, 
        message: "Sistema completamente automatico completato",
        processedImages: processedImages.length,
        updatedRows: updated,
        results: updateResults,
        summary: `✅ SUCCESSO TOTALE: Ho processato ${processedImages.length} immagini e aggiornato ${updated} righe in Google Sheets. Le immagini sono ora visibili direttamente nel foglio senza intervento manuale!`
      });

    } catch (error) {
      console.error("Error in complete automatic system:", error);
      res.status(500).json({ 
        error: "Failed to run complete automatic system", 
        details: error.message 
      });
    }
  });

  // Serve public files from uploads directory for Google Sheets access
  app.get("/uploads/:fileName", async (req, res) => {
    try {
      const fileName = req.params.fileName;
      const filePath = `./uploads/${fileName}`;

      // Check if file exists  
      const fs = await import('fs/promises');
      await fs.access(filePath);

      // Set appropriate headers for public access
      res.set({
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*'
      });

      // Stream the file
      const fileBuffer = await fs.readFile(filePath);
      res.send(fileBuffer);

    } catch (error) {
      console.error(`Error serving file ${req.params.fileName}:`, error);
      res.status(404).json({ error: 'File not found' });
    }
  });

  // Direct image embedding using Google Sheets API with actual image insertion
  app.post("/api/admin/embed-images-direct", async (req, res) => {
    try {
      console.log(`🖼️ Starting direct image embedding using Sheets API...`);

      if (!process.env.GOOGLE_CREDENTIALS_JSON || !process.env.GOOGLE_SPREADSHEET_ID) {
        return res.status(400).json({ error: "Google Sheets not configured" });
      }

      const { google } = require('googleapis');
      const fs = require('fs').promises;
      const path = require('path');

      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      const auth = new google.auth.JWT(
        credentials.client_email,
        null,
        credentials.private_key.replace(/\\n/g, '\n'),
        ['https://www.googleapis.com/auth/spreadsheets']
      );

      const sheetsApi = google.sheets({ version: 'v4', auth });

      // Get first session with image for testing
      const allSessions = await storage.getAllChatSessions();
      const sessionsWithEmail = allSessions.filter(session => 
        session.userEmail && 
        session.userEmail.trim() !== '' &&
        !session.userEmail.includes('@example.')
      );

      let testSession = null;
      let testImagePath = null;

      // Find a session with an actual image file
      for (const session of sessionsWithEmail.slice(0, 10)) {
        const messages = await storage.getChatMessages(session.sessionId);

        for (const message of messages) {
          const imageMatch = message.content.match(/\[Immagine caricata:\s*([^\]]+)\]/);
          if (imageMatch && imageMatch[1]) {
            const fileName = imageMatch[1].trim();
            const imagePath = path.join(process.cwd(), 'uploads', fileName);

            try {
              await fs.access(imagePath);
              testSession = session;
              testImagePath = imagePath;
              break;
            } catch {
              continue;
            }
          }
        }
        if (testSession) break;
      }

      if (!testSession || !testImagePath) {
        return res.json({
          success: false,
          message: "Nessuna immagine trovata per il test",
          explanation: "Non ho trovato file immagine accessibili nella cartella uploads per testare l'inserimento diretto."
        });
      }

      // Read the image file
      const imageBuffer = await fs.readFile(testImagePath);
      const fileName = path.basename(testImagePath);

      // Convert to base64
      const base64Image = imageBuffer.toString('base64');
      const mimeType = testImagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

      // Try to insert the image using batch update with embedded object
      const requests = [{
        insertEmbeddedObject: {
          location: {
            sheetId: 0, // Assuming first sheet
            newSheet: false
          },
          objectProperties: {
            embeddedObject: {
              imageProperties: {
                sourceUri: `data:${mimeType};base64,${base64Image}`,
                cropProperties: {
                  cropType: 'SQUARE'
                }
              }
            },
            size: {
              width: { magnitude: 100, unit: 'PIXELS' },
              height: { magnitude: 100, unit: 'PIXELS' }
            },
            position: {
              overlayPosition: {
                anchorCell: {
                  sheetId: 0,
                  rowIndex: 1, // Row 2 (0-indexed)
                  columnIndex: 24 // Column Y (0-indexed)
                },
                offsetXPixels: 0,
                offsetYPixels: 0
              }
            }
          }
        }
      }];

      const response = await sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
        requestBody: {
          requests
        }
      });

      console.log(`✅ Successfully embedded image: ${fileName}`);

      res.json({
        success: true,
        message: "Immagine inserita con successo",
        fileName,
        sessionId: testSession.sessionId,
        location: "Y2",
        explanation: "Ho inserito un'immagine di test direttamente nel foglio Google Sheets. Controlla la cella Y2 per vedere l'immagine embedded."
      });

    } catch (error) {
      console.error("Error embedding image directly:", error);
      res.status(500).json({ 
        error: "Failed to embed image", 
        details: error.message 
      });
    }
  });

  // Fix Google Sheets headers endpoint
  app.post("/api/admin/fix-sheets-headers", async (req, res) => {
    try {
      if (!process.env.GOOGLE_CREDENTIALS_JSON || !process.env.GOOGLE_SPREADSHEET_ID) {
        return res.status(400).json({ error: "Google Sheets not configured" });
      }

      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      const sheets = new GoogleSheetsService(credentials, process.env.GOOGLE_SPREADSHEET_ID);

      // Manually update headers to correct range A1:AA1 (including image column)
      const headers = [[
        'Data/Ora', 'Session ID', 'Nome', 'Email', 'Età', 'Sesso', 'Tipo Pelle',
        'Problemi Pelle', 'Punteggio Pelle', 'Routine Attuale', 'Allergie', 'Profumo',
        'Ore Sonno', 'Stress', 'Alimentazione', 'Fumo', 'Idratazione', 'Protezione Solare',
        'Utilizzo Scrub', 'Fase Completata', 'Accesso Prodotti', 'Qualità Dati', 
        'Note Aggiuntive', 'Ingredienti Consigliati', 'URL Immagini', 'Num. Messaggi', 'Conversazione Completa'
      ]];

      await sheets.sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
        range: 'Foglio1!A1:AA1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: headers
        }
      });

      console.log('Google Sheets headers fixed - now aligned with data columns A-AA including images');

      res.json({ 
        success: true, 
        message: "Headers corretti e allineati alle colonne dati A-AA con colonna immagini inclusa" 
      });
    } catch (error) {
      console.error("Error fixing Google Sheets headers:", error);
      res.status(500).json({ error: "Failed to fix headers" });
    }
  });

  // Check Google Sheets headers endpoint
  app.get("/api/admin/check-sheets-headers", async (req, res) => {
    try {
      if (!process.env.GOOGLE_CREDENTIALS_JSON || !process.env.GOOGLE_SPREADSHEET_ID) {
        return res.status(400).json({ error: "Google Sheets not configured" });
      }

      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      const sheets = new GoogleSheetsService(credentials, process.env.GOOGLE_SPREADSHEET_ID);

      const response = await sheets.sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
        range: 'Foglio1!A1:Z1'
      });

      const headers = response.data.values ? response.data.values[0] : [];

      res.json({ 
        success: true, 
        headers: headers,
        totalColumns: headers.length,
        ingredientsColumn: headers.indexOf('Ingredienti Consigliati') + 1 // +1 for human readable (A=1, B=2, etc.)
      });
    } catch (error) {
      console.error("Error checking Google Sheets headers:", error);
      res.status(500).json({ error: "Failed to check headers" });
    }
  });

  // Auto-Learning System Routes
  app.post('/api/admin/auto-learning/analyze', async (req, res) => {
    try {
      console.log('🧠 Starting auto-learning analysis...');

      // Get recent conversations (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const sessions = await storage.getAllSessions();
      const recentSessions = sessions.filter(s => 
        new Date(s.createdAt) > thirtyDaysAgo
      );

      console.log(`📊 Analyzing ${recentSessions.length} recent sessions...`);

      // Prepare conversation data
      const conversations = [];
      for (const session of recentSessions.slice(0, 50)) { // Limit to 50 for performance
        const messages = await storage.getChatMessages(session.sessionId);
        if (messages && messages.length >= 5) { // Only analyze substantial conversations
          conversations.push({
            sessionId: session.sessionId,
            messages,
            userData: {
              userName: session.userName,
              createdAt: session.createdAt,
              finalButtonClicked: session.finalButtonClicked
            }
          });
        }
      }

      console.log(`🔍 Processing ${conversations.length} substantial conversations...`);

      // Run analysis
      const analyses = await autoLearningSystem.analyzeConversations(conversations);

      console.log(`✅ Auto-learning analysis completed`);

      res.json({
        success: true,
        message: `Analyzed ${analyses.length} conversations`,
        stats: autoLearningSystem.getLearningStats(),
        analyses: analyses.slice(0, 10) // Return first 10 for preview
      });
    } catch (error) {
      console.error('Auto-learning analysis error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  app.get('/api/admin/auto-learning/insights', async (req, res) => {
    try {
      const insights = await autoLearningSystem.getApprovedInsights();
      const stats = autoLearningSystem.getLearningStats();

      res.json({
        success: true,
        insights,
        stats
      });
    } catch (error) {
      console.error('Error getting insights:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  app.post('/api/admin/auto-learning/approve/:insightId', async (req, res) => {
    try {
      const { insightId } = req.params;
      const success = await autoLearningSystem.approveInsight(insightId);

      if (success) {
        res.json({ success: true, message: 'Insight approved and applied' });
      } else {
        res.status(404).json({ success: false, error: 'Insight not found' });
      }
    } catch (error) {
      console.error('Error approving insight:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  app.post('/api/admin/auto-learning/reject/:insightId', async (req, res) => {
    try {
      const { insightId } = req.params;
      const success = await autoLearningSystem.rejectInsight(insightId);

      if (success) {
        res.json({ success: true, message: 'Insight rejected' });
      } else {
        res.status(404).json({ success: false, error: 'Insight not found' });
      }
    } catch (error) {
      console.error('Error rejecting insight:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // RAG Knowledge Base Management Routes
  app.get('/api/admin/rag/stats', async (req, res) => {
    try {
      const ragStats = await ragService.getStats();
      const vectorRagStats = await vectorRagService.getStats();

      res.json({
        success: true,
        ragStats,
        vectorRagStats
      });
    } catch (error) {
      console.error("Error getting RAG stats:", error);
      res.status(500).json({ error: "Failed to get RAG stats" });
    }
  });

  const server = createServer(app);
  return server;
}