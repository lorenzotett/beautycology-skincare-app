import { google } from 'googleapis';
import { loadIntegrationConfig } from '../config/integrations';

export async function convertSheetsImagesToFormulas() {
  try {
    // Load integration configuration
    const integrationConfig = loadIntegrationConfig();
    
    if (!integrationConfig.googleSheets.enabled) {
      throw new Error('Google Sheets integration not configured');
    }
    
    const credentials = integrationConfig.googleSheets.credentials;
    const spreadsheetId = integrationConfig.googleSheets.spreadsheetId;
    
    if (!credentials || !spreadsheetId) {
      throw new Error('Missing Google Sheets credentials or spreadsheet ID');
    }

    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Get all data from column Y (images column)
    console.log('📊 Reading current image URLs from Google Sheets...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Foglio1!Y:Y'
    });

    const values = response.data.values || [];
    console.log(`Found ${values.length} rows to process`);

    // Convert URLs to direct URLs (not IMAGE formulas)
    const updatedValues = values.map((row, index) => {
      const cellValue = row[0] || '';
      
      // Log first 10 values to debug
      if (index < 10) {
        console.log(`Row ${index + 1} value: "${cellValue}"`);
      }
      
      // Skip header, empty cells, or cells with "Nessuna immagine"
      if (!cellValue || cellValue === 'Nessuna immagine' || cellValue === 'Immagini') {
        return [cellValue];
      }
      
      // If it's an IMAGE formula or #ERROR!, extract/convert the URL
      if (cellValue.startsWith('=IMAGE(') || cellValue === '#ERROR!') {
        console.log(`Row ${index + 1}: Found IMAGE formula or error: ${cellValue}`);
        
        // For IMAGE formulas, extract the URL
        if (cellValue.startsWith('=IMAGE(')) {
          const urlMatch = cellValue.match(/=IMAGE\("([^"]+)"/);
          if (urlMatch && urlMatch[1]) {
            console.log(`Row ${index + 1}: Extracting URL from IMAGE formula`);
            return [urlMatch[1]];
          }
        }
        
        // For #ERROR!, check if there was a URL in the previous sync
        // For now, just skip errors
        if (cellValue === '#ERROR!') {
          console.log(`Row ${index + 1}: Found #ERROR!, skipping`);
          return [''];  // Clear the error
        }
        
        return [cellValue];
      }
      
      // Check if it's a URL
      if (cellValue.includes('http://') || cellValue.includes('https://')) {
        // Extract the first URL if multiple
        const urls = cellValue.split(', ');
        const firstUrl = urls[0].trim();
        
        // Convert localhost URLs to proper domain
        let finalUrl = firstUrl;
        if (firstUrl.includes('localhost:5000')) {
          const domain = process.env.REPL_SLUG && process.env.REPL_OWNER 
            ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
            : 'https://workspace.BONNIEBEAUTY.repl.co';
          
          finalUrl = firstUrl.replace('http://localhost:5000', domain);
        }
        
        // Return direct URL (IMAGE formulas don't work with Replit domains)
        console.log(`Row ${index + 1}: Using direct URL`);
        return [finalUrl];
      }
      
      return [cellValue];
    });

    // Update all cells at once
    console.log('📝 Updating Google Sheets with IMAGE formulas...');
    const updateResponse = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Foglio1!Y:Y',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: updatedValues
      }
    });

    // Count actual conversions (URLs that don't start with = or http)
    let converted = 0;
    for (let i = 0; i < values.length; i++) {
      const original = values[i][0] || '';
      const updated = updatedValues[i][0] || '';
      if (original !== updated && updated.includes('http')) {
        converted++;
      }
    }
    
    console.log(`✅ Successfully converted ${converted} entries to direct URLs`);
    
    return {
      success: true,
      processed: values.length,
      converted: converted,
      message: `Converted ${converted} entries to direct URLs in Google Sheets`
    };

  } catch (error) {
    console.error('❌ Error converting images in Google Sheets:', error);
    return {
      success: false,
      error: error.message
    };
  }
}