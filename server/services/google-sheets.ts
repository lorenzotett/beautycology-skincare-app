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

      // Build conversation text
      let conversationText = `=== CONVERSAZIONE ${sessionId} ===\n`;
      conversationText += `Data: ${timestamp}\n`;
      conversationText += `Nome: ${userName}\n`;
      conversationText += `Email: ${userEmail || 'Non fornita'}\n`;
      
      if (skinAnalysis) {
        conversationText += `\nANALISI PELLE:\n`;
        conversationText += `Punteggio Generale: ${skinAnalysis.generalScore || 'N/A'}\n`;
        if (skinAnalysis.scores) {
          Object.entries(skinAnalysis.scores).forEach(([key, value]) => {
            conversationText += `- ${key}: ${value}\n`;
          });
        }
      }

      conversationText += `\nCONVERSAZIONE:\n`;
      conversationText += '---\n';

      // Add all messages
      messages.forEach(message => {
        const role = message.role === 'user' ? userName : 'AI-DermaSense';
        const time = new Date(message.createdAt).toLocaleTimeString('it-IT', {
          hour: '2-digit',
          minute: '2-digit'
        });
        conversationText += `[${time}] ${role}: ${message.content}\n`;
      });

      conversationText += '\n=== FINE CONVERSAZIONE ===\n\n';

      // Prepare data for Google Sheets
      const values = [[
        timestamp,
        sessionId,
        userName,
        userEmail || '',
        skinAnalysis?.generalScore || '',
        messages.length,
        conversationText
      ]];

      // Append to Google Sheets
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Sheet1!A:G', // Adjust range as needed
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
      return false;
    }
  }

  async initializeSheet(): Promise<boolean> {
    try {
      // Check if headers exist, if not add them
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Sheet1!A1:G1'
      });

      if (!response.data.values || response.data.values.length === 0) {
        // Add headers
        const headers = [['Data/Ora', 'Session ID', 'Nome', 'Email', 'Punteggio Pelle', 'Num. Messaggi', 'Conversazione Completa']];
        
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: 'Sheet1!A1:G1',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: headers
          }
        });

        console.log('Google Sheets headers initialized');
      }

      return true;
    } catch (error) {
      console.error('Failed to initialize Google Sheets:', error);
      return false;
    }
  }
}