import sharp from "sharp";

export interface ProcessedImage {
  base64: string;
  mimeType: string;
  width: number;
  height: number;
  sizeInBytes: number;
}

export interface ImageAnalysisHeuristics {
  rednessScore: number;    // 0-100: quanto è rossa la pelle (indica infiammazione/acne)
  textureScore: number;    // 0-100: quanto è irregolare la texture (indica acne/imperfezioni)
  oilinessScore: number;   // 0-100: quanto appare oleosa/lucida la pelle
  darknessScore: number;   // 0-100: presenza di occhiaie/macchie scure
}

export class ImagePreprocessor {
  private readonly MAX_DIMENSION = 1024;
  private readonly JPEG_QUALITY = 85;
  private readonly MAX_SIZE_MB = 4;

  /**
   * Preprocessa un'immagine per l'invio a Gemini AI
   * - Converte in JPEG
   * - Ridimensiona se necessario
   * - Ottimizza le dimensioni
   */
  async preprocessForGemini(base64DataUrl: string): Promise<ProcessedImage> {
    console.log("🖼️ Preprocessing immagine per Gemini...");
    
    try {
      // Estrai base64 puro e mime type
      let base64Data = base64DataUrl;
      let originalMimeType = 'image/jpeg';
      
      if (base64DataUrl.startsWith('data:')) {
        const matches = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          originalMimeType = matches[1];
          base64Data = matches[2];
        }
      }
      
      console.log(`📋 Tipo MIME originale: ${originalMimeType}`);
      
      // Converti base64 in buffer
      const inputBuffer = Buffer.from(base64Data, 'base64');
      
      // Ottieni metadati dell'immagine
      const metadata = await sharp(inputBuffer).metadata();
      console.log(`📐 Dimensioni originali: ${metadata.width}x${metadata.height}`);
      
      // Processa l'immagine con Sharp
      let processedImage = sharp(inputBuffer);
      
      // Ridimensiona se troppo grande
      if (metadata.width && metadata.height) {
        if (metadata.width > this.MAX_DIMENSION || metadata.height > this.MAX_DIMENSION) {
          const aspectRatio = metadata.width / metadata.height;
          const newWidth = aspectRatio > 1 ? this.MAX_DIMENSION : Math.round(this.MAX_DIMENSION * aspectRatio);
          const newHeight = aspectRatio > 1 ? Math.round(this.MAX_DIMENSION / aspectRatio) : this.MAX_DIMENSION;
          
          console.log(`🔄 Ridimensionamento a: ${newWidth}x${newHeight}`);
          processedImage = processedImage.resize(newWidth, newHeight, {
            fit: 'inside',
            withoutEnlargement: true
          });
        }
      }
      
      // Converti sempre in JPEG per compatibilità
      const outputBuffer = await processedImage
        .jpeg({ 
          quality: this.JPEG_QUALITY,
          progressive: true,
          optimizeScans: true
        })
        .toBuffer();
      
      // Ottieni informazioni sull'immagine processata
      const processedMetadata = await sharp(outputBuffer).metadata();
      
      // Verifica che non sia troppo grande
      const sizeInMB = outputBuffer.length / (1024 * 1024);
      if (sizeInMB > this.MAX_SIZE_MB) {
        // Se ancora troppo grande, riduci la qualità
        console.log(`⚠️ Immagine ancora troppo grande (${sizeInMB.toFixed(2)}MB), riduco qualità...`);
        const reducedBuffer = await sharp(inputBuffer)
          .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 70 })
          .toBuffer();
        
        return {
          base64: reducedBuffer.toString('base64'),
          mimeType: 'image/jpeg',
          width: 800,
          height: 800,
          sizeInBytes: reducedBuffer.length
        };
      }
      
      console.log(`✅ Immagine processata: ${processedMetadata.width}x${processedMetadata.height}, ${(outputBuffer.length / 1024).toFixed(2)}KB`);
      
      return {
        base64: outputBuffer.toString('base64'),
        mimeType: 'image/jpeg',
        width: processedMetadata.width || this.MAX_DIMENSION,
        height: processedMetadata.height || this.MAX_DIMENSION,
        sizeInBytes: outputBuffer.length
      };
      
    } catch (error) {
      console.error("❌ Errore nel preprocessing dell'immagine:", error);
      throw new Error("Impossibile processare l'immagine");
    }
  }

  /**
   * Analisi euristica dell'immagine per fallback intelligente
   * Analizza i colori e la texture per stimare problemi della pelle
   */
  async analyzeImageHeuristics(base64DataUrl: string): Promise<ImageAnalysisHeuristics> {
    console.log("🔍 Analisi euristica dell'immagine per fallback intelligente...");
    
    try {
      // Estrai base64 puro
      let base64Data = base64DataUrl;
      if (base64DataUrl.startsWith('data:')) {
        const matches = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          base64Data = matches[2];
        }
      }
      
      const inputBuffer = Buffer.from(base64Data, 'base64');
      
      // Ridimensiona a una dimensione gestibile per l'analisi (400x400)
      const analysisBuffer = await sharp(inputBuffer)
        .resize(400, 400, { fit: 'cover' })
        .raw()
        .toBuffer({ resolveWithObject: true });
      
      const { data, info } = analysisBuffer;
      const pixelCount = info.width * info.height;
      
      // Analisi dei colori per rilevare rossori/acne
      let rednesCount = 0;
      let brightnessSum = 0;
      let highContrastCount = 0;
      let darkPixels = 0;
      
      // Analizza solo la zona centrale (60% dell'immagine) per evitare sfondi
      const centerStartX = Math.floor(info.width * 0.2);
      const centerEndX = Math.floor(info.width * 0.8);
      const centerStartY = Math.floor(info.height * 0.2);
      const centerEndY = Math.floor(info.height * 0.8);
      
      for (let y = centerStartY; y < centerEndY; y++) {
        for (let x = centerStartX; x < centerEndX; x++) {
          const idx = (y * info.width + x) * info.channels;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          
          // Calcola luminosità
          const brightness = (r + g + b) / 3;
          brightnessSum += brightness;
          
          // Rileva rossori (rosso più prominente di verde e blu)
          if (r > g * 1.15 && r > b * 1.15 && r > 100) {
            rednesCount++;
          }
          
          // Rileva zone scure (occhiaie, macchie)
          if (brightness < 80) {
            darkPixels++;
          }
          
          // Calcola contrasto locale per texture (indica imperfezioni)
          if (x > centerStartX && y > centerStartY) {
            const prevIdx = ((y-1) * info.width + (x-1)) * info.channels;
            const prevBrightness = (data[prevIdx] + data[prevIdx+1] + data[prevIdx+2]) / 3;
            if (Math.abs(brightness - prevBrightness) > 30) {
              highContrastCount++;
            }
          }
        }
      }
      
      const analyzedPixels = (centerEndX - centerStartX) * (centerEndY - centerStartY);
      const avgBrightness = brightnessSum / analyzedPixels;
      
      // Calcola punteggi basati sull'analisi
      const rednessPercentage = (rednesCount / analyzedPixels) * 100;
      const textureIrregularity = (highContrastCount / analyzedPixels) * 100;
      const darknessPercentage = (darkPixels / analyzedPixels) * 100;
      
      // Mappa i valori grezzi a punteggi 0-100 con curve realistiche
      const rednessScore = Math.min(100, Math.round(rednessPercentage * 3)); // Amplifica i rossori
      const textureScore = Math.min(100, Math.round(textureIrregularity * 4)); // Amplifica texture irregolare
      const oilinessScore = avgBrightness > 180 ? Math.min(100, Math.round((avgBrightness - 180) * 2)) : 20;
      const darknessScore = Math.min(100, Math.round(darknessPercentage * 2));
      
      console.log(`📊 Analisi euristica completata:
        - Rossori: ${rednessScore}/100 (${rednessPercentage.toFixed(1)}% pixel rossi)
        - Texture: ${textureScore}/100 (${textureIrregularity.toFixed(1)}% contrasto)
        - Oleosità: ${oilinessScore}/100 (luminosità media: ${avgBrightness.toFixed(0)})
        - Zone scure: ${darknessScore}/100 (${darknessPercentage.toFixed(1)}% pixel scuri)`);
      
      return {
        rednessScore,
        textureScore,
        oilinessScore,
        darknessScore
      };
      
    } catch (error) {
      console.error("❌ Errore nell'analisi euristica:", error);
      // Ritorna valori neutri in caso di errore
      return {
        rednessScore: 30,
        textureScore: 35,
        oilinessScore: 40,
        darknessScore: 30
      };
    }
  }
}