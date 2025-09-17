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
      this.scrapeProducts(),
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

  private async scrapeProducts(): Promise<Product[]> {
    console.log('📦 Scraping prodotti...');
    const products: Product[] = [];

    try {
      const response = await axios.get(`${this.baseUrl}/shop/`);
      const $ = cheerio.load(response.data);

      // Estrai tutti i prodotti dalla griglia
      $('.uk-grid-medium .uk-width-1-1').each((index, element) => {
        try {
          const $product = $(element);
          
          const name = $product.find('h3 a').text().trim();
          const url = $product.find('h3 a').attr('href') || '';
          const image = $product.find('img').first().attr('src') || '';
          
          // Estrai prezzi (gestisce sia prezzi singoli che range)
          const priceText = $product.find('.price').text().trim();
          let price = '';
          let originalPrice: string | undefined;
          
          if (priceText.includes('€')) {
            if (priceText.includes('Il prezzo originale era')) {
              // Prodotto in offerta
              const priceMatch = priceText.match(/€([\d,]+)/g);
              if (priceMatch && priceMatch.length >= 2) {
                originalPrice = priceMatch[0];
                price = priceMatch[1];
              }
            } else if (priceText.includes('–')) {
              // Range di prezzi
              price = priceText.match(/€[\d,]+–€[\d,]+/)?.[0] || priceText;
            } else {
              // Prezzo singolo
              price = priceText.match(/€[\d,]+/)?.[0] || priceText;
            }
          }

          // Estrai rating se presente
          const rating = $product.find('.star-rating').attr('title') || undefined;
          
          // Determina categoria dal nome/URL
          const category = this.determineProductCategory(name, url);

          if (name && url) {
            products.push({
              name,
              price,
              originalPrice,
              description: name, // Per ora usiamo il nome, aggiungeremo dettagli dopo
              url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
              image: image.startsWith('http') ? image : `${this.baseUrl}${image}`,
              rating,
              category
            });
          }
        } catch (error) {
          console.warn('Errore parsing prodotto:', error);
        }
      });

      // Ottieni dettagli aggiuntivi per prodotti principali
      await this.enrichProductDetails(products);

    } catch (error) {
      console.error('Errore scraping prodotti:', error);
    }

    return products;
  }

  private async scrapeBlogArticles(): Promise<BlogArticle[]> {
    console.log('📰 Scraping articoli blog...');
    const articles: BlogArticle[] = [];

    try {
      const response = await axios.get(`${this.baseUrl}/blog/`);
      const $ = cheerio.load(response.data);

      // Estrai tutti gli articoli dalla griglia del blog
      $('.uk-grid-medium .uk-width-1-1').each((index, element) => {
        try {
          const $article = $(element);
          
          const title = $article.find('h3 a, h2 a').text().trim();
          const url = $article.find('h3 a, h2 a').attr('href') || '';
          const image = $article.find('img').first().attr('src') || '';
          
          // Estrai data e autore
          const metaText = $article.find('.uk-text-meta').text();
          const dateMatch = metaText.match(/(\d{1,2}\s+\w+\s+\d{4})/);
          const date = dateMatch ? dateMatch[1] : '';
          const author = metaText.includes('Marilisa Franchini') ? 'Marilisa Franchini' : '';
          
          // Estrai excerpt
          const excerpt = $article.find('p').not('.uk-text-meta').first().text().trim();
          
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

    return [...new Set(ingredients)]; // Rimuovi duplicati
  }

  private extractCategories(products: Product[], articles: BlogArticle[]): string[] {
    const categories = new Set<string>();
    
    products.forEach(p => categories.add(p.category));
    articles.forEach(a => categories.add(a.category));
    
    return Array.from(categories).sort();
  }
}

export const beautycologyScraper = new BeautycologyScraper();