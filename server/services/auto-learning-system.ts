
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
  private learningThreshold = 5; // Minimum occurrences to consider a pattern (aumentato per sicurezza)
  private confidenceThreshold = 0.8; // Minimum confidence to auto-apply (aumentato per sicurezza)
  private autonomousLearning = true; // Abilita apprendimento autonomo
  private maxDailyInsights = 3; // Massimo 3 insights applicati al giorno per gradualità

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

    console.log(`🧠 New learning insight: ${type} - ${content} (frequency: ${frequency}, confidence: ${insight.confidence})`);

    // APPRENDIMENTO AUTONOMO: Auto-approva se passa i controlli di sicurezza
    if (this.autonomousLearning && await this.canAutoApprove(insight)) {
      await this.autoApproveInsight(insight.id);
    }
  }

  private async generateKnowledgeImprovement(
    type: 'frequent_question' | 'knowledge_gap',
    content: string
  ): Promise<string> {
    const safetyPrompt = `
IMPORTANTE: Genera SOLO contenuti cosmetici e di skincare routine. NON fornire mai:
- Diagnosi mediche
- Consigli medici specifici  
- Informazioni su patologie cutanee
- Raccomandazioni farmacologiche

Mantieni il tono coerente con Bonnie (professionale ma accessibile).
Limita la risposta a massimo 500 parole.
`;

    const prompt = type === 'frequent_question' 
      ? `${safetyPrompt}

Basandoti sulla knowledge base dermatologica di Bonnie, crea una risposta completa per questa domanda frequente: "${content}". 
Includi:
- Spiegazione scientifica semplice
- Ingredienti cosmetici raccomandati
- Consigli pratici per la routine
- Suggerimenti sui prodotti Bonnie (se pertinenti)

Mantieni uno stile educativo ma non medico.`
      : `${safetyPrompt}

Identifica e crea contenuto cosmetico per questa lacuna: "${content}". 
Includi:
- Definizioni cosmetiche (non mediche)
- Meccanismi d'azione degli ingredienti
- Applicazioni pratiche nella skincare routine

Focus su cosmetica, non medicina.`;

    try {
      const response = await this.ai.getGenerativeModel({ 
        model: "gemini-2.5-flash" 
      }).generateContent(prompt);

      const content_response = response.response.text();
      
      // Verifica finale di sicurezza
      const medicalTerms = ['diagnosi', 'patologia', 'malattia', 'cura medica'];
      const hasUnsafeContent = medicalTerms.some(term => 
        content_response.toLowerCase().includes(term)
      );

      if (hasUnsafeContent) {
        return `Informazione cosmetica per: ${content} (contenuto filtrato per sicurezza)`;
      }

      return content_response;
    } catch (error) {
      console.error('Error generating knowledge improvement:', error);
      return `Miglioramento cosmetico suggerito per: ${content}`;
    }
  }

  private calculateConfidence(type: string, frequency: number): number {
    // Calcolo confidence più conservativo per apprendimento autonomo
    const baseConfidence = Math.min(frequency / 15, 0.9); // Max 0.9 invece di 1.0
    const typeBonus = type === 'frequent_question' ? 0.1 : 0.02; // Bonus ridotto per knowledge_gap
    
    // Penalizza se frequency è troppo bassa
    const frequencyPenalty = frequency < this.learningThreshold ? -0.3 : 0;
    
    return Math.max(0.1, Math.min(baseConfidence + typeBonus + frequencyPenalty, 0.95));
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

  // Controlla se un insight può essere auto-approvato in sicurezza
  private async canAutoApprove(insight: LearningInsight): Promise<boolean> {
    // Controlli di sicurezza per l'apprendimento autonomo
    
    // 1. Controllo confidence minima
    if (insight.confidence < this.confidenceThreshold) {
      console.log(`❌ Auto-approve blocked: confidence too low (${insight.confidence})`);
      return false;
    }

    // 2. Controllo frequenza minima
    if (insight.frequency < this.learningThreshold) {
      console.log(`❌ Auto-approve blocked: frequency too low (${insight.frequency})`);
      return false;
    }

    // 3. Limite giornaliero per gradualità
    const today = new Date().toDateString();
    const todayApprovals = this.insights.filter(i => 
      i.validationStatus === 'approved' && 
      new Date(i.createdAt).toDateString() === today
    ).length;

    if (todayApprovals >= this.maxDailyInsights) {
      console.log(`❌ Auto-approve blocked: daily limit reached (${todayApprovals}/${this.maxDailyInsights})`);
      return false;
    }

    // 4. Controllo contenuto sicuro (no termini medici pericolosi)
    const dangerousTerms = [
      'diagnosi', 'malattia', 'patologia', 'medicina', 'farmaco', 'cura',
      'tumore', 'cancro', 'melanoma', 'infezione', 'virus', 'batterio'
    ];

    const contentLower = (insight.pattern + ' ' + insight.suggestedKnowledge).toLowerCase();
    const hasDangerousTerms = dangerousTerms.some(term => contentLower.includes(term));

    if (hasDangerousTerms) {
      console.log(`❌ Auto-approve blocked: contains medical terms`);
      return false;
    }

    // 5. Controllo lunghezza ragionevole (evita contenuti troppo lunghi che potrebbero essere imprecisi)
    if (insight.suggestedKnowledge.length > 2000) {
      console.log(`❌ Auto-approve blocked: content too long (${insight.suggestedKnowledge.length} chars)`);
      return false;
    }

    // 6. Solo domande frequenti per ora (più sicure)
    if (insight.topic !== 'frequent_question') {
      console.log(`❌ Auto-approve blocked: only frequent questions allowed for auto-approval`);
      return false;
    }

    console.log(`✅ Auto-approve approved: all safety checks passed`);
    return true;
  }

  // Auto-approva un insight
  private async autoApproveInsight(insightId: string): Promise<boolean> {
    const insight = this.insights.find(i => i.id === insightId);
    if (!insight) return false;

    insight.validationStatus = 'approved';
    await this.saveInsights();

    // Applica automaticamente alla knowledge base
    await this.applyInsightToKnowledgeBase(insight);

    console.log(`🤖 AUTONOMOUS LEARNING: Auto-approved and applied insight: ${insight.topic} - ${insight.pattern.slice(0, 50)}...`);
    return true;
  }

  // Get learning statistics
  getLearningStats(): {
    totalInsights: number;
    approvedInsights: number;
    pendingInsights: number;
    averageConfidence: number;
    autonomousMode: boolean;
    todayAutoApprovals: number;
  } {
    const approved = this.insights.filter(i => i.validationStatus === 'approved');
    const pending = this.insights.filter(i => i.validationStatus === 'pending');
    const avgConfidence = this.insights.length > 0 
      ? this.insights.reduce((sum, i) => sum + i.confidence, 0) / this.insights.length 
      : 0;

    const today = new Date().toDateString();
    const todayAutoApprovals = this.insights.filter(i => 
      i.validationStatus === 'approved' && 
      new Date(i.createdAt).toDateString() === today
    ).length;

    return {
      totalInsights: this.insights.length,
      approvedInsights: approved.length,
      pendingInsights: pending.length,
      averageConfidence: Math.round(avgConfidence * 100) / 100,
      autonomousMode: this.autonomousLearning,
      todayAutoApprovals
    };
  }
}

export const autoLearningSystem = new AutoLearningSystem();
