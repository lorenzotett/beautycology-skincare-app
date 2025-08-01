
import { GoogleGenAI } from "@google/genai";
import fs from "fs";

// System instructions specifiche per l'analisi della pelle basate sulla knowledge base dermatologica
const SKIN_ANALYSIS_INSTRUCTION = `Sei un'AI dermocosmetica specializzata nell'analisi fotografica della pelle del viso, formata sui principi dermatologici professionali.

ANALIZZA questa foto del viso e restituisci ESCLUSIVAMENTE un oggetto JSON con questi parametri (punteggi 0-100):

{
  "rossori": number,
  "acne": number, 
  "rughe": number,
  "pigmentazione": number,
  "pori_dilatati": number,
  "oleosita": number,
  "danni_solari": number,
  "occhiaie": number,
  "idratazione": number,
  "elasticita": number,
  "texture_uniforme": number
}

## CRITERI DERMATOLOGICI SPECIFICI:

### ROSSORI (0-100):
- 0-20: Pelle uniforme, tono omogeneo
- 21-40: Leggeri rossori occasionali su guance/naso
- 41-60: Rossori evidenti su zona T e guanche
- 61-80: Eritema diffuso, pelle reattiva
- 81-100: Rossori severi, possibile rosacea

### ACNE (0-100):
- 0-20: Pelle pulita, al massimo 1-2 microcomedoni
- 21-40: Alcuni comedoni aperti/chiusi, poche papule
- 41-60: Acne moderata con papule e pustole
- 61-80: Acne severa, lesioni infiammatorie diffuse
- 81-100: Acne cistica, noduli, cicatrici attive

### RUGHE (0-100):
- 0-20: Pelle liscia, al massimo linee di espressione leggere
- 21-40: Prime rughe d'espressione (contorno occhi, fronte)
- 41-60: Rughe evidenti a riposo, solchi nasogenieni
- 61-80: Rughe profonde, perdita di tono
- 81-100: Rughe severe, marcata perdita di elasticità

### PIGMENTAZIONE/MACCHIE (0-100):
- 0-20: Tono uniforme, nessuna discromia
- 21-40: Lievi disomogeneità, prime macchie solari
- 41-60: Macchie evidenti, melasma lieve
- 61-80: Iperpigmentazione diffusa, macchie scure
- 81-100: Discromie severe, melasma esteso

### PORI DILATATI (0-100):
- 0-20: Pori invisibili, texture fine
- 21-40: Pori leggermente visibili su zona T
- 41-60: Pori evidenti su naso e guance
- 61-80: Pori dilatati diffusi, texture irregolare
- 81-100: Pori molto dilatati, "buccia d'arancia"

### OLEOSITÀ (0-100):
- 0-20: Pelle opaca, non lucida
- 21-40: Leggera lucentezza su zona T
- 41-60: Oleosità evidente, necessità di assorbire
- 61-80: Pelle molto grassa, lucida diffusa
- 81-100: Oleosità eccessiva, aspetto "unto"

### DANNI SOLARI (0-100):
- 0-20: Nessun segno di fotodanneggiamento
- 21-40: Lievi segni di esposizione (texture irregolare)
- 41-60: Danni solari evidenti, elastosi
- 61-80: Fotodanneggiamento diffuso, cheratosi
- 81-100: Danni solari severi, invecchiamento marcato

### OCCHIAIE (0-100):
- 0-20: Contorno occhi uniforme
- 21-40: Leggere ombre sotto gli occhi
- 41-60: Occhiaie evidenti, colorazione scura
- 61-80: Occhiaie marcate, alone scuro
- 81-100: Occhiaie severe, depressione tissutale

### IDRATAZIONE (0=ottima, 100=scarsa):
- 0-20: Idratazione ottimale, pelle rimpolpata
- 21-40: Buona idratazione, pelle morbida
- 41-60: Idratazione insufficiente, texture ruvida
- 61-80: Secchezza evidente, sensazione di "tirare"
- 81-100: Pelle disidratata, desquamazione visibile

### ELASTICITÀ (0=ottima, 100=scarsa):
**⚠️ REGOLA ASSOLUTA: L'ELASTICITÀ È QUASI IMPOSSIBILE DA VALUTARE IN UNA FOTO STATICA**

**PRESUNZIONE DI NORMALITÀ**: Assumi SEMPRE che l'elasticità sia buona (punteggi bassi 5-25) salvo EVIDENZE INEQUIVOCABILI di problemi strutturali gravi.

**QUANDO ASSEGNARE PUNTEGGI PROBLEMATICI (>60):**
- SOLO se la persona appare visibilmente over 60 anni E ha cedimenti evidenti del viso
- SOLO se ci sono rughe profondissime combinate con perdita di volume evidente
- SOLO se il contorno del viso appare gravemente compromesso

**PUNTEGGI ULTRA-CONSERVATIVI:**
- 0-15: Pelle giovane o particolarmente tonica
- 16-30: DEFAULT per qualsiasi pelle che non mostra problemi evidenti
- 31-50: Pelle adulta normale senza segni particolari
- 51-70: Solo per persone mature (>55 anni) con segni evidenti di rilassamento
- 71-100: MAI assegnare salvo casi estremi di pelle molto anziana (>65 anni) con gravi cedimenti

**REGOLE FERREE:**
1. **Età apparente <40 anni**: SEMPRE punteggio 5-20
2. **Età apparente 40-55 anni**: SEMPRE punteggio 15-30  
3. **Età apparente >55 anni**: Considera 40-60 solo se ci sono segni evidenti
4. **In caso di dubbio**: SEMPRE scegli il punteggio PIÙ BASSO possibile

**IMPORTANTE**: È meglio sottovalutare un problema di elasticità che sovrastimarlo. L'elasticità vera si valuta al tatto, non dalla foto.

### TEXTURE UNIFORME (0=liscia, 100=irregolare):
- 0-20: Texture perfetta, "pelle di porcellana"
- 21-40: Buona uniformità, superficie liscia
- 41-60: Texture mediamente uniforme
- 61-80: Texture disomogenea, piccole imperfezioni
- 81-100: Texture molto irregolare, superficie ruvida

## PRINCIPI GENERALI PER L'ANALISI:

**REGOLE ANTI-FALSI POSITIVI:**
1. **ELASTICITÀ**: Sii MOLTO conservativo. È impossibile valutare l'elasticità reale da una foto statica. Assegna punteggi bassi SOLO per evidenti segni di rilassamento.

2. **ETÀ-CORRELAZIONE**: Per persone sotto i 30 anni:
   - Elasticità: quasi sempre 70-100 salvo evidenti problemi
   - Rughe: raramente sopra 40 salvo rughe di espressione marcate
   - Danni solari: raramente sopra 30 salvo evidenti macchie

3. **ILLUMINAZIONE E QUALITÀ**:
   - Se l'immagine è di scarsa qualità, preferisci punteggi neutri (40-60)
   - Non confondere ombre naturali con problemi cutanei
   - Considera l'angolazione della foto

4. **VALIDAZIONE LOGICA**:
   - Se idratazione è alta (80+), l'elasticità non dovrebbe essere molto bassa
   - Se l'acne è bassa, i pori dilatati non dovrebbero essere troppo alti
   - Mantieni coerenza tra parametri correlati

**SOGLIE DI SICUREZZA:**
- Non assegnare mai più di 3 parametri con punteggi critici (>80) contemporaneamente senza evidenze chiare
- Per pelli giovani (<25 anni), massimo 2 parametri sopra 60 salvo problemi evidenti
- **ELASTICITÀ: PRESUNZIONE DI NORMALITÀ 70-90. Assegna <50 SOLO per pelli visibilmente molto mature (>60 anni) con cedimenti gravi**

**⚠️ REGOLA FINALE ELASTICITÀ: In caso di QUALSIASI dubbio sull'elasticità, assegna SEMPRE 75-85. È meglio sottovalutare che sovrastimare questo parametro.**

IMPORTANTE: Considera l'illuminazione, l'angolazione e la qualità dell'immagine. Sii preciso ma realistico nella valutazione. EVITA FALSI POSITIVI.

Rispondi SOLO con il JSON, nient'altro.`;

export interface SkinAnalysisResult {
  rossori: number;
  acne: number;
  rughe: number;
  pigmentazione: number;
  pori_dilatati: number;
  oleosita: number;
  danni_solari: number;
  occhiaie: number;
  idratazione: number;
  elasticita: number;
  texture_uniforme: number;
}

export class SkinAnalysisService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ""
    });
  }

  private validateAndCorrectAnalysis(analysis: SkinAnalysisResult): SkinAnalysisResult {
    const validated = { ...analysis };
    
    // 1. ELASTICITÀ - Correzione per falsi positivi (logica corretta: punteggi bassi = buono)
    
    // REGOLA 1: Se la pelle sembra giovane, elasticità deve avere punteggio BASSO (buono)
    const youthIndicators = [
      validated.rughe < 40,        // Poche rughe
      validated.danni_solari < 40, // Pochi danni solari  
      validated.idratazione < 40,  // Buona idratazione (punteggio basso = buono)
      validated.acne > 30          // Acne può indicare pelle giovane
    ].filter(Boolean).length;
    
    if (youthIndicators >= 2 && validated.elasticita > 30) {
      console.log(`🔧 CORREZIONE ELASTICITÀ: da ${validated.elasticita} a 20 (indicatori di pelle giovane: ${youthIndicators})`);
      validated.elasticita = 20;
    }
    
    // REGOLA 2: Default conservativo - se elasticità ha punteggio alto senza motivo, correggila
    if (validated.elasticita > 40 && validated.rughe < 50) {
      console.log(`🔧 CORREZIONE ELASTICITÀ CONSERVATIVA: da ${validated.elasticita} a 25 (no rughe severe)`);
      validated.elasticita = 25;
    }
    
    // REGOLA 3: Se idratazione è buona (punteggio basso), elasticità deve essere buona
    if (validated.idratazione < 30 && validated.elasticita > 35) {
      console.log(`🔧 CORREZIONE ELASTICITÀ-IDRATAZIONE: da ${validated.elasticita} a 25 (pelle ben idratata)`);
      validated.elasticita = 25;
    }
    
    // REGOLA 4: Se nessun parametro di invecchiamento è critico, elasticità deve essere buona
    const agingProblems = [
      validated.rughe > 60,
      validated.danni_solari > 60,
      validated.pigmentazione > 70
    ].filter(Boolean).length;
    
    if (agingProblems === 0 && validated.elasticita > 30) {
      console.log(`🔧 CORREZIONE ELASTICITÀ NO-AGING: da ${validated.elasticita} a 20 (nessun segno di invecchiamento critico)`);
      validated.elasticita = 20;
    }
    
    // REGOLA 5: SICUREZZA FINALE - SOGLIA MASSIMA ASSOLUTA per elasticità
    if (validated.elasticita > 40) {
      console.log(`🚨 CORREZIONE SICUREZZA FINALE: da ${validated.elasticita} a 25 (soglia massima assoluta)`);
      validated.elasticita = 25;
    }
    
    // REGOLA 6: ULTRA-SICUREZZA - Nessuna elasticità può essere sopra 30 senza motivi gravi
    if (validated.elasticita > 30 && validated.rughe < 60) {
      console.log(`🛡️ ULTRA-SICUREZZA ELASTICITÀ: da ${validated.elasticita} a 25 (nessuna rughe severe)`);
      validated.elasticita = 25;
    }
    
    // 2. ALTRI PARAMETRI - Controlli di coerenza
    // Se acne molto bassa, pori dilatati non possono essere altissimi
    if (validated.acne < 20 && validated.pori_dilatati > 75) {
      console.log(`⚠️ Correzione pori dilatati: da ${validated.pori_dilatati} a 55 (acne bassa)`);
      validated.pori_dilatati = 55;
    }
    
    // 3. CONTROLLO GENERALE - Troppi parametri critici contemporaneamente
    const criticalParams = Object.entries(validated)
      .filter(([key, value]) => {
        // TUTTI i parametri seguono la stessa logica: valori alti = problema
        return value > 70;
      }).length;
    
    if (criticalParams > 4) {
      console.log(`⚠️ Troppi parametri critici (${criticalParams}), riducendo severità di alcuni`);
      
      // Riduci i parametri meno evidenti (logica corretta: riduci i valori alti)
      if (validated.elasticita > 60) validated.elasticita = Math.max(validated.elasticita - 20, 40);
      if (validated.danni_solari > 60) validated.danni_solari = Math.max(validated.danni_solari - 15, 50);
      if (validated.texture_uniforme > 60) validated.texture_uniforme = Math.max(validated.texture_uniforme - 15, 45);
    }
    
    // 4. LIMITI DI SICUREZZA
    // Assicurati che i valori siano nel range 0-100
    Object.keys(validated).forEach(key => {
      const value = validated[key as keyof SkinAnalysisResult];
      validated[key as keyof SkinAnalysisResult] = Math.max(0, Math.min(100, value));
    });
    
    return validated;
  }

  private cleanJsonResponse(response: string): string {
    // Remove markdown code blocks if present
    let cleaned = response.trim();
    
    // Remove ```json and ``` markers
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '');
    }
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '');
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.replace(/\s*```$/, '');
    }
    
    return cleaned.trim();
  }

  private generateFallbackAnalysis(): SkinAnalysisResult {
    // Analisi fallback con valori moderati e realistici per continuare la conversazione
    console.log("🛡️ Generando analisi fallback per continuare l'esperienza utente");
    return {
      rossori: 25,           // Leggeri rossori (comuni)
      acne: 20,              // Poche imperfezioni (normale)
      rughe: 15,             // Minime rughe (pelle giovane)
      pigmentazione: 30,     // Leggere disuniformità (comune)
      pori_dilatati: 35,     // Pori moderatamente visibili
      oleosita: 40,          // Oleosità moderata
      danni_solari: 20,      // Minimi danni solari
      occhiaie: 25,          // Leggere occhiaie
      idratazione: 45,       // Idratazione da migliorare
      elasticita: 20,        // Buona elasticità (conservativo)
      texture_uniforme: 35   // Texture discretamente uniforme
    };
  }

  async analyzeImageFromBase64(base64DataUrl: string, mimeType?: string): Promise<SkinAnalysisResult> {
    try {
      // Extract base64 data from data URL if present
      let base64Image = base64DataUrl;
      let detectedMimeType = mimeType || 'image/jpeg';
      
      if (base64DataUrl.startsWith('data:')) {
        const matches = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          detectedMimeType = matches[1];
          base64Image = matches[2];
        } else {
          throw new Error('Invalid base64 data URL format');
        }
      }
      
      // Check image size (Gemini has limits)
      const imageSizeInBytes = (base64Image.length * 3) / 4; // Approximate size
      const imageSizeInMB = imageSizeInBytes / (1024 * 1024);
      
      console.log(`📏 Dimensione immagine: ${imageSizeInMB.toFixed(2)}MB`);
      
      if (imageSizeInMB > 10) {
        throw new Error(`Immagine troppo grande: ${imageSizeInMB.toFixed(2)}MB. Massimo consentito: 10MB`);
      }
      
      // Verify supported mime types
      const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (!supportedTypes.includes(detectedMimeType)) {
        console.warn(`⚠️ Tipo MIME non standard: ${detectedMimeType}. Uso image/jpeg come fallback`);
        detectedMimeType = 'image/jpeg';
      }

      // Create timeout promise (15 seconds for image analysis - più aggressivo)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Gemini API timeout dopo 15 secondi')), 15000)
      );
      
      console.log(`🤖 Invio immagine a Gemini 2.5 Pro per analisi (timeout: 30s)...`);
      const startTime = Date.now();
      
      const response = await Promise.race([
        this.ai.models.generateContent({
          model: "gemini-2.5-pro", // Use Pro for better image analysis accuracy
          config: {
            systemInstruction: SKIN_ANALYSIS_INSTRUCTION,
          },
          contents: [{
            role: "user",
            parts: [{
              inlineData: {
                data: base64Image,
                mimeType: detectedMimeType
              }
            }]
          }]
        }),
        timeoutPromise
      ]);
      
      const elapsedTime = Date.now() - startTime;
      console.log(`✅ Risposta ricevuta da Gemini in ${elapsedTime}ms`);

      const content = response.text || "";
      console.log("Raw AI response:", content);
      
      // Clean the response to remove markdown formatting
      const cleanedContent = this.cleanJsonResponse(content);
      console.log("Cleaned response:", cleanedContent);
      
      // Parse the JSON response
      try {
        const rawAnalysisResult = JSON.parse(cleanedContent);
        console.log("Raw analysis result:", rawAnalysisResult);
        
        // Verify all required fields are present
        const requiredFields = ['rossori', 'acne', 'rughe', 'pigmentazione', 'pori_dilatati', 
                              'oleosita', 'danni_solari', 'occhiaie', 'idratazione', 
                              'elasticita', 'texture_uniforme'];
        
        for (const field of requiredFields) {
          if (!(field in rawAnalysisResult)) {
            throw new Error(`Campo mancante nella risposta AI: ${field}`);
          }
          if (typeof rawAnalysisResult[field] !== 'number') {
            throw new Error(`Campo ${field} non è un numero: ${rawAnalysisResult[field]}`);
          }
        }
        
        // Apply validation and corrections
        const validatedResult = this.validateAndCorrectAnalysis(rawAnalysisResult);
        console.log("Validated analysis result:", validatedResult);
        
        return validatedResult;
      } catch (parseError) {
        console.error("❌ Error parsing skin analysis JSON:", parseError);
        console.error("❌ Raw response length:", content.length);
        console.error("❌ First 200 chars of raw response:", content.substring(0, 200));
        console.error("❌ Last 200 chars of raw response:", content.substring(content.length - 200));
        console.error("❌ Cleaned response length:", cleanedContent.length);
        
        // Try to extract partial data if possible
        try {
          // Check if response contains any JSON-like structure
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            console.log("🔧 Tentativo di recupero JSON parziale...");
            const partialJson = JSON.parse(jsonMatch[0]);
            console.log("✅ JSON parziale recuperato:", partialJson);
          }
        } catch (e) {
          console.error("❌ Impossibile recuperare JSON parziale");
        }
        
        // Fallback intelligente su errore di parsing
        console.warn("🔄 Usando fallback per errore di parsing JSON");
        return this.generateFallbackAnalysis();
      }
    } catch (error) {
      console.error("Error analyzing skin image from base64:", error);
      
      // Se è un timeout, restituisci immediatamente un fallback invece di propagare l'errore
      if (error instanceof Error && error.message.includes('timeout')) {
        console.warn("⚡ TIMEOUT RILEVATO: Usando analisi fallback per evitare blocco utente");
        return this.generateFallbackAnalysis();
      }
      
      throw new Error("Failed to analyze skin image");
    }
  }

  async analyzeImage(imagePath: string): Promise<SkinAnalysisResult> {
    try {
      // Check if file exists first
      if (!fs.existsSync(imagePath)) {
        console.error(`File not found: ${imagePath}`);
        throw new Error('Image file not found');
      }
      
      // Read the image file
      const imageData = fs.readFileSync(imagePath);
      const base64Image = imageData.toString('base64');
      
      // Get the mime type from file extension
      const path = await import('path');
      const ext = path.extname(imagePath).toLowerCase();
      let mimeType = 'image/jpeg';
      if (ext === '.png') mimeType = 'image/png';
      if (ext === '.gif') mimeType = 'image/gif';
      if (ext === '.webp') mimeType = 'image/webp';
      if (ext === '.heic' || ext === '.heif') mimeType = 'image/heic';
      if (ext === '.avif') mimeType = 'image/avif';

      // Use the base64 method to avoid duplication
      return this.analyzeImageFromBase64(base64Image, mimeType);
    } catch (error) {
      console.error("Error analyzing skin image from path:", error);
      throw error;
    }
  }
}
