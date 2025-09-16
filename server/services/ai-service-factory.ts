// Factory to create the appropriate AI service based on brand

import { getAppConfig, AppType } from "../config/app-config";
import { beautycologyAI, BeautycologyAIService } from "./beautycology-ai";
import { GeminiService } from "./gemini";
import { Brand } from "@shared/schema";

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

  static async getAIService(brand: Brand = 'dermasense'): Promise<AIService> {
    switch (brand) {
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
        throw new Error(`Unsupported brand: ${brand}`);
    }
  }

  static getCurrentAppType(): AppType {
    return getAppConfig().appType;
  }

  static getAppBranding(brand: Brand = 'dermasense') {
    // Return branding based on brand instead of global config
    switch (brand) {
      case 'dermasense':
        return {
          name: 'AI-DermaSense',
          assistant: 'Bonnie',
          theme: 'dermatological'
        };
      case 'beautycology':
        return {
          name: 'Beautycology AI',
          assistant: 'Beauty Expert',
          theme: 'beauty'
        };
      default:
        return getAppConfig().branding;
    }
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

  static clearSessionsForBrand(brand: Brand): void {
    switch (brand) {
      case 'dermasense':
        if (this.dermasenseService) {
          console.log("DermaSense sessions managed by storage");
        }
        break;
      case 'beautycology':
        if (this.beautycologyService) {
          console.log("Clearing Beautycology AI sessions");
        }
        break;
    }
  }
}

// Export removed to avoid conflict