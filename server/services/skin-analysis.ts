
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
- 41-60: Rossori evidenti su zona T e guance
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
- 41-60: Oleosità evidente, necessità di assorbere
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

IMPORTANTE: Considera l'illuminazione, l'angolazione e la qualità dell'immagine. Sii preciso ma realistico nella valutazione.

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

      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-pro", // Use Pro for better image analysis
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
      
      // Parse the JSON response
      try {
        const analysisResult = JSON.parse(content);
        return analysisResult as SkinAnalysisResult;
      } catch (parseError) {
        console.error("Error parsing skin analysis JSON:", parseError);
        console.error("Raw response:", content);
        
        // Fallback: return default values
        return {
          rossori: 25,
          acne: 20,
          rughe: 30,
          pigmentazione: 25,
          pori_dilatati: 30,
          oleosita: 35,
          danni_solari: 20,
          occhiaie: 25,
          idratazione: 60,
          elasticita: 65,
          texture_uniforme: 70
        };
      }
    } catch (error) {
      console.error("Error analyzing skin image:", error);
      throw new Error("Failed to analyze skin image");
    }
  }
}
