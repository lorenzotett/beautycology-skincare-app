// Script per creare un file con tutte le immagini Base64 per download manuale
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

async function extractAllImages() {
  console.log('🖼️ Extracting all Base64 images from database...');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // Query per ottenere tutte le immagini Base64
    const result = await client.query(`
      SELECT 
        session_id, 
        metadata->>'imageBase64' as image_base64,
        metadata->>'imageOriginalName' as original_name,
        created_at
      FROM chat_messages 
      WHERE metadata->>'hasImage' = 'true' 
      AND metadata->>'imageBase64' IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    console.log(`Found ${result.rows.length} images with Base64 data`);
    
    let htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Immagini AI DermaSense - Download</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .image-item { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
        .image-preview { max-width: 200px; max-height: 200px; border: 1px solid #ccc; }
        .download-btn { 
            background: #007bff; color: white; padding: 8px 16px; 
            text-decoration: none; border-radius: 4px; margin: 5px;
            display: inline-block;
        }
        .session-id { font-family: monospace; background: #f5f5f5; padding: 2px 5px; }
    </style>
</head>
<body>
    <h1>🖼️ Immagini AI DermaSense</h1>
    <p>Clicca sui link per scaricare le immagini e poi caricale manualmente in Google Sheets colonna Y</p>
`;

    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows[i];
      if (row.image_base64) {
        const sessionId = row.session_id;
        const originalName = row.original_name || `image_${i + 1}.jpg`;
        const imageData = row.image_base64;
        
        htmlContent += `
        <div class="image-item">
            <h3>Sessione: <span class="session-id">${sessionId}</span></h3>
            <p><strong>File originale:</strong> ${originalName}</p>
            <p><strong>Data:</strong> ${new Date(row.created_at).toLocaleDateString('it-IT')}</p>
            <img src="${imageData}" class="image-preview" alt="Anteprima immagine">
            <br>
            <a href="${imageData}" download="${originalName}" class="download-btn">
                💾 Scarica ${originalName}
            </a>
        </div>
        `;
      }
    }
    
    htmlContent += `
    </body>
    </html>
    `;
    
    // Salva il file HTML
    fs.writeFileSync('immagini-download.html', htmlContent);
    console.log('✅ File HTML creato: immagini-download.html');
    console.log('📋 Apri il file nel browser per scaricare le immagini');
    
  } catch (error) {
    console.error('❌ Errore durante l\'estrazione:', error);
  } finally {
    await client.end();
  }
}

// Esegui sempre quando importato
extractAllImages();