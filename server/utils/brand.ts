import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export type Brand = 'dermasense' | 'beautycology';

const brandSchema = z.enum(['dermasense', 'beautycology']);

/**
 * Brand resolver utilities for multi-tenant support
 */
export class BrandResolver {
  /**
   * Resolve brand from various sources (secure order)
   */
  static resolveBrand(req: Request): Brand {
    // 1. Check hostname first (most secure)
    const hostname = (req.hostname || req.get('host') || '').toLowerCase();
    if (hostname.includes('beautycology')) {
      return 'beautycology';
    }
    if (hostname.includes('dermasense') || hostname.includes('ai-dermasense') || hostname.includes('aidermasense')) {
      return 'dermasense';
    }

    // 2. Check referer for brand hints
    const referer = (req.get('referer') || '').toLowerCase();
    if (referer.includes('brand=beautycology')) {
      return 'beautycology';
    }
    if (referer.includes('brand=dermasense')) {
      return 'dermasense';
    }

    // 3. Check query parameter
    if (req.query.brand) {
      const result = brandSchema.safeParse(req.query.brand);
      if (result.success) {
        return result.data;
      }
    }

    // 4. Check request body for POST requests (only for localhost/dev)
    if (req.method !== 'GET' && req.body?.brand && 
        (hostname.includes('localhost') || hostname.includes('127.0.0.1') || hostname.startsWith('replit'))) {
      const result = brandSchema.safeParse(req.body.brand);
      if (result.success) {
        return result.data;
      }
    }

    // 5. Default to dermasense
    return 'dermasense';
  }

  /**
   * Express middleware to attach brand to request
   */
  static attachBrand(req: Request, res: Response, next: NextFunction): void {
    (req as any).brand = BrandResolver.resolveBrand(req);
    next();
  }
}

// Extend Request interface to include brand
declare global {
  namespace Express {
    interface Request {
      brand: Brand;
    }
  }
}

/**
 * Validate brand parameter for API routes
 */
export function validateBrandParam(brand: string): Brand {
  const result = brandSchema.safeParse(brand);
  if (!result.success) {
    throw new Error(`Invalid brand parameter: ${brand}. Must be 'dermasense' or 'beautycology'`);
  }
  return result.data;
}