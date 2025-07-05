import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { GeminiService } from "./services/gemini";
import { SkinAnalysisService } from "./services/skin-analysis";
import { ragService } from "./services/rag-simple";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";

const geminiServices = new Map<string, GeminiService>();

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

const upload = multer({ 
  storage: storage_config,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo di file non supportato. Solo PDF, DOCX e TXT sono ammessi.'));
    }
  }
});

const imageUpload = multer({ 
  storage: storage_config,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Tipo di file non supportato. Solo immagini sono ammesse.'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Start a new chat session
  app.post("/api/chat/start", async (req, res) => {
    try {
      const { userName } = req.body;
      
      if (!userName || typeof userName !== "string") {
        return res.status(400).json({ error: "User name is required" });
      }

      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const userId = `user_${Date.now()}`;
      
      // Create chat session in storage
      const session = await storage.createChatSession({
        userId,
        sessionId,
        userName,
      });

      // Initialize Gemini service for this session
      const geminiService = new GeminiService();
      geminiServices.set(sessionId, geminiService);

      // Get initial message from Bonnie
      const initialResponse = await geminiService.initializeConversation(userName);

      // Store the initial message
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

  // Send a message with image to the chat
  app.post("/api/chat/message-with-image", imageUpload.single('image'), async (req, res) => {
    try {
      const { sessionId, message } = req.body;
      const imageFile = req.file;
      
      if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required" });
      }

      if (!imageFile) {
        return res.status(400).json({ error: "Image file is required" });
      }

      // Verify session exists
      const session = await storage.getChatSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Get Gemini service for this session
      const geminiService = geminiServices.get(sessionId);
      if (!geminiService) {
        return res.status(404).json({ error: "Chat service not found" });
      }

      // Store user message (include image info)
      const userContent = message ? `${message} [Immagine caricata: ${imageFile.originalname}]` : `[Immagine caricata: ${imageFile.originalname}]`;
      await storage.addChatMessage({
        sessionId,
        role: "user",
        content: userContent,
        metadata: {
          hasImage: true,
          imagePath: imageFile.path,
          imageOriginalName: imageFile.originalname
        },
      });

      // First, analyze the skin with specialized service
      const skinAnalysis = new SkinAnalysisService();
      const analysisResult = await skinAnalysis.analyzeImage(imageFile.path);

      // Then send the analysis data to Gemini for conversation
      const analysisMessage = message ? 
        `${message}\n\nAnalisi AI della pelle: ${JSON.stringify(analysisResult)}` : 
        `Analisi AI della pelle: ${JSON.stringify(analysisResult)}`;
      
      const response = await geminiService.sendMessage(analysisMessage);

      // Store assistant response
      await storage.addChatMessage({
        sessionId,
        role: "assistant",
        content: response.content,
        metadata: {
          hasChoices: response.hasChoices,
          choices: response.choices,
          skinAnalysis: analysisResult, // Store the raw analysis data
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

  // Send a message to the chat
  app.post("/api/chat/message", async (req, res) => {
    try {
      const { sessionId, message } = req.body;
      
      if (!sessionId || !message) {
        return res.status(400).json({ error: "Session ID and message are required" });
      }

      // Verify session exists
      const session = await storage.getChatSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Get Gemini service for this session
      const geminiService = geminiServices.get(sessionId);
      if (!geminiService) {
        return res.status(404).json({ error: "Chat service not found" });
      }

      // Store user message
      await storage.addChatMessage({
        sessionId,
        role: "user",
        content: message,
        metadata: null,
      });

      // Get response from Bonnie
      const response = await geminiService.sendMessage(message);

      // Store assistant response
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

  // End chat session
  app.post("/api/chat/:sessionId/end", async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      const session = await storage.updateChatSession(sessionId, { isActive: false });
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Clean up Gemini service
      geminiServices.delete(sessionId);

      res.json({ message: "Chat session ended" });
    } catch (error) {
      console.error("Error ending chat:", error);
      res.status(500).json({ error: "Failed to end chat session" });
    }
  });

  // RAG endpoints
  
  // Upload document to knowledge base
  app.post("/api/rag/upload", upload.single('document'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const result = await ragService.addDocument(req.file.path, req.file.originalname);
      
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      
      res.json({ 
        message: result,
        filename: req.file.originalname,
        size: req.file.size
      });
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ error: "Failed to upload document" });
    }
  });

  // Get knowledge base statistics
  app.get("/api/rag/stats", async (req, res) => {
    try {
      const stats = ragService.getKnowledgeBaseStats();
      res.json(stats);
    } catch (error) {
      console.error("Error getting knowledge base stats:", error);
      res.status(500).json({ error: "Failed to get knowledge base stats" });
    }
  });

  // Search knowledge base
  app.post("/api/rag/search", async (req, res) => {
    try {
      const { query, limit = 5 } = req.body;
      
      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Query is required" });
      }

      const results = await ragService.searchSimilar(query, limit);
      res.json(results);
    } catch (error) {
      console.error("Error searching knowledge base:", error);
      res.status(500).json({ error: "Failed to search knowledge base" });
    }
  });

  // Clear knowledge base
  app.delete("/api/rag/clear", async (req, res) => {
    try {
      ragService.clearKnowledgeBase();
      res.json({ message: "Knowledge base cleared successfully" });
    } catch (error) {
      console.error("Error clearing knowledge base:", error);
      res.status(500).json({ error: "Failed to clear knowledge base" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
