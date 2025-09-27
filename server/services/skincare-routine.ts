import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SkinAnalysisResult } from './skin-analysis';

// Type definitions
interface BeautycologyProduct {
  name: string;
  price: string;
  description: string;
  url: string;
  image: string;
  category: string;
  ingredients?: string[];
}

interface BeautycologyKnowledge {
  products: BeautycologyProduct[];
}

interface RoutineProduct {
  name: string;
  price: string;
  url: string;
  image?: string;
  category: string;
  scientificExplanation: string;
  keyIngredients: string[];
  targetedConcerns: string[];
  applicationOrder: number;
}

interface PersonalizedRoutine {
  morningSteps: RoutineProduct[];
  eveningSteps: RoutineProduct[];
  skinConcerns: string[];
  skinType: string;
  recommendations: string;
  totalProducts: number;
  estimatedTotalCost: number;
}

export class SkincareRoutineService {
  private beautycologyData: BeautycologyKnowledge = { products: [] };
  
  // Mapping of product categories to routine steps
  private readonly ROUTINE_ORDER = {
    morning: ['Detergenti', 'Sieri', 'Creme', 'Altri Prodotti'],
    evening: ['Detergenti', 'Esfolianti', 'Sieri', 'Altri Prodotti', 'Creme']
  };

  // Ingredient-to-concern mapping based on dermatological knowledge
  private readonly INGREDIENT_BENEFITS: Record<string, { concerns: string[], benefits: string }> = {
    'Niacinamide': {
      concerns: ['pigmentazione', 'oleosita', 'pori_dilatati', 'rossori', 'acne'],
      benefits: 'Regola la produzione di sebo, uniforma il tono della pelle, riduce pori dilatati e macchie'
    },
    'Acido Azelaico': {
      concerns: ['acne', 'rossori', 'pigmentazione', 'texture_uniforme'],
      benefits: 'Antibatterico, anti-infiammatorio, schiarisce le macchie e uniforma la texture'
    },
    'Retinaldeide': {
      concerns: ['rughe', 'elasticita', 'texture_uniforme', 'pigmentazione'],
      benefits: 'Stimola il rinnovamento cellulare, aumenta la produzione di collagene, migliora texture e tono'
    },
    'Retinol': {
      concerns: ['rughe', 'elasticita', 'texture_uniforme', 'pigmentazione'],
      benefits: 'Anti-aging potente, riduce rughe e migliora l\'elasticità cutanea'
    },
    'Vitamina C': {
      concerns: ['pigmentazione', 'danni_solari', 'elasticita', 'rughe'],
      benefits: 'Antiossidante, schiarisce macchie, stimola collagene, protegge dai radicali liberi'
    },
    'Acido Ascorbico': {
      concerns: ['pigmentazione', 'danni_solari', 'elasticita', 'rughe'],
      benefits: 'Forma pura di vitamina C, potente antiossidante e schiarente'
    },
    'Acido Ialuronico': {
      concerns: ['idratazione', 'rughe', 'elasticita'],
      benefits: 'Idratazione profonda, rimpolpa la pelle, riduce le rughe da disidratazione'
    },
    'Acido Lattobionico': {
      concerns: ['idratazione', 'texture_uniforme', 'rossori'],
      benefits: 'PHA delicato, esfolia gentilmente idratando e lenendo la pelle sensibile'
    },
    'Acido Salicilico': {
      concerns: ['acne', 'pori_dilatati', 'oleosita'],
      benefits: 'BHA che penetra nei pori, riduce acne e punti neri, regola il sebo'
    },
    'Acido Mandelico': {
      concerns: ['pigmentazione', 'texture_uniforme', 'acne'],
      benefits: 'AHA delicato, esfolia uniformando il tono e riducendo imperfezioni'
    },
    'Ceramidi': {
      concerns: ['idratazione', 'rossori', 'elasticita'],
      benefits: 'Ripristina la barriera cutanea, mantiene l\'idratazione, protegge da irritazioni'
    },
    'Peptidi': {
      concerns: ['rughe', 'elasticita', 'texture_uniforme'],
      benefits: 'Stimolano collagene ed elastina, migliorano compattezza e texture'
    },
    'Urea': {
      concerns: ['idratazione', 'texture_uniforme'],
      benefits: 'Idratante ed esfoliante delicato, migliora la texture della pelle secca'
    },
    'Pantenolo': {
      concerns: ['rossori', 'idratazione'],
      benefits: 'Lenitivo e riparatore, calma irritazioni e mantiene l\'idratazione'
    },
    'SPF': {
      concerns: ['danni_solari', 'pigmentazione', 'rughe'],
      benefits: 'Protezione UV essenziale per prevenire fotoinvecchiamento e macchie'
    }
  };

  // Skin type compatibility
  private readonly SKIN_TYPE_CATEGORIES: Record<string, string[]> = {
    'secca': ['Creme', 'Sieri', 'Altri Prodotti', 'Corpo'],
    'grassa': ['Sieri', 'Esfolianti', 'Altri Prodotti', 'Detergenti'],
    'mista': ['Sieri', 'Creme', 'Altri Prodotti', 'Detergenti', 'Esfolianti'],
    'sensibile': ['Altri Prodotti', 'Creme', 'Detergenti'],
    'normale': ['Sieri', 'Creme', 'Altri Prodotti', 'Detergenti', 'Esfolianti', 'Corpo']
  };

  constructor() {
    this.loadBeautycologyData();
  }

  /**
   * Prepare USER_ANALYSIS object from skin analysis results
   * This method formats the skin analysis data for the advanced routine generator
   */
  public prepareUserAnalysisFromSkinData(
    skinAnalysisResults: SkinAnalysisResult,
    skinType?: string,
    userName?: string,
    additionalPreferences?: string[]
  ): {
    skin_type_detected: string;
    concerns_detected: string[];
    preferences: string[];
  } {
    // Detect skin type from analysis or use provided
    let detectedSkinType = skinType || 'normale';
    
    // Auto-detect skin type if not provided
    if (!skinType) {
      if (skinAnalysisResults.oleosita > 60) {
        detectedSkinType = 'grassa';
      } else if (skinAnalysisResults.idratazione < 30) {
        detectedSkinType = 'secca';
      } else if (skinAnalysisResults.rossori > 50) {
        detectedSkinType = 'sensibile';
      } else if (skinAnalysisResults.oleosita > 40 && skinAnalysisResults.idratazione < 50) {
        detectedSkinType = 'mista';
      }
    }

    // Extract concerns from analysis (scores > 30 indicate significant issues)
    const concerns: string[] = [];
    
    if (skinAnalysisResults.acne > 30) concerns.push('acne');
    if (skinAnalysisResults.rughe > 30) concerns.push('rughe');
    if (skinAnalysisResults.pigmentazione > 30) concerns.push('macchie');
    if (skinAnalysisResults.rossori > 30) concerns.push('rossori');
    if (skinAnalysisResults.pori_dilatati > 30) concerns.push('pori_dilatati');
    if (skinAnalysisResults.texture_uniforme > 30) concerns.push('texture_irregolare');
    if (skinAnalysisResults.oleosita > 50) concerns.push('oleosità');
    if (skinAnalysisResults.idratazione < 40) concerns.push('secchezza');
    if (skinAnalysisResults.elasticita < 40) concerns.push('perdita_elasticità');
    if (skinAnalysisResults.danni_solari > 30) concerns.push('danni_solari');
    
    // If no significant concerns, add based on skin type
    if (concerns.length === 0) {
      if (detectedSkinType === 'grassa') {
        concerns.push('oleosità', 'pori_dilatati');
      } else if (detectedSkinType === 'secca') {
        concerns.push('secchezza', 'idratazione');
      } else if (detectedSkinType === 'sensibile') {
        concerns.push('rossori', 'sensibilità');
      } else if (detectedSkinType === 'mista') {
        concerns.push('zona_T_grassa', 'guance_secche');
      } else {
        concerns.push('mantenimento', 'prevenzione');
      }
    }

    // Prepare preferences
    const preferences: string[] = [];
    
    if (userName) {
      preferences.push(`name:${userName}`);
    }
    
    // Add skin-specific preferences
    if (detectedSkinType === 'sensibile' || skinAnalysisResults.rossori > 40) {
      preferences.push('prefer_gentle_products');
      preferences.push('dermatologically_tested');
      preferences.push('fragrance_free');
    }
    
    if (skinAnalysisResults.acne > 40) {
      preferences.push('non_comedogenic');
    }
    
    // Add any additional preferences provided
    if (additionalPreferences) {
      preferences.push(...additionalPreferences);
    }

    return {
      skin_type_detected: detectedSkinType,
      concerns_detected: concerns,
      preferences: preferences
    };
  }

  private loadBeautycologyData(): void {
    try {
      // Try to find the file from different working directories
      const possiblePaths = [
        path.join(process.cwd(), 'knowledge-base', 'beautycology.json'),
        path.join(process.cwd(), '..', 'knowledge-base', 'beautycology.json'),
        path.join(process.cwd(), '../..', 'knowledge-base', 'beautycology.json'),
        'knowledge-base/beautycology.json'
      ];
      
      let dataPath = '';
      let rawData = '';
      
      for (const testPath of possiblePaths) {
        try {
          if (fs.existsSync(testPath)) {
            dataPath = testPath;
            rawData = fs.readFileSync(dataPath, 'utf-8');
            break;
          }
        } catch (e) {
          // Continue to next path
        }
      }
      
      if (!rawData) {
        // If not found, try to list directory to debug
        console.log('Current working directory:', process.cwd());
        console.log('Directory contents:', fs.readdirSync(process.cwd()));
        throw new Error('beautycology.json not found in any expected location');
      }
      
      this.beautycologyData = JSON.parse(rawData);
      console.log(`✅ Caricati ${this.beautycologyData.products.length} prodotti Beautycology`);
    } catch (error) {
      console.error('❌ Errore caricamento dati Beautycology:', error);
      this.beautycologyData = { products: [] };
    }
  }

  /**
   * Generate a personalized skincare routine based on skin analysis results
   */
  public generatePersonalizedRoutine(
    skinAnalysis: SkinAnalysisResult, 
    skinType: string = 'normale',
    preferences?: {
      budget?: 'low' | 'medium' | 'high';
      preferNatural?: boolean;
      avoidIngredients?: string[];
    }
  ): PersonalizedRoutine {
    
    // 1. Identify top skin concerns (parameters with highest scores)
    const topConcerns = this.identifyTopConcerns(skinAnalysis);
    console.log('🎯 Principali problematiche identificate:', topConcerns);

    // 2. Find suitable products for these concerns
    const suitableProducts = this.findSuitableProducts(topConcerns, skinType, preferences);
    console.log(`🔍 Trovati ${suitableProducts.length} prodotti adatti`);

    // 3. Create morning and evening routines
    const morningSteps = this.createMorningRoutine(suitableProducts, topConcerns, skinType);
    const eveningSteps = this.createEveningRoutine(suitableProducts, topConcerns, skinType);

    // 4. Calculate total cost
    const totalProducts = morningSteps.length + eveningSteps.filter(p => 
      !morningSteps.find(m => m.name === p.name)
    ).length;
    
    const estimatedTotalCost = this.calculateTotalCost([...morningSteps, ...eveningSteps]);

    // 5. Generate personalized recommendations
    const recommendations = this.generateRecommendations(topConcerns, skinType);

    return {
      morningSteps,
      eveningSteps,
      skinConcerns: topConcerns.map(c => this.translateConcern(c.concern)),
      skinType: this.translateSkinType(skinType),
      recommendations,
      totalProducts,
      estimatedTotalCost
    };
  }

  /**
   * Identify the most problematic skin parameters with nuanced scoring
   */
  private identifyTopConcerns(skinAnalysis: SkinAnalysisResult): Array<{concern: string, score: number}> {
    // Use more nuanced thresholds based on score ranges
    const allConcerns = Object.entries(skinAnalysis)
      .map(([key, value]) => ({ concern: key, score: value }))
      .filter(c => {
        // Use different thresholds for different types of concerns
        if (['acne', 'rossori'].includes(c.concern)) {
          return c.score > 25; // Lower threshold for visible issues
        } else if (['rughe', 'elasticita', 'danni_solari'].includes(c.concern)) {
          return c.score > 20; // Even lower for aging concerns
        } else {
          return c.score > 30; // Standard threshold for others
        }
      })
      .sort((a, b) => b.score - a.score);

    // Take top concerns but also include moderate ones for variety
    const primaryConcerns = allConcerns.slice(0, 3); // Top 3 most severe
    const secondaryConcerns = allConcerns.slice(3, 6).filter(c => c.score > 25); // Moderate concerns

    let concerns = [...primaryConcerns, ...secondaryConcerns];

    // Always include hydration and sun protection as basic needs (before final slice)
    if (!concerns.find(c => c.concern === 'idratazione') && skinAnalysis.idratazione > 15) {
      concerns.push({ concern: 'idratazione', score: skinAnalysis.idratazione });
    }
    if (!concerns.find(c => c.concern === 'danni_solari') && skinAnalysis.danni_solari > 15) {
      concerns.push({ concern: 'danni_solari', score: Math.max(skinAnalysis.danni_solari, 25) });
    }

    // Ensure hydration and sun protection are always included by limiting other concerns first
    const hydrationConcern = concerns.find(c => c.concern === 'idratazione');
    const sunProtectionConcern = concerns.find(c => c.concern === 'danni_solari');
    const otherConcerns = concerns.filter(c => !['idratazione', 'danni_solari'].includes(c.concern));
    
    // Limit other concerns to make room for mandatory ones
    const maxOtherConcerns = 6 - (hydrationConcern ? 1 : 0) - (sunProtectionConcern ? 1 : 0);
    const finalOtherConcerns = otherConcerns.slice(0, maxOtherConcerns);
    
    const finalConcerns = [...finalOtherConcerns];
    if (hydrationConcern) finalConcerns.push(hydrationConcern);
    if (sunProtectionConcern) finalConcerns.push(sunProtectionConcern);

    return finalConcerns.slice(0, 6); // Return up to 6 concerns for more personalization
  }

  /**
   * Find products suitable for the identified concerns and skin type with improved variety
   */
  private findSuitableProducts(
    concerns: Array<{concern: string, score: number}>, 
    skinType: string,
    preferences?: any
  ): BeautycologyProduct[] {
    const suitableCategories = this.SKIN_TYPE_CATEGORIES[skinType] || this.SKIN_TYPE_CATEGORIES['normale'];
    
    const scoredProducts = this.beautycologyData.products
      .filter(product => {
        // Filter by skin type category preference
        const categoryMatch = suitableCategories.includes(product.category);
        
        // Filter by preferences if provided
        if (preferences?.avoidIngredients) {
          const hasAvoidedIngredient = preferences.avoidIngredients.some((avoid: string) =>
            product.ingredients?.some(ing => 
              ing.toLowerCase().includes(avoid.toLowerCase())
            )
          );
          if (hasAvoidedIngredient) return false;
        }

        return categoryMatch || this.productAddressesConcerns(product, concerns);
      })
      .map(product => ({
        product,
        score: this.calculateProductScore(product, concerns, skinType)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    // Introduce variety by selecting from different score tiers
    const topTier = scoredProducts.slice(0, 4);      // Top 4 products
    const midTier = scoredProducts.slice(4, 8);      // Next 4 products
    const lowerTier = scoredProducts.slice(8, 12);   // Next 4 products

    // Select products from different tiers for variety
    const selectedProducts: BeautycologyProduct[] = [];
    
    // Always include top 2 products
    selectedProducts.push(...topTier.slice(0, 2).map(item => item.product));
    
    // Add variety from mid and lower tiers
    if (midTier.length > 0) {
      selectedProducts.push(...midTier.slice(0, 2).map(item => item.product));
    }
    if (lowerTier.length > 0) {
      selectedProducts.push(...lowerTier.slice(0, 2).map(item => item.product));
    }
    
    // Fill remaining slots with top tier if needed
    const remainingSlots = 10 - selectedProducts.length;
    if (remainingSlots > 0) {
      const remainingTopTier = topTier.slice(2).map(item => item.product);
      selectedProducts.push(...remainingTopTier.slice(0, remainingSlots));
    }

    return selectedProducts.slice(0, 10);
  }

  /**
   * Check if a product addresses any of the concerns
   */
  private productAddressesConcerns(product: BeautycologyProduct, concerns: Array<{concern: string, score: number}>): boolean {
    const productDesc = product.description.toLowerCase();
    const productIngredients = product.ingredients?.join(' ').toLowerCase() || '';
    
    return concerns.some(concern => {
      const concernKeywords = this.getConcernKeywords(concern.concern);
      return concernKeywords.some(keyword => 
        productDesc.includes(keyword) || productIngredients.includes(keyword)
      );
    });
  }

  /**
   * Calculate how well a product matches the concerns with more nuanced scoring
   */
  private calculateProductScore(product: BeautycologyProduct, concerns: Array<{concern: string, score: number}>, skinType: string): number {
    let score = 0;
    
    // Check ingredient matches with severity-based weighting
    if (product.ingredients) {
      for (const ingredient of product.ingredients) {
        for (const [key, data] of Object.entries(this.INGREDIENT_BENEFITS)) {
          if (ingredient.toLowerCase().includes(key.toLowerCase())) {
            concerns.forEach(concern => {
              if (data.concerns.includes(concern.concern)) {
                // Use more nuanced weighting based on score ranges
                const multiplier = concern.score > 70 ? 3 : 
                                 concern.score > 50 ? 2.5 : 
                                 concern.score > 30 ? 2 : 1.5;
                score += concern.score * multiplier;
              }
            });
          }
        }
      }
    }

    // Check description for concern keywords with varying importance
    const productDesc = product.description.toLowerCase();
    concerns.forEach(concern => {
      const keywords = this.getConcernKeywords(concern.concern);
      keywords.forEach(keyword => {
        if (productDesc.includes(keyword)) {
          // Add variable bonus based on concern priority and severity
          const severityBonus = concern.score > 60 ? concern.score * 1.5 : concern.score;
          score += severityBonus;
        }
      });
    });

    // Bonus for matching skin type category (variable based on skin type)
    if (this.SKIN_TYPE_CATEGORIES[skinType]?.includes(product.category)) {
      const skinTypeBonus = skinType === 'sensibile' ? 35 : 
                           skinType === 'grassa' ? 30 : 
                           skinType === 'secca' ? 25 : 20;
      score += skinTypeBonus;
    }

    // Special bonuses with variation
    if (productDesc.includes('spf') && concerns.find(c => c.concern === 'danni_solari')) {
      const solarConcern = concerns.find(c => c.concern === 'danni_solari');
      score += solarConcern ? Math.min(80, solarConcern.score + 30) : 50;
    }

    // Add small variation factor to prevent identical scoring
    const productNameHash = product.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const variation = (productNameHash % 10) - 5; // Small random-like variation (-5 to +4)
    score += variation;

    return Math.max(0, score);
  }

  /**
   * Create morning routine (max 3-4 products)
   */
  private createMorningRoutine(products: BeautycologyProduct[], concerns: Array<{concern: string, score: number}>, skinType: string): RoutineProduct[] {
    const routine: RoutineProduct[] = [];
    const usedProducts = new Set<string>();
    const usedCategories = new Set<string>();

    // Sort products by their score for better personalization
    const sortedProducts = [...products].sort((a, b) => {
      const scoreA = this.calculateProductScore(a, concerns, skinType);
      const scoreB = this.calculateProductScore(b, concerns, skinType);
      return scoreB - scoreA;
    });

    // 1. Cleanser (optional for morning - prioritize gentle ones)
    const cleanser = sortedProducts.find(p => 
      p.category === 'Detergenti' && 
      !usedProducts.has(p.name) &&
      p.description.toLowerCase().includes('delicato')
    );
    if (cleanser && routine.length < 4) {
      routine.push(this.createRoutineProduct(cleanser, concerns, routine.length + 1));
      usedProducts.add(cleanser.name);
      usedCategories.add('Detergenti');
    }

    // 2. Serum (based on concerns, not specific names)
    const serum = sortedProducts.find(p => 
      p.category === 'Sieri' && 
      !usedProducts.has(p.name)
    );
    if (serum && routine.length < 4) {
      routine.push(this.createRoutineProduct(serum, concerns, routine.length + 1));
      usedProducts.add(serum.name);
      usedCategories.add('Sieri');
    }

    // 3. Treatment or Moisturizer (based on skin needs)
    const treatment = sortedProducts.find(p => 
      (p.category === 'Altri Prodotti' || p.category === 'Creme') &&
      !usedProducts.has(p.name) &&
      !p.description.toLowerCase().includes('spf') &&
      !p.name.toLowerCase().includes('retinal') && // Retinoids for evening only
      !p.name.toLowerCase().includes('esfoliant') // Exfoliants for evening only
    );
    if (treatment && routine.length < 4) {
      routine.push(this.createRoutineProduct(treatment, concerns, routine.length + 1));
      usedProducts.add(treatment.name);
    }

    // 4. SPF (essential for morning)
    const spf = sortedProducts.find(p => 
      p.description.toLowerCase().includes('spf') && 
      !usedProducts.has(p.name)
    );
    if (spf) {
      routine.push(this.createRoutineProduct(spf, concerns, routine.length + 1));
      usedProducts.add(spf.name);
    }

    return routine.slice(0, 4); // Max 4 products for morning
  }

  /**
   * Create evening routine (max 4-5 products)
   */
  private createEveningRoutine(products: BeautycologyProduct[], concerns: Array<{concern: string, score: number}>, skinType: string): RoutineProduct[] {
    const routine: RoutineProduct[] = [];
    const usedProducts = new Set<string>();
    const usedCategories = new Set<string>();

    // Sort products by their score for better personalization
    const sortedProducts = [...products].sort((a, b) => {
      const scoreA = this.calculateProductScore(a, concerns, skinType);
      const scoreB = this.calculateProductScore(b, concerns, skinType);
      return scoreB - scoreA;
    });

    // 1. Cleanser (essential for evening)
    const cleanser = sortedProducts.find(p => 
      p.category === 'Detergenti' && 
      !usedProducts.has(p.name)
    );
    if (cleanser) {
      routine.push(this.createRoutineProduct(cleanser, concerns, routine.length + 1));
      usedProducts.add(cleanser.name);
      usedCategories.add('Detergenti');
    }

    // 2. Exfoliant (2-3 times per week if needed)
    const needsExfoliation = concerns.find(c => 
      ['texture_uniforme', 'pori_dilatati', 'acne'].includes(c.concern)
    );
    if (needsExfoliation) {
      const exfoliant = sortedProducts.find(p => 
        p.category === 'Esfolianti' && 
        !usedProducts.has(p.name)
      );
      if (exfoliant && routine.length < 5) {
        const exfoliantProduct = this.createRoutineProduct(exfoliant, concerns, routine.length + 1);
        exfoliantProduct.scientificExplanation += ' (Utilizzare 2-3 volte a settimana)';
        routine.push(exfoliantProduct);
        usedProducts.add(exfoliant.name);
        usedCategories.add('Esfolianti');
      }
    }

    // 3. Treatment serum (selected based on actual skin concerns)
    const hasRetinoidConcerns = concerns.find(c => 
      ['rughe', 'invecchiamento', 'macchie', 'texture_uniforme'].includes(c.concern)
    );
    
    // Choose treatment based on primary concerns
    const treatmentSerum = sortedProducts.find(p => {
      if (!usedProducts.has(p.name) && 
          (p.category === 'Sieri' || p.category === 'Altri Prodotti')) {
        
        // If aging/wrinkles are a concern, prioritize retinoid products
        if (hasRetinoidConcerns && 
            (p.name.toLowerCase().includes('retinal') || 
             p.description.toLowerCase().includes('retinol'))) {
          return true;
        }
        
        // Otherwise, select based on highest score
        if (!usedCategories.has('Sieri')) {
          return true;
        }
      }
      return false;
    });
    
    if (treatmentSerum && routine.length < 5) {
      routine.push(this.createRoutineProduct(treatmentSerum, concerns, routine.length + 1));
      usedProducts.add(treatmentSerum.name);
      if (treatmentSerum.category === 'Sieri') {
        usedCategories.add('Sieri');
      }
    }

    // 4. Hydrating/repairing product (based on skin needs)
    const needsHydration = concerns.find(c => 
      ['idratazione', 'secchezza', 'sensibilita'].includes(c.concern)
    );
    
    const hydrator = sortedProducts.find(p => 
      (p.category === 'Creme' || p.category === 'Altri Prodotti') &&
      !usedProducts.has(p.name) &&
      !p.description.toLowerCase().includes('spf') && // No SPF for night
      (needsHydration || p.description.toLowerCase().includes('idrat') || 
       p.description.toLowerCase().includes('repair') ||
       p.description.toLowerCase().includes('nutrient'))
    );
    
    if (hydrator && routine.length < 5) {
      routine.push(this.createRoutineProduct(hydrator, concerns, routine.length + 1));
      usedProducts.add(hydrator.name);
    }

    // 5. Night cream (if not already added)
    if (routine.length < 5 && !usedCategories.has('Creme')) {
      const nightCream = sortedProducts.find(p => 
        p.category === 'Creme' &&
        !usedProducts.has(p.name) &&
        !p.description.toLowerCase().includes('spf')
      );
      if (nightCream) {
        routine.push(this.createRoutineProduct(nightCream, concerns, routine.length + 1));
        usedProducts.add(nightCream.name);
      }
    }

    return routine.slice(0, 5); // Max 5 products for evening
  }

  /**
   * Create a routine product with detailed explanation
   */
  private createRoutineProduct(
    product: BeautycologyProduct, 
    concerns: Array<{concern: string, score: number}>,
    order: number
  ): RoutineProduct {
    const targetedConcerns = this.identifyTargetedConcerns(product, concerns);
    const keyIngredients = this.extractKeyIngredients(product);
    const scientificExplanation = this.generateScientificExplanation(product, targetedConcerns, keyIngredients);

    return {
      name: product.name,
      price: product.price,
      url: product.url,
      image: product.image,
      category: product.category,
      scientificExplanation,
      keyIngredients,
      targetedConcerns: targetedConcerns.map(c => this.translateConcern(c)),
      applicationOrder: order
    };
  }

  /**
   * Identify which concerns a product targets
   */
  private identifyTargetedConcerns(product: BeautycologyProduct, concerns: Array<{concern: string, score: number}>): string[] {
    const targeted: string[] = [];
    const productDesc = product.description.toLowerCase();
    const productIngredients = product.ingredients?.join(' ').toLowerCase() || '';

    concerns.forEach(concern => {
      const keywords = this.getConcernKeywords(concern.concern);
      const hasKeyword = keywords.some(keyword => 
        productDesc.includes(keyword) || productIngredients.includes(keyword)
      );

      // Check if ingredients target this concern
      const hasTargetingIngredient = product.ingredients?.some(ing => {
        for (const [key, data] of Object.entries(this.INGREDIENT_BENEFITS)) {
          if (ing.toLowerCase().includes(key.toLowerCase()) && 
              data.concerns.includes(concern.concern)) {
            return true;
          }
        }
        return false;
      });

      if (hasKeyword || hasTargetingIngredient) {
        targeted.push(concern.concern);
      }
    });

    return targeted;
  }

  /**
   * Extract key ingredients from product
   */
  private extractKeyIngredients(product: BeautycologyProduct): string[] {
    const keyIngredients: string[] = [];
    
    // Extract from ingredients list if available
    if (product.ingredients) {
      product.ingredients.forEach(ing => {
        const matchedBenefit = Object.keys(this.INGREDIENT_BENEFITS).find(key =>
          ing.toLowerCase().includes(key.toLowerCase())
        );
        if (matchedBenefit) {
          keyIngredients.push(`${ing} - ${this.INGREDIENT_BENEFITS[matchedBenefit].benefits}`);
        }
      });
    }

    // Also extract percentages from description
    const percentageMatches = product.description.match(/\w+\s+(?:al\s+)?(\d+(?:,\d+)?%)/gi);
    if (percentageMatches) {
      percentageMatches.forEach(match => {
        if (!keyIngredients.some(ing => ing.includes(match))) {
          keyIngredients.push(match);
        }
      });
    }

    return keyIngredients.slice(0, 5); // Return top 5 ingredients
  }

  /**
   * Generate scientific explanation for product benefits
   */
  private generateScientificExplanation(
    product: BeautycologyProduct, 
    targetedConcerns: string[],
    keyIngredients: string[]
  ): string {
    let explanation = `${product.name} è stato selezionato per la tua routine perché:\n\n`;
    
    // Explain how it addresses concerns
    if (targetedConcerns.length > 0) {
      explanation += `🎯 AZIONE MIRATA:\n`;
      targetedConcerns.forEach(concern => {
        const concernExplanation = this.getConcernExplanation(concern, product);
        explanation += `• ${this.translateConcern(concern)}: ${concernExplanation}\n`;
      });
    }

    // Add ingredient science
    if (keyIngredients.length > 0) {
      explanation += `\n🧪 PRINCIPI ATTIVI:\n`;
      keyIngredients.forEach(ing => {
        explanation += `• ${ing}\n`;
      });
    }

    // Add usage instructions from description
    if (product.description.includes('Dermatologicamente Testato')) {
      explanation += `\n✅ Dermatologicamente testato su pelli sensibili`;
    }
    if (product.description.includes('Nickel Tested')) {
      explanation += `\n✅ Nickel tested <1 PPM`;
    }

    return explanation;
  }

  /**
   * Get keywords associated with a skin concern
   */
  private getConcernKeywords(concern: string): string[] {
    const keywords: Record<string, string[]> = {
      'rossori': ['rossori', 'arrossamenti', 'sensibil', 'lenitiv', 'calma'],
      'acne': ['acne', 'imperfezion', 'brufol', 'comedoni', 'antibatteri', 'purificant'],
      'rughe': ['rughe', 'anti-age', 'antiage', 'anti age', 'lifting', 'rassodant'],
      'pigmentazione': ['macchi', 'discrom', 'pigment', 'schiarent', 'uniforma'],
      'pori_dilatati': ['pori', 'dilatat', 'texture', 'affina', 'minimizza'],
      'oleosita': ['oleos', 'sebo', 'lucid', 'opacizz', 'matt', 'purificant'],
      'danni_solari': ['solar', 'spf', 'uva', 'uvb', 'protezione', 'fotoinvecchiamento'],
      'occhiaie': ['occhiai', 'contorno occhi', 'borse', 'gonfiori'],
      'idratazione': ['idrat', 'secch', 'nutrient', 'emolliente', 'barrier'],
      'elasticita': ['elastic', 'compact', 'tonic', 'rassod', 'rilassament'],
      'texture_uniforme': ['texture', 'grana', 'leviga', 'uniform', 'lisci']
    };
    
    return keywords[concern] || [];
  }

  /**
   * Get explanation for how product addresses a concern
   */
  private getConcernExplanation(concern: string, product: BeautycologyProduct): string {
    const explanations: Record<string, string> = {
      'rossori': 'Lenisce e calma la pelle irritata, riducendo rossori e infiammazioni',
      'acne': 'Azione antibatterica e purificante che previene e tratta le imperfezioni',
      'rughe': 'Stimola il rinnovamento cellulare e la produzione di collagene per ridurre i segni del tempo',
      'pigmentazione': 'Uniforma il tono della pelle e schiarisce progressivamente le macchie',
      'pori_dilatati': 'Affina la grana della pelle e minimizza la visibilità dei pori',
      'oleosita': 'Regola la produzione di sebo mantenendo la pelle opaca e pulita',
      'danni_solari': 'Protegge dai raggi UV prevenendo ulteriori danni e fotoinvecchiamento',
      'occhiaie': 'Decongestionante e schiarente per il contorno occhi',
      'idratazione': 'Ripristina e mantiene l\'idratazione ottimale della pelle',
      'elasticita': 'Migliora tono e compattezza cutanea',
      'texture_uniforme': 'Leviga e uniforma la superficie cutanea'
    };
    
    // Check if product has specific action mentioned in description
    const productDesc = product.description.toLowerCase();
    if (productDesc.includes('esfoliant')) {
      return explanations[concern] + ' attraverso un\'azione esfoliante delicata';
    }
    
    return explanations[concern] || 'Aiuta a migliorare questa condizione cutanea';
  }

  /**
   * Translate concern to Italian
   */
  private translateConcern(concern: string): string {
    const translations: Record<string, string> = {
      'rossori': 'Rossori e sensibilità',
      'acne': 'Acne e imperfezioni',
      'rughe': 'Rughe e segni del tempo',
      'pigmentazione': 'Macchie e discromie',
      'pori_dilatati': 'Pori dilatati',
      'oleosita': 'Pelle grassa',
      'danni_solari': 'Danni solari',
      'occhiaie': 'Occhiaie',
      'idratazione': 'Disidratazione',
      'elasticita': 'Perdita di elasticità',
      'texture_uniforme': 'Texture irregolare'
    };
    
    return translations[concern] || concern;
  }

  /**
   * Translate skin type to Italian
   */
  private translateSkinType(skinType: string): string {
    const translations: Record<string, string> = {
      'secca': 'Pelle Secca',
      'grassa': 'Pelle Grassa',
      'mista': 'Pelle Mista',
      'sensibile': 'Pelle Sensibile',
      'normale': 'Pelle Normale'
    };
    
    return translations[skinType] || 'Pelle Normale';
  }

  /**
   * Calculate total cost of routine
   */
  private calculateTotalCost(products: RoutineProduct[]): number {
    const uniqueProducts = new Map<string, number>();
    
    products.forEach(product => {
      if (!uniqueProducts.has(product.name)) {
        const price = parseFloat(product.price.replace('€', '').replace(',', '.'));
        uniqueProducts.set(product.name, price);
      }
    });
    
    return Array.from(uniqueProducts.values()).reduce((sum, price) => sum + price, 0);
  }

  /**
   * Generate personalized recommendations
   */
  private generateRecommendations(concerns: Array<{concern: string, score: number}>, skinType: string): string {
    let recommendations = '📋 CONSIGLI PERSONALIZZATI:\n\n';
    
    // Priority concern advice
    const topConcern = concerns[0];
    if (topConcern) {
      recommendations += `⚡ PRIORITÀ: ${this.translateConcern(topConcern.concern)}\n`;
      recommendations += `Focus principale della routine con prodotti mirati e costanza nell'applicazione.\n\n`;
    }
    
    // Skin type specific advice
    const skinTypeAdvice: Record<string, string> = {
      'secca': 'Privilegia texture ricche e nutrienti. Evita detergenti aggressivi.',
      'grassa': 'Usa texture leggere e oil-free. Non saltare mai l\'idratazione.',
      'mista': 'Applica prodotti diversi per zona T e guance secondo necessità.',
      'sensibile': 'Introduci un prodotto nuovo alla volta. Fai sempre patch test.',
      'normale': 'Mantieni l\'equilibrio con una routine costante e bilanciata.'
    };
    
    recommendations += `💡 TIPO DI PELLE: ${skinTypeAdvice[skinType] || skinTypeAdvice['normale']}\n\n`;
    
    // General best practices
    recommendations += `✨ BEST PRACTICES:\n`;
    recommendations += `• Applica sempre i prodotti dal più fluido al più denso\n`;
    recommendations += `• Aspetta 30-60 secondi tra un prodotto e l'altro\n`;
    recommendations += `• SPF ogni mattina, anche in inverno\n`;
    recommendations += `• Introduci prodotti attivi gradualmente\n`;
    recommendations += `• Sii costante: i risultati si vedono dopo 4-8 settimane\n`;
    
    // Specific concern tips
    if (concerns.find(c => c.concern === 'acne' && c.score > 50)) {
      recommendations += `\n⚠️ ACNE: Non schiacciare i brufoli. Cambia federa frequentemente.\n`;
    }
    if (concerns.find(c => c.concern === 'rughe' && c.score > 50)) {
      recommendations += `\n⚠️ ANTI-AGE: Massaggia i prodotti con movimenti verso l'alto.\n`;
    }
    if (concerns.find(c => c.concern === 'rossori' && c.score > 50)) {
      recommendations += `\n⚠️ SENSIBILITÀ: Evita acqua troppo calda e sfregamenti.\n`;
    }
    
    return recommendations;
  }
}

// Export the service class
export default SkincareRoutineService;