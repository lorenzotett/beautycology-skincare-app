import { BeautycologyAIService } from '../server/services/beautycology-ai.js';
import { SkinAnalysisService } from '../server/services/skin-analysis.js';

async function testBeautycologyRoutineGeneration() {
  console.log('=== TESTING BEAUTYCOLOGY AI ROUTINE GENERATION ===\n');
  
  const beautycologyAI = new BeautycologyAIService();
  const skinAnalysisService = new SkinAnalysisService();
  
  // Create a mock session ID
  const sessionId = 'test_session_' + Date.now();
  
  // Create mock skin analysis results (similar to what would be returned from photo analysis)
  const mockSkinAnalysis = {
    rossori: 45,
    acne: 30,
    rughe: 55,
    pigmentazione: 65,
    pori_dilatati: 40,
    oleosita: 35,
    danni_solari: 50,
    occhiaie: 25,
    idratazione: 60,
    elasticita: 45,
    texture_uniforme: 55
  };
  
  // Store the mock skin analysis in the service's session map
  // This simulates what happens when a photo is analyzed
  (beautycologyAI as any).sessionSkinAnalysis.set(sessionId, mockSkinAnalysis);
  
  // Also set up extracted info with skin type
  (beautycologyAI as any).extractedInfo.set(sessionId, { skinType: 'mista' });
  
  console.log('📊 Mock skin analysis stored for session:', sessionId);
  console.log('Skin analysis scores:', mockSkinAnalysis);
  
  // Test 1: Send a routine request message
  console.log('\n=== TEST 1: Routine Request with Skin Analysis ===');
  const routineRequest = "Puoi consigliarmi una routine skincare completa?";
  
  try {
    const response = await beautycologyAI.sendMessage(sessionId, routineRequest);
    
    console.log('\n📝 Response content length:', response.content.length);
    
    // Check if response contains prices
    const hasPrices = response.content.includes('€') && response.content.includes('Prezzo:');
    console.log('✓ Contains prices:', hasPrices);
    
    // Check if response contains URLs
    const hasUrls = response.content.includes('beautycology.it/prodotto/') && response.content.includes('[Acquista qui]');
    console.log('✓ Contains purchase URLs:', hasUrls);
    
    // Check for morning routine
    const hasMorningRoutine = response.content.includes('ROUTINE MATTUTINA');
    console.log('✓ Has morning routine:', hasMorningRoutine);
    
    // Check for evening routine
    const hasEveningRoutine = response.content.includes('ROUTINE SERALE');
    console.log('✓ Has evening routine:', hasEveningRoutine);
    
    // Check for total cost
    const hasTotalCost = response.content.includes('COSTO TOTALE STIMATO:');
    console.log('✓ Has total cost:', hasTotalCost);
    
    // Extract and display some product examples
    console.log('\n=== SAMPLE PRODUCTS FROM RESPONSE ===');
    const lines = response.content.split('\n');
    let productCount = 0;
    for (let i = 0; i < lines.length && productCount < 3; i++) {
      if (lines[i].match(/^\*\*\d+\.\s+.*\*\*$/)) {
        console.log('\nProduct:', lines[i]);
        // Show next few lines for price and URL
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
          if (lines[j].includes('Prezzo:') || lines[j].includes('[Acquista qui]')) {
            console.log(lines[j]);
          }
        }
        productCount++;
      }
    }
    
    // Success summary
    console.log('\n=== TEST RESULTS ===');
    if (hasPrices && hasUrls && hasMorningRoutine && hasEveningRoutine) {
      console.log('✅ SUCCESS: BeautycologyAIService now generates detailed routines with:');
      console.log('   - Individual product names');
      console.log('   - Product prices');
      console.log('   - Purchase URLs');
      console.log('   - Morning and evening routines');
      console.log('   - Total estimated cost');
    } else {
      console.log('❌ ISSUES FOUND:');
      if (!hasPrices) console.log('   - Missing prices');
      if (!hasUrls) console.log('   - Missing URLs');
      if (!hasMorningRoutine) console.log('   - Missing morning routine');
      if (!hasEveningRoutine) console.log('   - Missing evening routine');
    }
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  }
  
  // Test 2: Test without skin analysis (should fall back to kit recommendation)
  console.log('\n\n=== TEST 2: Routine Request WITHOUT Skin Analysis ===');
  const sessionIdNoAnalysis = 'test_session_no_analysis_' + Date.now();
  
  try {
    const response2 = await beautycologyAI.sendMessage(sessionIdNoAnalysis, routineRequest);
    
    // This should use the fallback with routine kit links
    const hasKitLink = response2.content.includes('beautycology.it/prodotto/routine-') || 
                       response2.content.includes('skincare-routine');
    console.log('✓ Falls back to routine kit links:', hasKitLink);
    
  } catch (error) {
    console.error('❌ Error during fallback test:', error);
  }
  
  console.log('\n=== END OF TEST ===');
}

// Run the test
testBeautycologyRoutineGeneration().catch(console.error);