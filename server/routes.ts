import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { GeminiService } from "./services/gemini";
import { SkinAnalysisService } from "./services/skin-analysis";
import { KlaviyoService } from "./services/klaviyo";
import { KlaviyoLeadAutomation } from "./services/klaviyo-lead-automation";
import { GoogleSheetsService } from "./services/google-sheets";
import { ChatDataExtractor } from "./services/chat-data-extractor";
import { AdvancedAIExtractor } from "./services/advanced-ai-extractor";
// Load environment variables before importing integration config
import { config } from "dotenv";
config();
import { loadIntegrationConfig } from "./config/integrations";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";

// Service management
const MAX_SESSIONS_IN_MEMORY = 1000;
const geminiServices = new Map<string, GeminiService>();
// Load integration configuration
const integrationConfig = loadIntegrationConfig();
// Initialize Klaviyo Lead Automation
const klaviyoLeadAutomation = new KlaviyoLeadAutomation();

// Auto-cleanup sessions
setInterval(() => {
  if (geminiServices.size > MAX_SESSIONS_IN_MEMORY) {
    const sessions = Array.from(geminiServices.keys());
    const toDelete = sessions.slice(0, sessions.length - MAX_SESSIONS_IN_MEMORY);
    toDelete.forEach(sessionId => geminiServices.delete(sessionId));
    console.log(`Cleaned up ${toDelete.length} old sessions`);
  }
}, 5 * 60 * 1000);

// Auto-fix missing images every 5 minutes
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

  // Auto-fix missing images endpoint - NEW VERSION WITH REAL IMAGE RECOVERY
  app.post("/api/admin/auto-fix-images", async (req, res) => {
    try {
      const allMessages = await storage.getAllChatMessages();
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const recentImagesWithoutBase64 = allMessages.filter(msg => 
        msg.metadata && 
        (msg.metadata as any).hasImage &&
        !(msg.metadata as any).imageBase64 &&
        new Date(msg.createdAt!) > cutoffTime
      );
      
      let fixed = 0;
      let realImageRecovered = 0;
      
      for (const message of recentImagesWithoutBase64) {
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
      
      res.json({ 
        success: true, 
        fixedImages: fixed,
        realImagesRecovered: realImageRecovered,
        totalRecentImages: recentImagesWithoutBase64.length
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
            reason: error.message 
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
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required" });
      }

      const session = await storage.getChatSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Only track the first view
      if (!session.firstViewedAt) {
        await storage.updateChatSession(sessionId, { 
          firstViewedAt: new Date() 
        });
      }

      res.json({ success: true });
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

      const geminiService = new GeminiService();
      geminiServices.set(sessionId, geminiService);

      const initialResponse = await geminiService.initializeConversation(userName);

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

      const geminiService = geminiServices.get(sessionId);
      if (!geminiService) {
        return res.status(404).json({ error: "Chat service not found" });
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
      const analysisResult = await skinAnalysis.analyzeImage(imageFile.path);

      const analysisMessage = message ? 
        `${message}\n\nAnalisi AI della pelle: ${JSON.stringify(analysisResult)}` : 
        `Analisi AI della pelle: ${JSON.stringify(analysisResult)}`;
      
      const response = await geminiService.sendMessage(analysisMessage);

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

      res.json({
        message: response,
      });
    } catch (error) {
      console.error("Error sending message with image:", error);
      res.status(500).json({ error: "Failed to send message with image" });
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

      const geminiService = geminiServices.get(sessionId);
      if (!geminiService) {
        return res.status(404).json({ error: "Chat service not found" });
      }

      await storage.addChatMessage({
        sessionId,
        role: "user",
        content: message,
        metadata: null,
      });

      // Check if message contains email and update session
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

        // REAL-TIME SYNC: Trigger immediate synchronization with AI extraction when email is detected
        console.log(`📧 EMAIL DETECTED: ${userEmail} - Triggering immediate sync to Google Sheets`);
        
        // Use integration config for real-time sync with AI extraction  
        if (integrationConfig.googleSheets.enabled) {
          try {
            const sheets = new GoogleSheetsService(integrationConfig.googleSheets.credentials, integrationConfig.googleSheets.spreadsheetId!);
            
            // Get all messages for the session
            const allMessages = await storage.getChatMessages(sessionId);
            console.log(`📨 Retrieved ${allMessages.length} messages for real-time sync`);

            // Use Advanced AI extraction for complete data extraction
            console.log('🤖 Real-time AI extraction starting...');
            const advancedAI = new AdvancedAIExtractor();
            const aiExtractedData = await advancedAI.extractConversationData(allMessages);
            const extractedData = aiExtractedData ? 
              advancedAI.convertToSheetsFormat(aiExtractedData) : 
              null;

            if (extractedData) {
              console.log('📊 Real-time AI extracted data:', {
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
              console.log(`✅ REAL-TIME SYNC SUCCESS: ${session.userName} (${userEmail}) synced to Google Sheets`);
            }
          } catch (err) {
            console.error('Failed to parse Google Sheets credentials:', err);
          }
        }
      }

      const response = await geminiService.sendMessage(message);

      await storage.addChatMessage({
        sessionId,
        role: "assistant",
        content: response.content,
        metadata: {
          hasChoices: response.hasChoices,
          choices: response.choices,
        },
      });

      res.json({
        message: response,
      });
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

  // Admin routes
  app.get("/api/admin/stats", async (req, res) => {
    try {
      const { from, to, period } = req.query;
      const allSessions = await storage.getAllChatSessions();
      
      // Helper function to filter sessions by date range
      const filterSessionsByDateRange = (sessions, fromDate, toDate) => {
        if (!fromDate && !toDate) {
          return sessions; // No filtering for "Tutto il tempo"
        }
        
        return sessions.filter(session => {
          const sessionDate = new Date(session.createdAt);
          if (fromDate && sessionDate < new Date(fromDate)) return false;
          if (toDate && sessionDate > new Date(toDate + 'T23:59:59.999Z')) return false;
          return true;
        });
      };

      // Filter sessions based on date range
      let filteredSessions = allSessions;
      if (from || to) {
        filteredSessions = filterSessionsByDateRange(allSessions, from, to);
      } else if (period) {
        // Handle predefined periods
        const now = new Date();
        let fromDate;
        
        switch (period) {
          case 'Oggi':
            fromDate = new Date();
            fromDate.setHours(0, 0, 0, 0);
            filteredSessions = allSessions.filter(session => 
              new Date(session.createdAt) >= fromDate
            );
            break;
          case 'Ultima settimana':
            fromDate = new Date();
            fromDate.setDate(now.getDate() - 7);
            filteredSessions = allSessions.filter(session => 
              new Date(session.createdAt) >= fromDate
            );
            break;
          case 'Ultimo mese':
            fromDate = new Date();
            fromDate.setMonth(now.getMonth() - 1);
            filteredSessions = allSessions.filter(session => 
              new Date(session.createdAt) >= fromDate
            );
            break;
        }
      }
      
      // Calculate metrics for filtered sessions
      const viewChatCount = filteredSessions.filter(session => session.firstViewedAt).length;
      const startChatCount = filteredSessions.filter(session => session.chatStartedAt).length;
      const finalButtonClicks = filteredSessions.filter(session => session.finalButtonClicked).length;

      // Calculate conversion rates
      const viewToStartRate = viewChatCount > 0 ? ((startChatCount / viewChatCount) * 100).toFixed(1) : '0';
      const startToFinalRate = startChatCount > 0 ? ((finalButtonClicks / startChatCount) * 100).toFixed(1) : '0';
      const viewToFinalRate = viewChatCount > 0 ? ((finalButtonClicks / viewChatCount) * 100).toFixed(1) : '0';

      res.json({
        totalSessions: filteredSessions.length,
        viewChatCount,
        startChatCount,
        finalButtonClicks,
        conversionRates: {
          viewToStart: viewToStartRate,
          startToFinal: startToFinalRate,
          viewToFinal: viewToFinalRate
        },
        // Keep legacy fields for compatibility
        todaySessions: filteredSessions.length,
        totalMessages: (await storage.getAllChatMessages()).length
      });
    } catch (error) {
      console.error("Error getting admin stats:", error);
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  app.get("/api/admin/sessions", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 25;
      const search = req.query.search as string || "";
      const { from, to, period } = req.query;
      

      
      const sessions = await storage.getAllChatSessions();
      
      // Helper function to filter sessions by date range
      const filterSessionsByDateRange = (sessions, fromDate, toDate) => {
        if (!fromDate && !toDate) {
          return sessions; // No filtering for "Tutto il tempo"
        }
        
        return sessions.filter(session => {
          const sessionDate = new Date(session.createdAt);
          if (fromDate && sessionDate < new Date(fromDate)) return false;
          if (toDate && sessionDate > new Date(toDate + 'T23:59:59.999Z')) return false;
          return true;
        });
      };

      // Filter sessions by date range first
      let filteredSessions = sessions;
      if (from || to) {
        filteredSessions = filterSessionsByDateRange(sessions, from, to);
      } else if (period) {
        // Handle predefined periods
        const now = new Date();
        let fromDate;
        
        switch (period) {
          case 'Oggi':
            fromDate = new Date();
            fromDate.setHours(0, 0, 0, 0);
            filteredSessions = sessions.filter(session => 
              new Date(session.createdAt) >= fromDate
            );
            break;
          case 'Ultima settimana':
            fromDate = new Date();
            fromDate.setDate(now.getDate() - 7);
            filteredSessions = sessions.filter(session => 
              new Date(session.createdAt) >= fromDate
            );
            break;
          case 'Ultimo mese':
            fromDate = new Date();
            fromDate.setMonth(now.getMonth() - 1);
            filteredSessions = sessions.filter(session => 
              new Date(session.createdAt) >= fromDate
            );
            break;
        }
      }
      
      // Then filter by search term if provided
      if (search) {
        filteredSessions = filteredSessions.filter(session => 
          session.userName.toLowerCase().includes(search.toLowerCase()) ||
          session.sessionId.toLowerCase().includes(search.toLowerCase())
        );
      }
      
      // Sort sessions by creation date (newest first)
      filteredSessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Calculate pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedSessions = filteredSessions.slice(startIndex, endIndex);
      
      // Only get message counts for paginated sessions (not all messages)
      const sessionsWithBasicInfo = await Promise.all(
        paginatedSessions.map(async (session) => {
          const sessionMessages = await storage.getChatMessages(session.sessionId);
          // For performance, we only get message count, not full messages
          return {
            ...session,
            messageCount: sessionMessages ? sessionMessages.length : 0,
            isActive: false, // We'll calculate this only when needed
            messages: [] // Don't load full messages for list view
          };
        })
      );

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
      const session = await storage.getChatSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const messages = await storage.getChatMessages(sessionId);
      
      res.json({
        ...session,
        messages
      });
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

  // Auto-sync integrations endpoint
  app.post("/api/admin/auto-sync-integrations", async (req, res) => {
    try {
      const allSessions = await storage.getAllChatSessions();
      let synced = 0;
      
      // Filter sessions that have email but haven't been synced (limit to last 5)
      const unsynced = allSessions.filter(session => 
        session.userEmail && 
        (!session.klaviyoSynced || !session.googleSheetsSynced)
      );
      
      // Sort by creation date (newest first) and take only last 5
      const sessionsToSync = unsynced
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);
      
      if (sessionsToSync.length > 0) {
        console.log(`🔍 Found ${unsynced.length} unsynced sessions, processing latest ${sessionsToSync.length}:`, 
          sessionsToSync.map(s => `#${s.id} (${s.userName})`));
      }

      for (const session of sessionsToSync) {
        try {
          // Enhanced Klaviyo sync with AI extraction if not already synced
          if (!session.klaviyoSynced && integrationConfig.klaviyo.enabled) {
            const success = await klaviyoLeadAutomation.processConversationForLeads(session.sessionId);
            if (success) {
              console.log(`✅ Enhanced Klaviyo sync completed for ${session.userName} (${session.userEmail})`);
            } else {
              console.log(`⚠️ Enhanced Klaviyo sync failed for ${session.userName} (${session.userEmail})`);
            }
          }

          // Sync with Google Sheets if not already synced and credentials are available
          if (!session.googleSheetsSynced && integrationConfig.googleSheets.enabled) {
            try {
              console.log(`🔄 Attempting to sync session ${session.sessionId} to Google Sheets...`);
              
              const sheets = new GoogleSheetsService(integrationConfig.googleSheets.credentials, integrationConfig.googleSheets.spreadsheetId!);
              
              // Get all messages for the session
              const allMessages = await storage.getChatMessages(session.sessionId);
              console.log(`📨 Retrieved ${allMessages.length} messages for session`);

              // Use AI extraction for better data
              console.log('🤖 Using Advanced AI extraction for better data...');
              const advancedAI = new AdvancedAIExtractor();
              const aiExtractedData = await advancedAI.extractConversationData(allMessages);
              const extractedData = aiExtractedData ? 
                advancedAI.convertToSheetsFormat(aiExtractedData) : 
                null;
              
              if (extractedData) {
                console.log('📊 AI extracted data preview:', {
                  eta: extractedData.eta,
                  sesso: extractedData.sesso,
                  tipoPelle: extractedData.tipoPelle,
                  problemi: extractedData.problemiPelle?.slice(0, 2) // Only show first 2 problems
                });
              }

              const success = await sheets.appendConversation(
                session.sessionId,
                session.userName,
                session.userEmail!,
                allMessages,
                extractedData
              );
              
              if (success) {
                await storage.updateChatSession(session.sessionId, { googleSheetsSynced: true });
                console.log(`✅ Synced ${session.userName} conversation to Google Sheets`);
              }
            } catch (err) {
              console.error(`❌ Google Sheets sync failed for session ${session.sessionId}:`, err);
            }
          }

          synced++;
        } catch (error) {
          console.error(`Failed to sync session ${session.sessionId}:`, error);
        }
      }

      res.json({ 
        success: true, 
        synced: synced,
        totalToSync: sessionsToSync.length
      });
    } catch (error) {
      console.error("Error in auto-sync integrations:", error);
      res.status(500).json({ error: "Failed to sync integrations" });
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

  // Fix Google Sheets headers endpoint
  app.post("/api/admin/fix-sheets-headers", async (req, res) => {
    try {
      if (!process.env.GOOGLE_CREDENTIALS_JSON || !process.env.GOOGLE_SPREADSHEET_ID) {
        return res.status(400).json({ error: "Google Sheets not configured" });
      }

      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      const sheets = new GoogleSheetsService(credentials, process.env.GOOGLE_SPREADSHEET_ID);
      
      // Manually update headers to correct range A1:Y1
      const headers = [[
        'Data/Ora', 'Session ID', 'Nome', 'Email', 'Età', 'Sesso', 'Tipo Pelle',
        'Problemi Pelle', 'Punteggio Pelle', 'Routine Attuale', 'Allergie', 'Profumo',
        'Ore Sonno', 'Stress', 'Alimentazione', 'Fumo', 'Idratazione', 'Protezione Solare',
        'Utilizzo Scrub', 'Fase Completata', 'Accesso Prodotti', 'Qualità Dati', 
        'Note Aggiuntive', 'Num. Messaggi', 'Conversazione Completa'
      ]];
      
      await sheets.sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
        range: 'Foglio1!A1:Y1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: headers
        }
      });

      console.log('Google Sheets headers fixed - now aligned with data columns A-Y');
      
      res.json({ 
        success: true, 
        message: "Headers corretti e allineati alle colonne dati A-Y" 
      });
    } catch (error) {
      console.error("Error fixing Google Sheets headers:", error);
      res.status(500).json({ error: "Failed to fix headers" });
    }
  });

  const server = createServer(app);
  return server;
}