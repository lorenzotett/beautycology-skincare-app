
import { GoogleGenAI } from "@google/genai";
import type { ChatMessage } from '../../shared/schema';

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ""
});

const EXTRACTION_PROMPT = `
Sei un esperto analista di conversazioni skincare. Analizza questa conversazione e estrai SOLO i dati effettivamente presenti.

REGOLE IMPORTANTI:
- Restituisci SOLO dati che sono esplicitamente menzionati
- Non inventare o dedurre informazioni non presenti
- Usa "Non specificato" se l'informazione non è fornita
- Mantieni le risposte originali dell'utente quando possibile

FORMATO RICHIESTO (JSON):
{
  "eta": "età in anni o 'Non specificato'",
  "sesso": "Maschio/Femmina/Non specificato",
  "tipoPelle": "tipo di pelle menzionato o 'Non specificato'",
  "problemiPelle": "problemi specifici menzionati separati da virgola",
  "punteggioPelle": "punteggio numerico se presente o 'Non specificato'",
  "allergie": "allergie menzionate o 'Nessuna' o 'Non specificato'",
  "profumo": "preferenza fragranza (Sì/No/Non specificato)",
  "protezioneSolare": "frequenza uso solare o 'Non specificato'",
  "sonno": "ore di sonno o 'Non specificato'",
  "stress": "livello stress (1-10) o 'Non specificato'",
  "alimentazione": "qualità alimentazione o 'Non specificato'",
  "fumo": "abitudine fumo o 'Non specificato'",
  "idratazione": "litri acqua al giorno o 'Non specificato'",
  "utilizzaScrub": "uso scrub/peeling o 'Non specificato'",
  "pelleTira": "pelle che tira dopo detersione o 'Non specificato'",
  "email": "indirizzo email o 'Non specificato'"
}

ESEMPI DI ESTRAZIONE:
- Se utente dice "25 anni" → eta: "25"
- Se utente dice "pelle grassa" → tipoPelle: "Grassa"
- Se utente dice "A) Sempre" per solare → protezioneSolare: "Sempre"
- Se utente dice "8" per stress → stress: "8"
- Se non menzionato → "Non specificato"

Analizza la conversazione e restituisci SOLO il JSON richiesto:
`;

export class ChatDataExtractor {
  async extractStructuredData(messages: ChatMessage[], skinAnalysis?: any): Promise<any> {
    try {
      // Prepara il testo della conversazione
      const conversationText = this.formatConversationForAI(messages);
      
      // Aggiungi dati skin analysis se disponibili
      let contextText = conversationText;
      if (skinAnalysis) {
        contextText = `ANALISI PELLE AI: ${JSON.stringify(skinAnalysis)}\n\n${conversationText}`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          role: "user",
          parts: [{ text: `${EXTRACTION_PROMPT}\n\nCONVERSAZIONE:\n${contextText}` }]
        }],
        generationConfig: {
          temperature: 0.1, // Bassa temperatura per consistenza
          maxOutputTokens: 1000
        }
      });

      const result = response.text;
      
      // Estrai JSON dalla risposta
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extractedData = JSON.parse(jsonMatch[0]);
        
        // Valida e pulisci i dati
        const cleanedData = this.validateAndCleanData(extractedData);
        
        console.log('✅ Dati estratti con AI:', cleanedData);
        return cleanedData;
      } else {
        console.error('❌ Nessun JSON valido nella risposta AI');
        return this.getFallbackData(messages);
      }
    } catch (error) {
      console.error('❌ Errore nell\'estrazione AI:', error);
      return this.getFallbackData(messages);
    }
  }

  private formatConversationForAI(messages: ChatMessage[]): string {
    return messages.map(msg => {
      const role = msg.role === 'user' ? 'UTENTE' : 'AI';
      const time = new Date(msg.createdAt).toLocaleTimeString('it-IT', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      return `[${time}] ${role}: ${msg.content}`;
    }).join('\n');
  }

  private validateAndCleanData(data: any): any {
    const cleaned: any = {};
    
    // Lista campi previsti
    const expectedFields = [
      'eta', 'sesso', 'tipoPelle', 'problemiPelle', 'punteggioPelle',
      'allergie', 'profumo', 'protezioneSolare', 'sonno', 'stress',
      'alimentazione', 'fumo', 'idratazione', 'utilizzaScrub', 'pelleTira', 'email'
    ];

    for (const field of expectedFields) {
      cleaned[field] = data[field] || 'Non specificato';
      
      // Pulizia specifica per campo
      if (field === 'eta' && cleaned[field] !== 'Non specificato') {
        // Estrai solo il numero
        const ageMatch = cleaned[field].toString().match(/\d+/);
        cleaned[field] = ageMatch ? ageMatch[0] : 'Non specificato';
      }
      
      if (field === 'sesso' && cleaned[field] !== 'Non specificato') {
        // Normalizza genere
        const gender = cleaned[field].toLowerCase();
        if (gender.includes('maschio') || gender.includes('uomo')) {
          cleaned[field] = 'Maschio';
        } else if (gender.includes('femmina') || gender.includes('donna')) {
          cleaned[field] = 'Femmina';
        }
      }
      
      if (field === 'email' && cleaned[field] !== 'Non specificato') {
        // Valida email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleaned[field])) {
          cleaned[field] = 'Non specificato';
        }
      }
    }

    return cleaned;
  }

  private getFallbackData(messages: ChatMessage[]): any {
    // Fallback: estrazione base se AI fallisce
    const fallbackData: any = {};
    const expectedFields = [
      'eta', 'sesso', 'tipoPelle', 'problemiPelle', 'punteggioPelle',
      'allergie', 'profumo', 'protezioneSolare', 'sonno', 'stress',
      'alimentazione', 'fumo', 'idratazione', 'utilizzaScrub', 'pelleTira', 'email'
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
    console.log('🧪 Test estrazione dati AI...');
    const result = await this.extractStructuredData(messages, skinAnalysis);
    console.log('📊 Risultato test:', JSON.stringify(result, null, 2));
  }
}
