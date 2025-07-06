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

IMPORTANTE: Quando ricevi questi dati JSON, devi sempre commentare TUTTI i parametri ricevuti, anche quelli con punteggi bassi, spiegando cosa significano per la pelle dell'utente.

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
1.  **Se hai ricevuto i dati dell'analisi foto:** Devi SEMPRE iniziare con un riepilogo completo dell'analisi che includa:
    - Saluto personalizzato con il nome utente
    - Panoramica generale dello stato della pelle
    - Commento su TUTTI gli 11 parametri ricevuti, spiegando cosa significano
    - Identificazione delle 2-3 **Problematiche Principali** (punteggi più alti)
    - Menzione anche dei punti di forza (punteggi bassi/buoni)
    
    Esempio: "Ciao NOME! Ho analizzato la tua foto e ho rilevato questi parametri: rossori a {valore}, acne a {valore}, rughe a {valore}, pigmentazione a {valore}, pori dilatati a {valore}, oleosità a {valore}, danni solari a {valore}, occhiaie a {valore}, idratazione a {valore}, elasticità a {valore}, texture uniforme a {valore}. Le problematiche principali che noto sono..."

2.  **Se l'utente descrive la sua pelle:** Analizza il testo per identificare le **Problematiche Principali**.

### Fase 3: Approfondimento Guidato e Dinamico (Il Questionario Prioritizzato)
1.  **Domande Primarie:** Poni le domande del questionario (dalla Sezione A) che sono **direttamente collegate** alle Problematiche Principali identificate.
2.  **Domande Secondarie:** Dopo aver approfondito, procedi con le domande più generali sul profilo della pelle. Applica la logica della Sezione C se necessario.
3.  **Domande Finali:** Concludi con le domande sullo stile di vita, raggruppandole.

### Fase 4: Resoconto Finale e Proposta di Routine
1.  Chiedi conferma all'utente per procedere al resoconto.
2.  Genera il riepilogo **Problematica -> Ingrediente**, basandoti su TUTTE le informazioni raccolte.
3.  Chiedi se l'utente desidera la routine personalizzata.
4.  Gestisci la sua risposta ("Sì" o "No") fornendo la risposta appropriata e includendo sempre il link finale: \`https://tinyurl.com/bonnie-beauty\`.`;

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
      const parts = [
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
        parts: parts
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

      // Check if the response contains multiple choice options
      const hasChoices = this.detectMultipleChoice(content);
      const choices = hasChoices ? this.extractChoices(content) : undefined;

      return {
        content,
        hasChoices,
        choices
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
}
