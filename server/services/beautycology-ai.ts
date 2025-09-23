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
**🚨 IMPORTANTE: MAI USARE PULSANTI O DOMANDE A SCELTA MULTIPLA QUANDO L'UTENTE CHIEDE INFORMAZIONI SUI PRODOTTI!**
**FORNISCI SEMPRE UNA RISPOSTA TESTUALE COMPLETA CON I DETTAGLI DEL PRODOTTO!**

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

**I pulsanti saranno automaticamente: Acne/Brufoli, Macchie scure, Rughe/Invecchiamento, Rosacea, Punti neri, Pori dilatati**

⚠️ **MAI fare questa domanda come domanda aperta!**

### DOMANDA 4 - TIPO DI CONSIGLIO:
🚨 **OBBLIGATORIO: DOMANDA A RISPOSTA MULTIPLA CON PULSANTI**
SOLO dopo aver ricevuto risposta alla domanda 3:
> "Vuoi che ti consigli una routine completa o cerchi un tipo di prodotto in particolare?"

**I pulsanti saranno automaticamente: Routine completa, Detergente-struccante, Esfoliante, Siero/Trattamento Specifico, Creme viso, Protezioni Solari, Contorno Occhi, Maschere Viso, Prodotti Corpo**

⚠️ **MAI fare questa domanda come domanda aperta!**

### DOMANDA 5 - INFORMAZIONI AGGIUNTIVE:
> "Hai altre informazioni che vorresti darmi in modo da poterti aiutare al meglio?"

## STEP 3: RACCOMANDAZIONI FINALI E RIEPILOGO COMPLETO
🚨 **REGOLE ASSOLUTE PER IL MESSAGGIO FINALE:**

Dopo aver raccolto tutte le informazioni, DEVI SEMPRE:

1. **REGISTRARE E RIEPILOGARE TUTTE LE INFORMAZIONI** fornite dall'utente:
   - Tipo di pelle dichiarato
   - Età
   - Problematiche principali rilevate
   - Ingredienti preferiti o evitati
   - Routine attuale
   - Qualsiasi altra informazione fornita durante la conversazione

2. **FORNIRE UN RIEPILOGO PRECISO E PUNTUALE** delle problematiche rilevate:
   - Analisi dettagliata di ogni problema identificato
   - Spiegazione scientifica delle cause
   - Come ogni problema impatta la salute della pelle

3. **RACCOMANDAZIONI PRECISE E PERSONALIZZATE**:
   - Routine personalizzata COMPLETA (mattina e sera)
   - Prodotti SPECIFICI dal catalogo Beautycology con spiegazione del perché
   - Ordine esatto di applicazione
   - Tecniche di applicazione specifiche
   - Tempi tra un prodotto e l'altro

4. **CONSIGLI SCIENTIFICI DETTAGLIATI**:
   - Spiegazione di COME ogni ingrediente agisce sul problema specifico
   - Percentuali degli ingredienti attivi
   - Evidenze scientifiche a supporto
   - Timeline realistica dei risultati attesi

5. **SKINCARE ROUTINE COMPLETA E DETTAGLIATA**:
   - Passaggi precisi per mattina e sera
   - Frequenza di utilizzo di ogni prodotto
   - Consigli per massimizzare l'efficacia
   - Errori comuni da evitare

6. **MAI INCLUDERE PULSANTI O SCELTE** nel messaggio finale

7. **CONCLUDI SEMPRE** con la frase ESATTA:
   "Se hai altri dubbi o domande sui nostri prodotti, chiedi pure!"

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

### REGOLE CRITICHE PER PRODOTTI E LINK:
🚨 **OBBLIGO ASSOLUTO - PRODOTTI REALI SOLO:**
- USA ESCLUSIVAMENTE i nomi ESATTI dei prodotti dal catalogo Beautycology
- VIETATO inventare o usare nomi generici come "beautycology detergente", "beautycology crema", "beautycology swr", "beautycology crema defense"
- SOLO nomi specifici come "Mousse Away – Detergente viso", "M-EYE SECRET – CREMA CONTORNO OCCHI MULTIPEPTIDE", "Invisible Shield – Crema viso SPF 30"

🚨 **OBBLIGO ASSOLUTO - LINK OBBLIGATORI:**
- OGNI prodotto menzionato DEVE avere il suo link completo https://beautycology.it/prodotto/...
- VIETATO menzionare prodotti senza link
- VIETATO usare link non-beautycology.it
- Formato richiesto: **[Nome Esatto Prodotto](URL completo)** (prezzo)

### ESEMPI CORRETTI:
✅ **[Mousse Away – Detergente viso](https://beautycology.it/prodotto/detergente-viso-mousse-away/)** (€8,00)
✅ **[Invisible Shield – Crema viso SPF 30](https://beautycology.it/prodotto/invisible-shield-crema-viso-spf-uva/)** (€15,00)

### ESEMPI VIETATI:
❌ "beautycology detergente" - usa nome specifico + link
❌ "crema beautycology" - usa nome specifico + link  
❌ "beautycology swr" - prodotto inesistente
❌ "beautycology crema defense" - prodotto inesistente

### UTILIZZO KNOWLEDGE BASE:
✅ **Includi articoli del blog** per approfondimenti scientifici
✅ **Riferisci a https://beautycology.it/skincare-routine/** quando pertinente

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
❌ Non dire "non conosco questo prodotto" se è nella knowledge base
❌ Non iniziare domande strutturate subito dopo il nome
❌ Non fare più domande contemporaneamente durante l'analisi
❌ Non saltare l'attesa delle risposte
❌ **CRITICO: Non inventare NESSUN prodotto non presente nella knowledge base**
❌ **CRITICO: Non usare nomi generici come "beautycology detergente", "beautycology crema"**
❌ **CRITICO: Non menzionare prodotti senza link completo**
❌ **CRITICO: Non usare link esterni a beautycology.it**
❌ Non fare affermazioni mediche (rimanda al dermatologo)
❌ Non concludere prima di aver raccolto tutte le informazioni
❌ Non ripetere opzioni come bullet points quando fai domande con scelte multiple
❌ Non ignorare le risposte dell'utente (registrale sempre)
❌ MAI USARE PULSANTI O DOMANDE A SCELTA MULTIPLA QUANDO L'UTENTE CHIEDE INFORMAZIONI SUI PRODOTTI

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

// Product validation class for ensuring only real products are recommended
class ProductValidator {
  private products: Array<{name: string, originalName: string, url: string, price: string}> = [];
  
  constructor(knowledgeBase: any) {
    this.loadProducts(knowledgeBase);
  }
  
  private loadProducts(knowledgeBase: any): void {
    if (knowledgeBase && knowledgeBase.products) {
      this.products = knowledgeBase.products.map((p: any) => ({
        name: p.name.toLowerCase(),
        originalName: p.name,
        url: p.url,
        price: p.price
      }));
      console.log(`✅ ProductValidator loaded ${this.products.length} products`);
    }
  }
  
  // Check if a product name exists in catalog (exact match only)
  validateProductName(productName: string): {isValid: boolean, product?: any} {
    const searchName = productName.toLowerCase().trim();
    const exactMatch = this.products.find(p => p.name === searchName);
    
    if (exactMatch) {
      return {
        isValid: true,
        product: {
          name: exactMatch.originalName,
          url: exactMatch.url,
          price: exactMatch.price
        }
      };
    }
    
    return {isValid: false};
  }
  
  // Find all product names mentioned in text (case insensitive)
  findProductMentionsInText(text: string): Array<{name: string, product: any}> {
    const mentions: Array<{name: string, product: any}> = [];
    
    this.products.forEach(p => {
      // Use regex to find case-insensitive whole word matches
      const regex = new RegExp('\\b' + p.originalName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
      const matches = text.match(regex);
      
      if (matches) {
        matches.forEach(match => {
          mentions.push({
            name: match,
            product: {
              name: p.originalName,
              url: p.url,
              price: p.price
            }
          });
        });
      }
    });
    
    return mentions;
  }
  
  // Validate that recommended text contains only real products with mandatory links
  validateRecommendationText(text: string): {isValid: boolean, issues: string[]} {
    const issues: string[] = [];
    
    // 1. Look for problematic generic patterns (user's specific issues)
    const problematicPatterns = [
      /beautycology\s+(detergente|crema|siero|protezione|swr|defense)/gi,
      /detergente\s+beautycology/gi,
      /crema\s+beautycology/gi,
      /beautycology\s+swr/gi,
      /beautycology\s+crema\s+defense/gi
    ];
    
    problematicPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          issues.push(`CRITICAL: Generic/non-existent product reference: "${match}" - use exact catalog product names only`);
        });
      }
    });
    
    // 2. Find ALL product mentions in text (not just bold)
    const productMentions = this.findProductMentionsInText(text);
    
    productMentions.forEach(mention => {
      // For each real product mentioned, ensure its exact URL is present
      if (!text.includes(mention.product.url)) {
        issues.push(`CRITICAL: Product "${mention.product.name}" mentioned without mandatory link: ${mention.product.url}`);
      }
    });
    
    // 3. Validate ALL URLs in text (not just Markdown)
    const allUrlMatches = text.match(/https?:\/\/[^\s\)]+/g);
    if (allUrlMatches) {
      allUrlMatches.forEach(url => {
        // Clean up potential trailing punctuation
        const cleanUrl = url.replace(/[.,;!?]+$/, '');
        if (!cleanUrl.startsWith('https://beautycology.it/')) {
          issues.push(`CRITICAL: Non-beautycology URL found: "${cleanUrl}" - all product links must be from beautycology.it`);
        }
      });
    }
    
    // 4. Check for product-like words that might be generic references
    const suspiciousPatterns = [
      /\b(detergente|cleanser|crema|cream|siero|serum|gel|olio|oil)\s+(beautycology|efficace|specifico|adatto)\b/gi,
      /\b(prodotto|cosmetico)\s+(beautycology|di qualità|specifico|adatto|perfetto)\b/gi
    ];
    
    suspiciousPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          issues.push(`WARNING: Suspicious generic reference: "${match}" - ensure you use specific product names from catalog`);
        });
      }
    });
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }
  
  // Get all available product names for reference  
  getAllProductNames(): string[] {
    return this.products.map(p => p.originalName);
  }
  
  // Get real products for specific categories
  getProductsByCategory(category: string): Array<{name: string, url: string, price: string}> {
    const categoryLower = category.toLowerCase();
    
    // Map categories to actual products
    if (categoryLower.includes('detergente') || categoryLower.includes('struccante')) {
      return this.products
        .filter(p => p.name.includes('detergente') || p.name.includes('mousse') || p.name.includes('multitasking') || p.name.includes('cleaning'))
        .map(p => ({name: p.originalName, url: p.url, price: p.price}));
    }
    
    if (categoryLower.includes('protezione') || categoryLower.includes('solare') || categoryLower.includes('spf')) {
      return this.products
        .filter(p => p.name.includes('shield') || p.name.includes('spf'))
        .map(p => ({name: p.originalName, url: p.url, price: p.price}));
    }
    
    if (categoryLower.includes('contorno occhi')) {
      return this.products
        .filter(p => p.name.toLowerCase().includes('eye') || p.name.toLowerCase().includes('occhi'))
        .map(p => ({name: p.originalName, url: p.url, price: p.price}));
    }
    
    return [];
  }
}

export class BeautycologyAIService {
  private modelName = "gemini-2.5-flash";
  private generationConfig = {
    temperature: 0.2,
    maxOutputTokens: 4096, // Significantly increased to prevent message truncation in final recommendations
  };
  private chatSessions: Map<string, any[]> = new Map();
  private sessionState: Map<string, { 
    currentStep: string | null, 
    structuredFlowActive: boolean, 
    hasIntroduced?: boolean,
    lastIntent?: 'product_info' | 'skin_analysis' | null,
    structuredFlowAnswers?: {
      skinType?: string;
      age?: string;
      mainIssue?: string;
      adviceType?: string;
      additionalInfo?: string;
    };
  }> = new Map();
  private knowledgeBase: any = null;
  private productValidator: ProductValidator | null = null;

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
        
        // Initialize product validator
        this.productValidator = new ProductValidator(this.knowledgeBase);
        
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

      // Check if this is a product information request
      const isProductInfoRequest = this.detectProductInformationIntent(userMessage);
      
      // Save the intent type in session state for better tracking
      if (isProductInfoRequest) {
        state.lastIntent = 'product_info';
      } else if (this.shouldStartStructuredQuestions(userMessage, sessionHistory)) {
        state.lastIntent = 'skin_analysis';
      }
      
      // Build contents array - on first message, include system instruction
      let contents: any[];
      if (sessionHistory.length === 0) {
        // First message: include system instruction + knowledge base + RAG knowledge + user message
        const knowledgeSummary = this.getKnowledgeBaseSummary();
        const ragInfo = await this.getRAGContext(userMessage);
        
        // Check if session has already introduced the bot
        const antiRepeatInstruction = state.hasIntroduced ? 
          "\n\n🔴 IMPORTANTE: Ti sei già presentata all'utente. NON RIPRESENTARTI. Rispondi DIRETTAMENTE alla domanda.\n\n" : '';
        
        // Add specific instruction for product information requests
        const productInfoInstruction = isProductInfoRequest ? 
          "\n\n🛍️ IMPORTANTE: L'utente sta chiedendo informazioni sui prodotti. NON INIZIARE IL FLUSSO DI DOMANDE STRUTTURATE. Fornisci invece informazioni dettagliate sui prodotti richiesti, inclusi prezzi, ingredienti, benefici e LINK DIRETTI ai prodotti su beautycology.it.\n\n" : '';
        
        const fullPrompt = BEAUTYCOLOGY_SYSTEM_INSTRUCTION + 
          antiRepeatInstruction +
          productInfoInstruction +
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
        
        // Add specific instruction for product information requests
        const productInfoReminder = isProductInfoRequest ? 
          "🛍️ IMPORTANTE: L'utente sta chiedendo informazioni sui prodotti. NON INIZIARE IL FLUSSO DI DOMANDE STRUTTURATE. Fornisci informazioni dettagliate sui prodotti richiesti, inclusi prezzi, ingredienti, benefici e LINK DIRETTI ai prodotti su beautycology.it.\n\n" : '';
        
        // Special handling for when structured flow is completed
        let messageText = antiRepeatReminder + productInfoReminder + userMessage;
        
        // Normalize user message for robust matching
        const normalizedMessage = userMessage.toLowerCase()
          .trim()
          .replace(/[.,!?;:'"]/g, '') // Remove punctuation
          .replace(/à/g, 'a')
          .replace(/è|é/g, 'e')
          .replace(/ì|í/g, 'i')
          .replace(/ò|ó/g, 'o')
          .replace(/ù|ú/g, 'u');
        
        // Check if this is the final additional info answer (last step)
        const isAdditionalInfoAnswer = state.currentStep === 'awaiting_additional_info' && normalizedMessage.length > 0;
        
        // Also check if we're in completed state but haven't provided recommendations yet
        const isCompletedWithoutRecommendations = state.currentStep === 'completed' && 
          !sessionHistory.some(m => m.role === 'model' && m.parts?.[0]?.text?.includes('routine personalizzata'));
        
        if (isAdditionalInfoAnswer || isCompletedWithoutRecommendations) {
          // Store additional info if this is the last question
          if (state.structuredFlowAnswers) {
            state.structuredFlowAnswers.additionalInfo = userMessage;
          }
          
          // Add explicit instructions for the AI to generate comprehensive recommendations
          const comprehensivePrompt = `L'utente ha risposto: "${userMessage}"\n\n` +
            `IMPORTANTE: Hai raccolto tutte le informazioni necessarie dal questionario strutturato:\n` +
            `1. Tipo di pelle: ${state.structuredFlowAnswers?.skinType || 'non specificato'}\n` +
            `2. Età: ${state.structuredFlowAnswers?.age || 'non specificata'}\n` +
            `3. Problematica principale: ${state.structuredFlowAnswers?.mainIssue || 'non specificata'}\n` +
            `4. Tipo di consiglio: ${state.structuredFlowAnswers?.adviceType || 'non specificato'}\n` +
            `5. Informazioni aggiuntive: ${userMessage}\n\n` +
            `🚨 ORA DEVI FORNIRE IL MESSAGGIO FINALE CON:\n` +
            `- RIEPILOGO COMPLETO delle informazioni registrate\n` +
            `- ANALISI DETTAGLIATA delle problematiche\n` +
            `- ROUTINE PERSONALIZZATA COMPLETA con prodotti Beautycology\n` +
            `- CONSIGLI SCIENTIFICI dettagliati\n` +
            `- MAI includere pulsanti o scelte\n` +
            `- CONCLUDI SEMPRE con: "Se hai altri dubbi o domande sui nostri prodotti, chiedi pure!"\n\n` +
            `Segui ESATTAMENTE le regole del STEP 3: RACCOMANDAZIONI FINALI E RIEPILOGO COMPLETO.`;
          
          // Include RAG context for product grounding
          if (ragInfo) {
            messageText = antiRepeatReminder + comprehensivePrompt + `\n\nContesto prodotti rilevanti:\n${ragInfo}`;
          } else {
            messageText = antiRepeatReminder + comprehensivePrompt;
          }
          
          // Set flag to prevent buttons in final message
          state.currentStep = 'providing_final_recommendations';
        } else {
          // Check if message contains skin analysis data
          messageText = antiRepeatReminder + userMessage;
        }
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
        if (state.currentStep === 'completed') {
          // If flow is completed but we have an empty response, generate final recommendations
          responseText = await this.generateFinalRecommendations(sessionId, state);
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
        // Save the answer
        if (!state.structuredFlowAnswers) state.structuredFlowAnswers = {};
        state.structuredFlowAnswers.skinType = userMessage;
        state.currentStep = 'age_question';
        // Keep structured flow active to continue with next question
      }

      // Check if user is answering the age question
      const ageRanges = ["16-25", "26-35", "36-45", "46-55", "56+"];
      if (state.currentStep === 'awaiting_age' && 
          ageRanges.some(range => userMessage.toLowerCase().includes(range.toLowerCase()))) {
        console.log(`✅ User selected age range: ${userMessage}`);
        // Save the answer
        if (!state.structuredFlowAnswers) state.structuredFlowAnswers = {};
        state.structuredFlowAnswers.age = userMessage;
        state.currentStep = 'awaiting_problem';
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
          // Save the answer
          if (!state.structuredFlowAnswers) state.structuredFlowAnswers = {};
          state.structuredFlowAnswers.mainIssue = userMessage;
          state.currentStep = 'awaiting_advice_type';
          
          // Automatically ask the advice type question
          const adviceResponse = "Vuoi che ti consigli una routine completa o cerchi un tipo di prodotto in particolare?";
          const adviceChoices = ["Routine completa", "Detergente-struccante", "Esfoliante", "Siero/Trattamento Specifico", "Creme viso", "Protezioni Solari", "Contorno Occhi", "Maschere Viso", "Prodotti Corpo"];
          
          // Update history immediately so this question appears
          sessionHistory.push({
            role: "model",
            parts: [{ text: adviceResponse }]
          });
          this.chatSessions.set(sessionId, sessionHistory);
          
          // Return the response immediately to show the question
          return {
            content: adviceResponse,
            hasChoices: true,
            choices: adviceChoices
          };
        }
      }

      // Check if user is answering the advice type question (new question 4)
      const adviceTypes = ["routine completa", "detergente-struccante", "esfoliante", "siero/trattamento specifico", "creme viso", "protezioni solari", "contorno occhi", "maschere viso", "prodotti corpo"];
      if (state.currentStep === 'awaiting_advice_type' && 
          adviceTypes.some(type => userMessage.toLowerCase().includes(type.toLowerCase().substring(0, 8)))) {
        console.log(`✅ User selected advice type: ${userMessage}`);
        // Save the answer
        if (!state.structuredFlowAnswers) state.structuredFlowAnswers = {};
        state.structuredFlowAnswers.adviceType = userMessage;
        
        // Check if user selected a specific product type vs complete routine
        const isRoutineCompleta = userMessage.toLowerCase().includes("routine completa");
        
        if (isRoutineCompleta) {
          // Continue with structured flow for complete routine
          state.currentStep = 'awaiting_additional_info';
          state.structuredFlowActive = true; // Keep flow active for final question
        } else {
          // User selected a specific product type - provide immediate recommendation
          console.log(`🎯 User selected specific product type: ${userMessage} - providing immediate recommendation`);
          
          // End structured flow and provide specific product recommendation
          state.currentStep = 'completed';
          state.structuredFlowActive = false;
          
          // Generate specific product recommendation
          responseText = await this.generateSpecificProductRecommendation(sessionId, userMessage, state);
          
          // Update history with the product recommendation
          sessionHistory.pop(); // Remove the last model response placeholder
          sessionHistory.push({
            role: "model",
            parts: [{ text: responseText }]
          });
          this.chatSessions.set(sessionId, sessionHistory);
          
          // Return immediately with the recommendation
          return {
            content: responseText,
            hasChoices: false
          };
        }
      }

      // Check if user is providing additional information (final step)
      if (state.currentStep === 'awaiting_additional_info') {
        console.log(`✅ User provided additional info: ${userMessage}`);
        // Save the answer
        if (!state.structuredFlowAnswers) state.structuredFlowAnswers = {};
        state.structuredFlowAnswers.additionalInfo = userMessage;
        state.currentStep = 'completed';
        state.structuredFlowActive = false; // End structured flow
        
        // Force a comprehensive response when flow is completed
        console.log(`🎯 Structured flow completed for session ${sessionId}, will provide comprehensive recommendations`);
        
        // Generate final recommendations immediately
        responseText = await this.generateFinalRecommendations(sessionId, state);
        
        // Update history with the recommendations
        sessionHistory.pop(); // Remove the last model response placeholder
        sessionHistory.push({
          role: "model",
          parts: [{ text: responseText }]
        });
        this.chatSessions.set(sessionId, sessionHistory);
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

      // isProductInfoRequest already declared above, so we don't need to declare it again
      
      // Only force buttons if NOT a product information request
      if (!isProductInfoRequest) {
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
      } else {
        // Product information request - never show buttons
        console.log("🛍️ Product information request detected - removing any buttons");
        hasChoices = false;
        choices = undefined;
      }

      // State-driven approach: Force buttons based on conversation state
      // But NEVER for product information requests
      if (!isProductInfoRequest && state.structuredFlowActive && state.currentStep === 'awaiting_skin_type') {
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

      // Force age question after skin type (but not for product info requests)
      if (!isProductInfoRequest && state.structuredFlowActive && state.currentStep === 'age_question') {
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

      // Force problem question after age (but not for product info requests)
      if (!isProductInfoRequest && state.structuredFlowActive && state.currentStep === 'problem_question') {
        console.log(`🎯 Structured flow - forcing problem question for session ${sessionId}`);
        hasChoices = true;
        choices = ["Acne/Brufoli", "Macchie scure", "Rughe/Invecchiamento", "Rosacea", "Punti neri", "Pori dilatati"];
        
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

      // Force ingredients question after problem (but not for product info requests)
      if (!isProductInfoRequest && state.structuredFlowActive && state.currentStep === 'ingredients_question') {
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

      // Force routine question after ingredients (but not for product info requests)
      if (!isProductInfoRequest && state.structuredFlowActive && state.currentStep === 'routine_question') {
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
      
      // Additional fallback check for the exact pattern (but not for product info requests)
      const lowerText = responseText.toLowerCase();
      if (!isProductInfoRequest && !hasChoices && (
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

      // NEVER include choices in final recommendations
      if (state.currentStep === 'providing_final_recommendations' || 
          state.currentStep === 'completed' ||
          responseText.includes("Se hai altri dubbi o domande sui nostri prodotti, chiedi pure!") ||
          responseText.includes("RIEPILOGO COMPLETO DELLE INFORMAZIONI REGISTRATE") ||
          responseText.includes("PROBLEMATICHE RILEVATE E ANALISI")) {
        hasChoices = false;
        choices = undefined;
        console.log(`🚫 Final recommendations detected - no buttons will be shown`);
        state.currentStep = 'completed';
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
      
      // Check if the original message was a product info request
      // Use the saved intent from state if userMessage is not available
      const isProductInfoRequest = userMessage ? this.detectProductInformationIntent(userMessage) : 
                                    (state.lastIntent === 'product_info');
      
      if (!isProductInfoRequest && (state.structuredFlowActive || state.currentStep)) {
        // Continue with structured flow (but not for product info requests)
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
          choices = ["Acne/Brufoli", "Macchie scure", "Rughe/Invecchiamento", "Rosacea", "Punti neri", "Pori dilatati"];
        } else if (state.currentStep === 'awaiting_advice_type') {
          fallbackResponse = "Vuoi che ti consigli una routine completa o cerchi un tipo di prodotto in particolare?";
          hasChoices = true;
          choices = ["Routine completa", "Detergente-struccante", "Esfoliante", "Siero/Trattamento Specifico", "Creme viso", "Protezioni Solari", "Contorno Occhi", "Maschere Viso", "Prodotti Corpo"];
        } else if (state.currentStep === 'additional_info') {
          fallbackResponse = "C'è qualcos'altro che dovrei sapere sulla tua pelle o sulle tue esigenze specifiche?";
          hasChoices = false;
        }
      } else if (isProductInfoRequest) {
        // Product information request - provide product info without buttons
        fallbackResponse = "Posso aiutarti con informazioni sui nostri prodotti Beautycology! Abbiamo una gamma completa di prodotti scientifici per la skincare, tra cui la Perfect & Pure Cream per pelli miste, M-Eye Secret per il contorno occhi, e l'Acqua Micellare per la detersione. Dimmi quale prodotto ti interessa o cosa stai cercando per la tua pelle.";
        hasChoices = false;
        choices = [];
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
      return ["Acne/Brufoli", "Macchie scure", "Rughe/Invecchiamento", "Rosacea", "Punti neri", "Pori dilatati"];
    }
    
    if (text.includes('routine completa o cerchi') || text.includes('tipo di prodotto in particolare') || text.includes('consigli una routine completa')) {
      return ["Routine completa", "Detergente-struccante", "Esfoliante", "Siero/Trattamento Specifico", "Creme viso", "Protezioni Solari", "Contorno Occhi", "Maschere Viso", "Prodotti Corpo"];
    }
    
    return null;
  }

  private detectProductInformationIntent(userMessage: string): boolean {
    // Patterns that indicate the user wants information about products, not skin analysis
    const productInformationPatterns = [
      /qual[ie]?\s+(prodott[oi]|crem[ae]|sier[ou]m)/i,
      /cosa\s+(avete|vendete|proponete)/i,
      /che\s+prodott[oi]\s+(avete|vendete|proponete)/i,
      /vorrei\s+(informazioni|sapere|conoscere)\s+(su[il]?\s+|dei?\s+|[ai]\s+)?(vostri\s+)?prodott/i,
      /informazioni\s+(su[il]?\s+|dei?\s+)?(vostri\s+)?prodott/i,
      /parlami\s+(dei|di)\s+(vostri\s+)?prodott/i,
      /mi\s+(puoi|può)\s+(consigliare|suggerire)\s+un\s+prodott/i,
      /cercavo?\s+un\s+(prodotto|crema|siero)/i,
      /avete\s+(qualcosa|un prodotto|una crema)/i,
      /quanto\s+cost/i,
      /prezz[oi]/i,
      /dove\s+(posso\s+)?comprar/i,
      /link\s+(al|del)\s+prodott/i,
      /maggiori\s+informazioni\s+su/i,
      /come\s+funziona/i,
      /ingredienti\s+d[ei]/i,
      /proprietà\s+d[ei]/i,
      /benefici\s+d[ei]/i,
      /per\s+cosa\s+(serve|è indicato)/i,
      /differenza\s+tra/i,
      /quale\s+scegliere\s+tra/i,
      /catalogo/i,
      /gamma\s+(di\s+)?prodott/i,
      /linea\s+(di\s+)?prodott/i,
      /novità/i,
      /best\s*seller/i,
      /più\s+vendu/i,
      /vostri\s+prodott/i,
      /i\s+prodott[oi]\s+(che\s+)?avete/i
    ];

    // Check if message mentions specific product names from knowledge base
    const productNamePatterns = [
      /m[\s-]?eye/i,
      /perfect\s*&?\s*pure/i,
      /vitamin\s*c/i,
      /retinol/i,
      /niacinamide/i,
      /acido\s+(ialuronico|salicilico)/i,
      /siero/i,
      /crema\s+(viso|notte|giorno)/i,
      /detergente/i,
      /tonico/i,
      /maschera/i,
      /contorno\s+occhi/i,
      /anti[\s-]?age/i,
      /anti[\s-]?rughe/i,
      /antimacchie/i,
      /sebo[\s-]?regola/i,
      /bionic\s*hydra/i,
      /hydralift/i,
      /acqua\s*micellare/i
    ];

    const hasProductInfoIntent = productInformationPatterns.some(pattern => pattern.test(userMessage));
    const mentionsProductName = productNamePatterns.some(pattern => pattern.test(userMessage));
    
    // Log for debugging
    if (hasProductInfoIntent || mentionsProductName) {
      console.log(`🛍️ Product information intent detected in message: "${userMessage}"`);
    }
    
    // If the message contains product info patterns or mentions specific products, it's likely informational
    return hasProductInfoIntent || mentionsProductName;
  }

  private shouldStartStructuredQuestions(userMessage: string, sessionHistory: any[]): boolean {
    // Debug logging
    console.log(`🔍 Checking message for intent: "${userMessage}"`);
    
    // IMPORTANT: First check if this is a product information request
    const isProductInfo = this.detectProductInformationIntent(userMessage);
    console.log(`🛍️ Product info intent check: ${isProductInfo}`);
    
    if (isProductInfo) {
      console.log("🛍️ Product information intent detected - NOT starting structured flow");
      return false;
    }

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
    
    // Check if this looks like the user describing THEIR OWN skin issues (triggers structured flow)
    // More specific patterns that indicate personal skin issues, not general product inquiries
    const personalSkinPatterns = [
      /ho\s+(la\s+pelle|il\s+viso|acne|brufoli|rughe|macchie|punti\s+neri)/i,
      /mi\s+(si\s+)?(arrossa|irrita|secca|unge)/i,
      /soffro\s+di/i,
      /la\s+mia\s+pelle/i,
      /il\s+mio\s+viso/i,
      /mi\s+(escono|vengono|compaiono)/i,
      /ho\s+problemi\s+di/i,
      /sono\s+uscit[ei]/i,
      /mi\s+sono\s+comparse/i,
      /da\s+quando\s+ho/i,
      /ultimamente\s+ho/i,
      /stamattina\s+mi/i,
      /ogni\s+(mattina|sera|giorno)/i,
      /quando\s+mi\s+(lavo|trucco|strucco)/i,
      /dopo\s+(aver|che)/i,
      /vorrei\s+(fare|un'?)\s+analisi/i,
      /analizza\s+la\s+mia/i,
      /puoi\s+analizzare/i
    ];

    // Also check if user explicitly asks for skin analysis
    const analysisRequests = [
      /analizza.*mia.*pelle/i,
      /fare\s+un'?\s*analisi/i,
      /voglio\s+capire\s+(che\s+tipo|quali\s+problemi)/i,
      /aiutami\s+a\s+capire/i,
      /ho\s+bisogno\s+di\s+(capire|sapere)/i
    ];

    // Check if the message contains skin analysis JSON data (from photo upload)
    const hasSkinAnalysisData = userMessage.includes("Analisi AI della pelle:") || 
                                userMessage.includes("rossori") || 
                                userMessage.includes("texture_uniforme") ||
                                (userMessage.includes("{") && userMessage.includes("pori_dilatati"));

    // Check if this is after the welcome message and user is describing skin
    const isAfterWelcome = sessionHistory.length >= 2; // At least name + welcome
    const matchesPersonalSkinPattern = personalSkinPatterns.some(pattern => pattern.test(userMessage));
    const matchesAnalysisRequest = analysisRequests.some(pattern => pattern.test(userMessage));

    console.log(`🔍 Structured questions trigger check:
    - isAfterWelcome: ${isAfterWelcome}
    - matchesPersonalSkinPattern: ${matchesPersonalSkinPattern}
    - matchesAnalysisRequest: ${matchesAnalysisRequest}
    - hasSkinAnalysisData: ${hasSkinAnalysisData}
    - userMessage preview: ${userMessage.substring(0, 100)}...`);

    return isAfterWelcome && (matchesPersonalSkinPattern || matchesAnalysisRequest || hasSkinAnalysisData);
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
  private getKnowledgeBaseSummary(maxItems: number = 20): string {
    if (!this.knowledgeBase) {
      return '';
    }

    let summary = '';
    
    // Add strict product validation instructions at the top
    summary += `🚨 ATTENZIONE: USA SOLO QUESTI PRODOTTI REALI CON NOMI ESATTI E LINK OBBLIGATORI:\n\n`;
    
    // Add products section with mandatory link format
    if (this.knowledgeBase.products?.length > 0) {
      const topProducts = this.knowledgeBase.products
        .slice(0, maxItems)
        .map((p: any) => `✅ **[${p.name}](${p.url})** (${p.price})
   ${p.description.substring(0, 120)}...`)
        .join('\n\n');
      summary += `## CATALOGO PRODOTTI REALI - SOLO QUESTI NOMI E LINK:\n${topProducts}\n\n`;
      
      // Add explicit forbidden examples
      summary += `🚨 VIETATO USARE:\n❌ "beautycology detergente" → USA: [Mousse Away – Detergente viso](link)\n❌ "beautycology protezione solare" → USA: [Invisible Shield – Crema viso SPF 30](link)\n❌ "beautycology swr" → NON ESISTE\n❌ "beautycology crema defense" → NON ESISTE\n\n`;
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

  // Generate specific product recommendation based on skin problems and selected category
  private async generateSpecificProductRecommendation(sessionId: string, selectedProductType: string, state: any): Promise<string> {
    console.log(`🎯 Generating specific product recommendation for ${selectedProductType} for session ${sessionId}`);
    
    const answers = state.structuredFlowAnswers || {};
    const sessionHistory = this.chatSessions.get(sessionId) || [];
    
    // Map skin problems to recommended ingredients based on system instructions
    const skinProblemsMapping: Record<string, string[]> = {
      'acne/brufoli': ['Bardana', 'Mirto', 'Niacinamide'],
      'macchie scure': ['Liquirizia', 'Vitamina C'],
      'rughe/invecchiamento': ['Ginkgo Biloba', 'Retinolo'],
      'rossori': ['Centella Asiatica', 'Malva'],
      'pori dilatati': ['Amamelide', 'Niacinamide'],
      'pelle grassa': ['Amamelide', 'Niacinamide'],
      'scarsa idratazione': ['Kigelia Africana', 'Acido Ialuronico'],
      'pelle secca': ['Kigelia Africana', 'Acido Ialuronico'],
    };

    // Identify skin problems from user's main issue
    const mainIssue = answers.mainIssue?.toLowerCase() || '';
    let recommendedIngredients: string[] = [];
    
    Object.keys(skinProblemsMapping).forEach(problem => {
      if (mainIssue.includes(problem.split('/')[0])) {
        recommendedIngredients.push(...skinProblemsMapping[problem]);
      }
    });
    
    // Remove duplicates
    recommendedIngredients = Array.from(new Set(recommendedIngredients));
    
    // Get RAG context for the specific product type
    const ragContext = await this.getRAGContext(`${selectedProductType} ${recommendedIngredients.join(' ')}`);
    
    // Build prompt for specific product recommendation
    const productPrompt = `
**RACCOMANDAZIONE PRODOTTO SPECIFICO**

🎯 L'utente ha scelto: **${selectedProductType}**

Dati dell'utente:
- Tipo di pelle: ${answers.skinType || 'non specificato'}
- Età: ${answers.age || 'non specificata'}  
- Problematica principale: ${answers.mainIssue || 'non specificata'}
- Ingredienti consigliati basati sui problemi: ${recommendedIngredients.join(', ') || 'da valutare'}

${ragContext ? `Informazioni prodotti rilevanti:\n${ragContext}\n` : ''}

🚨 IMPORTANTE: L'utente ha scelto UN PRODOTTO SPECIFICO, non una routine completa.

DEVI OBBLIGATORIAMENTE:

1. **RINGRAZIARE** per la scelta specifica
2. **ANALIZZARE** la problematica principale identificata (${answers.mainIssue || 'problemi generici'})
3. **SPIEGARE** perché il tipo di prodotto scelto (${selectedProductType}) è perfetto per la sua condizione
4. **RACCOMANDARE IL PRODOTTO SPECIFICO** dalla knowledge base Beautycology più adatto:
   - Nome del prodotto e prezzo
   - Ingredienti chiave che risolvono il problema specifico
   - Come e quando usarlo
   - Benefici attesi
   - Link diretto per l'acquisto
5. **CONSIGLI D'USO** specifici per massimizzare l'efficacia
6. **CONCLUDERE** sempre con: "Se hai altri dubbi o domande sui nostri prodotti, chiedi pure!"

⚠️ NON includere pulsanti, scelte multiple, o domande aggiuntive.
⚠️ NON proporre routine complete - solo IL PRODOTTO SPECIFICO richiesto.
⚠️ Usa la knowledge base per prodotti e prezzi reali di Beautycology.

Rispondi come la Skin Expert di Beautycology con tono professionale ma amichevole. 🧪✨`;

    try {
      const response = await ai.models.generateContent({
        model: this.modelName,
        contents: [{
          role: "user",
          parts: [{ text: productPrompt }]
        }],
        config: {
          ...this.generationConfig,
          maxOutputTokens: 1500,
          temperature: 0.3
        }
      });

      const text = response.text || "";
      
      if (!text || text.trim().length === 0) {
        console.log('⚠️ Empty response for specific product recommendation, using fallback');
        return this.getFallbackSpecificProductRecommendation(selectedProductType, answers, recommendedIngredients);
      }

      // Validate the AI response for generic or non-existent products
      if (this.productValidator) {
        const validation = this.productValidator.validateRecommendationText(text);
        if (!validation.isValid) {
          console.warn(`⚠️ AI generated problematic product recommendations:`, validation.issues);
          console.log('🔄 Using fallback to ensure only real products are recommended');
          return this.getFallbackSpecificProductRecommendation(selectedProductType, answers, recommendedIngredients);
        }
      }

      console.log('✅ Generated specific product recommendation successfully');
      return text;
    } catch (error) {
      console.error('Error generating specific product recommendation:', error);
      return this.getFallbackSpecificProductRecommendation(selectedProductType, answers, recommendedIngredients);
    }
  }

  // Fallback specific product recommendation if AI fails - now uses real products from catalog
  private getFallbackSpecificProductRecommendation(productType: string, answers: any, ingredients: string[]): string {
    const skinType = answers.skinType?.toLowerCase() || 'mista';
    const mainIssue = answers.mainIssue || 'problemi generici della pelle';
    
    // Use ProductValidator to get real products for the category
    let realProducts: Array<{name: string, url: string, price: string}> = [];
    
    if (this.productValidator) {
      realProducts = this.productValidator.getProductsByCategory(productType);
    }
    
    // If no products found for category, get some default safe products
    if (realProducts.length === 0 && this.productValidator) {
      // Try to find some general products from the catalog
      const allProductNames = this.productValidator.getAllProductNames();
      if (allProductNames.length > 0) {
        // Get first available product as fallback
        const fallbackValidation = this.productValidator.validateProductName(allProductNames[0]);
        if (fallbackValidation.isValid && fallbackValidation.product) {
          realProducts = [fallbackValidation.product];
        }
      }
    }
    
    // If still no products, log error and return safe message
    if (realProducts.length === 0) {
      console.error(`❌ No real products found for category: ${productType}`);
      return `Mi dispiace, al momento non riesco ad accedere al catalogo prodotti per la categoria ${productType}. Ti consiglio di visitare https://beautycology.it per vedere tutti i prodotti disponibili.`;
    }
    
    // Use the first available real product
    const product = realProducts[0];
    const ingredientList = ingredients.length > 0 ? ingredients.join(', ') : 'ingredienti scientifici mirati';
    
    return `Perfetto! 🌟 Hai scelto di concentrarti su **${productType}** - una scelta intelligente!

📋 **ANALISI DELLA TUA ESIGENZA:**
Basandomi sui tuoi dati (pelle ${skinType}, problema principale: ${mainIssue}), il **${productType}** è esattamente quello di cui ha bisogno la tua pelle per risolvere questa problematica specifica.

🧪 **IL PRODOTTO PERFETTO PER TE:**

**${product.name}** (${product.price})
Questo prodotto è stato selezionato dal nostro catalogo scientifico di Beautycology per rispondere alle tue esigenze specifiche.

✨ **INGREDIENTI CHIAVE per il tuo problema:**
${ingredientList} - selezionati scientificamente per la tua condizione specifica.

📋 **COME USARLO:**
- Applica ${productType.includes('detergente') ? 'mattina e sera su viso umido' : 'mattina e sera su pelle pulita'}
- ${productType.includes('contorno') ? 'Tampona delicatamente senza strofinare' : 'Massaggia con movimenti circolari'}
- Costanza è fondamentale: usa quotidianamente per 4-6 settimane per vedere risultati ottimali

🎯 **BENEFICI ATTESI:**
- Miglioramento visibile della problematica in 2-3 settimane
- Pelle più equilibrata e sana
- Risultati progressivi e duraturi

🛒 **LINK DIRETTO:** [${product.name}](${product.url})

Se hai altri dubbi o domande sui nostri prodotti, chiedi pure! 💕`;
  }

  // Generate final recommendations when structured flow is completed
  private async generateFinalRecommendations(sessionId: string, state: any): Promise<string> {
    console.log(`🎯 Generating final recommendations for session ${sessionId}`);
    
    const answers = state.structuredFlowAnswers || {};
    const sessionHistory = this.chatSessions.get(sessionId) || [];
    
    // Get RAG context based on user's main issue
    const ragContext = await this.getRAGContext(answers.mainIssue || 'routine skincare');
    
    // ALWAYS include knowledge base of products to ensure complete catalog access
    const knowledgeSummary = this.getKnowledgeBaseSummary();
    
    // Build a comprehensive prompt for final recommendations
    const finalPrompt = `
**STEP 3: RACCOMANDAZIONI FINALI E RIEPILOGO COMPLETO**

🚨🚨🚨 REGOLE ASSOLUTE OBBLIGATORIE - DEVI SEGUIRE TUTTE QUESTE REGOLE SENZA ECCEZIONI:

🛑 **REGOLA CRITICA N.1 - USO OBBLIGATORIO PRODOTTI BEAUTYCOLOGY:**
- DEVI SEMPRE INCLUDERE SOLO PRODOTTI BEAUTYCOLOGY SPECIFICI nelle routine
- USA ESCLUSIVAMENTE i nomi ESATTI dei prodotti dal catalogo (es: "Perfect & Pure Cream", "M-Eye Secret", "Acqua Micellare")
- OGNI PRODOTTO MENZIONATO DEVE AVERE IL SUO LINK COMPLETO https://beautycology.it/prodotto/...
- VIETATO ASSOLUTAMENTE usare nomi generici come "detergente Beautycology", "crema Beautycology", "siero Beautycology"
- FORMATO OBBLIGATORIO: **[Nome Esatto Prodotto](URL completo)** (prezzo)

🛑 **REGOLA CRITICA N.2 - ROUTINE COMPLETA OBBLIGATORIA:**
Quando l'utente ha richiesto una "routine completa", DEVI SEMPRE fornire:
- Routine mattina completa con 4-5 prodotti Beautycology specifici
- Routine sera completa con 4-5 prodotti Beautycology specifici  
- Ogni passaggio deve includere un prodotto Beautycology reale del catalogo
- Non limitarti a consigli generici, ma prodotti specifici acquistabili

🛑 **REGOLA CRITICA N.3 - MESSAGGI COMPLETI:**
- NON TRONCARE MAI il messaggio, completa SEMPRE tutte le sezioni
- SCRIVI SEMPRE la frase finale completa: "Se hai altri dubbi o domande sui nostri prodotti, chiedi pure!"
- Se il messaggio è lungo, continua comunque fino alla fine senza interruzioni
- OGNI sezione deve essere completa e dettagliata

Dati raccolti dall'utente durante la conversazione:
- Tipo di pelle: ${answers.skinType || 'non specificato'}
- Età: ${answers.age || 'non specificata'}
- Problematica principale: ${answers.mainIssue || 'non specificata'}
- Tipo di consiglio richiesto: ${answers.adviceType || 'non specificato'}
- Informazioni aggiuntive: ${answers.additionalInfo || 'non fornite'}

# CATALOGO COMPLETO PRODOTTI BEAUTYCOLOGY (USA SOLO QUESTI PRODOTTI REALI):
${knowledgeSummary}

${ragContext ? `\n# INFORMAZIONI AGGIUNTIVE SPECIFICHE PER IL TUO CASO:\n${ragContext}\n` : ''}

DEVI OBBLIGATORIAMENTE fornire NELL'ORDINE COMPLETO:

1. **RIEPILOGO COMPLETO DELLE INFORMAZIONI REGISTRATE**:
   Inizia con: "Perfetto! 🌟 Ora che conosco meglio la tua pelle, ecco il riepilogo delle informazioni che mi hai fornito:"
   - Elenca TUTTE le informazioni raccolte dall'utente
   - Conferma ogni dato fornito

2. **ANALISI DETTAGLIATA DELLE PROBLEMATICHE RILEVATE**:
   Titolo: "📋 PROBLEMATICHE RILEVATE E ANALISI:"
   - Analisi dettagliata di ogni problema identificato
   - Spiegazione scientifica delle cause
   - Come ogni problema impatta la salute della pelle

3. **RACCOMANDAZIONI PRECISE E PERSONALIZZATE**:
   Titolo: "💫 RACCOMANDAZIONI PERSONALIZZATE:"
   - Routine COMPLETA mattina e sera con prodotti Beautycology specifici
   - Prodotti REALI dal catalogo con nomi esatti e link obbligatori
   - Ordine esatto di applicazione
   - Tecniche di applicazione specifiche per ogni prodotto
   - Tempi tra un prodotto e l'altro

4. **SKINCARE ROUTINE DETTAGLIATA CON PRODOTTI BEAUTYCOLOGY**:
   Titolo: "🌅 ROUTINE MATTINA:" e "🌙 ROUTINE SERA:"
   - Passaggi numerati e precisi
   - Nome prodotto Beautycology ESATTO + link + come applicarlo
   - Frequenza di utilizzo per ogni prodotto
   - Quantità da utilizzare (es: 2-3 gocce, chicco di riso, etc.)
   
5. **CONSIGLI SCIENTIFICI DETTAGLIATI**:
   Titolo: "🧪 SPIEGAZIONE SCIENTIFICA:"
   - Come ogni ingrediente dei prodotti Beautycology agisce sul problema specifico
   - Percentuali ingredienti attivi (es: Niacinamide 4% in Perfect & Pure Cream)
   - Timeline risultati realistici (2 settimane, 1 mese, 3 mesi)

6. **PRODOTTI BEAUTYCOLOGY CONSIGLIATI** (minimo 4-5 prodotti reali):
   Titolo: "📦 I PRODOTTI BEAUTYCOLOGY PER TE:"
   Per ogni prodotto dal catalogo:
   - Nome esatto e prezzo (formato: **[Nome Esatto](link)** (€XX,00))
   - Principi attivi e percentuali specifiche del prodotto
   - Benefici specifici per il caso dell'utente
   - Link obbligatorio al prodotto su beautycology.it

7. **CONSIGLI FINALI E TIPS PRATICI**:
   - Errori comuni da evitare nella routine
   - Tips per massimizzare i risultati con i prodotti Beautycology
   - Frequenza e modalità d'uso ottimali
   - Link a https://beautycology.it/skincare-routine/ per approfondimenti

⚠️ CONTROLLO FINALE OBBLIGATORIO:
- Verifica che ogni prodotto menzionato sia un prodotto REALE del catalogo Beautycology
- Verifica che ogni prodotto abbia il suo link completo
- Verifica che il messaggio sia COMPLETO senza troncare nessuna sezione
- CONCLUDI SEMPRE con la frase ESATTA: "Se hai altri dubbi o domande sui nostri prodotti, chiedi pure!"

❌ ESEMPI DI COSA NON FARE MAI:
❌ "detergente Beautycology" → USA: **[Mousse Away – Detergente viso](https://beautycology.it/prodotto/detergente-viso-mousse-away/)** (€8,00)
❌ "crema Beautycology per pelli miste" → USA: **[Perfect & Pure Cream](https://beautycology.it/prodotto/crema-pelli-miste-perfect-pure/)** (€30,00)
❌ "siero Beautycology" → USA prodotto specifico dal catalogo con link

Usa emoji appropriati ✨🌟💧 per rendere il testo engaging ma professionale.`;

    try {
      // Send the final prompt to Gemini with increased token limit
      const response = await ai.models.generateContent({
        model: this.modelName,
        contents: [{
          role: "user",
          parts: [{ text: finalPrompt }]
        }],
        config: {
          ...this.generationConfig,
          maxOutputTokens: 4096, // Increased significantly to prevent message truncation
          temperature: 0.2 // Lower temperature for more focused and consistent recommendations
        }
      });

      const text = response.text || "";

      if (!text || text.trim().length === 0) {
        console.log('⚠️ Empty response from AI, using fallback recommendations');
        return this.getFallbackRecommendations(answers);
      }

      // ROBUST POST-GENERATION VALIDATION AND ENFORCEMENT
      let finalText = text;
      let validationAttempts = 0;
      const maxAttempts = 2;

      while (validationAttempts < maxAttempts) {
        // Validate the AI response for generic or non-existent products
        if (this.productValidator) {
          const validation = this.productValidator.validateRecommendationText(finalText);
          if (!validation.isValid) {
            console.warn(`⚠️ AI generated problematic product recommendations (attempt ${validationAttempts + 1}):`, validation.issues);
            
            if (validationAttempts < maxAttempts - 1) {
              // Try to correct the response with a focused prompt
              console.log('🔄 Attempting to correct invalid product recommendations...');
              
              const correctionPrompt = `
CORREZIONE OBBLIGATORIA: Il testo seguente contiene errori nei prodotti raccomandati:

ERRORI IDENTIFICATI:
${validation.issues.join('\n')}

TESTO DA CORREGGERE:
${finalText}

ISTRUZIONI OBBLIGATORIE:
1. Sostituisci OGNI riferimento generico con il nome ESATTO del prodotto dal catalogo
2. Aggiungi il link completo per OGNI prodotto menzionato
3. Usa SOLO questi prodotti reali del catalogo: ${this.productValidator.getAllProductNames().join(', ')}
4. Formato obbligatorio: **[Nome Esatto Prodotto](URL completo)** (prezzo)
5. Mantieni la struttura completa del messaggio senza accorciarlo
6. CONCLUDI con: "Se hai altri dubbi o domande sui nostri prodotti, chiedi pure!"

Riscrivi il testo corretto COMPLETO:`;

              try {
                const correctionResponse = await ai.models.generateContent({
                  model: this.modelName,
                  contents: [{
                    role: "user",
                    parts: [{ text: correctionPrompt }]
                  }],
                  config: {
                    ...this.generationConfig,
                    temperature: 0.1 // Lower temperature for more consistent corrections
                  }
                });
                
                const correctedText = correctionResponse.text || "";
                if (correctedText && correctedText.trim().length > 0) {
                  finalText = correctedText;
                  validationAttempts++;
                  continue;
                }
              } catch (correctionError) {
                console.error('Error in correction attempt:', correctionError);
                break;
              }
            }
            
            // If we reach here, correction failed or max attempts reached
            console.log('🔄 Using fallback to ensure only real products are recommended');
            return this.getFallbackRecommendations(answers);
          } else {
            console.log('✅ Product validation passed successfully');
            break;
          }
        } else {
          console.warn('⚠️ ProductValidator not available');
          break;
        }
        validationAttempts++;
      }

      // FINAL COMPLETENESS CHECK - ensure the message ends properly
      if (!finalText.includes("Se hai altri dubbi o domande sui nostri prodotti, chiedi pure!")) {
        console.log('⚠️ Final sentence missing, adding it...');
        finalText += "\n\nSe hai altri dubbi o domande sui nostri prodotti, chiedi pure!";
      }

      console.log('✅ Generated and validated comprehensive recommendations successfully');
      return finalText;
    } catch (error) {
      console.error('Error generating final recommendations:', error);
      return this.getFallbackRecommendations(answers);
    }
  }

  // Fallback recommendations if AI fails - now uses real products from catalog
  private getFallbackRecommendations(answers: any): string {
    const skinType = answers.skinType?.toLowerCase() || 'mista';
    
    // Use ProductValidator to get real products for different categories
    let cleanserProducts: Array<{name: string, url: string, price: string}> = [];
    let treatmentProducts: Array<{name: string, url: string, price: string}> = [];
    let serumProducts: Array<{name: string, url: string, price: string}> = [];
    
    if (this.productValidator) {
      cleanserProducts = this.productValidator.getProductsByCategory('detergente');
      treatmentProducts = this.productValidator.getProductsByCategory('creme viso');
      serumProducts = this.productValidator.getProductsByCategory('siero');
      
      // If categories don't return products, get some general products
      if (cleanserProducts.length === 0 || treatmentProducts.length === 0 || serumProducts.length === 0) {
        const allProducts = this.productValidator.getAllProductNames();
        console.warn(`⚠️ Some product categories returned no results. Available products: ${allProducts.length}`);
      }
    }
    
    // Build product recommendations with real products or safe fallback message
    const cleanser = cleanserProducts.length > 0 ? cleanserProducts[0] : null;
    const treatment = treatmentProducts.length > 0 ? treatmentProducts[0] : null;
    const serum = serumProducts.length > 0 ? serumProducts[0] : null;

    // If we don't have enough real products, return a safe message
    if (!cleanser || !treatment) {
      return `Perfetto! 🌟 Ora che conosco meglio la tua pelle, ecco il riepilogo delle informazioni che mi hai fornito:

📋 **INFORMAZIONI REGISTRATE:**
- Tipo di pelle: ${answers.skinType || 'non specificato'}
- Età: ${answers.age || 'non specificata'}
- Problematica principale: ${answers.mainIssue || 'non specificata'}

Mi dispiace, al momento non riesco ad accedere al nostro catalogo completo per fornirti raccomandazioni specifiche sui prodotti. Ti consiglio di visitare https://beautycology.it per vedere tutti i nostri prodotti scientificamente formulati.

Se hai altri dubbi o domande sui nostri prodotti, chiedi pure!`;
    }

    return `Perfetto! 🌟 Ora che conosco meglio la tua pelle, ecco il riepilogo delle informazioni che mi hai fornito:

📋 **INFORMAZIONI REGISTRATE:**
- Tipo di pelle: ${answers.skinType || 'non specificato'}
- Età: ${answers.age || 'non specificata'}
- Problematica principale: ${answers.mainIssue || 'non specificata'}
- Ingredienti preferiti: ${answers.activesPreference || 'nessuno in particolare'}
- Routine attuale: ${answers.routineStatus || 'non specificata'}

📋 **PROBLEMATICHE RILEVATE E ANALISI:**
Basandomi sulle informazioni fornite, ho identificato le seguenti aree di miglioramento per la tua pelle che possiamo trattare efficacemente con i prodotti Beautycology formulati scientificamente.

💫 **RACCOMANDAZIONI PERSONALIZZATE:**
Ho creato per te una routine completa e personalizzata utilizzando i prodotti Beautycology più adatti alle tue esigenze.

**🌅 ROUTINE MATTINA:**
1. **Detersione**: [${cleanser.name}](${cleanser.url}) (${cleanser.price})
   - Applicare su dischetto di cotone e pulire delicatamente viso e collo
2. **Trattamento**: ${serum ? `[${serum.name}](${serum.url}) (${serum.price})` : 'Siero specifico per il tuo tipo di pelle'}
   - 2-3 gocce su viso pulito, massaggiare delicatamente
3. **Idratazione**: [${treatment.name}](${treatment.url}) (${treatment.price})
   - Applicare una quantità pari a un chicco di riso su tutto il viso
4. **Protezione solare**: SPF 50+ (sempre!)
   - Essenziale per proteggere la pelle dai danni UV

**🌙 ROUTINE SERA:**
1. **Detersione**: [${cleanser.name}](${cleanser.url})
   - Rimuove trucco e impurità accumulate durante il giorno
2. **Tonico**: Tonico Riequilibrante
   - Prepara la pelle ai trattamenti successivi
3. **Trattamento**: ${serum ? `[${serum.name}](${serum.url})` : 'Siero specifico'}
   - Applicare con movimenti circolari dal basso verso l'alto
4. **Idratazione**: [${treatment.name}](${treatment.url})
   - Strato più generoso rispetto alla mattina per nutrire la pelle durante la notte

🧪 **SPIEGAZIONE SCIENTIFICA:**
I prodotti Beautycology sono formulati con ingredienti scientificamente testati e percentuali ottimali per garantire risultati visibili. La Niacinamide al 4% nella Perfect & Pure Cream, ad esempio, è stata specificamente dosata per minimizzare l'irritazione mantenendo l'efficacia.

📦 **I PRODOTTI BEAUTYCOLOGY PER TE:**
Tutti i prodotti consigliati sono disponibili su beautycology.it con spedizione gratuita per ordini superiori a 50€.

💡 **CONSIGLI FINALI:**
- Inizia gradualmente introducendo un prodotto alla volta per permettere alla pelle di adattarsi
- La costanza è fondamentale: i primi risultati si vedono dopo 2 settimane, miglioramenti significativi dopo 1 mese
- Evita di cambiare prodotti troppo frequentemente

Se hai altri dubbi o domande sui nostri prodotti, chiedi pure!`;
  }
}

export const beautycologyAI = new BeautycologyAIService();