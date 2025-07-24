
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
**⚠️ REGOLA ASSOLUTA: L'ELASTICITÀ È QUASI IMPOSSIBILE DA VALUTARE IN UNA FOTO STATICA**

**PRESUNZIONE DI NORMALITÀ**: Assumi SEMPRE che l'elasticità sia normale (75-95) salvo EVIDENZE INEQUIVOCABILI di problemi strutturali gravi.

**QUANDO ASSEGNARE PUNTEGGI PROBLEMATICI (<60):**
- SOLO se la persona appare visibilmente over 60 anni E ha cedimenti evidenti del viso
- SOLO se ci sono rughe profondissime combinate con perdita di volume evidente
- SOLO se il contorno del viso appare gravemente compromesso

**PUNTEGGI ULTRA-CONSERVATIVI:**
- 0-30: MAI assegnare salvo casi estremi di pelle molto anziana (>65 anni) con gravi cedimenti
- 31-50: Solo per persone mature (>55 anni) con segni evidenti di rilassamento
- 51-70: Pelle adulta normale senza segni particolari
- 71-85: DEFAULT per qualsiasi pelle che non mostra problemi evidenti
- 86-100: Pelle giovane o particolarmente tonica

**REGOLE FERREE:**
1. **Età apparente <40 anni**: SEMPRE punteggio 80-95
2. **Età apparente 40-55 anni**: SEMPRE punteggio 70-85  
3. **Età apparente >55 anni**: Considera 60-80 solo se ci sono segni evidenti
4. **In caso di dubbio**: SEMPRE scegli il punteggio PIÙ ALTO possibile

**IMPORTANTE**: È meglio sottovalutare un problema di elasticità che sovrastimarlo. L'elasticità vera si valuta al tatto, non dalla foto.

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
    
    // 1. ELASTICITÀ - Correzione ULTRA-AGGRESSIVA per falsi positivi
    
    // REGOLA 1: Se la pelle sembra giovane (pochi segni di invecchiamento), elasticità deve essere alta
    const youthIndicators = [
      validated.rughe < 40,        // Poche rughe
      validated.danni_solari < 40, // Pochi danni solari  
      validated.idratazione > 60,  // Buona idratazione
      validated.acne > 30          // Anche acne indica spesso pelle giovane
    ].filter(Boolean).length;
    
    if (youthIndicators >= 2 && validated.elasticita < 70) {
      console.log(`🔧 CORREZIONE ELASTICITÀ: da ${validated.elasticita} a 80 (indicatori di pelle giovane: ${youthIndicators})`);
      validated.elasticita = 80;
    }
    
    // REGOLA 2: Default conservativo - se elasticità è troppo bassa senza motivo, correggila
    if (validated.elasticita < 60 && validated.rughe < 50) {
      console.log(`🔧 CORREZIONE ELASTICITÀ CONSERVATIVA: da ${validated.elasticita} a 75 (no rughe severe)`);
      validated.elasticita = 75;
    }
    
    // REGOLA 3: Se idratazione è alta, elasticità deve essere almeno buona
    if (validated.idratazione > 70 && validated.elasticita < 65) {
      console.log(`🔧 CORREZIONE ELASTICITÀ-IDRATAZIONE: da ${validated.elasticita} a 75 (pelle ben idratata)`);
      validated.elasticita = 75;
    }
    
    // REGOLA 4: Se nessun parametro di invecchiamento è critico, elasticità deve essere normale
    const agingProblems = [
      validated.rughe > 60,
      validated.danni_solari > 60,
      validated.pigmentazione > 70
    ].filter(Boolean).length;
    
    if (agingProblems === 0 && validated.elasticita < 70) {
      console.log(`🔧 CORREZIONE ELASTICITÀ NO-AGING: da ${validated.elasticita} a 80 (nessun segno di invecchiamento critico)`);
      validated.elasticita = 80;
    }
    
    // REGOLA 5: SICUREZZA FINALE - SOGLIA MINIMA ASSOLUTA per elasticità
    if (validated.elasticita < 60) {
      console.log(`🚨 CORREZIONE SICUREZZA FINALE: da ${validated.elasticita} a 75 (soglia minima assoluta)`);
      validated.elasticita = 75;
    }
    
    // REGOLA 6: ULTRA-SICUREZZA - Nessuna elasticità può essere sotto 70 senza motivi gravi
    if (validated.elasticita < 70 && validated.rughe < 60) {
      console.log(`🛡️ ULTRA-SICUREZZA ELASTICITÀ: da ${validated.elasticita} a 75 (nessuna rughe severe)`);
      validated.elasticita = 75;
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
