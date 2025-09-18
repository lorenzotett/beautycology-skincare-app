// Test per verificare altri prodotti con nomi complessi
import { ragService } from './server/services/rag-simple.js';

async function testOtherProducts() {
  console.log('🧪 Testing other complex product names...\n');
  
  const productTests = [
    // Prodotti con caratteri speciali, trattini, e case mixing
    'C-Boost',
    'c boost',
    'CBOOST',
    'vitamina c',
    'BODYLICIOUS',
    'body licious',
    'retinol',
    'Perfect & Pure',
    'perfect and pure',
    'PERFECT PURE',
    'Let\'s Glow',
    'lets glow',
    'LETS GLOW',
    'peeling',
    'I PEEL GOOD',
    'ipeel good',
    'Bionic HydraLift',
    'bionic hydra lift',
    'BIONIC HYDRALIFT',
    'lattobionico',
    'Retinal bomb',
    'retinal',
    'RETINAL BOMB',
    'multipod gel',
    'MULTIPOD',
    'azelaico'
  ];
  
  let successCount = 0;
  let totalTests = productTests.length;
  
  for (const query of productTests) {
    console.log(`\n🔍 Testing: "${query}"`);
    
    try {
      const result = await ragService.searchSimilar(query, 2);
      
      if (result.sources && result.sources.length > 0) {
        const topResult = result.sources[0];
        const similarity = (topResult.similarity * 100).toFixed(1);
        
        console.log(`✅ Found results (top similarity: ${similarity}%)`);
        console.log(`   Source: ${topResult.metadata.source}`);
        console.log(`   Preview: ${topResult.content.substring(0, 100)}...`);
        successCount++;
      } else {
        console.log(`❌ No results found`);
      }
      
    } catch (error) {
      console.error(`❌ Error testing "${query}":`, error.message);
    }
  }
  
  console.log(`\n📊 Summary: ${successCount}/${totalTests} tests found results (${Math.round(successCount/totalTests*100)}% success rate)`);
  
  if (successCount / totalTests < 0.8) {
    console.log('⚠️ Warning: Less than 80% success rate. Some products may be hard to find.');
  } else {
    console.log('🎉 Great! Most product searches are working well.');
  }
}

testOtherProducts().catch(console.error);