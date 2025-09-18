// Test script per verificare che la ricerca di "M-Eye Secret" funzioni
import { ragService } from './server/services/rag-simple.js';

async function testSearch() {
  console.log('🧪 Testing search functionality for M-Eye Secret variants...\n');
  
  const testQueries = [
    'M-Eye Secret',
    'M-EYE SECRET', 
    'm-eye secret',
    'm eye secret',
    'MEyeSecret',
    'M_Eye_Secret',
    'meye secret',
    'contorno occhi multipeptide',
    'crema occhi M-Eye'
  ];
  
  for (const query of testQueries) {
    console.log(`\n🔍 Testing query: "${query}"`);
    console.log('=' .repeat(50));
    
    try {
      const result = await ragService.searchSimilar(query, 3);
      
      if (result.sources && result.sources.length > 0) {
        console.log(`✅ Found ${result.sources.length} results`);
        
        // Check if M-EYE SECRET is found
        const foundMEyeSecret = result.sources.some(source => 
          source.content.toLowerCase().includes('m-eye secret') ||
          source.content.toLowerCase().includes('meye secret') ||
          source.content.toLowerCase().includes('multipeptide')
        );
        
        if (foundMEyeSecret) {
          console.log('🎯 SUCCESS: M-Eye Secret product found!');
        } else {
          console.log('⚠️ M-Eye Secret not found in results');
        }
        
        // Show top result with similarity score
        const topResult = result.sources[0];
        console.log(`Top result similarity: ${(topResult.similarity * 100).toFixed(1)}%`);
        console.log(`Source: ${topResult.metadata.source}`);
        console.log(`Content preview: ${topResult.content.substring(0, 150)}...`);
        
      } else {
        console.log('❌ No results found');
      }
      
    } catch (error) {
      console.error(`❌ Error testing "${query}":`, error.message);
    }
  }
  
  console.log('\n🏁 Test completed!');
}

// Run the test
testSearch().catch(console.error);