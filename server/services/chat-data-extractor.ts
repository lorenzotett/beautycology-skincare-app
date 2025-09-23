
import { GoogleGenAI } from "@google/genai";
import type { ChatMessage } from '../../shared/schema';

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ""
});

export class ChatDataExtractor {
  async extractStructuredData(messages: ChatMessage[], skinAnalysis?: any): Promise<any> {
    try {
      // Prepara il testo della conversazione per il modello personalizzato
      const conversationData = this.formatConversationForCustomModel(messages, skinAnalysis);
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          role: "user", 
          parts: [{ text: `${this.getSystemInstruction()}\n\n${conversationData}` }]
        }],
        generationConfig: {
          temperature: 0.1, // Bassa temperatura per consistenza
          maxOutputTokens: 2000
        }
      });

      const result = response.response.text();
      
      // Estrai JSON dalla risposta
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extractedData = JSON.parse(jsonMatch[0]);
        
        // Trasforma i dati nel formato compatibile con Google Sheets
        const sheetsData = this.transformToSheetsFormat(extractedData);
        
        console.log('✅ Dati estratti con modello personalizzato:', sheetsData);
        return sheetsData;
      } else {
        console.error('❌ Nessun JSON valido nella risposta del modello personalizzato');
        return this.getFallbackData(messages);
      }
    } catch (error) {
      console.error('❌ Errore nell\'estrazione con modello personalizzato:', error);
      return this.getFallbackData(messages);
    }
  }

  private getSystemInstruction(): string {
    return `Sei un assistente AI specializzato nell'analisi e categorizzazione di conversazioni di consulenza dermatologica per l'estrazione di dati strutturati.
Il tuo compito è analizzare le conversazioni tra utenti e un AI skin expert, estraendo e organizzando le informazioni in modo intelligente per l'inserimento in Google Sheets.

### INPUT:
Riceverai un array di messaggi di conversazione nel formato:
[
{"role": "user/assistant", "content": "testo del messaggio"},
...
]

### OUTPUT RICHIESTO:
Restituisci un JSON con i seguenti campi:
\`\`\`json
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
    "tipo_richiesta": "Routine completa/Detergente-struccante/Esfoliante/Siero/Trattamento Specifico/Creme viso/Protezioni Solari/Contorno Occhi/Maschere Viso/Prodotti Corpo",
    "ingredienti_preferiti": "lista ingredienti attivi preferiti (opzionale)"
  },
  "analisi_conversazione": {
    "fase_completata": "consultazione_completa/parziale/solo_analisi",
    "accesso_prodotti": "Sì/No",
    "qualita_dati": "Alta/Media/Bassa",
    "note_aggiuntive": "osservazioni rilevanti"
  }
}
\`\`\`

### REGOLE DI ESTRAZIONE:

1. **Priorità di estrazione:**
   - Dati espliciti dichiarati dall'utente (priorità massima)
   - Informazioni dedotte dall'AI durante l'analisi
   - Inferenze logiche basate sul contesto

2. **Gestione dati mancanti:**
   - Se un dato non è presente, usa null
   - Se è parzialmente presente, estrai quello disponibile
   - Marca come "(dedotto)" le informazioni inferite

3. **Analisi intelligente:**
   - Riconosci pattern nelle risposte anche se non seguono l'ordine standard
   - Estrai informazioni anche da descrizioni libere
   - Identifica contraddizioni e privilegi l'informazione più recente

4. **Categorizzazione skin type:**
   - Se oleosità > 70 O acne > 60: "Grassa"
   - Se rossori > 50: "Sensibile"
   - Se oleosità < 30: "Secca"
   - Altrimenti: "Mista"

### ESEMPI DI PATTERN DA RICONOSCERE:

- Età: "ho 25 anni", "25enne", "sono del '99", "16-25 anni", "fascia d'età 20-30"
- Genere: "sono una ragazza", "uomo di", "donna"
- Routine: "uso solo acqua", "crema la sera", "niente trucco"
- Problemi: "ho sempre brufoli", "pelle che tira", "macchie rosse"

⚠️ REGOLA CRITICA PER DISTINGUERE ETÀ DA PROBLEMI:
- Numeri o range numerici che indicano anni (es: "25", "16-25", "20-30") vanno SEMPRE in "eta", MAI in "problemi_principali"
- Solo condizioni dermatologiche reali vanno in "problemi_principali" (acne, rossori, secchezza, rughe, macchie, oleosità, etc.)
- Se vedi pattern come "16-25" nel contesto di analisi pelle, è probabilmente l'età dedotta dall'AI, non un problema
- Range numerici senza contesto dermatologico specifico = età, non problema

Analizza attentamente ogni conversazione e estrai tutti i dati possibili mantenendo alta precisione e completezza.`;
  }

  private formatConversationForCustomModel(messages: ChatMessage[], skinAnalysis?: any): string {
    // Prepara la conversazione in formato array JSON
    const conversationArray = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.createdAt).toISOString()
    }));

    let input = JSON.stringify(conversationArray, null, 2);

    // Aggiungi dati skin analysis se disponibili
    if (skinAnalysis) {
      input = `ANALISI PELLE AI:\n${JSON.stringify(skinAnalysis, null, 2)}\n\nCONVERSAZIONE:\n${input}`;
    }

    return input;
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
      /^fascia\s*d['']età\s*\d{1,2}\s*[-–—]\s*\d{1,2}$/i, // "fascia d'età 20-30"
      /^tra\s+i?\s*\d{1,2}\s*e\s*\d{1,2}(\s*anni)?$/i, // "tra i 16 e 25" o "tra 16 e 25 anni"
      /^fra\s+i?\s*\d{1,2}\s*e\s*\d{1,2}(\s*anni)?$/i, // "fra i 16 e 25"
      /^\d{1,2}\s*[-–—]\s*\d{1,2}\s*anni$/i, // "16-25 anni"
    ];
    
    return agePatterns.some(pattern => pattern.test(cleanText));
  }

  // Helper function to validate and fix extracted data
  private validateAndFixExtractedData(extractedData: any): any {
    if (!extractedData.analisi_pelle?.problemi_principali) {
      return extractedData;
    }

    const problemiPuliti: string[] = [];
    let etaTrovata: string | null = null;

    // Controlla ogni problema per vedere se è in realtà un'età
    const problemiArray = Array.isArray(extractedData.analisi_pelle.problemi_principali) 
      ? extractedData.analisi_pelle.problemi_principali 
      : [extractedData.analisi_pelle.problemi_principali];

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

  private transformToSheetsFormat(extractedData: any): any {
    // Applica validazione e correzioni prima della conversione
    const cleanedData = this.validateAndFixExtractedData(extractedData);
    
    // Trasforma il formato del modello personalizzato nel formato compatibile con Google Sheets
    const sheetsFormat: any = {};

    // Informazioni base
    if (cleanedData.informazioni_base) {
      sheetsFormat.eta = cleanedData.informazioni_base.eta || 'Non specificato';
      sheetsFormat.sesso = cleanedData.informazioni_base.sesso || 'Non specificato';
      sheetsFormat.email = cleanedData.informazioni_base.email || 'Non specificato';
    }

    // Analisi pelle
    if (cleanedData.analisi_pelle) {
      sheetsFormat.tipoPelle = cleanedData.analisi_pelle.tipo_pelle || 'Non specificato';
      sheetsFormat.punteggioPelle = cleanedData.analisi_pelle.punteggio_generale || 'Non specificato';
      
      // Problemi principali come stringa (ora puliti dalla validazione)
      if (Array.isArray(cleanedData.analisi_pelle.problemi_principali)) {
        sheetsFormat.problemiPelle = cleanedData.analisi_pelle.problemi_principali.join(', ');
      } else {
        sheetsFormat.problemiPelle = cleanedData.analisi_pelle.problemi_principali || 'Non specificato';
      }
    }

    // Abitudini lifestyle
    if (cleanedData.abitudini_lifestyle) {
      sheetsFormat.protezioneSolare = cleanedData.abitudini_lifestyle.protezione_solare || 'Non specificato';
      sheetsFormat.idratazione = cleanedData.abitudini_lifestyle.idratazione_quotidiana || 'Non specificato';
      sheetsFormat.sonno = cleanedData.abitudini_lifestyle.ore_sonno || 'Non specificato';
      sheetsFormat.alimentazione = cleanedData.abitudini_lifestyle.alimentazione || 'Non specificato';
      sheetsFormat.fumo = cleanedData.abitudini_lifestyle.fumo || 'Non specificato';
      sheetsFormat.stress = cleanedData.abitudini_lifestyle.stress_level || 'Non specificato';
      sheetsFormat.utilizzaScrub = cleanedData.abitudini_lifestyle.utilizzo_scrub || 'Non specificato';
    }

    // Preferenze prodotti
    if (cleanedData.preferenze_prodotti) {
      sheetsFormat.allergie = cleanedData.preferenze_prodotti.allergie || 'Non specificato';
      sheetsFormat.profumo = cleanedData.preferenze_prodotti.profumo_fiori || 'Non specificato';
      sheetsFormat.routine = cleanedData.preferenze_prodotti.routine_attuale || 'Non specificato';
      sheetsFormat.tipoRichiesta = cleanedData.preferenze_prodotti.tipo_richiesta || 'Non specificato';
      sheetsFormat.ingredientiPreferiti = cleanedData.preferenze_prodotti.ingredienti_preferiti || 'Non specificato';
    }

    // Aggiungi campi aggiuntivi dal modello personalizzato
    if (cleanedData.analisi_conversazione) {
      sheetsFormat.faseCompletata = cleanedData.analisi_conversazione.fase_completata || 'Non specificato';
      sheetsFormat.accessoProdotti = cleanedData.analisi_conversazione.accesso_prodotti || 'Non specificato';
      sheetsFormat.qualitaDati = cleanedData.analisi_conversazione.qualita_dati || 'Non specificato';
      sheetsFormat.noteAggiuntive = cleanedData.analisi_conversazione.note_aggiuntive || 'Non specificato';
    }

    // Aggiungi ingredienti consigliati
    if (cleanedData.ingredienti_consigliati) {
      if (Array.isArray(cleanedData.ingredienti_consigliati.ingredienti_principali)) {
        sheetsFormat.ingredientiConsigliati = cleanedData.ingredienti_consigliati.ingredienti_principali.join(', ');
      } else {
        sheetsFormat.ingredientiConsigliati = 'Non specificato';
      }
    } else {
      sheetsFormat.ingredientiConsigliati = 'Non specificato';
    }

    return sheetsFormat;
  }

  private getFallbackData(messages: ChatMessage[]): any {
    // Fallback: estrazione base se AI fallisce
    const fallbackData: any = {};
    const expectedFields = [
      'eta', 'sesso', 'tipoPelle', 'problemiPelle', 'punteggioPelle',
      'allergie', 'profumo', 'protezioneSolare', 'sonno', 'stress',
      'routine', 'tipoRichiesta', 'ingredientiPreferiti',
      'alimentazione', 'fumo', 'idratazione', 'utilizzaScrub', 'email'
    ];

    // Inizializza tutti i campi
    expectedFields.forEach(field => {
      fallbackData[field] = 'Non specificato';
    });

    // Estrazione base email e età
    const allUserContent = messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join(' ');

    // Cerca email
    const emailMatch = allUserContent.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      fallbackData.email = emailMatch[1];
    }

    // Cerca età
    const ageMatch = allUserContent.match(/(\d{1,2})\s*anni?/);
    if (ageMatch) {
      fallbackData.eta = ageMatch[1];
    }

    console.log('⚠️ Usato fallback per estrazione dati');
    return fallbackData;
  }

  // Metodo per testare l'estrazione su una conversazione specifica
  async testExtraction(messages: ChatMessage[], skinAnalysis?: any): Promise<void> {
    console.log('🧪 Test estrazione dati con modello personalizzato...');
    const result = await this.extractStructuredData(messages, skinAnalysis);
    console.log('📊 Risultato test:', JSON.stringify(result, null, 2));
  }
}
