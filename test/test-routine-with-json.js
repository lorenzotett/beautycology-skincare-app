// Test per verificare che la generazione routine includa sia testo che JSON
import { BeautycologyAI } from '../server/services/beautycology-ai.js';

async function testRoutineWithJSON() {
  console.log('🧪 Testing routine generation with text AND JSON output...\n');
  
  const ai = new BeautycologyAI();
  
  // Simulare una richiesta di generazione routine
  const testRequest = {
    sessionId: 'test-session-123',
    message: 'Ho la pelle grassa con acne e punti neri. Vorrei una routine completa.',
    userName: 'Test User',
    skinAnalysisData: {
      rossori: 20,
      acne: 75,
      rughe: 10,
      pigmentazione: 30,
      pori_dilatati: 65,
      oleosita: 80,
      danni_solari: 15,
      occhiaie: 25,
      idratazione: 40,
      elasticita: 60,
      texture_uniforme: 35
    }
  };
  
  try {
    // Chiamare direttamente il metodo generateDetailedRoutineResponse
    const response = await ai.generateDetailedRoutineResponse(
      testRequest.skinAnalysisData,
      'grassa'
    );
    
    console.log('✅ Response generated!\n');
    
    // Verificare che la risposta contenga sia testo che JSON
    const hasTextSection = response.includes('✨') || response.includes('ROUTINE');
    const hasJSONSection = response.includes('**Dati Strutturati Routine:**');
    const hasJSONCode = response.includes('```json');
    
    console.log('📋 Format Check:');
    console.log('- Has text section:', hasTextSection ? '✅' : '❌');
    console.log('- Has JSON section header:', hasJSONSection ? '✅' : '❌'); 
    console.log('- Has JSON code block:', hasJSONCode ? '✅' : '❌');
    
    // Estrarre e verificare il JSON
    if (hasJSONCode) {
      const jsonStart = response.indexOf('```json') + 7;
      const jsonEnd = response.indexOf('```', jsonStart);
      
      if (jsonEnd > jsonStart) {
        const jsonString = response.substring(jsonStart, jsonEnd).trim();
        
        try {
          const jsonData = JSON.parse(jsonString);
          
          console.log('\n📊 JSON Structure Validation:');
          console.log('- skin_type:', jsonData.skin_type ? '✅' : '❌');
          console.log('- concerns:', Array.isArray(jsonData.concerns) ? '✅' : '❌');
          console.log('- recommendations:', jsonData.recommendations ? '✅' : '❌');
          console.log('  - morning:', Array.isArray(jsonData.recommendations?.morning) ? '✅' : '❌');
          console.log('  - evening:', Array.isArray(jsonData.recommendations?.evening) ? '✅' : '❌');
          console.log('- alternation_rules:', jsonData.alternation_rules !== undefined ? '✅' : '❌');
          console.log('- notes:', jsonData.notes !== undefined ? '✅' : '❌');
          console.log('- confidence:', jsonData.confidence ? '✅' : '❌');
          console.log('- sources:', Array.isArray(jsonData.sources) ? '✅' : '❌');
          
          // Verificare limite prodotti
          const totalProducts = 
            (jsonData.recommendations?.morning?.length || 0) + 
            (jsonData.recommendations?.evening?.length || 0);
          
          console.log('\n🛍️ Product Analysis:');
          console.log(`- Total products: ${totalProducts}`);
          console.log(`- Morning products: ${jsonData.recommendations?.morning?.length || 0}`);
          console.log(`- Evening products: ${jsonData.recommendations?.evening?.length || 0}`);
          console.log(`- Within limits (≤8): ${totalProducts <= 8 ? '✅' : '❌'}`);
          
          // Mostrare i nomi dei prodotti
          if (jsonData.recommendations?.morning?.length > 0) {
            console.log('\nMorning Products:');
            jsonData.recommendations.morning.forEach((step, i) => {
              console.log(`  ${i+1}. ${step.product} (${step.step})`);
            });
          }
          
          if (jsonData.recommendations?.evening?.length > 0) {
            console.log('\nEvening Products:');
            jsonData.recommendations.evening.forEach((step, i) => {
              console.log(`  ${i+1}. ${step.product} (${step.step})`);
            });
          }
          
        } catch (parseError) {
          console.error('❌ Failed to parse JSON:', parseError.message);
        }
      }
    }
    
    // Mostrare un esempio dell'output
    console.log('\n📝 Output Sample (first 800 chars):');
    console.log('---');
    console.log(response.substring(0, 800) + '...');
    console.log('---');
    
    // Verificare che ci sia il separatore tra testo e JSON
    if (response.includes('---')) {
      const parts = response.split('---');
      console.log(`\n✅ Response has ${parts.length - 1} separator(s)`);
    }
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
  }
}

// Eseguire il test
testRoutineWithJSON().catch(console.error);