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