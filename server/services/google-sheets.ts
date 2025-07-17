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
      // Check if session already exists in sheet to avoid duplicates
      const existingData = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Foglio1!B:B' // Session ID column
      });

      if (existingData.data.values) {
        const sessionIds = existingData.data.values.flat();
        if (sessionIds.includes(sessionId)) {
          console.log(`Session ${sessionId} already exists in Google Sheets, skipping duplicate`);
          return true; // Return true as it's already synced
        }
      }
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
        extractedData.idratazione || '', // R - Water intake
        extractedData.protezioneSolare || '', // S
        extractedData.problemiSpecifici || '', // T
        extractedData.ingredientiDesiderati || '', // U
        extractedData.budgetMensile || '', // V
        extractedData.frequenzaAcquisto || '', // W
        extractedData.motivazione || '', // X
        messages.length, // Y
        conversationText // Z
      ]];

      // Append to Google Sheets
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Foglio1!A:Z', // Extended range for all columns
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

    // Extract skin analysis data from AI messages
    this.extractSkinAnalysisFromMessages(messages, data);

    // Comprehensive question-answer extraction
    this.extractAllQuestionAnswers(messages, data);
    
    // Log extracted data summary
    const extractedFields = Object.keys(data).filter(key => data[key] && data[key] !== '').length;
    console.log(`Extracted ${extractedFields} data fields from conversation`);
    
    return data;
  }

  private extractAllQuestionAnswers(messages: ChatMessage[], data: any): void {
    // Define comprehensive patterns for all questions - ordered by specificity
    const questionPatterns = [
      // Basic info - most specific first
      { key: 'eta', patterns: ['quanti anni hai', 'anni hai'] },
      { key: 'sesso', patterns: ['genere?', 'sesso', 'uomo o donna', 'maschio o femmina'] },
      
      // Specific questions from the conversation - very specific patterns
      { key: 'utilizzaScrub', patterns: ['utilizzi scrub o peeling', 'scrub o peeling'] },
      { key: 'pelleTira', patterns: ['quando ti lavi il viso la tua pelle tira', 'pelle tira'] },
      { key: 'causaRossori', patterns: ['rossori sulla tua pelle. secondo te derivano principalmente da'] },
      { key: 'tipoPelle', patterns: ['come definiresti la tua pelle', 'definisci la tua pelle'] },
      
      // Allergies and preferences - specific wording
      { key: 'allergie', patterns: ['ingredienti ai quali la tua pelle è allergica', 'allergie particolari'] },
      { key: 'profumo', patterns: ['ti piacerebbe avere una fragranza che profumi di fiori', 'fragranza che profumi'] },
      
      // Lifestyle questions - exact phrases  
      { key: 'protezioneSolare', patterns: ['metti la crema solare ogni giorno'] },
      { key: 'idratazione', patterns: ['quanti litri d\'acqua bevi al giorno'] }, 
      { key: 'sonno', patterns: ['quante ore dormi in media'] },
      { key: 'alimentazione', patterns: ['hai un\'alimentazione bilanciata'] },
      { key: 'fumo', patterns: ['fumi?'] },
      { key: 'stress', patterns: ['da 1 a 10, qual è il tuo livello di stress attuale', 'livello di stress'] },
      { key: 'email', patterns: ['per visualizzare gli ingredienti perfetti per la tua pelle, potresti condividere la tua mail'] },
      
      // Routine and products  
      { key: 'routine', patterns: ['routine attuale', 'prodotti usi attualmente'] },
      { key: 'prodotti', patterns: ['quali prodotti utilizzati'] },
      
      // Preferences and goals  
      { key: 'problemiSpecifici', patterns: ['problema principale che vorresti risolvere'] },
      { key: 'ingredientiDesiderati', patterns: ['ingredienti particolari che ti piacerebbe trovare'] },
      { key: 'budgetMensile', patterns: ['budget mensile per la skincare'] },
      { key: 'frequenzaAcquisto', patterns: ['frequenza di acquisto preferita'] },
      { key: 'motivazione', patterns: ['cosa ti ha spinto a cercare una routine personalizzata'] }
    ];

    // Extract basic info from any user message
    const allUserContent = messages.filter(m => m.role === 'user').map(m => m.content).join(' ').toLowerCase();
    
    // Age extraction with multiple patterns
    const agePatterns = [
      /(?:ho|età|anni?)\s*(\d{1,2})\s*(?:anni?)?/g,
      /(\d{1,2})\s*anni/g,
      /età[:\s]*(\d{1,2})/g
    ];
    
    for (const pattern of agePatterns) {
      const match = allUserContent.match(pattern);
      if (match) {
        const ageMatch = match[0].match(/(\d{1,2})/);
        if (ageMatch) {
          data.eta = ageMatch[1];
          break;
        }
      }
    }

    // Gender extraction
    if (allUserContent.includes('donna') || allUserContent.includes('femmina') || allUserContent.includes('ragazza')) {
      data.sesso = 'Donna';
    } else if (allUserContent.includes('uomo') || allUserContent.includes('maschio') || allUserContent.includes('ragazzo')) {
      data.sesso = 'Uomo';
    }

    // Create ordered question-answer mapping
    const questionAnswerPairs: Array<{question: string, answer: string, index: number}> = [];
    
    for (let i = 0; i < messages.length - 1; i++) {
      const assistantMsg = messages[i];
      const userResponse = messages[i + 1];
      
      if (assistantMsg.role === 'assistant' && userResponse.role === 'user') {
        const question = assistantMsg.content.toLowerCase();
        const answer = userResponse.content.trim();
        
        // Skip empty answers and image uploads
        if (!answer || answer.length < 2 || answer.includes('[Immagine caricata:')) continue;
        
        questionAnswerPairs.push({ question, answer, index: i });
      }
    }
    
    console.log(`Found ${questionAnswerPairs.length} question-answer pairs to process`);
    
    // Process pairs in order, being careful about specificity
    for (const pair of questionAnswerPairs) {
      let matched = false;
      
      // Try to find the most specific pattern match
      for (const pattern of questionPatterns) {
        for (const patternText of pattern.patterns) {
          if (pair.question.includes(patternText)) {
            // Avoid overwriting with less specific data
            if (!data[pattern.key] || pair.answer.length > (data[pattern.key]?.length || 0)) {
              data[pattern.key] = pair.answer;
              console.log(`Q${pair.index}: "${patternText}" -> ${pattern.key} = "${pair.answer}"`);
              matched = true;
              break;
            }
          }
        }
        if (matched) break;
      }
      
      // Log unmatched pairs for pattern improvement (only in development)
      if (!matched && process.env.NODE_ENV === 'development') {
        console.log(`UNMATCHED Q${pair.index}: "${pair.question.substring(0, 80)}..." -> "${pair.answer}"`);
      }
    }
    
    // Fill in any missing basic info from user messages
    this.extractMissingBasicInfo(messages, data);
  }

  private handleSpecialQuestions(question: string, answer: string, data: any): void {
    const lowerAnswer = answer.toLowerCase();
    
    // Handle skin type questions
    if (question.includes('tipo di pelle') || question.includes('che tipo di pelle')) {
      const skinTypes = ['grassa', 'secca', 'mista', 'normale', 'sensibile'];
      for (const type of skinTypes) {
        if (lowerAnswer.includes(type)) {
          data.tipoPelle = type.charAt(0).toUpperCase() + type.slice(1);
          break;
        }
      }
    }
    
    // Handle yes/no questions with proper formatting
    if (question.includes('fumi') || question.includes('sigarette')) {
      if (lowerAnswer.includes('sì') || lowerAnswer.includes('si') || lowerAnswer.includes('yes')) {
        data.fumo = answer;
      } else if (lowerAnswer.includes('no') || lowerAnswer.includes('non')) {
        data.fumo = answer;
      }
    }
    
    // Handle stress levels
    if (question.includes('stress')) {
      if (lowerAnswer.includes('alto') || lowerAnswer.includes('molto') || lowerAnswer.includes('parecchio')) {
        data.stress = answer;
      } else if (lowerAnswer.includes('basso') || lowerAnswer.includes('poco') || lowerAnswer.includes('normale')) {
        data.stress = answer;
      } else {
        data.stress = answer;
      }
    }
  }

  private extractSkinAnalysisFromMessages(messages: ChatMessage[], data: any): void {
    // Find AI messages that contain skin analysis results
    const aiMessages = messages.filter(m => m.role === 'assistant');
    
    for (const message of aiMessages) {
      const content = message.content.toLowerCase();
      
      // Extract skin type from analysis results
      if (!data.tipoPelle && content.includes('tipo di pelle')) {
        const skinTypes = ['grassa', 'secca', 'mista', 'normale', 'sensibile', 'combinata'];
        for (const type of skinTypes) {
          if (content.includes(type)) {
            data.tipoPelle = type.charAt(0).toUpperCase() + type.slice(1);
            console.log(`Extracted skin type: ${data.tipoPelle}`);
            break;
          }
        }
      }
      
      // Extract skin score from analysis - look for level patterns
      if (!data.punteggioPelle) {
        const scoreMatch = content.match(/livello:\s*(\d+)\/100/i) || 
                          content.match(/punteggio[^\d]*(\d+)/i) ||
                          content.match(/score[^\d]*(\d+)/i) ||
                          content.match(/(\d+)\/100/) ||
                          content.match(/(\d+)\s*punti/);
        if (scoreMatch) {
          data.punteggioPelle = scoreMatch[1];
          console.log(`Extracted skin score: ${data.punteggioPelle}`);
        }
      }
      
      // Extract skin problems from analysis - look for specific level patterns
      if (!data.problemiPelle && (content.includes('necessità') || content.includes('livello:'))) {
        // Look for problem-level patterns like "Rossori (Livello: 65/100)"
        const problemMatches = content.match(/[•]\s*\*\*([^(]+)\s*\(livello:\s*(\d+)\/100\)/gi);
        
        if (problemMatches) {
          const problems = problemMatches.map(match => {
            const parts = match.match(/[•]\s*\*\*([^(]+)\s*\(livello:\s*(\d+)\/100\)/i);
            if (parts) {
              return `${parts[1].trim()}: ${parts[2]}/100`;
            }
            return null;
          }).filter(Boolean);
          
          if (problems.length > 0) {
            data.problemiPelle = problems.join(', ');
            console.log(`Extracted skin problems: ${data.problemiPelle}`);
          }
        } else {
          // Fallback to simple pattern matching
          const problemPatterns = [
            /rossori?/i, /acne/i, /punti neri/i, /pori dilatati/i, 
            /rughe?/i, /secchezza/i, /oleosità/i, /disidratazione/i,
            /macchie/i, /discromie/i, /sensibilità/i, /texture irregolare/i
          ];
          
          const foundProblems = [];
          for (const pattern of problemPatterns) {
            if (pattern.test(content)) {
              foundProblems.push(pattern.source.replace(/[\\?]/g, ''));
            }
          }
          
          if (foundProblems.length > 0) {
            data.problemiPelle = foundProblems.join(', ');
            console.log(`Extracted skin problems (fallback): ${data.problemiPelle}`);
          }
        }
      }
    }
  }

  private extractMissingBasicInfo(messages: ChatMessage[], data: any): void {
    // Extract any missing info from user messages using broader patterns
    const userMessages = messages.filter(m => m.role === 'user');
    
    for (const message of userMessages) {
      const content = message.content.toLowerCase();
      
      // Try to extract anything that looks like useful data
      if (!data.tipoPelle) {
        const skinTypes = ['grassa', 'secca', 'mista', 'normale', 'sensibile'];
        for (const type of skinTypes) {
          if (content.includes(type)) {
            data.tipoPelle = type.charAt(0).toUpperCase() + type.slice(1);
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
        range: 'Foglio1!A1:Z1'
      });

      if (!response.data.values || response.data.values.length === 0) {
        // Add comprehensive headers
        const headers = [[
          'Data/Ora', 'Session ID', 'Nome', 'Email', 'Età', 'Sesso', 'Tipo Pelle',
          'Problemi Pelle', 'Punteggio Pelle', 'Routine Attuale', 'Prodotti Usati',
          'Allergie', 'Profumo', 'Ore Sonno', 'Stress', 'Alimentazione', 'Fumo',
          'Idratazione', 'Protezione Solare', 'Problemi Specifici', 'Ingredienti Desiderati',
          'Budget Mensile', 'Frequenza Acquisto', 'Motivazione', 'Num. Messaggi',
          'Conversazione Completa'
        ]];
        
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: 'Foglio1!A1:Z1',
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