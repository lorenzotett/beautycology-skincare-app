import { BeautycologyAIService } from '../server/services/beautycology-ai';

async function testAdvancedRoutineIntegration() {
  console.log('🧪 Testing Advanced Routine Generation Integration in Chatbot');
  console.log('='.repeat(80));
  
  const aiService = new BeautycologyAIService();
  
  // Test cases for routine generation
  const testCases = [
    {
      name: 'Test 1: Pelle mista con acne - richiesta diretta',
      sessionId: 'test_advanced_1',
      message: 'Ho la pelle mista con acne, voglio una routine completa',
      expectedSkinType: 'mista',
      expectedConcerns: ['acne']
    },
    {
      name: 'Test 2: Pelle grassa - richiesta con "consigliami"',
      sessionId: 'test_advanced_2',
      message: 'Consigliami una routine per pelle grassa',
      expectedSkinType: 'grassa',
      expectedConcerns: ['eccesso di sebo']
    },
    {
      name: 'Test 3: Routine skincare - richiesta con "dammi"',
      sessionId: 'test_advanced_3',
      message: 'Dammi una routine skincare completa',
      expectedSkinType: 'normale',
      expectedConcerns: []
    },
    {
      name: 'Test 4: Pelle sensibile con rossori - routine specifica',
      sessionId: 'test_advanced_4',
      message: 'Ho la pelle sensibile con rossori, vorrei una routine mattina e sera',
      expectedSkinType: 'sensibile',
      expectedConcerns: ['rossori']
    },
    {
      name: 'Test 5: Macchie e rughe - richiesta complessa',
      sessionId: 'test_advanced_5',
      message: 'Ho macchie e prime rughe, voglio una routine anti-age completa',
      expectedSkinType: 'normale',
      expectedConcerns: ['macchie', 'rughe']
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    console.log('\n' + '='.repeat(80));
    console.log(`📋 ${testCase.name}`);
    console.log(`💬 Message: "${testCase.message}"`);
    console.log(`🎯 Expected skin type: ${testCase.expectedSkinType}`);
    console.log(`🎯 Expected concerns: ${testCase.expectedConcerns.join(', ') || 'none'}`);
    console.log('-'.repeat(80));
    
    try {
      // Initialize session with a test name
      await aiService.initializeConversation('TestUser', testCase.sessionId);
      
      // Send the routine request
      console.log('📤 Sending message to chatbot...');
      const response = await aiService.sendMessage(
        testCase.sessionId,
        testCase.message
      );
      
      // Analyze the response
      const responseAnalysis = analyzeResponse(response);
      
      // Print analysis results
      console.log('\n📊 Response Analysis:');
      console.log(`   ✓ Response generated: ✅`);
      console.log(`   ✓ Response length: ${response.content.length} characters`);
      console.log(`   ✓ Has routine content: ${responseAnalysis.hasRoutine ? '✅' : '❌'}`);
      console.log(`   ✓ Has morning routine: ${responseAnalysis.hasMorningRoutine ? '✅' : '❌'}`);
      console.log(`   ✓ Has evening routine: ${responseAnalysis.hasEveningRoutine ? '✅' : '❌'}`);
      console.log(`   ✓ Has product links: ${responseAnalysis.hasProductLinks ? '✅' : '❌'}`);
      console.log(`   ✓ Has prices: ${responseAnalysis.hasPrices ? '✅' : '❌'}`);
      console.log(`   ✓ Has no choices/buttons: ${!response.hasChoices ? '✅' : '❌'}`);
      console.log(`   ✓ Products found: ${responseAnalysis.productCount}`);
      
      // Determine if test passed
      const testPassed = responseAnalysis.hasRoutine && 
                        responseAnalysis.hasProductLinks && 
                        responseAnalysis.hasPrices &&
                        !response.hasChoices;
      
      if (testPassed) {
        console.log(`\n✅ TEST PASSED: Routine generated directly without questions!`);
        console.log(`   Preview: ${response.content.substring(0, 250)}...`);
        passed++;
      } else {
        console.log(`\n❌ TEST FAILED: Did not generate complete routine directly`);
        console.log(`   Issues:`);
        if (!responseAnalysis.hasRoutine) console.log(`     - Missing routine structure`);
        if (!responseAnalysis.hasProductLinks) console.log(`     - Missing product links`);
        if (!responseAnalysis.hasPrices) console.log(`     - Missing product prices`);
        if (response.hasChoices) console.log(`     - Has choices/buttons (should generate directly)`);
        console.log(`   Response preview: ${response.content.substring(0, 500)}...`);
        failed++;
      }
      
    } catch (error) {
      console.error(`❌ TEST ERROR: ${error.message}`);
      failed++;
    }
  }
  
  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📈 TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total tests: ${testCases.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success rate: ${((passed / testCases.length) * 100).toFixed(1)}%`);
  
  if (passed === testCases.length) {
    console.log('\n🎉 ALL TESTS PASSED! The advanced routine generator is working correctly!');
  } else {
    console.log('\n⚠️  Some tests failed. Check the implementation.');
  }
}

function analyzeResponse(response: { content: string, hasChoices: boolean }) {
  const content = response.content.toLowerCase();
  
  return {
    hasRoutine: content.includes('routine') || 
                content.includes('mattutina') || 
                content.includes('serale'),
    hasMorningRoutine: content.includes('mattina') || 
                       content.includes('mattutina') || 
                       content.includes('morning'),
    hasEveningRoutine: content.includes('sera') || 
                       content.includes('serale') || 
                       content.includes('evening'),
    hasProductLinks: content.includes('https://beautycology.it/prodotto/'),
    hasPrices: content.includes('€'),
    productCount: (content.match(/https:\/\/beautycology\.it\/prodotto\//g) || []).length
  };
}

// Run tests
console.log('🚀 Starting Advanced Routine Integration Tests...\n');
testAdvancedRoutineIntegration()
  .then(() => {
    console.log('\n✅ Test suite completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });