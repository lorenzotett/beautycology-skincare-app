// Script per convertire beautycology.json in formato testo per il RAG
import fs from 'fs';
import path from 'path';

function convertProductsToText() {
  console.log('🔄 Converting beautycology.json to text format for RAG...');
  
  try {
    // Read the JSON file
    const jsonPath = './knowledge-base/beautycology.json';
    if (!fs.existsSync(jsonPath)) {
      console.error('❌ beautycology.json not found in knowledge-base/');
      return;
    }
    
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    let textContent = '';
    
    // Convert products to searchable text
    if (data.products && data.products.length > 0) {
      textContent += '# CATALOGO PRODOTTI BEAUTYCOLOGY\n\n';
      
      data.products.forEach((product, index) => {
        textContent += `## PRODOTTO ${index + 1}: ${product.name}\n`;
        textContent += `**Nome prodotto:** ${product.name}\n`;
        textContent += `**Prezzo:** ${product.price}\n`;
        textContent += `**Categoria:** ${product.category}\n`;
        textContent += `**URL:** ${product.url}\n`;
        textContent += `**Descrizione:** ${product.description}\n`;
        
        if (product.originalPrice) {
          textContent += `**Prezzo originale:** ${product.originalPrice}\n`;
        }
        
        if (product.ingredients && product.ingredients.length > 0) {
          textContent += `**Ingredienti:** ${product.ingredients.join(', ')}\n`;
        }
        
        // Add variations for better search
        const productNameVariations = [
          product.name.toLowerCase(),
          product.name.replace(/[-_]/g, ' '),
          product.name.replace(/[-_\s]/g, ''),
          product.name.toUpperCase()
        ];
        
        textContent += `**Varianti nome per ricerca:** ${productNameVariations.join(', ')}\n`;
        textContent += '\n---\n\n';
      });
    }
    
    // Convert blog articles if present
    if (data.blogArticles && data.blogArticles.length > 0) {
      textContent += '\n\n# ARTICOLI BLOG BEAUTYCOLOGY\n\n';
      
      data.blogArticles.forEach((article, index) => {
        textContent += `## ARTICOLO ${index + 1}: ${article.title}\n`;
        textContent += `**Titolo:** ${article.title}\n`;
        textContent += `**Categoria:** ${article.category}\n`;
        textContent += `**URL:** ${article.url}\n`;
        textContent += `**Contenuto:** ${article.content}\n`;
        textContent += '\n---\n\n';
      });
    }
    
    // Add categories
    if (data.categories && data.categories.length > 0) {
      textContent += '\n\n# CATEGORIE PRODOTTI\n\n';
      textContent += `**Categorie disponibili:** ${data.categories.join(', ')}\n\n`;
    }
    
    // Add last updated info
    if (data.lastUpdated) {
      textContent += `\n**Ultimo aggiornamento catalogo:** ${data.lastUpdated}\n`;
    }
    
    // Write the text file
    const outputPath = './knowledge-base/beautycology-prodotti.txt';
    fs.writeFileSync(outputPath, textContent, 'utf8');
    
    console.log(`✅ Converted ${data.products?.length || 0} products to ${outputPath}`);
    console.log(`📄 Generated ${textContent.length} characters of searchable text`);
    
    return outputPath;
    
  } catch (error) {
    console.error('❌ Error converting products:', error);
  }
}

// Run the conversion
convertProductsToText();