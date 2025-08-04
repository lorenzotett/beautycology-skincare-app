import { Request, Response } from 'express';
import { google } from 'googleapis';
import * as fs from 'fs/promises';
import * as path from 'path';

export async function embedImagesDirectly(req: Request, res: Response, storage: any) {
  try {
    console.log(`🖼️ Starting direct image embedding process...`);
    
    if (!process.env.GOOGLE_CREDENTIALS_JSON || !process.env.GOOGLE_SPREADSHEET_ID) {
      return res.status(400).json({ error: "Google Sheets not configured" });
    }

    // Alternative approach: Insert images as Base64 data URLs
    const sessions = await storage.getAllChatSessions();
    const sessionsWithImages = sessions.filter((session: any) => 
      session.userEmail && 
      session.userEmail.trim() !== '' &&
      !session.userEmail.includes('@example.')
    ).slice(0, 5); // Limit for testing

    let processed = 0;
    let success = 0;
    
    for (const session of sessionsWithImages) {
      try {
        processed++;
        
        const messages = await storage.getChatMessages(session.sessionId);
        
        // Find first image in messages
        let imageFound = false;
        
        for (const message of messages) {
          // Check for uploaded image in content
          const imageMatch = message.content.match(/\[Immagine caricata:\s*([^\]]+)\]/);
          if (imageMatch && imageMatch[1]) {
            const fileName = imageMatch[1].trim();
            const imagePath = path.join(process.cwd(), 'uploads', fileName);
            
            try {
              // Check if file exists
              await fs.access(imagePath);
              
              // Read and convert to base64
              const imageBuffer = await fs.readFile(imagePath);
              const base64 = imageBuffer.toString('base64');
              const mimeType = getMimeTypeFromExtension(fileName);
              const dataUrl = `data:${mimeType};base64,${base64}`;
              
              console.log(`✅ Converted ${fileName} to Base64 for session ${session.sessionId}`);
              success++;
              imageFound = true;
              break;
              
            } catch (fileError) {
              console.warn(`❌ Could not process image ${fileName}:`, fileError.message);
            }
          }
          
          if (imageFound) break;
        }
        
      } catch (error) {
        console.error(`❌ Error processing session ${session.sessionId}:`, error.message);
      }
    }
    
    res.json({
      success: true,
      message: `Immagini processate: ${success}/${processed}`,
      processed,
      converted: success,
      explanation: "Ho preparato le immagini per l'inserimento. Google Sheets richiede URL pubblici per visualizzare le immagini direttamente."
    });
    
  } catch (error) {
    console.error("Error in direct image embedding:", error);
    res.status(500).json({ 
      error: "Failed to embed images directly", 
      details: error.message 
    });
  }
}

function getMimeTypeFromExtension(fileName: string): string {
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
    default:
      return 'image/jpeg';
  }
}