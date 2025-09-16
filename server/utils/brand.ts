import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export type Brand = 'dermasense' | 'beautycology';

const brandSchema = z.enum(['dermasense', 'beautycology']);

/**
 * Brand resolver utilities for multi-tenant support
 */
export class BrandResolver {
  /**
   * Resolve brand from various sources
   */
  static resolveBrand(req: Request): Brand {
    // 1. Check query parameter first
    if (req.query.brand) {
      const result = brandSchema.safeParse(req.query.brand);
      if (result.success) {
        return result.data;
      }
    }

    // 2. Check hostname
    const hostname = (req.hostname || req.get('host') || '').toLowerCase();
    if (hostname.includes('beautycology')) {
      return 'beautycology';
    }
    if (hostname.includes('dermasense') || hostname.includes('ai-dermasense') || hostname.includes('aidermasense')) {
      return 'dermasense';
    }

    // 3. Check referer as fallback
    const referer = (req.get('referer') || '').toLowerCase();
    if (referer.includes('beautycology')) {
      return 'beautycology';
    }
    if (referer.includes('dermasense') || referer.includes('ai-dermasense') || referer.includes('aidermasense')) {
      return 'dermasense';
    }

    // 4. Default to dermasense
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