import type { Express } from "express";
import type { IStorage } from "../storage.js";

export function registerAutoSheetsImages(app: Express, storage: IStorage) {
  // Complete automatic image insertion into Google Sheets
  app.post("/api/admin/auto-insert-images", async (req, res) => {
    try {
      console.log(`🚀 Starting complete automatic image insertion into Google Sheets...`);
      
      if (!process.env.GOOGLE_CREDENTIALS_JSON || !process.env.GOOGLE_SPREADSHEET_ID) {
        return res.status(400).json({ error: "Google Sheets not configured" });
      }

      // Dynamic import to avoid module issues
      const { google } = await import('googleapis');
      
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      const auth = new google.auth.JWT(
        credentials.client_email,
        null,
        credentials.private_key.replace(/\\n/g, '\n'),
        ['https://www.googleapis.com/auth/spreadsheets']
      );
      
      const sheetsApi = google.sheets({ version: 'v4', auth });
      
      // Step 1: Convert images to public URLs
      console.log(`📋 Step 1: Converting images to public URLs...`);
      
      const allSessions = await storage.getAllChatSessions();
      const sessionsWithEmail = allSessions.filter(session => 
        session.userEmail && 
        session.userEmail.trim() !== '' &&
        !session.userEmail.includes('@example.')
      ).slice(0, 10); // Process in batches
      
      const processedImages = [];
      
      for (const session of sessionsWithEmail) {
        try {
          const messages = await storage.getChatMessages(session.sessionId);
          
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
          
          if (!imageBase64) continue;
          
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
          
          const fileName = `auto-${session.sessionId}-${Date.now()}.jpg`;
          const tempPath = `${tempDir}/${fileName}`;
          await fs.writeFile(tempPath, imageBuffer);
          
          // Create public URL
          const domain = process.env.REPL_SLUG && process.env.REPL_OWNER 
            ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
            : `http://localhost:5000`;
            
          const publicUrl = `${domain}/uploads/${fileName}`;
          
          processedImages.push({
            sessionId: session.sessionId,
            publicUrl: publicUrl,
            imageFormula: `=IMAGE("${publicUrl}",4,80,80)`
          });
          
          console.log(`✅ Processed: ${session.sessionId} -> ${publicUrl}`);
          
        } catch (error) {
          console.error(`❌ Failed to process session ${session.sessionId}:`, error.message);
        }
      }
      
      console.log(`📋 Step 2: Getting existing sheet data...`);
      
      // Step 2: Get existing sheet data to map session IDs to rows
      const existingData = await sheetsApi.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
        range: 'Foglio1!B:B'
      });
      
      const sessionIds = existingData.data.values ? existingData.data.values.flat() : [];
      
      console.log(`📋 Step 3: Updating Google Sheets with IMAGE formulas...`);
      
      // Step 3: Update Google Sheets with IMAGE formulas
      let updated = 0;
      const updateResults = [];
      
      for (const imageData of processedImages) {
        try {
          const existingIndex = sessionIds.findIndex(id => id === imageData.sessionId);
          
          if (existingIndex >= 0) {
            const rowIndex = existingIndex + 1; // Sheets are 1-indexed
            
            // Update with IMAGE formula
            await sheetsApi.spreadsheets.values.update({
              spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
              range: `Foglio1!Y${rowIndex}`,
              valueInputOption: 'USER_ENTERED',
              requestBody: {
                values: [[imageData.imageFormula]]
              }
            });
            
            updated++;
            updateResults.push({
              sessionId: imageData.sessionId,
              sheetRow: rowIndex,
              status: 'updated',
              publicUrl: imageData.publicUrl
            });
            
            console.log(`✅ Updated Google Sheets row ${rowIndex} with IMAGE formula`);
            
            // Small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 1500));
            
          } else {
            updateResults.push({
              sessionId: imageData.sessionId,
              status: 'not_found_in_sheet',
              publicUrl: imageData.publicUrl
            });
          }
          
        } catch (error) {
          console.error(`❌ Failed to update sheet for session ${imageData.sessionId}:`, error.message);
          updateResults.push({
            sessionId: imageData.sessionId,
            status: 'error',
            error: error.message
          });
        }
      }
      
      res.json({ 
        success: true, 
        message: "Inserimento automatico completato",
        processedImages: processedImages.length,
        updatedRows: updated,
        results: updateResults,
        summary: `Ho processato ${processedImages.length} immagini e aggiornato ${updated} righe in Google Sheets. Le immagini sono ora visibili direttamente nel foglio con formule IMAGE automatiche!`
      });
      
    } catch (error) {
      console.error("Error in automatic image insertion:", error);
      res.status(500).json({ 
        error: "Failed to insert images automatically", 
        details: error.message 
      });
    }
  });
}