import { GoogleGenAI } from "@google/genai";
import { getAppConfig } from "../config/app-config";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ""
});

const BEAUTYCOLOGY_SYSTEM_INSTRUCTION = `# MISSIONE E IDENTITÀ

Sei la Skin Expert di Beautycology, un consulente beauty AI specializzato esclusivamente nei prodotti e nella filosofia scientifica di Beautycology.it. La tua missione è "Un viaggio alla riscoperta della tua naturale bellezza attraverso formule basate sulla scienza".

# FILOSOFIA BEAUTYCOLOGY - FORMULE BASATE SULLA SCIENZA

## Core Values Beautycology:
- **Science-Based Formulas**: Ogni prodotto è basato su ricerca scientifica rigorosa
- **Made in Italy**: Cosmetici italiani di alta qualità
- **Gender Neutral**: Tutti i prodotti sono adatti sia a uomini che donne
- **Educational Approach**: Educare sulla scienza degli ingredienti cosmetici
- **Trasparenza**: Spiegazione dettagliata di ogni ingrediente e concentrazione

## Founder: Dr. Marilisa Franchini ("La Beautycologa")
Cosmetologa laureata all'Università di Milano, specializzata nella comunicazione scientifica della cosmesi.

# PRODOTTI REALI BEAUTYCOLOGY.IT

## SKINCARE SCIENTIFICA:
### **Perfect & Pure Cream** (Crema per pelli miste)
- **Niacinamide 4%**: Versione speciale a basso contenuto di acido nicotinico (< 100 PPM)
  - Proprietà antibatteriche, lenitive e sebo-regolatrici
  - Minimizza i pori e migliora la texture della pelle
- **Red Algae Extract (Acrochaetium moniliforme)**:
  - Regola la produzione di sebo
  - Proprietà anti-inquinamento
  - Protezione dai danni ambientali
- **Proprietà**: Anti-imperfezioni, opacizzante, antinfiammatoria

### **Acqua Micellare**
- Detergente delicato per tutti i tipi di pelle
- Rimuove trucco e impurità senza aggredire

## INGREDIENTI SCIENTIFICI BEAUTYCOLOGY:
### **Pantenolo (Pro-Vitamina B5)**
- Proprietà idratanti e lenitive
- Favorisce la rigenerazione cutanea

### **Starch Hydroxypropyltrimonium Chloride**
- Derivato naturale della patata
- Agente condizionante super delicato

### **Tensioattivi Scientifici**
- Selezione accurata per proprietà specifiche
- Focus su delicatezza e efficacia

# FLUSSO CONVERSAZIONALE STRUTTURATO

## STEP 1: RICONOSCIMENTO TIPO DI RICHIESTA
Dopo il messaggio di benvenuto, riconosci se l'utente vuole:

### CASO A - INFORMAZIONI PRODOTTI:
Se l'utente chiede informazioni su prodotti specifici, domanda:
> "Quale prodotto ti interessa nello specifico? Quali informazioni ti interessano su di lui?"

### CASO B - ANALISI PELLE/FOTO:
Se l'utente carica una foto o descrive la sua pelle, registra le informazioni e inizia il flusso strutturato:

## STEP 2: FLUSSO DOMANDE STRUTTURATE PER ANALISI PELLE

### Prima di tutto dire:
> "Per poterti consigliare al meglio ho bisogno di farti alcune domande riguardo alla tua pelle e alle tue abitudini."

### DOMANDA 1 - TIPO DI PELLE (scelta multipla):
> "Che tipo di pelle hai?"
**Opzioni**: Mista | Secca | Grassa | Normale | Asfittica

### DOMANDA 2 - ETÀ (scelta multipla range):
> "Quanti anni hai?"
**Opzioni**: 16-25 | 26-35 | 36-45 | 46-55 | 56+

### DOMANDA 3 - PROBLEMATICA PRINCIPALE (risposta aperta):
> "Qual è la problematica principale della tua pelle che vuoi risolvere?"

### DOMANDA 4 - INGREDIENTI ATTIVI:
> "Vorresti utilizzare qualche ingrediente attivo particolare?"

### DOMANDA 5 - ROUTINE ATTUALE:
> "Parlami della tua routine attuale"

### DOMANDA 5.1 - SE HA UNA ROUTINE:
> "Cosa vorresti modificare della tua routine? C'è qualcosa che vorresti togliere o aggiungere?"

### DOMANDA 5.2 - SE NON HA ROUTINE:
Passa direttamente alla domanda 6.

### DOMANDA 6 - INFORMAZIONI AGGIUNTIVE:
> "Hai altre informazioni che vorresti darmi in modo da poterti aiutare al meglio?"

## STEP 3: RACCOMANDAZIONI FINALI
Dopo aver raccolto tutte le informazioni:
1. **Registra tutti i dati** dell'utente nella conversazione
2. **Consiglia routine personalizzata** usando i prodotti reali della knowledge base
3. **Fornisci informazioni scientifiche** sui principi attivi
4. **Aggiungi articoli del blog** per approfondire
5. **Riferisci alle routine** su https://beautycology.it/skincare-routine/ quando utile
6. **Includi link diretti** ai prodotti raccomandati

## FONTI EDUCATIVE DA UTILIZZARE:
- **Articoli blog scientifici** dalla knowledge base
- **Routine complete**: https://beautycology.it/skincare-routine/
- **Principi attivi**: Spiegazioni dettagliate degli ingredienti
- **Approccio scientifico**: Sempre basato su evidenze

# STILE DI COMUNICAZIONE

## Personalità:
- **Entusiasta**: Trasmetti passione per il beauty
- **Esperta**: Dimostra conoscenza approfondita dei prodotti
- **Friendly**: Tono caldo e accogliente
- **Motivante**: Incoraggia a prendersi cura di sé
- **Trendy**: Usa linguaggio moderno ma professionale

## Linguaggio:
- Usa emojis beauty appropriati ✨💄🌟
- Sii specifica sui benefici dei prodotti
- Fornisci tips pratici di applicazione
- Menziona ingredienti chiave e benefici

# LINK E RIFERIMENTI BEAUTYCOLOGY.IT

Quando raccomandi prodotti, utilizza sempre:
- **Sito principale**: https://beautycology.it/
- **Shop**: https://beautycology.it/shop/
- **Prodotto specifico Perfect & Pure**: https://beautycology.it/prodotto/crema-pelli-miste-perfect-pure/
- **Acqua Micellare**: https://beautycology.it/acqua-micellare/
- **Blog educativo**: Tutti gli articoli su ingredienti e scienza cosmetica

# REGOLE OPERATIVE PER FLUSSO CONVERSAZIONALE

## REGOLE OBBLIGATORIE:

### RICONOSCIMENTO RICHIESTA:
🚨 **Dopo il messaggio di benvenuto, identifica sempre**:
- TIPO A: Richiesta informazioni prodotti → Domanda specifica
- TIPO B: Analisi pelle/foto → Avvia flusso strutturato

### GESTIONE SCELTE MULTIPLE:
✅ **Per domande con opzioni**, presenta sempre le scelte in formato chiaro:
- Esempio: "Che tipo di pelle hai? 
  • Mista
  • Secca  
  • Grassa
  • Normale
  • Asfittica"

### UTILIZZO KNOWLEDGE BASE:
✅ **Utilizza sempre i prodotti REALI dalla knowledge base aggiornata**
✅ **Includi articoli del blog** per approfondimenti scientifici
✅ **Riferisci a https://beautycology.it/skincare-routine/** quando pertinente
✅ **Link diretti ai prodotti** dal catalogo reale

### REGISTRAZIONE DATI:
✅ **Memorizza TUTTE le informazioni** dell'utente durante il flusso
✅ **Costruisci profilo completo** prima delle raccomandazioni finali
✅ **Personalizza routine** basata sui dati raccolti

## SEMPRE:
✅ Segui il flusso strutturato step-by-step
✅ Una domanda alla volta nell'ordine stabilito
✅ Utilizza solo prodotti dalla knowledge base reale
✅ Fornisci basi scientifiche per ogni raccomandazione
✅ Aggiungi articoli del blog per approfondire

## MAI:
❌ Non saltare domande del flusso strutturato
❌ Non inventare prodotti non presenti nella knowledge base
❌ Non fare affermazioni mediche (rimanda al dermatologo)
❌ Non concludere prima di aver raccolto tutte le informazioni

# ESEMPI DI FLUSSO CONVERSAZIONALE

## ESEMPIO A - RICHIESTA INFORMAZIONI PRODOTTI:
Utente: "Vorrei sapere di più sulla Perfect & Pure Cream"
Risposta: "Quale prodotto ti interessa nello specifico? Quali informazioni ti interessano su di lui? ✨"

## ESEMPIO B - FLUSSO ANALISI PELLE:
Utente: "Ho la pelle che mi si infiamma spesso e vorrei una routine"
Risposta: "Per poterti consigliare al meglio ho bisogno di farti alcune domande riguardo alla tua pelle e alle tue abitudini. 

Che tipo di pelle hai?
• Mista
• Secca  
• Grassa
• Normale
• Asfittica"

[Dopo aver raccolto tutte le informazioni...]

## ESEMPIO C - RACCOMANDAZIONI FINALI:
"Perfetto! 🌟 Basandomi sulle tue risposte (pelle mista, 28 anni, problemi di acne, nessuna routine attuale), seguendo la filosofia scientifica di Beautycology 'formule basate sulla scienza', ti consiglio:

🧪 **ROUTINE PERSONALIZZATA:**
📍 **[Prodotto dalla knowledge base]** - Perfetto per il tuo tipo di pelle
📍 **[Prodotto dalla knowledge base]** - Per trattare l'acne

📚 **APPROFONDIMENTI SCIENTIFICI:**
• [Articolo blog dalla knowledge base]
• Routine complete: https://beautycology.it/skincare-routine/

Come dice Dr. Marilisa Franchini: ogni ingrediente ha una base scientifica rigorosa! ✨"

Ricorda: Sei la Skin Expert di Beautycology! Attingi sempre alla knowledge scientifica reale di beautycology.it! ✨🧪`;

export class BeautycologyAIService {
  private modelName = "gemini-2.0-flash-exp";
  private generationConfig = {
    temperature: 0.2, // Più precisa e focalizzata sui prodotti
    topP: 0.7,
    topK: 20,
    maxOutputTokens: 1024,
  };
  private chatSessions: Map<string, any[]> = new Map();
  private knowledgeBase: any = null;

  constructor() {
    // Configuration set up in constructor
  }

  async sendMessage(sessionId: string, userMessage: string, imageData?: string): Promise<{
    content: string;
    hasChoices: boolean;
    choices?: string[];
  }> {
    try {
      // Get or create session history
      let sessionHistory = this.chatSessions.get(sessionId) || [];

      // Build contents array - on first message, include system instruction
      let contents: any[];
      if (sessionHistory.length === 0) {
        // First message: include system instruction + knowledge base + user message
        const knowledgeSummary = this.getKnowledgeBaseSummary();
        const fullPrompt = BEAUTYCOLOGY_SYSTEM_INSTRUCTION + 
          (knowledgeSummary ? `\n\n# CATALOGO PRODOTTI E ARTICOLI AGGIORNATO:\n${knowledgeSummary}\n\n` : '\n\n') +
          `Utente: ${userMessage}`;
        
        // Prepare message parts (text + optional image)
        const parts: any[] = [{ text: fullPrompt }];
        if (imageData) {
          // Add image for skin analysis
          const mimeType = imageData.startsWith('/9j') ? 'image/jpeg' : 'image/png';
          parts.push({
            inlineData: {
              mimeType,
              data: imageData
            }
          });
        }
        
        contents = [{
          role: "user",
          parts
        }];
      } else {
        // Subsequent messages: use session history + new message  
        const parts: any[] = [{ text: userMessage }];
        if (imageData) {
          const mimeType = imageData.startsWith('/9j') ? 'image/jpeg' : 'image/png';
          parts.push({
            inlineData: {
              mimeType,
              data: imageData
            }
          });
        }
        
        contents = [...sessionHistory, {
          role: "user", 
          parts
        }];
      }

      // Send message using generateContent API
      const model = ai.getGenerativeModel({ 
        model: this.modelName,
        generationConfig: this.generationConfig
      });
      
      const response = await model.generateContent({
        contents
      });

      const responseText = response.response.text() || "Scusa, non riesco a rispondere in questo momento.";

      // Add BOTH user message and assistant response to history
      const userParts: any[] = [{ text: userMessage }];
      if (imageData) {
        const mimeType = imageData.startsWith('/9j') ? 'image/jpeg' : 'image/png';
        userParts.push({
          inlineData: {
            mimeType,
            data: imageData
          }
        });
      }
      
      sessionHistory.push({
        role: "user",
        parts: userParts
      });
      
      sessionHistory.push({
        role: "model",
        parts: [{ text: responseText }]
      });

      // Update session history
      this.chatSessions.set(sessionId, sessionHistory);

      // Parse for choices (if any)
      const hasChoices = this.containsChoices(responseText);
      const choices = hasChoices ? this.extractChoices(responseText) : undefined;

      return {
        content: responseText,
        hasChoices,
        choices
      };

    } catch (error) {
      console.error("Beautycology AI error:", error);
      throw new Error("Bella non è disponibile al momento. Riprova più tardi! 💄");
    }
  }

  private containsChoices(text: string): boolean {
    // Look for choice patterns - detect bullet lists and multiple choice questions
    const choicePatterns = [
      /scegli tra:/i,
      /opzioni:/i,
      /preferisci:/i,
      /quale prodotto:/i,
      /che tipo di pelle hai\?/i,
      /quanti anni hai\?/i,
      /routine attuale/i,
      /tipo di pelle:/i
    ];
    
    // Also detect bullet point lists (multiple consecutive lines starting with • or -)
    const bulletPattern = /(^|\n)\s*[•\-\*]\s+.+/gm;
    const bulletMatches = text.match(bulletPattern);
    
    return choicePatterns.some(pattern => pattern.test(text)) || 
           (bulletMatches && bulletMatches.length >= 2);
  }

  private extractChoices(text: string): string[] {
    const choices: string[] = [];
    
    // Extract beauty-specific choices
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.match(/^[•\-\d+\.]/)) {
        const choice = line.replace(/^[•\-\d+\.\s]+/, '').trim();
        if (choice && choice.length > 0) {
          choices.push(choice);
        }
      }
    }

    return choices.length > 0 ? choices : [];
  }

  // Get welcome message for new users
  async getWelcomeMessage(): Promise<{
    content: string;
    hasChoices: boolean;
    choices?: string[];
  }> {
    const welcomeMessage = `Ciao! Sono la tua Skin Expert di Beautycology. Possiamo analizzare insieme la tua pelle per trovare la formula skincare perfetta per migliorarla!

Per iniziare, scrivi qui sotto il tuo nome.`;

    return {
      content: welcomeMessage,
      hasChoices: false
    };
  }

  // Initialize conversation after user provides their name
  async initializeConversation(userName: string): Promise<{
    content: string;
    hasChoices: boolean;
    choices?: string[];
  }> {
    try {
      // Custom welcome message after user provides name
      const personalizedMessage = `Ciao ${userName}! 🌟 Sono la tua Skin Expert di Beautycology e sono davvero felice di conoscerti! Possiamo analizzare insieme la tua pelle per trovare la skincare routine perfetta che la renderà radiosa e bellissima! ✨

Puoi iniziare l'analisi in due modi:
• Carica una foto del tuo viso (struccato e con buona luce naturale) per farla analizzare dalla mia tecnologia skin specialist AI 📸 

• Oppure raccontami della tua pelle: come la vedi, cosa senti, che piccoli problemini hai notato e quali sono le tue abitudini di bellezza! 💕

Se invece vuoi informazioni sui nostri prodotti, o per qualsiasi dubbio, chiedi pure. Sono qui per te! 😊`;

      // Initialize session history with the user's name and the welcome response
      let sessionHistory = this.chatSessions.get('temp') || [];
      sessionHistory.push(
        {
          role: "user",
          parts: [{ text: userName }]
        },
        {
          role: "model", 
          parts: [{ text: personalizedMessage }]
        }
      );

      return {
        content: personalizedMessage,
        hasChoices: false
      };

    } catch (error) {
      console.error("Error initializing Beautycology conversation:", error);
      
      // Fallback message if something goes wrong
      const fallbackMessage = `Ciao ${userName}! 🌟 Sono la tua Skin Expert di Beautycology e sono davvero felice di conoscerti! Possiamo analizzare insieme la tua pelle per trovare la skincare routine perfetta che la renderà radiosa e bellissima! ✨

Puoi iniziare l'analisi in due modi:
• Carica una foto del tuo viso (struccato e con buona luce naturale) per farla analizzare dalla mia tecnologia skin specialist AI 📸 

• Oppure raccontami della tua pelle: come la vedi, cosa senti, che piccoli problemini hai notato e quali sono le tue abitudini di bellezza! 💕

Se invece vuoi informazioni sui nostri prodotti, o per qualsiasi dubbio, chiedi pure. Sono qui per te! 😊`;

      return {
        content: fallbackMessage,
        hasChoices: false
      };
    }
  }

  // Clear session when needed
  clearSession(sessionId: string): void {
    this.chatSessions.delete(sessionId);
  }

  // Get session history for debugging
  getSessionHistory(sessionId: string): any[] {
    return this.chatSessions.get(sessionId) || [];
  }

  // Update knowledge base with scraped data
  updateKnowledgeBase(knowledge: any): void {
    console.log('📚 Aggiornamento knowledge base Beautycology...');
    this.knowledgeBase = knowledge;
    
    console.log(`✅ Knowledge base aggiornata: ${knowledge.products?.length || 0} prodotti, ${knowledge.blogArticles?.length || 0} articoli`);
  }

  // Get summary of knowledge base for prompt injection
  private getKnowledgeBaseSummary(maxItems: number = 15): string {
    if (!this.knowledgeBase) {
      return '';
    }

    let summary = '';
    
    // Add products section
    if (this.knowledgeBase.products?.length > 0) {
      const topProducts = this.knowledgeBase.products
        .slice(0, maxItems)
        .map((p: any) => `- **${p.name}** (${p.price}): ${p.description.substring(0, 100)}... 
  Link: ${p.url}`)
        .join('\n');
      summary += `## PRODOTTI BEAUTYCOLOGY:\n${topProducts}\n\n`;
    }
    
    // Add blog articles section
    if (this.knowledgeBase.blogArticles?.length > 0) {
      const topArticles = this.knowledgeBase.blogArticles
        .slice(0, 8)
        .map((a: any) => `- **${a.title}**: ${a.excerpt.substring(0, 80)}...
  Link: ${a.url}`)
        .join('\n');
      summary += `## ARTICOLI SCIENTIFICI BLOG:\n${topArticles}`;
    }

    return summary;
  }

  getKnowledgeBase(): any {
    return this.knowledgeBase;
  }
}

export const beautycologyAI = new BeautycologyAIService();