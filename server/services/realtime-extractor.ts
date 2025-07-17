import { storage } from "../storage";
import { ChatDataExtractor } from "./chat-data-extractor";
import { AdvancedAIExtractor } from "./advanced-ai-extractor";
import { GoogleSheetsService } from "./google-sheets";
import { KlaviyoService } from "./klaviyo";

export class RealtimeDataExtractor {
  private lastProcessedSessionId: number = 0;
  private isProcessing: boolean = false;
  private chatExtractor: ChatDataExtractor;
  private advancedAIExtractor: AdvancedAIExtractor;
  private googleSheets: GoogleSheetsService;
  private klaviyo: KlaviyoService;

  constructor() {
    this.chatExtractor = new ChatDataExtractor();
    this.advancedAIExtractor = new AdvancedAIExtractor();
    
    // Initialize Google Sheets with credentials (use same as auto-sync)
    const googleCredentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON || '{}');
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    this.googleSheets = new GoogleSheetsService(googleCredentials, spreadsheetId || '');
    
    // Initialize Klaviyo
    const klaviyoApiKey = process.env.KLAVIYO_API_KEY || '';
    const klaviyoListId = process.env.KLAVIYO_LIST_ID || '';
    this.klaviyo = new KlaviyoService(klaviyoApiKey, klaviyoListId);
    this.initializeLastProcessedId();
  }

  private async initializeLastProcessedId() {
    try {
      // Get the latest session from storage to start monitoring from there
      const sessions = await storage.getAllChatSessions();
      
      if (sessions.length > 0) {
        // Sort by creation date to get the most recent
        sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        this.lastProcessedSessionId = sessions[0].id || 0;
        console.log(`Realtime extractor initialized. Monitoring from session ID: ${this.lastProcessedSessionId}`);
      }
    } catch (error) {
      console.error('Failed to initialize last processed session ID:', error);
    }
  }

  async checkForNewChats(): Promise<{ processed: number; newSessions: string[] }> {
    if (this.isProcessing) {
      return { processed: 0, newSessions: [] };
    }

    this.isProcessing = true;
    const newSessions: string[] = [];
    let processed = 0;

    try {
      // Get all sessions and filter for new ones
      const allSessions = await storage.getAllChatSessions();
      
      // Process all unsynced sessions for debugging
      const newSessionsList = allSessions.filter(session => 
        !session.googleSheetsSynced
      ).slice(0, 10); // Limit to 10 unsynced sessions
      
      console.log(`🔍 Found ${newSessionsList.length} unsynced sessions:`, newSessionsList.map(s => `#${s.id}`));

      for (const session of newSessionsList) {
        try {
          // Get messages for this session
          const messages = await storage.getChatMessages(session.sessionId);
          if (!messages) continue;

          // Check if this session has enough messages to be worth processing
          if (messages.length < 3) {
            // Update last processed ID even for short conversations to avoid reprocessing
            this.lastProcessedSessionId = Math.max(this.lastProcessedSessionId, session.id || 0);
            continue;
          }

          // Check if conversation is complete (has email or final consultation)
          const hasEmail = this.extractEmailFromMessages(messages);
          const hasConsultation = messages.some(msg => 
            msg.content.includes('necessità e consigli specifici') || 
            msg.content.includes('routine personalizzata') ||
            msg.content.includes('skincare personalizzata')
          );
          
          // Skip incomplete conversations unless they have substantial content
          if (!hasEmail && !hasConsultation && messages.length < 5) {
            console.log(`⏭️ Skipping incomplete conversation for ${session.userId} (${messages.length} messages, no email/consultation)`);
            this.lastProcessedSessionId = Math.max(this.lastProcessedSessionId, session.id || 0);
            continue;
          }

          // Extract data using Advanced AI
          console.log(`🤖 Advanced AI extracting data for new session: ${session.userId} (ID: ${session.id})`);
          
          const aiExtractedData = await this.advancedAIExtractor.extractConversationData(messages);
          
          // Convert to sheets format - if AI extraction fails, provide minimal fallback data
          const extractedData = aiExtractedData ? 
            this.advancedAIExtractor.convertToSheetsFormat(aiExtractedData) : 
            {
              eta: 'Non specificato',
              sesso: 'Non specificato',
              email: this.extractEmailFromMessages(messages) || 'Non specificato',
              tipo_pelle: 'Non specificato',
              problemi_pelle: 'Non specificato',
              punteggio_pelle: 'Non specificato'
            };

          // Sync to Google Sheets
          const sheetsSuccess = await this.googleSheets.appendConversation(
            session.sessionId,
            session.userId,
            this.extractEmailFromMessages(messages),
            messages,
            extractedData
          );

          // Sync to Klaviyo if email found
          const email = this.extractEmailFromMessages(messages);
          if (email) {
            await this.klaviyo.addProfileToList(email, session.userId, extractedData);
          }

          if (sheetsSuccess) {
            newSessions.push(session.userId);
            processed++;
            console.log(`✅ AI extracted and synced data for ${session.userId}`);
          }

          // Update last processed ID
          this.lastProcessedSessionId = Math.max(this.lastProcessedSessionId, session.id || 0);
          
        } catch (error) {
          console.error(`Failed to process session ${session.id}:`, error);
        }
      }

    } catch (error) {
      console.error('Error checking for new chats:', error);
    } finally {
      this.isProcessing = false;
    }

    return { processed, newSessions };
  }

  private extractEmailFromMessages(messages: any[]): string | null {
    for (const message of messages) {
      if (message.role === 'user') {
        const emailMatch = message.content.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
        if (emailMatch) {
          return emailMatch[0];
        }
      }
    }
    return null;
  }

  // Manual trigger for immediate processing
  async processSession(sessionId: number): Promise<boolean> {
    try {
      const sessionDetails = await storage.getSessionDetails(sessionId);
      if (!sessionDetails) return false;

      console.log(`🤖 Manual AI extraction for session: ${sessionDetails.userId} (ID: ${sessionId})`);
      
      // Try Advanced AI extraction first
      const aiExtractedData = await this.advancedAIExtractor.extractConversationData(sessionDetails.messages);
      
      const extractedData = aiExtractedData ? 
        this.advancedAIExtractor.convertToSheetsFormat(aiExtractedData) : 
        await this.chatExtractor.extractConversationData(
          sessionDetails.messages,
          sessionDetails.userId,
          this.extractEmailFromMessages(sessionDetails.messages)
        );

      const success = await this.googleSheets.syncConversation(
        sessionId,
        sessionDetails.userId,
        this.extractEmailFromMessages(sessionDetails.messages),
        sessionDetails.messages,
        extractedData
      );

      if (success) {
        console.log(`✅ Manual AI extraction completed for ${sessionDetails.userId}`);
      }

      return success;
    } catch (error) {
      console.error(`Failed to manually process session ${sessionId}:`, error);
      return false;
    }
  }

  getCurrentStatus() {
    return {
      lastProcessedSessionId: this.lastProcessedSessionId,
      isProcessing: this.isProcessing
    };
  }
}