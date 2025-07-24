
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

### IDRATAZIONE (0=scarsa, 100=ottima):
- 0-20: Pelle disidratata, desquamazione visibile
- 21-40: Secchezza evidente, sensazione di "tirare"
- 41-60: Idratazione insufficiente, texture ruvida
- 61-80: Buona idratazione, pelle morbida
- 81-100: Idratazione ottimale, pelle rimpolpata

### ELASTICITÀ (0=scarsa, 100=ottima):
**ATTENZIONE: L'elasticità è difficile da valutare in una foto statica. Sii MOLTO conservativo.**

**CRITERI VISIVI SPECIFICI:**
- **Perdita di tono evidente**: Pelle che appare "cascante" lungo il contorno del viso
- **Rilassamento**: Lineamenti del viso che appaiono "scesi" o poco definiti
- **Segni di invecchiamento avanzato**: Rughe profonde combinate con perdita di volume
- **Texture rilassata**: Pelle che non appare tonica e soda

**PUNTEGGI CONSERVATIVI:**
- 0-20: Solo se evidenti segni di rilassamento severo (pelle molto matura, >50 anni)
- 21-40: Solo se chiari segni di perdita di tono (cedimenti visibili, lineamenti poco definiti)
- 41-60: Pelle che mostra lievi segni di perdita di tono ma non evidenti
- 61-80: Pelle normale per l'età, nessun segno evidente di rilassamento
- 81-100: Pelle giovane e tonica, lineamenti ben definiti

**REGOLA CRITICA**: Per soggetti sotto i 35 anni, assegna SEMPRE punteggi 70-100 salvo evidenti problemi strutturali. L'elasticità diminuisce naturalmente con l'età, non assegnare punteggi bassi senza motivi evidenti.

### TEXTURE UNIFORME (0=irregolare, 100=liscia):
- 0-20: Texture molto irregolare, superficie ruvida
- 21-40: Texture disomogenea, piccole imperfezioni
- 41-60: Texture mediamente uniforme
- 61-80: Buona uniformità, superficie liscia
- 81-100: Texture perfetta, "pelle di porcellana"

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
- Elasticità: default conservativo 70-85 per pelli normali, 60-70 solo per pelli mature

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
    
    // 1. ELASTICITÀ - Correzione per falsi positivi
    // Se tutti gli altri parametri indicano pelle giovane/sana, elasticità non può essere troppo bassa
    const healthyIndicators = [
      validated.rughe < 30,
      validated.danni_solari < 35,
      validated.acne < 50,
      validated.idratazione > 60
    ].filter(Boolean).length;
    
    if (healthyIndicators >= 3 && validated.elasticita < 50) {
      console.log(`⚠️ Correzione elasticità: da ${validated.elasticita} a 75 (pelle sembra giovane/sana)`);
      validated.elasticita = 75;
    }
    
    // 2. COERENZA TRA PARAMETRI CORRELATI
    // Se idratazione alta, elasticità non può essere troppo bassa
    if (validated.idratazione > 70 && validated.elasticita < 40) {
      console.log(`⚠️ Correzione elasticità per coerenza idratazione: da ${validated.elasticita} a 65`);
      validated.elasticita = 65;
    }
    
    // Se acne molto bassa, pori dilatati non possono essere altissimi
    if (validated.acne < 20 && validated.pori_dilatati > 75) {
      console.log(`⚠️ Correzione pori dilatati: da ${validated.pori_dilatati} a 55 (acne bassa)`);
      validated.pori_dilatati = 55;
    }
    
    // 3. CONTROLLO GENERALE - Troppi parametri critici contemporaneamente
    const criticalParams = Object.entries(validated)
      .filter(([key, value]) => {
        if (['idratazione', 'elasticita', 'texture_uniforme'].includes(key)) {
          return value < 30; // Per questi parametri, valori bassi = problema
        }
        return value > 70; // Per gli altri, valori alti = problema
      }).length;
    
    if (criticalParams > 4) {
      console.log(`⚠️ Troppi parametri critici (${criticalParams}), riducendo severità di alcuni`);
      
      // Riduci i parametri meno evidenti
      if (validated.elasticita < 40) validated.elasticita = Math.min(validated.elasticita + 20, 60);
      if (validated.danni_solari > 60) validated.danni_solari = Math.max(validated.danni_solari - 15, 50);
      if (validated.texture_uniforme < 40) validated.texture_uniforme = Math.min(validated.texture_uniforme + 15, 55);
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

  async analyzeImage(imagePath: string): Promise<SkinAnalysisResult> {
    try {
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

      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-pro", // Use Pro for better image analysis accuracy
        config: {
          systemInstruction: SKIN_ANALYSIS_INSTRUCTION,
        },
        contents: [{
          role: "user",
          parts: [{
            inlineData: {
              data: base64Image,
              mimeType: mimeType
            }
          }]
        }]
      });

      const content = response.text || "";
      console.log("Raw AI response:", content);
      
      // Clean the response to remove markdown formatting
      const cleanedContent = this.cleanJsonResponse(content);
      console.log("Cleaned response:", cleanedContent);
      
      // Parse the JSON response
      try {
        const rawAnalysisResult = JSON.parse(cleanedContent);
        console.log("Raw analysis result:", rawAnalysisResult);
        
        // Apply validation and corrections
        const validatedResult = this.validateAndCorrectAnalysis(rawAnalysisResult);
        console.log("Validated analysis result:", validatedResult);
        
        return validatedResult;
      } catch (parseError) {
        console.error("Error parsing skin analysis JSON:", parseError);
        console.error("Raw response:", content);
        console.error("Cleaned response:", cleanedContent);
        
        // No fallback - throw error to force retry
        throw new Error(`Failed to parse skin analysis JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
    } catch (error) {
      console.error("Error analyzing skin image:", error);
      throw new Error("Failed to analyze skin image");
    }
  }
}
