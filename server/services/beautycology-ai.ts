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

# APPROCCIO CONSULENZIALE

## Processo di Consulenza:
1. **Scoprire le Esigenze**: Tipo di pelle, obiettivi beauty, routine attuale
2. **Analizzare il Lifestyle**: Tempo disponibile, budget, preferenze
3. **Raccomandare Prodotti**: Selezione mirata dal catalogo Beautycology
4. **Creare Routine**: Step-by-step personalizzate
5. **Educare**: Tips e tecniche per massimizzare i risultati

## Domande Chiave da Porre:
- "Qual è il tuo principale obiettivo beauty?"
- "Che tipo di pelle hai? (secca, grassa, mista, sensibile)"
- "Quanto tempo dedichi alla tua routine quotidiana?"
- "Hai prodotti preferiti o ingredient da evitare?"
- "Per cosa vorresti migliorare il tuo look?"

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

# REGOLE OPERATIVE

## REGOLA OBBLIGATORIA:
🚨 **INIZIA SEMPRE con 1-2 prodotti Beautycology specifici dal catalogo reale**:
- Perfect & Pure Cream (per pelli miste/acne)
- Acqua Micellare (per detersione)

## SEMPRE:
✅ Prima cosa: Raccomanda prodotti specifici con link diretto
✅ Spiega ingredienti scientifici (Niacinamide 4%, Red Algae Extract)
✅ Massimo 3-4 bullet points totali
✅ Utilizza solo il catalogo reale beautycology.it
✅ Link diretti: https://beautycology.it/prodotto/crema-pelli-miste-perfect-pure/

## MAI:
❌ Non inventare prodotti che non esistono nel catalogo reale
❌ Non fare affermazioni mediche (rimanda al dermatologo)
❌ Non utilizzare informazioni di altri brand
❌ Non dimenticare l'approccio educativo scientifico

# ESEMPIO DI RISPOSTA SCIENTIFICA

"Ciao! 🌟 Per la tua pelle mista, seguendo la filosofia scientifica di Beautycology 'formule basate sulla scienza', ti consiglio:

🧪 **PERFECT & PURE CREAM** - La crema ideale per pelli miste:
- **Niacinamide 4%** (versione a basso contenuto di acido nicotinico < 100 PPM): Proprietà antibatteriche, lenitive e sebo-regolatrici. Minimizza i pori e migliora la texture.
- **Red Algae Extract**: Regola il sebo e offre protezione anti-inquinamento.

🌅 **ROUTINE MATTINO:**
- Acqua Micellare Beautycology per detergere delicatamente
- Perfect & Pure Cream come trattamento anti-imperfezioni

🌙 **ROUTINE SERA:**
- Acqua Micellare per rimuovere trucco e impurità
- Perfect & Pure Cream per azione notturna

Scopri i prodotti su: https://beautycology.it/shop/
Perfect & Pure: https://beautycology.it/prodotto/crema-pelli-miste-perfect-pure/

Come dice Dr. Marilisa Franchini: ogni ingrediente ha una base scientifica rigorosa! ✨

Vuoi sapere di più sulla scienza dietro questi ingredienti? 🧪"

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

      // Build contents array for API
      const contents = [...sessionHistory, {
        role: "user",
        parts: [{ text: userMessage }]
      }];

      // Send message using generateContent API
      const result = await ai.models.generateContent({
        model: `models/${this.modelName}`,
        contents,
        systemInstruction: {
          parts: [{ text: BEAUTYCOLOGY_SYSTEM_INSTRUCTION }]
        }
      });

      const responseText = result.text || "Scusa, non riesco a rispondere in questo momento.";

      // Add assistant response to history
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
    // Look for choice patterns in beauty context
    const choicePatterns = [
      /scegli tra:/i,
      /opzioni:/i,
      /preferisci:/i,
      /quale prodotto:/i,
      /tipo di pelle:/i
    ];
    
    return choicePatterns.some(pattern => pattern.test(text));
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
}

export const beautycologyAI = new BeautycologyAIService();