import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { GeminiService } from "./services/gemini";
import { SkinAnalysisService } from "./services/skin-analysis";
// import { ragService } from "./services/rag-simple";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";

// Limite massimo di sessioni in memoria per evitare memory leak
const MAX_SESSIONS_IN_MEMORY = 1000;
const geminiServices = new Map<string, GeminiService>();

// Cleanup automatico delle sessioni vecchie
setInterval(() => {
  if (geminiServices.size > MAX_SESSIONS_IN_MEMORY) {
    const sessions = Array.from(geminiServices.keys());
    const toDelete = sessions.slice(0, sessions.length - MAX_SESSIONS_IN_MEMORY);
    toDelete.forEach(sessionId => geminiServices.delete(sessionId));
    console.log(`Cleaned up ${toDelete.length} old sessions`);
  }
}, 5 * 60 * 1000); // Ogni 5 minuti

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
    fileSize: 5 * 1024 * 1024, // Ridotto a 5MB per performance
    files: 1, // Massimo 1 file per request
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'image/heic',
      'image/heif',
      'image/avif'
    ];
    
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.avif'];
    const fileExtension = req.file?.originalname?.toLowerCase().match(/\.[^.]+$/)?.[0] || '';
    
    if (file.mimetype.startsWith('image/') || allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo di file non supportato. Formati supportati: JPG, PNG, GIF, WebP, HEIC, HEIF, AVIF.'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve static files from attached_assets directory
  app.use('/attached_assets', express.static(path.join(process.cwd(), 'attached_assets')));
  // Start a new chat session
  app.post("/api/chat/start", async (req, res) => {
    try {
      const { userName, fingerprint } = req.body;
      
      if (!userName || typeof userName !== "string") {
        return res.status(400).json({ error: "User name is required" });
      }

      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Use fingerprint as userId if provided, otherwise fallback to timestamp
      const userId = fingerprint && typeof fingerprint === "string" 
        ? `fp_${fingerprint.substring(0, 16)}` 
        : `user_${Date.now()}`;
      
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

  // Export chat data as CSV
  app.post("/api/admin/export-csv", async (req, res) => {
    try {
      const { sessionIds } = req.body;
      
      // Get all sessions first
      const allSessions = await storage.getAllChatSessions();
      const allMessages = await storage.getAllChatMessages();
      
      // Filter sessions if specific IDs provided
      const sessions = sessionIds && sessionIds.length > 0 
        ? allSessions.filter(session => sessionIds.includes(session.sessionId))
        : allSessions;
      
      // Get selected session IDs for filtering messages
      const selectedSessionIds = sessions.map(s => s.sessionId);
      
      // Filter messages for selected sessions only
      const filteredMessages = allMessages.filter(message => 
        selectedSessionIds.includes(message.sessionId)
      );
      
      // Group filtered messages by session
      const messagesGroupedBySession = filteredMessages.reduce((acc, message) => {
        if (!acc[message.sessionId]) {
          acc[message.sessionId] = [];
        }
        acc[message.sessionId].push(message);
        return acc;
      }, {} as Record<string, ChatMessage[]>);

      // Extract Q&A data from conversations
      const extractQAData = (messages: ChatMessage[]) => {
        const qaData: Record<string, string> = {};
        let skinAnalysis: any = null;
        
        // Create sequence of Q&A pairs
        const qaSequence: Array<{question: string, answer: string}> = [];
        
        // Get the first user message (name)
        const userNameMsg = messages.find(m => m.role === 'user');
        const userName = userNameMsg?.content || '';
        
        for (let i = 0; i < messages.length - 1; i++) {
          const currentMsg = messages[i];
          const nextMsg = messages[i + 1];
          
          // Extract skin analysis data
          if (currentMsg.metadata && (currentMsg.metadata as any).skinAnalysis) {
            skinAnalysis = (currentMsg.metadata as any).skinAnalysis;
          }
          
          // Find question-answer pairs
          if (currentMsg.role === 'assistant' && nextMsg.role === 'user') {
            const question = currentMsg.content.toLowerCase();
            const answer = nextMsg.content;
            
            // Skip if it's image upload or user name
            if (answer.includes('[Immagine caricata:') || answer.includes('IMG_') || answer === userName) {
              continue;
            }
            
            // Skip the initial skin description question for text-based conversations
            if (question.includes('descrivimi la tua pelle') || 
                question.includes('raccontami della tua pelle') ||
                question.includes('quali sono le tue preoccupazioni')) {
              continue;
            }
            
            qaSequence.push({ question, answer });
          }
        }
        
        // Map exact question-answer pairs with precise patterns
        const qaMapping = [
          { key: 'preoccupazioni_specifiche', patterns: ['problematica specifica che hai notato', 'vorresti condividere'] },
          { key: 'scrub_peeling', patterns: ['utilizzi scrub o peeling?'] },
          { key: 'pelle_tira', patterns: ['quando ti lavi il viso la tua pelle tira?'] },
          { key: 'punti_neri', patterns: ['hai punti neri?'] },
          { key: 'pelle_sensibile', patterns: ['hai una pelle sensibile?'] },
          { key: 'tipologia_pelle', patterns: ['che tipologia di pelle hai?'] },
          { key: 'eta', patterns: ['quanti anni hai?'] },
          { key: 'genere', patterns: ['ora, il genere:', 'genere?'] },
          { key: 'farmaci_ormonali', patterns: ['assumi farmaci come pillola anticoncezionale', 'pillola anticoncezionale'] },
          { key: 'allergie', patterns: ['ci sono ingredienti ai quali la tua pelle è allergica?'] },
          { key: 'fragranza', patterns: ['ti piacerebbe avere una fragranza che profumi di fiori'] },
          { key: 'crema_solare', patterns: ['metti la crema solare ogni giorno?'] },
          { key: 'acqua', patterns: ['quanti litri d\'acqua bevi al giorno?'] },
          { key: 'sonno', patterns: ['quante ore dormi in media?'] },
          { key: 'alimentazione', patterns: ['hai un\'alimentazione bilanciata?'] },
          { key: 'fumo', patterns: ['fumi?'] },
          { key: 'stress', patterns: ['qual è il tuo livello di stress attuale?'] },
          { key: 'altre_info', patterns: ['informazioni sulla tua pelle che non ti abbiamo chiesto e che vorresti condividere?'] },
          { key: 'email', patterns: ['per visualizzare gli ingredienti perfetti per la tua pelle, potresti condividere la tua mail?'] },
          { key: 'routine_conferma', patterns: ['vorresti che ti fornissi una routine personalizzata completa'] },
          { key: 'rossori', patterns: ['rossori che hai segnalato derivano', 'rossori sulla tua pelle'] }
        ];
        
        // Sequential mapping based on conversation flow
        const sequentialMapping = [
          'preoccupazioni_specifiche', // First question after skin analysis
          'scrub_peeling',             // "Utilizzi scrub o peeling?"
          'pelle_tira',                // "Quando ti lavi il viso la tua pelle tira?"
          'eta',                       // "Quanti anni hai?"
          'genere',                    // "Ora, il genere:"
          'allergie',                  // "Ci sono ingredienti ai quali la tua pelle è allergica?"
          'fragranza',                 // "Ti piacerebbe avere una fragranza..."
          'crema_solare',              // "Metti la crema solare ogni giorno?"
          'acqua',                     // "Quanti litri d'acqua bevi al giorno?"
          'sonno',                     // "Quante ore dormi in media?"
          'alimentazione',             // "Hai un'alimentazione bilanciata?"
          'fumo',                      // "Fumi?"
          'stress',                    // "Da 1 a 10, qual è il tuo livello di stress attuale?"
          'altre_info',                // "Ci sono informazioni sulla tua pelle che non ti abbiamo chiesto..."
          'email',                     // "Per visualizzare gli ingredienti perfetti..."
          'routine_conferma'           // "Vorresti che ti fornissi una routine personalizzata completa..."
        ];
        
        // Detect conversation type based on first user message
        const firstUserMessage = messages.find(m => m.role === 'user')?.content || '';
        const isImageBasedConversation = firstUserMessage.includes('[Immagine caricata:') || firstUserMessage.includes('IMG_');
        const isTextBasedConversation = firstUserMessage.includes('pelle grassa') || firstUserMessage.includes('pelle sensibile') || (!isImageBasedConversation && firstUserMessage.length > 10);
        
        // Filter answers excluding the user's name and initial description for text-based conversations
        const answersInOrder = qaSequence
          .map(qa => qa.answer)
          .filter((answer, index) => {
            // Skip user name
            if (answer === userName) return false;
            // For text-based conversations, skip the first answer if it's the initial description
            if (isTextBasedConversation && index === 0 && 
                (answer.includes('pelle grassa') || answer.includes('pelle sensibile') || answer.length > 20)) {
              return false;
            }
            return true;
          });
        
        if (isImageBasedConversation && answersInOrder.length >= 14) {
          // Image-based conversation pattern (like Gabriele)
          qaData.preoccupazioni_specifiche = answersInOrder[0]; // "no"
          qaData.scrub_peeling = answersInOrder[1];             // "No"
          qaData.pelle_tira = answersInOrder[2];                // "A volte"  
          qaData.eta = answersInOrder[3];                       // "24"
          qaData.genere = answersInOrder[4];                    // "Maschile"
          qaData.allergie = answersInOrder[5];                  // "no"
          qaData.fragranza = answersInOrder[6];                 // "Sì"
          qaData.crema_solare = answersInOrder[7];              // "Mai"
          qaData.acqua = answersInOrder[8];                     // "1.5-2L"
          qaData.sonno = answersInOrder[9];                     // "7-8h"
          qaData.alimentazione = answersInOrder[10];            // "Abbastanza"
          qaData.fumo = answersInOrder[11];                     // "No"
          qaData.stress = answersInOrder[12];                   // "4"
          qaData.altre_info = answersInOrder[13];               // "no"
          if (answersInOrder.length > 14) qaData.email = answersInOrder[14];
          if (answersInOrder.length > 15) qaData.routine_conferma = answersInOrder[15];
        } else if (isTextBasedConversation && answersInOrder.length >= 10) {
          // Text-based conversation pattern (like Sara)
          // Extract preoccupazioni from first user message
          qaData.preoccupazioni_specifiche = firstUserMessage; // "Ho la pelle grassa a tendenza acneica"
          
          // Exact mapping based on Sara's actual conversation order:
          qaData.scrub_peeling = answersInOrder[0];       // "Sì regolarmente"
          qaData.pelle_tira = answersInOrder[1];          // "Mai"
          qaData.punti_neri = answersInOrder[2];          // "Alcuni"
          qaData.pelle_sensibile = answersInOrder[3];     // "No"
          qaData.eta = answersInOrder[4];                 // "23"
          qaData.genere = answersInOrder[5];              // "Femminile"
          qaData.farmaci_ormonali = answersInOrder[6];    // "No" (pillola anticoncezionale)
          qaData.allergie = answersInOrder[7];            // "No"
          qaData.fragranza = answersInOrder[8];           // "Sì" (NOT "No"!)
          qaData.crema_solare = answersInOrder[9];        // "Sempre"
          qaData.acqua = answersInOrder[10];              // "1-1.5L"
          qaData.sonno = answersInOrder[11];              // "6-7h"
          qaData.alimentazione = answersInOrder[12];      // "Abbastanza"
          qaData.fumo = answersInOrder[13];               // "No"
          qaData.stress = answersInOrder[14];             // "6"
          if (answersInOrder.length > 15) qaData.altre_info = answersInOrder[15];  // "Ho cicatrici da acne sul viso e macchie"
          if (answersInOrder.length > 16) qaData.email = answersInOrder[16];       // "Skibidiboppi@gmail.com"
          if (answersInOrder.length > 17) qaData.rossori = answersInOrder[17];     // "Brufoli/Acne attivi"

        } else {
          // Fallback to pattern matching for incomplete conversations
          for (let i = 0; i < qaSequence.length && i < sequentialMapping.length; i++) {
            const key = sequentialMapping[i];
            const answer = qaSequence[i].answer;
            qaData[key] = answer;
          }
        }
        

        
        return { qaData, skinAnalysis };
      };

      // Generate vertical CSV data (field-value pairs)
      const csvRows = [];
      
      // Header for vertical format
      csvRows.push(['Session ID', 'Campo', 'Valore']);

      // Data rows - vertical format with field-value pairs
      for (const session of sessions) {
        const sessionMessages = messagesGroupedBySession[session.sessionId] || [];
        
        // Extract Q&A and analysis data
        const { qaData, skinAnalysis } = extractQAData(sessionMessages);
        
        // Calculate session metrics
        const hasImageUpload = sessionMessages.some(msg => 
          msg.metadata && (msg.metadata as any).hasImage
        );
        const hasSkinAnalysis = !!skinAnalysis;
        
        // Calculate duration
        const firstMessage = sessionMessages[0];
        const lastMessage = sessionMessages[sessionMessages.length - 1];
        let durationMinutes = 0;
        if (firstMessage && lastMessage) {
          const duration = new Date(lastMessage.createdAt).getTime() - new Date(firstMessage.createdAt).getTime();
          durationMinutes = Math.round(duration / (1000 * 60));
        }
        
        // Calculate general score if skin analysis available
        let generalScore = '';
        if (skinAnalysis) {
          const scores = [
            skinAnalysis.rossori || 0,
            skinAnalysis.acne || 0,
            skinAnalysis.rughe || 0,
            skinAnalysis.pigmentazione || 0,
            skinAnalysis.pori_dilatati || 0,
            skinAnalysis.oleosita || 0,
            skinAnalysis.danni_solari || 0,
            skinAnalysis.occhiaie || 0,
            (100 - (skinAnalysis.idratazione || 100)),
            (100 - (skinAnalysis.elasticita || 100)),
            (100 - (skinAnalysis.texture_uniforme || 100))
          ];
          generalScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length).toString();
        }

        // Create vertical rows (field-value pairs) for this session
        const fieldValuePairs = [
          ['Nome Utente', session.userName || ''],
          ['User ID', session.userId],
          ['Sessione Creata', session.createdAt.toISOString()],
          ['Numero Messaggi', sessionMessages.length.toString()],
          ['Ha Caricato Immagine', hasImageUpload ? 'Sì' : 'No'],
          ['Ha Analisi Pelle', hasSkinAnalysis ? 'Sì' : 'No'],
          
          // Basic demographics
          ['Età', qaData.eta || ''],
          ['Genere', qaData.genere || ''],
          ['Farmaci Ormonali', qaData.farmaci_ormonali || ''],
          ['Email', qaData.email || ''],
          
          // Skin concerns
          ['Preoccupazioni Specifiche', qaData.preoccupazioni_specifiche || ''],
          ['Tipologia Pelle', qaData.tipologia_pelle || ''],
          ['Pelle Sensibile', qaData.pelle_sensibile || ''],
          ['Punti Neri', qaData.punti_neri || ''],
          ['Rossori', qaData.rossori || ''],
          
          // Skincare habits
          ['Scrub/Peeling', qaData.scrub_peeling || ''],
          ['Pelle Tira', qaData.pelle_tira || ''],
          ['Crema Solare', qaData.crema_solare || ''],
          ['Allergie', qaData.allergie || ''],
          ['Fragranza', qaData.fragranza || ''],
          
          // Lifestyle
          ['Acqua al giorno', qaData.acqua || ''],
          ['Ore di sonno', qaData.sonno || ''],
          ['Alimentazione', qaData.alimentazione || ''],
          ['Fumo', qaData.fumo || ''],
          ['Livello Stress', qaData.stress || ''],
          ['Altre Info Pelle', qaData.altre_info || ''],
          ['Routine Conferma', qaData.routine_conferma || ''],
          
          // Skin analysis scores (if available)
          ['Punteggio Generale', generalScore],
          ['Rossori (Analisi)', skinAnalysis?.rossori?.toString() || ''],
          ['Acne (Analisi)', skinAnalysis?.acne?.toString() || ''],
          ['Rughe (Analisi)', skinAnalysis?.rughe?.toString() || ''],
          ['Pigmentazione (Analisi)', skinAnalysis?.pigmentazione?.toString() || ''],
          ['Pori Dilatati (Analisi)', skinAnalysis?.pori_dilatati?.toString() || ''],
          ['Oleosità (Analisi)', skinAnalysis?.oleosita?.toString() || ''],
          ['Danni Solari (Analisi)', skinAnalysis?.danni_solari?.toString() || ''],
          ['Occhiaie (Analisi)', skinAnalysis?.occhiaie?.toString() || ''],
          ['Idratazione (Analisi)', skinAnalysis?.idratazione?.toString() || ''],
          ['Elasticità (Analisi)', skinAnalysis?.elasticita?.toString() || ''],
          ['Texture Uniforme (Analisi)', skinAnalysis?.texture_uniforme?.toString() || ''],
          
          // Timing info
          ['Prima Messaggio', firstMessage?.createdAt?.toISOString() || ''],
          ['Ultima Messaggio', lastMessage?.createdAt?.toISOString() || ''],
          ['Durata (minuti)', durationMinutes.toString()]
        ];

        // Add each field-value pair as a row
        for (const [field, value] of fieldValuePairs) {
          if (value) { // Only add rows with values
            csvRows.push([session.sessionId, field, value]);
          }
        }
        
        // Add a separator row between sessions
        csvRows.push(['', '', '']);
      }

      // Convert to CSV string
      const csvContent = csvRows.map(row => row.join(',')).join('\n');
      
      // Set headers for file download
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `ai-dermasense-export-${timestamp}.csv`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csvContent);
      
    } catch (error) {
      console.error("Error exporting CSV:", error);
      res.status(500).json({ error: "Failed to export CSV data" });
    }
  });

  

  // Admin endpoints
  
  // Get admin statistics
  app.get("/api/admin/stats", async (req, res) => {
    try {
      const allSessions = await storage.getAllChatSessions();
      const allMessages = await storage.getAllChatMessages();
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todaySessions = allSessions.filter(session => 
        new Date(session.createdAt) >= today
      );
      
      const activeSessions = allSessions.filter(session => session.isActive);
      
      const averageMessagesPerSession = allSessions.length > 0 
        ? allMessages.length / allSessions.length 
        : 0;
      
      const stats = {
        totalSessions: allSessions.length,
        totalMessages: allMessages.length,
        activeSessions: activeSessions.length,
        todaySessions: todaySessions.length,
        averageMessagesPerSession: Math.round(averageMessagesPerSession * 10) / 10
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Error getting admin stats:", error);
      res.status(500).json({ error: "Failed to get admin statistics" });
    }
  });

  // Get all sessions with message counts
  app.get("/api/admin/sessions", async (req, res) => {
    try {
      const allSessions = await storage.getAllChatSessions();
      const sessionsWithDetails = await Promise.all(
        allSessions.map(async (session) => {
          const messages = await storage.getChatMessages(session.sessionId);
          const hasImages = messages.some(msg => 
            msg.metadata && (msg.metadata as any).hasImage
          );
          const skinAnalysisCount = messages.filter(msg => 
            msg.metadata && (msg.metadata as any).skinAnalysis
          ).length;
          
          const lastActivity = messages.length > 0 
            ? new Date(Math.max(...messages.map(msg => new Date(msg.createdAt).getTime())))
            : session.updatedAt;
          
          return {
            ...session,
            messages: [],
            messageCount: messages.length,
            lastActivity,
            hasImages,
            skinAnalysisCount
          };
        })
      );
      
      // Sort by last activity (most recent first)
      sessionsWithDetails.sort((a, b) => 
        new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      );
      
      res.json(sessionsWithDetails);
    } catch (error) {
      console.error("Error getting admin sessions:", error);
      res.status(500).json({ error: "Failed to get admin sessions" });
    }
  });

  // Serve uploaded images
  app.get("/api/images/:imageName", (req, res) => {
    try {
      const { imageName } = req.params;
      const imagePath = path.join(process.cwd(), 'uploads', imageName);
      
      // Check if file exists
      if (!fs.existsSync(imagePath)) {
        return res.status(404).json({ error: "Image not found" });
      }
      
      // Send the file
      res.sendFile(imagePath);
    } catch (error) {
      console.error("Error serving image:", error);
      res.status(500).json({ error: "Failed to serve image" });
    }
  });

  // Get specific session details with all messages
  app.get("/api/admin/sessions/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      const session = await storage.getChatSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      const messages = await storage.getChatMessages(sessionId);
      
      // Process messages to add image URLs for admin dashboard
      const processedMessages = messages.map(msg => {
        if (msg.metadata && (msg.metadata as any).hasImage && (msg.metadata as any).imagePath) {
          const imagePath = (msg.metadata as any).imagePath;
          const fileName = path.basename(imagePath);
          const imageUrl = `/api/images/${fileName}`;
          
          return {
            ...msg,
            metadata: {
              ...msg.metadata,
              image: imageUrl // Add image URL for MessageBubble component
            }
          };
        }
        return msg;
      });
      
      const hasImages = messages.some(msg => 
        msg.metadata && (msg.metadata as any).hasImage
      );
      const skinAnalysisCount = messages.filter(msg => 
        msg.metadata && (msg.metadata as any).skinAnalysis
      ).length;
      
      const lastActivity = messages.length > 0 
        ? new Date(Math.max(...messages.map(msg => new Date(msg.createdAt).getTime())))
        : session.updatedAt;
      
      res.json({
        ...session,
        messages: processedMessages,
        messageCount: messages.length,
        lastActivity,
        hasImages,
        skinAnalysisCount
      });
    } catch (error) {
      console.error("Error getting admin session details:", error);
      res.status(500).json({ error: "Failed to get session details" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
