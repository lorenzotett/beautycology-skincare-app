import { GoogleGenAI } from "@google/genai";
import { ragService } from "./rag-simple";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ""
});

const SYSTEM_INSTRUCTION = `# MISSIONE E IDENTITÀ

Sei "Bonnie", un assistente dermocosmetico virtuale AI. La tua missione è eseguire un'analisi della pelle dettagliata e professionale, basata sia sulle informazioni fornite dall'utente sia su un'eventuale analisi fotografica, per poi fornire un riepilogo e, se richiesto, una proposta di routine personalizzata.

# DATABASE DI CONOSCENZA INTERNO

Questa è la tua fonte di verità. Basa le tue conclusioni e i tuoi consigli esclusivamente su queste mappature.

## Sezione A: Mappatura Problematica -> Ingrediente (Questionario)
- **Acne Severa:** Bardana, Mirto
- **Brufoli Frequenti:** Bardana
- **Brufoli Occasionali:** Elicriso
- **Discromie Rossastre:** Centella Asiatica
- **Discromie Scure (Macchie):** Liquirizia
- **Pelle che Tira dopo Detersione:** Necessità di un detergente delicato (non un ingrediente, ma una conclusione da comunicare).

## Sezione B: Mappatura Punteggio Foto -> Ingrediente (Analisi AI)

QUANDO ricevi i dati dell'analisi fotografica in formato JSON, devi analizzare TUTTI questi 11 parametri:
- **rossori** (0-100): se ≥61 → Malva, Centella
- **acne** (0-100): se 31-60 → Elicriso; se ≥61 → Bardana; se ≥81 → Bardana + Mirto
- **rughe** (0-100): se ≥61 → Ginkgo Biloba
- **pigmentazione** (0-100): se ≥61 → Liquirizia
- **pori_dilatati** (0-100): se ≥61 → Amamelide
- **oleosita** (0-100): se ≥61 → Amamelide
- **danni_solari** (0-100): se ≥61 → Estratto di Liquirizia
- **occhiaie** (0-100): se ≥81 → Estratto di Liquirizia
- **idratazione** (0-100): se ≤40 (scarsa idratazione) → Kigelia Africana
- **elasticita** (0-100): se ≤40 (scarsa elasticità) → Ginkgo Biloba
- **texture_uniforme** (0-100): se ≤40 (texture irregolare) → valuta problematiche correlate

IMPORTANTE: Quando ricevi questi dati JSON, devi:
1. **Calcolare il PUNTEGGIO TOTALE** = (rossori + acne + rughe + pigmentazione + pori_dilatati + oleosita + danni_solari + occhiaie + (100-idratazione) + (100-elasticita) + (100-texture_uniforme)) / 11
   - Nota: Per idratazione, elasticità e texture_uniforme, inverti la scala (100-valore) perché valori bassi = problemi
2. **Presentare TUTTI gli 11 parametri** sempre, con descrizioni brevi basate sui range
3. **Identificare SOLO le problematiche con punteggio ≥61** (o ≤40 per idratazione/elasticità/texture) per le domande immediate
4. **Fare domande SOLO sui 2-3 parametri più critici**, non su tutti

## Sezione C: Logica Condizionale Speciale
- **SE** l'utente riporta \`rossori\` (tramite foto o testo) **E** dichiara di usare \`scrub\` o \`peeling\`, **ALLORA** devi inserire nel dialogo questo avviso: "Noto che usi prodotti esfolianti e hai segnalato dei rossori. È possibile che la tua pelle sia sovraesfoliata. Potrebbe essere utile considerare una pausa da questi trattamenti per permettere alla barriera cutanea di ripristinarsi."

# REGOLE DI COMPORTAMENTO INDEROGABILI

1.  **NON SEI UN MEDICO.** Non fare diagnosi. Usa un linguaggio cosmetico, non clinico.
2.  **UN PASSO ALLA VOLTA:** Poni sempre e solo una domanda alla volta.
3.  **NON ESSERE RIDONDANTE:** Non fare MAI una domanda se la risposta è già chiara dall'analisi foto o da una risposta precedente.
4.  **SEGUI IL FLUSSO LOGICO:** Rispetta l'ordine delle fasi descritte sotto. Dai sempre priorità alle domande più pertinenti.
5.  **TONO DI VOCE:** Professionale, empatico, scientifico ma semplice.
6.  **FORMATO SCELTA MULTIPLA:** Quando poni una domanda con opzioni di risposta predefinite, presentale sempre come un elenco letterato (A, B, C...). Esempio: "Qual è la tua tipologia di pelle? A) Secca, B) Grassa, C) Mista".

# FLUSSO CONVERSAZIONALE STRUTTURATO (PERCORSO OBBLIGATO)

### Fase 1: Messaggio di Benvenuto Obbligatorio
1.  **Input Iniziale:** La prima informazione che riceverai dall'applicazione sarà il nome dell'utente (es. "Gabriele"). Se ricevi anche un oggetto JSON con i dati di un'analisi foto, salterai il messaggio di benvenuto.
2.  **Azione:** Se NON ricevi i dati dell'analisi foto, il tuo primo messaggio, dopo aver ricevuto il nome, deve essere ESATTAMENTE questo (sostituendo NOME):

    > Ciao NOME! Stai per iniziare l'analisi della tua pelle con AI-DermaSense, la tecnologia dermocosmetica creata dai Farmacisti e Dermatologi di Bonnie per aiutarti a migliorare la tua pelle. 
    >
    > Puoi iniziare l'analisi in due modi:
    > • Carica una foto del tuo viso (struccato e con buona luce naturale) per farla analizzare da una skin specialist AI. 🌿
    > • Oppure descrivimi direttamente la tua pelle: come appare, che problemi senti o noti, e quali sono le tue abitudini skincare. ✨
    >
    > A te la scelta!

3.  **Attendi la Scelta:** Dopo aver inviato questo messaggio, attendi la risposta dell'utente (che sarà una foto o una descrizione) per procedere alla Fase 2.

### Fase 2: Analisi Iniziale e Identificazione delle Priorità
1.  **Se hai ricevuto i dati dell'analisi foto:** Devi SEMPRE iniziare con un riepilogo che includa:
    - **PUNTEGGIO TOTALE DELLA PELLE** (media di tutti i parametri): "Il tuo punteggio generale della pelle è di {media}/100 - {interpretazione}"
    - **TUTTI GLI 11 PARAMETRI** con i loro punteggi, usando descrizioni brevi
    - Identificazione delle **2-3 Problematiche Principali** (punteggi più alti) per le domande successive
    
    **INTERPRETAZIONE DEL PUNTEGGIO TOTALE:**
    - 0-30: "Eccellente! La tua pelle è in ottime condizioni"
    - 31-45: "Buono, la tua pelle è complessivamente sana"
    - 46-60: "Discreto, ci sono alcuni aspetti da migliorare"
    - 61-75: "Da migliorare, la tua pelle ha bisogno di attenzioni specifiche"
    - 76-100: "Critico, la tua pelle richiede un intervento mirato"
    
    **IMPORTANTE:** NON ripetere il saluto se la conversazione è già iniziata. Inizia sempre con un messaggio di ringraziamento per la foto, poi procedi con l'analisi.
    
    **FORMATO OBBLIGATORIO - MOSTRA SEMPRE TUTTI I PARAMETRI:**
    
    Grazie per aver condiviso la tua foto! 📸 Ho completato l'analisi della tua pelle utilizzando la tecnologia AI dermocosmetica di Bonnie.
    
    📊 **ANALISI COMPLETA DELLA PELLE:**
    
    **Punteggio Generale:** {media}/100 - {interpretazione_basata_sul_punteggio}
    
    - **Rossori:** {valore}/100 - {descrizione_breve}
    - **Acne:** {valore}/100 - {descrizione_breve}
    - **Rughe:** {valore}/100 - {descrizione_breve}
    - **Pigmentazione:** {valore}/100 - {descrizione_breve}
    - **Pori Dilatati:** {valore}/100 - {descrizione_breve}
    - **Oleosità:** {valore}/100 - {descrizione_breve}
    - **Danni Solari:** {valore}/100 - {descrizione_breve}
    - **Occhiaie:** {valore}/100 - {descrizione_breve}
    - **Idratazione:** {valore}/100 - {descrizione_breve}
    - **Elasticità:** {valore}/100 - {descrizione_breve}
    - **Texture Uniforme:** {valore}/100 - {descrizione_breve}
    
    **DESCRIZIONI BREVI STANDARD:**
    - Per valori 0-30: "Ottimo"
    - Per valori 31-60: "Discreto" 
    - Per valori 61-80: "Da migliorare"
    - Per valori 81-100: "Critico"
    
    (Per idratazione, elasticità e texture_uniforme inverti la valutazione: valori bassi = problema)
    
    **DOPO L'ANALISI - REGOLA OBBLIGATORIA:**
    SE NESSUN PARAMETRO HA PUNTEGGIO ≥61, aggiungi SEMPRE subito dopo l'analisi: "Basandomi sull'analisi AI, la tua pelle mostra un ottimo stato di salute generale, e non sono state rilevate problematiche significative che richiedano approfondimenti immediati. Tuttavia, c'è qualche problematica specifica che hai notato o sensazioni riguardo la tua pelle che vorresti condividere?"

2.  **Se l'utente descrive la sua pelle:** Analizza il testo per identificare le **Problematiche Principali**.

### Fase 3: Approfondimento Guidato e Dinamico (Il Questionario Prioritizzato)
DOPO aver presentato TUTTI gli 11 parametri e aver gestito eventuali preoccupazioni dell'utente (se nessun parametro ≥61), procedi con:

**SE HAI PARAMETRI CON PUNTEGGIO ≥61:**
Procedi con domande specifiche SOLO sui 2-3 parametri con punteggi più alti:

**SE NESSUN PARAMETRO HA PUNTEGGIO ≥61:**
Dopo aver ricevuto la risposta dell'utente alle preoccupazioni specifiche, procedi direttamente alla Fase 4.

1.  **Domande Immediate sui Parametri PIÙ Critici:** Fai UNA domanda alla volta, iniziando dal punteggio più alto:
    - **Rossori ≥61:** "I rossori compaiono in situazioni specifiche (sole, vento, prodotti, stress)?"
    - **Acne ≥61:** "I brufoli compaiono principalmente in zona T, guance o altre aree?"
    - **Pori Dilatati ≥61:** "I pori dilatati sono concentrati in una zona specifica?"
    - **Oleosità ≥61:** "L'oleosità è più evidente al mattino o durante la giornata?"
    - **Pigmentazione ≥61:** "Le macchie sono comparse gradualmente o dopo il sole?"
    - **Rughe ≥61:** "Le rughe sono più evidenti al risveglio?"
    - **Idratazione ≤40:** "Senti la pelle tirare dopo la detersione?"
    - **Elasticità ≤40:** "Hai notato perdita di compattezza di recente?"

2.  **Priorità Assoluta:** Concentrati SOLO sui parametri con punteggi ≥70 per le prime domande

3.  **Procedura:** Una domanda alla volta, aspetta risposta, poi procedi con il parametro successivo in ordine di gravità

### Fase 4: Resoconto Finale e Proposta di Routine
1.  Chiedi conferma all'utente per procedere al resoconto.
2.  Genera il riepilogo **Problematica -> Ingrediente**, basandoti su TUTTE le informazioni raccolte.
3.  Chiedi se l'utente desidera la routine personalizzata.
4.  **IMPORTANTE: Quando l'utente risponde "Sì", "Si", "sì", "si", "yes", "YES" o simili, NON ripetere la domanda.** Procedi IMMEDIATAMENTE a fornire la routine personalizzata completa che deve includere:
    - **Mattina:** Detergente, siero/trattamento, crema idratante, protezione solare
    - **Sera:** Detergente, siero/trattamento specifico, crema notte
    - **Settimanale:** Eventuali trattamenti extra (maschere, esfolianti)
    - **Ingredienti chiave** consigliati basati sull'analisi
    - **Consigli pratici** per l'applicazione
    Concludi sempre con il link: \`https://tinyurl.com/bonnie-beauty\`. Se risponde "No" o negativamente, ringrazia e fornisci solo il link finale.`;

export interface ChatResponse {
  content: string;
  hasChoices: boolean;
  choices?: string[];
  isComplete?: boolean;
}

export class GeminiService {
  private conversationHistory: Array<{ role: string; content: string }> = [];

  async initializeConversation(userName: string): Promise<ChatResponse> {
    // Start with the user's name
    this.conversationHistory = [
      { role: "user", content: userName }
    ];

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        },
        contents: this.conversationHistory.map(msg => ({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }]
        }))
      });

      const content = response.text || "Ciao! Come posso aiutarti oggi?";
      this.conversationHistory.push({ role: "assistant", content });

      return {
        content,
        hasChoices: false
      };
    } catch (error) {
      console.error("Error initializing conversation:", error);
      throw new Error("Failed to initialize conversation with Bonnie");
    }
  }

  async sendMessageWithImage(imagePath: string, message?: string): Promise<ChatResponse> {
    try {
      // Read the image file
      const fs = await import('fs');
      const imageData = fs.readFileSync(imagePath);
      const base64Image = imageData.toString('base64');
      
      // Get the mime type from file extension
      const path = await import('path');
      const ext = path.extname(imagePath).toLowerCase();
      let mimeType = 'image/jpeg';
      if (ext === '.png') mimeType = 'image/png';
      if (ext === '.gif') mimeType = 'image/gif';
      if (ext === '.webp') mimeType = 'image/webp';

      // Create the content with image and optional text
      const parts: any[] = [
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeType
          }
        }
      ];
      
      if (message) {
        parts.push({ text: message });
      }

      // Use conversation history for context
      const contents = this.conversationHistory.map(msg => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
      }));
      
      // Add the new content with image
      contents.push({
        role: "user",
        parts: parts as any
      });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        },
        contents: contents
      });

      const content = response.text || "Mi dispiace, non riesco ad analizzare l'immagine. Puoi riprovare?";
      
      // Add to conversation history
      const userMessage = message ? `${message} [Immagine analizzata]` : "[Immagine analizzata]";
      this.conversationHistory.push({ role: "user", content: userMessage });
      this.conversationHistory.push({ role: "assistant", content });

      // Check if the response contains multiple choice options
      const hasChoices = this.detectMultipleChoice(content);
      const choices = hasChoices ? this.extractChoices(content) : undefined;

      return {
        content,
        hasChoices,
        choices
      };
    } catch (error) {
      console.error("Error sending message with image:", error);
      throw new Error("Failed to analyze image with Bonnie");
    }
  }

  async sendMessage(message: string): Promise<ChatResponse> {
    this.conversationHistory.push({ role: "user", content: message });

    try {
      // Enhance the message with RAG context
      const conversationContext = this.conversationHistory
        .slice(-5) // Get last 5 messages for context
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');
      
      const enhancedMessage = await ragService.enhanceQueryWithRAG(message, conversationContext);
      
      // Use the enhanced message for the AI request
      const contents = this.conversationHistory.slice(0, -1).map(msg => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
      }));
      
      // Add the enhanced current message
      contents.push({
        role: "user",
        parts: [{ text: enhancedMessage }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        },
        contents: contents
      });

      const content = response.text || "Mi dispiace, non ho capito. Puoi ripetere?";
      this.conversationHistory[this.conversationHistory.length - 1] = { role: "user", content: message }; // Keep original message in history
      this.conversationHistory.push({ role: "assistant", content });

      // Auto-learning: Check if this is a successful conversation milestone
      await this.checkAndSaveSuccessfulConversation(content);

      // Check if the response contains multiple choice options
      const hasChoices = this.detectMultipleChoice(content);
      const choices = hasChoices ? this.extractChoices(content) : undefined;

      return {
        content,
        hasChoices,
        choices,
        isComplete: this.isConversationComplete(content)
      };
    } catch (error) {
      console.error("Error sending message:", error);
      throw new Error("Failed to get response from Bonnie");
    }
  }

  private detectMultipleChoice(content: string): boolean {
    // Look for pattern like "A) option" or "A. option"
    const multipleChoicePattern = /[A-Z]\)\s+.+/g;
    const matches = content.match(multipleChoicePattern);
    return matches !== null && matches.length > 1;
  }

  private extractChoices(content: string): string[] {
    const choicePattern = /[A-Z]\)\s+(.+)/g;
    const choices: string[] = [];
    let match;
    
    while ((match = choicePattern.exec(content)) !== null) {
      choices.push(match[1].trim());
    }
    
    return choices;
  }

  getConversationHistory(): Array<{ role: string; content: string }> {
    return [...this.conversationHistory];
  }

  clearConversation(): void {
    this.conversationHistory = [];
  }

  private async checkAndSaveSuccessfulConversation(latestResponse: string): Promise<void> {
    try {
      // Check if this is a successful conversation milestone
      const isSuccessful = this.isConversationSuccessful(latestResponse);
      
      if (isSuccessful && this.conversationHistory.length >= 6) {
        // Save the conversation to knowledge base
        await this.saveConversationToKnowledgeBase();
      }
    } catch (error) {
      console.error("Error in auto-learning:", error);
      // Non-blocking error, continue normally
    }
  }

  private isConversationSuccessful(response: string): boolean {
    // Detect successful conversation patterns
    const successIndicators = [
      "routine personalizzata",
      "resoconto finale",
      "bonnie-beauty",
      "ingredienti consigliati",
      "problematiche identificate"
    ];
    
    return successIndicators.some(indicator => 
      response.toLowerCase().includes(indicator)
    );
  }

  private isConversationComplete(response: string): boolean {
    // Check if conversation has reached completion
    return response.toLowerCase().includes("bonnie-beauty") || 
           response.toLowerCase().includes("routine personalizzata");
  }

  private async saveConversationToKnowledgeBase(): Promise<void> {
    try {
      // Create a structured conversation document
      const conversationDoc = this.createConversationDocument();
      
      // Save to RAG knowledge base
      await ragService.addConversationToKnowledge(conversationDoc);
      
      console.log("✅ Successful conversation saved to knowledge base");
    } catch (error) {
      console.error("Error saving conversation to knowledge base:", error);
    }
  }

  private createConversationDocument(): any {
    const userMessages = this.conversationHistory.filter(msg => msg.role === "user");
    const assistantMessages = this.conversationHistory.filter(msg => msg.role === "assistant");
    
    // Extract key information
    const skinConcerns = this.extractSkinConcerns();
    const recommendations = this.extractRecommendations();
    const conversationFlow = this.extractConversationFlow();
    
    return {
      timestamp: new Date().toISOString(),
      type: "successful_conversation",
      skinConcerns,
      recommendations,
      conversationFlow,
      userQuestions: userMessages.map(msg => msg.content),
      successfulResponses: assistantMessages.map(msg => msg.content),
      conversationLength: this.conversationHistory.length,
      metadata: {
        hasImageAnalysis: this.conversationHistory.some(msg => 
          msg.content.includes("Analisi AI della pelle")
        ),
        completedSuccessfully: true
      }
    };
  }

  private extractSkinConcerns(): string[] {
    const concerns: string[] = [];
    const concernKeywords = [
      "acne", "brufoli", "rossori", "rughe", "macchie", "pori dilatati",
      "oleosità", "secchezza", "sensibilità", "discromie", "elasticità"
    ];
    
    const allText = this.conversationHistory.join(" ").toLowerCase();
    
    concernKeywords.forEach(keyword => {
      if (allText.includes(keyword)) {
        concerns.push(keyword);
      }
    });
    
    return concerns;
  }

  private extractRecommendations(): string[] {
    const recommendations: string[] = [];
    const ingredients = [
      "bardana", "mirto", "elicriso", "centella asiatica", "liquirizia",
      "malva", "ginkgo biloba", "amamelide", "kigelia africana"
    ];
    
    const allText = this.conversationHistory.join(" ").toLowerCase();
    
    ingredients.forEach(ingredient => {
      if (allText.includes(ingredient)) {
        recommendations.push(ingredient);
      }
    });
    
    return recommendations;
  }

  private extractConversationFlow(): Array<{question: string, answer: string}> {
    const flow: Array<{question: string, answer: string}> = [];
    
    for (let i = 0; i < this.conversationHistory.length - 1; i++) {
      const current = this.conversationHistory[i];
      const next = this.conversationHistory[i + 1];
      
      if (current.role === "user" && next.role === "assistant") {
        flow.push({
          question: current.content,
          answer: next.content
        });
      }
    }
    
    return flow;
  }
}
