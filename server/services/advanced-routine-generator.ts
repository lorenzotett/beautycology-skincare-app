import { GoogleGenAI } from "@google/genai";
import * as fs from 'fs';
import * as path from 'path';

// Type definitions for input data
export interface UserAnalysis {
  skin_type_detected: string;
  concerns_detected: string[];
  preferences?: string[];
}

export interface RAGPassage {
  doc_id: string;
  title: string;
  section: string;
  passage: string;
  brand?: string;
  language?: string;
  product_name?: string;
  ingredients?: string[];
  properties?: string[];
}

export interface RoutineStep {
  step: string;
  product: string;
  why: string;
  how_to_use: string;
  frequency?: string;
  link?: string;
  price?: string;
}

export interface RoutineRecommendations {
  morning: RoutineStep[];
  evening: RoutineStep[];
}

export interface AdvancedRoutineOutput {
  skin_type: string;
  concerns: string[];
  recommendations: RoutineRecommendations;
  alternation_rules: string;
  notes: string;
  confidence: 'alta' | 'media' | 'bassa';
  sources: string[];
}

export class AdvancedRoutineGenerator {
  private ai: GoogleGenAI;
  private selectedProducts: Set<string> = new Set();
  private alternativeCount: number = 0;
  private maxAlternatives: number = 2;
  private productCatalog: Map<string, { price: string; url: string }> = new Map();

  constructor() {
    this.ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ""
    });
    this.loadProductCatalog();
  }

  /**
   * Load product catalog with prices and URLs
   */
  private loadProductCatalog(): void {
    try {
      const possiblePaths = [
        path.join(process.cwd(), 'knowledge-base', 'beautycology.json'),
        path.join(process.cwd(), '..', 'knowledge-base', 'beautycology.json'),
        path.join(process.cwd(), '../..', 'knowledge-base', 'beautycology.json'),
        'knowledge-base/beautycology.json'
      ];
      
      let rawData = '';
      
      for (const testPath of possiblePaths) {
        try {
          if (fs.existsSync(testPath)) {
            rawData = fs.readFileSync(testPath, 'utf-8');
            break;
          }
        } catch (e) {
          // Continue to next path
        }
      }
      
      if (rawData) {
        const data = JSON.parse(rawData);
        data.products?.forEach((product: any) => {
          if (product.name) {
            this.productCatalog.set(product.name.toLowerCase(), {
              price: product.price || '',
              url: product.url || ''
            });
          }
        });
        console.log(`✅ Loaded ${this.productCatalog.size} products from beautycology.json`);
      } else {
        console.warn('⚠️ beautycology.json not found - product links and prices will be unavailable');
      }
    } catch (error) {
      console.error('❌ Error loading product catalog:', error);
    }
  }

  /**
   * Main method to generate personalized skincare routine
   */
  async generateRoutineFromAnalysis(
    userAnalysis: UserAnalysis,
    ragContext: RAGPassage[]
  ): Promise<{ text: string; json: AdvancedRoutineOutput }> {
    try {
      console.log('🧪 Generating advanced routine for:', userAnalysis);
      console.log(`📚 Using ${ragContext.length} RAG passages`);

      // Reset state for new routine generation
      this.selectedProducts.clear();
      this.alternativeCount = 0;

      // Check if we have enough context
      const relevantPassages = this.filterRelevantPassages(ragContext, userAnalysis);
      const confidence = relevantPassages.length >= 5 ? 'alta' : 
                        relevantPassages.length >= 3 ? 'media' : 'bassa';

      // Extract available products from RAG context
      const availableProducts = this.extractProducts(relevantPassages);
      console.log(`🛍️ Found ${availableProducts.length} available products`);

      // Generate routine based on skin type and concerns
      const morningSteps = await this.generateMorningRoutine(
        userAnalysis,
        availableProducts
      );

      const eveningSteps = await this.generateEveningRoutine(
        userAnalysis,
        availableProducts
      );

      // Generate alternation rules for acids and retinoids
      const alternationRules = this.generateAlternationRules(eveningSteps);

      // Generate notes based on skin analysis
      const notes = this.generateNotes(userAnalysis, confidence);

      // Extract sources from relevant passages
      const sources = Array.from(new Set(relevantPassages.map(p => p.title || p.doc_id)));

      // Create the structured output
      const jsonOutput: AdvancedRoutineOutput = {
        skin_type: this.translateSkinType(userAnalysis.skin_type_detected),
        concerns: userAnalysis.concerns_detected.map(c => this.translateConcern(c)),
        recommendations: {
          morning: morningSteps,
          evening: eveningSteps
        },
        alternation_rules: alternationRules,
        notes: notes,
        confidence: confidence,
        sources: sources
      };

      // Generate natural language description
      const textOutput = this.generateNaturalLanguageDescription(jsonOutput, userAnalysis);

      return {
        text: textOutput,
        json: jsonOutput
      };
    } catch (error) {
      console.error('❌ Error generating advanced routine:', error);
      throw error;
    }
  }

  /**
   * Filter RAG passages relevant to user's skin analysis
   */
  private filterRelevantPassages(
    ragContext: RAGPassage[],
    userAnalysis: UserAnalysis
  ): RAGPassage[] {
    return ragContext.filter(passage => {
      const passageText = (passage.passage + ' ' + passage.title + ' ' + passage.section).toLowerCase();
      
      // Check if passage is relevant to skin type
      const skinTypeRelevant = passageText.includes(userAnalysis.skin_type_detected.toLowerCase()) ||
                               passageText.includes('tutti i tipi di pelle') ||
                               passageText.includes('all skin types');

      // Check if passage is relevant to concerns
      const concernRelevant = userAnalysis.concerns_detected.some(concern =>
        passageText.includes(concern.toLowerCase())
      );

      // Check if it's a product passage
      const isProduct = passageText.includes('ingredienti') || 
                       passageText.includes('inci') ||
                       passageText.includes('€') ||
                       passageText.includes('prezzo') ||
                       passage.product_name;

      return skinTypeRelevant || concernRelevant || isProduct;
    });
  }

  /**
   * Extract product information from RAG passages
   */
  private extractProducts(passages: RAGPassage[]): RAGPassage[] {
    const products: RAGPassage[] = [];
    
    for (const passage of passages) {
      // Check if passage contains product information
      if (passage.product_name || 
          passage.passage.includes('€') || 
          passage.passage.includes('INCI') ||
          passage.title?.toLowerCase().includes('prodotto')) {
        
        // Extract product details
        const productInfo = this.extractProductDetails(passage);
        if (productInfo) {
          products.push({
            ...passage,
            ...productInfo
          });
        }
      }
    }
    
    return products;
  }

  /**
   * Extract specific product details from a passage
   */
  private extractProductDetails(passage: RAGPassage): Partial<RAGPassage> | null {
    const text = passage.passage.toLowerCase();
    
    // Extract ingredients if mentioned
    const ingredients: string[] = [];
    const ingredientMatch = text.match(/ingredienti[^:]*:([^.]+)/i);
    if (ingredientMatch) {
      ingredients.push(...ingredientMatch[1].split(',').map(i => i.trim()));
    }
    
    // Extract properties
    const properties: string[] = [];
    if (text.includes('dermatologicamente testato')) properties.push('Dermatologicamente testato');
    if (text.includes('nickel tested')) properties.push('Nickel Tested');
    if (text.includes('senza profumo')) properties.push('Senza profumo');
    if (text.includes('spf')) properties.push('SPF');
    if (text.includes('acido')) properties.push('Esfoliante');
    if (text.includes('retino')) properties.push('Retinoide');
    
    // Extract product name from title or passage
    let productName = passage.product_name;
    if (!productName) {
      // Try to extract from title or first line
      const nameMatch = passage.title?.match(/^([^-–]+)/);
      if (nameMatch) {
        productName = nameMatch[1].trim();
      }
    }
    
    if (productName || ingredients.length > 0 || properties.length > 0) {
      return {
        product_name: productName,
        ingredients: ingredients,
        properties: properties
      };
    }
    
    return null;
  }

  /**
   * Generate morning routine steps
   */
  private async generateMorningRoutine(
    userAnalysis: UserAnalysis,
    availableProducts: RAGPassage[]
  ): Promise<RoutineStep[]> {
    const morningSteps: RoutineStep[] = [];
    const isSensitive = userAnalysis.skin_type_detected.includes('sensibile') || 
                       userAnalysis.concerns_detected.includes('rossori');

    // Step 1: Cleanser
    const cleanser = this.selectProduct(
      availableProducts,
      ['detergente', 'cleanser', 'gel', 'mousse'],
      isSensitive
    );
    
    if (cleanser) {
      const productName = cleanser.product_name || 'Detergente delicato';
      const productInfo = this.productCatalog.get(productName.toLowerCase());
      morningSteps.push({
        step: 'cleanser',
        product: productName,
        why: this.generateWhyText(cleanser, userAnalysis),
        how_to_use: 'Applicare su viso umido, massaggiare delicatamente e risciacquare con acqua tiepida',
        link: productInfo?.url,
        price: productInfo?.price
      });
    }

    // Step 2: Treatment (serum/treatment)
    const treatment = this.selectProduct(
      availableProducts,
      ['siero', 'serum', 'trattamento', 'vitamina c', 'niacinamide'],
      isSensitive,
      cleanser?.product_name // Avoid duplicate
    );
    
    if (treatment) {
      const productName = treatment.product_name || 'Siero trattamento';
      const productInfo = this.productCatalog.get(productName.toLowerCase());
      morningSteps.push({
        step: 'treatment',
        product: productName,
        why: this.generateWhyText(treatment, userAnalysis),
        how_to_use: 'Applicare poche gocce su viso e collo, picchiettare delicatamente fino ad assorbimento',
        link: productInfo?.url,
        price: productInfo?.price
      });
    }

    // Step 3: Eye cream
    const eyeCream = this.selectProduct(
      availableProducts,
      ['contorno occhi', 'eye cream', 'occhi'],
      isSensitive,
      cleanser?.product_name,
      treatment?.product_name
    );
    
    if (eyeCream) {
      const productName = eyeCream.product_name || 'Contorno occhi';
      const productInfo = this.productCatalog.get(productName.toLowerCase());
      morningSteps.push({
        step: 'eye',
        product: productName,
        why: this.generateWhyText(eyeCream, userAnalysis),
        how_to_use: 'Applicare picchiettando delicatamente nella zona perioculare',
        link: productInfo?.url,
        price: productInfo?.price
      });
    }

    // Step 4: Moisturizer
    const moisturizer = this.selectProduct(
      availableProducts,
      ['crema', 'moisturizer', 'idratante', 'emulsione'],
      isSensitive,
      cleanser?.product_name,
      treatment?.product_name,
      eyeCream?.product_name
    );
    
    if (moisturizer) {
      const productName = moisturizer.product_name || 'Crema idratante';
      const productInfo = this.productCatalog.get(productName.toLowerCase());
      morningSteps.push({
        step: 'moisturizer',
        product: productName,
        why: this.generateWhyText(moisturizer, userAnalysis),
        how_to_use: 'Applicare su viso e collo con movimenti circolari verso l\'alto',
        link: productInfo?.url,
        price: productInfo?.price
      });
    }

    // Step 5: SPF (MANDATORY)
    const spf = this.selectProduct(
      availableProducts,
      ['spf', 'protezione solare', 'sun', 'solare'],
      isSensitive,
      cleanser?.product_name,
      treatment?.product_name,
      eyeCream?.product_name,
      moisturizer?.product_name
    );
    
    if (spf) {
      const productName = spf.product_name || 'Protezione SPF 30+';
      const productInfo = this.productCatalog.get(productName.toLowerCase());
      morningSteps.push({
        step: 'spf',
        product: productName,
        why: 'Protezione UV essenziale per prevenire danni solari e invecchiamento precoce',
        how_to_use: 'Applicare generosamente 15 minuti prima dell\'esposizione solare, riapplicare ogni 2 ore',
        link: productInfo?.url,
        price: productInfo?.price
      });
    } else {
      // Always include SPF even if no specific product found
      morningSteps.push({
        step: 'spf',
        product: 'Protezione solare SPF 30+',
        why: 'Protezione essenziale dai raggi UV per prevenire fotoinvecchiamento e macchie',
        how_to_use: 'Applicare generosamente 15 minuti prima dell\'esposizione solare, riapplicare ogni 2 ore'
      });
    }

    return morningSteps;
  }

  /**
   * Generate evening routine steps
   */
  private async generateEveningRoutine(
    userAnalysis: UserAnalysis,
    availableProducts: RAGPassage[]
  ): Promise<RoutineStep[]> {
    const eveningSteps: RoutineStep[] = [];
    const isSensitive = userAnalysis.skin_type_detected.includes('sensibile') || 
                       userAnalysis.concerns_detected.includes('rossori');

    // Step 1: Oil cleanser (double cleansing)
    const oilCleanser = this.selectProduct(
      availableProducts,
      ['olio', 'oil cleanser', 'struccante', 'balm'],
      isSensitive
    );
    
    if (oilCleanser) {
      const productName = oilCleanser.product_name || 'Olio detergente';
      const productInfo = this.productCatalog.get(productName.toLowerCase());
      eveningSteps.push({
        step: 'cleanser/oil',
        product: productName,
        why: this.generateWhyText(oilCleanser, userAnalysis),
        how_to_use: 'Massaggiare su viso asciutto per sciogliere il trucco, emulsionare con acqua e risciacquare',
        link: productInfo?.url,
        price: productInfo?.price
      });
    }

    // Step 2: Foam cleanser
    const foamCleanser = this.selectProduct(
      availableProducts,
      ['gel', 'foam', 'mousse', 'detergente'],
      isSensitive,
      oilCleanser?.product_name
    );
    
    if (foamCleanser) {
      const productName = foamCleanser.product_name || 'Detergente schiumogeno';
      const productInfo = this.productCatalog.get(productName.toLowerCase());
      eveningSteps.push({
        step: 'cleanser/foam',
        product: productName,
        why: this.generateWhyText(foamCleanser, userAnalysis),
        how_to_use: 'Applicare su viso umido dopo il primo detergente, massaggiare e risciacquare',
        link: productInfo?.url,
        price: productInfo?.price
      });
    }

    // Step 3: Exfoliant OR Retinoid (NEVER BOTH)
    const hasAcid = this.selectProduct(
      availableProducts,
      ['acido', 'aha', 'bha', 'esfoliante', 'peeling'],
      isSensitive,
      oilCleanser?.product_name,
      foamCleanser?.product_name
    );
    
    const hasRetinoid = this.selectProduct(
      availableProducts,
      ['retino', 'retinal', 'vitamina a'],
      isSensitive,
      oilCleanser?.product_name,
      foamCleanser?.product_name
    );

    // Choose only one - prioritize based on concerns
    const activeIngredient = userAnalysis.concerns_detected.includes('acne') ? hasAcid :
                            userAnalysis.concerns_detected.includes('rughe') ? hasRetinoid :
                            hasAcid || hasRetinoid;

    if (activeIngredient) {
      const productName = activeIngredient.product_name || 'Trattamento esfoliante/retinoide';
      const productInfo = this.productCatalog.get(productName.toLowerCase());
      eveningSteps.push({
        step: 'exfoliant_or_retinoid (alternate)',
        product: productName,
        why: this.generateWhyText(activeIngredient, userAnalysis),
        how_to_use: 'Applicare su pelle asciutta evitando il contorno occhi',
        frequency: hasAcid && hasRetinoid ? 
          'Alternare: lunedì/mercoledì/venerdì acido, martedì/giovedì retinoide' :
          '2-3 volte a settimana, aumentare gradualmente',
        link: productInfo?.url,
        price: productInfo?.price
      });
    }

    // Step 4: Night moisturizer
    const nightMoisturizer = this.selectProduct(
      availableProducts,
      ['notte', 'night', 'repair', 'rigenerante', 'crema'],
      isSensitive,
      oilCleanser?.product_name,
      foamCleanser?.product_name,
      activeIngredient?.product_name
    );
    
    if (nightMoisturizer) {
      const productName = nightMoisturizer.product_name || 'Crema notte rigenerante';
      const productInfo = this.productCatalog.get(productName.toLowerCase());
      eveningSteps.push({
        step: 'moisturizer',
        product: productName,
        why: this.generateWhyText(nightMoisturizer, userAnalysis),
        how_to_use: 'Applicare generosamente su viso e collo come ultimo step della routine serale',
        link: productInfo?.url,
        price: productInfo?.price
      });
    }

    return eveningSteps;
  }

  /**
   * Select a product based on criteria with improved variation
   */
  private selectProduct(
    products: RAGPassage[],
    keywords: string[],
    prioritizeSensitive: boolean,
    ...excludeProducts: (string | undefined)[]
  ): RAGPassage | null {
    // Check if we've reached the alternative limit
    if (this.alternativeCount >= this.maxAlternatives) {
      return null;
    }

    // Filter products that haven't been selected and match keywords
    let candidates = products.filter(p => {
      const productName = p.product_name || '';
      const passageText = (p.passage + ' ' + p.title).toLowerCase();
      
      // Exclude already selected products
      if (excludeProducts.includes(productName) || this.selectedProducts.has(productName)) {
        return false;
      }
      
      // Check if product matches any keyword
      return keywords.some(keyword => 
        passageText.includes(keyword.toLowerCase()) ||
        productName.toLowerCase().includes(keyword.toLowerCase())
      );
    });

    // Prioritize products for sensitive skin if needed
    if (prioritizeSensitive) {
      const sensitiveProducts = candidates.filter(p => 
        p.properties?.some(prop => 
          prop.includes('Dermatologicamente testato') ||
          prop.includes('Nickel Tested') ||
          prop.includes('Senza profumo')
        )
      );
      
      if (sensitiveProducts.length > 0) {
        candidates = sensitiveProducts;
      }
    }

    // Select product with improved variation logic
    if (candidates.length > 0) {
      let selected: RAGPassage;
      
      if (candidates.length === 1) {
        selected = candidates[0];
      } else if (candidates.length === 2) {
        // For 2 candidates, prefer first but occasionally use second
        const useSecond = this.selectedProducts.size > 0 && this.selectedProducts.size % 3 === 0;
        selected = candidates[useSecond ? 1 : 0];
      } else {
        // For 3+ candidates, use more sophisticated selection
        // Always prefer top candidate for critical steps (first few selections)
        if (this.selectedProducts.size < 2) {
          // For first two critical products, always use the best match
          selected = candidates[0];
        } else {
          // For subsequent products, introduce controlled variation
          const variationFactor = this.selectedProducts.size % 5;
          let selectionIndex = 0; // Default to best candidate
          
          if (variationFactor === 2) {
            selectionIndex = Math.min(1, candidates.length - 1); // Occasionally pick 2nd
          } else if (variationFactor === 4) {
            selectionIndex = Math.min(2, candidates.length - 1); // Rarely pick 3rd
          }
          
          selected = candidates[selectionIndex];
        }
      }
      
      if (selected.product_name) {
        this.selectedProducts.add(selected.product_name);
        
        // Count as alternative if it's a secondary option
        if (this.selectedProducts.size > 5) {
          this.alternativeCount++;
        }
      }
      return selected;
    }

    return null;
  }

  /**
   * Generate detailed scientific explanation for why a product is recommended
   */
  private generateWhyText(product: RAGPassage, userAnalysis: UserAnalysis): string {
    let explanation = '';
    
    // 🧪 SCIENTIFIC INGREDIENTS SECTION
    const scientificIngredients: string[] = [];
    if (product.ingredients) {
      const keyIngredients = product.ingredients.slice(0, 3);
      keyIngredients.forEach(ingredient => {
        // Add scientific mechanism of action for key ingredients
        if (ingredient.toLowerCase().includes('niacinamide')) {
          scientificIngredients.push('Niacinamide (4-5%) regola la produzione di sebo attraverso l\'inibizione dell\'enzima 5α-reduttasi, riducendo pori dilatati e infiammazione');
        } else if (ingredient.toLowerCase().includes('acido azelaico')) {
          scientificIngredients.push('Acido Azelaico (10-20%) agisce con meccanismo antibatterico e cheratolitico, normalizzando la cheratinizzazione follicolare');
        } else if (ingredient.toLowerCase().includes('retinal')) {
          scientificIngredients.push('Retinaldeide si converte in acido retinoico stimolando il turnover cellulare e la sintesi di collagene di tipo I');
        } else if (ingredient.toLowerCase().includes('vitamina c')) {
          scientificIngredients.push('Vitamina C stabilizzata agisce come cofattore della prolil-4-idrossilasi nella sintesi del collagene, con azione antiossidante');
        } else if (ingredient.toLowerCase().includes('acido ialuronico')) {
          scientificIngredients.push('Acido Ialuronico a diversi pesi molecolari mantiene l\'idratazione cutanea legando fino a 1000 volte il suo peso in acqua');
        } else if (ingredient.toLowerCase().includes('ceramidi')) {
          scientificIngredients.push('Ceramidi ripristinano la funzione barriera cutanea riducendo la TEWL (Trans-Epidermal Water Loss)');
        } else {
          scientificIngredients.push(`${ingredient} con proprietà dermato-funzionali specifiche`);
        }
      });
    }

    // 🎯 SPECIFIC PROBLEM TARGETING
    const targetedProblems: string[] = [];
    userAnalysis.concerns_detected.forEach(concern => {
      if (product.passage.toLowerCase().includes(concern.toLowerCase())) {
        switch(concern) {
          case 'acne':
            targetedProblems.push('combatte l\'acne attraverso azione antibatterica e comedolitica');
            break;
          case 'rughe':
            targetedProblems.push('riduce le rughe stimolando la rigenerazione del derma e aumentando lo spessore epidermico');
            break;
          case 'pigmentazione':
          case 'macchie':
            targetedProblems.push('schiarisce le macchie inibendo la tirosinasi e accelerando il turnover cellulare');
            break;
          case 'rossori':
            targetedProblems.push('calma i rossori riducendo l\'infiammazione e rafforzando i capillari superficiali');
            break;
          case 'pori_dilatati':
            targetedProblems.push('minimizza i pori dilatati regolando la produzione sebacea e migliorando l\'elasticità cutanea');
            break;
          case 'oleosita':
            targetedProblems.push('controlla l\'oleosità normalizzando l\'attività delle ghiandole sebacee');
            break;
          case 'secchezza':
          case 'idratazione':
            targetedProblems.push('ripristina l\'idratazione ottimale rinforzando la barriera cutanea');
            break;
          default:
            targetedProblems.push(`tratta efficacemente ${this.translateConcern(concern)}`);
        }
      }
    });

    // 👤 SKIN TYPE COMPATIBILITY  
    let skinTypeExplanation = '';
    if (userAnalysis.skin_type_detected.includes('grassa')) {
      skinTypeExplanation = 'La formula oil-free e non comedogenica è ideale per pelli grasse, con texture leggera che non occlude i pori';
    } else if (userAnalysis.skin_type_detected.includes('secca')) {
      skinTypeExplanation = 'La formula ricca e nutriente compensa la carenza lipidica tipica delle pelli secche, con ingredienti filmogeni protettivi';
    } else if (userAnalysis.skin_type_detected.includes('mista')) {
      skinTypeExplanation = 'La formula equilibrata si adatta alle diverse zone del viso, regolando la zona T senza seccare le guance';
    } else if (userAnalysis.skin_type_detected.includes('sensibile')) {
      skinTypeExplanation = 'Formula ipoallergenica dermatologicamente testata, priva di fragranze e con pH fisiologico per pelli reattive';
    } else {
      skinTypeExplanation = 'Formula bilanciata adatta a mantenere l\'equilibrio fisiologico della pelle normale';
    }

    // Build complete scientific explanation
    if (scientificIngredients.length > 0) {
      explanation += `🧪 **SCIENZA**: ${scientificIngredients[0]}. `;
    }
    
    if (targetedProblems.length > 0) {
      explanation += `🎯 **PERCHÉ PER TE**: ${targetedProblems[0]}. `;
    }
    
    explanation += `👤 **ADATTO ALLA TUA PELLE**: ${skinTypeExplanation}`;

    return explanation || 'Prodotto scientificamente formulato per il tuo tipo di pelle e problematiche specifiche';
  }

  /**
   * Generate alternation rules for acids and retinoids
   */
  private generateAlternationRules(eveningSteps: RoutineStep[]): string {
    const exfoliantStep = eveningSteps.find(s => s.step === 'exfoliant_or_retinoid (alternate)');
    
    if (!exfoliantStep) {
      return 'Nessuna alternanza necessaria';
    }

    if (exfoliantStep.frequency?.includes('Alternare')) {
      return 'Alternare acidi esfolianti e retinoidi: mai nella stessa sera. ' +
             'Lunedì/Mercoledì/Venerdì: acido esfoliante. ' +
             'Martedì/Giovedì: retinoide. ' +
             'Weekend: pausa per far riposare la pelle.';
    }

    return 'Utilizzare il trattamento attivo 2-3 volte a settimana, ' +
           'aumentando gradualmente la frequenza secondo tolleranza cutanea.';
  }

  /**
   * Generate notes based on analysis and confidence
   */
  private generateNotes(userAnalysis: UserAnalysis, confidence: string): string {
    const notes: string[] = [];

    // Add note about confidence level
    if (confidence === 'bassa') {
      notes.push('Routine base consigliata. Si raccomanda consultazione dermatologica per routine personalizzata.');
    } else if (confidence === 'media') {
      notes.push('Routine basata su analisi parziale. Possibili aggiustamenti dopo 2-4 settimane di utilizzo.');
    }

    // Add notes for sensitive skin
    if (userAnalysis.skin_type_detected.includes('sensibile')) {
      notes.push('Introdurre un prodotto alla volta, testare su piccola area prima dell\'uso completo.');
    }

    // Add general skincare tips
    notes.push('Applicare sempre i prodotti dal più leggero al più pesante.');
    notes.push('La costanza è fondamentale: risultati visibili dopo 4-8 settimane.');

    return notes.join(' ');
  }

  /**
   * Generate natural language description of the routine
   */
  private generateNaturalLanguageDescription(
    routine: AdvancedRoutineOutput,
    userAnalysis: UserAnalysis
  ): string {
    const name = userAnalysis.preferences?.find(p => p.startsWith('name:'))?.replace('name:', '') || '';
    
    let description = `Perfetto${name ? ` ${name}` : ''}! `;
    description += `Ecco la tua routine skincare personalizzata`;
    
    // Only add skin type if it's not 'normale' or if it was actually detected
    if (routine.skin_type && routine.skin_type !== 'normale') {
      description += ` per pelle ${routine.skin_type}`;
    }
    
    if (routine.concerns.length > 0) {
      description += ` con focus su: ${routine.concerns.map(c => c.replace(/_/g, ' ')).join(', ')}.\n\n`;
    } else {
      description += '.\n\n';
    }

    // Morning routine description with scientific format
    description += '**ROUTINE MATTUTINA:**\n\n';
    routine.recommendations.morning.forEach((step, index) => {
      description += `${index + 1}. 🧴 **${step.product}**`;
      if (step.link) {
        description += ` - [Link](${step.link})`;
      }
      if (step.price) {
        description += ` - ${step.price}`;
      }
      description += '\n\n';
      
      // Apply the new scientific format
      description += `${step.why}\n\n`;
      description += `💡 **COME USARE**: ${step.how_to_use}\n\n`;
      
      description += '---\n\n';
    });

    // Evening routine description with scientific format  
    description += '**ROUTINE SERALE:**\n\n';
    routine.recommendations.evening.forEach((step, index) => {
      description += `${index + 1}. 🧴 **${step.product}**`;
      if (step.link) {
        description += ` - [Link](${step.link})`;
      }
      if (step.price) {
        description += ` - ${step.price}`;
      }
      description += '\n\n';
      
      // Apply the new scientific format
      description += `${step.why}\n\n`;
      description += `💡 **COME USARE**: ${step.how_to_use}\n`;
      if (step.frequency) {
        description += `**FREQUENZA**: ${step.frequency}\n`;
      }
      description += '\n---\n\n';
    });

    // Add alternation rules if present
    if (routine.alternation_rules && routine.alternation_rules !== 'Nessuna alternanza necessaria') {
      description += `\n**REGOLE DI ALTERNANZA:**\n${routine.alternation_rules}\n`;
    }

    // Add notes
    description += `\n**NOTE IMPORTANTI:**\n${routine.notes}\n`;

    // Add confidence disclaimer
    if (routine.confidence === 'bassa') {
      description += '\n⚠️ _Questa routine è basata su informazioni limitate. ' +
                     'Si consiglia una consulenza professionale per risultati ottimali._';
    }

    return description;
  }

  /**
   * Translate skin type to Italian
   */
  private translateSkinType(skinType: string): string {
    const translations: { [key: string]: string } = {
      'oily': 'grassa',
      'dry': 'secca',
      'combination': 'mista',
      'normal': 'normale',
      'sensitive': 'sensibile',
      'grassa': 'grassa',
      'secca': 'secca',
      'mista': 'mista',
      'normale': 'normale',
      'sensibile': 'sensibile'
    };
    
    return translations[skinType.toLowerCase()] || skinType;
  }

  /**
   * Translate concern to Italian
   */
  private translateConcern(concern: string): string {
    const translations: { [key: string]: string } = {
      'acne': 'acne',
      'wrinkles': 'rughe',
      'rughe': 'rughe',
      'dark_spots': 'macchie scure',
      'macchie': 'macchie scure',
      'pigmentazione': 'iperpigmentazione',
      'redness': 'rossori',
      'rossori': 'rossori',
      'dryness': 'secchezza',
      'secchezza': 'secchezza',
      'oiliness': 'oleosità',
      'oleosita': 'oleosità',
      'pori_dilatati': 'pori dilatati',
      'enlarged_pores': 'pori dilatati',
      'dullness': 'opacità',
      'opacita': 'opacità',
      'texture': 'texture irregolare',
      'texture_uniforme': 'texture irregolare',
      'elasticita': 'perdita di elasticità',
      'idratazione': 'disidratazione',
      'danni_solari': 'danni solari'
    };
    
    return translations[concern.toLowerCase()] || concern;
  }
}

// Export singleton instance
export const advancedRoutineGenerator = new AdvancedRoutineGenerator();