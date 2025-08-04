import type { IStorage } from "../storage.js";

export class CompleteImageAutomation {
  constructor(private storage: IStorage) {}

  // Process all sessions with images and convert to public URLs
  async processAllImages(limit: number = 50) {
    try {
      console.log(`🚀 Starting complete image automation (limit: ${limit})...`);
      
      const allSessions = await this.storage.getAllChatSessions();
      const sessionsWithEmail = allSessions.filter(session => 
        session.userEmail && 
        session.userEmail.trim() !== '' &&
        !session.userEmail.includes('@example.')
      ).slice(0, limit);
      
      const results = {
        processed: 0,
        converted: 0,
        publicUrls: [] as Array<{
          sessionId: string;
          userEmail: string;
          publicUrl: string;
          imageFormula: string;
        }>,
        errors: [] as Array<{
          sessionId: string;
          error: string;
        }>
      };
      
      for (const session of sessionsWithEmail) {
        try {
          results.processed++;
          
          const messages = await this.storage.getChatMessages(session.sessionId);
          
          // Find Base64 image
          let imageBase64 = null;
          for (const message of messages) {
            if (message.metadata && (message.metadata as any).hasImage) {
              const metadata = message.metadata as any;
              if (metadata.imageBase64) {
                imageBase64 = metadata.imageBase64;
                break;
              }
            }
          }
          
          if (!imageBase64) {
            continue;
          }
          
          // Convert Base64 to file
          const fs = await import('fs/promises');
          const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
          const imageBuffer = Buffer.from(cleanBase64, 'base64');
          
          // Save to uploads directory
          const tempDir = './uploads';
          try {
            await fs.mkdir(tempDir, { recursive: true });
          } catch (error) {
            // Directory already exists
          }
          
          const fileName = `automated-${session.sessionId}-${Date.now()}.jpg`;
          const tempPath = `${tempDir}/${fileName}`;
          await fs.writeFile(tempPath, imageBuffer);
          
          // Create public URL
          const domain = process.env.REPL_SLUG && process.env.REPL_OWNER 
            ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
            : `http://localhost:5000`;
            
          const publicUrl = `${domain}/uploads/${fileName}`;
          const imageFormula = `=IMAGE("${publicUrl}",4,80,80)`;
          
          results.converted++;
          results.publicUrls.push({
            sessionId: session.sessionId,
            userEmail: session.userEmail,
            publicUrl,
            imageFormula
          });
          
          console.log(`✅ Processed ${session.sessionId}: ${publicUrl}`);
          
        } catch (error) {
          console.error(`❌ Failed to process session ${session.sessionId}:`, error.message);
          results.errors.push({
            sessionId: session.sessionId,
            error: error.message
          });
        }
      }
      
      return results;
      
    } catch (error) {
      console.error("Error in complete image automation:", error);
      throw error;
    }
  }

  // Generate CSV export with session mapping
  generateCSVMapping(results: any) {
    const csvLines = ['Session ID,User Email,Public URL,Image Formula'];
    
    for (const item of results.publicUrls) {
      const csvLine = [
        item.sessionId,
        item.userEmail,
        item.publicUrl,
        `"${item.imageFormula}"`
      ].join(',');
      csvLines.push(csvLine);
    }
    
    return csvLines.join('\n');
  }

  // Generate Google Sheets instructions
  generateSheetsInstructions(results: any) {
    return `
🎯 ISTRUZIONI AUTOMATICHE PER GOOGLE SHEETS

✅ PROCESSATE ${results.converted} IMMAGINI SU ${results.processed} SESSIONI

📋 FORMULE IMAGE DA INSERIRE IN GOOGLE SHEETS:

${results.publicUrls.map(item => 
  `Session: ${item.sessionId}\nEmail: ${item.userEmail}\nFormula: ${item.imageFormula}\n`
).join('\n')}

🔧 PROCESSO APPLICAZIONE:
1. Apri il foglio Google Sheets
2. Trova la riga con il Session ID nella colonna B
3. Nella colonna Y della stessa riga, incolla la formula IMAGE
4. L'immagine apparirà automaticamente!

💡 SUGGERIMENTO VELOCE:
- Usa Ctrl+F per trovare rapidamente ogni Session ID
- Le formule sono già pronte, basta copia-incolla
- Tutte le immagini sono ora accessibili pubblicamente

✅ SISTEMA AUTOMATICO COMPLETATO CON SUCCESSO!
`.trim();
  }
}