// Test per verificare che la generazione routine includa sia testo che JSON
import { AdvancedRoutineGenerator, UserAnalysis, RAGPassage } from '../server/services/advanced-routine-generator';

async function testRoutineWithJSON() {
  console.log('🧪 Testing routine generation with text AND JSON output...\n');
  
  const generator = new AdvancedRoutineGenerator();
  
  // Dati di test per l'analisi dell'utente
  const userAnalysis: UserAnalysis = {
    skin_type_detected: 'grassa',
    concerns_detected: ['acne', 'punti neri'],
    preferences: []
  };
  
  // Simulazione di passaggi RAG (prodotti dal catalogo)
  const ragPassages: RAGPassage[] = [
    {
      doc_id: 'prod_1',
      title: 'Mousse Away - Detergente viso',
      section: 'Detergenti',
      passage: 'Detergente schiumogeno delicato per pelli grasse e miste. Contiene tensioattivi delicati. €18,00',
      brand: 'Beautycology',
      language: 'it',
      product_name: 'Mousse Away',
      ingredients: ['tensioattivi delicati', 'pantenolo'],
      properties: ['Dermatologicamente testato', 'Nickel Tested']
    },
    {
      doc_id: 'prod_2',
      title: 'Multipod Gel - Gel Acido Azelaico',
      section: 'Trattamenti',
      passage: 'Gel con acido azelaico al 10% per trattamento acne e punti neri. €25,00',
      brand: 'Beautycology',
      language: 'it',
      product_name: 'Multipod Gel',
      ingredients: ['acido azelaico 10%', 'niacinamide'],
      properties: ['Non comedogenico', 'Dermatologicamente testato']
    },
    {
      doc_id: 'prod_3',
      title: 'Perfect & Pure - Crema pelli miste',
      section: 'Creme',
      passage: 'Crema idratante per pelli miste con niacinamide 4%. €30,00',
      brand: 'Beautycology',
      language: 'it',
      product_name: 'Perfect & Pure',
      ingredients: ['niacinamide 4%', 'red algae extract'],
      properties: ['Non comedogenico', 'Senza profumo']
    },
    {
      doc_id: 'prod_4',
      title: 'Invisible Shield - SPF 30',
      section: 'Protezione solare',
      passage: 'Protezione solare SPF 30 invisibile, non grassa. €22,00',
      brand: 'Beautycology',
      language: 'it',
      product_name: 'Invisible Shield SPF30',
      ingredients: ['filtri solari minerali', 'antiossidanti'],
      properties: ['SPF', 'Non comedogenico']
    }
  ];
  
  try {
    // Test generazione routine
    console.log('📊 User Analysis:', userAnalysis);
    console.log('📚 Available RAG Products:', ragPassages.length);
    console.log('\n🎯 Generating routine...\n');
    
    const result = await generator.generateRoutineFromAnalysis(userAnalysis, ragPassages);
    
    // Verificare che abbiamo sia testo che JSON
    console.log('✅ Text output generated:', result.text ? 'YES' : 'NO');
    console.log('✅ JSON output generated:', result.json ? 'YES' : 'NO');
    
    // Verificare il formato del JSON
    if (result.json) {
      console.log('\n📊 JSON Structure Check:');
      console.log('- skin_type:', result.json.skin_type);
      console.log('- concerns:', result.json.concerns);
      console.log('- morning steps:', result.json.recommendations.morning.length);
      console.log('- evening steps:', result.json.recommendations.evening.length);
      console.log('- confidence:', result.json.confidence);
      console.log('- sources count:', result.json.sources.length);
      
      // Verificare limite prodotti (1 per step, max 2 alternative)
      const totalProducts = result.json.recommendations.morning.length + 
                           result.json.recommendations.evening.length;
      console.log('\n✅ Product limits check:');
      console.log(`- Total products recommended: ${totalProducts}`);
      console.log(`- Within limits (max ~7-8 products): ${totalProducts <= 8 ? 'YES' : 'NO'}`);
      
      // Verificare che i prodotti vengano dal RAG
      const ragProductNames = ragPassages.map(p => p.product_name).filter(Boolean);
      const recommendedProducts = [
        ...result.json.recommendations.morning.map(s => s.product),
        ...result.json.recommendations.evening.map(s => s.product)
      ];
      
      console.log('\n✅ RAG products check:');
      recommendedProducts.forEach(product => {
        const fromRAG = ragProductNames.some(ragName => 
          product.toLowerCase().includes(ragName.toLowerCase()) ||
          ragName.toLowerCase().includes(product.toLowerCase())
        );
        console.log(`- ${product}: ${fromRAG ? 'FROM RAG ✓' : 'NOT FROM RAG ✗'}`);
      });
    }
    
    // Mostrare esempio del testo generato (prime 500 caratteri)
    console.log('\n📝 Text Output Sample (first 500 chars):');
    console.log(result.text.substring(0, 500) + '...');
    
    // Mostrare il JSON strutturato
    console.log('\n📋 JSON Output:');
    console.log(JSON.stringify(result.json, null, 2));
    
    console.log('\n✅ Test completed successfully!');
    console.log('\n🎉 The system now includes both natural text and structured JSON in the response!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Eseguire il test
testRoutineWithJSON();