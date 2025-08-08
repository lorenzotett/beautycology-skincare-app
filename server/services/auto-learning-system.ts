
import { GoogleGenAI } from '@google/genai';
import { ChatMessage } from '../../shared/schema';
import { ragService } from './rag-simple';
import fs from 'fs/promises';
import path from 'path';

interface LearningInsight {
  id: string;
  topic: string;
  pattern: string;
  frequency: number;
  confidence: number;
  examples: string[];
  suggestedKnowledge: string;
  validationStatus: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}

interface ConversationAnalysis {
  sessionId: string;
  userSatisfaction: 'high' | 'medium' | 'low';
  completionRate: number;
  commonQuestions: string[];
  unusualRequests: string[];
  knowledgeGaps: string[];
}

export class AutoLearningSystem {
  private ai: GoogleGenAI;
  private insights: LearningInsight[] = [];
  private learningThreshold = 3; // Minimum occurrences to consider a pattern
  private confidenceThreshold = 0.7; // Minimum confidence to auto-apply

  constructor() {
    this.ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY || ""
    });
    this.loadExistingInsights();
  }

  async analyzeConversations(conversations: Array<{
    sessionId: string;
    messages: ChatMessage[];
    userData: any;
  }>): Promise<ConversationAnalysis[]> {
    const analyses: ConversationAnalysis[] = [];

    for (const conv of conversations) {
      const analysis = await this.analyzeConversation(conv);
      analyses.push(analysis);
    }

    // Identify patterns across all conversations
    await this.identifyLearningPatterns(analyses);
    
    return analyses;
  }

  private async analyzeConversation(conversation: {
    sessionId: string;
    messages: ChatMessage[];
    userData: any;
  }): Promise<ConversationAnalysis> {
    const { sessionId, messages } = conversation;
    
    try {
      const prompt = `
Analizza questa conversazione di consulenza dermatologica e identifica:

1. SODDISFAZIONE UTENTE (high/medium/low):
   - L'utente ha completato la conversazione?
   - Ha fatto domande ripetute o mostrato confusione?
   - Ha accettato i consigli finali?

2. DOMANDE COMUNI:
   - Quali domande ha fatto l'utente?
   - Ci sono pattern nelle richieste?

3. RICHIESTE INUSUALI:
   - L'utente ha chiesto informazioni non standard?
   - Ci sono domande a cui l'AI ha risposto in modo generico?

4. LACUNE NELLA KNOWLEDGE BASE:
   - Ci sono argomenti dove l'AI sembra incerta?
   - L'utente ha menzionato prodotti/ingredienti non riconosciuti?

CONVERSAZIONE:
${JSON.stringify(messages.map(m => ({ role: m.role, content: m.content })), null, 2)}

Rispondi in formato JSON:
{
  "userSatisfaction": "high|medium|low",
  "completionRate": 0-100,
  "commonQuestions": ["domanda1", "domanda2"],
  "unusualRequests": ["richiesta1", "richiesta2"],
  "knowledgeGaps": ["gap1", "gap2"],
  "reasoning": "spiegazione dell'analisi"
}`;

      const response = await this.ai.getGenerativeModel({ 
        model: "gemini-2.5-flash" 
      }).generateContent(prompt);

      const result = response.response.text();
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const analysisData = JSON.parse(jsonMatch[0]);
        return {
          sessionId,
          userSatisfaction: analysisData.userSatisfaction || 'medium',
          completionRate: analysisData.completionRate || 50,
          commonQuestions: analysisData.commonQuestions || [],
          unusualRequests: analysisData.unusualRequests || [],
          knowledgeGaps: analysisData.knowledgeGaps || []
        };
      }
    } catch (error) {
      console.error('Error analyzing conversation:', error);
    }

    // Fallback analysis
    return {
      sessionId,
      userSatisfaction: 'medium',
      completionRate: messages.length > 10 ? 80 : 40,
      commonQuestions: [],
      unusualRequests: [],
      knowledgeGaps: []
    };
  }

  private async identifyLearningPatterns(analyses: ConversationAnalysis[]): Promise<void> {
    // Aggregate common questions
    const questionFrequency: { [key: string]: number } = {};
    const knowledgeGaps: { [key: string]: number } = {};
    
    analyses.forEach(analysis => {
      analysis.commonQuestions.forEach(q => {
        questionFrequency[q] = (questionFrequency[q] || 0) + 1;
      });
      
      analysis.knowledgeGaps.forEach(gap => {
        knowledgeGaps[gap] = (knowledgeGaps[gap] || 0) + 1;
      });
    });

    // Identify significant patterns
    for (const [question, frequency] of Object.entries(questionFrequency)) {
      if (frequency >= this.learningThreshold) {
        await this.createLearningInsight('frequent_question', question, frequency);
      }
    }

    for (const [gap, frequency] of Object.entries(knowledgeGaps)) {
      if (frequency >= this.learningThreshold) {
        await this.createLearningInsight('knowledge_gap', gap, frequency);
      }
    }
  }

  private async createLearningInsight(
    type: 'frequent_question' | 'knowledge_gap',
    content: string,
    frequency: number
  ): Promise<void> {
    // Check if insight already exists
    const existing = this.insights.find(i => 
      i.topic === type && i.pattern.includes(content)
    );

    if (existing) {
      existing.frequency += frequency;
      return;
    }

    // Generate suggested knowledge improvement
    const suggestion = await this.generateKnowledgeImprovement(type, content);
    
    const insight: LearningInsight = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      topic: type,
      pattern: content,
      frequency,
      confidence: this.calculateConfidence(type, frequency),
      examples: [content],
      suggestedKnowledge: suggestion,
      validationStatus: 'pending',
      createdAt: new Date()
    };

    this.insights.push(insight);
    await this.saveInsights();

    console.log(`🧠 New learning insight: ${type} - ${content} (frequency: ${frequency})`);
  }

  private async generateKnowledgeImprovement(
    type: 'frequent_question' | 'knowledge_gap',
    content: string
  ): Promise<string> {
    const prompt = type === 'frequent_question' 
      ? `Basandoti sulla knowledge base dermatologica esistente, crea una risposta completa e accurata per questa domanda frequente: "${content}". Fornisci informazioni scientifiche, ingredienti consigliati e consigli pratici.`
      : `Identifica e crea contenuto per colmare questa lacuna nella knowledge base dermatologica: "${content}". Includi definizioni, meccanismi d'azione e applicazioni pratiche.`;

    try {
      const response = await this.ai.getGenerativeModel({ 
        model: "gemini-2.5-flash" 
      }).generateContent(prompt);

      return response.response.text();
    } catch (error) {
      console.error('Error generating knowledge improvement:', error);
      return `Miglioramento suggerito per: ${content}`;
    }
  }

  private calculateConfidence(type: string, frequency: number): number {
    // Simple confidence calculation based on frequency and type
    const baseConfidence = Math.min(frequency / 10, 1);
    const typeBonus = type === 'frequent_question' ? 0.1 : 0.05;
    
    return Math.min(baseConfidence + typeBonus, 1);
  }

  async getApprovedInsights(): Promise<LearningInsight[]> {
    return this.insights.filter(i => i.validationStatus === 'approved');
  }

  async approveInsight(insightId: string): Promise<boolean> {
    const insight = this.insights.find(i => i.id === insightId);
    if (!insight) return false;

    insight.validationStatus = 'approved';
    await this.saveInsights();

    // Auto-apply if confidence is high enough
    if (insight.confidence >= this.confidenceThreshold) {
      await this.applyInsightToKnowledgeBase(insight);
    }

    return true;
  }

  async rejectInsight(insightId: string): Promise<boolean> {
    const insight = this.insights.find(i => i.id === insightId);
    if (!insight) return false;

    insight.validationStatus = 'rejected';
    await this.saveInsights();
    return true;
  }

  private async applyInsightToKnowledgeBase(insight: LearningInsight): Promise<void> {
    try {
      // Create a new knowledge base entry
      const knowledgeEntry = `
# Auto-Generated Knowledge: ${insight.topic}

**Topic**: ${insight.pattern}
**Frequency**: ${insight.frequency} occorrences
**Confidence**: ${insight.confidence}
**Generated**: ${insight.createdAt.toISOString()}

## Content

${insight.suggestedKnowledge}

---
*This content was automatically generated based on conversation patterns and approved for inclusion in the knowledge base.*
`;

      // Save to knowledge base
      const fileName = `auto_learning_${insight.id}.txt`;
      const filePath = path.join(process.cwd(), 'knowledge-base', fileName);
      
      await fs.writeFile(filePath, knowledgeEntry, 'utf-8');

      // Add to RAG system
      await ragService.addDocument(filePath, fileName);

      console.log(`✅ Applied insight to knowledge base: ${fileName}`);
    } catch (error) {
      console.error('Error applying insight to knowledge base:', error);
    }
  }

  private async loadExistingInsights(): Promise<void> {
    try {
      const insightsPath = path.join(process.cwd(), 'learning_insights.json');
      const data = await fs.readFile(insightsPath, 'utf-8');
      this.insights = JSON.parse(data);
    } catch (error) {
      // File doesn't exist or is corrupted, start fresh
      this.insights = [];
    }
  }

  private async saveInsights(): Promise<void> {
    try {
      const insightsPath = path.join(process.cwd(), 'learning_insights.json');
      await fs.writeFile(insightsPath, JSON.stringify(this.insights, null, 2));
    } catch (error) {
      console.error('Error saving insights:', error);
    }
  }

  // Get learning statistics
  getLearningStats(): {
    totalInsights: number;
    approvedInsights: number;
    pendingInsights: number;
    averageConfidence: number;
  } {
    const approved = this.insights.filter(i => i.validationStatus === 'approved');
    const pending = this.insights.filter(i => i.validationStatus === 'pending');
    const avgConfidence = this.insights.length > 0 
      ? this.insights.reduce((sum, i) => sum + i.confidence, 0) / this.insights.length 
      : 0;

    return {
      totalInsights: this.insights.length,
      approvedInsights: approved.length,
      pendingInsights: pending.length,
      averageConfidence: Math.round(avgConfidence * 100) / 100
    };
  }
}

export const autoLearningSystem = new AutoLearningSystem();
