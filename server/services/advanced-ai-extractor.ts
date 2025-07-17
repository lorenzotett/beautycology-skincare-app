import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChatMessage } from '@shared/schema';

interface ExtractedData {
  informazioni_base: {
    eta: string | null;
    sesso: string | null;
    email: string | null;
    nome: string | null;
    citta_residenza: string | null;
    professione: string | null;
  };
  analisi_pelle: {
    tipo_pelle: string | null;
    punteggio_generale: string | null;
    problemi_principali: string[];
    oleosita_score: string | null;
    acne_score: string | null;
    rossori_score: string | null;
    texture_score: string | null;
    pori_score: string | null;
    pigmentazione_score: string | null;
    sensibilita_pelle: string | null;
    zone_problematiche: string | null;
    condizioni_attuali: string | null;
  };
  abitudini_lifestyle: {
    protezione_solare: string | null;
    idratazione_quotidiana: string | null;
    ore_sonno: string | null;
    alimentazione: string | null;
    fumo: string | null;
    stress_level: string | null;
    utilizzo_scrub: string | null;
    attivita_fisica: string | null;
    esposizione_sole: string | null;
    ambiente_lavoro: string | null;
    qualita_aria: string | null;
    clima_citta: string | null;
  };
  preferenze_prodotti: {
    allergie: string | null;
    profumo_fiori: string | null;
    routine_attuale: string | null;
    prodotti_preferiti: string | null;
    marchi_usati: string | null;
    budget_spesa: string | null;
    frequenza_acquisto: string | null;
    ingredienti_evitare: string | null;
    texture_preferite: string | null;
  };
  problemi_specifici: {
    acne_tipo: string | null;
    acne_frequenza: string | null;
    rossori_causa: string | null;
    secchezza_zone: string | null;
    macchie_tipo: string | null;
    rughe_zone: string | null;
    cicatrici_presenti: string | null;
    problemi_stagionali: string | null;
  };
  routine_dettagliata: {
    routine_mattina: string | null;
    routine_sera: string | null;
    prodotti_detergenti: string | null;
    prodotti_idratanti: string | null;
    prodotti_trattamento: string | null;
    frequenza_maschere: string | null;
    uso_sieri: string | null;
    strumenti_bellezza: string | null;
  };
  storia_medica: {
    farmaci_assunti: string | null;
    trattamenti_dermatologici: string | null;
    allergie_note: string | null;
    problemi_ormonali: string | null;
    gravidanza_allattamento: string | null;
    storia_familiare: string | null;
  };
  obiettivi_aspettative: {
    risultati_desiderati: string | null;
    priorita_trattamento: string | null;
    tempo_disponibile: string | null;
    aspettative_realistiche: string | null;
    motivazioni_principali: string | null;
  };
  analisi_conversazione: {
    fase_completata: string | null;
    accesso_prodotti: string | null;
    qualita_dati: string | null;
    note_aggiuntive: string | null;
    livello_dettaglio: string | null;
    soddisfazione_consulenza: string | null;
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
        systemInstruction: `Sei un assistente AI specializzato nell'analisi ultra-dettagliata di conversazioni di consulenza dermatologica per l'estrazione completa di dati strutturati.

Il tuo compito è analizzare ogni singolo dettaglio delle conversazioni tra utenti e un AI skin expert, estraendo TUTTE le informazioni disponibili, anche quelle sottintese o deducibili dal contesto.

### IMPORTANTE: COMPLETEZZA MASSIMA
- Estrai OGNI informazione presente nella conversazione
- Deduci informazioni dal contesto quando possibile
- Se un'informazione non è presente, utilizza "Non specificato"
- Analizza anche le foto caricate e i risultati dell'analisi AI
- Cattura dettagli su prodotti, routine, problemi, obiettivi

### OUTPUT RICHIESTO - JSON COMPLETO:
{
  "informazioni_base": {
    "eta": "età estratta o dedotta",
    "sesso": "Uomo/Donna/Non specificato", 
    "email": "email se fornita",
    "nome": "nome estratto",
    "citta_residenza": "città se menzionata", 
    "professione": "lavoro se menzionato"
  },
  "analisi_pelle": {
    "tipo_pelle": "Grassa/Secca/Mista/Normale/Sensibile",
    "punteggio_generale": "0-100",
    "problemi_principali": ["acne", "rossori", "texture", "etc"],
    "oleosita_score": "0-100 o Non rilevato",
    "acne_score": "0-100 o Non rilevato", 
    "rossori_score": "0-100 o Non rilevato",
    "texture_score": "0-100 o Non rilevato",
    "pori_score": "0-100 o Non rilevato", 
    "pigmentazione_score": "0-100 o Non rilevato",
    "sensibilita_pelle": "Alta/Media/Bassa",
    "zone_problematiche": "T-zone, guance, mento, etc",
    "condizioni_attuali": "descrizione stato pelle"
  },
  "abitudini_lifestyle": {
    "protezione_solare": "Sì/No/Occasionalmente/Non specificato",
    "idratazione_quotidiana": "litri acqua al giorno",
    "ore_sonno": "ore medie",
    "alimentazione": "Bilanciata/Non bilanciata",
    "fumo": "Sì/No",
    "stress_level": "1-10 o Basso/Medio/Alto",
    "utilizzo_scrub": "Sì/No/Occasionalmente",
    "attivita_fisica": "tipo e frequenza sport",
    "esposizione_sole": "frequenza e protezione",
    "ambiente_lavoro": "ufficio/esterno/casa",
    "qualita_aria": "città inquinata/pulita",
    "clima_citta": "umido/secco/variabile"
  },
  "preferenze_prodotti": {
    "allergie": "lista ingredienti o 'Nessuna'",
    "profumo_fiori": "Sì/No",
    "routine_attuale": "descrizione routine esistente",
    "prodotti_preferiti": "marchi e prodotti menzionati",
    "marchi_usati": "brand utilizzati attualmente",
    "budget_spesa": "fascia di prezzo preferita",
    "frequenza_acquisto": "ogni quanto compra prodotti",
    "ingredienti_evitare": "componenti da evitare",
    "texture_preferite": "cremose/gel/oli/etc"
  },
  "problemi_specifici": {
    "acne_tipo": "comedonica/infiammatoria/cistica",
    "acne_frequenza": "occasionale/frequente/costante",
    "rossori_causa": "sensibilità/rosacea/irritazione",
    "secchezza_zone": "T-zone/guance/intero viso",
    "macchie_tipo": "età/sole/post-acne",
    "rughe_zone": "occhi/bocca/fronte",
    "cicatrici_presenti": "tipo e localizzazione",
    "problemi_stagionali": "inverno/estate/variazioni"
  },
  "routine_dettagliata": {
    "routine_mattina": "step per step mattutina",
    "routine_sera": "step per step serale",
    "prodotti_detergenti": "tipo detergente usato",
    "prodotti_idratanti": "creme e sieri idratanti",
    "prodotti_trattamento": "anti-age/acne/specifici",
    "frequenza_maschere": "quanto spesso fa maschere",
    "uso_sieri": "tipi di sieri utilizzati",
    "strumenti_bellezza": "spazzole/device/tool"
  },
  "storia_medica": {
    "farmaci_assunti": "medicinali che influenzano pelle",
    "trattamenti_dermatologici": "visite/cure precedenti",
    "allergie_note": "allergie medicali/cosmetiche",
    "problemi_ormonali": "ciclo/tiroide/ormoni",
    "gravidanza_allattamento": "stato attuale",
    "storia_familiare": "genetica problemi pelle"
  },
  "obiettivi_aspettative": {
    "risultati_desiderati": "cosa vuole ottenere",
    "priorita_trattamento": "problema principale da risolvere",
    "tempo_disponibile": "routine veloce/elaborata",
    "aspettative_realistiche": "tempi di miglioramento",
    "motivazioni_principali": "perché cerca consulenza"
  },
  "analisi_conversazione": {
    "fase_completata": "consultazione_completa/parziale/solo_analisi",
    "accesso_prodotti": "Sì/No",
    "qualita_dati": "Alta/Media/Bassa",
    "note_aggiuntive": "osservazioni rilevanti",
    "livello_dettaglio": "superficiale/medio/approfondito",
    "soddisfazione_consulenza": "soddisfatto/insoddisfatto/neutro"
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

  // Convert extracted data to Google Sheets format - ULTRA COMPLETE
  convertToSheetsFormat(extractedData: ExtractedData): any {
    return {
      // Informazioni Base
      eta: extractedData.informazioni_base?.eta || '',
      sesso: extractedData.informazioni_base?.sesso || '',
      nome: extractedData.informazioni_base?.nome || '',
      cittaResidenza: extractedData.informazioni_base?.citta_residenza || '',
      professione: extractedData.informazioni_base?.professione || '',
      
      // Analisi Pelle Completa
      tipoPelle: extractedData.analisi_pelle?.tipo_pelle || '',
      punteggioPelle: extractedData.analisi_pelle?.punteggio_generale || '',
      problemiPelle: extractedData.analisi_pelle?.problemi_principali?.length ? 
        extractedData.analisi_pelle.problemi_principali.join(', ') : '',
      oleositaScore: extractedData.analisi_pelle?.oleosita_score || '',
      acneScore: extractedData.analisi_pelle?.acne_score || '',
      rossoriScore: extractedData.analisi_pelle?.rossori_score || '',
      textureScore: extractedData.analisi_pelle?.texture_score || '',
      poriScore: extractedData.analisi_pelle?.pori_score || '',
      pigmentazioneScore: extractedData.analisi_pelle?.pigmentazione_score || '',
      sensibilitaPelle: extractedData.analisi_pelle?.sensibilita_pelle || '',
      zoneProblematiche: extractedData.analisi_pelle?.zone_problematiche || '',
      condizioniAttuali: extractedData.analisi_pelle?.condizioni_attuali || '',
      
      // Lifestyle Esteso
      protezioneSolare: extractedData.abitudini_lifestyle?.protezione_solare || '',
      idratazione: extractedData.abitudini_lifestyle?.idratazione_quotidiana || '',
      sonno: extractedData.abitudini_lifestyle?.ore_sonno || '',
      alimentazione: extractedData.abitudini_lifestyle?.alimentazione || '',
      fumo: extractedData.abitudini_lifestyle?.fumo || '',
      stress: extractedData.abitudini_lifestyle?.stress_level || '',
      scrub: extractedData.abitudini_lifestyle?.utilizzo_scrub || '',
      attivitaFisica: extractedData.abitudini_lifestyle?.attivita_fisica || '',
      esposizioneSole: extractedData.abitudini_lifestyle?.esposizione_sole || '',
      ambienteLavoro: extractedData.abitudini_lifestyle?.ambiente_lavoro || '',
      qualitaAria: extractedData.abitudini_lifestyle?.qualita_aria || '',
      climaCitta: extractedData.abitudini_lifestyle?.clima_citta || '',
      
      // Preferenze Prodotti Complete
      allergie: extractedData.preferenze_prodotti?.allergie || '',
      profumo: extractedData.preferenze_prodotti?.profumo_fiori || '',
      routine: extractedData.preferenze_prodotti?.routine_attuale || '',
      prodottiPreferiti: extractedData.preferenze_prodotti?.prodotti_preferiti || '',
      marchiUsati: extractedData.preferenze_prodotti?.marchi_usati || '',
      budgetSpesa: extractedData.preferenze_prodotti?.budget_spesa || '',
      frequenzaAcquisto: extractedData.preferenze_prodotti?.frequenza_acquisto || '',
      ingredientiEvitare: extractedData.preferenze_prodotti?.ingredienti_evitare || '',
      texturePreferite: extractedData.preferenze_prodotti?.texture_preferite || '',
      
      // Problemi Specifici
      acneTipo: extractedData.problemi_specifici?.acne_tipo || '',
      acneFrequenza: extractedData.problemi_specifici?.acne_frequenza || '',
      rossoriCausa: extractedData.problemi_specifici?.rossori_causa || '',
      secchezzaZone: extractedData.problemi_specifici?.secchezza_zone || '',
      macchieTipo: extractedData.problemi_specifici?.macchie_tipo || '',
      rugheZone: extractedData.problemi_specifici?.rughe_zone || '',
      cicatrici: extractedData.problemi_specifici?.cicatrici_presenti || '',
      problemiStagionali: extractedData.problemi_specifici?.problemi_stagionali || '',
      
      // Routine Dettagliata
      routineMattina: extractedData.routine_dettagliata?.routine_mattina || '',
      routineSera: extractedData.routine_dettagliata?.routine_sera || '',
      prodottiDetergenti: extractedData.routine_dettagliata?.prodotti_detergenti || '',
      prodottiIdratanti: extractedData.routine_dettagliata?.prodotti_idratanti || '',
      prodottiTrattamento: extractedData.routine_dettagliata?.prodotti_trattamento || '',
      frequenzaMaschere: extractedData.routine_dettagliata?.frequenza_maschere || '',
      usoSieri: extractedData.routine_dettagliata?.uso_sieri || '',
      strumentiBellezza: extractedData.routine_dettagliata?.strumenti_bellezza || '',
      
      // Storia Medica
      farmaciAssunti: extractedData.storia_medica?.farmaci_assunti || '',
      trattamentiDermatologici: extractedData.storia_medica?.trattamenti_dermatologici || '',
      allergieNote: extractedData.storia_medica?.allergie_note || '',
      problemiOrmonali: extractedData.storia_medica?.problemi_ormonali || '',
      gravidanzaAllattamento: extractedData.storia_medica?.gravidanza_allattamento || '',
      storiaFamiliare: extractedData.storia_medica?.storia_familiare || '',
      
      // Obiettivi e Aspettative
      risultatiDesiderati: extractedData.obiettivi_aspettative?.risultati_desiderati || '',
      prioritaTrattamento: extractedData.obiettivi_aspettative?.priorita_trattamento || '',
      tempoDisponibile: extractedData.obiettivi_aspettative?.tempo_disponibile || '',
      aspettativeRealistiche: extractedData.obiettivi_aspettative?.aspettative_realistiche || '',
      motivazioniPrincipali: extractedData.obiettivi_aspettative?.motivazioni_principali || '',
      
      // Analisi Conversazione Estesa
      faseCompletata: extractedData.analisi_conversazione?.fase_completata || '',
      accessoProdotti: extractedData.analisi_conversazione?.accesso_prodotti || '',
      qualitaDati: extractedData.analisi_conversazione?.qualita_dati || '',
      noteAggiuntive: extractedData.analisi_conversazione?.note_aggiuntive || '',
      livelloDettaglio: extractedData.analisi_conversazione?.livello_dettaglio || '',
      soddisfazioneConsulenza: extractedData.analisi_conversazione?.soddisfazione_consulenza || ''
    };
  }
}