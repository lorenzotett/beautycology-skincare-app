import { SkinAnalysisService, SkinAnalysisResult } from './services/skin-analysis';

console.log('🚀 Test del sistema di analisi della pelle CORRETTO');
console.log('📝 Logica: Punteggi BASSI = BUONO, Punteggi ALTI = PROBLEMATICO');

const skinAnalysis = new SkinAnalysisService();

// Test function che accede al metodo privato
function testValidation(analysis: SkinAnalysisResult): SkinAnalysisResult {
  // Accesso diretto al metodo privato tramite casting
  return (skinAnalysis as any).validateAndCorrectAnalysis(analysis);
}

console.log('\n🔧 Test funzione di validazione automatica\n');

// Test 1: Elasticità alta (problematica) con pelle giovane
console.log("Test 1: Elasticità alta (problematica) con pelle giovane");
const before1 = {
  rossori: 20,      // Buono
  acne: 15,         // Buono  
  rughe: 25,        // Buono
  pigmentazione: 30, // Buono
  pori_dilatati: 25, // Buono
  oleosita: 20,     // Buono
  danni_solari: 15, // Buono
  occhiaie: 10,     // Buono
  idratazione: 25,  // Buono (punteggio basso)
  elasticita: 65,   // PROBLEMATICO (dovrebbe essere corretto)
  texture_uniforme: 30, // Buono
  general_score: 35
};

const after1 = testValidation(before1);
console.log(`   Prima: elasticità ${before1.elasticita}`);
console.log(`   Dopo: elasticità ${after1.elasticita}`);
console.log(`   ${after1.elasticita <= 30 ? '✅' : '❌'} ${after1.elasticita <= 30 ? 'Corretta' : 'Non corretta'}`);

// Test 2: Elasticità già buona (non dovrebbe cambiare)
console.log("\nTest 2: Elasticità già buona");
const before2 = {
  rossori: 30,
  acne: 25,
  rughe: 20,
  pigmentazione: 35,
  pori_dilatati: 30,
  oleosita: 25,
  danni_solari: 20,
  occhiaie: 15,
  idratazione: 30,
  elasticita: 20,   // Già buona
  texture_uniforme: 25,
  general_score: 28
};

const after2 = testValidation(before2);
console.log(`   Prima: elasticità ${before2.elasticita}`);
console.log(`   Dopo: elasticità ${after2.elasticita}`);
console.log(`   ${after2.elasticita <= 30 ? '✅' : '❌'} ${after2.elasticita === before2.elasticita ? 'Non modificata (corretto)' : 'Modificata'}`);

// Test 3: Pelle matura con rughe severe (elasticità può rimanere problematica)
console.log("\nTest 3: Pelle matura con rughe severe");
const before3 = {
  rossori: 40,
  acne: 10,
  rughe: 75,        // Rughe severe
  pigmentazione: 65, // Problematiche
  pori_dilatati: 50,
  oleosita: 30,
  danni_solari: 70, // Danni solari evidenti
  occhiaie: 45,
  idratazione: 60,  // Idratazione scarsa
  elasticita: 70,   // Problematica ma giustificata
  texture_uniforme: 65,
  general_score: 55
};

const after3 = testValidation(before3);
console.log(`   Prima: elasticità ${before3.elasticita}`);
console.log(`   Dopo: elasticità ${after3.elasticita}`);
console.log(`   ${after3.elasticita < before3.elasticita ? '✅' : '❌'} ${after3.elasticita < before3.elasticita ? 'Migliorata' : 'Invariata/Peggiorata'}`);

console.log('\n📊 Riepilogo logica corretta:');
console.log('   0-30: Ottimo (pelle perfetta)');
console.log('   31-60: Discreto (pelle normale)');
console.log('   61-80: Da migliorare (problemi lievi)');
console.log('   81-100: Critico (problemi gravi)');

console.log('\n🎯 Sistema di validazione testato con logica corretta!');