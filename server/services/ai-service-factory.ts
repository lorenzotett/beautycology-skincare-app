// Factory to create the appropriate AI service based on app configuration

import { getAppConfig, AppType } from "../config/app-config";
import { beautycologyAI, BeautycologyAIService } from "./beautycology-ai";
import { GeminiService } from "./gemini";

export interface AIService {
  sendMessage(sessionId: string, userMessage: string, imageData?: string): Promise<{
    content: string;
    hasChoices: boolean;
    choices?: string[];
  }>;
  
  getWelcomeMessage(): Promise<{
    content: string;
    hasChoices: boolean;
    choices?: string[];
  }>;
  
  clearSession(sessionId: string): void;
}

export class AIServiceFactory {
  private static dermasenseService: AIService | null = null;
  private static beautycologyService: AIService | null = null;

  static async getAIService(): Promise<AIService> {
    const config = getAppConfig();
    
    switch (config.appType) {
      case 'dermasense':
        if (!this.dermasenseService) {
          const { GeminiService } = await import('./gemini');
          this.dermasenseService = new GeminiService();
        }
        return this.dermasenseService!;
        
      case 'beautycology':
        if (!this.beautycologyService) {
          this.beautycologyService = beautycologyAI;
        }
        return this.beautycologyService!;
        
      default:
        throw new Error(`Unsupported app type: ${config.appType}`);
    }
  }

  static getCurrentAppType(): AppType {
    return getAppConfig().appType;
  }

  static getAppBranding() {
    return getAppConfig().branding;
  }

  static clearAllSessions(): void {
    if (this.dermasenseService) {
      // DermaSense service sessions are cleared via storage
      console.log("DermaSense sessions managed by storage");
    }
    
    if (this.beautycologyService) {
      // Clear Beautycology sessions (they're in-memory)
      console.log("Clearing Beautycology AI sessions");
    }
  }
}

// Export removed to avoid conflict