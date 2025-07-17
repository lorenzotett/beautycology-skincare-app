export interface IntegrationConfig {
  googleSheets: {
    enabled: boolean;
    credentials: any | null;
    spreadsheetId: string | null;
  };
  klaviyo: {
    enabled: boolean;
    apiKey: string | null;
    listId: string | null;
  };
}

export function loadIntegrationConfig(): IntegrationConfig {
  const config: IntegrationConfig = {
    googleSheets: {
      enabled: false,
      credentials: null,
      spreadsheetId: null,
    },
    klaviyo: {
      enabled: false,
      apiKey: null,
      listId: null,
    },
  };

  // Load Google Sheets configuration
  if (process.env.GOOGLE_SHEETS_CREDENTIALS && process.env.GOOGLE_SHEETS_ID) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);
      if (credentials.client_email && credentials.private_key) {
        config.googleSheets.enabled = true;
        config.googleSheets.credentials = credentials;
        config.googleSheets.spreadsheetId = process.env.GOOGLE_SHEETS_ID;
        console.log('✅ Google Sheets integration configured successfully');
      } else {
        console.warn('⚠️ Google Sheets credentials missing client_email or private_key');
      }
    } catch (error) {
      console.error('❌ Failed to parse Google Sheets credentials:', error);
    }
  } else {
    console.log('⚠️ Google Sheets integration disabled - missing credentials');
  }

  // Load Klaviyo configuration
  if (process.env.KLAVIYO_API_KEY && process.env.KLAVIYO_LIST_ID) {
    config.klaviyo.enabled = true;
    config.klaviyo.apiKey = process.env.KLAVIYO_API_KEY;
    config.klaviyo.listId = process.env.KLAVIYO_LIST_ID;
    console.log('✅ Klaviyo integration configured successfully');
  } else {
    console.log('⚠️ Klaviyo integration disabled - missing credentials');
  }

  return config;
}