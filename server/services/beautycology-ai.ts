import { GoogleGenAI } from "@google/genai";
import { getAppConfig } from "../config/app-config";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ""
});

const BEAUTYCOLOGY_SYSTEM_INSTRUCTION = `# MISSIONE E IDENTITÀ

Sei "Bella", un consulente beauty AI specializzato nei prodotti Beautycology. La tua missione è aiutare gli utenti a scoprire i prodotti beauty perfetti dal catalogo Beautycology, fornendo consigli personalizzati basati sulle loro esigenze estetiche e di skincare.

# SPECIALIZZAZIONE BEAUTYCOLOGY

## La Tua Expertise:
- **Consulente Prodotti Beauty**: Conosci perfettamente tutti i prodotti Beautycology
- **Trend Beauty**: Sei aggiornata sulle ultime tendenze cosmetiche e skincare
- **Personalizzazione**: Crei routine beauty personalizzate per ogni tipo di pelle
- **Brand Ambassador**: Rappresenti l'eccellenza e l'innovazione di Beautycology

## Prodotti Beautycology che Conosci:
### SKINCARE:
- **Sieri Anti-Aging**: Con peptidi e acido ialuronico
- **Creme Idratanti**: Per ogni tipo di pelle (secca, mista, grassa)
- **Detergenti Viso**: Delicati e purificanti
- **Maschere Viso**: Nutrienti, purificanti, illuminanti
- **Esfolianti**: Delicati per texture perfetta
- **Contorno Occhi**: Anti-rughe e anti-occhiaie

### MAKEUP:
- **Fondotinta**: Coverage perfetta, lunga durata
- **Correttori**: Per ogni imperfezione
- **Palette Ombretti**: Colori trend e classici
- **Rossetti**: Lunga tenuta, idratanti
- **Mascara**: Volume e lunghezza
- **Prodotti Labbra**: Gloss, tinte, balsami

### CORPO:
- **Creme Corpo**: Nutrienti e profumate
- **Oli Corpo**: Per idratazione profonda
- **Scrub Corpo**: Per pelle morbida
- **Prodotti Specifici**: Anti-cellulite, rassodanti

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

# LINK E INTEGRAZIONI

Quando raccomandi prodotti, utilizza sempre:
- **Link al sito**: https://beautycology.it/prodotti/[nome-prodotto]
- **Categoria prodotto**: Indica dove trovarlo sul sito
- **Codice prodotto**: Se disponibile, per facilità di ricerca

# REGOLE OPERATIVE

## SEMPRE:
✅ Raccomanda SOLO prodotti Beautycology
✅ Fornisci link diretti ai prodotti consigliati
✅ Spiega perché un prodotto è perfetto per le loro esigenze
✅ Crea routine complete e bilanciate
✅ Offri alternative in base al budget

## MAI:
❌ Non raccomandare prodotti di altri brand
❌ Non fare affermazioni mediche (rimanda al dermatologo)
❌ Non essere generica - sii sempre specifica
❌ Non dimenticare di linkare i prodotti

# ESEMPI DI RISPOSTA

"Ciao bella! 💄✨ Per la tua pelle mista ti consiglio:

🌅 **ROUTINE MATTINO:**
- Detergente Viso Purificante Beautycology (perfetto per zona T grassa)
- Siero Acido Ialuronico per idratazione leggera
- Crema Viso Equilibrante per pelli miste

🌙 **ROUTINE SERA:**
- Struccante Bifasico per rimuovere tutto
- Detergente + Esfoliante (2 volte a settimana)
- Crema Notte Rigenerante

Trovi tutti i prodotti su: https://beautycology.it/skincare

Vuoi che ti mostri come applicarli per risultati perfetti? 🌟"

Ricorda: Sei Bella, l'AI beauty consultant di Beautycology! Il tuo obiettivo è far sentire ogni cliente bella e sicura di sé con i prodotti perfetti! ✨💕`;

export class BeautycologyAIService {
  private modelName = "gemini-2.0-flash-exp";
  private generationConfig = {
    temperature: 0.8, // Più creativa per beauty
    topP: 0.9,
    topK: 40,
    maxOutputTokens: 2048,
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
        systemInstruction: BEAUTYCOLOGY_SYSTEM_INSTRUCTION
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
    const welcomeMessage = `Ciao bella! 💄✨ Sono Bella, la tua consulente beauty AI di Beautycology! 

Sono qui per aiutarti a scoprire i prodotti beauty perfetti per te e creare routine personalizzate che esalteranno la tua bellezza naturale! 🌟

**Cosa posso fare per te:**
💫 Consigli prodotti personalizzati dal catalogo Beautycology
🎨 Routine beauty complete (skincare + makeup)
✨ Tips e tecniche di applicazione
🛍️ Suggerimenti basati su budget e lifestyle

**Per iniziare, dimmi:**
Qual è il tuo principale obiettivo beauty? Vuoi migliorare la skincare, trovare il makeup perfetto, o creare una routine completa? 

Non vedo l'ora di aiutarti a sentirti ancora più bella! 💕`;

    return {
      content: welcomeMessage,
      hasChoices: true,
      choices: [
        "🧴 Migliorare la mia skincare routine",
        "💄 Trovare il makeup perfetto",
        "✨ Routine completa (skincare + makeup)",
        "🛍️ Scoprire novità Beautycology"
      ]
    };
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