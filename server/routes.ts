import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { GeminiService } from "./services/gemini";
import { SkinAnalysisService } from "./services/skin-analysis";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";

// Service management
const MAX_SESSIONS_IN_MEMORY = 1000;
const geminiServices = new Map<string, GeminiService>();

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
      const allSessions = await storage.getAllChatSessions();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todaySessions = allSessions.filter(session => 
        new Date(session.createdAt) >= today
      );

      const finalButtonClicks = allSessions.filter(session => 
        session.finalButtonClicked
      ).length;

      res.json({
        totalSessions: allSessions.length,
        todaySessions: todaySessions.length,
        finalButtonClicks: finalButtonClicks,
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
      
      const sessions = await storage.getAllChatSessions();
      
      // Filter sessions by search term if provided
      let filteredSessions = sessions;
      if (search) {
        filteredSessions = sessions.filter(session => 
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

  const server = createServer(app);
  return server;
}