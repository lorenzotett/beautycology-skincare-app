import fs from 'fs/promises';
import path from 'path';

// Service per caricare immagini su servizi pubblici
export class ImageUploadService {
  
  // Upload to Imgur (free, no API key needed per Base64)
  async uploadToImgur(base64Data: string): Promise<string> {
    try {
      // Remove data:image/jpeg;base64, prefix if present
      const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
      
      const response = await fetch('https://api.imgur.com/3/image', {
        method: 'POST',
        headers: {
          'Authorization': 'Client-ID 546c25a59c58ad7', // Public client ID
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: cleanBase64,
          type: 'base64'
        })
      });
      
      const result = await response.json();
      
      if (result.success && result.data?.link) {
        return result.data.link;
      }
      
      throw new Error('Failed to upload to Imgur');
    } catch (error) {
      console.error('Imgur upload failed:', error);
      throw error;
    }
  }
  
  // Upload to ImageBB (alternative service)
  async uploadToImageBB(base64Data: string): Promise<string> {
    try {
      const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
      
      const formData = new FormData();
      formData.append('image', cleanBase64);
      
      const response = await fetch('https://api.imgbb.com/1/upload?key=demo', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (result.success && result.data?.url) {
        return result.data.url;
      }
      
      throw new Error('Failed to upload to ImageBB');
    } catch (error) {
      console.error('ImageBB upload failed:', error);
      throw error;
    }
  }
  
  // Try multiple services in order
  async uploadImage(base64Data: string): Promise<string> {
    const services = [
      () => this.uploadToImgur(base64Data),
      () => this.uploadToImageBB(base64Data)
    ];
    
    for (const uploadService of services) {
      try {
        const url = await uploadService();
        console.log(`✅ Image uploaded successfully: ${url}`);
        return url;
      } catch (error) {
        console.warn(`Upload service failed, trying next...`);
        continue;
      }
    }
    
    throw new Error('All image upload services failed');
  }
  
  // Read image from file and upload
  async uploadFromFile(filePath: string): Promise<string> {
    try {
      const imageBuffer = await fs.readFile(filePath);
      const base64 = imageBuffer.toString('base64');
      const mimeType = this.getMimeType(filePath);
      const dataUrl = `data:${mimeType};base64,${base64}`;
      
      return await this.uploadImage(dataUrl);
    } catch (error) {
      console.error(`Failed to upload file ${filePath}:`, error);
      throw error;
    }
  }
  
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.gif':
        return 'image/gif';
      case '.webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  }
}