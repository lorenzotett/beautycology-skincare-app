// Test per verificare che le richieste generiche di prodotti bypassino il flusso domande

const testCases = [
  {
    message: "vorrei una crema viso per l'acne",
    expectedBehavior: "Dovrebbe consigliare prodotti per acne senza fare domande"
  },
  {
    message: "cerco qualcosa per le macchie",
    expectedBehavior: "Dovrebbe consigliare prodotti per macchie senza fare domande"
  },
  {
    message: "hai prodotti per pelle grassa",
    expectedBehavior: "Dovrebbe consigliare prodotti per pelle grassa senza fare domande"
  },
  {
    message: "mi serve un siero antirughe",
    expectedBehavior: "Dovrebbe consigliare prodotti antirughe senza fare domande"
  },
  {
    message: "cerco un prodotto per i rossori",
    expectedBehavior: "Dovrebbe consigliare prodotti per rossori senza fare domande"
  }
];

async function testProductRequests() {
  const baseUrl = 'http://localhost:5000';
  
  for (const testCase of testCases) {
    console.log('\n' + '='.repeat(60));
    console.log(`TEST: "${testCase.message}"`);
    console.log(`EXPECTED: ${testCase.expectedBehavior}`);
    console.log('='.repeat(60));
    
    try {
      // 1. Prima avvia una nuova sessione chat
      const startResponse = await fetch(`${baseUrl}/api/chat/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userName: 'Test User',
          brand: 'beautycology'
        })
      });
      
      const startData = await startResponse.json();
      const sessionId = startData.sessionId;
      
      if (!sessionId) {
        console.error('❌ FAILED: Could not start session');
        continue;
      }
      
      console.log(`✅ Session started: ${sessionId}`);
      
      // 2. Invia il messaggio di test
      const messageResponse = await fetch(`${baseUrl}/api/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId,
          message: testCase.message
        })
      });
      
      const messageData = await messageResponse.json();
      const response = messageData.message?.content || '';
      
      // 3. Verifica la risposta
      console.log('\n📝 RESPONSE:');
      console.log(response.substring(0, 500) + '...');
      
      // Check per verificare che NON ci siano domande strutturate
      const hasStructuredQuestions = 
        response.includes('Che tipo di pelle hai?') ||
        response.includes('Quanti anni hai?') ||
        response.includes('Qual è la problematica principale') ||
        response.includes('ho bisogno di farti alcune domande');
      
      // Check per verificare che CI SIANO prodotti consigliati
      const hasProductRecommendations = 
        response.includes('ti consiglio questi prodotti') ||
        response.includes('https://beautycology.it/prodotto/') ||
        response.includes('€') ||
        response.includes('Acquista ora:');
      
      if (!hasStructuredQuestions && hasProductRecommendations) {
        console.log('\n✅ PASS: La risposta contiene prodotti e NON domande strutturate');
      } else if (hasStructuredQuestions) {
        console.log('\n❌ FAIL: La risposta contiene domande strutturate invece di prodotti!');
        console.log('Domande trovate nel testo:', response.match(/Che tipo di pelle hai\?|Quanti anni hai\?|Qual è la problematica principale/g));
      } else if (!hasProductRecommendations) {
        console.log('\n❌ FAIL: La risposta NON contiene prodotti consigliati!');
      }
      
      // Attendi un po' tra i test per non sovraccaricare
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error('❌ ERROR:', error.message);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('TEST COMPLETATI');
  console.log('='.repeat(60));
}

// Esegui i test
testProductRequests().catch(console.error);