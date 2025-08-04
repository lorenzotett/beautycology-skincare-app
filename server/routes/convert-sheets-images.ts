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

    // Convert URLs to IMAGE formulas
    const updatedValues = values.map((row, index) => {
      const cellValue = row[0] || '';
      
      // Skip if already a formula or empty
      if (cellValue.startsWith('=IMAGE(') || !cellValue || cellValue === 'Nessuna immagine' || cellValue === 'Immagini') {
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
        
        // Create IMAGE formula
        const imageFormula = `=IMAGE("${finalUrl}",4,80,80)`;
        console.log(`Row ${index + 1}: Converting URL to formula`);
        return [imageFormula];
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

    const converted = updatedValues.filter(row => row[0].startsWith('=IMAGE(')).length;
    console.log(`✅ Successfully converted ${converted} URLs to IMAGE formulas`);
    
    return {
      success: true,
      processed: values.length,
      converted: converted,
      message: `Converted ${converted} URLs to IMAGE formulas in Google Sheets`
    };

  } catch (error) {
    console.error('❌ Error converting images in Google Sheets:', error);
    return {
      success: false,
      error: error.message
    };
  }
}