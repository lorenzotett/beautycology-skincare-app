// Script per ricaricare la knowledge base e testare la ricerca
import { RAGLoader } from './server/utils/rag-loader.js';

async function reloadAndTest() {
  console.log('🔄 Reloading knowledge base and testing search...\n');
  
  try {
    // Clear existing knowledge base
    console.log('🗑️ Clearing existing knowledge base...');
    RAGLoader.clearKnowledgeBase();
    
    // Reload all documents including the new products file
    console.log('📚 Reloading all documents...');
    await RAGLoader.loadDocumentsFromDirectory('./knowledge-base');
    
    // Show status
    console.log('\n📊 Current knowledge base status:');
    RAGLoader.showKnowledgeBaseStatus();
    
    // Test search for M-Eye Secret
    console.log('\n🧪 Testing M-Eye Secret search...');
    await RAGLoader.testRAGSearch('M-Eye Secret');
    
    console.log('\n🧪 Testing other variants...');
    await RAGLoader.testRAGSearch('M-EYE SECRET');
    await RAGLoader.testRAGSearch('contorno occhi multipeptide');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

reloadAndTest();