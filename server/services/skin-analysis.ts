
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
CERCA ATTENTAMENTE questi tipi di discromie:
- Macchie solari (marroni/beige su fronte, guance, naso)
- Melasma (macchie simmetriche scure su guance/fronte)
- Iperpigmentazione post-infiammatoria (macchie dopo acne)
- Lentiggini e efelidi
- Discromie generali del tono della pelle

VALUTAZIONE:
- 0-15: Tono perfettamente uniforme, zero macchie visibili
- 16-30: Minime imperfezioni del tono, lentiggini sparse
- 31-50: Macchie solari evidenti o lievi discromie localizzate
- 51-70: Melasma moderato o macchie diffuse su più zone
- 71-85: Iperpigmentazione marcata, macchie scure estese
- 86-100: Discromie severe, melasma esteso, tono molto irregolare

ATTENZIONE: Esamina OGNI ZONA del viso per macchie anche sottili. Le discromie possono essere lievi ma significative.

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
- 0-20: Pelle rilassata, perdita di tono evidente
- 21-40: Elasticità ridotta, primi cedimenti
- 41-60: Tono discreto ma non ottimale
- 61-80: Buona elasticità, pelle tonica
- 81-100: Elasticità eccellente, pelle soda

### TEXTURE UNIFORME (0=irregolare, 100=liscia):
- 0-20: Texture molto irregolare, superficie ruvida
- 21-40: Texture disomogenea, piccole imperfezioni
- 41-60: Texture mediamente uniforme
- 61-80: Buona uniformità, superficie liscia
- 81-100: Texture perfetta, "pelle di porcellana"

IMPORTANTE: 
1. ESAMINA ATTENTAMENTE ogni zona del viso per macchie e discromie
2. Guarda oltre l'illuminazione generale - cerca variazioni di colore localizzate
3. Le macchie possono essere sottili ma vanno rilevate
4. Confronta diverse aree del viso per identificare disomogeneità
5. Presta particolare attenzione a: fronte, tempie, guance, naso, mento

PRIORITÀ MASSIMA al rilevamento accurato della PIGMENTAZIONE.

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
        model: "gemini-2.5-pro", // Use Pro for better image analysis
        config: {
          systemInstruction: SKIN_ANALYSIS_INSTRUCTION,
          temperature: 0.3, // Lower temperature for more consistent analysis
          topP: 0.8, // More focused on likely outputs
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
        const analysisResult = JSON.parse(cleanedContent);
        console.log("Parsed analysis result:", analysisResult);
        
        // Validate pigmentation results - if too low, might need re-analysis
        if (analysisResult.pigmentazione < 10) {
          console.log("Low pigmentation detected, results validated");
        }
        
        return analysisResult as SkinAnalysisResult;
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
