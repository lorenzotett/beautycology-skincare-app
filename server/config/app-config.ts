// Configuration system for separating Beautycology AI vs AI-DermaSense

export type AppType = 'dermasense' | 'beautycology';

export interface AppConfig {
  appType: AppType;
  branding: {
    name: string;
    assistantName: string;
    domain: string;
    colors: {
      primary: string;
      secondary: string;
      accent: string;
    };
  };
  ai: {
    systemRole: string;
    specialization: string;
    knowledgeBase: string[];
  };
  database: {
    tablePrefix: string;
  };
  integrations: {
    productCatalog?: string;
    externalSite?: string;
  };
}

const APP_CONFIGS: Record<AppType, AppConfig> = {
  dermasense: {
    appType: 'dermasense',
    branding: {
      name: 'AI-DermaSense',
      assistantName: 'Bonnie',
      domain: 'aidermasense.com',
      colors: {
        primary: 'hsl(214, 84%, 56%)',
        secondary: 'hsl(0, 0%, 96%)',
        accent: 'hsl(214, 84%, 56%)'
      }
    },
    ai: {
      systemRole: 'dermatological consultant',
      specialization: 'medical skin care analysis',
      knowledgeBase: ['dermatology', 'skin conditions', 'ingredients mapping']
    },
    database: {
      tablePrefix: 'dermasense_'
    },
    integrations: {}
  },
  
  beautycology: {
    appType: 'beautycology',
    branding: {
      name: 'Beautycology AI',
      assistantName: 'Bella',
      domain: 'beautycology.ai',
      colors: {
        primary: 'hsl(340, 82%, 55%)',
        secondary: 'hsl(340, 25%, 92%)',
        accent: 'hsl(340, 82%, 67%)'
      }
    },
    ai: {
      systemRole: 'beauty products consultant',
      specialization: 'beauty product recommendations',
      knowledgeBase: ['beauty products', 'skincare routines', 'cosmetics']
    },
    database: {
      tablePrefix: 'beautycology_'
    },
    integrations: {
      productCatalog: 'beautycology.it/api/products',
      externalSite: 'https://beautycology.it'
    }
  }
};

export function getAppConfig(): AppConfig {
  // Determine app type from environment variable
  const appType = (process.env.APP_TYPE as AppType) || 'dermasense';
  
  if (!APP_CONFIGS[appType]) {
    throw new Error(`Invalid APP_TYPE: ${appType}. Must be 'dermasense' or 'beautycology'`);
  }
  
  return APP_CONFIGS[appType];
}

export function getCurrentAppType(): AppType {
  return getAppConfig().appType;
}

export function isDermaSense(): boolean {
  return getCurrentAppType() === 'dermasense';
}

export function isBeautycology(): boolean {
  return getCurrentAppType() === 'beautycology';
}

// Helper to get app-specific table names
export function getTableName(baseTable: string): string {
  const config = getAppConfig();
  return `${config.database.tablePrefix}${baseTable}`;
}