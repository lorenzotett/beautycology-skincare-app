import { KlaviyoService } from './klaviyo';
import { storage } from '../storage';
import { ChatMessage } from '@shared/schema';
import { AdvancedAIExtractor } from './advanced-ai-extractor';

export class KlaviyoLeadAutomation {
  private klaviyo: KlaviyoService | null = null;
  private aiExtractor: AdvancedAIExtractor;

  constructor() {
    const apiKey = process.env.KLAVIYO_API_KEY;
    const listId = process.env.KLAVIYO_LIST_ID;

    if (apiKey && listId) {
      this.klaviyo = new KlaviyoService(apiKey, listId);
      console.log('✅ Klaviyo Lead Automation initialized successfully');
    } else {
      console.log('⚠️ Klaviyo Lead Automation disabled - missing credentials');
    }

    // Initialize AI extractor for intelligent name/email extraction
    this.aiExtractor = new AdvancedAIExtractor();
  }

  /**
   * Extract email from message content using improved regex patterns
   */
  extractEmailFromMessage(message: string): string | null {
    // Enhanced email regex that handles more edge cases
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const matches = message.match(emailRegex);
    
    if (matches && matches.length > 0) {
      // Return the first valid email found
      return matches[0].toLowerCase().trim();
    }
    
    return null;
  }

  /**
   * Extract name and email using AI (same as Google Sheets but focused on leads)
   */
  async extractLeadDataWithAI(messages: ChatMessage[]): Promise<{ name: string; email: string | null }> {
    try {
      // Use the same AI extractor as Google Sheets
      const extractedData = await this.aiExtractor.extractConversationData(messages);
      
      if (extractedData && extractedData.informazioni_base) {
        const aiEmail = extractedData.informazioni_base.email;
        
        // Get name from session or first user message
        const session = messages.find(msg => msg.sessionId);
        const sessionData = session ? await storage.getChatSession(session.sessionId) : null;
        const aiName = sessionData?.userName || 'Lead AI-DermaSense';
        
        return {
          name: aiName,
          email: aiEmail
        };
      }
    } catch (error) {
      console.warn('AI extraction failed for lead data, falling back to regex:', error);
    }
    
    // Fallback to regex extraction if AI fails
    return this.extractLeadDataFallback(messages);
  }

  /**
   * Fallback method for name/email extraction without AI
   */
  private extractLeadDataFallback(messages: ChatMessage[]): { name: string; email: string | null } {
    // Look for the first user message which usually contains the name
    const firstUserMessage = messages.find(msg => msg.role === 'user');
    let name = 'Lead sconosciuto';
    let email = null;

    if (firstUserMessage && firstUserMessage.content) {
      // Check if it contains an email
      email = this.extractEmailFromMessage(firstUserMessage.content);
      
      // If it's a simple name (no email), use it as name
      if (!email) {
        name = firstUserMessage.content.trim();
      }
    }

    // Search for email in all messages
    if (!email) {
      for (const message of messages) {
        const foundEmail = this.extractEmailFromMessage(message.content);
        if (foundEmail) {
          email = foundEmail;
          break;
        }
      }
    }

    // Get name from session if available
    const session = messages.find(msg => msg.sessionId);
    if (session) {
      const sessionBasedName = `User_${session.sessionId.substring(0, 8)}`;
      if (name === 'Lead sconosciuto') {
        name = sessionBasedName;
      }
    }

    return { name, email };
  }

  /**
   * Process a conversation for lead extraction using AI
   */
  async processConversationForLeads(sessionId: string): Promise<boolean> {
    if (!this.klaviyo) {
      console.log('⚠️ Klaviyo not configured, skipping lead processing');
      return false;
    }

    try {
      // First, check the session brand to filter out dermasense conversations
      const session = await storage.getChatSession(sessionId);
      if (!session) {
        console.log(`⚠️ Session ${sessionId} not found, skipping Klaviyo lead processing`);
        return false;
      }
      
      // Only process beautycology leads, prevent dermasense data from being sent to Klaviyo
      if (session.brand === 'dermasense') {
        console.log(`🚫 Skipping Klaviyo lead processing for dermasense conversation ${sessionId}`);
        return true; // Return true to avoid retries, but don't actually process
      }
      
      console.log(`✅ Proceeding with Klaviyo lead processing for ${session.brand} conversation ${sessionId}`);
      
      // Get all messages for the conversation
      const messages = await storage.getChatMessages(sessionId);
      if (!messages || messages.length === 0) {
        return false;
      }

      // Use AI to extract lead data (name and email)
      const leadData = await this.extractLeadDataWithAI(messages);
      
      if (leadData.email) {
        console.log(`📧 LEAD DETECTED: ${leadData.name} (${leadData.email})`);
        const sessionData = {
          sessionId: sessionId,
          source: `${session.brand === 'beautycology' ? 'Beautycology AI' : 'AI-DermaSense'} Chat`,
          captureDate: new Date().toISOString(),
          conversationDate: session.createdAt || new Date(),
          finalButtonClicked: session.finalButtonClicked || false,
          extractionMethod: 'AI-Enhanced'
        };

        // Add to Klaviyo list
        const success = await this.klaviyo.addProfileToList(leadData.email, leadData.name, sessionData);
        
        if (success) {
          // Update session to mark as Klaviyo synced
          await storage.updateChatSession(sessionId, { 
            klaviyoSynced: true,
            userEmail: leadData.email 
          });
          
          console.log(`✅ LEAD CAPTURED: ${leadData.name} (${leadData.email}) added to Klaviyo list`);
          return true;
        } else {
          console.error(`❌ Failed to add ${leadData.email} to Klaviyo list`);
          return false;
        }
      }

      return false;
    } catch (error) {
      console.error('❌ Error processing conversation for Klaviyo:', error);
      return false;
    }
  }

  /**
   * Process a single chat message for immediate lead extraction (quick method)
   */
  async processMessageForLeads(sessionId: string, message: string, userName: string): Promise<boolean> {
    if (!this.klaviyo) {
      return false;
    }

    const extractedEmail = this.extractEmailFromMessage(message);
    
    if (extractedEmail) {
      console.log(`📧 EMAIL DETECTED: ${extractedEmail} for user: ${userName}`);
      
      try {
        const session = await storage.getChatSession(sessionId);
        if (!session) {
          console.log(`⚠️ Session ${sessionId} not found, skipping Klaviyo lead processing`);
          return false;
        }
        
        // Only process beautycology leads, prevent dermasense data from being sent to Klaviyo
        if (session.brand === 'dermasense') {
          console.log(`🚫 Skipping Klaviyo lead processing for dermasense message in session ${sessionId}`);
          return true; // Return true to avoid retries, but don't actually process
        }
        
        console.log(`✅ Proceeding with Klaviyo lead processing for ${session.brand} message in session ${sessionId}`);
        
        const sessionData = {
          sessionId: sessionId,
          source: `${session.brand === 'beautycology' ? 'Beautycology AI' : 'AI-DermaSense'} Chat`,
          captureDate: new Date().toISOString(),
          conversationDate: session.createdAt || new Date(),
          finalButtonClicked: session.finalButtonClicked || false,
          extractionMethod: 'Real-time'
        };

        const success = await this.klaviyo.addProfileToList(extractedEmail, userName, sessionData);
        
        if (success) {
          await storage.updateChatSession(sessionId, { 
            klaviyoSynced: true,
            userEmail: extractedEmail 
          });
          
          console.log(`✅ LEAD CAPTURED: ${userName} (${extractedEmail}) added to Klaviyo list`);
          return true;
        } else {
          console.error(`❌ Failed to add ${extractedEmail} to Klaviyo list`);
          return false;
        }
      } catch (error) {
        console.error('❌ Error processing lead for Klaviyo:', error);
        return false;
      }
    }

    return false;
  }

  /**
   * Batch process unsynced conversations for lead recovery
   */
  async batchProcessUnsyncedLeads(): Promise<{ processed: number; successful: number }> {
    if (!this.klaviyo) {
      return { processed: 0, successful: 0 };
    }

    try {
      console.log('🔄 Starting batch lead recovery process...');
      
      // Get all sessions that have email but aren't synced to Klaviyo
      const allSessions = await storage.getAllChatSessions();
      const unsyncedSessions = allSessions.filter(session => 
        session.userEmail && !session.klaviyoSynced
      );

      console.log(`📊 Found ${unsyncedSessions.length} unsynced sessions with emails`);

      let processed = 0;
      let successful = 0;

      for (const session of unsyncedSessions) {
        try {
          processed++;
          
          const sessionData = {
            sessionId: session.sessionId,
            source: 'AI-DermaSense Chat (Batch Recovery)',
            captureDate: new Date().toISOString(),
            conversationDate: session.createdAt,
            finalButtonClicked: session.finalButtonClicked || false
          };

          const success = await this.klaviyo.addProfileToList(
            session.userEmail!,
            session.userName,
            sessionData
          );

          if (success) {
            await storage.updateChatSession(session.sessionId, { klaviyoSynced: true });
            successful++;
            console.log(`✅ Batch recovered: ${session.userName} (${session.userEmail})`);
          } else {
            console.warn(`⚠️ Failed to batch recover: ${session.userName} (${session.userEmail})`);
          }
        } catch (error) {
          console.error(`❌ Error in batch recovery for session ${session.id}:`, error);
        }
      }

      console.log(`🎯 Batch lead recovery completed: ${successful}/${processed} successful`);
      return { processed, successful };
    } catch (error) {
      console.error('❌ Error in batch lead recovery:', error);
      return { processed: 0, successful: 0 };
    }
  }

  /**
   * Test the Klaviyo integration
   */
  async testKlaviyoIntegration(): Promise<{ success: boolean; message: string }> {
    if (!this.klaviyo) {
      return { success: false, message: 'Klaviyo not configured' };
    }

    try {
      const testEmail = `test_${Date.now()}@example.com`;
      const testName = 'Test Lead';
      
      const success = await this.klaviyo.addProfileToList(testEmail, testName, {
        source: 'Integration Test',
        testMode: true,
        timestamp: new Date().toISOString()
      });

      if (success) {
        return { 
          success: true, 
          message: `Test successful - ${testEmail} added to Klaviyo list` 
        };
      } else {
        return { 
          success: false, 
          message: 'Test failed - unable to add profile to Klaviyo list' 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        message: `Test failed with error: ${error.message}` 
      };
    }
  }

  /**
   * Get current automation status
   */
  getStatus(): { enabled: boolean; listId: string | null; apiConfigured: boolean } {
    return {
      enabled: this.klaviyo !== null,
      listId: process.env.KLAVIYO_LIST_ID || null,
      apiConfigured: !!(process.env.KLAVIYO_API_KEY && process.env.KLAVIYO_LIST_ID)
    };
  }
}