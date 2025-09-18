import axios from 'axios';
import * as cheerio from 'cheerio';

interface Product {
  name: string;
  price: string;
  originalPrice?: string;
  description: string;
  url: string;
  image: string;
  rating?: string;
  ingredients?: string[];
  category: string;
}

interface BlogArticle {
  title: string;
  url: string;
  date: string;
  author: string;
  excerpt: string;
  content?: string;
  image: string;
  category: string;
}

interface BeautycologyKnowledge {
  products: Product[];
  blogArticles: BlogArticle[];
  categories: string[];
  lastUpdated: string;
}

export class BeautycologyScraper {
  private baseUrl = 'https://beautycology.it';
  
  async scrapeAllData(): Promise<BeautycologyKnowledge> {
    console.log('🔄 Iniziando scraping completo di beautycology.it...');
    
    const [products, blogArticles] = await Promise.all([
      this.scrapeAllProducts(),
      this.scrapeBlogArticles()
    ]);

    const categories = this.extractCategories(products, blogArticles);

    const knowledge: BeautycologyKnowledge = {
      products,
      blogArticles,
      categories,
      lastUpdated: new Date().toISOString()
    };

    console.log(`✅ Scraping completato: ${products.length} prodotti, ${blogArticles.length} articoli`);
    return knowledge;
  }

  private async scrapeAllProducts(): Promise<Product[]> {
    console.log('🚀 NUOVO SISTEMA: Scraping COMPLETO da sitemap + pagine shop...');
    const allProducts = new Set<string>(); // Per evitare duplicati
    const products: Product[] = [];

    try {
      // 1. Scrapa TUTTI i prodotti dalla sitemap
      console.log('🗺️ STEP 1: Scraping da sitemap completa...');
      const sitemapProducts = await this.scrapeProductsFromSitemap(allProducts);
      products.push(...sitemapProducts);
      console.log(`✅ Sitemap: ${sitemapProducts.length} prodotti catturati`);

      // 2. Scrapa anche dalle pagine shop per backup/completezza
      console.log('🏪 STEP 2: Scraping backup da pagine shop...');
      const shopProducts = await this.scrapeProductsFromShop(allProducts);
      products.push(...shopProducts);
      console.log(`✅ Shop pages: ${shopProducts.length} prodotti aggiuntivi`);

    } catch (error) {
      console.error('❌ Errore scraping completo:', error);
    }

    // Ottieni dettagli aggiuntivi per prodotti principali
    await this.enrichProductDetails(products);

    console.log(`🎯 TOTALE FINALE: ${products.length} prodotti UNICI catturati!`);
    return products;
  }

  private async scrapeProductsFromSitemap(allProducts: Set<string>): Promise<Product[]> {
    const products: Product[] = [];
    
    try {
      // Ottieni sitemap dei prodotti
      console.log('📋 Caricamento sitemap prodotti...');
      const sitemapResponse = await axios.get(`${this.baseUrl}/product-sitemap1.xml`);
      const sitemapHtml = sitemapResponse.data;
      
      // Estrai TUTTI gli URL /prodotto/
      const productUrls = sitemapHtml.match(/https:\/\/beautycology\.it\/prodotto\/[^<]+/g) || [];
      console.log(`🔍 Trovati ${productUrls.length} URL prodotto nella sitemap`);
      
      // Scrapa ogni singola pagina prodotto
      for (let i = 0; i < productUrls.length; i++) {
        const productUrl = productUrls[i];
        
        // Evita duplicati
        if (allProducts.has(productUrl)) {
          console.log(`⏭️ URL già processato: ${productUrl}`);
          continue;
        }
        
        console.log(`🔍 Scraping prodotto ${i+1}/${productUrls.length}: ${productUrl}`);
        
        try {
          const product = await this.scrapeIndividualProduct(productUrl);
          if (product) {
            allProducts.add(productUrl);
            products.push(product);
            console.log(`✅ Prodotto catturato: ${product.name}`);
          }
        } catch (error: any) {
          console.warn(`⚠️ Errore scraping ${productUrl}:`, error.response?.status || error.message);
        }
        
        // Pausa per evitare rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.error('❌ Errore accesso sitemap:', error);
    }
    
    return products;
  }

  private async scrapeIndividualProduct(url: string): Promise<Product | null> {
    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);
      
      // Estrai nome prodotto
      const name = $('h1.entry-title, h1.product_title, .product-title').first().text().trim() ||
                   $('.woocommerce-loop-product__title').first().text().trim() ||
                   $('title').text().split(' - ')[0].trim();
      
      if (!name) {
        console.warn(`⚠️ Nome prodotto non trovato per ${url}`);
        return null;
      }
      
      // Estrai prezzo
      let price = '';
      let originalPrice: string | undefined;
      
      const priceElement = $('.price, .woocommerce-Price-amount, .amount').first();
      const priceText = priceElement.text();
      
      const priceMatches = priceText.match(/€[\d,]+(?:,\d{2})?/g);
      if (priceMatches) {
        if (priceText.includes('–') && priceMatches.length >= 2) {
          price = `${priceMatches[0]}–${priceMatches[priceMatches.length - 1]}`;
        } else {
          price = priceMatches[0];
        }
      }
      
      // Estrai descrizione
      const description = $('.woocommerce-product-details__short-description, .entry-content, .product-summary')
        .first().text().trim().substring(0, 500) || name;
      
      // Estrai immagine
      const image = $('.woocommerce-product-gallery__image img, .wp-post-image, .product-image img')
        .first().attr('src') || '';
      
      // Determina categoria
      const category = this.determineProductCategory(name, url);
      
      return {
        name,
        price,
        originalPrice,
        description,
        url,
        image: image.startsWith('http') ? image : `${this.baseUrl}${image}`,
        category
      };
      
    } catch (error) {
      console.error(`Errore scraping prodotto individuale ${url}:`, error);
      return null;
    }
  }

  private async scrapeProductsFromShop(allProducts: Set<string>): Promise<Product[]> {
    console.log('📦 Scraping backup da pagine shop...');
    const products: Product[] = [];

    // Focus sulla pagina principale con paginazione completa
    const shopUrl = `${this.baseUrl}/shop/`;
    
    try {
      console.log(`🔍 Scraping da pagina principale: ${shopUrl}`);
      
      // Scrapa la prima pagina
      const firstPageProducts = await this.scrapeProductsFromPage(shopUrl, allProducts);
      products.push(...firstPageProducts);
      console.log(`📄 Pagina 1: trovati ${firstPageProducts.length} prodotti`);
      
      // Ora scrapa TUTTE le pagine successive con paginazione robusta
      await this.scrapeAllPaginatedPages(shopUrl, products, allProducts);
      
    } catch (error) {
      console.error(`Errore scraping pagina principale:`, error);
    }

    console.log(`✅ Shop scraping completato: ${products.length} prodotti dalle pagine shop`);
    return products;
  }

  private async scrapeProductsFromPage(url: string, allProducts: Set<string>): Promise<Product[]> {
    const products: Product[] = [];
    
    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      // Estrai tutti i prodotti usando i selettori corretti identificati dal debug
      $('li.product.type-product').each((index, element) => {
        try {
          const $product = $(element);
          const fullText = $product.text();
          
          // Estrai nome del prodotto - è la prima parte del testo prima del rating
          const textParts = fullText.split('Valutato');
          const name = textParts[0].trim();
          
          // Estrai URL del prodotto dal link interno
          const $productLink = $product.find('a[href*="/prodotto/"]').first();
          const url = $productLink.attr('href') || '';
          
          // Evita duplicati usando l'URL come identificatore unico
          const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
          if (allProducts.has(fullUrl)) {
            return; // Salta se già processato
          }
          allProducts.add(fullUrl);
          
          // Estrai immagine
          const image = $product.find('img').first().attr('src') || '';
          
          // Estrai prezzo con regex più preciso
          let price = '';
          let originalPrice: string | undefined;
          
          // Cerca tutti i prezzi nel testo
          const priceMatches = fullText.match(/€[\d,]+(?:,\d{2})?/g);
          
          if (fullText.includes('Il prezzo originale era') && priceMatches && priceMatches.length >= 2) {
            // Prodotto in offerta - primo prezzo è originale, ultimo è attuale
            originalPrice = priceMatches[0];
            price = priceMatches[priceMatches.length - 1];
          } else if (fullText.includes('–') && priceMatches && priceMatches.length >= 2) {
            // Range di prezzi
            price = `${priceMatches[0]}–${priceMatches[1]}`;
          } else if (priceMatches && priceMatches.length > 0) {
            // Prezzo singolo
            price = priceMatches[0];
          }

          // Estrai rating se presente
          const ratingMatch = fullText.match(/Valutato ([\d,]+) su 5/);
          const rating = ratingMatch ? `${ratingMatch[1]} su 5` : undefined;
          
          // Determina categoria dal nome/URL
          const category = this.determineProductCategory(name, url);

          if (name && url) {
            products.push({
              name,
              price,
              originalPrice,
              description: name, // Per ora usiamo il nome, aggiungeremo dettagli dopo
              url: fullUrl,
              image: image.startsWith('http') ? image : `${this.baseUrl}${image}`,
              rating,
              category
            });
          }
        } catch (error) {
          console.warn('Errore parsing prodotto:', error);
        }
      });

    } catch (error) {
      console.error(`Errore scraping da ${url}:`, error);
    }

    return products;
  }

  private async scrapeAllPaginatedPages(baseUrl: string, products: Product[], allProducts: Set<string>): Promise<void> {
    console.log('📚 Iniziando scraping paginazione completa...');
    let currentPage = 2;
    let hasNextPage = true;
    let consecutiveErrors = 0;

    while (hasNextPage && currentPage <= 20 && consecutiveErrors < 3) { // Massimo 20 pagine, massimo 3 errori consecutivi
      try {
        const paginatedUrl = `${baseUrl}page/${currentPage}/`;
        console.log(`🔍 Controllo pagina ${currentPage}: ${paginatedUrl}`);
        
        const response = await axios.get(paginatedUrl);
        const $ = cheerio.load(response.data);
        
        // Verifica se ci sono prodotti in questa pagina
        const productsOnPage = $('li.product.type-product').length;
        console.log(`📊 Pagina ${currentPage}: trovati ${productsOnPage} elementi prodotto`);
        
        if (productsOnPage === 0) {
          console.log(`⚠️ Pagina ${currentPage} senza prodotti - fine paginazione`);
          hasNextPage = false;
          break;
        }

        // Scrapa i prodotti da questa pagina
        const scraped = await this.scrapeProductsFromPage(paginatedUrl, allProducts);
        
        if (scraped.length === 0) {
          console.log(`⚠️ Pagina ${currentPage} non ha prodotti validi - fine paginazione`);
          hasNextPage = false;
          break;
        }
        
        products.push(...scraped);
        console.log(`📄 Pagina ${currentPage}: aggiunti ${scraped.length} prodotti (totale: ${products.length})`);
        
        // Reset errori consecutivi se tutto va bene
        consecutiveErrors = 0;
        currentPage++;
        
        // Pausa per evitare rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error: any) {
        consecutiveErrors++;
        console.warn(`❌ Errore pagina ${currentPage} (errori consecutivi: ${consecutiveErrors}):`, error.response?.status || error.message);
        
        if (error.response?.status === 404) {
          console.log(`🔚 Pagina ${currentPage} non esiste (404) - fine paginazione naturale`);
          hasNextPage = false;
        } else if (consecutiveErrors >= 3) {
          console.log(`🛑 Troppi errori consecutivi (${consecutiveErrors}) - stop paginazione`);
          hasNextPage = false;
        } else {
          currentPage++;
          // Pausa più lunga dopo errore
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }
    
    console.log(`✅ Paginazione completata: esplorate ${currentPage-1} pagine totali`);
  }

  private async scrapeBlogArticles(): Promise<BlogArticle[]> {
    console.log('📰 Scraping articoli blog...');
    const articles: BlogArticle[] = [];

    try {
      const response = await axios.get(`${this.baseUrl}/blog/`);
      const $ = cheerio.load(response.data);

      // Estrai articoli del blog - cerca elementi con pattern specifici
      // Prima cerchiamo elementi che contengano data + Marilisa Franchini + link
      $('*').filter((i, element) => {
        const $el = $(element);
        const text = $el.text();
        
        // Deve contenere una data, l'autore, e avere dimensione ragionevole
        const hasDate = /\d{1,2}\s+\w+\s+\d{4}/.test(text);
        const hasAuthor = text.includes('Marilisa Franchini');
        const hasLink = $el.find('a').length > 0;
        const textLength = text.replace(/\s+/g, ' ').trim().length;
        const isSizeReasonable = textLength > 50 && textLength < 1500;
        
        return hasDate && hasAuthor && hasLink && isSizeReasonable;
      }).each((index, element) => {
        try {
          const $article = $(element);
          const fullText = $article.text().replace(/\s+/g, ' ').trim();
          
          // Trova il link principale (probabilmente il primo link non-anchor)
          const $titleLink = $article.find('a').filter((i, el) => {
            const href = $(el).attr('href') || '';
            return href.includes('/') && !href.includes('#') && href.length > 20;
          }).first();
          
          if (!$titleLink.length) return;
          
          // Estrai titolo - prima parte del testo o dal link
          const title = $article.find('h1, h2, h3, h4, strong, b').first().text().trim() ||
                       $titleLink.text().trim();
          
          const url = $titleLink.attr('href') || '';
          const image = $article.find('img').first().attr('src') || '';
          
          // Estrai data e autore
          const dateMatch = fullText.match(/(\d{1,2}\s+\w+\s+\d{4})/);
          const date = dateMatch ? dateMatch[1] : '';
          const author = fullText.includes('Marilisa Franchini') ? 'Marilisa Franchini' : '';
          
          // Estrai excerpt - cerca testo dopo data e autore
          const lines = fullText.split(/\s{3,}|\n/).filter(l => l.trim().length > 20);
          let excerpt = '';
          for (const line of lines) {
            if (!line.includes(date) && !line.includes('Marilisa Franchini') && 
                !line.includes('Leggi') && line.length > 30) {
              excerpt = line.substring(0, 200);
              break;
            }
          }
          
          // Determina categoria
          const category = this.determineBlogCategory(title, excerpt);

          if (title && url) {
            articles.push({
              title,
              url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
              date,
              author,
              excerpt,
              image: image.startsWith('http') ? image : `${this.baseUrl}${image}`,
              category
            });
          }
        } catch (error) {
          console.warn('Errore parsing articolo:', error);
        }
      });

      // Ottieni contenuto completo per articoli più importanti
      await this.enrichArticleContent(articles);

    } catch (error) {
      console.error('Errore scraping blog:', error);
    }

    return articles;
  }

  private async enrichProductDetails(products: Product[]): Promise<void> {
    console.log('🔍 Arricchimento dettagli prodotti...');
    
    // Focus sui prodotti principali per evitare troppe richieste
    const mainProducts = products.filter(p => 
      p.name.includes('Perfect & Pure') ||
      p.name.includes('BODYLICIOUS') ||
      p.name.includes('M-EYE SECRET') ||
      p.name.includes('I PEEL GOOD') ||
      p.name.includes('C-Boost') ||
      p.name.includes('Barrier Hero')
    ).slice(0, 10); // Limita a 10 prodotti principali

    for (const product of mainProducts) {
      try {
        const response = await axios.get(product.url);
        const $ = cheerio.load(response.data);
        
        // Estrai descrizione dettagliata
        const description = $('.entry-content, .product-summary, .woocommerce-product-details__short-description')
          .text().trim().substring(0, 500);
        
        if (description) {
          product.description = description;
        }

        // Estrai ingredienti se presenti
        const ingredientsText = $('*:contains("INCI"), *:contains("Ingredienti"), *:contains("ingredienti")')
          .parent().text();
        
        if (ingredientsText) {
          product.ingredients = this.parseIngredients(ingredientsText);
        }

        // Piccola pausa per evitare rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.warn(`Errore enrichment prodotto ${product.name}:`, error);
      }
    }
  }

  private async enrichArticleContent(articles: BlogArticle[]): Promise<void> {
    console.log('📖 Arricchimento contenuto articoli...');
    
    // Focus sui primi 5 articoli più recenti
    const recentArticles = articles.slice(0, 5);

    for (const article of recentArticles) {
      try {
        const response = await axios.get(article.url);
        const $ = cheerio.load(response.data);
        
        // Estrai contenuto principale
        const content = $('.entry-content, .article-content, .post-content')
          .text().trim().substring(0, 1000);
        
        if (content) {
          article.content = content;
        }

        // Piccola pausa per evitare rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.warn(`Errore enrichment articolo ${article.title}:`, error);
      }
    }
  }

  private determineProductCategory(name: string, url: string): string {
    const nameLower = name.toLowerCase();
    const urlLower = url.toLowerCase();
    
    if (nameLower.includes('kit') || nameLower.includes('routine')) return 'Kit & Routine';
    if (nameLower.includes('crema') || nameLower.includes('cream')) return 'Creme';
    if (nameLower.includes('siero') || nameLower.includes('serum')) return 'Sieri';
    if (nameLower.includes('detergente') || nameLower.includes('oil') || nameLower.includes('mousse')) return 'Detergenti';
    if (nameLower.includes('maschera') || nameLower.includes('mask')) return 'Maschere';
    if (nameLower.includes('contorno') || nameLower.includes('eye')) return 'Contorno Occhi';
    if (nameLower.includes('spf') || nameLower.includes('shield')) return 'Protezione Solare';
    if (nameLower.includes('corpo') || nameLower.includes('body')) return 'Corpo';
    if (nameLower.includes('esfoliante') || nameLower.includes('peel')) return 'Esfolianti';
    
    return 'Altri Prodotti';
  }

  private determineBlogCategory(title: string, excerpt: string): string {
    const textLower = (title + ' ' + excerpt).toLowerCase();
    
    if (textLower.includes('acne') || textLower.includes('brufoli') || textLower.includes('sebo')) return 'Acne & Pelle Grassa';
    if (textLower.includes('rughe') || textLower.includes('antiage') || textLower.includes('elastina')) return 'Anti-Aging';
    if (textLower.includes('ingredienti') || textLower.includes('inci') || textLower.includes('acido')) return 'Ingredienti';
    if (textLower.includes('routine') || textLower.includes('skincare') || textLower.includes('cura')) return 'Skincare Routine';
    if (textLower.includes('trucco') || textLower.includes('makeup') || textLower.includes('pennelli')) return 'Makeup';
    if (textLower.includes('capelli') || textLower.includes('hair')) return 'Capelli';
    
    return 'Divulgazione Scientifica';
  }

  private parseIngredients(text: string): string[] {
    // Estrai ingredienti da testo INCI
    const ingredients: string[] = [];
    
    // Pattern comuni per ingredienti
    const patterns = [
      /niacinamide/gi,
      /retinol/gi,
      /vitamin\s*c/gi,
      /acido\s+\w+/gi,
      /algae?\s+extract/gi,
      /hyaluronic\s+acid/gi,
      /panthenol/gi,
      /peptide/gi
    ];

    patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        ingredients.push(...matches.map(m => m.trim()));
      }
    });

    // Rimuovi duplicati manualmente
    const uniqueIngredients: string[] = [];
    ingredients.forEach(ingredient => {
      if (!uniqueIngredients.includes(ingredient)) {
        uniqueIngredients.push(ingredient);
      }
    });
    return uniqueIngredients;
  }

  private extractCategories(products: Product[], articles: BlogArticle[]): string[] {
    const categories: string[] = [];
    
    products.forEach(p => {
      if (!categories.includes(p.category)) {
        categories.push(p.category);
      }
    });
    
    articles.forEach(a => {
      if (!categories.includes(a.category)) {
        categories.push(a.category);
      }
    });
    
    return categories.sort();
  }
}

export const beautycologyScraper = new BeautycologyScraper();