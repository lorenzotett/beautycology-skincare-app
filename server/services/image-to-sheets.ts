import { ObjectStorageService } from '../objectStorage.js';
import fs from 'fs/promises';
import path from 'path';

export class ImageToSheetsService {
  private objectStorage: ObjectStorageService;

  constructor() {
    this.objectStorage = new ObjectStorageService();
  }

  // Upload Base64 image to Object Storage and return public URL
  async uploadBase64ToObjectStorage(base64Data: string, sessionId: string): Promise<string> {
    try {
      // Clean Base64 data
      const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
      
      // Convert to buffer
      const imageBuffer = Buffer.from(cleanBase64, 'base64');
      
      // Create temporary file
      const tempDir = './uploads';
      await fs.mkdir(tempDir, { recursive: true });
      
      const fileName = `session-${sessionId}-${Date.now()}.jpg`;
      const tempPath = path.join(tempDir, fileName);
      
      // Write to temp file
      await fs.writeFile(tempPath, imageBuffer);
      
      // Upload to Object Storage
      const publicUrl = await this.objectStorage.uploadFromFile(tempPath);
      
      // Clean up temp file
      await fs.unlink(tempPath);
      
      console.log(`✅ Uploaded image for session ${sessionId}: ${publicUrl}`);
      return publicUrl;
      
    } catch (error) {
      console.error(`❌ Failed to upload image for session ${sessionId}:`, error);
      throw error;
    }
  }

  // Process multiple images and return URL mapping
  async processSessionImages(sessions: any[]): Promise<Map<string, string>> {
    const urlMap = new Map<string, string>();
    
    for (const session of sessions) {
      try {
        // Find image in session messages
        const imageBase64 = await this.findImageInSession(session);
        
        if (imageBase64) {
          const publicUrl = await this.uploadBase64ToObjectStorage(imageBase64, session.sessionId);
          urlMap.set(session.sessionId, publicUrl);
          
          // Small delay to avoid overwhelming the service
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.error(`Failed to process session ${session.sessionId}:`, error);
      }
    }
    
    return urlMap;
  }

  private async findImageInSession(session: any): Promise<string | null> {
    // This would need to be connected to your storage service
    // For now, return null - you'll need to integrate with your existing storage
    return null;
  }

  // Create IMAGE formulas for Google Sheets
  createImageFormula(publicUrl: string, width: number = 100, height: number = 100): string {
    return `=IMAGE("${publicUrl}",4,${width},${height})`;
  }
}