import { SkincareRoutineService } from '../server/services/skincare-routine.js';

// Create a sample skin analysis result
const sampleSkinAnalysis = {
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

const service = new SkincareRoutineService();
const routine = service.generatePersonalizedRoutine(sampleSkinAnalysis, 'mista');

console.log('=== ROUTINE GENERATION TEST ===\n');
console.log('Skin Type:', routine.skinType);
console.log('Total Products:', routine.totalProducts);
console.log('Estimated Total Cost:', routine.estimatedTotalCost);
console.log('\n=== MORNING ROUTINE ===');

routine.morningSteps.forEach((product, index) => {
  console.log(`\n${index + 1}. ${product.name}`);
  console.log('   Price:', product.price || 'MISSING');
  console.log('   URL:', product.url || 'MISSING');
  console.log('   Has Price:', !!product.price);
  console.log('   Has URL:', !!product.url);
  console.log('   Category:', product.category);
  console.log('   Key Ingredients:', product.keyIngredients);
});

console.log('\n=== EVENING ROUTINE ===');
routine.eveningSteps.forEach((product, index) => {
  console.log(`\n${index + 1}. ${product.name}`);
  console.log('   Price:', product.price || 'MISSING');
  console.log('   URL:', product.url || 'MISSING');
  console.log('   Has Price:', !!product.price);
  console.log('   Has URL:', !!product.url);
  console.log('   Category:', product.category);
  console.log('   Key Ingredients:', product.keyIngredients);
});

console.log('\n=== DEBUGGING INFO ===');
console.log('First morning product object keys:', Object.keys(routine.morningSteps[0] || {}));
console.log('First evening product object keys:', Object.keys(routine.eveningSteps[0] || {}));