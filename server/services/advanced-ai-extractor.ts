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
    tipo_richiesta: string | null;
    ingredienti_preferiti: string | null;
  };
  analisi_conversazione: {
    fase_completata: string | null;
    accesso_prodotti: string | null;
    qualita_dati: string | null;
    note_aggiuntive: string | null;
  };
  ingredienti_consigliati: {
    ingredienti_principali: string[];
    spiegazione_ingredienti: string | null;
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
    "routine_attuale": "descrizione routine esistente (opzionale)",
    "tipo_richiesta": "Routine completa/Detergente-struccante/Esfoliante/Siero/Trattamento Specifico/Crema viso/Protezione solare/Contorno Occhi/Maschera viso/Prodotti Corpo",
    "ingredienti_preferiti": "lista ingredienti attivi preferiti (opzionale)"
  },
  "analisi_conversazione": {
    "fase_completata": "consultazione_completa/parziale/solo_analisi",
    "accesso_prodotti": "Sì/No",
    "qualita_dati": "Alta/Media/Bassa",
    "note_aggiuntive": "osservazioni rilevanti"
  },
  "ingredienti_consigliati": {
    "ingredienti_principali": ["lista ingredienti specifici consigliati dall'AI"],
    "spiegazione_ingredienti": "breve spiegazione del perché questi ingredienti sono stati consigliati"
  }
}

REGOLE DI ESTRAZIONE:
Priorità di estrazione:
1. Dati espliciti dichiarati dall'utente (priorità massima)
2. Informazioni dedotte dall'AI durante l'analisi
3. Inferenze logiche basate sul contesto

Gestione dati mancanti:
- Se un dato NON è presente o non può essere determinato, scrivi esattamente null
- Se è parzialmente presente, estrai quello disponibile
- Marca come "(dedotto)" SOLO le informazioni inferite dall'AI analysis
- NON usare "Non specificato" come valore - usa sempre null per dati mancanti

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
Età: "ho 25 anni", "25enne", "sono del '99", "16-25 anni", "fascia d'età 20-30"
Genere: "sono una ragazza", "uomo di", "donna"
Routine: "uso solo acqua", "crema la sera", "niente trucco"
Problemi: "ho sempre brufoli", "pelle che tira", "macchie rosse"

⚠️ REGOLA CRITICA PER DISTINGUERE ETÀ DA PROBLEMI:
- Numeri o range numerici che indicano anni (es: "25", "16-25", "20-30") vanno SEMPRE in "eta", MAI in "problemi_principali"
- Solo condizioni dermatologiche reali vanno in "problemi_principali" (acne, rossori, secchezza, rughe, macchie, oleosità, etc.)
- Se vedi pattern come "16-25" nel contesto di analisi pelle, è probabilmente l'età dedotta dall'AI, non un problema
- Range numerici senza contesto dermatologico specifico = età, non problema
Idratazione: "Meno di 1L", "1-1.5L", "1.5-2L", "Più di 2L" - cerca le scelte multiple per l'acqua
Sonno: "Meno di 6h", "6-7h", "7-8h", "Più di 8h" - cerca le scelte multiple per il sonno
Protezione solare: "Sempre", "Solo d'estate", "Solo quando esco", "Raramente", "Mai"
Fumo: "Sì regolarmente", "Occasionalmente", "No"
Stress: "Molto", "Abbastanza", "Poco", "Per niente"

ATTENZIONE SPECIALE per campi multiple choice:
- Cerca nelle conversazioni le risposte esatte alle scelte multiple offerte
- Per idratazione_quotidiana: estrai il valore esatto tra le opzioni fornite
- Per protezione_solare: estrai il valore esatto tra le opzioni fornite  
- Non approssimare - usa il valore letterale selezionato dall'utente

ESTRAZIONE INGREDIENTI CONSIGLIATI:
- Analizza i messaggi dell'AI per identificare ingredienti specifici menzionati come raccomandazioni
- Cerca nelle sezioni come "LE TUE PRINCIPALI NECESSITÀ", "ROUTINE PERSONALIZZATA", "INGREDIENTI IDEALI"
- Estrai solo ingredienti esplicitamente consigliati, non quelli menzionati come esempi
- Includi ingredienti botanici (Bardana, Mirto, Elicriso, Centella Asiatica, Liquirizia, Malva, etc.)
- Includi principi attivi dermatologici (Acido Ialuronico, Retinolo, Niacinamide, Acido Salicilico, etc.)
- Fornisci una spiegazione concisa del perché questi ingredienti sono stati scelti

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
      console.log('🔍 Raw AI response (first 300 chars):', JSON.stringify(text.substring(0, 300)));
      console.log('🔍 Raw AI response (last 50 chars):', JSON.stringify(text.substring(text.length - 50)));

      // Clean the response text by removing markdown backticks
      let cleanText = text.trim();
      // Remove starting backticks
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.substring(7); // Remove '```json'
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.substring(3); // Remove '```'
      }
      // Remove ending backticks
      if (cleanText.endsWith('```')) {
        cleanText = cleanText.substring(0, cleanText.length - 3);
      }
      cleanText = cleanText.trim();

      // Parse JSON response
      try {
        const extractedData = JSON.parse(cleanText) as ExtractedData;
        console.log('✅ Advanced AI extraction completed successfully');
        console.log('📊 Extracted data preview:', {
          eta: extractedData.informazioni_base?.eta,
          sesso: extractedData.informazioni_base?.sesso,
          tipoPelle: extractedData.analisi_pelle?.tipo_pelle,
          problemi: extractedData.analisi_pelle?.problemi_principali?.slice(0, 2)
        });
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

  // Helper function to detect age patterns
  private isAgePattern(text: string): boolean {
    if (!text) return false;
    
    const cleanText = text.trim();
    
    // Pattern migliorati per riconoscere età in varie forme
    const agePatterns = [
      /^\d{1,2}$/, // singolo numero 13-99
      /^\d{1,2}\s*[-–—]\s*\d{1,2}$/, // range con vari tipi di trattino e spazi opzionali
      /^\d{1,2}\s*anni?$/, // "25 anni" o "25 anno"
      /^età\s*\d{1,2}$/i, // "età 25"
      /^fascia\s*d[''']età\s*\d{1,2}\s*[-–—]\s*\d{1,2}$/i, // "fascia d'età 20-30"
      /^tra\s+i?\s*\d{1,2}\s*e\s*\d{1,2}(\s*anni)?$/i, // "tra i 16 e 25" o "tra 16 e 25 anni"
      /^fra\s+i?\s*\d{1,2}\s*e\s*\d{1,2}(\s*anni)?$/i, // "fra i 16 e 25"
      /^\d{1,2}\s*[-–—]\s*\d{1,2}\s*anni$/i, // "16-25 anni"
    ];
    
    return agePatterns.some(pattern => pattern.test(cleanText));
  }

  // Helper function to validate and fix extracted data
  private validateAndFixExtractedData(extractedData: ExtractedData): ExtractedData {
    if (!extractedData.analisi_pelle?.problemi_principali) {
      return extractedData;
    }

    const problemiPuliti: string[] = [];
    let etaTrovata: string | null = null;

    // Normalizza problemi_principali in array (come in ChatDataExtractor)
    const problemiArray = Array.isArray(extractedData.analisi_pelle.problemi_principali) 
      ? extractedData.analisi_pelle.problemi_principali 
      : [extractedData.analisi_pelle.problemi_principali];

    // Controlla ogni problema per vedere se è in realtà un'età
    for (const problema of problemiArray) {
      if (this.isAgePattern(problema)) {
        // È un pattern di età, non un problema
        etaTrovata = problema;
        console.log(`🔧 Correzione: "${problema}" spostato da problemi a età`);
      } else {
        problemiPuliti.push(problema);
      }
    }

    // Aggiorna i dati estratti
    extractedData.analisi_pelle.problemi_principali = problemiPuliti;
    
    // Se abbiamo trovato un'età nei problemi e non c'è già un'età specificata
    if (etaTrovata && (!extractedData.informazioni_base?.eta || extractedData.informazioni_base.eta === null)) {
      if (!extractedData.informazioni_base) {
        extractedData.informazioni_base = { eta: null, sesso: null, email: null };
      }
      extractedData.informazioni_base.eta = etaTrovata;
      console.log(`🔧 Correzione: Età "${etaTrovata}" aggiunta alle informazioni base`);
    }

    return extractedData;
  }

  // Convert extracted data to Google Sheets format
  convertToSheetsFormat(extractedData: ExtractedData): any {
    // Applica validazione e correzioni prima della conversione
    const cleanedData = this.validateAndFixExtractedData(extractedData);
    
    const result: any = {};
    
    // Informazioni base
    if (cleanedData.informazioni_base) {
      result.eta = cleanedData.informazioni_base.eta || 'Non specificato';
      result.sesso = cleanedData.informazioni_base.sesso || 'Non specificato';
      result.email = cleanedData.informazioni_base.email || 'Non specificato';
    } else {
      result.eta = 'Non specificato';
      result.sesso = 'Non specificato';
      result.email = 'Non specificato';
    }

    // Analisi pelle (usa dati puliti dalla validazione)
    if (cleanedData.analisi_pelle) {
      result.tipoPelle = cleanedData.analisi_pelle.tipo_pelle || 'Non specificato';
      result.problemiPelle = cleanedData.analisi_pelle.problemi_principali?.length ? 
        cleanedData.analisi_pelle.problemi_principali.join(', ') : 'Non specificato';
      result.punteggioPelle = cleanedData.analisi_pelle.punteggio_generale || 'Non specificato';
    } else {
      result.tipoPelle = 'Non specificato';
      result.problemiPelle = 'Non specificato';
      result.punteggioPelle = 'Non specificato';
    }

    // Preferenze prodotti
    if (extractedData.preferenze_prodotti) {
      result.routine = extractedData.preferenze_prodotti.routine_attuale || 'Non specificato';
      result.tipoRichiesta = extractedData.preferenze_prodotti.tipo_richiesta || 'Non specificato';
      result.ingredientiPreferiti = extractedData.preferenze_prodotti.ingredienti_preferiti || 'Non specificato';
      result.allergie = extractedData.preferenze_prodotti.allergie || 'Non specificato';
      result.profumo = extractedData.preferenze_prodotti.profumo_fiori || 'Non specificato';
    } else {
      result.routine = 'Non specificato';
      result.tipoRichiesta = 'Non specificato';
      result.ingredientiPreferiti = 'Non specificato';
      result.allergie = 'Non specificato';
      result.profumo = 'Non specificato';
    }

    // Abitudini lifestyle
    if (extractedData.abitudini_lifestyle) {
      result.sonno = extractedData.abitudini_lifestyle.ore_sonno || 'Non specificato';
      result.stress = extractedData.abitudini_lifestyle.stress_level || 'Non specificato';
      result.alimentazione = extractedData.abitudini_lifestyle.alimentazione || 'Non specificato';
      result.fumo = extractedData.abitudini_lifestyle.fumo || 'Non specificato';
      result.idratazione = extractedData.abitudini_lifestyle.idratazione_quotidiana || 'Non specificato';
      result.protezioneSolare = extractedData.abitudini_lifestyle.protezione_solare || 'Non specificato';
    } else {
      result.sonno = 'Non specificato';
      result.stress = 'Non specificato';
      result.alimentazione = 'Non specificato';
      result.fumo = 'Non specificato';
      result.idratazione = 'Non specificato';
      result.protezioneSolare = 'Non specificato';
    }

    // Analisi conversazione
    if (extractedData.analisi_conversazione) {
      result.qualitaDati = extractedData.analisi_conversazione.qualita_dati || 'Non specificato';
      result.faseCompletata = extractedData.analisi_conversazione.fase_completata || 'Non specificato';
      result.accessoProdotti = extractedData.analisi_conversazione.accesso_prodotti || 'Non specificato';
    } else {
      result.qualitaDati = 'Non specificato';
      result.faseCompletata = 'Non specificato';
      result.accessoProdotti = 'Non specificato';
    }

    return result;
  }
}