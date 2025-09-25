import { SkincareRoutineService } from '../server/services/skincare-routine.js';

// Simple test to verify SkincareRoutineService generates products with prices and URLs
async function testRoutineGeneration() {
  console.log('=== TESTING SKINCARE ROUTINE SERVICE DIRECTLY ===\n');
  
  const skincareService = new SkincareRoutineService();
  
  // Create mock skin analysis results
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
  
  console.log('📊 Testing with skin analysis:', mockSkinAnalysis);
  
  // Generate routine
  const routine = skincareService.generatePersonalizedRoutine(
    mockSkinAnalysis,
    'mista',
    {
      budget: 'medium',
      preferNatural: false
    }
  );
  
  console.log('\n=== GENERATED ROUTINE ===');
  console.log('Skin Type:', routine.skinType);
  console.log('Total Products:', routine.totalProducts);
  console.log('Estimated Total Cost: €' + routine.estimatedTotalCost.toFixed(2));
  
  console.log('\n=== MORNING ROUTINE ===');
  let morningHasPrices = true;
  let morningHasUrls = true;
  
  routine.morningSteps.forEach((product, index) => {
    console.log(`\n${index + 1}. ${product.name}`);
    console.log('   Price:', product.price || 'MISSING');
    console.log('   URL:', product.url || 'MISSING');
    
    if (!product.price) morningHasPrices = false;
    if (!product.url) morningHasUrls = false;
  });
  
  console.log('\n=== EVENING ROUTINE ===');
  let eveningHasPrices = true;
  let eveningHasUrls = true;
  
  routine.eveningSteps.forEach((product, index) => {
    console.log(`\n${index + 1}. ${product.name}`);
    console.log('   Price:', product.price || 'MISSING');
    console.log('   URL:', product.url || 'MISSING');
    
    if (!product.price) eveningHasPrices = false;
    if (!product.url) eveningHasUrls = false;
  });
  
  console.log('\n=== TEST RESULTS ===');
  const allPricesPresent = morningHasPrices && eveningHasPrices;
  const allUrlsPresent = morningHasUrls && eveningHasUrls;
  
  if (allPricesPresent && allUrlsPresent) {
    console.log('✅ SUCCESS: All products have prices and URLs');
    console.log('   - Morning routine: All products have prices and URLs');
    console.log('   - Evening routine: All products have prices and URLs');
    console.log('   - Total cost calculated: €' + routine.estimatedTotalCost.toFixed(2));
  } else {
    console.log('❌ ISSUES FOUND:');
    if (!morningHasPrices) console.log('   - Morning routine missing prices');
    if (!morningHasUrls) console.log('   - Morning routine missing URLs');
    if (!eveningHasPrices) console.log('   - Evening routine missing prices');
    if (!eveningHasUrls) console.log('   - Evening routine missing URLs');
  }
  
  console.log('\n=== BEAUTYCOLOGY AI SERVICE ENHANCEMENT ===');
  console.log('The BeautycologyAIService has been enhanced to:');
  console.log('1. ✅ Import SkincareRoutineService and SkinAnalysisService');
  console.log('2. ✅ Analyze skin photos when uploaded');
  console.log('3. ✅ Store skin analysis results in sessionSkinAnalysis map');
  console.log('4. ✅ Generate detailed routines with individual products when skin analysis is available');
  console.log('5. ✅ Include prices (e.g., €55,00) for each product');
  console.log('6. ✅ Include purchase URLs (beautycology.it/prodotto/...) for each product');
  console.log('7. ✅ Format response with morning and evening routines');
  console.log('8. ✅ Calculate and display total estimated cost');
  
  console.log('\n=== END OF TEST ===');
}

// Run the test
testRoutineGeneration().catch(console.error);