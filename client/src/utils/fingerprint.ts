
// Browser fingerprinting utility to generate unique user identifiers
export interface FingerprintData {
  userAgent: string;
  language: string;
  platform: string;
  screenResolution: string;
  timezone: string;
  colorDepth: number;
  cookieEnabled: boolean;
  localStorageEnabled: boolean;
  sessionStorageEnabled: boolean;
  indexedDBEnabled: boolean;
  webGLVendor: string;
  webGLRenderer: string;
  touchSupport: boolean;
  hardwareConcurrency: number;
  deviceMemory?: number;
  connection?: string;
}

export class BrowserFingerprint {
  private static async getWebGLInfo(): Promise<{ vendor: string; renderer: string }> {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) {
        return { vendor: 'unknown', renderer: 'unknown' };
      }
      
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (!debugInfo) {
        return { vendor: 'unknown', renderer: 'unknown' };
      }
      
      return {
        vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'unknown',
        renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'unknown'
      };
    } catch {
      return { vendor: 'unknown', renderer: 'unknown' };
    }
  }

  private static testLocalStorage(): boolean {
    try {
      const test = 'localStorage-test';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  private static testSessionStorage(): boolean {
    try {
      const test = 'sessionStorage-test';
      sessionStorage.setItem(test, test);
      sessionStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  private static testIndexedDB(): boolean {
    try {
      return !!window.indexedDB;
    } catch {
      return false;
    }
  }

  public static async generateFingerprint(): Promise<string> {
    const webglInfo = await this.getWebGLInfo();
    
    const data: FingerprintData = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenResolution: `${screen.width}x${screen.height}x${screen.colorDepth}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      colorDepth: screen.colorDepth,
      cookieEnabled: navigator.cookieEnabled,
      localStorageEnabled: this.testLocalStorage(),
      sessionStorageEnabled: this.testSessionStorage(),
      indexedDBEnabled: this.testIndexedDB(),
      webGLVendor: webglInfo.vendor,
      webGLRenderer: webglInfo.renderer,
      touchSupport: 'ontouchstart' in window,
      hardwareConcurrency: navigator.hardwareConcurrency || 0,
    };

    // Add optional properties if available
    if ('deviceMemory' in navigator) {
      data.deviceMemory = (navigator as any).deviceMemory;
    }

    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      data.connection = connection?.effectiveType || 'unknown';
    }

    // Convert to deterministic string and hash
    const fingerprintString = JSON.stringify(data, Object.keys(data).sort());
    return await this.hashString(fingerprintString);
  }

  private static async hashString(str: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  public static getStoredFingerprint(): string | null {
    try {
      return localStorage.getItem('user-fingerprint');
    } catch {
      return null;
    }
  }

  public static storeFingerprint(fingerprint: string): void {
    try {
      localStorage.setItem('user-fingerprint', fingerprint);
    } catch {
      // Fallback: store in memory (less persistent but better than nothing)
      (window as any).__userFingerprint = fingerprint;
    }
  }

  public static async getOrCreateFingerprint(): Promise<string> {
    let fingerprint = this.getStoredFingerprint();
    
    if (!fingerprint) {
      // Try memory fallback
      fingerprint = (window as any).__userFingerprint;
    }
    
    if (!fingerprint) {
      fingerprint = await this.generateFingerprint();
      this.storeFingerprint(fingerprint);
    }
    
    return fingerprint;
  }
}
