import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChatMessage } from '@shared/schema';

interface ExtractedData {
  informazioni_base: {
    eta: string | null;
    sesso: string | null;
    email: string | null;
  };
  analisi_pelle: {
    tipo_pelle: string | null;
    punteggio_generale: string | null;
    problemi_principali: string[];
    oleosita_score: string | null;
    acne_score: string | null;
    rossori_score: string | null;
  };
  abitudini_lifestyle: {
    protezione_solare: string | null;
    idratazione_quotidiana: string | null;
    ore_sonno: string | null;
    alimentazione: string | null;
    fumo: string | null;
    stress_level: string | null;
    utilizzo_scrub: string | null;
  };
  preferenze_prodotti: {
    allergie: string | null;
    profumo_fiori: string | null;
    routine_attuale: string | null;
  };
  analisi_conversazione: {
    fase_completata: string | null;
    accesso_prodotti: string | null;
    qualita_dati: string | null;
    note_aggiuntive: string | null;
  };
}

export class AdvancedAIExtractor {
  private genAI: GoogleGenerativeAI;
  
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async extractConversationData(messages: ChatMessage[]): Promise<ExtractedData | null> {
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        systemInstruction: `Sei un assistente AI specializzato nell'analisi e categorizzazione di conversazioni di consulenza dermatologica per l'estrazione di dati strutturati.
Il tuo compito è analizzare le conversazioni tra utenti e un AI skin expert, estraendo e organizzando le informazioni in modo intelligente per l'inserimento in Google Sheets.

### OUTPUT RICHIESTO:
Restituisci un JSON con i seguenti campi:
{
  "informazioni_base": {
    "eta": "età estratta o dedotta",
    "sesso": "Uomo/Donna",
    "email": "email se fornita"
  },
  "analisi_pelle": {
    "tipo_pelle": "Grassa/Secca/Mista/Normale/Sensibile",
    "punteggio_generale": "0-100",
    "problemi_principali": ["acne", "rossori", "secchezza", "etc"],
    "oleosita_score": "0-100",
    "acne_score": "0-100",
    "rossori_score": "0-100"
  },
  "abitudini_lifestyle": {
    "protezione_solare": "Sì/No/Occasionalmente",
    "idratazione_quotidiana": "litri acqua al giorno",
    "ore_sonno": "ore medie",
    "alimentazione": "Bilanciata/Non bilanciata",
    "fumo": "Sì/No",
    "stress_level": "Basso/Medio/Alto",
    "utilizzo_scrub": "Sì/No/Occasionalmente"
  },
  "preferenze_prodotti": {
    "allergie": "lista ingredienti o 'Nessuna'",
    "profumo_fiori": "Sì/No",
    "routine_attuale": "descrizione routine esistente"
  },
  "analisi_conversazione": {
    "fase_completata": "consultazione_completa/parziale/solo_analisi",
    "accesso_prodotti": "Sì/No",
    "qualita_dati": "Alta/Media/Bassa",
    "note_aggiuntive": "osservazioni rilevanti"
  }
}

REGOLE DI ESTRAZIONE:
Priorità di estrazione:
1. Dati espliciti dichiarati dall'utente (priorità massima)
2. Informazioni dedotte dall'AI durante l'analisi
3. Inferenze logiche basate sul contesto

Gestione dati mancanti:
- Se un dato non è presente, usa null
- Se è parzialmente presente, estrai quello disponibile
- Marca come "(dedotto)" le informazioni inferite

Analisi intelligente:
- Riconosci pattern nelle risposte anche se non seguono l'ordine standard
- Estrai informazioni anche da descrizioni libere
- Identifica contraddizioni e privilegi l'informazione più recente

Categorizzazione skin type:
- Se oleosità > 70 O acne > 60: "Grassa"
- Se rossori > 50: "Sensibile"
- Se oleosità < 30: "Secca"
- Altrimenti: "Mista"

ESEMPI DI PATTERN DA RICONOSCERE:
Età: "ho 25 anni", "25enne", "sono del '99"
Genere: "sono una ragazza", "uomo di", "donna"
Routine: "uso solo acqua", "crema la sera", "niente trucco"
Problemi: "ho sempre brufoli", "pelle che tira", "macchie rosse"

Analizza attentamente ogni conversazione e estrai tutti i dati possibili mantenendo alta precisione e completezza.`
      });

      // Prepare conversation data
      const conversationText = JSON.stringify(messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })));

      console.log('🤖 Advanced AI extraction starting...');
      
      const result = await model.generateContent(conversationText);
      const response = await result.response;
      const text = response.text();

      console.log('🤖 AI response received, parsing JSON...');

      // Parse JSON response
      try {
        const extractedData = JSON.parse(text) as ExtractedData;
        console.log('✅ Advanced AI extraction completed successfully');
        return extractedData;
      } catch (parseError) {
        console.error('Failed to parse AI response as JSON:', parseError);
        console.log('Raw AI response:', text);
        return null;
      }

    } catch (error) {
      console.error('Advanced AI extraction error:', error);
      return null;
    }
  }

  // Convert extracted data to Google Sheets format
  convertToSheetsFormat(extractedData: ExtractedData): any {
    return {
      eta: extractedData.informazioni_base.eta || '',
      sesso: extractedData.informazioni_base.sesso || '',
      tipoPelle: extractedData.analisi_pelle.tipo_pelle || '',
      problemiPelle: extractedData.analisi_pelle.problemi_principali.join(', ') || '',
      punteggioPelle: extractedData.analisi_pelle.punteggio_generale || '',
      routine: extractedData.preferenze_prodotti.routine_attuale || '',
      prodotti: extractedData.preferenze_prodotti.routine_attuale || '',
      allergie: extractedData.preferenze_prodotti.allergie || '',
      profumo: extractedData.preferenze_prodotti.profumo_fiori || '',
      sonno: extractedData.abitudini_lifestyle.ore_sonno || '',
      stress: extractedData.abitudini_lifestyle.stress_level || '',
      alimentazione: extractedData.abitudini_lifestyle.alimentazione || '',
      fumo: extractedData.abitudini_lifestyle.fumo || '',
      idratazione: extractedData.abitudini_lifestyle.idratazione_quotidiana || '',
      protezioneSolare: extractedData.abitudini_lifestyle.protezione_solare || '',
      qualitaDati: extractedData.analisi_conversazione.qualita_dati || '',
      faseCompletata: extractedData.analisi_conversazione.fase_completata || '',
      accessoProdotti: extractedData.analisi_conversazione.accesso_prodotti || ''
    };
  }
}