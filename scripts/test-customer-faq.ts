#!/usr/bin/env tsx
// Test script per verificare che le FAQ clienti siano accessibili nella knowledge base
import { RAGLoader } from '../server/utils/rag-loader';

async function testCustomerFAQ() {
  console.log('🧪 Test delle FAQ clienti di Beautycology...\n');
  
  try {
    // Carica tutti i documenti
    console.log('📚 Caricamento knowledge base...');
    await RAGLoader.loadDocumentsFromDirectory('./knowledge-base');
    
    // Test query specifiche per le FAQ clienti
    const testQueries = [
      'rosacea e capillari',
      'macchie pelle scura',
      'pori dilatati naso',
      'Multiple Gel usage',
      'Invisible Shield protezione',
      'Retinal Bomb vs Retinal Eye Lip',
      'pelle sensibile arrossamenti'
    ];
    
    console.log('\n🔍 Test di ricerca nelle FAQ...\n');
    
    for (const query of testQueries) {
      console.log(`\n--- TEST: "${query}" ---`);
      await RAGLoader.testRAGSearch(query);
    }
    
  } catch (error) {
    console.error('❌ Errore durante il test:', error);
  }
}

testCustomerFAQ().catch(console.error);