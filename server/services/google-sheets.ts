import { google } from 'googleapis';
import type { ChatMessage } from '../../shared/schema';
import { ChatDataExtractor } from './chat-data-extractor';

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
    aiExtractedData?: any
  ): Promise<boolean> {
    try {
      // Check if session already exists in sheet to update rather than duplicate
      const existingData = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Foglio1!B:B' // Session ID column
      });

      let isUpdate = false;
      let updateRowIndex = -1;
      
      if (existingData.data.values) {
        const sessionIds = existingData.data.values.flat();
        const existingIndex = sessionIds.findIndex(id => id === sessionId);
        if (existingIndex >= 0) {
          isUpdate = true;
          updateRowIndex = existingIndex + 1; // +1 because sheets are 1-indexed
          console.log(`🔄 Session ${sessionId} exists at row ${updateRowIndex}, updating with fresh AI data`);
        }
      }
      // Format conversation data - use original session creation time, not sync time
      const sessionCreationDate = messages.length > 0 ? new Date(messages[0].createdAt) : new Date();
      const timestamp = sessionCreationDate.toLocaleString('it-IT', {
        timeZone: 'Europe/Rome',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Use the AI-extracted data passed from the calling function
      const extractedData = aiExtractedData || {};
      

      
      // Build full conversation text
      let conversationText = `=== CONVERSAZIONE ${sessionId} ===\n`;
      conversationText += `Data: ${timestamp}\nNome: ${userName}\nEmail: ${userEmail || 'Non fornita'}\n\n`;
      
      messages.forEach(message => {
        const role = message.role === 'user' ? userName : 'AI-DermaSense';
        const time = new Date(message.createdAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        conversationText += `[${time}] ${role}: ${message.content}\n`;
      });

      // Get ingredients from AI extraction or fallback to old method
      const ingredientiConsigliati = extractedData.ingredientiConsigliati || this.extractIngredientsFromMessages(messages);
      
      // Extract image data (try Base64 first, fallback to URLs)
      let immaginiCaricate = await this.extractImageBase64FromMessages(messages);
      
      // If no IMAGE formula was generated, try to get URL and convert to formula
      if (!immaginiCaricate || immaginiCaricate === '') {
        const imageUrl = this.extractImageUrlsFromMessages(messages);
        if (imageUrl && imageUrl !== 'Nessuna immagine') {
          // Convert URL to IMAGE formula for Google Sheets
          const urls = imageUrl.split(', ');
          const firstUrl = urls[0];
          immaginiCaricate = `=IMAGE("${firstUrl}",4,80,80)`;
          console.log(`📐 Converted URL to Google Sheets formula: ${immaginiCaricate}`);
        } else {
          immaginiCaricate = '';
        }
      }

      // Sanitize all data to ensure proper string format for Google Sheets
      const sanitizeValue = (value: any): string => {
        if (value === null || value === undefined) return '';
        if (Array.isArray(value)) return value.join(', ');
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
      };

      // Prepare structured data for Google Sheets with extracted values from custom AI model
      const values = [[
        timestamp, // A
        sessionId, // B
        userName, // C
        userEmail || '', // D
        sanitizeValue(extractedData.eta), // E
        sanitizeValue(extractedData.sesso), // F
        sanitizeValue(extractedData.tipoPelle), // G
        sanitizeValue(extractedData.problemiPelle), // H
        sanitizeValue(extractedData.punteggioPelle), // I
        sanitizeValue(extractedData.routine), // J
        sanitizeValue(extractedData.allergie), // K
        sanitizeValue(extractedData.profumo), // L
        sanitizeValue(extractedData.sonno), // M
        sanitizeValue(extractedData.stress), // N
        sanitizeValue(extractedData.alimentazione), // O
        sanitizeValue(extractedData.fumo), // P
        sanitizeValue(extractedData.idratazione), // Q
        sanitizeValue(extractedData.protezioneSolare), // R
        sanitizeValue(extractedData.utilizzaScrub), // S
        sanitizeValue(extractedData.faseCompletata), // T
        sanitizeValue(extractedData.accessoProdotti), // U
        sanitizeValue(extractedData.qualitaDati), // V
        sanitizeValue(extractedData.noteAggiuntive), // W
        sanitizeValue(ingredientiConsigliati), // X
        sanitizeValue(immaginiCaricate), // Y - Nuova colonna per immagini
        messages.length, // Z
        conversationText // AA
      ]];

      if (isUpdate && updateRowIndex > 0) {
        // Update existing row with fresh AI data including images
        const updateRange = `Foglio1!A${updateRowIndex}:AA${updateRowIndex}`;
        const response = await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: updateRange,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: values
          }
        });
        console.log(`✅ Successfully updated conversation ${sessionId} at row ${updateRowIndex} with fresh AI data and images`);
      } else {
        // Append new conversation to Google Sheets
        const response = await this.sheets.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range: 'Foglio1!A:AA', // Updated range to include image URLs column
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: values
          }
        });
        console.log(`✅ Successfully appended new conversation ${sessionId} to Google Sheets with images`);
      }
      
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

  private async extractConversationData(messages: ChatMessage[], skinAnalysis?: any): Promise<any> {
    try {
      // Usa il nuovo estrattore AI
      const extractor = new ChatDataExtractor();
      const aiExtractedData = await extractor.extractStructuredData(messages, skinAnalysis);
      
      // Aggiungi dati da skin analysis se disponibili
      if (skinAnalysis) {
        if (skinAnalysis.generalScore && aiExtractedData.punteggioPelle === 'Non specificato') {
          aiExtractedData.punteggioPelle = skinAnalysis.generalScore.toString();
        }
        
        if (skinAnalysis.scores && aiExtractedData.problemiPelle === 'Non specificato') {
          aiExtractedData.problemiPelle = Object.entries(skinAnalysis.scores)
            .filter(([key, value]) => value && value !== 'N/A')
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
        }
      }
      
      // Conta campi estratti (escludendo 'Non specificato')
      const extractedFields = Object.keys(aiExtractedData)
        .filter(key => aiExtractedData[key] && aiExtractedData[key] !== 'Non specificato').length;
      
      console.log(`🤖 AI ha estratto ${extractedFields} campi dati dalla conversazione`);
      
      return aiExtractedData;
    } catch (error) {
      console.error('❌ Errore nell\'estrazione AI, uso fallback:', error);
      return this.extractConversationDataFallback(messages, skinAnalysis);
    }
  }

  private extractConversationDataFallback(messages: ChatMessage[], skinAnalysis?: any): any {
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
    
    // Sequential question-answer extraction (improved accuracy)
    this.extractSequentialQuestionAnswers(messages, data);
    
    // Log extracted data summary
    const extractedFields = Object.keys(data).filter(key => data[key] && data[key] !== '').length;
    console.log(`📊 Fallback ha estratto ${extractedFields} campi dati dalla conversazione`);
    
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
      { key: 'prodotti', patterns: ['quali prodotti utilizzati'] }
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
      
      // Extract skin type from analysis results or deduce from scores
      if (!data.tipoPelle) {
        // First try direct extraction
        if (content.includes('tipo di pelle')) {
          const skinTypes = ['grassa', 'secca', 'mista', 'normale', 'sensibile', 'combinata'];
          for (const type of skinTypes) {
            if (content.includes(type)) {
              data.tipoPelle = type.charAt(0).toUpperCase() + type.slice(1);
              console.log(`Extracted skin type: ${data.tipoPelle}`);
              break;
            }
          }
        }
        
        // If not found, deduce from analysis scores
        if (!data.tipoPelle && content.includes('analisi completa della pelle')) {
          // Extract oleosità score to deduce skin type
          const oleoMatch = content.match(/oleosità[^\d]*(\d+)\/100/i);
          const acneMatch = content.match(/acne[^\d]*(\d+)\/100/i);
          const rossoriMatch = content.match(/rossori[^\d]*(\d+)\/100/i);
          
          if (oleoMatch || acneMatch || rossoriMatch) {
            const oleo = oleoMatch ? parseInt(oleoMatch[1]) : 0;
            const acne = acneMatch ? parseInt(acneMatch[1]) : 0;
            const rossori = rossoriMatch ? parseInt(rossoriMatch[1]) : 0;
            
            // Deduce skin type based on scores (priority: sensitivity > dryness > oiliness)
            if (rossori >= 50) {
              data.tipoPelle = 'Sensibile';
            } else if (oleo <= 30) {
              data.tipoPelle = 'Secca';
            } else if (oleo >= 70 || acne >= 60) {
              data.tipoPelle = 'Grassa';
            } else {
              data.tipoPelle = 'Mista';
            }
            console.log(`Deduced skin type from analysis: ${data.tipoPelle} (oleo:${oleo}, acne:${acne}, rossori:${rossori})`);
          }
        }
      }
      
      // Extract skin score - look for general score patterns
      if (!data.punteggioPelle) {
        const scoreMatch = content.match(/punteggio generale[^\d]*(\d+)\/100/i) || 
                          content.match(/livello:\s*(\d+)\/100/i) ||
                          content.match(/punteggio[^\d]*(\d+)/i) ||
                          content.match(/score[^\d]*(\d+)/i) ||
                          content.match(/(\d+)\/100.*buono|ottimo|discreto|critico/i);
        if (scoreMatch) {
          data.punteggioPelle = scoreMatch[1];
          console.log(`Extracted skin score: ${data.punteggioPelle}`);
        }
      }
      
      // Extract skin problems from analysis - enhanced pattern matching
      if (!data.problemiPelle && (content.includes('necessità') || content.includes('livello:') || content.includes('analisi completa'))) {
        // Look for problem-level patterns like "Rossori (Livello: 65/100)" or "• **Rossori (Livello: 65/100):**"
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
          // Look for analysis scores in the detailed analysis section with different patterns
          const problemScoreMatches = content.match(/-\s*\*\*([^:]+):\*\*\s*(\d+)\/100/gi) ||
                                     content.match(/[•-]\s*([^:]+):\s*(\d+)\/100/gi) ||
                                     content.match(/\*\*([^:]+):\*\*[^\d]*(\d+)\/100/gi);
          
          if (problemScoreMatches) {
            const problems = problemScoreMatches.map(match => {
              // Try multiple patterns
              let parts = match.match(/-\s*\*\*([^:]+):\*\*\s*(\d+)\/100/i) ||
                         match.match(/[•-]\s*([^:]+):\s*(\d+)\/100/i) ||
                         match.match(/\*\*([^:]+):\*\*[^\d]*(\d+)\/100/i);
              
              if (parts) {
                return `${parts[1].trim()}: ${parts[2]}/100`;
              }
              return null;
            }).filter(Boolean);
            
            if (problems.length > 0) {
              data.problemiPelle = problems.join(', ');
              console.log(`Extracted skin problems from scores: ${data.problemiPelle}`);
            }
          } else {
            // Extract major problems from final consultation message
            if (content.includes('necessità e consigli specifici')) {
              const majorProblems = [];
              if (content.includes('rossori')) majorProblems.push('Rossori');
              if (content.includes('acne')) majorProblems.push('Acne');
              if (content.includes('texture irregolare')) majorProblems.push('Texture Irregolare');
              if (content.includes('rughe')) majorProblems.push('Rughe');
              if (content.includes('macchie')) majorProblems.push('Macchie');
              
              if (majorProblems.length > 0) {
                data.problemiPelle = majorProblems.join(', ');
                console.log(`Extracted major skin problems: ${data.problemiPelle}`);
              }
            }
          }
        }
      }
    }
  }

  private extractSequentialQuestionAnswers(messages: ChatMessage[], data: any): void {
    // Define the exact question sequence with precise mappings
    const questionMappings = [
      { contains: 'utilizzi scrub o peeling', key: 'utilizzaScrub' },
      { contains: 'quando ti lavi il viso la tua pelle tira', key: 'pelleTira' },
      { contains: 'rossori sulla tua pelle. secondo te derivano principalmente da', key: 'causaRossori' },
      { contains: 'quanti anni hai', key: 'eta' },
      { contains: 'genere?', key: 'sesso' },
      { contains: 'ingredienti ai quali la tua pelle è allergica', key: 'allergie' },
      { contains: 'fragranza che profumi di fiori', key: 'profumo' },
      { contains: 'metti la crema solare ogni giorno', key: 'protezioneSolare' },
      { contains: 'quanti litri d\'acqua bevi al giorno', key: 'idratazione' },
      { contains: 'quante ore dormi in media', key: 'sonno' },
      { contains: 'hai un\'alimentazione bilanciata', key: 'alimentazione' },
      { contains: 'fumi?', key: 'fumo' },
      { contains: 'livello di stress attuale', key: 'stress' },
      { contains: 'potresti condividere la tua mail', key: 'email' }
    ];

    // Extract question-answer pairs in sequence
    for (let i = 0; i < messages.length - 1; i++) {
      const assistantMsg = messages[i];
      const userResponse = messages[i + 1];
      
      if (assistantMsg.role === 'assistant' && userResponse.role === 'user') {
        const question = assistantMsg.content.toLowerCase();
        const answer = userResponse.content.trim();
        
        // Skip empty answers and image uploads
        if (!answer || answer.length < 2 || answer.includes('[Immagine caricata:')) continue;
        
        // Find exact match for this question
        for (const mapping of questionMappings) {
          if (question.includes(mapping.contains)) {
            // Only overwrite if we don't have data or this is more specific
            if (!data[mapping.key] || data[mapping.key] === '') {
              data[mapping.key] = answer;
              console.log(`Sequential extraction - ${mapping.key}: "${answer}" (from "${mapping.contains}")`);
            }
            break;
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

  private extractImageUrlsFromMessages(messages: ChatMessage[]): string {
    const imageUrls: string[] = [];
    
    for (const message of messages) {
      // Check if message has image metadata
      if (message.metadata && (message.metadata as any).hasImage) {
        const metadata = message.metadata as any;
        
        // Check for various image URL formats
        if (metadata.imageUrl) {
          imageUrls.push(metadata.imageUrl);
        } else if (metadata.imageName) {
          // Construct URL from image name (assumes images are served from /uploads/)
          const baseUrl = process.env.NODE_ENV === 'production' 
            ? `${process.env.REPLIT_DEV_DOMAIN || 'https://your-repl-url.replit.dev'}`
            : 'http://localhost:5000';
          imageUrls.push(`${baseUrl}/uploads/${metadata.imageName}`);
        }
      }
      
      // Also check message content for image references
      const imageMatches = message.content.match(/\[Immagine caricata:[^\]]+\]/g);
      if (imageMatches) {
        for (const match of imageMatches) {
          const fileName = match.match(/\[Immagine caricata:\s*([^\]]+)\]/);
          if (fileName) {
            const baseUrl = process.env.NODE_ENV === 'production' 
              ? `${process.env.REPLIT_DEV_DOMAIN || 'https://your-repl-url.replit.dev'}`
              : 'http://localhost:5000';
            imageUrls.push(`${baseUrl}/uploads/${fileName[1].trim()}`);
          }
        }
      }
    }
    
    const result = imageUrls.join(', ');
    console.log(`🖼️ Estratti URL immagini: ${result || 'Nessuna immagine trovata'}`);
    
    return result || 'Nessuna immagine';
  }

  private async extractImageBase64FromMessages(messages: ChatMessage[]): Promise<string> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    for (const message of messages) {
      // Check for Base64 images in metadata first
      if (message.metadata && (message.metadata as any).hasImage) {
        const metadata = message.metadata as any;
        
        // If we already have Base64, convert to public URL and return IMAGE formula
        if (metadata.imageBase64) {
          console.log(`🖼️ Found existing Base64 image: ${metadata.imageOriginalName || 'unknown'}`);
          
          try {
            // Convert Base64 to public URL
            const cleanBase64 = metadata.imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
            const imageBuffer = Buffer.from(cleanBase64, 'base64');
            
            // Save to uploads directory
            const fileName = `sheets-${message.sessionId}-${Date.now()}.jpg`;
            const tempPath = path.join(process.cwd(), 'uploads', fileName);
            
            // Ensure uploads directory exists
            try {
              await fs.mkdir(path.join(process.cwd(), 'uploads'), { recursive: true });
            } catch (error) {
              // Directory already exists
            }
            
            await fs.writeFile(tempPath, imageBuffer);
            
            // Create public URL
            const domain = process.env.REPL_SLUG && process.env.REPL_OWNER 
              ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
              : `http://localhost:5000`;
              
            const publicUrl = `${domain}/uploads/${fileName}`;
            
            // Return IMAGE formula for Google Sheets
            const imageFormula = `=IMAGE("${publicUrl}",4,80,80)`;
            console.log(`✅ Converted image to Google Sheets formula: ${imageFormula}`);
            return imageFormula;
            
          } catch (error) {
            console.error(`❌ Failed to convert Base64 to public URL:`, error);
            return '';
          }
        }
        
        // Try to read image file and convert to public URL
        if (metadata.imagePath) {
          try {
            const fullPath = path.isAbsolute(metadata.imagePath) 
              ? metadata.imagePath 
              : path.join(process.cwd(), metadata.imagePath);
            
            const imageBuffer = await fs.readFile(fullPath);
            
            // Save to uploads directory with unique name
            const fileName = `sheets-${message.sessionId}-${Date.now()}.jpg`;
            const tempPath = path.join(process.cwd(), 'uploads', fileName);
            
            await fs.writeFile(tempPath, imageBuffer);
            
            // Create public URL
            const domain = process.env.REPL_SLUG && process.env.REPL_OWNER 
              ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
              : `http://localhost:5000`;
              
            const publicUrl = `${domain}/uploads/${fileName}`;
            
            // Return direct URL instead of IMAGE formula
            // Google Sheets may have issues with IMAGE formulas from Replit domains
            console.log(`✅ Using direct URL for Google Sheets: ${publicUrl}`);
            return publicUrl;
            
          } catch (error) {
            console.warn(`❌ Failed to read image file: ${metadata.imagePath}`, error);
          }
        }
      }
      
      // Check message content for uploaded image files
      const imageMatches = message.content.match(/\[Immagine caricata:\s*([^\]]+)\]/);
      if (imageMatches && imageMatches[1]) {
        const fileName = imageMatches[1].trim();
        const imagePath = path.join(process.cwd(), 'uploads', fileName);
        
        try {
          const imageBuffer = await fs.readFile(imagePath);
          
          // Create new filename for public access
          const newFileName = `sheets-${message.sessionId}-${Date.now()}.jpg`;
          const newPath = path.join(process.cwd(), 'uploads', newFileName);
          
          await fs.writeFile(newPath, imageBuffer);
          
          // Create public URL
          const domain = process.env.REPL_SLUG && process.env.REPL_OWNER 
            ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
            : `http://localhost:5000`;
            
          const publicUrl = `${domain}/uploads/${newFileName}`;
          
          // Return direct URL instead of IMAGE formula
          // Google Sheets may have issues with IMAGE formulas from Replit domains
          console.log(`✅ Using direct URL for Google Sheets: ${publicUrl}`);
          return publicUrl;
          
        } catch (error) {
          console.warn(`❌ Failed to read uploaded image: ${fileName}`, error);
        }
      }
    }
    
    console.log(`🖼️ No images found for conversion`);
    return '';
  }

  private getMimeType(fileName: string): string {
    const ext = fileName.toLowerCase().split('.').pop();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'heic':
        return 'image/heic';
      default:
        return 'image/jpeg';
    }
  }

  private extractIngredientsFromMessages(messages: ChatMessage[]): string {
    const ingredients = new Set<string>();
    
    // Lista completa degli ingredienti noti dal database di conoscenza
    const knownIngredients = [
      'Bardana', 'Mirto', 'Elicriso', 'Centella Asiatica', 'Liquirizia', 
      'Malva', 'Ginkgo Biloba', 'Amamelide', 'Kigelia Africana',
      'Estratto di Liquirizia', 'Acido Ialuronico', 'Retinolo', 'Niacinamide',
      'Acido Salicilico', 'Acido Glicolico', 'Vitamina C', 'Vitamina E',
      'Aloe Vera', 'Camomilla', 'Rosa Mosqueta', 'Argan', 'Jojoba'
    ];

    // Cerca nei messaggi dell'assistente
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    
    for (const message of assistantMessages) {
      const content = message.content;
      
      // Cerca pattern specifici per ingredienti consigliati
      if (content.includes('Ingrediente consigliato:') || 
          content.includes('ingredienti ideali') ||
          content.includes('principi attivi')) {
        
        // Estrai ingredienti dalla sezione delle necessità
        const necessitySection = content.match(/🔎\s*LE TUE PRINCIPALI NECESSITÀ[\s\S]*?(?=\n\n|\*\*📝|$)/i);
        if (necessitySection) {
          for (const ingredient of knownIngredients) {
            if (necessitySection[0].includes(ingredient)) {
              ingredients.add(ingredient);
            }
          }
        }

        // Estrai dalla routine personalizzata
        const routineSection = content.match(/📋\s*ROUTINE PERSONALIZZATA[\s\S]*?(?=\n\n|Puoi accedere|$)/i);
        if (routineSection) {
          for (const ingredient of knownIngredients) {
            if (routineSection[0].includes(ingredient)) {
              ingredients.add(ingredient);
            }
          }
        }

        // Pattern generici per ingredienti menzionati
        for (const ingredient of knownIngredients) {
          const ingredientRegex = new RegExp(`\\b${ingredient}\\b`, 'gi');
          if (ingredientRegex.test(content)) {
            // Verifica che sia nel contesto di un consiglio
            const sentences = content.split(/[.!?]/);
            for (const sentence of sentences) {
              if (sentence.includes(ingredient) && 
                  (sentence.includes('consiglio') || 
                   sentence.includes('ideale') || 
                   sentence.includes('perfetto') ||
                   sentence.includes('aiuta') ||
                   sentence.includes('ingrediente'))) {
                ingredients.add(ingredient);
                break;
              }
            }
          }
        }
      }
    }

    // Se non troviamo ingredienti specifici, prova a estrarre da pattern più generici
    if (ingredients.size === 0) {
      for (const message of assistantMessages) {
        if (message.content.includes('crema personalizzata') || 
            message.content.includes('formula personalizzata')) {
          
          // Cerca pattern come "con [ingrediente]"
          const withPattern = message.content.match(/con\s+([A-Za-z\s]+?)(?=\s*[,.]|$)/gi);
          if (withPattern) {
            for (const match of withPattern) {
              const potentialIngredient = match.replace(/^con\s+/i, '').trim();
              for (const knownIngredient of knownIngredients) {
                if (potentialIngredient.toLowerCase().includes(knownIngredient.toLowerCase())) {
                  ingredients.add(knownIngredient);
                }
              }
            }
          }
        }
      }
    }

    const result = Array.from(ingredients).join(', ');
    console.log(`📋 Estratti ingredienti consigliati: ${result || 'Nessuno trovato'}`);
    
    return result || 'Non specificato';
  }

  async initializeSheet(): Promise<boolean> {
    try {
      // Check if headers exist, if not add them
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Foglio1!A1:AA1'
      });

      if (!response.data.values || response.data.values.length === 0) {
        // Add comprehensive headers with new AI model fields (must match data columns A-AA)
        const headers = [[
          'Data/Ora', 'Session ID', 'Nome', 'Email', 'Età', 'Sesso', 'Tipo Pelle',
          'Problemi Pelle', 'Punteggio Pelle', 'Routine Attuale', 'Allergie', 'Profumo',
          'Ore Sonno', 'Stress', 'Alimentazione', 'Fumo', 'Idratazione', 'Protezione Solare',
          'Utilizzo Scrub', 'Fase Completata', 'Accesso Prodotti', 'Qualità Dati', 
          'Note Aggiuntive', 'Ingredienti Consigliati', 'URL Immagini', 'Num. Messaggi', 'Conversazione Completa'
        ]];
        
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: 'Foglio1!A1:AA1',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: headers
          }
        });

        console.log('Google Sheets headers initialized with comprehensive columns including images');
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