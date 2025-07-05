import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { GeminiService } from "./services/gemini";
import { z } from "zod";

const geminiServices = new Map<string, GeminiService>();

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

  const httpServer = createServer(app);
  return httpServer;
}
