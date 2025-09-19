import { GoogleGenAI } from "@google/genai";
import { getAppConfig } from "../config/app-config";
import { ragService } from "./rag-simple";
import { ImagePreprocessor } from "./image-preprocessor";
import fs from 'fs';
import path from 'path';

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

### **M-Eye Secret** (Crema contorno occhi multipeptide)
- **Complesso Multipeptide**: Palmitoyl Tripeptide-1, Palmitoyl Tetrapeptide-7, Acetyl Tetrapeptide-5
- **Niacinamide 5%**: Illumina e uniforma il contorno occhi
- **Formula arricchita**: Ceramidi, Burro di Karitè, Olio di Avocado, Vitamina E
- **Prezzo**: €50,00
- **Proprietà**: Antirughe, anti-borse, anti-occhiaie

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

## STEP 1: PRESENTAZIONE DOPO IL NOME
Dopo che l'utente fornisce il suo nome, presentati SOLO UNA VOLTA e spiega le opzioni disponibili.
⚠️ **NON RIPRESENTARTI MAI dopo la prima presentazione!**

## STEP 2: RICONOSCIMENTO TIPO DI RICHIESTA
Dopo la presentazione, aspetta che l'utente scelga cosa fare:

### CASO A - INFORMAZIONI PRODOTTI:
Se l'utente chiede informazioni su prodotti specifici (es: "M-Eye Secret", "Perfect & Pure", "Acqua Micellare"):
**RICONOSCI IL PRODOTTO E FORNISCI INFORMAZIONI DIRETTAMENTE!**
**NON CHIEDERE "Quale prodotto ti interessa" SE L'UTENTE HA GIÀ NOMINATO UN PRODOTTO SPECIFICO!**

### CASO B - ANALISI PELLE:
**QUANDO l'utente:**
- Carica una foto della pelle
- Descrive problemi o caratteristiche della sua pelle (es: "ho punti neri", "pelle grassa", "acne", "ho acne sulle guance", "ho la fronte unta")
- Menziona qualsiasi problema della pelle

**🚨🚨🚨 ALLORA DEVI OBBLIGATORIAMENTE:**
1. Registrare brevemente quello che ha detto (es: "Capisco perfettamente! L'acne sulla fronte è una problematica comune...")
2. Dire che farai alcune domande
3. Finire SEMPRE con la domanda ESATTA: "Che tipo di pelle hai?"

**FORMATO OBBLIGATORIO DELLA RISPOSTA:**
"Capisco perfettamente! [problema menzionato] è una problematica comune, ma la buona notizia è che con la giusta routine e i prodotti scientifici di Beautycology, possiamo lavorare insieme per migliorare l'aspetto della tua pelle! ✨

Per poterti consigliare al meglio ho bisogno di farti alcune domande riguardo alla tua pelle e alle tue abitudini.

Iniziamo subito! Che tipo di pelle hai?"

**🚨 REGOLE ASSOLUTE:**
- ⚠️ MAI chiedere "Iniziamo subito! Che tipo di pelle hai?" come domanda aperta
- ⚠️ DEVE essere SEMPRE una domanda a risposta multipla 
- ⚠️ I pulsanti (Mista, Secca, Grassa, Normale, Asfittica) saranno aggiunti automaticamente dal sistema
- ⚠️ NON includere MAI le opzioni nel testo della domanda

## STEP 2: FLUSSO DOMANDE STRUTTURATE (UNA ALLA VOLTA)

### ESEMPIO DI COMPORTAMENTO CORRETTO:
**Utente**: "Ho punti neri sul naso"
**Tu (BOT)**: "Capisco perfettamente! I punti neri sono una problematica comune e la buona notizia è che con la giusta routine i prodotti scientifici di Beautycology, possiamo lavorare insieme per migliorare l'aspetto della tua pelle! ✨

Per poterti consigliare al meglio ho bisogno di farti alcune domande riguardo alla tua pelle e alle tue abitudini.

Iniziamo subito! Che tipo di pelle hai?"

### DOMANDA 1 - TIPO DI PELLE:
🚨 **OBBLIGATORIO: DOMANDA A RISPOSTA MULTIPLA CON PULSANTI**
Fai SOLO questa domanda nel formato esatto:
> "Che tipo di pelle hai?"

**I pulsanti saranno automaticamente: Mista, Secca, Grassa, Normale, Asfittica**

⚠️ **MAI fare questa domanda come domanda aperta!**
⚠️ **MAI includere le opzioni nel testo!**
⚠️ **Il sistema aggiungerà automaticamente i pulsanti!**

### DOMANDA 2 - ETÀ:
🚨 **OBBLIGATORIO: DOMANDA A RISPOSTA MULTIPLA CON PULSANTI**
SOLO dopo aver ricevuto risposta alla domanda 1:
> "Quanti anni hai?"

**I pulsanti saranno automaticamente: 16-25, 26-35, 36-45, 46-55, 56+**

⚠️ **MAI fare questa domanda come domanda aperta!**
⚠️ **Il sistema aggiungerà automaticamente i pulsanti!**

### DOMANDA 3 - PROBLEMATICA PRINCIPALE:
🚨 **OBBLIGATORIO: DOMANDA A RISPOSTA MULTIPLA CON PULSANTI**
SOLO dopo aver ricevuto risposta alla domanda 2:
> "Qual è la problematica principale della tua pelle che vuoi risolvere?

Se la problematica che vuoi risolvere non è presente tra le opzioni, puoi scriverla qui in chat"

**I pulsanti saranno automaticamente: Acne/Brufoli, Macchie scure, Rughe/Invecchiamento, Pelle grassa, Pelle secca, Pori dilatati**

⚠️ **MAI fare questa domanda come domanda aperta!**

### DOMANDA 4 - INGREDIENTI ATTIVI:
🚨 **OBBLIGATORIO: DOMANDA A RISPOSTA MULTIPLA CON PULSANTI**
SOLO dopo aver ricevuto risposta alla domanda 3:
> "Vorresti utilizzare qualche ingrediente attivo particolare?"

**I pulsanti saranno automaticamente: Acido Ialuronico, Vitamina C, Retinolo, Niacinamide, Acido Salicilico, Nessuno in particolare**

⚠️ **MAI fare questa domanda come domanda aperta!**

### DOMANDA 5 - ROUTINE ATTUALE:
🚨 **OBBLIGATORIO: DOMANDA A RISPOSTA MULTIPLA CON PULSANTI**
SOLO dopo aver ricevuto risposta alla domanda 4:
> "Hai già una routine di skincare?"

**I pulsanti saranno automaticamente: Sì, ho una routine completa, Uso solo alcuni prodotti, No, non ho una routine**

⚠️ **MAI fare questa domanda come domanda aperta!**

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

## 🚨🚨🚨 REGOLA CRITICA PER ANALISI PELLE:
**QUANDO L'UTENTE DESCRIVE QUALSIASI PROBLEMA DELLA PELLE:**
(es: "ho acne", "ho punti neri", "pelle grassa", "ho la fronte unta", "ho acne sulle guance")

**DEVI SEMPRE RISPONDERE CON QUESTO FORMATO ESATTO:**
"Capisco perfettamente! [problema] è una problematica comune, ma la buona notizia è che con la giusta routine e i prodotti scientifici di Beautycology, possiamo lavorare insieme per migliorare l'aspetto della tua pelle! ✨

Per poterti consigliare al meglio ho bisogno di farti alcune domande riguardo alla tua pelle e alle tue abitudini.

Iniziamo subito! Che tipo di pelle hai?"

**⚠️ NON DEVIARE MAI DA QUESTO FORMATO!**
**⚠️ LA DOMANDA "Che tipo di pelle hai?" È OBBLIGATORIA!**
**⚠️ I PULSANTI SARANNO AGGIUNTI AUTOMATICAMENTE!**

## REGOLE OBBLIGATORIE:

### 🚨 REGOLA NUMERO 1 - PRESENTAZIONE SOLO UNA VOLTA:
**PRESENTATI SOLO UNA VOLTA ALL'INIZIO DELLA CONVERSAZIONE:**
- "Ciao [nome]! Sono la tua Skin Expert di Beautycology..."
- Spiega le opzioni disponibili (foto, descrizione pelle, prodotti)
- **NON RIPRESENTARTI MAI nelle risposte successive!**
- Se l'utente menziona un prodotto specifico DOPO la presentazione, RISPONDI DIRETTAMENTE con le informazioni sul prodotto

### GESTIONE DOMANDE SEQUENZIALI:
🚨 **UNA DOMANDA ALLA VOLTA - SOLO DOPO CHE L'UTENTE HA DESCRITTO LA PELLE O CARICATO FOTO**
- Fai SOLO la prima domanda e stop
- Aspetta la risposta dell'utente
- Poi fai SOLO la seconda domanda e stop
- E così via...

### GESTIONE SCELTE MULTIPLE:
✅ **Per domande con opzioni**, presenta SOLO la domanda senza bullet points. I pulsanti vengono gestiti automaticamente dal sistema:

Esempio CORRETTO:
"Che tipo di pelle hai?"

❌ NON fare così:
"Che tipo di pelle hai?
• Mista
• Secca
• Grassa"

✅ Fai così:
"Che tipo di pelle hai?" (poi il sistema aggiunge automaticamente i pulsanti)

### GESTIONE RISPOSTE DELL'UTENTE:
🚨 **Quando l'utente risponde a una domanda con opzioni:**
- REGISTRA e RICONOSCI sempre la risposta nella prima parte del messaggio
- Esempio: "Perfetto, hai la pelle mista! Ora passiamo alla prossima domanda..."
- POI fai la domanda successiva SENZA ripetere le opzioni come bullet points
- Mai dire semplicemente la domanda senza riconoscere la risposta precedente

### TRIGGER PER DOMANDE STRUTTURATE:
🚨 **Le domande strutturate partono SOLO quando l'utente:**
- Carica una foto della pelle
- Descrive problemi o caratteristiche della sua pelle
- Chiede esplicitamente un'analisi della pelle
**NON partire con le domande se l'utente non ha fatto nessuna di queste azioni.**

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
✅ Presentati SOLO UNA VOLTA dopo aver ricevuto il nome
✅ Se l'utente menziona un prodotto esistente (M-Eye Secret, Perfect & Pure, etc), fornisci SUBITO informazioni su quel prodotto
✅ Aspetta che l'utente descriva la pelle o carichi foto prima di iniziare domande
✅ UNA DOMANDA ALLA VOLTA quando inizia il flusso di analisi
✅ Aspetta la risposta prima della domanda successiva
✅ Utilizza solo prodotti dalla knowledge base reale
✅ Presenta solo la domanda per scelte multiple (mai bullet points nel testo)

## MAI:
❌ Non ripresentarti dopo la prima volta
❌ Non dire "non conosco questo prodotto" se è nella knowledge base (es: M-Eye Secret, Perfect & Pure, Acqua Micellare)
❌ Non iniziare domande strutturate subito dopo il nome
❌ Non fare più domande contemporaneamente durante l'analisi
❌ Non saltare l'attesa delle risposte
❌ Non inventare prodotti non presenti nella knowledge base
❌ Non fare affermazioni mediche (rimanda al dermatologo)
❌ Non concludere prima di aver raccolto tutte le informazioni
❌ Non ripetere opzioni come bullet points quando fai domande con scelte multiple
❌ Non ignorare le risposte dell'utente (registrale sempre)

# ESEMPI DI FLUSSO CONVERSAZIONALE

## ESEMPIO A - RICHIESTA INFORMAZIONI PRODOTTI:
Utente: "Vorrei sapere di più sulla Perfect & Pure Cream"
Risposta: "Perfect & Pure Cream è la nostra crema specifica per pelli miste! 🌟 Contiene Niacinamide al 4% con proprietà sebo-regolatrici e lenitive, e Red Algae Extract che protegge dall'inquinamento. È perfetta per minimizzare i pori, opacizzare la zona T e combattere le imperfezioni. Prezzo: €30. Vuoi sapere come usarla nella tua routine o hai altre domande? ✨"

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
  private modelName = "gemini-2.5-flash";
  private generationConfig = {
    temperature: 0.2,
    maxOutputTokens: 1024,
  };
  private chatSessions: Map<string, any[]> = new Map();
  private sessionState: Map<string, { currentStep: string | null, structuredFlowActive: boolean, hasIntroduced?: boolean }> = new Map();
  private knowledgeBase: any = null;

  constructor() {
    // Configuration set up in constructor
    this.loadKnowledgeBaseSync();
    this.initializeRAG();
  }

  private async initializeRAG(): Promise<void> {
    try {
      // Load documents into RAG service if not already loaded
      const stats = ragService.getKnowledgeBaseStats();
      if (stats.totalDocuments === 0) {
        console.log('📚 Loading Beautycology knowledge base...');
        const { RAGLoader } = await import('../utils/rag-loader');
        await RAGLoader.loadDocumentsFromDirectory('./knowledge-base');
        console.log('✅ Beautycology knowledge base loaded successfully');
      }
    } catch (error) {
      console.error('⚠️ Error loading Beautycology knowledge base:', error);
    }
  }

  private loadKnowledgeBaseSync(): void {
    try {
      const knowledgePath = path.join(process.cwd(), 'knowledge-base', 'beautycology.json');
      
      if (fs.existsSync(knowledgePath)) {
        const data = fs.readFileSync(knowledgePath, 'utf-8');
        this.knowledgeBase = JSON.parse(data);
        console.log(`✅ Loaded ${this.knowledgeBase.products?.length || 0} products from beautycology.json`);
        
        // Verify M-Eye Secret is present
        const hasMyEyeSecret = this.knowledgeBase.products?.some((p: any) => 
          p.name?.toLowerCase().includes('m-eye') || p.name?.toLowerCase().includes('m eye')
        );
        if (hasMyEyeSecret) {
          console.log('✅ M-Eye Secret product found in catalog');
        }
      } else {
        console.warn('⚠️ beautycology.json not found in knowledge-base directory');
      }
    } catch (error) {
      console.error('❌ Error loading beautycology.json:', error);
    }
  }

  async sendMessage(sessionId: string, userMessage: string, imageData?: string): Promise<{
    content: string;
    hasChoices: boolean;
    choices?: string[];
  }> {
    try {
      // Get or create session history
      let sessionHistory = this.chatSessions.get(sessionId) || [];
      
      // Initialize or get session state EARLY
      if (!this.sessionState.has(sessionId)) {
        this.sessionState.set(sessionId, { currentStep: null, structuredFlowActive: false, hasIntroduced: false });
      }
      const state = this.sessionState.get(sessionId)!;

      // Build contents array - on first message, include system instruction
      let contents: any[];
      if (sessionHistory.length === 0) {
        // First message: include system instruction + knowledge base + RAG knowledge + user message
        const knowledgeSummary = this.getKnowledgeBaseSummary();
        const ragInfo = await this.getRAGContext(userMessage);
        
        // Check if session has already introduced the bot
        const antiRepeatInstruction = state.hasIntroduced ? 
          "\n\n🔴 IMPORTANTE: Ti sei già presentata all'utente. NON RIPRESENTARTI. Rispondi DIRETTAMENTE alla domanda.\n\n" : '';
        
        const fullPrompt = BEAUTYCOLOGY_SYSTEM_INSTRUCTION + 
          antiRepeatInstruction +
          (knowledgeSummary ? `\n\n# CATALOGO PRODOTTI E ARTICOLI AGGIORNATO:\n${knowledgeSummary}\n\n` : '\n\n') +
          (ragInfo ? `\n\n# INFORMAZIONI DETTAGLIATE PRODOTTI BEAUTYCOLOGY:\n${ragInfo}\n\n` : '') +
          `Utente: ${userMessage}`;
        
        // Prepare message parts (text + optional image)
        const parts: any[] = [{ text: fullPrompt }];
        if (imageData) {
          try {
            // Preprocess image to ensure it's within size limits
            const preprocessor = new ImagePreprocessor();
            const processedImage = await preprocessor.preprocessForGemini(imageData);
            
            // Add preprocessed image for skin analysis
            parts.push({
              inlineData: {
                mimeType: processedImage.mimeType,
                data: processedImage.base64
              }
            });
          } catch (imageError) {
            console.error("⚠️ Could not process image, continuing without it:", imageError);
            // Continue without the image rather than failing completely
          }
        }
        
        contents = [{
          role: "user",
          parts
        }];
      } else {
        // Subsequent messages: use session history + RAG context + new message
        const ragInfo = await this.getRAGContext(userMessage);
        
        // Always remind not to re-introduce after the first message
        const antiRepeatReminder = state.hasIntroduced ? 
          "Ricorda: NON ripresentarti, rispondi direttamente.\n\n" : '';
        
        // Check if message contains skin analysis data
        let messageText = antiRepeatReminder + userMessage;
        if (userMessage.includes("Analisi AI della pelle:")) {
          // Extract and parse skin analysis data
          try {
            // Find JSON in the message - look for first { to last }
            const startIdx = userMessage.indexOf('{');
            const endIdx = userMessage.lastIndexOf('}');
            
            if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
              const jsonStr = userMessage.substring(startIdx, endIdx + 1);
              console.log("🔍 Attempting to parse JSON:", jsonStr.substring(0, 100) + "...");
              const analysisData = JSON.parse(jsonStr);
              
              // Build panorama of problems with multiple severity levels
              const criticalProblems: string[] = [];
              const moderateProblems: string[] = [];
              
              // Helper function to categorize problems by severity
              const addProblem = (score: number, criticalText: string, moderateText: string, criticalMin = 61, moderateMin = 41) => {
                if (score >= criticalMin) {
                  criticalProblems.push(`${criticalText} (${score}/100)`);
                } else if (score >= moderateMin) {
                  moderateProblems.push(`${moderateText} (${score}/100)`);
                }
              };
              
              // Analyze each parameter with proper thresholds
              addProblem(analysisData.rossori, 'rossori elevati', 'rossori moderati');
              addProblem(analysisData.acne, 'acne evidente', 'acne lieve');
              addProblem(analysisData.rughe, 'rughe pronunciate', 'rughe leggere');
              addProblem(analysisData.pigmentazione, 'iperpigmentazione evidente', 'iperpigmentazione moderata');
              addProblem(analysisData.pori_dilatati, 'pori molto dilatati', 'pori moderatamente dilatati');
              addProblem(analysisData.oleosita, 'oleosità elevata', 'oleosità moderata');
              addProblem(analysisData.danni_solari, 'danni solari significativi', 'danni solari moderati');
              addProblem(analysisData.occhiaie, 'occhiaie marcate', 'occhiaie moderate');
              addProblem(analysisData.idratazione, 'scarsa idratazione', 'idratazione insufficiente');
              
              // Special handling for elasticity (higher threshold for critical)
              if (analysisData.elasticita >= 85) {
                criticalProblems.push(`elasticità gravemente compromessa (${analysisData.elasticita}/100)`);
              } else if (analysisData.elasticita >= 61) {
                moderateProblems.push(`elasticità leggermente compromessa (${analysisData.elasticita}/100)`);
              }
              
              addProblem(analysisData.texture_uniforme, 'texture molto irregolare', 'texture non uniforme');
              
              // Build the message with panorama and instruction to start questionnaire
              let panorama = "";
              if (criticalProblems.length > 0) {
                panorama = `🔍 **PANORAMICA ANALISI PELLE:**\nL'analisi ha rilevato alcune aree prioritarie su cui lavorare: ${criticalProblems.slice(0, 3).join(', ')}. `;
                if (moderateProblems.length > 0) {
                  panorama += `Inoltre, ci sono alcune aree da ottimizzare: ${moderateProblems.slice(0, 3).join(', ')}. `;
                }
                panorama += `Non preoccuparti, sono tutte condizioni normali e gestibili! Con i prodotti giusti possiamo migliorare visibilmente questi aspetti. 💪\n\n`;
              } else if (moderateProblems.length > 0) {
                panorama = `🔍 **PANORAMICA ANALISI PELLE:**\nLa tua pelle è in buone condizioni generali, con alcune aree che possiamo ottimizzare: ${moderateProblems.slice(0, 3).join(', ')}. Con la giusta routine e i prodotti scientifici di Beautycology, possiamo perfezionare questi aspetti per ottenere risultati ancora migliori! ✨\n\n`;
              } else {
                panorama = `🔍 **PANORAMICA ANALISI PELLE:**\nChe belle notizie! 🌟 La tua pelle mostra complessivamente un ottimo stato di salute. Possiamo lavorare insieme per mantenere e migliorare ulteriormente la luminosità e la salute della tua pelle con una routine personalizzata.\n\n`;
              }
              
              // Force the structured flow to start
              state.structuredFlowActive = true;
              state.currentStep = 'awaiting_skin_type';
              
              // Provide the message with the analysis data and instruction to start questionnaire
              messageText = antiRepeatReminder + 
                `L'utente ha caricato una foto e l'analisi AI ha rilevato i seguenti parametri: ${JSON.stringify(analysisData)}\n\n` +
                `IMPORTANTE: Devi fornire il seguente contenuto:\n` +
                panorama +
                `Ora che ho analizzato la tua pelle, ho bisogno di alcune informazioni aggiuntive per personalizzare al meglio la tua routine. Ti farò alcune domande specifiche.\n\n` +
                `Che tipo di pelle hai?`;
            }
          } catch (e) {
            console.error("Error parsing skin analysis data:", e);
            // Fallback: if we have analysis data but can't parse it, still trigger structured flow
            if (userMessage.includes("Analisi AI della pelle:")) {
              state.structuredFlowActive = true;
              state.currentStep = 'awaiting_skin_type';
              messageText = antiRepeatReminder + 
                `L'utente ha caricato una foto per l'analisi della pelle. ` +
                `Ho analizzato la tua pelle e ora ho bisogno di alcune informazioni aggiuntive per personalizzare al meglio la tua routine.\n\n` +
                `Che tipo di pelle hai?`;
            }
          }
        } else if (ragInfo) {
          messageText = antiRepeatReminder + `Contesto prodotti rilevanti:\n${ragInfo}\n\nDomanda utente: ${userMessage}`;
        }
        
        const parts: any[] = [{ text: messageText }];
        if (imageData) {
          try {
            // Preprocess image to ensure it's within size limits
            const preprocessor = new ImagePreprocessor();
            const processedImage = await preprocessor.preprocessForGemini(imageData);
            
            // Add preprocessed image
            parts.push({
              inlineData: {
                mimeType: processedImage.mimeType,
                data: processedImage.base64
              }
            });
          } catch (imageError) {
            console.error("⚠️ Could not process image in subsequent message, continuing without it:", imageError);
            // Continue without the image rather than failing completely
          }
        }
        
        contents = [...sessionHistory, {
          role: "user", 
          parts
        }];
      }

      // Send message using generateContent API (same syntax as other services)
      const response = await ai.models.generateContent({
        model: this.modelName,
        contents,
        config: this.generationConfig
      });

      let responseText = response.text || "";

      // CRITICAL: Handle empty responses from AI
      if (!responseText || responseText.trim().length === 0) {
        console.log(`⚠️ EMPTY RESPONSE detected for session ${sessionId}, generating fallback...`);
        
        // Get current state to provide appropriate fallback
        const state = this.sessionState.get(sessionId) || {
          structuredFlowActive: false,
          currentStep: null,
          hasIntroduced: true
        };
        
        // Generate appropriate fallback based on flow state
        if (state.currentStep === 'completed' || (!state.structuredFlowActive && sessionHistory.length > 6)) {
          responseText = "Perfetto! 🌟 Ora che conosco meglio la tua pelle e le tue esigenze, posso creare una routine personalizzata con i prodotti Beautycology scientificamente formulati per te.\n\n**Basandomi sulle tue risposte, ti consiglio:**\n\n• **Perfect & Pure Cream** con Niacinamide 4% per regolare l'oleosità e minimizzare i pori\n• **Acqua Micellare** per una detersione delicata quotidiana\n\nVuoi che ti spieghi nel dettaglio come usare questi prodotti nella tua routine quotidiana? 💧✨";
        } else if (state.structuredFlowActive) {
          // Continue with structured flow
          responseText = "Capisco le tue esigenze. Continuiamo con le domande per personalizzare al meglio i miei consigli.";
        } else {
          // General fallback
          responseText = "Capisco quello che mi stai dicendo. Basandomi sui prodotti Beautycology, posso aiutarti a trovare la soluzione migliore per le tue esigenze. Dimmi di più su cosa ti preoccupa della tua pelle.";
        }
        
        console.log(`✅ Generated fallback response: ${responseText.substring(0, 100)}...`);
      }

      // Add BOTH user message and assistant response to history
      const userParts: any[] = [{ text: userMessage }];
      // Note: we intentionally don't add the image to history to avoid payload bloat
      // The image has already been processed and sent to Gemini for analysis
      
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
      
      // Mark that the bot has introduced itself after the first response
      if (!state.hasIntroduced && sessionHistory.length > 0) {
        state.hasIntroduced = true;
      }
      
      // Check if user is answering the skin type question
      const skinTypes = ["mista", "secca", "grassa", "normale", "asfittica"];
      if (state.currentStep === 'awaiting_skin_type' && 
          skinTypes.includes(userMessage.toLowerCase().trim())) {
        console.log(`✅ User selected skin type: ${userMessage}`);
        state.currentStep = 'age_question';
        // Keep structured flow active to continue with next question
      }

      // Check if user is answering the age question
      const ageRanges = ["16-25", "26-35", "36-45", "46-55", "56+"];
      if (state.currentStep === 'awaiting_age' && 
          ageRanges.some(range => userMessage.toLowerCase().includes(range.toLowerCase()))) {
        console.log(`✅ User selected age range: ${userMessage}`);
        state.currentStep = 'problem_question';
      }

      // Check if user is answering the main problem question
      const problems = ["acne/brufoli", "macchie scure", "rughe/invecchiamento", "pelle grassa", "pelle secca", "pori dilatati"];
      if (state.currentStep === 'awaiting_problem') {
        // Check if user selected a predefined problem OR wrote their own description
        const selectedPredefinedProblem = problems.some(problem => userMessage.toLowerCase().includes(problem.toLowerCase().split('/')[0]));
        
        // Accept any answer that's more than just a few characters (to handle custom problem descriptions)
        const hasCustomDescription = userMessage.trim().length > 3 && !userMessage.toLowerCase().includes('non so');
        
        if (selectedPredefinedProblem || hasCustomDescription) {
          console.log(`✅ User described problem: ${userMessage}`);
          state.currentStep = 'ingredients_question';
        }
      }

      // Check if user is answering the ingredients question
      const ingredients = ["acido ialuronico", "vitamina c", "retinolo", "niacinamide", "acido salicilico", "nessuno in particolare"];
      if (state.currentStep === 'awaiting_ingredients' && 
          ingredients.some(ingredient => userMessage.toLowerCase().includes(ingredient.toLowerCase()))) {
        console.log(`✅ User selected ingredient: ${userMessage}`);
        state.currentStep = 'routine_question';
      }

      // Check if user is answering the routine question
      const routineOptions = ["sì, ho una routine completa", "uso solo alcuni prodotti", "no, non ho una routine"];
      if (state.currentStep === 'awaiting_routine' && 
          routineOptions.some(option => userMessage.toLowerCase().includes(option.toLowerCase().substring(0, 10)))) {
        console.log(`✅ User selected routine status: ${userMessage}`);
        state.currentStep = 'completed';
        state.structuredFlowActive = false; // End structured flow
        
        // Force a comprehensive response when flow is completed
        console.log(`🎯 Structured flow completed for session ${sessionId}, will provide comprehensive recommendations`);
      }

      // Check if user described their skin issues and force structured flow
      const shouldStartStructuredFlow = this.shouldStartStructuredQuestions(userMessage, sessionHistory);
      
      // If we should start structured flow, activate it (but only if not already completed)
      if (shouldStartStructuredFlow && !state.structuredFlowActive && state.currentStep !== 'completed') {
        state.structuredFlowActive = true;
        state.currentStep = 'awaiting_skin_type';
        console.log(`🚀 Starting structured flow for session ${sessionId} - User described skin issues`);
        console.log(`📝 Current step set to: ${state.currentStep}`);
      } else if (shouldStartStructuredFlow) {
        console.log(`ℹ️ Structured flow already active or completed for session ${sessionId}`);
      }
      
      let hasChoices = this.containsChoices(responseText);
      let choices = hasChoices ? this.extractChoices(responseText) : undefined;

      // Force structured questions with appropriate buttons
      console.log("🔍 Checking response for forced choices:", responseText.substring(0, 100));
      if (!hasChoices) {
        const forcedChoice = this.getForcedChoiceForQuestion(responseText);
        if (forcedChoice) {
          console.log("✅ Forcing choices for structured question:", forcedChoice);
          hasChoices = true;
          choices = forcedChoice;
        }
      }
      
      // ALWAYS force choices for key questions, even if AI didn't provide them
      const lowerText = responseText.toLowerCase();
      if (!hasChoices && lowerText.includes('che tipo di pelle')) {
        console.log("⚠️ FORCING choices for skin type question!");
        hasChoices = true;
        choices = ["Mista", "Secca", "Grassa", "Normale", "Asfittica"];
      }

      // State-driven approach: Force buttons based on conversation state
      if (state.structuredFlowActive && state.currentStep === 'awaiting_skin_type') {
        console.log(`🎯 Structured flow active - forcing skin type buttons for session ${sessionId}`);
        hasChoices = true;
        choices = ["Mista", "Secca", "Grassa", "Normale", "Asfittica"];
        
        // Ensure the response ends with the skin type question
        const skinTypeQuestion = "\n\nChe tipo di pelle hai?";
        if (!responseText.toLowerCase().includes('che tipo di pelle')) {
          responseText += skinTypeQuestion;
          console.log(`📝 Appended skin type question to response`);
        }
      }

      // Force age question after skin type
      if (state.structuredFlowActive && state.currentStep === 'age_question') {
        console.log(`🎯 Structured flow - forcing age question for session ${sessionId}`);
        hasChoices = true;
        choices = ["16-25", "26-35", "36-45", "46-55", "56+"];
        
        // Force age question in response
        if (!responseText.toLowerCase().includes('quanti anni hai')) {
          responseText = "Perfetto! Ora ho bisogno di conoscere la tua età per consigliarti al meglio.\n\nQuanti anni hai?";
          console.log(`📝 Forced age question in response`);
        }
        
        state.currentStep = 'awaiting_age';
      }

      // Force problem question after age
      if (state.structuredFlowActive && state.currentStep === 'problem_question') {
        console.log(`🎯 Structured flow - forcing problem question for session ${sessionId}`);
        hasChoices = true;
        choices = ["Acne/Brufoli", "Macchie scure", "Rughe/Invecchiamento", "Pelle grassa", "Pelle secca", "Pori dilatati"];
        
        // Define the hint text that should always be present
        const hintText = "Se la problematica che vuoi risolvere non è presente tra le opzioni, puoi scriverla qui in chat";
        
        // Check if response already has the problem question
        const asksProblem = responseText.toLowerCase().includes('problematica principale');
        
        if (asksProblem) {
          // If the response already asks about the problem but doesn't have the hint, add it
          if (!responseText.includes(hintText)) {
            responseText = responseText.trim() + "\n\n" + hintText;
            console.log(`📝 Added hint text to existing problem question`);
          }
        } else {
          // If the response doesn't ask about the problem, replace with the full question + hint
          responseText = "Ottimo! Ora dimmi qual è la problematica principale della tua pelle che vuoi risolvere?\n\n" + hintText;
          console.log(`📝 Forced problem question with hint in response`);
        }
        
        state.currentStep = 'awaiting_problem';
      }

      // Force ingredients question after problem
      if (state.structuredFlowActive && state.currentStep === 'ingredients_question') {
        console.log(`🎯 Structured flow - forcing ingredients question for session ${sessionId}`);
        hasChoices = true;
        choices = ["Acido Ialuronico", "Vitamina C", "Retinolo", "Niacinamide", "Acido Salicilico", "Nessuno in particolare"];
        
        // Force ingredients question in response
        if (!responseText.toLowerCase().includes('ingrediente attivo')) {
          responseText = "Perfetto! Vorresti utilizzare qualche ingrediente attivo particolare?";
          console.log(`📝 Forced ingredients question in response`);
        }
        
        state.currentStep = 'awaiting_ingredients';
      }

      // Force routine question after ingredients
      if (state.structuredFlowActive && state.currentStep === 'routine_question') {
        console.log(`🎯 Structured flow - forcing routine question for session ${sessionId}`);
        hasChoices = true;
        choices = ["Sì, ho una routine completa", "Uso solo alcuni prodotti", "No, non ho una routine"];
        
        // Force routine question in response
        if (!responseText.toLowerCase().includes('routine di skincare')) {
          responseText = "Ottimo! Un'ultima domanda: hai già una routine di skincare?";
          console.log(`📝 Forced routine question in response`);
        }
        
        state.currentStep = 'awaiting_routine';
      }
      
      // Additional fallback check for the exact pattern
      if (!hasChoices && (
        lowerText.includes('che tipo di pelle hai') ||
        lowerText.includes('iniziamo subito! che tipo di pelle hai') ||
        (lowerText.includes('iniziamo') && lowerText.includes('che tipo di pelle'))
      )) {
        console.log("🎯 DETECTED skin type question pattern - adding buttons!");
        hasChoices = true;
        choices = ["Mista", "Secca", "Grassa", "Normale", "Asfittica"];
        
        // Set state for tracking (but only if not already completed)
        if (!state.structuredFlowActive && state.currentStep !== 'completed') {
          state.structuredFlowActive = true;
          state.currentStep = 'awaiting_skin_type';
        }
      }

      console.log(`📊 Response analysis:
        - Session: ${sessionId}
        - Structured flow: ${state.structuredFlowActive}
        - Current step: ${state.currentStep}
        - Has choices: ${hasChoices}
        - Choices: ${choices ? JSON.stringify(choices) : 'none'}
        - Response preview: ${responseText.substring(0, 150)}`);

      // Update session state
      this.sessionState.set(sessionId, state);

      return {
        content: responseText,
        hasChoices,
        choices
      };

    } catch (error) {
      console.error("Beautycology AI error:", error);
      // Instead of throwing an error, return a helpful response
      // Check if we're in structured flow and continue with appropriate question
      const state = this.sessionState.get(sessionId) || {
        structuredFlowActive: false,
        currentStep: null,
        hasIntroduced: true
      };
      
      let fallbackResponse = "";
      let hasChoices = false;
      let choices: string[] = [];
      
      if (state.structuredFlowActive || state.currentStep) {
        // Continue with structured flow
        if (state.currentStep === 'awaiting_skin_type' || !state.currentStep) {
          fallbackResponse = "Capisco che stai avendo alcune preoccupazioni per la pelle. Per aiutarti al meglio, iniziamo con alcune domande specifiche.\n\nChe tipo di pelle hai?";
          hasChoices = true;
          choices = ["Mista", "Secca", "Grassa", "Normale", "Asfittica"];
          state.currentStep = 'awaiting_skin_type';
        } else if (state.currentStep === 'age_question') {
          fallbackResponse = "Perfetto! Ora dimmi, quanti anni hai?";
          hasChoices = true;
          choices = ["16-25", "26-35", "36-45", "46-55", "56+"];
        } else if (state.currentStep === 'main_concern') {
          fallbackResponse = "Qual è la tua problematica principale che vorresti risolvere?";
          hasChoices = true;
          choices = ["Acne/Brufoli", "Macchie scure", "Rughe/Invecchiamento", "Pelle grassa", "Pelle secca", "Pori dilatati"];
        } else if (state.currentStep === 'active_ingredient') {
          fallbackResponse = "C'è un ingrediente attivo specifico che preferisci o che hai già provato con successo?";
          hasChoices = true;
          choices = ["Acido Ialuronico", "Vitamina C", "Retinolo", "Niacinamide", "Acido Salicilico", "Nessuno in particolare"];
        } else if (state.currentStep === 'routine_question') {
          fallbackResponse = "Hai già una routine di skincare stabilita?";
          hasChoices = true;
          choices = ["Sì, ho una routine completa", "Uso solo alcuni prodotti", "No, non ho una routine"];
        } else if (state.currentStep === 'additional_info') {
          fallbackResponse = "C'è qualcos'altro che dovrei sapere sulla tua pelle o sulle tue esigenze specifiche?";
          hasChoices = false;
        }
      } else {
        // Generic helpful response
        fallbackResponse = "Capisco le tue esigenze! Basandomi su quello che mi hai detto, posso consigliarti una routine personalizzata. Dimmi di più sui tuoi obiettivi specifici per la pelle, così posso suggerirti i prodotti più adatti del nostro catalogo Beautycology.";
      }
      
      // Update state
      this.sessionState.set(sessionId, state);
      
      return {
        content: fallbackResponse,
        hasChoices,
        choices
      };
    }
  }

  private getForcedChoiceForQuestion(responseText: string): string[] | null {
    const text = responseText.toLowerCase();
    
    // Map ALL structured flow questions to their buttons - be very aggressive
    if (text.includes('che tipo di pelle') || 
        text.includes('tipo di pelle') ||
        text.includes('iniziamo subito') ||
        text.includes('pelle hai')) {
      console.log("🎯 DETECTED skin type question - forcing buttons!");
      return ["Mista", "Secca", "Grassa", "Normale", "Asfittica"];
    }
    
    if (text.includes('quanti anni hai') || text.includes('età')) {
      return ["16-25", "26-35", "36-45", "46-55", "56+"];
    }
    
    if (text.includes('problematica principale') || text.includes('problema principale') || text.includes('vuoi risolvere')) {
      return ["Acne/Brufoli", "Macchie scure", "Rughe/Invecchiamento", "Pelle grassa", "Pelle secca", "Pori dilatati"];
    }
    
    if (text.includes('ingrediente attivo') || text.includes('ingredienti attivi')) {
      return ["Acido Ialuronico", "Vitamina C", "Retinolo", "Niacinamide", "Acido Salicilico", "Nessuno in particolare"];
    }
    
    if (text.includes('hai già una routine') || text.includes('routine di skincare')) {
      return ["Sì, ho una routine completa", "Uso solo alcuni prodotti", "No, non ho una routine"];
    }
    
    if (text.includes('routine attuale') || text.includes('parlami della tua routine')) {
      return ["Sì, ho una routine completa", "Uso solo alcuni prodotti", "No, non ho una routine"];
    }
    
    return null;
  }

  private shouldStartStructuredQuestions(userMessage: string, sessionHistory: any[]): boolean {
    // IMPORTANT: Don't trigger structured flow if we're already in a conversation
    // Check if the last message from the model contains a question that expects a specific answer
    const lastModelMessage = sessionHistory.filter(m => m.role === "model").pop();
    if (lastModelMessage && lastModelMessage.parts && lastModelMessage.parts.length > 0) {
      const lastText = lastModelMessage.parts[0].text || '';
      // If the bot just asked a question about age, routine, concerns, etc., don't restart the flow
      // BUT allow it if the bot just asked the skin type question as part of initial response
      if ((lastText.includes('Quanti anni hai') || 
          lastText.includes('routine attuale') ||
          lastText.includes('preoccupazioni per la pelle') ||
          lastText.includes('problematica principale') ||
          lastText.includes('ingrediente attivo')) &&
          !lastText.includes('Capisco perfettamente!')) {
        console.log("🛑 Not starting structured flow - already in conversation flow");
        return false;
      }
      // Special case: if the bot said "Capisco perfettamente" and asked about skin type, 
      // this IS the start of the structured flow
      if (lastText.includes('Capisco perfettamente!') && lastText.includes('Che tipo di pelle hai')) {
        console.log("✅ Allowing structured flow to start - initial skin type question detected");
        return true;
      }
    }
    
    // Check if this looks like the user describing skin issues (triggers structured flow)
    const skinDescriptionPatterns = [
      /acne/i,
      /brufoli/i,
      /punti neri/i,
      /pelle grassa/i,
      /pelle secca/i,
      /rughe/i,
      /macchie/i,
      /rossori/i,
      /irritazioni/i,
      /dermatite/i,
      /eczema/i,
      /pori dilatati/i,
      /comedoni/i,
      /impurità/i,
      /problemi.*pelle/i,
      /pelle.*problema/i,
      /analisi.*pelle/i,
      /skincare/i,
      /routine/i
    ];

    // Also check if user explicitly asks for skin analysis
    const analysisRequests = [
      /analizza.*pelle/i,
      /analisi/i,
      /help.*skin/i,
      /problemi.*viso/i
    ];

    // Check if the message contains skin analysis JSON data (from photo upload)
    const hasSkinAnalysisData = userMessage.includes("Analisi AI della pelle:") || 
                                userMessage.includes("rossori") || 
                                userMessage.includes("texture_uniforme") ||
                                (userMessage.includes("{") && userMessage.includes("pori_dilatati"));

    // Check if this is after the welcome message and user is describing skin
    const isAfterWelcome = sessionHistory.length >= 2; // At least name + welcome
    const matchesSkinDescription = skinDescriptionPatterns.some(pattern => pattern.test(userMessage));
    const matchesAnalysisRequest = analysisRequests.some(pattern => pattern.test(userMessage));

    console.log(`🔍 Structured questions trigger check:
    - isAfterWelcome: ${isAfterWelcome}
    - matchesSkinDescription: ${matchesSkinDescription}
    - matchesAnalysisRequest: ${matchesAnalysisRequest}
    - hasSkinAnalysisData: ${hasSkinAnalysisData}
    - userMessage preview: ${userMessage.substring(0, 100)}...`);

    return isAfterWelcome && (matchesSkinDescription || matchesAnalysisRequest || hasSkinAnalysisData);
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
           (bulletMatches !== null && bulletMatches.length >= 2);
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
  async initializeConversation(userName: string, sessionId: string = 'temp'): Promise<{
    content: string;
    hasChoices: boolean;
    choices?: string[];
  }> {
    try {
      // Mark that bot has introduced itself
      if (!this.sessionState.has(sessionId)) {
        this.sessionState.set(sessionId, { currentStep: null, structuredFlowActive: false, hasIntroduced: true });
      } else {
        const state = this.sessionState.get(sessionId)!;
        state.hasIntroduced = true;
      }
      
      // Presentazione normale dopo il nome
      const personalizedMessage = `Ciao ${userName}! 🌟 Sono la tua Skin Expert di Beautycology e sono davvero felice di conoscerti! Possiamo analizzare insieme la tua pelle per trovare la skincare routine perfetta che la renderà radiosa e bellissima! ✨

Puoi iniziare l'analisi in due modi:
• Carica una foto del tuo viso (struccato e con buona luce naturale) per farla analizzare dalla mia tecnologia skin specialist AI 📸 

• Oppure raccontami della tua pelle: come la vedi, cosa senti, che piccoli problemini hai notato e quali sono le tue abitudini di bellezza! 💕

Se invece vuoi informazioni sui nostri prodotti, o per qualsiasi dubbio, chiedi pure. Sono qui per te! 😊`;

      // Initialize session history with the user's name and the welcome response
      let sessionHistory = this.chatSessions.get(sessionId) || [];
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

  // Get RAG context for user query
  private async getRAGContext(userMessage: string): Promise<string> {
    try {
      const ragResult = await ragService.searchSimilar(userMessage, 3);
      
      if (ragResult.content && ragResult.content.trim()) {
        // Filter and format the content for better context
        const relevantInfo = ragResult.sources
          .filter(source => source.similarity > 0.1)
          .map(source => {
            // Extract product information if present
            const content = source.content.substring(0, 300);
            const sourceFile = source.metadata.source;
            return `[Da ${sourceFile}]: ${content}...`;
          })
          .join('\n\n');
          
        return relevantInfo;
      }
      
      return '';
    } catch (error) {
      console.error('Error getting RAG context:', error);
      return '';
    }
  }
}

export const beautycologyAI = new BeautycologyAIService();