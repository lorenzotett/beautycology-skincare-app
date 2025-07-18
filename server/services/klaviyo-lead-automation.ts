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
   * Extract name from conversation history
   */
  extractNameFromConversation(messages: ChatMessage[]): string {
    // Look for the first user message which usually contains the name
    const firstUserMessage = messages.find(msg => msg.role === 'user');
    if (firstUserMessage && firstUserMessage.content) {
      // If it's a simple name (no email), return it
      if (!this.extractEmailFromMessage(firstUserMessage.content)) {
        return firstUserMessage.content.trim();
      }
    }

    // Fallback to sessionId-based name extraction
    const sessionBasedName = messages.find(msg => msg.sessionId)?.sessionId;
    if (sessionBasedName) {
      return `User_${sessionBasedName.substring(0, 8)}`;
    }

    return 'Lead sconosciuto';
  }

  /**
   * Process a chat message for lead extraction
   */
  async processMessageForLeads(sessionId: string, message: string, userName: string): Promise<boolean> {
    if (!this.klaviyo) {
      console.log('⚠️ Klaviyo not configured, skipping lead processing');
      return false;
    }

    const extractedEmail = this.extractEmailFromMessage(message);
    
    if (extractedEmail) {
      console.log(`📧 EMAIL DETECTED: ${extractedEmail} for user: ${userName}`);
      
      try {
        // Get additional session data for context
        const session = await storage.getChatSession(sessionId);
        const sessionData = {
          sessionId: sessionId,
          source: 'AI-DermaSense Chat',
          captureDate: new Date().toISOString(),
          conversationDate: session?.createdAt || new Date(),
          finalButtonClicked: session?.finalButtonClicked || false
        };

        // Add to Klaviyo list
        const success = await this.klaviyo.addProfileToList(extractedEmail, userName, sessionData);
        
        if (success) {
          // Update session to mark as Klaviyo synced
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