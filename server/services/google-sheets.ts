import { google } from 'googleapis';
import type { ChatMessage } from '../../shared/schema';

export class GoogleSheetsService {
  private sheets: any;
  private spreadsheetId: string;
  private auth: any;

  constructor(credentials: any, spreadsheetId: string) {
    this.spreadsheetId = spreadsheetId;
    
    // Initialize Google Auth
    this.auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  async appendConversation(
    sessionId: string,
    userName: string,
    userEmail: string | null,
    messages: ChatMessage[],
    skinAnalysis?: any
  ): Promise<boolean> {
    try {
      // Format conversation data
      const timestamp = new Date().toLocaleString('it-IT', {
        timeZone: 'Europe/Rome',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Extract structured data from conversation
      const extractedData = this.extractConversationData(messages, skinAnalysis);
      
      // Build full conversation text
      let conversationText = `=== CONVERSAZIONE ${sessionId} ===\n`;
      conversationText += `Data: ${timestamp}\nNome: ${userName}\nEmail: ${userEmail || 'Non fornita'}\n\n`;
      
      messages.forEach(message => {
        const role = message.role === 'user' ? userName : 'AI-DermaSense';
        const time = new Date(message.createdAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        conversationText += `[${time}] ${role}: ${message.content}\n`;
      });

      // Prepare structured data for Google Sheets with extracted values
      const values = [[
        timestamp, // A
        sessionId, // B
        userName, // C
        userEmail || '', // D
        extractedData.eta || '', // E
        extractedData.sesso || '', // F
        extractedData.tipoPelle || '', // G
        extractedData.problemiPelle || '', // H
        extractedData.punteggioPelle || '', // I
        extractedData.routine || '', // J
        extractedData.prodotti || '', // K
        extractedData.allergie || '', // L
        extractedData.profumo || '', // M
        extractedData.sonno || '', // N
        extractedData.stress || '', // O
        extractedData.alimentazione || '', // P
        extractedData.fumo || '', // Q
        extractedData.protezioneSolare || '', // R
        extractedData.problemiSpecifici || '', // S
        extractedData.ingredientiDesiderati || '', // T
        extractedData.budgetMensile || '', // U
        extractedData.frequenzaAcquisto || '', // V
        extractedData.motivazione || '', // W
        messages.length, // X
        conversationText // Y
      ]];

      // Append to Google Sheets
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Foglio1!A:Y', // Extended range for all columns
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: values
        }
      });

      console.log(`Successfully appended conversation ${sessionId} to Google Sheets`);
      return true;
    } catch (error) {
      console.error('Google Sheets integration error:', error);
      console.error('Spreadsheet ID:', this.spreadsheetId);
      console.error('Error details:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      return false;
    }
  }

  private extractConversationData(messages: ChatMessage[], skinAnalysis?: any): any {
    const data: any = {};
    
    // Extract from skin analysis
    if (skinAnalysis) {
      data.punteggioPelle = skinAnalysis.generalScore || '';
      if (skinAnalysis.scores) {
        data.problemiPelle = Object.entries(skinAnalysis.scores)
          .filter(([key, value]) => value && value !== 'N/A')
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
      }
    }

    // Extract from user messages
    const userMessages = messages.filter(m => m.role === 'user').map(m => m.content.toLowerCase());
    const allContent = userMessages.join(' ');

    // Age extraction
    const ageMatch = allContent.match(/(?:ho|età|anni?)\s*(\d{2})\s*(?:anni?)?/);
    if (ageMatch) data.eta = ageMatch[1];

    // Gender extraction
    if (allContent.includes('donna') || allContent.includes('femmina')) data.sesso = 'Donna';
    if (allContent.includes('uomo') || allContent.includes('maschio')) data.sesso = 'Uomo';

    // Skin type patterns
    const skinTypes = {
      'grassa': 'Grassa',
      'secca': 'Secca', 
      'mista': 'Mista',
      'normale': 'Normale',
      'sensibile': 'Sensibile'
    };
    
    for (const [key, value] of Object.entries(skinTypes)) {
      if (allContent.includes(key)) {
        data.tipoPelle = value;
        break;
      }
    }

    // Extract answers for specific questions
    this.extractAnswersFromMessages(messages, data);
    
    return data;
  }

  private extractAnswersFromMessages(messages: ChatMessage[], data: any): void {
    const patterns = [
      { key: 'routine', questions: ['routine', 'prodotti usi', 'cosa usi'] },
      { key: 'allergie', questions: ['allergi', 'intolleranz'] },
      { key: 'profumo', questions: ['profumo', 'fragranza'] },
      { key: 'sonno', questions: ['ore dormi', 'sonno'] },
      { key: 'stress', questions: ['stress', 'stressata'] },
      { key: 'alimentazione', questions: ['alimentazione', 'mangi', 'dieta'] },
      { key: 'fumo', questions: ['fumi', 'fumo', 'sigarett'] },
      { key: 'protezioneSolare', questions: ['protezione solare', 'crema solare', 'spf'] }
    ];

    for (let i = 0; i < messages.length - 1; i++) {
      const currentMsg = messages[i];
      const nextMsg = messages[i + 1];
      
      if (currentMsg.role === 'assistant' && nextMsg.role === 'user') {
        const question = currentMsg.content.toLowerCase();
        const answer = nextMsg.content;
        
        for (const pattern of patterns) {
          if (pattern.questions.some(q => question.includes(q))) {
            data[pattern.key] = answer;
            break;
          }
        }
      }
    }
  }

  async initializeSheet(): Promise<boolean> {
    try {
      // Check if headers exist, if not add them
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Foglio1!A1:Y1'
      });

      if (!response.data.values || response.data.values.length === 0) {
        // Add comprehensive headers
        const headers = [[
          'Data/Ora', 'Session ID', 'Nome', 'Email', 'Età', 'Sesso', 'Tipo Pelle',
          'Problemi Pelle', 'Punteggio Pelle', 'Routine Attuale', 'Prodotti Usati',
          'Allergie', 'Profumo', 'Ore Sonno', 'Stress', 'Alimentazione', 'Fumo',
          'Protezione Solare', 'Problemi Specifici', 'Ingredienti Desiderati',
          'Budget Mensile', 'Frequenza Acquisto', 'Motivazione', 'Num. Messaggi',
          'Conversazione Completa'
        ]];
        
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: 'Foglio1!A1:Y1',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: headers
          }
        });

        console.log('Google Sheets headers initialized with comprehensive columns');
      }

      return true;
    } catch (error) {
      console.error('Failed to initialize Google Sheets:', error);
      console.error('Spreadsheet ID:', this.spreadsheetId);
      console.error('Error details:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      return false;
    }
  }
}